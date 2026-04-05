const jwt = require('jsonwebtoken');
require('dotenv').config();

const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const queryToken = String((req.query && req.query.token) || '').trim();
  const headerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : '';
  const token = headerToken || queryToken;
  if (token) {
    try {
      req.user = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {}
  }
  next();
};

const protect = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const queryToken = String((req.query && req.query.token) || '').trim();
  const headerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : '';
  const token = headerToken || queryToken;
  if (!token) {
    return res.status(401).json({ message: 'No token. Access denied.' });
  }
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    // Distinguish between expired and invalid tokens
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Session expired. Please login again.' });
    }
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
};

const adminOnly = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Not authenticated.' });
  }
  if (req.user?.role !== 'admin' && req.user?.role !== 'superadmin') {
    return res.status(403).json({ message: 'Admin access required.' });
  }
  next();
};

const superAdminOnly = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Not authenticated.' });
  }
  if (req.user?.role !== 'superadmin') {
    return res.status(403).json({ message: 'Super admin access required.' });
  }
  next();
};

const centerOnly = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Not authenticated.' });
  }
  if (req.user?.role !== 'review_center') {
    return res.status(403).json({ message: 'Review center access required.' });
  }
  next();
};

const studentOnly = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Not authenticated.' });
  }
  if (req.user?.role !== 'student') {
    return res.status(403).json({ message: 'Student access required.' });
  }
  next();
};

module.exports = { protect, optionalAuth, adminOnly, superAdminOnly, centerOnly, studentOnly };
