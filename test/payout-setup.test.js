const test = require('node:test');
const assert = require('node:assert/strict');

process.env.PAYSTACK_SECRET_KEY = 'sk_test_unit_test_key';
const { isPayoutReady, requirePayoutSetup } = require('../middleware/payout-setup');

function run({ role = 'landlord', user = {}, path = '/dashboard', method = 'GET', authenticated = true } = {}) {
    const req = {
        path,
        method,
        isAuthenticated: () => authenticated,
        user: authenticated ? { role, ...user } : undefined,
        app: { locals: { paystackMode: 'test' } }
    };
    const result = { next: false, redirect: null, status: null };
    const res = {
        redirect: location => { result.redirect = location; },
        status: code => { result.status = code; return { send: () => {} }; }
    };
    requirePayoutSetup(req, res, () => { result.next = true; });
    return result;
}

const ready = { payoutSubaccountCode: 'ACCT_1', payoutSubaccountMode: 'test' };

test('a landlord without a payout account is sent to the setup page from every landlord page', () => {
    for (const path of ['/dashboard', '/add-property', '/my-properties', '/profile', '/bookings', '/inquiries', '/sales-inquiries', '/property/abc123/edit', '/property/abc123/video', '/property/abc123/status']) {
        const result = run({ path });
        assert.equal(result.redirect, '/payout-setup', path);
        assert.equal(result.next, false, path);
    }
});

test('a landlord who has not set up payouts cannot post to landlord actions', () => {
    const result = run({ path: '/add-property', method: 'POST' });
    assert.equal(result.status, 403);
    assert.equal(result.next, false);
});

test('the setup page, the payout endpoints, logout and public pages stay reachable', () => {
    for (const path of ['/payout-setup', '/payments/banks', '/payments/resolve-payout-account', '/payments/payout-account', '/logout', '/', '/properties', '/property/abc123', '/terms']) {
        const result = run({ path, method: path.startsWith('/payments/') && path !== '/payments/banks' ? 'POST' : 'GET' });
        assert.equal(result.next, true, path);
    }
});

test('a landlord with a payout account for the current Paystack mode passes through', () => {
    assert.equal(run({ user: ready }).next, true);
    assert.equal(isPayoutReady(ready, 'test'), true);
});

test('a payout account from another Paystack mode does not count', () => {
    const result = run({ user: { ...ready, payoutSubaccountMode: 'live' } });
    assert.equal(result.redirect, '/payout-setup');
    assert.equal(isPayoutReady({ ...ready, payoutSubaccountMode: 'live' }, 'test'), false);
});

test('students, admins and signed-out visitors are not affected', () => {
    assert.equal(run({ role: 'student' }).next, true);
    assert.equal(run({ role: 'admin', path: '/dashboard' }).next, true);
    assert.equal(run({ authenticated: false }).next, true);
});
