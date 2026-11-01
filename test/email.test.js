const assert = require('node:assert/strict');
const test = require('node:test');
const { isEmailConfigured, sendEmail } = require('../services/email');

const originalApiKey = process.env.RESEND_API_KEY;
const originalFrom = process.env.EMAIL_FROM;
const originalFetch = global.fetch;

test.after(() => {
    if (originalApiKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = originalApiKey;
    if (originalFrom === undefined) delete process.env.EMAIL_FROM;
    else process.env.EMAIL_FROM = originalFrom;
    global.fetch = originalFetch;
});

test('email configuration requires both Resend credentials', () => {
    assert.equal(isEmailConfigured({ RESEND_API_KEY: 'key', EMAIL_FROM: 'Jacob Estate <mail@example.com>' }), true);
    assert.equal(isEmailConfigured({ RESEND_API_KEY: 'key' }), false);
    assert.equal(isEmailConfigured({ EMAIL_FROM: 'mail@example.com' }), false);
});

test('sendEmail requires configuration', async () => {
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
    await assert.rejects(sendEmail({
        to: 'buyer@example.com',
        subject: 'Reset your password',
        text: 'Follow the secure reset link.'
    }), error => error.code === 'EMAIL_NOT_CONFIGURED' && error.status === 503);
});

test('sendEmail sends plain-text messages through the Resend API', async () => {
    process.env.RESEND_API_KEY = 'test-api-key';
    process.env.EMAIL_FROM = 'Jacob Estate <mail@example.com>';
    let request;
    global.fetch = async (url, options) => {
        request = { url, options };
        return { ok: true, status: 200 };
    };

    await sendEmail({
        to: 'buyer@example.com',
        subject: 'Reset your password',
        text: 'Follow the secure reset link.'
    });

    assert.equal(request.url, 'https://api.resend.com/emails');
    assert.equal(request.options.headers.Authorization, 'Bearer test-api-key');
    assert.deepEqual(JSON.parse(request.options.body), {
        from: 'Jacob Estate <mail@example.com>',
        to: ['buyer@example.com'],
        subject: 'Reset your password',
        text: 'Follow the secure reset link.'
    });
});

test('sendEmail reports provider errors without returning provider response content', async () => {
    process.env.RESEND_API_KEY = 'test-api-key';
    process.env.EMAIL_FROM = 'Jacob Estate <mail@example.com>';
    global.fetch = async () => ({ ok: false, status: 429 });

    await assert.rejects(sendEmail({
        to: 'buyer@example.com',
        subject: 'Reset your password',
        text: 'Follow the secure reset link.'
    }), error => error.code === 'EMAIL_DELIVERY_FAILED' && error.status === 503);
});
