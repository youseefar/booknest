const mongoose = require('mongoose');

const propertySchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        required: true
    },
    location: {
        type: String,
        required: true
    },
    address: {
        type: String,
        required: true
    },
    amenities: [{
        type: String
    }],
    images: [{
        type: String
    }],
    videoUrl: {
        type: String,
        default: ''
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
        enum: ['available', 'rented', 'maintenance'],
        default: 'available'
    },
    verificationStatus: {
        type: String,
        enum: ['pending', 'verified', 'rejected'],
        default: 'pending'
    },
}, { timestamps: true });

propertySchema.virtual('averageRating').get(function () {
    if (!this.reviews?.length) return null;
    return this.reviews.reduce((total, review) => total + review.rating, 0) / this.reviews.length;
});

module.exports = mongoose.model('Property', propertySchema);