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
  schedule        JSON,
  review_schedule JSON,
  payment_methods JSON,
  payment_details JSON,
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
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (center_id)  REFERENCES review_centers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reports (
  id INT AUTO_INCREMENT PRIMARY KEY,
  reporter_id INT NOT NULL,
  reported_user_id INT NULL,
  center_id INT NULL,
  testimonial_id INT NULL,
  message_id INT NULL,
  report_type ENUM('center','message','testimonial','rating') NOT NULL,
  reason VARCHAR(255) NOT NULL,
  details TEXT NULL,
  status ENUM('open','resolved','dismissed') DEFAULT 'open',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_reports_status_created (status, created_at),
  INDEX idx_reports_center (center_id),
  INDEX idx_reports_reporter (reporter_id),
  FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (reported_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (center_id) REFERENCES review_centers(id) ON DELETE SET NULL,
  FOREIGN KEY (testimonial_id) REFERENCES testimonials(id) ON DELETE SET NULL,
  FOREIGN KEY (message_id) REFERENCES chat_messages(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS report_attachments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  report_id INT NOT NULL,
  file_url TEXT NOT NULL,
  file_name VARCHAR(255) NULL,
  mime_type VARCHAR(120) NULL,
  file_size INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_report_attachments_report (report_id),
  FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE
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
  UNIQUE KEY uniq_provider_provider_payment_id (provider, provider_payment_id),
  INDEX idx_payments_center_status_created (center_id, status, created_at),
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
  INDEX idx_enrollments_center_review_created (center_id, review_status, created_at),
  INDEX idx_enrollments_payment_id (payment_id),
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

CREATE TABLE IF NOT EXISTS user_notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  kind VARCHAR(30) DEFAULT 'info',
  message VARCHAR(500) NOT NULL,
  is_read TINYINT(1) DEFAULT 0,
  read_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_notifications_user_created (user_id, created_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  center_id INT NOT NULL,
  enrollment_id INT NULL,
  sender_id INT NOT NULL,
  receiver_id INT NOT NULL,
  message TEXT NOT NULL,
  attachment_url TEXT NULL,
  attachment_name VARCHAR(255) NULL,
  attachment_mime_type VARCHAR(120) NULL,
  attachment_size INT NULL,
  is_read TINYINT(1) DEFAULT 0,
  read_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (center_id) REFERENCES review_centers(id) ON DELETE CASCADE,
  FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE SET NULL,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_chat_participants (sender_id, receiver_id, created_at),
  INDEX idx_chat_context (student_id, center_id, created_at)
);

CREATE TABLE IF NOT EXISTS center_ratings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  center_id INT NOT NULL,
  rating TINYINT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (center_id) REFERENCES review_centers(id) ON DELETE CASCADE,
  UNIQUE KEY uniq_student_center_rating (student_id, center_id),
  CHECK (rating BETWEEN 1 AND 5)
);

CREATE TABLE IF NOT EXISTS site_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  site_name VARCHAR(120) DEFAULT 'Review.MNL',
  maintenance_mode TINYINT(1) DEFAULT 0,
  allow_center_registrations TINYINT(1) DEFAULT 1,
  allow_student_registrations TINYINT(1) DEFAULT 1,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT IGNORE INTO users (first_name, last_name, email, password, role, is_verified)
VALUES ('Super', 'Admin', 'admin@reviewmnl.com',
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lHHC', 'superadmin', 1);

