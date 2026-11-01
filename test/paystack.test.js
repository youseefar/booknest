const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');
const { isDatabaseError, isStorageLimitError } = require('../services/database-errors');
const {
    getPaymentMode,
    getPaystackSecretKey,
    isVerifiedPaystackTransaction,
    verifyWebhookSignature
} = require('../services/paystack');

const originalEnvironment = {
    NODE_ENV: process.env.NODE_ENV,
    PAYSTACK_MODE: process.env.PAYSTACK_MODE,
    PAYSTACK_SECRET_KEY: process.env.PAYSTACK_SECRET_KEY
};

test.after(() => {
    for (const [key, value] of Object.entries(originalEnvironment)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
    }
});

test('non-production always selects test mode, even if live is requested', () => {
    process.env.NODE_ENV = 'development';
    process.env.PAYSTACK_MODE = 'live';
    process.env.PAYSTACK_SECRET_KEY = 'sk_test_local';

    assert.equal(getPaymentMode(), 'test');
    assert.equal(getPaystackSecretKey(), 'sk_test_local');
});

test('production defaults to live mode and rejects test keys for live requests', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.PAYSTACK_MODE;
    process.env.PAYSTACK_SECRET_KEY = 'sk_test_local';

    assert.equal(getPaymentMode(), 'live');
    assert.equal(getPaystackSecretKey(), null);
});

test('webhook signature validates the exact raw body', () => {
    const rawBody = Buffer.from('{"event":"charge.success"}');
    const secret = 'test-secret';
    const signature = crypto.createHmac('sha512', secret).update(rawBody).digest('hex');

    assert.equal(verifyWebhookSignature(rawBody, signature, secret), true);
    assert.equal(verifyWebhookSignature(Buffer.from('{}'), signature, secret), false);
    assert.equal(verifyWebhookSignature(rawBody, 'invalid', secret), false);
});

test('verified transaction must match booking, reference, amount, currency, customer, and metadata', () => {
    const booking = {
        _id: 'booking-123',
        paymentAmountKobo: 250000,
        studentId: { email: 'renter@example.com' },
        propertyId: { _id: 'property-456' }
    };
    const transaction = {
        status: 'success',
        reference: 'payment-789',
        amount: 250000,
        currency: 'NGN',
        customer: { email: 'RENTER@example.com' },
        metadata: { booking_id: 'booking-123', property_id: 'property-456' }
    };

    assert.equal(isVerifiedPaystackTransaction(booking, 'payment-789', transaction), true);
    assert.equal(isVerifiedPaystackTransaction(booking, 'other-reference', transaction), false);
    assert.equal(isVerifiedPaystackTransaction(booking, 'payment-789', { ...transaction, amount: 250001 }), false);
    assert.equal(isVerifiedPaystackTransaction(booking, 'payment-789', { ...transaction, currency: 'USD' }), false);
    assert.equal(isVerifiedPaystackTransaction(booking, 'payment-789', {
        ...transaction,
        metadata: { ...transaction.metadata, booking_id: 'other-booking' }
    }), false);
});

test('database outages and storage-quota errors are classified for the friendly error page', () => {
    assert.equal(isDatabaseError({ name: 'MongoServerError' }), true);
    assert.equal(isStorageLimitError({ message: 'You have exceeded your space quota.' }), true);
    assert.equal(isStorageLimitError({ message: 'A required field is missing.' }), false);
});
