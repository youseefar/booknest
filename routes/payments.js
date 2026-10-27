const crypto = require('crypto');
const express = require('express');
const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Property = require('../models/Property');
const { requireRole } = require('../middleware/auth');

const router = express.Router();
const PAYSTACK_API = 'https://api.paystack.co';

function getPaymentMode() {
    const configuredMode = String(process.env.PAYSTACK_MODE || '').trim().toLowerCase();
    if (configuredMode === 'test' || configuredMode === 'live') return configuredMode;
    return process.env.NODE_ENV === 'production' ? 'live' : 'test';
}

function getPaystackSecretKey() {
    const secretKey = process.env.PAYSTACK_SECRET_KEY || '';
    const requiredPrefix = getPaymentMode() === 'live' ? 'sk_live_' : 'sk_test_';
    return secretKey.startsWith(requiredPrefix) ? secretKey : null;
}

function paystackConfigurationMessage() {
    const secretKey = process.env.PAYSTACK_SECRET_KEY || '';
    if (getPaymentMode() === 'test' && secretKey.startsWith('sk_live_')) {
        return 'A live Paystack key is configured while payment mode is test. Set PAYSTACK_MODE=live in your local environment and restart the app to enable live payments.';
    }
    if (getPaymentMode() === 'live' && secretKey.startsWith('sk_test_')) {
        return 'A test Paystack key is configured while payment mode is live. Set PAYSTACK_MODE=test or use a live key.';
    }
    return getPaymentMode() === 'live'
        ? 'Live Paystack payments are not configured. Set a PAYSTACK_SECRET_KEY beginning with sk_live_.'
        : 'Test Paystack payments are not configured. Set a PAYSTACK_SECRET_KEY beginning with sk_test_.';
}

async function paystackRequest(endpoint, secretKey, options = {}) {
    const response = await fetch(`${PAYSTACK_API}${endpoint}`, {
        ...options,
        headers: {
            Authorization: `Bearer ${secretKey}`,
            'Content-Type': 'application/json',
            ...options.headers
        },
        signal: options.signal || AbortSignal.timeout(15000)
    });
    const result = await response.json();
    if (!response.ok || result?.status !== true) {
        throw new Error(result?.message || 'Paystack request failed.');
    }
    return result.data;
}

function normalizeAccountName(value) {
    return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

async function resolvePayoutAccount(accountNumber, bankCode, secretKey) {
    const query = new URLSearchParams({ account_number: accountNumber, bank_code: bankCode });
    return paystackRequest(`/bank/resolve?${query}`, secretKey, { method: 'GET' });
}

router.get('/payments/banks', requireRole('landlord'), async (req, res) => {
    const secretKey = getPaystackSecretKey();
    if (!secretKey) return res.status(503).json({ message: paystackConfigurationMessage() });

    try {
        const banks = await paystackRequest('/bank?country=nigeria&perPage=100', secretKey, { method: 'GET' });
        return res.json({
            banks: banks
                .filter(bank => bank.active && bank.currency === 'NGN')
                .map(bank => ({ name: bank.name, code: bank.code }))
        });
    } catch (error) {
        console.error('Paystack bank list failed:', error.message);
        return res.status(502).json({ message: 'Unable to load the bank list right now.' });
    }
});

router.post('/payments/resolve-payout-account', requireRole('landlord'), async (req, res) => {
    const secretKey = getPaystackSecretKey();
    if (!secretKey) return res.status(503).json({ message: paystackConfigurationMessage() });

    const accountNumber = String(req.body.accountNumber || '').trim();
    const bankCode = String(req.body.bankCode || '').trim();
    if (!/^\d{10}$/.test(accountNumber) || !/^[a-z\d]{2,12}$/i.test(bankCode)) {
        return res.status(400).json({ message: 'Enter a valid 10-digit account number and choose a bank.' });
    }

    try {
        const account = await resolvePayoutAccount(accountNumber, bankCode, secretKey);
        if (!account?.account_name) return res.status(422).json({ message: 'Paystack could not verify this account.' });
        return res.json({ accountName: account.account_name });
    } catch (error) {
        console.error('Payout account verification failed:', error.message);
        return res.status(422).json({ message: 'Could not verify this account. Check the bank and account number.' });
    }
});

router.post('/payments/payout-account', requireRole('landlord'), async (req, res) => {
    const secretKey = getPaystackSecretKey();
    if (!secretKey) {
        return res.status(503).render('profile', { user: req.user, message: paystackConfigurationMessage() });
    }

    const accountNumber = String(req.body.accountNumber || '').trim();
    const bankCode = String(req.body.bankCode || '').trim();
    const verifiedAccountName = String(req.body.verifiedAccountName || '').trim();
    if (!/^\d{10}$/.test(accountNumber) || !/^[a-z\d]{2,12}$/i.test(bankCode) || !verifiedAccountName) {
        return res.status(400).render('profile', { user: req.user, message: 'Verify a valid 10-digit bank account before saving.' });
    }

    try {
        const account = await resolvePayoutAccount(accountNumber, bankCode, secretKey);
        if (normalizeAccountName(account?.account_name) !== normalizeAccountName(verifiedAccountName)) {
            return res.status(409).render('profile', { user: req.user, message: 'The verified account changed. Verify it again before saving.' });
        }

        const payload = {
            business_name: req.user.name,
            settlement_bank: bankCode,
            account_number: accountNumber,
            percentage_charge: 1,
            primary_contact_email: req.user.email,
            primary_contact_name: req.user.name,
            primary_contact_phone: req.user.phone || ''
        };
        const useExistingSubaccount = req.user.payoutSubaccountCode
            && req.user.payoutSubaccountMode === getPaymentMode();
        const subaccount = useExistingSubaccount
            ? await paystackRequest(`/subaccount/${encodeURIComponent(req.user.payoutSubaccountCode)}`, secretKey, {
                method: 'PUT',
                body: JSON.stringify(payload)
            })
            : await paystackRequest('/subaccount', secretKey, {
                method: 'POST',
                body: JSON.stringify(payload)
            });

        if (!subaccount?.subaccount_code) throw new Error('Paystack did not return a subaccount code.');

        req.user.payoutSubaccountCode = subaccount.subaccount_code;
        req.user.payoutSubaccountMode = getPaymentMode();
        req.user.payoutBankCode = bankCode;
        req.user.payoutBankName = subaccount.settlement_bank || bankCode;
        req.user.payoutAccountName = account.account_name;
        req.user.payoutAccountLast4 = accountNumber.slice(-4);
        await req.user.save();

        return res.render('profile', { user: req.user, success: 'Your verified payout account is ready to receive rental payments.' });
    } catch (error) {
        console.error('Payout account setup failed:', error.message);
        return res.status(502).render('profile', { user: req.user, message: 'Paystack could not save this payout account. Please try again.' });
    }
});

function getCallbackUrl(req) {
    const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    return new URL('/payments/paystack/callback', baseUrl).toString();
}

async function initializePaystackCheckout(req, res, booking, property, secretKey) {
    const landlord = property.landlordId;
    const subaccountCode = landlord?.payoutSubaccountCode;
    if (!subaccountCode || landlord.payoutSubaccountMode !== getPaymentMode()) {
        return res.status(409).render('error', {
            statusCode: 409,
            title: 'Online payment is not ready yet',
            message: `This landlord has not configured a payout account for ${getPaymentMode()} mode.`,
            detail: 'Please contact the landlord or try again later.',
            backUrl: `/property/${property._id}`,
            backLabel: 'Back to property',
            user: req.user || null
        });
    }

    const amountKobo = Math.round(Number(property.price) * 100);
    if (!Number.isSafeInteger(amountKobo) || amountKobo <= 0) {
        return res.status(400).send('This property has an invalid payment amount.');
    }

    if (booking.paymentStatus === 'paid' && !['expired', 'cancelled'].includes(booking.status)) {
        return res.redirect('/my-bookings?payment=already-paid');
    }
    if (booking.paymentStatus === 'pending'
        && booking.paymentAuthorizationUrl
        && booking.paymentSubaccountCode === subaccountCode) {
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
    booking.paymentSubaccountCode = subaccountCode;
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
                subaccount: subaccountCode,
                bearer: 'subaccount',
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
    const secretKey = getPaystackSecretKey();
    if (!secretKey) {
        return res.status(503).send(paystackConfigurationMessage());
    }

    try {
        if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).send('Property not found.');
        await Booking.syncExpiredSubscriptions();
        const property = await Property.findOne({
            _id: req.params.id,
            status: 'available',
            verificationStatus: 'verified'
        }).populate('landlordId', 'payoutSubaccountCode payoutSubaccountMode');
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
    const secretKey = getPaystackSecretKey();
    if (!secretKey) {
        return res.status(503).send(paystackConfigurationMessage());
    }

    try {
        if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).send('Booking not found.');
        const booking = await Booking.findOne({ _id: req.params.id, studentId: req.user._id }).populate({
            path: 'propertyId',
            populate: { path: 'landlordId', select: 'payoutSubaccountCode payoutSubaccountMode' }
        });
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

router.get('/payments/receipts/:reference', requireRole('student'), async (req, res) => {
    const reference = String(req.params.reference || '').trim();
    if (!reference || reference.length > 100) return res.status(404).render('error', {
        statusCode: 404,
        title: 'Receipt not found',
        message: 'We could not find a receipt for that payment.',
        detail: 'Open My Bookings to view receipts for your payments.',
        backUrl: '/my-bookings',
        backLabel: 'Back to my bookings',
        user: req.user
    });

    try {
        const booking = await Booking.findOne({
            studentId: req.user._id,
            $or: [
                { paymentReference: reference, paymentStatus: 'paid' },
                { 'paymentHistory.reference': reference }
            ]
        }).populate('propertyId', 'title location');

        if (!booking || !booking.propertyId) return res.status(404).render('error', {
            statusCode: 404,
            title: 'Receipt not found',
            message: 'We could not find a receipt for that payment.',
            detail: 'Open My Bookings to view receipts for your payments.',
            backUrl: '/my-bookings',
            backLabel: 'Back to my bookings',
            user: req.user
        });

        const previousPayment = booking.paymentHistory.find(payment => payment.reference === reference);
        const receipt = previousPayment
            ? {
                reference,
                amountKobo: previousPayment.amountKobo,
                paidAt: previousPayment.paidAt,
                expiresAt: previousPayment.subscriptionExpiresAt
            }
            : booking.paymentStatus === 'paid' && booking.paymentReference === reference
            ? {
                reference,
                amountKobo: booking.paymentAmountKobo,
                paidAt: booking.paymentPaidAt,
                expiresAt: booking.subscriptionExpiresAt
            }
            : null;

        if (!receipt || !Number.isSafeInteger(receipt.amountKobo) || receipt.amountKobo <= 0 || !receipt.paidAt) {
            return res.status(404).render('error', {
                statusCode: 404,
                title: 'Receipt not found',
                message: 'We could not find a receipt for that payment.',
                detail: 'Open My Bookings to view receipts for your payments.',
                backUrl: '/my-bookings',
                backLabel: 'Back to my bookings',
                user: req.user
            });
        }

        return res.render('receipt', { user: req.user, booking, receipt });
    } catch (error) {
        console.error('Payment receipt lookup failed:', error.message);
        return res.status(500).render('error', {
            statusCode: 500,
            title: 'Receipt unavailable',
            message: 'We could not load this receipt right now.',
            detail: 'Please return to My Bookings and try again.',
            backUrl: '/my-bookings',
            backLabel: 'Back to my bookings',
            user: req.user
        });
    }
});

router.get('/payments/paystack/callback', async (req, res) => {
    const reference = String(req.query.reference || req.query.trxref || '').trim();
    const secretKey = getPaystackSecretKey();
    if (!reference || !secretKey) return res.redirect('/my-bookings?payment=verify');

    try {
        const booking = await Booking.findOne({ paymentReference: reference })
            .populate('studentId', 'email')
            .populate('propertyId', 'status');
        if (!booking) return res.redirect('/my-bookings?payment=failed');
        if (booking.paymentStatus === 'paid') {
            return res.redirect(`/my-bookings?payment=success&reference=${encodeURIComponent(reference)}`);
        }

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
            ? res.redirect(`/my-bookings?payment=success&reference=${encodeURIComponent(reference)}`)
            : res.redirect('/my-bookings?payment=verify');
    } catch (error) {
        console.error('Paystack verification failed:', error.message);
        return res.redirect('/my-bookings?payment=verify');
    }
});

module.exports = router;