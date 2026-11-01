const express = require('express');
const mongoose = require('mongoose');
const Property = require('../models/Property');
const PropertyInquiry = require('../models/PropertyInquiry');
const { requireRole } = require('../middleware/auth');
const { isEmailConfigured, sendEmail } = require('../services/email');

const router = express.Router();

router.post('/property/:id/inquiries', requireRole('student'), async (req, res, next) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).send('Property not found.');

    const message = String(req.body.message || '').trim();
    if (message.length > 1000) return res.status(400).send('Your message must be 1,000 characters or fewer.');

    try {
        const property = await Property.findOne({
            _id: req.params.id,
            listingType: 'sale',
            status: 'available',
            verificationStatus: 'verified'
        }).populate('landlordId', 'name email');
        if (!property) return res.status(404).send('This property is not available for sale.');

        await PropertyInquiry.create({
            buyerId: req.user._id,
            propertyId: property._id,
            message
        });
        if (isEmailConfigured()) {
            try {
                await sendEmail({
                    to: property.landlordId.email,
                    subject: 'New property inquiry on Jacob Estate',
                    text: [
                        `Hello ${property.landlordId.name},`,
                        '',
                        `${req.user.name} is interested in "${property.title}" in ${property.location}.`,
                        req.user.email ? `Buyer email: ${req.user.email}` : null,
                        req.user.phone ? `Buyer phone: ${req.user.phone}` : null,
                        message ? `\nMessage:\n${message}` : null,
                        '',
                        `View and manage inquiries: ${new URL('/sales-inquiries', process.env.APP_URL || `${req.protocol}://${req.get('host')}`).toString()}`
                    ].filter(Boolean).join('\n')
                });
            } catch (emailError) {
                console.error('Seller inquiry email failed:', {
                    name: emailError.name,
                    code: emailError.code
                });
            }
        } else {
            console.warn('Seller inquiry email not sent: email service is not configured.');
        }
        return res.redirect(`/property/${property._id}?inquiry=submitted`);
    } catch (error) {
        if (error.code === 11000) return res.redirect(`/property/${req.params.id}?inquiry=exists`);
        return next(error);
    }
});

router.get('/sales-inquiries', requireRole('landlord'), async (req, res, next) => {
    try {
        const properties = await Property.find({ landlordId: req.user._id, listingType: 'sale' }).select('_id');
        const inquiries = await PropertyInquiry.find({ propertyId: { $in: properties.map(property => property._id) } })
            .populate('buyerId', 'name email phone')
            .populate('propertyId', 'title location price status listingType')
            .sort({ timestamp: -1 });
        return res.render('property-inquiries', { inquiries, user: req.user, sellerView: true });
    } catch (error) {
        return next(error);
    }
});

router.get('/my-property-inquiries', requireRole('student'), async (req, res, next) => {
    try {
        const inquiries = await PropertyInquiry.find({ buyerId: req.user._id })
            .populate({ path: 'propertyId', populate: { path: 'landlordId', select: 'name email phone' } })
            .sort({ timestamp: -1 });
        return res.render('property-inquiries', { inquiries, user: req.user, sellerView: false });
    } catch (error) {
        return next(error);
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
