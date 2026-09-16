import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.jsx';
import { StoreProvider } from './store.jsx';
import ErrorBoundary from './ErrorBoundary.jsx';
import './index.css';

// Offline cache that never goes stale: check for a new deploy on open, whenever the
// app comes back to the foreground, and every 5 minutes. With autoUpdate the page
// reloads itself as soon as the new version takes over (cart/login live in localStorage).
registerSW({
  immediate: true,
  onRegisteredSW(_url, reg) {
    if (!reg) return;
    const check = () => navigator.onLine && reg.update().catch(() => {});
    setInterval(check, 5 * 60 * 1000);
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && check());
  }
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <StoreProvider>
        <App />
      </StoreProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
