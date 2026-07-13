import React, { useState } from 'react';
import { ChevronLeft, Check, Phone, Bike, Star, MapPin } from 'lucide-react';
import { useStore, buzz, HAPTIC } from '../store.jsx';
import { api } from '../api.js';

const RATE_TAGS = ['Juicy', 'Fast', 'Great packing', 'Late', 'Cold', 'Wrong item'];

export default function Tracking() {
  const { activeOrder: order, setScreen, config, setActiveOrder, showToast } = useStore();
  const [stars, setStars] = useState(0);
  const [tags, setTags] = useState([]);
  const [outsideNote, setOutsideNote] = useState('');
  const [busy, setBusy] = useState(false);

  const submitRating = async () => {
    if (!stars || busy) return;
    setBusy(true);
    try {
      await api.post(`/orders/${order.id}/rating`, { stars, tags });
      setActiveOrder(await api.get('/orders/' + order.id));
      showToast('Thanks for the rating!', 'success');
    } catch (e) {
      showToast(e.message);
    } finally {
      setBusy(false);
    }
  };

  const imOutside = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await api.post(`/orders/${order.id}/arrived`, { note: outsideNote });
      buzz(HAPTIC.toggle);
      setActiveOrder(await api.get('/orders/' + order.id));
      showToast("Told the counter — they're on it!", 'success');
    } catch (e) {
      showToast(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (!order) {
    return (
      <div className="px-5 pt-16 pb-24 text-center">
        <div className="text-[14px] font-bold text-sub">No active order — hungry?</div>
        <button className="mt-4 rounded-md bg-blue text-white font-extrabold text-[14px] px-5 py-3 shadow-cta" onClick={() => setScreen('menu')}>
          Browse the menu
        </button>
      </div>
    );
  }

  const lastIdx = order.flow.length - 1;
  const pct = Math.round((order.statusIdx / lastIdx) * 100);
  const typeLabel = { dinein: 'Dine-in', pickup: 'Pickup', delivery: 'Delivery' }[order.type];
  const eta = config?.eta?.[order.type] || '';
  const riderOut = order.type === 'delivery' && order.statusIdx >= order.flow.indexOf('Out for delivery');

  return (
    <div className="pb-24">
      {/* navy header */}
      <div className="text-white px-5 pt-5 pb-6" style={{ background: 'var(--hero)' }}>
        <button
          className="w-9 h-9 rounded-md flex items-center justify-center mb-4"
          style={{ background: 'rgba(255,255,255,.08)' }}
          onClick={() => setScreen('home')}
          aria-label="Back"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="text-[11.5px] font-extrabold tracking-[1.5px]" style={{ color: '#FF8A7A' }}>
          ORDER {order.num}
        </div>
        <h1 className="font-display font-extrabold text-[28px] leading-tight mt-1">
          {order.cancelled ? 'Order cancelled' : order.status}
        </h1>
        <div className="text-[13px] font-semibold mt-1" style={{ color: '#E8B8B0' }}>
          {typeLabel} ·{' '}
          {config?.kitchenEta && !order.done && !order.cancelled
            ? `kitchen pace today ~${config.kitchenEta} min`
            : `estimated ${eta}`}
        </div>
        <div className="mt-4 rounded-full overflow-hidden" style={{ height: 7, background: 'rgba(255,244,242,.15)' }}>
          <div className="h-full rounded-full progress-anim" style={{ width: `${pct}%`, background: '#FF8A7A' }} />
        </div>
      </div>

      <div className="px-5 -mt-3 space-y-4">
        {/* cancelled notice */}
        {order.cancelled && (
          <div className="bg-card border-2 border-red rounded-lg p-4">
            <div className="text-[13.5px] font-extrabold text-red">This order was cancelled</div>
            <div className="text-[12.5px] text-sub font-semibold mt-1">
              {order.cancelled.reason}
              {order.payMethod === 'online' ? ' — your refund is being processed.' : ''}
            </div>
          </div>
        )}

        {/* timeline */}
        <div className="bg-card border-2 border-line rounded-lg p-4">
          {order.flow.map((stage, i) => {
            const done = i < order.statusIdx;
            const current = i === order.statusIdx;
            const last = i === order.flow.length - 1;
            return (
              <div key={stage} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span
                    className={`w-[26px] h-[26px] rounded-full flex items-center justify-center shrink-0 ${current ? 'blink' : ''}`}
                    style={{
                      background: done ? '#1FA45C' : current ? 'var(--blue)' : 'var(--soft)'
                    }}
                  >
                    {done && <Check size={14} strokeWidth={3.2} className="text-white" />}
                    {current && <span className="w-2 h-2 rounded-full bg-white" />}
                  </span>
                  {!last && (
                    <span className="flex-1 my-0.5" style={{ width: 2.5, background: done ? '#1FA45C' : 'var(--line)', minHeight: 18 }} />
                  )}
                </div>
                <div className={`pb-4 ${last ? 'pb-0' : ''}`}>
                  <div className={`text-[13.5px] font-extrabold ${done || current ? '' : 'text-sub'}`}>{stage}</div>
                  {current && !order.done && (
                    <div className="text-[11.5px] text-sub font-semibold mt-0.5">Updates live from the kitchen dashboard</div>
                  )}
                  {last && order.done && <div className="text-[11.5px] text-greendark font-semibold mt-0.5">Enjoy! Order again soon.</div>}
                </div>
              </div>
            );
          })}
        </div>

        {/* live rider map (delivery in progress) */}
        {order.type === 'delivery' && !order.done && !order.cancelled && (
          <div className="bg-card border-2 border-line rounded-lg p-4">
            <div
              className="rounded-md h-[110px] flex items-center justify-center relative overflow-hidden"
              style={{ background: 'var(--soft)', border: '2px dashed var(--line)' }}
            >
              <Bike size={26} className={`text-blue ${riderOut ? 'blink-slow' : ''}`} />
              <span className="absolute bottom-2 right-3 text-[10px] font-bold text-sub">Live rider GPS · production</span>
            </div>
            <div className="flex items-center gap-2 mt-2.5">
              <div className="flex-1 text-[12.5px] font-bold">
                {order.rider
                  ? `${order.rider.name} is ${riderOut ? 'on the way to you' : 'assigned to your order'}`
                  : riderOut
                    ? 'Rider is on the way to you'
                    : 'A rider will pick this up once it’s ready'}
              </div>
              {order.rider?.phone && (
                <a href={`tel:+91${order.rider.phone}`} className="rounded-full bg-bluesoft text-blue px-3 py-1.5 text-[11.5px] font-extrabold">
                  Call rider
                </a>
              )}
            </div>
          </div>
        )}

        {/* "I'm outside" — pickup orders from Ready onwards */}
        {order.type === 'pickup' && !order.done && !order.cancelled && order.statusIdx >= order.flow.indexOf('Ready') && (
          <div className="bg-card border-2 border-line rounded-lg p-4">
            {order.arrived ? (
              <div className="text-[12.5px] font-bold text-greendark flex items-center gap-2">
                <Check size={15} strokeWidth={3} /> Counter knows you're outside{order.arrived.note ? ` (${order.arrived.note})` : ''} — hang tight!
              </div>
            ) : (
              <>
                <div className="text-[13px] font-extrabold flex items-center gap-1.5">
                  <MapPin size={14} className="text-blue" /> Reached the store?
                </div>
                <div className="flex gap-2 mt-2.5">
                  <input
                    className="flex-1 min-w-0 bg-bg border-2 border-line rounded-md px-3 h-10 text-[12.5px] font-semibold outline-none placeholder:text-sub"
                    placeholder="e.g. blue scooter (optional)"
                    value={outsideNote}
                    onChange={(e) => setOutsideNote(e.target.value.slice(0, 40))}
                  />
                  <button className="shrink-0 rounded-md bg-blue text-white text-[12.5px] font-extrabold px-4" onClick={imOutside} disabled={busy}>
                    I'm outside
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* post-order rating */}
        {order.done && (
          <div className="bg-card border-2 border-line rounded-lg p-4">
            {order.rating ? (
              <div className="text-[13px] font-bold flex items-center gap-1.5">
                Thanks for rating!{' '}
                <span className="text-[#F2A93B]">{'★'.repeat(order.rating.stars)}</span>
                {order.rating.tags.length > 0 && <span className="text-sub font-semibold">· {order.rating.tags.join(', ')}</span>}
              </div>
            ) : (
              <>
                <div className="text-[13.5px] font-extrabold">How was it?</div>
                <div className="flex gap-2 mt-2.5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button key={s} className="press-sm" onClick={() => setStars(s)} aria-label={`${s} stars`}>
                      <Star size={28} className={s <= stars ? 'text-[#F2A93B]' : 'text-line'} fill={s <= stars ? '#F2A93B' : 'none'} />
                    </button>
                  ))}
                </div>
                <div className="flex gap-1.5 flex-wrap mt-3">
                  {RATE_TAGS.map((tg) => {
                    const on = tags.includes(tg);
                    return (
                      <button
                        key={tg}
                        className={`rounded-full px-3 py-1.5 text-[11.5px] font-extrabold border-2 ${
                          on ? 'border-blue text-blue bg-bluesoft' : 'border-line text-sub bg-bg'
                        }`}
                        onClick={() => setTags((cur) => (on ? cur.filter((x) => x !== tg) : [...cur, tg]))}
                      >
                        {tg}
                      </button>
                    );
                  })}
                </div>
                <button
                  className="w-full mt-3 rounded-md bg-blue text-white text-[13px] font-extrabold h-10 disabled:opacity-50"
                  onClick={submitRating}
                  disabled={!stars || busy}
                >
                  Submit rating
                </button>
              </>
            )}
          </div>
        )}

        {/* summary */}
        <div className="bg-card border-2 border-line rounded-lg p-4 space-y-2">
          {order.lines.map((l) => (
            <div key={l.id} className="flex justify-between text-[13px] font-semibold">
              <span>
                {l.qty} × {l.name}
              </span>
              <span className="text-sub">₹{l.lineTotal}</span>
            </div>
          ))}
          <div className="border-t border-line pt-2 flex justify-between text-[13.5px] font-extrabold">
            <span>{order.payMethod === 'online' ? 'Paid online' : 'Paying by cash'}</span>
            <span className="font-display">₹{order.total}</span>
          </div>
        </div>

        <a
          href="tel:+911610000000"
          className="flex items-center justify-center gap-2 text-blue text-[13.5px] font-extrabold py-2"
        >
          <Phone size={15} /> Need help? Call the restaurant
        </a>
      </div>
    </div>
  );
}
