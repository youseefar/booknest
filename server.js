const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo').default;
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
require('dotenv').config();
const authRoutes = require('./routes/auth');
const propertyRoutes = require('./routes/property');
const inquiryRoutes = require('./routes/inquiry');
const adminRoutes = require('./routes/admin');
const User = require('./models/User');
const bcryptjs = require('bcryptjs');

console.log('🔍 Environment variables loaded');
console.log('📍 MongoDB URI:', process.env.MONGODB_URI ? 'Loaded' : 'NOT FOUND');

const app = express();
mongoose.set('bufferCommands', false);
app.set('trust proxy', 1);

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.urlencoded({ extended: false, limit: '20kb' }));
app.use(express.json({ limit: '20kb' }));
app.use(express.static('public'));
app.set('view engine', 'ejs');

const requestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-8',
  legacyHeaders: false
});
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: 'Too many login attempts. Please try again later.',
  standardHeaders: 'draft-8',
  legacyHeaders: false
});
app.use(requestLimiter);

passport.use(new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => {
  try {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return done(null, false, { message: 'Invalid email or password' });

    const passwordMatches = await bcryptjs.compare(password, user.password);
    if (!passwordMatches) return done(null, false, { message: 'Invalid email or password' });

    return done(null, user);
  } catch (err) {
    return done(err);
  }
}));

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    done(null, await User.findById(id));
  } catch (err) {
    done(err);
  }
});

app.use(session({
  secret: process.env.SESSION_SECRET || 'development-secret-change-me',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    collectionName: 'sessions',
    ttl: 14 * 24 * 60 * 60
  }),
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 14 * 24 * 60 * 60 * 1000
  }
}));
app.use(passport.initialize());
app.use(passport.session());
app.use('/login', loginLimiter);
app.use('/', authRoutes);
app.use('/', propertyRoutes);
app.use('/', inquiryRoutes);
app.use('/', adminRoutes);

// Home page
app.get('/', (req, res) => {
  res.render('index', { user: req.user });
});

const PORT = process.env.PORT || 5000;

async function startServer() {
  if (!process.env.MONGODB_URI) {
    console.error('❌ MongoDB connection failed: MONGODB_URI is missing from .env');
    process.exitCode = 1;
    return;
  }

  try {
    console.log('🔌 Attempting to connect to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000
    });
    console.log('✅ Connected to MongoDB successfully!');
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err.message);
    console.error('Check that the Atlas cluster is running and this IP is allowed in Network Access.');
    process.exitCode = 1;
  }
}

startServer();