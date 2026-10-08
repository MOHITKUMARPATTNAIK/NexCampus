import { query } from '../config/db.js';

/**
 * Persists an immutable audit log entry to PostgreSQL
 * @param {Object} params
 * @param {string} params.userId - User initiating the action
 * @param {string} params.action - e.g. "USER_LOGIN", "CMO_APPOINTED", "GATE_CHECKOUT"
 * @param {string} params.module - e.g. "auth", "admin", "gatepass", "complaint"
 * @param {string} [params.targetRecordId] - ID of target entity
 * @param {Object} [params.details] - JSON serializable object of changes or context
 * @param {string} [params.ipAddress] - Request IP
 */
export const logAudit = async ({
  userId = null,
  actorId = null,
  action,
  module = null,
  targetType = null,
  targetId = null,
  targetRecordId = null,
  details = {},
  ipAddress = null
}) => {
  try {
    const effectiveUserId = userId || actorId || null;
    const effectiveModule = module || targetType || 'general';
    const effectiveRecordId = (targetRecordId || targetId) ? String(targetRecordId || targetId) : null;
    await query(
      `INSERT INTO audit_logs (user_id, action, module, target_record_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [effectiveUserId, action, effectiveModule, effectiveRecordId, JSON.stringify(details), ipAddress]
    );
  } catch (err) {
    // Non-blocking for primary transaction, but logged to stderr
    console.error('[Audit Log Failure]:', err.message);
  }
};

export default logAudit;
