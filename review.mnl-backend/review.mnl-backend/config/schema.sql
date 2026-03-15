CREATE DATABASE IF NOT EXISTS reviewmnl_db;
USE reviewmnl_db;

CREATE TABLE IF NOT EXISTS users (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  first_name  VARCHAR(100) NOT NULL,
  last_name   VARCHAR(100) NOT NULL,
  email       VARCHAR(150) NOT NULL UNIQUE,
  password    VARCHAR(255) NOT NULL,
  role        ENUM('student', 'review_center', 'admin', 'superadmin') DEFAULT 'student',
  is_verified TINYINT(1) DEFAULT 0,
  verify_token VARCHAR(255),
  reset_token  VARCHAR(255),
  reset_token_expires DATETIME,
  otp_code     VARCHAR(6) DEFAULT NULL,
  otp_expires_at DATETIME DEFAULT NULL,
  otp_session  VARCHAR(64) DEFAULT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS review_centers (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  user_id         INT NOT NULL,
  business_name   VARCHAR(200) NOT NULL,
  email           VARCHAR(150) NOT NULL UNIQUE,
  password        VARCHAR(255) NOT NULL,
  owner_first     VARCHAR(100) NOT NULL,
  owner_last      VARCHAR(100) NOT NULL,
  business_permit VARCHAR(255),
  dti_sec_reg     VARCHAR(255),
  status          ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  latitude        DECIMAL(10, 8),
  longitude       DECIMAL(11, 8),
  address         VARCHAR(500),
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
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

INSERT IGNORE INTO users (first_name, last_name, email, password, role, is_verified)
VALUES ('Super', 'Admin', 'admin@reviewmnl.com',
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lHHC', 'superadmin', 1);
