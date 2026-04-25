const passport       = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const db     = require('./db');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// Find existing user by email or create a new account for OAuth logins with the given role
async function findOrCreateOAuthUser(email, firstName, lastName, role) {
    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length > 0) return rows[0];

    // New OAuth user — create as a verified user with a random unusable password and the given role
    const userRole = (role === 'admin' || role === 'review_center') ? 'review_center' : 'student';
    const fakePassword = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
    const [result] = await db.query(
        `INSERT INTO users (first_name, last_name, email, password, role, is_verified)
         VALUES (?, ?, ?, ?, ?, 1)`,
        [firstName, lastName, email, fakePassword, userRole]
    );
    const [newUser] = await db.query('SELECT * FROM users WHERE id = ?', [result.insertId]);
    return newUser[0];
}

// ── Google Strategy ──────────────────────────────────────────────────────────
// Patch: Pass role from req._rmnlOAuthRole (set in /google route) to user creation
passport.use(new GoogleStrategy(
    {
        clientID:     process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL:  process.env.GOOGLE_CALLBACK_URL || '/api/auth/google/callback',
        passReqToCallback: true,
    },
    async (req, accessToken, refreshToken, profile, done) => {
        try {
            const email = profile.emails?.[0]?.value;
            if (!email) return done(null, false, { message: 'Google did not provide an email address.' });
            const first = profile.name?.givenName  || profile.displayName || 'User';
            const last  = profile.name?.familyName || '';
            // Use role from req._rmnlOAuthRole if present
            const role = req._rmnlOAuthRole || 'student';
            const user  = await findOrCreateOAuthUser(email, first, last, role);
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
