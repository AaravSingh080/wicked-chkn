import React, { useEffect, useState } from 'react';
import { ShieldCheck, Gauge } from 'lucide-react';
import { useAdmin } from '../store.jsx';
import { api, fmtTime } from '../api.js';
import { Card } from './Overview.jsx';

function PinChanger() {
  const [pin, setPin] = useState('');
  const [msg, setMsg] = useState('');
  return (
    <div className="mt-3 flex items-center gap-2.5">
      <input
        type="password"
        inputMode="numeric"
        className="w-[130px] bg-page border-[1.5px] border-line rounded-xl px-3 h-11 text-[14px] font-extrabold outline-none tracking-widest"
        placeholder="New PIN"
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
      />
      <button
        className="rounded-xl bg-blue text-white text-[13px] font-extrabold px-4 h-11 disabled:opacity-50"
        disabled={pin.length < 4}
        onClick={async () => {
          await api.put('/admin/settings', { pin });
          setPin('');
          setMsg('PIN updated — applies from the next sign-in.');
          setTimeout(() => setMsg(''), 4000);
        }}
      >
        Update PIN
      </button>
      <span className="text-[11.5px] font-semibold text-sub flex-1">{msg || '4–8 digits. Staff enter it to open this dashboard.'}</span>
    </div>
  );
}

// simulated Friday-night traffic — makes the dashboard look alive during pitches
function RushControl() {
  const [running, setRunning] = useState(false);
  useEffect(() => {
    api.get('/admin/demo-rush').then((r) => setRunning(r.running)).catch(() => {});
  }, []);
  return (
    <div className="mt-3 flex items-center gap-2.5">
      <button
        className={`rounded-xl text-[13px] font-extrabold px-4 h-11 ${
          running ? 'bg-redfill border-[1.5px] border-red text-red' : 'bg-blue text-white'
        }`}
        onClick={async () => {
          const r = await api.post('/admin/demo-rush', { on: !running });
          setRunning(r.running);
        }}
      >
        {running ? 'Stop rush' : 'Start Friday rush'}
      </button>
      <span className="text-[11.5px] font-semibold text-sub flex-1">
        {running
          ? 'Simulated orders are streaming in — watch Live orders. Auto-stops in 5 min.'
          : 'Streams realistic orders every few seconds for 5 minutes — perfect while presenting.'}
      </span>
    </div>
  );
}

function ResetDemo() {
  const [arm, setArm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  return (
    <div className="mt-3 flex items-center gap-2.5">
      {done ? (
        <span className="text-greendark text-[13px] font-extrabold">Demo reset ✓ — clean slate, history kept.</span>
      ) : !arm ? (
        <button className="rounded-xl border-[1.5px] border-red text-red bg-redfill text-[13px] font-extrabold px-4 h-11" onClick={() => setArm(true)}>
          Reset demo data
        </button>
      ) : (
        <>
          <span className="text-[12.5px] font-bold">Wipe all orders, customers &amp; chats?</span>
          <button
            className="rounded-xl bg-red text-white text-[13px] font-extrabold px-4 h-11 disabled:opacity-60"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api.post('/admin/reset');
                setArm(false);
                setDone(true);
                setTimeout(() => setDone(false), 4000);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? 'Wiping…' : 'Yes, wipe it'}
          </button>
          <button className="rounded-xl border-[1.5px] border-line text-sub text-[13px] font-extrabold px-4 h-11" onClick={() => setArm(false)}>
            Cancel
          </button>
        </>
      )}
      <span className="text-[11.5px] font-semibold text-sub flex-1">Menu, prices and the 365-day sales history stay.</span>
    </div>
  );
}

function QrGrid() {
  const [count, setCount] = useState(8);
  // dev: customer app runs on :5273; production: same origin serves it at /
  const appBase = window.location.port === '5274' ? `http://${window.location.hostname}:5273` : window.location.origin;
  return (
    <div className="mt-3">
      <div className="flex items-center gap-3 mb-4">
        <label className="text-[12.5px] font-bold text-sub">Tables:</label>
        <input
          type="number"
          min="1"
          max="40"
          className="w-[70px] bg-page border-[1.5px] border-line rounded-lg px-2 h-9 text-[13px] font-bold outline-none"
          value={count}
          onChange={(e) => setCount(Math.max(1, Math.min(40, Number(e.target.value) || 1)))}
        />
        <span className="text-[11.5px] font-semibold text-sub">
          Each code opens the app with that table pre-selected. Print and stick on tables (production: codes point at the live domain).
        </span>
      </div>
      <div className="grid grid-cols-4 gap-3">
        {Array.from({ length: count }).map((_, i) => {
          const n = i + 1;
          const url = `${appBase}/?table=${n}`;
          return (
            <div key={n} className="bg-page border-[1.5px] border-line rounded-xl p-3 text-center">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=${encodeURIComponent(url)}`}
                alt={`Table ${n} QR`}
                width={110}
                height={110}
                className="mx-auto rounded"
                loading="lazy"
              />
              <div className="font-display font-extrabold text-[13px] mt-2">TABLE {n}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Settings() {
  const { bump } = useAdmin();
  const [s, setS] = useState(null);
  const [smsLog, setSmsLog] = useState([]);
  const [saved, setSaved] = useState('');

  useEffect(() => {
    api.get('/admin/settings').then(setS).catch(() => {});
  }, []);
  useEffect(() => {
    api.get('/admin/sms').then(setSmsLog).catch(() => {});
  }, [bump]);

  if (!s) return <div className="text-sub text-[13px] font-semibold">Loading…</div>;

  const save = async (patch, message = 'Saved — live in the app') => {
    await api.put('/admin/settings', patch);
    setSaved(message);
    setTimeout(() => setSaved(''), 3000);
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        {/* ordering assistant */}
        <Card title="Ordering assistant">
          <div className="space-y-3 mt-3">
            <div>
              <label className="text-[11.5px] font-extrabold text-sub uppercase tracking-wide">Provider</label>
              <select
                className="w-full mt-1 bg-page border-[1.5px] border-line rounded-xl px-3 h-11 text-[13px] font-bold outline-none"
                value={s.provider}
                onChange={(e) => setS({ ...s, provider: e.target.value })}
              >
                <option value="openai">OpenAI GPT-4o-mini {s.providerAvailable.openai ? '· key found' : '· no key'}</option>
                <option value="anthropic">Anthropic Claude Haiku {s.providerAvailable.anthropic ? '· key found' : '· no key'}</option>
              </select>
            </div>
            <div>
              <label className="text-[11.5px] font-extrabold text-sub uppercase tracking-wide">API key</label>
              <input
                className="w-full mt-1 bg-page border-[1.5px] border-line rounded-xl px-3 h-11 text-[13px] font-bold outline-none"
                type="password"
                value={s.keyMasked || ''}
                placeholder="Set via server env (.env) — never stored in the browser"
                readOnly
              />
              <div className="text-[10.5px] text-sub font-semibold mt-1">
                Keys live in server env vars only ({s.keyMasked ? `active: ${s.keyMasked}` : 'none set — assistant runs in demo mode'}).
              </div>
            </div>
            <div>
              <label className="text-[11.5px] font-extrabold text-sub uppercase tracking-wide">Training notes</label>
              <textarea
                className="w-full mt-1 bg-page border-[1.5px] border-line rounded-xl p-3 text-[13px] font-semibold outline-none min-h-[100px] resize-y"
                value={s.training}
                onChange={(e) => setS({ ...s, training: e.target.value })}
                placeholder='e.g. "Always mention the Double Mutton…"'
              />
              <div className="text-[10.5px] text-sub font-semibold mt-1">
                Injected live into the app assistant's system prompt.
              </div>
            </div>
            <button
              className="rounded-xl bg-blue text-white text-[13px] font-extrabold px-5 py-2.5"
              onClick={() => save({ provider: s.provider, training: s.training })}
            >
              Save
            </button>
            {saved && <span className="text-greendark text-[12.5px] font-extrabold ml-3">{saved}</span>}
          </div>
        </Card>

        {/* twilio */}
        <Card title="Twilio SMS">
          <div className="space-y-3 mt-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[13px] font-extrabold">Send real SMS</div>
                <div className="text-[11px] text-sub font-semibold">
                  {s.twilio.envConfigured ? 'Env credentials found — sends go through Twilio.' : 'No env credentials — sends are simulated but logged.'}
                </div>
              </div>
              <button
                onClick={() => {
                  const next = { ...s.twilio, enabled: !s.twilio.enabled };
                  setS({ ...s, twilio: next });
                  save({ twilio: next }, next.enabled ? 'SMS enabled' : 'SMS disabled');
                }}
                className="relative rounded-full transition-colors duration-200"
                style={{ width: 44, height: 25, background: s.twilio.enabled ? '#1FA45C' : '#F0D9D5' }}
              >
                <span
                  className="absolute top-[3px] rounded-full bg-white shadow transition-all duration-200"
                  style={{ width: 19, height: 19, left: s.twilio.enabled ? 22 : 3 }}
                />
              </button>
            </div>
            <input
              className="w-full bg-page border-[1.5px] border-line rounded-xl px-3 h-11 text-[13px] font-bold outline-none placeholder:text-sub"
              placeholder="Account SID (AC…)"
              value={s.twilio.sid}
              onChange={(e) => setS({ ...s, twilio: { ...s.twilio, sid: e.target.value } })}
            />
            <input
              className="w-full bg-page border-[1.5px] border-line rounded-xl px-3 h-11 text-[13px] font-bold outline-none placeholder:text-sub"
              placeholder="From number (+1…)"
              value={s.twilio.from}
              onChange={(e) => setS({ ...s, twilio: { ...s.twilio, from: e.target.value } })}
            />
            <button
              className="rounded-xl bg-blue text-white text-[13px] font-extrabold px-5 py-2.5"
              onClick={() => save({ twilio: s.twilio })}
            >
              Save
            </button>
            <div className="text-[10.5px] text-sub font-semibold">
              SMS fire on: order placed, accepted, every status change, SMS campaigns. Auth token stays server-side.
            </div>

            <div className="border-t border-line pt-3">
              <div className="text-[11.5px] font-extrabold text-sub uppercase tracking-wide mb-2">Recent SMS</div>
              <div className="space-y-1.5 max-h-[130px] overflow-y-auto pr-1">
                {smsLog.length === 0 && <div className="text-sub text-[12px] font-semibold">Nothing sent yet.</div>}
                {smsLog.map((m, i) => (
                  <div key={i} className="text-[11.5px] font-semibold flex gap-2">
                    <span className="text-sub shrink-0">{fmtTime(m.ts)}</span>
                    <span className="shrink-0">→ {m.to}</span>
                    <span className="flex-1 truncate text-sub">{m.body}</span>
                    <span className={`shrink-0 font-extrabold ${m.status === 'failed' ? 'text-red' : 'text-greendark'}`}>
                      {m.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* access + demo controls */}
      <div className="grid grid-cols-2 gap-4">
        <Card title="Dashboard PIN">
          <PinChanger />
        </Card>
        <Card title="Demo controls">
          <RushControl />
          <ResetDemo />
        </Card>
      </div>

      {/* table QR codes */}
      <Card title="Table QR codes" right={<span className="text-[11.5px] font-bold text-sub">scan → dine-in with table prefilled</span>}>
        <QrGrid />
      </Card>

      <div className="grid grid-cols-2 gap-4">
        {/* security checklist */}
        <Card title="Security checklist">
          <ul className="mt-3 space-y-2.5">
            {[
              'Razorpay signature verified server-side before any order is confirmed',
              'Card data never touches our servers — hosted checkout only',
              'Phone-OTP auth, no passwords to leak',
              'Secrets live in server env vars, never in the client bundle',
              'Input validation + rate limiting on orders and OTP, HTTPS everywhere'
            ].map((t) => (
              <li key={t} className="flex items-start gap-2.5 text-[12.5px] font-semibold">
                <ShieldCheck size={15} className="text-greendark shrink-0 mt-0.5" />
                {t}
              </li>
            ))}
          </ul>
        </Card>

        {/* performance targets */}
        <Card title="Performance targets">
          <ul className="mt-3 space-y-2.5">
            {[
              'Menu served from cache — PWA works offline',
              'API p95 under 100ms',
              'Images on a CDN, lazy-loaded',
              'App ↔ admin sync latency ≤ 2 seconds (SSE)'
            ].map((t) => (
              <li key={t} className="flex items-start gap-2.5 text-[12.5px] font-semibold">
                <Gauge size={15} className="text-blue shrink-0 mt-0.5" />
                {t}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
