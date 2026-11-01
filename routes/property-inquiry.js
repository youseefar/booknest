const express = require('express');
const mongoose = require('mongoose');
const Property = require('../models/Property');
const PropertyInquiry = require('../models/PropertyInquiry');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

router.post('/property/:id/inquiries', requireRole('student'), async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).send('Property not found.');

    const message = String(req.body.message || '').trim();
    if (message.length > 1000) return res.status(400).send('Your message must be 1,000 characters or fewer.');

    try {
        const property = await Property.findOne({
            _id: req.params.id,
            listingType: 'sale',
            status: 'available',
            verificationStatus: 'verified'
        });
        if (!property) return res.status(404).send('This property is not available for sale.');

        await PropertyInquiry.create({
            buyerId: req.user._id,
            propertyId: property._id,
            message
        });
        return res.redirect(`/property/${property._id}?inquiry=submitted`);
    } catch (error) {
        if (error.code === 11000) return res.redirect(`/property/${req.params.id}?inquiry=exists`);
        console.error('Property sale inquiry submission failed:', error.message);
        return res.status(500).send('Unable to send your inquiry right now.');
    }
});

router.get('/sales-inquiries', requireRole('landlord'), async (req, res) => {
    try {
        const properties = await Property.find({ landlordId: req.user._id, listingType: 'sale' }).select('_id');
        const inquiries = await PropertyInquiry.find({ propertyId: { $in: properties.map(property => property._id) } })
            .populate('buyerId', 'name email phone')
            .populate('propertyId', 'title location price status listingType')
            .sort({ timestamp: -1 });
        return res.render('property-inquiries', { inquiries, user: req.user, sellerView: true });
    } catch (error) {
        console.error('Seller property inquiries could not be loaded:', error.message);
        return res.status(500).send('Unable to load your sale inquiries.');
    }
});

router.get('/my-property-inquiries', requireRole('student'), async (req, res) => {
    try {
        const inquiries = await PropertyInquiry.find({ buyerId: req.user._id })
            .populate({ path: 'propertyId', populate: { path: 'landlordId', select: 'name email phone' } })
            .sort({ timestamp: -1 });
        return res.render('property-inquiries', { inquiries, user: req.user, sellerView: false });
    } catch (error) {
        console.error('Buyer property inquiries could not be loaded:', error.message);
        return res.status(500).send('Unable to load your sale inquiries.');
    }
});

router.post('/sales-inquiries/:id/status', requireRole('landlord'), async (req, res) => {
    const allowedStatuses = ['pending', 'viewed', 'contacted', 'rejected'];
    if (!allowedStatuses.includes(req.body.status)) return res.status(400).send('Invalid inquiry status.');
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).send('Inquiry not found.');

    const inquiry = await PropertyInquiry.findById(req.params.id).populate('propertyId', 'landlordId');
    if (!inquiry || !inquiry.propertyId || String(inquiry.propertyId.landlordId) !== String(req.user._id)) {
        return res.status(404).send('Inquiry not found.');
    }

    inquiry.status = req.body.status;
    await inquiry.save();
    return res.redirect('/sales-inquiries');
});

module.exports = router;
