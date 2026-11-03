const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');
const { isDatabaseError, isStorageLimitError } = require('../services/database-errors');
const {
    getPaymentMode,
    getPaystackSecretKey,
    isVerifiedPaystackTransaction,
    paystackRequest,
    verifyWebhookSignature
} = require('../services/paystack');

const originalFetch = global.fetch;
const originalEnvironment = {
    NODE_ENV: process.env.NODE_ENV,
    PAYSTACK_MODE: process.env.PAYSTACK_MODE,
    PAYSTACK_SECRET_KEY: process.env.PAYSTACK_SECRET_KEY
};

test.after(() => {
    global.fetch = originalFetch;
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
    assert.equal(isVerifiedPaystackTransaction(booking, '', transaction), false);
    assert.equal(isVerifiedPaystackTransaction({
        ...booking,
        paymentAmountKobo: null
    }, 'payment-789', { ...transaction, amount: null }), false);
    assert.equal(isVerifiedPaystackTransaction(booking, 'other-reference', transaction), false);
    assert.equal(isVerifiedPaystackTransaction(booking, 'payment-789', { ...transaction, amount: 250001 }), false);
    assert.equal(isVerifiedPaystackTransaction(booking, 'payment-789', { ...transaction, currency: 'USD' }), false);
    assert.equal(isVerifiedPaystackTransaction(booking, 'payment-789', {
        ...transaction,
        customer: { email: 'other@example.com' }
    }), false);
    assert.equal(isVerifiedPaystackTransaction(booking, 'payment-789', {
        ...transaction,
        customer: { email: {} }
    }), false);
    assert.equal(isVerifiedPaystackTransaction(booking, 'payment-789', {
        ...transaction,
        metadata: { ...transaction.metadata, property_id: 'other-property' }
    }), false);
    assert.equal(isVerifiedPaystackTransaction(booking, 'payment-789', {
        ...transaction,
        metadata: { ...transaction.metadata, booking_id: 'other-booking' }
    }), false);
});

test('paystackRequest sends bearer authentication and returns successful data', async () => {
    let requestUrl;
    let requestOptions;
    global.fetch = async (url, options) => {
        requestUrl = url;
        requestOptions = options;
        return {
            ok: true,
            status: 200,
            json: async () => ({ status: true, data: { reference: 'payment-789' } })
        };
    };

    const result = await paystackRequest('/transaction/initialize', ' sk_test_local ', {
        method: 'POST',
        body: JSON.stringify({ amount: 10000 })
    });

    assert.equal(requestUrl, 'https://api.paystack.co/transaction/initialize');
    assert.equal(requestOptions.headers.get('Authorization'), 'Bearer sk_test_local');
    assert.equal(requestOptions.headers.get('Content-Type'), 'application/json');
    assert.ok(requestOptions.signal instanceof AbortSignal);
    assert.deepEqual(result, { reference: 'payment-789' });
});

test('paystackRequest reports API errors and invalid non-JSON responses', async () => {
    global.fetch = async () => ({
        ok: true,
        status: 200,
        json: async () => ({ status: false, message: 'Invalid key.' })
    });
    await assert.rejects(
        paystackRequest('/transaction/verify/reference', 'sk_test_local'),
        { message: 'Invalid key.' }
    );

    global.fetch = async () => ({
        ok: false,
        status: 502,
        json: async () => { throw new SyntaxError('invalid JSON'); }
    });
    await assert.rejects(
        paystackRequest('/transaction/verify/reference', 'sk_test_local'),
        { message: 'Paystack returned an invalid response.' }
    );
});

test('paystackRequest preserves network failures for callers', async () => {
    const networkError = new TypeError('fetch failed');
    global.fetch = async () => { throw networkError; };

    await assert.rejects(
        paystackRequest('/transaction/verify/reference', 'sk_test_local'),
        error => error === networkError
    );
});

test('database outages and storage-quota errors are classified for the friendly error page', () => {
    assert.equal(isDatabaseError({ name: 'MongoServerError' }), true);
    assert.equal(isStorageLimitError({ message: 'You have exceeded your space quota.' }), true);
    assert.equal(isStorageLimitError({ message: 'A required field is missing.' }), false);
});
