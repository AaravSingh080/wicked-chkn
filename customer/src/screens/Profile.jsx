import React, { useState } from 'react';
import { Heart, Phone, MessageCircle, MapPin, Clock, Sun, Moon, Gift, Star, Volume2 } from 'lucide-react';
import { useStore, buzz, HAPTIC } from '../store.jsx';
import { api } from '../api.js';
import { VegMark, Toggle } from '../components/ui.jsx';
import { Sheet } from '../components/Overlays.jsx';
import { LANGS } from '../i18n.js';

export default function Profile() {
  const {
    auth, signOut, setShowLogin, prefs, setPrefs, favourites, toggleFav, itemById, addToCart,
    myOrders, setScreen, setActiveOrder, clearCart, showToast, setPaySheet
  } = useStore();
  const [giftOpen, setGiftOpen] = useState(false);
  const [taste, setTaste] = useState(null);
  const tastePhone = auth?.customer?.phone;
  React.useEffect(() => {
    if (!tastePhone) return setTaste(null);
    api.get('/taste?phone=' + tastePhone).then(setTaste).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tastePhone, myOrders.length]);

  const favItems = favourites.map(itemById).filter(Boolean);
  const initial = (auth?.customer?.name || 'W')[0].toUpperCase();
  const punch = myOrders.filter((o) => o.done).length % 8;
  const lastDone = myOrders.find((o) => o.done);

  const reorder = (order) => {
    clearCart();
    let skipped = 0;
    for (const l of order.lines) {
      const item = itemById(l.itemId);
      if (item && item.inStock) addToCart(l.itemId, l.qty, l.note || undefined);
      else skipped++;
    }
    if (skipped) showToast(`${skipped} item${skipped > 1 ? 's' : ''} skipped (sold out)`, 'success');
    setScreen('cart');
  };

  return (
    <div className="pb-28">
      {/* maroon banner header — avatar, identity, live stats */}
      <div className="relative overflow-hidden text-white px-5 pt-5 pb-14" style={{ background: 'var(--hero)' }}>
        <span
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'repeating-linear-gradient(-45deg, rgba(255,255,255,.03) 0 16px, transparent 16px 32px)' }}
        />
        <h1 className="relative font-display uppercase text-[20px]">Profile</h1>
        <div className="relative flex items-center gap-3.5 mt-4">
          <span
            className="w-[54px] h-[54px] rounded-lg -rotate-3 flex items-center justify-center font-display text-[22px] shrink-0 text-white"
            style={{ background: 'var(--blue)', border: '2px solid rgba(255,255,255,.3)', boxShadow: '3px 3px 0 rgba(0,0,0,.3)' }}
          >
            {initial}
          </span>
          <div className="flex-1 min-w-0">
            {auth ? (
              <>
                <div className="text-[16px] font-extrabold truncate">{auth?.customer?.name || 'Wicked fan'}</div>
                <div className="text-[12px] font-semibold" style={{ color: '#E8B8B0' }}>+91 {auth?.customer?.phone || ''}</div>
              </>
            ) : (
              <>
                <div className="text-[16px] font-extrabold">Hungry stranger</div>
                <div className="text-[12px] font-semibold" style={{ color: '#E8B8B0' }}>Sign in to unlock rewards</div>
              </>
            )}
          </div>
          {!auth && (
            <button
              className="rounded-md text-[12.5px] font-extrabold px-4 py-2.5 shrink-0"
              style={{ background: '#FFF3EC', color: '#4A0E0B', boxShadow: '3px 3px 0 rgba(0,0,0,.3)' }}
              onClick={() => setShowLogin(true)}
            >
              Sign in
            </button>
          )}
        </div>
        {/* stats strip */}
        <div
          className="relative grid grid-cols-3 mt-5 rounded-lg overflow-hidden"
          style={{ background: 'rgba(255,255,255,.08)', border: '1.5px solid rgba(255,255,255,.18)' }}
        >
          {[
            ['Orders', myOrders.length],
            ['Favourites', favItems.length],
            ['Punch card', `${punch}/8`]
          ].map(([label, value], i) => (
            <div key={label} className={`text-center py-3 ${i ? 'border-l border-white/15' : ''}`}>
              <div className="font-display text-[18px]">{value}</div>
              <div className="text-[9px] font-extrabold tracking-[1.2px] uppercase" style={{ color: '#E8B8B0' }}>
                {label}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="relative z-10 px-5 -mt-7 space-y-4">
        {/* taste profile — archetype from real order history */}
        {taste?.profile && (
          <section
            className="relative overflow-hidden rounded-lg p-4 text-white"
            style={{
              background: {
                fire: 'linear-gradient(135deg,#3A1B10,#E4573D)',
                ocean: 'linear-gradient(135deg,#4A0E0B,#D92B21)',
                candy: 'linear-gradient(135deg,#8B3E78,#E8A2D8)',
                forest: 'linear-gradient(135deg,#123B22,#37A662)'
              }[taste.profile.theme],
              border: '2px solid var(--tileBorder)',
              boxShadow: '4px 4px 0 var(--shadowInk)'
            }}
          >
            <span className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(70% 70% at 85% 10%, rgba(255,255,255,.18), transparent 60%)' }} />
            <div className="relative text-[10.5px] font-extrabold tracking-[1.5px] opacity-80">YOUR WICKED PROFILE</div>
            <div className="relative font-display text-[24px] mt-0.5 uppercase">{taste.profile.name}</div>
            <div className="relative text-[12.5px] font-semibold opacity-90 mt-0.5">{taste.profile.line}</div>
            <div className="relative flex gap-4 mt-3 text-[11.5px] font-bold">
              <span>{taste?.stats?.orders ?? 0} orders</span>
              {taste?.stats?.favourite && <span>Go-to: {taste.stats.favourite}</span>}
              <span>
                {(() => {
                  // clamp hard — a bad spiceLevel must never crash the screen (negative .repeat throws)
                  const lvl = Math.min(5, Math.max(1, Number(taste?.stats?.spiceLevel) || 1));
                  return `Spice ${'|'.repeat(lvl)}${'·'.repeat(5 - lvl)}`;
                })()}
              </span>
            </div>
          </section>
        )}

        {/* quick actions — Zomato-style tile row */}
        <section className="grid grid-cols-2 gap-3">
          {[
            {
              Icon: Gift,
              label: 'Gift a meal',
              sub: 'Treat by phone number',
              grad: 'linear-gradient(135deg,#E8A2D8,#8B6BD8)',
              onClick: () => setGiftOpen(true)
            },
            {
              Icon: Star,
              label: 'Rate last order',
              sub: lastDone ? lastDone.num : 'No orders yet',
              grad: 'linear-gradient(135deg,#FFCF6B,#EF8F2B)',
              onClick: () => {
                if (!lastDone) return showToast('Finish an order first — then rate it!');
                setActiveOrder(lastDone);
                setScreen('tracking');
              }
            }
          ].map(({ Icon, label, sub, grad, onClick }) => (
            <button
              key={label}
              className="press-tilt bg-card border-2 border-line rounded-lg p-3.5 text-left flex items-center gap-3"
              style={{ boxShadow: '3px 3px 0 var(--shadowInk)' }}
              onClick={onClick}
            >
              <span className="w-9 h-9 rounded-md rotate-3 flex items-center justify-center shrink-0 text-white" style={{ background: grad, border: '2px solid var(--tileBorder)' }}>
                <Icon size={16} />
              </span>
              <span className="min-w-0">
                <span className="block text-[12.5px] font-extrabold leading-tight">{label}</span>
                <span className="block text-[10.5px] text-sub truncate">{sub}</span>
              </span>
            </button>
          ))}
        </section>

        {giftOpen && <GiftSheet onClose={() => setGiftOpen(false)} setPaySheet={setPaySheet} showToast={showToast} fromName={auth?.customer?.name || ''} />}

        {/* favourites */}
        <section className="bg-card border-2 border-line rounded-lg p-4">
        <h2 className="text-[13.5px] font-extrabold mb-3 flex items-center gap-1.5"><Heart size={14} className="text-red" /> Favourites</h2>
        {favItems.length === 0 ? (
          <div className="text-[12.5px] text-sub font-semibold">Tap the heart on any item to save it here.</div>
        ) : (
          <div className="space-y-3">
            {favItems.map((item) => (
              <div key={item.id} className="flex items-center gap-2.5">
                <VegMark veg={item.veg} />
                <span className="flex-1 text-[13.5px] font-bold truncate">{item.name}</span>
                <span className="font-display font-bold text-[14px]">₹{item.price}</span>
                {item.inStock && (
                  <button
                    className="rounded-full bg-bluesoft text-blue text-[11.5px] font-extrabold px-3 py-1"
                    onClick={() => addToCart(item.id)}
                  >
                    Add
                  </button>
                )}
                <button className="press-sm" onClick={() => toggleFav(item.id)} aria-label="Remove favourite">
                  <Heart size={16} className="text-red" fill="#E23B2E" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* orders */}
      <section className="bg-card border-2 border-line rounded-lg p-4">
        <h2 className="text-[13.5px] font-extrabold mb-3">Orders</h2>
        {myOrders.length === 0 ? (
          <div className="text-[12.5px] text-sub font-semibold">
            No orders yet — your history lands here after your first wicked bite.
          </div>
        ) : (
          <div className="space-y-3">
            {myOrders.map((o) => (
              <div key={o.id} className="flex items-center gap-2.5">
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-bold">
                    {o.num} · ₹{o.total}
                  </div>
                  <div className="text-[11px] text-sub font-semibold">
                    {o.createdAt ? new Date(o.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'} ·{' '}
                    {{ dinein: 'Dine-in', pickup: 'Pickup', delivery: 'Delivery' }[o.type] || o.type}
                  </div>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-[10.5px] font-extrabold ${
                    o.cancelled ? 'bg-spicyfill text-red' : o.done ? 'bg-greenfill text-greendark' : 'bg-bluesoft text-blue'
                  }`}
                >
                  {o.cancelled ? 'Cancelled' : o.status}
                </span>
                {o.done ? (
                  <span className="flex gap-1.5">
                    {!o.rating && (
                      <button
                        className="rounded-md bg-bluesoft text-blue text-[11.5px] font-extrabold px-3 py-2"
                        onClick={() => {
                          setActiveOrder(o);
                          setScreen('tracking');
                        }}
                      >
                        Rate
                      </button>
                    )}
                    <button className="rounded-md bg-blue text-white text-[11.5px] font-extrabold px-3 py-2" onClick={() => reorder(o)}>
                      Reorder
                    </button>
                  </span>
                ) : (
                  <button
                    className="rounded-md bg-bluesoft text-blue text-[11.5px] font-extrabold px-3 py-2"
                    onClick={() => {
                      setActiveOrder(o);
                      setScreen('tracking');
                    }}
                  >
                    Track
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* settings — grouped rows, one card */}
      <section className="bg-card border-2 border-line rounded-lg overflow-hidden">
        <div className="px-4 pt-3.5 pb-2 text-[10.5px] font-extrabold tracking-[1.5px] uppercase text-sub">Settings</div>
        <div className="flex items-center gap-3 px-4 py-3 border-t-2 border-line">
          <span className="w-8 h-8 rounded-md bg-bluesoft text-blue flex items-center justify-center shrink-0">
            {prefs.theme === 'dark' ? <Moon size={15} /> : <Sun size={15} />}
          </span>
          <div className="flex-1">
            <div className="text-[13px] font-extrabold">Appearance</div>
            <div className="text-[11px] text-sub">{prefs.theme === 'dark' ? 'Dark' : 'Light'} theme</div>
          </div>
          <Toggle
            color="var(--blue)"
            on={prefs.theme === 'dark'}
            onChange={() => {
              buzz(HAPTIC.toggle);
              setPrefs((p) => ({ ...p, theme: p.theme === 'dark' ? 'light' : 'dark' }));
            }}
          />
        </div>
        <div className="flex items-center gap-3 px-4 py-3 border-t-2 border-line">
          <span className="w-8 h-8 rounded-md bg-bluesoft text-blue flex items-center justify-center shrink-0">
            <Volume2 size={15} />
          </span>
          <div className="flex-1">
            <div className="text-[13px] font-extrabold">Sounds</div>
            <div className="text-[11px] text-sub">Little clicks and chimes</div>
          </div>
          <Toggle
            color="var(--blue)"
            on={prefs.sounds !== false}
            onChange={() => {
              buzz(HAPTIC.toggle);
              setPrefs((p) => ({ ...p, sounds: p.sounds === false }));
            }}
          />
        </div>
        <div className="px-4 py-3 border-t-2 border-line">
          <div className="text-[13px] font-extrabold mb-2">Language</div>
          <div className="flex gap-2">
            {LANGS.map((l) => (
              <button
                key={l.key}
                className={`flex-1 rounded-md py-2 text-[12.5px] font-extrabold border-2 ${
                  (prefs.lang || 'en') === l.key ? 'border-blue text-blue bg-bluesoft' : 'border-line bg-bg text-sub'
                }`}
                onClick={() => setPrefs((p) => ({ ...p, lang: l.key }))}
              >
                {l.label}
              </button>
            ))}
          </div>
          <div className="text-[10.5px] text-sub font-semibold mt-1.5">Menu item names stay in English.</div>
        </div>
      </section>

      {/* help & contact — grouped rows */}
      <section className="bg-card border-2 border-line rounded-lg overflow-hidden">
        <div className="px-4 pt-3.5 pb-2 text-[10.5px] font-extrabold tracking-[1.5px] uppercase text-sub">Help &amp; contact</div>
        <a href="tel:+911610000000" className="flex items-center gap-3 px-4 py-3 border-t-2 border-line text-[13px] font-extrabold">
          <span className="w-8 h-8 rounded-md bg-bluesoft text-blue flex items-center justify-center shrink-0"><Phone size={15} /></span>
          Call Wicked Chkn
          <span className="ml-auto text-sub font-bold">›</span>
        </a>
        <a href="https://wa.me/911610000000" target="_blank" rel="noreferrer" className="flex items-center gap-3 px-4 py-3 border-t-2 border-line text-[13px] font-extrabold">
          <span className="w-8 h-8 rounded-md bg-greenfill text-greendark flex items-center justify-center shrink-0"><MessageCircle size={15} /></span>
          WhatsApp us
          <span className="ml-auto text-sub font-bold">›</span>
        </a>
        <div className="flex items-center gap-3 px-4 py-3 border-t-2 border-line text-[12.5px] font-semibold text-sub">
          <span className="w-8 h-8 rounded-md bg-soft text-blue flex items-center justify-center shrink-0"><MapPin size={15} /></span>
          Down Town Market, BRS Nagar, Ludhiana
        </div>
        <div className="flex items-center gap-3 px-4 py-3 border-t-2 border-line text-[12.5px] font-semibold text-sub">
          <span className="w-8 h-8 rounded-md bg-soft text-blue flex items-center justify-center shrink-0"><Clock size={15} /></span>
          Open 11 AM – 10 PM daily
        </div>
      </section>

      {/* sign out */}
      {auth && (
        <button
          className="w-full bg-card border-2 border-line rounded-lg py-3 text-red text-[13.5px] font-extrabold"
          onClick={signOut}
        >
          Sign out
        </button>
      )}
      </div>
    </div>
  );
}

// gift voucher purchase — reuses the mock payment sheet
function GiftSheet({ onClose, setPaySheet, showToast, fromName }) {
  const [amount, setAmount] = useState(500);
  const [toPhone, setToPhone] = useState('');
  const [name, setName] = useState(fromName);
  const [message, setMessage] = useState('');
  const [result, setResult] = useState(null);

  const buy = () => {
    if (toPhone.length !== 10) return showToast("Enter the recipient's 10-digit phone.");
    setPaySheet({
      amount,
      onResult: async (ok) => {
        setPaySheet(null);
        if (!ok) return showToast("Payment didn't go through — try again.");
        try {
          const res = await api.post('/vouchers', {
            amount,
            toPhone,
            fromName: name,
            message,
            payment: { rzpOrderId: 'order_mock_gift', paymentId: 'pay_mock_' + Math.random().toString(36).slice(2, 10), signature: 'mock' }
          });
          setResult(res);
        } catch (e) {
          showToast(e.message);
        }
      }
    });
  };

  return (
    <Sheet onClose={onClose}>
      <div className="p-6 pb-8 space-y-4">
        {result ? (
          <div className="text-center space-y-3 py-4">
            <div className="font-display font-extrabold text-[20px]">Gift sent!</div>
            <div
              className="mx-auto inline-block rounded-lg px-6 py-4 text-white font-display font-extrabold text-[22px] tracking-wider"
              style={{ background: 'linear-gradient(135deg,#E8A2D8,#8B6BD8)' }}
            >
              {result.code}
            </div>
            <p className="text-[12.5px] text-sub font-semibold">
              ₹{result.amount} credit texted to +91 {toPhone}. They enter the code at checkout.
            </p>
            <button className="w-full rounded-md bg-blue text-white font-extrabold text-[14px] h-12 shadow-cta" onClick={onClose}>
              Done
            </button>
          </div>
        ) : (
          <>
            <h2 className="font-display font-extrabold text-[20px]">Gift a meal</h2>
            <div className="flex gap-2">
              {[200, 500, 1000].map((a) => (
                <button
                  key={a}
                  className={`flex-1 rounded-md py-3 font-display font-extrabold text-[16px] border-2 ${
                    amount === a ? 'border-blue text-blue bg-bluesoft' : 'border-line bg-bg text-sub'
                  }`}
                  onClick={() => setAmount(a)}
                >
                  ₹{a}
                </button>
              ))}
            </div>
            <input className={giftInput} placeholder="Recipient's 10-digit phone" inputMode="numeric" value={toPhone} onChange={(e) => setToPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} />
            <input className={giftInput} placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
            <input className={giftInput} placeholder="Message (optional)" value={message} onChange={(e) => setMessage(e.target.value.slice(0, 120))} />
            <button className="w-full rounded-md bg-blue text-white font-extrabold text-[14.5px] h-12 shadow-cta" onClick={buy}>
              Pay ₹{amount} & send
            </button>
          </>
        )}
      </div>
    </Sheet>
  );
}

const giftInput =
  'w-full bg-bg border-2 border-line rounded-md px-3.5 h-12 text-[13.5px] font-semibold outline-none placeholder:text-sub';
