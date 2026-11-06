// Content Security Policy for Jacob Estate. Pages use only external scripts, so inline
// script is not allowed. form-action is intentionally not set: browsers apply it to the
// redirects after a form post, which would block the hand-off to Paystack and Google.
function buildContentSecurityPolicy({ production = false } = {}) {
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
    return { useDefaults: false, directives };
}

module.exports = { buildContentSecurityPolicy };
