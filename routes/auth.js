const express = require('express');
const passport = require('passport');
const User = require('../models/User');
const Property = require('../models/Property');
const Booking = require('../models/Booking');
const router = express.Router();

// Register Page
router.get('/register', (req, res) => {
  res.render('register');
});

// Register Post
router.post('/register', async (req, res) => {
  try {
    const nameValue = String(req.body.name || '').trim();
    const emailValue = String(req.body.email || '').trim().toLowerCase();
    const { password, confirmPassword, role } = req.body;

    if (nameValue.length < 2 || !emailValue.includes('@') || String(password || '').length < 6 || !['student', 'landlord'].includes(role)) {
      return res.status(400).render('register', { message: 'Please provide a valid name, email, password, and role.' });
    }

    if (password !== confirmPassword) {
      return res.status(400).render('register', { message: 'Passwords do not match' });
    }

    const userExists = await User.findOne({ email: emailValue });
    if (userExists) {
      return res.status(400).render('register', { message: 'Email already registered' });
    }

    const newUser = new User({
      name: nameValue,
      email: emailValue,
      password,
      role
    });

    await newUser.save();
    res.redirect('/login');
  } catch (err) {
    res.status(500).render('register', { message: err.message });
  }
});

// Login Page
router.get('/login', (req, res) => {
  res.render('login');
});

// Login Post
router.post('/login', (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) return next(err);
    if (!user) return res.status(401).render('login', { message: info?.message || 'Invalid email or password.' });
    req.logIn(user, (loginError) => {
      if (loginError) return next(loginError);
      res.redirect(user.role === 'admin' ? '/admin' : '/dashboard');
    });
  })(req, res, next);
});

// Dashboard
router.get('/dashboard', (req, res) => {
  if (!req.user) return res.redirect('/login');
  if (req.user.role === 'admin') return res.redirect('/admin');

  if (req.user.role === 'landlord') {
    return Property.find({ landlordId: req.user._id }).sort({ createdAt: -1 })
      .then(properties => Booking.find({ propertyId: { $in: properties.map(property => property._id) } })
        .populate('studentId', 'name email')
        .populate('propertyId', 'title')
        .sort({ timestamp: -1 })
        .then(bookings => res.render('dashboard', { user: req.user, properties, bookings })))
      .catch(err => res.status(500).send(err.message));
  }

  return Booking.find({ studentId: req.user._id })
    .populate('propertyId', 'title location price')
    .sort({ timestamp: -1 })
    .then(bookings => res.render('dashboard', { user: req.user, properties: [], bookings }))
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