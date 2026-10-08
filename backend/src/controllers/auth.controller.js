import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query, getClient } from '../config/db.js';
import { logAudit } from '../utils/auditLogger.js';

export const login = async (req, res) => {
  const identifier = (req.body.email || req.body.identifier || req.body.studentId || '').trim();
  const password = (req.body.password || '').trim();

  if (!identifier || !password) {
    return res.status(400).json({
      success: false,
      message: 'Please provide your Institutional Email / Student ID and password.'
    });
  }

  try {
    const userResult = await query(
      `SELECT u.id, u.email, u.password_hash, u.full_name, u.phone, u.status, u.preferred_language 
       FROM users u 
       LEFT JOIN student_profiles sp ON sp.user_id = u.id
       WHERE LOWER(u.email) = LOWER($1) OR LOWER(sp.student_id) = LOWER($1)`,
      [identifier]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid Institutional Email, Student ID, or password.'
      });
    }

    const user = userResult.rows[0];

    // Status checks
    if (user.status === 'suspended') {
      return res.status(403).json({
        success: false,
        message: 'Your account has been suspended by administration.'
      });
    }

    if (user.status === 'deactivated') {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated.'
      });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password credentials.'
      });
    }

    // Retrieve Roles
    const rolesRes = await query(
      `SELECT r.name, r.display_name 
       FROM user_roles ur
       JOIN roles r ON ur.role_id = r.id
       WHERE ur.user_id = $1`,
      [user.id]
    );
    const roles = rolesRes.rows.map(r => r.name);

    // Retrieve Permissions
    const rolePermissionsRes = await query(
      `SELECT DISTINCT p.code 
       FROM user_roles ur
       JOIN role_permissions rp ON ur.role_id = rp.role_id
       JOIN permissions p ON rp.permission_id = p.id
       WHERE ur.user_id = $1`,
      [user.id]
    );
    const rolePerms = rolePermissionsRes.rows.map(p => p.code);

    const userPermsRes = await query(
      `SELECT p.code, up.is_granted 
       FROM user_permissions up
       JOIN permissions p ON up.permission_id = p.id
       WHERE up.user_id = $1`,
      [user.id]
    );

    const permSet = new Set(rolePerms);
    for (const up of userPermsRes.rows) {
      if (up.is_granted) permSet.add(up.code);
      else permSet.delete(up.code);
    }

    // Check specific profile records
    let profile = null;
    let studentProfile = null;
    let facultyProfile = null;
    let staffProfile = null;

    if (roles.includes('student')) {
      const sp = await query('SELECT * FROM student_profiles WHERE user_id = $1', [user.id]);
      if (sp.rows.length > 0) studentProfile = sp.rows[0];
      profile = studentProfile;
    } else if (roles.includes('faculty')) {
      const fp = await query('SELECT * FROM faculty_profiles WHERE user_id = $1', [user.id]);
      if (fp.rows.length > 0) facultyProfile = fp.rows[0];
      profile = facultyProfile;
    } else {
      const stp = await query('SELECT * FROM staff_profiles WHERE user_id = $1', [user.id]);
      if (stp.rows.length > 0) staffProfile = stp.rows[0];
      profile = staffProfile;
    }

    // Check Admin / CMO Assignment
    const adminAssignmentRes = await query(
      'SELECT * FROM administrator_assignments WHERE user_id = $1 AND is_active = true',
      [user.id]
    );
    const adminAssignment = adminAssignmentRes.rows[0] || null;

    // Issue JWT
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        roles
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Audit log
    await logAudit({
      userId: user.id,
      action: 'USER_LOGIN',
      module: 'auth',
      targetRecordId: user.id,
      details: { email: user.email, roles },
      ipAddress: req.ip
    });

    return res.json({
      success: true,
      message: 'Login successful.',
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        phone: user.phone,
        status: user.status,
        roles,
        permissions: Array.from(permSet),
        profile,
        adminAssignment,
        isSuperAdmin: roles.includes('super_admin'),
        isCMO: roles.includes('cmo') || (adminAssignment && adminAssignment.is_cmo),
        preferredLanguage: user.preferred_language || 'en'
      }
    });
  } catch (err) {
    console.error('[Login Error]:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error during login processing.'
    });
  }
};

export const registerStudent = async (req, res) => {
  const {
    email,
    password,
    fullName,
    phone,
    studentId,
    departmentId,
    courseId,
    academicYear = 1,
    currentSemester = 1,
    section = 'A',
    hostelName,
    roomNumber,
    guardianName,
    guardianPhone
  } = req.body;

  // Check if self-registration is blocked
  const isSuperAdmin = req.user?.isSuperAdmin;
  const isDelegatedAdmin = req.user?.roles?.includes('delegated_admin');
  if (!isSuperAdmin && !isDelegatedAdmin) {
    return res.status(403).json({
      success: false,
      message: 'Student self-registration is disabled. All student accounts must be provisioned by Campus Administration / Student Affairs.'
    });
  }

  if (!email || !password || !fullName || !studentId) {
    return res.status(400).json({
      success: false,
      message: 'Email, password, full name, and Student ID are required.'
    });
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    // 1. Check existing email
    const emailCheck = await client.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [email.trim()]);
    if (emailCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        message: 'An account with this email address already exists.'
      });
    }

    // 2. Check existing student ID
    const studentIdCheck = await client.query('SELECT id FROM student_profiles WHERE student_id = $1', [studentId.trim()]);
    if (studentIdCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        message: `Student ID "${studentId}" is already registered in the system.`
      });
    }

    // 3. Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // 4. Create user
    const userRes = await client.query(
      `INSERT INTO users (email, password_hash, full_name, phone, status)
       VALUES ($1, $2, $3, $4, 'active')
       RETURNING id, email, full_name, phone, status`,
      [email.trim().toLowerCase(), passwordHash, fullName.trim(), phone || null]
    );
    const newUser = userRes.rows[0];

    // 5. Assign student role
    const roleRes = await client.query("SELECT id FROM roles WHERE name = 'student'");
    if (roleRes.rows.length > 0) {
      await client.query(
        'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)',
        [newUser.id, roleRes.rows[0].id]
      );
    }

    // 6. Create student profile
    const profileRes = await client.query(
      `INSERT INTO student_profiles (
         user_id, student_id, department_id, course_id, academic_year, 
         current_semester, section, hostel_name, room_number, guardian_name, guardian_phone
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        newUser.id,
        studentId.trim(),
        departmentId || null,
        courseId || null,
        academicYear,
        currentSemester,
        section,
        hostelName || null,
        roomNumber || null,
        guardianName || null,
        guardianPhone || null
      ]
    );

    await client.query('COMMIT');

    // Audit log
    await logAudit({
      userId: newUser.id,
      action: 'STUDENT_REGISTERED',
      module: 'auth',
      targetRecordId: newUser.id,
      details: { email: newUser.email, studentId: studentId.trim() },
      ipAddress: req.ip
    });

    // Issue JWT
    const token = jwt.sign(
      {
        userId: newUser.id,
        email: newUser.email,
        roles: ['student']
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    return res.status(201).json({
      success: true,
      message: 'Student account registered successfully.',
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        fullName: newUser.full_name,
        phone: newUser.phone,
        status: newUser.status,
        roles: ['student'],
        permissions: ['leave:apply', 'gatepass:apply', 'complaint:submit', 'fee:pay_online', 'notice:view'],
        profile: profileRes.rows[0],
        isSuperAdmin: false,
        isCMO: false
      }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Student Registration Error]:', err);
    return res.status(500).json({
      success: false,
      message: 'Registration transaction failed: ' + err.message
    });
  } finally {
    client.release();
  }
};

export const getMe = async (req, res) => {
  try {
    const user = req.user;

    // Fetch detailed profile
    let profile = null;
    if (user.roles.includes('student')) {
      const sp = await query(
        `SELECT sp.*, d.name as department_name, c.name as course_name 
         FROM student_profiles sp
         LEFT JOIN departments d ON sp.department_id = d.id
         LEFT JOIN courses c ON sp.course_id = c.id
         WHERE sp.user_id = $1`,
        [user.id]
      );
      if (sp.rows.length > 0) profile = sp.rows[0];
    } else if (user.roles.includes('faculty')) {
      const fp = await query(
        `SELECT fp.*, d.name as department_name 
         FROM faculty_profiles fp
         LEFT JOIN departments d ON fp.department_id = d.id
         WHERE fp.user_id = $1`,
        [user.id]
      );
      if (fp.rows.length > 0) profile = fp.rows[0];
    } else {
      const stp = await query('SELECT * FROM staff_profiles WHERE user_id = $1', [user.id]);
      if (stp.rows.length > 0) profile = stp.rows[0];
    }

    return res.json({
      success: true,
      user: {
        ...user,
        profile
      }
    });
  } catch (err) {
    console.error('[GetMe Error]:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve current user profile.'
    });
  }
};

export const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({
      success: false,
      message: 'Please provide both current and new passwords.'
    });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({
      success: false,
      message: 'New password must be at least 8 characters in length.'
    });
  }

  try {
    const userRes = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    const user = userRes.rows[0];

    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'The current password you entered is incorrect.'
      });
    }

    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(newPassword, salt);

    await query(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [newHash, req.user.id]
    );

    await logAudit({
      userId: req.user.id,
      action: 'PASSWORD_CHANGED',
      module: 'auth',
      targetRecordId: req.user.id,
      ipAddress: req.ip
    });

    return res.json({
      success: true,
      message: 'Password has been updated successfully.'
    });
  } catch (err) {
    console.error('[ChangePassword Error]:', err);
    return res.status(500).json({
      success: false,
      message: 'Error updating password.'
    });
  }
};

export const updateLanguagePreference = async (req, res) => {
  const { language } = req.body;
  const validLanguages = ['en', 'hi', 'or', 'te'];
  const lang = validLanguages.includes(language) ? language : 'en';

  try {
    await query(
      'UPDATE users SET preferred_language = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [lang, req.user.id]
    );

    await logAudit({
      userId: req.user.id,
      action: 'LANGUAGE_PREFERENCE_UPDATED',
      module: 'auth',
      targetRecordId: req.user.id,
      details: { preferredLanguage: lang },
      ipAddress: req.ip
    });

    return res.json({
      success: true,
      message: 'Language preference updated successfully.',
      preferredLanguage: lang
    });
  } catch (err) {
    console.error('[UpdateLanguage Error]:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to update language preference.'
    });
  }
};

