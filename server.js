const express = require('express');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo').default;
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
require('dotenv').config();
const authRoutes = require('./routes/auth');
const propertyRoutes = require('./routes/property');
const bookingRoutes = require('./routes/booking');
const adminRoutes = require('./routes/admin');
const paymentRoutes = require('./routes/payments');
const User = require('./models/User');
const bcryptjs = require('bcryptjs');

console.log('🔍 Environment variables loaded');
console.log('📍 MongoDB URI:', process.env.MONGODB_URI ? 'Loaded' : 'NOT FOUND');

const app = express();
mongoose.set('bufferCommands', false);
app.set('trust proxy', 1);

const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/futb-housing';

const uploadDir = path.join(__dirname, 'public', 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const safeName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    cb(null, safeName);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    cb(new Error('Only JPG, PNG, or WEBP images are allowed.'));
  },
  limits: { files: 5, fileSize: 5 * 1024 * 1024 }
});

app.locals.upload = upload;

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));
app.use(express.json({ limit: '20mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));
app.set('view engine', 'ejs');

const requestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
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
  if (mongoose.connection.readyState !== 1) return done(null, false);
  try {
    done(null, await User.findById(id));
  } catch (err) {
    done(err);
  }
});

const sessionOptions = {
  secret: process.env.SESSION_SECRET || 'development-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 14 * 24 * 60 * 60 * 1000
  }
};

const createSessionMiddleware = store => session({ ...sessionOptions, store });
let sessionMiddleware = createSessionMiddleware(new session.MemoryStore());

function enableMongoSessionStore() {
  const mongoSessionStore = MongoStore.create({
    client: mongoose.connection.getClient(),
    collectionName: 'sessions',
    ttl: 14 * 24 * 60 * 60
  });
  sessionMiddleware = createSessionMiddleware(mongoSessionStore);
}

app.use((req, res, next) => {
  if (mongoose.connection.readyState === 1) return next();

  const publicFallbackPaths = new Set(['/','/login','/register','/register/landlord','/forgot-password']);
  const canRenderWithoutDatabase = req.method === 'GET'
    && (publicFallbackPaths.has(req.path) || req.path.startsWith('/reset-password/'));

  if (canRenderWithoutDatabase) {
    req.databaseUnavailable = true;
    req.user = null;
    return next();
  }

  return res.status(503).type('text/plain').send('The database is temporarily unavailable. Please try again shortly.');
});

app.use((req, res, next) => {
  if (req.databaseUnavailable) return next();
  return sessionMiddleware(req, res, next);
});
app.use(passport.initialize());
const passportSession = passport.session();
app.use((req, res, next) => {
  if (req.databaseUnavailable) return next();
  return passportSession(req, res, next);
});
app.use('/', authRoutes);
app.use('/', propertyRoutes);
app.use('/', bookingRoutes);
app.use('/', adminRoutes);
app.use('/', paymentRoutes);

// Home page
app.get('/', async (req, res) => {
  let properties = [];

  try {
    const Property = require('./models/Property');
    properties = await Property.find({ status: 'available', verificationStatus: 'verified' })
      .sort({ createdAt: -1 })
      .limit(12)
      .populate('landlordId', 'name');
  } catch (err) {
    console.warn('⚠️ Unable to load homepage listings:', err.message);
    properties = [];
  }

  res.render('index', { user: req.user, properties });
});

const PORT = process.env.PORT || 5000;

async function startServer() {
  if (!process.env.MONGODB_URI) {
    console.warn('⚠️ No MONGODB_URI found in .env. Falling back to mongodb://127.0.0.1:27017/futb-housing');
  }

  try {
    console.log('🔌 Attempting to connect to MongoDB...');
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000
    });
    enableMongoSessionStore();
    console.log('✅ Connected to MongoDB successfully!');
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err.message);
    console.error('Use a valid local MongoDB URI or set a working Atlas connection in the .env file.');
    console.warn('⚠️ Starting the app without a working database connection.');
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT} without a live MongoDB connection.`);
    });
  }
}

startServer();