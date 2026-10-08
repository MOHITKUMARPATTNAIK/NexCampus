import QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import { query, getClient } from '../config/db.js';
import { logAudit } from '../utils/auditLogger.js';

// ==========================================
// 1. STUDENT GATE PASS REQUESTS
// ==========================================

export const requestGatePass = async (req, res) => {
  const { reason, departureTime, expectedReturnTime } = req.body;

  if (!reason || !departureTime || !expectedReturnTime) {
    return res.status(400).json({
      success: false,
      message: 'Reason, departure time, and expected return time are required.'
    });
  }

  if (new Date(departureTime) >= new Date(expectedReturnTime)) {
    return res.status(400).json({
      success: false,
      message: 'Expected return time must be later than departure time.'
    });
  }

  try {
    const passNumber = `GP-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

    const result = await query(
      `INSERT INTO gate_passes (student_id, pass_number, reason, departure_time, expected_return_time, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')
       RETURNING *`,
      [req.user.id, passNumber, reason.trim(), departureTime, expectedReturnTime]
    );

    await logAudit({
      userId: req.user.id,
      action: 'GATE_PASS_REQUESTED',
      module: 'security',
      targetRecordId: result.rows[0].id,
      details: { passNumber, departureTime, expectedReturnTime },
      ipAddress: req.ip
    });

    return res.status(201).json({
      success: true,
      message: 'Gate pass requested successfully. Awaiting warden/admin approval.',
      gatePass: result.rows[0]
    });
  } catch (err) {
    console.error('[RequestGatePass Error]:', err);
    return res.status(500).json({ success: false, message: 'Failed to request gate pass.' });
  }
};

export const getMyGatePasses = async (req, res) => {
  try {
    const queryStr = `
      SELECT 
        gp.*,
        gpt.qr_token, gpt.expires_at as token_expires_at, gpt.is_revoked as token_revoked,
        u.full_name as approver_name,
        (
          SELECT movement_type FROM gate_movements gm 
          WHERE gm.gate_pass_id = gp.id 
          ORDER BY gm.movement_time DESC LIMIT 1
        ) as current_movement_state
      FROM gate_passes gp
      LEFT JOIN gate_pass_tokens gpt ON gp.id = gpt.gate_pass_id
      LEFT JOIN users u ON gp.approver_id = u.id
      WHERE gp.student_id = $1
      ORDER BY gp.created_at DESC;
    `;
    const result = await query(queryStr, [req.user.id]);

    // Generate base64 QR data URLs for approved active tokens
    const passesWithQr = await Promise.all(
      result.rows.map(async (p) => {
        let qrDataUrl = null;
        if (p.qr_token && !p.token_revoked && ['approved', 'active'].includes(p.status)) {
          try {
            qrDataUrl = await QRCode.toDataURL(p.qr_token, {
              width: 280,
              margin: 2,
              color: { dark: '#0f172a', light: '#ffffff' }
            });
          } catch (qrErr) {
            console.error('Failed to generate QR data URL:', qrErr);
          }
        }
        return {
          ...p,
          qr_code_data_url: qrDataUrl
          
        };
      })
    );

    return res.json({ success: true, passes: passesWithQr });
  } catch (err) {
    console.error('[GetMyGatePasses Error]:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch gate passes.' });
  }
};

// ==========================================
// 2. APPROVER DECISION WORKFLOW
// ==========================================

export const listPendingGatePasses = async (req, res) => {
  const { status = 'pending' } = req.query;
  try {
    let queryStr = `
      SELECT 
        gp.*,
        u.full_name as student_name, u.email as student_email, u.phone as student_phone,
        sp.student_id as roll_number, sp.hostel_name, sp.room_number,
        d.name as department_name,
        approver.full_name as approver_name
      FROM gate_passes gp
      JOIN users u ON gp.student_id = u.id
      JOIN student_profiles sp ON u.id = sp.user_id
      LEFT JOIN departments d ON sp.department_id = d.id
      LEFT JOIN users approver ON gp.approver_id = approver.id
    `;
    const params = [];

    if (status) {
      queryStr += ' WHERE gp.status = $1';
      params.push(status);
    }

    queryStr += ' ORDER BY gp.departure_time ASC;';

    const result = await query(queryStr, params);
    return res.json({ success: true, passes: result.rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to list gate passes.' });
  }
};

export const reviewGatePass = async (req, res) => {
  const { passId } = req.params;
  const { verdict, rejectionReason } = req.body;

  if (!['approved', 'rejected'].includes(verdict)) {
    return res.status(400).json({ success: false, message: "Verdict must be 'approved' or 'rejected'." });
  }

  if (verdict === 'rejected' && (!rejectionReason || !rejectionReason.trim())) {
    return res.status(400).json({ success: false, message: 'Rejection reason is mandatory when denying gate pass.' });
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const passRes = await client.query('SELECT * FROM gate_passes WHERE id = $1', [passId]);
    if (passRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Gate pass not found.' });
    }
    const pass = passRes.rows[0];

    // Update gate pass status
    await client.query(
      `UPDATE gate_passes 
       SET status = $1, approver_id = $2, approved_at = CURRENT_TIMESTAMP, 
           rejection_reason = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $4`,
      [verdict, req.user.id, verdict === 'rejected' ? rejectionReason.trim() : null, passId]
    );

    // If approved, generate unique cryptographic token for QR
    let tokenRecord = null;
    if (verdict === 'approved') {
      const qrToken = `NC-PASS-${uuidv4()}-${pass.pass_number}`;
      const tokenRes = await client.query(
        `INSERT INTO gate_pass_tokens (gate_pass_id, qr_token, expires_at)
         VALUES ($1, $2, $3)
         ON CONFLICT (gate_pass_id) 
         DO UPDATE SET qr_token = EXCLUDED.qr_token, expires_at = EXCLUDED.expires_at, is_revoked = false
         RETURNING *`,
        [passId, qrToken, pass.expected_return_time]
      );
      tokenRecord = tokenRes.rows[0];
    }

    // Notify student in in-app notification center
    await client.query(
      `INSERT INTO notifications (user_id, title, message, category, action_url)
       VALUES ($1, $2, $3, 'gatepass', '/student/gatepass')`,
      [
        pass.student_id,
        `Gate Pass ${verdict.toUpperCase()}`,
        `Your Gate Pass (${pass.pass_number}) has been ${verdict}.${verdict === 'approved' ? ' Display your verified QR code at the campus checkpoint.' : ` Reason: ${rejectionReason}`}`
      ]
    );

    await client.query('COMMIT');

    await logAudit({
      userId: req.user.id,
      action: `GATE_PASS_${verdict.toUpperCase()}`,
      module: 'security',
      targetRecordId: passId,
      details: { verdict, passNumber: pass.pass_number },
      ipAddress: req.ip
    });

    return res.json({
      success: true,
      message: `Gate pass has been ${verdict}. QR token generated and student notified.`,
      status: verdict,
      token: tokenRecord
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[ReviewGatePass Error]:', err);
    return res.status(500).json({ success: false, message: 'Failed to review gate pass: ' + err.message });
  } finally {
    client.release();
  }
};

// ==========================================
// 3. SECURITY GUARD VERIFICATION & SCANNING
// ==========================================

export const verifyPassToken = async (req, res) => {
  const { qrToken, passNumber, gateId } = req.body;

  if (!qrToken && !passNumber) {
    return res.status(400).json({
      success: false,
      message: 'Please provide either a QR token string or Gate Pass Number.'
    });
  }

  try {
    let queryStr = `
      SELECT 
        gp.*,
        gpt.qr_token, gpt.expires_at as token_expires_at, gpt.is_revoked as token_revoked,
        u.id as student_user_id, u.full_name as student_name, u.email as student_email, u.phone as student_phone,
        sp.student_id as roll_number, sp.hostel_name, sp.room_number, sp.avatar_url,
        d.name as department_name,
        (
          SELECT movement_type FROM gate_movements gm 
          WHERE gm.gate_pass_id = gp.id 
          ORDER BY gm.movement_time DESC LIMIT 1
        ) as last_movement_type
      FROM gate_passes gp
      JOIN gate_pass_tokens gpt ON gp.id = gpt.gate_pass_id
      JOIN users u ON gp.student_id = u.id
      JOIN student_profiles sp ON u.id = sp.user_id
      LEFT JOIN departments d ON sp.department_id = d.id
      WHERE 1=1
    `;
    const params = [];

    if (qrToken) {
      params.push(qrToken.trim());
      queryStr += ` AND gpt.qr_token = $${params.length}`;
    } else {
      params.push(passNumber.trim().toUpperCase());
      queryStr += ` AND UPPER(gp.pass_number) = $${params.length}`;
    }

    const result = await query(queryStr, params);

    // If not found in tokens/passes
    if (result.rows.length === 0) {
      // Log invalid attempt
      await query(
        `INSERT INTO gate_verification_logs (guard_id, gate_id, scan_result, remarks)
         VALUES ($1, $2, 'invalid', $3)`,
        [req.user.id, gateId || null, `Token not found: ${qrToken || passNumber}`]
      );

      return res.status(404).json({
        success: false,
        scanResult: 'invalid',
        message: 'Invalid or forged Gate Pass QR Code. Not recognized in institutional registry.'
      });
    }

    const pass = result.rows[0];

    // Check Revocation
    if (pass.token_revoked || pass.status === 'revoked') {
      await query(
        `INSERT INTO gate_verification_logs (gate_pass_id, guard_id, gate_id, scan_result, remarks)
         VALUES ($1, $2, $3, 'revoked', 'Attempted use of revoked pass')`,
        [pass.id, req.user.id, gateId || null]
      );
      return res.status(403).json({
        success: false,
        scanResult: 'revoked',
        message: 'This Gate Pass has been REVOKED by Campus Administration.',
        pass
      });
    }

    // Check Expiration
    const now = new Date();
    const expiry = new Date(pass.token_expires_at);
    if (now > expiry && pass.status !== 'active') {
      await query(
        `INSERT INTO gate_verification_logs (gate_pass_id, guard_id, gate_id, scan_result, remarks)
         VALUES ($1, $2, $3, 'expired', 'Pass expired before departure')`,
        [pass.id, req.user.id, gateId || null]
      );
      return res.status(400).json({
        success: false,
        scanResult: 'expired',
        message: 'Gate Pass has EXPIRED. Permitted movement window has passed.',
        pass
      });
    }

    // Check Completed / Already Used
    if (pass.status === 'completed') {
      await query(
        `INSERT INTO gate_verification_logs (gate_pass_id, guard_id, gate_id, scan_result, remarks)
         VALUES ($1, $2, $3, 'already_used', 'Pass cycle already completed')`,
        [pass.id, req.user.id, gateId || null]
      );
      return res.status(400).json({
        success: false,
        scanResult: 'already_used',
        message: 'Gate Pass has ALREADY BEEN COMPLETED. Student has returned.',
        pass
      });
    }

    // Determine allowed movement action
    let nextAllowedAction = null;
    if (pass.status === 'approved' && (!pass.last_movement_type || pass.last_movement_type === 'checkin')) {
      nextAllowedAction = 'checkout';
    } else if (pass.status === 'active' && pass.last_movement_type === 'checkout') {
      nextAllowedAction = 'checkin';
    }

    // Log valid verification
    await query(
      `INSERT INTO gate_verification_logs (gate_pass_id, guard_id, gate_id, scan_result, remarks)
       VALUES ($1, $2, $3, 'valid', $4)`,
      [pass.id, req.user.id, gateId || null, `Ready for ${nextAllowedAction}`]
    );

    return res.json({
      success: true,
      scanResult: 'valid',
      nextAllowedAction,
      message: `Verified valid pass for student ${pass.student_name}. Ready for ${nextAllowedAction?.toUpperCase()}.`,
      student: {
        id: pass.student_user_id,
        name: pass.student_name,
        rollNumber: pass.roll_number,
        department: pass.department_name,
        hostel: pass.hostel_name,
        roomNumber: pass.room_number,
        phone: pass.student_phone,
        avatarUrl: pass.avatar_url
      },
      pass: {
        id: pass.id,
        passNumber: pass.pass_number,
        reason: pass.reason,
        departureTime: pass.departure_time,
        expectedReturnTime: pass.expected_return_time,
        status: pass.status,
        lastMovementType: pass.last_movement_type
      }
    });
  } catch (err) {
    console.error('[VerifyPassToken Error]:', err);
    return res.status(500).json({ success: false, message: 'Server error during QR verification: ' + err.message });
  }
};

export const recordGateMovement = async (req, res) => {
  const { passId, movementType, gateId, remarks } = req.body;

  if (!passId || !['checkout', 'checkin'].includes(movementType)) {
    return res.status(400).json({
      success: false,
      message: "Pass ID and movement type ('checkout' or 'checkin') are required."
    });
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const passRes = await client.query('SELECT * FROM gate_passes WHERE id = $1 FOR UPDATE', [passId]);
    if (passRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Gate pass not found.' });
    }
    const pass = passRes.rows[0];

    // Check last movement to prevent duplicates
    const lastMovRes = await client.query(
      'SELECT movement_type FROM gate_movements WHERE gate_pass_id = $1 ORDER BY movement_time DESC LIMIT 1',
      [passId]
    );
    const lastMovement = lastMovRes.rows[0]?.movement_type;

    if (movementType === 'checkout') {
      if (lastMovement === 'checkout' || pass.status === 'active') {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: 'Duplicate checkout rejected: Student has already checked out and has not returned.'
        });
      }
      if (pass.status !== 'approved') {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: `Cannot checkout pass with status '${pass.status}'. Pass must be approved.`
        });
      }
    }

    if (movementType === 'checkin') {
      if (lastMovement !== 'checkout' || pass.status !== 'active') {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: 'Invalid check-in: Student does not have an active checkout record.'
        });
      }
    }

    // Insert movement record
    const movRes = await client.query(
      `INSERT INTO gate_movements (gate_pass_id, student_id, gate_id, guard_id, movement_type, remarks)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [passId, pass.student_id, gateId || null, req.user.id, movementType, remarks || null]
    );

    // Update gate_pass status
    const newPassStatus = movementType === 'checkout' ? 'active' : 'completed';
    await client.query(
      'UPDATE gate_passes SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [newPassStatus, passId]
    );

    await client.query('COMMIT');

    await logAudit({
      userId: req.user.id,
      action: `GATE_MOVEMENT_${movementType.toUpperCase()}`,
      module: 'security',
      targetRecordId: passId,
      details: { movementType, gateId, passNumber: pass.pass_number },
      ipAddress: req.ip
    });

    return res.json({
      success: true,
      message: `Physical ${movementType.toUpperCase()} recorded successfully at ${new Date().toLocaleTimeString()}.`,
      movement: movRes.rows[0],
      newPassStatus
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[RecordMovement Error]:', err);
    return res.status(500).json({ success: false, message: 'Failed to record gate movement: ' + err.message });
  } finally {
    client.release();
  }
};

// ==========================================
// 4. OVERDUE & SECURITY EXCEPTION LOGS
// ==========================================

export const getOverdueStudents = async (req, res) => {
  try {
    const queryStr = `
      SELECT 
        gp.id as pass_id, gp.pass_number, gp.departure_time, gp.expected_return_time, gp.reason,
        u.id as student_id, u.full_name as student_name, u.email as student_email, u.phone as student_phone,
        sp.student_id as roll_number, sp.hostel_name, sp.room_number, sp.guardian_name, sp.guardian_phone,
        d.name as department_name,
        gm.movement_time as actual_checkout_time,
        EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - gp.expected_return_time)) / 3600 as hours_overdue
      FROM gate_passes gp
      JOIN users u ON gp.student_id = u.id
      JOIN student_profiles sp ON u.id = sp.user_id
      LEFT JOIN departments d ON sp.department_id = d.id
      JOIN gate_movements gm ON gp.id = gm.gate_pass_id AND gm.movement_type = 'checkout'
      WHERE gp.status = 'active'
        AND gp.expected_return_time < CURRENT_TIMESTAMP
      ORDER BY gp.expected_return_time ASC;
    `;
    const result = await query(queryStr);
    return res.json({ success: true, overdue: result.rows });
  } catch (err) {
    console.error('[GetOverdueStudents Error]:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch overdue records.' });
  }
};

export const getRecentMovements = async (req, res) => {
  const { gateId, limit = 50 } = req.query;
  try {
    let queryStr = `
      SELECT 
        gm.*,
        gp.pass_number, gp.expected_return_time,
        u.full_name as student_name,
        sp.student_id as roll_number,
        g.gate_number, g.name as gate_name,
        guard.full_name as guard_name
      FROM gate_movements gm
      JOIN gate_passes gp ON gm.gate_pass_id = gp.id
      JOIN users u ON gm.student_id = u.id
      JOIN student_profiles sp ON u.id = sp.user_id
      LEFT JOIN gates g ON gm.gate_id = g.id
      LEFT JOIN users guard ON gm.guard_id = guard.id
      WHERE 1=1
    `;
    const params = [];
    if (gateId) {
      params.push(gateId);
      queryStr += ` AND gm.gate_id = $${params.length}`;
    }
    queryStr += ` ORDER BY gm.movement_time DESC LIMIT $${params.length + 1};`;
    params.push(limit);

    const result = await query(queryStr, params);
    return res.json({ success: true, movements: result.rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch movements.' });
  }
};
