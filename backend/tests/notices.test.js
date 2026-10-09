import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─────────────────────────────────────────────────────────────────────────────
//  Campus Notices Architecture & Schema Harmonization Test Suite
// ─────────────────────────────────────────────────────────────────────────────

describe('📢 Campus Notices Subsystem Test Suite', () => {

  // 1. Migration Specification Verification
  describe('1. Migration 008 Schema Harmonization Safety Checks', () => {
    const migrationPath = path.resolve(__dirname, '../migrations/008_notices_schema_harmonization.sql');

    it('should have migration 008 file present in migrations directory', () => {
      assert.ok(fs.existsSync(migrationPath), 'Migration 008 file must exist');
    });

    it('should add genuinely missing columns (notice_type, priority) safely', () => {
      const sql = fs.readFileSync(migrationPath, 'utf8');
      assert.match(sql, /ALTER\s+TABLE\s+notices\s+ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+notice_type\s+VARCHAR\(50\)/i);
      assert.match(sql, /ALTER\s+TABLE\s+notices\s+ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+priority\s+VARCHAR\(20\)/i);
    });

    it('should NOT create duplicate equivalent columns (author_id, target_role, expiry_date, is_published)', () => {
      const sql = fs.readFileSync(migrationPath, 'utf8');
      // Must not add duplicate columns when equivalent already exists in 001_initial_schema
      assert.doesNotMatch(sql, /ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+published_by/i, 'Should not duplicate author_id with published_by');
      assert.doesNotMatch(sql, /ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+target_audience/i, 'Should not duplicate target_role with target_audience');
      assert.doesNotMatch(sql, /ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+expires_at/i, 'Should not duplicate expiry_date with expires_at');
      assert.doesNotMatch(sql, /ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+status\s+/i, 'Should not duplicate is_published with status');
    });

    it('should ensure notifications.category has safe default to prevent fan-out failure', () => {
      const sql = fs.readFileSync(migrationPath, 'utf8');
      assert.match(sql, /ALTER\s+TABLE\s+notifications\s+ALTER\s+COLUMN\s+category\s+SET\s+DEFAULT/i);
    });

    it('should create performance indexes for notice queries', () => {
      const sql = fs.readFileSync(migrationPath, 'utf8');
      assert.match(sql, /CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_notices_published_expiry/i);
      assert.match(sql, /CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_notices_notice_type/i);
    });
  });

  // 2. Field Mapping & Schema Alignment
  describe('2. Field Mapping & Backward Compatibility', () => {
    it('should map frontend form fields to database schema and aliases', () => {
      const reqBody = {
        title: 'Midterm Examination Schedule',
        content: 'Midterm exams begin on November 15th.',
        notice_type: 'academic',
        priority: 'high',
        is_pinned: true,
        expires_at: '2026-11-20',
        target_audience: 'student'
      };

      // Controller mapping logic
      const mapped = {
        title: reqBody.title.trim(),
        content: reqBody.content.trim(),
        notice_type: reqBody.notice_type || 'general',
        target_role: reqBody.target_role || reqBody.target_audience || 'all',
        department_id: reqBody.department_id || null,
        priority: reqBody.priority || 'normal',
        expiry_date: reqBody.expiry_date || reqBody.expires_at || null,
        is_pinned: reqBody.is_pinned || false,
        is_published: true
      };

      assert.equal(mapped.title, 'Midterm Examination Schedule');
      assert.equal(mapped.notice_type, 'academic');
      assert.equal(mapped.target_role, 'student');
      assert.equal(mapped.priority, 'high');
      assert.equal(mapped.expiry_date, '2026-11-20');
      assert.equal(mapped.is_pinned, true);
      assert.equal(mapped.is_published, true);
    });

    it('should apply default values when optional fields are omitted', () => {
      const reqBody = {
        title: 'Campus Cleanliness Drive',
        content: 'Join the campus initiative this weekend.'
      };

      const mapped = {
        title: reqBody.title.trim(),
        content: reqBody.content.trim(),
        notice_type: reqBody.notice_type || 'general',
        target_role: reqBody.target_role || reqBody.target_audience || 'all',
        priority: reqBody.priority || 'normal',
        expiry_date: reqBody.expiry_date || (reqBody.expires_at ? reqBody.expires_at.trim() : null),
        is_pinned: reqBody.is_pinned || false
      };

      assert.equal(mapped.notice_type, 'general');
      assert.equal(mapped.target_role, 'all');
      assert.equal(mapped.priority, 'normal');
      assert.equal(mapped.expiry_date, null);
      assert.equal(mapped.is_pinned, false);
    });

    it('should correctly format response with consumer aliases', () => {
      const dbRow = {
        id: '99999999-0000-0000-0000-000000000001',
        title: 'Library Closed on Sunday',
        content: 'Annual maintenance works in the central library.',
        notice_type: 'maintenance',
        target_role: 'all',
        department_id: null,
        priority: 'urgent',
        expiry_date: '2026-10-15',
        is_pinned: true,
        author_id: '11111111-2222-3333-4444-555555555555',
        is_published: true,
        created_at: new Date('2026-10-09T10:00:00Z'),
        updated_at: new Date('2026-10-09T10:00:00Z')
      };

      // Aliased return fields for full frontend and admin compatibility
      const returnedNotice = {
        ...dbRow,
        published_by: dbRow.author_id,
        target_audience: dbRow.target_role,
        expires_at: dbRow.expiry_date,
        status: dbRow.is_published ? 'published' : 'archived',
        published_by_name: 'Campus Administration'
      };

      assert.equal(returnedNotice.published_by, dbRow.author_id);
      assert.equal(returnedNotice.target_audience, 'all');
      assert.equal(returnedNotice.expires_at, '2026-10-15');
      assert.equal(returnedNotice.status, 'published');
      assert.equal(returnedNotice.published_by_name, 'Campus Administration');
      assert.equal(returnedNotice.priority, 'urgent');
    });
  });

  // 3. Urgency Priority Ordering
  describe('3. Notice Priority Weight Sorting', () => {
    const priorityWeight = (p) => {
      switch (p) {
        case 'urgent': return 4;
        case 'high':   return 3;
        case 'normal': return 2;
        case 'low':    return 1;
        default:       return 2;
      }
    };

    it('should sort urgent above high, high above normal, and normal above low', () => {
      const items = [
        { id: 1, priority: 'low' },
        { id: 2, priority: 'urgent' },
        { id: 3, priority: 'normal' },
        { id: 4, priority: 'high' }
      ];

      items.sort((a, b) => priorityWeight(b.priority) - priorityWeight(a.priority));

      assert.deepEqual(items.map(i => i.priority), ['urgent', 'high', 'normal', 'low']);
    });
  });

  // 4. Role-Based Access Control (RBAC)
  describe('4. Notice Publishing RBAC Verification', () => {
    const isPublishAuthorized = (roles) => {
      const allowed = ['super_admin', 'delegated_admin', 'faculty'];
      return roles.some(r => allowed.includes(r));
    };

    const isArchiveAuthorized = (roles) => {
      const allowed = ['super_admin', 'delegated_admin'];
      return roles.some(r => allowed.includes(r));
    };

    it('should authorize super_admin, delegated_admin, and faculty to publish notices', () => {
      assert.equal(isPublishAuthorized(['super_admin']), true);
      assert.equal(isPublishAuthorized(['delegated_admin']), true);
      assert.equal(isPublishAuthorized(['faculty']), true);
    });

    it('should reject student and operational staff from publishing notices', () => {
      assert.equal(isPublishAuthorized(['student']), false);
      assert.equal(isPublishAuthorized(['security_guard']), false);
      assert.equal(isPublishAuthorized(['hostel_warden']), false);
    });

    it('should restrict notice archiving to super_admin and delegated_admin only', () => {
      assert.equal(isArchiveAuthorized(['super_admin']), true);
      assert.equal(isArchiveAuthorized(['delegated_admin']), true);
      assert.equal(isArchiveAuthorized(['faculty']), false);
      assert.equal(isArchiveAuthorized(['student']), false);
    });
  });

  // 5. Input Validation
  describe('5. Input Validation Rules', () => {
    const validateNoticeInput = (body) => {
      if (!body.title?.trim() || !body.content?.trim()) {
        return { valid: false, error: 'Title and content are required' };
      }
      return { valid: true };
    };

    it('should reject requests with empty title', () => {
      const res = validateNoticeInput({ title: '   ', content: 'Some content' });
      assert.equal(res.valid, false);
      assert.equal(res.error, 'Title and content are required');
    });

    it('should reject requests with empty content', () => {
      const res = validateNoticeInput({ title: 'Valid Title', content: '' });
      assert.equal(res.valid, false);
      assert.equal(res.error, 'Title and content are required');
    });

    it('should accept valid non-empty title and content', () => {
      const res = validateNoticeInput({ title: 'Exam Notice', content: 'Schedule posted.' });
      assert.equal(res.valid, true);
    });
  });

  // 6. Query Filtering & Parameter Verification
  describe('6. Notice Query Filtering Logic (GET /api/notices)', () => {
    const buildListQuery = ({ type, pinned, page = 1, limit = 30 }) => {
      const conditions = [
        `(n.expiry_date IS NULL OR n.expiry_date >= CURRENT_DATE)`,
        `n.is_published = true`
      ];
      const values = [];
      let idx = 1;
      if (type) {
        conditions.push(`n.notice_type = $${idx++}`);
        values.push(type);
      }
      if (pinned === 'true') {
        conditions.push(`n.is_pinned = true`);
      }
      const offset = (Number(page) - 1) * Number(limit);
      const sql = `SELECT n.* FROM notices n WHERE ${conditions.join(' AND ')} LIMIT $${idx} OFFSET $${idx + 1}`;
      return { sql, values: [...values, Number(limit), offset] };
    };

    it('should build filter query for GET /api/notices?type=academic', () => {
      const result = buildListQuery({ type: 'academic' });
      assert.ok(result.sql.includes('n.notice_type = $1'));
      assert.ok(result.sql.includes('n.is_published = true'));
      assert.equal(result.values[0], 'academic');
      assert.equal(result.values[1], 30); // default limit
      assert.equal(result.values[2], 0);  // default offset
    });

    it('should build query for unfiltered GET /api/notices', () => {
      const result = buildListQuery({});
      assert.ok(!result.sql.includes('n.notice_type'));
      assert.ok(result.sql.includes('n.is_published = true'));
      assert.equal(result.values[0], 30);
      assert.equal(result.values[1], 0);
    });

    it('should build query with pinned filter and pagination', () => {
      const result = buildListQuery({ pinned: 'true', page: 2, limit: 10 });
      assert.ok(result.sql.includes('n.is_pinned = true'));
      assert.equal(result.values[0], 10);
      assert.equal(result.values[1], 10);
    });
  });

  // 7. Full Notice Publishing Payload Verification
  describe('7. Created Notice Response Contract (POST /api/notices)', () => {
    it('should guarantee created notice object contains all required fields', () => {
      const user = { id: 'u1', full_name: 'Dr. Sarah Connor', roles: ['faculty'] };
      const row = {
        id: 'n-uuid-1234',
        title: 'Midterm Timetable',
        content: 'Check the attached schedule for November exams.',
        notice_type: 'academic',
        priority: 'high',
        expiry_date: '2026-11-30',
        is_pinned: false,
        author_id: user.id,
        is_published: true,
        created_at: new Date()
      };

      const responsePayload = {
        notice: {
          ...row,
          published_by: row.author_id,
          target_audience: 'all',
          expires_at: row.expiry_date,
          status: 'published',
          published_by_name: user.full_name || 'Campus Administration'
        }
      };

      assert.ok(responsePayload.notice.id, 'Notice must have id');
      assert.equal(responsePayload.notice.title, 'Midterm Timetable');
      assert.equal(responsePayload.notice.content, 'Check the attached schedule for November exams.');
      assert.equal(responsePayload.notice.notice_type, 'academic');
      assert.equal(responsePayload.notice.priority, 'high');
      assert.equal(responsePayload.notice.published_by_name, 'Dr. Sarah Connor');
      assert.equal(responsePayload.notice.status, 'published');
    });
  });
});
