// Integration tests against a real MongoDB. They run only when TEST_MONGODB_URI is set
// (CI provides a MongoDB service container); otherwise they are skipped.
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const uri = process.env.TEST_MONGODB_URI;
const skip = uri ? false : 'TEST_MONGODB_URI is not set';

const Booking = require('../models/Booking');
const Property = require('../models/Property');
const User = require('../models/User');
const { recordVerifiedPayment } = require('../services/payment-recording');

const AMOUNT = 5000000;

async function createFixture({ reservation = 'own', status = 'available' } = {}) {
    const suffix = new mongoose.Types.ObjectId().toString();
    const landlord = await User.create({
        name: 'Landlord', email: `landlord-${suffix}@example.com`, password: 'x'.repeat(12), role: 'landlord'
    });
    const property = await Property.create({
        title: 'Test home', description: 'A home', price: 50000, location: 'Babura', address: '1 Test Road',
        landlordId: landlord._id, status, verificationStatus: 'verified'
    });
    return { landlord, property };
}

async function createBooking(property, { reserve = true, expired = false } = {}) {
    const suffix = new mongoose.Types.ObjectId().toString();
    const student = await User.create({
        name: 'Student', email: `student-${suffix}@example.com`, password: 'x'.repeat(12), role: 'student'
    });
    const reference = `FUTB_TEST_${suffix}`;
    const booking = await Booking.create({
        studentId: student._id, propertyId: property._id, status: 'awaiting_payment',
        paymentStatus: 'pending', paymentReference: reference, paymentAmountKobo: AMOUNT
    });
    if (reserve) {
        await Property.updateOne({ _id: property._id }, {
            $set: {
                paymentReservationBookingId: booking._id,
                paymentReservationExpiresAt: new Date(Date.now() + (expired ? -60000 : 1800000))
            }
        });
    }
    return { booking, student, reference };
}

function paystackTransaction(booking, student, property, reference) {
    return {
        status: 'success', reference, amount: AMOUNT, currency: 'NGN',
        customer: { email: student.email },
        metadata: { booking_id: String(booking._id), property_id: String(property._id) }
    };
}

async function loadForRecording(bookingId) {
    return Booking.findById(bookingId).populate('studentId', 'email').populate('propertyId', 'status');
}

test.before(async () => { if (uri) await mongoose.connect(uri); });
test.after(async () => {
    if (!uri) return;
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
});

test('a verified payment secures the property and marks the booking paid', { skip }, async () => {
    const { property } = await createFixture();
    const { booking, student, reference } = await createBooking(property);
    const result = await recordVerifiedPayment(await loadForRecording(booking._id), reference, paystackTransaction(booking, student, property, reference));
    assert.equal(result, true);
    const savedBooking = await Booking.findById(booking._id);
    const savedProperty = await Property.findById(property._id);
    assert.equal(savedBooking.paymentStatus, 'paid');
    assert.equal(savedBooking.status, 'approved');
    assert.ok(savedBooking.subscriptionExpiresAt > new Date());
    assert.equal(savedProperty.status, 'rented');
    assert.ok(!savedProperty.paymentReservationBookingId);
});

test('a duplicate webhook is idempotent and keeps one payment record', { skip }, async () => {
    const { property } = await createFixture();
    const { booking, student, reference } = await createBooking(property);
    const transaction = paystackTransaction(booking, student, property, reference);
    assert.equal(await recordVerifiedPayment(await loadForRecording(booking._id), reference, transaction), true);
    const firstPaidAt = (await Booking.findById(booking._id)).paymentPaidAt;
    assert.equal(await recordVerifiedPayment(await loadForRecording(booking._id), reference, transaction), true);
    const after = await Booking.findById(booking._id);
    assert.equal(after.paymentPaidAt.getTime(), firstPaidAt.getTime());
    assert.equal(after.paymentHistory.length, 0);
    assert.equal(await Booking.countDocuments({ paymentReference: reference }), 1);
});

test('a duplicate webhook after the stay ended does not fail or re-rent the property', { skip }, async () => {
    const { property } = await createFixture();
    const { booking, student, reference } = await createBooking(property);
    const transaction = paystackTransaction(booking, student, property, reference);
    await recordVerifiedPayment(await loadForRecording(booking._id), reference, transaction);
    await Booking.updateOne({ _id: booking._id }, { $set: { status: 'expired', subscriptionExpiresAt: new Date(Date.now() - 1000) } });
    await Property.updateOne({ _id: property._id }, { $set: { status: 'available' } });
    assert.equal(await recordVerifiedPayment(await loadForRecording(booking._id), reference, transaction), true);
    assert.equal((await Property.findById(property._id)).status, 'available');
});

test('concurrent duplicate webhooks produce exactly one paid booking', { skip }, async () => {
    const { property } = await createFixture();
    const { booking, student, reference } = await createBooking(property);
    const transaction = paystackTransaction(booking, student, property, reference);
    const results = await Promise.all(Array.from({ length: 6 }, async () =>
        recordVerifiedPayment(await loadForRecording(booking._id), reference, transaction)));
    assert.ok(results.some(result => result === true));
    const after = await Booking.findById(booking._id);
    assert.equal(after.paymentStatus, 'paid');
    assert.equal(after.paymentIssue, null);
    assert.equal((await Property.findById(property._id)).status, 'rented');
});

test('two renters paying for one home at once: exactly one is confirmed, the other is flagged', { skip }, async () => {
    const { property } = await createFixture();
    const first = await createBooking(property, { reserve: false });
    const second = await createBooking(property, { reserve: false });
    const attempts = [first, second].map(async ({ booking, student, reference }) =>
        recordVerifiedPayment(await loadForRecording(booking._id), reference, paystackTransaction(booking, student, property, reference)));
    const results = await Promise.all(attempts);
    assert.equal(results.filter(Boolean).length, 1);
    const paid = await Booking.countDocuments({ propertyId: property._id, paymentStatus: 'paid' });
    const flagged = await Booking.countDocuments({ propertyId: property._id, paymentIssue: 'paid_property_unavailable' });
    assert.equal(paid, 1);
    assert.equal(flagged, 1);
    assert.equal((await Property.findById(property._id)).status, 'rented');
});

test('a late success after the reservation was released and expired is still secured', { skip }, async () => {
    const { property } = await createFixture();
    const { booking, student, reference } = await createBooking(property, { reserve: false });
    await Booking.updateOne({ _id: booking._id }, { $set: { paymentStatus: 'failed' } });
    const result = await recordVerifiedPayment(await loadForRecording(booking._id), reference, paystackTransaction(booking, student, property, reference));
    assert.equal(result, true);
    assert.equal((await Booking.findById(booking._id)).paymentStatus, 'paid');
    assert.equal((await Property.findById(property._id)).status, 'rented');
});

test('an expired reservation held by another renter does not block a verified payment', { skip }, async () => {
    const { property } = await createFixture();
    const other = await createBooking(property, { reserve: true, expired: true });
    const mine = await createBooking(property, { reserve: false });
    const result = await recordVerifiedPayment(await loadForRecording(mine.booking._id), mine.reference,
        paystackTransaction(mine.booking, mine.student, property, mine.reference));
    assert.equal(result, true);
    assert.equal((await Booking.findById(other.booking._id)).paymentStatus, 'pending');
});

test('an active reservation held by another renter blocks the payment and flags it for review', { skip }, async () => {
    const { property } = await createFixture();
    await createBooking(property, { reserve: true, expired: false });
    const mine = await createBooking(property, { reserve: false });
    const result = await recordVerifiedPayment(await loadForRecording(mine.booking._id), mine.reference,
        paystackTransaction(mine.booking, mine.student, property, mine.reference));
    assert.equal(result, false);
    const saved = await Booking.findById(mine.booking._id);
    assert.notEqual(saved.paymentStatus, 'paid');
    assert.equal(saved.paymentIssue, 'paid_property_unavailable');
    assert.equal((await Property.findById(property._id)).status, 'available');
});

test('a payment for an unavailable property is never marked paid', { skip }, async () => {
    const { property } = await createFixture({ status: 'maintenance' });
    const { booking, student, reference } = await createBooking(property);
    const result = await recordVerifiedPayment(await loadForRecording(booking._id), reference, paystackTransaction(booking, student, property, reference));
    assert.equal(result, false);
    const saved = await Booking.findById(booking._id);
    assert.notEqual(saved.paymentStatus, 'paid');
    assert.equal(saved.paymentIssue, 'paid_property_unavailable');
});

test('a transaction that does not match the booking is rejected without changes', { skip }, async () => {
    const { property } = await createFixture();
    const { booking, student, reference } = await createBooking(property);
    const wrongAmount = { ...paystackTransaction(booking, student, property, reference), amount: AMOUNT - 1 };
    assert.equal(await recordVerifiedPayment(await loadForRecording(booking._id), reference, wrongAmount), false);
    const failedStatus = { ...paystackTransaction(booking, student, property, reference), status: 'abandoned' };
    assert.equal(await recordVerifiedPayment(await loadForRecording(booking._id), reference, failedStatus), false);
    assert.equal((await Property.findById(property._id)).status, 'available');
    assert.equal((await Booking.findById(booking._id)).paymentStatus, 'pending');
});
