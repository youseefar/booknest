const nodemailer = require('nodemailer');

// Hosts such as Render's free plan block outgoing SMTP, so mail can also go over HTTPS through Brevo
// (BREVO_API_KEY plus EMAIL_FROM, a sender address verified in Brevo). Gmail SMTP remains the fallback.
const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';

function isBrevoConfigured(environment = process.env) {
    return Boolean(environment.BREVO_API_KEY && environment.EMAIL_FROM);
}

function isEmailConfigured(environment = process.env) {
    return isBrevoConfigured(environment) || Boolean(environment.SMTP_USER && environment.SMTP_APP_PASSWORD);
}

function createTransport(environment = process.env, mailer = nodemailer) {
    const user = environment.SMTP_USER;
    const password = environment.SMTP_APP_PASSWORD?.replace(/\s/g, '');
    if (!user || !password) {
        const error = new Error('Email delivery is not configured.');
        error.code = 'EMAIL_NOT_CONFIGURED';
        error.status = 503;
        throw error;
    }

    return mailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        requireTLS: true,
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
        auth: { user, pass: password }
    });
}

async function sendViaBrevo({ to, subject, text, html }, fetchImpl, environment) {
    const response = await fetchImpl(BREVO_ENDPOINT, {
        method: 'POST',
        headers: { 'api-key': environment.BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
            sender: { name: 'Jacob Estate', email: environment.EMAIL_FROM },
            to: [{ email: to }],
            subject,
            textContent: text,
            ...(html ? { htmlContent: html } : {})
        }),
        signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) {
        const failure = new Error('Brevo rejected the message.');
        failure.code = `HTTP_${response.status}`;
        throw failure;
    }
}

async function sendEmail({ to, subject, text, html }, dependencies = {}) {
    if (!dependencies.createTransport && isBrevoConfigured()) {
        try {
            await sendViaBrevo({ to, subject, text, html }, dependencies.fetch || fetch, process.env);
            return;
        } catch (cause) {
            const error = new Error('Email delivery is temporarily unavailable.');
            error.code = 'EMAIL_DELIVERY_FAILED';
            error.reason = cause.code || cause.name;
            error.status = 503;
            throw error;
        }
    }
    const createSmtpTransport = dependencies.createTransport || createTransport;
    let transport;
    try {
        transport = createSmtpTransport();
        await transport.sendMail({
            from: `Jacob Estate <${process.env.SMTP_USER}>`,
            to,
            subject,
            text,
            ...(html ? { html } : {})
        });
    } catch (cause) {
        if (cause.code === 'EMAIL_NOT_CONFIGURED') throw cause;

        const error = new Error('Email delivery is temporarily unavailable.');
        error.code = 'EMAIL_DELIVERY_FAILED';
        error.reason = cause.code || cause.responseCode || cause.name;
        error.status = 503;
        throw error;
    } finally {
        transport?.close();
    }
}

module.exports = { createTransport, isBrevoConfigured, isEmailConfigured, sendEmail };
