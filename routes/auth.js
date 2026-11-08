const express = require('express');
const crypto = require('crypto');
const passport = require('passport');
const bcryptjs = require('bcryptjs');
const User = require('../models/User');
const Property = require('../models/Property');
const Booking = require('../models/Booking');
const PropertyInquiry = require('../models/PropertyInquiry');
const { requireAuth } = require('../middleware/auth');
const { isEmailConfigured, sendEmail } = require('../services/email');
const {
  getRegistrationRole,
  normalizeEmail,
  isStrongPassword,
  getSafePropertyReturnPath,
  isLocalDevelopmentResetAllowed
} = require('../services/auth-validation');
const router = express.Router();

// Register Page
router.get('/register', (req, res) => {
  res.render('register', {
    mode: 'student',
    role: 'student',
      pageTitle: 'Register',
      returnTo: getSafePropertyReturnPath(req.query.returnTo)
  });
});

// Landlord Register Page
router.get('/register/landlord', (req, res) => {
  res.render('register-landlord', {
    role: 'landlord',
    pageTitle: 'Property Owner Registration',
    returnTo: getSafePropertyReturnPath(req.query.returnTo)
  });
});

// Register Post
router.post('/register', async (req, res, next) => {
  try {
    const nameValue = String(req.body.name || '').trim();
    const emailValue = normalizeEmail(req.body.email);
    const role = getRegistrationRole(req.body.role);
    const phoneValue = String(req.body.phone || '').trim();
    const returnTo = getSafePropertyReturnPath(req.body.returnTo);
    const { password, confirmPassword } = req.body;

    const registrationView = role === 'landlord' ? 'register-landlord' : 'register';

    if (nameValue.length < 2 || !emailValue.includes('@') || !isStrongPassword(password) || (role === 'landlord' && phoneValue.length < 7)) {
      return res.status(400).render(registrationView, {
        message: role === 'landlord'
          ? 'Please provide a valid name, email, and a strong password with at least 8 characters and one number.'
          : 'Please provide a valid name, email, and a strong password with at least 8 characters and one number.',
        mode: role === 'landlord' ? 'landlord' : 'student',
        role,
        pageTitle: role === 'landlord' ? 'Property Owner Registration' : 'Register',
        returnTo
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).render(registrationView, {
        message: 'Passwords do not match',
        mode: role === 'landlord' ? 'landlord' : 'student',
        role,
        pageTitle: role === 'landlord' ? 'Property Owner Registration' : 'Register',
        returnTo
      });
    }

    const userExists = await User.findOne({ email: emailValue });
    if (userExists) {
      return res.status(400).render(registrationView, {
        message: 'Email already registered',
        mode: role === 'landlord' ? 'landlord' : 'student',
        role,
        pageTitle: role === 'landlord' ? 'Property Owner Registration' : 'Register',
        returnTo
      });
    }

    const newUser = new User({
      name: nameValue,
      email: emailValue,
      password,
      phone: phoneValue,
      role
    });

    await newUser.save();
    if (role === 'landlord') {
      return req.logIn(newUser, loginError => {
        if (loginError) return next(loginError);
        return res.redirect('/payout-setup');
      });
    }

    return res.redirect(returnTo ? `/login?returnTo=${encodeURIComponent(returnTo)}` : '/login');
  } catch (err) {
    if (err.code === 11000) {
      const role = getRegistrationRole(req.body.role);
      const isLandlord = role === 'landlord';
      return res.status(400).render(isLandlord ? 'register-landlord' : 'register', {
        message: 'Email already registered.',
        mode: isLandlord ? 'landlord' : 'student',
        role,
        pageTitle: isLandlord ? 'Property Owner Registration' : 'Register',
        returnTo: getSafePropertyReturnPath(req.body.returnTo)
      });
    }
    return next(err);
  }
});

// Login Page
router.get('/login', (req, res) => {
  res.render('login', { returnTo: getSafePropertyReturnPath(req.query.returnTo) });
});

// Forgot password page
router.get('/forgot-password', (req, res) => {
  res.render('forgot-password');
});

// Create a short-lived password reset token. The response stays generic to avoid exposing account existence.
router.post('/forgot-password', async (req, res, next) => {
  const emailValue = normalizeEmail(req.body.email);
  const emailConfigured = isEmailConfigured();
  const localDevelopmentResetAllowed = isLocalDevelopmentResetAllowed(
    process.env,
    req.socket?.remoteAddress
  );
  const response = {
    message: emailConfigured
      ? 'If an account uses that email, reset instructions will be sent. If you do not receive them, check your spam folder or try again later.'
      : localDevelopmentResetAllowed
        ? 'In local development, a reset link appears below if the account matches.'
        : 'Password reset is temporarily unavailable. Please try again later.'
  };
  let resetUser = null;

  try {
    if (!emailConfigured && !localDevelopmentResetAllowed) {
      const error = new Error('Password reset email delivery is not configured.');
      error.code = 'EMAIL_NOT_CONFIGURED';
      error.status = 503;
      return next(error);
    }

    const user = await User.findOne({ email: emailValue }).select('+passwordResetToken +passwordResetExpires');
    if (user) {
      const rawToken = crypto.randomBytes(32).toString('hex');
      user.passwordResetToken = crypto.createHash('sha256').update(rawToken).digest('hex');
      user.passwordResetExpires = new Date(Date.now() + 30 * 60 * 1000);
      await user.save();
      resetUser = user;

      if (emailConfigured) {
        if (!process.env.APP_URL) {
          const error = new Error('APP_URL must be configured for password reset email delivery.');
          error.code = 'APP_URL_NOT_CONFIGURED';
          error.status = 503;
          throw error;
        }
        const resetUrl = new URL(`/reset-password/${rawToken}`, process.env.APP_URL).toString();
        try {
          await sendEmail({
            to: user.email,
            subject: 'Reset your Jacob Estate password',
            text: [
              `Hello ${user.name},`,
              '',
              'We received a request to reset your Jacob Estate password.',
              `Use this link within 30 minutes: ${resetUrl}`,
              '',
              'If you did not request this, you can ignore this email.'
            ].join('\n')
          });
        } catch (emailError) {
          console.error('Password reset email failed:', {
            name: emailError.name,
            code: emailError.code
          });
          user.passwordResetToken = undefined;
          user.passwordResetExpires = undefined;
          try {
            await user.save();
            resetUser = null;
          } catch (cleanupError) {
            console.error('Password reset token cleanup failed:', {
              name: cleanupError.name,
              code: cleanupError.code
            });
          }
          throw emailError;
        }
      } else {
        response.resetLink = `/reset-password/${rawToken}`;
      }
    }
    res.render('forgot-password', response);
  } catch (err) {
    if (resetUser) {
      resetUser.passwordResetToken = undefined;
      resetUser.passwordResetExpires = undefined;
      try {
        await resetUser.save();
      } catch (cleanupError) {
        console.error('Password reset token cleanup failed:', {
          name: cleanupError.name,
          code: cleanupError.code
        });
      }
    }
    return next(err);
  }
});

// Reset password page
router.get('/reset-password/:token', async (req, res) => {
  const tokenHash = crypto.createHash('sha256').update(req.params.token).digest('hex');
  const user = await User.findOne({ passwordResetToken: tokenHash, passwordResetExpires: { $gt: new Date() } }).select('+passwordResetToken +passwordResetExpires');
  if (!user) return res.status(400).render('reset-password', { message: 'This reset link is invalid or has expired.' });
  res.render('reset-password', { token: req.params.token });
});

// Reset password action
router.post('/reset-password/:token', async (req, res) => {
  const password = String(req.body.password || '');
  const confirmPassword = String(req.body.confirmPassword || '');
  if (!isStrongPassword(password) || password !== confirmPassword) {
    return res.status(400).render('reset-password', { token: req.params.token, message: password !== confirmPassword ? 'Passwords do not match.' : 'Password must be at least 8 characters and include a number.' });
  }

  const tokenHash = crypto.createHash('sha256').update(req.params.token).digest('hex');
  const user = await User.findOne({ passwordResetToken: tokenHash, passwordResetExpires: { $gt: new Date() } }).select('+passwordResetToken +passwordResetExpires');
  if (!user) return res.status(400).render('reset-password', { message: 'This reset link is invalid or has expired.' });

  user.password = password;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();
  res.redirect('/login?reset=success');
});

// Profile page
router.get('/profile', requireAuth, (req, res) => {
  res.render('profile', { user: req.user, payoutSetup: req.query.setup === 'payout' });
});

// Update profile details
router.post('/profile', requireAuth, async (req, res, next) => {
  try {
    const nameValue = String(req.body.name || '').trim();
    const emailValue = normalizeEmail(req.body.email);
    const phoneValue = String(req.body.phone || '').trim();
    if (nameValue.length < 2 || !emailValue.includes('@')) return res.status(400).render('profile', { user: req.user, message: 'Enter a valid name and email address.' });

    const existingUser = await User.findOne({ email: emailValue, _id: { $ne: req.user._id } });
    if (existingUser) return res.status(400).render('profile', { user: req.user, message: 'That email is already in use.' });

    req.user.name = nameValue;
    req.user.email = emailValue;
    req.user.phone = phoneValue;
    await req.user.save();
    res.render('profile', { user: req.user, success: 'Profile details updated successfully.' });
  } catch (err) {
    return next(err);
  }
});

// Change password while signed in
router.post('/profile/password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;
  const passwordMatches = await bcryptjs.compare(String(currentPassword || ''), req.user.password);
  if (!passwordMatches || !isStrongPassword(newPassword) || newPassword !== confirmPassword) {
    return res.status(400).render('profile', { user: req.user, message: !passwordMatches ? 'Current password is incorrect.' : newPassword !== confirmPassword ? 'New passwords do not match.' : 'New password must be at least 8 characters and include a number.' });
  }

  req.user.password = newPassword;
  await req.user.save();
  res.render('profile', { user: req.user, success: 'Password changed successfully.' });
});

// Login Post
router.post('/login', (req, res, next) => {
  const returnTo = getSafePropertyReturnPath(req.body.returnTo);
  passport.authenticate('local', (err, user, info) => {
    if (err) return next(err);
    if (!user) return res.status(401).render('login', { message: info?.message || 'Invalid email or password.', returnTo });
    req.logIn(user, (loginError) => {
      if (loginError) return next(loginError);
      res.redirect(user.role === 'admin'
        ? '/admin'
        : user.role === 'student' && returnTo ? returnTo : '/dashboard');
    });
  })(req, res, next);
});

// Dashboard
router.get('/dashboard', (req, res, next) => {
  if (!req.user) return res.redirect('/login');
  if (req.user.role === 'admin') return res.redirect('/admin');

  if (req.user.role === 'landlord') {
    return Property.find({ landlordId: req.user._id }).sort({ createdAt: -1 })
      .then(async allProperties => {
        // Archived listings stay in the booking lookup so landlords still see paid stays, but are not listed.
        const properties = allProperties.filter(property => !property.archivedAt);
        const propertyIds = allProperties.map(property => property._id);
        const [bookings, propertyInquiries] = await Promise.all([
          Booking.find({
            propertyId: { $in: propertyIds },
            status: { $ne: 'awaiting_payment' }
          })
            .populate('studentId', 'name email')
            .populate('propertyId', 'title status')
            .sort({ timestamp: -1 }),
          PropertyInquiry.find({ propertyId: { $in: propertyIds } })
            .populate('buyerId', 'name email')
            .populate('propertyId', 'title')
            .sort({ timestamp: -1 })
        ]);
        return res.render('dashboard', { user: req.user, properties, bookings, propertyInquiries });
      })
      .catch(next);
  }

  return Booking.syncExpiredSubscriptions()
    .then(() => Promise.all([
      Booking.find({ studentId: req.user._id })
        .populate('propertyId', 'title location price videoUrl videoFormat status listingType')
        .sort({ timestamp: -1 }),
      PropertyInquiry.find({ buyerId: req.user._id })
        .populate('propertyId', 'title location price status listingType')
        .sort({ timestamp: -1 })
    ]))
    .then(([bookings, propertyInquiries]) => res.render('dashboard', {
      user: req.user,
      properties: [],
      bookings,
      propertyInquiries,
      bookingResult: req.query.booking
    }))
    .catch(next);
});

// Logout
router.get('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    res.redirect('/');
  });
});

module.exports = router;