import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import {
  listFeeCategories,
  createFeeCategory,
  listFeeStructures,
  createFeeStructure,
  updateFeeStructure,
  generateInvoice,
  listAllInvoices,
  getMyInvoices,
  createPaymentOrder,
  verifyPayment,
  razorpayWebhook,
  getMyReceipts,
  getFinancialReport,
  getAvailablePayables,
  createDirectPaymentOrder,
  verifyDirectPayment,
  processDirectPayment,
  getMyPayments,
  getMyCourses,
  getAdminTransactions,
  listAdminCourses,
  updateAdminCourse,
} from '../controllers/fees.controller.js';

const router = Router();

// ── Razorpay Webhook (raw body, unauthenticated — Razorpay posts here) ──────
router.post('/webhooks/razorpay', razorpayWebhook);

// ── Auth required below ───────────────────────────────────────────────────────
router.use(authenticate);

// ── Fee Categories (admin) ─────────────────────────────────────────────────────
router.get('/categories',
  requireRole(['super_admin', 'delegated_admin']),
  listFeeCategories
);
router.post('/categories',
  requireRole(['super_admin']),
  createFeeCategory
);

// ── Fee Structures (admin) ─────────────────────────────────────────────────────
router.get('/structures',
  requireRole(['super_admin', 'delegated_admin']),
  listFeeStructures
);
router.post('/structures',
  requireRole(['super_admin', 'delegated_admin']),
  createFeeStructure
);
router.patch('/structures/:id',
  requireRole(['super_admin', 'delegated_admin']),
  updateFeeStructure
);

// ── Course Pricing & Payment Config (admin) ──────────────────────────────────
router.get('/admin/courses',
  requireRole(['super_admin', 'delegated_admin']),
  listAdminCourses
);
router.patch('/admin/courses/:id',
  requireRole(['super_admin', 'delegated_admin']),
  updateAdminCourse
);

// ── Transaction Ledger (admin) ───────────────────────────────────────────────
router.get('/admin/transactions',
  requireRole(['super_admin', 'delegated_admin']),
  getAdminTransactions
);

// ── Invoices (admin — legacy/archive support) ──────────────────────────────────
router.post('/invoices/generate',
  requireRole(['super_admin', 'delegated_admin']),
  generateInvoice
);
router.get('/invoices',
  requireRole(['super_admin', 'delegated_admin']),
  listAllInvoices
);

// ── Financial Report (admin) ───────────────────────────────────────────────────
router.get('/financial-report',
  requireRole(['super_admin', 'delegated_admin']),
  getFinancialReport
);

// ── Student Direct Payables & Enrollment ──────────────────────────────────────
router.get('/available-payables',
  requireRole(['student']),
  getAvailablePayables
);
router.get('/my-courses',
  requireRole(['student']),
  getMyCourses
);
router.get('/my-payments',
  requireRole(['student']),
  getMyPayments
);
router.get('/my-invoices',
  requireRole(['student']),
  getMyInvoices
);
router.get('/my-receipts',
  requireRole(['student']),
  getMyReceipts
);

// ── Direct Payment Flow (Modern — No Invoice Needed) ──────────────────────────
router.post('/direct-payment/process',
  requireRole(['student']),
  processDirectPayment
);
router.post('/direct-payment/create-order',
  requireRole(['student']),
  createDirectPaymentOrder
);
router.post('/direct-payment/verify',
  requireRole(['student']),
  verifyDirectPayment
);

// ── Legacy Payment Flow (Backward compatibility) ─────────────────────────────
router.post('/payment/create-order',
  requireRole(['student']),
  createPaymentOrder
);
router.post('/payment/verify',
  requireRole(['student']),
  verifyPayment
);

export default router;
