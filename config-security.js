// Content Security Policy for Jacob Estate. Pages use only external scripts, so inline
// script is not allowed. form-action is intentionally not set: browsers apply it to the
// redirects after a form post, which would block the hand-off to Paystack and Google.
function buildContentSecurityPolicy({ production = false, enforce = false } = {}) {
    const directives = {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", 'https://cdn.jsdelivr.net'],
        scriptSrcAttr: ["'none'"],
        styleSrc: ["'self'", 'https://cdn.jsdelivr.net', 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://cdn.jsdelivr.net', 'https://fonts.gstatic.com', 'data:'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https://images.unsplash.com', 'https://res.cloudinary.com'],
        mediaSrc: ["'self'", 'blob:', 'https://res.cloudinary.com'],
        connectSrc: ["'self'"],
        workerSrc: ["'self'"],
        manifestSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'self'"]
    };
    if (production) directives.upgradeInsecureRequests = [];
    // Report-only until CSP_ENFORCE=true, so the owner can confirm in a real browser console
    // that nothing is blocked before the policy is enforced.
    return { useDefaults: false, reportOnly: !enforce, directives };
}

module.exports = { buildContentSecurityPolicy };
