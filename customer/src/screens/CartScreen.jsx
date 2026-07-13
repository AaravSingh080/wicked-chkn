import React, { useState } from 'react';
import { ChevronLeft, ShoppingCart, X } from 'lucide-react';
import { useStore } from '../store.jsx';
import { api } from '../api.js';
import { Tile, Stepper } from '../components/ui.jsx';

const TYPES = [
  { key: 'dinein', label: 'Dine-in', eta: '15–20 min' },
  { key: 'pickup', label: 'Pickup', eta: '25–30 min' },
  { key: 'delivery', label: 'Delivery', eta: '35–40 min · ₹35' }
];

export default function CartScreen() {
  const {
    cartLines, addToCart, decCart, clearCart, setScreen, promo, setPromo, promoApplied, promoActive,
    subtotal, discount, deliveryFee, total, orderType, setOrderType, config, voucher, setVoucher
  } = useStore();
  const [input, setInput] = useState(promo);
  const [promoError, setPromoError] = useState('');

  const applyPromo = async () => {
    const code = input.trim().toUpperCase();
    setPromoError('');
    if (code === 'WICKED10') {
      setVoucher(null);
      setPromo('WICKED10');
    } else if (code.startsWith('WCGIFT-')) {
      try {
        const v = await api.get('/vouchers/' + code);
        if (!v.valid) return setPromoError(v.redeemed ? 'That gift code was already used.' : "That gift code doesn't exist.");
        setVoucher({ code, amount: v.amount });
        setPromo(code);
      } catch {
        setPromoError('Could not check that code — try again.');
      }
    } else {
      setPromoError("That code doesn't exist — try WICKED10 or a WCGIFT- code.");
    }
  };

  const minGap = config ? config.promo.min - subtotal : 0;

  if (cartLines.length === 0) {
    return (
      <div className="px-5 pb-24">
        <Header setScreen={setScreen} />
        <div className="flex flex-col items-center justify-center pt-24 gap-3">
          <ShoppingCart size={54} className="text-line" strokeWidth={1.5} />
          <div className="text-[15px] font-bold text-sub">Your cart is empty</div>
          <button className="rounded-md bg-blue text-white font-extrabold text-[14px] px-5 py-3 shadow-cta" onClick={() => setScreen('menu')}>
            Browse the menu
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 pb-40">
      <Header setScreen={setScreen} onClear={clearCart} />

      {/* line items */}
      <div className="space-y-3">
        {cartLines.map(({ item, qty, note, mods, lineTotal }) => (
          <div key={item.id} className="bg-card border-2 border-line rounded-lg p-3 flex items-center gap-3">
            <Tile item={item} size={52} radius={6} />
            <div className="flex-1 min-w-0">
              <div className="text-[13.5px] font-bold truncate">{item.name}</div>
              {mods.length > 0 && <div className="text-[11px] text-blue font-bold truncate">+ {mods.join(', ')}</div>}
              {note && <div className="text-[11px] text-sub truncate">“{note}”</div>}
              <div className="font-display font-bold text-[14.5px] text-blue mt-0.5">₹{lineTotal}</div>
            </div>
            <Stepper variant="soft" qty={qty} onInc={() => addToCart(item.id)} onDec={() => decCart(item.id)} />
          </div>
        ))}
      </div>

      {/* promo */}
      <div className="mt-4">
        <div className="flex gap-2">
          <input
            className="flex-1 bg-card border-2 border-line rounded-md px-3.5 h-11 text-[13px] font-bold uppercase outline-none placeholder:normal-case placeholder:font-semibold placeholder:text-sub"
            placeholder="Promo code (try WICKED10)"
            value={input}
            onChange={(e) => setInput(e.target.value.toUpperCase())}
          />
          <button className="rounded-md bg-bluesoft text-blue border-2 border-blue text-[13px] font-extrabold px-4" onClick={applyPromo}>
            Apply
          </button>
        </div>
        {promoError && <div className="text-red text-[12px] font-semibold mt-1.5">{promoError}</div>}
        {promo && (
          <div className="mt-2 rounded-md bg-greenfill text-greendark px-3.5 py-2.5 text-[12.5px] font-bold flex items-center gap-2">
            <span className="flex-1">
              {voucher && promo === voucher.code
                ? `Gift ${promo} applied — ₹${discount} off`
                : promoActive
                  ? `WICKED10 applied — you save ₹${discount}`
                  : 'WICKED10 applied (needs ₹499+ to kick in)'}
            </span>
            <button className="press-sm" onClick={() => { setPromo(''); setVoucher(null); setInput(''); }} aria-label="Remove promo">
              <X size={15} />
            </button>
          </div>
        )}
      </div>

      {/* order type */}
      <div className="grid grid-cols-3 gap-2.5 mt-4">
        {TYPES.map((t) => {
          const active = orderType === t.key;
          return (
            <button
              key={t.key}
              className={`rounded-lg p-3 text-left border-2 ${active ? 'text-white border-transparent' : 'bg-card border-line'}`}
              style={active ? { background: 'var(--hero)' } : undefined}
              onClick={() => setOrderType(t.key)}
            >
              <div className="text-[13px] font-extrabold">{t.label}</div>
              <div className={`text-[10.5px] font-semibold mt-0.5 ${active ? '' : 'text-sub'}`} style={active ? { color: '#E8B8B0' } : undefined}>
                {t.eta}
              </div>
            </button>
          );
        })}
      </div>

      {/* totals */}
      <div className="bg-card border-2 border-line rounded-lg p-4 mt-4 space-y-2 text-[13.5px] font-semibold">
        <Row label="Subtotal" value={`₹${subtotal}`} />
        {promoActive && (
          <Row label={voucher && promo === voucher.code ? `Gift ${promo}` : 'WICKED10 (10% off)'} value={`−₹${discount}`} valueClass="text-greendark" />
        )}
        {orderType === 'delivery' && <Row label="Delivery (within 7 km)" value={`₹${deliveryFee}`} />}
        <div className="border-t border-line pt-2 flex items-center justify-between">
          <span className="text-[16px] font-extrabold">Total</span>
          <span className="font-display text-[16px] font-extrabold">₹{total}</span>
        </div>
        {promoApplied && !promoActive && minGap > 0 && (
          <div className="text-blue text-[11.5px] font-bold">Add ₹{minGap} more to unlock 10% off</div>
        )}
      </div>

      {/* sticky CTA */}
      <div
        className="fixed bottom-16 inset-x-0 max-w-[420px] mx-auto px-5 pt-6 pb-3 z-20"
        style={{ background: 'linear-gradient(to top, var(--bg) 55%, transparent)' }}
      >
        <button
          className="w-full rounded-md bg-blue text-white font-extrabold text-[15.5px] h-[52px] shadow-cta"
          onClick={() => setScreen('checkout')}
        >
          Checkout · ₹{total} →
        </button>
      </div>
    </div>
  );
}

function Header({ setScreen, onClear }) {
  return (
    <header className="flex items-center gap-2 pt-5 mb-4">
      <button className="w-9 h-9 rounded-md bg-card border-2 border-line flex items-center justify-center" onClick={() => setScreen('menu')} aria-label="Back">
        <ChevronLeft size={18} />
      </button>
      <h1 className="font-display font-extrabold text-[22px] tracking-[-0.5px] flex-1">Your cart</h1>
      {onClear && (
        <button className="text-red text-[12.5px] font-extrabold px-1" onClick={onClear}>
          Clear
        </button>
      )}
    </header>
  );
}

function Row({ label, value, valueClass = '' }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sub">{label}</span>
      <span className={valueClass}>{value}</span>
    </div>
  );
}
