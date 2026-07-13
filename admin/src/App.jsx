import React, { useState } from 'react';
import {
  LayoutDashboard, ShoppingBag, BarChart3, Package, Megaphone, Users, MessageCircle, Settings as SettingsIcon,
  LifeBuoy, ChefHat
} from 'lucide-react';
import Tickets from './sections/Tickets.jsx';
import Kds from './sections/Kds.jsx';
import { useAdmin } from './store.jsx';
import Overview from './sections/Overview.jsx';
import LiveOrders from './sections/LiveOrders.jsx';
import Reports from './sections/Reports.jsx';
import Inventory from './sections/Inventory.jsx';
import Marketing from './sections/Marketing.jsx';
import Crm from './sections/Crm.jsx';
import SupportAI from './sections/SupportAI.jsx';
import Settings from './sections/Settings.jsx';

function PinLock() {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (pin.length < 4 || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Wrong PIN');
      localStorage.setItem('sb_admin_token', data.token);
      window.location.reload();
    } catch (e) {
      setError(e.message);
      setPin('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-navy flex flex-col items-center justify-center gap-5">
      <span className="w-16 h-16 rounded-2xl bg-blue text-white font-display font-extrabold text-[24px] flex items-center justify-center">
        WC
      </span>
      <div className="text-white font-display font-extrabold text-[20px]">Staff sign-in</div>
      <input
        type="password"
        inputMode="numeric"
        autoFocus
        className="w-[190px] bg-white/10 text-white rounded-xl h-14 text-center font-extrabold outline-none border-[1.5px] border-white/20"
        style={{ fontSize: 24, letterSpacing: 10 }}
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        placeholder="PIN"
      />
      {error && <div className="text-red text-[13px] font-bold">{error}</div>}
      <button
        className="w-[190px] rounded-xl bg-blue text-white font-extrabold text-[14px] h-11 disabled:opacity-50"
        onClick={submit}
        disabled={pin.length < 4 || busy}
      >
        {busy ? 'Checking…' : 'Unlock dashboard'}
      </button>
      <div className="text-navytext text-[11.5px] font-semibold">Default PIN 1234 — change it in Settings.</div>
    </div>
  );
}

const SECTIONS = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard, comp: Overview },
  { key: 'orders', label: 'Live orders', icon: ShoppingBag, comp: LiveOrders },
  { key: 'reports', label: 'Reports', icon: BarChart3, comp: Reports },
  { key: 'inventory', label: 'Inventory', icon: Package, comp: Inventory },
  { key: 'marketing', label: 'AI Marketing', icon: Megaphone, comp: Marketing },
  { key: 'crm', label: 'CRM & Integrations', icon: Users, comp: Crm },
  { key: 'tickets', label: 'Support inbox', icon: LifeBuoy, comp: Tickets },
  { key: 'support', label: 'Support AI', icon: MessageCircle, comp: SupportAI },
  { key: 'settings', label: 'Settings', icon: SettingsIcon, comp: Settings }
];

export default function App() {
  const { liveCount, storePaused, toggleStore } = useAdmin();
  const [active, setActive] = useState('overview');
  const [kitchen, setKitchen] = useState(false);
  const section = SECTIONS.find((s) => s.key === active);
  const Comp = section.comp;

  if (!localStorage.getItem('sb_admin_token')) return <PinLock />;
  if (kitchen) return <Kds onExit={() => setKitchen(false)} />;

  return (
    <div className="flex min-h-screen">
      {/* sidebar */}
      <aside className="w-[232px] shrink-0 bg-navy text-navytext flex flex-col fixed inset-y-0 left-0 z-20">
        <div className="flex items-center gap-3 px-5 py-6">
          <span className="w-10 h-10 rounded-xl bg-blue text-white font-display font-extrabold text-[15px] flex items-center justify-center shrink-0">
            WC
          </span>
          <div>
            <div className="text-white font-display font-extrabold text-[15px] leading-tight">WICKED CHKN</div>
            <div className="text-[10px] font-bold tracking-[1px]">ADMIN · LUDHIANA</div>
          </div>
        </div>
        <nav className="flex-1 px-3 space-y-1">
          {SECTIONS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActive(key)}
              className={`w-full flex items-center gap-3 rounded-[11px] px-3.5 py-2.5 text-[13px] font-bold text-left ${
                active === key ? 'bg-blue text-white' : 'hover:bg-white/5'
              }`}
            >
              <Icon size={17} strokeWidth={2.1} />
              <span className="flex-1">{label}</span>
              {key === 'orders' && liveCount > 0 && (
                <span className="min-w-[19px] h-[19px] px-1 rounded-full bg-red text-white text-[11px] font-extrabold flex items-center justify-center">
                  {liveCount}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="px-5 py-4 text-[10.5px] leading-relaxed opacity-70">
          One live backend — changes here hit the customer app in under 2 seconds.
        </div>
      </aside>

      {/* main */}
      <div className="flex-1 ml-[232px]">
        {/* topbar */}
        <header className="sticky top-0 z-10 bg-page/90 backdrop-blur border-b border-line px-8 py-4 flex items-center gap-4">
          <h1 className="font-display font-extrabold text-[21px] flex-1">{section.label}</h1>
          <span className="flex items-center gap-1.5 rounded-full bg-greenfill text-greendark px-3 py-1.5 text-[11px] font-extrabold">
            <span className="w-[7px] h-[7px] rounded-full bg-green blink" /> LIVE · synced with app
          </span>
          <button
            className="flex items-center gap-2 rounded-xl bg-navy text-white px-3.5 py-2 text-[12.5px] font-extrabold"
            onClick={() => setKitchen(true)}
            title="Fullscreen ticket board for the kitchen tablet"
          >
            <ChefHat size={15} /> Kitchen mode
          </button>
          <button
            className={`flex items-center gap-2 rounded-xl border-[1.5px] px-3.5 py-2 text-[12.5px] font-extrabold ${
              storePaused ? 'border-red text-red bg-redfill' : 'border-green text-greendark bg-greenfill'
            }`}
            onClick={toggleStore}
            title={storePaused ? 'Resume ordering' : 'Pause ordering'}
          >
            <span className={`w-2 h-2 rounded-full ${storePaused ? 'bg-red' : 'bg-green blink'}`} />
            {storePaused ? 'Paused' : 'Accepting orders'}
          </button>
        </header>

        <main className="px-8 py-6 max-w-[1080px]">
          <Comp />
        </main>
      </div>
    </div>
  );
}
