const PAYSTACK_API = 'https://api.paystack.co';

function getPaymentMode() {
    const configuredMode = String(process.env.PAYSTACK_MODE || '').trim().toLowerCase();
    if (configuredMode === 'test' || configuredMode === 'live') return configuredMode;
    return process.env.NODE_ENV === 'production' ? 'live' : 'test';
}

function getPaystackSecretKey() {
    const secretKey = process.env.PAYSTACK_SECRET_KEY || '';
    const requiredPrefix = getPaymentMode() === 'live' ? 'sk_live_' : 'sk_test_';
    return secretKey.startsWith(requiredPrefix) ? secretKey : null;
}

function paystackConfigurationMessage() {
    const secretKey = process.env.PAYSTACK_SECRET_KEY || '';
    if (getPaymentMode() === 'test' && secretKey.startsWith('sk_live_')) {
        return 'A live Paystack key is configured while payment mode is test. Set PAYSTACK_MODE=live in your local environment and restart the app to enable live payments.';
    }
    if (getPaymentMode() === 'live' && secretKey.startsWith('sk_test_')) {
        return 'A test Paystack key is configured while payment mode is live. Set PAYSTACK_MODE=test or use a live key.';
    }
    return getPaymentMode() === 'live'
        ? 'Live Paystack payments are not configured. Set a PAYSTACK_SECRET_KEY beginning with sk_live_.'
        : 'Test Paystack payments are not configured. Set a PAYSTACK_SECRET_KEY beginning with sk_test_.';
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

module.exports = { PAYSTACK_API, getPaymentMode, getPaystackSecretKey, paystackConfigurationMessage, paystackRequest };
