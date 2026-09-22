function requireAuth(req, res, next) {
    if (req.isAuthenticated && req.isAuthenticated()) return next();
    res.redirect('/login');
}

function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.isAuthenticated || !req.isAuthenticated()) return res.redirect('/login');
        if (roles.includes(req.user.role)) return next();
        res.status(403).send('You do not have permission to access this page.');
    };
}

module.exports = { requireAuth, requireRole };
