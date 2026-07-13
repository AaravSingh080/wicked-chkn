import React, { createContext, useContext, useCallback, useEffect, useState } from 'react';
import { api, subscribe } from './api.js';

const Ctx = createContext(null);
export const useAdmin = () => useContext(Ctx);

// new-order chime (tiny WebAudio synth, no assets)
let audioCtx = null;
function coin() {
  try {
    audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    [988, 1319].forEach((f, i) => {
      const t0 = audioCtx.currentTime + i * 0.07;
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = 'square';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.07, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
      o.connect(g).connect(audioCtx.destination);
      o.start(t0);
      o.stop(t0 + 0.25);
    });
  } catch {}
}

export function AdminProvider({ children }) {
  const [orders, setOrders] = useState([]);
  const [menu, setMenu] = useState([]);
  const [storePaused, setStorePaused] = useState(false);
  const [activity, setActivity] = useState([]);
  const [bump, setBump] = useState(0); // sections listen to this to refetch their own data

  const refreshOrders = useCallback(async () => setOrders(await api.get('/admin/orders')), []);
  const refreshMenu = useCallback(async () => setMenu(await api.get('/menu')), []);
  const refreshConfig = useCallback(async () => {
    const c = await api.get('/config');
    setStorePaused(c.storePaused);
  }, []);
  const refreshActivity = useCallback(async () => setActivity(await api.get('/admin/activity')), []);

  useEffect(() => {
    Promise.all([refreshOrders(), refreshMenu(), refreshConfig(), refreshActivity()]).catch(() => {});
    const off = subscribe((ev) => {
      if (ev.topic === 'orders' && ev.status === 'Order placed') coin(); // new-order chime
      if (['orders', 'poll'].includes(ev.topic)) refreshOrders();
      if (['menu', 'poll'].includes(ev.topic)) refreshMenu();
      if (['store', 'config', 'poll'].includes(ev.topic)) refreshConfig();
      if (['activity', 'poll'].includes(ev.topic)) refreshActivity();
      setBump((b) => b + 1);
    });
    return off;
  }, [refreshOrders, refreshMenu, refreshConfig, refreshActivity]);

  const liveCount = orders.filter((o) => !o.done).length;

  const toggleStore = useCallback(async () => {
    await api.put('/admin/store', { open: storePaused });
    setStorePaused(!storePaused);
  }, [storePaused]);

  return (
    <Ctx.Provider
      value={{ orders, menu, storePaused, activity, liveCount, bump, refreshOrders, refreshMenu, toggleStore }}
    >
      {children}
    </Ctx.Provider>
  );
}
