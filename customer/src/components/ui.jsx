import React from 'react';

// Veg / non-veg mark: 13px square outline with a dot
export function VegMark({ veg, size = 13 }) {
  const color = veg ? '#1FA45C' : '#C0392B';
  return (
    <span
      className="inline-flex items-center justify-center shrink-0 rounded-[3px]"
      style={{ width: size, height: size, border: `2px solid ${color}` }}
    >
      <span className="rounded-full" style={{ width: size * 0.45, height: size * 0.45, background: color }} />
    </span>
  );
}

// ---------- hand-drawn duotone food illustrations (no emoji, no stock) ----------
// White-on-gradient marks so every tile reads as a designed icon set.
const W = 'rgba(255,255,255,.94)';
const W2 = 'rgba(255,255,255,.55)';
const K = 'rgba(20,10,0,.28)';

export const FOOD_ART = {
  burger: (s) => (
    <svg width={s} height={s} viewBox="0 0 64 64" aria-hidden="true">
      <path d="M11 30a21 16 0 0 1 42 0v3H11z" fill={W} />
      <circle cx="23" cy="21" r="1.8" fill={K} />
      <circle cx="32" cy="18" r="1.8" fill={K} />
      <circle cx="41" cy="21" r="1.8" fill={K} />
      <path d="M10 36h44l-4 5 -6-4 -6 4 -6-4 -6 4 -6-4 -6 5z" fill={W2} />
      <rect x="12" y="43" width="40" height="8" rx="4" fill={K} />
      <rect x="14" y="53" width="36" height="6" rx="3" fill={W} />
    </svg>
  ),
  flame: (s) => (
    <svg width={s} height={s} viewBox="0 0 64 64" aria-hidden="true">
      <path
        d="M34 6c3 10-8 13-8 22a7 7 0 0 0 14 .5c0-4-2-6-1-9 5 4 11 9 11 18a17 17 0 0 1-34 0C16 23 30 20 34 6z"
        fill={W}
      />
      <path d="M32 38c-3 4-4 6-4 9a5 5 0 0 0 10 0c0-4-3-5-6-9z" fill={K} />
    </svg>
  ),
  leaf: (s) => (
    <svg width={s} height={s} viewBox="0 0 64 64" aria-hidden="true">
      <path d="M32 8C17 21 15 37 32 56 49 37 47 21 32 8z" fill={W} />
      <path d="M32 16v32M32 26l-8-6M32 26l8-6M32 38l-9-7M32 38l9-7" stroke={K} strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </svg>
  ),
  steak: (s) => (
    <svg width={s} height={s} viewBox="0 0 64 64" aria-hidden="true">
      <path d="M14 26c0-9 10-14 22-13s16 8 14 16c-1 6 2 7 1 12-2 8-13 12-24 9S8 39 10 32c1-4 4-3 4-6z" fill={W} />
      <path d="M22 28c4-3 9-3 13 0m-11 8c4-3 9-3 13 0" stroke={K} strokeWidth="3" strokeLinecap="round" fill="none" />
    </svg>
  ),
  drumstick: (s) => (
    <svg width={s} height={s} viewBox="0 0 64 64" aria-hidden="true">
      <ellipse cx="37" cy="25" rx="17" ry="14" fill={W} />
      <path d="M27 36 17 46" stroke={W} strokeWidth="7" strokeLinecap="round" />
      <circle cx="14" cy="49" r="4.5" fill={W2} />
      <circle cx="21" cy="53" r="4.5" fill={W2} />
      <path d="M33 20c3-2 7-2 9 1" stroke={K} strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </svg>
  ),
  fries: (s) => (
    <svg width={s} height={s} viewBox="0 0 64 64" aria-hidden="true">
      <rect x="24" y="12" width="5" height="20" rx="2.5" fill={W2} />
      <rect x="31" y="8" width="5" height="24" rx="2.5" fill={W} />
      <rect x="38" y="12" width="5" height="20" rx="2.5" fill={W2} />
      <path d="M19 28h26l-3.5 28h-19z" fill={W} />
      <path d="M21 34h22" stroke={K} strokeWidth="3" strokeLinecap="round" />
    </svg>
  ),
  drink: (s) => (
    <svg width={s} height={s} viewBox="0 0 64 64" aria-hidden="true">
      <path d="M35 16 42 5" stroke={W} strokeWidth="4" strokeLinecap="round" />
      <rect x="19" y="15" width="26" height="5" rx="2.5" fill={W} />
      <path d="M21 22h22l-3 34H24z" fill={W2} />
      <circle cx="30" cy="34" r="2.4" fill={K} />
      <circle cx="36" cy="42" r="2" fill={K} />
      <circle cx="29" cy="48" r="1.7" fill={K} />
    </svg>
  ),
  shake: (s) => (
    <svg width={s} height={s} viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="25" cy="17" r="6.5" fill={W} />
      <circle cx="34" cy="13" r="7.5" fill={W} />
      <circle cx="41" cy="18" r="6" fill={W} />
      <path d="M40 12 45 4" stroke={W} strokeWidth="4" strokeLinecap="round" />
      <path d="M21 22h22l-3 34H24z" fill={W2} />
      <path d="M27 30c4 2 7 2 10 0m-9 9c3 2 6 2 8 0" stroke={K} strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </svg>
  )
};

const CAT_TILE = {
  'Burgers & Sandwiches': ['burger', 'linear-gradient(135deg,#FF7A59,#C22F1F)'],
  'Burritos & Quesadillas': ['steak', 'linear-gradient(135deg,#D98E6B,#8F3F1B)'],
  'Wicked Wedges': ['fries', 'linear-gradient(135deg,#FFCF6B,#EF8F2B)'],
  'Chicken Snacks': ['drumstick', 'linear-gradient(135deg,#FFC163,#D8710E)'],
  Drinks: ['drink', 'linear-gradient(135deg,#5ED0C0,#1F8FE0)']
};

// Photo convention: drop customer/public/food/<item-id>.jpg and it replaces the
// illustration automatically (item.imageUrl from the DB wins over both).
export function Tile({ item, size = 76, radius = 8, className = '', fullWidth = false }) {
  const [art, gradient] = CAT_TILE[item?.category] || ['burger', 'linear-gradient(135deg,#FF7A59,#C22F1F)'];
  const [photoOk, setPhotoOk] = React.useState(true);
  const photo = item?.imageUrl || (item?.id && photoOk ? `/food/${item.id}.jpg` : null);

  return (
    <div
      className={`relative flex items-center justify-center shrink-0 select-none overflow-hidden ${className}`}
      style={{
        width: fullWidth ? '100%' : size,
        // photos are always 1:1 — full-width tiles size themselves square
        height: fullWidth ? 'auto' : size,
        aspectRatio: '1 / 1',
        borderRadius: radius,
        background: gradient,
        border: '2px solid var(--tileBorder)',
        boxShadow: '3px 3px 0 var(--shadowInk)'
      }}
    >
      {/* lit-surface sheen */}
      <span
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(120% 90% at 28% 0%, rgba(255,255,255,.32), transparent 55%)' }}
      />
      <span className="tile-emoji relative flex items-center justify-center">{FOOD_ART[art](size * 0.66)}</span>
      {photo && (
        <img
          src={photo}
          alt={item.name}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ borderRadius: radius }}
          onError={() => setPhotoOk(false)}
        />
      )}
    </div>
  );
}

export function SpicyPill() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-spicyfill text-red px-2 py-[3px] text-[11px] font-extrabold">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
      </svg>
      SPICY
    </span>
  );
}

export function Price({ value, size = 16, className = '' }) {
  return (
    <span className={`font-display font-bold text-blue ${className}`} style={{ fontSize: size }}>
      ₹{value}
    </span>
  );
}

// − qty + stepper (blue on cards, soft fill in sheets/cart)
export function Stepper({ qty, onInc, onDec, variant = 'blue', size = 34 }) {
  const base =
    variant === 'blue'
      ? 'bg-blue text-white'
      : 'bg-soft text-ink';
  return (
    <div className={`inline-flex items-center rounded-md overflow-hidden ${base}`} style={{ height: size }}>
      <button className="press-sm px-3 h-full font-extrabold text-[15px]" onClick={onDec} aria-label="Remove one">
        −
      </button>
      <span className="min-w-[22px] text-center text-[13.5px] font-extrabold">{qty}</span>
      <button className="press-sm px-3 h-full font-extrabold text-[15px]" onClick={onInc} aria-label="Add one">
        +
      </button>
    </div>
  );
}

// 50×29 toggle, white knob, green when on (veg) or blue (theme)
export function Toggle({ on, onChange, color = '#1FA45C' }) {
  return (
    <button
      onClick={onChange}
      className="relative shrink-0 rounded-full transition-colors duration-200"
      style={{ width: 50, height: 29, background: on ? color : 'var(--line)' }}
      role="switch"
      aria-checked={on}
    >
      <span
        className="absolute top-[3px] rounded-full bg-white shadow transition-all duration-200"
        style={{ width: 23, height: 23, left: on ? 24 : 3 }}
      />
    </button>
  );
}

export function SectionHeader({ title, badge, action, onAction }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 bg-blue rotate-45 shrink-0" aria-hidden />
        <h2 className="font-display text-[18px] uppercase tracking-[0.5px]">{title}</h2>
        {badge && (
          <span className="rounded-md bg-blue text-white px-2 py-[2px] text-[10.5px] font-extrabold -rotate-2">{badge}</span>
        )}
      </div>
      {action && (
        <button className="text-blue text-[12.5px] font-extrabold uppercase tracking-[0.5px] underline underline-offset-4 decoration-2" onClick={onAction}>
          {action}
        </button>
      )}
    </div>
  );
}
