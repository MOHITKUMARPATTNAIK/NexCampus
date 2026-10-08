import bcrypt from 'bcryptjs';
import { pool, checkConnection } from './db.js';
import { fileURLToPath } from 'url';

export const seedDatabase = async () => {
  const conn = await checkConnection();
  if (!conn.connected) {
    throw new Error(`Cannot seed: ${conn.message}`);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('[Seed] Seeding Roles & Permissions...');

    // 1. Roles
    const roles = [
      { name: 'super_admin', display_name: 'Super Administrator', description: 'Highest institutional authority with full access' },
      { name: 'delegated_admin', display_name: 'Delegated Administrator', description: 'Department or functional administrative authority' },
      { name: 'cmo', display_name: 'Complaint Management Officer', description: 'Centralized complaint triage, assignment, verification, and escalation' },
      { name: 'faculty', display_name: 'Faculty Member', description: 'Course management, class attendance, and academic guidance' },
      { name: 'student', display_name: 'Student', description: 'Access to learning schedules, fee payments, gate-passes, and complaints' },
      { name: 'security_guard', display_name: 'Security Guard', description: 'Gate checkpoint QR scanning, checkout, and checkin verification' },
      { name: 'hostel_warden', display_name: 'Hostel Warden', description: 'Hostel room management and complaint resolution' },
      { name: 'mess_staff', display_name: 'Mess Staff', description: 'Campus dining feedback and mess complaint resolution' },
      { name: 'maintenance_staff', display_name: 'Maintenance Staff', description: 'Electrical, plumbing, and physical repair task resolution' }
    ];

    for (const r of roles) {
      await client.query(`
        INSERT INTO roles (name, display_name, description, is_system)
        VALUES ($1, $2, $3, true)
        ON CONFLICT (name) DO UPDATE SET display_name = EXCLUDED.display_name, description = EXCLUDED.description;
      `, [r.name, r.display_name, r.description]);
    }

    // 2. Permissions
    const permissions = [
      // Super Admin & Admin Permissions
      { code: 'admin:view_dashboard', module: 'admin', description: 'View administrative overview & analytics' },
      { code: 'admin:manage_admins', module: 'admin', description: 'Appoint, configure, and deactivate delegated admins' },
      { code: 'admin:appoint_cmo', module: 'admin', description: 'Designate or replace Complaint Management Officers' },
      { code: 'admin:manage_users', module: 'admin', description: 'Create and update users across all roles' },
      { code: 'admin:view_audit_logs', module: 'audit', description: 'Inspect system-wide immutable audit trail' },
      
      // Academic & Attendance Permissions
      { code: 'academic:manage_curriculum', module: 'academic', description: 'Manage departments, courses, and subjects' },
      { code: 'academic:manage_timetables', module: 'academic', description: 'Schedule and allocate classes and rooms' },
      { code: 'attendance:mark', module: 'attendance', description: 'Mark student attendance for assigned sessions' },
      { code: 'attendance:view_all', module: 'attendance', description: 'View institute-wide attendance reports' },
      { code: 'attendance:modify', module: 'attendance', description: 'Modify recorded attendance with audit logging' },
      { code: 'leave:apply', module: 'leave', description: 'Submit student leave applications' },
      { code: 'leave:approve', module: 'leave', description: 'Approve or reject student leave requests' },

      // Gate-Pass & Security Permissions
      { code: 'gatepass:apply', module: 'gatepass', description: 'Request student digital gate pass' },
      { code: 'gatepass:approve', module: 'gatepass', description: 'Approve or reject gate-pass requests' },
      { code: 'security:scan_qr', module: 'security', description: 'Scan and cryptographically verify gate QR passes' },
      { code: 'security:record_movement', module: 'security', description: 'Record student physical check-out and check-in' },
      { code: 'security:view_exceptions', module: 'security', description: 'Monitor overdue returns and security alerts' },

      // Complaints & CMO Permissions
      { code: 'complaint:submit', module: 'complaint', description: 'Submit institutional, hostel, or mess complaints' },
      { code: 'complaint:cmo_triage', module: 'cmo', description: 'Triage, prioritize, and assign incoming complaints' },
      { code: 'complaint:resolve', module: 'complaint', description: 'Resolve assigned operational complaints with photo proof' },
      { code: 'complaint:cmo_verify', module: 'cmo', description: 'Verify completed resolution or reopen complaint' },
      { code: 'complaint:escalate', module: 'complaint', description: 'Escalate overdue complaints to administrators' },

      // Fee & Payment Permissions
      { code: 'fee:manage_structures', module: 'fee', description: 'Configure fee categories, courses, and amounts' },
      { code: 'fee:view_invoices', module: 'fee', description: 'Inspect student fee invoices and dues' },
      { code: 'fee:pay_online', module: 'fee', description: 'Initiate online payment via Razorpay' },
      { code: 'fee:manage_reconciliation', module: 'fee', description: 'Reconcile gateway payments and refund records' },

      // Notices & Communications
      { code: 'notice:publish', module: 'notice', description: 'Publish targeted campus announcements' },
      { code: 'notice:view', module: 'notice', description: 'View role-targeted campus notices' }
    ];

    for (const p of permissions) {
      await client.query(`
        INSERT INTO permissions (code, module, description)
        VALUES ($1, $2, $3)
        ON CONFLICT (code) DO UPDATE SET module = EXCLUDED.module, description = EXCLUDED.description;
      `, [p.code, p.module, p.description]);
    }

    // 3. Departments
    const departments = [
      { code: 'CSE', name: 'Computer Science & Engineering', description: 'Department of Computing, AI and Software Systems' },
      { code: 'ECE', name: 'Electronics & Communication', description: 'Department of Electronics, IoT and Communication' },
      { code: 'MECH', name: 'Mechanical Engineering', description: 'Department of Mechanical and Automation Engineering' },
      { code: 'CIVIL', name: 'Civil Engineering', description: 'Department of Infrastructure & Structural Engineering' },
      { code: 'MGMT', name: 'Department of Management Studies', description: 'Business Administration and Campus Operations' }
    ];

    const departmentMap = {};
    for (const d of departments) {
      const res = await client.query(`
        INSERT INTO departments (code, name, description)
        VALUES ($1, $2, $3)
        ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
        RETURNING id, code;
      `, [d.code, d.name, d.description]);
      departmentMap[d.code] = res.rows[0].id;
    }

    // 4. Courses
    const courses = [
      { code: 'BTECH-CSE', name: 'B.Tech Computer Science & Engineering', deptCode: 'CSE', duration: 8 },
      { code: 'BTECH-ECE', name: 'B.Tech Electronics & Communication', deptCode: 'ECE', duration: 8 },
      { code: 'MBA', name: 'Master of Business Administration', deptCode: 'MGMT', duration: 4 }
    ];

    const courseMap = {};
    for (const c of courses) {
      const res = await client.query(`
        INSERT INTO courses (code, name, department_id, duration_semesters)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
        RETURNING id, code;
      `, [c.code, c.name, departmentMap[c.deptCode], c.duration]);
      courseMap[c.code] = res.rows[0].id;
    }

    // 5. Subjects
    const subjects = [
      { code: 'CS101', name: 'Data Structures & Algorithms', courseCode: 'BTECH-CSE', semester: 3, credits: 4 },
      { code: 'CS102', name: 'Database Management Systems', courseCode: 'BTECH-CSE', semester: 4, credits: 4 },
      { code: 'CS103', name: 'Operating Systems & Concurrency', courseCode: 'BTECH-CSE', semester: 4, credits: 3 },
      { code: 'CS104', name: 'Computer Networks', courseCode: 'BTECH-CSE', semester: 4, credits: 3 },
      { code: 'EC101', name: 'Digital Signal Processing', courseCode: 'BTECH-ECE', semester: 4, credits: 4 }
    ];

    const subjectMap = {};
    for (const s of subjects) {
      const res = await client.query(`
        INSERT INTO subjects (code, name, course_id, semester, credits)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
        RETURNING id, code;
      `, [s.code, s.name, courseMap[s.courseCode], s.semester, s.credits]);
      subjectMap[s.code] = res.rows[0].id;
    }

    // 6. Complaint Categories
    const categories = [
      { name: 'Hostel Maintenance', description: 'Furniture, doors, locks, room amenities, and cleanliness', default_urgency: 'normal' },
      { name: 'Mess & Food Quality', description: 'Dining hygiene, meal quality, water dispensers, and service', default_urgency: 'high' },
      { name: 'Electricity & Lighting', description: 'Power cuts, malfunctioning fans, ACs, switchboards, and wiring', default_urgency: 'high' },
      { name: 'Water Supply & Plumbing', description: 'Washroom leaks, geysers, pipe blocks, and drinking water shortages', default_urgency: 'emergency' },
      { name: 'Internet & WiFi', description: 'Campus Wi-Fi connectivity, LAN ports, and speed degradation', default_urgency: 'normal' },
      { name: 'Classroom & Labs', description: 'Projector issues, benches, lab instruments, and chalkboards', default_urgency: 'normal' },
      { name: 'Campus Sanitation', description: 'Corridor cleanliness, garbage collection, and pest control', default_urgency: 'normal' }
    ];

    for (const c of categories) {
      await client.query(`
        INSERT INTO complaint_categories (name, description, default_urgency, requires_cmo_verification)
        VALUES ($1, $2, $3, true)
        ON CONFLICT (name) DO NOTHING;
      `, [c.name, c.description, c.default_urgency]);
    }

    // 7. Gates
    const gates = [
      { gate_number: 'GATE-01', name: 'Main Campus Grand Gate', location: 'South Perimeter (NH Highway Facing)' },
      { gate_number: 'GATE-02', name: 'Hostel & Residential Gate', location: 'East Campus Perimeter' },
      { gate_number: 'GATE-03', name: 'Academic Complex North Gate', location: 'North Perimeter (Library & Lab side)' }
    ];

    for (const g of gates) {
      await client.query(`
        INSERT INTO gates (gate_number, name, location, is_active)
        VALUES ($1, $2, $3, true)
        ON CONFLICT (gate_number) DO NOTHING;
      `, [g.gate_number, g.name, g.location]);
    }

    // 8. Fee Categories
    const feeCats = [
      { name: 'Tuition Fee', description: 'Regular semester academic tuition fee' },
      { name: 'Hostel Accommodation', description: 'Hostel boarding, room rent, and water charges' },
      { name: 'Mess Charges', description: 'Monthly or semester food meal subscription' },
      { name: 'Examination & Lab Fee', description: 'University examination and practical lab consumables' },
      { name: 'Library & Development', description: 'Library access, digital resources, and campus development' }
    ];

    const feeCatMap = {};
    for (const fc of feeCats) {
      const res = await client.query(`
        INSERT INTO fee_categories (name, description)
        VALUES ($1, $2)
        ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description
        RETURNING id, name;
      `, [fc.name, fc.description]);
      feeCatMap[fc.name] = res.rows[0].id;
    }

    // 9. Fee Structures
    const feeStructures = [
      { cat: 'Tuition Fee', course: 'BTECH-CSE', year: 2, sem: 4, amount: 45000, late: 1000 },
      { cat: 'Examination & Lab Fee', course: 'BTECH-CSE', year: 2, sem: 4, amount: 2500, late: 250 },
      { cat: 'Hostel Accommodation', course: 'BTECH-CSE', year: 2, sem: 4, amount: 30000, late: 500 },
      { cat: 'Library & Development', course: 'BTECH-CSE', year: 2, sem: 4, amount: 1500, late: 100 }
    ];

    const feeStructMap = {};
    for (const fs of feeStructures) {
      const res = await client.query(`
        INSERT INTO fee_structures (category_id, course_id, academic_year, semester, amount, due_date, late_fine_amount)
        VALUES ($1, $2, $3, $4, $5, CURRENT_DATE + INTERVAL '30 days', $6)
        RETURNING id;
      `, [feeCatMap[fs.cat], courseMap[fs.course], fs.year, fs.sem, fs.amount, fs.late]);
      feeStructMap[fs.cat] = res.rows[0].id;
    }

    // Helper: upsert user
    const upsertUser = async (email, password, fullName, phone, roleName) => {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      const userRes = await client.query(`
        INSERT INTO users (email, password_hash, full_name, phone, status)
        VALUES ($1, $2, $3, $4, 'active')
        ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name, phone = EXCLUDED.phone
        RETURNING id;
      `, [email.toLowerCase(), hashedPassword, fullName, phone]);

      const userId = userRes.rows[0].id;

      const roleRes = await client.query('SELECT id FROM roles WHERE name = $1', [roleName]);
      if (roleRes.rows.length > 0) {
        await client.query(`
          INSERT INTO user_roles (user_id, role_id)
          VALUES ($1, $2)
          ON CONFLICT (user_id, role_id) DO NOTHING;
        `, [userId, roleRes.rows[0].id]);
      }

      return userId;
    };

    // 10. Users
    // Super Admin
    const superAdminId = await upsertUser(
      'superadmin@nexcampus.edu',
      'Admin@NexCampus2026!',
      'System Super Administrator',
      '+91 9876543210',
      'super_admin'
    );

    // Complaint Management Officer (CMO)
    const cmoId = await upsertUser(
      'cmo@nexcampus.edu',
      'Cmo@NexCampus2026!',
      'Dr. Rajesh Verma (CMO)',
      '+91 9876543220',
      'cmo'
    );
    await client.query(`
      INSERT INTO administrator_assignments (user_id, role_type, is_cmo, appointed_by, is_active)
      VALUES ($1, 'Complaint Officer', true, $2, true)
      ON CONFLICT DO NOTHING;
    `, [cmoId, superAdminId]);

    // Faculty Member
    const facultyId = await upsertUser(
      'faculty@nexcampus.edu',
      'Faculty@NexCampus2026!',
      'Prof. Alan Turing',
      '+91 9876543230',
      'faculty'
    );
    await client.query(`
      INSERT INTO faculty_profiles (user_id, employee_id, department_id, designation, specialization, cabin_number)
      VALUES ($1, 'FAC202601', $2, 'Associate Professor', 'Distributed Systems & Algorithms', 'C-302')
      ON CONFLICT (user_id) DO NOTHING;
    `, [facultyId, departmentMap['CSE']]);

    // Security Guard
    const guardId = await upsertUser(
      'security@nexcampus.edu',
      'Security@NexCampus2026!',
      'Vikram Singh (Head Guard)',
      '+91 9876543240',
      'security_guard'
    );

    // Student Aarav Sharma (student@nexcampus.edu / Student ID: STU2026001)
    const studentId = await upsertUser(
      'student@nexcampus.edu',
      'Student@NexCampus2026!',
      'Aarav Sharma',
      '+91 9876543201',
      'student'
    );

    // Student Profile
    await client.query(`
      INSERT INTO student_profiles (
        user_id, student_id, department_id, course_id, academic_year, current_semester, section,
        hostel_name, room_number, guardian_name, guardian_phone, phone, address,
        emergency_contact_name, emergency_contact_phone, blood_group, date_of_birth, status
      )
      VALUES ($1, 'STU2026001', $2, $3, 2, 4, 'A', 'Aryabhatta Boys Hostel', 'B-204', 'Rajesh Sharma', '+91 9811122334', '+91 9876543201', 'Flat 402, Green Meadows, Sector 62, Noida, UP', 'Rajesh Sharma (Father)', '+91 9811122334', 'O+', '2004-05-15', 'active')
      ON CONFLICT (user_id) DO UPDATE SET
        student_id = EXCLUDED.student_id,
        phone = EXCLUDED.phone,
        address = EXCLUDED.address,
        guardian_name = EXCLUDED.guardian_name,
        guardian_phone = EXCLUDED.guardian_phone,
        emergency_contact_name = EXCLUDED.emergency_contact_name,
        emergency_contact_phone = EXCLUDED.emergency_contact_phone,
        blood_group = EXCLUDED.blood_group,
        date_of_birth = EXCLUDED.date_of_birth,
        status = 'active';
    `, [studentId, departmentMap['CSE'], courseMap['BTECH-CSE']]);

    // 11. Classes (for Academic Scheduler)
    const classes = [
      { name: 'Data Structures - CSE 4A', subCode: 'CS101', sec: 'A', room: 'LH-101', sem: 4 },
      { name: 'Database Management Systems - CSE 4A', subCode: 'CS102', sec: 'A', room: 'LH-203', sem: 4 },
      { name: 'Operating Systems - CSE 4A', subCode: 'CS103', sec: 'A', room: 'LH-104', sem: 4 },
      { name: 'Computer Networks - CSE 4A', subCode: 'CS104', sec: 'A', room: 'LH-105', sem: 4 }
    ];

    for (const cl of classes) {
      await client.query(`
        INSERT INTO classes (subject_id, faculty_id, name, section, academic_year, semester, room_number)
        VALUES ($1, $2, $3, $4, 2026, $5, $6)
        ON CONFLICT DO NOTHING;
      `, [subjectMap[cl.subCode], facultyId, cl.name, cl.sec, cl.sem, cl.room]);
    }

    // 12. Fee Invoices for Aarav Sharma
    // Tuition Fee Invoice
    await client.query(`
      INSERT INTO fee_invoices (
        invoice_number, student_id, fee_structure_id, total_amount, discount_amount, late_fee,
        final_amount, paid_amount, balance_amount, amount_due, amount_paid, status, due_date, notes
      )
      VALUES (
        'INV-2026-001', $1, $2, 45000.00, 0, 0,
        45000.00, 0, 45000.00, 45000.00, 0, 'unpaid', CURRENT_DATE + INTERVAL '30 days', 'Semester 4 Tuition Fee'
      )
      ON CONFLICT (invoice_number) DO UPDATE SET
        amount_due = EXCLUDED.amount_due,
        balance_amount = EXCLUDED.balance_amount,
        status = EXCLUDED.status;
    `, [studentId, feeStructMap['Tuition Fee']]);

    // Examination Fee Invoice
    await client.query(`
      INSERT INTO fee_invoices (
        invoice_number, student_id, fee_structure_id, total_amount, discount_amount, late_fee,
        final_amount, paid_amount, balance_amount, amount_due, amount_paid, status, due_date, notes
      )
      VALUES (
        'INV-2026-002', $1, $2, 2500.00, 0, 0,
        2500.00, 0, 2500.00, 2500.00, 0, 'unpaid', CURRENT_DATE + INTERVAL '15 days', 'Semester 4 Mid-Term & Lab Examination Fee'
      )
      ON CONFLICT (invoice_number) DO UPDATE SET
        amount_due = EXCLUDED.amount_due,
        balance_amount = EXCLUDED.balance_amount,
        status = EXCLUDED.status;
    `, [studentId, feeStructMap['Examination & Lab Fee']]);

    // Library & Development Fee Invoice (Paid)
    await client.query(`
      INSERT INTO fee_invoices (
        invoice_number, student_id, fee_structure_id, total_amount, discount_amount, late_fee,
        final_amount, paid_amount, balance_amount, amount_due, amount_paid, status, due_date, notes, paid_at
      )
      VALUES (
        'INV-2026-003', $1, $2, 1500.00, 0, 0,
        1500.00, 1500.00, 0, 0, 1500.00, 'paid', CURRENT_DATE - INTERVAL '10 days', 'Annual Digital Library & Lab Access Fee', NOW()
      )
      ON CONFLICT (invoice_number) DO UPDATE SET
        amount_due = EXCLUDED.amount_due,
        amount_paid = EXCLUDED.amount_paid,
        status = EXCLUDED.status;
    `, [studentId, feeStructMap['Library & Development']]);

    // 13. Institutional Documents
    const docs = [
      {
        title: 'Academic Calendar 2026-2027',
        description: 'Comprehensive schedule of academic terms, examination cycles, and institutional holidays.',
        category: 'Academic',
        document_type: 'academic_calendar',
        file_url: '/uploads/documents/academic_calendar_2026.pdf',
        file_name: 'academic_calendar_2026.pdf',
        file_type: 'application/pdf',
        file_size: 245000,
        target_audience: 'all'
      },
      {
        title: 'Campus Code of Conduct & Anti-Ragging Policy',
        description: 'Official institutional guidelines, disciplinary codes, and zero-tolerance policy against harassment.',
        category: 'Policy',
        document_type: 'institutional_policy',
        file_url: '/uploads/documents/campus_policy.pdf',
        file_name: 'campus_policy.pdf',
        file_type: 'application/pdf',
        file_size: 512000,
        target_audience: 'all'
      },
      {
        title: 'Semester Fee Payment Schedule & Instructions',
        description: 'Digital payment regulations, late fine schedules, and Razorpay transaction instructions.',
        category: 'Fees',
        document_type: 'fee_schedule',
        file_url: '/uploads/documents/fee_guidelines.pdf',
        file_name: 'fee_guidelines.pdf',
        file_type: 'application/pdf',
        file_size: 180000,
        target_audience: 'student'
      },
      {
        title: 'Hostel Accommodation Rules Handbook',
        description: 'Hostel timing regulations, visitor rules, curfew hours, and mess schedule.',
        category: 'Hostel',
        document_type: 'hostel_handbook',
        file_url: '/uploads/documents/hostel_rules.pdf',
        file_name: 'hostel_rules.pdf',
        file_type: 'application/pdf',
        file_size: 420000,
        target_audience: 'hostel'
      }
    ];

    for (const d of docs) {
      await client.query(`
        INSERT INTO documents (
          title, description, category, document_type, file_url, file_name,
          file_type, file_size, owner_id, uploaded_by, target_audience, is_public, is_active
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9, $10, true, true)
        ON CONFLICT DO NOTHING;
      `, [d.title, d.description, d.category, d.document_type, d.file_url, d.file_name, d.file_type, d.file_size, superAdminId, d.target_audience]);
    }

    // 14. Sample Student Achievement for Aarav Sharma
    await client.query(`
      INSERT INTO student_achievements (
        student_id, title, category, issuing_organization, achievement_date, description, is_verified
      )
      VALUES (
        $1, 'Smart India Hackathon 2025 - First Runner Up', 'hackathon', 'Ministry of Education, Govt of India',
        '2025-11-20', 'Built an AI-powered smart agriculture monitoring IoT pipeline for rural farming communities.',
        true
      )
      ON CONFLICT DO NOTHING;
    `, [studentId]);

    await client.query('COMMIT');
    console.log('[Seed] Database seeding completed successfully.');
    console.log('[Seed] Accounts ready:');
    console.log('       Super Admin:  superadmin@nexcampus.edu / Admin@NexCampus2026!');
    console.log('       CMO:          cmo@nexcampus.edu / Cmo@NexCampus2026!');
    console.log('       Faculty:      faculty@nexcampus.edu / Faculty@NexCampus2026!');
    console.log('       Security:     security@nexcampus.edu / Security@NexCampus2026!');
    console.log('       Student:      student@nexcampus.edu (Roll: STU2026001) / Student@NexCampus2026!');
  } catch (seedErr) {
    await client.query('ROLLBACK');
    console.error('[Seed Error]:', seedErr.message);
    throw seedErr;
  } finally {
    client.release();
  }
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seedDatabase()
    .then(() => {
      console.log('[Seed CLI] Completed successfully.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Seed CLI] Failed:', err.message);
      process.exit(1);
    });
}
