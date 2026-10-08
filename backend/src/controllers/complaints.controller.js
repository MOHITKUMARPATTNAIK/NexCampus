import pool from '../config/db.js';
import { logAudit } from '../utils/auditLogger.js';

// ─────────────────────────────────────────────────────────────────
//  STUDENT — Submit Complaint
// ─────────────────────────────────────────────────────────────────

/** POST /api/complaints — student submits a complaint */
export const submitComplaint = async (req, res) => {
  const { category_id, title, description, location, priority } = req.body;
  if (!title?.trim() || !description?.trim()) {
    return res.status(400).json({ error: 'Title and description are required' });
  }
  try {
    // Auto-generate complaint number
    const countRes = await pool.query('SELECT COUNT(*) FROM complaints');
    const complaintNumber = `CMP-${new Date().getFullYear()}-${String(Number(countRes.rows[0].count) + 1).padStart(5, '0')}`;

    const { rows } = await pool.query(
      `INSERT INTO complaints
         (complaint_number, submitted_by, category_id, title, description, location, priority, status)
       VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, 'medium'), 'open')
       RETURNING *`,
      [complaintNumber, req.user.id, category_id || null, title.trim(), description.trim(), location || null, priority]
    );
    await logAudit({ actorId: req.user.id, action: 'COMPLAINT_SUBMIT', targetType: 'complaint', targetId: rows[0].id, details: { complaintNumber, title } });
    res.status(201).json({ complaint: rows[0] });
  } catch (err) {
    console.error('[complaints] submitComplaint:', err.message);
    res.status(500).json({ error: 'Failed to submit complaint' });
  }
};

/** GET /api/complaints/my-complaints — student's own complaints */
export const getMyComplaints = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.*, cc.name AS category_name,
              u_cmo.full_name AS assigned_cmo_name,
              (SELECT cu.update_text FROM complaint_updates cu WHERE cu.complaint_id = c.id ORDER BY cu.created_at DESC LIMIT 1) AS latest_update
       FROM complaints c
       LEFT JOIN complaint_categories cc ON cc.id = c.category_id
       LEFT JOIN users u_cmo ON u_cmo.id = c.assigned_cmo_id
       WHERE c.submitted_by = $1
       ORDER BY c.created_at DESC`,
      [req.user.id]
    );
    res.json({ complaints: rows });
  } catch (err) {
    console.error('[complaints] getMyComplaints:', err.message);
    res.status(500).json({ error: 'Failed to load complaints' });
  }
};

// ─────────────────────────────────────────────────────────────────
//  CMO / ADMIN — Complaint Dashboard
// ─────────────────────────────────────────────────────────────────

/** GET /api/complaints — CMO/admin: all complaints with filters */
export const listAllComplaints = async (req, res) => {
  const { status, priority, category_id, assigned_cmo_id, page = 1, limit = 50 } = req.query;
  try {
    const conditions = [];
    const values = [];
    let idx = 1;
    if (status)          { conditions.push(`c.status = $${idx++}`); values.push(status); }
    if (priority)        { conditions.push(`c.priority = $${idx++}`); values.push(priority); }
    if (category_id)     { conditions.push(`c.category_id = $${idx++}`); values.push(category_id); }
    if (assigned_cmo_id) { conditions.push(`c.assigned_cmo_id = $${idx++}`); values.push(assigned_cmo_id); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (Number(page) - 1) * Number(limit);

    const { rows } = await pool.query(
      `SELECT c.*, cc.name AS category_name,
              u_sub.full_name AS submitted_by_name,
              u_cmo.full_name AS assigned_cmo_name,
              (SELECT cu.update_text FROM complaint_updates cu WHERE cu.complaint_id = c.id ORDER BY cu.created_at DESC LIMIT 1) AS latest_update
       FROM complaints c
       LEFT JOIN complaint_categories cc ON cc.id = c.category_id
       LEFT JOIN users u_sub ON u_sub.id = c.submitted_by
       LEFT JOIN users u_cmo ON u_cmo.id = c.assigned_cmo_id
       ${where}
       ORDER BY
         CASE c.priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
         c.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...values, Number(limit), offset]
    );

    const countRes = await pool.query(
      `SELECT COUNT(*) FROM complaints c ${where}`, values
    );

    res.json({ complaints: rows, total: Number(countRes.rows[0].count) });
  } catch (err) {
    console.error('[complaints] listAllComplaints:', err.message);
    res.status(500).json({ error: 'Failed to load complaints' });
  }
};

/** GET /api/complaints/:id — get single complaint with full history */
export const getComplaintDetail = async (req, res) => {
  const { id } = req.params;
  try {
    // Complaint record
    const compRes = await pool.query(
      `SELECT c.*, cc.name AS category_name,
              u_sub.full_name AS submitted_by_name, u_sub.email AS submitted_by_email,
              u_cmo.full_name AS assigned_cmo_name
       FROM complaints c
       LEFT JOIN complaint_categories cc ON cc.id = c.category_id
       LEFT JOIN users u_sub ON u_sub.id = c.submitted_by
       LEFT JOIN users u_cmo ON u_cmo.id = c.assigned_cmo_id
       WHERE c.id = $1`,
      [id]
    );
    if (!compRes.rows.length) return res.status(404).json({ error: 'Complaint not found' });

    const complaint = compRes.rows[0];
    // Access control: student can only see own complaints
    if (req.user.roles?.includes('student') && complaint.submitted_by !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Updates / timeline
    const updatesRes = await pool.query(
      `SELECT cu.*, u.full_name AS author_name
       FROM complaint_updates cu
       JOIN users u ON u.id = cu.author_id
       WHERE cu.complaint_id = $1
       ORDER BY cu.created_at ASC`,
      [id]
    );

    // Assignments
    const assignRes = await pool.query(
      `SELECT ca.*, u.full_name AS assigned_to_name, u2.full_name AS assigned_by_name
       FROM complaint_assignments ca
       JOIN users u ON u.id = ca.assigned_to
       JOIN users u2 ON u2.id = ca.assigned_by
       WHERE ca.complaint_id = $1
       ORDER BY ca.created_at DESC`,
      [id]
    );

    res.json({ complaint, updates: updatesRes.rows, assignments: assignRes.rows });
  } catch (err) {
    console.error('[complaints] getComplaintDetail:', err.message);
    res.status(500).json({ error: 'Failed to load complaint details' });
  }
};

// ─────────────────────────────────────────────────────────────────
//  CMO — Triage & Assignment
// ─────────────────────────────────────────────────────────────────

/** PATCH /api/complaints/:id/assign — CMO assigns complaint to staff/department */
export const assignComplaint = async (req, res) => {
  const { id } = req.params;
  const { assigned_to, notes, expected_resolution_date } = req.body;
  if (!assigned_to) return res.status(400).json({ error: 'assigned_to (user ID) is required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Mark previous active assignments inactive
    await client.query(
      `UPDATE complaint_assignments SET is_active = false WHERE complaint_id = $1`,
      [id]
    );
    // Create new assignment
    const { rows: assignRows } = await client.query(
      `INSERT INTO complaint_assignments (complaint_id, assigned_to, assigned_by, notes, expected_resolution_date)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [id, assigned_to, req.user.id, notes || null, expected_resolution_date || null]
    );
    // Update complaint status to 'in_progress' and record CMO
    await client.query(
      `UPDATE complaints SET status = 'in_progress', assigned_cmo_id = $1, updated_at = NOW()
       WHERE id = $2`,
      [req.user.id, id]
    );
    // Add update entry
    await client.query(
      `INSERT INTO complaint_updates (complaint_id, author_id, update_text, update_type)
       VALUES ($1, $2, $3, 'assignment')`,
      [id, req.user.id, notes ? `Assigned to staff. Notes: ${notes}` : 'Complaint assigned to resolution staff.']
    );

    await logAudit({ actorId: req.user.id, action: 'COMPLAINT_ASSIGN', targetType: 'complaint', targetId: id, details: { assigned_to } });
    await client.query('COMMIT');
    res.json({ assignment: assignRows[0], message: 'Complaint assigned successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[complaints] assignComplaint:', err.message);
    res.status(500).json({ error: 'Failed to assign complaint' });
  } finally {
    client.release();
  }
};

/** PATCH /api/complaints/:id/status — CMO/admin updates complaint status */
export const updateComplaintStatus = async (req, res) => {
  const { id } = req.params;
  const { status, update_text, resolution_notes } = req.body;

  const VALID_STATUSES = ['open', 'in_progress', 'resolved', 'closed', 'escalated', 'rejected'];
  if (!status || !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const updateFields = ['status = $1', 'updated_at = NOW()'];
    const values = [status];
    let idx = 2;

    if (status === 'resolved') {
      updateFields.push(`resolved_at = NOW()`);
      if (resolution_notes) { updateFields.push(`resolution_notes = $${idx++}`); values.push(resolution_notes); }
    }
    values.push(id);

    await client.query(
      `UPDATE complaints SET ${updateFields.join(', ')} WHERE id = $${idx}`,
      values
    );

    // Add timeline update
    if (update_text?.trim()) {
      await client.query(
        `INSERT INTO complaint_updates (complaint_id, author_id, update_text, update_type)
         VALUES ($1, $2, $3, $4)`,
        [id, req.user.id, update_text.trim(), status === 'resolved' ? 'resolution' : 'status_change']
      );
    }

    await logAudit({ actorId: req.user.id, action: 'COMPLAINT_STATUS_UPDATE', targetType: 'complaint', targetId: id, details: { status } });
    await client.query('COMMIT');
    res.json({ message: `Complaint status updated to: ${status}` });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[complaints] updateComplaintStatus:', err.message);
    res.status(500).json({ error: 'Failed to update complaint status' });
  } finally {
    client.release();
  }
};

/** POST /api/complaints/:id/update — add timeline update/note */
export const addComplaintUpdate = async (req, res) => {
  const { id } = req.params;
  const { update_text, update_type, is_internal } = req.body;
  if (!update_text?.trim()) return res.status(400).json({ error: 'update_text is required' });

  try {
    const { rows } = await pool.query(
      `INSERT INTO complaint_updates (complaint_id, author_id, update_text, update_type, is_internal)
       VALUES ($1, $2, $3, COALESCE($4, 'note'), COALESCE($5, false))
       RETURNING *`,
      [id, req.user.id, update_text.trim(), update_type, is_internal]
    );
    res.status(201).json({ update: rows[0] });
  } catch (err) {
    console.error('[complaints] addComplaintUpdate:', err.message);
    res.status(500).json({ error: 'Failed to add update' });
  }
};

/** POST /api/complaints/:id/escalate — CMO escalates to super admin */
export const escalateComplaint = async (req, res) => {
  const { id } = req.params;
  const { reason, escalated_to } = req.body;
  if (!reason?.trim()) return res.status(400).json({ error: 'Escalation reason is required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO complaint_escalations (complaint_id, escalated_by, escalated_to, reason)
       VALUES ($1, $2, $3, $4)`,
      [id, req.user.id, escalated_to || null, reason.trim()]
    );
    await client.query(
      `UPDATE complaints SET status = 'escalated', updated_at = NOW() WHERE id = $1`,
      [id]
    );
    await client.query(
      `INSERT INTO complaint_updates (complaint_id, author_id, update_text, update_type, is_internal)
       VALUES ($1, $2, $3, 'escalation', true)`,
      [id, req.user.id, `Escalated: ${reason.trim()}`]
    );
    await logAudit({ actorId: req.user.id, action: 'COMPLAINT_ESCALATE', targetType: 'complaint', targetId: id, details: { reason } });
    await client.query('COMMIT');
    res.json({ message: 'Complaint escalated successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[complaints] escalateComplaint:', err.message);
    res.status(500).json({ error: 'Failed to escalate complaint' });
  } finally {
    client.release();
  }
};

/** POST /api/complaints/:id/reopen — reopen a resolved complaint */
export const reopenComplaint = async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  if (!reason?.trim()) return res.status(400).json({ error: 'Reason for reopening is required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const compRes = await client.query('SELECT status FROM complaints WHERE id = $1', [id]);
    if (!compRes.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Complaint not found' }); }
    if (!['resolved', 'closed'].includes(compRes.rows[0].status)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Only resolved or closed complaints can be reopened' });
    }

    await client.query(
      `UPDATE complaints SET status = 'in_progress', resolved_at = NULL, resolution_notes = NULL, updated_at = NOW() WHERE id = $1`,
      [id]
    );
    await client.query(
      `INSERT INTO complaint_updates (complaint_id, author_id, update_text, update_type)
       VALUES ($1, $2, $3, 'reopen')`,
      [id, req.user.id, `Complaint reopened. Reason: ${reason.trim()}`]
    );

    await logAudit({ actorId: req.user.id, action: 'COMPLAINT_REOPEN', targetType: 'complaint', targetId: id, details: { reason } });
    await client.query('COMMIT');
    res.json({ message: 'Complaint reopened' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[complaints] reopenComplaint:', err.message);
    res.status(500).json({ error: 'Failed to reopen complaint' });
  } finally {
    client.release();
  }
};

/** GET /api/complaints/categories — list complaint categories */
export const listComplaintCategories = async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM complaint_categories ORDER BY name');
    res.json({ categories: rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load complaint categories' });
  }
};

/** GET /api/complaints/stats — CMO dashboard stats */
export const getComplaintStats = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'open')        AS open_count,
         COUNT(*) FILTER (WHERE status = 'in_progress') AS in_progress_count,
         COUNT(*) FILTER (WHERE status = 'resolved')    AS resolved_count,
         COUNT(*) FILTER (WHERE status = 'escalated')   AS escalated_count,
         COUNT(*) FILTER (WHERE priority = 'critical')  AS critical_count,
         COUNT(*) FILTER (WHERE priority = 'high')      AS high_count,
         COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') AS last_24h,
         COUNT(*)                                        AS total
       FROM complaints`
    );
    res.json({ stats: rows[0] });
  } catch (err) {
    console.error('[complaints] getComplaintStats:', err.message);
    res.status(500).json({ error: 'Failed to load stats' });
  }
};
