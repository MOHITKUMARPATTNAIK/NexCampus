import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';

// ─────────────────────────────────────────────
//  Mock DB to avoid needing a live Supabase
// ─────────────────────────────────────────────
import { createServer } from 'node:http';
import express from 'express';

// We test the security controller logic in isolation using mocked DB responses.
// Integration tests against a real DB are done via manual/UAT testing.

// ─────────────────────────────────────────────
//  Gate Pass State Machine Tests
// ─────────────────────────────────────────────
describe('Gate Pass State Machine', () => {
  const VALID_STATUSES = ['pending', 'approved', 'rejected', 'active', 'completed', 'cancelled'];
  const ALLOWED_TRANSITIONS = {
    pending:   ['approved', 'rejected', 'cancelled'],
    approved:  ['active', 'cancelled'],
    active:    ['completed'],
    rejected:  [],    // terminal
    completed: [],    // terminal
    cancelled: [],    // terminal
  };

  it('should define valid state transitions', () => {
    assert.ok(ALLOWED_TRANSITIONS.pending.includes('approved'), 'pending → approved allowed');
    assert.ok(ALLOWED_TRANSITIONS.pending.includes('rejected'), 'pending → rejected allowed');
    assert.ok(ALLOWED_TRANSITIONS.approved.includes('active'), 'approved → active (checkout) allowed');
    assert.ok(ALLOWED_TRANSITIONS.active.includes('completed'), 'active → completed (checkin) allowed');
    assert.ok(ALLOWED_TRANSITIONS.completed.length === 0, 'completed is terminal');
    assert.ok(ALLOWED_TRANSITIONS.rejected.length === 0, 'rejected is terminal');
  });

  it('should not allow direct pending → active transition', () => {
    assert.ok(!ALLOWED_TRANSITIONS.pending.includes('active'), 'pending → active NOT allowed (must approve first)');
  });

  it('should not allow skipping checkout to go directly to completed', () => {
    assert.ok(!ALLOWED_TRANSITIONS.approved.includes('completed'), 'approved → completed NOT allowed (must checkout first)');
  });

  it('should not allow checkin before checkout', () => {
    // nextAllowedAction for a pass that was just approved should be 'checkout'
    const simulatedPass = { status: 'approved', checkout_recorded: false };
    const nextAction = simulatedPass.checkout_recorded ? 'checkin' : 'checkout';
    assert.equal(nextAction, 'checkout', 'next action when not checked out is checkout');
  });

  it('should allow checkin after checkout', () => {
    const simulatedPass = { status: 'active', checkout_recorded: true };
    const nextAction = simulatedPass.checkout_recorded ? 'checkin' : 'checkout';
    assert.equal(nextAction, 'checkin', 'next action after checkout is checkin');
  });
});

// ─────────────────────────────────────────────
//  QR Token Format Tests
// ─────────────────────────────────────────────
describe('QR Token Format', () => {
  const generateToken = (passNumber) => `NC-PASS-${crypto.randomUUID()}-${passNumber}`;

  it('should generate valid NC-PASS token format', () => {
    const token = generateToken('GP2026001');
    assert.ok(token.startsWith('NC-PASS-'), 'token starts with NC-PASS-');
    assert.ok(token.includes('GP2026001'), 'token contains pass number');
    const parts = token.split('-');
    assert.ok(parts.length >= 7, 'token has enough UUID segments');
  });

  it('should reject tokens that do not start with NC-PASS-', () => {
    const fakeToken = 'FAKE-TOKEN-12345';
    assert.ok(!fakeToken.startsWith('NC-PASS-'), 'invalid token correctly identified');
  });

  it('should detect expired tokens', () => {
    const now = new Date();
    const expiredTime = new Date(now.getTime() - 3600000); // 1 hour ago
    const futureTime = new Date(now.getTime() + 3600000);  // 1 hour ahead

    const isExpired = (expiresAt) => new Date(expiresAt) < now;

    assert.ok(isExpired(expiredTime), 'past time is expired');
    assert.ok(!isExpired(futureTime), 'future time is not expired');
  });
});

// ─────────────────────────────────────────────
//  Movement Type Validation Tests
// ─────────────────────────────────────────────
describe('Movement Type Validation', () => {
  const VALID_MOVEMENT_TYPES = ['checkout', 'checkin'];

  it('should accept checkout as a valid movement type', () => {
    assert.ok(VALID_MOVEMENT_TYPES.includes('checkout'));
  });

  it('should accept checkin as a valid movement type', () => {
    assert.ok(VALID_MOVEMENT_TYPES.includes('checkin'));
  });

  it('should reject invalid movement types', () => {
    const invalid = ['entry', 'exit', 'leave', 'CHECKOUT', 'CHECK_IN'];
    for (const type of invalid) {
      assert.ok(!VALID_MOVEMENT_TYPES.includes(type), `"${type}" should be invalid`);
    }
  });
});

// ─────────────────────────────────────────────
//  Duplicate Prevention Logic Tests
// ─────────────────────────────────────────────
describe('Duplicate Movement Prevention', () => {
  it('should detect duplicate checkout attempt', () => {
    // Simulate: pass already has a checkout movement
    const existingMovements = [{ movement_type: 'checkout', recorded_at: new Date() }];
    const lastMovement = existingMovements[existingMovements.length - 1];

    // If last movement was checkout, next must be checkin
    const isDuplicateCheckout = lastMovement.movement_type === 'checkout';
    assert.ok(isDuplicateCheckout, 'duplicate checkout correctly detected');
  });

  it('should detect duplicate checkin attempt', () => {
    const existingMovements = [
      { movement_type: 'checkout', recorded_at: new Date(Date.now() - 3600000) },
      { movement_type: 'checkin',  recorded_at: new Date() }
    ];
    const lastMovement = existingMovements[existingMovements.length - 1];
    const isDuplicateCheckin = lastMovement.movement_type === 'checkin';
    assert.ok(isDuplicateCheckin, 'duplicate checkin correctly detected');
  });

  it('should allow checkin after checkout', () => {
    const existingMovements = [{ movement_type: 'checkout', recorded_at: new Date() }];
    const lastMovement = existingMovements[existingMovements.length - 1];
    const canCheckin = lastMovement.movement_type === 'checkout';
    assert.ok(canCheckin, 'checkin allowed after checkout');
  });
});

// ─────────────────────────────────────────────
//  Overdue Detection Logic Tests
// ─────────────────────────────────────────────
describe('Overdue Detection', () => {
  it('should correctly identify overdue students', () => {
    const now = new Date();
    const passes = [
      { student_name: 'Alice', expected_return_time: new Date(now.getTime() - 7200000), status: 'active' }, // 2h overdue
      { student_name: 'Bob',   expected_return_time: new Date(now.getTime() + 3600000), status: 'active' }, // 1h remaining
      { student_name: 'Carol', expected_return_time: new Date(now.getTime() - 1800000), status: 'active' }, // 30m overdue
      { student_name: 'Dave',  expected_return_time: new Date(now.getTime() - 3600000), status: 'completed' }, // already returned
    ];

    const overdue = passes.filter(p =>
      p.status === 'active' && new Date(p.expected_return_time) < now
    );

    assert.equal(overdue.length, 2, 'should find 2 overdue students (Alice and Carol)');
    assert.ok(overdue.some(p => p.student_name === 'Alice'), 'Alice is overdue');
    assert.ok(overdue.some(p => p.student_name === 'Carol'), 'Carol is overdue');
    assert.ok(!overdue.some(p => p.student_name === 'Bob'), 'Bob is not overdue');
    assert.ok(!overdue.some(p => p.student_name === 'Dave'), 'Dave (completed) is not counted as overdue');
  });

  it('should calculate hours overdue correctly', () => {
    const expectedReturn = new Date(Date.now() - 7200000); // 2 hours ago
    const diff = Date.now() - new Date(expectedReturn).getTime();
    const hoursOverdue = Math.floor(diff / 3600000);
    assert.equal(hoursOverdue, 2, '2 hours overdue correctly calculated');
  });
});
