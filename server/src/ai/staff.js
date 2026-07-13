import { db, getSetting, setSetting, addActivity, rowToItem } from '../db.js';
import { chatWithTools } from '../services/llm.js';
import { broadcast } from '../realtime.js';
import { FLOWS } from '../menu-data.js';

// Support AI — back-office assistant with real tools that change live state.

async function setStock(itemName, inStock) {
  const rows = await db('menu_items');
  const items = rows.map(rowToItem);
  const q = String(itemName).toLowerCase();
  let best = items.find((i) => i.name.toLowerCase() === q);
  if (!best) best = items.find((i) => i.name.toLowerCase().includes(q));
  if (!best) {
    const qWords = q.split(/\s+/).filter(Boolean);
    best = items
      .map((i) => ({ i, score: qWords.filter((w) => i.name.toLowerCase().includes(w)).length }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)[0]?.i;
  }
  if (!best) throw new Error(`No menu item matches "${itemName}".`);
  await db('menu_items').where({ id: best.id }).update({ in_stock: !!inStock });
  await addActivity(`${best.name} marked ${inStock ? 'back in stock' : 'OUT OF STOCK'} (staff AI)`);
  broadcast('menu');
  broadcast('activity');
  return `${best.name} is now ${inStock ? 'in stock' : 'out of stock'} — the app reflects it already.`;
}

async function setStoreOpen(open) {
  await setSetting('store_open', !!open);
  await addActivity(open ? 'Ordering resumed (staff AI)' : 'Ordering paused (staff AI)');
  broadcast('store');
  broadcast('activity');
  return open ? 'Ordering is live again.' : 'Ordering paused — the app shows customers a closed notice.';
}

async function salesSummary() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const orders = await db('orders').where('created_at', '>=', start.getTime()).whereNull('cancelled_at');
  const rev = orders.reduce((a, o) => a + o.total, 0);
  const live = orders.filter((o) => o.status_index < (FLOWS[o.type]?.length || 4) - 1);
  const soldOut = (await db('menu_items').where({ in_stock: false })).map((r) => r.name);
  return `Today (app orders): ₹${rev} revenue, ${orders.length} orders; ${live.length} in progress: ${
    live.map((o) => `${o.order_number} (${FLOWS[o.type][o.status_index]})`).join(', ') || 'none'
  }. Sold out: ${soldOut.join(', ') || 'nothing'}.`;
}

export async function staffChat({ messages = [] }) {
  const rows = await db('menu_items').orderBy('sort');
  const items = rows.map(rowToItem);

  const tools = [
    {
      name: 'set_stock',
      description: 'Mark a menu item in or out of stock. Fuzzy-matches the item name.',
      input_schema: {
        type: 'object',
        properties: { itemName: { type: 'string' }, inStock: { type: 'boolean' } },
        required: ['itemName', 'inStock']
      },
      run: ({ itemName, inStock }) => setStock(itemName, inStock)
    },
    {
      name: 'set_store_open',
      description: 'Pause or resume ordering across the customer app.',
      input_schema: { type: 'object', properties: { open: { type: 'boolean' } }, required: ['open'] },
      run: ({ open }) => setStoreOpen(open)
    },
    {
      name: 'get_sales_summary',
      description: "Read today's sales numbers and live orders.",
      input_schema: { type: 'object', properties: {} },
      run: () => salesSummary()
    }
  ];

  const system = `You are the staff/back-office assistant on the Wicked Chkn admin dashboard (burger restaurant, Ludhiana). Be brief and practical (1-3 sentences). Use your tools to actually make changes — stock, store pause, sales summaries. Menu items: ${items
    .map((i) => i.name + (i.inStock ? '' : ' (OUT)'))
    .join('; ')}.`;

  const history = messages.slice(-12).map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.text }));

  let reply = null;
  try {
    reply = await chatWithTools({ system, messages: history, tools, maxTokens: 600 });
  } catch (e) {
    console.error('[ai/staff] provider error:', e.message);
  }
  if (reply == null) reply = await mockStaffReply(history.at(-1)?.content || '', items);
  return { reply };
}

async function mockStaffReply(text, items) {
  const t = text.toLowerCase();

  const stockMatch = t.match(/(?:mark|set|make)?\s*(.+?)\s*(?:as\s*)?(out of stock|back in stock|in stock|sold out|available)/);
  if (stockMatch) {
    const inStock = /back in stock|in stock|available/.test(stockMatch[2]) && !/out of stock|sold out/.test(stockMatch[2]);
    try {
      return await setStock(stockMatch[1].trim(), inStock);
    } catch (e) {
      return e.message;
    }
  }
  if (/pause|close|stop (taking )?orders/.test(t)) return setStoreOpen(false);
  if (/resume|unpause|re-?open|start (taking )?orders/.test(t)) return setStoreOpen(true);
  if (/sales|revenue|how.*(today|doing)|summary|numbers/.test(t)) return salesSummary();
  const out = items.filter((i) => !i.inStock).map((i) => i.name);
  if (/sold out|out of stock/.test(t)) return out.length ? `Currently sold out: ${out.join(', ')}.` : 'Nothing is sold out right now.';
  return 'I can flip stock ("Mark Chicken Burrito out of stock"), pause/resume ordering, or pull today\'s sales summary — what do you need?';
}
