const express = require('express');
const router = express.Router();
const db = require('../config/db');

router.get('/db', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT DATABASE() AS db, @@hostname AS host, @@port AS port');
    const info = rows && rows[0] ? rows[0] : {};
    res.json({
      database: info.db || null,
      host: info.host || null,
      port: info.port || null,
    });
  } catch (err) {
    console.error('Debug DB error:', err && err.message);
    res.status(500).json({ message: 'Debug error' });
  }
});

module.exports = router;
