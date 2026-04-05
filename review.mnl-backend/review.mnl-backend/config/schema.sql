-- Schema will be applied to the currently configured database.
-- Do not create or switch databases here. Let the configured connection determine the target.

CREATE TABLE IF NOT EXISTS users (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  first_name  VARCHAR(100) NOT NULL,
  last_name   VARCHAR(100) NOT NULL,
  email       VARCHAR(150) NOT NULL UNIQUE,
  password    VARCHAR(255) NOT NULL,
  phone       VARCHAR(50),
  address     TEXT,
  bio         TEXT,
  profile_picture_url VARCHAR(500),
  role        ENUM('student', 'review_center', 'admin', 'superadmin') DEFAULT 'student',
  is_verified TINYINT(1) DEFAULT 0,
  verify_token VARCHAR(255),
  reset_token VARCHAR(255),
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login  TIMESTAMP NULL,
  INDEX idx_email (email),
  INDEX idx_verify_token (verify_token),
  INDEX idx_reset_token (reset_token)
);

CREATE TABLE IF NOT EXISTS review_centers (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  user_id         INT NOT NULL,
  business_name   VARCHAR(200) NOT NULL,
  email           VARCHAR(150) NOT NULL UNIQUE,
  password        VARCHAR(255) NOT NULL,
  business_permit VARCHAR(500),
  dti_sec_reg     VARCHAR(500),
  status          ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  latitude        DECIMAL(10, 8),
  longitude       DECIMAL(11, 8),
  address         VARCHAR(500),
  logo_url        VARCHAR(500),
  description     TEXT,
  programs        JSON,
  achievements    JSON,
  last_login      TIMESTAMP NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  role ENUM('student','review_center','admin','superadmin') NOT NULL,
  ip VARCHAR(100),
  user_agent VARCHAR(500),
  logged_in_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS testimonials (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  student_id  INT NOT NULL,
  center_id   INT NOT NULL,
  content     TEXT NOT NULL,
  rating      TINYINT CHECK (rating BETWEEN 1 AND 5),
  is_approved TINYINT(1) DEFAULT 0,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (center_id)  REFERENCES review_centers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  center_id INT NOT NULL,
  provider VARCHAR(100) NOT NULL,
  provider_payment_id VARCHAR(255),
  amount INT NOT NULL,
  currency VARCHAR(10) DEFAULT 'PHP',
  status ENUM('pending','paid','failed','cancelled') DEFAULT 'pending',
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (center_id) REFERENCES review_centers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS enrollments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  center_id INT NOT NULL,
  payment_id INT,
  status ENUM('pending','active','cancelled') DEFAULT 'pending',
  review_status ENUM('pending','approved','rejected') DEFAULT 'pending',
  payment_verified TINYINT(1) DEFAULT 0,
  reviewed_at TIMESTAMP NULL,
  reviewed_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (center_id) REFERENCES review_centers(id) ON DELETE CASCADE,
  FOREIGN KEY (payment_id) REFERENCES payments(id),
  FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS enrollment_notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  enrollment_id INT NOT NULL,
  user_id INT NOT NULL,
  center_id INT NOT NULL,
  status ENUM('pending','approved','rejected') NOT NULL,
  message VARCHAR(500) NOT NULL,
  is_read TINYINT(1) DEFAULT 0,
  read_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (center_id) REFERENCES review_centers(id) ON DELETE CASCADE,
  INDEX idx_enrollment_created_at (enrollment_id, created_at)
);

INSERT IGNORE INTO users (first_name, last_name, email, password, role, is_verified)
VALUES ('Super', 'Admin', 'admin@reviewmnl.com',
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lHHC', 'superadmin', 1);
