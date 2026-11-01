const nodemailer = require('nodemailer');

function isEmailConfigured(environment = process.env) {
    return Boolean(environment.SMTP_USER && environment.SMTP_APP_PASSWORD);
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

async function sendEmail({ to, subject, text }, dependencies = {}) {
    const createSmtpTransport = dependencies.createTransport || createTransport;
    let transport;
    try {
        transport = createSmtpTransport();
        await transport.sendMail({
            from: `Jacob Estate <${process.env.SMTP_USER}>`,
            to,
            subject,
            text
        });
    } catch (cause) {
        if (cause.code === 'EMAIL_NOT_CONFIGURED') throw cause;

        const error = new Error('Email delivery is temporarily unavailable.');
        error.code = 'EMAIL_DELIVERY_FAILED';
        error.status = 503;
        throw error;
    } finally {
        transport?.close();
    }
}

module.exports = { createTransport, isEmailConfigured, sendEmail };
