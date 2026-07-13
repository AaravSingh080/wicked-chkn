import React from 'react';
import { Home, Sandwich, MessageCircle, User } from 'lucide-react';
import { useStore } from '../store.jsx';

const TABS = [
  { key: 'home', label: 'Home', icon: Home },
  { key: 'menu', label: 'Menu', icon: Sandwich },
  { key: 'chat', label: 'Chat', icon: MessageCircle },
  { key: 'profile', label: 'Profile', icon: User }
];

// floating sticker dock — hard shadow, 2px ink border, active tab is a red plate
export default function TabBar() {
  const { screen, setScreen, t } = useStore();
  // Menu tab stays active on cart/checkout screens
  const activeKey = ['cart', 'checkout'].includes(screen) ? 'menu' : screen === 'tracking' ? 'home' : screen;

  return (
    <nav
      className="fixed bottom-3 inset-x-5 max-w-[380px] mx-auto h-[60px] rounded-lg border-2 flex items-center px-1.5 gap-1 z-30"
      style={{ background: 'var(--card)', borderColor: 'var(--tileBorder)', boxShadow: '4px 4px 0 var(--shadowInk)' }}
    >
      {TABS.map(({ key, label, icon: Icon }) => {
        const active = activeKey === key;
        return (
          <button
            key={key}
            onClick={() => setScreen(key)}
            className={`flex-1 h-[46px] rounded-md flex flex-col items-center justify-center gap-[2px] transition-colors duration-150 ${
              active ? 'bg-blue text-white' : 'text-tabinactive'
            }`}
          >
            <Icon size={19} strokeWidth={2.3} />
            <span className="text-[9.5px] font-extrabold uppercase tracking-[0.5px]">{t(key, label)}</span>
          </button>
        );
      })}
    </nav>
  );
}
