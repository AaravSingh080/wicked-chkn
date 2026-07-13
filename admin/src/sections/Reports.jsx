import React, { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { useAdmin } from '../store.jsx';
import { api, fmtMoney } from '../api.js';
import { Card } from './Overview.jsx';

const RANGES = [
  { key: 'day', label: 'Day' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: '6m', label: '6 months' },
  { key: '12m', label: '12 months' }
];

export default function Reports() {
  const { bump } = useAdmin();
  const [range, setRange] = useState('week');
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get('/admin/reports?range=' + range).then(setData).catch(() => {});
  }, [range, bump]);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        {RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => setRange(r.key)}
            className={`rounded-full px-4 py-2 text-[12.5px] font-extrabold ${
              range === r.key ? 'bg-navy text-white' : 'bg-card border-[1.5px] border-line text-sub'
            }`}
          >
            {r.label}
          </button>
        ))}
        <span className="flex-1" />
        <span className="text-[12.5px] font-bold text-sub">{data?.periodLabel}</span>
      </div>

      {data && (
        <>
          <div className="grid grid-cols-4 gap-4">
            <Kpi label="Total sales" value={fmtMoney(data.kpis.sales.value)} delta={data.kpis.sales.delta} />
            <Kpi label="Orders" value={data.kpis.orders.value} delta={data.kpis.orders.delta} />
            <Kpi label="Avg order value" value={fmtMoney(data.kpis.aov.value)} delta={data.kpis.aov.delta} />
            <Kpi label="Daily average" value={fmtMoney(data.kpis.daily.value)} delta={data.kpis.daily.delta} />
          </div>

          <Card title="Revenue">
            <Bars bars={data.bars} />
          </Card>

          <MenuEngineering />

          <div className="rounded-xl bg-bluesoft border-[1.5px] border-blue/40 px-4 py-3 text-[12px] font-semibold text-sub leading-relaxed">
            <strong className="text-ink">Data storage:</strong> every order is a PostgreSQL row; nightly jobs roll orders
            up into daily/weekly/monthly summary tables with automated daily DB backups. These charts read{' '}
            <code className="text-blue">GET /reports?range=…</code> — the demo ships a seeded 365-day history.
          </div>
        </>
      )}
    </div>
  );
}

// consultant-grade menu analysis: popularity × ticket-size quadrants + AI actions
const QUADS = [
  ['stars', 'Stars', 'Popular + high ticket — promote hard', '#1FA45C', '#E7F5EC'],
  ['workhorses', 'Workhorses', 'Popular, low ticket — nudge price / bundle', '#D92B21', '#FCE7E4'],
  ['puzzles', 'Puzzles', 'High ticket, slow — market or rework', '#B3761A', '#FFF9F0'],
  ['duds', 'Duds', 'Slow + low ticket — candidates to cut', '#8A93A6', '#FBF3F1']
];

function MenuEngineering() {
  const [d, setD] = useState(null);
  useEffect(() => {
    api.get('/admin/menu-engineering').then(setD).catch(() => {});
  }, []);
  if (!d) return null;
  return (
    <Card
      title="Menu engineering"
      right={
        <span className="text-[11px] font-bold text-sub">
          {d.sample ? 'sample data until 25+ orders · ' : ''}ticket size as margin proxy
        </span>
      }
    >
      <div className="grid grid-cols-2 gap-3 mt-4">
        {QUADS.map(([key, title, sub, color, bg]) => (
          <div key={key} className="rounded-xl p-3.5" style={{ background: bg, border: `1.5px solid ${color}33` }}>
            <div className="text-[13px] font-extrabold" style={{ color }}>
              {title}
            </div>
            <div className="text-[10.5px] font-semibold text-sub mb-2">{sub}</div>
            {d.quadrants[key].length === 0 && <div className="text-[12px] text-sub font-semibold">—</div>}
            {d.quadrants[key].slice(0, 4).map((it) => (
              <div key={it.name} className="flex justify-between text-[12.5px] font-bold py-0.5">
                <span className="truncate pr-2">{it.name}</span>
                <span className="text-sub shrink-0">
                  {it.units} · ₹{it.price}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-xl bg-navy text-white px-4 py-3.5 flex gap-3 items-start">
        <span className="w-7 h-7 rounded-lg bg-blue flex items-center justify-center shrink-0 text-[11px] font-display font-extrabold">AI</span>
        <span className="text-[13px] font-semibold leading-relaxed">{d.advice}</span>
      </div>
    </Card>
  );
}

function Kpi({ label, value, delta }) {
  return (
    <div className="bg-card border-[1.5px] border-line rounded-2xl p-4">
      <div className="text-[11.5px] font-bold text-sub uppercase tracking-wide">{label}</div>
      <div className="font-display font-extrabold text-[24px] mt-1">{value}</div>
      {delta == null ? (
        <div className="text-[11px] font-semibold text-sub mt-0.5">no prior-period data</div>
      ) : (
        <div className={`text-[11.5px] font-extrabold mt-0.5 flex items-center gap-1 ${delta >= 0 ? 'text-greendark' : 'text-red'}`}>
          {delta >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
          {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}% vs previous period
        </div>
      )}
    </div>
  );
}

function Bars({ bars }) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  const tallest = bars.findIndex((b) => b.value === max && max > 0);
  return (
    <div className="flex items-end gap-2 h-52 mt-4">
      {bars.map((b, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0 group relative">
          <span className="text-[9.5px] font-bold text-sub opacity-0 group-hover:opacity-100 absolute -top-4 whitespace-nowrap bg-navy text-white rounded px-1.5 py-0.5 z-10">
            {fmtMoney(b.value)}
          </span>
          <div
            className="w-full rounded-t-md"
            style={{
              height: `${Math.max(2, (b.value / max) * 100)}%`,
              background: i === tallest && b.value > 0 ? '#D92B21' : '#F0B8B0'
            }}
          />
          <span className="text-[9.5px] font-bold text-sub whitespace-nowrap">{b.label}</span>
        </div>
      ))}
    </div>
  );
}
