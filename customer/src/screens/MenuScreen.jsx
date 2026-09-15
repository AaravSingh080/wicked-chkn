import React, { useMemo, useState } from 'react';
import { Search, Heart, ShoppingCart, SlidersHorizontal, Check } from 'lucide-react';
import { useStore, buzz, HAPTIC } from '../store.jsx';
import { VegMark, Tile, Stepper, Toggle } from '../components/ui.jsx';
import { Sheet } from '../components/Overlays.jsx';

const CATEGORIES = [
  'Burgers & Sandwiches', 'Burritos & Quesadillas', 'Wicked Wedges', 'Chicken Snacks', 'Drinks'
];

const SORTS = [
  { key: 'none', label: 'Recommended', sub: 'Grouped by category' },
  { key: 'asc', label: 'Price: low to high', sub: 'Budget bites first' },
  { key: 'desc', label: 'Price: high to low', sub: 'Go big first' }
];

export default function MenuScreen() {
  const { menu, prefs, setPrefs, cart, addToCart, decCart, setSheetItem, favourites, toggleFav, cartCount, total, setScreen, t } =
    useStore();
  const [query, setQuery] = useState('');
  // home's menu-board tiles preselect a category via this one-shot handoff
  // (initializer stays pure — StrictMode runs it twice — so the flag clears in an effect)
  const [chip, setChip] = useState(() =>
    window.__wickedCat && CATEGORIES.includes(window.__wickedCat) ? window.__wickedCat : 'All'
  );
  React.useEffect(() => {
    window.__wickedCat = null;
  }, []);
  const [showFilters, setShowFilters] = useState(false);

  const sort = prefs.sort || 'none';
  const filtersActive = prefs.vegMode || sort !== 'none';

  const filtered = useMemo(() => {
    let items = menu;
    if (prefs.vegMode) items = items.filter((i) => i.veg);
    if (chip !== 'All') items = items.filter((i) => i.category === chip);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      items = items.filter((i) => i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q));
    }
    return items;
  }, [menu, prefs.vegMode, chip, query]);

  // grouped by category (default) or one flat price-sorted list
  const sections = useMemo(() => {
    if (sort !== 'none') {
      const sorted = [...filtered].sort((a, b) => (sort === 'asc' ? a.price - b.price : b.price - a.price));
      return sorted.length ? [[sort === 'asc' ? 'Price: low to high' : 'Price: high to low', sorted]] : [];
    }
    const g = new Map();
    for (const i of filtered) {
      if (!g.has(i.category)) g.set(i.category, []);
      g.get(i.category).push(i);
    }
    return [...g.entries()];
  }, [filtered, sort]);

  return (
    <div className="pb-32">
      {/* sticky header */}
      <div className="sticky top-0 z-20 bg-bg border-b border-line px-5 pt-5 pb-3 space-y-3">
        <div className="flex items-center gap-2.5">
          <h1 className="font-display font-extrabold text-[22px] tracking-[-0.5px] flex-1">{t('menu', 'Menu')}</h1>
          {prefs.vegMode && (
            <span className="rounded-full bg-greenfill text-greendark px-2.5 py-1 text-[11px] font-extrabold">
              VEG ONLY
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <label className="flex-1 flex items-center gap-2.5 bg-card border-2 border-line rounded-md px-3.5 h-11">
            <Search size={16} className="text-sub shrink-0" />
            <input
              className="flex-1 min-w-0 bg-transparent outline-none text-[13.5px] font-semibold placeholder:text-sub"
              placeholder={t('search', 'Search burgers, burritos, wedges…')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <button
            className={`relative shrink-0 h-11 px-3.5 rounded-md border-2 flex items-center gap-1.5 text-[13px] font-extrabold ${
              filtersActive ? 'border-blue text-blue bg-bluesoft' : 'border-line bg-card text-sub'
            }`}
            onClick={() => setShowFilters(true)}
          >
            <SlidersHorizontal size={15} />
            {t('filters', 'Filters')}
            {filtersActive && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-blue" />}
          </button>
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5">
          {['All', ...CATEGORIES].map((c) => (
            <button
              key={c}
              onClick={() => setChip(c)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-bold whitespace-nowrap ${
                chip === c ? 'text-white' : 'bg-card text-sub border-2 border-line'
              }`}
              style={chip === c ? { background: 'var(--hero)' } : undefined}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* item list */}
      <div className="px-5 mt-4 space-y-6">
        {sections.length === 0 && (
          <div className="text-center text-sub text-[13.5px] font-semibold py-14">
            Nothing matches "{query}". Try "burger", "burrito" or "wedges".
          </div>
        )}
        {sections.map(([category, items]) => (
          <section key={category}>
            <h2 className="font-display font-bold text-[16.5px] mb-3">{category}</h2>
            <div className="space-y-3">
              {items.map((item) => {
                const qty = cart[item.id]?.qty || 0;
                const fav = favourites.includes(item.id);
                return (
                  <div
                    key={item.id}
                    className={`bg-card border-2 border-line rounded-lg p-3 flex gap-3 ${
                      item.inStock ? '' : 'opacity-45'
                    }`}
                  >
                    <button onClick={() => setSheetItem(item)} className="shrink-0">
                      <Tile item={item} size={76} radius={8} />
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-1.5">
                        <VegMark veg={item.veg} />
                        <button className="text-[14px] font-bold leading-tight flex-1 text-left min-w-0 truncate" onClick={() => setSheetItem(item)}>
                          {item.name}
                        </button>
                        <button className="shrink-0 press-sm" onClick={() => toggleFav(item.id)} aria-label="Favourite">
                          <Heart size={17} className={fav ? 'text-red' : 'text-sub'} fill={fav ? '#E23B2E' : 'none'} />
                        </button>
                      </div>
                      <p className="text-[11.5px] text-sub mt-1 clamp-2">{item.desc}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="font-display font-bold text-[16px]">₹{item.price}</span>
                        {!item.inStock ? (
                          <span className="text-[11.5px] font-extrabold uppercase text-sub">Sold out</span>
                        ) : qty === 0 ? (
                          <button
                            className="rounded-md bg-bluesoft text-blue border-2 border-blue text-[12.5px] font-extrabold px-4 py-1.5"
                            onClick={() => addToCart(item.id)}
                          >
                            Add
                          </button>
                        ) : (
                          <Stepper qty={qty} onInc={() => addToCart(item.id)} onDec={() => decCart(item.id)} />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {/* the global CartBar (App.jsx) handles "view cart" on every screen */}

      {/* filters sheet */}
      {showFilters && (
        <Sheet onClose={() => setShowFilters(false)}>
          <div className="p-5 pb-8 space-y-5">
            <h2 className="font-display font-extrabold text-[20px]">Filters</h2>

            <div className="flex items-center justify-between bg-bg border-2 border-line rounded-lg p-4">
              <div>
                <div className="text-[13.5px] font-extrabold">Veg only</div>
                <div className="text-[11.5px] text-sub">Hides everything non-veg across the app</div>
              </div>
              <Toggle
                on={prefs.vegMode}
                onChange={() => {
                  buzz(HAPTIC.toggle);
                  setPrefs((p) => ({ ...p, vegMode: !p.vegMode }));
                }}
              />
            </div>

            <div>
              <div className="text-[12px] font-extrabold uppercase tracking-wide text-sub mb-2">Sort by price</div>
              <div className="space-y-2">
                {SORTS.map((s) => {
                  const active = sort === s.key;
                  return (
                    <button
                      key={s.key}
                      className={`w-full flex items-center gap-3 rounded-lg p-3.5 text-left border-2 ${
                        active ? 'border-blue bg-bluesoft' : 'border-line bg-bg'
                      }`}
                      onClick={() => {
                        buzz(HAPTIC.toggle);
                        setPrefs((p) => ({ ...p, sort: s.key }));
                      }}
                    >
                      <span className="flex-1">
                        <span className="block text-[13.5px] font-extrabold">{s.label}</span>
                        <span className="block text-[11.5px] text-sub">{s.sub}</span>
                      </span>
                      <span
                        className="w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center shrink-0"
                        style={{ borderColor: active ? 'var(--blue)' : 'var(--line)' }}
                      >
                        {active && <Check size={11} strokeWidth={3.5} className="text-blue" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-2.5">
              <button
                className="flex-1 rounded-md border-2 border-line text-sub font-extrabold text-[13.5px] h-11"
                onClick={() => {
                  setPrefs((p) => ({ ...p, vegMode: false, sort: 'none' }));
                }}
              >
                Clear all
              </button>
              <button className="flex-1 rounded-md bg-blue text-white font-extrabold text-[13.5px] h-11 shadow-cta" onClick={() => setShowFilters(false)}>
                Done
              </button>
            </div>
          </div>
        </Sheet>
      )}
    </div>
  );
}
