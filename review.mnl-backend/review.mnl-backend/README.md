# Review.MNL Backend API

## 📁 Project Structure
```
backend/
├── config/
│   ├── db.js           # MySQL connection pool
│   ├── mailer.js       # Email sender (Nodemailer)
│   └── schema.sql      # Database tables — run this first!
├── controllers/
│   ├── authController.js        # Register & Login
│   ├── adminController.js       # Admin management
│   ├── centerController.js      # Locator & Center profiles
│   └── testimonialController.js # UC-04 Testimonials
├── middleware/
│   ├── auth.js         # JWT protection
│   └── upload.js       # Multer file uploads
├── routes/
│   ├── auth.js         # /api/auth/*
│   ├── admin.js        # /api/admin/*
│   └── centers.js      # /api/centers/*
├── uploads/            # Uploaded documents saved here
├── .env                # Environment variables
├── server.js           # Entry point
└── package.json
```

## ⚙️ Setup Steps

### 1. Install dependencies
```bash
npm install
```

### 2. Setup MySQL Database
- Open MySQL Workbench or phpMyAdmin
- Run the contents of `config/schema.sql`

### 3. Configure .env
Fill in your `.env` file:
```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=reviewhub_db
JWT_SECRET=make_this_long_and_random
EMAIL_USER=your_gmail@gmail.com
EMAIL_PASS=your_gmail_app_password
CLIENT_URL=http://localhost:3000
```

> For Gmail, use an **App Password** (not your normal password).
> Go to: Google Account → Security → 2-Step Verification → App Passwords

### 4. Run the server
```bash
# Development (auto-restart)
npm run dev

# Production
npm start
```

---

## 🔌 API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register/student` | UC-01: Register student |
| POST | `/api/auth/register/center`  | UC-01: Register review center (multipart/form-data) |
| GET  | `/api/auth/verify-email?token=` | Verify student email |
| POST | `/api/auth/login` | Login (all roles) |

### Centers (Public)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/centers` | All approved centers |
| GET | `/api/centers/nearby?lat=&lng=&radius=` | Nearby centers (km) |
| GET | `/api/centers/:id` | Center profile + testimonials |

### Admin (Requires admin token)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/centers/pending` | Pending applications |
| PUT | `/api/admin/centers/:id/status` | Approve/Reject center |
| GET | `/api/admin/students` | All students |
| GET | `/api/admin/testimonials/pending` | Pending testimonials |
| PUT | `/api/admin/testimonials/:id/approve` | Approve testimonial |
| DELETE | `/api/admin/testimonials/:id` | Delete testimonial |

---

## 🔐 Default Admin Account
- **Email:** admin@reviewhub.com
- **Password:** Admin@1234

> Change this immediately after first login!
