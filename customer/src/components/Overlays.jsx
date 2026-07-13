import React from 'react';
import { X } from 'lucide-react';
import { useStore } from '../store.jsx';

// In-app push notification banners: drop from top, tap to navigate, auto-dismiss 4.5s
export function NotifBanners() {
  const { banners, setBanners, setScreen } = useStore();
  if (!banners.length) return null;
  return (
    <div className="fixed top-2 inset-x-0 max-w-[420px] mx-auto px-3 z-50 space-y-2 pointer-events-none">
      {banners.map((b) => (
        <button
          key={b.id}
          className="banner-drop pointer-events-auto w-full bg-card rounded-lg border border-line shadow-lg p-3 flex items-center gap-3 text-left"
          onClick={() => {
            setBanners((prev) => prev.filter((x) => x.id !== b.id));
            if (b.target) setScreen(b.target);
          }}
        >
          <span className="w-[38px] h-[38px] shrink-0 rounded-md bg-hero text-white font-display font-extrabold text-[14px] flex items-center justify-center">
            WC
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-[13px] font-extrabold truncate">{b.title}</span>
            <span className="block text-[12px] text-sub truncate">{b.body}</span>
          </span>
          <span className="text-[11px] text-sub shrink-0">now</span>
        </button>
      ))}
    </div>
  );
}

export function Toast() {
  const { toast } = useStore();
  if (!toast) return null;
  return (
    <div className="fixed bottom-20 inset-x-0 max-w-[420px] mx-auto px-5 z-50 pointer-events-none">
      <div
        className={`sheet-up rounded-lg px-4 py-3 text-[13px] font-bold text-white text-center shadow-lg ${
          toast.kind === 'success' ? 'bg-green' : 'bg-red'
        }`}
      >
        {toast.text}
      </div>
    </div>
  );
}

// Generic bottom sheet over scrim
export function Sheet({ onClose, children, closeButton = true }) {
  return (
    <div className="fixed inset-0 z-40 max-w-[420px] mx-auto">
      <div className="absolute inset-0" style={{ background: 'rgba(10,20,36,.5)' }} onClick={onClose} />
      <div className="sheet-up absolute bottom-0 inset-x-0 bg-card rounded-t-lg max-h-[92%] overflow-y-auto no-scrollbar">
        {closeButton && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-soft flex items-center justify-center z-10"
            aria-label="Close"
          >
            <X size={17} />
          </button>
        )}
        {children}
      </div>
    </div>
  );
}
