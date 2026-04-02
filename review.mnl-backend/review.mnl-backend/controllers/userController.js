const db = require('../config/db');
const bcrypt = require('bcryptjs');

const getMyProfile = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, first_name, last_name, email, phone, address, bio, profile_picture_url, role, created_at 
       FROM users WHERE id = ?`,
      [req.user.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }
    res.json({ user: rows[0] });
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
};

const updateMyProfile = async (req, res) => {
  try {
    const { first_name, last_name, phone, address, bio, profile_picture_url, current_password, new_password, email } = req.body;
    // If changing email, ensure uniqueness
    if (email !== undefined) {
      const [existing] = await db.query('SELECT id FROM users WHERE email = ? AND id != ?', [email, req.user.id]);
      if (existing.length > 0) return res.status(409).json({ message: 'Email already in use.' });
    }
    
    // If changing password, verify current password first
    if (new_password) {
      if (!current_password) {
        return res.status(400).json({ message: 'Current password is required to set a new password.' });
      }
      const [userRows] = await db.query('SELECT password FROM users WHERE id = ?', [req.user.id]);
      if (userRows.length === 0) {
        return res.status(404).json({ message: 'User not found.' });
      }
      const isMatch = await bcrypt.compare(current_password, userRows[0].password);
      if (!isMatch) {
        return res.status(401).json({ message: 'Current password is incorrect.' });
      }
      const hashed = await bcrypt.hash(new_password, 10);
      await db.query('UPDATE users SET password = ? WHERE id = ?', [hashed, req.user.id]);
    }

    // Update profile fields
    const updates = [];
    const values = [];
    
    if (first_name !== undefined) {
      updates.push('first_name = ?');
      values.push(first_name);
    }
    if (last_name !== undefined) {
      updates.push('last_name = ?');
      values.push(last_name);
    }
    if (phone !== undefined) {
      updates.push('phone = ?');
      values.push(phone);
    }
    if (address !== undefined) {
      updates.push('address = ?');
      values.push(address);
    }
    if (bio !== undefined) {
      updates.push('bio = ?');
      values.push(bio);
    }
    if (profile_picture_url !== undefined) {
      updates.push('profile_picture_url = ?');
      values.push(profile_picture_url);
    }
    if (email !== undefined) {
      updates.push('email = ?');
      values.push(email);
    }

    if (updates.length > 0) {
      values.push(req.user.id);
      await db.query(
        `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
        values
      );
    }

    // Get updated profile
    const [rows] = await db.query(
      `SELECT id, first_name, last_name, email, phone, address, bio, profile_picture_url, role, created_at 
       FROM users WHERE id = ?`,
      [req.user.id]
    );

    res.json({ 
      message: 'Profile updated successfully.',
      user: rows[0] 
    });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
};

const updateMyProfilePhoto = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded.' });
    const url = req.file.path || req.file.url || req.file.secure_url || null;
    if (!url) return res.status(500).json({ message: 'Upload failed.' });
    await db.query('UPDATE users SET profile_picture_url = ? WHERE id = ?', [url, req.user.id]);
    const [rows] = await db.query(
      `SELECT id, first_name, last_name, email, phone, address, bio, profile_picture_url, role, created_at 
       FROM users WHERE id = ?`,
      [req.user.id]
    );
    res.json({ message: 'Profile photo updated.', user: rows[0] });
  } catch (err) {
    console.error('Update profile photo error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
};

module.exports = { getMyProfile, updateMyProfile, updateMyProfilePhoto };
