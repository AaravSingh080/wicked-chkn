import React, { useEffect, useState } from 'react';
import { Phone, LifeBuoy } from 'lucide-react';
import { useAdmin } from '../store.jsx';
import { api, fmtTime } from '../api.js';

// complaints filed by the customer chat assistant land here
export default function Tickets() {
  const { bump } = useAdmin();
  const [tickets, setTickets] = useState([]);
  const [tab, setTab] = useState('open');

  useEffect(() => {
    api.get('/admin/tickets').then(setTickets).catch(() => {});
  }, [bump]);

  const visible = tickets.filter((t) => t.status === tab);
  const openCount = tickets.filter((t) => t.status === 'open').length;

  const setStatus = async (t, status) => {
    await api.patch(`/admin/tickets/${t.id}`, { status });
    setTickets((cur) => cur.map((x) => (x.id === t.id ? { ...x, status } : x)));
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-center">
        {['open', 'resolved'].map((s) => (
          <button
            key={s}
            onClick={() => setTab(s)}
            className={`rounded-full px-4 py-2 text-[12.5px] font-extrabold capitalize ${
              tab === s ? 'bg-navy text-white' : 'bg-card border-[1.5px] border-line text-sub'
            }`}
          >
            {s} {s === 'open' && openCount > 0 && <span className="opacity-70">· {openCount}</span>}
          </button>
        ))}
        <span className="flex-1" />
        <span className="text-[12px] font-semibold text-sub">Filed automatically when customers report problems in chat</span>
      </div>

      {visible.length === 0 && (
        <div className="bg-card border-[1.5px] border-line rounded-2xl p-10 text-center">
          <LifeBuoy size={30} className="text-line mx-auto mb-2" />
          <div className="text-sub text-[13px] font-semibold">
            {tab === 'open' ? 'No open tickets — smooth sailing.' : 'Nothing resolved yet.'}
          </div>
        </div>
      )}

      {visible.map((t) => (
        <div key={t.id} className="bg-card border-[1.5px] border-line rounded-2xl p-4 flex items-start gap-4">
          <span className="w-9 h-9 rounded-xl bg-redfill text-red flex items-center justify-center shrink-0 font-display font-extrabold text-[12px]">
            #{t.id}
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-[13.5px] font-bold">{t.summary}</div>
            <div className="text-[12px] text-sub font-semibold mt-1">
              {t.name}
              {t.phone ? ` · +91 ${t.phone}` : ''}
              {t.orderNumber ? ` · ${t.orderNumber}` : ''} · {fmtTime(t.ts)}
            </div>
          </div>
          {t.phone && (
            <a href={`tel:+91${t.phone}`} className="shrink-0 rounded-xl bg-bluesoft text-blue text-[12.5px] font-extrabold px-3.5 py-2.5 flex items-center gap-1.5">
              <Phone size={13} /> Call back
            </a>
          )}
          {t.status === 'open' ? (
            <button className="shrink-0 rounded-xl bg-green text-white text-[12.5px] font-extrabold px-3.5 py-2.5" onClick={() => setStatus(t, 'resolved')}>
              Mark resolved
            </button>
          ) : (
            <button className="shrink-0 rounded-xl border-[1.5px] border-line text-sub text-[12.5px] font-extrabold px-3.5 py-2.5" onClick={() => setStatus(t, 'open')}>
              Reopen
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
