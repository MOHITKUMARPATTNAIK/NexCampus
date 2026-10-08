import pool from '../config/db.js';
import { logAudit } from '../utils/auditLogger.js';

// ─────────────────────────────────────────────────────────────────
//  NOTICES — Admin/Faculty publish, all users read
// ─────────────────────────────────────────────────────────────────

/** POST /api/notices — publish a notice */
export const publishNotice = async (req, res) => {
  const { title, content, notice_type, target_audience, department_id, priority, expires_at, is_pinned } = req.body;
  if (!title?.trim() || !content?.trim()) {
    return res.status(400).json({ error: 'Title and content are required' });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO notices
         (title, content, notice_type, target_audience, department_id, priority,
          expires_at, is_pinned, published_by, status)
       VALUES ($1,$2,$3,COALESCE($4,'all'),$5,COALESCE($6,'normal'),$7,COALESCE($8,false),$9,'published')
       RETURNING *`,
      [title.trim(), content.trim(), notice_type || 'general', target_audience, department_id || null,
       priority, expires_at || null, is_pinned, req.user.id]
    );
    // Create notifications for all active users (async — best effort)
    pool.query(
      `INSERT INTO notifications (user_id, title, message, notification_type, reference_id, reference_type)
       SELECT u.id, $1, $2, 'notice', $3, 'notice'
       FROM users u WHERE u.is_active = true AND u.id != $4`,
      [`Notice: ${title.trim()}`, content.trim().slice(0, 200), rows[0].id, req.user.id]
    ).catch(err => console.warn('[notices] Notification fan-out failed:', err.message));

    await logAudit({ actorId: req.user.id, action: 'NOTICE_PUBLISH', targetType: 'notice', targetId: rows[0].id, details: { title } });
    res.status(201).json({ notice: rows[0] });
  } catch (err) {
    console.error('[notices] publishNotice:', err.message);
    res.status(500).json({ error: 'Failed to publish notice' });
  }
};

/** GET /api/notices — all published notices visible to current user */
export const listNotices = async (req, res) => {
  const { type, pinned, page = 1, limit = 30 } = req.query;
  try {
    const conditions = [`(n.expires_at IS NULL OR n.expires_at > NOW())`, `n.status = 'published'`];
    const values = [];
    let idx = 1;
    if (type)   { conditions.push(`n.notice_type = $${idx++}`); values.push(type); }
    if (pinned === 'true') { conditions.push(`n.is_pinned = true`); }

    const offset = (Number(page) - 1) * Number(limit);
    const { rows } = await pool.query(
      `SELECT n.*, u.full_name AS published_by_name, d.name AS department_name
       FROM notices n
       JOIN users u ON u.id = n.published_by
       LEFT JOIN departments d ON d.id = n.department_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY n.is_pinned DESC, n.priority DESC, n.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...values, Number(limit), offset]
    );
    res.json({ notices: rows });
  } catch (err) {
    console.error('[notices] listNotices:', err.message);
    res.status(500).json({ error: 'Failed to load notices' });
  }
};

/** GET /api/notices/admin — all notices for admin management */
export const listAllNoticesAdmin = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT n.*, u.full_name AS published_by_name
       FROM notices n JOIN users u ON u.id = n.published_by
       ORDER BY n.created_at DESC LIMIT 100`
    );
    res.json({ notices: rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load notices' });
  }
};

/** GET /api/notices/:id — single notice */
export const getNotice = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT n.*, u.full_name AS published_by_name FROM notices n JOIN users u ON u.id = n.published_by WHERE n.id = $1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Notice not found' });
    res.json({ notice: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load notice' });
  }
};

/** PATCH /api/notices/:id — update notice */
export const updateNotice = async (req, res) => {
  const { title, content, status, is_pinned, expires_at } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE notices SET
         title      = COALESCE($1, title),
         content    = COALESCE($2, content),
         status     = COALESCE($3, status),
         is_pinned  = COALESCE($4, is_pinned),
         expires_at = COALESCE($5, expires_at),
         updated_at = NOW()
       WHERE id = $6 RETURNING *`,
      [title || null, content || null, status || null, is_pinned ?? null, expires_at || null, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Notice not found' });
    res.json({ notice: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update notice' });
  }
};

/** DELETE /api/notices/:id — archive notice */
export const archiveNotice = async (req, res) => {
  try {
    await pool.query(`UPDATE notices SET status = 'archived', updated_at = NOW() WHERE id = $1`, [req.params.id]);
    res.json({ message: 'Notice archived' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to archive notice' });
  }
};

// ─────────────────────────────────────────────────────────────────
//  NOTIFICATIONS — Personal bell icon feed
// ─────────────────────────────────────────────────────────────────

/** GET /api/notifications/my — current user's unread+recent notifications */
export const getMyNotifications = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC LIMIT 50`,
      [req.user.id]
    );
    const unread = rows.filter(n => !n.is_read).length;
    res.json({ notifications: rows, unread_count: unread });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load notifications' });
  }
};

/** PATCH /api/notifications/mark-read — mark notifications as read */
export const markNotificationsRead = async (req, res) => {
  const { ids } = req.body; // array of IDs, or empty to mark all
  try {
    if (ids && Array.isArray(ids) && ids.length > 0) {
      await pool.query(
        `UPDATE notifications SET is_read = true, read_at = NOW()
         WHERE id = ANY($1::uuid[]) AND user_id = $2`,
        [ids, req.user.id]
      );
    } else {
      await pool.query(
        `UPDATE notifications SET is_read = true, read_at = NOW() WHERE user_id = $1`,
        [req.user.id]
      );
    }
    res.json({ message: 'Marked as read' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark notifications as read' });
  }
};

/** POST /api/notifications/send — admin sends targeted notification */
export const sendNotification = async (req, res) => {
  const { user_ids, title, message, notification_type } = req.body;
  if (!title?.trim() || !message?.trim() || !Array.isArray(user_ids) || !user_ids.length) {
    return res.status(400).json({ error: 'user_ids (array), title, and message are required' });
  }
  try {
    const values = user_ids.map((uid, i) => `($${i * 5 + 1},$${i * 5 + 2},$${i * 5 + 3},$${i * 5 + 4},$${i * 5 + 5})`).join(',');
    const params = user_ids.flatMap(uid => [uid, title.trim(), message.trim(), notification_type || 'general', req.user.id]);
    await pool.query(
      `INSERT INTO notifications (user_id, title, message, notification_type, sent_by)
       VALUES ${values}`,
      params
    );
    res.json({ message: `Notification sent to ${user_ids.length} user(s)` });
  } catch (err) {
    console.error('[notifications] sendNotification:', err.message);
    res.status(500).json({ error: 'Failed to send notification' });
  }
};

// ─────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────
//  DOCUMENTS — Upload metadata, download links
// ─────────────────────────────────────────────────────────────────

import fs from 'fs';
import path from 'path';

/** POST /api/documents — register a document */
export const createDocument = async (req, res) => {
  const { title, description, document_type, file_url, file_name, file_size, is_public, target_audience, department_id, file_base64 } = req.body;
  if (!title?.trim() && !file_name?.trim()) {
    return res.status(400).json({ error: 'Title is required' });
  }

  let finalFileUrl = file_url?.trim() || null;
  let finalFileName = file_name?.trim() || null;
  let finalFileType = 'application/pdf';
  let finalFileSize = file_size || 0;

  // Handle local base64 upload if provided
  if (file_base64 && file_base64.includes(';base64,')) {
    try {
      const matches = file_base64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        finalFileType = matches[1];
        const buffer = Buffer.from(matches[2], 'base64');
        finalFileSize = buffer.length;
        const ext = finalFileType.includes('pdf') ? 'pdf' : finalFileType.includes('png') ? 'png' : finalFileType.includes('jpeg') ? 'jpg' : 'doc';
        const safeName = `doc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}.${ext}`;
        const filePath = path.join(process.cwd(), 'uploads', 'documents', safeName);
        fs.writeFileSync(filePath, buffer);
        finalFileUrl = `/uploads/documents/${safeName}`;
        finalFileName = file_name || safeName;
      }
    } catch (uploadErr) {
      console.warn('[documents] Local file write failed:', uploadErr.message);
    }
  }

  if (!finalFileUrl) {
    finalFileUrl = '#';
  }

  const categoryVal = document_type || 'general';

  try {
    const { rows } = await pool.query(
      `INSERT INTO documents
         (title, description, document_type, category, file_url, file_name, file_type, file_size,
          is_public, target_audience, department_id, uploaded_by, owner_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,COALESCE($9,true),$10,$11,$12,$13)
       RETURNING *`,
      [title?.trim() || finalFileName, description || null, categoryVal, categoryVal,
       finalFileUrl, finalFileName, finalFileType, finalFileSize, is_public ?? true,
       target_audience || 'all', department_id || null, req.user.id, req.user.id]
    );
    await logAudit({ actorId: req.user.id, action: 'DOCUMENT_UPLOAD', targetType: 'document', targetId: rows[0].id, details: { title: rows[0].title, file_name: finalFileName } });
    res.status(201).json({ document: rows[0] });
  } catch (err) {
    console.error('[documents] createDocument error:', err.message);
    res.status(500).json({ error: 'Failed to create document record' });
  }
};

/** GET /api/documents — list accessible documents */
export const listDocuments = async (req, res) => {
  const { type, my_only } = req.query;
  try {
    const conditions = ['(d.is_active IS NULL OR d.is_active = true)'];
    const values = [];
    let idx = 1;

    if (my_only === 'true') {
      conditions.push(`COALESCE(d.uploaded_by, d.owner_id) = $${idx++}`);
      values.push(req.user.id);
    }

    if (type && type !== 'all') {
      conditions.push(`LOWER(COALESCE(d.document_type, d.category, 'general')) = LOWER($${idx++})`);
      values.push(type.toLowerCase());
    }

    const { rows } = await pool.query(
      `SELECT d.id, d.title, d.file_url,
              COALESCE(d.file_type, 'application/pdf') AS file_type,
              COALESCE(d.file_size, 0) AS file_size,
              COALESCE(d.document_type, d.category, 'general') AS document_type,
              COALESCE(d.document_type, d.category, 'general') AS category,
              COALESCE(d.description, '') AS description,
              COALESCE(d.file_name, d.title) AS file_name,
              COALESCE(d.is_public, true) AS is_public,
              COALESCE(d.uploaded_by, d.owner_id) AS uploaded_by,
              d.created_at,
              COALESCE(u.full_name, 'Administration') AS uploaded_by_name,
              dep.name AS department_name
       FROM documents d
       LEFT JOIN users u ON u.id = COALESCE(d.uploaded_by, d.owner_id)
       LEFT JOIN departments dep ON dep.id = d.department_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY d.created_at DESC LIMIT 100`,
      values
    );
    res.json({ documents: rows });
  } catch (err) {
    console.error('[documents] listDocuments error:', err.message);
    res.status(500).json({ error: 'Failed to load documents' });
  }
};

/** DELETE /api/documents/:id — soft delete document */
export const deleteDocument = async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT uploaded_by, owner_id FROM documents WHERE id = $1`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Document not found' });
    const owner = rows[0].uploaded_by || rows[0].owner_id;
    if (owner !== req.user.id && !req.user.isSuperAdmin) {
      return res.status(403).json({ error: 'Not authorized to delete this document' });
    }
    await pool.query(`UPDATE documents SET is_active = false WHERE id = $1`, [req.params.id]);
    res.json({ message: 'Document deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete document' });
  }
};

// ─────────────────────────────────────────────────────────────────
//  STUDENT PORTFOLIO
// ─────────────────────────────────────────────────────────────────

/** GET /api/portfolio/my — student's portfolio */
export const getMyPortfolio = async (req, res) => {
  try {
    // Attendance summary
    const attendanceRes = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE ar.status = 'present') AS present,
         COUNT(*) FILTER (WHERE ar.status = 'absent')  AS absent,
         COUNT(*) FILTER (WHERE ar.status = 'late')    AS late,
         COUNT(*)                                        AS total
       FROM attendance_records ar
       JOIN attendance_sessions asess ON asess.id = ar.session_id
       WHERE ar.student_id = $1`,
      [req.user.id]
    );

    // Leave summary
    const leaveRes = await pool.query(
      `SELECT status, COUNT(*) as count FROM leave_requests WHERE student_id = $1 GROUP BY status`,
      [req.user.id]
    );

    // Gate pass summary
    const gatepassRes = await pool.query(
      `SELECT status, COUNT(*) as count FROM gate_passes WHERE student_id = $1 GROUP BY status`,
      [req.user.id]
    );

    // Complaints summary
    const complaintRes = await pool.query(
      `SELECT status, COUNT(*) as count FROM complaints WHERE student_id = $1 GROUP BY status`,
      [req.user.id]
    );

    // Fee summary including direct payments & legacy invoices
    const feeRes = await pool.query(
      `SELECT
         (
           SELECT COUNT(*) FROM payments WHERE student_id = $1 AND (UPPER(status) IN ('SUCCESS', 'CAPTURED', 'PAID'))
         ) AS direct_payments_count,
         COALESCE((
           SELECT SUM(amount) FROM payments WHERE student_id = $1 AND (UPPER(status) IN ('SUCCESS', 'CAPTURED', 'PAID'))
         ), 0) AS direct_amount_paid,
         COUNT(*) FILTER (WHERE status = 'paid') AS fees_paid,
         COUNT(*) FILTER (WHERE status IN ('unpaid', 'pending', 'partial', 'partially_paid')) AS fees_pending,
         COALESCE((
           SELECT SUM(amount) FROM payments WHERE student_id = $1 AND (UPPER(status) IN ('SUCCESS', 'CAPTURED', 'PAID'))
         ), 0) + COALESCE(SUM(COALESCE(amount_paid, paid_amount, 0)), 0) AS total_paid
       FROM fee_invoices WHERE student_id = $1`,
      [req.user.id]
    );

    // Student profile with LEFT JOIN so it never fails even if profile row is fresh
    const profileRes = await pool.query(
      `SELECT u.full_name, u.email, COALESCE(sp.phone, u.phone) AS phone,
              sp.student_id, COALESCE(sp.student_id, '') AS roll_number, sp.department_id, sp.course_id,
              sp.academic_year, sp.current_semester, sp.section, sp.hostel_name,
              sp.room_number, sp.guardian_name, sp.guardian_phone, sp.address,
              sp.emergency_contact_name, sp.emergency_contact_phone, sp.blood_group,
              d.name AS department_name, c.name AS course_name
       FROM users u
       LEFT JOIN student_profiles sp ON sp.user_id = u.id
       LEFT JOIN departments d ON d.id = sp.department_id
       LEFT JOIN courses c ON c.id = sp.course_id
       WHERE u.id = $1`,
      [req.user.id]
    );

    // Achievements summary
    const achRes = await pool.query(
      `SELECT * FROM student_achievements WHERE student_id = $1 ORDER BY achievement_date DESC`,
      [req.user.id]
    );

    const attendance = attendanceRes.rows[0];
    const attendancePct = attendance.total > 0
      ? ((attendance.present / attendance.total) * 100).toFixed(1)
      : null;

    res.json({
      profile:      profileRes.rows[0] || { full_name: req.user.fullName, email: req.user.email },
      attendance:   { ...attendance, percentage: attendancePct },
      leaves:       leaveRes.rows,
      gatepasses:   gatepassRes.rows,
      complaints:   complaintRes.rows,
      fees:         feeRes.rows[0] || {},
      achievements: achRes.rows
    });
  } catch (err) {
    console.error('[portfolio] getMyPortfolio error:', err.message);
    res.status(500).json({ error: 'Failed to load portfolio' });
  }
};

/** PATCH /api/portfolio/profile — student updates own profile info with UPSERT */
export const updateStudentProfile = async (req, res) => {
  const { phone, address, emergency_contact_name, emergency_contact_phone, blood_group } = req.body;
  try {
    // 1. Update phone in users table
    if (phone) {
      await pool.query(`UPDATE users SET phone = $1, updated_at = NOW() WHERE id = $2`, [phone.trim(), req.user.id]);
    }

    // 2. Upsert student_profiles
    await pool.query(
      `INSERT INTO student_profiles (
         user_id, student_id, phone, address, emergency_contact_name, emergency_contact_phone, blood_group, updated_at
       ) VALUES (
         $1, COALESCE((SELECT student_id FROM student_profiles WHERE user_id = $1), 'STU-' || SUBSTRING($1::text, 1, 8)),
         $2, $3, $4, $5, $6, NOW()
       )
       ON CONFLICT (user_id) DO UPDATE SET
         phone = COALESCE(EXCLUDED.phone, student_profiles.phone),
         address = COALESCE(EXCLUDED.address, student_profiles.address),
         emergency_contact_name = COALESCE(EXCLUDED.emergency_contact_name, student_profiles.emergency_contact_name),
         emergency_contact_phone = COALESCE(EXCLUDED.emergency_contact_phone, student_profiles.emergency_contact_phone),
         blood_group = COALESCE(EXCLUDED.blood_group, student_profiles.blood_group),
         updated_at = NOW()`,
      [req.user.id, phone || null, address || null, emergency_contact_name || null, emergency_contact_phone || null, blood_group || null]
    );

    res.json({ success: true, message: 'Profile updated successfully' });
  } catch (err) {
    console.error('[portfolio] updateStudentProfile error:', err.message);
    res.status(500).json({ error: 'Failed to update profile' });
  }
};

// ─────────────────────────────────────────────────────────────────
//  ACHIEVEMENTS & CERTIFICATES
// ─────────────────────────────────────────────────────────────────

/** GET /api/portfolio/achievements — list achievements */
export const getMyAchievements = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM student_achievements WHERE student_id = $1 ORDER BY achievement_date DESC`,
      [req.user.id]
    );
    res.json({ success: true, achievements: rows });
  } catch (err) {
    console.error('[achievements] getMyAchievements error:', err.message);
    res.status(500).json({ error: 'Failed to load achievements' });
  }
};

/** POST /api/portfolio/achievements — create achievement */
export const createAchievement = async (req, res) => {
  const {
    title,
    category,
    issuing_organization,
    achievement_date,
    description,
    file_url,
    file_name,
    file_type,
    file_size,
    file_base64
  } = req.body;

  if (!title?.trim() || !category || !issuing_organization?.trim() || !achievement_date) {
    return res.status(400).json({ error: 'Title, category, issuing organization, and date are required.' });
  }

  try {
    let finalFileUrl = file_url || null;
    let finalFileName = file_name || null;
    let finalFileType = file_type || 'application/pdf';
    let finalFileSize = file_size || 0;

    // Handle base64 file upload if provided
    if (file_base64 && file_base64.includes(';base64,')) {
      const matches = file_base64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        finalFileType = matches[1];
        const buffer = Buffer.from(matches[2], 'base64');
        finalFileSize = buffer.length;
        const ext = finalFileType.includes('pdf') ? 'pdf' : finalFileType.includes('png') ? 'png' : finalFileType.includes('jpeg') ? 'jpg' : 'bin';
        const safeName = `cert-${Date.now()}-${Math.random().toString(36).substring(2, 6)}.${ext}`;
        const filePath = path.join(process.cwd(), 'uploads', 'certificates', safeName);
        fs.writeFileSync(filePath, buffer);
        finalFileUrl = `/uploads/certificates/${safeName}`;
        finalFileName = file_name || safeName;
      }
    }

    const { rows } = await pool.query(
      `INSERT INTO student_achievements
         (student_id, title, category, issuing_organization, achievement_date, description,
          file_url, file_name, file_type, file_size)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        req.user.id, title.trim(), category, issuing_organization.trim(),
        achievement_date, description || null, finalFileUrl, finalFileName,
        finalFileType, finalFileSize
      ]
    );

    await logAudit({
      actorId: req.user.id,
      action: 'ACHIEVEMENT_CREATE',
      targetType: 'achievement',
      targetId: rows[0].id,
      details: { title }
    });

    res.status(201).json({ success: true, achievement: rows[0] });
  } catch (err) {
    console.error('[achievements] createAchievement error:', err.message);
    res.status(500).json({ error: 'Failed to create achievement' });
  }
};

/** PATCH /api/portfolio/achievements/:id — edit achievement */
export const updateAchievement = async (req, res) => {
  const { id } = req.params;
  const {
    title,
    category,
    issuing_organization,
    achievement_date,
    description,
    file_url,
    file_name,
    file_type,
    file_size,
    file_base64
  } = req.body;

  try {
    const exist = await pool.query('SELECT * FROM student_achievements WHERE id = $1', [id]);
    if (!exist.rows.length) return res.status(404).json({ error: 'Achievement not found' });
    if (exist.rows[0].student_id !== req.user.id && !req.user.isSuperAdmin) {
      return res.status(403).json({ error: 'Unauthorized to update this achievement' });
    }

    let finalFileUrl = file_url || exist.rows[0].file_url;
    let finalFileName = file_name || exist.rows[0].file_name;
    let finalFileType = file_type || exist.rows[0].file_type;
    let finalFileSize = file_size || exist.rows[0].file_size;

    if (file_base64 && file_base64.includes(';base64,')) {
      const matches = file_base64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        finalFileType = matches[1];
        const buffer = Buffer.from(matches[2], 'base64');
        finalFileSize = buffer.length;
        const ext = finalFileType.includes('pdf') ? 'pdf' : finalFileType.includes('png') ? 'png' : finalFileType.includes('jpeg') ? 'jpg' : 'bin';
        const safeName = `cert-${Date.now()}-${Math.random().toString(36).substring(2, 6)}.${ext}`;
        const filePath = path.join(process.cwd(), 'uploads', 'certificates', safeName);
        fs.writeFileSync(filePath, buffer);
        finalFileUrl = `/uploads/certificates/${safeName}`;
        finalFileName = file_name || safeName;
      }
    }

    const { rows } = await pool.query(
      `UPDATE student_achievements SET
         title = COALESCE($1, title),
         category = COALESCE($2, category),
         issuing_organization = COALESCE($3, issuing_organization),
         achievement_date = COALESCE($4, achievement_date),
         description = COALESCE($5, description),
         file_url = $6,
         file_name = $7,
         file_type = $8,
         file_size = $9,
         updated_at = NOW()
       WHERE id = $10
       RETURNING *`,
      [
        title || null, category || null, issuing_organization || null,
        achievement_date || null, description || null, finalFileUrl,
        finalFileName, finalFileType, finalFileSize, id
      ]
    );

    res.json({ success: true, achievement: rows[0] });
  } catch (err) {
    console.error('[achievements] updateAchievement error:', err.message);
    res.status(500).json({ error: 'Failed to update achievement' });
  }
};

/** DELETE /api/portfolio/achievements/:id — delete achievement */
export const deleteAchievement = async (req, res) => {
  const { id } = req.params;
  try {
    const exist = await pool.query('SELECT * FROM student_achievements WHERE id = $1', [id]);
    if (!exist.rows.length) return res.status(404).json({ error: 'Achievement not found' });
    if (exist.rows[0].student_id !== req.user.id && !req.user.isSuperAdmin) {
      return res.status(403).json({ error: 'Unauthorized to delete this achievement' });
    }

    await pool.query('DELETE FROM student_achievements WHERE id = $1', [id]);
    res.json({ success: true, message: 'Achievement deleted successfully' });
  } catch (err) {
    console.error('[achievements] deleteAchievement error:', err.message);
    res.status(500).json({ error: 'Failed to delete achievement' });
  }
};
