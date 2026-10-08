-- Migration 003: Comprehensive schema repair & enhancement
-- Harmonizes student profiles, invoices, payments, documents, and adds achievements

-- 1. student_profiles enhancements
ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(255);
ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS emergency_contact_phone VARCHAR(50);
ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS blood_group VARCHAR(10);
ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active';

-- 2. fee_invoices enhancements & aliases
ALTER TABLE fee_invoices ADD COLUMN IF NOT EXISTS amount_due NUMERIC(12,2);
ALTER TABLE fee_invoices ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(12,2) DEFAULT 0;
ALTER TABLE fee_invoices ADD COLUMN IF NOT EXISTS balance_amount NUMERIC(12,2);
ALTER TABLE fee_invoices ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE fee_invoices ADD COLUMN IF NOT EXISTS generated_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE fee_invoices ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

-- Drop check constraint on status so it supports both naming conventions
ALTER TABLE fee_invoices DROP CONSTRAINT IF EXISTS fee_invoices_status_check;
ALTER TABLE fee_invoices ADD CONSTRAINT fee_invoices_status_check 
  CHECK(status IN ('unpaid', 'partially_paid', 'paid', 'overdue', 'pending', 'partial', 'cancelled', 'refunded'));

-- Populate amount_due and amount_paid for existing invoices if any
DO $$
BEGIN
  UPDATE fee_invoices SET 
    amount_due = COALESCE(amount_due, final_amount, total_amount),
    amount_paid = COALESCE(amount_paid, paid_amount, 0),
    balance_amount = COALESCE(balance_amount, final_amount - COALESCE(paid_amount, 0))
  WHERE amount_due IS NULL;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- 3. payment_orders enhancements
ALTER TABLE payment_orders ALTER COLUMN order_reference DROP NOT NULL;
ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

-- 4. payments enhancements
ALTER TABLE payments ALTER COLUMN transaction_reference DROP NOT NULL;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_order_id UUID REFERENCES payment_orders(id) ON DELETE SET NULL;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'INR';

-- 5. payment_receipts enhancements
ALTER TABLE payment_receipts ADD COLUMN IF NOT EXISTS generated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE payment_receipts ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT 'razorpay';
ALTER TABLE payment_receipts ADD COLUMN IF NOT EXISTS razorpay_payment_id VARCHAR(255);

-- 6. documents enhancements
ALTER TABLE documents ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS document_type VARCHAR(100);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_name VARCHAR(255);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS target_audience VARCHAR(100) DEFAULT 'all';
ALTER TABLE documents ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id) ON DELETE SET NULL;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Sync document_type with category and uploaded_by with owner_id
DO $$
BEGIN
  UPDATE documents SET 
    document_type = COALESCE(document_type, category, 'general'),
    uploaded_by = COALESCE(uploaded_by, owner_id)
  WHERE document_type IS NULL OR uploaded_by IS NULL;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- 7. student_achievements table
CREATE TABLE IF NOT EXISTS student_achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    issuing_organization VARCHAR(255) NOT NULL,
    achievement_date DATE NOT NULL,
    description TEXT,
    file_url TEXT,
    file_name VARCHAR(255),
    file_type VARCHAR(100),
    file_size INT,
    is_verified BOOLEAN DEFAULT false,
    verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_student_achievements_student ON student_achievements(student_id);
