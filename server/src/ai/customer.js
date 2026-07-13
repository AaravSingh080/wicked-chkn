import { db, getSetting, addActivity, rowToItem } from '../db.js';
import { chatWithTools } from '../services/llm.js';
import { broadcast } from '../realtime.js';
import { PROMO } from '../orders.js';

// Customer ordering assistant ("Wicked assistant"). System prompt and tools
// mirror the design prototype. Tools mutate a working copy of the client's
// cart; the response returns the updated cart for the app to adopt.

async function fileTicket({ summary, orderNumber, customer }) {
  const [idRaw] = await db('support_tickets')
    .insert({
      ts: Date.now(),
      name: String(customer?.name || '').slice(0, 60) || null,
      phone: String(customer?.phone || '').replace(/\D/g, '').slice(0, 10) || null,
      summary: String(summary).slice(0, 400),
      order_number: orderNumber ? String(orderNumber).slice(0, 20) : null
    })
    .returning('id');
  const id = typeof idRaw === 'object' ? idRaw.id : idRaw;
  await addActivity(
    `Support ticket #${id}: "${String(summary).slice(0, 90)}"${customer?.name ? ` — ${customer.name}` : ''}${
      customer?.phone ? ` · ${customer.phone}` : ''
    }`
  );
  broadcast('activity');
  return `Ticket #${id} filed — the team sees it on their dashboard and will call back within 30 minutes.`;
}

export async function customerChat({ messages = [], cart = {}, vegMode = false, orderType = 'pickup', customer = {} }) {
  const rows = await db('menu_items').orderBy('sort');
  const menu = rows.map(rowToItem);
  const byId = new Map(menu.map((m) => [m.id, m]));
  const working = structuredClone(cart || {});
  let openCheckout = false;

  const cartSummary = () => {
    const lines = Object.entries(working).map(([id, c]) => {
      const it = byId.get(id);
      return `${c.qty} × ${it ? it.name : id} = ₹${it ? it.price * c.qty : '?'}`;
    });
    if (!lines.length) return 'Cart is empty.';
    const subtotal = Object.entries(working).reduce((a, [id, c]) => a + (byId.get(id)?.price || 0) * c.qty, 0);
    const discount = subtotal >= PROMO.min ? Math.round((subtotal * PROMO.pct) / 100) : 0;
    const delivery = orderType === 'delivery' ? 35 : 0;
    return (
      lines.join('\n') +
      `\nSubtotal ₹${subtotal}${discount ? ` − ₹${discount} with WICKED10` : ''}${delivery ? ' + ₹35 delivery' : ''} = ₹${subtotal - discount + delivery}`
    );
  };

  const menuContext = () =>
    menu
      .filter((i) => !vegMode || i.veg)
      .map(
        (i) =>
          `${i.id} | ${i.name} | ₹${i.price} | ${i.veg ? 'veg' : 'non-veg'}${i.spicy ? ' | spicy' : ''}${i.inStock ? '' : ' | OUT OF STOCK'}`
      )
      .join('\n');

  const addToCart = (itemId, qty = 1) => {
    const it = byId.get(itemId);
    if (!it) throw new Error('No item with id ' + itemId);
    if (!it.inStock) throw new Error(it.name + ' is out of stock right now.');
    if (vegMode && !it.veg) throw new Error('Customer has Veg mode on — only offer veg items.');
    const cur = working[itemId] || { qty: 0 };
    working[itemId] = { ...cur, qty: cur.qty + Math.max(1, Math.min(10, Number(qty) || 1)) };
    return `Added ${qty || 1} × ${it.name}. ` + cartSummary();
  };

  const removeFromCart = (itemId) => {
    const cur = working[itemId];
    if (cur) {
      if (cur.qty > 1) working[itemId] = { ...cur, qty: cur.qty - 1 };
      else delete working[itemId];
    }
    return 'Done. ' + cartSummary();
  };

  const tools = [
    {
      name: 'add_to_cart',
      description: 'Add a menu item to the customer cart. Use the exact item id from the menu list.',
      input_schema: {
        type: 'object',
        properties: { itemId: { type: 'string' }, qty: { type: 'integer' } },
        required: ['itemId']
      },
      run: ({ itemId, qty }) => addToCart(itemId, qty || 1)
    },
    {
      name: 'remove_from_cart',
      description: 'Remove one unit of an item from the cart (repeat to remove more).',
      input_schema: { type: 'object', properties: { itemId: { type: 'string' } }, required: ['itemId'] },
      run: ({ itemId }) => removeFromCart(itemId)
    },
    {
      name: 'get_cart',
      description: 'Read the current cart contents and total.',
      input_schema: { type: 'object', properties: {} },
      run: () => cartSummary()
    },
    {
      name: 'open_checkout',
      description: 'Open the cart/checkout screen once the customer confirms their order.',
      input_schema: { type: 'object', properties: {} },
      run: () => {
        openCheckout = true;
        return 'Cart screen opened; the customer finishes checkout there.';
      }
    },
    {
      name: 'report_problem',
      description:
        'File a support ticket when the customer reports a problem — wrong/missing/cold items, delivery issues, refunds, bad experience. Summarise the issue in one sentence; include the order number if they gave one.',
      input_schema: {
        type: 'object',
        properties: { summary: { type: 'string' }, orderNumber: { type: 'string' } },
        required: ['summary']
      },
      run: ({ summary, orderNumber }) => fileTicket({ summary, orderNumber, customer })
    }
  ];

  const training = (await getSetting('training_notes')) || '';
  const system = `You are the in-app ordering assistant for Wicked Chkn, a fried-chicken, burger and burrito restaurant in Down Town Market, BRS Nagar, Ludhiana, Punjab. Every burger is served with wedges.
Voice: warm, friendly, lightly playful. Keep replies SHORT (1-3 sentences) — this is a phone chat.
Detect the customer's language (English / Hindi / Punjabi / Hinglish) and reply in it, but ALWAYS keep menu item names in English.
${vegMode ? 'The customer has VEG MODE ON — only discuss and add vegetarian items.\n' : ''}LIVE MENU (id | name | price | veg | notes):
${menuContext()}
CURRENT CART:
${cartSummary()}
RULES:
- Hours 11 AM-10 PM. Delivery within 7 km, flat ₹35, no minimum. ETAs: dine-in 15-20 min, pickup 25-30 min, delivery 35-40 min.
- Promo WICKED10 gives 10% off orders of ₹499+.
- Never invent items or prices. Never offer out-of-stock items.
- Use add_to_cart with exact item ids. Upsell ONE side or drink at most once per conversation, never pushy.
- Before finishing, read back the full order with the total and ask them to confirm; on confirmation call open_checkout.
- Problems or complaints (wrong/missing/cold items, delivery trouble, refunds): apologise warmly, ask for the order number if they have one, then call report_problem with a one-line summary. Tell them the team will call back within 30 minutes.
${training ? 'OWNER TRAINING NOTES (follow these):\n' + training : ''}`;

  const history = messages.slice(-12).map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.text }));

  let reply = null;
  try {
    reply = await chatWithTools({ system, messages: history, tools, maxTokens: 700 });
  } catch (e) {
    console.error('[ai/chat] provider error:', e.message);
    reply = null;
  }
  if (reply == null) {
    reply = await mockReply({
      text: history.at(-1)?.content || '',
      menu, vegMode, working, addToCart, cartSummary, customer,
      setCheckout: () => (openCheckout = true)
    });
  }

  return { reply, cart: working, openCheckout };
}

// ---------- keyless demo brain ----------
async function mockReply({ text, menu, vegMode, working, addToCart, cartSummary, setCheckout, customer }) {
  const t = text.toLowerCase();
  const available = menu.filter((i) => i.inStock && (!vegMode || i.veg));

  // complaints first — never turn a problem report into an upsell
  if (/(report a problem|complain|problem|issue|wrong|missing|cold|late|refund|stale|soggy|spill|never (came|arrived)|didn'?t (get|receive)|not (good|fresh)|bad (food|order))/.test(t)) {
    const generic = t.trim().length < 26 || /^report a problem( with my order)?$/.test(t.trim());
    if (generic) {
      return "Oh no — sorry to hear that. Tell me what happened (and the order number if you have it, like WC-1234) and I'll log it for the team right away.";
    }
    const orderNumber = (text.match(/WC-\d{3,5}/i) || [])[0];
    const result = await fileTicket({ summary: text.slice(0, 200), orderNumber, customer });
    return `Really sorry about that — that's not the Wicked standard. ${result} Anything else I can fix right now?`;
  }

  const findMentioned = () => {
    // score each item by how much of its own name appears in the message, so
    // "curly fries" matches Curly Fries (coverage 1.0) and not Loaded Fries (0.25)
    const textWords = new Set(t.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean));
    const scored = available
      .map((item) => {
        const words = item.name.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length >= 3);
        if (!words.length) return null;
        const matched = words.filter((w) => textWords.has(w)).length;
        return { item, coverage: matched / words.length, matched };
      })
      .filter((s) => s && s.matched > 0 && s.coverage >= 0.6)
      .sort((a, b) => b.coverage - a.coverage);
    if (!scored.length) return [];
    const best = scored[0].coverage;
    return scored.filter((s) => s.coverage === best || best < 1).map((s) => s.item);
  };

  if (/\b(yes|yeah|confirm|checkout|place (the )?order|order it|done|haan|karo|ok(ay)? go)\b/.test(t) && Object.keys(working).length) {
    setCheckout();
    return `Locked in! ${cartSummary().replace(/\n/g, ' · ')} — finishing up on the checkout screen now.`;
  }

  if (/spic/.test(t)) {
    const spicy = available.filter((i) => i.spicy);
    if (!spicy.length) return 'In veg mode the Spicy Crispy Paneer Burger (₹299) is the fieriest thing we do — want me to add one?';
    return `The Harrisa Chicken on Foccacia (₹349) brings serious North-African heat, and the hot Crispy Chicken Wings (₹249) are a close second. Want one in your cart? An iced tea on the side helps with the fire.`;
  }

  if (/veg.*(under|below|400|budget)|under.*400/.test(t)) {
    return `Easy: Spicy Crispy Paneer Burger (₹299, comes with wedges) + Lemon Iced Tea (₹99) lands at ₹398. Say the word and I'll add both.`;
  }

  const mentioned = findMentioned();
  if (mentioned.length) {
    const qtyMatch = t.match(/(\d+)\s*(?:x|×)?\s/);
    const qty = qtyMatch ? Math.min(10, Number(qtyMatch[1])) : 1;
    const added = [];
    for (const item of mentioned.slice(0, 3)) {
      try {
        addToCart(item.id, qty);
        added.push(`${qty} × ${item.name}`);
      } catch {
        /* skip out-of-stock / veg-mode conflicts */
      }
    }
    if (added.length) {
      return `Added ${added.join(' and ')}. ${cartSummary().split('\n').pop()} — anything else, or shall I take you to checkout? (Remember: every burger comes with wedges.)`;
    }
  }

  if (/recommend|suggest|kya|what.*(good|best)/.test(t)) {
    const pick = available.find((i) => i.popular) || available[0];
    return `Can't go wrong with the ${pick.name} (₹${pick.price}) — and WICKED10 gets you 10% off above ₹499. Want me to add it?`;
  }

  return `Hey! I'm the Wicked assistant — tell me what you're craving ("Chicken Burrito + wedges for pickup") and I'll build your cart. The Double Mutton Cheese Burger is our house heavyweight, just saying.`;
}
