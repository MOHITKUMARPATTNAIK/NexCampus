import test from 'node:test';
import assert from 'node:assert';
import crypto from 'crypto';

test('Server-side payable amount calculation with discount and tax', () => {
  const calculatePayable = (basePrice, discountPct = 0, taxPct = 0, lateFee = 0) => {
    const discountAmount = Math.round(((basePrice * discountPct) / 100) * 100) / 100;
    const subtotal = Math.max(0, basePrice - discountAmount);
    const taxAmount = Math.round(((subtotal * taxPct) / 100) * 100) / 100;
    const netAmount = Math.round((subtotal + taxAmount + lateFee) * 100) / 100;
    return { discountAmount, subtotal, taxAmount, netAmount };
  };

  // Case 1: Course price ₹2999 with 10% discount and 18% GST
  const result1 = calculatePayable(2999, 10, 18, 0);
  assert.strictEqual(result1.discountAmount, 299.9);
  assert.strictEqual(result1.subtotal, 2699.1);
  assert.strictEqual(result1.taxAmount, 485.84);
  assert.strictEqual(result1.netAmount, 3184.94);

  // Case 2: Direct fee ₹1500 with zero discount, zero tax, ₹100 late fee
  const result2 = calculatePayable(1500, 0, 0, 100);
  assert.strictEqual(result2.netAmount, 1600);

  // Case 3: Flat fee ₹2499 no discount no tax
  const result3 = calculatePayable(2499, 0, 0, 0);
  assert.strictEqual(result3.netAmount, 2499);
});

test('HMAC SHA256 payment signature verification', () => {
  const secret = 'rzp_test_secret_key_mock_12345';
  const orderId = 'order_DA789XYZ';
  const paymentId = 'pay_9988776655';

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  // Valid signature
  const verify = (sig) => {
    const computed = crypto
      .createHmac('sha256', secret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
    return computed === sig;
  };

  assert.strictEqual(verify(expectedSignature), true);
  assert.strictEqual(verify('tampered_invalid_signature_hex'), false);
});

test('Receipt and Order reference formats', () => {
  const orderRef = `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
  assert.match(orderRef, /^ORD-\d+-[A-Z0-9]+$/);

  const currentYear = new Date().getFullYear();
  const receiptNumber = `RCP-${currentYear}-${String(42).padStart(6, '0')}`;
  assert.strictEqual(receiptNumber, `RCP-${currentYear}-000042`);
  assert.match(receiptNumber, /^RCP-\d{4}-\d{6}$/);
});

test('Payment and Enrollment idempotency rules', () => {
  const activeEnrollments = new Set(['user1_course101', 'user2_course202']);

  const canEnroll = (userId, courseId) => {
    const key = `${userId}_${courseId}`;
    if (activeEnrollments.has(key)) return { allowed: false, reason: 'ALREADY_ENROLLED' };
    return { allowed: true };
  };

  assert.strictEqual(canEnroll('user1', 'course101').allowed, false);
  assert.strictEqual(canEnroll('user1', 'course101').reason, 'ALREADY_ENROLLED');
  assert.strictEqual(canEnroll('user1', 'course303').allowed, true);
});

test('Dummy transaction reference format and status consistency', () => {
  const randomHex = crypto.randomBytes(4).toString('hex').toUpperCase();
  const txRef = `DUMMY-TXN-${Date.now().toString(36).toUpperCase()}${randomHex}`;
  assert.match(txRef, /^DUMMY-TXN-[A-Z0-9]+$/);

  const validStatuses = ['PENDING', 'SUCCESS', 'FAILED', 'REFUNDED'];
  const testStatus = 'SUCCESS';
  assert.strictEqual(validStatuses.includes(testStatus), true);

  const normalizeStatus = (status) => {
    const upper = String(status || '').toUpperCase();
    if (['SUCCESS', 'CAPTURED', 'PAID'].includes(upper)) return 'SUCCESS';
    return upper;
  };
  assert.strictEqual(normalizeStatus('captured'), 'SUCCESS');
  assert.strictEqual(normalizeStatus('paid'), 'SUCCESS');
  assert.strictEqual(normalizeStatus('SUCCESS'), 'SUCCESS');
});

test('Payment amount anti-tampering validation', () => {
  const authoritativeAmount = 2499.00;
  const validateAmount = (submitted) => {
    if (submitted === undefined || submitted === null) return false;
    const num = parseFloat(submitted);
    if (isNaN(num) || num <= 0) return false;
    if (Math.abs(num - authoritativeAmount) > 1.0) return false;
    return true;
  };

  assert.strictEqual(validateAmount(2499.00), true);
  assert.strictEqual(validateAmount('2499'), true);
  assert.strictEqual(validateAmount(2499.50), true); // within rounding tolerance
  assert.strictEqual(validateAmount(10.00), false); // tampered
  assert.strictEqual(validateAmount(-500), false); // negative
  assert.strictEqual(validateAmount(0), false); // zero
  assert.strictEqual(validateAmount(NaN), false); // NaN
});
