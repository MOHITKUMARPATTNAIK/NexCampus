-- ============================================================================
-- Migration 005: Dummy Direct Payment System, Status Normalization & Safety
-- ============================================================================

-- 1. Relax and expand check constraints on payments.status to support standard 'SUCCESS', 'PENDING', 'FAILED', 'REFUNDED'
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_status_check;
ALTER TABLE payments ADD CONSTRAINT payments_status_check 
  CHECK (UPPER(status) IN ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED') OR status IN ('pending', 'captured', 'paid', 'failed', 'refunded'));

-- 2. Relax and expand check constraints on payment_orders.status
ALTER TABLE payment_orders DROP CONSTRAINT IF EXISTS payment_orders_status_check;
ALTER TABLE payment_orders ADD CONSTRAINT payment_orders_status_check 
  CHECK (UPPER(status) IN ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED') OR status IN ('created', 'attempted', 'paid', 'failed'));

-- 3. High-performance indexes for duplicate payment lookups and dashboard queries
CREATE INDEX IF NOT EXISTS idx_payments_student_course ON payments(student_id, course_id, status);
CREATE INDEX IF NOT EXISTS idx_payments_student_fee_struct ON payments(student_id, fee_structure_id, status);
CREATE INDEX IF NOT EXISTS idx_payments_student_status ON payments(student_id, status);
CREATE INDEX IF NOT EXISTS idx_receipts_student_course ON payment_receipts(student_id, course_id);
CREATE INDEX IF NOT EXISTS idx_receipts_student_fee ON payment_receipts(student_id, fee_structure_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_student_status ON course_enrollments(student_id, status);
