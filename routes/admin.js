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

const { featuredUntilFromDays } = require('../services/listing-promotion');
const { recordAudit } = require('../services/audit-log');
const AuditLog = require('../models/AuditLog');

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
        const propertyFilter = { archivedAt: null };
        if (propertyStatus) propertyFilter.status = propertyStatus;
        if (verificationStatus) propertyFilter.verificationStatus = verificationStatus;

        const [pendingProperties, recentProperties, users, propertyCount, userCount, studentCount, landlordCount, availableCount] = await Promise.all([
            Property.find({ verificationStatus: 'pending' }).populate('landlordId', 'name email').sort({ createdAt: 1 }),
            Property.find(propertyFilter).populate('landlordId', 'name email').sort({ updatedAt: -1 }).limit(20),
            User.find(searchFilter).select('-password').sort({ createdAt: -1 }),
            Property.countDocuments({ archivedAt: null }),
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
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).send('Property not found.');
    if (req.body.status === 'verified') {
        const current = await Property.findById(req.params.id).select('videoUrl verificationStatus');
        if (current && current.verificationStatus !== 'verified' && !current.videoUrl) {
            return res.status(409).send('A property needs a video tour before it can be verified.');
        }
    }
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
    await recordAudit(req, 'property.verification', { targetType: 'property', targetId: property._id, details: `status=${req.body.status}` });
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
        if (req.body.verificationStatus === 'verified' && property.verificationStatus !== 'verified' && !property.videoUrl) {
            return res.status(409).send('A property needs a video tour before it can be verified.');
        }
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
        await recordAudit(req, 'property.manage', { targetType: 'property', targetId: property._id, details: `status=${req.body.status}; verification=${req.body.verificationStatus}` });
        return res.redirect('/admin?message=listing-updated');
    } catch (error) {
        return next(error);
    }
});

router.post('/admin/properties/:id/feature', requireRole('admin'), async (req, res, next) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).send('Property not found.');
    const featuredUntil = featuredUntilFromDays(req.body.days);
    if (featuredUntil === undefined) return res.redirect('/admin');

    try {
        const filter = featuredUntil
            ? { _id: req.params.id, verificationStatus: 'verified' }
            : { _id: req.params.id };
        const property = await Property.findOneAndUpdate(filter, { $set: { featuredUntil } });
        if (!property) {
            const exists = await Property.exists({ _id: req.params.id });
            if (!exists) return res.status(404).send('Property not found.');
            return res.status(409).send('Only verified properties can be featured.');
        }
        await recordAudit(req, 'property.feature', { targetType: 'property', targetId: req.params.id, details: featuredUntil ? `until=${featuredUntil.toISOString()}` : 'removed' });
        return res.redirect('/admin?message=listing-updated');
    } catch (error) {
        return next(error);
    }
});

const ABANDONED_TRANSACTION_STATUSES = new Set(['failed', 'abandoned', 'reversed']);
const MAX_CHECKOUTS_TO_SETTLE = 25;

// Settles every unfinished checkout on a property before it is deleted. A renter who only opened
// the payment page and left has not paid, so Paystack reports that checkout as abandoned and it
// must not block the admin. Only a confirmed payment, or one Paystack still has in progress,
// does. Abandoned attempts are marked failed and kept, so a payment completed later on an old
// payment page is flagged for refund review instead of being lost.
// Returns { released: true } or { released: false, reason: 'paid' | 'inprogress' | 'unverified' }.
async function settleCheckoutsBeforeDelete(property) {
    const checkouts = await Booking.find({
        propertyId: property._id,
        paymentStatus: 'pending',
        paymentReference: { $exists: true, $nin: [null, ''] }
    }).select('paymentReference').limit(MAX_CHECKOUTS_TO_SETTLE);

    const abandoned = [];
    if (checkouts.length) {
        const secretKey = getPaystackSecretKey();
        if (!secretKey) return { released: false, reason: 'unverified' };
        for (const checkout of checkouts) {
            try {
                const transaction = await paystackRequest(
                    `/transaction/verify/${encodeURIComponent(checkout.paymentReference)}`,
                    secretKey,
                    { method: 'GET' }
                );
                if (transaction?.status === 'success') return { released: false, reason: 'paid' };
                if (!ABANDONED_TRANSACTION_STATUSES.has(transaction?.status)) return { released: false, reason: 'inprogress' };
            } catch (error) {
                // A reference Paystack has never seen cannot have been paid.
                if (!/not found/i.test(String(error?.message || ''))) return { released: false, reason: 'unverified' };
            }
            abandoned.push(checkout._id);
        }
    }

    if (abandoned.length) {
        await Booking.updateMany(
            { _id: { $in: abandoned }, paymentStatus: 'pending' },
            { $set: { paymentStatus: 'failed', paymentAuthorizationUrl: null } }
        );
    }
    await Property.updateOne(
        { _id: property._id },
        { $unset: { paymentReservationBookingId: 1, paymentReservationExpiresAt: 1 } }
    );
    return { released: true, settled: abandoned.length };
}

async function archiveProperty(req, res, property, reason) {
    await Property.updateOne(
        { _id: property._id },
        { $set: { archivedAt: new Date(), status: 'maintenance', verificationStatus: 'rejected', featuredUntil: null } }
    );
    await recordAudit(req, 'property.archive', { targetType: 'property', targetId: property._id, details: `kept because ${reason}` });
    return res.redirect('/admin?message=listing-archived');
}

// An admin can always remove a listing. When money is involved the listing is archived instead of
// erased: it disappears from the site and the admin list, but its bookings and payment records
// stay, so renters' receipts keep working and a refund can still be proven.
router.post('/admin/properties/:id/delete', requireRole('admin'), async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).send('Property not found.');
    const existingProperty = await Property.findById(req.params.id)
        .select('videoPublicId paymentReservationBookingId paymentReservationExpiresAt');
    if (!existingProperty) return res.status(404).send('Property not found.');

    if (await Booking.exists({
        propertyId: existingProperty._id,
        $or: [{ paymentStatus: 'paid' }, { 'paymentHistory.0': { $exists: true } }]
    })) {
        return archiveProperty(req, res, existingProperty, 'it has payment records');
    }

    const settlement = await settleCheckoutsBeforeDelete(existingProperty);
    if (!settlement.released) {
        const reasons = {
            paid: 'a payment is confirmed with Paystack',
            inprogress: 'a payment is in progress with Paystack',
            unverified: 'Paystack could not confirm an earlier payment attempt'
        };
        return archiveProperty(req, res, existingProperty, reasons[settlement.reason]);
    }

    const property = await Property.findOneAndDelete({
        _id: req.params.id,
        $or: [{ paymentReservationBookingId: null }, { paymentReservationBookingId: { $exists: false } }]
    });
    if (!property) {
        if (!await Property.exists({ _id: req.params.id })) return res.status(404).send('Property not found.');
        // A checkout started while the delete was running.
        return archiveProperty(req, res, existingProperty, 'a checkout started during the delete');
    }
    await cleanupOrQueueVideos([property.videoPublicId]);
    // Keep bookings that already have a Paystack reference (abandoned attempts): a late payment on
    // one of them is then flagged for refund review rather than going unrecorded.
    await Booking.deleteMany({
        propertyId: property._id,
        $or: [{ paymentReference: { $exists: false } }, { paymentReference: null }, { paymentReference: '' }]
    });
    await PropertyInquiry.deleteMany({ propertyId: property._id });
    await recordAudit(req, 'property.delete', { targetType: 'property', targetId: property._id, details: property.title });
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
    const financialRecord = await Booking.exists({
        $or: [{ studentId: targetUser._id }, { propertyId: { $in: propertyIds } }],
        $and: [{ $or: [{ paymentStatus: 'paid' }, { 'paymentHistory.0': { $exists: true } }] }]
    });
    if (financialRecord) {
        return res.status(409).send('This account has payment records that must be kept, so it cannot be deleted. Remove its listings from public view instead.');
    }
    await Booking.deleteMany({ $or: [{ studentId: targetUser._id }, { propertyId: { $in: propertyIds } }] });
    await PropertyInquiry.deleteMany({ $or: [{ buyerId: targetUser._id }, { propertyId: { $in: propertyIds } }] });
    await Property.deleteMany({ landlordId: targetUser._id });
    await cleanupOrQueueVideos(ownedProperties.map(property => property.videoPublicId));
    await User.findByIdAndDelete(targetUser._id);
    await recordAudit(req, 'user.delete', { targetType: 'user', targetId: targetUser._id, details: `role=${targetUser.role}` });
    res.redirect('/admin');
});

router.get('/admin/audit-log', requireRole('admin'), async (req, res, next) => {
    try {
        const entries = await AuditLog.find().sort({ createdAt: -1 }).limit(200).lean();
        res.render('audit-log', { user: req.user, entries });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
