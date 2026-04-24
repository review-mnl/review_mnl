const db = require('../config/db');

/**
 * Centralized activity logger for system events.
 * This helper should never break the caller flow.
 */
async function logActivity({ actionType, description, actorName, targetEntity }) {
  try {
    const action = String(actionType || '').trim();
    const desc = String(description || '').trim();
    const actor = String(actorName || 'System').trim();
    const target = String(targetEntity || '').trim() || null;

    if (!action || !desc) return;

    await db.query(
      `INSERT INTO activity_logs (action_type, description, actor_name, target_entity)
       VALUES (?, ?, ?, ?)`,
      [action, desc, actor, target]
    );
  } catch (err) {
    console.warn('Activity logging failed:', err && err.message);
  }
}

module.exports = { logActivity };
