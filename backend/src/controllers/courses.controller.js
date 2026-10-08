import pool from '../config/db.js';
import { logAudit } from '../utils/auditLogger.js';

// Authority role helper
const isCourseAuthority = (user) => {
  if (!user || !user.roles) return false;
  return (
    user.isSuperAdmin ||
    user.roles.includes('super_admin') ||
    user.roles.includes('delegated_admin') ||
    user.roles.includes('course_manager') ||
    user.roles.includes('admin')
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. LIST COURSES (Public / Student vs Authority Mode)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * GET /api/courses
 * Students / public: only returns status = 'PUBLISHED' and is_active = true
 * Authorities: returns all courses with optional status filtering
 */
export const listCourses = async (req, res) => {
  try {
    const isAuthUser = req.user ? isCourseAuthority(req.user) : false;
    const studentId = (req.user && req.user.roles?.includes('student')) ? req.user.id : null;

    const {
      q,
      department_id,
      category,
      course_type,
      status,
      price_min,
      price_max,
      availability
    } = req.query;

    const conditions = [];
    const params = [];

    // Access control: non-authorities can ONLY see published and active courses
    if (!isAuthUser) {
      conditions.push(`c.status = 'PUBLISHED'`);
      conditions.push(`c.is_active = true`);
    } else if (status && status !== 'ALL') {
      params.push(status.toUpperCase());
      conditions.push(`c.status = $${params.length}`);
    }

    // Keyword search: name, code, short_description, description, category, instructor
    if (q && q.trim()) {
      params.push(`%${q.trim()}%`);
      const pIdx = params.length;
      conditions.push(`(
        c.name ILIKE $${pIdx} OR 
        c.code ILIKE $${pIdx} OR 
        c.short_description ILIKE $${pIdx} OR 
        c.description ILIKE $${pIdx} OR 
        c.category ILIKE $${pIdx} OR
        c.instructor_name ILIKE $${pIdx} OR
        d.name ILIKE $${pIdx}
      )`);
    }

    // Department filter
    if (department_id) {
      params.push(department_id);
      conditions.push(`c.department_id = $${params.length}`);
    }

    // Category filter
    if (category && category !== 'ALL') {
      params.push(category);
      conditions.push(`c.category ILIKE $${params.length}`);
    }

    // Course type filter
    if (course_type && course_type !== 'ALL') {
      params.push(course_type);
      conditions.push(`c.course_type ILIKE $${params.length}`);
    }

    // Price range filters
    if (price_min !== undefined && price_min !== '') {
      params.push(parseFloat(price_min));
      conditions.push(`c.price >= $${params.length}`);
    }
    if (price_max !== undefined && price_max !== '') {
      params.push(parseFloat(price_max));
      conditions.push(`c.price <= $${params.length}`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    // Student enrollment param
    let studentEnrollSelect = `false AS is_enrolled, NULL AS receipt_number, NULL AS enrollment_id, 0 AS my_progress`;
    if (studentId) {
      params.push(studentId);
      const sIdx = params.length;
      studentEnrollSelect = `
        (
          EXISTS (
            SELECT 1 FROM course_enrollments ce 
            WHERE ce.course_id = c.id AND ce.student_id = $${sIdx} AND ce.status IN ('active', 'completed')
          ) OR EXISTS (
            SELECT 1 FROM payments p 
            WHERE p.course_id = c.id AND p.student_id = $${sIdx} AND (UPPER(p.status) IN ('SUCCESS', 'CAPTURED', 'PAID'))
          )
        ) AS is_enrolled,
        (
          SELECT pr.receipt_number FROM payment_receipts pr
          WHERE pr.course_id = c.id AND pr.student_id = $${sIdx}
          ORDER BY pr.generated_at DESC NULLS LAST LIMIT 1
        ) AS receipt_number,
        (
          SELECT ce.id FROM course_enrollments ce
          WHERE ce.course_id = c.id AND ce.student_id = $${sIdx}
          LIMIT 1
        ) AS enrollment_id,
        COALESCE(
          (
            SELECT ce.progress FROM course_enrollments ce
            WHERE ce.course_id = c.id AND ce.student_id = $${sIdx}
            LIMIT 1
          ),
          0
        ) AS my_progress
      `;
    }

    const queryText = `
      SELECT 
        c.*,
        d.name AS department_name,
        d.code AS department_code,
        COALESCE(
          (SELECT COUNT(*) FROM course_enrollments ce WHERE ce.course_id = c.id AND ce.status = 'active'),
          0
        ) AS enrolled_count,
        COALESCE(
          (SELECT COUNT(*) FROM course_modules cm WHERE cm.course_id = c.id),
          0
        ) AS modules_count,
        ${studentEnrollSelect}
      FROM courses c
      LEFT JOIN departments d ON d.id = c.department_id
      ${whereClause}
      ORDER BY 
        CASE WHEN c.status = 'PUBLISHED' THEN 1 WHEN c.status = 'DRAFT' THEN 2 ELSE 3 END,
        c.created_at DESC
    `;

    const { rows } = await pool.query(queryText, params);

    // Filter by availability post-query if requested
    let filteredCourses = rows.map(c => {
      const maxSeats = c.max_seats || 120;
      const enrolled = parseInt(c.enrolled_count || 0);
      const isFull = enrolled >= maxSeats;
      return {
        ...c,
        is_full: isFull,
        available_seats: Math.max(0, maxSeats - enrolled)
      };
    });

    if (availability === 'available') {
      filteredCourses = filteredCourses.filter(c => !c.is_enrolled && !c.is_full);
    } else if (availability === 'enrolled') {
      filteredCourses = filteredCourses.filter(c => c.is_enrolled);
    } else if (availability === 'full') {
      filteredCourses = filteredCourses.filter(c => c.is_full);
    }

    return res.json({
      success: true,
      count: filteredCourses.length,
      courses: filteredCourses
    });
  } catch (err) {
    console.error('[courses] listCourses error:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve courses: ' + err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. GET COURSE DETAILS
// ─────────────────────────────────────────────────────────────────────────────
/**
 * GET /api/courses/:id
 * Complete course information including modules and student enrollment status
 */
export const getCourseDetails = async (req, res) => {
  const { id } = req.params;
  try {
    const isAuthUser = req.user ? isCourseAuthority(req.user) : false;
    const studentId = (req.user && req.user.roles?.includes('student')) ? req.user.id : null;

    const courseRes = await pool.query(`
      SELECT 
        c.*,
        d.name AS department_name,
        d.code AS department_code,
        u.full_name AS creator_name,
        COALESCE(
          (SELECT COUNT(*) FROM course_enrollments ce WHERE ce.course_id = c.id AND ce.status = 'active'),
          0
        ) AS enrolled_count
      FROM courses c
      LEFT JOIN departments d ON d.id = c.department_id
      LEFT JOIN users u ON u.id = c.created_by
      WHERE c.id = $1
    `, [id]);

    if (!courseRes.rows.length) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    const course = courseRes.rows[0];

    // Check enrollment for student
    let isEnrolled = false;
    let enrollment = null;
    let receiptNumber = null;

    if (studentId) {
      const enrollRes = await pool.query(`
        SELECT ce.*, pr.receipt_number, pr.amount AS amount_paid
        FROM course_enrollments ce
        LEFT JOIN payment_receipts pr ON pr.course_id = ce.course_id AND pr.student_id = ce.student_id
        WHERE ce.course_id = $1 AND ce.student_id = $2
        ORDER BY ce.enrolled_at DESC LIMIT 1
      `, [id, studentId]);

      if (enrollRes.rows.length) {
        isEnrolled = true;
        enrollment = enrollRes.rows[0];
        receiptNumber = enrollRes.rows[0].receipt_number;
      }
    }

    // Access control: if course is draft/archived/unpublished and user is not authority and not enrolled
    if (!isAuthUser && !isEnrolled) {
      if (course.status !== 'PUBLISHED' || !course.is_active) {
        return res.status(403).json({
          success: false,
          message: 'This course is currently unavailable or not published.'
        });
      }
    }

    // Fetch curriculum modules
    const modulesRes = await pool.query(`
      SELECT * FROM course_modules
      WHERE course_id = $1
      ORDER BY module_order ASC, created_at ASC
    `, [id]);

    const maxSeats = course.max_seats || 120;
    const enrolled = parseInt(course.enrolled_count || 0);
    const isFull = enrolled >= maxSeats;

    return res.json({
      success: true,
      course: {
        ...course,
        is_full: isFull,
        available_seats: Math.max(0, maxSeats - enrolled),
        is_enrolled: isEnrolled,
        receipt_number: receiptNumber,
        enrollment,
        modules: modulesRes.rows
      }
    });
  } catch (err) {
    console.error('[courses] getCourseDetails error:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve course details: ' + err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. COURSE DASHBOARD / AUTHORITY STATISTICS
// ─────────────────────────────────────────────────────────────────────────────
/**
 * GET /api/courses/stats
 * Authority-only metrics overview
 */
export const getCourseStats = async (req, res) => {
  try {
    const statsQuery = `
      SELECT
        COUNT(*) AS total_courses,
        COUNT(*) FILTER (WHERE status = 'PUBLISHED' AND is_active = true) AS published_courses,
        COUNT(*) FILTER (WHERE status = 'DRAFT') AS draft_courses,
        COUNT(*) FILTER (WHERE status = 'UNPUBLISHED') AS unpublished_courses,
        COUNT(*) FILTER (WHERE status = 'ARCHIVED' OR is_active = false) AS archived_courses,
        (SELECT COUNT(*) FROM course_enrollments WHERE status = 'active') AS total_enrollments,
        (
          SELECT COALESCE(SUM(amount), 0.00) 
          FROM payments 
          WHERE course_id IS NOT NULL AND (UPPER(status) IN ('SUCCESS', 'CAPTURED', 'PAID'))
        ) AS total_course_revenue
      FROM courses;
    `;

    const { rows } = await pool.query(statsQuery);
    return res.json({
      success: true,
      stats: {
        total_courses: parseInt(rows[0].total_courses || 0),
        published_courses: parseInt(rows[0].published_courses || 0),
        draft_courses: parseInt(rows[0].draft_courses || 0),
        unpublished_courses: parseInt(rows[0].unpublished_courses || 0),
        archived_courses: parseInt(rows[0].archived_courses || 0),
        total_enrollments: parseInt(rows[0].total_enrollments || 0),
        total_course_revenue: parseFloat(rows[0].total_course_revenue || 0)
      }
    });
  } catch (err) {
    console.error('[courses] getCourseStats error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch course statistics: ' + err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. STUDENT "MY LEARNING"
// ─────────────────────────────────────────────────────────────────────────────
/**
 * GET /api/courses/my-learning
 * Returns courses the student is actively enrolled in
 */
export const getMyLearning = async (req, res) => {
  try {
    const studentId = req.user.id;

    const { rows } = await pool.query(`
      SELECT 
        ce.id AS enrollment_id,
        ce.status AS enrollment_status,
        ce.progress,
        ce.enrolled_at,
        ce.completed_at,
        ce.last_accessed_at,
        ce.course_fee_at_enrollment,
        c.id AS course_id,
        c.name AS course_name,
        c.code AS course_code,
        c.description,
        c.short_description,
        c.category,
        c.course_type,
        c.duration,
        c.instructor_name,
        c.image_url,
        c.status AS course_status,
        d.name AS department_name,
        pr.receipt_number,
        pr.amount AS receipt_amount,
        p.transaction_reference,
        p.paid_at,
        p.status AS payment_status,
        COALESCE(
          (SELECT COUNT(*) FROM course_modules cm WHERE cm.course_id = c.id),
          0
        ) AS total_modules
      FROM course_enrollments ce
      JOIN courses c ON c.id = ce.course_id
      LEFT JOIN departments d ON d.id = c.department_id
      LEFT JOIN payments p ON p.id = ce.payment_id OR (p.course_id = c.id AND p.student_id = ce.student_id AND (UPPER(p.status) IN ('SUCCESS', 'CAPTURED', 'PAID')))
      LEFT JOIN payment_receipts pr ON pr.course_id = c.id AND pr.student_id = ce.student_id
      WHERE ce.student_id = $1
      ORDER BY ce.enrolled_at DESC
    `, [studentId]);

    return res.json({
      success: true,
      count: rows.length,
      learning: rows
    });
  } catch (err) {
    console.error('[courses] getMyLearning error:', err);
    return res.status(500).json({ success: false, message: 'Failed to load My Learning courses: ' + err.message });
  }
};

/**
 * PATCH /api/courses/my-learning/:courseId/progress
 * Update learning progress (0 - 100%)
 */
export const updateLearningProgress = async (req, res) => {
  const { courseId } = req.params;
  const { progress } = req.body;

  if (progress === undefined || progress < 0 || progress > 100) {
    return res.status(400).json({ success: false, message: 'Valid progress percentage (0 - 100) is required.' });
  }

  try {
    const studentId = req.user.id;
    const isCompleted = Number(progress) === 100;

    const { rows } = await pool.query(`
      UPDATE course_enrollments
      SET progress = $1,
          status = CASE WHEN $2 = true THEN 'completed' ELSE 'active' END,
          completed_at = CASE WHEN $2 = true AND completed_at IS NULL THEN NOW() ELSE completed_at END,
          last_accessed_at = NOW()
      WHERE course_id = $3 AND student_id = $4
      RETURNING *
    `, [progress, isCompleted, courseId, studentId]);

    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Course enrollment not found.' });
    }

    return res.json({
      success: true,
      message: 'Progress updated successfully',
      enrollment: rows[0]
    });
  } catch (err) {
    console.error('[courses] updateLearningProgress error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update progress: ' + err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 5. AUTHORITY COURSE MANAGEMENT (Create, Update, Publish, Unpublish, Archive, Delete)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/courses
 * Create new course with draft/publish status
 */
export const createCourse = async (req, res) => {
  const {
    name,
    code,
    short_description,
    description,
    department_id,
    category = 'Engineering',
    course_type = 'Degree',
    duration = '1 Semester',
    eligibility = 'All Enrolled Students',
    prerequisites = '',
    learning_objectives = '',
    instructor_name = 'Faculty Member',
    price = 0,
    currency = 'INR',
    is_payable = true,
    max_seats = 120,
    enrollment_start,
    enrollment_end,
    course_start,
    course_end,
    image_url,
    status = 'PUBLISHED',
    modules = []
  } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, message: 'Course name is required.' });
  }
  if (!code || !code.trim()) {
    return res.status(400).json({ success: false, message: 'Course code is required.' });
  }

  const cleanCode = code.trim().toUpperCase();
  const numericPrice = Math.max(0, parseFloat(price) || 0);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check code uniqueness
    const codeCheck = await client.query('SELECT id FROM courses WHERE code = $1', [cleanCode]);
    if (codeCheck.rows.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, message: `Course code '${cleanCode}' is already registered.` });
    }

    const { rows: courseRows } = await client.query(`
      INSERT INTO courses (
        name, code, short_description, description, department_id,
        category, course_type, duration, eligibility, prerequisites,
        learning_objectives, instructor_name, price, currency, is_payable,
        is_active, status, max_seats, enrollment_start, enrollment_end,
        course_start, course_end, image_url, created_by, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15,
        $16, $17, $18, $19, $20,
        $21, $22, $23, $24, NOW(), NOW()
      )
      RETURNING *
    `, [
      name.trim(),
      cleanCode,
      short_description || name.trim(),
      description || name.trim(),
      department_id || null,
      category,
      course_type,
      duration,
      eligibility,
      prerequisites,
      learning_objectives,
      instructor_name,
      numericPrice,
      currency,
      Boolean(is_payable),
      status === 'PUBLISHED',
      ['DRAFT', 'PUBLISHED', 'UNPUBLISHED', 'ARCHIVED'].includes(status) ? status : 'PUBLISHED',
      parseInt(max_seats) || 120,
      enrollment_start || null,
      enrollment_end || null,
      course_start || null,
      course_end || null,
      image_url || null,
      req.user.id
    ]);

    const newCourse = courseRows[0];

    // Insert modules if provided
    if (Array.isArray(modules) && modules.length > 0) {
      for (let i = 0; i < modules.length; i++) {
        const m = modules[i];
        if (m.title && m.title.trim()) {
          await client.query(`
            INSERT INTO course_modules (
              course_id, module_order, title, description, topics, duration, learning_resources
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [
            newCourse.id,
            m.module_order || (i + 1),
            m.title.trim(),
            m.description || '',
            JSON.stringify(m.topics || []),
            m.duration || '2 Weeks',
            JSON.stringify(m.learning_resources || [])
          ]);
        }
      }
    }

    await client.query('COMMIT');

    // Audit log
    await logAudit({
      userId: req.user.id,
      action: 'COURSE_CREATED',
      module: 'courses',
      targetRecordId: newCourse.id,
      details: {
        code: cleanCode,
        name: newCourse.name,
        price: numericPrice,
        status: newCourse.status
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Course created successfully',
      course: newCourse
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[courses] createCourse error:', err);
    return res.status(500).json({ success: false, message: 'Failed to create course: ' + err.message });
  } finally {
    client.release();
  }
};

/**
 * PUT /api/courses/:id
 * Edit course information (Historical payment amounts are strictly preserved)
 */
export const updateCourse = async (req, res) => {
  const { id } = req.params;
  const {
    name,
    code,
    short_description,
    description,
    department_id,
    category,
    course_type,
    duration,
    eligibility,
    prerequisites,
    learning_objectives,
    instructor_name,
    price,
    currency,
    is_payable,
    max_seats,
    enrollment_start,
    enrollment_end,
    course_start,
    course_end,
    image_url,
    status
  } = req.body;

  try {
    const existingRes = await pool.query('SELECT * FROM courses WHERE id = $1', [id]);
    if (!existingRes.rows.length) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }
    const current = existingRes.rows[0];

    const cleanCode = code ? code.trim().toUpperCase() : current.code;
    if (cleanCode !== current.code) {
      const codeCheck = await pool.query('SELECT id FROM courses WHERE code = $1 AND id != $2', [cleanCode, id]);
      if (codeCheck.rows.length) {
        return res.status(409).json({ success: false, message: `Course code '${cleanCode}' is already in use by another course.` });
      }
    }

    const newStatus = status ? status.toUpperCase() : current.status;
    const isActive = newStatus === 'PUBLISHED' ? true : (newStatus === 'ARCHIVED' ? false : current.is_active);

    const { rows } = await pool.query(`
      UPDATE courses
      SET
        name = COALESCE($1, name),
        code = COALESCE($2, code),
        short_description = COALESCE($3, short_description),
        description = COALESCE($4, description),
        department_id = $5,
        category = COALESCE($6, category),
        course_type = COALESCE($7, course_type),
        duration = COALESCE($8, duration),
        eligibility = COALESCE($9, eligibility),
        prerequisites = COALESCE($10, prerequisites),
        learning_objectives = COALESCE($11, learning_objectives),
        instructor_name = COALESCE($12, instructor_name),
        price = COALESCE($13, price),
        currency = COALESCE($14, currency),
        is_payable = COALESCE($15, is_payable),
        is_active = $16,
        status = $17,
        max_seats = COALESCE($18, max_seats),
        enrollment_start = $19,
        enrollment_end = $20,
        course_start = $21,
        course_end = $22,
        image_url = COALESCE($23, image_url),
        updated_at = NOW()
      WHERE id = $24
      RETURNING *
    `, [
      name ? name.trim() : null,
      cleanCode,
      short_description,
      description,
      department_id !== undefined ? department_id : current.department_id,
      category,
      course_type,
      duration,
      eligibility,
      prerequisites,
      learning_objectives,
      instructor_name,
      price !== undefined ? parseFloat(price) : null,
      currency,
      is_payable !== undefined ? Boolean(is_payable) : null,
      isActive,
      newStatus,
      max_seats !== undefined ? parseInt(max_seats) : null,
      enrollment_start !== undefined ? enrollment_start : current.enrollment_start,
      enrollment_end !== undefined ? enrollment_end : current.enrollment_end,
      course_start !== undefined ? course_start : current.course_start,
      course_end !== undefined ? course_end : current.course_end,
      image_url,
      id
    ]);

    await logAudit({
      userId: req.user.id,
      action: 'COURSE_UPDATED',
      module: 'courses',
      targetRecordId: id,
      details: {
        code: cleanCode,
        updatedFields: Object.keys(req.body)
      }
    });

    return res.json({
      success: true,
      message: 'Course updated successfully',
      course: rows[0]
    });
  } catch (err) {
    console.error('[courses] updateCourse error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update course: ' + err.message });
  }
};

/**
 * PATCH /api/courses/:id/publish
 */
export const publishCourse = async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(`
      UPDATE courses
      SET status = 'PUBLISHED', is_active = true, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [id]);

    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    await logAudit({
      userId: req.user.id,
      action: 'COURSE_PUBLISHED',
      module: 'courses',
      targetRecordId: id,
      details: { name: rows[0].name, code: rows[0].code }
    });

    return res.json({
      success: true,
      message: 'Course published successfully',
      course: rows[0]
    });
  } catch (err) {
    console.error('[courses] publishCourse error:', err);
    return res.status(500).json({ success: false, message: 'Failed to publish course: ' + err.message });
  }
};

/**
 * PATCH /api/courses/:id/unpublish
 */
export const unpublishCourse = async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(`
      UPDATE courses
      SET status = 'UNPUBLISHED', updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [id]);

    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    await logAudit({
      userId: req.user.id,
      action: 'COURSE_UNPUBLISHED',
      module: 'courses',
      targetRecordId: id,
      details: { name: rows[0].name, code: rows[0].code }
    });

    return res.json({
      success: true,
      message: 'Course unpublished successfully. It is now hidden from new students.',
      course: rows[0]
    });
  } catch (err) {
    console.error('[courses] unpublishCourse error:', err);
    return res.status(500).json({ success: false, message: 'Failed to unpublish course: ' + err.message });
  }
};

/**
 * PATCH /api/courses/:id/archive
 */
export const archiveCourse = async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(`
      UPDATE courses
      SET status = 'ARCHIVED', is_active = false, archived_at = NOW(), updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [id]);

    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    await logAudit({
      userId: req.user.id,
      action: 'COURSE_ARCHIVED',
      module: 'courses',
      targetRecordId: id,
      details: { name: rows[0].name, code: rows[0].code }
    });

    return res.json({
      success: true,
      message: 'Course archived successfully. Historical records and receipts remain preserved.',
      course: rows[0]
    });
  } catch (err) {
    console.error('[courses] archiveCourse error:', err);
    return res.status(500).json({ success: false, message: 'Failed to archive course: ' + err.message });
  }
};

/**
 * DELETE /api/courses/:id
 * SAFE DELETION: Never hard delete a course with enrollments, payments, or receipts!
 */
export const deleteCourse = async (req, res) => {
  const { id } = req.params;
  try {
    const courseRes = await pool.query('SELECT * FROM courses WHERE id = $1', [id]);
    if (!courseRes.rows.length) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }
    const course = courseRes.rows[0];

    // Check existing enrollments
    const enrollmentsCheck = await pool.query('SELECT COUNT(*) FROM course_enrollments WHERE course_id = $1', [id]);
    const enrollCount = parseInt(enrollmentsCheck.rows[0].count);

    // Check existing payments
    const paymentsCheck = await pool.query('SELECT COUNT(*) FROM payments WHERE course_id = $1', [id]);
    const payCount = parseInt(paymentsCheck.rows[0].count);

    // Check receipts
    const receiptsCheck = await pool.query('SELECT COUNT(*) FROM payment_receipts WHERE course_id = $1', [id]);
    const receiptCount = parseInt(receiptsCheck.rows[0].count);

    if (enrollCount > 0 || payCount > 0 || receiptCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot permanently delete course '${course.name}'. It contains ${enrollCount} student enrollment(s), ${payCount} payment(s), and ${receiptCount} receipt(s). Please archive the course instead to preserve academic and audit integrity.`,
        canArchive: true,
        stats: { enrollCount, payCount, receiptCount }
      });
    }

    // No dependencies found — safe to delete modules and course
    await pool.query('DELETE FROM course_modules WHERE course_id = $1', [id]);
    await pool.query('DELETE FROM courses WHERE id = $1', [id]);

    await logAudit({
      userId: req.user.id,
      action: 'COURSE_DELETED',
      module: 'courses',
      targetRecordId: id,
      details: { name: course.name, code: course.code }
    });

    return res.json({
      success: true,
      message: `Course '${course.name}' was permanently deleted.`
    });
  } catch (err) {
    console.error('[courses] deleteCourse error:', err);
    return res.status(500).json({ success: false, message: 'Failed to delete course: ' + err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 6. COURSE CURRICULUM MODULES CRUD
// ─────────────────────────────────────────────────────────────────────────────

/** GET /api/courses/:id/modules */
export const getCourseModules = async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(`
      SELECT * FROM course_modules
      WHERE course_id = $1
      ORDER BY module_order ASC, created_at ASC
    `, [id]);
    return res.json({ success: true, count: rows.length, modules: rows });
  } catch (err) {
    console.error('[courses] getCourseModules error:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve modules: ' + err.message });
  }
};

/** POST /api/courses/:id/modules */
export const createCourseModule = async (req, res) => {
  const { id } = req.params;
  const { title, description = '', topics = [], duration = '2 Weeks', learning_resources = [], module_order } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ success: false, message: 'Module title is required.' });
  }

  try {
    let orderNum = module_order;
    if (!orderNum) {
      const countRes = await pool.query('SELECT COUNT(*) FROM course_modules WHERE course_id = $1', [id]);
      orderNum = parseInt(countRes.rows[0].count) + 1;
    }

    const { rows } = await pool.query(`
      INSERT INTO course_modules (
        course_id, module_order, title, description, topics, duration, learning_resources
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      id,
      orderNum,
      title.trim(),
      description,
      JSON.stringify(topics),
      duration,
      JSON.stringify(learning_resources)
    ]);

    return res.status(201).json({
      success: true,
      message: 'Module added successfully',
      module: rows[0]
    });
  } catch (err) {
    console.error('[courses] createCourseModule error:', err);
    return res.status(500).json({ success: false, message: 'Failed to add module: ' + err.message });
  }
};

/** PUT /api/courses/:id/modules/:moduleId */
export const updateCourseModule = async (req, res) => {
  const { id, moduleId } = req.params;
  const { title, description, topics, duration, learning_resources, module_order } = req.body;

  try {
    const { rows } = await pool.query(`
      UPDATE course_modules
      SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        topics = COALESCE($3, topics),
        duration = COALESCE($4, duration),
        learning_resources = COALESCE($5, learning_resources),
        module_order = COALESCE($6, module_order),
        updated_at = NOW()
      WHERE id = $7 AND course_id = $8
      RETURNING *
    `, [
      title ? title.trim() : null,
      description,
      topics ? JSON.stringify(topics) : null,
      duration,
      learning_resources ? JSON.stringify(learning_resources) : null,
      module_order !== undefined ? parseInt(module_order) : null,
      moduleId,
      id
    ]);

    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Module not found' });
    }

    return res.json({
      success: true,
      message: 'Module updated successfully',
      module: rows[0]
    });
  } catch (err) {
    console.error('[courses] updateCourseModule error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update module: ' + err.message });
  }
};

/** DELETE /api/courses/:id/modules/:moduleId */
export const deleteCourseModule = async (req, res) => {
  const { id, moduleId } = req.params;
  try {
    const { rows } = await pool.query('DELETE FROM course_modules WHERE id = $1 AND course_id = $2 RETURNING *', [moduleId, id]);
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Module not found' });
    }
    return res.json({ success: true, message: 'Module deleted successfully' });
  } catch (err) {
    console.error('[courses] deleteCourseModule error:', err);
    return res.status(500).json({ success: false, message: 'Failed to delete module: ' + err.message });
  }
};
