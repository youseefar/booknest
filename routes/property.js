const express = require('express');
const Property = require('../models/Property');
const Booking = require('../models/Booking');
const PropertyInquiry = require('../models/PropertyInquiry');
const mongoose = require('mongoose');
const { requireRole } = require('../middleware/auth');
const { SORT_OPTIONS, getPagination, parsePage, parseSort } = require('../services/listing-pagination');
const { parseSavedPropertyIds } = require('../services/saved-property-ids');
const { parseOptionalRoomCount } = require('../services/property-details');
const { normalizePropertySearch } = require('../services/property-search');
const { Readable } = require('node:stream');
const {
    cleanupOrQueueVideos,
    isCloudinaryConfigured,
    uploadPropertyVideo
} = require('../services/cloudinary-videos');
const router = express.Router();

async function parseVideoUpload(req, res, next) {
    try {
        const declaredLength = Number(req.get('content-length') || 0);
        const maximumRequestBytes = 50 * 1024 * 1024 + 64 * 1024;
        if (declaredLength > maximumRequestBytes) {
            const error = new Error('Video files must be 50 MB or smaller.');
            error.status = 413;
            return next(error);
        }

        let receivedBytes = 0;
        const body = Readable.toWeb(req).pipeThrough(new TransformStream({
            transform(chunk, controller) {
                receivedBytes += chunk.byteLength;
                if (receivedBytes > maximumRequestBytes) {
                    const error = new Error('Video files must be 50 MB or smaller.');
                    error.status = 413;
                    throw error;
                }
                controller.enqueue(chunk);
            }
        }));
        const multipartRequest = new Request('http://localhost/video-upload', {
            method: 'POST',
            headers: { 'content-type': req.get('content-type') || '' },
            body,
            duplex: 'half'
        });
        const formData = await multipartRequest.formData();
        const fields = {};
        let uploadedFile = null;
        for (const [fieldName, value] of formData.entries()) {
            if (fieldName === 'video' && typeof value.arrayBuffer === 'function') {
                if (uploadedFile) {
                    const error = new Error('Submit only one video file.');
                    error.status = 400;
                    return next(error);
                }
                if (value.size > 0) uploadedFile = value;
                continue;
            }
            if (typeof value !== 'string' || Object.hasOwn(fields, fieldName)) {
                const error = new Error('The property form contains unsupported fields.');
                error.status = 400;
                return next(error);
            }
            fields[fieldName] = value;
        }

        req.body = fields;
        if (uploadedFile) req.file = uploadedFile;
        return next();
    } catch (error) {
        if (!error.status) error.status = 400;
        if (error.status < 500) return res.status(error.status).send(error.message);
        return next(error);
    }
}

function handleVideoUploadError(error, req, res, next) {
    if (error.status && error.status < 500) return res.status(error.status).send(error.message);
    return next(error);
}

router.get('/saved-properties', async (req, res, next) => {
    try {
        const savedIds = parseSavedPropertyIds(req.query.ids);
        const properties = savedIds.length
            ? await Property.find({
                _id: { $in: savedIds },
                verificationStatus: 'verified',
                status: { $in: ['available', 'rented', 'sold'] }
            }).populate('landlordId', 'name')
            : [];
        const propertyById = new Map(properties.map(property => [String(property._id), property]));

        res.render('saved-properties', {
            properties: savedIds.map(id => propertyById.get(id)).filter(Boolean),
            user: req.user
        });
    } catch (err) {
        return next(err);
    }
});

// View all properties
router.get('/properties', async (req, res, next) => {
    try {
        await Booking.syncExpiredSubscriptions();
        const search = String(req.query.q || '').trim();
        if (search.length > 100) {
            const error = new Error('Search terms must be 100 characters or fewer.');
            error.status = 400;
            return next(error);
        }
        const normalizedSearch = normalizePropertySearch(search);
        if (search && !normalizedSearch) {
            const error = new Error('Search must include at least one letter or number.');
            error.status = 400;
            return next(error);
        }
        const listingType = ['rent', 'sale'].includes(req.query.type) ? req.query.type : '';
        const sort = parseSort(req.query.sort);
        const requestedPage = parsePage(req.query.page);
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
            const searchFilter = { $text: { $search: normalizedSearch } };
            if (Object.keys(filter).length) {
                filter.$and = [searchFilter];
            } else {
                Object.assign(filter, searchFilter);
            }
        }

        const totalCount = await Property.countDocuments(filter);
        const pagination = getPagination(requestedPage, totalCount);
        const properties = await Property.find(filter)
            .sort(SORT_OPTIONS[sort])
            .skip(pagination.skip)
            .limit(pagination.pageSize)
            .populate('landlordId', 'name');
        res.render('properties', {
            properties,
            user: req.user,
            search,
            listingType,
            sort,
            listingPath: '/properties',
            ...pagination
        });
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
        const filter = { landlordId: req.user._id };
        const sort = parseSort(req.query.sort);
        const requestedPage = parsePage(req.query.page);
        const totalCount = await Property.countDocuments(filter);
        const pagination = getPagination(requestedPage, totalCount);
        const properties = await Property.find(filter)
            .sort(SORT_OPTIONS[sort])
            .skip(pagination.skip)
            .limit(pagination.pageSize);
        res.render('properties', {
            properties,
            user: req.user,
            landlordView: true,
            search: '',
            listingType: '',
            sort,
            listingPath: '/my-properties',
            ...pagination
        });
    } catch (err) {
        return next(err);
    }
});

// Add property post
router.post('/add-property', requireRole('landlord'), parseVideoUpload, handleVideoUploadError, async (req, res, next) => {
    let uploadedVideo = null;
    try {
        if (req.user.role !== 'landlord') {
            return res.status(403).send('Only landlords can add properties');
        }

        const { title, description, price, location, address, amenities } = req.body;
        const bedrooms = parseOptionalRoomCount(req.body.bedrooms);
        const bathrooms = parseOptionalRoomCount(req.body.bathrooms);
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
            || bedrooms === undefined || bathrooms === undefined
            || !['rent', 'sale'].includes(listingType) || !Number.isFinite(numericPrice) || numericPrice <= 0) {
            return res.status(400).render('add-property', { user: req.user, message: 'Please complete every field with valid information.' });
        }
        if (req.file) {
            if (!isCloudinaryConfigured()) {
                return res.status(503).send('Video uploads are temporarily unavailable.');
            }
            uploadedVideo = await uploadPropertyVideo(req.file);
        }

        const newProperty = new Property({
            title: cleanTitle,
            description: cleanDescription,
            price: numericPrice,
            listingType,
            location: cleanLocation,
            address: cleanAddress,
            bedrooms,
            bathrooms,
            amenities: cleanAmenities,
            videoUrl: uploadedVideo?.videoUrl || null,
            videoPublicId: uploadedVideo?.videoPublicId || null,
            videoFormat: uploadedVideo?.videoFormat || null,
            landlordId: req.user._id
        });

        await newProperty.save();
        res.redirect('/dashboard');
    } catch (err) {
        if (uploadedVideo) {
            try {
                await cleanupOrQueueVideos([uploadedVideo.videoPublicId]);
            } catch (cleanupError) {
                console.error('Unable to queue an unlinked Cloudinary video:', {
                    name: cleanupError.name,
                    code: cleanupError.code
                });
            }
        }
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
    res.render('edit-property', { property, user: req.user, videoResult: req.query.video });
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
        const bedrooms = parseOptionalRoomCount(req.body.bedrooms);
        const bathrooms = parseOptionalRoomCount(req.body.bathrooms);
        if (!cleanTitle || cleanTitle.length > 120 || !cleanDescription || cleanDescription.length > 3000
            || !cleanLocation || cleanLocation.length > 120 || !cleanAddress || cleanAddress.length > 240
            || cleanAmenities.length > 20 || cleanAmenities.some(amenity => amenity.length > 80)
            || bedrooms === undefined || bathrooms === undefined
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
            { title: cleanTitle, description: cleanDescription, price: numericPrice, listingType, location: cleanLocation, address: cleanAddress, bedrooms, bathrooms, amenities: cleanAmenities, verificationStatus: 'pending' },
            { new: true, runValidators: true }
        );
        if (!property) return res.status(404).send('Property not found');
        res.redirect('/dashboard');
    } catch (err) {
        return next(err);
    }
});

router.post('/property/:id/video', requireRole('landlord'), parseVideoUpload, handleVideoUploadError, async (req, res, next) => {
    let uploadedVideo = null;
    try {
        if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).send('Property not found.');
        if (!req.file) return res.status(400).send('Choose a video to upload.');
        if (!isCloudinaryConfigured()) return res.status(503).send('Video uploads are temporarily unavailable.');

        const property = await Property.findOne({ _id: req.params.id, landlordId: req.user._id });
        if (!property) return res.status(404).send('Property not found.');
        if (property.paymentReservationBookingId) {
            return res.status(409).send('This property has an active payment and its video cannot be changed.');
        }

        uploadedVideo = await uploadPropertyVideo(req.file);
        const previousProperty = await Property.findOneAndUpdate(
            {
                _id: property._id,
                landlordId: req.user._id,
                $or: [{ paymentReservationBookingId: null }, { paymentReservationBookingId: { $exists: false } }]
            },
            {
                $set: {
                    videoUrl: uploadedVideo.videoUrl,
                    videoPublicId: uploadedVideo.videoPublicId,
                    videoFormat: uploadedVideo.videoFormat,
                    verificationStatus: 'pending'
                }
            },
            { new: false, runValidators: true }
        );
        if (!previousProperty) {
            const error = new Error('This property changed while the video was uploading. Try again.');
            error.status = 409;
            throw error;
        }

        if (previousProperty.videoPublicId && previousProperty.videoPublicId !== uploadedVideo.videoPublicId) {
            await cleanupOrQueueVideos([previousProperty.videoPublicId]);
        }
        return res.redirect(`/property/${property._id}/edit?video=updated`);
    } catch (error) {
        if (uploadedVideo) {
            try {
                const stillReferenced = await Property.exists({ videoPublicId: uploadedVideo.videoPublicId });
                if (!stillReferenced) await cleanupOrQueueVideos([uploadedVideo.videoPublicId]);
            } catch (cleanupError) {
                console.error('Unable to clean up an unlinked Cloudinary video:', {
                    name: cleanupError.name,
                    code: cleanupError.code
                });
            }
        }
        if (error.status && error.status < 500) return res.status(error.status).send(error.message);
        return next(error);
    }
});

router.post('/property/:id/video/delete', requireRole('landlord'), async (req, res, next) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).send('Property not found.');
        const existingProperty = await Property.findOne({
            _id: req.params.id,
            landlordId: req.user._id
        }).select('videoPublicId');
        if (!existingProperty) return res.status(404).send('Property not found.');
        const property = await Property.findOneAndUpdate(
            {
                _id: req.params.id,
                landlordId: req.user._id,
                $or: [{ paymentReservationBookingId: null }, { paymentReservationBookingId: { $exists: false } }]
            },
            { $set: { videoUrl: null, videoPublicId: null, videoFormat: null, verificationStatus: 'pending' } },
            { new: false }
        );
        if (!property) {
            const exists = await Property.exists({ _id: req.params.id, landlordId: req.user._id });
            if (!exists) return res.status(404).send('Property not found.');
            return res.status(409).send('This property has an active payment and its video cannot be changed.');
        }

        if (property.videoPublicId) {
            await cleanupOrQueueVideos([property.videoPublicId]);
        }
        return res.redirect(`/property/${property._id}/edit?video=deleted`);
    } catch (error) {
        return next(error);
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