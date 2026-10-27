const express = require('express');
const Booking = require('../models/Booking');
const Property = require('../models/Property');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

const renderBookings = async (req, res, landlordView) => {
    try {
        await Booking.syncExpiredSubscriptions();
        if (landlordView) {
            const properties = await Property.find({ landlordId: req.user._id }).select('_id title');
            const propertyIds = properties.map(property => property._id);
            const bookings = await Booking.find({
                propertyId: { $in: propertyIds },
                status: { $ne: 'awaiting_payment' }
            })
                .populate('studentId', 'name email phone')
                .populate('propertyId', 'title location price')
                .sort({ timestamp: -1 });
                res.render('bookings', { inquiries: bookings, user: req.user, landlordView: true, bookings, paymentResult: req.query.payment, receiptReference: '' });
            return;
        }

        const bookings = await Booking.find({ studentId: req.user._id })
            .populate({ path: 'propertyId', populate: { path: 'landlordId', select: 'name email phone' } })
            .sort({ timestamp: -1 });
        res.render('bookings', {
            inquiries: bookings,
            user: req.user,
            landlordView: false,
            bookings,
            paymentResult: req.query.payment,
            receiptReference: String(req.query.reference || '').slice(0, 100)
        });
    } catch (err) {
        res.status(500).send(landlordView ? 'Unable to load bookings.' : 'Unable to load your bookings.');
    }
};

router.get('/bookings', requireRole('landlord'), async (req, res) => {
    await renderBookings(req, res, true);
});

router.get('/inquiries', requireRole('landlord'), async (req, res) => {
    res.redirect('/bookings');
});

router.post('/bookings/:id/status', requireRole('landlord'), async (req, res) => {
    const allowed = ['pending', 'viewed', 'approved', 'rejected'];
    if (!allowed.includes(req.body.status)) return res.status(400).send('Invalid booking status.');

    const booking = await Booking.findById(req.params.id).populate('propertyId', 'landlordId');
    if (!booking || String(booking.propertyId.landlordId) !== String(req.user._id)) return res.status(404).send('Booking not found.');
    booking.status = req.body.status;
    booking.landlordViewed = true;
    await booking.save();
    res.redirect('/bookings');
});

router.post('/inquiries/:id/status', requireRole('landlord'), async (req, res) => {
    res.redirect('/bookings');
});

router.get('/my-bookings', requireRole('student'), async (req, res) => {
    await renderBookings(req, res, false);
});

router.get('/my-inquiries', requireRole('student'), async (req, res) => {
    res.redirect('/my-bookings');
});

module.exports = router;
