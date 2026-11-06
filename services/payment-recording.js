const Booking = require('../models/Booking');
const Property = require('../models/Property');
const { isVerifiedPaystackTransaction } = require('./paystack');

const idOf = value => value?._id || value;

// Atomically claims the property for a booking whose payment Paystack has confirmed.
// It succeeds only if the property is still available and is either reserved for this
// booking, not reserved at all, or held by a reservation that has already expired.
async function securePropertyForBooking(propertyId, bookingId, now = new Date()) {
    const result = await Property.updateOne(
        {
            _id: propertyId,
            status: 'available',
            $or: [
                { paymentReservationBookingId: bookingId },
                { paymentReservationBookingId: null },
                { paymentReservationExpiresAt: { $lte: now } }
            ]
        },
        { $set: { status: 'rented' }, $unset: { paymentReservationBookingId: 1, paymentReservationExpiresAt: 1 } }
    );
    return result.modifiedCount === 1;
}

// A verified payment exists but the home can no longer be given to this renter. Flag the
// booking for an administrator instead of leaving it silently unpaid or marking it paid.
async function flagUnsecuredPayment(booking, reference) {
    const result = await Booking.updateOne(
        { _id: booking._id, paymentReference: reference, paymentStatus: { $ne: 'paid' } },
        { $set: { paymentIssue: 'paid_property_unavailable', paymentIssueAt: new Date(), paymentAuthorizationUrl: null } }
    );
    if (result.modifiedCount) {
        console.error('Verified payment needs refund review:', {
            bookingId: String(booking._id),
            propertyId: String(idOf(booking.propertyId)),
            reference
        });
    }
}

async function isPaidWithReference(bookingId, reference) {
    const current = await Booking.findById(bookingId).select('paymentStatus paymentReference');
    return current?.paymentStatus === 'paid' && current.paymentReference === reference;
}

// Records a payment that Paystack has verified as successful. Safe to call repeatedly and
// concurrently: the property is claimed first with a conditional update, and the booking is
// marked paid only after the claim succeeds. Returns true when the booking is paid and its
// property is secured.
async function recordVerifiedPayment(booking, reference, transaction) {
    if (!isVerifiedPaystackTransaction(booking, reference, transaction)) return false;

    const propertyId = idOf(booking.propertyId);
    const now = new Date();

    if (booking.paymentStatus === 'paid' && booking.paymentReference === reference) {
        // Duplicate webhook or callback. Repair a stay that was marked paid but never secured.
        const stillActive = booking.status === 'approved'
            && booking.subscriptionExpiresAt
            && new Date(booking.subscriptionExpiresAt) > now;
        if (stillActive) await securePropertyForBooking(propertyId, booking._id, now);
        return true;
    }

    if (!await securePropertyForBooking(propertyId, booking._id, now)) {
        // A concurrent call may have just completed this same payment.
        if (await isPaidWithReference(booking._id, reference)) return true;
        await flagUnsecuredPayment(booking, reference);
        return false;
    }

    const paymentPaidAt = new Date();
    const update = await Booking.updateOne(
        {
            _id: booking._id,
            paymentReference: reference,
            paymentAmountKobo: transaction.amount,
            paymentStatus: { $in: ['pending', 'failed'] }
        },
        {
            $set: {
                status: 'approved',
                paymentStatus: 'paid',
                paymentPaidAt,
                subscriptionExpiresAt: Booking.addOneCalendarMonth(paymentPaidAt),
                paymentAuthorizationUrl: null,
                paymentIssue: null,
                paymentIssueAt: null
            }
        }
    );
    if (update.modifiedCount === 1) return true;

    if (await isPaidWithReference(booking._id, reference)) return true;

    // The property was claimed but the booking cannot be marked paid: release the claim.
    const anotherActiveStay = await Booking.exists({
        _id: { $ne: booking._id },
        propertyId,
        paymentStatus: 'paid',
        status: 'approved',
        subscriptionExpiresAt: { $gt: now }
    });
    if (!anotherActiveStay) {
        await Property.updateOne({ _id: propertyId, status: 'rented' }, { $set: { status: 'available' } });
    }
    return false;
}

module.exports = { recordVerifiedPayment, securePropertyForBooking };
