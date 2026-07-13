import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, MapPin, Store, CreditCard, Banknote, Check } from 'lucide-react';
import { useStore, buzz, HAPTIC } from '../store.jsx';
import { api } from '../api.js';
import { sfx } from '../sound.js';

export default function Checkout() {
  const {
    setScreen, cartLines, orderType, total, promo, config, auth, setShowLogin,
    clearCart, setPromo, setActiveOrder, refreshOrders, notify, showToast, setPaySheet, sessionId
  } = useStore();

  const [name, setName] = useState(auth?.customer?.name || '');
  const [phone, setPhone] = useState(auth?.customer?.phone || '');
  const [address, setAddress] = useState('');
  const [tableNo, setTableNo] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('sb_table')) || '';
    } catch {
      return '';
    }
  });
  const [payMethod, setPayMethod] = useState('online');
  const [placing, setPlacing] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('sb_addresses')) || [];
    } catch {
      return [];
    }
  });
  const [saveLabel, setSaveLabel] = useState(''); // 'Home' | 'Work' | '' = don't save
  const [addrSugs, setAddrSugs] = useState([]);
  const pickedRef = useRef('');

  // address autocomplete via Photon (OpenStreetMap) — free, keyless, Ludhiana-biased
  useEffect(() => {
    const q = address.trim();
    if (orderType !== 'delivery' || q.length < 3 || q === pickedRef.current) {
      setAddrSugs([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://photon.komoot.io/api/?q=${encodeURIComponent(q + ', Ludhiana')}&limit=4&lat=30.889&lon=75.808`
        ).then((r) => r.json());
        const seen = new Set();
        const sugs = (res.features || [])
          .map((f) => {
            const p = f.properties || {};
            const street = p.housenumber && p.street ? `${p.housenumber} ${p.street}` : p.street;
            return [p.name, street, p.district, p.city || 'Ludhiana']
              .filter((x, i, a) => x && a.indexOf(x) === i)
              .join(', ');
          })
          .filter((s) => s && !seen.has(s) && seen.add(s));
        setAddrSugs(sugs.slice(0, 4));
      } catch {
        setAddrSugs([]); // offline / rate-limited → plain typing still works
      }
    }, 350);
    return () => clearTimeout(t);
  }, [address, orderType]);

  const saveAddress = (label, text) => {
    const next = [{ label, text }, ...savedAddresses.filter((a) => a.label !== label)].slice(0, 4);
    setSavedAddresses(next);
    localStorage.setItem('sb_addresses', JSON.stringify(next));
  };

  const etaLabel = { dinein: 'Dine-in · 15–20 min', pickup: 'Pickup · 25–30 min', delivery: 'Delivery · 35–40 min' }[orderType];
  const cashAllowed = orderType !== 'delivery';
  const effectivePay = cashAllowed ? payMethod : 'online';

  const problem = useMemo(() => {
    if (!config?.storeOpen) return "Ordering is paused right now — we're open 11 AM to 10 PM.";
    if (!cartLines.length) return 'Your cart is empty.';
    if (name.trim().length < 2) return 'Add your name to continue.';
    if (phone.replace(/\D/g, '').length !== 10) return 'Enter a 10-digit phone number.';
    if (orderType === 'delivery' && address.trim().length < 6) return 'Add your delivery address.';
    if (orderType === 'dinein' && !tableNo.trim()) return 'Add your table number.';
    return null;
  }, [config, cartLines, name, phone, orderType, address, tableNo]);

  const items = cartLines.map((l) => ({ id: l.item.id, qty: l.qty, note: l.note || undefined, mods: l.mods }));

  const finalizeOrder = async (payment) => {
    const order = await api.post('/orders', {
      sessionId,
      items,
      type: orderType,
      payMethod: effectivePay,
      name: name.trim(),
      phone: phone.replace(/\D/g, ''),
      address,
      tableNo,
      promo,
      payment
    });
    localStorage.setItem('sb_lastphone', JSON.stringify(phone.replace(/\D/g, '')));
    if (orderType === 'delivery' && saveLabel && address.trim()) saveAddress(saveLabel, address.trim());
    localStorage.removeItem('sb_table');
    clearCart();
    setPromo('');
    setActiveOrder(order);
    buzz(HAPTIC.placed);
    sfx.success();
    notify('Order placed', `${order.num} is in — the kitchen has it.`, 'tracking');
    setScreen('tracking');
    refreshOrders();
  };

  const placeOrder = async () => {
    if (problem || placing) return;
    setPlacing(true);
    try {
      if (effectivePay === 'cash') {
        await finalizeOrder(null);
      } else {
        const pay = await api.post('/payments/create', { items, type: orderType, promo });
        if (pay.mode === 'razorpay') {
          await openRazorpay(pay, { name: name.trim(), phone }, async (payment) => finalizeOrder(payment));
        } else {
          // simulated hosted checkout sheet
          setPaySheet({
            amount: pay.total,
            onResult: async (ok) => {
              setPaySheet(null);
              if (!ok) {
                buzz(HAPTIC.payFailed);
                showToast("Payment didn't go through — your cart is safe. Try again or pay cash.");
                return;
              }
              try {
                await finalizeOrder({
                  rzpOrderId: pay.rzpOrderId,
                  paymentId: 'pay_mock_' + Math.random().toString(36).slice(2, 10),
                  signature: 'mock'
                });
              } catch (e) {
                showToast(e.message);
              }
            }
          });
        }
      }
    } catch (e) {
      buzz(HAPTIC.payFailed);
      showToast(e.message);
    } finally {
      setPlacing(false);
    }
  };

  return (
    <div className="px-5 pb-40">
      <header className="flex items-center gap-2 pt-5 mb-4">
        <button className="w-9 h-9 rounded-md bg-card border-2 border-line flex items-center justify-center" onClick={() => setScreen('cart')} aria-label="Back">
          <ChevronLeft size={18} />
        </button>
        <h1 className="font-display font-extrabold text-[22px] tracking-[-0.5px] flex-1">Checkout</h1>
        <span className="rounded-full bg-bluesoft text-blue px-3 py-1.5 text-[11.5px] font-extrabold">{etaLabel}</span>
      </header>

      {!auth && (
        <button
          className="w-full rounded-lg bg-bluesoft border-2 border-blue/30 p-3.5 text-left text-[13px] font-bold text-blue mb-4"
          onClick={() => setShowLogin(true)}
        >
          Sign in to prefill your details &amp; save this order →
        </button>
      )}

      {/* contact */}
      <Section title="Contact">
        <input className={inputCls} placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
        <input
          className={inputCls}
          placeholder="10-digit phone"
          inputMode="numeric"
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/[^\d]/g, '').slice(0, 10))}
        />
      </Section>

      {orderType === 'delivery' && (
        <Section title="Delivery">
          <div className="rounded-lg bg-soft p-4 text-center" style={{ border: '2px dashed var(--line)' }}>
            <MapPin size={22} className="text-blue mx-auto" />
            <div className="text-[12.5px] font-bold mt-1.5">Pin dropped · 2.1 km from Wicked Chkn</div>
            <div className="text-[11.5px] font-bold text-greendark mt-0.5">✓ Within the 7 km delivery zone</div>
          </div>
          {savedAddresses.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {savedAddresses.map((a) => (
                <button
                  key={a.label}
                  className={`rounded-full px-3.5 py-2 text-[12px] font-extrabold border-2 ${
                    address === a.text ? 'border-blue text-blue bg-bluesoft' : 'border-line bg-card text-sub'
                  }`}
                  onClick={() => setAddress(a.text)}
                >
                  {a.label} · {a.text.slice(0, 22)}
                  {a.text.length > 22 ? '…' : ''}
                </button>
              ))}
            </div>
          )}
          <div className="relative">
            <input className={inputCls} placeholder="Flat / street / landmark" value={address} onChange={(e) => setAddress(e.target.value)} />
            {addrSugs.length > 0 && (
              <div className="absolute inset-x-0 top-[46px] z-30 bg-card border-2 border-line rounded-md overflow-hidden shadow-lg">
                {addrSugs.map((s) => (
                  <button
                    key={s}
                    className="w-full text-left px-3.5 py-2.5 text-[12.5px] font-semibold border-b border-line last:border-0 flex items-center gap-2"
                    onClick={() => {
                      pickedRef.current = s;
                      setAddress(s);
                      setAddrSugs([]);
                    }}
                  >
                    <MapPin size={13} className="text-blue shrink-0" />
                    <span className="truncate">{s}</span>
                  </button>
                ))}
                <div className="px-3.5 py-1.5 text-[9.5px] font-bold text-sub bg-bg">Suggestions by OpenStreetMap</div>
              </div>
            )}
          </div>
          {address.trim().length >= 6 && !savedAddresses.some((a) => a.text === address.trim()) && (
            <div className="flex items-center gap-2 text-[12px] font-bold text-sub">
              Save as:
              {['Home', 'Work'].map((l) => (
                <button
                  key={l}
                  className={`rounded-full px-3 py-1.5 border-2 font-extrabold ${
                    saveLabel === l ? 'border-blue text-blue bg-bluesoft' : 'border-line bg-card'
                  }`}
                  onClick={() => setSaveLabel(saveLabel === l ? '' : l)}
                >
                  {l}
                </button>
              ))}
            </div>
          )}
        </Section>
      )}

      {orderType === 'dinein' && (
        <Section title="Dine-in">
          <input className={inputCls} placeholder="Table number" value={tableNo} onChange={(e) => setTableNo(e.target.value.slice(0, 6))} />
        </Section>
      )}

      {orderType === 'pickup' && (
        <Section title="Pickup">
          <div className="rounded-lg bg-soft p-4 flex items-center gap-3">
            <Store size={20} className="text-blue shrink-0" />
            <div>
              <div className="text-[12.5px] font-bold">Wicked Chkn, Down Town Market, BRS Nagar, Ludhiana</div>
              <div className="text-[11.5px] text-sub">Ready in 25–30 min after confirmation</div>
            </div>
          </div>
        </Section>
      )}

      {/* payment */}
      <Section title="Payment">
        <PayCard
          active={effectivePay === 'online'}
          onClick={() => setPayMethod('online')}
          icon={CreditCard}
          title="Pay online"
          sub="UPI, cards, netbanking via Razorpay"
        />
        {cashAllowed ? (
          <PayCard
            active={effectivePay === 'cash'}
            onClick={() => setPayMethod('cash')}
            icon={Banknote}
            title="Cash"
            sub={orderType === 'dinein' ? 'Pay at the table' : 'Pay at the counter'}
          />
        ) : (
          <div className="text-[11.5px] text-sub font-semibold px-1">Delivery orders are prepaid only.</div>
        )}
      </Section>

      {/* CTA */}
      <div
        className="fixed bottom-16 inset-x-0 max-w-[420px] mx-auto px-5 pt-6 pb-3 z-20"
        style={{ background: 'linear-gradient(to top, var(--bg) 55%, transparent)' }}
      >
        <button
          className="w-full rounded-md text-white font-extrabold text-[15.5px] h-[52px] disabled:shadow-none"
          style={{ background: problem ? '#CBA49D' : 'var(--blue)', boxShadow: problem ? 'none' : '0 8px 20px rgba(217,43,33,.3)' }}
          disabled={!!problem || placing}
          onClick={placeOrder}
        >
          {placing ? 'Placing…' : effectivePay === 'online' ? `Pay ₹${total} & place order` : `Place order · ₹${total}`}
        </button>
        {problem && <div className="text-[11.5px] text-sub font-semibold text-center mt-2">{problem}</div>}
      </div>
    </div>
  );
}

const inputCls =
  'w-full bg-card border-2 border-line rounded-md px-3.5 h-11 text-[13.5px] font-semibold outline-none placeholder:text-sub';

function Section({ title, children }) {
  return (
    <section className="mb-4">
      <h2 className="text-[12px] font-extrabold uppercase tracking-wide text-sub mb-2">{title}</h2>
      <div className="space-y-2.5">{children}</div>
    </section>
  );
}

function PayCard({ active, onClick, icon: Icon, title, sub }) {
  return (
    <button
      className={`w-full rounded-lg p-3.5 flex items-center gap-3 text-left border-2 ${
        active ? 'border-blue bg-bluesoft' : 'border-line bg-card'
      }`}
      onClick={onClick}
    >
      <Icon size={19} className={active ? 'text-blue' : 'text-sub'} />
      <span className="flex-1">
        <span className="block text-[13.5px] font-extrabold">{title}</span>
        <span className="block text-[11.5px] text-sub">{sub}</span>
      </span>
      <span
        className="w-[18px] h-[18px] rounded-full border-[2px] flex items-center justify-center shrink-0"
        style={{ borderColor: active ? 'var(--blue)' : 'var(--line)' }}
      >
        {active && <Check size={11} strokeWidth={3.5} className="text-blue" />}
      </span>
    </button>
  );
}

// real Razorpay hosted checkout (activates when server has keys)
function openRazorpay(pay, contact, onSuccess) {
  return new Promise((resolve, reject) => {
    const ready = () => {
      const rzp = new window.Razorpay({
        key: pay.keyId,
        amount: pay.amount * 100,
        currency: 'INR',
        name: 'Wicked Chkn',
        order_id: pay.rzpOrderId,
        prefill: { name: contact.name, contact: contact.phone },
        theme: { color: '#D92B21' },
        handler: (resp) =>
          onSuccess({
            rzpOrderId: resp.razorpay_order_id,
            paymentId: resp.razorpay_payment_id,
            signature: resp.razorpay_signature
          })
            .then(resolve)
            .catch(reject),
        modal: { ondismiss: () => reject(new Error("Payment didn't go through — your cart is safe. Try again or pay cash.")) }
      });
      rzp.open();
    };
    if (window.Razorpay) return ready();
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = ready;
    s.onerror = () => reject(new Error('Could not load the payment provider.'));
    document.body.appendChild(s);
  });
}
