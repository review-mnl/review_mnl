const db = require('../config/db');
const { logActivity } = require('../utils/activityLogger');

const getActivityLogs = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, action_type, description, actor_name, target_entity, created_at
       FROM activity_logs
       ORDER BY created_at DESC
       LIMIT 300`
    );
    return res.json({ logs: rows });
  } catch (err) {
    console.error('Get activity logs error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

const createActivityLog = async (req, res) => {
  try {
    const { action_type, description, actor_name, target_entity } = req.body || {};
    if (!action_type || !description) {
      return res.status(400).json({ message: 'action_type and description are required.' });
    }

    await logActivity({
      actionType: action_type,
      description,
      actorName: actor_name || (req.user && req.user.email) || 'Admin',
      targetEntity: target_entity || '',
    });

    return res.status(201).json({ message: 'Activity log created.' });
  } catch (err) {
    console.error('Create activity log error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

module.exports = { getActivityLogs, createActivityLog };
