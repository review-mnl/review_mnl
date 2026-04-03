-- MIGRATION SCRIPT: Add missing columns to existing tables
-- Run this if your tables already exist and need updating

USE reviewmnl_db;

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
