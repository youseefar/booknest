const crypto = require('crypto');

const PAYSTACK_API = 'https://api.paystack.co';

function normalizeSecretKey(secretKey) {
    return typeof secretKey === 'string' ? secretKey.trim() : '';
}

function getPaymentMode() {
    if (process.env.NODE_ENV !== 'production') return 'test';
    const configuredMode = String(process.env.PAYSTACK_MODE || '').trim().toLowerCase();
    if (configuredMode === 'test' || configuredMode === 'live') return configuredMode;
    return 'live';
}

function getPaystackSecretKey() {
    const secretKey = normalizeSecretKey(process.env.PAYSTACK_SECRET_KEY || '');
    const requiredPrefix = getPaymentMode() === 'live' ? 'sk_live_' : 'sk_test_';
    return secretKey.startsWith(requiredPrefix) ? secretKey : null;
}

function paystackConfigurationMessage() {
    const secretKey = normalizeSecretKey(process.env.PAYSTACK_SECRET_KEY || '');
    if (getPaymentMode() === 'test' && secretKey.startsWith('sk_live_')) {
        return 'A live Paystack key cannot be used outside production. Configure a test key beginning with sk_test_.';
    }
    if (getPaymentMode() === 'live' && secretKey.startsWith('sk_test_')) {
        return 'A test Paystack key is configured for production live mode. Use a live key beginning with sk_live_.';
    }
    return getPaymentMode() === 'live'
        ? 'Live Paystack payments are not configured. Set a PAYSTACK_SECRET_KEY beginning with sk_live_.'
        : 'Test Paystack payments are not configured. Set a PAYSTACK_SECRET_KEY beginning with sk_test_.';
}

function verifyWebhookSignature(rawBody, signature, secretKey) {
    const normalizedSecretKey = normalizeSecretKey(secretKey);
    if (!Buffer.isBuffer(rawBody) || !normalizedSecretKey || !/^[a-f\d]{128}$/i.test(String(signature || ''))) return false;
    const expected = crypto.createHmac('sha512', normalizedSecretKey).update(rawBody).digest();
    const submitted = Buffer.from(signature, 'hex');
    return expected.length === submitted.length && crypto.timingSafeEqual(expected, submitted);
}

function isVerifiedPaystackTransaction(booking, reference, transaction) {
    const propertyId = booking.propertyId?._id || booking.propertyId;
    const expectedEmail = String(booking.studentId?.email ?? '').trim().toLowerCase();
    const transactionEmail = String(transaction?.customer?.email ?? '').trim().toLowerCase();
    return typeof reference === 'string'
        && reference.length > 0
        && Number.isSafeInteger(booking.paymentAmountKobo)
        && booking.paymentAmountKobo > 0
        && Number.isSafeInteger(transaction?.amount)
        && transaction.amount > 0
        && Boolean(booking._id)
        && Boolean(propertyId)
        && transaction?.status === 'success'
        && transaction.reference === reference
        && transaction.amount === booking.paymentAmountKobo
        && transaction.currency === 'NGN'
        && expectedEmail !== ''
        && transactionEmail === expectedEmail
        && String(transaction.metadata?.booking_id) === String(booking._id)
        && String(transaction.metadata?.property_id) === String(propertyId);
}

async function paystackRequest(endpoint, secretKey, options = {}) {
    const normalizedSecretKey = normalizeSecretKey(secretKey);
    if (!normalizedSecretKey) throw new Error("Paystack secret key is required.");

    const headers = new Headers(options.headers || {});
    headers.set("Authorization", "Bearer " + normalizedSecretKey);
    if (!headers.has('Content-Type') && (options.method === 'POST' || options.method === 'PUT' || options.method === 'PATCH')) {
        headers.set("Content-Type", "application/json");
    }

    const timeoutSignal = AbortSignal.timeout(15000);
    const signal = options.signal
        ? AbortSignal.any([options.signal, timeoutSignal])
        : timeoutSignal;
    const response = await fetch(PAYSTACK_API + endpoint, {
        ...options,
        headers,
        signal
    });

    let result;
    try {
        result = await response.json();
    } catch (cause) {
        throw new Error('Paystack returned an invalid response.', { cause });
    }

    if (!response.ok || result?.status !== true) {
        const message = typeof result?.message === 'string' && result.message.trim()
            ? result.message
            : 'Paystack request failed.';
        throw new Error(message);
    }
    return result.data;
}

module.exports = {
    PAYSTACK_API,
    getPaymentMode,
    getPaystackSecretKey,
    isVerifiedPaystackTransaction,
    paystackConfigurationMessage,
    paystackRequest,
    verifyWebhookSignature
};
