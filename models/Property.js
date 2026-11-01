const mongoose = require('mongoose');

const propertySchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 120
    },
    description: {
        type: String,
        required: true,
        maxlength: 3000
    },
    price: {
        type: Number,
        required: true
    },
    listingType: {
        type: String,
        enum: ['rent', 'sale'],
        default: 'rent'
    },
    location: {
        type: String,
        required: true,
        trim: true,
        maxlength: 120
    },
    address: {
        type: String,
        required: true,
        trim: true,
        maxlength: 240
    },
    amenities: {
        type: [{ type: String, trim: true, maxlength: 80 }],
        validate: [amenities => amenities.length <= 20, 'A property can have at most 20 amenities.']
    },
    images: [{
        type: String
    }],
    paymentReservationBookingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Booking',
        default: null
    },
    paymentReservationExpiresAt: {
        type: Date,
        default: null
    },
    reviews: [{
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        rating: { type: Number, min: 1, max: 5, required: true },
        comment: { type: String, trim: true, maxlength: 1000, required: true },
        createdAt: { type: Date, default: Date.now }
    }],
    landlordId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    status: {
        type: String,
        enum: ['available', 'rented', 'sold', 'maintenance'],
        default: 'available'
    },
    verificationStatus: {
        type: String,
        enum: ['pending', 'verified', 'rejected'],
        default: 'pending'
    },
}, { timestamps: true });

propertySchema.index({ status: 1, verificationStatus: 1, createdAt: -1 });
propertySchema.index({ verificationStatus: 1, createdAt: 1 });
propertySchema.index({ landlordId: 1, createdAt: -1 });

propertySchema.virtual('averageRating').get(function () {
    if (!this.reviews?.length) return null;
    return this.reviews.reduce((total, review) => total + review.rating, 0) / this.reviews.length;
});

module.exports = mongoose.model('Property', propertySchema);