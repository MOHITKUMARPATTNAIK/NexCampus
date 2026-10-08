-- Migration 004: Direct Student Payments, Course Enrollments & Multi-Language Support
-- Removes invoice requirement for new payments, enables direct Pay Now on courses/fees, and provides i18n support.

-- 1. Enhance courses table for direct purchase & pricing
ALTER TABLE courses ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS price NUMERIC(12,2) DEFAULT 0.00;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS duration VARCHAR(100) DEFAULT '1 Semester';
ALTER TABLE courses ADD COLUMN IF NOT EXISTS eligibility TEXT DEFAULT 'All Enrolled Students';
ALTER TABLE courses ADD COLUMN IF NOT EXISTS is_payable BOOLEAN DEFAULT true;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS discount_percentage NUMERIC(5,2) DEFAULT 0.00;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS tax_percentage NUMERIC(5,2) DEFAULT 0.00;

-- 2. Course Enrollments table (links student to enrolled courses)
CREATE TABLE IF NOT EXISTS course_enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'dropped')),
    enrolled_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_course_enrollments_student ON course_enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_course_enrollments_course ON course_enrollments(course_id);

-- 3. Enhance fee_structures for direct fee payment configuration
ALTER TABLE fee_structures ADD COLUMN IF NOT EXISTS name VARCHAR(255);
ALTER TABLE fee_structures ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE fee_structures ADD COLUMN IF NOT EXISTS late_fee NUMERIC(12,2) DEFAULT 0.00;
ALTER TABLE fee_structures ADD COLUMN IF NOT EXISTS tax_percentage NUMERIC(5,2) DEFAULT 0.00;
ALTER TABLE fee_structures ADD COLUMN IF NOT EXISTS discount_percentage NUMERIC(5,2) DEFAULT 0.00;

-- Populate name from category if not set
DO $$
BEGIN
  UPDATE fee_structures fs
  SET name = fc.name
  FROM fee_categories fc
  WHERE fs.category_id = fc.id AND fs.name IS NULL;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- 4. Enhance payment_orders for direct payments
ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES courses(id) ON DELETE SET NULL;
ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS fee_structure_id UUID REFERENCES fee_structures(id) ON DELETE SET NULL;
ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS payment_type VARCHAR(50) DEFAULT 'fee' CHECK (payment_type IN ('course', 'fee', 'invoice'));
ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- 5. Enhance payments for direct payments & failure reasons
ALTER TABLE payments ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES courses(id) ON DELETE SET NULL;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS fee_structure_id UUID REFERENCES fee_structures(id) ON DELETE SET NULL;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_type VARCHAR(50) DEFAULT 'fee' CHECK (payment_type IN ('course', 'fee', 'invoice'));
ALTER TABLE payments ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(12,2) DEFAULT 0.00;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12,2) DEFAULT 0.00;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS net_amount NUMERIC(12,2);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS failure_reason TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Populate net_amount on existing payments
UPDATE payments SET net_amount = amount WHERE net_amount IS NULL;

-- 6. Enhance payment_receipts for direct payment proof
ALTER TABLE payment_receipts ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES courses(id) ON DELETE SET NULL;
ALTER TABLE payment_receipts ADD COLUMN IF NOT EXISTS fee_structure_id UUID REFERENCES fee_structures(id) ON DELETE SET NULL;
ALTER TABLE payment_receipts ADD COLUMN IF NOT EXISTS receipt_title VARCHAR(255);
ALTER TABLE payment_receipts ADD COLUMN IF NOT EXISTS student_name VARCHAR(255);
ALTER TABLE payment_receipts ADD COLUMN IF NOT EXISTS student_roll VARCHAR(100);
ALTER TABLE payment_receipts ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(12,2) DEFAULT 0.00;
ALTER TABLE payment_receipts ADD COLUMN IF NOT EXISTS institution_details JSONB DEFAULT '{"name":"NexCampus Smart Campus Institute","code":"NC-2026","email":"accounts@nexcampus.edu","tax_id":"GSTIN21AAAAA0000A1Z5"}';

-- 7. Multi-language: user preferred language
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(10) DEFAULT 'en';

-- 8. Course Translations table
CREATE TABLE IF NOT EXISTS course_translations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    language_code VARCHAR(10) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    instructions TEXT,
    UNIQUE(course_id, language_code)
);

CREATE INDEX IF NOT EXISTS idx_course_translations_lookup ON course_translations(course_id, language_code);

-- 9. Seed default prices and descriptions for existing courses if needed
UPDATE courses SET
  price = CASE 
    WHEN code = 'CSE101' OR code ILIKE '%CS%' THEN 2999.00
    WHEN code = 'ECE201' OR code ILIKE '%EC%' THEN 2499.00
    WHEN code = 'MECH301' OR code ILIKE '%ME%' THEN 1999.00
    ELSE 2999.00
  END,
  duration = '1 Semester (6 Months)',
  eligibility = 'Undergraduate & Postgraduate Students',
  description = CASE 
    WHEN code ILIKE '%CS%' THEN 'Comprehensive Computer Science curriculum covering advanced algorithms, software architecture, full-stack systems, and modern AI development.'
    WHEN code ILIKE '%EC%' THEN 'Core Electronics and Communication engineering program covering embedded systems, microcontrollers, and IoT protocols.'
    ELSE 'Core engineering and technical education program designed for university scholars.'
  END,
  is_payable = true,
  is_active = true
WHERE price IS NULL OR price = 0.00;
