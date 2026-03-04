# review.mnl

**review.mnl** is a web platform for discovering, comparing, and reviewing professional board exam review centers in Manila, Philippines. Students can search for review centers by course category, read and submit testimonials, and manage their profiles — while review center owners can register their business and admins can moderate the platform.

---

## Project Structure
- `frontend/` - Contains all user interface and client-side code.
- `backend/` - Contains server-side logic, APIs, and routes.
- `database/` - Contains database scripts, schemas, and authentication logic.

## Setup Instructions
1. Clone the repository:
   ```bash
   git clone https://github.com/Zvk1/review.mnl.git

---

## Features

- **Browse by Category** — Find review centers for Civil Engineering, Mechanical Engineering, Electrical Engineering, Electronics Engineering, Chemical Engineering, Architecture, Law, Medicine, Nursing, Pharmacy, and more.
- **Search** — Search review centers by name or keyword.
- **User Accounts** — Students and review center owners can register, verify their email, and log in.
- **Review Center Profiles** — View details, location, ratings, and testimonials for each center.
- **Testimonials & Ratings** — Verified students can leave 1–5 star reviews on review centers.
- **Review Center Registration** — Businesses can submit registration with business permits and DTI/SEC documents for admin approval.

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
