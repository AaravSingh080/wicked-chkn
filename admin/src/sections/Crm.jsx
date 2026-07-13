import React, { useEffect, useState } from 'react';
import { Search, ChevronDown, ChevronUp } from 'lucide-react';
import { useAdmin } from '../store.jsx';
import { api, fmtTime, fmtMoney } from '../api.js';

const INTEGRATIONS = [
  { name: 'WhatsApp Business', mono: 'WA', tile: '#1FA45C', desc: 'Campaigns, order updates and support chats.', on: true },
  { name: 'Razorpay', mono: 'RP', tile: '#D92B21', desc: 'Payments, settlements and refunds.', on: true },
  { name: 'MSG91 / Twilio SMS', mono: 'SMS', tile: '#4A0E0B', desc: 'OTP and order status texts.', on: true },
  { name: 'HubSpot CRM', mono: 'HS', tile: '#E23B2E', desc: 'Customer + order sync for lifecycle marketing.', on: false },
  { name: 'Zoho CRM', mono: 'ZO', tile: '#B7791F', desc: 'Pipelines and customer records.', on: false },
  { name: 'Google Business', mono: 'GB', tile: '#157A45', desc: 'Reviews, hours and location profile.', on: false }
];

export default function Crm() {
  const { bump } = useAdmin();
  const [q, setQ] = useState('');
  const [customers, setCustomers] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [history, setHistory] = useState({});

  useEffect(() => {
    const t = setTimeout(() => {
      api.get('/admin/customers?q=' + encodeURIComponent(q)).then(setCustomers).catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [q, bump]);

  const toggleRow = async (c) => {
    if (openId === c.id) return setOpenId(null);
    setOpenId(c.id);
    if (!history[c.id]) {
      const orders = await api.get(`/admin/customers/${c.id}/orders`);
      setHistory((h) => ({ ...h, [c.id]: orders }));
    }
  };

  return (
    <div className="space-y-5">
      {/* integrations */}
      <div className="grid grid-cols-3 gap-3">
        {INTEGRATIONS.map((it) => (
          <div key={it.name} className="bg-card border-[1.5px] border-line rounded-2xl p-4 flex items-center gap-3">
            <span
              className="w-10 h-10 rounded-xl text-white font-display font-extrabold text-[12px] flex items-center justify-center shrink-0"
              style={{ background: it.tile }}
            >
              {it.mono}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-extrabold truncate">{it.name}</div>
              <div className="text-[11px] text-sub font-semibold truncate">{it.desc}</div>
            </div>
            {it.on ? (
              <span className="rounded-full bg-greenfill text-greendark px-2.5 py-1 text-[10.5px] font-extrabold shrink-0">
                Connected
              </span>
            ) : (
              <button className="rounded-lg border-[1.5px] border-blue text-blue px-3 py-1.5 text-[11.5px] font-extrabold shrink-0">
                Connect
              </button>
            )}
          </div>
        ))}
      </div>

      {/* customers table */}
      <div className="bg-card border-[1.5px] border-line rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-line flex items-center gap-3">
          <h2 className="text-[14px] font-extrabold flex-1">Customers</h2>
          <label className="flex items-center gap-2.5 bg-page border-[1.5px] border-line rounded-xl px-3.5 h-10 w-[300px]">
            <Search size={14} className="text-sub" />
            <input
              className="flex-1 bg-transparent outline-none text-[13px] font-semibold placeholder:text-sub"
              placeholder="Search by name or phone…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </label>
        </div>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="bg-thead text-left text-[11px] font-extrabold text-sub uppercase tracking-wide">
              <th className="px-5 py-3">Customer</th>
              <th className="px-2 py-3">Phone</th>
              <th className="px-2 py-3">Orders</th>
              <th className="px-2 py-3">Lifetime spend</th>
              <th className="px-5 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {customers.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-sub font-semibold">
                  No customers yet — they appear here after sign-ins and orders in the app.
                </td>
              </tr>
            )}
            {customers.map((c) => (
              <React.Fragment key={c.id}>
                <tr className="border-t border-line cursor-pointer hover:bg-page/60" onClick={() => toggleRow(c)}>
                  <td className="px-5 py-3 font-bold">{c.name}</td>
                  <td className="px-2 py-3 text-sub font-semibold">+91 {c.phone}</td>
                  <td className="px-2 py-3 font-bold">{c.ordersCount}</td>
                  <td className="px-2 py-3 font-display font-bold">{fmtMoney(c.lifetimeSpend)}</td>
                  <td className="px-5 py-3 text-sub">{openId === c.id ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</td>
                </tr>
                {openId === c.id && (
                  <tr className="border-t border-line bg-page/50">
                    <td colSpan={5} className="px-5 py-4">
                      {!history[c.id] ? (
                        <div className="text-sub text-[12px] font-semibold">Loading history…</div>
                      ) : history[c.id].length === 0 ? (
                        <div className="text-sub text-[12px] font-semibold">Signed in, hasn't ordered yet.</div>
                      ) : (
                        <div className="space-y-2.5">
                          {history[c.id].map((o) => (
                            <div key={o.id} className="bg-card border-[1.5px] border-line rounded-xl px-4 py-3">
                              <div className="flex items-center gap-3 flex-wrap">
                                <span className="font-display font-extrabold text-[14px]">{o.num}</span>
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                                    o.done ? 'bg-greenfill text-greendark' : 'bg-bluesoft text-blue'
                                  }`}
                                >
                                  {o.status}
                                </span>
                                <span className="text-[11.5px] text-sub font-semibold flex-1">
                                  {new Date(o.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} ·{' '}
                                  {fmtTime(o.createdAt)} · {{ dinein: 'Dine-in', pickup: 'Pickup', delivery: 'Delivery' }[o.type]} ·{' '}
                                  {o.payMethod === 'online' ? 'Paid online' : 'Cash'}
                                </span>
                                <span className="font-display font-extrabold text-[14px]">{fmtMoney(o.total)}</span>
                              </div>
                              <div className="text-[12px] font-semibold text-sub mt-1">
                                {o.lines.map((l) => `${l.qty} × ${l.name}`).join(' · ')}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
