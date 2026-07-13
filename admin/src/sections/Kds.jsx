import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useAdmin } from '../store.jsx';
import { api } from '../api.js';

// Kitchen Display System — fullscreen ticket board for a kitchen tablet.
// Big type, one-tap stage advance, live via the shared SSE feed.
export default function Kds({ onExit }) {
  const { orders, refreshOrders } = useAdmin();
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 30000); // refresh elapsed times
    return () => clearInterval(t);
  }, []);

  const live = orders
    .filter((o) => !o.done && !o.cancelled)
    .sort((a, b) => a.createdAt - b.createdAt);

  const advance = async (o) => {
    try {
      await api.patch(`/admin/orders/${o.id}`, { action: o.statusIdx === 0 ? 'accept' : 'advance' });
      refreshOrders();
    } catch (e) {
      alert(e.message);
    }
  };

  const mins = (ts) => Math.max(0, Math.round((Date.now() - ts) / 60000));

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" style={{ background: '#170908' }}>
      <div className="flex items-center gap-4 px-6 py-4 sticky top-0 z-10" style={{ background: '#170908' }}>
        <span className="w-10 h-10 rounded-xl bg-blue text-white font-display font-extrabold text-[15px] flex items-center justify-center">WC</span>
        <div className="text-white font-display font-extrabold text-[20px]">KITCHEN</div>
        <span className="flex items-center gap-1.5 rounded-full bg-greenfill text-greendark px-3 py-1.5 text-[11px] font-extrabold">
          <span className="w-[7px] h-[7px] rounded-full bg-green blink" /> LIVE
        </span>
        <span className="flex-1" />
        <span className="text-navytext text-[13px] font-bold">{live.length} active</span>
        <button className="w-10 h-10 rounded-xl flex items-center justify-center text-white" style={{ background: 'rgba(255,255,255,.1)' }} onClick={onExit} aria-label="Exit kitchen mode">
          <X size={18} />
        </button>
      </div>

      {live.length === 0 && (
        <div className="flex flex-col items-center justify-center py-40 gap-3">
          <div className="text-[52px] font-display font-extrabold" style={{ color: '#4A211C' }}>ALL CLEAR</div>
          <div className="text-navytext text-[14px] font-semibold">New tickets appear here the second they're placed.</div>
        </div>
      )}

      <div className="grid gap-4 px-6 pb-8" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
        {live.map((o) => {
          const waited = mins(o.createdAt);
          const isNew = o.statusIdx === 0;
          const urgent = waited >= 15;
          return (
            <div
              key={o.id}
              className="rounded-2xl p-4 flex flex-col"
              style={{
                background: '#241110',
                border: `2px solid ${isNew ? '#E23B2E' : urgent ? '#E8A33D' : '#4A211C'}`
              }}
            >
              <div className="flex items-center gap-2.5">
                <span className="font-display font-extrabold text-[22px] text-white">{o.num}</span>
                <span className="rounded-full px-2.5 py-1 text-[10.5px] font-extrabold uppercase" style={{ background: '#3A1714', color: '#F2B3AA' }}>
                  {{ dinein: `Table ${o.tableNo || '?'}`, pickup: 'Pickup', delivery: 'Delivery' }[o.type]}
                </span>
                <span className="flex-1" />
                <span className="text-[13px] font-extrabold" style={{ color: urgent ? '#F2A93B' : '#C9968E' }}>
                  {waited}m
                </span>
              </div>

              <div className="mt-3 space-y-2 flex-1">
                {o.lines.map((l) => (
                  <div key={l.id}>
                    <div className="text-white text-[16px] font-bold leading-tight">
                      <span className="text-blue font-display" style={{ color: '#FF8A7A' }}>{l.qty}×</span> {l.name}
                    </div>
                    {(l.mods?.length > 0 || l.note) && (
                      <div className="text-[13px] font-bold mt-0.5" style={{ color: '#F2A93B' }}>
                        {[...(l.mods || []), l.note].filter(Boolean).join(' · ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {o.arrived && (
                <div className="mt-2 text-[12px] font-extrabold" style={{ color: '#F2A93B' }}>
                  CUSTOMER OUTSIDE{o.arrived.note ? ` · ${o.arrived.note.toUpperCase()}` : ''}
                </div>
              )}

              <button
                className="mt-3 w-full rounded-xl text-white font-extrabold text-[15px] py-3.5"
                style={{ background: isNew ? '#E23B2E' : '#D92B21' }}
                onClick={() => advance(o)}
              >
                {isNew ? 'ACCEPT' : `→ ${o.flow[o.statusIdx + 1]?.toUpperCase()}`}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
