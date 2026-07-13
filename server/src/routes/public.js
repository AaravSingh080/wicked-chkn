import { Router } from 'express';
import crypto from 'node:crypto';
import { db, getSetting, addActivity, rowToItem } from '../db.js';
import { RULES, FLOWS } from '../menu-data.js';
import { broadcast } from '../realtime.js';
import { sendSms, twilioEnvConfigured } from '../services/sms.js';
import { createPaymentOrder, verifyPayment, razorpayConfigured } from '../services/payments.js';
import { priceOrder, serializeOrder, serializeOrders, makeOrderNumber, httpError, PROMO } from '../orders.js';
import { customerChat } from '../ai/customer.js';

const r = Router();

const isOpenNow = async () => {
  const storeOpen = await getSetting('store_open');
  if (!storeOpen) return false;
  // Hours gating is opt-in (ENFORCE_HOURS=1) so the pitch demo works at any hour.
  if (process.env.ENFORCE_HOURS === '1') {
    const h = new Date().getHours();
    return h >= RULES.openHour && h < RULES.closeHour;
  }
  return true;
};

// learning kitchen ETA: rolling average of real accepted→ready times
async function kitchenPace() {
  const rows = await db('orders').whereNotNull('accepted_at').whereNotNull('ready_at').orderBy('ready_at', 'desc').limit(20);
  const mins = rows.map((o) => (Number(o.ready_at) - Number(o.accepted_at)) / 60000).filter((m) => m > 0 && m < 120);
  if (mins.length < 3) return null;
  return Math.max(5, Math.round(mins.reduce((a, b) => a + b, 0) / mins.length));
}

// Ludhiana weather via open-meteo (keyless, cached 30 min) — used for mood-aware picks
let weatherCache = { ts: 0, data: null };
async function getWeather() {
  if (Date.now() - weatherCache.ts < 30 * 60e3) return weatherCache.data;
  try {
    const r = await fetch(
      'https://api.open-meteo.com/v1/forecast?latitude=30.889&longitude=75.808&current=temperature_2m,precipitation,weather_code'
    );
    const j = await r.json();
    const t = Math.round(j.current.temperature_2m);
    const code = j.current.weather_code;
    const rain = j.current.precipitation > 0 || (code >= 51 && code <= 99);
    weatherCache = { ts: Date.now(), data: { temp: t, mood: rain ? 'rain' : t >= 32 ? 'hot' : t <= 18 ? 'cool' : 'pleasant' } };
  } catch {
    weatherCache = { ts: Date.now(), data: null }; // offline → no weather features, no breakage
  }
  return weatherCache.data;
}

// ---------- config + menu ----------
r.get('/config', async (req, res) => {
  const marketing = await getSetting('marketing_auto');
  res.json({
    kitchenEta: await kitchenPace(),
    weather: await getWeather(),
    storeOpen: await isOpenNow(),
    storePaused: !(await getSetting('store_open')),
    openHour: RULES.openHour,
    closeHour: RULES.closeHour,
    deliveryFee: RULES.deliveryFee,
    deliveryRadiusKm: RULES.deliveryRadiusKm,
    eta: RULES.eta,
    promo: PROMO,
    recommendEnabled: !!marketing.recommend,
    razorpay: razorpayConfigured(),
    smsReal: twilioEnvConfigured()
  });
});

r.get('/menu', async (req, res) => {
  const rows = await db('menu_items').orderBy('sort');
  res.json(rows.map(rowToItem));
});

// ---------- recommendations ("For you" AI picks) ----------
r.get('/recommendations', async (req, res) => {
  const marketing = await getSetting('marketing_auto');
  if (!marketing.recommend) return res.json([]);
  const veg = req.query.veg === '1';
  const rows = await db('menu_items').where({ in_stock: true }).orderBy('sort');
  let items = rows.map(rowToItem).filter((i) => !veg || i.veg);

  let lastCats = [];
  const phone = String(req.query.phone || '').replace(/\D/g, '');
  if (phone.length === 10) {
    const cust = await db('customers').where({ phone }).first();
    if (cust) {
      const lastOrder = await db('orders').where({ phone }).orderBy('created_at', 'desc').first();
      if (lastOrder) {
        const lines = await db('order_lines').where({ order_id: lastOrder.id });
        const cats = await db('menu_items').whereIn('id', lines.map((l) => l.menu_item_id)).select('id', 'category', 'spicy');
        lastCats = cats;
      }
    }
  }
  const hadBurger = lastCats.some((c) => !['Wicked Wedges', 'Chicken Snacks', 'Drinks'].includes(c.category));
  const hadSpicy = lastCats.some((c) => c.spicy);

  const picks = [];
  const push = (item, reason) => {
    if (item && !picks.some((p) => p.id === item.id)) picks.push({ ...item, reason });
  };
  // weather-mood picks come first — nobody else does this
  const wx = await getWeather();
  if (wx?.mood === 'rain') {
    push(items.find((i) => i.category === 'Wicked Wedges'), 'Rain in Ludhiana — crispy weather');
    push(items.find((i) => i.category === 'Chicken Snacks'), 'Monsoon mood calls for hot fried chicken');
  } else if (wx?.mood === 'hot') {
    push(items.find((i) => i.category === 'Drinks'), `It's ${wx.temp}° out — cool down first`);
    push(items.find((i) => i.id === 'iced-tea-peach'), 'Beat the heat, iced-tea style');
  } else if (wx?.mood === 'cool') {
    push(items.find((i) => i.spicy), `${wx.temp}° evening — bring the heat`);
  }
  if (hadSpicy) push(items.find((i) => i.category === 'Drinks'), 'Cools down the harrisa heat');
  if (hadBurger) {
    push(items.find((i) => i.id === 'wicked-wedges'), 'Pairs with your usual burger order');
    push(items.find((i) => i.category === 'Drinks'), 'Rounds out the meal');
  }
  for (const i of items.filter((x) => x.popular)) push(i, 'Crowd favourite this week');
  push(items.find((i) => i.id === 'loaded-wedges'), 'Most wicked share plate right now');
  push(items.find((i) => i.category === 'Wicked Wedges'), 'Great for sharing');
  res.json(picks.slice(0, 6));
});

// ---------- cart sync (abandoned-cart tracking) ----------
r.put('/carts/:sessionId', async (req, res) => {
  const sessionId = String(req.params.sessionId).slice(0, 64);
  const { lines = [], total = 0, customerName = '' } = req.body || {};
  const empty = !Array.isArray(lines) || lines.length === 0;
  if (empty) {
    await db('carts').where({ session_id: sessionId }).del();
  } else {
    const payload = {
      session_id: sessionId,
      customer_name: String(customerName || '').slice(0, 60),
      lines: JSON.stringify(lines),
      total: Math.max(0, Number(total) || 0),
      updated_at: Date.now(),
      nudged: false
    };
    const existing = await db('carts').where({ session_id: sessionId }).first();
    if (existing) await db('carts').where({ session_id: sessionId }).update(payload);
    else await db('carts').insert(payload);
  }
  broadcast('carts');
  res.json({ ok: true });
});

// ---------- auth: phone OTP ----------
const otpHits = new Map(); // naive per-phone rate limit
r.post('/auth/otp', async (req, res) => {
  const phone = String(req.body?.phone || '').replace(/\D/g, '');
  if (phone.length !== 10) throw httpError(400, 'Enter a 10-digit phone number.');
  const hits = (otpHits.get(phone) || []).filter((t) => t > Date.now() - 10 * 60e3);
  if (hits.length >= 5) throw httpError(429, 'Too many codes requested — try again in a few minutes.');
  hits.push(Date.now());
  otpHits.set(phone, hits);

  const real = twilioEnvConfigured();
  const code = real ? String(1000 + Math.floor(Math.random() * 9000)) : '0000';
  const existing = await db('otp_codes').where({ phone }).first();
  const row = { phone, code, expires_at: Date.now() + 5 * 60e3, attempts: 0 };
  if (existing) await db('otp_codes').where({ phone }).update(row);
  else await db('otp_codes').insert(row);

  await sendSms(phone, `${code} is your Wicked Chkn sign-in code. Valid for 5 minutes.`, { force: true });
  res.json({ ok: true, simulated: !real, ...(real ? {} : { devCode: code }) });
});

r.post('/auth/verify', async (req, res) => {
  const phone = String(req.body?.phone || '').replace(/\D/g, '');
  const code = String(req.body?.code || '').trim();
  const name = String(req.body?.name || '').trim().slice(0, 60);
  const row = await db('otp_codes').where({ phone }).first();
  if (!row || row.expires_at < Date.now()) throw httpError(400, 'That code expired — request a new one.');
  if (row.attempts >= 5) throw httpError(429, 'Too many attempts — request a new code.');
  if (row.code !== code) {
    await db('otp_codes').where({ phone }).update({ attempts: row.attempts + 1 });
    throw httpError(400, "That code doesn't match — check the SMS and try again.");
  }
  await db('otp_codes').where({ phone }).del();

  let customer = await db('customers').where({ phone }).first();
  if (!customer) {
    const [id] = await db('customers').insert({ phone, name, created_at: Date.now() }).returning('id');
    customer = await db('customers').where({ id: typeof id === 'object' ? id.id : id }).first();
    await addActivity(`${name || phone} signed in for the first time`);
  } else {
    if (name && name !== customer.name) await db('customers').where({ id: customer.id }).update({ name });
    await addActivity(`${name || customer.name || phone} signed in`);
  }
  const token = crypto.randomBytes(24).toString('hex');
  await db('auth_tokens').insert({ token, customer_id: customer.id, created_at: Date.now() });
  broadcast('customers');
  broadcast('activity');
  res.json({ token, customer: { id: customer.id, name: name || customer.name || '', phone } });
});

// Social sign-in (Apple / Google). Demo: the client simulates the provider
// handshake; production verifies the provider's ID token here (Sign in with
// Apple JWT / Google Identity token) before trusting the identity.
r.post('/auth/social', async (req, res) => {
  const provider = ['apple', 'google'].includes(req.body?.provider) ? req.body.provider : null;
  if (!provider) throw httpError(400, 'Unknown sign-in provider.');
  const phone = String(req.body?.phone || '').replace(/\D/g, '');
  if (phone.length !== 10) throw httpError(400, 'Enter a 10-digit phone number.');
  const name = String(req.body?.name || '').trim().slice(0, 60);

  let customer = await db('customers').where({ phone }).first();
  if (!customer) {
    const [id] = await db('customers').insert({ phone, name, created_at: Date.now() }).returning('id');
    customer = await db('customers').where({ id: typeof id === 'object' ? id.id : id }).first();
  } else if (name && name !== customer.name) {
    await db('customers').where({ id: customer.id }).update({ name });
  }
  const providerName = provider === 'apple' ? 'Apple' : 'Google';
  await addActivity(`${name || customer.name || phone} signed in with ${providerName}`);
  const token = crypto.randomBytes(24).toString('hex');
  await db('auth_tokens').insert({ token, customer_id: customer.id, created_at: Date.now() });
  broadcast('customers');
  broadcast('activity');
  res.json({ token, customer: { id: customer.id, name: name || customer.name || '', phone } });
});

async function authed(req) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const row = await db('auth_tokens').where({ token }).first();
  if (!row) return null;
  return db('customers').where({ id: row.customer_id }).first();
}

r.get('/me', async (req, res) => {
  const customer = await authed(req);
  if (!customer) return res.status(401).json({ error: 'Not signed in' });
  const favs = await db('favourites').where({ customer_id: customer.id });
  res.json({
    customer: { id: customer.id, name: customer.name || '', phone: customer.phone },
    favourites: favs.map((f) => f.menu_item_id)
  });
});

r.put('/me/favourites', async (req, res) => {
  const customer = await authed(req);
  if (!customer) return res.status(401).json({ error: 'Not signed in' });
  const { itemId, fav } = req.body || {};
  await db('favourites').where({ customer_id: customer.id, menu_item_id: itemId }).del();
  if (fav) await db('favourites').insert({ customer_id: customer.id, menu_item_id: itemId });
  res.json({ ok: true });
});

// ---------- payments ----------
r.post('/payments/create', async (req, res) => {
  const { items = [], type = 'pickup', promo } = req.body || {};
  if (!(await isOpenNow())) throw httpError(409, 'Ordering is paused right now.');
  const priced = await priceOrder(items, type, promo);
  const payment = await createPaymentOrder(priced.total);
  res.json({ ...payment, total: priced.total });
});

// ---------- orders ----------
r.post('/orders', async (req, res) => {
  const b = req.body || {};
  const type = ['dinein', 'pickup', 'delivery'].includes(b.type) ? b.type : null;
  if (!type) throw httpError(400, 'Pick an order type.');
  if (!(await isOpenNow())) throw httpError(409, "Ordering is paused right now — we're open 11 AM to 10 PM.");

  const name = String(b.name || '').trim();
  const phone = String(b.phone || '').replace(/\D/g, '');
  if (name.length < 2) throw httpError(400, 'Add your name (at least 2 characters).');
  if (phone.length !== 10) throw httpError(400, 'Enter a 10-digit phone number.');
  const address = String(b.address || '').trim();
  const tableNo = String(b.tableNo || '').trim();
  if (type === 'delivery' && address.length < 6) throw httpError(400, 'Add a delivery address (at least 6 characters).');
  if (type === 'dinein' && !tableNo) throw httpError(400, 'Add your table number.');

  const payMethod = b.payMethod === 'cash' ? 'cash' : 'online';
  if (type === 'delivery' && payMethod === 'cash') throw httpError(400, 'Delivery orders are prepaid only.');

  const priced = await priceOrder(b.items || [], type, b.promo);

  let paymentId = null;
  let paymentSignature = null;
  if (payMethod === 'online') {
    const p = b.payment || {};
    if (!verifyPayment(p)) throw httpError(402, "Payment didn't go through — your cart is safe. Try again or pay cash.");
    paymentId = p.paymentId;
    paymentSignature = p.signature || null;
  }

  // upsert customer (customers keyed by 10-digit phone)
  let customer = await db('customers').where({ phone }).first();
  if (!customer) {
    const [id] = await db('customers').insert({ phone, name, created_at: Date.now() }).returning('id');
    customer = await db('customers').where({ id: typeof id === 'object' ? id.id : id }).first();
  }

  const num = makeOrderNumber();
  const now = Date.now();
  const [orderIdRaw] = await db('orders')
    .insert({
      order_number: num,
      created_at: now,
      customer_id: customer.id,
      customer_name: name,
      phone,
      type,
      status_index: 0,
      subtotal: priced.subtotal,
      discount: priced.discount,
      delivery_fee: priced.deliveryFee,
      total: priced.total,
      pay_method: payMethod,
      payment_id: paymentId,
      payment_signature: paymentSignature,
      address: type === 'delivery' ? address : null,
      table_no: type === 'dinein' ? tableNo : null,
      promo_code: priced.promoCode
    })
    .returning('id');
  const orderId = typeof orderIdRaw === 'object' ? orderIdRaw.id : orderIdRaw;
  await db('order_lines').insert(priced.lines.map((l) => ({ ...l, order_id: orderId })));

  await db('customers')
    .where({ id: customer.id })
    .update({
      name,
      orders_count: (customer.orders_count || 0) + 1,
      lifetime_spend: (customer.lifetime_spend || 0) + priced.total,
      last_order_at: now
    });

  if (b.sessionId) await db('carts').where({ session_id: String(b.sessionId) }).del();

  // gift voucher: mark redeemed
  if (priced.voucherCode) {
    await db('vouchers').where({ code: priced.voucherCode }).update({ redeemed_at: now, redeemed_order: num });
  }

  // portion tracking: decrement counted items, auto-sold-out at zero
  for (const l of priced.lines) {
    const mi = await db('menu_items').where({ id: l.menu_item_id }).first();
    if (mi && mi.stock_count != null) {
      const left = Math.max(0, Number(mi.stock_count) - l.qty);
      const patch = { stock_count: left };
      if (left === 0 && mi.in_stock) patch.in_stock = false;
      await db('menu_items').where({ id: mi.id }).update(patch);
      if (left === 0 && mi.in_stock) await addActivity(`${mi.name} auto-marked sold out — portions ran out`);
    }
  }
  broadcast('menu');

  await addActivity(`New ${type === 'dinein' ? 'dine-in' : type} order ${num} — ₹${priced.total} (${payMethod === 'online' ? 'paid online' : 'cash'})`);
  await sendSms(phone, `Wicked Chkn: got your order ${num} — ₹${priced.total}. We'll confirm it in a moment.`);
  broadcast('orders', { orderId, num, status: 'Order placed' });
  broadcast('carts');
  broadcast('activity');
  broadcast('customers');

  const row = await db('orders').where({ id: orderId }).first();
  res.status(201).json(await serializeOrder(row));
});

r.get('/orders/:id', async (req, res) => {
  const row = await db('orders').where({ id: Number(req.params.id) }).first();
  if (!row) throw httpError(404, 'Order not found');
  res.json(await serializeOrder(row));
});

r.get('/orders', async (req, res) => {
  const phone = String(req.query.phone || '').replace(/\D/g, '');
  if (phone.length !== 10) return res.json([]);
  const rows = await db('orders').where({ phone }).orderBy('created_at', 'desc').limit(20);
  res.json(await serializeOrders(rows));
});

// ---------- taste profile: a fun archetype from real order history ----------
r.get('/taste', async (req, res) => {
  const phone = String(req.query.phone || '').replace(/\D/g, '');
  if (phone.length !== 10) return res.json({ profile: null });
  const orders = await db('orders').where({ phone }).whereNull('cancelled_at');
  if (!orders.length) return res.json({ profile: null });
  const lines = await db('order_lines').whereIn('order_id', orders.map((o) => o.id));
  const meta = new Map((await db('menu_items')).map((m) => [m.id, rowToItem(m)]));

  let total = 0, spicy = 0, veg = 0, teas = 0, burritos = 0;
  const byName = {};
  for (const l of lines) {
    const m = meta.get(l.menu_item_id);
    total += l.qty;
    byName[l.name_snapshot] = (byName[l.name_snapshot] || 0) + l.qty;
    if (!m) continue;
    if (m.spicy) spicy += l.qty;
    if (m.veg) veg += l.qty;
    if (m.category === 'Drinks') teas += l.qty;
    if (m.category === 'Burritos & Quesadillas') burritos += l.qty;
  }
  const aov = Math.round(orders.reduce((a, o) => a + o.total, 0) / orders.length);
  const favourite = Object.entries(byName).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  const pick = () => {
    if (total && spicy / total >= 0.3) return ['The Fire Breather', 'Harrisa heat runs in your veins.', 'fire'];
    if (total && veg / total >= 0.8) return ['The Green Wing', 'Plants — but make them wicked.', 'forest'];
    if (total && burritos / total >= 0.35) return ['The Burrito Bandit', 'Wrapped, rolled, and gone in minutes.', 'candy'];
    if (aov >= 500) return ['The Big Spender', 'You never go home hungry. Or alone — the wedges agree.', 'ocean'];
    if (total && teas / total >= 0.3) return ['The Iced-Tea Sipper', 'Every order chilled to perfection.', 'candy'];
    if (orders.length >= 5) return ['The Wicked Regular', 'A true regular. The fryer knows your name.', 'ocean'];
    return ['The Explorer', 'Working through the menu, one bite at a time.', 'forest'];
  };
  const [name, line, theme] = pick();
  res.json({
    profile: { name, line, theme },
    stats: { orders: orders.length, favourite, spiceLevel: Math.min(5, Math.round((spicy / Math.max(1, total)) * 10)), aov }
  });
});

// ---------- loyalty punch card ----------
r.get('/loyalty', async (req, res) => {
  const phone = String(req.query.phone || '').replace(/\D/g, '');
  if (phone.length !== 10) return res.json({ completed: 0, stamps: 0, target: 8 });
  const all = await db('orders').where({ phone });
  const completed = all.filter((o) => o.status_index >= (FLOWS[o.type]?.length || 4) - 1).length;
  const stamps = completed % 8;
  res.json({
    completed,
    stamps,
    target: 8,
    justEarned: completed > 0 && stamps === 0,
    reward: 'Free Wicked Wedges (₹149 voucher by SMS)'
  });
});

// ---------- ratings ----------
r.post('/orders/:id/rating', async (req, res) => {
  const row = await db('orders').where({ id: Number(req.params.id) }).first();
  if (!row) throw httpError(404, 'Order not found');
  const stars = Math.max(1, Math.min(5, Number(req.body?.stars) || 0));
  if (!stars) throw httpError(400, 'Pick a star rating.');
  const tags = (Array.isArray(req.body?.tags) ? req.body.tags : []).slice(0, 5).map((t) => String(t).slice(0, 20));
  await db('ratings').where({ order_id: row.id }).del();
  await db('ratings').insert({ order_id: row.id, stars, tags: JSON.stringify(tags), ts: Date.now() });
  await addActivity(`${row.order_number} rated ${'★'.repeat(stars)}${tags.length ? ` (${tags.join(', ')})` : ''}`);
  broadcast('orders', { orderId: row.id });
  broadcast('activity');
  res.json({ ok: true });
});

// ---------- "I'm outside" (pickup arrival) ----------
r.post('/orders/:id/arrived', async (req, res) => {
  const row = await db('orders').where({ id: Number(req.params.id) }).first();
  if (!row) throw httpError(404, 'Order not found');
  const note = String(req.body?.note || '').slice(0, 60);
  await db('orders').where({ id: row.id }).update({ arrived_at: Date.now(), arrived_note: note || null });
  await addActivity(`${row.order_number}: customer is outside${note ? ` (${note})` : ''}`);
  broadcast('orders', { orderId: row.id });
  broadcast('activity');
  res.json({ ok: true });
});

// ---------- stories ----------
r.get('/stories', async (req, res) => {
  const rows = await db('stories').where('expires_at', '>', Date.now()).orderBy('ts', 'desc').limit(10);
  res.json(rows.map((s) => ({ id: s.id, ts: Number(s.ts), caption: s.caption, theme: s.theme })));
});

// ---------- gift vouchers ----------
r.get('/vouchers/:code', async (req, res) => {
  const v = await db('vouchers').where({ code: String(req.params.code).toUpperCase() }).first();
  if (!v) return res.json({ valid: false });
  res.json({ valid: !v.redeemed_at, amount: v.amount, redeemed: !!v.redeemed_at });
});

r.post('/vouchers', async (req, res) => {
  const amount = [200, 500, 1000].includes(Number(req.body?.amount)) ? Number(req.body.amount) : null;
  if (!amount) throw httpError(400, 'Pick a gift amount.');
  const toPhone = String(req.body?.toPhone || '').replace(/\D/g, '');
  if (toPhone.length !== 10) throw httpError(400, "Enter the recipient's 10-digit phone.");
  if (!verifyPayment(req.body?.payment || {})) throw httpError(402, "Payment didn't go through — try again.");
  const code = 'WCGIFT-' + crypto.randomBytes(3).toString('hex').toUpperCase();
  const fromName = String(req.body?.fromName || '').slice(0, 60);
  const message = String(req.body?.message || '').slice(0, 200);
  await db('vouchers').insert({ code, amount, from_name: fromName, to_phone: toPhone, message, ts: Date.now() });
  await sendSms(
    toPhone,
    `${fromName || 'Someone'} sent you a ₹${amount} Wicked Chkn treat! Use code ${code} at checkout.${message ? ` "${message}"` : ''}`,
    { force: true }
  );
  await addActivity(`Gift voucher ${code} (₹${amount}) sent to ${toPhone}`);
  broadcast('activity');
  res.status(201).json({ code, amount });
});

// ---------- notifications the app should show (campaigns + recovery nudges) ----------
r.get('/notifications', async (req, res) => {
  const since = Number(req.query.since) || Date.now() - 60e3;
  const sessionId = String(req.query.sessionId || '');
  const rows = await db('campaigns')
    .where('ts', '>', since)
    .andWhere((q) => q.whereNull('target_session').orWhere('target_session', sessionId))
    .orderBy('ts');
  res.json(rows.map((c) => ({ id: c.id, kind: c.kind, ts: Number(c.ts), text: c.text })));
});

// ---------- AI chat (customer assistant) ----------
r.post('/ai/chat', async (req, res) => {
  const out = await customerChat(req.body || {});
  res.json(out);
});

export default r;
