-- Migration 002: Add leave_approvals table missing from initial schema
-- This table tracks the approval/rejection records for leave requests

CREATE TABLE IF NOT EXISTS leave_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leave_request_id UUID NOT NULL REFERENCES leave_requests(id) ON DELETE CASCADE,
  reviewed_by UUID NOT NULL REFERENCES users(id),
  verdict VARCHAR(20) NOT NULL CHECK (verdict IN ('approved', 'rejected')),
  remarks TEXT,
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leave_approvals_request ON leave_approvals(leave_request_id);
CREATE INDEX IF NOT EXISTS idx_leave_approvals_reviewer ON leave_approvals(reviewed_by);
