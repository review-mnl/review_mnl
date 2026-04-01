# REVIEW.MNL Deployment Configuration Issues - RESOLVED

## Issues Fixed:

### ✅ 1. Frontend API Configuration (CRITICAL)
**File:** `review.mnl-frontend/review.mnl-frontend/api.js`
- Made API base URL configurable via `window.BACKEND_URL`
- Allows environment-specific backend URL injection

### ✅ 2. Vercel Configuration (HIGH)
**File:** `vercel.json`
- Added proper version 2 configuration
- Added SPA rewrites for client-side routing
- Added security headers
- Fixed output directory path

### ✅ 3. Environment Variables Template (CRITICAL)
**File:** `review.mnl-backend/review.mnl-backend/.env.example`
- Created comprehensive template with all required variables
- Documented all optional OAuth variables
- Added clear instructions

### ✅ 4. Database Schema (CRITICAL)
**File:** `review.mnl-backend/review.mnl-backend/config/schema.sql`
- Added missing `reset_token` column
- Added missing `phone`, `address`, `bio`, `profile_picture_url` columns
- Added proper indexes for performance

### ✅ 5. Missing Dependencies (HIGH)
**File:** `review.mnl-backend/review.mnl-backend/package.json`
- Added `passport`: ^0.7.0
- Added `passport-google-oauth20`: ^2.0.0
- Added `passport-facebook`: ^3.0.0

### ✅ 6. CORS Configuration (MEDIUM)
**File:** `review.mnl-backend/review.mnl-backend/server.js`
- Added `.filter(Boolean)` to remove undefined CLIENT_URL
- Prevents CORS errors when CLIENT_URL is not set

### ✅ 7. Email Configuration (MEDIUM)
**File:** `review.mnl-backend/review.mnl-backend/config/mailer.js`
- Made sender email environment-based
- Made sender name environment-based
- Allows easy customization per environment

---

## Deployment Checklist:

### Backend (Railway):
- [ ] Copy `.env.example` to `.env`
- [ ] Fill in all required environment variables:
  - DB_HOST, DB_USER, DB_PASSWORD, DB_NAME
  - JWT_SECRET (generate a secure random string)
  - CLIENT_URL (your Vercel frontend URL)
  - BREVO_API_KEY (from Brevo dashboard)
  - Cloudinary credentials
- [ ] Run database migration: `mysql -u user -p database < config/schema.sql`
- [ ] Run `npm install` to install new dependencies
- [ ] Deploy to Railway
- [ ] Test endpoints: `curl https://your-backend.railway.app`

### Frontend (Vercel):
- [ ] Add environment variable in Vercel dashboard:
  - `BACKEND_URL` = your Railway backend URL
- [ ] Or add this to your HTML files before loading api.js:
  ```html
  <script>
    window.BACKEND_URL = 'https://your-backend.railway.app';
  </script>
  ```
- [ ] Deploy to Vercel
- [ ] Test in browser console: `console.log(API_BASE)`

### Database:
- [ ] Connect to your MySQL database
- [ ] Run the updated schema.sql file
- [ ] Verify all columns exist: `DESCRIBE users;`
- [ ] Check for reset_token column specifically

---

## Quick Start Commands:

### Backend setup:
```bash
cd review.mnl-backend/review.mnl-backend
cp .env.example .env
# Edit .env with your actual values
npm install
npm start
```

### Database migration:
```bash
mysql -u your_user -p your_database < config/schema.sql
```

### Test database columns:
```bash
mysql -u your_user -p -e "USE reviewmnl_db; DESCRIBE users;"
```

---

## What Changed:

1. **API_BASE in api.js** - Now checks `window.BACKEND_URL` first
2. **vercel.json** - Proper v2 config with rewrites
3. **.env.example** - Complete template with all variables
4. **schema.sql** - All missing columns added
5. **package.json** - Added passport dependencies
6. **server.js** - CORS filter for undefined values
7. **mailer.js** - Environment-based email config

---

## Next Steps:

1. **Configure environment variables** in Railway and Vercel dashboards
2. **Run database migration** to add missing columns
3. **Install new dependencies** with `npm install`
4. **Test locally** before deploying
5. **Deploy** and monitor logs for any errors

All critical issues are now fixed! 🎉
