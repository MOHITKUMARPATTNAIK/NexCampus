import { pool } from '../src/config/db.js';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import http from 'http';

async function runE2ETests() {
  console.log('===========================================================');
  console.log('🧪 NEXCAMPUS COMPLETE DUMMY DIRECT PAYMENT E2E TEST SUITE');
  console.log('===========================================================');

  // Start internal HTTP server for E2E HTTP requests
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(5099, resolve));
  const baseUrl = 'http://127.0.0.1:5099';

  try {
    // 0. Setup: Ensure student account is active
    await pool.query(`UPDATE users SET status = 'active' WHERE email = 'student@nexcampus.edu'`);

    const studentUserRes = await pool.query(`
      SELECT u.id, u.email, u.full_name
      FROM users u
      JOIN user_roles ur ON ur.user_id = u.id
      JOIN roles r ON r.id = ur.role_id
      WHERE r.name = 'student' AND u.status = 'active'
      LIMIT 1
    `);
    if (!studentUserRes.rows.length) {
      throw new Error('No active student found in test database');
    }
    const student = studentUserRes.rows[0];
    console.log(`[SETUP] Test Student: ${student.full_name} (${student.email}, ID: ${student.id})`);

    // Generate JWT token for student
    const jwtSecret = process.env.JWT_SECRET || 'nexcampus_secure_jwt_secret_key_at_least_32_characters_long_2026_salt';
    const studentToken = jwt.sign({ userId: student.id, email: student.email, roles: ['student'] }, jwtSecret, { expiresIn: '1h' });

    // Identify a course that student is NOT enrolled in yet, or prepare one
    let targetCourseRes = await pool.query(`
      SELECT * FROM courses 
      WHERE is_active = true AND is_payable = true
        AND id NOT IN (SELECT course_id FROM course_enrollments WHERE student_id = $1 AND status = 'active')
        AND id NOT IN (SELECT course_id FROM payments WHERE student_id = $1 AND (UPPER(status) IN ('SUCCESS', 'CAPTURED', 'PAID')) AND course_id IS NOT NULL)
      LIMIT 1
    `, [student.id]);

    let targetCourse = targetCourseRes.rows[0];
    if (!targetCourse) {
      // Create a dedicated test course for this run
      const newCourseRes = await pool.query(`
        INSERT INTO courses (name, code, description, duration, price, is_payable, is_active, discount_percentage, tax_percentage)
        VALUES ('Advanced Cloud Engineering 2026', 'CLOUD-TEST-' || substr(md5(random()::text), 1, 6), 'E2E Test Course', '1 Semester', 2499.00, true, true, 0, 0)
        RETURNING *
      `);
      targetCourse = newCourseRes.rows[0];
    }
    console.log(`[SETUP] Target Course: ${targetCourse.name} (Code: ${targetCourse.code}, Price: ₹${targetCourse.price})`);

    // Helper fetch with auth
    const authFetch = (endpoint, options = {}) => {
      const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      };
      if (options.token !== null) {
        headers['Authorization'] = `Bearer ${options.token || studentToken}`;
      }
      return fetch(`${baseUrl}${endpoint}`, {
        ...options,
        headers
      });
    };

    // ── TEST 1: Student → Course → PAY NOW → Confirm → SUCCESS ──
    console.log('\n--- TEST 1: Student PAY NOW → Confirm → SUCCESS ---');
    const payRes = await authFetch('/api/fees/direct-payment/process', {
      method: 'POST',
      body: JSON.stringify({
        item_type: 'course',
        item_id: targetCourse.id,
        amount: parseFloat(targetCourse.price),
        payment_method: 'dummy_gateway'
      })
    });
    const payData = await payRes.json();
    if (!payRes.ok || !payData.success) {
      throw new Error(`TEST 1 Failed: ${JSON.stringify(payData)}`);
    }
    console.log('✓ TEST 1 PASSED: Direct payment processed successfully.');
    console.log(`  Txn ID: ${payData.payment.transactionId}, Status: ${payData.payment.status}, Amount: ₹${payData.payment.amount}`);
    if (payData.payment.status !== 'SUCCESS') {
      throw new Error(`Expected payment.status === 'SUCCESS', got: ${payData.payment.status}`);
    }
    if (!payData.payment.transactionId.startsWith('DUMMY-TXN-')) {
      throw new Error(`Expected transaction reference to start with 'DUMMY-TXN-', got: ${payData.payment.transactionId}`);
    }

    // ── TEST 2: Successful payment → Receipt appears ──
    console.log('\n--- TEST 2: Successful payment → Receipt appears ---');
    if (!payData.receipt || !payData.receipt.receipt_number) {
      throw new Error('TEST 2 Failed: Receipt not included in payment response');
    }
    console.log(`✓ TEST 2 PASSED: Receipt generated: ${payData.receipt.receipt_number} for ${payData.receipt.receipt_title}`);
    console.log(`  Student on Receipt: ${payData.receipt.student_name}, Amount: ₹${payData.receipt.amount}`);

    // Verify receipt in receipts query
    const receiptsRes = await authFetch('/api/fees/my-receipts');
    const receiptsData = await receiptsRes.json();
    const hasReceipt = (receiptsData.receipts || []).some(r => r.receipt_number === payData.receipt.receipt_number);
    if (!hasReceipt) {
      throw new Error('TEST 2 Failed: Receipt not found in GET /api/fees/my-receipts');
    }
    console.log('✓ TEST 2 PASSED: Receipt verified in /api/fees/my-receipts list.');

    // ── TEST 3: Successful payment → Dashboard amount paid increases ──
    console.log('\n--- TEST 3: Dashboard telemetry & amount paid update ---');
    const portfolioRes = await authFetch('/api/portfolio/my');
    const portfolioData = await portfolioRes.json();
    console.log(`  Portfolio Total Paid: ₹${portfolioData.fees.total_paid}, Direct Amount: ₹${portfolioData.fees.direct_amount_paid}`);
    if (parseFloat(portfolioData.fees.total_paid) <= 0) {
      throw new Error('TEST 3 Failed: Dashboard portfolio amount paid did not reflect direct payment');
    }
    console.log('✓ TEST 3 PASSED: Dashboard portfolio fee telemetry reflected direct payment.');

    // ── TEST 4: Successful payment → Course becomes paid/enrolled ──
    console.log('\n--- TEST 4: Course becomes paid/enrolled ---');
    const payablesRes = await authFetch('/api/fees/available-payables');
    const payablesData = await payablesRes.json();
    const enrolledCourse = (payablesData.courses || []).find(c => c.id === targetCourse.id);
    if (!enrolledCourse || !enrolledCourse.is_enrolled) {
      throw new Error('TEST 4 Failed: Course is_enrolled is not true in available-payables');
    }
    if (!enrolledCourse.receipt_number) {
      throw new Error('TEST 4 Failed: Course does not link receipt_number');
    }
    console.log(`✓ TEST 4 PASSED: Course marked is_enrolled=true with linked receipt ${enrolledCourse.receipt_number}.`);

    // ── TEST 5: Duplicate Payment Prevention ──
    console.log('\n--- TEST 5: Click PAY NOW again on already-paid course → Prevented ---');
    const dupRes = await authFetch('/api/fees/direct-payment/process', {
      method: 'POST',
      body: JSON.stringify({
        item_type: 'course',
        item_id: targetCourse.id,
        amount: parseFloat(targetCourse.price),
        payment_method: 'dummy_gateway'
      })
    });
    const dupData = await dupRes.json();
    if (dupRes.status !== 409 || dupData.success !== false) {
      throw new Error(`TEST 5 Failed: Expected 409 conflict, got ${dupRes.status}: ${JSON.stringify(dupData)}`);
    }
    console.log(`✓ TEST 5 PASSED: Duplicate payment blocked with message: "${dupData.message}"`);
    if (!dupData.alreadyPaid) {
      throw new Error('Expected alreadyPaid: true flag');
    }

    // ── TEST 6: Invalid amount → Payment rejected ──
    console.log('\n--- TEST 6: Invalid or manipulated amount → Payment rejected ---');
    // Prepare a second course
    const course2Res = await pool.query(`
      INSERT INTO courses (name, code, description, duration, price, is_payable, is_active, discount_percentage, tax_percentage)
      VALUES ('Cybersecurity Defense 2026', 'SEC-TEST-' || substr(md5(random()::text), 1, 6), 'Test', '1 Sem', 4999.00, true, true, 0, 0)
      RETURNING *
    `);
    const course2 = course2Res.rows[0];

    // Try paying ₹10 instead of ₹4999
    const tamperedRes = await authFetch('/api/fees/direct-payment/process', {
      method: 'POST',
      body: JSON.stringify({
        item_type: 'course',
        item_id: course2.id,
        amount: 10.00,
        payment_method: 'dummy_gateway'
      })
    });
    const tamperedData = await tamperedRes.json();
    if (tamperedRes.status !== 400 || tamperedData.success !== false) {
      throw new Error(`TEST 6 Failed: Tampered amount was not rejected! Status: ${tamperedRes.status}`);
    }
    console.log(`✓ TEST 6 PASSED: Tampered amount rejected with 400 Bad Request: "${tamperedData.message}"`);

    // Try paying negative amount
    const negRes = await authFetch('/api/fees/direct-payment/process', {
      method: 'POST',
      body: JSON.stringify({
        item_type: 'course',
        item_id: course2.id,
        amount: -500,
        payment_method: 'dummy_gateway'
      })
    });
    const negData = await negRes.json();
    if (negRes.status !== 400 || negData.success !== false) {
      throw new Error('TEST 6 Failed: Negative amount was not rejected');
    }
    console.log(`✓ TEST 6 PASSED: Negative amount rejected: "${negData.message}"`);

    // ── TEST 7: Unauthenticated user → Payment rejected ──
    console.log('\n--- TEST 7: Unauthenticated user → Payment rejected ---');
    const unauthRes = await authFetch('/api/fees/direct-payment/process', {
      method: 'POST',
      token: null,
      body: JSON.stringify({
        item_type: 'course',
        item_id: course2.id,
        amount: 4999.00
      })
    });
    if (unauthRes.status !== 401) {
      throw new Error(`TEST 7 Failed: Expected 401, got ${unauthRes.status}`);
    }
    console.log('✓ TEST 7 PASSED: Unauthenticated request rejected with 401 Unauthorized.');

    // ── TEST 8: /api/payments alias consistency ──
    console.log('\n--- TEST 8: API Consistency — POST /api/payments endpoint ---');
    const aliasRes = await authFetch('/api/payments', {
      method: 'POST',
      body: JSON.stringify({
        item_type: 'course',
        item_id: course2.id,
        amount: 4999.00,
        payment_method: 'dummy_gateway'
      })
    });
    const aliasData = await aliasRes.json();
    if (!aliasRes.ok || !aliasData.success) {
      throw new Error(`TEST 8 Failed: /api/payments returned ${JSON.stringify(aliasData)}`);
    }
    console.log(`✓ TEST 8 PASSED: /api/payments direct endpoint succeeded. Txn: ${aliasData.payment.transactionId}, Receipt: ${aliasData.receipt.receipt_number}`);

    // ── TEST 9: Persistent database verification ──
    console.log('\n--- TEST 9: Database persistence verification ---');
    const dbPaymentRes = await pool.query(
      `SELECT * FROM payments WHERE transaction_reference = $1`,
      [payData.payment.transactionId]
    );
    if (!dbPaymentRes.rows.length) {
      throw new Error('TEST 9 Failed: Payment not found in database');
    }
    const dbPayment = dbPaymentRes.rows[0];
    if (dbPayment.status !== 'SUCCESS') {
      throw new Error(`TEST 9 Failed: DB payment status is '${dbPayment.status}', expected 'SUCCESS'`);
    }
    console.log(`✓ TEST 9 PASSED: Payment confirmed in persistent PostgreSQL table. Status: ${dbPayment.status}.`);

    // ── TEST 10: History and receipts availability ──
    console.log('\n--- TEST 10: Payment history and receipt querying ---');
    const historyRes = await authFetch('/api/fees/my-payments');
    const historyData = await historyRes.json();
    const foundInHistory = (historyData.payments || []).some(p => p.transaction_reference === payData.payment.transactionId);
    if (!foundInHistory) {
      throw new Error('TEST 10 Failed: Payment not found in student payment history');
    }
    console.log('✓ TEST 10 PASSED: Payment confirmed in student payment history list.');

    console.log('\n===========================================================');
    console.log('🎉 ALL 10 E2E DUMMY PAYMENT TEST CASES PASSED WITH 100% SUCCESS!');
    console.log('===========================================================');

  } finally {
    server.close();
    await pool.end();
  }
}

runE2ETests().catch(err => {
  console.error('\n❌ E2E TEST RUNNER FAILED:', err);
  process.exit(1);
});
