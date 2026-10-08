import { pool } from '../src/config/db.js';

async function diagnose() {
  try {
    const users = await pool.query(`
      SELECT u.id, u.email, u.full_name, array_agg(r.name) as roles
      FROM users u
      JOIN user_roles ur ON ur.user_id = u.id
      JOIN roles r ON r.id = ur.role_id
      GROUP BY u.id, u.email, u.full_name
      LIMIT 10
    `);
    console.log('Sample Users:', JSON.stringify(users.rows, null, 2));

    const courses = await pool.query('SELECT id, name, code, price, is_payable, is_active FROM courses');
    console.log('Courses:', JSON.stringify(courses.rows, null, 2));

    const enrollments = await pool.query('SELECT ce.*, c.name as course_name FROM course_enrollments ce JOIN courses c ON c.id = ce.course_id');
    console.log('Enrollments:', JSON.stringify(enrollments.rows, null, 2));

    const orders = await pool.query('SELECT id, order_reference, razorpay_order_id, amount, status, student_id, payment_type, created_at FROM payment_orders ORDER BY created_at DESC LIMIT 5');
    console.log('Recent Orders:', JSON.stringify(orders.rows, null, 2));

    const payments = await pool.query('SELECT id, transaction_reference, razorpay_payment_id, amount, status, student_id, payment_type, created_at FROM payments ORDER BY created_at DESC LIMIT 5');
    console.log('Recent Payments:', JSON.stringify(payments.rows, null, 2));

    const receipts = await pool.query('SELECT id, receipt_number, receipt_title, amount, student_id, generated_at FROM payment_receipts ORDER BY generated_at DESC LIMIT 5');
    console.log('Recent Receipts:', JSON.stringify(receipts.rows, null, 2));
  } catch (err) {
    console.error('Diagnosis Error:', err);
  } finally {
    await pool.end();
  }
}

diagnose();
