const { getPaystackSecretKey } = require('../services/paystack');

// Landlords must connect a verified payout account before using their dashboard or listing tools.
const GATED_PATHS = [
    /^\/dashboard\/?$/,
    /^\/add-property\/?$/,
    /^\/my-properties\/?$/,
    /^\/profile(\/|$)/,
    /^\/bookings(\/|$)/,
    /^\/inquiries(\/|$)/,
    /^\/sales-inquiries(\/|$)/,
    /^\/property\/[^/]+\/(edit|video|status)(\/|$)/
];

function isPayoutReady(user, paymentMode) {
    return Boolean(user?.payoutSubaccountCode) && user.payoutSubaccountMode === paymentMode;
}

function requirePayoutSetup(req, res, next) {
    const isLandlord = req.isAuthenticated && req.isAuthenticated() && req.user?.role === 'landlord';
    if (!isLandlord) return next();
    if (!GATED_PATHS.some(pattern => pattern.test(req.path))) return next();
    // Without a Paystack key nobody can finish setup, so do not lock owners out of their account.
    if (!getPaystackSecretKey()) return next();
    if (isPayoutReady(req.user, req.app.locals.paystackMode)) return next();
    if (req.method === 'GET' || req.method === 'HEAD') return res.redirect('/payout-setup');
    return res.status(403).send('Add your payout account before continuing.');
}

module.exports = { isPayoutReady, requirePayoutSetup };
