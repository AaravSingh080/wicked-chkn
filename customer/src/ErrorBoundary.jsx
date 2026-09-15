import React from 'react';

// One crashing component must never blank the whole app.
export default class ErrorBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error('[app crash]', error, info?.componentStack);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24, textAlign: 'center' }}>
        <div
          style={{
            width: 64, height: 64, borderRadius: 10, background: 'var(--blue, #D92B21)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: 24, transform: 'rotate(-4deg)', boxShadow: '4px 4px 0 rgba(0,0,0,.2)'
          }}
        >
          WC
        </div>
        <div style={{ fontWeight: 800, fontSize: 17 }}>Something hiccuped</div>
        <div style={{ color: 'var(--sub, #8F625B)', fontSize: 13, fontWeight: 600 }}>Your cart and orders are safe.</div>
        <button
          onClick={() => window.location.reload()}
          style={{ background: 'var(--blue, #D92B21)', color: '#fff', fontWeight: 800, fontSize: 14, border: 0, borderRadius: 13, padding: '12px 22px' }}
        >
          Reload the app
        </button>
      </div>
    );
  }
}
