const passport       = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const db     = require('./db');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// Find existing user by email or create a new student account for OAuth logins
async function findOrCreateOAuthUser(email, firstName, lastName) {
    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length > 0) return rows[0];

    // New OAuth user — create as a verified student with a random unusable password
    const fakePassword = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
    const [result] = await db.query(
        `INSERT INTO users (first_name, last_name, email, password, role, is_verified)
         VALUES (?, ?, ?, ?, 'student', 1)`,
        [firstName, lastName, email, fakePassword]
    );
    const [newUser] = await db.query('SELECT * FROM users WHERE id = ?', [result.insertId]);
    return newUser[0];
}

// ── Google Strategy ──────────────────────────────────────────────────────────
passport.use(new GoogleStrategy(
    {
        clientID:     process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL:  '/api/auth/google/callback',
    },
    async (accessToken, refreshToken, profile, done) => {
        try {
            const email = profile.emails?.[0]?.value;
            if (!email) return done(null, false, { message: 'Google did not provide an email address.' });
            const first = profile.name?.givenName  || profile.displayName || 'User';
            const last  = profile.name?.familyName || '';
            const user  = await findOrCreateOAuthUser(email, first, last);
            return done(null, user);
        } catch (err) {
            return done(err);
        }
    }
));

// ── Facebook Strategy ────────────────────────────────────────────────────────
passport.use(new FacebookStrategy(
    {
        clientID:      process.env.FACEBOOK_APP_ID,
        clientSecret:  process.env.FACEBOOK_APP_SECRET,
        callbackURL:   '/api/auth/facebook/callback',
        profileFields: ['id', 'emails', 'name'],
    },
    async (accessToken, refreshToken, profile, done) => {
        try {
            const email = profile.emails?.[0]?.value;
            if (!email) return done(null, false, { message: 'Facebook did not provide an email address. Please ensure your Facebook account has a verified email.' });
            const first = profile.name?.givenName  || 'User';
            const last  = profile.name?.familyName || '';
            const user  = await findOrCreateOAuthUser(email, first, last);
            return done(null, user);
        } catch (err) {
            return done(err);
        }
    }
));

// Minimal session serialization — only stores user ID in session during the OAuth redirect
passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
    try {
        const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [id]);
        done(null, rows[0] || false);
    } catch (err) {
        done(err);
    }
});

module.exports = passport;
