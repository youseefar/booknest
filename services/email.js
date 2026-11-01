const RESEND_API_URL = 'https://api.resend.com/emails';

function isEmailConfigured(environment = process.env) {
    return Boolean(environment.RESEND_API_KEY && environment.EMAIL_FROM);
}

async function sendEmail({ to, subject, text }) {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM;
    if (!apiKey || !from) {
        const error = new Error('Email delivery is not configured.');
        error.code = 'EMAIL_NOT_CONFIGURED';
        error.status = 503;
        throw error;
    }

    let response;
    try {
        response = await fetch(RESEND_API_URL, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ from, to: [to], subject, text }),
            signal: AbortSignal.timeout(10000)
        });
    } catch (cause) {
        const error = new Error('Email delivery is temporarily unavailable.', { cause });
        error.code = 'EMAIL_DELIVERY_FAILED';
        error.status = 503;
        throw error;
    }

    if (!response.ok) {
        const error = new Error('Email delivery is temporarily unavailable.');
        error.code = 'EMAIL_DELIVERY_FAILED';
        error.status = response.status >= 500 || response.status === 429 ? 503 : 502;
        throw error;
    }
}

module.exports = { isEmailConfigured, sendEmail };
