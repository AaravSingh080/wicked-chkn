import React, { useEffect, useState } from 'react';
import { Info } from 'lucide-react';
import { useAdmin } from '../store.jsx';
import { api, fmtTime, fmtMoney } from '../api.js';

export default function Overview() {
  const { activity, bump } = useAdmin();
  const [data, setData] = useState(null);
  const [brief, setBrief] = useState('');

  useEffect(() => {
    api.get('/admin/overview').then(setData).catch(() => {});
  }, [bump]);
  useEffect(() => {
    api.get('/admin/brief').then((r) => setBrief(r.brief)).catch(() => {});
  }, []);

  if (!data) return <div className="text-sub text-[13px] font-semibold">Loading…</div>;

  const maxBar = Math.max(1, ...data.salesByHour.map((b) => b.value));
  const tallest = data.salesByHour.findIndex((b) => b.value === maxBar && maxBar > 0);
  const maxTop = Math.max(1, ...data.topItems.map((t) => t.qty));

  return (
    <div className="space-y-5">
      {/* AI daily brief */}
      {brief && (
        <div className="rounded-2xl bg-navy text-white px-5 py-4 flex items-start gap-3">
          <span className="w-8 h-8 rounded-lg bg-blue flex items-center justify-center shrink-0 text-[13px] font-display font-extrabold">AI</span>
          <div>
            <div className="text-[11px] font-extrabold tracking-[1.2px] text-navytext">TODAY'S BRIEF</div>
            <div className="text-[13.5px] font-semibold mt-1 leading-relaxed">{brief}</div>
          </div>
        </div>
      )}

      {/* notice */}
      <div className="rounded-xl bg-bluesoft border-[1.5px] border-blue/40 px-4 py-3 flex items-center gap-2.5 text-[12.5px] font-semibold text-ink">
        <Info size={15} className="text-blue shrink-0" />
        App orders only — this overview counts orders placed through the Wicked Chkn app. Walk-in / POS sales are not included.
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-4 gap-4">
        <Kpi label="App revenue today" value={fmtMoney(data.revenueToday)} />
        <Kpi label="App orders" value={data.ordersToday} sub={`${data.inProgress} in progress`} />
        <Kpi label="Avg order value" value={fmtMoney(data.aov)} sub={`target ${fmtMoney(data.aovTarget)}`} />
        <Kpi label="Commission saved" value={fmtMoney(data.commissionSaved)} sub="vs 25% aggregator cut" green />
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* sales by hour */}
        <Card title="Sales by hour">
          <div className="flex items-end gap-2 h-40 mt-3">
            {data.salesByHour.map((b, i) => (
              <div key={b.label} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                {b.value > 0 && <span className="text-[9.5px] font-bold text-sub">₹{b.value >= 1000 ? (b.value / 1000).toFixed(1) + 'k' : b.value}</span>}
                <div
                  className="w-full rounded-t-md"
                  style={{
                    height: `${Math.max(3, (b.value / maxBar) * 100)}%`,
                    background: i === tallest && b.value > 0 ? '#D92B21' : '#F0B8B0'
                  }}
                />
                <span className="text-[9.5px] font-bold text-sub">{b.label}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* top items */}
        <Card title="Top items today">
          {data.topItems.length === 0 ? (
            <div className="text-sub text-[12.5px] font-semibold mt-3">No orders yet today.</div>
          ) : (
            <div className="space-y-3 mt-3">
              {data.topItems.map((t) => (
                <div key={t.name}>
                  <div className="flex justify-between text-[12.5px] font-bold">
                    <span className="truncate">{t.name}</span>
                    <span className="text-sub shrink-0">
                      {t.qty} · {fmtMoney(t.revenue)}
                    </span>
                  </div>
                  <div className="h-[7px] rounded-full bg-soft mt-1">
                    <div className="h-full rounded-full bg-blue" style={{ width: `${(t.qty / maxTop) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* direct channel savings */}
        <div className="rounded-2xl bg-navy text-white p-5">
          <div className="text-[12px] font-bold text-navytext uppercase tracking-wide">Direct channel savings</div>
          <div className="font-display font-extrabold text-[34px] mt-1" style={{ color: '#FF8A7A' }}>
            {fmtMoney(data.commissionSaved)}
          </div>
          <p className="text-[12.5px] text-navytext mt-2 leading-relaxed">
            Every app order skips the ~25% aggregator commission. That margin stays in the kitchen — better meat, better
            buns, better business.
          </p>
        </div>

        {/* live activity feed */}
        <Card title="Live activity">
          <div className="mt-3 space-y-2.5 max-h-[180px] overflow-y-auto pr-1">
            {activity.map((a, i) => (
              <div key={i} className="flex items-start gap-2.5 text-[12.5px]">
                <span className="w-[7px] h-[7px] rounded-full bg-blue mt-1.5 shrink-0" />
                <span className="flex-1 font-semibold">{a.text}</span>
                <span className="text-sub text-[11px] font-semibold shrink-0">{fmtTime(a.ts)}</span>
              </div>
            ))}
            {activity.length === 0 && <div className="text-sub text-[12.5px] font-semibold">Quiet so far…</div>}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Kpi({ label, value, sub, green }) {
  return (
    <div className="bg-card border-[1.5px] border-line rounded-2xl p-4">
      <div className="text-[11.5px] font-bold text-sub uppercase tracking-wide">{label}</div>
      <div className={`font-display font-extrabold text-[26px] mt-1 ${green ? 'text-greendark' : ''}`}>{value}</div>
      {sub && <div className="text-[11.5px] font-semibold text-sub mt-0.5">{sub}</div>}
    </div>
  );
}

export function Card({ title, children, right }) {
  return (
    <div className="bg-card border-[1.5px] border-line rounded-2xl p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-[14px] font-extrabold">{title}</h2>
        {right}
      </div>
      {children}
    </div>
  );
}
