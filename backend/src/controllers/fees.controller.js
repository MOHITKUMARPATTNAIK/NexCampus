import pool from '../config/db.js';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { logAudit } from '../utils/auditLogger.js';

// ─────────────────────────────────────────────────────────────────
//  Razorpay client — initialized once, used across all handlers
// ─────────────────────────────────────────────────────────────────
let razorpay;
try {
  razorpay = new Razorpay({
    key_id:     process.env.RAZORPAY_KEY_ID     || '',
    key_secret: process.env.RAZORPAY_KEY_SECRET || '',
  });
} catch (err) {
  console.warn('[Razorpay] Could not initialize client:', err.message);
}

// ─────────────────────────────────────────────────────────────────
//  ADMIN — Fee Structures
// ─────────────────────────────────────────────────────────────────

/** GET /api/fees/categories — list all fee categories */
export const listFeeCategories = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM fee_categories ORDER BY name`
    );
    res.json({ categories: rows });
  } catch (err) {
    console.error('[fees] listFeeCategories:', err.message);
    res.status(500).json({ error: 'Failed to load fee categories' });
  }
};

/** POST /api/fees/categories — create fee category (super_admin) */
export const createFeeCategory = async (req, res) => {
  const { name, description } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Category name is required' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO fee_categories (name, description) VALUES ($1, $2)
       ON CONFLICT (name) DO NOTHING RETURNING *`,
      [name.trim(), description || null]
    );
    if (!rows.length) return res.status(409).json({ error: 'A fee category with that name already exists' });
    await logAudit({ actorId: req.user.id, action: 'FEE_CATEGORY_CREATE', targetType: 'fee_category', targetId: rows[0].id, details: { name } });
    res.status(201).json({ category: rows[0] });
  } catch (err) {
    console.error('[fees] createFeeCategory:', err.message);
    res.status(500).json({ error: 'Failed to create fee category' });
  }
};

/** GET /api/fees/structures — list all fee structures */
export const listFeeStructures = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT fs.*, fc.name AS category_name
       FROM fee_structures fs
       LEFT JOIN fee_categories fc ON fc.id = fs.category_id
       ORDER BY fs.academic_year DESC NULLS LAST, fs.name ASC`
    );
    res.json({ structures: rows });
  } catch (err) {
    console.error('[fees] listFeeStructures:', err.message);
    res.status(500).json({ error: 'Failed to load fee structures' });
  }
};

/** POST /api/fees/structures — create fee structure (super_admin / accounts admin) */
export const createFeeStructure = async (req, res) => {
  const { category_id, fee_category_id, name, academic_year, amount, due_date, late_fee, tax_percentage, discount_percentage, is_active } = req.body;
  const targetCategoryId = category_id || fee_category_id;
  if (!targetCategoryId || !amount) {
    return res.status(400).json({ error: 'category_id and amount are required' });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO fee_structures
         (category_id, name, academic_year, amount, due_date, late_fee, tax_percentage, discount_percentage, is_active)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6, 0.00), COALESCE($7, 0.00), COALESCE($8, 0.00), COALESCE($9, true))
       RETURNING *`,
      [targetCategoryId, name || null, academic_year || '2026-2027', amount, due_date || null, late_fee || 0, tax_percentage || 0, discount_percentage || 0, is_active ?? true]
    );
    await logAudit({ actorId: req.user.id, action: 'FEE_STRUCTURE_CREATE', targetType: 'fee_structure', targetId: rows[0].id, details: { academic_year, amount, name } });
    res.status(201).json({ structure: rows[0] });
  } catch (err) {
    console.error('[fees] createFeeStructure:', err.message);
    res.status(500).json({ error: 'Failed to create fee structure' });
  }
};

// ─────────────────────────────────────────────────────────────────
//  ADMIN — Invoice Generation
// ─────────────────────────────────────────────────────────────────

/** POST /api/fees/invoices/generate — generate invoice for a student */
export const generateInvoice = async (req, res) => {
  const { student_id, fee_structure_id, due_date, notes } = req.body;
  if (!student_id || !fee_structure_id) {
    return res.status(400).json({ error: 'student_id and fee_structure_id are required' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Validate student
    const studentRes = await client.query(
      `SELECT u.id, u.full_name, u.email, sp.roll_number
       FROM users u JOIN student_profiles sp ON sp.user_id = u.id
       WHERE u.id = $1 AND u.is_active = true`,
      [student_id]
    );
    if (!studentRes.rows.length) throw new Error('Student not found or inactive');

    // Validate fee structure
    const structureRes = await client.query(
      `SELECT fs.*, fc.name AS category_name FROM fee_structures fs
       JOIN fee_categories fc ON fc.id = fs.category_id WHERE fs.id = $1`,
      [fee_structure_id]
    );
    if (!structureRes.rows.length) throw new Error('Fee structure not found');

    const structure = structureRes.rows[0];
    const student   = studentRes.rows[0];

    // Check for duplicate unpaid invoice
    const existingRes = await client.query(
      `SELECT id FROM fee_invoices
       WHERE student_id = $1 AND fee_structure_id = $2 AND status NOT IN ('cancelled','refunded')`,
      [student_id, fee_structure_id]
    );
    if (existingRes.rows.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Invoice already exists for this student and fee structure' });
    }

    // Generate invoice number
    const invoiceCount = await client.query('SELECT COUNT(*) FROM fee_invoices');
    const invoiceNumber = `INV-${new Date().getFullYear()}-${String(Number(invoiceCount.rows[0].count) + 1).padStart(6, '0')}`;

    const invoiceRes = await client.query(
      `INSERT INTO fee_invoices
         (student_id, fee_structure_id, invoice_number, amount_due, due_date, status, notes, generated_by)
       VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7)
       RETURNING *`,
      [student_id, fee_structure_id, invoiceNumber, structure.amount, due_date || structure.due_date, notes || null, req.user.id]
    );

    await logAudit({ actorId: req.user.id, action: 'FEE_INVOICE_GENERATE', targetType: 'fee_invoice', targetId: invoiceRes.rows[0].id, details: { student_id, invoiceNumber, amount: structure.amount } });
    await client.query('COMMIT');
    res.status(201).json({ invoice: invoiceRes.rows[0], student, structure });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[fees] generateInvoice:', err.message);
    res.status(400).json({ error: err.message || 'Failed to generate invoice' });
  } finally {
    client.release();
  }
};

/** GET /api/fees/invoices — admin: all invoices (with filters) */
export const listAllInvoices = async (req, res) => {
  const { status, academic_year, student_id } = req.query;
  try {
    const conditions = [];
    const values = [];
    let idx = 1;
    if (status)        { conditions.push(`fi.status = $${idx++}`); values.push(status); }
    if (student_id)    { conditions.push(`fi.student_id = $${idx++}`); values.push(student_id); }
    if (academic_year) { conditions.push(`fs.academic_year = $${idx++}`); values.push(academic_year); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await pool.query(
      `SELECT fi.*, u.full_name AS student_name, COALESCE(sp.student_id, '') AS roll_number,
              fc.name AS category_name, fs.academic_year, fs.amount AS structure_amount
       FROM fee_invoices fi
       JOIN users u ON u.id = fi.student_id
       JOIN student_profiles sp ON sp.user_id = fi.student_id
       JOIN fee_structures fs ON fs.id = fi.fee_structure_id
       JOIN fee_categories fc ON fc.id = fs.category_id
       ${where}
       ORDER BY fi.created_at DESC
       LIMIT 200`,
      values
    );
    res.json({ invoices: rows });
  } catch (err) {
    console.error('[fees] listAllInvoices:', err.message);
    res.status(500).json({ error: 'Failed to load invoices' });
  }
};

// ─────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────
//  STUDENT — My Invoices & Fee Summary
// ─────────────────────────────────────────────────────────────────

/** GET /api/fees/my-invoices — student's own invoices */
export const getMyInvoices = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT fi.*, fc.name AS category_name, fs.academic_year, COALESCE(fi.notes, '') AS structure_description,
              COALESCE(fi.amount_due, fi.final_amount, fi.total_amount, 0) AS amount_due,
              COALESCE(fi.amount_paid, fi.paid_amount, 0) AS amount_paid,
              (COALESCE(fi.amount_due, fi.final_amount, fi.total_amount, 0) - COALESCE(fi.amount_paid, fi.paid_amount, 0)) AS amount_outstanding
       FROM fee_invoices fi
       JOIN fee_structures fs ON fs.id = fi.fee_structure_id
       JOIN fee_categories fc ON fc.id = fs.category_id
       WHERE fi.student_id = $1
       ORDER BY fi.due_date ASC NULLS LAST, fi.created_at DESC`,
      [req.user.id]
    );
    const total_due   = rows.reduce((s, r) => s + parseFloat(r.amount_outstanding || 0), 0);
    const total_paid  = rows.reduce((s, r) => s + parseFloat(r.amount_paid || 0), 0);
    res.json({ invoices: rows, summary: { total_due, total_paid, total_invoices: rows.length } });
  } catch (err) {
    console.error('[fees] getMyInvoices:', err.message);
    res.status(500).json({ error: 'Failed to load your invoices' });
  }
};

// ─────────────────────────────────────────────────────────────────
//  RAZORPAY — Order Creation & Verification
// ─────────────────────────────────────────────────────────────────

/** POST /api/fees/payment/create-order — student creates a payment order */
export const createPaymentOrder = async (req, res) => {
  const { invoice_id } = req.body;
  if (!invoice_id) return res.status(400).json({ error: 'invoice_id is required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verify invoice belongs to student and is payable
    const invoiceRes = await client.query(
      `SELECT fi.*, fc.name AS category_name,
              COALESCE(fi.amount_due, fi.final_amount, fi.total_amount, 0) AS amount_due,
              COALESCE(fi.amount_paid, fi.paid_amount, 0) AS amount_paid
       FROM fee_invoices fi
       JOIN fee_structures fs ON fs.id = fi.fee_structure_id
       JOIN fee_categories fc ON fc.id = fs.category_id
       WHERE fi.id = $1 AND fi.student_id = $2`,
      [invoice_id, req.user.id]
    );
    if (!invoiceRes.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Invoice not found' });
    }
    const invoice = invoiceRes.rows[0];
    if (invoice.status === 'paid') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Invoice is already paid' });
    }
    if (['cancelled', 'refunded'].includes(invoice.status)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Invoice is cancelled or refunded' });
    }

    const amountOutstanding = parseFloat(invoice.amount_due) - parseFloat(invoice.amount_paid || 0);
    if (amountOutstanding <= 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No outstanding amount on this invoice' });
    }

    const orderRef = `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    let razorpayOrderId = null;
    let isTestSimulation = false;

    // Try real Razorpay order creation
    if (razorpay && process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
      try {
        const razorpayOrder = await razorpay.orders.create({
          amount:   Math.round(amountOutstanding * 100),
          currency: 'INR',
          receipt:  invoice.invoice_number.slice(0, 40),
          notes: {
            invoice_id:  invoice_id,
            student_id:  req.user.id,
            category:    invoice.category_name,
          }
        });
        razorpayOrderId = razorpayOrder.id;
      } catch (rzpErr) {
        console.warn('[fees] Razorpay API error, falling back to test sandbox order:', rzpErr.message);
        razorpayOrderId = `order_test_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        isTestSimulation = true;
      }
    } else {
      razorpayOrderId = `order_test_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      isTestSimulation = true;
    }

    // Store pending order in DB
    const { rows: orderRows } = await client.query(
      `INSERT INTO payment_orders
         (student_id, invoice_id, order_reference, razorpay_order_id, amount, currency, status)
       VALUES ($1, $2, $3, $4, $5, 'INR', 'created')
       RETURNING *`,
      [req.user.id, invoice_id, orderRef, razorpayOrderId, amountOutstanding]
    );

    await client.query('COMMIT');
    res.json({
      orderId:       razorpayOrderId,
      amount:        Math.round(amountOutstanding * 100),
      currency:      'INR',
      keyId:         process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder',
      invoiceNumber: invoice.invoice_number,
      paymentOrderId: orderRows[0].id,
      isTestSimulation
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[fees] createPaymentOrder:', err.message);
    res.status(500).json({ error: err.message || 'Failed to create payment order' });
  } finally {
    client.release();
  }
};

/** POST /api/fees/payment/verify — verify Razorpay payment and mark invoice paid */
export const verifyPayment = async (req, res) => {
  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    invoice_id,
    payment_method = 'razorpay_test'
  } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id) {
    return res.status(400).json({ error: 'Missing payment verification fields' });
  }

  // Verify HMAC signature if live signature provided and key configured
  const isSimulation = razorpay_order_id.startsWith('order_test_') || !razorpay_signature;
  if (!isSimulation && process.env.RAZORPAY_KEY_SECRET) {
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      await logAudit({ actorId: req.user.id, action: 'PAYMENT_SIGNATURE_INVALID', targetType: 'payment', details: { razorpay_order_id, razorpay_payment_id } });
      return res.status(400).json({ error: 'Payment signature verification failed. Transaction not trusted.' });
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Find the payment order
    const orderRes = await client.query(
      `SELECT * FROM payment_orders WHERE razorpay_order_id = $1 AND student_id = $2`,
      [razorpay_order_id, req.user.id]
    );
    if (!orderRes.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Payment order not found' });
    }
    const order = orderRes.rows[0];

    const txRef = `TXN-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    // Record the payment
    const { rows: paymentRows } = await client.query(
      `INSERT INTO payments
         (student_id, invoice_id, order_id, payment_order_id, transaction_reference, razorpay_payment_id, razorpay_signature, amount, currency, status, payment_method, paid_at)
       VALUES ($1, $2, $3, $3, $4, $5, $6, $7, 'INR', 'captured', $8, NOW())
       RETURNING *`,
      [req.user.id, invoice_id || order.invoice_id, order.id, txRef, razorpay_payment_id, razorpay_signature || 'test_verified', order.amount, payment_method]
    );

    // Update payment_orders status
    await client.query(
      `UPDATE payment_orders SET status = 'paid', paid_at = NOW() WHERE id = $1`,
      [order.id]
    );

    // Update invoice status to PAID
    const invoiceRes = await client.query(
      `UPDATE fee_invoices
       SET amount_paid = COALESCE(amount_due, final_amount, total_amount),
           paid_amount = COALESCE(final_amount, total_amount),
           balance_amount = 0,
           status = 'paid',
           paid_at = NOW(),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [invoice_id || order.invoice_id]
    );
    const invoice = invoiceRes.rows[0];

    // Generate receipt number
    const receiptCount = await client.query('SELECT COUNT(*) FROM payment_receipts');
    const receiptNumber = `RCP-${new Date().getFullYear()}-${String(Number(receiptCount.rows[0].count) + 1).padStart(6, '0')}`;

    const { rows: receiptRows } = await client.query(
      `INSERT INTO payment_receipts
         (payment_id, student_id, invoice_id, receipt_number, amount, payment_method, razorpay_payment_id, generated_at, issued_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
       RETURNING *`,
      [paymentRows[0].id, req.user.id, invoice_id || order.invoice_id, receiptNumber, order.amount, payment_method, razorpay_payment_id]
    );

    await logAudit({
      actorId: req.user.id,
      action: 'PAYMENT_VERIFIED',
      targetType: 'payment',
      targetId: paymentRows[0].id,
      details: { razorpay_payment_id, amount: order.amount, invoiceStatus: 'paid' }
    });

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Payment verified and recorded successfully',
      receipt: receiptRows[0],
      invoice: { status: 'paid', amount_paid: invoice.amount_paid },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[fees] verifyPayment error:', err.message);
    res.status(500).json({ error: 'Failed to record payment' });
  } finally {
    client.release();
  }
};

/** POST /api/fees/webhooks/razorpay — Razorpay server-to-server webhook */
export const razorpayWebhook = async (req, res) => {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.warn('[Razorpay Webhook] RAZORPAY_WEBHOOK_SECRET not set — skipping verification');
    return res.status(200).json({ received: true });
  }

  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(JSON.stringify(req.body))
    .digest('hex');

  const receivedSignature = req.headers['x-razorpay-signature'];
  if (expectedSignature !== receivedSignature) {
    console.warn('[Razorpay Webhook] Invalid webhook signature');
    return res.status(400).json({ error: 'Invalid webhook signature' });
  }

  const event = req.body.event;
  const payload = req.body.payload?.payment?.entity;
  console.log(`[Razorpay Webhook] Event: ${event}`, payload?.id);

  // Handle payment captured event
  if (event === 'payment.captured' && payload) {
    try {
      await pool.query(
        `UPDATE payments SET status = 'captured' WHERE razorpay_payment_id = $1`,
        [payload.id]
      );
    } catch (err) {
      console.error('[Razorpay Webhook] DB update failed:', err.message);
    }
  }

  res.status(200).json({ received: true });
};

// ─────────────────────────────────────────────────────────────────
//  RECEIPTS & HISTORY
// ─────────────────────────────────────────────────────────────────

/** GET /api/fees/my-receipts — student's payment receipts */
export const getMyReceipts = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT pr.*, 
              COALESCE(pr.generated_at, pr.issued_at) AS payment_date,
              COALESCE(pr.receipt_title, c.name, fs.name, fc.name, fi.invoice_number, 'Campus Fee Payment') AS title,
              c.name AS course_name,
              c.code AS course_code,
              fs.name AS fee_name,
              fc.name AS category_name,
              fi.invoice_number,
              u.full_name AS student_name,
              COALESCE(pr.student_roll, sp.student_id, '') AS student_roll
       FROM payment_receipts pr
       JOIN users u ON u.id = pr.student_id
       LEFT JOIN student_profiles sp ON sp.user_id = u.id
       LEFT JOIN courses c ON c.id = pr.course_id
       LEFT JOIN fee_structures fs ON fs.id = pr.fee_structure_id
       LEFT JOIN fee_categories fc ON fc.id = fs.category_id
       LEFT JOIN fee_invoices fi ON fi.id = pr.invoice_id
       WHERE pr.student_id = $1
       ORDER BY pr.generated_at DESC NULLS LAST, pr.issued_at DESC NULLS LAST`,
      [req.user.id]
    );
    res.json({ receipts: rows });
  } catch (err) {
    console.error('[fees] getMyReceipts:', err.message);
    res.status(500).json({ error: 'Failed to load receipts' });
  }
};

/** GET /api/fees/financial-report — admin financial overview */
export const getFinancialReport = async (req, res) => {
  const { academic_year } = req.query;
  try {
    const yearFilter = academic_year ? `AND fs.academic_year = $1` : '';
    const values = academic_year ? [academic_year] : [];

    const { rows } = await pool.query(
      `SELECT
         fc.name AS category,
         fs.academic_year,
         COUNT(fi.id)                                   AS total_invoices,
         SUM(fi.amount_due)                             AS total_amount_due,
         SUM(COALESCE(fi.amount_paid, 0))               AS total_collected,
         SUM(fi.amount_due - COALESCE(fi.amount_paid,0)) AS total_outstanding,
         COUNT(fi.id) FILTER (WHERE fi.status = 'paid')     AS paid_count,
         COUNT(fi.id) FILTER (WHERE fi.status = 'pending')  AS pending_count
       FROM fee_invoices fi
       JOIN fee_structures fs ON fs.id = fi.fee_structure_id
       JOIN fee_categories fc ON fc.id = fs.category_id
       WHERE fi.status NOT IN ('cancelled')
       ${yearFilter}
       GROUP BY fc.name, fs.academic_year
       ORDER BY fs.academic_year DESC, fc.name`,
      values
    );
    res.json({ report: rows });
  } catch (err) {
    console.error('[fees] getFinancialReport:', err.message);
    res.status(500).json({ error: 'Failed to generate financial report' });
  }
};

// ─────────────────────────────────────────────────────────────────
//  DIRECT PAYMENTS & CATALOG (NO INVOICE REQUIRED)
// ─────────────────────────────────────────────────────────────────

/** GET /api/fees/available-payables — student: available direct courses, fees, and legacy invoices */
export const getAvailablePayables = async (req, res) => {
  try {
    // 1. Available Courses
    const coursesRes = await pool.query(
      `SELECT c.*,
              (
                EXISTS (
                  SELECT 1 FROM course_enrollments ce
                  WHERE ce.course_id = c.id AND ce.student_id = $1 AND ce.status = 'active'
                )
                OR
                EXISTS (
                  SELECT 1 FROM payments p
                  WHERE p.course_id = c.id AND p.student_id = $1 AND (UPPER(p.status) IN ('SUCCESS', 'CAPTURED', 'PAID'))
                )
              ) AS is_enrolled,
              (
                SELECT p.id FROM payments p
                WHERE p.course_id = c.id AND p.student_id = $1 AND (UPPER(p.status) IN ('SUCCESS', 'CAPTURED', 'PAID'))
                ORDER BY p.paid_at DESC NULLS LAST LIMIT 1
              ) AS payment_id,
              (
                SELECT pr.id FROM payment_receipts pr
                WHERE pr.course_id = c.id AND pr.student_id = $1
                ORDER BY pr.generated_at DESC NULLS LAST, pr.issued_at DESC NULLS LAST LIMIT 1
              ) AS receipt_id,
              (
                SELECT pr.receipt_number FROM payment_receipts pr
                WHERE pr.course_id = c.id AND pr.student_id = $1
                ORDER BY pr.generated_at DESC NULLS LAST, pr.issued_at DESC NULLS LAST LIMIT 1
              ) AS receipt_number
       FROM courses c
       WHERE c.is_active = true AND c.is_payable = true
       ORDER BY c.name ASC`,
      [req.user.id]
    );

    // 2. Available Direct Fee Structures
    const feesRes = await pool.query(
      `SELECT fs.*, fc.name AS category_name,
              EXISTS (
                SELECT 1 FROM payments p
                WHERE p.fee_structure_id = fs.id AND p.student_id = $1 AND (UPPER(p.status) IN ('SUCCESS', 'CAPTURED', 'PAID'))
              ) AS is_paid,
              (
                SELECT p.id FROM payments p
                WHERE p.fee_structure_id = fs.id AND p.student_id = $1 AND (UPPER(p.status) IN ('SUCCESS', 'CAPTURED', 'PAID'))
                ORDER BY p.paid_at DESC NULLS LAST LIMIT 1
              ) AS payment_id,
              (
                SELECT pr.id FROM payment_receipts pr
                WHERE pr.fee_structure_id = fs.id AND pr.student_id = $1
                ORDER BY pr.generated_at DESC NULLS LAST, pr.issued_at DESC NULLS LAST LIMIT 1
              ) AS receipt_id,
              (
                SELECT pr.receipt_number FROM payment_receipts pr
                WHERE pr.fee_structure_id = fs.id AND pr.student_id = $1
                ORDER BY pr.generated_at DESC NULLS LAST, pr.issued_at DESC NULLS LAST LIMIT 1
              ) AS receipt_number
       FROM fee_structures fs
       LEFT JOIN fee_categories fc ON fc.id = fs.category_id
       WHERE fs.is_active = true
       ORDER BY fs.due_date ASC NULLS LAST, fs.created_at DESC`,
      [req.user.id]
    );

    // 3. Historical / Outstanding Invoices (if any)
    const invoicesRes = await pool.query(
      `SELECT fi.*, fc.name AS category_name, fs.academic_year,
              COALESCE(fi.amount_due, fi.final_amount, fi.total_amount, 0) AS amount_due,
              COALESCE(fi.amount_paid, fi.paid_amount, 0) AS amount_paid,
              (COALESCE(fi.amount_due, fi.final_amount, fi.total_amount, 0) - COALESCE(fi.amount_paid, fi.paid_amount, 0)) AS amount_outstanding
       FROM fee_invoices fi
       JOIN fee_structures fs ON fs.id = fi.fee_structure_id
       JOIN fee_categories fc ON fc.id = fs.category_id
       WHERE fi.student_id = $1 AND fi.status NOT IN ('cancelled', 'refunded')
       ORDER BY fi.due_date ASC NULLS LAST, fi.created_at DESC`,
      [req.user.id]
    );

    res.json({
      success: true,
      courses: coursesRes.rows,
       feeStructures: feesRes.rows,
       invoices: invoicesRes.rows
     });
   } catch (err) {
     console.error('[fees] getAvailablePayables:', err.message);
     res.status(500).json({ error: 'Failed to load available payables' });
   }
 };
 
 /**
  * POST /api/fees/direct-payment/process OR POST /api/payments
  * Full dummy / direct student payment execution in a single atomic database transaction
  */
 export const processDirectPayment = async (req, res) => {
   if (!req.user) {
     return res.status(401).json({ success: false, message: 'Authentication required. Please log in.' });
   }
 
   const studentId = req.user.id;
   const { item_type, item_id, amount, payment_method = 'dummy_gateway' } = req.body;
 
   if (!item_type || !item_id) {
     return res.status(400).json({ success: false, message: 'item_type and item_id are required fields.' });
   }
   if (!['course', 'fee', 'invoice'].includes(item_type)) {
     return res.status(400).json({ success: false, message: 'Invalid item_type. Must be course, fee, or invoice.' });
   }
 
   const client = await pool.connect();
   try {
     await client.query('BEGIN');
 
     let basePrice = 0;
     let discountPct = 0;
     let taxPct = 0;
     let lateFee = 0;
     let itemTitle = '';
     let courseId = null;
     let feeStructureId = null;
     let invoiceId = null;
 
     if (item_type === 'course') {
       const courseRes = await client.query(
         `SELECT * FROM courses WHERE id = $1 AND is_active = true AND is_payable = true`,
         [item_id]
       );
       if (!courseRes.rows.length) {
         await client.query('ROLLBACK');
         return res.status(404).json({ success: false, message: 'Course not found or currently unavailable for direct payment.' });
       }
       const course = courseRes.rows[0];
 
       // Check existing active enrollment
       const enrollRes = await client.query(
         `SELECT ce.id, pr.id AS receipt_id, pr.receipt_number
          FROM course_enrollments ce
          LEFT JOIN payment_receipts pr ON pr.course_id = ce.course_id AND pr.student_id = ce.student_id
          WHERE ce.course_id = $1 AND ce.student_id = $2 AND ce.status = 'active'
          LIMIT 1`,
         [item_id, studentId]
       );
 
       // Check existing successful payment
       const paymentCheck = await client.query(
         `SELECT p.id, pr.id AS receipt_id, pr.receipt_number
          FROM payments p
          LEFT JOIN payment_receipts pr ON pr.payment_id = p.id
          WHERE p.course_id = $1 AND p.student_id = $2 AND (UPPER(p.status) IN ('SUCCESS', 'CAPTURED', 'PAID'))
          LIMIT 1`,
         [item_id, studentId]
       );
 
       if (enrollRes.rows.length || paymentCheck.rows.length) {
         await client.query('ROLLBACK');
         const existingReceipt = (paymentCheck.rows[0]?.receipt_id || enrollRes.rows[0]?.receipt_id) ? {
           id: paymentCheck.rows[0]?.receipt_id || enrollRes.rows[0]?.receipt_id,
           receipt_number: paymentCheck.rows[0]?.receipt_number || enrollRes.rows[0]?.receipt_number
         } : null;
 
         return res.status(409).json({
           success: false,
           message: 'You have already paid and enrolled in this course.',
           alreadyPaid: true,
           receipt: existingReceipt
         });
       }
 
       basePrice = parseFloat(course.price || 0);
       discountPct = parseFloat(course.discount_percentage || 0);
       taxPct = parseFloat(course.tax_percentage || 0);
       itemTitle = course.name;
       courseId = course.id;
 
     } else if (item_type === 'fee') {
       const feeRes = await client.query(
         `SELECT fs.*, fc.name AS category_name FROM fee_structures fs
          LEFT JOIN fee_categories fc ON fc.id = fs.category_id
          WHERE fs.id = $1 AND fs.is_active = true`,
         [item_id]
       );
       if (!feeRes.rows.length) {
         await client.query('ROLLBACK');
         return res.status(404).json({ success: false, message: 'Fee structure not found or inactive.' });
       }
       const fee = feeRes.rows[0];
 
       // Check existing successful payment
       const paymentCheck = await client.query(
         `SELECT p.id, pr.id AS receipt_id, pr.receipt_number
          FROM payments p
          LEFT JOIN payment_receipts pr ON pr.payment_id = p.id
          WHERE p.fee_structure_id = $1 AND p.student_id = $2 AND (UPPER(p.status) IN ('SUCCESS', 'CAPTURED', 'PAID'))
          LIMIT 1`,
         [item_id, studentId]
       );
 
       if (paymentCheck.rows.length) {
         await client.query('ROLLBACK');
         return res.status(409).json({
           success: false,
           message: 'You have already paid this institutional fee.',
           alreadyPaid: true,
           receipt: paymentCheck.rows[0]?.receipt_id ? {
             id: paymentCheck.rows[0].receipt_id,
             receipt_number: paymentCheck.rows[0].receipt_number
           } : null
         });
       }
 
       basePrice = parseFloat(fee.amount || 0);
       discountPct = parseFloat(fee.discount_percentage || 0);
       taxPct = parseFloat(fee.tax_percentage || 0);
       if (fee.due_date && new Date(fee.due_date) < new Date()) {
         lateFee = parseFloat(fee.late_fee || fee.late_fine_amount || 0);
       }
       itemTitle = fee.name || fee.category_name;
       feeStructureId = fee.id;
 
     } else if (item_type === 'invoice') {
       const invRes = await client.query(
         `SELECT fi.*, fc.name AS category_name FROM fee_invoices fi
          JOIN fee_structures fs ON fs.id = fi.fee_structure_id
          JOIN fee_categories fc ON fc.id = fs.category_id
          WHERE fi.id = $1 AND fi.student_id = $2`,
         [item_id, studentId]
       );
       if (!invRes.rows.length) {
         await client.query('ROLLBACK');
         return res.status(404).json({ success: false, message: 'Invoice not found.' });
       }
       const inv = invRes.rows[0];
       if (inv.status === 'paid') {
         await client.query('ROLLBACK');
         return res.status(409).json({ success: false, message: 'This invoice is already paid.', alreadyPaid: true });
       }
       basePrice = parseFloat(inv.amount_due || inv.final_amount || inv.total_amount || 0) - parseFloat(inv.amount_paid || inv.paid_amount || 0);
       itemTitle = `Invoice ${inv.invoice_number} (${inv.category_name})`;
       invoiceId = inv.id;
       feeStructureId = inv.fee_structure_id;
     }
 
     // Authoritative server-side price calculation
     const discountAmount = Math.round(((basePrice * discountPct) / 100) * 100) / 100;
     const subtotal = Math.max(0, basePrice - discountAmount);
     const taxAmount = Math.round(((subtotal * taxPct) / 100) * 100) / 100;
     const netAmount = Math.round((subtotal + taxAmount + lateFee) * 100) / 100;
 
     if (isNaN(netAmount) || netAmount <= 0) {
       await client.query('ROLLBACK');
       return res.status(400).json({ success: false, message: 'Payable amount must be a valid positive value.' });
     }
 
     // Validate client-sent amount against server authoritative price
     if (amount !== undefined && amount !== null) {
       const clientAmount = parseFloat(amount);
       if (isNaN(clientAmount) || clientAmount <= 0) {
         await client.query('ROLLBACK');
         return res.status(400).json({ success: false, message: 'Invalid payment amount specified.' });
       }
       if (Math.abs(clientAmount - netAmount) > 1.0) {
         await client.query('ROLLBACK');
         return res.status(400).json({
           success: false,
           message: `Payment amount validation failed. University recorded payable is ₹${netAmount}, but received ₹${clientAmount}.`
         });
       }
     }
 
     // Generate unique reference codes: DUMMY-TXN-XXXXXXXX
     const randomHex = crypto.randomBytes(4).toString('hex').toUpperCase();
     const txRef = `DUMMY-TXN-${Date.now().toString(36).toUpperCase()}${randomHex}`;
     const orderRef = `DUMMY-ORD-${Date.now().toString(36).toUpperCase()}${randomHex}`;
 
     // Student details for receipt
     const studentUserRes = await client.query(
       `SELECT u.full_name, COALESCE(sp.student_id, '') AS roll_number
        FROM users u
        LEFT JOIN student_profiles sp ON sp.user_id = u.id
        WHERE u.id = $1`,
       [studentId]
     );
     const studentMeta = studentUserRes.rows[0] || { full_name: req.user.fullName || 'Student', roll_number: '' };
 
     const metadata = {
       itemTitle,
       basePrice,
       discountAmount,
       taxAmount,
       lateFee,
       netAmount,
       studentName: studentMeta.full_name,
       studentRoll: studentMeta.roll_number,
       payment_mode: 'dummy'
     };
 
     // 1. Create order record with status SUCCESS
     const { rows: orderRows } = await client.query(
       `INSERT INTO payment_orders
          (student_id, course_id, fee_structure_id, invoice_id, payment_type, order_reference,
           razorpay_order_id, amount, currency, status, metadata, paid_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'INR', 'SUCCESS', $9, NOW())
        RETURNING *`,
       [studentId, courseId, feeStructureId, invoiceId, item_type, orderRef, orderRef, netAmount, JSON.stringify(metadata)]
     );
     const order = orderRows[0];
 
     // 2. Insert payment record with status 'SUCCESS'
     const { rows: paymentRows } = await client.query(
       `INSERT INTO payments
          (student_id, course_id, fee_structure_id, invoice_id, order_id, payment_order_id, payment_type,
           transaction_reference, razorpay_payment_id, razorpay_signature, amount, net_amount,
           currency, status, payment_method, paid_at, metadata)
        VALUES ($1, $2, $3, $4, $5, $5, $6, $7, $8, 'dummy_verified_signature', $9, $9, 'INR', 'SUCCESS', $10, NOW(), $11)
        RETURNING *`,
       [
         studentId,
         courseId,
         feeStructureId,
         invoiceId,
         order.id,
         item_type,
         txRef,
         txRef,
         netAmount,
         payment_method || 'dummy_gateway',
         JSON.stringify(metadata)
       ]
     );
     const payment = paymentRows[0];
 
     // 3. Auto-enroll student if course payment
     let enrollment = null;
     if (item_type === 'course' && courseId) {
       const enrollRes = await client.query(
         `INSERT INTO course_enrollments (student_id, course_id, payment_id, status, course_fee_at_enrollment, progress, enrolled_at)
          VALUES ($1, $2, $3, 'active', $4, 0, NOW())
          ON CONFLICT (student_id, course_id) DO UPDATE
          SET status = 'active', payment_id = EXCLUDED.payment_id, course_fee_at_enrollment = EXCLUDED.course_fee_at_enrollment, enrolled_at = NOW()
          RETURNING *`,
         [studentId, courseId, payment.id, netAmount]
       );
       enrollment = enrollRes.rows[0];
     }
 
     // 4. Update invoice if invoice payment
     if (invoiceId) {
       await client.query(
         `UPDATE fee_invoices
          SET amount_paid = COALESCE(amount_due, final_amount, total_amount),
              paid_amount = COALESCE(final_amount, total_amount),
              balance_amount = 0,
              status = 'paid',
              paid_at = NOW(),
              updated_at = NOW()
          WHERE id = $1`,
         [invoiceId]
       );
     }
 
     // 5. Generate Official Receipt
     const receiptCount = await client.query('SELECT COUNT(*) FROM payment_receipts');
     const receiptNumber = `RCP-${new Date().getFullYear()}-${String(Number(receiptCount.rows[0].count) + 1).padStart(6, '0')}`;
 
     const { rows: receiptRows } = await client.query(
       `INSERT INTO payment_receipts
          (payment_id, student_id, course_id, fee_structure_id, invoice_id,
           receipt_number, receipt_title, student_name, student_roll,
           amount, payment_method, razorpay_payment_id, generated_at, issued_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
        RETURNING *`,
       [
         payment.id,
         studentId,
         courseId,
         feeStructureId,
         invoiceId,
         receiptNumber,
         itemTitle,
         studentMeta.full_name,
         studentMeta.roll_number,
         netAmount,
         payment_method || 'dummy_gateway',
         txRef
       ]
     );
     const receipt = receiptRows[0];
 
     // 6. Commit the financial transaction immediately
     await client.query('COMMIT');
 
     // 7. In-app Notification (best-effort, outside transaction)
     try {
       await pool.query(
         `INSERT INTO notifications (user_id, title, message, category, notification_type, is_read, created_at)
          VALUES ($1, $2, $3, 'payment', 'payment', false, NOW())`,
         [
           studentId,
           `Payment Confirmed: ${itemTitle}`,
           `Your direct payment of ₹${netAmount} was confirmed. Receipt: ${receiptNumber}. Reference: ${txRef}.`
         ]
       );
     } catch (notifErr) {
       console.warn('[fees] Notification insert error (non-fatal):', notifErr.message);
     }
 
     // 8. Audit Log
     await logAudit({
       userId: studentId,
       action: 'DIRECT_PAYMENT_SUCCESS',
       module: 'fees',
       targetRecordId: payment.id,
       details: {
         receiptNumber,
         transactionReference: txRef,
         amount: netAmount,
         payment_type: item_type,
         course_id: courseId,
         fee_structure_id: feeStructureId,
         is_dummy: true
       }
     });
 
     return res.status(200).json({
       success: true,
       message: 'Payment completed successfully',
       payment: {
         id: payment.id,
         transactionId: payment.transaction_reference,
         status: 'SUCCESS',
         amount: parseFloat(payment.amount),
         currency: 'INR',
         paymentMethod: payment.payment_method,
         paidAt: payment.paid_at
       },
       receipt: {
         id: receipt.id,
         receipt_number: receipt.receipt_number,
         receipt_title: receipt.receipt_title,
         student_name: receipt.student_name,
         student_roll: receipt.student_roll,
         amount: parseFloat(receipt.amount),
         payment_method: receipt.payment_method,
         transaction_reference: payment.transaction_reference,
         generated_at: receipt.generated_at
       },
       enrollment
     });
   } catch (err) {
     await client.query('ROLLBACK');
     console.error('[fees] processDirectPayment error:', err.message);
     return res.status(500).json({
       success: false,
       message: 'Payment execution failed on server. ' + (err.message || 'Please try again.')
     });
   } finally {
     client.release();
   }
 };
 
 /** POST /api/fees/direct-payment/create-order — direct payment order without prior invoice */
 export const createDirectPaymentOrder = async (req, res) => {
  const { item_type, item_id } = req.body;
  if (!item_type || !item_id) {
    return res.status(400).json({ error: 'item_type and item_id are required' });
  }
  if (!['course', 'fee', 'invoice'].includes(item_type)) {
    return res.status(400).json({ error: 'item_type must be course, fee, or invoice' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let basePrice = 0;
    let discountPct = 0;
    let taxPct = 0;
    let lateFee = 0;
    let itemTitle = '';
    let courseId = null;
    let feeStructureId = null;
    let invoiceId = null;

    if (item_type === 'course') {
      const courseRes = await client.query(
        `SELECT * FROM courses WHERE id = $1 AND is_active = true AND is_payable = true`,
        [item_id]
      );
      if (!courseRes.rows.length) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Course not found or not available for direct payment' });
      }
      const course = courseRes.rows[0];

      // Prevent duplicate enrollment or completed payment
      const enrollRes = await client.query(
        `SELECT id FROM course_enrollments WHERE course_id = $1 AND student_id = $2 AND status = 'active'`,
        [item_id, req.user.id]
      );
      const paidRes = await client.query(
        `SELECT id FROM payments WHERE course_id = $1 AND student_id = $2 AND (UPPER(status) IN ('SUCCESS', 'CAPTURED', 'PAID'))`,
        [item_id, req.user.id]
      );
      if (enrollRes.rows.length || paidRes.rows.length) {
        await client.query('ROLLBACK');
        return res.status(409).json({ success: false, message: 'You have already paid and enrolled in this course', alreadyPaid: true });
      }

      basePrice = parseFloat(course.price || 0);
      discountPct = parseFloat(course.discount_percentage || 0);
      taxPct = parseFloat(course.tax_percentage || 0);
      itemTitle = course.name;
      courseId = course.id;
    } else if (item_type === 'fee') {
      const feeRes = await client.query(
        `SELECT fs.*, fc.name AS category_name FROM fee_structures fs
         LEFT JOIN fee_categories fc ON fc.id = fs.category_id
         WHERE fs.id = $1 AND fs.is_active = true`,
        [item_id]
      );
      if (!feeRes.rows.length) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, message: 'Fee structure not found or inactive' });
      }
      const fee = feeRes.rows[0];

      // Prevent duplicate fee payment
      const paidRes = await client.query(
        `SELECT id FROM payments WHERE fee_structure_id = $1 AND student_id = $2 AND (UPPER(status) IN ('SUCCESS', 'CAPTURED', 'PAID'))`,
        [item_id, req.user.id]
      );
      if (paidRes.rows.length) {
        await client.query('ROLLBACK');
        return res.status(409).json({ success: false, message: 'You have already paid this fee', alreadyPaid: true });
      }

      basePrice = parseFloat(fee.amount || 0);
      discountPct = parseFloat(fee.discount_percentage || 0);
      taxPct = parseFloat(fee.tax_percentage || 0);
      if (fee.due_date && new Date(fee.due_date) < new Date()) {
        lateFee = parseFloat(fee.late_fee || fee.late_fine_amount || 0);
      }
      itemTitle = fee.name || fee.category_name;
      feeStructureId = fee.id;
    } else if (item_type === 'invoice') {
      const invRes = await client.query(
        `SELECT fi.*, fc.name AS category_name FROM fee_invoices fi
         JOIN fee_structures fs ON fs.id = fi.fee_structure_id
         JOIN fee_categories fc ON fc.id = fs.category_id
         WHERE fi.id = $1 AND fi.student_id = $2`,
        [item_id, req.user.id]
      );
      if (!invRes.rows.length) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, message: 'Invoice not found' });
      }
      const inv = invRes.rows[0];
      if (inv.status === 'paid') {
        await client.query('ROLLBACK');
        return res.status(409).json({ success: false, message: 'Invoice is already paid', alreadyPaid: true });
      }
      basePrice = parseFloat(inv.amount_due || inv.final_amount || inv.total_amount || 0) - parseFloat(inv.amount_paid || inv.paid_amount || 0);
      itemTitle = `Invoice ${inv.invoice_number} (${inv.category_name})`;
      invoiceId = inv.id;
      feeStructureId = inv.fee_structure_id;
    }

    // Server-side calculated net amount
    const discountAmount = Math.round(((basePrice * discountPct) / 100) * 100) / 100;
    const subtotal = Math.max(0, basePrice - discountAmount);
    const taxAmount = Math.round(((subtotal * taxPct) / 100) * 100) / 100;
    const netAmount = Math.round((subtotal + taxAmount + lateFee) * 100) / 100;

    if (netAmount <= 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Payable amount must be greater than zero' });
    }

    const randomHex = crypto.randomBytes(4).toString('hex').toUpperCase();
    const orderRef = `DUMMY-ORD-${Date.now().toString(36).toUpperCase()}${randomHex}`;
    let razorpayOrderId = null;
    let isTestSimulation = false;

    const isDummyMode = process.env.PAYMENT_MODE === 'dummy' || !process.env.RAZORPAY_KEY_ID?.startsWith('rzp_live');
    if (!isDummyMode && razorpay && process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
      try {
        const razorpayOrder = await razorpay.orders.create({
          amount: Math.round(netAmount * 100),
          currency: 'INR',
          receipt: orderRef.slice(0, 40),
          notes: {
            item_type,
            item_id,
            student_id: req.user.id,
            item_title: itemTitle.slice(0, 40)
          }
        });
        razorpayOrderId = razorpayOrder.id;
      } catch (rzpErr) {
        console.warn('[fees] Razorpay fallback to test sandbox order:', rzpErr.message);
        razorpayOrderId = `order_dummy_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        isTestSimulation = true;
      }
    } else {
      razorpayOrderId = `order_dummy_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      isTestSimulation = true;
    }

    const metadata = {
      itemTitle,
      basePrice,
      discountAmount,
      taxAmount,
      lateFee,
      netAmount
    };

    const { rows: orderRows } = await client.query(
      `INSERT INTO payment_orders
         (student_id, course_id, fee_structure_id, invoice_id, payment_type, order_reference, razorpay_order_id, amount, currency, status, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'INR', 'created', $9)
       RETURNING *`,
      [req.user.id, courseId, feeStructureId, invoiceId, item_type, orderRef, razorpayOrderId, netAmount, JSON.stringify(metadata)]
    );

    await client.query('COMMIT');

    res.json({
      orderId: razorpayOrderId,
      amount: Math.round(netAmount * 100),
      netAmount,
      currency: 'INR',
      keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder',
      itemTitle,
      itemType: item_type,
      itemId: item_id,
      paymentOrderId: orderRows[0].id,
      breakdown: {
        basePrice,
        discountAmount,
        taxAmount,
        lateFee,
        netAmount
      },
      isTestSimulation
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[fees] createDirectPaymentOrder:', err.message);
    res.status(500).json({ error: err.message || 'Failed to create payment order' });
  } finally {
    client.release();
  }
};

/** POST /api/fees/direct-payment/verify — verify direct payment and fulfill */
export const verifyDirectPayment = async (req, res) => {
  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    payment_order_id,
    payment_method = 'razorpay_checkout'
  } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id) {
    return res.status(400).json({ success: false, message: 'Missing payment verification fields' });
  }

  // Simulation detection
  const isSimulation =
    razorpay_order_id.startsWith('order_test_') ||
    razorpay_order_id.startsWith('order_dummy_') ||
    razorpay_order_id.startsWith('DUMMY-ORD') ||
    !razorpay_signature ||
    razorpay_signature === 'sandbox_verified_signature' ||
    razorpay_signature === 'dummy_verified_signature' ||
    process.env.PAYMENT_MODE === 'dummy';

  // HMAC verification if live keys & non-simulation
  if (!isSimulation && process.env.RAZORPAY_KEY_SECRET) {
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      await logAudit({
        actorId: req.user.id,
        action: 'PAYMENT_SIGNATURE_INVALID',
        targetType: 'payment',
        details: { razorpay_order_id, razorpay_payment_id }
      });
      return res.status(400).json({ success: false, message: 'Payment signature verification failed. Transaction rejected.' });
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Retrieve order
    const orderRes = await client.query(
      `SELECT * FROM payment_orders WHERE (razorpay_order_id = $1 OR id = $2) AND student_id = $3`,
      [razorpay_order_id, payment_order_id || null, req.user.id]
    );

    if (!orderRes.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Payment order record not found' });
    }
    const order = orderRes.rows[0];

    // Idempotency check: if order is already marked paid or SUCCESS, return existing receipt
    if (['paid', 'SUCCESS', 'captured'].includes(order.status)) {
      const existingReceipt = await client.query(
        `SELECT * FROM payment_receipts WHERE payment_id IN (SELECT id FROM payments WHERE order_id = $1)`,
        [order.id]
      );
      const existingPayment = await client.query(
        `SELECT * FROM payments WHERE order_id = $1`,
        [order.id]
      );
      await client.query('COMMIT');
      return res.json({
        success: true,
        message: 'Payment already verified',
        payment: existingPayment.rows[0] || null,
        receipt: existingReceipt.rows[0] || null
      });
    }

    const randomHex = crypto.randomBytes(4).toString('hex').toUpperCase();
    const txRef = isSimulation
      ? `DUMMY-TXN-${Date.now().toString(36).toUpperCase()}${randomHex}`
      : `TXN-${Date.now()}-${randomHex}`;

    // Student profile details for receipt
    const studentUserRes = await client.query(
      `SELECT u.full_name, COALESCE(sp.student_id, '') AS roll_number
       FROM users u
       LEFT JOIN student_profiles sp ON sp.user_id = u.id
       WHERE u.id = $1`,
      [req.user.id]
    );
    const studentMeta = studentUserRes.rows[0] || { full_name: req.user.fullName || 'Student', roll_number: '' };

    const metadata = typeof order.metadata === 'string' ? JSON.parse(order.metadata || '{}') : (order.metadata || {});
    const itemTitle = metadata.itemTitle || (order.payment_type === 'course' ? 'Course Enrollment' : 'Campus Fee Payment');

    // Insert payment with status SUCCESS
    const { rows: paymentRows } = await client.query(
      `INSERT INTO payments
         (student_id, course_id, fee_structure_id, invoice_id, order_id, payment_order_id, payment_type,
          transaction_reference, razorpay_payment_id, razorpay_signature, amount, net_amount,
          currency, status, payment_method, paid_at, metadata)
       VALUES ($1, $2, $3, $4, $5, $5, $6, $7, $8, $9, $10, $10, 'INR', 'SUCCESS', $11, NOW(), $12)
       RETURNING *`,
      [
        req.user.id,
        order.course_id,
        order.fee_structure_id,
        order.invoice_id,
        order.id,
        order.payment_type,
        txRef,
        razorpay_payment_id || txRef,
        razorpay_signature || 'simulation_verified',
        order.amount,
        payment_method,
        JSON.stringify(metadata)
      ]
    );
    const payment = paymentRows[0];

    // Update order status to SUCCESS
    await client.query(
      `UPDATE payment_orders SET status = 'SUCCESS', paid_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [order.id]
    );

    // If Course: Auto-enroll student
    let enrollment = null;
    if (order.payment_type === 'course' && order.course_id) {
      const enrollRes = await client.query(
        `INSERT INTO course_enrollments (student_id, course_id, payment_id, status, enrolled_at)
         VALUES ($1, $2, $3, 'active', NOW())
         ON CONFLICT (student_id, course_id) DO UPDATE SET status = 'active', payment_id = EXCLUDED.payment_id
         RETURNING *`,
        [req.user.id, order.course_id, payment.id]
      );
      enrollment = enrollRes.rows[0];
    }

    // If Invoice: Mark invoice as paid
    if (order.invoice_id) {
      await client.query(
        `UPDATE fee_invoices
         SET amount_paid = COALESCE(amount_due, final_amount, total_amount),
             paid_amount = COALESCE(final_amount, total_amount),
             balance_amount = 0,
             status = 'paid',
             paid_at = NOW(),
             updated_at = NOW()
         WHERE id = $1`,
        [order.invoice_id]
      );
    }

    // Generate Receipt Number
    const receiptCount = await client.query('SELECT COUNT(*) FROM payment_receipts');
    const receiptNumber = `RCP-${new Date().getFullYear()}-${String(Number(receiptCount.rows[0].count) + 1).padStart(6, '0')}`;

    const { rows: receiptRows } = await client.query(
      `INSERT INTO payment_receipts
         (payment_id, student_id, course_id, fee_structure_id, invoice_id,
          receipt_number, receipt_title, student_name, student_roll,
          amount, payment_method, razorpay_payment_id, generated_at, issued_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
       RETURNING *`,
      [
        payment.id,
        req.user.id,
        order.course_id,
        order.fee_structure_id,
        order.invoice_id,
        receiptNumber,
        itemTitle,
        studentMeta.full_name,
        studentMeta.roll_number,
        order.amount,
        payment_method,
        razorpay_payment_id || txRef
      ]
    );
    const receipt = receiptRows[0];

    // In-app Notification
    try {
      await client.query(
        `INSERT INTO notifications (user_id, title, message, notification_type, is_read, created_at)
         VALUES ($1, $2, $3, 'payment', false, NOW())`,
        [
          req.user.id,
          `Payment Confirmed: ${itemTitle}`,
          `Your payment of ₹${order.amount} was confirmed. Receipt No: ${receiptNumber}. Transaction: ${txRef}.`
        ]
      );
    } catch (notifErr) {
      console.warn('[fees] Notification insert error (non-fatal):', notifErr.message);
    }

    await logAudit({
      actorId: req.user.id,
      action: 'DIRECT_PAYMENT_SUCCESS',
      targetType: 'payment',
      targetId: payment.id,
      details: {
        receiptNumber,
        transactionReference: txRef,
        amount: order.amount,
        payment_type: order.payment_type,
        course_id: order.course_id,
        fee_structure_id: order.fee_structure_id
      }
    });

    await client.query('COMMIT');

    res.status(200).json({
      success: true,
      message: 'Payment completed and verified successfully',
      payment: {
        id: payment.id,
        transactionId: payment.transaction_reference,
        status: 'SUCCESS',
        amount: parseFloat(payment.amount),
        currency: 'INR',
        paymentMethod: payment.payment_method,
        paidAt: payment.paid_at
      },
      receipt: {
        id: receipt.id,
        receipt_number: receipt.receipt_number,
        receipt_title: receipt.receipt_title,
        student_name: receipt.student_name,
        student_roll: receipt.student_roll,
        amount: parseFloat(receipt.amount),
        payment_method: receipt.payment_method,
        transaction_reference: payment.transaction_reference,
        generated_at: receipt.generated_at
      },
      enrollment
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[fees] verifyDirectPayment error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to verify payment and record transaction. ' + (err.message || '') });
  } finally {
    client.release();
  }
};

/** GET /api/fees/my-payments — student's complete unified payment history */
export const getMyPayments = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.*,
              COALESCE(pr.receipt_number, '') AS receipt_number,
              COALESCE(pr.id, NULL) AS receipt_id,
              COALESCE(pr.receipt_title, c.name, fs.name, fi.invoice_number, 'Campus Payment') AS item_title,
              c.name AS course_name,
              c.code AS course_code,
              fs.name AS fee_name,
              fi.invoice_number
       FROM payments p
       LEFT JOIN payment_receipts pr ON pr.payment_id = p.id
       LEFT JOIN courses c ON c.id = p.course_id
       LEFT JOIN fee_structures fs ON fs.id = p.fee_structure_id
       LEFT JOIN fee_invoices fi ON fi.id = p.invoice_id
       WHERE p.student_id = $1
       ORDER BY p.paid_at DESC NULLS LAST, p.created_at DESC`,
      [req.user.id]
    );
    res.json({ payments: rows });
  } catch (err) {
    console.error('[fees] getMyPayments:', err.message);
    res.status(500).json({ error: 'Failed to load payment history' });
  }
};

/** GET /api/fees/my-courses — student's enrolled courses */
export const getMyCourses = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT ce.*, c.name, c.code, c.description, c.duration, c.price,
              p.transaction_reference, p.paid_at,
              pr.receipt_number, pr.id AS receipt_id
       FROM course_enrollments ce
       JOIN courses c ON c.id = ce.course_id
       LEFT JOIN payments p ON p.id = ce.payment_id
       LEFT JOIN payment_receipts pr ON pr.payment_id = p.id
       WHERE ce.student_id = $1
       ORDER BY ce.enrolled_at DESC`,
      [req.user.id]
    );
    res.json({ courses: rows });
  } catch (err) {
    console.error('[fees] getMyCourses:', err.message);
    res.status(500).json({ error: 'Failed to load enrolled courses' });
  }
};

/** GET /api/fees/admin/transactions — admin unified transaction ledger */
export const getAdminTransactions = async (req, res) => {
  const { status, payment_type, search, date_from, date_to } = req.query;
  try {
    const conditions = [];
    const values = [];
    let idx = 1;

    if (status) {
      conditions.push(`p.status = $${idx++}`);
      values.push(status);
    }
    if (payment_type) {
      conditions.push(`p.payment_type = $${idx++}`);
      values.push(payment_type);
    }
    if (date_from) {
      conditions.push(`p.paid_at >= $${idx++}`);
      values.push(date_from);
    }
    if (date_to) {
      conditions.push(`p.paid_at <= $${idx++}`);
      values.push(date_to);
    }
    if (search) {
      conditions.push(`(u.full_name ILIKE $${idx} OR u.email ILIKE $${idx} OR sp.student_id ILIKE $${idx} OR p.transaction_reference ILIKE $${idx} OR pr.receipt_number ILIKE $${idx} OR c.name ILIKE $${idx})`);
      values.push(`%${search}%`);
      idx++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await pool.query(
      `SELECT p.*,
              u.full_name AS student_name,
              u.email AS student_email,
              COALESCE(sp.student_id, '') AS student_roll,
              COALESCE(pr.receipt_number, '') AS receipt_number,
              COALESCE(pr.id, NULL) AS receipt_id,
              COALESCE(pr.receipt_title, c.name, fs.name, fi.invoice_number, 'Campus Payment') AS item_title,
              c.name AS course_name,
              fs.name AS fee_name
       FROM payments p
       JOIN users u ON u.id = p.student_id
       LEFT JOIN student_profiles sp ON sp.user_id = u.id
       LEFT JOIN payment_receipts pr ON pr.payment_id = p.id
       LEFT JOIN courses c ON c.id = p.course_id
       LEFT JOIN fee_structures fs ON fs.id = p.fee_structure_id
       LEFT JOIN fee_invoices fi ON fi.id = p.invoice_id
       ${where}
       ORDER BY p.paid_at DESC NULLS LAST, p.created_at DESC
       LIMIT 300`,
      values
    );

    // Summary calculations
    const summaryRes = await pool.query(
      `SELECT
         COUNT(p.id) AS total_transactions,
         SUM(CASE WHEN UPPER(p.status) IN ('SUCCESS', 'CAPTURED', 'PAID') THEN p.amount ELSE 0 END) AS total_revenue,
         COUNT(CASE WHEN UPPER(p.status) IN ('SUCCESS', 'CAPTURED', 'PAID') THEN 1 END) AS captured_count,
         COUNT(CASE WHEN UPPER(p.status) = 'FAILED' THEN 1 END) AS failed_count,
         SUM(CASE WHEN UPPER(p.status) IN ('SUCCESS', 'CAPTURED', 'PAID') AND p.payment_type = 'course' THEN p.amount ELSE 0 END) AS course_revenue,
         SUM(CASE WHEN UPPER(p.status) IN ('SUCCESS', 'CAPTURED', 'PAID') AND p.payment_type = 'fee' THEN p.amount ELSE 0 END) AS fee_revenue
       FROM payments p`
    );

    res.json({
      transactions: rows,
      summary: summaryRes.rows[0]
    });
  } catch (err) {
    console.error('[fees] getAdminTransactions:', err.message);
    res.status(500).json({ error: 'Failed to load transaction ledger' });
  }
};

/** GET /api/fees/admin/courses — list courses with pricing configurations */
export const listAdminCourses = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.*,
              COUNT(ce.id) FILTER (WHERE ce.status = 'active') AS active_students_count,
              SUM(CASE WHEN UPPER(p.status) IN ('SUCCESS', 'CAPTURED', 'PAID') THEN p.amount ELSE 0 END) AS total_revenue
       FROM courses c
       LEFT JOIN course_enrollments ce ON ce.course_id = c.id
       LEFT JOIN payments p ON p.course_id = c.id
       GROUP BY c.id
       ORDER BY c.name ASC`
    );
    res.json({ courses: rows });
  } catch (err) {
    console.error('[fees] listAdminCourses:', err.message);
    res.status(500).json({ error: 'Failed to list courses' });
  }
};

/** PATCH /api/fees/admin/courses/:id — update course pricing and payment configuration */
export const updateAdminCourse = async (req, res) => {
  const { id } = req.params;
  const { price, duration, eligibility, is_payable, is_active, discount_percentage, tax_percentage, description } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE courses
       SET price = COALESCE($1, price),
           duration = COALESCE($2, duration),
           eligibility = COALESCE($3, eligibility),
           is_payable = COALESCE($4, is_payable),
           is_active = COALESCE($5, is_active),
           discount_percentage = COALESCE($6, discount_percentage),
           tax_percentage = COALESCE($7, tax_percentage),
           description = COALESCE($8, description)
       WHERE id = $9
       RETURNING *`,
      [price, duration, eligibility, is_payable, is_active, discount_percentage, tax_percentage, description, id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Course not found' });
    await logAudit({
      actorId: req.user.id,
      action: 'COURSE_PRICING_UPDATED',
      targetType: 'course',
      targetId: id,
      details: { price, is_payable, is_active }
    });
    res.json({ course: rows[0] });
  } catch (err) {
    console.error('[fees] updateAdminCourse:', err.message);
    res.status(500).json({ error: 'Failed to update course' });
  }
};

/** PATCH /api/fees/structures/:id — update fee structure config */
export const updateFeeStructure = async (req, res) => {
  const { id } = req.params;
  const { name, amount, due_date, late_fee, tax_percentage, discount_percentage, is_active } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE fee_structures
       SET name = COALESCE($1, name),
           amount = COALESCE($2, amount),
           due_date = COALESCE($3, due_date),
           late_fee = COALESCE($4, late_fee),
           tax_percentage = COALESCE($5, tax_percentage),
           discount_percentage = COALESCE($6, discount_percentage),
           is_active = COALESCE($7, is_active)
       WHERE id = $8
       RETURNING *`,
      [name, amount, due_date, late_fee, tax_percentage, discount_percentage, is_active, id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Fee structure not found' });
    await logAudit({
      actorId: req.user.id,
      action: 'FEE_STRUCTURE_UPDATED',
      targetType: 'fee_structure',
      targetId: id,
      details: { name, amount, is_active }
    });
    res.json({ structure: rows[0] });
  } catch (err) {
    console.error('[fees] updateFeeStructure:', err.message);
    res.status(500).json({ error: 'Failed to update fee structure' });
  }
};

