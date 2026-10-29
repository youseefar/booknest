const express = require('express');
const multer = require('multer');
const Property = require('../models/Property');
const Booking = require('../models/Booking');
const mongoose = require('mongoose');
const { uploadPropertyVideo } = require('../services/cloudinary');
const { requireAuth, requireRole } = require('../middleware/auth');
const router = express.Router();

const videoUpload = multer({
    storage: multer.memoryStorage(),
    fileFilter: (req, file, cb) => {
        if (['video/mp4', 'video/quicktime', 'video/webm'].includes(file.mimetype)) return cb(null, true);
        cb(new Error('Property videos must be MP4, MOV, or WEBM files.'));
    },
    limits: { files: 1, fileSize: 50 * 1024 * 1024 }
}).single('video');

// View all properties
router.get('/properties', async (req, res) => {
    try {
        await Booking.syncExpiredSubscriptions();
        const search = String(req.query.q || '').trim();
        const filter = req.user?.role === 'admin'
            ? {}
            : req.user?.role === 'landlord'
            ? {
                $or: [
                    { status: { $in: ['available', 'rented'] }, verificationStatus: 'verified' },
                    { landlordId: req.user._id }
                ]
            }
            : { status: { $in: ['available', 'rented'] }, verificationStatus: 'verified' };

        if (search) {
            const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const searchFilter = {
                $or: ['title', 'location', 'address'].map(field => ({
                    [field]: { $regex: escapedSearch, $options: 'i' }
                }))
            };
            if (Object.keys(filter).length) {
                filter.$and = [searchFilter];
            } else {
                Object.assign(filter, searchFilter);
            }
        }

        const properties = await Property.find(filter).sort({ createdAt: -1 })
            .populate('landlordId', 'name phone email');
        res.render('properties', { properties, user: req.user, search });
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// View single property
router.get('/property/:id', async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).send('Property not found');
        await Booking.syncExpiredSubscriptions();
        const property = await Property.findById(req.params.id)
            .populate('landlordId', 'name phone email payoutSubaccountCode payoutSubaccountMode');

        if (!property) return res.status(404).send('Property not found');
        const canView = property.verificationStatus === 'verified' && ['available', 'rented'].includes(property.status)
            || req.user?.role === 'admin'
            || property.landlordId?._id.equals(req.user?._id);
        if (!canView) return res.status(404).send('Property not found');
        const reviewEligible = req.user?.role === 'student' && Boolean(await Booking.exists({
            studentId: req.user._id,
            propertyId: property._id,
            paymentStatus: 'paid'
        }));
        const reviewed = property.reviews.some(review => String(review.userId) === String(req.user?._id));
        await property.populate('reviews.userId', 'name');
        res.render('property-detail', {
            property,
            user: req.user,
            reviewEligible,
            reviewed,
            reviewResult: req.query.review,
            paystackMode: req.app.locals.paystackMode,
            paystackReady: Boolean(property.landlordId?.payoutSubaccountCode)
                && property.landlordId.payoutSubaccountMode === req.app.locals.paystackMode
        });
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// Add property page (Landlord only)
router.get('/add-property', requireRole('landlord'), (req, res) => {
    if (req.user.role !== 'landlord') {
        return res.status(403).send('Only landlords can add properties');
    }
    res.render('add-property', { user: req.user });
});

// Landlord inventory for the dashboard
router.get('/my-properties', requireRole('landlord'), async (req, res) => {
    if (req.user.role !== 'landlord') {
        return res.status(403).send('Only landlords can view their properties');
    }

    try {
        const properties = await Property.find({ landlordId: req.user._id }).sort({ createdAt: -1 });
        res.render('properties', { properties, user: req.user, landlordView: true });
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// Add property post
router.post('/add-property', requireRole('landlord'), videoUpload, async (req, res) => {
    try {
        if (req.user.role !== 'landlord') {
            return res.status(403).send('Only landlords can add properties');
        }

        const { title, description, price, location, address, amenities } = req.body;
        const cleanTitle = String(title || '').trim();
        const cleanDescription = String(description || '').trim();
        const cleanLocation = String(location || '').trim();
        const cleanAddress = String(address || '').trim();
        const numericPrice = Number(price);
        if (!cleanTitle || !cleanDescription || !cleanLocation || !cleanAddress || !Number.isFinite(numericPrice) || numericPrice <= 0) {
            return res.status(400).render('add-property', { user: req.user, message: 'Please complete every field with valid information.' });
        }
        const uploadedVideo = req.file ? await uploadPropertyVideo(req.file.buffer) : null;

        const newProperty = new Property({
            title: cleanTitle,
            description: cleanDescription,
            price: numericPrice,
            location: cleanLocation,
            address: cleanAddress,
            amenities: String(amenities || '').split(',').map(a => a.trim()).filter(Boolean),
            videoUrl: uploadedVideo?.videoUrl || '',
            videoPosterUrl: uploadedVideo?.videoPosterUrl || '',
            landlordId: req.user._id
        });

        await newProperty.save();
        res.redirect('/dashboard');
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// Edit listing details
router.get('/property/:id/edit', requireRole('landlord'), async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).send('Property not found');
    const property = await Property.findOne({ _id: req.params.id, landlordId: req.user._id });
    if (!property) return res.status(404).send('Property not found');
    res.render('edit-property', { property, user: req.user });
});

router.post('/property/:id/edit', requireRole('landlord'), videoUpload, async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).send('Property not found');
        const { title, description, price, location, address, amenities } = req.body;
        const numericPrice = Number(price);
        if (!String(title || '').trim() || !String(description || '').trim() || !String(location || '').trim() || !String(address || '').trim() || !Number.isFinite(numericPrice) || numericPrice <= 0) {
            return res.status(400).send('Please provide valid property details.');
        }

        const existingProperty = await Property.findOne({ _id: req.params.id, landlordId: req.user._id });
        if (!existingProperty) return res.status(404).send('Property not found');

        const uploadedVideo = req.file ? await uploadPropertyVideo(req.file.buffer) : null;
        const videoUrl = uploadedVideo?.videoUrl || existingProperty.videoUrl;
        const videoPosterUrl = uploadedVideo?.videoPosterUrl || existingProperty.videoPosterUrl;

        const property = await Property.findOneAndUpdate(
            { _id: req.params.id, landlordId: req.user._id },
            { title: title.trim(), description: description.trim(), price: numericPrice, location: location.trim(), address: address.trim(), amenities: String(amenities || '').split(',').map(a => a.trim()).filter(Boolean), videoUrl, videoPosterUrl, verificationStatus: 'pending' },
            { new: true, runValidators: true }
        );
        if (!property) return res.status(404).send('Property not found');
        res.redirect('/dashboard');
    } catch (err) {
        res.status(500).send('Unable to update this property.');
    }
});

router.post('/property/:id/reviews', requireRole('student'), async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).send('Property not found.');
    const rating = Number(req.body.rating);
    const comment = String(req.body.comment || '').trim();
    if (!Number.isInteger(rating) || rating < 1 || rating > 5 || comment.length < 2 || comment.length > 1000) {
        return res.redirect(`/property/${req.params.id}?review=invalid`);
    }

    try {
        const hasPaidBooking = await Booking.exists({ studentId: req.user._id, propertyId: req.params.id, paymentStatus: 'paid' });
        if (!hasPaidBooking) return res.status(403).send('Only students with a paid booking can review this property.');

        const result = await Property.updateOne(
            { _id: req.params.id, 'reviews.userId': { $ne: req.user._id } },
            { $push: { reviews: { userId: req.user._id, rating, comment } } }
        );
        return res.redirect(`/property/${req.params.id}?review=${result.modifiedCount ? 'submitted' : 'duplicate'}`);
    } catch (error) {
        console.error('Property review submission failed:', error.message);
        return res.status(500).send('Unable to submit your review right now.');
    }
});

router.post('/property/:id/status', requireRole('landlord'), async (req, res) => {
    const allowedStatuses = ['available', 'rented', 'maintenance'];
    if (!allowedStatuses.includes(req.body.status)) return res.status(400).send('Invalid property status.');
    const property = await Property.findOneAndUpdate({ _id: req.params.id, landlordId: req.user._id }, { status: req.body.status }, { new: true });
    if (!property) return res.status(404).send('Property not found');
    res.redirect('/dashboard');
});

// Submit booking request
router.post('/book-property/:id', requireRole('student'), async (req, res) => {
    try {
        if (req.user.role !== 'student') {
            return res.status(403).send('Only students can book properties');
        }

        if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).send('Property not found');
        const property = await Property.findOne({ _id: req.params.id, status: 'available', verificationStatus: 'verified' });
        if (!property) return res.status(404).send('This property is not available for booking.');
        const message = String(req.body.message || '').trim();
        if (message.length > 1000) return res.status(400).send('Your message is too long.');

        const newBooking = new Booking({
            studentId: req.user._id,
            propertyId: req.params.id,
            message
        });

        await newBooking.save();
        res.redirect(`/property/${req.params.id}`);
    } catch (err) {
        if (err.code === 11000) return res.status(400).send('You already have a booking request for this property.');
        res.status(500).send('Unable to submit your booking request.');
    }
});

module.exports = router;