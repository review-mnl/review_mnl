-- MIGRATION SCRIPT: Add missing columns to existing tables
-- Run this if your tables already exist and need updating

-- Migration SQL runs against the configured database. Do not hardcode a database name here.
-- Add reset_token column if it doesn't exist
ALTER TABLE users ADD COLUMN reset_token VARCHAR(255);

-- Add phone column if it doesn't exist
ALTER TABLE users ADD COLUMN phone VARCHAR(50);

-- Add address column if it doesn't exist
ALTER TABLE users ADD COLUMN address TEXT;

-- Add bio column if it doesn't exist
ALTER TABLE users ADD COLUMN bio TEXT;

-- Add profile_picture_url column if it doesn't exist
ALTER TABLE users ADD COLUMN profile_picture_url VARCHAR(500);

-- Add logo_url column to review_centers if it doesn't exist
ALTER TABLE review_centers ADD COLUMN logo_url VARCHAR(500);

-- Add required document columns for review center signup if they don't exist
ALTER TABLE review_centers ADD COLUMN business_permit VARCHAR(500);
ALTER TABLE review_centers ADD COLUMN dti_sec_reg VARCHAR(500);

-- Ensure status column exists for approval workflow
ALTER TABLE review_centers ADD COLUMN status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending';

-- Add description column to review_centers if it doesn't exist
ALTER TABLE review_centers ADD COLUMN description TEXT;

-- Add programs column to review_centers if it doesn't exist
ALTER TABLE review_centers ADD COLUMN programs JSON;

-- Add achievements column to review_centers if it doesn't exist
ALTER TABLE review_centers ADD COLUMN achievements JSON;

-- Ensure users.role supports all required values
ALTER TABLE users MODIFY COLUMN role ENUM('student', 'review_center', 'admin', 'superadmin') DEFAULT 'student';

-- Add indexes if they don't exist
CREATE INDEX idx_reset_token ON users(reset_token);

-- Verify the changes
DESCRIBE users;
DESCRIBE review_centers;

-- Add last_login columns to track recent sign-ins
ALTER TABLE users ADD COLUMN last_login TIMESTAMP NULL;
ALTER TABLE review_centers ADD COLUMN last_login TIMESTAMP NULL;

-- Create user_sessions to record each successful login (safe to run repeatedly)
CREATE TABLE IF NOT EXISTS user_sessions (
	id INT AUTO_INCREMENT PRIMARY KEY,
	user_id INT NOT NULL,
	role ENUM('student','review_center','admin','superadmin') NOT NULL,
	ip VARCHAR(100),
	user_agent VARCHAR(500),
	logged_in_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create payments table to record enrollment payments (mock or provider-backed)
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

CREATE UNIQUE INDEX uniq_provider_provider_payment_id ON payments(provider, provider_payment_id);
CREATE INDEX idx_payments_center_status_created ON payments(center_id, status, created_at);

-- Enrollments table — links students to centers after successful payment/approval
CREATE TABLE IF NOT EXISTS enrollments (
	id INT AUTO_INCREMENT PRIMARY KEY,
	user_id INT NOT NULL,
	center_id INT NOT NULL,
	payment_id INT,
	status ENUM('pending','active','cancelled') DEFAULT 'pending',
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
	FOREIGN KEY (center_id) REFERENCES review_centers(id) ON DELETE CASCADE,
	FOREIGN KEY (payment_id) REFERENCES payments(id)
);

CREATE INDEX idx_enrollments_payment_id ON enrollments(payment_id);

-- Add center review workflow fields on enrollments
ALTER TABLE enrollments ADD COLUMN review_status ENUM('pending','approved','rejected') DEFAULT 'pending';
ALTER TABLE enrollments ADD COLUMN payment_verified TINYINT(1) DEFAULT 0;
ALTER TABLE enrollments ADD COLUMN reviewed_at TIMESTAMP NULL;
ALTER TABLE enrollments ADD COLUMN reviewed_by INT NULL;

CREATE INDEX idx_enrollments_center_review_created ON enrollments(center_id, review_status, created_at);

-- Notifications sent to students when center updates enrollment decision
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

-- General notifications (warnings, announcements)
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

ALTER TABLE enrollment_notifications ADD COLUMN is_read TINYINT(1) DEFAULT 0;
ALTER TABLE enrollment_notifications ADD COLUMN read_at TIMESTAMP NULL;

-- Two-way chat messages between student and review center
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

ALTER TABLE review_centers ADD COLUMN schedule JSON;
ALTER TABLE review_centers ADD COLUMN payment_methods JSON;
ALTER TABLE review_centers ADD COLUMN payment_details JSON;

ALTER TABLE chat_messages ADD COLUMN attachment_url TEXT NULL;
ALTER TABLE chat_messages ADD COLUMN attachment_name VARCHAR(255) NULL;
ALTER TABLE chat_messages ADD COLUMN attachment_mime_type VARCHAR(120) NULL;
ALTER TABLE chat_messages ADD COLUMN attachment_size INT NULL;

-- Student ratings per enrolled review center
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

-- Site-wide settings
CREATE TABLE IF NOT EXISTS site_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  site_name VARCHAR(120) DEFAULT 'Review.MNL',
  maintenance_mode TINYINT(1) DEFAULT 0,
  allow_center_registrations TINYINT(1) DEFAULT 1,
  allow_student_registrations TINYINT(1) DEFAULT 1,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Allow review edits with cooldown tracking
ALTER TABLE testimonials ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- User-generated reports
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
