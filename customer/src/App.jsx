import React from 'react';
import { ShoppingCart } from 'lucide-react';
import { useStore } from './store.jsx';
import Splash from './screens/Splash.jsx';
import Home from './screens/Home.jsx';
import MenuScreen from './screens/MenuScreen.jsx';
import CartScreen from './screens/CartScreen.jsx';
import Checkout from './screens/Checkout.jsx';
import Tracking from './screens/Tracking.jsx';
import Chat from './screens/Chat.jsx';
import Profile from './screens/Profile.jsx';
import ItemSheet from './screens/ItemSheet.jsx';
import LoginSheet from './screens/LoginSheet.jsx';
import PaySheet from './screens/PaySheet.jsx';
import TabBar from './components/TabBar.jsx';
import { NotifBanners, Toast } from './components/Overlays.jsx';

const SCREENS = {
  home: Home,
  menu: MenuScreen,
  cart: CartScreen,
  checkout: Checkout,
  tracking: Tracking,
  chat: Chat,
  profile: Profile
};

// iOS-style rubber band: pulling past either end of the page stretches it a little,
// then it springs back. Wheel + touch, skipped for reduced-motion users.
function useOverscrollStretch(ref, enabled) {
  React.useEffect(() => {
    if (!enabled || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let pull = 0;
    let snapTimer = null;
    let touchY = null;

    // resolve the node at event time — the keyed wrapper remounts on every screen switch
    const el = () => ref.current;
    const doc = () => document.scrollingElement || document.documentElement;
    const atTop = () => doc().scrollTop <= 0;
    const atBottom = () => doc().scrollTop + window.innerHeight >= doc().scrollHeight - 1;
    // screens with fixed controls inside the wrapper (checkout CTA) opt out —
    // a transformed ancestor would briefly re-anchor them mid-pull
    const blocked = () => !!document.querySelector('[data-no-stretch]');

    const apply = () => {
      const n = el();
      if (!n) return;
      n.classList.remove('stretch-snap');
      n.style.transform = pull ? `translateY(${pull}px)` : '';
    };
    const release = () => {
      const n = el();
      if (!pull || !n) return;
      pull = 0;
      n.classList.add('stretch-snap');
      n.style.transform = '';
    };

    const onWheel = (e) => {
      if (blocked()) return;
      const top = atTop() && e.deltaY < 0;
      const bottom = atBottom() && e.deltaY > 0;
      if (!top && !bottom) return;
      const dir = top ? 1 : -1;
      pull = Math.max(-64, Math.min(64, pull + dir * Math.min(18, Math.abs(e.deltaY) * 0.25)));
      apply();
      clearTimeout(snapTimer);
      snapTimer = setTimeout(release, 130);
    };
    const onTouchStart = (e) => {
      touchY = e.touches[0].clientY;
    };
    const onTouchMove = (e) => {
      if (touchY == null || blocked()) return;
      const dy = e.touches[0].clientY - touchY;
      if ((atTop() && dy > 0) || (atBottom() && dy < 0)) {
        pull = Math.max(-70, Math.min(70, dy * 0.32));
        apply();
      }
    };
    const onTouchEnd = () => {
      touchY = null;
      release();
    };

    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      clearTimeout(snapTimer);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [ref, enabled]);
}

// global "View cart" bar — lives OUTSIDE the stretch wrapper so position:fixed
// always means the viewport, and follows the customer to every tab
function CartBar() {
  const { cartCount, total, screen, setScreen } = useStore();
  if (!cartCount || ['cart', 'checkout', 'tracking'].includes(screen)) return null;
  return (
    <button
      className="sheet-up fixed bottom-[84px] inset-x-5 max-w-[380px] mx-auto z-20 flex items-center gap-3 rounded-lg text-white p-3.5"
      style={{ background: 'var(--blue)', border: '2px solid var(--tileBorder)', boxShadow: '4px 4px 0 var(--shadowInk)' }}
      onClick={() => setScreen('cart')}
    >
      <ShoppingCart size={18} />
      <span className="flex-1 text-left text-[13.5px] font-bold">
        {cartCount} item{cartCount > 1 ? 's' : ''} · ₹{total}
      </span>
      <span className="text-[13.5px] font-extrabold">View cart →</span>
    </button>
  );
}

export default function App() {
  const { booted, screen } = useStore();
  const stretchRef = React.useRef(null);
  useOverscrollStretch(stretchRef, booted);
  if (!booted) return <Splash />;
  const Screen = SCREENS[screen] || Home;

  return (
    <div className="min-h-dvh bg-bg">
      {/* keyed wrapper re-runs the enter animation on every screen switch */}
      <div key={screen} ref={stretchRef} className="screen-in stretch-wrap">
        <Screen />
      </div>
      <CartBar />
      <TabBar />
      <ItemSheet />
      <LoginSheet />
      <PaySheet />
      <NotifBanners />
      <Toast />
    </div>
  );
}
