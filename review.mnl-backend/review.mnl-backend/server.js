const express = require('express');
const cors    = require('cors');
const path    = require('path');
const passport = require('./config/passport');
const db = require('./config/db');
require('dotenv').config();


const app = express();

// Initialize passport
app.use(passport.initialize());




// Allow only the deployed frontend and localhost for CORS
const allowedOrigins = [
  process.env.CLIENT_URL,
  'https://review-mnl.vercel.app',
  'https://review-mnl-gamma.vercel.app',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:5501',
  'http://127.0.0.1:5501',
  'http://localhost',
  'https://localhost',
  'capacitor://localhost',
].filter(Boolean); // Remove undefined values

function isAllowedOrigin(origin) {
  if (allowedOrigins.includes(origin)) return true;
  // Allow any *.vercel.app domain
  if (/^https:\/\/[a-zA-Z0-9-]+\.vercel\.app$/.test(origin)) return true;
  return false;
}

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (isAllowedOrigin(origin)) {
      return callback(null, true);
    } else {
      return callback(new Error('Not allowed by CORS: ' + origin));
    }
  },
  credentials: true
}));

// Handle preflight requests
app.options('*', cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (isAllowedOrigin(origin)) {
      return callback(null, true);
    } else {
      return callback(new Error('Not allowed by CORS: ' + origin));
    }
  },
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth',    require('./routes/auth'));
app.use('/api/admin',   require('./routes/admin'));
app.use('/api/centers', require('./routes/centers'));
app.use('/api/users',   require('./routes/users'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/enrollments', require('./routes/enrollments'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/reports', require('./routes/reports'));

// Optional debug route to inspect which database the app is connected to.
// Enable by setting environment variable `ENABLE_DEBUG_ROUTE=1` (temporary).
if (process.env.ENABLE_DEBUG_ROUTE === '1') {
  try {
    app.use('/api/debug', require('./routes/debug'));
    console.log('Debug route enabled: /api/debug/db');
  } catch (e) {
    console.warn('Debug route could not be mounted:', e && e.message);
  }
}

app.get('/', (req, res) => res.json({ message: 'REVIEW.MNL API is running.' }));

app.use((err, req, res, next) => {
  console.error('Full error:', err);
  if (err.response && err.response.body) {
    console.error('Brevo error response:', err.response.body);
  }
  res.status(500).json({ message: err.message || 'Something went wrong.' });
});

const PORT = process.env.PORT || 5000;

// Run DB migrations before starting the server (non-blocking safety)
const { runMigration } = require('./config/migrate');
runMigration().then(() => {
  app.listen(PORT, async () => {
    console.log(`Server running on http://localhost:${PORT}`);
    try {
      const [rows] = await db.query('SELECT DATABASE() AS db, @@hostname AS host, @@port AS port');
      if (rows && rows[0]) {
        console.log(`DB connected: ${rows[0].db} @ ${rows[0].host}:${rows[0].port}`);
      }
    } catch (e) {
      console.error('Failed to fetch DB connection identity:', e && e.message);
    }
  });
}).catch(err => {
  console.error('Migration failed to run:', err);
  process.exit(1);
});
