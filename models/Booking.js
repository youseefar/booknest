const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
    studentId: {
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
        default: ''
    },
    status: {
        type: String,
        enum: ['awaiting_payment', 'pending', 'approved', 'rejected', 'viewed', 'expired', 'cancelled'],
        default: 'pending'
    },
    landlordViewed: {
        type: Boolean,
        default: false
    },
    paymentStatus: {
        type: String,
        enum: ['not_started', 'pending', 'paid', 'failed'],
        default: 'not_started'
    },
    paymentReference: {
        type: String
    },
    paymentAmountKobo: {
        type: Number,
        min: 0,
        default: null
    },
    paymentSubaccountCode: {
        type: String,
        default: null
    },
    paymentAuthorizationUrl: {
        type: String,
        default: null
    },
    paymentPaidAt: {
        type: Date,
        default: null
    },
    subscriptionExpiresAt: {
        type: Date,
        default: null
    },
    paymentHistory: [{
        reference: String,
        amountKobo: Number,
        paidAt: Date,
        subscriptionExpiresAt: Date,
        endedStatus: String,
        endedAt: Date
    }],
    timestamp: {
        type: Date,
        default: Date.now
    }
});

bookingSchema.index({ studentId: 1, propertyId: 1 }, { unique: true });
bookingSchema.index({ paymentReference: 1 }, { unique: true, sparse: true });

bookingSchema.statics.addOneCalendarMonth = function (date) {
    const expiresAt = new Date(date);
    const originalDay = expiresAt.getDate();
    expiresAt.setDate(1);
    expiresAt.setMonth(expiresAt.getMonth() + 1);
    const lastDayOfMonth = new Date(expiresAt.getFullYear(), expiresAt.getMonth() + 1, 0).getDate();
    expiresAt.setDate(Math.min(originalDay, lastDayOfMonth));
    return expiresAt;
};

bookingSchema.statics.syncExpiredSubscriptions = async function () {
    const now = new Date();
    const bookingsMissingExpiry = await this.find({
        paymentStatus: 'paid',
        paymentPaidAt: { $ne: null },
        $or: [
            { subscriptionExpiresAt: null },
            { subscriptionExpiresAt: { $exists: false } }
        ]
    }).select('_id paymentPaidAt');

    for (const booking of bookingsMissingExpiry) {
        const expiresAt = this.addOneCalendarMonth(booking.paymentPaidAt);
        await this.updateOne(
            { _id: booking._id, subscriptionExpiresAt: null },
            { $set: { subscriptionExpiresAt: expiresAt } }
        );
    }

    const expiredBookings = await this.find({
        paymentStatus: 'paid',
        status: 'approved',
        subscriptionExpiresAt: { $lte: now }
    }).select('_id propertyId');
    if (!expiredBookings.length) return 0;

    const expiredBookingIds = expiredBookings.map(booking => booking._id);
    await this.updateMany(
        { _id: { $in: expiredBookingIds }, paymentStatus: 'paid', status: 'approved' },
        { $set: { status: 'expired' } }
    );

    const propertyIds = [...new Set(expiredBookings.map(booking => String(booking.propertyId)))];
    const activePropertyIds = await this.distinct('propertyId', {
        propertyId: { $in: propertyIds },
        paymentStatus: 'paid',
        status: 'approved',
        subscriptionExpiresAt: { $gt: now }
    });
    const releasablePropertyIds = propertyIds.filter(propertyId =>
        !activePropertyIds.some(activeId => String(activeId) === propertyId)
    );

    if (releasablePropertyIds.length) {
        const Property = require('./Property');
        await Property.updateMany(
            { _id: { $in: releasablePropertyIds }, status: 'rented' },
            { $set: { status: 'available' } }
        );
    }

    return expiredBookings.length;
};

module.exports = mongoose.model('Booking', bookingSchema);