const express = require('express');
const mongoose = require('mongoose');
const Property = require('../models/Property');
const User = require('../models/User');
const Booking = require('../models/Booking');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/admin', requireRole('admin'), async (req, res) => {
    try {
        const search = String(req.query.q || '').trim();
        const role = ['student', 'landlord', 'admin'].includes(req.query.role) ? req.query.role : '';
        const propertyStatus = ['available', 'rented', 'maintenance'].includes(req.query.propertyStatus) ? req.query.propertyStatus : '';
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
            adminMessage: req.query.message
        });
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

router.post('/admin/properties/:id/manage', requireRole('admin'), async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).send('Property not found.');

    const allowedStatuses = ['available', 'rented', 'maintenance'];
    const allowedVerificationStatuses = ['pending', 'verified', 'rejected'];
    if (!allowedStatuses.includes(req.body.status) || !allowedVerificationStatuses.includes(req.body.verificationStatus)) {
        return res.status(400).send('Choose a valid listing and verification status.');
    }

    try {
        const property = await Property.findById(req.params.id);
        if (!property) return res.status(404).send('Property not found.');

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

        property.status = req.body.status;
        property.verificationStatus = req.body.verificationStatus;
        await property.save();
        return res.redirect('/admin?message=listing-updated');
    } catch (error) {
        console.error('Admin listing update failed:', error.message);
        return res.status(500).send('Unable to update this listing right now.');
    }
});

router.post('/admin/properties/:id/delete', requireRole('admin'), async (req, res) => {
    const property = await Property.findByIdAndDelete(req.params.id);
    if (!property) return res.status(404).send('Property not found.');
    await Booking.deleteMany({ propertyId: property._id });
    res.redirect('/admin');
});

router.post('/admin/users/:id/delete', requireRole('admin'), async (req, res) => {
    if (String(req.params.id) === String(req.user._id)) return res.status(400).send('You cannot delete your own admin account.');

    const targetUser = await User.findById(req.params.id);
    if (!targetUser) return res.status(404).send('User not found.');
    if (targetUser.role === 'admin') return res.status(403).send('Admin accounts cannot be deleted here.');

    const ownedProperties = await Property.find({ landlordId: targetUser._id }).select('_id');
    const propertyIds = ownedProperties.map(property => property._id);
    await Booking.deleteMany({ $or: [{ studentId: targetUser._id }, { propertyId: { $in: propertyIds } }] });
    await Property.deleteMany({ landlordId: targetUser._id });
    await User.findByIdAndDelete(targetUser._id);
    res.redirect('/admin');
});

module.exports = router;
