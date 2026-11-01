const express = require('express');
const Property = require('../models/Property');
const Booking = require('../models/Booking');
const PropertyInquiry = require('../models/PropertyInquiry');
const mongoose = require('mongoose');
const { requireRole } = require('../middleware/auth');
const router = express.Router();

// View all properties
router.get('/properties', async (req, res, next) => {
    try {
        await Booking.syncExpiredSubscriptions();
        const search = String(req.query.q || '').trim();
        const listingType = ['rent', 'sale'].includes(req.query.type) ? req.query.type : '';
        const filter = req.user?.role === 'admin'
            ? {}
            : req.user?.role === 'landlord'
            ? {
                $or: [
                    { status: { $in: ['available', 'rented', 'sold'] }, verificationStatus: 'verified' },
                    { landlordId: req.user._id }
                ]
            }
            : { status: { $in: ['available', 'rented', 'sold'] }, verificationStatus: 'verified' };

        if (listingType) filter.listingType = listingType;

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
        res.render('properties', { properties, user: req.user, search, listingType });
    } catch (err) {
        return next(err);
    }
});

// View single property
router.get('/property/:id', async (req, res, next) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).send('Property not found');
        await Booking.syncExpiredSubscriptions();
        const property = await Property.findById(req.params.id)
            .populate('landlordId', 'name phone email payoutSubaccountCode payoutSubaccountMode');

        if (!property) return res.status(404).send('Property not found');
        const canView = property.verificationStatus === 'verified' && ['available', 'rented', 'sold'].includes(property.status)
            || req.user?.role === 'admin'
            || property.landlordId?._id.equals(req.user?._id);
        if (!canView) return res.status(404).send('Property not found');
        const reviewEligible = property.listingType === 'rent' && req.user?.role === 'student' && Boolean(await Booking.exists({
            studentId: req.user._id,
            propertyId: property._id,
            paymentStatus: 'paid'
        }));
        const existingInquiry = property.listingType === 'sale' && req.user?.role === 'student'
            ? await PropertyInquiry.findOne({ buyerId: req.user._id, propertyId: property._id }).select('status')
            : null;
        const reviewed = property.reviews.some(review => String(review.userId) === String(req.user?._id));
        await property.populate('reviews.userId', 'name');
        res.render('property-detail', {
            property,
            user: req.user,
            reviewEligible,
            reviewed,
            existingInquiry,
            inquiryResult: req.query.inquiry,
            reviewResult: req.query.review,
            paystackMode: req.app.locals.paystackMode,
            paystackReady: Boolean(property.landlordId?.payoutSubaccountCode)
                && property.landlordId.payoutSubaccountMode === req.app.locals.paystackMode
        });
    } catch (err) {
        return next(err);
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
router.get('/my-properties', requireRole('landlord'), async (req, res, next) => {
    if (req.user.role !== 'landlord') {
        return res.status(403).send('Only landlords can view their properties');
    }

    try {
        const properties = await Property.find({ landlordId: req.user._id }).sort({ createdAt: -1 });
        res.render('properties', { properties, user: req.user, landlordView: true, search: '', listingType: '' });
    } catch (err) {
        return next(err);
    }
});

// Add property post
router.post('/add-property', requireRole('landlord'), async (req, res, next) => {
    try {
        if (req.user.role !== 'landlord') {
            return res.status(403).send('Only landlords can add properties');
        }

        const { title, description, price, location, address, amenities } = req.body;
        const listingType = String(req.body.listingType || '');
        const cleanTitle = String(title || '').trim();
        const cleanDescription = String(description || '').trim();
        const cleanLocation = String(location || '').trim();
        const cleanAddress = String(address || '').trim();
        const cleanAmenities = String(amenities || '').split(',').map(a => a.trim()).filter(Boolean);
        const numericPrice = Number(price);
        if (!cleanTitle || cleanTitle.length > 120 || !cleanDescription || cleanDescription.length > 3000
            || !cleanLocation || cleanLocation.length > 120 || !cleanAddress || cleanAddress.length > 240
            || cleanAmenities.length > 20 || cleanAmenities.some(amenity => amenity.length > 80)
            || !['rent', 'sale'].includes(listingType) || !Number.isFinite(numericPrice) || numericPrice <= 0) {
            return res.status(400).render('add-property', { user: req.user, message: 'Please complete every field with valid information.' });
        }
        const newProperty = new Property({
            title: cleanTitle,
            description: cleanDescription,
            price: numericPrice,
            listingType,
            location: cleanLocation,
            address: cleanAddress,
            amenities: cleanAmenities,
            landlordId: req.user._id
        });

        await newProperty.save();
        res.redirect('/dashboard');
    } catch (err) {
        return next(err);
    }
});

// Edit listing details
router.get('/property/:id/edit', requireRole('landlord'), async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).send('Property not found');
    const property = await Property.findOne({ _id: req.params.id, landlordId: req.user._id });
    if (!property) return res.status(404).send('Property not found');
    if (property.paymentReservationBookingId) {
        return res.status(409).send('This property has an active payment and cannot be changed until checkout finishes.');
    }
    res.render('edit-property', { property, user: req.user });
});

router.post('/property/:id/edit', requireRole('landlord'), async (req, res, next) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).send('Property not found');
        const { title, description, price, location, address, amenities } = req.body;
        const listingType = String(req.body.listingType || '');
        const numericPrice = Number(price);
        const cleanTitle = String(title || '').trim();
        const cleanDescription = String(description || '').trim();
        const cleanLocation = String(location || '').trim();
        const cleanAddress = String(address || '').trim();
        const cleanAmenities = String(amenities || '').split(',').map(a => a.trim()).filter(Boolean);
        if (!cleanTitle || cleanTitle.length > 120 || !cleanDescription || cleanDescription.length > 3000
            || !cleanLocation || cleanLocation.length > 120 || !cleanAddress || cleanAddress.length > 240
            || cleanAmenities.length > 20 || cleanAmenities.some(amenity => amenity.length > 80)
            || !['rent', 'sale'].includes(listingType) || !Number.isFinite(numericPrice) || numericPrice <= 0) {
            return res.status(400).send('Please provide valid property details.');
        }

        const existingProperty = await Property.findOne({ _id: req.params.id, landlordId: req.user._id });
        if (!existingProperty) return res.status(404).send('Property not found');
        if (existingProperty.paymentReservationBookingId) {
            return res.status(409).send('This property has an active payment and cannot be changed until checkout finishes.');
        }
        if (existingProperty.listingType !== listingType) {
            if (existingProperty.status !== 'available'
                || await Booking.exists({ propertyId: existingProperty._id })
                || await PropertyInquiry.exists({ propertyId: existingProperty._id })) {
                return res.status(409).send('The listing type cannot be changed after inquiries or bookings have started.');
            }
        }

        const property = await Property.findOneAndUpdate(
            { _id: req.params.id, landlordId: req.user._id },
            { title: cleanTitle, description: cleanDescription, price: numericPrice, listingType, location: cleanLocation, address: cleanAddress, amenities: cleanAmenities, verificationStatus: 'pending' },
            { new: true, runValidators: true }
        );
        if (!property) return res.status(404).send('Property not found');
        res.redirect('/dashboard');
    } catch (err) {
        return next(err);
    }
});

router.post('/property/:id/reviews', requireRole('student'), async (req, res, next) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).send('Property not found.');
    const rating = Number(req.body.rating);
    const comment = String(req.body.comment || '').trim();
    if (!Number.isInteger(rating) || rating < 1 || rating > 5 || comment.length < 2 || comment.length > 1000) {
        return res.redirect(`/property/${req.params.id}?review=invalid`);
    }

    try {
        const property = await Property.findById(req.params.id).select('listingType');
        if (!property || property.listingType !== 'rent') return res.status(404).send('Rental property not found.');
        const hasPaidBooking = await Booking.exists({ studentId: req.user._id, propertyId: req.params.id, paymentStatus: 'paid' });
        if (!hasPaidBooking) return res.status(403).send('Only students with a paid booking can review this property.');

        const result = await Property.updateOne(
            { _id: req.params.id, 'reviews.userId': { $ne: req.user._id }, 'reviews.49': { $exists: false } },
            { $push: { reviews: { userId: req.user._id, rating, comment } } }
        );
        if (result.modifiedCount) return res.redirect(`/property/${req.params.id}?review=submitted`);
        const currentProperty = await Property.findById(req.params.id).select('reviews.userId');
        return res.redirect(`/property/${req.params.id}?review=${currentProperty?.reviews.length >= 50 ? 'limit' : 'duplicate'}`);
    } catch (error) {
        return next(error);
    }
});

router.post('/property/:id/status', requireRole('landlord'), async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).send('Property not found.');
    const property = await Property.findOne({ _id: req.params.id, landlordId: req.user._id });
    if (!property) return res.status(404).send('Property not found');
    if (property.paymentReservationBookingId) {
        return res.status(409).send('This property has an active payment and cannot be changed until checkout finishes.');
    }
    const allowedStatuses = property.listingType === 'sale'
        ? ['available', 'sold', 'maintenance']
        : ['available', 'rented', 'maintenance'];
    if (!allowedStatuses.includes(req.body.status)) return res.status(400).send('Invalid property status.');
    const updatedProperty = await Property.findOneAndUpdate(
        {
            _id: property._id,
            landlordId: req.user._id,
            $or: [{ paymentReservationBookingId: null }, { paymentReservationBookingId: { $exists: false } }]
        },
        { $set: { status: req.body.status } },
        { runValidators: true }
    );
    if (!updatedProperty) return res.status(409).send('This property has an active payment and cannot be changed until checkout finishes.');
    res.redirect('/dashboard');
});

// Submit booking request
router.post('/book-property/:id', requireRole('student'), async (req, res, next) => {
    try {
        if (req.user.role !== 'student') {
            return res.status(403).send('Only students can book properties');
        }

        if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).send('Property not found');
        const property = await Property.findOne({ _id: req.params.id, listingType: 'rent', status: 'available', verificationStatus: 'verified' });
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
        return next(err);
    }
});

module.exports = router;