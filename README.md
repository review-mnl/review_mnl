# review.mnl

**review.mnl** is a web platform for discovering, comparing, and reviewing professional board exam review centers in Manila, Philippines. Students can search for review centers by course category, read and submit testimonials, and manage their profiles — while review center owners can register their business and admins can moderate the platform.

---

## 🚀 Quick Start

### Setup Instructions:
1. **Read the setup guide:** [SETUP_GUIDE.md](SETUP_GUIDE.md)
2. **Check deployment fixes:** [DEPLOYMENT_FIXES.md](DEPLOYMENT_FIXES.md)
3. **Install backend dependencies:**
   ```bash
   cd review.mnl-backend/review.mnl-backend
   npm install
   ```
4. **Configure environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your actual values
   ```
5. **Run database migration:**
   ```bash
   mysql -u user -p database < config/migration.sql
   ```
6. **Start backend:**
   ```bash
   npm start
   ```

---

## Project Structure

```
review.mnl/
├── review.mnl-frontend/
│   └── review.mnl-frontend/     # Frontend (HTML, CSS, JS)
│       ├── index.html
│       ├── api.js               # API client
│       └── ...
├── review.mnl-backend/
│   └── review.mnl-backend/      # Backend (Node.js, Express)
│       ├── server.js
│       ├── controllers/
│       ├── routes/
│       ├── config/
│       └── package.json
├── vercel.json                  # Vercel deployment config
├── SETUP_GUIDE.md               # Detailed setup instructions
└── DEPLOYMENT_FIXES.md          # Recent fixes applied
```

---

## Features

- **Browse by Category** — Find review centers for Civil Engineering, Mechanical Engineering, Electrical Engineering, Electronics Engineering, Chemical Engineering, Architecture, Law, Medicine, Nursing, Pharmacy, and more.
- **Search** — Search review centers by name or keyword.
- **User Accounts** — Students and review center owners can register, verify their email, and log in.
- **User Profiles** — View and edit profile information (NEW ✨)
- **Review Center Profiles** — View details, location, ratings, and testimonials for each center.
- **Testimonials & Ratings** — Verified students can leave 1–5 star reviews on review centers.
- **Review Center Registration** — Businesses can submit registration with business permits and DTI/SEC documents for admin approval.
- **Admin Dashboard** — Approve/reject review centers and testimonials.

---

## Tech Stack

| Layer    | Technology                              |
|----------|-----------------------------------------|
| Frontend | HTML, CSS, JavaScript                   |
| Backend  | Node.js, Express.js                     |
| Database | MySQL                                   |
| Auth     | JWT (jsonwebtoken), bcryptjs            |
| Email    | Brevo (Sendinblue) API                  |
| Uploads  | Multer + Cloudinary                     |
| Hosting  | Vercel (Frontend) + Railway (Backend)   |

---

## API Endpoints

### Auth
- `POST /api/auth/register/student` - Student registration
- `POST /api/auth/register/center` - Review center registration
- `POST /api/auth/login` - User login
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password
- `GET /api/auth/verify-email` - Verify email

### Users (NEW ✨)
- `GET /api/users/me` - Get current user profile
- `PUT /api/users/me` - Update user profile

### Centers
- `GET /api/centers` - Get all approved centers
- `GET /api/centers/search` - Search centers
- `GET /api/centers/:id` - Get center details
- `GET /api/centers/me` - Get my center profile (centers only)
- `POST /api/centers/:id/testimonials` - Submit testimonial

### Admin
- `GET /api/admin/centers/pending` - Get pending centers
- `PUT /api/admin/centers/:id/status` - Approve/reject center
- `GET /api/admin/testimonials/pending` - Get pending testimonials
- `PUT /api/admin/testimonials/:id/approve` - Approve testimonial

---

## Environment Variables

### Backend (.env)
```env
# Database
DB_HOST=your_db_host
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=reviewmnl_db

# JWT
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=7d

# Server
PORT=5000
CLIENT_URL=https://your-frontend.vercel.app

# Email (Brevo)
BREVO_API_KEY=your_api_key
SENDER_EMAIL=your_email@example.com

# Cloudinary (optional)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

### Frontend (Vercel Environment Variable)
```
BACKEND_URL=https://your-backend.railway.app
```

---

## Recent Updates (2024)

- ✅ Added user profile API endpoints (`GET /api/users/me`, `PUT /api/users/me`)
- ✅ Fixed Vercel deployment configuration
- ✅ Added missing database columns (`reset_token`, `phone`, `address`, `bio`, `profile_picture_url`)
- ✅ Added passport OAuth dependencies
- ✅ Fixed CORS configuration
- ✅ Made email configuration environment-based
- ✅ Created comprehensive setup documentation

---

## Deployment

### Backend (Railway)
1. Push to GitHub
2. Connect Railway to repository
3. Add environment variables
4. Deploy

### Frontend (Vercel)
1. Push to GitHub
2. Connect Vercel to repository
3. Set environment variable: `BACKEND_URL`
4. Deploy

See [SETUP_GUIDE.md](SETUP_GUIDE.md) for detailed instructions.

---

## License

MIT

---

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

---

## Support

For issues and questions, please open an issue on GitHub.
