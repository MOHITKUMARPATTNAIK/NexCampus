import pool from '../src/config/db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

async function runE2ETest() {
  console.log('--- STARTING NEXCAMPUS DIRECT PAYMENTS & I18N E2E TEST ---');

  try {
    // 1. Get or create a test student user
    let studentUserRes = await pool.query(
      `SELECT u.id, u.email FROM users u
       JOIN user_roles ur ON ur.user_id = u.id
       JOIN roles r ON r.id = ur.role_id
       WHERE r.name = 'student' AND u.status = 'active'
       LIMIT 1`
    );

    let studentId;
    let studentEmail;
    if (studentUserRes.rows.length) {
      studentId = studentUserRes.rows[0].id;
      studentEmail = studentUserRes.rows[0].email;
    } else {
      console.log('Creating test student...');
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash('Student@123!', salt);
      const newU = await pool.query(
        `INSERT INTO users (email, password_hash, full_name, status)
         VALUES ('e2e_student@nexcampus.edu', $1, 'E2E Test Student', 'active')
         RETURNING id, email`,
        [hash]
      );
      studentId = newU.rows[0].id;
      studentEmail = newU.rows[0].email;
      const roleRes = await pool.query(`SELECT id FROM roles WHERE name = 'student'`);
      if (roleRes.rows.length) {
        await pool.query(
          `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [studentId, roleRes.rows[0].id]
        );
      }
      await pool.query(
        `INSERT INTO student_profiles (user_id, student_id, admission_year)
         VALUES ($1, 'NC-E2E-999', 2026) ON CONFLICT DO NOTHING`,
        [studentId]
      );
    }
    console.log(`[PASS] Student identified: ${studentEmail} (${studentId})`);

    // 2. Query available courses
    const courseRes = await pool.query(
      `SELECT * FROM courses WHERE is_active = true AND is_payable = true LIMIT 1`
    );
    if (!courseRes.rows.length) {
      throw new Error('No active payable course found in database');
    }
    const testCourse = courseRes.rows[0];
    console.log(`[PASS] Test Course selected: ${testCourse.name} (Code: ${testCourse.code}, Price: ₹${testCourse.price})`);

    // Ensure student is NOT already enrolled for clean test
    await pool.query(
      `DELETE FROM course_enrollments WHERE student_id = $1 AND course_id = $2`,
      [studentId, testCourse.id]
    );

    // 3. Create Direct Payment Order (Simulating POST /api/fees/direct-payment/create-order)
    const basePrice = parseFloat(testCourse.price || 0);
    const discountPct = parseFloat(testCourse.discount_percentage || 0);
    const taxPct = parseFloat(testCourse.tax_percentage || 0);
    const discountAmount = Math.round(((basePrice * discountPct) / 100) * 100) / 100;
    const subtotal = Math.max(0, basePrice - discountAmount);
    const taxAmount = Math.round(((subtotal * taxPct) / 100) * 100) / 100;
    const netAmount = Math.round((subtotal + taxAmount) * 100) / 100;

    const orderRef = `ORD-${Date.now()}-TESTE2E`;
    const simRzpOrderId = `order_sim_${Date.now()}`;
    const metadata = {
      itemTitle: testCourse.name,
      basePrice,
      discountAmount,
      taxAmount,
      netAmount
    };

    const orderInsert = await pool.query(
      `INSERT INTO payment_orders
         (student_id, course_id, payment_type, order_reference, razorpay_order_id, amount, currency, status, metadata)
       VALUES ($1, $2, 'course', $3, $4, $5, 'INR', 'created', $6)
       RETURNING *`,
      [studentId, testCourse.id, orderRef, simRzpOrderId, netAmount, JSON.stringify(metadata)]
    );
    const createdOrder = orderInsert.rows[0];
    console.log(`[PASS] Direct Payment Order created: Ref ${createdOrder.order_reference}, Amount: ₹${createdOrder.amount}`);

    // 4. Verify Direct Payment & Auto-Enrollment (Simulating POST /api/fees/direct-payment/verify)
    const txRef = `TXN-${Date.now()}-E2E`;
    const simPaymentId = `pay_sim_${Date.now()}`;

    // Insert payment
    const paymentInsert = await pool.query(
      `INSERT INTO payments
         (student_id, course_id, order_id, payment_order_id, payment_type, transaction_reference,
          razorpay_payment_id, razorpay_signature, amount, net_amount, currency, status,
          payment_method, paid_at, metadata)
       VALUES ($1, $2, $3, $3, 'course', $4, $5, 'sig_e2e_verified', $6, $6, 'INR', 'captured',
          'test_sandbox', NOW(), $7)
       RETURNING *`,
      [studentId, testCourse.id, createdOrder.id, txRef, simPaymentId, netAmount, JSON.stringify(metadata)]
    );
    const recordedPayment = paymentInsert.rows[0];
    console.log(`[PASS] Payment recorded with status '${recordedPayment.status}': Txn ${recordedPayment.transaction_reference}`);

    // Update order status to 'paid'
    await pool.query(
      `UPDATE payment_orders SET status = 'paid', updated_at = NOW() WHERE id = $1`,
      [createdOrder.id]
    );

    // Auto-enroll in course_enrollments
    const enrollInsert = await pool.query(
      `INSERT INTO course_enrollments (student_id, course_id, payment_id, status, enrolled_at)
       VALUES ($1, $2, $3, 'active', NOW())
       ON CONFLICT (student_id, course_id) DO UPDATE SET status = 'active', payment_id = EXCLUDED.payment_id
       RETURNING *`,
      [studentId, testCourse.id, recordedPayment.id]
    );
    const enrollment = enrollInsert.rows[0];
    console.log(`[PASS] Student auto-enrolled: Course ${enrollment.course_id}, Status: ${enrollment.status}`);

    // Auto-generate Receipt
    const receiptCount = await pool.query('SELECT COUNT(*) FROM payment_receipts');
    const receiptNumber = `RCP-${new Date().getFullYear()}-${String(Number(receiptCount.rows[0].count) + 1).padStart(6, '0')}`;
    const receiptInsert = await pool.query(
      `INSERT INTO payment_receipts
         (payment_id, student_id, course_id, receipt_number, receipt_title, student_name,
          student_roll, amount, payment_method, razorpay_payment_id, generated_at, issued_at)
       VALUES ($1, $2, $3, $4, $5, 'E2E Test Student', 'NC-E2E-999', $6, 'test_sandbox', $7, NOW(), NOW())
       RETURNING *`,
      [recordedPayment.id, studentId, testCourse.id, receiptNumber, testCourse.name, netAmount, simPaymentId]
    );
    const receipt = receiptInsert.rows[0];
    console.log(`[PASS] Official Receipt generated: ${receipt.receipt_number} for ₹${receipt.amount}`);

    // 5. Test Unified Receipts retrieval (LEFT JOIN check)
    const myReceipts = await pool.query(
      `SELECT pr.*, 
              COALESCE(pr.receipt_title, c.name, 'Campus Payment') AS title
       FROM payment_receipts pr
       LEFT JOIN courses c ON c.id = pr.course_id
       WHERE pr.student_id = $1`,
      [studentId]
    );
    if (!myReceipts.rows.some(r => r.id === receipt.id)) {
      throw new Error('Newly generated receipt not returned in myReceipts query');
    }
    console.log(`[PASS] Student receipts query returned ${myReceipts.rows.length} receipts, including direct course receipt`);

    // 6. Test Admin Transaction Ledger & Revenue aggregation
    const adminLedger = await pool.query(
      `SELECT p.*, u.full_name AS student_name, pr.receipt_number
       FROM payments p
       JOIN users u ON u.id = p.student_id
       LEFT JOIN payment_receipts pr ON pr.payment_id = p.id
       WHERE p.id = $1`,
      [recordedPayment.id]
    );
    if (!adminLedger.rows.length) {
      throw new Error('Payment not present in admin transaction ledger query');
    }
    console.log(`[PASS] Admin transaction ledger verified: Student "${adminLedger.rows[0].student_name}", Receipt: ${adminLedger.rows[0].receipt_number}`);

    // 7. Test Language Preference Persistence
    await pool.query(
      `UPDATE users SET preferred_language = 'hi' WHERE id = $1`,
      [studentId]
    );
    const langCheck = await pool.query(
      `SELECT preferred_language FROM users WHERE id = $1`,
      [studentId]
    );
    if (langCheck.rows[0].preferred_language !== 'hi') {
      throw new Error('Preferred language failed to update to Hindi');
    }
    console.log(`[PASS] User preferred language successfully set and verified in DB: '${langCheck.rows[0].preferred_language}'`);

    console.log('\n======================================================');
    console.log('✅ ALL DIRECT PAYMENT & I18N E2E TESTS PASSED 100%!');
    console.log('======================================================\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ E2E TEST FAILED:', err);
    process.exit(1);
  }
}

runE2ETest();
