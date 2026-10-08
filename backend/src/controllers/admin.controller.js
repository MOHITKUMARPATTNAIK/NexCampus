import bcrypt from 'bcryptjs';
import { query, getClient } from '../config/db.js';
import { logAudit } from '../utils/auditLogger.js';

// ==========================================
// 1. DELEGATED ADMINISTRATORS
// ==========================================

export const createDelegatedAdmin = async (req, res) => {
  const {
    email,
    password,
    fullName,
    phone,
    roleType, // e.g. 'Academic Administrator', 'Accounts Administrator', 'Hostel Administrator', 'Security Manager'
    departmentId,
    scopeDetails = {},
    customPermissions = [] // array of permission codes
  } = req.body;

  if (!email || !password || !fullName || !roleType) {
    return res.status(400).json({
      success: false,
      message: 'Email, password, full name, and role type are required.'
    });
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Check if email exists
    const emailCheck = await client.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [email.trim()]);
    if (emailCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        message: 'A user with this email address already exists.'
      });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create User
    const userRes = await client.query(
      `INSERT INTO users (email, password_hash, full_name, phone, status)
       VALUES ($1, $2, $3, $4, 'active')
       RETURNING id, email, full_name, status`,
      [email.trim().toLowerCase(), passwordHash, fullName.trim(), phone || null]
    );
    const newAdmin = userRes.rows[0];

    // Assign delegated_admin role
    const roleRes = await client.query("SELECT id FROM roles WHERE name = 'delegated_admin'");
    if (roleRes.rows.length > 0) {
      await client.query(
        'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)',
        [newAdmin.id, roleRes.rows[0].id]
      );
    }

    // Record administrator assignment
    const assignRes = await client.query(
      `INSERT INTO administrator_assignments (
         user_id, role_type, department_id, scope_details, is_cmo, appointed_by, is_active
       )
       VALUES ($1, $2, $3, $4, false, $5, true)
       RETURNING *`,
      [
        newAdmin.id,
        roleType.trim(),
        departmentId || null,
        JSON.stringify(scopeDetails),
        req.user.id
      ]
    );

    // Assign custom permissions if provided
    if (customPermissions.length > 0) {
      for (const code of customPermissions) {
        const permRes = await client.query('SELECT id FROM permissions WHERE code = $1', [code]);
        if (permRes.rows.length > 0) {
          await client.query(
            `INSERT INTO user_permissions (user_id, permission_id, is_granted)
             VALUES ($1, $2, true)
             ON CONFLICT (user_id, permission_id) DO UPDATE SET is_granted = true`,
            [newAdmin.id, permRes.rows[0].id]
          );
        }
      }
    }

    await client.query('COMMIT');

    await logAudit({
      userId: req.user.id,
      action: 'DELEGATED_ADMIN_APPOINTED',
      module: 'admin',
      targetRecordId: newAdmin.id,
      details: { roleType, email: newAdmin.email, departmentId, customPermissions },
      ipAddress: req.ip
    });

    return res.status(201).json({
      success: true,
      message: `Delegated Administrator (${roleType}) created successfully.`,
      admin: {
        ...newAdmin,
        assignment: assignRes.rows[0]
      }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[CreateAdmin Error]:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to create delegated administrator: ' + err.message
    });
  } finally {
    client.release();
  }
};

export const listDelegatedAdmins = async (req, res) => {
  try {
    const queryStr = `
      SELECT 
        u.id, u.email, u.full_name, u.phone, u.status, u.created_at,
        aa.id as assignment_id, aa.role_type, aa.department_id, aa.scope_details, 
        aa.is_cmo, aa.is_active, aa.appointed_by,
        d.name as department_name,
        creator.full_name as appointed_by_name,
        COALESCE(
          json_agg(DISTINCT p.code) FILTER (WHERE p.code IS NOT NULL AND up.is_granted = true), '[]'
        ) as permissions
      FROM users u
      JOIN administrator_assignments aa ON u.id = aa.user_id
      LEFT JOIN departments d ON aa.department_id = d.id
      LEFT JOIN users creator ON aa.appointed_by = creator.id
      LEFT JOIN user_permissions up ON u.id = up.user_id
      LEFT JOIN permissions p ON up.permission_id = p.id
      GROUP BY u.id, u.email, u.full_name, u.phone, u.status, u.created_at,
               aa.id, aa.role_type, aa.department_id, aa.scope_details, aa.is_cmo, aa.is_active, aa.appointed_by,
               d.name, creator.full_name
      ORDER BY u.created_at DESC;
    `;
    const result = await query(queryStr);
    return res.json({ success: true, admins: result.rows });
  } catch (err) {
    console.error('[ListAdmins Error]:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch delegated administrators.' });
  }
};

export const updateAccountStatus = async (req, res) => {
  const { userId } = req.params;
  const { status } = req.body;

  if (!['active', 'suspended', 'deactivated'].includes(status)) {
    return res.status(400).json({
      success: false,
      message: "Status must be 'active', 'suspended', or 'deactivated'."
    });
  }

  // Prevent modifying Super Admin status
  const targetUser = await query('SELECT email FROM users WHERE id = $1', [userId]);
  if (targetUser.rows.length === 0) {
    return res.status(404).json({ success: false, message: 'User not found.' });
  }

  if (targetUser.rows[0].email === 'superadmin@nexcampus.edu') {
    return res.status(403).json({ success: false, message: 'Super Admin account cannot be deactivated or suspended.' });
  }

  try {
    await query(
      'UPDATE users SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [status, userId]
    );

    // If deactivating or suspending, also toggle assignment is_active
    if (status !== 'active') {
      await query('UPDATE administrator_assignments SET is_active = false WHERE user_id = $1', [userId]);
      await query('UPDATE staff_assignments SET is_active = false WHERE user_id = $1', [userId]);
    } else {
      await query('UPDATE administrator_assignments SET is_active = true WHERE user_id = $1', [userId]);
      await query('UPDATE staff_assignments SET is_active = true WHERE user_id = $1', [userId]);
    }

    await logAudit({
      userId: req.user.id,
      action: `ACCOUNT_STATUS_${status.toUpperCase()}`,
      module: 'admin',
      targetRecordId: userId,
      details: { newStatus: status, email: targetUser.rows[0].email },
      ipAddress: req.ip
    });

    return res.json({
      success: true,
      message: `Account status updated to ${status}.`
    });
  } catch (err) {
    console.error('[UpdateStatus Error]:', err);
    return res.status(500).json({ success: false, message: 'Failed to update account status.' });
  }
};

// ==========================================
// 2. COMPLAINT MANAGEMENT OFFICER (CMO)
// ==========================================

export const appointCMO = async (req, res) => {
  const {
    userId, // existing user ID to appoint OR provide new credentials below
    email,
    password,
    fullName,
    phone,
    assignedCategories = [], // array of category IDs
    assignedHostels = [],    // array of hostel names/IDs
    notes
  } = req.body;

  const client = await getClient();
  try {
    await client.query('BEGIN');

    let targetUserId = userId;

    // If appointing a new user
    if (!targetUserId) {
      if (!email || !password || !fullName) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: 'Email, password, and full name are required to create a new Complaint Officer account.'
        });
      }

      const emailCheck = await client.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [email.trim()]);
      if (emailCheck.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          success: false,
          message: 'A user with this email address already exists.'
        });
      }

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      const userRes = await client.query(
        `INSERT INTO users (email, password_hash, full_name, phone, status)
         VALUES ($1, $2, $3, $4, 'active')
         RETURNING id`,
        [email.trim().toLowerCase(), passwordHash, fullName.trim(), phone || null]
      );
      targetUserId = userRes.rows[0].id;
    }

    // Assign cmo role to user
    const cmoRoleRes = await client.query("SELECT id FROM roles WHERE name = 'cmo'");
    if (cmoRoleRes.rows.length > 0) {
      await client.query(
        `INSERT INTO user_roles (user_id, role_id)
         VALUES ($1, $2)
         ON CONFLICT (user_id, role_id) DO NOTHING`,
        [targetUserId, cmoRoleRes.rows[0].id]
      );
    }

    // Grant CMO core permissions
    const cmoPermCodes = [
      'complaint:cmo_triage',
      'complaint:cmo_verify',
      'complaint:resolve',
      'complaint:escalate',
      'notice:view'
    ];
    for (const code of cmoPermCodes) {
      const pRes = await client.query('SELECT id FROM permissions WHERE code = $1', [code]);
      if (pRes.rows.length > 0) {
        await client.query(
          `INSERT INTO user_permissions (user_id, permission_id, is_granted)
           VALUES ($1, $2, true)
           ON CONFLICT (user_id, permission_id) DO UPDATE SET is_granted = true`,
          [targetUserId, pRes.rows[0].id]
        );
      }
    }

    // Record or update administrator assignment with is_cmo = true
    const scopeDetails = {
      categories: assignedCategories,
      hostels: assignedHostels,
      notes: notes || 'Designated by Super Administrator'
    };

    const assignRes = await client.query(
      `INSERT INTO administrator_assignments (
         user_id, role_type, scope_details, is_cmo, appointed_by, is_active
       )
       VALUES ($1, 'Complaint Management Officer', $2, true, $3, true)
       RETURNING *`,
      [targetUserId, JSON.stringify(scopeDetails), req.user.id]
    );

    await client.query('COMMIT');

    await logAudit({
      userId: req.user.id,
      action: 'CMO_DESIGNATED',
      module: 'admin',
      targetRecordId: targetUserId,
      details: { scopeDetails, appointedUserId: targetUserId },
      ipAddress: req.ip
    });

    return res.status(201).json({
      success: true,
      message: 'Complaint Management Officer appointed successfully with designated scope.',
      assignment: assignRes.rows[0]
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[AppointCMO Error]:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to appoint Complaint Management Officer: ' + err.message
    });
  } finally {
    client.release();
  }
};

export const listCMOs = async (req, res) => {
  try {
    const queryStr = `
      SELECT 
        u.id, u.email, u.full_name, u.phone, u.status,
        aa.id as assignment_id, aa.scope_details, aa.is_active, aa.created_at as appointed_at,
        creator.full_name as appointed_by_name,
        (SELECT COUNT(*) FROM complaints c WHERE c.assigned_cmo_id = u.id) as total_complaints_handled
      FROM users u
      JOIN administrator_assignments aa ON u.id = aa.user_id
      LEFT JOIN users creator ON aa.appointed_by = creator.id
      WHERE aa.is_cmo = true
      ORDER BY aa.is_active DESC, aa.created_at DESC;
    `;
    const result = await query(queryStr);
    return res.json({ success: true, cmos: result.rows });
  } catch (err) {
    console.error('[ListCMOs Error]:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch Complaint Management Officers.' });
  }
};

// ==========================================
// 3. OPERATIONAL STAFF LIFECYCLE
// ==========================================

export const createStaff = async (req, res) => {
  const {
    email,
    password,
    fullName,
    phone,
    staffCategory, // 'security_guard', 'hostel_warden', 'mess_staff', 'maintenance_staff'
    designation,
    assignedArea,
    gateId // optional, if security guard
  } = req.body;

  if (!email || !password || !fullName || !staffCategory || !designation) {
    return res.status(400).json({
      success: false,
      message: 'Email, password, full name, staff category, and designation are required.'
    });
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const emailCheck = await client.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [email.trim()]);
    if (emailCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, message: 'Email address is already in use.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const userRes = await client.query(
      `INSERT INTO users (email, password_hash, full_name, phone, status)
       VALUES ($1, $2, $3, $4, 'active')
       RETURNING id, email, full_name, status`,
      [email.trim().toLowerCase(), passwordHash, fullName.trim(), phone || null]
    );
    const newStaff = userRes.rows[0];

    // Assign appropriate role
    const roleRes = await client.query('SELECT id FROM roles WHERE name = $1', [staffCategory]);
    if (roleRes.rows.length > 0) {
      await client.query(
        'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)',
        [newStaff.id, roleRes.rows[0].id]
      );
    }

    // Role-specific permission assignment
    let permCodes = [];
    if (staffCategory === 'security_guard') {
      permCodes = ['security:scan_qr', 'security:record_movement', 'security:view_exceptions'];
    } else if (['hostel_warden', 'mess_staff', 'maintenance_staff'].includes(staffCategory)) {
      permCodes = ['complaint:resolve'];
    }

    for (const code of permCodes) {
      const pRes = await client.query('SELECT id FROM permissions WHERE code = $1', [code]);
      if (pRes.rows.length > 0) {
        await client.query(
          `INSERT INTO user_permissions (user_id, permission_id, is_granted)
           VALUES ($1, $2, true)
           ON CONFLICT DO NOTHING`,
          [newStaff.id, pRes.rows[0].id]
        );
      }
    }

    // Create staff profile
    const empId = `EMP-${staffCategory.substring(0, 3).toUpperCase()}-${Date.now().toString().slice(-4)}`;
    await client.query(
      `INSERT INTO staff_profiles (user_id, employee_id, staff_category, designation, assigned_area)
       VALUES ($1, $2, $3, $4, $5)`,
      [newStaff.id, empId, staffCategory, designation, assignedArea || null]
    );

    // Record staff assignment
    const assignRes = await client.query(
      `INSERT INTO staff_assignments (user_id, staff_category, assigned_by, assigned_area, is_active)
       VALUES ($1, $2, $3, $4, true)
       RETURNING *`,
      [newStaff.id, staffCategory, req.user.id, assignedArea || null]
    );

    // If security guard with gate assigned
    if (staffCategory === 'security_guard' && gateId) {
      // Find or assign shift
      const shiftRes = await client.query('SELECT id FROM guard_shifts LIMIT 1');
      if (shiftRes.rows.length > 0) {
        await client.query(
          `INSERT INTO guard_assignments (guard_user_id, gate_id, shift_id, assigned_date)
           VALUES ($1, $2, $3, CURRENT_DATE)`,
          [newStaff.id, gateId, shiftRes.rows[0].id]
        );
      }
    }

    await client.query('COMMIT');

    await logAudit({
      userId: req.user.id,
      action: 'OPERATIONAL_STAFF_CREATED',
      module: 'admin',
      targetRecordId: newStaff.id,
      details: { staffCategory, designation, assignedArea, employeeId: empId },
      ipAddress: req.ip
    });

    return res.status(201).json({
      success: true,
      message: `${designation} account created successfully.`,
      staff: {
        ...newStaff,
        employeeId: empId,
        assignment: assignRes.rows[0]
      }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[CreateStaff Error]:', err);
    return res.status(500).json({ success: false, message: 'Failed to create staff member: ' + err.message });
  } finally {
    client.release();
  }
};

export const listStaff = async (req, res) => {
  const { category } = req.query;
  try {
    let queryStr = `
      SELECT 
        u.id, u.email, u.full_name, u.phone, u.status, u.created_at,
        sp.employee_id, sp.staff_category, sp.designation, sp.assigned_area,
        sa.is_active,
        creator.full_name as assigned_by_name
      FROM users u
      JOIN staff_profiles sp ON u.id = sp.user_id
      LEFT JOIN staff_assignments sa ON u.id = sa.user_id
      LEFT JOIN users creator ON sa.assigned_by = creator.id
    `;
    const params = [];

    if (category) {
      queryStr += ' WHERE sp.staff_category = $1';
      params.push(category);
    }

    queryStr += ' ORDER BY u.created_at DESC;';

    const result = await query(queryStr, params);
    return res.json({ success: true, staff: result.rows });
  } catch (err) {
    console.error('[ListStaff Error]:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch operational staff.' });
  }
};

// ==========================================
// 4. STUDENT & FACULTY DIRECTORY
// ==========================================

export const listStudents = async (req, res) => {
  const { search, departmentId, status, page = 1, limit = 50 } = req.query;
  try {
    let queryStr = `
      SELECT 
        u.id, u.email, u.full_name, u.phone, u.status, u.created_at,
        sp.student_id, sp.academic_year, sp.current_semester, sp.section,
        sp.hostel_name, sp.room_number, sp.guardian_name, sp.guardian_phone,
        d.name as department_name, d.code as department_code,
        c.name as course_name
      FROM users u
      JOIN student_profiles sp ON u.id = sp.user_id
      LEFT JOIN departments d ON sp.department_id = d.id
      LEFT JOIN courses c ON sp.course_id = c.id
      WHERE 1=1
    `;
    const params = [];
    let pIdx = 1;

    if (search) {
      queryStr += ` AND (u.full_name ILIKE $${pIdx} OR u.email ILIKE $${pIdx} OR sp.student_id ILIKE $${pIdx})`;
      params.push(`%${search}%`);
      pIdx++;
    }

    if (departmentId) {
      queryStr += ` AND sp.department_id = $${pIdx}`;
      params.push(departmentId);
      pIdx++;
    }

    if (status) {
      queryStr += ` AND u.status = $${pIdx}`;
      params.push(status);
      pIdx++;
    }

    queryStr += ` ORDER BY sp.student_id ASC LIMIT $${pIdx} OFFSET $${pIdx + 1};`;
    params.push(limit, (page - 1) * limit);

    const result = await query(queryStr, params);
    return res.json({ success: true, students: result.rows });
  } catch (err) {
    console.error('[ListStudents Error]:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch students directory.' });
  }
};

export const createStudent = async (req, res) => {
  const {
    studentId,
    fullName,
    email,
    password = 'Welcome@NexCampus2026!',
    phone,
    departmentId,
    courseId,
    academicYear = 1,
    currentSemester = 1,
    section = 'A',
    dateOfBirth,
    address,
    guardianName,
    guardianPhone,
    status = 'active'
  } = req.body;

  if (!studentId || !fullName || !email) {
    return res.status(400).json({
      success: false,
      message: 'Student ID, Full Name, and Institutional Email are required.'
    });
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Check duplicate email
    const emailCheck = await client.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [email.trim()]);
    if (emailCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, message: 'An account with this email address already exists.' });
    }

    // Check duplicate student ID
    const idCheck = await client.query('SELECT id FROM student_profiles WHERE LOWER(student_id) = LOWER($1)', [studentId.trim()]);
    if (idCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, message: 'A student with this Student ID already exists.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password.trim(), salt);

    const userRes = await client.query(
      `INSERT INTO users (email, password_hash, full_name, phone, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, full_name, status`,
      [email.trim().toLowerCase(), passwordHash, fullName.trim(), phone || null, status || 'active']
    );
    const userId = userRes.rows[0].id;

    // Assign student role
    const roleRes = await client.query("SELECT id FROM roles WHERE name = 'student'");
    if (roleRes.rows.length > 0) {
      await client.query('INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [userId, roleRes.rows[0].id]);
    }

    // Create student profile
    const profileRes = await client.query(
      `INSERT INTO student_profiles (
         user_id, student_id, department_id, course_id, academic_year, current_semester,
         section, guardian_name, guardian_phone, phone, address, date_of_birth, status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        userId, studentId.trim().toUpperCase(), departmentId || null, courseId || null,
        Number(academicYear) || 1, Number(currentSemester) || 1, section || 'A',
        guardianName || null, guardianPhone || null, phone || null, address || null,
        dateOfBirth || null, status || 'active'
      ]
    );

    await logAudit({
      actorId: req.user.id,
      action: 'ADMIN_CREATE_STUDENT',
      targetType: 'student',
      targetId: userId,
      details: { studentId, fullName, email }
    });

    await client.query('COMMIT');
    return res.status(201).json({
      success: true,
      message: `Student account for ${fullName} (${studentId}) created successfully.`,
      student: { ...userRes.rows[0], ...profileRes.rows[0] }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[CreateStudent Error]:', err);
    return res.status(500).json({ success: false, message: 'Failed to create student account.' });
  } finally {
    client.release();
  }
};

export const updateStudent = async (req, res) => {
  const { id } = req.params;
  const {
    fullName,
    phone,
    departmentId,
    courseId,
    academicYear,
    currentSemester,
    section,
    address,
    dateOfBirth,
    guardianName,
    guardianPhone,
    status
  } = req.body;

  const client = await getClient();
  try {
    await client.query('BEGIN');

    if (fullName || phone || status) {
      await client.query(
        `UPDATE users SET
           full_name = COALESCE($1, full_name),
           phone = COALESCE($2, phone),
           status = COALESCE($3, status),
           updated_at = NOW()
         WHERE id = $4`,
        [fullName || null, phone || null, status || null, id]
      );
    }

    await client.query(
      `UPDATE student_profiles SET
         department_id = COALESCE($1, department_id),
         course_id = COALESCE($2, course_id),
         academic_year = COALESCE($3, academic_year),
         current_semester = COALESCE($4, current_semester),
         section = COALESCE($5, section),
         address = COALESCE($6, address),
         date_of_birth = COALESCE($7, date_of_birth),
         guardian_name = COALESCE($8, guardian_name),
         guardian_phone = COALESCE($9, guardian_phone),
         phone = COALESCE($10, phone),
         status = COALESCE($11, status),
         updated_at = NOW()
       WHERE user_id = $12`,
      [
        departmentId || null, courseId || null,
        academicYear ? Number(academicYear) : null,
        currentSemester ? Number(currentSemester) : null,
        section || null, address || null, dateOfBirth || null,
        guardianName || null, guardianPhone || null, phone || null,
        status || null, id
      ]
    );

    await logAudit({
      actorId: req.user.id,
      action: 'ADMIN_UPDATE_STUDENT',
      targetType: 'student',
      targetId: id,
      details: { fullName, status }
    });

    await client.query('COMMIT');
    return res.json({ success: true, message: 'Student record updated successfully.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[UpdateStudent Error]:', err);
    return res.status(500).json({ success: false, message: 'Failed to update student.' });
  } finally {
    client.release();
  }
};

export const resetStudentPassword = async (req, res) => {
  const { id } = req.params;
  const { newPassword = 'Welcome@NexCampus2026!' } = req.body;

  try {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(newPassword.trim(), salt);

    await query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [hash, id]);

    await logAudit({
      actorId: req.user.id,
      action: 'ADMIN_RESET_PASSWORD',
      targetType: 'user',
      targetId: id,
      details: { target: id }
    });

    return res.json({ success: true, message: 'Password reset successfully.' });
  } catch (err) {
    console.error('[ResetPassword Error]:', err);
    return res.status(500).json({ success: false, message: 'Failed to reset password.' });
  }
};

export const getStudentFullDetails = async (req, res) => {
  const { id } = req.params;
  try {
    const [userRes, invoicesRes, paymentsRes, achievementsRes] = await Promise.all([
      query(
        `SELECT u.id, u.email, u.full_name, u.phone, u.status, u.created_at,
                sp.student_id, sp.academic_year, sp.current_semester, sp.section,
                sp.address, sp.date_of_birth, sp.blood_group, sp.emergency_contact_name,
                sp.emergency_contact_phone, sp.guardian_name, sp.guardian_phone,
                d.name AS department_name, c.name AS course_name
         FROM users u
         LEFT JOIN student_profiles sp ON sp.user_id = u.id
         LEFT JOIN departments d ON sp.department_id = d.id
         LEFT JOIN courses c ON sp.course_id = c.id
         WHERE u.id = $1`,
        [id]
      ),
      query(
        `SELECT fi.*, fc.name AS category_name, fs.academic_year
         FROM fee_invoices fi
         JOIN fee_structures fs ON fs.id = fi.fee_structure_id
         JOIN fee_categories fc ON fc.id = fs.category_id
         WHERE fi.student_id = $1
         ORDER BY fi.created_at DESC`,
        [id]
      ),
      query(
        `SELECT pr.*, fc.name AS category_name, fi.invoice_number
         FROM payment_receipts pr
         JOIN fee_invoices fi ON fi.id = pr.invoice_id
         JOIN fee_structures fs ON fs.id = fi.fee_structure_id
         JOIN fee_categories fc ON fc.id = fs.category_id
         WHERE pr.student_id = $1
         ORDER BY pr.generated_at DESC`,
        [id]
      ),
      query(
        `SELECT * FROM student_achievements WHERE student_id = $1 ORDER BY achievement_date DESC`,
        [id]
      )
    ]);

    if (!userRes.rows.length) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }

    const payload = {
      student: userRes.rows[0],
      invoices: invoicesRes.rows,
      receipts: paymentsRes.rows,
      achievements: achievementsRes.rows
    };

    return res.json({
      success: true,
      data: payload,
      ...payload
    });
  } catch (err) {
    console.error('[GetStudentFullDetails Error]:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch student details.' });
  }
};

export const createFaculty = async (req, res) => {
  const {
    email,
    password,
    fullName,
    phone,
    employeeId,
    departmentId,
    designation,
    specialization,
    cabinNumber
  } = req.body;

  if (!email || !password || !fullName || !employeeId || !designation) {
    return res.status(400).json({
      success: false,
      message: 'Email, password, full name, employee ID, and designation are required.'
    });
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const emailCheck = await client.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [email.trim()]);
    if (emailCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, message: 'Email address already exists.' });
    }

    const empIdCheck = await client.query('SELECT id FROM faculty_profiles WHERE employee_id = $1', [employeeId.trim()]);
    if (empIdCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, message: 'Faculty Employee ID already registered.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const userRes = await client.query(
      `INSERT INTO users (email, password_hash, full_name, phone, status)
       VALUES ($1, $2, $3, $4, 'active')
       RETURNING id, email, full_name, status`,
      [email.trim().toLowerCase(), passwordHash, fullName.trim(), phone || null]
    );
    const newFaculty = userRes.rows[0];

    // Assign faculty role
    const roleRes = await client.query("SELECT id FROM roles WHERE name = 'faculty'");
    if (roleRes.rows.length > 0) {
      await client.query(
        'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)',
        [newFaculty.id, roleRes.rows[0].id]
      );
    }

    // Grant default faculty permissions
    const facultyPerms = ['attendance:mark', 'leave:approve', 'academic:manage_timetables', 'notice:publish', 'notice:view'];
    for (const code of facultyPerms) {
      const pRes = await client.query('SELECT id FROM permissions WHERE code = $1', [code]);
      if (pRes.rows.length > 0) {
        await client.query(
          `INSERT INTO user_permissions (user_id, permission_id, is_granted)
           VALUES ($1, $2, true)
           ON CONFLICT DO NOTHING`,
          [newFaculty.id, pRes.rows[0].id]
        );
      }
    }

    // Create faculty profile
    const profileRes = await client.query(
      `INSERT INTO faculty_profiles (
         user_id, employee_id, department_id, designation, specialization, cabin_number
       )
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        newFaculty.id,
        employeeId.trim(),
        departmentId || null,
        designation.trim(),
        specialization || null,
        cabinNumber || null
      ]
    );

    await client.query('COMMIT');

    await logAudit({
      userId: req.user.id,
      action: 'FACULTY_CREATED',
      module: 'admin',
      targetRecordId: newFaculty.id,
      details: { employeeId, designation, departmentId },
      ipAddress: req.ip
    });

    return res.status(201).json({
      success: true,
      message: 'Faculty member created successfully.',
      faculty: {
        ...newFaculty,
        profile: profileRes.rows[0]
      }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[CreateFaculty Error]:', err);
    return res.status(500).json({ success: false, message: 'Failed to create faculty: ' + err.message });
  } finally {
    client.release();
  }
};

export const listFaculty = async (req, res) => {
  const { departmentId } = req.query;
  try {
    let queryStr = `
      SELECT 
        u.id, u.email, u.full_name, u.phone, u.status, u.created_at,
        fp.employee_id, fp.designation, fp.specialization, fp.cabin_number,
        d.name as department_name, d.code as department_code
      FROM users u
      JOIN faculty_profiles fp ON u.id = fp.user_id
      LEFT JOIN departments d ON fp.department_id = d.id
    `;
    const params = [];
    if (departmentId) {
      queryStr += ' WHERE fp.department_id = $1';
      params.push(departmentId);
    }
    queryStr += ' ORDER BY u.full_name ASC;';

    const result = await query(queryStr, params);
    return res.json({ success: true, faculty: result.rows });
  } catch (err) {
    console.error('[ListFaculty Error]:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch faculty list.' });
  }
};

// ==========================================
// 5. AUDIT LOG VIEWER
// ==========================================

export const getAuditLogs = async (req, res) => {
  const { module, action, search, limit = 50, page = 1 } = req.query;
  try {
    let queryStr = `
      SELECT 
        al.id, al.action, al.module, al.target_record_id, al.details, al.ip_address, al.created_at,
        u.email as actor_email, u.full_name as actor_name
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE 1=1
    `;
    const params = [];
    let pIdx = 1;

    if (module) {
      queryStr += ` AND al.module = $${pIdx}`;
      params.push(module);
      pIdx++;
    }

    if (action) {
      queryStr += ` AND al.action ILIKE $${pIdx}`;
      params.push(`%${action}%`);
      pIdx++;
    }

    if (search) {
      queryStr += ` AND (al.action ILIKE $${pIdx} OR u.email ILIKE $${pIdx} OR u.full_name ILIKE $${pIdx})`;
      params.push(`%${search}%`);
      pIdx++;
    }

    queryStr += ` ORDER BY al.created_at DESC LIMIT $${pIdx} OFFSET $${pIdx + 1};`;
    params.push(limit, (page - 1) * limit);

    const result = await query(queryStr, params);
    return res.json({ success: true, logs: result.rows });
  } catch (err) {
    console.error('[GetAuditLogs Error]:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch audit logs.' });
  }
};

// ==========================================
// 6. SYSTEM REFERENCE DATA
// ==========================================

export const getSystemReferenceData = async (req, res) => {
  try {
    const departments = await query('SELECT * FROM departments ORDER BY name ASC');
    const categories = await query('SELECT * FROM complaint_categories ORDER BY name ASC');
    const gates = await query('SELECT * FROM gates ORDER BY gate_number ASC');
    const permissions = await query('SELECT * FROM permissions ORDER BY module ASC, code ASC');
    const roles = await query('SELECT * FROM roles ORDER BY name ASC');

    return res.json({
      success: true,
      data: {
        departments: departments.rows,
        complaintCategories: categories.rows,
        gates: gates.rows,
        permissions: permissions.rows,
        roles: roles.rows
      }
    });
  } catch (err) {
    console.error('[GetRefData Error]:', err);
    return res.status(500).json({ success: false, message: 'Failed to load reference data.' });
  }
};

// ==========================================
// 7. DASHBOARD SYSTEM ANALYTICS
// ==========================================

export const getDashboardMetrics = async (req, res) => {
  try {
    const [
      studentsRes,
      facultyRes,
      staffRes,
      adminsRes,
      gatePassesRes,
      movementsRes,
      complaintsRes,
      feesRes,
      noticesRes
    ] = await Promise.all([
      query("SELECT COUNT(*) FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE r.name = 'student'"),
      query("SELECT COUNT(*) FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE r.name = 'faculty'"),
      query("SELECT COUNT(*) FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE r.name IN ('hostel_warden','mess_staff','maintenance_staff','security_guard')"),
      query("SELECT COUNT(*) FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE r.name IN ('super_admin','delegated_admin')"),
      query("SELECT COUNT(*) FILTER (WHERE status = 'approved') AS active, COUNT(*) FILTER (WHERE status = 'pending') AS pending FROM gate_passes"),
      query("SELECT COUNT(*) FROM gate_movements WHERE recorded_at >= CURRENT_DATE"),
      query("SELECT COUNT(*) FILTER (WHERE status = 'open') AS open, COUNT(*) FILTER (WHERE priority = 'critical') AS critical, COUNT(*) FILTER (WHERE status = 'resolved') AS resolved FROM complaints"),
      query("SELECT COALESCE(SUM(amount_paid), 0) AS collected, COALESCE(SUM(amount_due - COALESCE(amount_paid, 0)), 0) AS outstanding FROM fee_invoices WHERE status != 'cancelled'"),
      query("SELECT COUNT(*) FROM notices WHERE status = 'published' AND (expires_at IS NULL OR expires_at > NOW())")
    ]);

    return res.json({
      success: true,
      metrics: {
        totalStudents: Number(studentsRes.rows[0]?.count || 0),
        totalFaculty: Number(facultyRes.rows[0]?.count || 0),
        totalStaff: Number(staffRes.rows[0]?.count || 0),
        totalAdmins: Number(adminsRes.rows[0]?.count || 0),
        gatePasses: gatePassesRes.rows[0] || { active: 0, pending: 0 },
        movementsToday: Number(movementsRes.rows[0]?.count || 0),
        complaints: complaintsRes.rows[0] || { open: 0, critical: 0, resolved: 0 },
        fees: feesRes.rows[0] || { collected: 0, outstanding: 0 },
        activeNotices: Number(noticesRes.rows[0]?.count || 0)
      }
    });
  } catch (err) {
    console.error('[GetDashboardMetrics Error]:', err);
    return res.status(500).json({ success: false, message: 'Failed to load metrics.' });
  }
};

