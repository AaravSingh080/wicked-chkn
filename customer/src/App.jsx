import React from 'react';
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
      if (touchY == null) return;
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
      <TabBar />
      <ItemSheet />
      <LoginSheet />
      <PaySheet />
      <NotifBanners />
      <Toast />
    </div>
  );
}
