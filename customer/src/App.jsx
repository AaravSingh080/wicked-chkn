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

export default function App() {
  const { booted, screen } = useStore();
  if (!booted) return <Splash />;
  const Screen = SCREENS[screen] || Home;

  return (
    <div className="min-h-dvh bg-bg">
      {/* keyed wrapper re-runs the enter animation on every screen switch */}
      <div key={screen} className="screen-in">
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
