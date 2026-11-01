const crypto = require('crypto');

const PAYSTACK_API = 'https://api.paystack.co';

function getPaymentMode() {
    if (process.env.NODE_ENV !== 'production') return 'test';
    const configuredMode = String(process.env.PAYSTACK_MODE || '').trim().toLowerCase();
    if (configuredMode === 'test' || configuredMode === 'live') return configuredMode;
    return 'live';
}

function getPaystackSecretKey() {
    const secretKey = process.env.PAYSTACK_SECRET_KEY || '';
    const requiredPrefix = getPaymentMode() === 'live' ? 'sk_live_' : 'sk_test_';
    return secretKey.startsWith(requiredPrefix) ? secretKey : null;
}

function paystackConfigurationMessage() {
    const secretKey = process.env.PAYSTACK_SECRET_KEY || '';
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
    if (!Buffer.isBuffer(rawBody) || !secretKey || !/^[a-f\d]{128}$/i.test(String(signature || ''))) return false;
    const expected = crypto.createHmac('sha512', secretKey).update(rawBody).digest();
    const submitted = Buffer.from(signature, 'hex');
    return expected.length === submitted.length && crypto.timingSafeEqual(expected, submitted);
}

function isVerifiedPaystackTransaction(booking, reference, transaction) {
    const propertyId = booking.propertyId?._id || booking.propertyId;
    return transaction?.status === 'success'
        && transaction.reference === reference
        && transaction.amount === booking.paymentAmountKobo
        && transaction.currency === 'NGN'
        && transaction.customer?.email?.toLowerCase() === booking.studentId?.email?.toLowerCase()
        && String(transaction.metadata?.booking_id) === String(booking._id)
        && String(transaction.metadata?.property_id) === String(propertyId);
}

async function paystackRequest(endpoint, secretKey, options = {}) {
    const response = await fetch(`${PAYSTACK_API}${endpoint}`, {
        ...options,
        headers: {
            Authorization: `Bearer ${secretKey}`,
            'Content-Type': 'application/json',
            ...options.headers
        },
        signal: options.signal || AbortSignal.timeout(15000)
    });
    const result = await response.json();
    if (!response.ok || result?.status !== true) {
        throw new Error(result?.message || 'Paystack request failed.');
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
