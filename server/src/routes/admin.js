import { Router } from 'express';
import express from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, getSetting, setSetting, addActivity, addMarketingLog, rowToItem, seed } from '../db.js';
import { FLOWS, CATEGORIES, modsForCategory } from '../menu-data.js';

const UPLOADS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'uploads');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });
import { broadcast } from '../realtime.js';
import { sendSms, twilioEnvConfigured } from '../services/sms.js';
import { generateText, activeProvider, maskedKey } from '../services/llm.js';
import { serializeOrders, serializeOrder, priceOrder, makeOrderNumber, httpError } from '../orders.js';
import { staffChat } from '../ai/staff.js';

const r = Router();

// ---------- PIN gate (defined first so /auth bypasses the guard) ----------
const adminTokens = new Set(); // in-memory; server restart re-prompts the dashboard

r.post('/auth', async (req, res) => {
  const pin = String(req.body?.pin || '');
  const expected = (await getSetting('admin_pin')) || '1234';
  if (pin !== expected) {
    const e = new Error('Wrong PIN — try again.');
    e.status = 403;
    throw e;
  }
  const token = crypto.randomBytes(24).toString('hex');
  adminTokens.add(token);
  res.json({ token });
});

r.use((req, res, next) => {
  if (adminTokens.has(req.headers['x-admin-token'])) return next();
  const e = new Error('Admin sign-in required');
  e.status = 401;
  throw e;
});

// ---------- demo reset ----------
r.post('/reset', async (req, res) => {
  const tables = [
    'orders', 'order_lines', 'ratings', 'support_tickets', 'carts', 'campaigns', 'stories',
    'vouchers', 'sms_log', 'auth_tokens', 'otp_codes', 'favourites', 'customers',
    'activity_log', 'marketing_log'
  ];
  for (const t of tables) await db(t).del();
  await db('menu_items').update({ in_stock: true, stock_count: null }); // seed state: everything in stock
  await setSetting('store_open', true);
  await seed(); // re-seeds the activity/marketing starter rows (sales history is preserved)
  await addActivity('Demo data reset — clean slate');
  for (const topic of ['menu', 'orders', 'config', 'activity', 'carts', 'customers', 'sms', 'notify', 'stories']) broadcast(topic);
  res.json({ ok: true });
});

// ---------- demo rush: simulated Friday-night traffic for pitches ----------
let rushTimer = null;
let rushStopTimer = null;
const RUSH_NAMES = ['Simran K', 'Arjun M', 'Priya S', 'Rohan G', 'Neha T', 'Vikram S', 'Anita D', 'Kabir B', 'Mehak J', 'Harsh P'];
const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];

async function createDemoOrder() {
  const menu = (await db('menu_items').where({ in_stock: true })).map(rowToItem);
  const picks = [...menu].sort(() => Math.random() - 0.5).slice(0, 1 + Math.floor(Math.random() * 3));
  const items = picks.map((m) => ({ id: m.id, qty: Math.random() < 0.25 ? 2 : 1 }));
  const type = rand(['dinein', 'pickup', 'pickup', 'delivery']);
  const priced = await priceOrder(items, type, Math.random() < 0.3 ? 'WICKED10' : null);
  const name = rand(RUSH_NAMES);
  const phone = '98' + String(Math.floor(10000000 + Math.random() * 89999999));
  let customer = await db('customers').where({ phone }).first();
  if (!customer) {
    const [id] = await db('customers').insert({ phone, name, created_at: Date.now() }).returning('id');
    customer = await db('customers').where({ id: typeof id === 'object' ? id.id : id }).first();
  }
  const num = makeOrderNumber();
  const now = Date.now();
  const [oidRaw] = await db('orders')
    .insert({
      order_number: num, created_at: now, customer_id: customer.id, customer_name: name, phone, type,
      status_index: 0, subtotal: priced.subtotal, discount: priced.discount, delivery_fee: priced.deliveryFee,
      total: priced.total, pay_method: type === 'delivery' ? 'online' : rand(['online', 'cash']),
      payment_id: 'pay_demo', address: type === 'delivery' ? rand(['12 Sarabha Nagar', '8 Model Town', '44 BRS Nagar']) : null,
      table_no: type === 'dinein' ? String(1 + Math.floor(Math.random() * 8)) : null, promo_code: priced.promoCode
    })
    .returning('id');
  const orderId = typeof oidRaw === 'object' ? oidRaw.id : oidRaw;
  await db('order_lines').insert(priced.lines.map((l) => ({ ...l, order_id: orderId })));
  await db('customers').where({ id: customer.id }).update({
    orders_count: (customer.orders_count || 0) + 1,
    lifetime_spend: (customer.lifetime_spend || 0) + priced.total,
    last_order_at: now
  });
  await addActivity(`New ${type === 'dinein' ? 'dine-in' : type} order ${num} — ₹${priced.total}`);
  broadcast('orders', { orderId, num, status: 'Order placed' });
  broadcast('activity');
  broadcast('customers');
}

async function advanceRandomOrder() {
  const rows = await db('orders').where('created_at', '>=', startOfToday()).whereNull('cancelled_at').orderBy('created_at', 'desc').limit(30);
  const live = rows.filter((o) => o.status_index < (FLOWS[o.type]?.length || 4) - 1 && o.status_index > 0);
  if (!live.length) return;
  const o = rand(live);
  const flow = FLOWS[o.type];
  await db('orders').where({ id: o.id }).update({ status_index: o.status_index + 1 });
  broadcast('orders', { orderId: o.id, num: o.order_number, status: flow[o.status_index + 1] });
}

function stopRush() {
  clearInterval(rushTimer);
  clearTimeout(rushStopTimer);
  rushTimer = null;
  rushStopTimer = null;
}

r.get('/demo-rush', (req, res) => res.json({ running: !!rushTimer }));

r.post('/demo-rush', async (req, res) => {
  if (!req.body?.on) {
    stopRush();
    await addActivity('Demo rush stopped');
    broadcast('activity');
    return res.json({ ok: true, running: false });
  }
  if (rushTimer) return res.json({ ok: true, running: true });
  await addActivity('Friday-rush simulation started (auto-stops in 5 min)');
  broadcast('activity');
  createDemoOrder().catch(() => {});
  rushTimer = setInterval(() => {
    const roll = Math.random();
    (roll < 0.55 ? createDemoOrder() : Promise.all([advanceRandomOrder(), roll > 0.85 ? advanceRandomOrder() : null])).catch(() => {});
  }, 7000);
  rushStopTimer = setTimeout(async () => {
    stopRush();
    await addActivity('Demo rush finished');
    broadcast('activity');
  }, 5 * 60e3);
  res.json({ ok: true, running: true });
});

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

// hourly revenue bins — 11a–9p window, widened to include any off-hours orders
// (demo mode allows ordering at any hour; those must not vanish from the chart)
function hourBins(orders) {
  let lo = 11;
  let hi = 21;
  for (const o of orders) {
    const h = new Date(Number(o.created_at)).getHours();
    lo = Math.min(lo, h);
    hi = Math.max(hi, h);
  }
  const bins = [];
  for (let h = lo; h <= hi; h++) {
    const label = h === 0 ? '12a' : h === 12 ? '12p' : h < 12 ? `${h}a` : `${h - 12}p`;
    const value = orders.filter((o) => new Date(Number(o.created_at)).getHours() === h).reduce((a, o) => a + o.total, 0);
    bins.push({ label, value });
  }
  return bins;
}

// ---------- overview ----------
r.get('/overview', async (req, res) => {
  const orders = await db('orders').where('created_at', '>=', startOfToday()).whereNull('cancelled_at');
  const revenue = orders.reduce((a, o) => a + o.total, 0);
  const inProgress = orders.filter((o) => o.status_index < (FLOWS[o.type]?.length || 4) - 1).length;
  const bins = hourBins(orders);

  const lines = orders.length
    ? await db('order_lines').whereIn('order_id', orders.map((o) => o.id))
    : [];
  const byItem = new Map();
  for (const l of lines) {
    const cur = byItem.get(l.name_snapshot) || { name: l.name_snapshot, qty: 0, revenue: 0 };
    cur.qty += l.qty;
    cur.revenue += l.line_total;
    byItem.set(l.name_snapshot, cur);
  }
  const topItems = [...byItem.values()].sort((a, b) => b.qty - a.qty).slice(0, 5);

  res.json({
    revenueToday: revenue,
    ordersToday: orders.length,
    inProgress,
    aov: orders.length ? Math.round(revenue / orders.length) : 0,
    aovTarget: 450,
    commissionSaved: Math.round(revenue * 0.25),
    salesByHour: bins,
    topItems
  });
});

// ---------- AI daily brief ----------
let briefCache = { ts: 0, text: '' };
r.get('/brief', async (req, res) => {
  if (Date.now() - briefCache.ts < 30 * 60e3 && briefCache.text) return res.json({ brief: briefCache.text });
  const orders = await db('orders').where('created_at', '>=', startOfToday()).whereNull('cancelled_at');
  const revenue = orders.reduce((a, o) => a + o.total, 0);
  const yesterKey = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return localKey(d); })();
  const yester = await db('daily_rollups').where({ date: yesterKey }).first();
  const lines = orders.length ? await db('order_lines').whereIn('order_id', orders.map((o) => o.id)) : [];
  const counts = {};
  for (const l of lines) counts[l.name_snapshot] = (counts[l.name_snapshot] || 0) + l.qty;
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  const soldOut = (await db('menu_items').where({ in_stock: false })).map((m) => m.name);
  const stats = { todayRevenue: revenue, todayOrders: orders.length, yesterdayRevenue: yester?.revenue || 0, topItem: top?.[0] || null, soldOut };

  let text = null;
  try {
    text = await generateText({
      system: 'You are a concise restaurant-operations analyst for Wicked Chkn, a burger joint in Ludhiana. Two sentences max, practical, no fluff, use ₹.',
      prompt: `Write today's morning brief for the owner from this data: ${JSON.stringify(stats)}. Mention pace vs yesterday and one action.`,
      maxTokens: 120
    });
  } catch {}
  if (!text) {
    const pace = stats.yesterdayRevenue ? Math.round((revenue / stats.yesterdayRevenue) * 100) : null;
    text = `Today so far: ₹${revenue.toLocaleString('en-IN')} across ${orders.length} order${orders.length === 1 ? '' : 's'}${top ? ` — top mover: ${top[0]}` : ''}${pace != null ? ` (${pace}% of yesterday's full day)` : ''}. ${soldOut.length ? `Restock check: ${soldOut.join(', ')} still marked sold out.` : 'Nothing is sold out — kitchen is fully stocked.'}`;
  }
  briefCache = { ts: Date.now(), text };
  res.json({ brief: text });
});

// ---------- live orders ----------
r.get('/orders', async (req, res) => {
  const rows = await db('orders').orderBy('created_at', 'desc').limit(60);
  res.json(await serializeOrders(rows));
});

r.patch('/orders/:id', async (req, res) => {
  const row = await db('orders').where({ id: Number(req.params.id) }).first();
  if (!row) throw httpError(404, 'Order not found');
  const flow = FLOWS[row.type];
  const action = req.body?.action;
  if (row.cancelled_at && action !== 'cancel') throw httpError(409, 'This order was cancelled.');

  if (action === 'accept') {
    if (row.status_index !== 0) throw httpError(409, 'Order was already accepted.');
    await db('orders').where({ id: row.id }).update({ status_index: 1, accepted_at: Date.now() });
    await addActivity(`${row.order_number} accepted`);
    await sendSms(row.phone, `Wicked Chkn: ${row.order_number} is accepted — the kitchen has it. ETA ${etaFor(row.type)}.`);
    broadcast('orders', { orderId: row.id, num: row.order_number, status: flow[1] });
  } else if (action === 'advance') {
    if (row.status_index >= flow.length - 1) throw httpError(409, 'Order is already complete.');
    const idx = row.status_index + 1;
    const patch = { status_index: idx };
    if (/^Ready/.test(flow[idx]) && !row.ready_at) patch.ready_at = Date.now(); // feeds the learning ETA
    await db('orders').where({ id: row.id }).update(patch);
    await addActivity(`${row.order_number} → ${flow[idx]}`);
    await sendSms(row.phone, `Wicked Chkn: ${row.order_number} update — ${flow[idx]}.`);
    broadcast('orders', { orderId: row.id, num: row.order_number, status: flow[idx] });
    // loyalty punch-card: every 8th completed order earns a free Wicked Wedges voucher
    if (idx === flow.length - 1 && row.phone) {
      const all = await db('orders').where({ phone: row.phone });
      const completed = all.filter((o) => o.status_index >= (FLOWS[o.type]?.length || 4) - 1).length;
      if (completed > 0 && completed % 8 === 0) {
        const code = 'WCGIFT-' + crypto.randomBytes(3).toString('hex').toUpperCase();
        await db('vouchers').insert({ code, amount: 149, from_name: 'Wicked Chkn Loyalty', to_phone: row.phone, message: 'Punch card complete!', ts: Date.now() });
        await sendSms(row.phone, `Punch card complete! Wicked Wedges on us — use code ${code} on your next order. — Wicked Chkn`, { force: true });
        await addActivity(`Loyalty reward: ${row.customer_name || row.phone} completed 8 orders — free Wicked Wedges voucher sent`);
        broadcast('activity');
      }
    }
  } else if (action === 'rider') {
    if (row.type !== 'delivery') throw httpError(400, 'Riders only apply to delivery orders.');
    const name = String(req.body?.name || '').trim().slice(0, 40);
    const phoneR = String(req.body?.phone || '').replace(/\D/g, '').slice(0, 10);
    if (!name) throw httpError(400, 'Add the rider name.');
    await db('orders').where({ id: row.id }).update({ rider_name: name, rider_phone: phoneR || null });
    await addActivity(`${row.order_number}: rider ${name} assigned`);
    await sendSms(row.phone, `Wicked Chkn: ${name}${phoneR ? ` (+91${phoneR})` : ''} is bringing your order ${row.order_number}.`);
    broadcast('orders', { orderId: row.id, num: row.order_number });
  } else if (action === 'cancel') {
    if (row.cancelled_at) throw httpError(409, 'Order is already cancelled.');
    if (row.status_index >= flow.length - 1) throw httpError(409, 'Completed orders cannot be cancelled.');
    const reason = String(req.body?.reason || '').trim().slice(0, 120) || 'Cancelled by the restaurant';
    await db('orders').where({ id: row.id }).update({ cancelled_at: Date.now(), cancel_reason: reason });
    await addActivity(`${row.order_number} CANCELLED — ${reason}`);
    await sendSms(
      row.phone,
      `Wicked Chkn: sorry, ${row.order_number} was cancelled (${reason}).${row.pay_method === 'online' ? ' Your refund is being processed.' : ''} Call us if you need anything.`
    );
    broadcast('orders', { orderId: row.id, num: row.order_number, status: 'Cancelled' });
  } else if (action === 'kot') {
    await db('orders').where({ id: row.id }).update({ kot_printed: true });
    await addActivity(`KOT printed for ${row.order_number}`);
    broadcast('orders', { orderId: row.id, num: row.order_number });
  } else {
    throw httpError(400, 'Unknown action');
  }

  broadcast('activity');
  const fresh = await db('orders').where({ id: row.id }).first();
  res.json(await serializeOrder(fresh));
});

const etaFor = (type) => ({ dinein: '15–20 min', pickup: '25–30 min', delivery: '35–40 min' })[type] || '';

// ---------- inventory ----------
r.put('/menu/:id/stock', async (req, res) => {
  const item = await db('menu_items').where({ id: req.params.id }).first();
  if (!item) throw httpError(404, 'Item not found');
  const inStock = !!req.body?.inStock;
  await db('menu_items').where({ id: item.id }).update({ in_stock: inStock });
  await addActivity(`${item.name} marked ${inStock ? 'back in stock' : 'OUT OF STOCK'}`);
  broadcast('menu');
  broadcast('activity');
  res.json({ ok: true });
});

// ---------- menu editor (owner-managed items + photos) ----------
const slugify = (name) =>
  String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40) || 'item';

function cleanItemFields(b, { partial = false } = {}) {
  const out = {};
  if (b.name !== undefined || !partial) {
    const name = String(b.name || '').trim().slice(0, 60);
    if (name.length < 2) throw httpError(400, 'Give the item a name (2+ characters).');
    out.name = name;
  }
  if (b.price !== undefined || !partial) {
    const price = Math.round(Number(b.price));
    if (!Number.isFinite(price) || price < 1 || price > 9999) throw httpError(400, 'Price must be ₹1–9999.');
    out.price = price;
  }
  if (b.category !== undefined || !partial) {
    if (!CATEGORIES.includes(b.category)) throw httpError(400, 'Pick a valid category.');
    out.category = b.category;
    out.modifiers = JSON.stringify(modsForCategory(b.category));
  }
  if (b.veg !== undefined) out.veg = !!b.veg;
  if (b.spicy !== undefined) out.spicy = !!b.spicy;
  if (b.popular !== undefined) out.popular = !!b.popular;
  if (b.desc !== undefined) out.description = String(b.desc || '').slice(0, 200);
  return out;
}

r.post('/menu', async (req, res) => {
  const fields = cleanItemFields(req.body || {});
  let id = slugify(fields.name);
  if (await db('menu_items').where({ id }).first()) id = `${id}-${crypto.randomBytes(2).toString('hex')}`;
  const maxSort = (await db('menu_items').max('sort as m').first())?.m || 0;
  await db('menu_items').insert({ id, ...fields, in_stock: true, sort: maxSort + 1 });
  await addActivity(`Menu: "${fields.name}" added (₹${fields.price})`);
  broadcast('menu');
  broadcast('activity');
  res.status(201).json({ id });
});

r.put('/menu/:id', async (req, res) => {
  const item = await db('menu_items').where({ id: req.params.id }).first();
  if (!item) throw httpError(404, 'Item not found');
  const fields = cleanItemFields(req.body || {}, { partial: true });
  await db('menu_items').where({ id: item.id }).update(fields);
  await addActivity(`Menu: "${fields.name || item.name}" updated`);
  broadcast('menu');
  broadcast('activity');
  res.json({ ok: true });
});

r.delete('/menu/:id', async (req, res) => {
  const item = await db('menu_items').where({ id: req.params.id }).first();
  if (!item) throw httpError(404, 'Item not found');
  const used = await db('order_lines').where({ menu_item_id: item.id }).first();
  if (used) throw httpError(409, 'This item has order history — mark it out of stock instead of deleting.');
  await db('menu_items').where({ id: item.id }).del();
  await addActivity(`Menu: "${item.name}" deleted`);
  broadcast('menu');
  broadcast('activity');
  res.json({ ok: true });
});

// photo upload: base64 data-URL in, file on disk, served at /api/uploads/*
r.put('/menu/:id/photo', express.json({ limit: '4mb' }), async (req, res) => {
  const item = await db('menu_items').where({ id: req.params.id }).first();
  if (!item) throw httpError(404, 'Item not found');
  if (req.body?.remove) {
    if (item.image_url) {
      const old = path.join(UPLOADS_DIR, path.basename(item.image_url.split('?')[0]));
      fs.rmSync(old, { force: true });
    }
    await db('menu_items').where({ id: item.id }).update({ image_url: null });
  } else {
    const m = String(req.body?.dataUrl || '').match(/^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/);
    if (!m) throw httpError(400, 'Upload a JPG, PNG or WebP image.');
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length > 3 * 1024 * 1024) throw httpError(413, 'Keep photos under 3 MB.');
    const ext = m[1] === 'jpg' ? 'jpeg' : m[1];
    const file = `${item.id}.${ext}`;
    fs.writeFileSync(path.join(UPLOADS_DIR, file), buf);
    await db('menu_items').where({ id: item.id }).update({ image_url: `/api/uploads/${file}?v=${Date.now()}` });
  }
  await addActivity(`Menu: photo ${req.body?.remove ? 'removed from' : 'updated for'} "${item.name}"`);
  broadcast('menu');
  broadcast('activity');
  res.json({ ok: true });
});

// portion tracking: set/clear the counted stock for an item
r.put('/menu/:id/stock-count', async (req, res) => {
  const item = await db('menu_items').where({ id: req.params.id }).first();
  if (!item) throw httpError(404, 'Item not found');
  const raw = req.body?.count;
  const count = raw === null || raw === '' || raw === undefined ? null : Math.max(0, Math.min(999, Number(raw) || 0));
  const patch = { stock_count: count };
  if (count != null && count > 0 && !item.in_stock) patch.in_stock = true; // restocking revives the item
  if (count === 0 && item.in_stock) patch.in_stock = false;
  await db('menu_items').where({ id: item.id }).update(patch);
  await addActivity(count == null ? `${item.name}: portion tracking off` : `${item.name}: ${count} portions set`);
  broadcast('menu');
  broadcast('activity');
  res.json({ ok: true });
});

// ---------- stories ----------
r.get('/stories', async (req, res) => {
  const rows = await db('stories').where('expires_at', '>', Date.now()).orderBy('ts', 'desc');
  res.json(rows.map((s) => ({ id: s.id, ts: Number(s.ts), caption: s.caption, theme: s.theme })));
});

r.post('/stories', async (req, res) => {
  const caption = String(req.body?.caption || '').trim().slice(0, 120);
  if (caption.length < 3) throw httpError(400, 'Write a caption first.');
  const theme = ['fire', 'ocean', 'candy', 'forest'].includes(req.body?.theme) ? req.body.theme : 'fire';
  await db('stories').insert({ ts: Date.now(), caption, theme, expires_at: Date.now() + 24 * 36e5 });
  await addActivity(`Story posted: "${caption.slice(0, 60)}" (live 24h)`);
  broadcast('stories');
  broadcast('activity');
  res.status(201).json({ ok: true });
});

// ---------- store toggle ----------
r.put('/store', async (req, res) => {
  const open = !!req.body?.open;
  await setSetting('store_open', open);
  await addActivity(open ? 'Ordering resumed' : 'Ordering paused');
  broadcast('store');
  broadcast('activity');
  res.json({ ok: true, open });
});

// ---------- reports ----------
r.get('/reports', async (req, res) => {
  const range = ['day', 'week', 'month', '6m', '12m'].includes(req.query.range) ? req.query.range : 'day';
  res.json(await buildReport(range));
});

const localKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

async function buildReport(range) {
  const rollups = await db('daily_rollups');
  const byDate = new Map(rollups.map((x) => [x.date, { orders: x.orders, revenue: x.revenue }]));
  const todayOrders = await db('orders').where('created_at', '>=', startOfToday()).whereNull('cancelled_at');
  const todayKey = localKey(new Date());
  byDate.set(todayKey, {
    orders: todayOrders.length,
    revenue: todayOrders.reduce((a, o) => a + o.total, 0)
  });

  const dayKey = (offset) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - offset);
    return localKey(d);
  };
  const sumDays = (from, to) => {
    // offsets inclusive, from > to (older → newer)
    let orders = 0, revenue = 0, missing = 0;
    for (let o = from; o >= to; o--) {
      const v = byDate.get(dayKey(o));
      if (!v) missing++;
      else {
        orders += v.orders;
        revenue += v.revenue;
      }
    }
    return { orders, revenue, missing, days: from - to + 1 };
  };

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const fmt = (key) => {
    const d = new Date(key + 'T00:00:00');
    return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  };

  let bars = [];
  let cur, prior, periodLabel;

  if (range === 'day') {
    bars = hourBins(todayOrders);
    cur = sumDays(0, 0);
    prior = sumDays(1, 1);
    periodLabel = 'Today';
  } else if (range === 'week') {
    const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    bars = [];
    for (let o = 6; o >= 0; o--) {
      const key = dayKey(o);
      const d = new Date(key + 'T00:00:00');
      bars.push({ label: WD[d.getDay()], value: byDate.get(key)?.revenue || 0 });
    }
    cur = sumDays(6, 0);
    prior = sumDays(13, 7);
    periodLabel = `${fmt(dayKey(6))} – ${fmt(dayKey(0))}`;
  } else if (range === 'month') {
    bars = [];
    for (let b = 9; b >= 0; b--) {
      const from = b * 3 + 2;
      const s = sumDays(from, b * 3);
      bars.push({ label: fmt(dayKey(from)), value: s.revenue });
    }
    cur = sumDays(29, 0);
    prior = sumDays(59, 30);
    periodLabel = `${fmt(dayKey(29))} – ${fmt(dayKey(0))}`;
  } else {
    const months = range === '6m' ? 6 : 12;
    bars = [];
    const now = new Date();
    for (let m = months - 1; m >= 0; m--) {
      const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
      const label = MONTHS[d.getMonth()];
      let value = 0;
      for (const [key, v] of byDate) {
        const kd = new Date(key + 'T00:00:00');
        if (kd.getFullYear() === d.getFullYear() && kd.getMonth() === d.getMonth()) value += v.revenue;
      }
      bars.push({ label, value });
    }
    const days = months === 6 ? 182 : 364;
    cur = sumDays(days, 0);
    prior = sumDays(days * 2 + 1, days + 1);
    periodLabel = `Last ${months} months`;
  }

  const kpi = (curVal, priorVal, priorMissing) => ({
    value: curVal,
    delta: priorMissing || !priorVal ? null : Math.round(((curVal - priorVal) / priorVal) * 1000) / 10
  });
  const priorIncomplete = prior.missing > 0 || (prior.orders === 0 && prior.revenue === 0);
  const curAov = cur.orders ? Math.round(cur.revenue / cur.orders) : 0;
  const priorAov = prior.orders ? Math.round(prior.revenue / prior.orders) : 0;

  return {
    range,
    periodLabel,
    bars,
    kpis: {
      sales: kpi(cur.revenue, prior.revenue, priorIncomplete),
      orders: kpi(cur.orders, prior.orders, priorIncomplete),
      aov: kpi(curAov, priorAov, priorIncomplete),
      daily: kpi(Math.round(cur.revenue / cur.days), Math.round(prior.revenue / prior.days), priorIncomplete)
    }
  };
}

// ---------- menu engineering: stars / workhorses / puzzles / duds ----------
r.get('/menu-engineering', async (req, res) => {
  const menu = (await db('menu_items')).map(rowToItem);
  const cancelledIds = new Set((await db('orders').whereNotNull('cancelled_at')).map((o) => o.id));
  const lines = await db('order_lines');
  const units = {};
  let totalUnits = 0;
  for (const l of lines) {
    if (cancelledIds.has(l.order_id)) continue;
    units[l.menu_item_id] = (units[l.menu_item_id] || 0) + l.qty;
    totalUnits += l.qty;
  }
  // young installs: synthesize stable sample popularity so the report is useful day one
  const sample = totalUnits < 25;
  if (sample) {
    for (const m of menu) {
      const hash = [...m.id].reduce((a, c) => a + c.charCodeAt(0), 0);
      units[m.id] = (m.popular ? 9 : 2) + (hash % 7);
    }
  }
  const rows = menu.map((m) => ({ name: m.name, price: m.price, units: units[m.id] || 0 }));
  const med = (arr) => {
    const s = [...arr].sort((a, b) => a - b);
    return s.length ? s[Math.floor(s.length / 2)] : 0;
  };
  const medUnits = med(rows.map((r) => r.units));
  const medPrice = med(rows.map((r) => r.price));
  const q = { stars: [], workhorses: [], puzzles: [], duds: [] };
  for (const it of rows) {
    const popular = it.units >= medUnits;
    const highTicket = it.price >= medPrice; // price as a margin proxy — stated in the UI
    q[popular ? (highTicket ? 'stars' : 'workhorses') : highTicket ? 'puzzles' : 'duds'].push(it);
  }
  for (const k of Object.keys(q)) q[k].sort((a, b) => b.units - a.units);

  let advice = null;
  try {
    advice = await generateText({
      system: 'You are a menu-engineering consultant for a burger restaurant in Ludhiana. 3 short sentences max, concrete, use ₹, no fluff.',
      prompt: `Stars(promote): ${q.stars.slice(0, 3).map((x) => x.name).join(', ')}. Workhorses(popular, low ticket): ${q.workhorses.slice(0, 3).map((x) => x.name).join(', ')}. Puzzles(high ticket, slow): ${q.puzzles.slice(0, 3).map((x) => x.name).join(', ')}. Duds: ${q.duds.slice(0, 3).map((x) => x.name).join(', ')}. Give the owner 3 actions.`,
      maxTokens: 160
    });
  } catch {}
  if (!advice) {
    advice = `Put ${q.stars[0]?.name || 'your stars'} front and centre — hero, stories, combos. ${q.workhorses[0] ? `${q.workhorses[0].name} sells well at a low ticket — try a ₹20–30 nudge or bundle it with a drink.` : ''} ${q.puzzles[0] ? `${q.puzzles[0].name} makes money but moves slowly — feature it in a story this week; if it stays slow, rework or cut it.` : ''}`;
  }
  res.json({ sample, quadrants: { stars: q.stars.slice(0, 5), workhorses: q.workhorses.slice(0, 5), puzzles: q.puzzles.slice(0, 5), duds: q.duds.slice(0, 5) }, advice });
});

// ---------- customers (CRM) ----------
r.get('/customers', async (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  let query = db('customers').orderBy('lifetime_spend', 'desc').limit(100);
  if (q) query = query.where((b) => b.whereRaw('lower(name) like ?', [`%${q}%`]).orWhere('phone', 'like', `%${q}%`));
  const rows = await query;
  res.json(
    rows.map((c) => ({
      id: c.id,
      name: c.name || '—',
      phone: c.phone,
      ordersCount: c.orders_count,
      lifetimeSpend: c.lifetime_spend,
      lastOrderAt: c.last_order_at ? Number(c.last_order_at) : null
    }))
  );
});

r.get('/customers/:id/orders', async (req, res) => {
  const rows = await db('orders').where({ customer_id: Number(req.params.id) }).orderBy('created_at', 'desc');
  res.json(await serializeOrders(rows));
});

// ---------- abandoned carts ----------
r.get('/carts', async (req, res) => {
  const rows = await db('carts').orderBy('updated_at', 'desc');
  const menu = new Map((await db('menu_items')).map((m) => [m.id, m]));
  res.json(
    rows.map((c) => {
      let lines = [];
      try {
        lines = JSON.parse(c.lines);
      } catch {}
      return {
        sessionId: c.session_id,
        customerName: c.customer_name || 'Guest',
        total: c.total,
        idleMinutes: Math.max(0, Math.round((Date.now() - Number(c.updated_at)) / 60000)),
        nudged: !!c.nudged,
        summary: lines
          .map((l) => `${l.qty} × ${menu.get(l.id)?.name || l.id}`)
          .join(', ')
      };
    })
  );
});

r.post('/carts/:sessionId/nudge', async (req, res) => {
  const cart = await db('carts').where({ session_id: req.params.sessionId }).first();
  if (!cart) throw httpError(404, 'Cart is gone (checked out or cleared).');
  const text = `Your cart (₹${cart.total}) is still waiting — checkout in 2 taps and use WICKED10 for 10% off ₹499+.`;
  await db('campaigns').insert({ kind: 'recovery', ts: Date.now(), text, target_session: cart.session_id });
  await db('carts').where({ session_id: cart.session_id }).update({ nudged: true });
  await addMarketingLog(`Abandoned cart nudge sent for a ₹${cart.total} cart (${cart.customer_name || 'guest'})`);
  await addActivity(`Cart recovery nudge sent — ₹${cart.total} cart`);
  broadcast('notify');
  broadcast('carts');
  broadcast('activity');
  res.json({ ok: true });
});

// ---------- support tickets ----------
r.get('/tickets', async (req, res) => {
  const rows = await db('support_tickets').orderBy('ts', 'desc').limit(100);
  res.json(
    rows.map((t) => ({
      id: t.id,
      ts: Number(t.ts),
      name: t.name || 'Guest',
      phone: t.phone || '',
      summary: t.summary,
      orderNumber: t.order_number || null,
      status: t.status
    }))
  );
});

r.patch('/tickets/:id', async (req, res) => {
  const t = await db('support_tickets').where({ id: Number(req.params.id) }).first();
  if (!t) throw httpError(404, 'Ticket not found');
  const status = req.body?.status === 'open' ? 'open' : 'resolved';
  await db('support_tickets').where({ id: t.id }).update({ status });
  await addActivity(`Ticket #${t.id} marked ${status}`);
  broadcast('activity');
  res.json({ ok: true });
});

// ---------- marketing ----------
r.get('/marketing', async (req, res) => {
  const auto = await getSetting('marketing_auto');
  const log = await db('marketing_log').orderBy('ts', 'desc').limit(20);
  res.json({ auto, log: log.map((l) => ({ ts: Number(l.ts), text: l.text })) });
});

r.put('/marketing/auto', async (req, res) => {
  const auto = await getSetting('marketing_auto');
  const { key, on } = req.body || {};
  if (!(key in auto)) throw httpError(400, 'Unknown automation');
  auto[key] = !!on;
  await setSetting('marketing_auto', auto);
  const labels = {
    whatsapp: 'WhatsApp campaigns',
    offers: 'Smart offers',
    email: 'Email customers',
    cartRecovery: 'Abandoned cart recovery',
    recommend: 'Dish recommendations'
  };
  await addActivity(`${labels[key] || key} ${on ? 'enabled' : 'disabled'}`);
  broadcast('config');
  broadcast('activity');
  res.json({ ok: true, auto });
});

r.post('/campaigns/generate', async (req, res) => {
  const audienceMap = {
    all: 'all customers',
    lapsed: 'customers who have not ordered in 30+ days',
    big: 'high-value customers who spent ₹1000+'
  };
  const audience = audienceMap[req.body?.audience] || audienceMap.all;
  const ch = ['whatsapp', 'sms', 'email'].includes(req.body?.channel) ? req.body.channel : 'whatsapp';

  let draft = null;
  try {
    draft = await generateText({
      system:
        'You write short, warm, lightly playful marketing copy for Wicked Chkn, a fried-chicken, burger and burrito restaurant in BRS Nagar, Ludhiana. Keep item names in English; a light Hinglish touch is welcome. No emoji.',
      prompt: `Write one ${
        ch === 'whatsapp' ? 'WhatsApp message (max 50 words)' : ch === 'sms' ? 'SMS (max 25 words)' : 'short email (subject + 60-word body)'
      } for ${audience}. Mention the WICKED10 code (10% off ₹499+) and one signature item like the Double Mutton Cheese Burger. Output only the message.`,
      maxTokens: 300
    });
  } catch (e) {
    console.error('[campaigns/generate]', e.message);
  }
  if (draft == null) draft = mockCampaign(ch, req.body?.audience);
  res.json({ draft });
});

function mockCampaign(channel, audience) {
  const hooks = {
    all: 'The fryers are hot and the Double Mutton Cheese Burger is undefeated.',
    lapsed: "It's been a minute! The Double Mutton missed you (it doesn't say that about everyone).",
    big: 'VIP treatment, boss — the Double Mutton Cheese Burger is calling your name again.'
  };
  const hook = hooks[audience] || hooks.all;
  if (channel === 'sms') return `Wicked Chkn: ${hook} WICKED10 = 10% off above Rs499. Order direct, skip the apps.`;
  if (channel === 'email')
    return `Subject: The Double Mutton misses you\n\n${hook} Order straight from our app — no aggregator markups, just wicked burgers served hot with wedges. Use code WICKED10 for 10% off orders above ₹499. Open till 10 PM tonight — see you at the counter.`;
  return `${hook} Order direct on the Wicked Chkn app and use WICKED10 for 10% off above ₹499 — served hot till 10 PM. Full menu, zero aggregator drama.`;
}

r.post('/campaigns/send', async (req, res) => {
  const text = String(req.body?.text || '').trim();
  if (!text) throw httpError(400, 'Nothing to send — generate or write a message first.');
  const audience = ['all', 'lapsed', 'big'].includes(req.body?.audience) ? req.body.audience : 'all';
  const channel = ['whatsapp', 'sms', 'email'].includes(req.body?.channel) ? req.body.channel : 'whatsapp';

  const cutoff = Date.now() - 30 * 864e5;
  let customers = await db('customers');
  if (audience === 'lapsed') customers = customers.filter((c) => !c.last_order_at || Number(c.last_order_at) < cutoff);
  if (audience === 'big') customers = customers.filter((c) => c.lifetime_spend >= 1000);

  await db('campaigns').insert({ kind: 'campaign', ts: Date.now(), text: text.slice(0, 400), audience, channel });

  const chName = channel === 'whatsapp' ? 'WhatsApp' : channel.toUpperCase() === 'SMS' ? 'SMS' : 'Email';
  const n = customers.length;
  await addMarketingLog(`${chName} campaign sent to ${n} customer${n === 1 ? '' : 's'}: "${text.slice(0, 70)}${text.length > 70 ? '…' : ''}"`);
  await addActivity(`${chName} campaign sent — check the app for the notification`);

  if (channel === 'sms') {
    for (const c of customers.slice(0, 50)) await sendSms(c.phone, text.slice(0, 300));
  }

  broadcast('notify');
  broadcast('activity');
  res.json({ ok: true, sent: n });
});

// ---------- settings ----------
r.get('/settings', async (req, res) => {
  const provider = await getSetting('ai_provider');
  const twilio = await getSetting('twilio');
  res.json({
    provider,
    activeProvider: await activeProvider(),
    keyMasked: maskedKey(provider),
    providerAvailable: { anthropic: !!process.env.ANTHROPIC_API_KEY, openai: !!process.env.OPENAI_API_KEY },
    training: await getSetting('training_notes'),
    twilio: { ...twilio, envConfigured: twilioEnvConfigured() }
  });
});

r.put('/settings', async (req, res) => {
  const b = req.body || {};
  if (b.provider && ['anthropic', 'openai'].includes(b.provider)) await setSetting('ai_provider', b.provider);
  if (b.pin && /^\d{4,8}$/.test(String(b.pin))) await setSetting('admin_pin', String(b.pin));
  if (typeof b.training === 'string') await setSetting('training_notes', b.training.slice(0, 2000));
  if (b.twilio && typeof b.twilio === 'object') {
    const cur = await getSetting('twilio');
    await setSetting('twilio', {
      enabled: !!b.twilio.enabled,
      sid: String(b.twilio.sid ?? cur.sid).slice(0, 64),
      from: String(b.twilio.from ?? cur.from).slice(0, 20)
    });
  }
  await addActivity('Settings updated — assistant retrained live');
  broadcast('config');
  broadcast('activity');
  res.json({ ok: true });
});

// ---------- logs ----------
r.get('/activity', async (req, res) => {
  const rows = await db('activity_log').orderBy('ts', 'desc').limit(80);
  res.json(rows.map((a) => ({ ts: Number(a.ts), text: a.text })));
});

r.get('/sms', async (req, res) => {
  const rows = await db('sms_log').orderBy('ts', 'desc').limit(60);
  res.json(rows.map((s) => ({ ts: Number(s.ts), to: s.to, body: s.body, status: s.status })));
});

// ---------- staff AI ----------
r.post('/ai/staff', async (req, res) => {
  res.json(await staffChat(req.body || {}));
});

export default r;
