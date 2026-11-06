const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo').default;
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
require('dotenv').config();
const authRoutes = require('./routes/auth');
const googleAuthRoutes = require('./routes/google-auth');
const propertyRoutes = require('./routes/property');
const bookingRoutes = require('./routes/booking');
const adminRoutes = require('./routes/admin');
const paymentRoutes = require('./routes/payments');
const legalRoutes = require('./routes/legal');
const propertyInquiryRoutes = require('./routes/property-inquiry');
const User = require('./models/User');
const bcryptjs = require('bcryptjs');
const validateRequestBody = require('./middleware/validate-request-body');
const { normalizeEmail } = require('./services/auth-validation');

const app = express();
const { getPaymentMode } = require('./services/paystack');
const { isGoogleConfigured } = require('./services/google-auth');
const { isDatabaseError, isStorageLimitError } = require('./services/database-errors');
const { isOpaqueSameOriginNavigation } = require('./services/request-origin');
const { isCloudinaryConfigured, processVideoCleanupQueue } = require('./services/cloudinary-videos');
app.locals.paystackMode = getPaymentMode();
app.locals.googleAuthEnabled = isGoogleConfigured(process.env);
mongoose.set('bufferCommands', false);
app.set('trust proxy', 1);

const mongoUri = process.env.MONGODB_URI;

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));
app.use(express.json({
  limit: '1mb',
  verify: (req, res, buffer) => {
    if (req.path === '/payments/paystack/webhook') req.rawBody = Buffer.from(buffer);
  }
}));
app.use(validateRequestBody);
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');

app.get('/health', (req, res) => {
  const databaseConnected = mongoose.connection.readyState === 1;
  return res.status(databaseConnected ? 200 : 503).json({
    status: databaseConnected ? 'ok' : 'unavailable',
    database: databaseConnected ? 'connected' : 'disconnected'
  });
});

const isProduction = process.env.NODE_ENV === 'production';
const limiterOptions = {
  windowMs: 15 * 60 * 1000,
  standardHeaders: 'draft-8',
  legacyHeaders: false
};
const requestLimiter = rateLimit({
  limit: 300,
  ...limiterOptions
});
app.use(requestLimiter);
app.use('/login', rateLimit({ ...limiterOptions, limit: 10 }));
app.use('/auth/google', rateLimit({ ...limiterOptions, limit: 30 }));
app.use('/register', rateLimit({ ...limiterOptions, limit: 5, windowMs: 60 * 60 * 1000 }));
app.use('/forgot-password', rateLimit({ ...limiterOptions, limit: 5, windowMs: 60 * 60 * 1000 }));
app.use('/reset-password', rateLimit({ ...limiterOptions, limit: 10 }));
app.use('/payments', rateLimit({ ...limiterOptions, limit: 30 }));

function containsUnsafeMongoKeys(value) {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(containsUnsafeMongoKeys);
  return Object.entries(value).some(([key, nestedValue]) =>
    key.startsWith('$') || key.includes('.') || containsUnsafeMongoKeys(nestedValue)
  );
}

app.use((req, res, next) => {
  if (containsUnsafeMongoKeys(req.body) || containsUnsafeMongoKeys(req.query)) {
    const error = new Error('Request contains unsupported field names.');
    error.status = 400;
    return next(error);
  }
  return next();
});

const configuredOrigins = new Set();
for (const originValue of [process.env.APP_URL, process.env.FRONTEND_ORIGIN]) {
  if (!originValue) continue;
  try {
    configuredOrigins.add(new URL(originValue).origin);
  } catch {
    throw new Error('APP_URL and FRONTEND_ORIGIN must be valid absolute URLs.');
  }
}

app.use((req, res, next) => {
  const origin = req.get('Origin');
  if (!origin) return next();
  if (origin === 'null') {
    if (isOpaqueSameOriginNavigation(req)) return next();
    return res.sendStatus(403);
  }

  let requestOrigin;
  try {
    requestOrigin = new URL(`${req.protocol}://${req.get('host')}`).origin;
  } catch {
    return res.sendStatus(400);
  }

  const allowed = origin === requestOrigin || configuredOrigins.has(origin);
  if (!allowed) return res.sendStatus(403);

  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Requested-With');
    return res.sendStatus(204);
  }
  return next();
});

passport.use(new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => {
  try {
    const user = await User.findOne({ email: normalizeEmail(email) });
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
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000
  }
};

let sessionMiddleware = null;
let cloudinaryCleanupTimer = null;

function startCloudinaryCleanupWorker() {
  if (cloudinaryCleanupTimer || !isCloudinaryConfigured()) return;
  const runCleanup = () => {
    processVideoCleanupQueue().catch(error => {
      console.error('Cloudinary video cleanup worker failed:', {
        name: error.name,
        code: error.code
      });
    });
  };
  runCleanup();
  cloudinaryCleanupTimer = setInterval(runCleanup, 60 * 1000);
  cloudinaryCleanupTimer.unref();
}

function enableMongoSessionStore() {
  if (mongoose.connection.readyState !== 1) return;
  if (!sessionMiddleware) {
    const mongoSessionStore = MongoStore.create({
      client: mongoose.connection.getClient(),
      collectionName: 'sessions',
      ttl: 7 * 24 * 60 * 60
    });
    mongoSessionStore.on('error', error => {
      console.error('MongoDB session store error:', error.name);
    });
    sessionMiddleware = session({ ...sessionOptions, store: mongoSessionStore });
  }
  startCloudinaryCleanupWorker();
}

app.use((req, res, next) => {
  if (mongoose.connection.readyState === 1) return next();
  return res.status(503).render('error', {
    statusCode: 503,
    title: 'We are temporarily unavailable',
    message: 'We cannot reach the database needed to load or save your information.',
    detail: 'No successful save has been confirmed. Please try again later.',
    backUrl: '/',
    backLabel: 'Back to home',
    user: null
  });
});

app.use((req, res, next) => {
  if (!sessionMiddleware) {
    const error = new Error('The session store is not available.');
    error.status = 503;
    return next(error);
  }
  return sessionMiddleware(req, res, next);
});
app.use(passport.initialize());
const passportSession = passport.session();
app.use((req, res, next) => {
  return passportSession(req, res, next);
});
app.use('/', authRoutes);
app.use('/', googleAuthRoutes);
app.use('/', propertyRoutes);
app.use('/', bookingRoutes);
app.use('/', adminRoutes);
app.use('/', paymentRoutes);
app.use('/', legalRoutes);
app.use('/', propertyInquiryRoutes);

// Home page
app.get('/', async (req, res, next) => {
  let properties = [];

  try {
    const Property = require('./models/Property');
    properties = await Property.find({ status: 'available', verificationStatus: 'verified' })
      .sort({ createdAt: -1 })
      .limit(12)
      .populate('landlordId', 'name');
  } catch (err) {
    return next(err);
  }

  res.render('index', { user: req.user, properties });
});

app.use((req, res, next) => {
  const error = new Error('Page not found.');
  error.status = 404;
  next(error);
});

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);

  let statusCode = Number(error.status || error.statusCode) || 500;
  let title = statusCode === 404 ? 'We could not find that page' : 'Something went wrong';
  let message = statusCode === 404
    ? 'That page may have moved, or the address may be incorrect.'
    : 'We could not complete your request right now. Please try again.';
  let detail = 'We could not confirm whether your request was saved. Check your account before retrying.';
  let backUrl = '/';
  let backLabel = 'Back to home';
  const isAddPropertyRequest = req.path === '/add-property';
  const isEditPropertyRequest = /^\/property\/[a-f\d]{24}\/edit$/i.test(req.path);

  const storageLimitReached = isStorageLimitError(error);
  const databaseError = error.code !== 11000 && isDatabaseError(error);

  if (storageLimitReached) {
    statusCode = 503;
    title = 'Database storage is at capacity';
    message = 'We cannot save or load account information right now because the database has reached its storage limit.';
    detail = 'Your request was not confirmed as saved. Check your account before retrying payment-related actions, then contact support if this continues.';
  } else if (databaseError || mongoose.connection.readyState !== 1) {
    statusCode = 503;
    title = 'We are temporarily unavailable';
    message = 'We could not complete your request because the database connection is interrupted.';
    detail = 'Your request was not confirmed as saved. Please try again later.';
  } else if (error.status === 413) {
    statusCode = 413;
    title = 'That request is too large';
    message = 'Please reduce the amount of information submitted and try again.';
    detail = 'The request was not processed.';
  } else if (error.name === 'ValidationError' || error.name === 'CastError') {
    statusCode = 400;
    title = 'Check the information you entered';
    message = 'Some submitted information is not valid.';
    detail = 'Review the form and try again.';
  } else if (error.code === 11000) {
    statusCode = 409;
    title = 'That information is already in use';
    message = 'We could not save this because a matching record already exists.';
    detail = 'Check the existing account or request before trying again.';
  }

  if (isAddPropertyRequest || isEditPropertyRequest) {
    backUrl = isEditPropertyRequest ? req.path : '/add-property';
    backLabel = 'Return to your listing';
  } else if (req.user) {
    backUrl = '/dashboard';
    backLabel = 'Back to dashboard';
  }

  if (statusCode >= 500) {
    console.error('Request failed:', {
      name: error.name,
      code: error.code,
      message: databaseError || storageLimitReached ? 'Database operation failed.' : 'Request failed.',
      path: req.path
    });
  }

  return res.status(statusCode).render('error', {
    statusCode,
    title,
    message,
    detail,
    backUrl,
    backLabel,
    user: req.user || null
  });
});

const PORT = process.env.PORT || 5000;
let httpServer;
let mongoRetryTimer;

function validateEnvironment() {
  if (!['development', 'test', 'production'].includes(process.env.NODE_ENV)) {
    throw new Error('NODE_ENV must be explicitly set to development, test, or production.');
  }
  if (!mongoUri) throw new Error('MONGODB_URI must be configured.');
  if (!sessionOptions.secret || sessionOptions.secret.length < 32) {
    throw new Error('SESSION_SECRET must contain at least 32 characters.');
  }
  if (isProduction) {
    if (!process.env.APP_URL || new URL(process.env.APP_URL).protocol !== 'https:') {
      throw new Error('APP_URL must be the public HTTPS URL of the production service.');
    }
    if (String(process.env.PAYSTACK_MODE || 'live').trim().toLowerCase() !== 'live') {
      throw new Error('PAYSTACK_MODE must be live in production.');
    }
    if (!String(process.env.PAYSTACK_SECRET_KEY || '').startsWith('sk_live_')) {
      throw new Error('Production requires a live Paystack secret key in PAYSTACK_SECRET_KEY.');
    }
  }
}

function scheduleMongoReconnect() {
  if (mongoRetryTimer || mongoose.connection.readyState === 1) return;
  mongoRetryTimer = setTimeout(async () => {
    mongoRetryTimer = null;
    if (mongoose.connection.readyState === 1 || mongoose.connection.readyState === 2) return;
    try {
      await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000, maxPoolSize: 10 });
      enableMongoSessionStore();
      console.info('MongoDB connection restored.');
    } catch (error) {
      console.error('MongoDB reconnect failed:', error.name);
      scheduleMongoReconnect();
    }
  }, 30000);
  mongoRetryTimer.unref();
}

mongoose.connection.on('connected', enableMongoSessionStore);
mongoose.connection.on('disconnected', () => {
  console.warn('MongoDB disconnected.');
  scheduleMongoReconnect();
});

function handleFatalProcessError(error) {
  console.error('Fatal process error:', {
    name: error?.name || 'Error',
    code: error?.code
  });
  if (httpServer) {
    httpServer.close(() => process.exit(1));
    const forceExit = setTimeout(() => process.exit(1), 10000);
    forceExit.unref();
  } else {
    process.exit(1);
  }
}

process.on('unhandledRejection', handleFatalProcessError);
process.on('uncaughtException', handleFatalProcessError);

async function startServer() {
  validateEnvironment();
  httpServer = app.listen(PORT, () => {
    console.info(`Server listening on port ${PORT}.`);
  });
  try {
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: 10
    });
    enableMongoSessionStore();
    console.info('MongoDB connected.');
  } catch (err) {
    console.error('MongoDB connection failed:', err.name);
    scheduleMongoReconnect();
  }
}

startServer().catch(error => {
  console.error('Application startup failed:', error.message);
  process.exitCode = 1;
});