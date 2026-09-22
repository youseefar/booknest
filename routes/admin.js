const express = require('express');
const Property = require('../models/Property');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/admin', requireRole('admin'), async (req, res) => {
    try {
        const [pendingProperties, recentProperties] = await Promise.all([
            Property.find({ verificationStatus: 'pending' }).populate('landlordId', 'name email').sort({ createdAt: 1 }),
            Property.find().populate('landlordId', 'name email').sort({ updatedAt: -1 }).limit(20)
        ]);
        res.render('admin', { user: req.user, pendingProperties, recentProperties });
    } catch (err) {
        res.status(500).send('Unable to load the moderation dashboard.');
    }
});

router.post('/admin/properties/:id/verification', requireRole('admin'), async (req, res) => {
    const allowed = ['pending', 'verified', 'rejected'];
    if (!allowed.includes(req.body.status)) return res.status(400).send('Invalid verification status.');
    const property = await Property.findByIdAndUpdate(req.params.id, { verificationStatus: req.body.status }, { new: true });
    if (!property) return res.status(404).send('Property not found.');
    res.redirect('/admin');
});

module.exports = router;
