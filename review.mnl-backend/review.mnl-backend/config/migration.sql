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
