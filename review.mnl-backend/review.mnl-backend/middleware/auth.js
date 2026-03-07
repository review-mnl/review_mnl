const jwt = require('jsonwebtoken');
require('dotenv').config();

const protect = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token. Access denied.' });
  }
  try {
    const token = authHeader.split(' ')[1];
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user?.role !== 'admin' && req.user?.role !== 'superadmin') {
    return res.status(403).json({ message: 'Admin access required.' });
  }
  next();
};

const superAdminOnly = (req, res, next) => {
  if (req.user?.role !== 'superadmin') {
    return res.status(403).json({ message: 'Super admin access required.' });
  }
  next();
};

const centerOnly = (req, res, next) => {
  if (req.user?.role !== 'review_center') {
    return res.status(403).json({ message: 'Review center access required.' });
  }
  next();
};

module.exports = { protect, adminOnly, superAdminOnly, centerOnly };
