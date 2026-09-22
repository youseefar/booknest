const express = require('express');
const Booking = require('../models/Booking');
const Property = require('../models/Property');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/inquiries', requireRole('landlord'), async (req, res) => {
    try {
        const properties = await Property.find({ landlordId: req.user._id }).select('_id title');
        const propertyIds = properties.map(property => property._id);
        const inquiries = await Booking.find({ propertyId: { $in: propertyIds } })
            .populate('studentId', 'name email phone')
            .populate('propertyId', 'title location price')
            .sort({ timestamp: -1 });
        res.render('inquiries', { inquiries, user: req.user, landlordView: true });
    } catch (err) {
        res.status(500).send('Unable to load inquiries.');
    }
});

router.post('/inquiries/:id/status', requireRole('landlord'), async (req, res) => {
    const allowed = ['pending', 'viewed', 'approved', 'rejected'];
    if (!allowed.includes(req.body.status)) return res.status(400).send('Invalid inquiry status.');

    const inquiry = await Booking.findById(req.params.id).populate('propertyId', 'landlordId');
    if (!inquiry || String(inquiry.propertyId.landlordId) !== String(req.user._id)) return res.status(404).send('Inquiry not found.');
    inquiry.status = req.body.status;
    inquiry.landlordViewed = true;
    await inquiry.save();
    res.redirect('/inquiries');
});

router.get('/my-inquiries', requireRole('student'), async (req, res) => {
    try {
        const inquiries = await Booking.find({ studentId: req.user._id })
            .populate({ path: 'propertyId', populate: { path: 'landlordId', select: 'name email phone' } })
            .sort({ timestamp: -1 });
        res.render('inquiries', { inquiries, user: req.user, landlordView: false });
    } catch (err) {
        res.status(500).send('Unable to load your inquiries.');
    }
});

module.exports = router;
