import { db, getSetting } from '../db.js';
import { broadcast } from '../realtime.js';

// Twilio Messages API via fetch — auth token stays server-side. When the
// Twilio card in admin Settings is disabled (or no env creds exist) the send
// is simulated but still logged, so the demo SMS log stays alive.

function envCreds() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM;
  return sid && token && from ? { sid, token, from } : null;
}

export function twilioEnvConfigured() {
  return !!envCreds();
}

export async function sendSms(to, body, { force = false } = {}) {
  const cfg = await getSetting('twilio');
  if (!cfg.enabled && !force) return;

  const creds = envCreds();
  let status = 'simulated';
  if (creds) {
    try {
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${creds.sid}/Messages.json`, {
        method: 'POST',
        headers: {
          Authorization: 'Basic ' + Buffer.from(`${creds.sid}:${creds.token}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({ To: normalizePhone(to), From: creds.from, Body: body })
      });
      status = res.ok ? 'delivered' : 'failed';
      if (!res.ok) console.error('[sms] twilio error', res.status, (await res.text()).slice(0, 200));
    } catch (e) {
      status = 'failed';
      console.error('[sms] send failed:', e.message);
    }
  } else {
    status = 'delivered'; // simulated delivery, like the prototype
    console.log(`[sms:simulated] to ${to}: ${body}`);
  }

  await db('sms_log').insert({ ts: Date.now(), to, body, status });
  const old = await db('sms_log').orderBy('id', 'desc').offset(60).first();
  if (old) await db('sms_log').where('id', '<=', old.id).del();
  broadcast('sms');
}

function normalizePhone(p) {
  const digits = String(p).replace(/\D/g, '');
  if (digits.length === 10) return '+91' + digits; // customers keyed by 10-digit Indian numbers
  return p.startsWith('+') ? p : '+' + digits;
}
