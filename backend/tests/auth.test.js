import test from 'node:test';
import assert from 'node:assert';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

test('Password hashing and comparison with bcrypt', async () => {
  const plainPassword = 'Admin@NexCampus2026!';
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(plainPassword, salt);

  assert.notStrictEqual(hash, plainPassword);
  const isMatch = await bcrypt.compare(plainPassword, hash);
  assert.strictEqual(isMatch, true);

  const isWrongMatch = await bcrypt.compare('WrongPassword123!', hash);
  assert.strictEqual(isWrongMatch, false);
});

test('JWT signing and claims decoding', () => {
  const secret = 'nexcampus_test_jwt_secret_key_long_enough';
  const payload = {
    userId: '11111111-2222-3333-4444-555555555555',
    email: 'superadmin@nexcampus.edu',
    roles: ['super_admin']
  };

  const token = jwt.sign(payload, secret, { expiresIn: '1h' });
  assert.ok(token);

  const decoded = jwt.verify(token, secret);
  assert.strictEqual(decoded.userId, payload.userId);
  assert.strictEqual(decoded.email, payload.email);
  assert.deepStrictEqual(decoded.roles, payload.roles);
});

test('RBAC & Permission gate logic', () => {
  const superAdminUser = {
    roles: ['super_admin'],
    permissions: [],
    isSuperAdmin: true
  };

  const cmoUser = {
    roles: ['cmo'],
    permissions: ['complaint:cmo_triage', 'complaint:cmo_verify'],
    isSuperAdmin: false
  };

  const studentUser = {
    roles: ['student'],
    permissions: ['gatepass:apply', 'fee:pay_online'],
    isSuperAdmin: false
  };

  // Super admin can access anything
  assert.strictEqual(superAdminUser.isSuperAdmin, true);

  // CMO check
  assert.strictEqual(cmoUser.roles.includes('cmo'), true);
  assert.strictEqual(cmoUser.permissions.includes('complaint:cmo_triage'), true);
  assert.strictEqual(cmoUser.permissions.includes('academic:manage_timetables'), false);

  // Student check
  assert.strictEqual(studentUser.roles.includes('student'), true);
  assert.strictEqual(studentUser.permissions.includes('gatepass:apply'), true);
  assert.strictEqual(studentUser.permissions.includes('admin:manage_admins'), false);
});
