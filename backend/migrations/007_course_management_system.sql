-- =========================================================================
-- Migration 007: Dedicated Course Management System
-- Schema enhancements for courses, modules, enrollments, and roles
-- =========================================================================

-- 1. Ensure course_manager role exists
INSERT INTO roles (name, display_name, description)
VALUES ('course_manager', 'Course Manager', 'Authorized to create, edit, publish, and manage academic courses and curricula')
ON CONFLICT (name) DO NOTHING;

-- 2. Enhance courses table
ALTER TABLE courses ADD COLUMN IF NOT EXISTS short_description TEXT;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS category VARCHAR(100) DEFAULT 'Engineering';
ALTER TABLE courses ADD COLUMN IF NOT EXISTS course_type VARCHAR(100) DEFAULT 'Degree';
ALTER TABLE courses ADD COLUMN IF NOT EXISTS prerequisites TEXT;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS learning_objectives TEXT;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS instructor_name VARCHAR(255) DEFAULT 'Faculty of Engineering';
ALTER TABLE courses ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'INR';
ALTER TABLE courses ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'PUBLISHED';
ALTER TABLE courses ADD COLUMN IF NOT EXISTS max_seats INT DEFAULT 120;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS enrollment_start TIMESTAMPTZ;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS enrollment_end TIMESTAMPTZ;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS course_start TIMESTAMPTZ;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS course_end TIMESTAMPTZ;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- Normalize status constraint if any or create check constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_courses_status'
  ) THEN
    ALTER TABLE courses ADD CONSTRAINT chk_courses_status
      CHECK (status IN ('DRAFT', 'PUBLISHED', 'UNPUBLISHED', 'ARCHIVED'));
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- In case constraint already exists or name differs
  NULL;
END $$;

-- Set default status for existing courses
UPDATE courses 
SET status = 'PUBLISHED' 
WHERE status IS NULL OR status = '';

UPDATE courses
SET currency = 'INR'
WHERE currency IS NULL;

UPDATE courses
SET max_seats = 120
WHERE max_seats IS NULL;

-- 3. Create course_modules table for structured curriculum
CREATE TABLE IF NOT EXISTS course_modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    module_order INT NOT NULL DEFAULT 1,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    topics JSONB DEFAULT '[]'::jsonb,
    duration VARCHAR(100) DEFAULT '2 Weeks',
    learning_resources JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_course_modules_course_id ON course_modules(course_id);
CREATE INDEX IF NOT EXISTS idx_course_modules_order ON course_modules(course_id, module_order);

-- 4. Enhance course_enrollments table
ALTER TABLE course_enrollments ADD COLUMN IF NOT EXISTS course_fee_at_enrollment NUMERIC(12,2) DEFAULT 0.00;
ALTER TABLE course_enrollments ADD COLUMN IF NOT EXISTS progress INT DEFAULT 0;
ALTER TABLE course_enrollments ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE course_enrollments ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;

-- Update existing course enrollments course_fee_at_enrollment from course price if 0
UPDATE course_enrollments ce
SET course_fee_at_enrollment = COALESCE(c.price, 0.00)
FROM courses c
WHERE ce.course_id = c.id AND (ce.course_fee_at_enrollment IS NULL OR ce.course_fee_at_enrollment = 0);

-- 5. Seed default modules for standard courses if none exist
DO $$
DECLARE
  v_course_id UUID;
BEGIN
  FOR v_course_id IN SELECT id FROM courses LOOP
    IF NOT EXISTS (SELECT 1 FROM course_modules WHERE course_id = v_course_id) THEN
      INSERT INTO course_modules (course_id, module_order, title, description, topics, duration)
      VALUES
        (v_course_id, 1, 'Module 1: Foundations & Core Architecture', 'Introduction to the core principles, architecture, and toolchains.', '["Orientation & Setup", "Foundational Syntax", "System Architecture"]'::jsonb, '2 Weeks'),
        (v_course_id, 2, 'Module 2: Advanced Design & Engineering', 'Deep dive into patterns, domain modeling, and data pipelines.', '["Advanced Protocols", "State Management", "Performance Optimization"]'::jsonb, '4 Weeks'),
        (v_course_id, 3, 'Module 3: Industry Projects & Deployment', 'Real-world project implementation, testing, CI/CD, and production deployment.', '["Capstone Integration", "Automated QA", "Production Deployment"]'::jsonb, '4 Weeks');
    END IF;
  END LOOP;
END $$;
