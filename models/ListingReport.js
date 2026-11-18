const mongoose = require('mongoose');

const listingReportSchema = new mongoose.Schema({
    propertyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true },
    reporterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reason: { type: String, enum: ['scam', 'wrong_info', 'unavailable', 'not_real', 'inappropriate', 'other'], required: true },
    details: { type: String, trim: true, maxlength: 500, default: '' },
    status: { type: String, enum: ['open', 'reviewed', 'dismissed'], default: 'open' },
    handledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    handledAt: { type: Date, default: null }
}, { timestamps: true });

// One open report per person per listing; they can report again after it is handled.
listingReportSchema.index(
    { reporterId: 1, propertyId: 1 },
    { unique: true, partialFilterExpression: { status: 'open' } }
);
listingReportSchema.index({ status: 1, createdAt: -1 });
listingReportSchema.index({ reporterId: 1, createdAt: -1 });

module.exports = mongoose.model('ListingReport', listingReportSchema);
