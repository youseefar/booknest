const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const express = require('express');
const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Property = require('../models/Property');
const User = require('../models/User');

const uri = process.env.TEST_MONGODB_URI;
const options = { skip: uri ? false : 'set TEST_MONGODB_URI to run database tests' };

process.env.PAYSTACK_SECRET_KEY = 'sk_test_unit_test_key';
process.env.APP_URL = 'http://localhost:5000';
const paymentRoutes = require('../routes/payments');

const realFetch = globalThis.fetch;
let paystackCalls = [];
let paystackShouldFail = false;
let server;
let baseUrl;
let currentStudent;

function stubPaystack() {
    globalThis.fetch = async (url, init = {}) => {
        if (!String(url).startsWith('https://api.paystack.co/')) return realFetch(url, init);
        const body = init.body ? JSON.parse(init.body) : null;
        paystackCalls.push({ url: String(url), body });
        if (paystackShouldFail) return new Response(JSON.stringify({ status: false, message: 'Paystack is down' }), { status: 500 });
        return new Response(JSON.stringify({
            status: true, message: 'Authorization URL created',
            data: { authorization_url: `https://checkout.paystack.com/${body.reference}`, access_code: 'code', reference: body.reference }
        }), { status: 200, headers: { 'content-type': 'application/json' } });
    };
}

test.before(async () => {
    if (!uri) return;
    await mongoose.connect(uri);
    stubPaystack();
    const app = express();
    app.set('view engine', 'ejs');
    app.set('views', path.join(__dirname, '..', 'views'));
    app.use(express.urlencoded({ extended: true }));
    app.use((req, res, next) => { req.user = currentStudent; req.isAuthenticated = () => true; next(); });
    app.use('/', paymentRoutes);
    await new Promise(resolve => { server = app.listen(0, '127.0.0.1', resolve); });
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});
test.after(async () => {
    globalThis.fetch = realFetch;
    if (server) await new Promise(resolve => server.close(resolve));
    if (uri) { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); }
});
test.beforeEach(async () => {
    paystackCalls = []; paystackShouldFail = false;
    if (uri) await Promise.all([Booking.deleteMany({}), Property.deleteMany({}), User.deleteMany({})]);
});

async function setup() {
    const landlord = await User.create({
        name: 'Landlord', email: 'landlord@example.com', password: 'Password123', role: 'landlord',
        payoutSubaccountCode: 'ACCT_test123', payoutSubaccountMode: 'test'
    });
    const property = await Property.create({
        title: 'Test home', description: 'Test', price: 1000, location: 'Babura', address: '1 Test Road',
        landlordId: landlord._id, verificationStatus: 'verified', status: 'available', listingType: 'rent'
    });
    return property;
}
function student(email) { return { _id: new mongoose.Types.ObjectId(), email, role: 'student' }; }
function startCheckout(property) {
    return realFetch(`${baseUrl}/payments/properties/${property._id}/initialize`, { method: 'POST', redirect: 'manual' });
}

test('starting checkout reserves the home and sends the amount and landlord subaccount to Paystack', options, async () => {
    const property = await setup();
    currentStudent = student('renter@example.com');

    const response = await startCheckout(property);
    assert.equal(response.status, 302);
    assert.match(response.headers.get('location'), /^https:\/\/checkout\.paystack\.com\/FUTB_/);

    assert.equal(paystackCalls.length, 1);
    assert.match(paystackCalls[0].url, /\/transaction\/initialize$/);
    assert.equal(paystackCalls[0].body.amount, 100000);
    assert.equal(paystackCalls[0].body.currency, 'NGN');
    assert.equal(paystackCalls[0].body.subaccount, 'ACCT_test123');
    assert.equal(paystackCalls[0].body.bearer, 'subaccount');
    assert.equal(paystackCalls[0].body.callback_url, 'http://localhost:5000/payments/paystack/callback');

    const booking = await Booking.findOne({ propertyId: property._id });
    assert.equal(booking.paymentStatus, 'pending');
    assert.equal(booking.status, 'awaiting_payment');
    const saved = await Property.findById(property._id);
    assert.equal(saved.status, 'available', 'a started checkout must not rent the home');
    assert.equal(String(saved.paymentReservationBookingId), String(booking._id));
    assert.ok(saved.paymentReservationExpiresAt > new Date());
});

test('a second renter cannot start checkout while the home is reserved', options, async () => {
    const property = await setup();
    currentStudent = student('first@example.com');
    assert.equal((await startCheckout(property)).status, 302);

    currentStudent = student('second@example.com');
    const response = await startCheckout(property);
    assert.equal(response.status, 409);
    assert.equal(paystackCalls.length, 1);
    assert.equal(await Booking.countDocuments({ propertyId: property._id }), 1);
});

test('if Paystack cannot start the payment, the reservation is released', options, async () => {
    const property = await setup();
    currentStudent = student('renter@example.com');
    paystackShouldFail = true;

    const response = await startCheckout(property);
    assert.ok(response.status >= 400);
    const saved = await Property.findById(property._id);
    assert.equal(saved.paymentReservationBookingId ?? null, null);
    assert.equal(saved.status, 'available');
    assert.equal((await Booking.findOne({ propertyId: property._id })).paymentStatus, 'failed');
});
