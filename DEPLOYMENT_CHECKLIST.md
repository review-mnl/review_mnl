# ✅ DEPLOYMENT CHECKLIST

## Pre-Deployment

### Backend Setup
- [ ] Navigate to `review.mnl-backend/review.mnl-backend`
- [ ] Run `npm install` to install all dependencies (including new passport packages)
- [ ] Copy `.env.example` to `.env`
- [ ] Fill in all required environment variables in `.env`:
  - [ ] `DB_HOST` - Your MySQL database host
  - [ ] `DB_USER` - Your MySQL username
  - [ ] `DB_PASSWORD` - Your MySQL password
  - [ ] `DB_NAME` - Database name (e.g., `reviewmnl_db`)
  - [ ] `JWT_SECRET` - Generate a secure random string (32+ characters)
  - [ ] `CLIENT_URL` - Your Vercel frontend URL (e.g., `https://review-mnl.vercel.app`)
  - [ ] `BREVO_API_KEY` - Your Brevo API key for emails
  - [ ] `CLOUDINARY_*` - Cloudinary credentials (for image uploads)

### Database Setup
- [ ] Connect to your MySQL database
- [ ] Run migration script: `mysql -u user -p database < config/migration.sql`
- [ ] Verify columns exist: `DESCRIBE users;` should show:
  - [ ] `reset_token` column
  - [ ] `phone` column
  - [ ] `address` column
  - [ ] `bio` column
  - [ ] `profile_picture_url` column

### Frontend Setup
- [ ] No build steps required (static HTML/CSS/JS)
- [ ] Verify `api.js` has the updated API_BASE configuration

---

## Railway Deployment (Backend)

- [ ] Push all changes to GitHub
- [ ] Connect Railway to your GitHub repository
- [ ] In Railway dashboard, add environment variables:
  - [ ] `DB_HOST`
  - [ ] `DB_USER`
  - [ ] `DB_PASSWORD`
  - [ ] `DB_NAME`
  - [ ] `JWT_SECRET`
  - [ ] `CLIENT_URL`
  - [ ] `BREVO_API_KEY`
  - [ ] `CLOUDINARY_CLOUD_NAME`
  - [ ] `CLOUDINARY_API_KEY`
  - [ ] `CLOUDINARY_API_SECRET`
  - [ ] `PORT=5000`
- [ ] Deploy backend
- [ ] Copy your Railway app URL (e.g., `https://reviewmnl-production.up.railway.app`)
- [ ] Test backend: `curl https://your-backend.railway.app` should return API message

---

## Vercel Deployment (Frontend)

- [ ] Push all changes to GitHub
- [ ] Connect Vercel to your GitHub repository
- [ ] Set Root Directory: `.` (repository root)
- [ ] Set Build Command: Leave empty or `echo 'Build complete'`
- [ ] Set Output Directory: `review.mnl-frontend/review.mnl-frontend`
- [ ] Add environment variable in Vercel dashboard:
  - [ ] Key: `BACKEND_URL`
  - [ ] Value: Your Railway backend URL (e.g., `https://reviewmnl-production.up.railway.app`)
- [ ] Deploy frontend
- [ ] Update `CLIENT_URL` in Railway environment variables with your Vercel URL

---

## Post-Deployment Testing

### Test Backend
- [ ] Visit: `https://your-backend.railway.app`
  - Should show: `{"message":"REVIEW.MNL API is running."}`
- [ ] Test health: `curl https://your-backend.railway.app`

### Test Frontend
- [ ] Visit: `https://your-frontend.vercel.app`
- [ ] Open browser console (F12)
- [ ] Type: `console.log(API_BASE)`
  - Should show your Railway backend URL
- [ ] Verify no CORS errors in console

### Test User Registration
- [ ] Try registering a new student account
- [ ] Check for verification email
- [ ] Verify email by clicking link
- [ ] Try logging in

### Test Profile API (NEW)
- [ ] Log in with a test account
- [ ] Open browser console
- [ ] Run: `await UserAPI.getMyProfile()`
  - Should return user profile data
- [ ] Try updating profile: `await UserAPI.updateMyProfile({phone: '123-456-7890'})`
  - Should succeed

### Test Password Reset
- [ ] Click "Forgot Password"
- [ ] Enter email
- [ ] Check for reset email
- [ ] Click reset link
- [ ] Set new password
- [ ] Log in with new password

### Test Review Center Features
- [ ] Register as a review center
- [ ] Upload business documents
- [ ] Wait for admin approval (or approve via admin panel)
- [ ] View center profile
- [ ] Post a testimonial

---

## Troubleshooting

### "Column 'reset_token' doesn't exist"
```bash
mysql -u user -p database < config/migration.sql
```

### "Cannot find module 'passport'"
```bash
cd review.mnl-backend/review.mnl-backend
npm install
```

### "CORS error" in browser console
- Check that `CLIENT_URL` in Railway matches your Vercel URL exactly
- Check Railway logs for CORS errors
- Make sure your Vercel domain is in the `allowedOrigins` array

### API calls returning 404
- Verify `BACKEND_URL` is set in Vercel environment variables
- Check browser console: `console.log(API_BASE)`
- Verify Railway backend is running

### Emails not sending
- Verify `BREVO_API_KEY` is correct in Railway
- Check that sender email is verified in Brevo dashboard
- Check Railway logs for email errors

### Database connection errors
- Verify database credentials in Railway environment variables
- Check that database server allows connections from Railway
- Verify database exists and is accessible

---

## Final Verification

- [ ] All environment variables are set correctly
- [ ] Database migration completed successfully
- [ ] Backend is running on Railway
- [ ] Frontend is deployed on Vercel
- [ ] User registration works
- [ ] Email verification works
- [ ] Login works
- [ ] Profile API works (GET and PUT)
- [ ] Password reset works
- [ ] Review center registration works
- [ ] Testimonials work
- [ ] No errors in browser console
- [ ] No errors in Railway logs

---

## Files Changed/Added

### Modified:
- ✅ `vercel.json` - Fixed configuration
- ✅ `review.mnl-frontend/review.mnl-frontend/api.js` - Made API URL configurable
- ✅ `review.mnl-backend/review.mnl-backend/package.json` - Added dependencies
- ✅ `review.mnl-backend/review.mnl-backend/server.js` - Fixed CORS, added users route
- ✅ `review.mnl-backend/review.mnl-backend/config/mailer.js` - Environment-based config
- ✅ `review.mnl-backend/review.mnl-backend/config/schema.sql` - Added missing columns
- ✅ `netlify.toml` - Fixed redirect status
- ✅ `README.md` - Updated documentation

### Added:
- ✅ `review.mnl-backend/review.mnl-backend/controllers/userController.js` - NEW
- ✅ `review.mnl-backend/review.mnl-backend/routes/users.js` - NEW
- ✅ `review.mnl-backend/review.mnl-backend/.env.example` - NEW
- ✅ `review.mnl-backend/review.mnl-backend/config/migration.sql` - NEW
- ✅ `DEPLOYMENT_FIXES.md` - NEW
- ✅ `SETUP_GUIDE.md` - NEW
- ✅ `DEPLOYMENT_CHECKLIST.md` - NEW

---

## 🎉 Success!

Once all items are checked off, your REVIEW.MNL application should be fully deployed and functional!

If you encounter any issues, refer to:
- [SETUP_GUIDE.md](SETUP_GUIDE.md) for detailed instructions
- [DEPLOYMENT_FIXES.md](DEPLOYMENT_FIXES.md) for what was fixed
- Check Railway logs for backend errors
- Check browser console for frontend errors
