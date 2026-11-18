const express = require('express');
const Notification = require('../models/Notification');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/notifications', requireAuth, async (req, res, next) => {
    try {
        const notifications = await Notification.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(50).lean();
        const unreadIds = notifications.filter(item => !item.readAt).map(item => item._id);
        if (unreadIds.length) {
            await Notification.updateMany({ userId: req.user._id, _id: { $in: unreadIds } }, { $set: { readAt: new Date() } });
        }
        // The list shows what was new on arrival; the badge is cleared once it has been seen.
        res.locals.unreadNotifications = 0;
        return res.render('notifications', { user: req.user, notifications });
    } catch (error) {
        return next(error);
    }
});

module.exports = router;
