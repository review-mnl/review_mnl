# Review.MNL - Complete Project Analysis

## Project Overview
**review.mnl** is a web platform for discovering, comparing, and reviewing professional board exam review centers in Manila, Philippines. It features user authentication, review center discovery, testimonials, and admin moderation.

---

## 📁 Complete File Structure

```
Review center/
├── netlify.toml
├── README.md
├── test_profile.js
├── vercel.json
│
├── review_mnl/                                          # Main project folder
│   ├── README.md
│   ├── vercel.json
│   ├── .git/
│   ├── .gitignore
│   ├── .vscode/
│   │
│   ├── review.mnl-backend/                              # Duplicate structure
│   │   └── review.mnl-backend/
│   │       ├── config/
│   │       │   ├── db.js                           # MySQL connection
│   │       │   ├── mailer.js                       # Email service (Brevo/Sendinblue)
│   │       │   ├── migrate.js                      # Migration runner
│   │       │   ├── passport.js                     # Google OAuth config
│   │       │   ├── schema.sql                      # Database schema
│   │       │   └── migration.sql                   # Initial migration
│   │       │
│   │       ├── controllers/                        # Business logic
│   │       │   ├── authController.js               # Auth operations
│   │       │   ├── adminController.js              # Admin operations
│   │       │   ├── centerController.js             # Review center operations
│   │       │   ├── testimonialController.js        # Testimonial operations
│   │       │   └── userController.js               # User profile operations
│   │       │
│   │       ├── middleware/                         # Express middleware
│   │       │   ├── auth.js                         # JWT auth + role checks
│   │       │   └── upload.js                       # Multer file upload
│   │       │
│   │       ├── routes/                             # API endpoints
│   │       │   ├── auth.js                         # Auth routes
│   │       │   ├── admin.js                        # Admin routes
│   │       │   ├── centers.js                      # Review centers routes
│   │       │   └── users.js                        # User profile routes
│   │       │
│   │       ├── node_modules/                       # Dependencies
│   │       ├── .env                                # Environment variables
│   │       ├── package.json                        # Dependencies + scripts
│   │       ├── package-lock.json
│   │       ├── server.js                           # Express app entry point
│   │       ├── railway.json                        # Railway deployment config
│   │       ├── Procfile                            # Heroku/Railway process config
│   │       └── README.md
│   │
│   ├── review.mnl-frontend/                             # Duplicate structure
│   │   └── review.mnl-frontend/
│   │       ├── index.html                          # Homepage
│   │       ├── login.html                          # Login page
│   │       ├── signup.html                         # Signup page
│   │       ├── loggedin.html                       # Logged-in home
│   │       ├── userdashboard.html                  # Student dashboard
│   │       ├── admindashboard.html                 # Admin dashboard
│   │       ├── superadmin.html                     # Super admin dashboard
│   │       ├── search.html                         # Search results page
│   │       ├── viewcenter.html                     # Review center detail page
│   │       ├── editcenter.html                     # Edit center profile
│   │       ├── managestudents.html                 # Manage student testimonials
│   │       ├── contact.html                        # Contact page
│   │       ├── verifyemail.html                    # Email verification page
│   │       ├── resetpassword.html                  # Password reset page
│   │       ├── forgotpassword.html                 # Forgot password page
│   │       ├── terms.html                          # Terms & conditions
│   │       ├── privacy.html                        # Privacy policy
│   │       ├── style.css                           # Main stylesheet
│   │       ├── api.js                              # API client helper
│   │       ├── search.js                           # Search page logic
│   │       └── images/                             # Image assets
│   │           ├── adminbg.png
│   │           ├── bg.png
│   │           ├── bgsearch.png
│   │           ├── resultsbg.png
│   │           ├── userdashboard.png
│   │           └── viewcenterbg.png
│   │
│   └── (Also in root: review.mnl-backend/ and review.mnl-frontend/)
│
└── (Also: review.mnl-backend/ and review.mnl-frontend/ in root)
```

---

## 🔧 Backend Architecture

### Technology Stack
- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** MySQL 8.0
- **Authentication:** JWT (jsonwebtoken) + bcryptjs
- **File Upload:** Multer + Cloudinary
- **Email Service:** Brevo (Sendinblue) + Nodemailer
- **OAuth:** Passport.js (Google OAuth 2.0)
- **Validation:** express-validator

### Dependencies (`package.json`)
```json
{
  "dependencies": {
    "bcryptjs": "^2.4.3",                  // Password hashing
    "cloudinary": "^1.41.3",               // Image hosting
    "cors": "^2.8.5",                      // CORS handling
    "dotenv": "^16.3.1",                   // Environment variables
    "express": "^4.18.2",                  // Web framework
    "express-validator": "^7.0.1",         // Request validation
    "jsonwebtoken": "^9.0.2",              // JWT generation/verification
    "mailersend": "^2.6.0",                // Email sending (primary)
    "multer": "^1.4.5-lts.1",              // File upload middleware
    "multer-storage-cloudinary": "^4.0.0", // Cloudinary storage for multer
    "mysql2": "^3.6.0",                    // MySQL driver
    "nodemailer": "^6.9.5",                // Fallback email
    "passport": "^0.7.0",                  // Authentication
    "passport-google-oauth20": "^2.0.0",   // Google OAuth strategy
    "pg": "^8.20.0",                       // PostgreSQL driver
    "sib-api-v3-sdk": "^8.5.0"             // Brevo SDK
  },
  "devDependencies": {
    "nodemon": "^3.0.1"                    // Auto-restart on file changes
  }
}
```

### Environment Variables (`.env`)
```bash
# Server
PORT=5000
CLIENT_URL=http://localhost:5000

# Database (MySQL)
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=root123
DB_NAME=reviewmnl_db

# JWT
JWT_SECRET=your_super_secret_jwt_key_here_change_in_production
JWT_EXPIRES_IN=24h

# Email (optional for development)
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USER=
MAIL_PASS=
MAIL_FROM=no-reply@review.mnl

# Google OAuth (optional - social signup will show error but regular signup works)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback

# Session
SESSION_SECRET=your_session_secret_key_change_in_production
```

### Database Schema

#### Users Table
```sql
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  address TEXT,
  bio TEXT,
  profile_picture_url VARCHAR(500),
  role ENUM('student', 'review_center', 'admin', 'superadmin') DEFAULT 'student',
  is_verified TINYINT(1) DEFAULT 0,
  verify_token VARCHAR(255),
  reset_token VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_verify_token (verify_token),
  INDEX idx_reset_token (reset_token)
);
```

#### Review Centers Table
```sql
CREATE TABLE review_centers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  business_name VARCHAR(200) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  business_permit VARCHAR(255),
  dti_sec_reg VARCHAR(255),
  status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  address VARCHAR(500),
  logo_url VARCHAR(500),
  description TEXT,
  programs JSON,
  achievements JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

#### Testimonials Table
```sql
CREATE TABLE testimonials (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  center_id INT NOT NULL,
  content TEXT NOT NULL,
  rating TINYINT CHECK (rating BETWEEN 1 AND 5),
  is_approved TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (center_id) REFERENCES review_centers(id) ON DELETE CASCADE
);
```

### API Endpoints

#### Authentication (`/api/auth`)
```
POST   /api/auth/register/student          # Student signup
POST   /api/auth/register/center           # Review center signup (files: business_permit, dti_sec_reg)
POST   /api/auth/login                     # User login
POST   /api/auth/forgot-password           # Request password reset
POST   /api/auth/reset-password            # Reset password with token
GET    /api/auth/verify-email              # Email verification endpoint
POST   /api/auth/resend-verification       # Resend verification email
GET    /api/auth/google                    # Google OAuth redirect
GET    /api/auth/google/callback           # Google OAuth callback
```

#### Users (`/api/users`)
```
GET    /api/users/me                       # Get current user profile (protected)
PUT    /api/users/me                       # Update user profile (protected)
```

#### Review Centers (`/api/centers`)
```
GET    /api/centers                        # Get all approved centers
GET    /api/centers/nearby                 # Get nearby centers (geolocation)
GET    /api/centers/search                 # Search centers by name/keyword
GET    /api/centers/me                     # Get center's own profile (protected, centerOnly)
GET    /api/centers/:id                    # Get center details by ID
PUT    /api/centers/me/location            # Update center location (protected, centerOnly)
PUT    /api/centers/me                     # Update center profile (protected, centerOnly)
PUT    /api/centers/me/logo                # Update center logo (protected, centerOnly, multipart)
POST   /api/centers/:id/testimonials       # Post testimonial for center (protected)
```

#### Admin (`/api/admin`)
```
GET    /api/admin/centers                  # List all centers (pending/approved/rejected)
GET    /api/admin/testimonials             # List all testimonials
PUT    /api/admin/centers/:id/approve      # Approve center (superAdminOnly)
PUT    /api/admin/centers/:id/reject       # Reject center (superAdminOnly)
PUT    /api/admin/testimonials/:id/approve # Approve testimonial (adminOnly)
PUT    /api/admin/testimonials/:id/reject  # Reject testimonial (adminOnly)
DELETE /api/admin/users/:id                # Delete user (superAdminOnly)
```

### Controllers

1. **authController.js**
   - `registerStudent()` - Validate, hash password, store user, send verification email
   - `registerCenter()` - Validate, upload documents, store center, send verification email
   - `verifyEmail()` - Verify email using token
   - `login()` - Validate credentials, generate JWT
   - `forgotPassword()` - Generate reset token, send reset email
   - `resetPassword()` - Reset password with token
   - `resendVerification()` - Resend verification email

2. **userController.js**
   - `getUserProfile()` - Get authenticated user profile
   - `updateUserProfile()` - Update user profile info

3. **centerController.js**
   - `getApprovedCenters()` - Get all approved centers with pagination
   - `getCenterById()` - Get single center details
   - `getCentersNearby()` - Filter centers by geolocation
   - `searchCenters()` - Search by name/keyword
   - `getMyCenterProfile()` - Get center owner's profile
   - `updateCenterLocation()` - Update latitude/longitude
   - `updateCenterProfile()` - Update center details
   - `updateCenterLogo()` - Upload new logo to Cloudinary

4. **testimonialController.js**
   - `postTestimonial()` - Create new testimonial (student only)

5. **adminController.js**
   - `getAllCenters()` - List all centers by status
   - `getAllTestimonials()` - List all testimonials
   - `approveCenterRegistration()` - Approve pending center
   - `rejectCenterRegistration()` - Reject pending center
   - `approveTestimonial()` - Approve pending testimonial
   - `rejectTestimonial()` - Reject pending testimonial
   - `deleteUser()` - Delete user account

### Middleware

1. **auth.js**
   - `protect()` - JWT verification middleware
   - `adminOnly()` - Admin/superadmin role check
   - `superAdminOnly()` - Superadmin-only access
   - `centerOnly()` - Review center role check

2. **upload.js**
   - Multer configuration for Cloudinary storage
   - File size/type validation
   - Single/multi-file upload handlers

### Configuration Files

1. **db.js** - MySQL connection pool
2. **mailer.js** - Email sending via Brevo/Nodemailer
3. **migrate.js** - Run database migrations on startup
4. **passport.js** - Google OAuth strategy configuration

### Server Entry Point (`server.js`)
- Express app setup with CORS
- Passport initialization
- Route registration
- Error handling middleware
- Auto-run migrations
- Starts on `PORT` (default: 5000)

---

## 🎨 Frontend Architecture

### Technology Stack
- **HTML5** - Semantic markup
- **CSS3** - Responsive design
- **Vanilla JavaScript** - Client-side logic
- **Font:** Poppins (Google Fonts)
- **Icons:** Material Symbols Outlined

### HTML Pages (17 total)

| Page | Purpose |
|------|---------|
| `index.html` | Homepage with browse/search |
| `login.html` | User login page |
| `signup.html` | New user signup (student/center choice) |
| `loggedin.html` | Logged-in homepage |
| `userdashboard.html` | Student dashboard & profile |
| `admindashboard.html` | Admin dashboard (approve centers/testimonials) |
| `superadmin.html` | Super admin dashboard (manage admins) |
| `search.html` | Search results page |
| `viewcenter.html` | Single review center detail page |
| `editcenter.html` | Edit center profile (center owner) |
| `managestudents.html` | Manage testimonials (center owner) |
| `contact.html` | Contact page |
| `verifyemail.html` | Email verification page |
| `resetpassword.html` | Password reset page |
| `forgotpassword.html` | Forgot password request page |
| `terms.html` | Terms & conditions |
| `privacy.html` | Privacy policy |

### Stylesheet (`style.css`)
- Responsive design (mobile-first)
- Color scheme & typography
- Component styles (forms, buttons, cards, modals)
- Navigation & layout

### JavaScript Files

1. **api.js** (Main API Client)
   - **Purpose:** Single source of truth for all API calls
   - **Features:**
     - Dynamic backend URL detection (production vs localhost)
     - Session management (localStorage/sessionStorage)
     - JWT token handling
     - User authentication helpers
     - Redirect loops detection
   - **Base URL:** `https://reviewmnl-production-67eb.up.railway.app` (production) or `http://localhost:5000` (dev)
   - **Key Functions:**
     - `authHeaders()` - Add JWT token to requests
     - `saveSession(data)` - Store token + user data
     - `getActiveToken()` - Retrieve current JWT token
     - `setOriginalUser()` - Track signup source per user

2. **search.js** (Search Page Logic)
   - Handle search form submissions
   - Filter centers by category/keyword
   - Display search results
   - Pagination

### Image Assets (`images/`)
- `adminbg.png` - Admin dashboard background
- `bg.png` - General background
- `bgsearch.png` - Search page background
- `resultsbg.png` - Results page background
- `userdashboard.png` - Dashboard background
- `viewcenterbg.png` - Center detail background

### Frontend Features

**Public Pages:**
- Browse review centers by category
- Search centers
- View center details & reviews
- View terms & privacy

**Authenticated User Pages:**
- User profile management
- Submit testimonials & ratings
- View application status

**Authenticated Center Owner Pages:**
- Edit center profile
- View testimonials
- Upload logo & documents
- Manage programs/achievements

**Authenticated Admin Pages:**
- Approve/reject center registrations
- Approve/reject testimonials
- View user activity
- Ban users

---

## 🔗 Frontend-Backend Integration

### API Client Pattern (`api.js`)
```javascript
const API_BASE = window.BACKEND_URL || 
  (localhost ? 'http://localhost:5000' : 'https://reviewmnl-production-67eb.up.railway.app');

// All requests use authHeaders() for JWT token injection
function authHeaders() {
  const token = getActiveToken();
  return token ? {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  } : { 'Content-Type': 'application/json' };
}

// Sessions persist across tabs with unique session IDs
function saveSession(data) {
  const sid = 's_' + Math.random().toString(36).slice(2,10);
  localStorage.setItem('rmnl_session_' + sid, JSON.stringify({
    token: data.token,
    user: data.user,
    created: Date.now()
  }));
  sessionStorage.setItem('rmnl_active_session', sid);
}
```

### Request Flow
1. Frontend collects user input (form)
2. Validates input client-side
3. Calls API function from `api.js`
4. Adds JWT token via `authHeaders()`
5. Sends to backend API endpoint
6. Backend validates JWT, processes request
7. Returns JSON response
8. Frontend updates UI or redirects

---

## 🚀 Deployment Configuration

### Backend Deployment (`railway.json`, `Procfile`)
- **Railway.io** - Node.js server hosting
- Start command: `node server.js`
- Environment variables configured in Railway dashboard

### Frontend Deployment (`vercel.json`)
- **Vercel** - Static hosting for HTML/CSS/JS
- Production URL: `https://review-mnl.vercel.app`
- Staging URL: `https://review-mnl-gamma.vercel.app`
- CORS allowlist updated in backend for both URLs

---

## 📊 Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND (HTML/CSS/JS)                │
│  [api.js] ←→ [search.js] ←→ [Other page JS]                 │
└────────────┬────────────────────────────────────────────────┘
             │ HTTP/JSON
             ↓
┌─────────────────────────────────────────────────────────────┐
│              BACKEND (Express.js + Node.js)                  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ [Routes] → [Controllers] → [Models/DB Logic]           │  │
│  │                                                         │  │
│  │ /auth → authController → db.query() → MySQL            │  │
│  │ /centers → centerController → getApprovedCenters()     │  │
│  │ /admin → adminController → moderateContent()           │  │
│  └────────────────────────────────────────────────────────┘  │
└──────┬───────────────────────────────────────────────────────┘
       │ JDBC
       ↓
┌─────────────────────────────────────────────────────────────┐
│                    MySQL DATABASE                            │
│ [users] ← [review_centers] ← [testimonials]                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔐 Authentication Flow

```
1. User signs up/logs in
   ↓
2. Frontend sends credentials to /api/auth/register or /api/auth/login
   ↓
3. Backend validates, hashes password (bcryptjs), stores user
   ↓
4. Backend generates JWT token (expires in 24h)
   ↓
5. Frontend receives { token, user }
   ↓
6. Frontend calls saveSession() → stores in localStorage
   ↓
7. For subsequent requests: authHeaders() adds "Bearer {token}"
   ↓
8. Backend middleware (protect) verifies JWT
   ↓
9. If valid: request proceeds; if invalid: 401 Unauthorized
```

---

## 🎯 Key Features Mapping

| Feature | Frontend | Backend |
|---------|----------|---------|
| User Registration | signup.html | /api/auth/register/{student\|center} |
| Email Verification | verifyemail.html | /api/auth/verify-email |
| Login | login.html | /api/auth/login |
| Profile Management | userdashboard.html, editcenter.html | /api/users/me, /api/centers/me |
| Browse Centers | index.html, loggedin.html | /api/centers |
| Search Centers | search.html | /api/centers/search |
| View Center Details | viewcenter.html | /api/centers/:id |
| Post Testimonial | viewcenter.html | /api/centers/:id/testimonials |
| Admin Dashboard | admindashboard.html | /api/admin/* |
| File Upload | editcenter.html | Multer + Cloudinary |
| Email Notification | - | Brevo API |
| Google OAuth | login.html | /api/auth/google* |

---

## 📝 Development Workflow

### Setup
```bash
# Backend
cd review.mnl-backend/review.mnl-backend
npm install
cp .env.example .env
mysql -u root -p < config/migration.sql  # Create database
npm start

# Frontend
cd review.mnl-frontend/review.mnl-frontend
# Serve on localhost:5500 using VS Code Live Server or Python
python -m http.server 5500
```

### Scripts
- **Backend:** `npm start` (production), `npm run dev` (development with nodemon)
- **Frontend:** Open HTML files or use live server

### Environment Setup
- Node.js 14+
- MySQL 8.0+
- Cloudinary account (for image uploads)
- Brevo account (for email sending)
- Google OAuth credentials (optional, for social login)

---

## 🐛 Common Issues & Notes

1. **CORS Errors:** Check `server.js` allowedOrigins - add frontend URL
2. **JWT Expired:** Token expires in 24h; user must log in again
3. **Email Not Sending:** Check Brevo/Nodemailer config in `.env`
4. **File Upload Fails:** Verify Cloudinary credentials & API key
5. **Database Not Found:** Run migrations: `npm run migrate`
6. **Google OAuth Not Working:** Add OAuth credentials to `.env`

---

## 📦 Project Statistics

- **Backend Files:** 13 core files (routes, controllers, middleware, config)
- **Frontend Files:** 17 HTML pages + 2 JS files + 1 CSS file
- **Database:** 3 main tables (users, review_centers, testimonials)
- **API Endpoints:** 30+ total endpoints across 4 route modules
- **Dependencies:** 16 production + 1 dev dependency

---

**Generated:** April 2, 2026
**Project Type:** Full-stack Node.js + MySQL web application
**Status:** Deployed (Vercel frontend + Railway backend)
