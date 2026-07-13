import React, { useState } from 'react';
import { Heart } from 'lucide-react';
import { useStore } from '../store.jsx';
import { Sheet } from '../components/Overlays.jsx';
import { VegMark, Tile, SpicyPill, Stepper } from '../components/ui.jsx';

export default function ItemSheet() {
  const { sheetItem: item, setSheetItem, addToCart, favourites, toggleFav } = useStore();
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState('');
  const [mods, setMods] = useState([]);
  if (!item) return null;

  const fav = favourites.includes(item.id);
  const modsTotal = mods.reduce((a, name) => a + (item.modifiers?.find((m) => m.name === name)?.price || 0), 0);
  const unit = item.price + modsTotal;
  const toggleMod = (name) =>
    setMods((cur) => (cur.includes(name) ? cur.filter((m) => m !== name) : [...cur, name]));
  const close = () => {
    setSheetItem(null);
    setQty(1);
    setNote('');
    setMods([]);
  };

  return (
    <Sheet onClose={close}>
      <div className="p-5 pb-7 space-y-4">
        <Tile item={item} size={150} radius={8} fullWidth />
        <div className="flex items-center gap-2">
          <VegMark veg={item.veg} />
          <h2 className="font-display font-extrabold text-[20px] flex-1 leading-tight">{item.name}</h2>
          <button className="press-sm shrink-0" onClick={() => toggleFav(item.id)} aria-label="Favourite">
            <Heart size={19} className={fav ? 'text-red' : 'text-sub'} fill={fav ? '#E23B2E' : 'none'} />
          </button>
        </div>
        {item.spicy && <SpicyPill />}
        <p className="text-[13.5px] text-sub leading-relaxed">{item.desc}</p>

        {/* customization */}
        {item.modifiers?.length > 0 && (
          <div>
            <div className="text-[11.5px] font-extrabold uppercase tracking-wide text-sub mb-2">Make it yours</div>
            <div className="space-y-1.5">
              {item.modifiers.map((m) => {
                const on = mods.includes(m.name);
                return (
                  <button
                    key={m.name}
                    className={`w-full flex items-center gap-2.5 rounded-md px-3.5 py-2.5 border-2 text-left ${
                      on ? 'border-blue bg-bluesoft' : 'border-line bg-bg'
                    }`}
                    onClick={() => toggleMod(m.name)}
                  >
                    <span
                      className="w-[17px] h-[17px] rounded-md border-2 flex items-center justify-center text-white text-[11px] font-extrabold shrink-0"
                      style={{ borderColor: on ? 'var(--blue)' : 'var(--line)', background: on ? 'var(--blue)' : 'transparent' }}
                    >
                      {on ? '✓' : ''}
                    </span>
                    <span className="flex-1 text-[13px] font-bold">{m.name}</span>
                    <span className="text-[12.5px] font-extrabold text-sub">{m.price ? `+₹${m.price}` : 'Free'}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <input
          className="w-full bg-bg border-2 border-line rounded-md px-3.5 h-11 text-[13px] font-semibold outline-none placeholder:text-sub"
          placeholder="Special instructions (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={120}
        />
        <div className="flex items-center gap-3">
          <Stepper variant="soft" size={44} qty={qty} onInc={() => setQty((q) => Math.min(10, q + 1))} onDec={() => setQty((q) => Math.max(1, q - 1))} />
          {item.inStock ? (
            <button
              className="flex-1 rounded-md bg-blue text-white font-extrabold text-[15px] h-[46px] shadow-cta"
              onClick={() => {
                addToCart(item.id, qty, note || undefined, mods);
                close();
              }}
            >
              Add to cart · ₹{unit * qty}
            </button>
          ) : (
            <button className="flex-1 rounded-md text-white font-extrabold text-[15px] h-[46px]" style={{ background: '#CBA49D' }} disabled>
              Sold out today
            </button>
          )}
        </div>
      </div>
    </Sheet>
  );
}
