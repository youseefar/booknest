// Route-level authorization and data-protection tests. They run against a real MongoDB when
// TEST_MONGODB_URI is set and are skipped otherwise.
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const mongoose = require('mongoose');

const uri = process.env.TEST_MONGODB_URI;
const skip = uri ? false : 'TEST_MONGODB_URI is not set';

const Booking = require('../models/Booking');
const Property = require('../models/Property');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const adminRoutes = require('../routes/admin');
const bookingRoutes = require('../routes/booking');

let server;
let baseUrl;
let currentUser = null;

test.before(async () => {
    if (!uri) return;
    await mongoose.connect(uri);
    const app = express();
    app.use(express.urlencoded({ extended: true }));
    app.use((req, res, next) => {
        req.isAuthenticated = () => Boolean(currentUser);
        req.user = currentUser;
        next();
    });
    app.use('/', adminRoutes);
    app.use('/', bookingRoutes);
    app.use((error, req, res, next) => res.status(500).send(error.message));
    server = http.createServer(app);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
    if (!uri) return;
    await new Promise(resolve => server.close(resolve));
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
});

async function post(path, body = {}) {
    const response = await fetch(baseUrl + path, {
        method: 'POST',
        redirect: 'manual',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(body)
    });
    return { status: response.status, text: await response.text(), location: response.headers.get('location') };
}

async function makeUser(role) {
    const id = new mongoose.Types.ObjectId().toString();
    return User.create({ name: role, email: `${role}-${id}@example.com`, password: 'x'.repeat(12), role });
}

async function makeProperty(landlord, overrides = {}) {
    return Property.create({
        title: 'Home', description: 'A home', price: 50000, location: 'Babura', address: '1 Road',
        landlordId: landlord._id, verificationStatus: 'verified', ...overrides
    });
}

async function makeBooking(student, property, overrides = {}) {
    return Booking.create({ studentId: student._id, propertyId: property._id, status: 'pending', ...overrides });
}

test('admin routes reject students, landlords and anonymous visitors', { skip }, async () => {
    const landlord = await makeUser('landlord');
    const student = await makeUser('student');
    const property = await makeProperty(landlord);
    for (const [user, expected] of [[student, 403], [landlord, 403], [null, 302]]) {
        currentUser = user;
        for (const action of ['delete', 'verification', 'manage', 'feature']) {
            const result = await post(`/admin/properties/${property._id}/${action}`, { status: 'verified' });
            assert.equal(result.status, expected, `${user?.role || 'anonymous'} ${action}`);
        }
        assert.equal((await post(`/admin/users/${student._id}/delete`)).status, expected);
    }
    assert.ok(await Property.exists({ _id: property._id }));
    assert.ok(await User.exists({ _id: student._id }));
});

test('admin delete archives a property with paid history instead of erasing it', { skip }, async () => {
    const admin = await makeUser('admin');
    const landlord = await makeUser('landlord');
    const student = await makeUser('student');
    const property = await makeProperty(landlord);
    const booking = await makeBooking(student, property, {
        status: 'expired', paymentStatus: 'paid', paymentReference: `REF_${property._id}`,
        paymentAmountKobo: 5000000, paymentPaidAt: new Date(Date.now() - 40 * 86400000),
        subscriptionExpiresAt: new Date(Date.now() - 10 * 86400000)
    });
    currentUser = admin;
    const result = await post(`/admin/properties/${property._id}/delete`);
    assert.equal(result.status, 302);
    assert.match(result.location, /listing-archived/);
    const archived = await Property.findById(property._id);
    assert.ok(archived.archivedAt);
    assert.equal(archived.verificationStatus, 'rejected');
    assert.ok(await Booking.exists({ _id: booking._id }), 'paid booking history is kept');
    assert.ok(await AuditLog.exists({ action: 'property.archive', targetId: String(property._id) }));
});

test('admin cannot delete or archive a property with an active paid stay', { skip }, async () => {
    const admin = await makeUser('admin');
    const landlord = await makeUser('landlord');
    const student = await makeUser('student');
    const property = await makeProperty(landlord, { status: 'rented' });
    await makeBooking(student, property, {
        status: 'approved', paymentStatus: 'paid', paymentReference: `REF_${property._id}`,
        paymentAmountKobo: 5000000, paymentPaidAt: new Date(), subscriptionExpiresAt: new Date(Date.now() + 20 * 86400000)
    });
    currentUser = admin;
    assert.equal((await post(`/admin/properties/${property._id}/delete`)).status, 409);
    const after = await Property.findById(property._id);
    assert.equal(after.status, 'rented');
    assert.equal(after.archivedAt, null);
});

test('admin can delete a property with no payment history and the action is logged', { skip }, async () => {
    const admin = await makeUser('admin');
    const landlord = await makeUser('landlord');
    const property = await makeProperty(landlord);
    currentUser = admin;
    assert.equal((await post(`/admin/properties/${property._id}/delete`)).status, 302);
    assert.equal(await Property.exists({ _id: property._id }), null);
    assert.ok(await AuditLog.exists({ action: 'property.delete', targetId: String(property._id) }));
});

test('accounts with payment records cannot be deleted, other accounts can', { skip }, async () => {
    const admin = await makeUser('admin');
    const landlord = await makeUser('landlord');
    const payingStudent = await makeUser('student');
    const idleStudent = await makeUser('student');
    const property = await makeProperty(landlord);
    await makeBooking(payingStudent, property, {
        status: 'expired', paymentStatus: 'paid', paymentReference: `REF_${property._id}`,
        paymentAmountKobo: 5000000, paymentPaidAt: new Date(Date.now() - 40 * 86400000),
        subscriptionExpiresAt: new Date(Date.now() - 10 * 86400000)
    });
    currentUser = admin;
    assert.equal((await post(`/admin/users/${payingStudent._id}/delete`)).status, 409);
    assert.equal((await post(`/admin/users/${landlord._id}/delete`)).status, 409);
    assert.ok(await User.exists({ _id: payingStudent._id }));
    assert.ok(await User.exists({ _id: landlord._id }));
    assert.equal((await post(`/admin/users/${idleStudent._id}/delete`)).status, 302);
    assert.equal(await User.exists({ _id: idleStudent._id }), null);
});

test('admins cannot delete themselves or other admins', { skip }, async () => {
    const admin = await makeUser('admin');
    const otherAdmin = await makeUser('admin');
    currentUser = admin;
    assert.equal((await post(`/admin/users/${admin._id}/delete`)).status, 400);
    assert.equal((await post(`/admin/users/${otherAdmin._id}/delete`)).status, 403);
});

test('landlords can only change statuses of unpaid bookings on their own properties', { skip }, async () => {
    const landlord = await makeUser('landlord');
    const otherLandlord = await makeUser('landlord');
    const student = await makeUser('student');
    const property = await makeProperty(landlord);
    const unpaid = await makeBooking(student, property);
    const paidStudent = await makeUser('student');
    const paid = await makeBooking(paidStudent, property, {
        status: 'approved', paymentStatus: 'paid', paymentReference: `REF_${property._id}`,
        paymentAmountKobo: 5000000, paymentPaidAt: new Date(), subscriptionExpiresAt: new Date(Date.now() + 20 * 86400000)
    });

    currentUser = otherLandlord;
    assert.equal((await post(`/bookings/${unpaid._id}/status`, { status: 'approved' })).status, 404);

    currentUser = landlord;
    assert.equal((await post(`/bookings/${unpaid._id}/status`, { status: 'viewed' })).status, 302);
    assert.equal((await Booking.findById(unpaid._id)).status, 'viewed');
    assert.equal((await post(`/bookings/${paid._id}/status`, { status: 'rejected' })).status, 409);
    assert.equal((await Booking.findById(paid._id)).status, 'approved');
    assert.equal((await post('/bookings/not-an-id/status', { status: 'viewed' })).status, 404);
});

test('students cannot use landlord booking actions', { skip }, async () => {
    const landlord = await makeUser('landlord');
    const student = await makeUser('student');
    const property = await makeProperty(landlord);
    const booking = await makeBooking(student, property);
    currentUser = student;
    assert.equal((await post(`/bookings/${booking._id}/status`, { status: 'approved' })).status, 403);
    assert.equal((await Booking.findById(booking._id)).status, 'pending');
});
