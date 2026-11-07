// An admin may delete a property unless a payment is confirmed or still in progress. A checkout
// the renter abandoned must not block deletion. Runs against a real MongoDB when
// TEST_MONGODB_URI is set and is skipped otherwise.
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const mongoose = require('mongoose');

const uri = process.env.TEST_MONGODB_URI;
const skip = uri ? false : 'TEST_MONGODB_URI is not set';
process.env.PAYSTACK_SECRET_KEY = 'sk_test_unit_test_key';

const Booking = require('../models/Booking');
const Property = require('../models/Property');
const User = require('../models/User');
const adminRoutes = require('../routes/admin');
const { recordVerifiedPayment } = require('../services/payment-recording');

const realFetch = globalThis.fetch;
let paystackCalls = [];
let paystackReply = () => { throw new Error('unexpected Paystack call'); };
let server;
let baseUrl;
let currentUser = null;

test.before(async () => {
    if (!uri) return;
    // A database of its own, because test files run in parallel against the same server.
    await mongoose.connect(uri, { dbName: `delete_checkout_${process.pid}` });
    globalThis.fetch = async (url, init) => {
        if (String(url).startsWith('https://api.paystack.co')) {
            paystackCalls.push(String(url));
            return paystackReply(String(url));
        }
        return realFetch(url, init);
    };
    const app = express();
    app.use(express.urlencoded({ extended: true }));
    app.use((req, res, next) => {
        req.isAuthenticated = () => Boolean(currentUser);
        req.user = currentUser;
        next();
    });
    app.use('/', adminRoutes);
    app.use((error, req, res, next) => res.status(500).send(error.message));
    server = http.createServer(app);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
    if (!uri) return;
    globalThis.fetch = realFetch;
    await new Promise(resolve => server.close(resolve));
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
});

test.beforeEach(() => {
    paystackCalls = [];
    paystackReply = () => { throw new Error('unexpected Paystack call'); };
});

const verifyResponse = (status, httpStatus = 200) => new Response(
    JSON.stringify(httpStatus === 200 ? { status: true, data: { status } } : { status: false, message: status }),
    { status: httpStatus, headers: { 'Content-Type': 'application/json' } }
);

async function deleteProperty(property) {
    const response = await fetch(`${baseUrl}/admin/properties/${property._id}/delete`, {
        method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({})
    });
    return { status: response.status, text: await response.text(), location: response.headers.get('location') };
}

async function makeUser(role) {
    const id = new mongoose.Types.ObjectId().toString();
    return User.create({ name: role, email: `${role}-${id}@example.com`, password: 'x'.repeat(12), role });
}

// A property with a live (unexpired) checkout lock held by a pending, unpaid booking.
async function lockedProperty({ withReference = true } = {}) {
    const landlord = await makeUser('landlord');
    const student = await makeUser('student');
    const property = await Property.create({
        title: 'Home', description: 'A home', price: 50000, location: 'Babura', address: '1 Road',
        landlordId: landlord._id, verificationStatus: 'verified'
    });
    const booking = await Booking.create({
        studentId: student._id, propertyId: property._id, status: 'awaiting_payment', paymentStatus: 'pending',
        paymentAmountKobo: 5000000, paymentAuthorizationUrl: 'https://checkout.paystack.com/abc',
        ...(withReference ? { paymentReference: `FUTB_${property._id}_ref` } : {})
    });
    await Property.updateOne({ _id: property._id }, {
        paymentReservationBookingId: booking._id, paymentReservationExpiresAt: new Date(Date.now() + 25 * 60000)
    });
    return { property, booking, student };
}

test('a renter who opened the payment page and left does not block deletion', { skip }, async () => {
    const { property, booking } = await lockedProperty();
    currentUser = await makeUser('admin');
    paystackReply = () => verifyResponse('abandoned');

    assert.equal((await deleteProperty(property)).status, 302);
    assert.equal(await Property.exists({ _id: property._id }), null);
    const kept = await Booking.findById(booking._id);
    assert.equal(kept.paymentStatus, 'failed');
    assert.equal(kept.paymentAuthorizationUrl, null);
    assert.equal(paystackCalls.length, 1);
});

test('a payment Paystack has confirmed is never erased: the listing is archived', { skip }, async () => {
    const { property, booking } = await lockedProperty();
    currentUser = await makeUser('admin');
    paystackReply = () => verifyResponse('success');

    const result = await deleteProperty(property);
    assert.equal(result.status, 302);
    assert.match(result.location, /listing-archived/);
    const archived = await Property.findById(property._id);
    assert.ok(archived.archivedAt);
    assert.equal(archived.status, 'maintenance', 'no longer offered to renters');
    assert.equal((await Booking.findById(booking._id)).paymentStatus, 'pending', 'the booking is untouched');
});

test('a payment still in progress with Paystack archives the listing instead of erasing it', { skip }, async () => {
    const { property, booking } = await lockedProperty();
    currentUser = await makeUser('admin');
    paystackReply = () => verifyResponse('ongoing');

    const result = await deleteProperty(property);
    assert.equal(result.status, 302);
    assert.match(result.location, /listing-archived/);
    assert.ok((await Property.findById(property._id)).archivedAt);
    assert.ok(await Booking.exists({ _id: booking._id }));
});

test('if Paystack cannot be reached the listing is archived, never erased on a guess', { skip }, async () => {
    const { property, booking } = await lockedProperty();
    currentUser = await makeUser('admin');
    paystackReply = () => { throw new TypeError('fetch failed'); };

    const result = await deleteProperty(property);
    assert.equal(result.status, 302);
    assert.match(result.location, /listing-archived/);
    assert.ok((await Property.findById(property._id)).archivedAt);
    assert.ok(await Booking.exists({ _id: booking._id }));
});

test('a reference Paystack has never seen cannot have been paid, so deletion proceeds', { skip }, async () => {
    const { property } = await lockedProperty();
    currentUser = await makeUser('admin');
    paystackReply = () => verifyResponse('Transaction reference not found', 404);

    assert.equal((await deleteProperty(property)).status, 302);
    assert.equal(await Property.exists({ _id: property._id }), null);
});

test('a lock with no payment started needs no Paystack call and does not block deletion', { skip }, async () => {
    const { property, booking } = await lockedProperty({ withReference: false });
    currentUser = await makeUser('admin');

    assert.equal((await deleteProperty(property)).status, 302);
    assert.equal(await Property.exists({ _id: property._id }), null);
    assert.equal(paystackCalls.length, 0);
    assert.equal(await Booking.exists({ _id: booking._id }), null, 'bookings with no payment attempt are removed');
});

test('a payment completed later on an old payment page is flagged for refund, not lost', { skip }, async () => {
    const { property, booking, student } = await lockedProperty();
    currentUser = await makeUser('admin');
    paystackReply = () => verifyResponse('abandoned');
    assert.equal((await deleteProperty(property)).status, 302);

    const kept = await Booking.findById(booking._id);
    const transaction = {
        amount: kept.paymentAmountKobo, currency: 'NGN', status: 'success', reference: kept.paymentReference,
        customer: { email: student.email },
        metadata: { booking_id: String(kept._id), property_id: String(property._id) }
    };
    const context = {
        _id: kept._id, propertyId: property._id, studentId: { email: student.email }, status: kept.status,
        paymentStatus: kept.paymentStatus, paymentReference: kept.paymentReference, paymentAmountKobo: kept.paymentAmountKobo
    };
    assert.equal(await recordVerifiedPayment(context, kept.paymentReference, transaction), false);
    const flagged = await Booking.findById(booking._id);
    assert.equal(flagged.paymentIssue, 'paid_property_unavailable');
    assert.notEqual(flagged.paymentStatus, 'paid');
    assert.equal(await Property.exists({ _id: property._id }), null, 'the deleted property is not recreated');
});
