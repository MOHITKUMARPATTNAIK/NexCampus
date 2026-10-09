-- Migration 008: Harmonize notices table schema with application controllers and frontend
-- Safe migration: preserves all existing data, columns, constraints, and relationships.
-- Does NOT create duplicate equivalent columns:
-- Existing schema columns used directly:
--   author_id (creator), target_role (audience), expiry_date (expiry), is_published (status).
-- Genuinely missing columns added:
--   notice_type, priority.

-- 1. Add genuinely missing columns with safe defaults
ALTER TABLE notices ADD COLUMN IF NOT EXISTS notice_type VARCHAR(50) DEFAULT 'general';
ALTER TABLE notices ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'normal';

-- 2. Backfill existing notice records if any exist
UPDATE notices SET
  notice_type = COALESCE(notice_type, 'general'),
  priority = COALESCE(priority, 'normal')
WHERE notice_type IS NULL OR priority IS NULL;

-- 3. Set default for notifications.category so notice fan-out never violates NOT NULL
ALTER TABLE notifications ALTER COLUMN category SET DEFAULT 'notice';

-- 4. Create performance indexes for common filter/sort queries
CREATE INDEX IF NOT EXISTS idx_notices_published_expiry ON notices (is_published, expiry_date);
CREATE INDEX IF NOT EXISTS idx_notices_pinned_created ON notices (is_pinned DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notices_notice_type ON notices (notice_type);
