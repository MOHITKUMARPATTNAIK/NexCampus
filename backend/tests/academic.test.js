import test from 'node:test';
import assert from 'node:assert';

test('Timetable time slot collision algorithm', () => {
  // Collision condition: NOT (end_time <= new_start OR start_time >= new_end)
  const isOverlap = (slotA, slotB) => {
    return !(slotA.end <= slotB.start || slotA.start >= slotB.end);
  };

  const existingSlot = { start: '09:00', end: '10:00' };

  // Case 1: Identical slot -> Collision
  assert.strictEqual(isOverlap(existingSlot, { start: '09:00', end: '10:00' }), true);

  // Case 2: Partial overlap (09:30 - 10:30) -> Collision
  assert.strictEqual(isOverlap(existingSlot, { start: '09:30', end: '10:30' }), true);

  // Case 3: Enclosing slot (08:30 - 10:30) -> Collision
  assert.strictEqual(isOverlap(existingSlot, { start: '08:30', end: '10:30' }), true);

  // Case 4: Non-overlapping earlier slot (08:00 - 09:00) -> Allowed
  assert.strictEqual(isOverlap(existingSlot, { start: '08:00', end: '09:00' }), false);

  // Case 5: Non-overlapping later slot (10:00 - 11:00) -> Allowed
  assert.strictEqual(isOverlap(existingSlot, { start: '10:00', end: '11:00' }), false);
});

test('Student Attendance Percentage & 75% Shortage Threshold logic', () => {
  const calculateAttendance = (attended, total) => {
    if (total === 0) return { percentage: 100.0, isShortage: false };
    const pct = parseFloat(((attended / total) * 100).toFixed(1));
    return {
      percentage: pct,
      isShortage: pct < 75.0
    };
  };

  // Case 1: 80 out of 100 -> 80% (Safe)
  const safe = calculateAttendance(80, 100);
  assert.strictEqual(safe.percentage, 80.0);
  assert.strictEqual(safe.isShortage, false);

  // Case 2: 74 out of 100 -> 74% (Shortage)
  const shortage = calculateAttendance(74, 100);
  assert.strictEqual(shortage.percentage, 74.0);
  assert.strictEqual(shortage.isShortage, true);

  // Case 3: Exact 75% -> Safe
  const boundary = calculateAttendance(75, 100);
  assert.strictEqual(boundary.percentage, 75.0);
  assert.strictEqual(boundary.isShortage, false);
});

test('Leave request date and rejection validation', () => {
  const validateLeaveRequest = ({ startDate, endDate }) => {
    if (new Date(startDate) > new Date(endDate)) {
      return { valid: false, error: 'Start date cannot be after end date.' };
    }
    return { valid: true };
  };

  assert.strictEqual(validateLeaveRequest({ startDate: '2026-10-06', endDate: '2026-10-08' }).valid, true);
  assert.strictEqual(validateLeaveRequest({ startDate: '2026-10-08', endDate: '2026-10-06' }).valid, false);

  // Rejection requires reason
  const validateLeaveReview = ({ verdict, rejectionReason }) => {
    if (verdict === 'rejected' && (!rejectionReason || !rejectionReason.trim())) {
      return { valid: false, error: 'Rejection reason is mandatory.' };
    }
    return { valid: true };
  };

  assert.strictEqual(validateLeaveReview({ verdict: 'approved' }).valid, true);
  assert.strictEqual(validateLeaveReview({ verdict: 'rejected', rejectionReason: '' }).valid, false);
  assert.strictEqual(validateLeaveReview({ verdict: 'rejected', rejectionReason: 'Exam day' }).valid, true);
});
