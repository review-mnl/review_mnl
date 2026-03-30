const express  = require('express');
const cors     = require('cors');
const path     = require('path');
const session  = require('express-session');
require('dotenv').config();
const passport = require('./config/passport');
const { runMigration } = require('./config/migrate');

// Force migration on redeploy
const app = express();




// Allow only the deployed frontend and localhost for CORS
const allowedOrigins = [
  process.env.CLIENT_URL,
  'https://review-mnl.vercel.app',
  'https://review-mnl-gamma.vercel.app',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:5501',
  'http://127.0.0.1:5501',
];

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

app.use(session({
  secret: process.env.SESSION_SECRET || 'rmnl_session_secret',
  resave: false,
  saveUninitialized: false,
}));
app.use(passport.initialize());
app.use(passport.session());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve the frontend static files
const frontendPath = path.join(__dirname, '..', '..', 'review.mnl-frontend', 'review.mnl-frontend');
app.use(express.static(frontendPath));

app.use('/api/auth',    require('./routes/auth'));
app.use('/api/admin',   require('./routes/admin'));
app.use('/api/centers', require('./routes/centers'));

app.get('/', (req, res) => res.json({ message: 'REVIEW.MNL API is running.' }));

app.use((err, req, res, next) => {
  console.error('Full error:', err);
  if (err.response && err.response.body) {
    console.error('Brevo error response:', err.response.body);
  }
  res.status(500).json({ message: err.message || 'Something went wrong.' });
});

const PORT = process.env.PORT || 5000;

// Start server after running migrations
(async () => {
  try {
    await runMigration();
    app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
})();
