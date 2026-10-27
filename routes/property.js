const express = require('express');
const path = require('path');
const fs = require('fs');
const Property = require('../models/Property');
const Booking = require('../models/Booking');
const mongoose = require('mongoose');
const { requireAuth, requireRole } = require('../middleware/auth');
const router = express.Router();

const uploadDir = path.join(__dirname, '..', 'public', 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const imageUpload = (req, res, next) => {
    const multer = require('multer');
    const storage = multer.diskStorage({
        destination: (req, file, cb) => cb(null, uploadDir),
        filename: (req, file, cb) => {
            const safeName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
            cb(null, safeName);
        }
    });
    const upload = multer({
        storage,
        fileFilter: (req, file, cb) => {
            const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
            if (allowed.includes(file.mimetype)) return cb(null, true);
            cb(new Error('Only JPG, PNG, or WEBP images are allowed.'));
        },
        limits: { files: 5, fileSize: 5 * 1024 * 1024 }
    });
    upload.array('images', 5)(req, res, next);
};

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
        res.render('property-detail', {
            property,
            user: req.user,
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
router.post('/add-property', requireRole('landlord'), imageUpload, async (req, res) => {
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
        const uploadedImages = (req.files || []).map(file => `/uploads/${file.filename}`);

        if (!cleanTitle || !cleanDescription || !cleanLocation || !cleanAddress || !Number.isFinite(numericPrice) || numericPrice <= 0) {
            return res.status(400).render('add-property', { user: req.user, message: 'Please complete every field with valid information.' });
        }

        const newProperty = new Property({
            title: cleanTitle,
            description: cleanDescription,
            price: numericPrice,
            location: cleanLocation,
            address: cleanAddress,
            amenities: String(amenities || '').split(',').map(a => a.trim()).filter(Boolean),
            images: uploadedImages,
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

router.post('/property/:id/edit', requireRole('landlord'), imageUpload, async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).send('Property not found');
        const { title, description, price, location, address, amenities } = req.body;
        const numericPrice = Number(price);
        if (!String(title || '').trim() || !String(description || '').trim() || !String(location || '').trim() || !String(address || '').trim() || !Number.isFinite(numericPrice) || numericPrice <= 0) {
            return res.status(400).send('Please provide valid property details.');
        }

        const existingProperty = await Property.findOne({ _id: req.params.id, landlordId: req.user._id });
        if (!existingProperty) return res.status(404).send('Property not found');

        const uploadedImages = (req.files || []).map(file => `/uploads/${file.filename}`);
        const mergedImages = uploadedImages.length ? uploadedImages : existingProperty.images;

        const property = await Property.findOneAndUpdate(
            { _id: req.params.id, landlordId: req.user._id },
            { title: title.trim(), description: description.trim(), price: numericPrice, location: location.trim(), address: address.trim(), amenities: String(amenities || '').split(',').map(a => a.trim()).filter(Boolean), images: mergedImages, verificationStatus: 'pending' },
            { new: true, runValidators: true }
        );
        if (!property) return res.status(404).send('Property not found');
        res.redirect('/dashboard');
    } catch (err) {
        res.status(500).send('Unable to update this property.');
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