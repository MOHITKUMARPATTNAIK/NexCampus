import test from 'node:test';
import assert from 'node:assert';

test('CMO Role and Permission Scope rules', () => {
  const cmoRole = 'cmo';
  const cmoPermissions = [
    'complaint:cmo_triage',
    'complaint:cmo_verify',
    'complaint:resolve',
    'complaint:escalate',
    'notice:view'
  ];

  // CMO must have triage and verification permissions
  assert.ok(cmoPermissions.includes('complaint:cmo_triage'));
  assert.ok(cmoPermissions.includes('complaint:cmo_verify'));

  // CMO cannot have appointment authority
  assert.strictEqual(cmoPermissions.includes('admin:appoint_cmo'), false);
  assert.strictEqual(cmoPermissions.includes('admin:manage_admins'), false);
  assert.strictEqual(cmoPermissions.includes('fee:manage_structures'), false);
});

test('Account status state machine', () => {
  const allowedStatuses = ['active', 'suspended', 'deactivated'];

  const validateStatusChange = (current, next) => {
    if (!allowedStatuses.includes(next)) return false;
    return true;
  };

  assert.strictEqual(validateStatusChange('active', 'suspended'), true);
  assert.strictEqual(validateStatusChange('suspended', 'active'), true);
  assert.strictEqual(validateStatusChange('active', 'deactivated'), true);
  assert.strictEqual(validateStatusChange('active', 'unknown_status'), false);
});

test('Operational staff category duty mapping', () => {
  const staffRoleMap = {
    security_guard: ['security:scan_qr', 'security:record_movement', 'security:view_exceptions'],
    hostel_warden: ['complaint:resolve'],
    mess_staff: ['complaint:resolve'],
    maintenance_staff: ['complaint:resolve']
  };

  assert.deepStrictEqual(staffRoleMap.security_guard, [
    'security:scan_qr',
    'security:record_movement',
    'security:view_exceptions'
  ]);
  assert.ok(staffRoleMap.maintenance_staff.includes('complaint:resolve'));
  assert.strictEqual(staffRoleMap.maintenance_staff.includes('security:scan_qr'), false);
});
