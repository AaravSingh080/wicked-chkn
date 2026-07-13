import React, { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useAdmin } from '../store.jsx';
import { api, fmtTime, fmtMoney } from '../api.js';
import { Card } from './Overview.jsx';

const AUTOMATIONS = [
  { key: 'whatsapp', label: 'WhatsApp campaigns', desc: 'Auto-sends offers and win-back nudges over WhatsApp Business.' },
  { key: 'offers', label: 'Smart offers', desc: 'AI picks discount timing based on slow hours and demand.' },
  { key: 'email', label: 'Email customers', desc: 'Weekly digest + occasion campaigns to opted-in emails.' },
  { key: 'cartRecovery', label: 'Abandoned cart recovery', desc: 'Nudges customers who built a cart but never checked out.' },
  { key: 'recommend', label: 'Dish recommendations', desc: 'Personalised "For you" picks inside the customer app.' }
];

export default function Marketing() {
  const { bump } = useAdmin();
  const [marketing, setMarketing] = useState(null);
  const [carts, setCarts] = useState([]);
  const [audience, setAudience] = useState('all');
  const [channel, setChannel] = useState('whatsapp');
  const [draft, setDraft] = useState('');
  const [genBusy, setGenBusy] = useState(false);
  const [sendBusy, setSendBusy] = useState(false);
  const [sentMsg, setSentMsg] = useState('');

  const refresh = () => {
    api.get('/admin/marketing').then(setMarketing).catch(() => {});
    api.get('/admin/carts').then(setCarts).catch(() => {});
  };
  useEffect(refresh, [bump]);

  const toggleAuto = async (key, on) => {
    const res = await api.put('/admin/marketing/auto', { key, on });
    setMarketing((m) => ({ ...m, auto: res.auto }));
  };

  const generate = async () => {
    setGenBusy(true);
    try {
      const res = await api.post('/admin/campaigns/generate', { audience, channel });
      setDraft(res.draft);
    } finally {
      setGenBusy(false);
    }
  };

  const send = async () => {
    if (!draft.trim()) return;
    setSendBusy(true);
    try {
      const res = await api.post('/admin/campaigns/send', { text: draft, audience, channel });
      setSentMsg(`Queued — delivered to ${res.sent} customer${res.sent === 1 ? '' : 's'} as an app notification.`);
      setDraft('');
      setTimeout(() => setSentMsg(''), 5000);
      refresh();
    } finally {
      setSendBusy(false);
    }
  };

  const nudge = async (sessionId) => {
    await api.post(`/admin/carts/${sessionId}/nudge`);
    refresh();
  };

  if (!marketing) return <div className="text-sub text-[13px] font-semibold">Loading…</div>;

  return (
    <div className="space-y-5">
      {/* automation toggles */}
      <div className="grid grid-cols-5 gap-3">
        {AUTOMATIONS.map((a) => {
          const on = !!marketing.auto[a.key];
          return (
            <div key={a.key} className="bg-card border-[1.5px] border-line rounded-2xl p-4 flex flex-col">
              <div className="text-[12.5px] font-extrabold leading-tight">{a.label}</div>
              <div className="text-[11px] text-sub font-semibold mt-1 flex-1">{a.desc}</div>
              <button
                onClick={() => toggleAuto(a.key, !on)}
                className="relative rounded-full transition-colors duration-200 mt-3"
                style={{ width: 44, height: 25, background: on ? '#1FA45C' : '#F0D9D5' }}
                role="switch"
                aria-checked={on}
              >
                <span
                  className="absolute top-[3px] rounded-full bg-white shadow transition-all duration-200"
                  style={{ width: 19, height: 19, left: on ? 22 : 3 }}
                />
              </button>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* abandoned carts */}
        <Card title="Abandoned carts" right={<span className="text-[11.5px] font-bold text-sub">live from the app</span>}>
          {carts.length === 0 ? (
            <div className="text-sub text-[12.5px] font-semibold mt-3">
              No abandoned carts right now — build one in the app and pause at checkout.
            </div>
          ) : (
            <div className="space-y-2.5 mt-3">
              {carts.map((c) => (
                <div
                  key={c.sessionId}
                  className="rounded-xl px-4 py-3 flex items-center gap-3"
                  style={{ background: '#FFF9F0', border: '1.5px solid #F2D8A8' }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-extrabold">
                      {c.customerName} · {fmtMoney(c.total)}
                    </div>
                    <div className="text-[11.5px] text-sub font-semibold truncate">
                      {c.summary || 'cart'} · idle {c.idleMinutes} min
                    </div>
                  </div>
                  {c.nudged ? (
                    <span className="text-[11.5px] font-extrabold text-greendark shrink-0">Nudged ✓</span>
                  ) : (
                    <button
                      className="rounded-lg bg-blue text-white text-[11.5px] font-extrabold px-3 py-2 shrink-0"
                      onClick={() => nudge(c.sessionId)}
                    >
                      Send recovery nudge
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="text-[10.5px] text-sub font-semibold mt-3">
            Production: also WhatsApp/SMS after 30–60 min idle, automated while the toggle is on.
          </div>
        </Card>

        {/* campaign composer */}
        <Card title="Draft a campaign with AI">
          <div className="flex gap-2.5 mt-3">
            <select className={selectCls} value={audience} onChange={(e) => setAudience(e.target.value)}>
              <option value="all">All customers</option>
              <option value="lapsed">Lapsed 30+ days</option>
              <option value="big">Big spenders ₹1000+</option>
            </select>
            <select className={selectCls} value={channel} onChange={(e) => setChannel(e.target.value)}>
              <option value="whatsapp">WhatsApp</option>
              <option value="email">Email</option>
              <option value="sms">SMS</option>
            </select>
          </div>
          <button
            className="w-full mt-3 rounded-xl bg-blue text-white text-[13.5px] font-extrabold py-3 flex items-center justify-center gap-2 disabled:opacity-60"
            onClick={generate}
            disabled={genBusy}
          >
            <Sparkles size={15} /> {genBusy ? 'Drafting…' : 'Generate with AI'}
          </button>
          <textarea
            className="w-full mt-3 bg-page border-[1.5px] border-line rounded-xl p-3.5 text-[13px] font-semibold outline-none min-h-[110px] resize-y placeholder:text-sub"
            placeholder="Your campaign copy lands here — edit freely before queueing."
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button
            className="w-full mt-2 rounded-xl bg-navy text-white text-[13.5px] font-extrabold py-3 disabled:opacity-50"
            onClick={send}
            disabled={sendBusy || !draft.trim()}
          >
            {sendBusy ? 'Queueing…' : 'Queue send'}
          </button>
          {sentMsg && <div className="text-greendark text-[12px] font-bold mt-2">{sentMsg}</div>}
        </Card>
      </div>

      {/* stories */}
      <Card title="Post a story" right={<span className="text-[11.5px] font-bold text-sub">shows in the app for 24h</span>}>
        <StoryComposer />
      </Card>

      {/* automation log */}
      <Card title="Automation log">
        <div className="space-y-2.5 mt-3">
          {marketing.log.map((l, i) => (
            <div key={i} className="flex items-start gap-2.5 text-[12.5px]">
              <span className="w-[7px] h-[7px] rounded-full bg-blue mt-1.5 shrink-0" />
              <span className="flex-1 font-semibold">{l.text}</span>
              <span className="text-sub text-[11px] font-semibold shrink-0">{fmtTime(l.ts)}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

const STORY_THEMES = {
  fire: 'linear-gradient(135deg,#3A1B10,#E4573D)',
  ocean: 'linear-gradient(135deg,#4A0E0B,#D92B21)',
  candy: 'linear-gradient(135deg,#8B3E78,#E8A2D8)',
  forest: 'linear-gradient(135deg,#123B22,#37A662)'
};

function StoryComposer() {
  const [caption, setCaption] = useState('');
  const [theme, setTheme] = useState('fire');
  const [active, setActive] = useState([]);
  const [posted, setPosted] = useState('');

  const refresh = () => {
    api.get('/admin/stories').then(setActive).catch(() => {});
  };
  useEffect(refresh, []);

  const post = async () => {
    if (caption.trim().length < 3) return;
    await api.post('/admin/stories', { caption, theme });
    setCaption('');
    setPosted('Live in the app now — expires in 24h.');
    setTimeout(() => setPosted(''), 4000);
    refresh();
  };

  return (
    <div className="mt-3 space-y-3">
      <div className="flex gap-3">
        <input
          className="flex-1 bg-page border-[1.5px] border-line rounded-xl px-3.5 h-11 text-[13px] font-bold outline-none placeholder:text-sub"
          placeholder='e.g. "Double Mutton ₹100 off till 9 PM tonight"'
          value={caption}
          onChange={(e) => setCaption(e.target.value.slice(0, 120))}
        />
        {Object.entries(STORY_THEMES).map(([key, grad]) => (
          <button
            key={key}
            className="w-9 h-9 rounded-lg shrink-0"
            style={{ background: grad, outline: theme === key ? '2.5px solid #D92B21' : 'none', outlineOffset: 2 }}
            onClick={() => setTheme(key)}
            aria-label={key}
          />
        ))}
        <button className="rounded-xl bg-blue text-white text-[13px] font-extrabold px-5 disabled:opacity-50" disabled={caption.trim().length < 3} onClick={post}>
          Post
        </button>
      </div>
      {posted && <div className="text-greendark text-[12px] font-bold">{posted}</div>}
      {active.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {active.map((s) => (
            <span key={s.id} className="rounded-full text-white text-[11.5px] font-extrabold px-3 py-1.5" style={{ background: STORY_THEMES[s.theme] }}>
              {s.caption.slice(0, 40)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

const selectCls =
  'flex-1 bg-card border-[1.5px] border-line rounded-xl px-3 h-11 text-[13px] font-bold outline-none';
