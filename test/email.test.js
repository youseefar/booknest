const assert = require('node:assert/strict');
const test = require('node:test');
const { createTransport, isEmailConfigured, sendEmail } = require('../services/email');

const originalUser = process.env.SMTP_USER;
const originalPassword = process.env.SMTP_APP_PASSWORD;

test.after(() => {
    if (originalUser === undefined) delete process.env.SMTP_USER;
    else process.env.SMTP_USER = originalUser;
    if (originalPassword === undefined) delete process.env.SMTP_APP_PASSWORD;
    else process.env.SMTP_APP_PASSWORD = originalPassword;
});

test('email configuration requires the Gmail address and app password', () => {
    assert.equal(isEmailConfigured({ SMTP_USER: 'jacob@example.com', SMTP_APP_PASSWORD: 'app-password' }), true);
    assert.equal(isEmailConfigured({ SMTP_USER: 'jacob@example.com' }), false);
    assert.equal(isEmailConfigured({ SMTP_APP_PASSWORD: 'app-password' }), false);
});

test('Gmail transport requires configuration and removes App Password spaces', () => {
    assert.throws(() => createTransport({ SMTP_USER: 'jacob@example.com' }), error =>
        error.code === 'EMAIL_NOT_CONFIGURED' && error.status === 503
    );

    let options;
    createTransport({
        SMTP_USER: 'jacob@example.com',
        SMTP_APP_PASSWORD: 'abcd efgh ijkl mnop'
    }, {
        createTransport: settings => {
            options = settings;
            return {};
        }
    });
    assert.equal(options.host, 'smtp.gmail.com');
    assert.equal(options.port, 587);
    assert.equal(options.secure, false);
    assert.equal(options.requireTLS, true);
    assert.equal(options.auth.user, 'jacob@example.com');
    assert.equal(options.auth.pass, 'abcdefghijklmnop');
});

test('sendEmail sends through the configured Gmail identity and closes its transport', async () => {
    process.env.SMTP_USER = 'jacob@example.com';
    process.env.SMTP_APP_PASSWORD = 'gmail-app-password';
    let message;
    let closed = false;
    await sendEmail({
        to: 'buyer@example.com',
        subject: 'Reset your password',
        text: 'Follow the secure reset link.'
    }, {
        createTransport: () => ({
            sendMail: async value => { message = value; },
            close: () => { closed = true; }
        })
    });

    assert.deepEqual(message, {
        from: 'Jacob Estate <jacob@example.com>',
        to: 'buyer@example.com',
        subject: 'Reset your password',
        text: 'Follow the secure reset link.'
    });
    assert.equal(closed, true);
});

test('sendEmail returns a sanitized error when SMTP delivery fails', async () => {
    process.env.SMTP_USER = 'jacob@example.com';
    process.env.SMTP_APP_PASSWORD = 'gmail-app-password';
    await assert.rejects(sendEmail({
        to: 'buyer@example.com',
        subject: 'Reset your password',
        text: 'Follow the secure reset link.'
    }, {
        createTransport: () => ({
            sendMail: async () => { throw new Error('provider response with private detail'); },
            close() {}
        })
    }), error => error.code === 'EMAIL_DELIVERY_FAILED'
        && error.status === 503
        && !error.message.includes('private detail'));
});
