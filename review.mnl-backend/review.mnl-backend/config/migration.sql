-- MIGRATION SCRIPT: Add missing columns to existing users table
-- Run this if your users table already exists and needs updating

USE reviewmnl_db;

-- Add reset_token column if it doesn't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255);

-- Add phone column if it doesn't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(50);

-- Add address column if it doesn't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT;

-- Add bio column if it doesn't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;

-- Add profile_picture_url column if it doesn't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_picture_url VARCHAR(500);

-- Add logo_url column to review_centers if it doesn't exist
ALTER TABLE review_centers ADD COLUMN IF NOT EXISTS logo_url VARCHAR(500);

-- Add indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_reset_token ON users(reset_token);

-- Verify the changes
DESCRIBE users;
