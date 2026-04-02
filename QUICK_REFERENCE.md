# Review.MNL - Quick Reference Guide

## 🎯 Project at a Glance

**What:** Platform to find and review board exam review centers in Manila
**Tech:** Node.js/Express (backend) + HTML/CSS/JS (frontend) + MySQL (database)
**Status:** Live on Vercel (frontend) + Railway (backend)

---

## 📂 Directory Quick Links

```
review_mnl/
├── Backend: review.mnl-backend/review.mnl-backend/
│   ├── Entry: server.js
│   ├── API: routes/ (4 modules)
│   ├── Logic: controllers/ (5 modules)
│   ├── Auth: middleware/auth.js
│   ├── Config: config/ (db, mailer, passport, schema)
│   └── Setup: package.json, .env, railway.json
│
└── Frontend: review.mnl-frontend/review.mnl-frontend/
    ├── Pages: 17 HTML files
    ├── API: api.js (central client)
    ├── Logic: search.js
    ├── Style: style.css
    ├── Assets: images/ (6 backgrounds)
    └── Deployment: vercel.json
```

---

## 🔌 API Endpoints Quick Map

### Auth (`/api/auth`)
```
POST   /register/student         | Sign up as student
POST   /register/center          | Sign up as center (with docs)
POST   /login                    | Login → JWT token
POST   /forgot-password          | Start password reset
POST   /reset-password           | Complete password reset
GET    /verify-email             | Verify email address
POST   /resend-verification      | Resend verification email
GET    /google                   | Start Google OAuth
GET    /google/callback          | Google OAuth callback
```

### Users (`/api/users`)
```
GET    /me                       | Get current user (protected)
PUT    /me                       | Update profile (protected)
```

### Centers (`/api/centers`)
```
GET    /                         | List all approved centers
GET    /nearby                   | Get nearby centers
GET    /search                   | Search by name/keyword
GET    /me                       | Get my center (protected)
GET    /:id                      | Get center details
PUT    /me/location              | Update location (protected)
PUT    /me                       | Update center info (protected)
PUT    /me/logo                  | Upload logo (protected)
POST   /:id/testimonials         | Post review (protected)
```

### Admin (`/api/admin`)
```
GET    /centers                  | List all centers (admin)
GET    /testimonials             | List all testimonials (admin)
PUT    /centers/:id/approve      | Approve center (superadmin)
PUT    /centers/:id/reject       | Reject center (superadmin)
PUT    /testimonials/:id/approve | Approve testimonial (admin)
PUT    /testimonials/:id/reject  | Reject testimonial (admin)
DELETE /users/:id                | Delete user (superadmin)
```

---

## 🗄️ Database Schema

### Users
- `id` (PK) | `first_name` | `last_name` | `email` (UQ) | `password`
- `phone` | `address` | `bio` | `profile_picture_url`
- `role` (student|review_center|admin|superadmin) | `is_verified`
- `verify_token` | `reset_token` | `created_at`

### Review Centers
- `id` (PK) | `user_id` (FK→users) | `business_name` | `email` (UQ) | `password`
- `business_permit` | `dti_sec_reg` | `status` (pending|approved|rejected)
- `latitude` | `longitude` | `address` | `logo_url`
- `description` | `programs` (JSON) | `achievements` (JSON) | `created_at`

### Testimonials
- `id` (PK) | `student_id` (FK→users) | `center_id` (FK→review_centers)
- `content` | `rating` (1-5) | `is_approved` | `created_at`

---

## 🔐 Authentication & Authorization

### Authentication Methods
1. **JWT (JSON Web Token)** - Default auth
2. **Google OAuth 2.0** - Social login
3. **Email Verification** - Verify ownership
4. **Password Hashing** - bcryptjs with salt rounds 10

### Role-Based Access
```
student         → Browse, post testimonials, manage profile
review_center   → Register center, update profile, manage testimonials
admin           → Approve testimonials, approve centers
superadmin      → All admin power + delete users, manage admins
```

### Protected Routes
```
@protect       → Requires valid JWT token
@adminOnly     → admin or superadmin role
@superAdminOnly → superadmin role only
@centerOnly    → review_center role only
```

---

## 📋 Frontend Pages Overview

| Page | Role | Purpose |
|------|------|---------|
| `index.html` | Public | Browse all categories |
| `login.html` | Public | Login form |
| `signup.html` | Public | Register (student/center) |
| `loggedin.html` | Student | Home after login |
| `userdashboard.html` | Student | Manage profile & testimonials |
| `search.html` | Public | Search results |
| `viewcenter.html` | Public | Center details & reviews |
| `editcenter.html` | Center | Edit center profile |
| `managestudents.html` | Center | View testimonials |
| `admindashboard.html` | Admin | Moderate content |
| `superadmin.html` | Superadmin | Manage admins |
| `verifyemail.html` | Public | Email verification |
| `forgotpassword.html` | Public | Password reset request |
| `resetpassword.html` | Public | Complete password reset |
| `contact.html` | Public | Contact page |
| `terms.html` | Public | Terms & conditions |
| `privacy.html` | Public | Privacy policy |

---

## 🔄 Key Data Flows

### User Registration Flow
```
Signup Form
   ↓
validate email/password
   ↓
hash password (bcryptjs)
   ↓
insert into users table
   ↓
generate verify_token
   ↓
send verification email
   ↓
user clicks verify link
   ↓
mark is_verified = 1
   ↓
ready for login
```

### Center Registration Flow
```
Center Signup Form
   ↓
upload documents (business_permit, dti_sec_reg)
   ↓
upload to Cloudinary
   ↓
insert review_center row (status='pending')
   ↓
send notification to superadmin
   ↓
superadmin approves/rejects
   ↓
if approved: status='approved'
   ↓
center visible to students
```

### Login Flow
```
login form (email, password)
   ↓
query users by email
   ↓
compare password with bcrypt
   ↓
generate JWT token (expires 24h)
   ↓
return {token, user} to frontend
   ↓
frontend saveSession(data)
   ↓
store in localStorage
   ↓
use token for subsequent requests
```

### Testimonial Flow
```
student clicks "Write Review"
   ↓
rate center (1-5) + comment
   ↓
POST /api/centers/:id/testimonials
   ↓
backend verifies student is authenticated
   ↓
insert testimonials row (is_approved=0)
   ↓
admin notification sent
   ↓
admin approves/rejects in dashboard
   ↓
if approved: visible to all users
```

---

## 🔧 Configuration Files

### Backend
- **`.env`** - Database, JWT, email, OAuth credentials
- **`package.json`** - Dependencies & scripts
- **`railway.json`** - Railway.io deployment config
- **`Procfile`** - Process startup command
- **`server.js`** - Express app initialization

### Frontend
- **`vercel.json`** - Vercel deployment config
- **`style.css`** - All styling
- **`api.js`** - Global API client

### Database
- **`config/schema.sql`** - Table definitions
- **`config/migration.sql`** - Data migrations
- **`config/db.js`** - MySQL pool connection

---

## 📦 Dependencies Breakdown

### Backend Core
- `express` - Web framework
- `mysql2` - Database driver
- `jsonwebtoken` - JWT creation
- `bcryptjs` - Password hashing
- `passport` - OAuth handling
- `cors` - Cross-origin requests
- `dotenv` - Environment variables

### Backend Integration
- `cloudinary` - Image hosting
- `multer` - File uploads
- `multer-storage-cloudinary` - Upload destination
- `mailersend` / `brevo-api-client` / `nodemailer` - Email sending
- `express-validator` - Input validation

### Frontend
- Vanilla JavaScript (no frameworks)
- Google Fonts (Poppins)
- Material Symbols (icons)

---

## 🚀 Running the Project

### Backend
```bash
cd review.mnl-backend/review.mnl-backend
npm install
cp .env.example .env              # Edit with real credentials
npm start                         # http://localhost:5000
```

### Frontend
```bash
cd review.mnl-frontend/review.mnl-frontend
# Use VS Code Live Server or
python -m http.server 5500        # http://localhost:5500
```

### First Run
1. Start MySQL: ensure db is running
2. Run migrations: `npm run migrate`
3. Create admin user (auto-done in schema.sql)
4. Set up `.env` with real credentials
5. Start backend
6. Open frontend in browser
7. Test signup → verify email → login

---

## 🌐 Deployment URLs

| Service | Frontend | Backend |
|---------|----------|---------|
| **Production** | https://review-mnl.vercel.app | https://reviewmnl-production-67eb.up.railway.app |
| **Staging** | https://review-mnl-gamma.vercel.app | (same backend) |
| **Local Dev** | http://localhost:5500 | http://localhost:5000 |

---

## 🔗 Important Files to Know

### Must-Know Backend Files
1. `server.js` - Always here first
2. `routes/auth.js` - All login/signup
3. `config/schema.sql` - Database structure
4. `controllers/authController.js` - Auth logic
5. `config/db.js` - Database connection
6. `.env` - Secrets & configuration

### Must-Know Frontend Files
1. `api.js` - ALL API calls go here
2. `index.html` - Homepage entry point
3. `login.html` - Login page
4. `signup.html` - Signup page
5. `style.css` - All styling
6. `search.html` - Search page

---

## 🆘 Common Quick Fixes

| Problem | Solution |
|---------|----------|
| "Cannot connect to MySQL" | Check DB_HOST/PORT/USER/PASSWORD in .env |
| "CORS error" | Add frontend URL to allowedOrigins in server.js |
| "Email not sending" | Configure MAIL_HOST/PORT/USER/PASS in .env |
| "Token expired 401" | User needs to log in again (24h expiry) |
| "File upload fails" | Check Cloudinary API key in .env |
| "Google login error" | Add Google OAuth credentials to .env |
| "Frontend blank page" | Check api.js API_BASE URL matches backend |
| "Database tables missing" | Run migrations: `npm run migrate` |

---

**Last Updated:** April 2, 2026
**Status:** Production Ready
