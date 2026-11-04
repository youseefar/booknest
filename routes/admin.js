const express = require('express');
const mongoose = require('mongoose');
const crypto = require('crypto');
const Property = require('../models/Property');
const User = require('../models/User');
const Booking = require('../models/Booking');
const PropertyInquiry = require('../models/PropertyInquiry');
const { getPaystackSecretKey, paystackConfigurationMessage, paystackRequest } = require('../services/paystack');
const { requireRole } = require('../middleware/auth');
const {
    cleanupOrQueueVideos
} = require('../services/cloudinary-videos');

const router = express.Router();

router.get('/admin', requireRole('admin'), async (req, res, next) => {
    try {
        req.session.adminPayoutCsrfToken = crypto.randomBytes(32).toString('hex');
        const adminCsrfToken = req.session.adminPayoutCsrfToken;
        const secretKey = getPaystackSecretKey();
        let adminBalanceKobo = null;
        let adminBalanceMessage = secretKey ? '' : paystackConfigurationMessage();
        if (secretKey) {
            try {
                const balances = await paystackRequest('/balance?currency=NGN', secretKey, { method: 'GET' });
                adminBalanceKobo = Array.isArray(balances)
                    ? balances.find(balance => balance.currency === 'NGN')?.balance ?? 0
                    : null;
                if (adminBalanceKobo === null) adminBalanceMessage = 'Paystack did not return an NGN balance.';
            } catch (error) {
                adminBalanceMessage = 'Unable to load the Paystack balance right now.';
            }
        }
        const search = String(req.query.q || '').trim();
        const role = ['student', 'landlord', 'admin'].includes(req.query.role) ? req.query.role : '';
        const propertyStatus = ['available', 'rented', 'sold', 'maintenance'].includes(req.query.propertyStatus) ? req.query.propertyStatus : '';
        const verificationStatus = ['pending', 'verified', 'rejected'].includes(req.query.verificationStatus) ? req.query.verificationStatus : '';
        const searchFilter = search
            ? {
                $or: [
                    { name: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
                    { email: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } }
                ]
            }
            : {};
        if (role) searchFilter.role = role;
        const propertyFilter = {};
        if (propertyStatus) propertyFilter.status = propertyStatus;
        if (verificationStatus) propertyFilter.verificationStatus = verificationStatus;

        const [pendingProperties, recentProperties, users, propertyCount, userCount, studentCount, landlordCount, availableCount] = await Promise.all([
            Property.find({ verificationStatus: 'pending' }).populate('landlordId', 'name email').sort({ createdAt: 1 }),
            Property.find(propertyFilter).populate('landlordId', 'name email').sort({ updatedAt: -1 }).limit(20),
            User.find(searchFilter).select('-password').sort({ createdAt: -1 }),
            Property.countDocuments(),
            User.countDocuments(),
            User.countDocuments({ role: 'student' }),
            User.countDocuments({ role: 'landlord' }),
            Property.countDocuments({ status: 'available', verificationStatus: 'verified' })
        ]);
        res.render('admin', {
            user: req.user,
            pendingProperties,
            recentProperties,
            users,
            propertyCount,
            userCount,
            studentCount,
            landlordCount,
            availableCount,
            search,
            role,
            propertyStatus,
            verificationStatus,
            adminMessage: req.query.message,
            adminBalanceKobo,
            adminBalanceMessage,
            adminCsrfToken,
            pendingAdminTransfer: req.session.pendingAdminTransfer || null,
            payoutMessage: req.query.payout
        });
    } catch (err) {
        return next(err);
    }
});

router.post('/admin/properties/:id/verification', requireRole('admin'), async (req, res) => {
    const allowed = ['pending', 'verified', 'rejected'];
    if (!allowed.includes(req.body.status)) return res.status(400).send('Invalid verification status.');
    const property = await Property.findOneAndUpdate(
        {
            _id: req.params.id,
            $or: [{ paymentReservationBookingId: null }, { paymentReservationBookingId: { $exists: false } }]
        },
        { $set: { verificationStatus: req.body.status } },
        { new: true }
    );
    if (!property) {
        const exists = await Property.exists({ _id: req.params.id });
        if (!exists) return res.status(404).send('Property not found.');
        return res.status(409).send('This property has an active payment and cannot be changed until checkout finishes.');
    }
    res.redirect('/admin');
});

router.post('/admin/properties/:id/manage', requireRole('admin'), async (req, res, next) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).send('Property not found.');

    const allowedStatuses = ['available', 'rented', 'sold', 'maintenance'];
    const allowedVerificationStatuses = ['pending', 'verified', 'rejected'];
    if (!allowedStatuses.includes(req.body.status) || !allowedVerificationStatuses.includes(req.body.verificationStatus)) {
        return res.status(400).send('Choose a valid listing and verification status.');
    }

    try {
        const property = await Property.findById(req.params.id);
        if (!property) return res.status(404).send('Property not found.');
        if ((property.listingType === 'sale' && req.body.status === 'rented')
            || (property.listingType === 'rent' && req.body.status === 'sold')) {
            return res.status(400).send('Choose a status that matches this listing type.');
        }

        if (req.body.status === 'available') {
            await Booking.syncExpiredSubscriptions();
            const activeStay = await Booking.exists({
                propertyId: property._id,
                status: 'approved',
                paymentStatus: 'paid',
                subscriptionExpiresAt: { $gt: new Date() }
            });
            if (activeStay) return res.redirect('/admin?message=active-stay');
        }

        const updatedProperty = await Property.findOneAndUpdate(
            {
                _id: property._id,
                $or: [{ paymentReservationBookingId: null }, { paymentReservationBookingId: { $exists: false } }]
            },
            { $set: { status: req.body.status, verificationStatus: req.body.verificationStatus } },
            { runValidators: true }
        );
        if (!updatedProperty) {
            return res.status(409).send('This property has an active payment and cannot be changed until checkout finishes.');
        }
        return res.redirect('/admin?message=listing-updated');
    } catch (error) {
        return next(error);
    }
});

router.post('/admin/properties/:id/delete', requireRole('admin'), async (req, res) => {
    const existingProperty = await Property.findById(req.params.id).select('videoPublicId');
    if (!existingProperty) return res.status(404).send('Property not found.');

    const property = await Property.findOneAndDelete({
        _id: req.params.id,
        $or: [{ paymentReservationBookingId: null }, { paymentReservationBookingId: { $exists: false } }]
    });
    if (!property) {
        const exists = await Property.exists({ _id: req.params.id });
        if (!exists) return res.status(404).send('Property not found.');
        return res.status(409).send('This property has an active payment and cannot be deleted until checkout finishes.');
    }
    await cleanupOrQueueVideos([property.videoPublicId]);
    await Booking.deleteMany({ propertyId: property._id });
    await PropertyInquiry.deleteMany({ propertyId: property._id });
    res.redirect('/admin');
});

router.post('/admin/users/:id/delete', requireRole('admin'), async (req, res) => {
    if (String(req.params.id) === String(req.user._id)) return res.status(400).send('You cannot delete your own admin account.');

    const targetUser = await User.findById(req.params.id);
    if (!targetUser) return res.status(404).send('User not found.');
    if (targetUser.role === 'admin') return res.status(403).send('Admin accounts cannot be deleted here.');

    const ownedProperties = await Property.find({ landlordId: targetUser._id }).select('_id videoPublicId');
    const propertyIds = ownedProperties.map(property => property._id);
    if (await Property.exists({ landlordId: targetUser._id, paymentReservationBookingId: { $ne: null } })
        || await Booking.exists({ studentId: targetUser._id, paymentStatus: 'pending' })) {
        return res.status(409).send('This account has an active payment and cannot be deleted until checkout finishes.');
    }
    await Booking.deleteMany({ $or: [{ studentId: targetUser._id }, { propertyId: { $in: propertyIds } }] });
    await PropertyInquiry.deleteMany({ $or: [{ buyerId: targetUser._id }, { propertyId: { $in: propertyIds } }] });
    await Property.deleteMany({ landlordId: targetUser._id });
    await cleanupOrQueueVideos(ownedProperties.map(property => property.videoPublicId));
    await User.findByIdAndDelete(targetUser._id);
    res.redirect('/admin');
});

module.exports = router;
