import crypto from 'node:crypto';

// Razorpay hosted checkout. With env keys: real order creation + server-side
// signature verification (the security-checklist requirement). Without keys:
// a simulated flow the customer app renders as the mock payment sheet.

function keys() {
  const id = process.env.RAZORPAY_KEY_ID;
  const secret = process.env.RAZORPAY_KEY_SECRET;
  return id && secret ? { id, secret } : null;
}

export function razorpayConfigured() {
  return !!keys();
}

/** amount in ₹ (int). Returns what the client needs to open checkout. */
export async function createPaymentOrder(amount) {
  const k = keys();
  if (!k) {
    return { mode: 'mock', rzpOrderId: 'order_mock_' + crypto.randomBytes(6).toString('hex'), amount };
  }
  const res = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${k.id}:${k.secret}`).toString('base64'),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ amount: amount * 100, currency: 'INR' })
  });
  if (!res.ok) throw new Error(`Razorpay order failed (${res.status})`);
  const order = await res.json();
  return { mode: 'razorpay', keyId: k.id, rzpOrderId: order.id, amount };
}

/** Verify before confirming any prepaid order. */
export function verifyPayment({ rzpOrderId, paymentId, signature }) {
  const k = keys();
  if (!k) {
    // Mock flow: the simulated sheet issues pay_mock_* ids on "success".
    return typeof paymentId === 'string' && paymentId.startsWith('pay_mock_') && String(rzpOrderId).startsWith('order_mock_');
  }
  const expected = crypto.createHmac('sha256', k.secret).update(`${rzpOrderId}|${paymentId}`).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(String(signature)));
  } catch {
    return false;
  }
}
