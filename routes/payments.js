const crypto = require('crypto');
const express = require('express');
const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Property = require('../models/Property');
const { requireRole } = require('../middleware/auth');

const router = express.Router();
const PAYSTACK_API = 'https://api.paystack.co';

function getTestSecretKey() {
    const secretKey = process.env.PAYSTACK_SECRET_KEY || '';
    return secretKey.startsWith('sk_test_') ? secretKey : null;
}

function getCallbackUrl(req) {
    const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    return new URL('/payments/paystack/callback', baseUrl).toString();
}

async function initializePaystackCheckout(req, res, booking, property, secretKey) {
    const amountKobo = Math.round(Number(property.price) * 100);
    if (!Number.isSafeInteger(amountKobo) || amountKobo <= 0) {
        return res.status(400).send('This property has an invalid payment amount.');
    }

    if (booking.paymentStatus === 'paid' && !['expired', 'cancelled'].includes(booking.status)) {
        return res.redirect('/my-bookings?payment=already-paid');
    }
    if (booking.paymentStatus === 'pending' && booking.paymentAuthorizationUrl) {
        return res.redirect(booking.paymentAuthorizationUrl);
    }

    if (booking.paymentStatus === 'paid' && ['expired', 'cancelled'].includes(booking.status)) {
        booking.paymentHistory.push({
            reference: booking.paymentReference,
            amountKobo: booking.paymentAmountKobo,
            paidAt: booking.paymentPaidAt,
            subscriptionExpiresAt: booking.subscriptionExpiresAt,
            endedStatus: booking.status,
            endedAt: new Date()
        });
    }

    const reference = `FUTB_${booking._id}_${crypto.randomBytes(12).toString('hex')}`;
    booking.status = 'awaiting_payment';
    booking.paymentStatus = 'pending';
    booking.paymentReference = reference;
    booking.paymentAmountKobo = amountKobo;
    booking.paymentAuthorizationUrl = null;
    booking.paymentPaidAt = null;
    booking.subscriptionExpiresAt = null;
    await booking.save();

    try {
        const response = await fetch(`${PAYSTACK_API}/transaction/initialize`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${secretKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: req.user.email,
                amount: amountKobo,
                currency: 'NGN',
                reference,
                callback_url: getCallbackUrl(req),
                metadata: { booking_id: String(booking._id), property_id: String(property._id) }
            }),
            signal: AbortSignal.timeout(15000)
        });
        const result = await response.json();
        const authorizationUrl = result?.data?.authorization_url;

        if (!response.ok || !result.status || !authorizationUrl || result.data.reference !== reference) {
            booking.paymentStatus = 'failed';
            await booking.save();
            return res.status(502).send('Paystack could not start the payment. Please try again.');
        }

        booking.paymentAuthorizationUrl = authorizationUrl;
        await booking.save();
        return res.redirect(authorizationUrl);
    } catch (error) {
        booking.paymentStatus = 'failed';
        booking.paymentAuthorizationUrl = null;
        await booking.save();
        throw error;
    }
}

router.post('/payments/properties/:id/initialize', requireRole('student'), async (req, res) => {
    const secretKey = getTestSecretKey();
    if (!secretKey) {
        return res.status(503).send('Paystack test mode is not configured. Add a PAYSTACK_SECRET_KEY beginning with sk_test_ to your environment.');
    }

    try {
        if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).send('Property not found.');
        await Booking.syncExpiredSubscriptions();
        const property = await Property.findOne({
            _id: req.params.id,
            status: 'available',
            verificationStatus: 'verified'
        });
        if (!property) return res.status(404).send('This property is no longer available for payment.');

        let booking = await Booking.findOne({ studentId: req.user._id, propertyId: property._id });
        if (!booking) {
            booking = new Booking({
                studentId: req.user._id,
                propertyId: property._id,
                status: 'awaiting_payment',
                message: ''
            });
        }
        return await initializePaystackCheckout(req, res, booking, property, secretKey);
    } catch (error) {
        if (error.code === 11000) return res.status(409).send('A checkout for this property is already being processed. Refresh your bookings to continue.');
        console.error('Paystack initialization failed:', error.message);
        return res.status(502).send('Unable to start the payment right now. Please try again.');
    }
});

router.post('/payments/bookings/:id/initialize', requireRole('student'), async (req, res) => {
    const secretKey = getTestSecretKey();
    if (!secretKey) {
        return res.status(503).send('Paystack test mode is not configured. Add a PAYSTACK_SECRET_KEY beginning with sk_test_ to your environment.');
    }

    try {
        if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).send('Booking not found.');
        const booking = await Booking.findOne({ _id: req.params.id, studentId: req.user._id }).populate('propertyId');
        if (!booking) return res.status(404).send('Booking not found.');
        if (!booking.propertyId) return res.status(404).send('The property for this booking is unavailable.');
        return await initializePaystackCheckout(req, res, booking, booking.propertyId, secretKey);
    } catch (error) {
        console.error('Paystack initialization failed:', error.message);
        return res.status(502).send('Unable to start the payment right now. Please try again.');
    }
});

router.post('/payments/bookings/:id/cancel', requireRole('student'), async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).send('Booking not found.');
        const now = new Date();
        const booking = await Booking.findOne({
            _id: req.params.id,
            studentId: req.user._id,
            paymentStatus: 'paid',
            status: 'approved',
            subscriptionExpiresAt: { $gt: now }
        });
        if (!booking) return res.status(404).send('Active booking not found.');

        booking.status = 'cancelled';
        await booking.save();

        const anotherActiveStay = await Booking.exists({
            propertyId: booking.propertyId,
            paymentStatus: 'paid',
            status: 'approved',
            subscriptionExpiresAt: { $gt: now }
        });
        if (!anotherActiveStay) {
            await Property.updateOne(
                { _id: booking.propertyId, status: 'rented' },
                { $set: { status: 'available' } }
            );
        }

        return res.redirect('/dashboard?booking=cancelled');
    } catch (error) {
        console.error('Booking cancellation failed:', error.message);
        return res.status(500).send('Unable to cancel this booking right now.');
    }
});

router.get('/payments/paystack/callback', async (req, res) => {
    const reference = String(req.query.reference || req.query.trxref || '').trim();
    const secretKey = getTestSecretKey();
    if (!reference || !secretKey) return res.redirect('/my-bookings?payment=verify');

    try {
        const booking = await Booking.findOne({ paymentReference: reference })
            .populate('studentId', 'email')
            .populate('propertyId', 'status');
        if (!booking) return res.redirect('/my-bookings?payment=failed');
        if (booking.paymentStatus === 'paid') return res.redirect('/my-bookings?payment=success');

        const response = await fetch(`${PAYSTACK_API}/transaction/verify/${encodeURIComponent(reference)}`, {
            headers: { Authorization: `Bearer ${secretKey}` },
            signal: AbortSignal.timeout(15000)
        });
        const result = await response.json();
        const transaction = result?.data;
        const validPayment = response.ok
            && result.status === true
            && transaction?.status === 'success'
            && transaction.reference === reference
            && transaction.amount === booking.paymentAmountKobo
            && transaction.currency === 'NGN'
            && transaction.customer?.email?.toLowerCase() === booking.studentId?.email?.toLowerCase()
            && String(transaction.metadata?.booking_id) === String(booking._id)
            && String(transaction.metadata?.property_id) === String(booking.propertyId?._id);

        if (!validPayment) {
            if (response.ok && transaction && transaction.status !== 'success') {
                await Booking.updateOne(
                    { _id: booking._id, paymentReference: reference, paymentStatus: 'pending' },
                    { $set: { paymentStatus: 'failed', paymentAuthorizationUrl: null } }
                );
                return res.redirect('/my-bookings?payment=failed');
            }
            return res.redirect('/my-bookings?payment=verify');
        }

        const paymentPaidAt = new Date();
        await Booking.updateOne(
            { _id: booking._id, paymentReference: reference, paymentAmountKobo: transaction.amount, paymentStatus: { $ne: 'paid' } },
            { $set: {
                status: 'approved',
                paymentStatus: 'paid',
                paymentPaidAt,
                subscriptionExpiresAt: Booking.addOneCalendarMonth(paymentPaidAt),
                paymentAuthorizationUrl: null
            } }
        );
        const updatedBooking = await Booking.findById(booking._id).select('paymentStatus paymentReference');
        if (updatedBooking?.paymentStatus === 'paid' && updatedBooking.paymentReference === reference) {
            await Property.updateOne({ _id: booking.propertyId._id, status: 'available' }, { $set: { status: 'rented' } });
        }
        return updatedBooking?.paymentStatus === 'paid' && updatedBooking.paymentReference === reference
            ? res.redirect('/my-bookings?payment=success')
            : res.redirect('/my-bookings?payment=verify');
    } catch (error) {
        console.error('Paystack verification failed:', error.message);
        return res.redirect('/my-bookings?payment=verify');
    }
});

module.exports = router;