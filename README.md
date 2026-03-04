# review.mnl

**review.mnl** is a web platform for discovering, comparing, and reviewing professional board exam review centers in Manila, Philippines. Students can search for review centers by course category, read and submit testimonials, and manage their profiles — while review center owners can register their business and admins can moderate the platform.

---

## Features

- **Browse by Category** — Find review centers for Civil Engineering, Mechanical Engineering, Electrical Engineering, Electronics Engineering, Chemical Engineering, Architecture, Law, Medicine, Nursing, Pharmacy, and more.
- **Search** — Search review centers by name or keyword.
- **User Accounts** — Students and review center owners can register, verify their email, and log in.
- **Review Center Profiles** — View details, location, ratings, and testimonials for each center.
- **Testimonials & Ratings** — Verified students can leave 1–5 star reviews on review centers.
- **Review Center Registration** — Businesses can submit registration with business permits and DTI/SEC documents for admin approval.
- **Admin Dashboard** — Admins can approve or reject review center applications and moderate testimonials.
- **Forgot Password** — Email-based password reset flow.

---

## Tech Stack

| Layer    | Technology                              |
|----------|-----------------------------------------|
| Frontend | HTML, CSS, JavaScript                   |
| Backend  | Node.js, Express.js                     |
| Database | MySQL                                   |
| Auth     | JWT (jsonwebtoken), bcryptjs            |
| Email    | Nodemailer                              |
| Uploads  | Multer                                  |

---

## Project Structure

```
review_mnl/
│
├── review.mnl-frontend/       # Frontend (HTML/CSS/JS)
│   ├── index.html             # Landing page
│   ├── search.html            # Search results
│   ├── login.html             # Login page
│   ├── signup.html            # Registration page
│   ├── forgotpassword.html    # Password reset
│   ├── userdashboard.html     # Student dashboard
│   ├── admindashboard.html    # Admin dashboard
│   ├── viewcenter.html        # Review center profile
│   ├── editcenter.html        # Edit center details
│   ├── contact.html           # Contact page
│   ├── privacy.html           # Privacy policy
│   ├── terms.html             # Terms of service
│   ├── style.css              # Global styles
│   ├── search.js              # Search logic
│   └── images/                # Static image assets
│
└── review.mnl-backend/        # Backend (Node.js/Express REST API)
    ├── server.js              # Entry point
    ├── package.json
    ├── config/
    │   ├── db.js              # MySQL connection
    │   ├── mailer.js          # Nodemailer setup
    │   └── schema.sql         # Database schema
    ├── controllers/
    │   ├── authController.js
    │   ├── adminController.js
    │   ├── centerController.js
    │   └── testimonialController.js
    ├── middleware/
    │   ├── auth.js            # JWT authentication middleware
    │   └── upload.js          # Multer file upload middleware
    └── routes/
        ├── auth.js            # /api/auth
        ├── admin.js           # /api/admin
        └── centers.js         # /api/centers
```

---

## Getting Started

### Prerequisites

- Node.js (v18+)
- MySQL

### Backend Setup

```bash
cd review.mnl-backend
npm install
```

Create a `.env` file in the backend directory:

```env
PORT=5000
CLIENT_URL=http://localhost:3000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=reviewmnl_db
JWT_SECRET=your_jwt_secret
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_email_password
```

Import the database schema:

```bash
mysql -u root -p < config/schema.sql
```

Start the server:

```bash
npm run dev
```

The API will be available at `http://localhost:5000`.

### Frontend Setup

Open `review.mnl-frontend/index.html` directly in a browser, or serve it with a static file server such as Live Server in VS Code.

---

## API Endpoints

| Method | Endpoint              | Description                        |
|--------|-----------------------|------------------------------------|
| POST   | /api/auth/register    | Register a new user                |
| POST   | /api/auth/login       | Login and receive JWT              |
| GET    | /api/auth/verify      | Verify email address               |
| POST   | /api/auth/forgot      | Request password reset email       |
| GET    | /api/centers          | Get all approved review centers    |
| GET    | /api/centers/:id      | Get a single review center         |
| POST   | /api/admin/approve    | Approve a review center (admin)    |
| POST   | /api/admin/reject     | Reject a review center (admin)     |

---

## Database Schema

- **users** — Stores student and admin accounts with email verification.
- **review_centers** — Stores review center registrations with approval status, location, and documents.
- **testimonials** — Student reviews with 1–5 star ratings, subject to admin approval.

---

## License

This project is for academic and development purposes.
