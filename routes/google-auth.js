const express = require('express');
const crypto = require('node:crypto');
const bcryptjs = require('bcryptjs');
const User = require('../models/User');
const { getSafePropertyReturnPath } = require('../services/auth-validation');
const {
    buildAuthorizationUrl,
    createPkcePair,
    createState,
    fetchGoogleProfile,
    getGoogleCallbackUrl,
    isGoogleConfigured,
    normalizeGoogleProfile,
    statesMatch
} = require('../services/google-auth');

const router = express.Router();

// Google can only create student or landlord accounts. Administrators are never created
// or signed in through Google.
const GOOGLE_REGISTRATION_ROLES = new Set(['student', 'landlord']);
const FLOW_LIFETIME_MS = 10 * 60 * 1000;
const MAX_LINK_ATTEMPTS = 5;
const ADMIN_MESSAGE = 'Administrator accounts must sign in with their email and password.';

function renderLoginError(res, message, returnTo = '', status = 400) {
    return res.status(status).render('login', { message, returnTo });
}

function getPostLoginPath(user, returnTo, isNewAccount) {
    if (user.role === 'landlord') return isNewAccount ? '/payout-setup' : '/dashboard';
    return returnTo || '/dashboard';
}

function completeLogin(req, res, next, user, returnTo, isNewAccount = false) {
    return req.logIn(user, error => {
        if (error) return next(error);
        return res.redirect(getPostLoginPath(user, returnTo, isNewAccount));
    });
}

function isExpired(timestamp) {
    return !timestamp || Date.now() - timestamp > FLOW_LIFETIME_MS;
}

// Start Google sign-in or registration.
router.get('/auth/google', (req, res, next) => {
    const returnTo = getSafePropertyReturnPath(req.query.returnTo);
    if (req.isAuthenticated && req.isAuthenticated()) return res.redirect('/dashboard');
    if (!isGoogleConfigured()) {
        return renderLoginError(res, 'Google sign-in is not available right now. Please use your email and password.', returnTo, 503);
    }

    const requestedRole = String(req.query.role || '');
    const { verifier, challenge } = createPkcePair();
    const state = createState();
    req.session.googleAuth = {
        state,
        verifier,
        intent: req.query.intent === 'register' ? 'register' : 'login',
        role: GOOGLE_REGISTRATION_ROLES.has(requestedRole) ? requestedRole : 'student',
        returnTo,
        createdAt: Date.now()
    };

    return req.session.save(error => {
        if (error) return next(error);
        return res.redirect(buildAuthorizationUrl({
            clientId: process.env.GOOGLE_CLIENT_ID,
            redirectUri: getGoogleCallbackUrl(),
            state,
            codeChallenge: challenge
        }));
    });
});

// Google redirects here after the person chooses an account.
router.get('/auth/google/callback', async (req, res, next) => {
    const flow = req.session?.googleAuth;
    if (req.session) delete req.session.googleAuth;

    try {
        if (!isGoogleConfigured()) {
            return renderLoginError(res, 'Google sign-in is not available right now. Please use your email and password.', '', 503);
        }
        if (!flow || isExpired(flow.createdAt) || !statesMatch(flow.state, req.query.state)) {
            return renderLoginError(res, 'Your Google sign-in could not be verified or has expired. Please try again.', flow?.returnTo || '');
        }
        if (req.query.error) {
            const message = req.query.error === 'access_denied'
                ? 'Google sign-in was cancelled.'
                : 'Google sign-in was not completed. Please try again.';
            return renderLoginError(res, message, flow.returnTo);
        }
        if (typeof req.query.code !== 'string' || !req.query.code) {
            return renderLoginError(res, 'Google sign-in was not completed. Please try again.', flow.returnTo);
        }

        let profile;
        try {
            profile = normalizeGoogleProfile(await fetchGoogleProfile({
                code: req.query.code,
                codeVerifier: flow.verifier
            }));
        } catch (error) {
            console.error('Google sign-in failed:', { name: error.name, code: error.code });
            return renderLoginError(res, 'We could not complete Google sign-in. Please try again or use your email and password.', flow.returnTo, 502);
        }
        if (!profile) {
            return renderLoginError(res, 'Your Google account needs a verified email address to continue.', flow.returnTo);
        }

        // 1. Returning Google user.
        const linkedUser = await User.findOne({ googleId: profile.googleId });
        if (linkedUser) {
            if (linkedUser.role === 'admin') return renderLoginError(res, ADMIN_MESSAGE, flow.returnTo, 403);
            return completeLogin(req, res, next, linkedUser, flow.returnTo);
        }

        // 2. Existing account with the same email: never create a duplicate. The person must
        //    prove they own the account by entering its password before Google is linked.
        const existingUser = await User.findOne({ email: profile.email });
        if (existingUser) {
            if (existingUser.role === 'admin') return renderLoginError(res, ADMIN_MESSAGE, flow.returnTo, 403);
            if (existingUser.googleId) {
                return renderLoginError(res, 'That email is already connected to a different Google account.', flow.returnTo, 409);
            }
            req.session.googleLink = {
                userId: String(existingUser._id),
                googleId: profile.googleId,
                email: profile.email,
                returnTo: flow.returnTo,
                createdAt: Date.now(),
                attempts: 0
            };
            return req.session.save(error => (error ? next(error) : res.redirect('/auth/google/link')));
        }

        // 3. No account yet. Signing in (not registering) never creates one silently, because the
        //    person has to choose between a home seeker and a property owner account first.
        if (flow.intent !== 'register') {
            return res.status(404).render('register', {
                message: 'No Jacob Estate account uses that Google email yet. Choose an account type to create one.',
                mode: 'student',
                role: 'student',
                pageTitle: 'Register',
                returnTo: flow.returnTo
            });
        }

        const role = GOOGLE_REGISTRATION_ROLES.has(flow.role) ? flow.role : 'student';
        let newUser;
        try {
            newUser = await User.create({
                name: profile.name,
                email: profile.email,
                // Random value: Google accounts can set their own password later via "Forgot password".
                password: crypto.randomBytes(32).toString('hex'),
                phone: '',
                role,
                googleId: profile.googleId,
                isVerified: true
            });
        } catch (error) {
            if (error.code === 11000) {
                return renderLoginError(res, 'An account already exists for that email. Please sign in.', flow.returnTo, 409);
            }
            throw error;
        }
        return completeLogin(req, res, next, newUser, flow.returnTo, true);
    } catch (error) {
        return next(error);
    }
});

// Confirm ownership of an existing password account before linking Google to it.
router.get('/auth/google/link', (req, res) => {
    const pending = req.session?.googleLink;
    if (!pending || isExpired(pending.createdAt)) {
        if (req.session) delete req.session.googleLink;
        return res.redirect('/login');
    }
    return res.render('google-link', { email: pending.email });
});

router.post('/auth/google/link', async (req, res, next) => {
    const pending = req.session?.googleLink;
    try {
        if (!pending || isExpired(pending.createdAt)) {
            if (req.session) delete req.session.googleLink;
            return renderLoginError(res, 'Your Google link request expired. Please try again.');
        }
        if (pending.attempts >= MAX_LINK_ATTEMPTS) {
            delete req.session.googleLink;
            return renderLoginError(res, 'Too many incorrect attempts. Please start again.', '', 429);
        }

        const user = await User.findById(pending.userId);
        if (!user || user.role === 'admin' || user.googleId || user.email !== pending.email) {
            delete req.session.googleLink;
            return renderLoginError(res, 'We could not link that Google account. Please sign in with your email and password.', pending.returnTo, 409);
        }

        const passwordMatches = await bcryptjs.compare(String(req.body.password || ''), user.password);
        if (!passwordMatches) {
            pending.attempts += 1;
            req.session.googleLink = pending;
            return res.status(401).render('google-link', { email: pending.email, message: 'That password is incorrect.' });
        }
        if (await User.exists({ googleId: pending.googleId })) {
            delete req.session.googleLink;
            return renderLoginError(res, 'That Google account is already linked to another Jacob Estate account.', pending.returnTo, 409);
        }

        user.googleId = pending.googleId;
        user.isVerified = true;
        await user.save();
        delete req.session.googleLink;
        return completeLogin(req, res, next, user, pending.returnTo);
    } catch (error) {
        if (error.code === 11000) {
            if (req.session) delete req.session.googleLink;
            return renderLoginError(res, 'That Google account is already linked to another Jacob Estate account.', '', 409);
        }
        return next(error);
    }
});

module.exports = router;
