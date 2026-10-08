import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import {
  processDirectPayment,
  getMyPayments,
  getMyReceipts
} from '../controllers/fees.controller.js';

const router = Router();

router.use(authenticate);

// POST /api/payments — Direct student payment (courses, fees, invoices)
router.post('/', requireRole(['student']), processDirectPayment);

// GET /api/payments/my — Student's unified payment history
router.get('/my', requireRole(['student']), getMyPayments);

// GET /api/payments/receipts/my — Student's receipts
router.get('/receipts/my', requireRole(['student']), getMyReceipts);

export default router;
