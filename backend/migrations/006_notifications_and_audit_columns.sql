-- Migration 006: Add notifications columns for cross-controller compatibility
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS notification_type VARCHAR(100) DEFAULT 'general';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS reference_id VARCHAR(150);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS reference_type VARCHAR(100);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS sent_by UUID REFERENCES users(id) ON DELETE SET NULL;
