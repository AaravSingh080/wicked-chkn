import React, { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { api, subscribe } from './api.js';
import { makeT } from './i18n.js';
import { sfx } from './sound.js';

const Ctx = createContext(null);
export const useStore = () => useContext(Ctx);

const ls = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v == null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }
};

// haptic patterns from the spec
export const buzz = (pattern) => {
  try {
    navigator.vibrate?.(pattern);
  } catch {}
};
export const HAPTIC = {
  add: 14,
  remove: [10, 50, 10],
  placed: [14, 40, 14, 40, 30],
  status: [16, 60, 16],
  payFailed: [60, 40, 60],
  toggle: 10
};

function sessionId() {
  let id = localStorage.getItem('sb_session');
  if (!id) {
    id = 'sess_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem('sb_session', id);
  }
  return id;
}

export function StoreProvider({ children }) {
  const [booted, setBooted] = useState(false);
  const [config, setConfig] = useState(null);
  const [menu, setMenu] = useState([]);
  const [screen, setScreenRaw] = useState('home');
  const [sheetItem, setSheetItem] = useState(null); // item detail bottom sheet
  const [showLogin, setShowLogin] = useState(false);
  const [paySheet, setPaySheet] = useState(null); // {total, orderDraft, payment}

  const [prefs, setPrefs] = useState(() => ls.get('sb_prefs', { vegMode: false, theme: 'light', lang: 'en', sounds: true }));
  const [stories, setStories] = useState([]);
  const [voucher, setVoucher] = useState(null); // {code, amount} — validated gift code
  const [auth, setAuth] = useState(() => ls.get('sb_auth', null)); // {token, customer:{id,name,phone}}
  const [favourites, setFavourites] = useState(() => ls.get('sb_favs', []));
  const [cart, setCart] = useState(() => ls.get('sb_cart', {}));
  const [promo, setPromo] = useState(() => ls.get('sb_promo', ''));
  const [orderType, setOrderType] = useState(() => ls.get('sb_ordertype', 'pickup'));
  const [activeOrder, setActiveOrder] = useState(null);
  const [myOrders, setMyOrders] = useState([]);
  const [recs, setRecs] = useState([]);
  const [banners, setBanners] = useState([]); // in-app push notification banners
  const [toast, setToast] = useState(null);

  // chat sessions persist across app closes; newest first, capped at 20
  const [chats, setChats] = useState(() => ls.get('sb_chats', []));
  const [activeChatId, setActiveChatId] = useState(() => ls.get('sb_activechat', ''));

  const phone = auth?.customer?.phone || ls.get('sb_lastphone', '');

  // ---------- persistence ----------
  useEffect(() => ls.set('sb_prefs', prefs), [prefs]);
  useEffect(() => ls.set('sb_cart', cart), [cart]);
  useEffect(() => ls.set('sb_promo', promo), [promo]);
  useEffect(() => ls.set('sb_ordertype', orderType), [orderType]);
  useEffect(() => ls.set('sb_favs', favourites), [favourites]);
  useEffect(() => ls.set('sb_chats', chats), [chats]);
  useEffect(() => ls.set('sb_activechat', activeChatId), [activeChatId]);
  useEffect(() => {
    if (auth) ls.set('sb_auth', auth);
    else localStorage.removeItem('sb_auth');
    if (auth?.token) localStorage.setItem('sb_token', auth.token);
    else localStorage.removeItem('sb_token');
  }, [auth]);
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', prefs.theme === 'dark' ? 'dark' : 'light');
  }, [prefs.theme]);

  // table QR: ?table=N opens the app in dine-in mode with the table prefilled
  useEffect(() => {
    const table = new URLSearchParams(window.location.search).get('table');
    if (table) {
      ls.set('sb_table', String(table).slice(0, 6));
      setOrderType('dinein');
      window.history.replaceState({}, '', window.location.pathname);
      setTimeout(() => notify('Table ' + table, "Dine-in ready — order from your seat and we'll bring it over.", 'menu'), 1600);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- boot ----------
  const refreshMenu = useCallback(async () => setMenu(await api.get('/menu')), []);
  const refreshStories = useCallback(async () => {
    try {
      setStories(await api.get('/stories'));
    } catch {}
  }, []);
  const refreshConfig = useCallback(async () => setConfig(await api.get('/config')), []);
  const refreshRecs = useCallback(async () => {
    try {
      const qs = new URLSearchParams();
      if (phone) qs.set('phone', phone);
      if (prefs.vegMode) qs.set('veg', '1');
      setRecs(await api.get('/recommendations?' + qs));
    } catch {
      setRecs([]);
    }
  }, [phone, prefs.vegMode]);

  const refreshOrders = useCallback(async () => {
    if (!phone) return;
    try {
      const orders = await api.get('/orders?phone=' + phone);
      setMyOrders(orders);
      const active = orders.find((o) => !o.done && !o.cancelled);
      // keep a just-completed order visible on the tracking screen ("Enjoy!")
      setActiveOrder((prev) => active || (prev ? orders.find((o) => o.id === prev.id) || null : null));
    } catch {}
  }, [phone]);

  useEffect(() => {
    const start = Date.now();
    Promise.all([refreshMenu(), refreshConfig(), refreshOrders(), refreshRecs(), refreshStories()])
      .catch(() => {})
      .finally(() => {
        const wait = Math.max(0, 1100 - (Date.now() - start)); // splash minimum ~1.1s
        setTimeout(() => setBooted(true), wait);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    refreshOrders();
    refreshRecs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone, prefs.vegMode]);

  // ---------- notifications ----------
  const notify = useCallback((title, body, target) => {
    const id = Math.random().toString(36).slice(2);
    sfx.ding();
    setBanners((b) => [...b.slice(-2), { id, title, body, target, ts: Date.now() }]);
    setTimeout(() => setBanners((b) => b.filter((x) => x.id !== id)), 4500);
  }, []);

  const showToast = useCallback((text, kind = 'error') => {
    setToast({ text, kind });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const lastNotifRef = useRef(ls.get('sb_lastnotif', Date.now()));
  const pullNotifications = useCallback(async () => {
    try {
      const items = await api.get(`/notifications?since=${lastNotifRef.current}&sessionId=${sessionId()}`);
      for (const n of items) {
        lastNotifRef.current = Math.max(lastNotifRef.current, n.ts);
        notify(n.kind === 'recovery' ? 'Still hungry?' : 'Wicked Chkn', n.text, n.kind === 'recovery' ? 'cart' : 'menu');
      }
      ls.set('sb_lastnotif', lastNotifRef.current);
    } catch {}
  }, [notify]);

  // ---------- realtime ----------
  const activeOrderRef = useRef(null);
  activeOrderRef.current = activeOrder;
  const configRef = useRef(null);
  configRef.current = config;
  const refreshOrdersRef = useRef(refreshOrders);
  refreshOrdersRef.current = refreshOrders;
  const refreshRecsRef = useRef(refreshRecs);
  refreshRecsRef.current = refreshRecs;

  useEffect(() => {
    const off = subscribe(async (ev) => {
      if (ev.topic === 'menu' || ev.topic === 'poll') refreshMenu();
      if (ev.topic === 'store' || ev.topic === 'config' || ev.topic === 'poll') {
        const before = configRef.current?.storePaused;
        const fresh = await api.get('/config').catch(() => null);
        if (fresh) {
          setConfig(fresh);
          if (ev.topic === 'store' && before !== undefined && before !== fresh.storePaused) {
            notify('Wicked Chkn', fresh.storePaused ? 'Ordering is paused — back soon.' : 'We are back — ordering is live!', 'menu');
          }
        }
      }
      if (ev.topic === 'config') refreshRecsRef.current();
      if (ev.topic === 'orders') {
        const cur = activeOrderRef.current;
        if (cur && ev.orderId === cur.id) {
          const fresh = await api.get('/orders/' + cur.id).catch(() => null);
          if (fresh) {
            if (fresh.status !== cur.status) {
              buzz(HAPTIC.status);
              notify('Order update', `${fresh.num} — ${fresh.status}`, 'tracking');
            }
            setActiveOrder(fresh);
            if (fresh.done) refreshOrdersRef.current();
          }
        } else {
          refreshOrdersRef.current();
        }
      }
      if (ev.topic === 'notify') pullNotifications();
      if (ev.topic === 'stories') refreshStories();
    });
    return off;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // random promo banner, max ~1/day-ish, only while open (spec §11)
  useEffect(() => {
    if (!booted || !config?.storeOpen) return;
    const last = ls.get('sb_lastpromo', 0);
    if (Date.now() - last < 4 * 3600e3) return;
    const t = setTimeout(() => {
      const promos = [
        'The Double Mutton Cheese Burger is undefeated. Change that today?',
        'Wicked Wedges hit different at 6 PM. Just saying.',
        'WICKED10 = 10% off above ₹499. Your move.'
      ];
      notify('Wicked Chkn', promos[Math.floor(Math.random() * promos.length)], 'menu');
      ls.set('sb_lastpromo', Date.now());
    }, 45000);
    return () => clearTimeout(t);
  }, [booted, config?.storeOpen, notify]);

  // ---------- cart ----------
  const itemById = useCallback((id) => menu.find((m) => m.id === id), [menu]);

  const modsPrice = useCallback((item, mods = []) => {
    return mods.reduce((a, name) => a + (item.modifiers?.find((m) => m.name === name)?.price || 0), 0);
  }, []);

  const cartLines = useMemo(
    () =>
      Object.entries(cart)
        .map(([id, c]) => {
          const item = itemById(id);
          if (!item) return null;
          const mods = c.mods || [];
          const unit = item.price + modsPrice(item, mods);
          return { item, qty: c.qty, note: c.note || '', mods, unitPrice: unit, lineTotal: unit * c.qty };
        })
        .filter(Boolean),
    [cart, itemById, modsPrice]
  );
  const cartCount = useMemo(() => cartLines.reduce((a, l) => a + l.qty, 0), [cartLines]);
  const subtotal = useMemo(() => cartLines.reduce((a, l) => a + l.lineTotal, 0), [cartLines]);
  const promoApplied = promo === 'WICKED10';
  const voucherActive = !!(voucher && promo === voucher.code && cartLines.length);
  const promoActive = (promoApplied && config && subtotal >= config.promo.min) || voucherActive;
  const discount = voucherActive
    ? Math.min(voucher.amount, subtotal)
    : promoApplied && config && subtotal >= config.promo.min
      ? Math.round((subtotal * config.promo.pct) / 100)
      : 0;
  const deliveryFee = orderType === 'delivery' && cartLines.length ? config?.deliveryFee || 35 : 0;
  const total = subtotal - discount + deliveryFee;

  const lastClosedNoticeRef = useRef(0);
  const addToCart = useCallback(
    (id, qty = 1, note, mods) => {
      buzz(HAPTIC.add);
      sfx.pop();
      // adding while closed is allowed — the cart is saved; checkout stays gated.
      // Pop a notice (throttled so it doesn't nag on every tap).
      const cfg = configRef.current;
      if (cfg && !cfg.storeOpen && Date.now() - lastClosedNoticeRef.current > 45000) {
        lastClosedNoticeRef.current = Date.now();
        notify("We're closed right now", "Cart away! We'll keep it safe — ordering opens at 11 AM.", null);
      }
      setCart((c) => {
        const cur = c[id] || { qty: 0 };
        return { ...c, [id]: { qty: Math.min(20, cur.qty + qty), note: note ?? cur.note, mods: mods ?? cur.mods ?? [] } };
      });
    },
    [notify]
  );
  const decCart = useCallback((id) => {
    buzz(HAPTIC.remove);
    setCart((c) => {
      const cur = c[id];
      if (!cur) return c;
      if (cur.qty <= 1) {
        const { [id]: _, ...rest } = c;
        return rest;
      }
      return { ...c, [id]: { ...cur, qty: cur.qty - 1 } };
    });
  }, []);
  const clearCart = useCallback(() => setCart({}), []);
  const adoptCart = useCallback((c) => setCart(c && typeof c === 'object' ? c : {}), []);

  // sync cart snapshot for abandoned-cart tracking (debounced)
  useEffect(() => {
    const t = setTimeout(() => {
      const lines = Object.entries(cart).map(([id, c]) => ({ id, qty: c.qty, note: c.note || undefined }));
      api
        .put('/carts/' + sessionId(), { lines, total, customerName: auth?.customer?.name || '' })
        .catch(() => {});
    }, 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, total]);

  // ---------- favourites ----------
  const toggleFav = useCallback(
    (id) => {
      buzz(HAPTIC.toggle);
      setFavourites((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]));
      if (auth) api.put('/me/favourites', { itemId: id, fav: !favourites.includes(id) }).catch(() => {});
    },
    [auth, favourites]
  );

  // ---------- auth ----------
  const signIn = useCallback(
    async (data) => {
      setAuth(data);
      ls.set('sb_lastphone', data.customer.phone);
      try {
        const me = await api.get('/me');
        if (me.favourites?.length) setFavourites((f) => [...new Set([...f, ...me.favourites])]);
      } catch {}
      notify('Welcome back!', `Signed in as ${data.customer.name || data.customer.phone} — your orders are saved.`, null);
    },
    [notify]
  );
  const signOut = useCallback(() => setAuth(null), []);

  // ---------- chat sessions ----------
  const activeChat = chats.find((c) => c.id === activeChatId) || null;
  const newChat = useCallback(() => {
    const c = { id: 'chat_' + Math.random().toString(36).slice(2) + Date.now().toString(36), ts: Date.now(), messages: [] };
    setChats((prev) => [c, ...prev.filter((x) => x.messages.length > 0)].slice(0, 20));
    setActiveChatId(c.id);
    return c.id;
  }, []);
  const appendChat = useCallback((chatId, msg) => {
    setChats((prev) => prev.map((c) => (c.id === chatId ? { ...c, messages: [...c.messages, msg], updated: Date.now() } : c)));
  }, []);

  // ---------- navigation ----------
  // browser/Android back pops screens instead of exiting the PWA
  const setScreen = useCallback((s) => {
    setScreenRaw((prev) => {
      if (prev !== s) window.history.pushState({ sbScreen: s }, '');
      return s;
    });
    window.scrollTo(0, 0);
  }, []);
  useEffect(() => {
    // align the restored history entry with the actual initial screen
    window.history.replaceState({ sbScreen: 'home' }, '');
    const onPop = (e) => {
      setScreenRaw(e.state?.sbScreen || 'home');
      window.scrollTo(0, 0);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const t = useMemo(() => makeT(prefs.lang || 'en'), [prefs.lang]);

  const value = {
    booted,
    config,
    menu,
    recs,
    stories,
    t,
    voucher,
    setVoucher,
    modsPrice,
    screen,
    setScreen,
    sheetItem,
    setSheetItem,
    showLogin,
    setShowLogin,
    paySheet,
    setPaySheet,
    prefs,
    setPrefs,
    auth,
    signIn,
    signOut,
    favourites,
    toggleFav,
    cart,
    cartLines,
    cartCount,
    subtotal,
    discount,
    deliveryFee,
    total,
    promo,
    setPromo,
    promoApplied,
    promoActive,
    orderType,
    setOrderType,
    addToCart,
    decCart,
    clearCart,
    adoptCart,
    itemById,
    activeOrder,
    setActiveOrder,
    myOrders,
    refreshOrders,
    banners,
    setBanners,
    notify,
    toast,
    showToast,
    chats,
    activeChat,
    activeChatId,
    setActiveChatId,
    newChat,
    appendChat,
    sessionId: sessionId(),
    phone
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
