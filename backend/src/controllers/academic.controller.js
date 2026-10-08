import { query, getClient } from '../config/db.js';
import { logAudit } from '../utils/auditLogger.js';

// ==========================================
// 1. SUBJECTS & CLASSES
// ==========================================

export const createSubject = async (req, res) => {
  const { code, name, semester, credits = 3, courseId } = req.body;
  if (!code || !name || !semester) {
    return res.status(400).json({ success: false, message: 'Code, name, and semester are required.' });
  }

  try {
    const existing = await query('SELECT id FROM subjects WHERE UPPER(code) = UPPER($1)', [code.trim()]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ success: false, message: `Subject code '${code}' already exists.` });
    }

    const result = await query(
      `INSERT INTO subjects (code, name, semester, credits, course_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [code.trim().toUpperCase(), name.trim(), semester, credits, courseId || null]
    );

    return res.status(201).json({ success: true, subject: result.rows[0] });
  } catch (err) {
    console.error('[CreateSubject Error]:', err);
    return res.status(500).json({ success: false, message: 'Failed to create subject.' });
  }
};

export const listSubjects = async (req, res) => {
  const { semester, courseId } = req.query;
  try {
    let queryStr = 'SELECT s.*, c.name as course_name FROM subjects s LEFT JOIN courses c ON s.course_id = c.id WHERE 1=1';
    const params = [];
    if (semester) {
      params.push(semester);
      queryStr += ` AND s.semester = $${params.length}`;
    }
    if (courseId) {
      params.push(courseId);
      queryStr += ` AND s.course_id = $${params.length}`;
    }
    queryStr += ' ORDER BY s.semester ASC, s.code ASC';

    const result = await query(queryStr, params);
    return res.json({ success: true, subjects: result.rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to list subjects.' });
  }
};

export const createClass = async (req, res) => {
  const { subjectId, facultyId, name, section = 'A', academicYear, semester, roomNumber } = req.body;
  if (!subjectId || !name || !academicYear || !semester) {
    return res.status(400).json({ success: false, message: 'Subject, class name, academic year, and semester are required.' });
  }

  try {
    const result = await query(
      `INSERT INTO classes (subject_id, faculty_id, name, section, academic_year, semester, room_number)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [subjectId, facultyId || null, name.trim(), section.trim().toUpperCase(), academicYear, semester, roomNumber || null]
    );

    return res.status(201).json({ success: true, class: result.rows[0] });
  } catch (err) {
    console.error('[CreateClass Error]:', err);
    return res.status(500).json({ success: false, message: 'Failed to create class.' });
  }
};

export const listClasses = async (req, res) => {
  const { facultyId, semester } = req.query;
  try {
    let queryStr = `
      SELECT 
        c.*, 
        s.name as subject_name, s.code as subject_code,
        u.full_name as faculty_name, u.email as faculty_email,
        (SELECT COUNT(*) FROM class_enrollments ce WHERE ce.class_id = c.id) as enrolled_count
      FROM classes c
      JOIN subjects s ON c.subject_id = s.id
      LEFT JOIN users u ON c.faculty_id = u.id
      WHERE 1=1
    `;
    const params = [];
    if (facultyId) {
      params.push(facultyId);
      queryStr += ` AND c.faculty_id = $${params.length}`;
    }
    if (semester) {
      params.push(semester);
      queryStr += ` AND c.semester = $${params.length}`;
    }
    queryStr += ' ORDER BY c.academic_year DESC, c.semester ASC, c.name ASC';

    const result = await query(queryStr, params);
    return res.json({ success: true, classes: result.rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to list classes.' });
  }
};

export const enrollStudents = async (req, res) => {
  const { classId } = req.params;
  const { studentIds } = req.body; // array of user UUIDs

  if (!Array.isArray(studentIds) || studentIds.length === 0) {
    return res.status(400).json({ success: false, message: 'Array of studentIds is required.' });
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');
    for (const sid of studentIds) {
      await client.query(
        'INSERT INTO class_enrollments (class_id, student_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [classId, sid]
      );
    }
    await client.query('COMMIT');
    return res.json({ success: true, message: `Enrolled ${studentIds.length} students into class.` });
  } catch (err) {
    await client.query('ROLLBACK');
    return res.status(500).json({ success: false, message: 'Enrollment failed: ' + err.message });
  } finally {
    client.release();
  }
};

export const getClassStudents = async (req, res) => {
  const { classId } = req.params;
  try {
    const queryStr = `
      SELECT 
        u.id, u.full_name, u.email, u.phone,
        sp.student_id, sp.academic_year, sp.current_semester, sp.section
      FROM class_enrollments ce
      JOIN users u ON ce.student_id = u.id
      JOIN student_profiles sp ON u.id = sp.user_id
      WHERE ce.class_id = $1
      ORDER BY sp.student_id ASC;
    `;
    const result = await query(queryStr, [classId]);
    return res.json({ success: true, students: result.rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch class students.' });
  }
};

// ==========================================
// 2. TIMETABLES & CONFLICT DETECTION
// ==========================================

export const createTimetableEntry = async (req, res) => {
  const { classId, dayOfWeek, startTime, endTime, roomNumber } = req.body;

  if (!classId || !dayOfWeek || !startTime || !endTime || !roomNumber) {
    return res.status(400).json({
      success: false,
      message: 'Class ID, day of week (1-7), start time, end time, and room number are required.'
    });
  }

  if (startTime >= endTime) {
    return res.status(400).json({
      success: false,
      message: 'Class start time must be earlier than end time.'
    });
  }

  try {
    // 1. Fetch Class & Faculty
    const classRes = await query('SELECT * FROM classes WHERE id = $1', [classId]);
    if (classRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Class not found.' });
    }
    const currentClass = classRes.rows[0];

    // 2. Check Classroom Collision (Room double-booking prevention)
    const roomConflict = await query(
      `SELECT t.id, t.start_time, t.end_time, c.name as class_name 
       FROM timetables t
       JOIN classes c ON t.class_id = c.id
       WHERE LOWER(t.room_number) = LOWER($1) 
         AND t.day_of_week = $2
         AND NOT (t.end_time <= $3::TIME OR t.start_time >= $4::TIME)`,
      [roomNumber.trim(), dayOfWeek, startTime, endTime]
    );

    if (roomConflict.rows.length > 0) {
      const conflict = roomConflict.rows[0];
      return res.status(409).json({
        success: false,
        message: `Classroom conflict: Room '${roomNumber}' is already booked on Day ${dayOfWeek} for '${conflict.class_name}' from ${conflict.start_time} to ${conflict.end_time}.`
      });
    }

    // 3. Check Faculty Collision (Instructor assigned to two classes simultaneously)
    if (currentClass.faculty_id) {
      const facultyConflict = await query(
        `SELECT t.id, t.start_time, t.end_time, c.name as class_name, t.room_number 
         FROM timetables t
         JOIN classes c ON t.class_id = c.id
         WHERE c.faculty_id = $1 
           AND t.day_of_week = $2
           AND NOT (t.end_time <= $3::TIME OR t.start_time >= $4::TIME)`,
        [currentClass.faculty_id, dayOfWeek, startTime, endTime]
      );

      if (facultyConflict.rows.length > 0) {
        const conflict = facultyConflict.rows[0];
        return res.status(409).json({
          success: false,
          message: `Faculty scheduling conflict: The assigned instructor is already teaching '${conflict.class_name}' in room ${conflict.room_number} between ${conflict.start_time} and ${conflict.end_time}.`
        });
      }
    }

    // 4. Insert Entry
    const result = await query(
      `INSERT INTO timetables (class_id, day_of_week, start_time, end_time, room_number)
       VALUES ($1, $2, $3::TIME, $4::TIME, $5)
       RETURNING *`,
      [classId, dayOfWeek, startTime, endTime, roomNumber.trim()]
    );

    return res.status(201).json({
      success: true,
      message: 'Timetable slot scheduled successfully without conflicts.',
      entry: result.rows[0]
    });
  } catch (err) {
    console.error('[Timetable Conflict Check Error]:', err);
    return res.status(500).json({ success: false, message: 'Failed to schedule timetable entry: ' + err.message });
  }
};

export const getTimetable = async (req, res) => {
  const { classId, facultyId, studentId } = req.query;
  try {
    let queryStr = `
      SELECT 
        t.*,
        c.name as class_name, c.section,
        s.name as subject_name, s.code as subject_code,
        u.full_name as faculty_name
      FROM timetables t
      JOIN classes c ON t.class_id = c.id
      JOIN subjects s ON c.subject_id = s.id
      LEFT JOIN users u ON c.faculty_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (classId) {
      params.push(classId);
      queryStr += ` AND t.class_id = $${params.length}`;
    } else if (facultyId) {
      params.push(facultyId);
      queryStr += ` AND c.faculty_id = $${params.length}`;
    } else if (studentId) {
      params.push(studentId);
      queryStr += ` AND c.id IN (SELECT class_id FROM class_enrollments WHERE student_id = $${params.length})`;
    } else if (req.user.roles.includes('student')) {
      params.push(req.user.id);
      queryStr += ` AND c.id IN (SELECT class_id FROM class_enrollments WHERE student_id = $${params.length})`;
    } else if (req.user.roles.includes('faculty')) {
      params.push(req.user.id);
      queryStr += ` AND c.faculty_id = $${params.length}`;
    }

    queryStr += ' ORDER BY t.day_of_week ASC, t.start_time ASC';

    const result = await query(queryStr, params);
    return res.json({ success: true, schedule: result.rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch timetable.' });
  }
};

// ==========================================
// 3. ATTENDANCE MANAGEMENT
// ==========================================

export const submitAttendance = async (req, res) => {
  const { classId, sessionDate, startTime, endTime, topicCovered, attendanceList } = req.body;
  // attendanceList = [{ studentId, status: 'present'|'absent'|'late', remarks }]

  if (!classId || !sessionDate || !startTime || !endTime || !Array.isArray(attendanceList)) {
    return res.status(400).json({
      success: false,
      message: 'Class, session date, time range, and attendance records list are required.'
    });
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Fetch class subject
    const classRes = await client.query('SELECT subject_id FROM classes WHERE id = $1', [classId]);
    if (classRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Class not found.' });
    }
    const subjectId = classRes.rows[0].subject_id;

    // Check duplicate session
    const dupSession = await client.query(
      `SELECT id FROM attendance_sessions 
       WHERE class_id = $1 AND session_date = $2 AND start_time = $3::TIME`,
      [classId, sessionDate, startTime]
    );

    let sessionId;
    if (dupSession.rows.length > 0) {
      sessionId = dupSession.rows[0].id;
      // Update session details
      await client.query(
        `UPDATE attendance_sessions 
         SET end_time = $1::TIME, topic_covered = $2, marked_by = $3
         WHERE id = $4`,
        [endTime, topicCovered || null, req.user.id, sessionId]
      );
    } else {
      const sessionRes = await client.query(
        `INSERT INTO attendance_sessions (class_id, subject_id, marked_by, session_date, start_time, end_time, topic_covered)
         VALUES ($1, $2, $3, $4, $5::TIME, $6::TIME, $7)
         RETURNING id`,
        [classId, subjectId, req.user.id, sessionDate, startTime, endTime, topicCovered || null]
      );
      sessionId = sessionRes.rows[0].id;
    }

    // Insert or update records
    for (const record of attendanceList) {
      await client.query(
        `INSERT INTO attendance_records (session_id, student_id, status, remarks)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (session_id, student_id) 
         DO UPDATE SET status = EXCLUDED.status, remarks = EXCLUDED.remarks, updated_at = CURRENT_TIMESTAMP`,
        [sessionId, record.studentId, record.status, record.remarks || null]
      );
    }

    await client.query('COMMIT');

    await logAudit({
      userId: req.user.id,
      action: 'ATTENDANCE_MARKED',
      module: 'attendance',
      targetRecordId: sessionId,
      details: { classId, sessionDate, recordsCount: attendanceList.length },
      ipAddress: req.ip
    });

    return res.status(201).json({
      success: true,
      message: `Attendance recorded for ${attendanceList.length} students on ${sessionDate}.`,
      sessionId
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[SubmitAttendance Error]:', err);
    return res.status(500).json({ success: false, message: 'Failed to record attendance: ' + err.message });
  } finally {
    client.release();
  }
};

export const modifyAttendanceRecord = async (req, res) => {
  const { recordId } = req.params;
  const { newStatus, reason } = req.body;

  if (!newStatus || !reason) {
    return res.status(400).json({
      success: false,
      message: 'New attendance status and a mandatory modification reason are required.'
    });
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const currRes = await client.query('SELECT * FROM attendance_records WHERE id = $1', [recordId]);
    if (currRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Attendance record not found.' });
    }
    const oldRecord = currRes.rows[0];

    // Update record
    await client.query(
      'UPDATE attendance_records SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [newStatus, recordId]
    );

    // Save change log
    await client.query(
      `INSERT INTO attendance_change_logs (attendance_record_id, modified_by, old_status, new_status, reason)
       VALUES ($1, $2, $3, $4, $5)`,
      [recordId, req.user.id, oldRecord.status, newStatus, reason.trim()]
    );

    await client.query('COMMIT');

    await logAudit({
      userId: req.user.id,
      action: 'ATTENDANCE_MODIFIED',
      module: 'attendance',
      targetRecordId: recordId,
      details: { oldStatus: oldRecord.status, newStatus, reason },
      ipAddress: req.ip
    });

    return res.json({
      success: true,
      message: `Attendance updated from '${oldRecord.status}' to '${newStatus}' with audit log saved.`
    });
  } catch (err) {
    await client.query('ROLLBACK');
    return res.status(500).json({ success: false, message: 'Failed to modify attendance: ' + err.message });
  } finally {
    client.release();
  }
};

export const getStudentAttendanceSummary = async (req, res) => {
  const studentId = req.params.studentId || req.user.id;
  try {
    // Subject-wise percentage
    const queryStr = `
      SELECT 
        s.id as subject_id, s.name as subject_name, s.code as subject_code,
        COUNT(ar.id) as total_sessions,
        COUNT(CASE WHEN ar.status = 'present' THEN 1 END) as present_sessions,
        COUNT(CASE WHEN ar.status = 'late' THEN 1 END) as late_sessions,
        COUNT(CASE WHEN ar.status = 'absent' THEN 1 END) as absent_sessions,
        ROUND(
          (COUNT(CASE WHEN ar.status = 'present' THEN 1 END)::NUMERIC / NULLIF(COUNT(ar.id), 0)) * 100, 1
        ) as attendance_percentage
      FROM class_enrollments ce
      JOIN classes c ON ce.class_id = c.id
      JOIN subjects s ON c.subject_id = s.id
      LEFT JOIN attendance_sessions att_s ON c.id = att_s.class_id
      LEFT JOIN attendance_records ar ON att_s.id = ar.session_id AND ar.student_id = ce.student_id
      WHERE ce.student_id = $1
      GROUP BY s.id, s.name, s.code
      ORDER BY s.code ASC;
    `;
    const result = await query(queryStr, [studentId]);

    // Overall aggregate
    let totalSessions = 0;
    let totalAttended = 0;

    result.rows.forEach(r => {
      totalSessions += parseInt(r.total_sessions || 0);
      totalAttended += parseInt(r.present_sessions || 0);
    });

    const overallPercentage = totalSessions > 0 ? ((totalAttended / totalSessions) * 100).toFixed(1) : '100.0';
    const isShortage = parseFloat(overallPercentage) < 75.0;

    return res.json({
      success: true,
      summary: {
        totalSessions,
        totalAttended,
        overallPercentage: parseFloat(overallPercentage),
        isShortage,
        shortageThreshold: 75.0,
        subjects: result.rows
      }
    });
  } catch (err) {
    console.error('[StudentAttendance Error]:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve attendance summary.' });
  }
};

// ==========================================
// 4. LEAVE MANAGEMENT
// ==========================================

export const applyLeave = async (req, res) => {
  const { leaveType, startDate, endDate, reason, documentUrl } = req.body;

  if (!leaveType || !startDate || !endDate || !reason) {
    return res.status(400).json({
      success: false,
      message: 'Leave type, start date, end date, and reason are required.'
    });
  }

  if (new Date(startDate) > new Date(endDate)) {
    return res.status(400).json({
      success: false,
      message: 'Start date cannot be after end date.'
    });
  }

  try {
    const result = await query(
      `INSERT INTO leave_requests (student_id, leave_type, start_date, end_date, reason, document_url, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending')
       RETURNING *`,
      [req.user.id, leaveType.trim(), startDate, endDate, reason.trim(), documentUrl || null]
    );

    await logAudit({
      userId: req.user.id,
      action: 'LEAVE_REQUESTED',
      module: 'leave',
      targetRecordId: result.rows[0].id,
      details: { leaveType, startDate, endDate },
      ipAddress: req.ip
    });

    return res.status(201).json({
      success: true,
      message: 'Leave application submitted successfully for review.',
      leaveRequest: result.rows[0]
    });
  } catch (err) {
    console.error('[ApplyLeave Error]:', err);
    return res.status(500).json({ success: false, message: 'Failed to submit leave request.' });
  }
};

export const getMyLeaves = async (req, res) => {
  try {
    const queryStr = `
      SELECT 
        lr.*, 
        u.full_name as approver_name
      FROM leave_requests lr
      LEFT JOIN users u ON lr.approver_id = u.id
      WHERE lr.student_id = $1
      ORDER BY lr.created_at DESC;
    `;
    const result = await query(queryStr, [req.user.id]);
    return res.json({ success: true, leaves: result.rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch leave requests.' });
  }
};

export const cancelLeave = async (req, res) => {
  const { leaveId } = req.params;
  try {
    const check = await query('SELECT * FROM leave_requests WHERE id = $1 AND student_id = $2', [leaveId, req.user.id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Leave request not found.' });
    }

    if (!['pending', 'draft'].includes(check.rows[0].status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel leave request that is already ${check.rows[0].status}.`
      });
    }

    await query("UPDATE leave_requests SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [leaveId]);

    return res.json({ success: true, message: 'Leave request has been cancelled.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to cancel leave.' });
  }
};

export const listPendingLeaves = async (req, res) => {
  try {
    const queryStr = `
      SELECT 
        lr.*,
        u.full_name as student_name, u.email as student_email,
        sp.student_id as roll_number, sp.section,
        d.name as department_name
      FROM leave_requests lr
      JOIN users u ON lr.student_id = u.id
      JOIN student_profiles sp ON u.id = sp.user_id
      LEFT JOIN departments d ON sp.department_id = d.id
      ORDER BY lr.created_at DESC;
    `;
    const result = await query(queryStr);
    return res.json({ success: true, leaves: result.rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to list pending leaves.' });
  }
};

export const reviewLeave = async (req, res) => {
  const { leaveId } = req.params;
  const { verdict, rejectionReason, remarks } = req.body;

  if (!['approved', 'rejected'].includes(verdict)) {
    return res.status(400).json({ success: false, message: "Verdict must be 'approved' or 'rejected'." });
  }

  if (verdict === 'rejected' && (!rejectionReason || !rejectionReason.trim())) {
    return res.status(400).json({
      success: false,
      message: 'A mandatory rejection reason is required when denying a student leave request.'
    });
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Update leave request
    const updateRes = await client.query(
      `UPDATE leave_requests 
       SET status = $1, approver_id = $2, rejection_reason = $3, reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [verdict, req.user.id, verdict === 'rejected' ? rejectionReason.trim() : null, leaveId]
    );

    if (updateRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Leave request not found.' });
    }
    const leave = updateRes.rows[0];

    // Record in leave_approvals audit
    await client.query(
      `INSERT INTO leave_approvals (leave_request_id, approver_id, status, remarks)
       VALUES ($1, $2, $3, $4)`,
      [leaveId, req.user.id, verdict, remarks || rejectionReason || 'Reviewed by faculty authority']
    );

    // Notify student in in-app notifications table
    await client.query(
      `INSERT INTO notifications (user_id, title, message, category, action_url)
       VALUES ($1, $2, $3, 'leave', '/student/leaves')`,
      [
        leave.student_id,
        `Leave Request ${verdict.toUpperCase()}`,
        `Your leave request from ${leave.start_date} to ${leave.end_date} has been ${verdict}.${verdict === 'rejected' ? ` Reason: ${rejectionReason}` : ''}`
      ]
    );

    await client.query('COMMIT');

    await logAudit({
      userId: req.user.id,
      action: `LEAVE_${verdict.toUpperCase()}`,
      module: 'leave',
      targetRecordId: leaveId,
      details: { verdict, rejectionReason },
      ipAddress: req.ip
    });

    return res.json({
      success: true,
      message: `Leave request marked as ${verdict}. Student notified.`,
      leave
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[ReviewLeave Error]:', err);
    return res.status(500).json({ success: false, message: 'Failed to review leave request.' });
  } finally {
    client.release();
  }
};
