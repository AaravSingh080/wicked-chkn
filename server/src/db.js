import knexFactory from 'knex';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MENU, modsForCategory } from './menu-data.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const usePg = !!process.env.DATABASE_URL;

if (!usePg) {
  fs.mkdirSync(path.join(__dirname, '..', 'data'), { recursive: true });
}

export const db = knexFactory(
  usePg
    ? {
        client: 'pg',
        connection: { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } },
        pool: { min: 0, max: 10 }
      }
    : {
        client: 'better-sqlite3',
        connection: { filename: path.join(__dirname, '..', 'data', 'wickedchkn.db') },
        useNullAsDefault: true
      }
);

export async function migrate() {
  const has = (t) => db.schema.hasTable(t);

  if (!(await has('menu_items'))) {
    await db.schema.createTable('menu_items', (t) => {
      t.string('id').primary();
      t.string('name').notNullable();
      t.string('category').notNullable();
      t.integer('price').notNullable();
      t.boolean('veg').notNullable().defaultTo(false);
      t.boolean('spicy').notNullable().defaultTo(false);
      t.boolean('popular').notNullable().defaultTo(false);
      t.boolean('in_stock').notNullable().defaultTo(true);
      t.text('description');
      t.string('image_url');
      t.integer('sort').notNullable().defaultTo(0);
    });
  }

  if (!(await has('customers'))) {
    await db.schema.createTable('customers', (t) => {
      t.increments('id').primary();
      t.string('phone').notNullable().unique();
      t.string('name');
      t.integer('orders_count').notNullable().defaultTo(0);
      t.integer('lifetime_spend').notNullable().defaultTo(0);
      t.bigint('last_order_at');
      t.bigint('created_at');
    });
  }

  if (!(await has('orders'))) {
    await db.schema.createTable('orders', (t) => {
      t.increments('id').primary();
      t.string('order_number').notNullable();
      t.bigint('created_at').notNullable();
      t.integer('customer_id');
      t.string('customer_name');
      t.string('phone');
      t.string('type').notNullable(); // dinein | pickup | delivery
      t.integer('status_index').notNullable().defaultTo(0);
      t.integer('subtotal').notNullable();
      t.integer('discount').notNullable().defaultTo(0);
      t.integer('delivery_fee').notNullable().defaultTo(0);
      t.integer('total').notNullable();
      t.string('pay_method').notNullable(); // online | cash
      t.string('payment_id');
      t.string('payment_signature');
      t.boolean('kot_printed').notNullable().defaultTo(false);
      t.string('address');
      t.string('table_no');
      t.string('promo_code');
    });
  }

  if (!(await has('order_lines'))) {
    await db.schema.createTable('order_lines', (t) => {
      t.increments('id').primary();
      t.integer('order_id').notNullable().index();
      t.string('menu_item_id').notNullable();
      t.string('name_snapshot').notNullable();
      t.integer('qty').notNullable();
      t.integer('unit_price').notNullable();
      t.integer('line_total').notNullable();
      t.text('note');
    });
  }

  if (!(await has('favourites'))) {
    await db.schema.createTable('favourites', (t) => {
      t.integer('customer_id').notNullable();
      t.string('menu_item_id').notNullable();
      t.primary(['customer_id', 'menu_item_id']);
    });
  }

  if (!(await has('carts'))) {
    await db.schema.createTable('carts', (t) => {
      t.string('session_id').primary();
      t.integer('customer_id');
      t.string('customer_name');
      t.text('lines').notNullable(); // JSON [{id, qty, note}]
      t.integer('total').notNullable();
      t.bigint('updated_at').notNullable();
      t.boolean('nudged').notNullable().defaultTo(false);
    });
  }

  if (!(await has('daily_rollups'))) {
    await db.schema.createTable('daily_rollups', (t) => {
      t.string('date').primary(); // YYYY-MM-DD
      t.integer('orders').notNullable();
      t.integer('revenue').notNullable();
    });
  }

  if (!(await has('settings'))) {
    await db.schema.createTable('settings', (t) => {
      t.string('key').primary();
      t.text('value').notNullable(); // JSON
    });
  }

  if (!(await has('activity_log'))) {
    await db.schema.createTable('activity_log', (t) => {
      t.increments('id').primary();
      t.bigint('ts').notNullable();
      t.text('text').notNullable();
    });
  }

  if (!(await has('marketing_log'))) {
    await db.schema.createTable('marketing_log', (t) => {
      t.increments('id').primary();
      t.bigint('ts').notNullable();
      t.text('text').notNullable();
    });
  }

  if (!(await has('sms_log'))) {
    await db.schema.createTable('sms_log', (t) => {
      t.increments('id').primary();
      t.bigint('ts').notNullable();
      t.string('to').notNullable();
      t.text('body').notNullable();
      t.string('status').notNullable();
    });
  }

  if (!(await has('campaigns'))) {
    await db.schema.createTable('campaigns', (t) => {
      t.increments('id').primary();
      t.string('kind').notNullable(); // campaign | recovery
      t.bigint('ts').notNullable();
      t.text('text').notNullable();
      t.string('audience');
      t.string('channel');
      t.string('target_session'); // for cart-recovery nudges
    });
  }

  if (!(await has('otp_codes'))) {
    await db.schema.createTable('otp_codes', (t) => {
      t.string('phone').primary();
      t.string('code').notNullable();
      t.bigint('expires_at').notNullable();
      t.integer('attempts').notNullable().defaultTo(0);
    });
  }

  if (!(await has('support_tickets'))) {
    await db.schema.createTable('support_tickets', (t) => {
      t.increments('id').primary();
      t.bigint('ts').notNullable();
      t.string('name');
      t.string('phone');
      t.text('summary').notNullable();
      t.string('order_number');
      t.string('status').notNullable().defaultTo('open');
    });
  }

  if (!(await has('auth_tokens'))) {
    await db.schema.createTable('auth_tokens', (t) => {
      t.string('token').primary();
      t.integer('customer_id').notNullable();
      t.bigint('created_at').notNullable();
    });
  }

  if (!(await has('ratings'))) {
    await db.schema.createTable('ratings', (t) => {
      t.integer('order_id').primary();
      t.integer('stars').notNullable();
      t.text('tags'); // JSON array
      t.bigint('ts').notNullable();
    });
  }

  if (!(await has('stories'))) {
    await db.schema.createTable('stories', (t) => {
      t.increments('id').primary();
      t.bigint('ts').notNullable();
      t.text('caption').notNullable();
      t.string('theme').notNullable().defaultTo('fire');
      t.bigint('expires_at').notNullable();
    });
  }

  if (!(await has('vouchers'))) {
    await db.schema.createTable('vouchers', (t) => {
      t.string('code').primary();
      t.integer('amount').notNullable();
      t.string('from_name');
      t.string('to_phone');
      t.text('message');
      t.bigint('ts').notNullable();
      t.bigint('redeemed_at');
      t.string('redeemed_order');
    });
  }

  // column additions on existing tables
  const addCol = async (table, col, cb) => {
    if (!(await db.schema.hasColumn(table, col))) await db.schema.alterTable(table, cb);
  };
  await addCol('menu_items', 'modifiers', (t) => t.text('modifiers'));
  await addCol('menu_items', 'stock_count', (t) => t.integer('stock_count')); // null = untracked portions
  await addCol('orders', 'rider_name', (t) => t.string('rider_name'));
  await addCol('orders', 'rider_phone', (t) => t.string('rider_phone'));
  await addCol('orders', 'arrived_at', (t) => t.bigint('arrived_at'));
  await addCol('orders', 'arrived_note', (t) => t.string('arrived_note'));
  await addCol('orders', 'cancelled_at', (t) => t.bigint('cancelled_at'));
  await addCol('orders', 'accepted_at', (t) => t.bigint('accepted_at'));
  await addCol('orders', 'ready_at', (t) => t.bigint('ready_at'));
  await addCol('orders', 'cancel_reason', (t) => t.string('cancel_reason'));
  await addCol('order_lines', 'mods', (t) => t.text('mods'));

  // backfill modifiers for rows that predate the column
  const missing = await db('menu_items').whereNull('modifiers');
  for (const row of missing) {
    await db('menu_items').where({ id: row.id }).update({ modifiers: JSON.stringify(modsForCategory(row.category)) });
  }
}

// ---------- settings helpers ----------
const settingDefaults = {
  store_open: true,
  admin_pin: '1234',
  ai_provider: 'anthropic', // 'anthropic' (Claude Haiku) | 'openai' (GPT-4o-mini)
  training_notes:
    'Always mention that the Double Mutton Cheese Burger is our house heavyweight and that every burger comes with wedges. Suggest an iced tea with any spicy order.',
  twilio: { enabled: false, sid: '', from: '' },
  marketing_auto: { whatsapp: true, offers: true, email: false, cartRecovery: true, recommend: true }
};

export async function getSetting(key) {
  const row = await db('settings').where({ key }).first();
  if (!row) return settingDefaults[key];
  try {
    return JSON.parse(row.value);
  } catch {
    return settingDefaults[key];
  }
}

export async function setSetting(key, value) {
  const payload = { key, value: JSON.stringify(value) };
  const existing = await db('settings').where({ key }).first();
  if (existing) await db('settings').where({ key }).update({ value: payload.value });
  else await db('settings').insert(payload);
}

// ---------- seeding ----------
function seedHistory() {
  // Same deterministic PRNG as the prototype's backend.js so the demo history matches.
  const days = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let seed = 42;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 365; i >= 1; i--) {
    const d = new Date(today.getTime() - i * 864e5);
    const dow = d.getDay();
    const weekend = dow === 0 || dow === 6 ? 1.45 : 1;
    const growth = 1 + ((365 - i) / 365) * 0.8;
    const orders = Math.round((55 + rnd() * 30) * weekend * growth);
    const aov = 340 + Math.round(rnd() * 90);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    days.push({ date: key, orders, revenue: orders * aov });
  }
  return days;
}

export async function seed() {
  const count = await db('menu_items').count('id as c').first();
  if (Number(count.c) === 0) {
    await db('menu_items').insert(
      MENU.map((m, i) => ({
        id: m.id,
        name: m.name,
        category: m.category,
        price: m.price,
        veg: !!m.veg,
        spicy: !!m.spicy,
        popular: !!m.popular,
        in_stock: !!m.inStock,
        description: m.desc,
        modifiers: JSON.stringify(modsForCategory(m.category)),
        sort: i
      }))
    );
  }

  const roll = await db('daily_rollups').count('date as c').first();
  if (Number(roll.c) === 0) {
    await db('daily_rollups').insert(seedHistory());
  }

  const act = await db('activity_log').count('id as c').first();
  if (Number(act.c) === 0) {
    await db('activity_log').insert({ ts: Date.now() - 6e5, text: 'Dashboard connected to shared backend' });
  }

  const mkt = await db('marketing_log').count('id as c').first();
  if (Number(mkt.c) === 0) {
    const now = Date.now();
    await db('marketing_log').insert([
      { ts: now - 3 * 36e5, text: 'WhatsApp win-back sent to 42 lapsed customers — 6 orders recovered (₹2,840)' },
      { ts: now - 7 * 36e5, text: 'Abandoned cart nudge recovered a ₹530 cart (WC-8817)' },
      { ts: now - 26 * 36e5, text: 'Weekend offer emailed to 310 customers — 18% open rate' },
      { ts: now - 30 * 36e5, text: 'Dish recommendations updated: pairing Wicked Wedges with burritos (+9% attach rate)' }
    ]);
  }
}

export async function addActivity(text) {
  await db('activity_log').insert({ ts: Date.now(), text });
  const old = await db('activity_log').orderBy('id', 'desc').offset(120).first();
  if (old) await db('activity_log').where('id', '<=', old.id).del();
}

export async function addMarketingLog(text) {
  await db('marketing_log').insert({ ts: Date.now(), text });
}

export const rowToItem = (r) => {
  let modifiers = [];
  try {
    modifiers = JSON.parse(r.modifiers || '[]');
  } catch {}
  return {
    id: r.id,
    name: r.name,
    category: r.category,
    price: r.price,
    veg: !!r.veg,
    spicy: !!r.spicy,
    popular: !!r.popular,
    inStock: !!r.in_stock,
    desc: r.description,
    imageUrl: r.image_url || null,
    modifiers,
    stockCount: r.stock_count == null ? null : Number(r.stock_count)
  };
};
