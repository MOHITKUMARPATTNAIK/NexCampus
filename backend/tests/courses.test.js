import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import pool from '../src/config/db.js';

describe('🎓 Dedicated Course Management System Test Suite', () => {
  let server;
  let baseUrl;
  let adminToken;
  let studentToken;
  let adminUser;
  let studentUser;
  let testCourseId;
  let draftCourseId;

  const jwtSecret = process.env.JWT_SECRET || 'nexcampus_secure_jwt_secret_key_at_least_32_characters_long_2026_salt';

  before(async () => {
    server = http.createServer(app);
    await new Promise(resolve => server.listen(5098, resolve));
    baseUrl = 'http://127.0.0.1:5098';

    // Retrieve active super_admin / admin user
    const adminRes = await pool.query(`
      SELECT u.id, u.email, u.full_name
      FROM users u
      JOIN user_roles ur ON ur.user_id = u.id
      JOIN roles r ON r.id = ur.role_id
      WHERE r.name IN ('super_admin', 'delegated_admin') AND u.status = 'active'
      LIMIT 1
    `);
    adminUser = adminRes.rows[0];
    adminToken = jwt.sign(
      { userId: adminUser.id, email: adminUser.email, roles: ['super_admin'] },
      jwtSecret,
      { expiresIn: '2h' }
    );

    // Retrieve active student user
    const studentRes = await pool.query(`
      SELECT u.id, u.email, u.full_name
      FROM users u
      JOIN user_roles ur ON ur.user_id = u.id
      JOIN roles r ON r.id = ur.role_id
      WHERE r.name = 'student' AND u.status = 'active'
      LIMIT 1
    `);
    studentUser = studentRes.rows[0];
    studentToken = jwt.sign(
      { userId: studentUser.id, email: studentUser.email, roles: ['student'] },
      jwtSecret,
      { expiresIn: '2h' }
    );
  });

  after(async () => {
    // Cleanup created test courses
    if (draftCourseId) {
      await pool.query('DELETE FROM course_modules WHERE course_id = $1', [draftCourseId]);
      await pool.query('DELETE FROM courses WHERE id = $1', [draftCourseId]);
    }
    if (testCourseId) {
      await pool.query('DELETE FROM course_modules WHERE course_id = $1', [testCourseId]);
      await pool.query('DELETE FROM courses WHERE id = $1', [testCourseId]);
    }
    server.close();
  });

  const apiFetch = (url, options = {}) => {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    return fetch(`${baseUrl}${url}`, { ...options, headers });
  };

  it('1. GET /api/courses lists published courses for students', async () => {
    const res = await apiFetch('/api/courses');
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(Array.isArray(data.courses));
    // Verify none of the public courses are DRAFT
    for (const c of data.courses) {
      assert.equal(c.status, 'PUBLISHED');
      assert.equal(c.is_active, true);
    }
  });

  it('2. Authority creates a course in DRAFT status', async () => {
    const randomCode = 'DRAFT-' + Math.random().toString(36).substring(2, 7).toUpperCase();
    const res = await apiFetch('/api/courses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        name: 'Quantum Computing Fundamentals',
        code: randomCode,
        short_description: 'Intro to qubits and quantum circuits',
        description: 'Comprehensive introduction to quantum algorithms, superposition, and quantum computing hardware.',
        category: 'Physics & Computing',
        course_type: 'Specialization',
        price: 3499.00,
        currency: 'INR',
        duration: '3 Months',
        status: 'DRAFT',
        max_seats: 60,
        modules: [
          { title: 'Module 1: Introduction to Qubits', duration: '2 Weeks' },
          { title: 'Module 2: Quantum Gates & Circuits', duration: '3 Weeks' }
        ]
      })
    });

    assert.equal(res.status, 201);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.course.status, 'DRAFT');
    assert.equal(data.course.price, '3499.00');
    draftCourseId = data.course.id;
  });

  it('3. Students cannot see DRAFT course in public catalog', async () => {
    const res = await apiFetch('/api/courses', {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    const found = data.courses.find(c => c.id === draftCourseId);
    assert.equal(found, undefined, 'Draft course must not be visible to students');
  });

  it('4. Authority CAN see DRAFT course in authority view', async () => {
    const res = await apiFetch('/api/courses?status=DRAFT', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    const found = data.courses.find(c => c.id === draftCourseId);
    assert.ok(found, 'Authority must be able to view draft course');
  });

  it('5. Authority publishes course → Student can now view it', async () => {
    const pubRes = await apiFetch(`/api/courses/${draftCourseId}/publish`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.equal(pubRes.status, 200);
    const pubData = await pubRes.json();
    assert.equal(pubData.course.status, 'PUBLISHED');

    // Student checks catalog
    const studentCatalogRes = await apiFetch('/api/courses', {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    const catalogData = await studentCatalogRes.json();
    const found = catalogData.courses.find(c => c.id === draftCourseId);
    assert.ok(found, 'Published course must be visible to students');
    testCourseId = draftCourseId;
    draftCourseId = null; // Reassigned for cleanup
  });

  it('6. Student CANNOT create, modify, or delete a course (RBAC)', async () => {
    // Attempt Create
    const createRes = await apiFetch('/api/courses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({ name: 'Hacked Course', code: 'HACK101', price: 0 })
    });
    assert.equal(createRes.status, 403);

    // Attempt Modify
    const modRes = await apiFetch(`/api/courses/${testCourseId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({ price: 1.00 })
    });
    assert.equal(modRes.status, 403);

    // Attempt Delete
    const delRes = await apiFetch(`/api/courses/${testCourseId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    assert.equal(delRes.status, 403);
  });

  it('7. Course details endpoint returns modules and seat availability', async () => {
    const res = await apiFetch(`/api/courses/${testCourseId}`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.course.id, testCourseId);
    assert.ok(Array.isArray(data.course.modules));
    assert.equal(data.course.modules.length, 2);
    assert.equal(data.course.is_full, false);
    assert.ok(data.course.available_seats > 0);
  });

  it('8. Authority adds a 3rd module to curriculum', async () => {
    const res = await apiFetch(`/api/courses/${testCourseId}/modules`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        title: 'Module 3: Shor Algorithm & Quantum Cryptography',
        description: 'Advanced quantum cryptographic schemes and quantum key distribution.',
        duration: '3 Weeks',
        topics: ['RSA Factorization', 'BB84 Protocol', 'Post-Quantum Defense']
      })
    });
    assert.equal(res.status, 201);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.module.title, 'Module 3: Shor Algorithm & Quantum Cryptography');
  });

  it('9. Student enrolls and pays directly for course via direct dummy payment', async () => {
    const payRes = await apiFetch('/api/fees/direct-payment/process', {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({
        item_type: 'course',
        item_id: testCourseId,
        amount: 3499.00,
        payment_method: 'dummy_gateway'
      })
    });
    assert.equal(payRes.status, 200);
    const payData = await payRes.json();
    assert.equal(payData.success, true);
    assert.equal(payData.payment.status, 'SUCCESS');
    assert.ok(payData.payment.transactionId.startsWith('DUMMY-TXN-'));
    assert.ok(payData.receipt.receipt_number.startsWith('RCP-2026-'));
  });

  it('10. Enrolled course appears in student My Learning with 0% progress', async () => {
    const res = await apiFetch('/api/courses/my-learning', {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    const myCourse = data.learning.find(l => l.course_id === testCourseId);
    assert.ok(myCourse, 'Enrolled course must appear in My Learning');
    assert.equal(myCourse.enrollment_status, 'active');
    assert.equal(myCourse.progress, 0);
    assert.equal(parseFloat(myCourse.course_fee_at_enrollment), 3499.00);
  });

  it('11. Student updates learning progress to 45%', async () => {
    const res = await apiFetch(`/api/courses/my-learning/${testCourseId}/progress`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({ progress: 45 })
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.enrollment.progress, 45);
    assert.equal(data.enrollment.status, 'active');
  });

  it('12. Authority attempts to permanently delete enrolled course → REJECTED with canArchive: true', async () => {
    const res = await apiFetch(`/api/courses/${testCourseId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.success, false);
    assert.equal(data.canArchive, true);
    assert.ok(data.message.includes('enrollment'));
  });

  it('13. Authority archives course → Historical enrollment & receipts preserved', async () => {
    const res = await apiFetch(`/api/courses/${testCourseId}/archive`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.course.status, 'ARCHIVED');

    // Student still retains their record in My Learning
    const myLearningRes = await apiFetch('/api/courses/my-learning', {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    const myLearningData = await myLearningRes.json();
    const myCourse = myLearningData.learning.find(l => l.course_id === testCourseId);
    assert.ok(myCourse, 'Student must retain enrolled course even after course is archived');
  });

  it('14. Authority stats returns aggregate metrics', async () => {
    const res = await apiFetch('/api/courses/stats', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(data.stats.total_courses >= 1);
    assert.ok(data.stats.total_enrollments >= 1);
    assert.ok(data.stats.total_course_revenue >= 3499.00);
  });
});
