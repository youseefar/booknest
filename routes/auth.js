const express = require('express');
const crypto = require('crypto');
const passport = require('passport');
const bcryptjs = require('bcryptjs');
const User = require('../models/User');
const Property = require('../models/Property');
const Booking = require('../models/Booking');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

const getPropertyReturnPath = value => {
  const match = /^\/property\/([a-f\d]{24})$/i.exec(String(value || ''));
  return match ? `/property/${match[1]}` : '';
};

// Register Page
router.get('/register', (req, res) => {
  res.render('register', {
    mode: 'student',
    role: 'student',
      pageTitle: 'Register',
      returnTo: getPropertyReturnPath(req.query.returnTo)
  });
});

// Landlord Register Page
router.get('/register/landlord', (req, res) => {
  res.render('register-landlord', {
    role: 'landlord',
    pageTitle: 'Landlord Registration',
    returnTo: getPropertyReturnPath(req.query.returnTo)
  });
});

// Register Post
router.post('/register', async (req, res, next) => {
  try {
    const nameValue = String(req.body.name || '').trim();
    const emailValue = String(req.body.email || '').trim().toLowerCase();
    let role = String(req.body.role || 'student').trim();
    const phoneValue = String(req.body.phone || '').trim();
    const returnTo = getPropertyReturnPath(req.body.returnTo);
    const { password, confirmPassword } = req.body;

    if (!['student', 'landlord'].includes(role)) {
      role = 'student';
    }
    const registrationView = role === 'landlord' ? 'register-landlord' : 'register';

    if (nameValue.length < 2 || !emailValue.includes('@') || String(password || '').length < 6 || (role === 'landlord' && phoneValue.length < 7)) {
      return res.status(400).render(registrationView, {
        message: role === 'landlord'
          ? 'Please provide a valid name, email, password, and phone number.'
          : 'Please provide a valid name, email, and password.',
        mode: role === 'landlord' ? 'landlord' : 'student',
        role,
        pageTitle: role === 'landlord' ? 'Landlord Registration' : 'Register',
        returnTo
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).render(registrationView, {
        message: 'Passwords do not match',
        mode: role === 'landlord' ? 'landlord' : 'student',
        role,
        pageTitle: role === 'landlord' ? 'Landlord Registration' : 'Register',
        returnTo
      });
    }

    const userExists = await User.findOne({ email: emailValue });
    if (userExists) {
      return res.status(400).render(registrationView, {
        message: 'Email already registered',
        mode: role === 'landlord' ? 'landlord' : 'student',
        role,
        pageTitle: role === 'landlord' ? 'Landlord Registration' : 'Register',
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
        return res.redirect('/profile?setup=payout');
      });
    }

    return res.redirect(returnTo ? `/login?returnTo=${encodeURIComponent(returnTo)}` : '/login');
  } catch (err) {
    const fallbackRole = String(req.body.role || 'student').trim();
    const role = ['student', 'landlord'].includes(fallbackRole) ? fallbackRole : 'student';
    res.status(500).render(role === 'landlord' ? 'register-landlord' : 'register', {
      message: err.message,
      mode: role === 'landlord' ? 'landlord' : 'student',
      role,
      pageTitle: role === 'landlord' ? 'Landlord Registration' : 'Register',
      returnTo
    });
  }
});

// Login Page
router.get('/login', (req, res) => {
  res.render('login', { returnTo: getPropertyReturnPath(req.query.returnTo) });
});

// Forgot password page
router.get('/forgot-password', (req, res) => {
  res.render('forgot-password');
});

// Create a short-lived password reset token. The response stays generic to avoid exposing account existence.
router.post('/forgot-password', async (req, res) => {
  const emailValue = String(req.body.email || '').trim().toLowerCase();
  const response = { message: 'If an account uses that email, password reset instructions have been created.' };

  try {
    const user = await User.findOne({ email: emailValue }).select('+passwordResetToken +passwordResetExpires');
    if (user) {
      const rawToken = crypto.randomBytes(32).toString('hex');
      user.passwordResetToken = crypto.createHash('sha256').update(rawToken).digest('hex');
      user.passwordResetExpires = new Date(Date.now() + 30 * 60 * 1000);
      await user.save();
      if (process.env.NODE_ENV !== 'production') {
        response.resetLink = `/reset-password/${rawToken}`;
      }
      console.log(`Password reset link for ${user.email}: /reset-password/${rawToken}`);
    }
    res.render('forgot-password', response);
  } catch (err) {
    res.status(500).render('forgot-password', { message: 'Unable to create a reset request right now.' });
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
  if (password.length < 6 || password !== confirmPassword) {
    return res.status(400).render('reset-password', { token: req.params.token, message: password !== confirmPassword ? 'Passwords do not match.' : 'Password must be at least 6 characters.' });
  }

  const tokenHash = crypto.createHash('sha256').update(req.params.token).digest('hex');
  const user = await User.findOne({ passwordResetToken: tokenHash, passwordResetExpires: { $gt: new Date() } }).select('+passwordResetToken +passwordResetExpires');
  if (!user) return res.status(400).render('reset-password', { message: 'This reset link is invalid or has expired.' });

  user.password = password;
  user.passwordResetToken = null;
  user.passwordResetExpires = null;
  await user.save();
  res.redirect('/login?reset=success');
});

// Profile page
router.get('/profile', requireAuth, (req, res) => {
  res.render('profile', { user: req.user, payoutSetup: req.query.setup === 'payout' });
});

// Update profile details
router.post('/profile', requireAuth, async (req, res) => {
  try {
    const nameValue = String(req.body.name || '').trim();
    const emailValue = String(req.body.email || '').trim().toLowerCase();
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
    res.status(500).render('profile', { user: req.user, message: 'Unable to update your profile right now.' });
  }
});

// Change password while signed in
router.post('/profile/password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;
  const passwordMatches = await bcryptjs.compare(String(currentPassword || ''), req.user.password);
  if (!passwordMatches || String(newPassword || '').length < 6 || newPassword !== confirmPassword) {
    return res.status(400).render('profile', { user: req.user, message: !passwordMatches ? 'Current password is incorrect.' : newPassword !== confirmPassword ? 'New passwords do not match.' : 'New password must be at least 6 characters.' });
  }

  req.user.password = newPassword;
  await req.user.save();
  res.render('profile', { user: req.user, success: 'Password changed successfully.' });
});

// Login Post
router.post('/login', (req, res, next) => {
  const returnTo = getPropertyReturnPath(req.body.returnTo);
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
router.get('/dashboard', (req, res) => {
  if (!req.user) return res.redirect('/login');
  if (req.user.role === 'admin') return res.redirect('/admin');

  if (req.user.role === 'landlord') {
    return Property.find({ landlordId: req.user._id }).sort({ createdAt: -1 })
      .then(properties => Booking.find({
        propertyId: { $in: properties.map(property => property._id) },
        status: { $ne: 'awaiting_payment' }
      })
        .populate('studentId', 'name email')
        .populate('propertyId', 'title status')
        .sort({ timestamp: -1 })
        .then(bookings => res.render('dashboard', { user: req.user, properties, bookings })))
      .catch(err => res.status(500).send(err.message));
  }

  return Booking.syncExpiredSubscriptions()
    .then(() => Booking.find({ studentId: req.user._id })
      .populate('propertyId', 'title location price images videoUrl videoPosterUrl status')
      .sort({ timestamp: -1 }))
    .then(bookings => res.render('dashboard', { user: req.user, properties: [], bookings, bookingResult: req.query.booking }))
    .catch(err => res.status(500).send(err.message));
});

// Logout
router.get('/logout', (req, res) => {
  req.logout((err) => {
    if (err) return res.send(err);
    res.redirect('/');
  });
});

module.exports = router;