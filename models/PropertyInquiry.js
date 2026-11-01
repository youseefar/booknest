const mongoose = require('mongoose');

const propertyInquirySchema = new mongoose.Schema({
    buyerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    propertyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Property',
        required: true
    },
    message: {
        type: String,
        trim: true,
        maxlength: 1000,
        default: ''
    },
    status: {
        type: String,
        enum: ['pending', 'viewed', 'contacted', 'rejected'],
        default: 'pending'
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

propertyInquirySchema.index({ buyerId: 1, propertyId: 1 }, { unique: true });

module.exports = mongoose.model('PropertyInquiry', propertyInquirySchema);
