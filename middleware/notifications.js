const Notification = require('../models/Notification');

// Makes the unread-notification count available to page templates for signed-in visitors.
// It only runs for ordinary page loads, and a failure simply shows no badge.
async function attachUnreadNotifications(req, res, next) {
    res.locals.unreadNotifications = 0;
    try {
        if (req.method !== 'GET' || !req.user || req.path.startsWith('/api/') || !req.accepts('html')) return next();
        res.locals.unreadNotifications = await Notification.countDocuments({ userId: req.user._id, readAt: null });
    } catch (error) {
        res.locals.unreadNotifications = 0;
    }
    return next();
}

module.exports = attachUnreadNotifications;
