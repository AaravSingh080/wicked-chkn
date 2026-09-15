import { db, rowToItem } from './db.js';
import { FLOWS } from './menu-data.js';

export const PROMO = { code: 'WICKED10', pct: 10, min: 499 };

export async function serializeOrder(row, lines, rating) {
  const flow = FLOWS[row.type] || FLOWS.pickup;
  const ls = lines ?? (await db('order_lines').where({ order_id: row.id }));
  const rt = rating !== undefined ? rating : await db('ratings').where({ order_id: row.id }).first();
  return {
    cancelled: row.cancelled_at ? { at: Number(row.cancelled_at), reason: row.cancel_reason || '' } : null,
    rider: row.rider_name ? { name: row.rider_name, phone: row.rider_phone || '' } : null,
    arrived: row.arrived_at ? { at: Number(row.arrived_at), note: row.arrived_note || '' } : null,
    rating: rt ? { stars: rt.stars, tags: JSON.parse(rt.tags || '[]') } : null,
    id: row.id,
    num: row.order_number,
    createdAt: Number(row.created_at),
    type: row.type,
    statusIdx: row.status_index,
    flow,
    status: flow[Math.min(row.status_index, flow.length - 1)],
    done: row.status_index >= flow.length - 1,
    subtotal: row.subtotal,
    discount: row.discount,
    deliveryFee: row.delivery_fee,
    total: row.total,
    payMethod: row.pay_method,
    kotPrinted: !!row.kot_printed,
    address: row.address || null,
    tableNo: row.table_no || null,
    kitchenNote: row.kitchen_note || null,
    promoCode: row.promo_code || null,
    customer: { name: row.customer_name || '', phone: row.phone || '' },
    lines: ls.map((l) => ({
      id: l.id,
      itemId: l.menu_item_id,
      name: l.name_snapshot,
      qty: l.qty,
      unitPrice: l.unit_price,
      lineTotal: l.line_total,
      note: l.note || null,
      mods: JSON.parse(l.mods || '[]')
    }))
  };
}

export async function serializeOrders(rows) {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const allLines = await db('order_lines').whereIn('order_id', ids);
  const allRatings = await db('ratings').whereIn('order_id', ids);
  const ratingBy = new Map(allRatings.map((r) => [r.order_id, r]));
  const byOrder = new Map();
  for (const l of allLines) {
    if (!byOrder.has(l.order_id)) byOrder.set(l.order_id, []);
    byOrder.get(l.order_id).push(l);
  }
  return Promise.all(rows.map((r) => serializeOrder(r, byOrder.get(r.id) || [], ratingBy.get(r.id) || null)));
}

/** Recompute pricing server-side from DB prices. items: [{id, qty, note, mods:[names]}] */
export async function priceOrder(items, type, promo) {
  const ids = items.map((i) => i.id);
  const rows = await db('menu_items').whereIn('id', ids);
  const menu = new Map(rows.map((r) => [r.id, rowToItem(r)]));

  const lines = [];
  let subtotal = 0;
  for (const it of items) {
    const m = menu.get(it.id);
    if (!m) throw httpError(400, `Unknown item: ${it.id}`);
    if (!m.inStock) throw httpError(409, `${m.name} just sold out — remove it from your cart.`);
    const qty = Math.max(1, Math.min(20, Number(it.qty) || 1));
    // validate mods against the item's own modifier list; price server-side
    const mods = (Array.isArray(it.mods) ? it.mods : [])
      .map((name) => m.modifiers.find((x) => x.name === name))
      .filter(Boolean);
    const unit = m.price + mods.reduce((a, x) => a + x.price, 0);
    lines.push({
      menu_item_id: m.id,
      name_snapshot: m.name,
      qty,
      unit_price: unit,
      line_total: unit * qty,
      note: (it.note || '').slice(0, 200) || null,
      mods: mods.length ? JSON.stringify(mods.map((x) => x.name)) : null
    });
    subtotal += unit * qty;
  }
  if (!lines.length) throw httpError(400, 'Cart is empty');

  // promo: WICKED10 percentage, or a gift-voucher code (flat credit)
  let discount = 0;
  let promoCode = null;
  let voucherCode = null;
  const code = String(promo || '').toUpperCase();
  if (code === PROMO.code && subtotal >= PROMO.min) {
    discount = Math.round((subtotal * PROMO.pct) / 100);
    promoCode = PROMO.code;
  } else if (code.startsWith('WCGIFT-')) {
    const v = await db('vouchers').where({ code }).first();
    if (!v) throw httpError(400, "That gift code doesn't exist.");
    if (v.redeemed_at) throw httpError(409, 'That gift code was already used.');
    discount = Math.min(v.amount, subtotal);
    promoCode = code;
    voucherCode = code;
  }
  const deliveryFee = type === 'delivery' ? 35 : 0;
  const total = subtotal - discount + deliveryFee;
  return { lines, subtotal, discount, deliveryFee, total, promoCode, voucherCode };
}

export function makeOrderNumber() {
  return 'WC-' + String(1000 + Math.floor(Math.random() * 9000));
}

export function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}
