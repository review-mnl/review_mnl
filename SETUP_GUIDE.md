# REVIEW.MNL - Setup Instructions

## 🚀 Quick Setup Guide

### 1. Backend Configuration (Railway)

#### Install Dependencies:
```bash
cd review.mnl-backend/review.mnl-backend
npm install
```

#### Setup Environment Variables:
Create a `.env` file from the template:
```bash
cp .env.example .env
```

Edit `.env` and fill in these **REQUIRED** values:
```env
DB_HOST=your_mysql_host
DB_USER=your_mysql_user
DB_PASSWORD=your_mysql_password
DB_NAME=reviewmnl_db
JWT_SECRET=generate_a_long_random_string_here
CLIENT_URL=https://your-frontend.vercel.app
BREVO_API_KEY=your_brevo_api_key
```

#### Run Database Migration:
```bash
# Connect to your MySQL database and run:
mysql -u your_user -p your_database < config/schema.sql

# Or if database already exists, run migration:
mysql -u your_user -p your_database < config/migration.sql
```

#### Start Backend:
```bash
npm start
```

Backend should run on `http://localhost:5000`

---

### 2. Frontend Configuration (Vercel)

#### Option A: Using Vercel Environment Variables (Recommended)
1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add: `BACKEND_URL` = `https://your-backend.railway.app`
3. Redeploy

#### Option B: Direct Configuration
Add this to your main HTML files before loading `api.js`:
```html
<script>
  window.BACKEND_URL = 'https://your-backend.railway.app';
</script>
<script src="api.js"></script>
```

---

### 3. Database Setup

Run this to verify all columns exist:
```sql
USE reviewmnl_db;
DESCRIBE users;
```

You should see these columns:
- id
- first_name
- last_name
- email
- password
- **phone** ✅
- **address** ✅
- **bio** ✅
- **profile_picture_url** ✅
- role
- is_verified
- verify_token
- **reset_token** ✅
- created_at

---

### 4. Deployment Steps

#### Backend (Railway):
1. Push code to GitHub
2. Connect Railway to your repository
3. Add environment variables in Railway dashboard
4. Deploy
5. Copy your Railway app URL

#### Frontend (Vercel):
1. Push code to GitHub
2. Connect Vercel to your repository
3. Set Root Directory: `./` (repository root)
4. Add environment variable: `BACKEND_URL=https://your-backend.railway.app`
5. Deploy

---

### 5. Testing

#### Test Backend:
```bash
curl https://your-backend.railway.app
# Should return: {"message":"REVIEW.MNL API is running."}
```

#### Test Frontend:
1. Open browser console
2. Type: `console.log(API_BASE)`
3. Should show your Railway backend URL

#### Test Profile API:
```bash
# Login first to get a token
curl -X POST https://your-backend.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"yourpassword"}'

# Then test profile endpoint
curl -X GET https://your-backend.railway.app/api/users/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

## 🔧 Common Issues

### "Cannot find module 'passport'"
```bash
cd review.mnl-backend/review.mnl-backend
npm install
```

### "Column 'reset_token' doesn't exist"
```bash
mysql -u user -p database < config/migration.sql
```

### "CORS error" in browser
- Make sure `CLIENT_URL` in backend `.env` matches your Vercel URL
- Check Railway logs for CORS errors

### "API calls fail in production"
- Verify `window.BACKEND_URL` is set correctly
- Check browser console for the actual API_BASE value
- Verify Railway backend is running

---

## 📝 Environment Variables Reference

### Backend (.env):
| Variable | Required | Example |
|----------|----------|---------|
| DB_HOST | ✅ Yes | `db.example.com` |
| DB_USER | ✅ Yes | `admin` |
| DB_PASSWORD | ✅ Yes | `password123` |
| DB_NAME | ✅ Yes | `reviewmnl_db` |
| JWT_SECRET | ✅ Yes | `super_secret_key_123` |
| CLIENT_URL | ✅ Yes | `https://app.vercel.app` |
| BREVO_API_KEY | ✅ Yes | `xkeysib-...` |
| PORT | No | `5000` |
| CLOUDINARY_* | No | For image uploads |
| GOOGLE_* | No | For Google OAuth |
| FACEBOOK_* | No | For Facebook OAuth |

### Frontend (Vercel):
| Variable | Required | Example |
|----------|----------|---------|
| BACKEND_URL | ✅ Yes | `https://api.railway.app` |

---

## 🎉 You're Ready!

Once everything is configured:
1. ✅ Backend is running on Railway
2. ✅ Frontend is deployed on Vercel
3. ✅ Database has all required columns
4. ✅ Environment variables are set
5. ✅ API communication is working

Your REVIEW.MNL app should be fully functional! 🚀
