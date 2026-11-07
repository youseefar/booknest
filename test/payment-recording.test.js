const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Property = require('../models/Property');
const { recordVerifiedPayment } = require('../services/payment-recording');

const uri = process.env.MONGODB_TEST_URI;
const options = { skip: uri ? false : 'set MONGODB_TEST_URI to run database tests' };
const PRICE_KOBO = 100000;

function objectId() { return new mongoose.Types.ObjectId(); }

async function makeProperty(overrides = {}) {
    return Property.create({
        title: 'Test home', description: 'Test', price: 1000, location: 'Babura', address: '1 Test Road',
        landlordId: objectId(), verificationStatus: 'verified', status: 'available', ...overrides
    });
}

async function makeBooking(property, overrides = {}) {
    const studentId = objectId();
    const reference = `REF_${studentId}`;
    const booking = await Booking.create({
        studentId, propertyId: property._id, status: 'awaiting_payment', paymentStatus: 'pending',
        paymentReference: reference, paymentAmountKobo: PRICE_KOBO, ...overrides
    });
    return booking;
}

function context(booking) {
    return {
        _id: booking._id, propertyId: booking.propertyId, studentId: { email: 's@example.com' },
        status: booking.status, paymentStatus: booking.paymentStatus, paymentReference: booking.paymentReference,
        paymentAmountKobo: booking.paymentAmountKobo, subscriptionExpiresAt: booking.subscriptionExpiresAt
    };
}

function transaction(booking, overrides = {}) {
    return {
        amount: PRICE_KOBO, currency: 'NGN', status: 'success', reference: booking.paymentReference,
        customer: { email: 's@example.com' },
        metadata: { booking_id: String(booking._id), property_id: String(booking.propertyId) }, ...overrides
    };
}

test.before(async () => { if (uri) await mongoose.connect(uri); });
test.after(async () => { if (uri) { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); } });
test.beforeEach(async () => { if (uri) await Promise.all([Booking.deleteMany({}), Property.deleteMany({})]); });

test('secures the property and marks the booking paid', options, async () => {
    const property = await makeProperty();
    const booking = await makeBooking(property);
    await Property.updateOne({ _id: property._id }, { paymentReservationBookingId: booking._id, paymentReservationExpiresAt: new Date(Date.now() + 60000) });

    assert.equal(await recordVerifiedPayment(context(booking), booking.paymentReference, transaction(booking)), true);
    const [savedBooking, savedProperty] = await Promise.all([Booking.findById(booking._id), Property.findById(property._id)]);
    assert.equal(savedBooking.paymentStatus, 'paid');
    assert.equal(savedBooking.status, 'approved');
    assert.ok(savedBooking.subscriptionExpiresAt > new Date());
    assert.equal(savedProperty.status, 'rented');
    assert.equal(savedProperty.paymentReservationBookingId ?? null, null);
});

test('a late payment after the reservation expired still succeeds while the home is free', options, async () => {
    const property = await makeProperty();
    const booking = await makeBooking(property, { paymentStatus: 'failed' });

    assert.equal(await recordVerifiedPayment(context(booking), booking.paymentReference, transaction(booking)), true);
    assert.equal((await Booking.findById(booking._id)).paymentStatus, 'paid');
    assert.equal((await Property.findById(property._id)).status, 'rented');
});

test('a late payment for a home someone else already rented is flagged, not marked paid', options, async () => {
    const property = await makeProperty({ status: 'rented' });
    const booking = await makeBooking(property, { paymentStatus: 'failed' });

    assert.equal(await recordVerifiedPayment(context(booking), booking.paymentReference, transaction(booking)), false);
    const saved = await Booking.findById(booking._id);
    assert.notEqual(saved.paymentStatus, 'paid');
    assert.equal(saved.paymentIssue, 'paid_property_unavailable');
    assert.ok(saved.paymentIssueAt);
    assert.equal((await Property.findById(property._id)).status, 'rented');
});

test('a payment cannot take a home that another renter is actively checking out', options, async () => {
    const property = await makeProperty();
    const holder = await makeBooking(property);
    const late = await makeBooking(property, { paymentStatus: 'failed' });
    await Property.updateOne({ _id: property._id }, { paymentReservationBookingId: holder._id, paymentReservationExpiresAt: new Date(Date.now() + 600000) });

    assert.equal(await recordVerifiedPayment(context(late), late.paymentReference, transaction(late)), false);
    const savedProperty = await Property.findById(property._id);
    assert.equal(savedProperty.status, 'available');
    assert.equal(String(savedProperty.paymentReservationBookingId), String(holder._id));
    assert.equal((await Booking.findById(late._id)).paymentIssue, 'paid_property_unavailable');
});

test('duplicate webhooks are idempotent and keep one payment record', options, async () => {
    const property = await makeProperty();
    const booking = await makeBooking(property);
    const txn = transaction(booking);

    assert.equal(await recordVerifiedPayment(context(booking), booking.paymentReference, txn), true);
    const firstPaidAt = (await Booking.findById(booking._id)).paymentPaidAt;
    const results = await Promise.all([1, 2, 3].map(async () => {
        const fresh = await Booking.findById(booking._id);
        return recordVerifiedPayment(context(fresh), booking.paymentReference, txn);
    }));
    assert.deepEqual(results, [true, true, true]);
    const saved = await Booking.findById(booking._id);
    assert.equal(saved.paymentPaidAt.getTime(), firstPaidAt.getTime());
    assert.equal(saved.paymentHistory.length, 0);
    assert.equal(await Booking.countDocuments({ propertyId: property._id, paymentStatus: 'paid' }), 1);
});

test('duplicate webhook for an expired stay does not report failure or re-rent the home', options, async () => {
    const property = await makeProperty();
    const booking = await makeBooking(property, {
        status: 'expired', paymentStatus: 'paid', paymentPaidAt: new Date(Date.now() - 40 * 86400000),
        subscriptionExpiresAt: new Date(Date.now() - 10 * 86400000)
    });

    assert.equal(await recordVerifiedPayment(context(booking), booking.paymentReference, transaction(booking)), true);
    assert.equal((await Property.findById(property._id)).status, 'available');
});

test('two renters paying for the same home at once: exactly one wins', options, async () => {
    const property = await makeProperty();
    const first = await makeBooking(property, { paymentStatus: 'failed' });
    const second = await makeBooking(property, { paymentStatus: 'failed' });

    const results = await Promise.all([
        recordVerifiedPayment(context(first), first.paymentReference, transaction(first)),
        recordVerifiedPayment(context(second), second.paymentReference, transaction(second))
    ]);
    assert.equal(results.filter(Boolean).length, 1);
    assert.equal(await Booking.countDocuments({ propertyId: property._id, paymentStatus: 'paid' }), 1);
    assert.equal(await Booking.countDocuments({ propertyId: property._id, paymentIssue: 'paid_property_unavailable' }), 1);
    assert.equal((await Property.findById(property._id)).status, 'rented');
});

test('an unverified or failed transaction never rents the home', options, async () => {
    const property = await makeProperty();
    const booking = await makeBooking(property);
    for (const bad of [{ status: 'failed' }, { status: 'abandoned' }, { amount: PRICE_KOBO - 1 }, { currency: 'USD' }, { reference: 'OTHER' }]) {
        assert.equal(await recordVerifiedPayment(context(booking), booking.paymentReference, transaction(booking, bad)), false);
    }
    assert.equal((await Property.findById(property._id)).status, 'available');
    assert.notEqual((await Booking.findById(booking._id)).paymentStatus, 'paid');
});
