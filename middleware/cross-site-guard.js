// Rejects state-changing requests that the browser reports as coming from another site.
// Works with SameSite cookies and the Origin check in server.js, with no changes to forms.
// Server-to-server calls (such as the Paystack webhook) send no Sec-Fetch-Site header.
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function crossSiteGuard(req, res, next) {
    if (SAFE_METHODS.has(req.method)) return next();
    if (req.get('Sec-Fetch-Site') === 'cross-site') return res.sendStatus(403);
    return next();
}

module.exports = crossSiteGuard;
