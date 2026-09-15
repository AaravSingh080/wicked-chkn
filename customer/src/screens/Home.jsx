import React, { useRef } from 'react';
import { MapPin, ShoppingCart, Clock, ArrowRight, RefreshCw, MessageCircle, Bike, Phone, Plus, Dices } from 'lucide-react';
import { useStore, buzz, HAPTIC } from '../store.jsx';
import { api } from '../api.js';
import { Tile, SectionHeader, Stepper, FOOD_ART } from '../components/ui.jsx';

const TICKER = ['EVERY BURGER SERVED WITH WEDGES', 'WICKED10 · 10% OFF ₹499+', 'FLAT ₹35 DELIVERY · 7 KM', 'OPEN 11 AM – 10 PM'];

const STORY_THEMES = {
  fire: 'linear-gradient(135deg,#3A1B10,#E4573D)',
  ocean: 'linear-gradient(135deg,#4A0E0B,#D92B21)',
  candy: 'linear-gradient(135deg,#8B3E78,#E8A2D8)',
  forest: 'linear-gradient(135deg,#123B22,#37A662)'
};

export default function Home() {
  const {
    config, menu, recs, stories, cart, cartCount, total, setScreen, setSheetItem, activeOrder, myOrders,
    promo, setPromo, addToCart, decCart, prefs, clearCart, itemById, showToast, t, phone
  } = useStore();

  React.useEffect(() => {
    if (!phone) return setLoyalty(null);
    api.get('/loyalty?phone=' + phone).then(setLoyalty).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone, myOrders.length]);

  const cartBtnRef = useRef(null);
  const [storyIdx, setStoryIdx] = React.useState(null); // open story viewer index
  const [loyalty, setLoyalty] = React.useState(null);
  const [budget, setBudget] = React.useState(300);
  const [rolling, setRolling] = React.useState(false);
  const [confirmRoll, setConfirmRoll] = React.useState(false);

  // "Feed me": random meal within budget — main first, then side/drink if they fit
  const rollMeal = () => {
    if (rolling) return;
    // replacing a non-empty cart is destructive — ask for a second tap
    if (cartCount > 0 && !confirmRoll) {
      setConfirmRoll(true);
      showToast('This replaces your current cart — tap again to confirm', 'success');
      setTimeout(() => setConfirmRoll(false), 3500);
      return;
    }
    setConfirmRoll(false);
    const pool = menu.filter((m) => m.inStock && (!prefs.vegMode || m.veg));
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const isMain = (m) => !['Wicked Wedges', 'Chicken Snacks', 'Drinks'].includes(m.category);
    const mains = pool.filter((m) => isMain(m) && m.price <= budget);
    if (!mains.length) return showToast('Nothing fits that budget right now — go higher!');
    setRolling(true);
    setTimeout(() => {
      const meal = [pick(mains)];
      let left = budget - meal[0].price;
      const sides = pool.filter((m) => ['Wicked Wedges', 'Chicken Snacks'].includes(m.category) && m.price <= left);
      if (sides.length) {
        meal.push(pick(sides));
        left -= meal[meal.length - 1].price;
      }
      const drinks = pool.filter((m) => m.category === 'Drinks' && m.price <= left);
      if (drinks.length) meal.push(pick(drinks));
      clearCart();
      meal.forEach((m) => addToCart(m.id));
      setRolling(false);
      showToast(`Fate says: ${meal.map((m) => m.name).join(' + ')} — ₹${meal.reduce((a, m) => a + m.price, 0)}`, 'success');
      setTimeout(() => setScreen('cart'), 900);
    }, 950);
  };
  const featured = menu.filter((m) => m.popular && m.inStock && (!prefs.vegMode ? true : m.veg));
  const lastDone = myOrders.find((o) => o.done);
  const dealApplied = promo === 'WICKED10';

  // fling a dot from the tapped control into the cart button
  const flyToCart = (e) => {
    const from = e.currentTarget.getBoundingClientRect();
    const to = cartBtnRef.current?.getBoundingClientRect();
    if (!to) return;
    const dot = document.createElement('span');
    dot.className = 'fly-dot';
    dot.style.left = `${from.left + from.width / 2 - 8}px`;
    dot.style.top = `${from.top + from.height / 2 - 8}px`;
    document.body.appendChild(dot);
    requestAnimationFrame(() => {
      dot.style.transform = `translate(${to.left + to.width / 2 - (from.left + from.width / 2)}px, ${
        to.top + to.height / 2 - (from.top + from.height / 2)
      }px) scale(0.35)`;
      dot.style.opacity = '0.25';
    });
    setTimeout(() => dot.remove(), 700);
  };

  const quickAdd = (e, id) => {
    e.stopPropagation();
    flyToCart(e);
    addToCart(id);
  };

  const reorder = (order) => {
    clearCart();
    let skipped = 0;
    for (const l of order.lines) {
      const item = itemById(l.itemId);
      if (item && item.inStock && (!prefs.vegMode || item.veg)) addToCart(l.itemId, l.qty, l.note || undefined);
      else skipped++;
    }
    if (skipped) showToast(`${skipped} item${skipped > 1 ? 's' : ''} skipped (sold out)`, 'success');
    setScreen('cart');
  };

  const openCategory = (cat) => {
    window.__wickedCat = cat;
    setScreen('menu');
  };

  return (
    <div className="px-5 pb-24 space-y-4 overflow-x-clip">
      {/* announcement ticker — pinned to the very top edge, shop-front style */}
      <section className="marquee -mx-5 py-[7px] bg-blue" style={{ borderBottom: '2px solid var(--tileBorder)' }}>
        <div className="marquee-track">
          {[0, 1].map((dup) => (
            <div key={dup} className="flex items-center gap-[30px]">
              {TICKER.map((t) => (
                <React.Fragment key={t}>
                  <span className="font-display text-[11px] tracking-[2px] whitespace-nowrap uppercase text-white">{t}</span>
                  <span className="w-1.5 h-1.5 shrink-0 rotate-45 bg-[#FFD9A0]" />
                </React.Fragment>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* header — logo plate + status line */}
      <header className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <span
            className="w-10 h-10 rounded-md -rotate-3 flex items-center justify-center font-display text-[15px] text-white shrink-0"
            style={{ background: 'var(--blue)', border: '2px solid var(--tileBorder)', boxShadow: '2px 2px 0 var(--shadowInk)' }}
          >
            WC
          </span>
          <div>
            <h1 className="font-display text-[20px] leading-none uppercase">Wicked Chkn</h1>
            <div className="flex items-center gap-1 mt-1 text-[11.5px] font-bold text-sub">
              <MapPin size={12} className="text-blue" />
              BRS Nagar · Open till 10 PM
              {config?.weather && ` · ${config.weather.temp}°`}
            </div>
          </div>
        </div>
        <button
          ref={cartBtnRef}
          className="relative w-11 h-11 rounded-md bg-card border-2 border-line flex items-center justify-center"
          onClick={() => setScreen('cart')}
          aria-label="Cart"
        >
          <ShoppingCart size={19} strokeWidth={2.2} />
          {cartCount > 0 && (
            <span
              key={cartCount}
              className="badge-pop absolute -top-1.5 -right-1.5 min-w-[19px] h-[19px] px-1 rounded-md bg-red text-white text-[11px] font-extrabold flex items-center justify-center"
            >
              {cartCount}
            </span>
          )}
        </button>
      </header>

      {/* closed banner */}
      {config?.storeOpen === false && (
        <div className="rounded-md p-3.5 flex items-center gap-3 text-white" style={{ background: 'var(--hero)' }}>
          <Clock size={18} style={{ color: '#FF9A8C' }} className="shrink-0" />
          <span className="text-[13.5px] font-semibold">
            Ordering is paused right now — we're open 11 AM to 10 PM. You can still build your cart.
          </span>
        </div>
      )}

      {/* active order pill */}
      {activeOrder && !activeOrder.done && (
        <button
          className="w-full rounded-md bg-blue text-white p-3.5 flex items-center gap-2.5 shadow-cta"
          onClick={() => setScreen('tracking')}
        >
          <span className="w-[9px] h-[9px] rounded-full bg-white blink shrink-0" />
          <span className="text-[14px] font-bold flex-1 text-left truncate">
            {activeOrder.num} — {activeOrder.status}
          </span>
          <span className="text-[13px] font-extrabold flex items-center gap-1">
            Track <ArrowRight size={14} />
          </span>
        </button>
      )}

      {/* hero — slim full-bleed poster strip, one job: start the order */}
      <section
        className="relative -mx-5 overflow-hidden text-white"
        style={{
          background: '#D92B21',
          borderTop: '2px solid var(--tileBorder)',
          borderBottom: '2px solid var(--tileBorder)',
          padding: '18px 20px 20px'
        }}
      >
        <span
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'repeating-linear-gradient(-45deg, rgba(74,14,11,.16) 0 14px, transparent 14px 28px)' }}
        />
        <span className="food-float absolute pointer-events-none" style={{ right: -12, top: 14 }}>
          <HeroBurger width={110} />
        </span>
        <h2 className="relative font-display uppercase" style={{ fontSize: 30, lineHeight: 1.02, letterSpacing: '0.5px' }}>
          Wicked. <span style={{ color: 'transparent', WebkitTextStroke: '1.6px #FFF3EC' }}>Crispy.</span>
          <br />
          <span style={{ color: '#FFD9A0' }}>Served hot.</span>
        </h2>
        <p className="relative mt-1.5 text-[12px] font-semibold max-w-[200px]" style={{ color: '#FFE3DC' }}>
          {t('heroCopy', 'Loaded burgers, fat burritos and wicked wedges — order direct and skip the app markups.')}
        </p>
        <div className="relative flex items-center gap-4 mt-3.5">
          <button
            className="rounded-md text-white font-extrabold text-[13.5px] px-4 py-2.5 flex items-center gap-1.5"
            style={{ background: '#4A0E0B', boxShadow: '3px 3px 0 rgba(0,0,0,.35)' }}
            onClick={() => setScreen('menu')}
          >
            {t('startOrder', 'Start order')} <ArrowRight size={14} />
          </button>
          <button
            className="rounded-md font-extrabold text-[13.5px] px-4 py-2.5 flex items-center gap-1.5"
            style={{ background: '#FFF3EC', color: '#4A0E0B', boxShadow: '3px 3px 0 rgba(0,0,0,.35)' }}
            onClick={() => setScreen('chat')}
          >
            <MessageCircle size={14} /> {t('chatOrder', 'Chat order')}
          </button>
        </div>
      </section>

      {/* the menu board — category grid is the centrepiece */}
      <section>
        <SectionHeader title="The menu board" action={t('fullMenu', 'Full menu')} onAction={() => setScreen('menu')} />
        <div className="grid grid-cols-2 gap-3">
          {[
            ['Burgers & Sandwiches', 'double-mutton-cheese', 'linear-gradient(120deg,#8C1710,#D92B21)', 'served with wedges'],
            ['Burritos & Quesadillas', 'chicken-burrito', 'linear-gradient(135deg,#8F3F1B,#C97845)', null],
            ['Wicked Wedges', 'wicked-wedges', 'linear-gradient(135deg,#B85A08,#E07B1A)', null],
            ['Chicken Snacks', 'chicken-wings', 'linear-gradient(135deg,#B86A0C,#E08A26)', null],
            ['Drinks', 'iced-tea-peach', 'linear-gradient(135deg,#0F6FB8,#1F8FE0)', null]
          ].map(([cat, photo, grad, tag], i) => {
            const count = menu.filter((m) => m.category === cat && m.inStock).length;
            const wide = i === 0;
            return (
              <button
                key={cat}
                onClick={() => {
                  buzz(HAPTIC.toggle);
                  openCategory(cat);
                }}
                className={`press-tilt relative overflow-hidden rounded-lg text-left text-white p-3.5 flex flex-col justify-end ${wide ? 'col-span-2 h-[110px]' : 'h-[104px]'}`}
                style={{
                  background: `linear-gradient(rgba(40,6,3,.28), rgba(40,6,3,.74)), url('/food/${photo}.jpg') center/cover, ${grad}`,
                  border: '2px solid var(--tileBorder)',
                  boxShadow: '3px 3px 0 var(--shadowInk)'
                }}
              >
                <div className="relative font-display uppercase text-[15px] leading-tight" style={{ textShadow: '0 2px 8px rgba(0,0,0,.5)' }}>
                  {cat}
                </div>
                <div className="relative text-[11px] font-bold mt-0.5" style={{ color: 'rgba(255,255,255,.92)' }}>
                  {count} items{tag ? ` · ${tag}` : ''}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* stories — owner-posted daily specials, 24h expiry (sticker wall) */}
      {stories.length > 0 && (
        <section className="flex gap-3.5 overflow-x-auto no-scrollbar -mx-5 px-5 pt-1">
          {stories.map((s, i) => (
            <button key={s.id} className="press-tilt shrink-0 flex flex-col items-center gap-1.5 w-[68px]" onClick={() => setStoryIdx(i)}>
              <span
                className={`w-16 h-16 rounded-md flex items-center justify-center text-white font-display text-[20px] ${i % 2 ? 'rotate-2' : '-rotate-2'}`}
                style={{
                  background: STORY_THEMES[s.theme] || STORY_THEMES.fire,
                  border: '2px solid var(--tileBorder)',
                  boxShadow: '3px 3px 0 var(--shadowInk)'
                }}
              >
                {s.caption[0]?.toUpperCase()}
              </span>
              <span className="text-[10px] font-bold text-sub truncate w-full text-center">{s.caption.split(' ').slice(0, 2).join(' ')}</span>
            </button>
          ))}
        </section>
      )}

      {/* bento — coupon + roulette side by side */}
      <section className="grid grid-cols-2 gap-3 items-stretch">
        {/* deal — cut-out coupon, tap to stamp */}
        <div
          className="relative rounded-md cursor-pointer select-none overflow-hidden flex flex-col"
          style={{ background: 'var(--card)', border: '2px dashed var(--blue)', boxShadow: '4px 4px 0 var(--shadowInk)' }}
          role="button"
          tabIndex={0}
          onClick={() => {
            buzz(HAPTIC.toggle);
            setPromo(dealApplied ? '' : 'WICKED10');
          }}
          onKeyDown={(e) => e.key === 'Enter' && setPromo(dealApplied ? '' : 'WICKED10')}
        >
          <div className="bg-blue py-1.5 text-center font-display text-[11px] tracking-[2px] text-white">10% OFF</div>
          <div className="flex-1 p-3 flex flex-col">
            <div className="font-display text-[19px] uppercase text-blue leading-none">WICKED10</div>
            <div className="text-[11px] text-sub font-semibold mt-1">Orders ₹499+</div>
            <div className={`text-[11px] font-extrabold mt-auto pt-2 ${dealApplied ? 'text-blue' : 'text-sub'}`}>
              {dealApplied ? 'APPLIED · tap to remove' : 'Tap coupon to apply'}
            </div>
          </div>
          {dealApplied && (
            <span
              className="stamp-in absolute right-2 top-9 rounded-md px-2 py-0.5 font-display text-[11px] tracking-[1px] text-blue rotate-[-8deg]"
              style={{ border: '2px solid var(--blue)', background: 'var(--blueSoft)' }}
            >
              APPLIED
            </span>
          )}
        </div>

        {/* feed me roulette — compact */}
        <div className="rounded-lg bg-card border-2 border-line p-3 flex flex-col" style={{ boxShadow: '4px 4px 0 var(--shadowInk)' }}>
          <div className="flex items-center gap-2">
            <span
              className={`w-8 h-8 rounded-md flex items-center justify-center text-white shrink-0 ${rolling ? 'dice-roll' : ''}`}
              style={{ background: 'linear-gradient(135deg,#FF8A7A,#D92B21)' }}
            >
              <Dices size={16} />
            </span>
            <div className="min-w-0">
              <div className="text-[13px] font-extrabold leading-tight">Feed me</div>
              <div className="text-[10px] text-sub leading-tight">Budget in, meal out</div>
            </div>
          </div>
          <div className="flex gap-1 mt-2.5">
            {[200, 300, 500].map((b) => (
              <button
                key={b}
                className={`flex-1 rounded-md py-1 text-[10.5px] font-extrabold border-2 ${
                  budget === b ? 'border-blue text-blue bg-bluesoft' : 'border-line text-sub bg-bg'
                }`}
                onClick={() => setBudget(b)}
              >
                ₹{b}
              </button>
            ))}
          </div>
          <button
            className="mt-2.5 rounded-md bg-blue text-white text-[11.5px] font-extrabold py-2 shadow-cta disabled:opacity-60"
            onClick={rollMeal}
            disabled={rolling}
          >
            {rolling ? 'Rolling…' : confirmRoll ? 'Replace cart?' : 'Surprise me'}
          </button>
        </div>
      </section>

      {/* your usual */}
      {lastDone && (
        <section className="bg-card rounded-lg border-2 border-line p-3.5 flex items-center gap-3">
          <span className="w-1.5 self-stretch rounded-full bg-blue shrink-0" />
          <span className="w-[42px] h-[42px] rounded-md bg-bluesoft text-blue flex items-center justify-center shrink-0">
            <RefreshCw size={18} />
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-[13.5px] font-extrabold">Your usual</div>
            <div className="text-[12px] text-sub truncate">{lastDone.lines.map((l) => `${l.qty} × ${l.name}`).join(', ')}</div>
          </div>
          <button className="shrink-0 rounded-md bg-blue text-white text-[12.5px] font-extrabold px-3.5 py-2.5" onClick={() => reorder(lastDone)}>
            Reorder ₹{lastDone.total}
          </button>
        </section>
      )}

      {/* loyalty punch card — signed-in users */}
      {loyalty && phone && (
        <section className="bg-card border-2 border-line rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="text-[13.5px] font-extrabold">Wicked punch card</div>
            <span className="text-[11.5px] font-bold text-sub">
              {loyalty.justEarned ? 'Reward sent by SMS' : `${loyalty.target - loyalty.stamps} to free Wicked Wedges`}
            </span>
          </div>
          <div className="flex gap-2 mt-3">
            {Array.from({ length: loyalty.target }).map((_, i) => {
              const filled = i < loyalty.stamps || loyalty.justEarned;
              return (
                <span
                  key={i}
                  className={`flex-1 aspect-square rounded-md flex items-center justify-center ${filled ? 'stamp-pop' : ''}`}
                  style={
                    filled
                      ? { background: 'linear-gradient(135deg,#FFCF6B,#EF8F2B)', border: '2px solid var(--tileBorder)', animationDelay: `${i * 60}ms` }
                      : { border: '2px dashed var(--line)' }
                  }
                >
                  {filled && FOOD_ART.fries(20)}
                </span>
              );
            })}
          </div>
          <div className="text-[11px] text-sub font-semibold mt-2.5">
            Every 8th order unlocks a treat — automatically, by SMS.
          </div>
        </section>
      )}

      {/* posters — typographic, admin-managed creatives */}
      <section className="flex gap-3 overflow-x-auto no-scrollbar -mx-5 px-5">
        {[
          { big: 'WING WEDNESDAYS', small: 'Mild or hot — crispy wings ₹249', word: 'HOT', bg: 'linear-gradient(120deg,#3A1B10 10%,#C0392B 110%)' },
          { big: 'BURRITO O’CLOCK', small: 'Fat burritos, cheese, beans & rice', word: '₹349', bg: 'linear-gradient(120deg,#4A0E0B 25%,#D92B21 110%)' }
        ].map((p, i) => (
          <div
            key={i}
            className="relative overflow-hidden shrink-0 rounded-lg text-white flex flex-col justify-end p-4"
            style={{ width: 280, height: 150, background: p.bg, border: '2px solid var(--tileBorder)', boxShadow: '4px 4px 0 var(--shadowInk)' }}
          >
            <span className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(70% 70% at 85% 15%, rgba(255,255,255,.14), transparent 60%)' }} />
            <span
              className="absolute font-display font-extrabold select-none"
              style={{ fontSize: 76, right: -8, top: -16, color: 'transparent', WebkitTextStroke: '2px rgba(255,255,255,.25)', transform: 'rotate(6deg)', letterSpacing: '-3px' }}
            >
              {p.word}
            </span>
            <div className="relative font-display font-extrabold text-[19px] leading-tight">{p.big}</div>
            <div className="relative text-[12px]" style={{ color: 'rgba(255,255,255,.75)' }}>
              {p.small}
            </div>
          </div>
        ))}
      </section>

      {/* for you — AI picks as a receipt-style list (hidden when admin disables Dish Recommendations) */}
      {config?.recommendEnabled && recs.length > 0 && (
        <section>
          <SectionHeader title={t('forYou', 'For you')} badge="AI PICKS" />
          <div className="bg-card border-2 border-line rounded-lg divide-y-2 divide-line overflow-hidden" style={{ boxShadow: '3px 3px 0 var(--shadowInk)' }}>
            {recs.slice(0, 4).map((item) => {
              const qty = cart[item.id]?.qty || 0;
              return (
                <div key={item.id} className="flex items-center gap-3 p-3">
                  <button className="flex-1 min-w-0 text-left" onClick={() => setSheetItem(itemById(item.id) || item)}>
                    <div className="text-[13px] font-bold truncate">{item.name}</div>
                    <div className="text-[11px] text-sub truncate mt-0.5">{item.reason}</div>
                  </button>
                  <span className="font-display text-[14px] text-blue shrink-0">₹{item.price}</span>
                  {qty > 0 ? (
                    <Stepper qty={qty} size={28} onInc={() => addToCart(item.id)} onDec={() => decCart(item.id)} />
                  ) : (
                    <button
                      className="shrink-0 rounded-md bg-blue text-white w-7 h-7 flex items-center justify-center press-sm"
                      onClick={(e) => quickAdd(e, item.id)}
                      aria-label={`Add ${item.name}`}
                    >
                      <Plus size={15} strokeWidth={2.6} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* most wicked — 2-up sticker grid, no carousel */}
      <section>
        <SectionHeader title={t('mostSmashed', 'Most wicked')} action={t('fullMenu', 'Full menu')} onAction={() => setScreen('menu')} />
        <div className="grid grid-cols-2 gap-3 gap-y-4 py-1">
          {featured.slice(0, 6).map((item, i) => {
            const qty = cart[item.id]?.qty || 0;
            return (
              <button
                key={item.id}
                className={`press-tilt bg-card border-2 border-line rounded-lg p-3 text-left ${i % 2 ? '-rotate-[0.8deg]' : 'rotate-[0.8deg]'}`}
                onClick={() => setSheetItem(item)}
              >
                <div className="relative">
                  <Tile item={item} size={96} radius={8} fullWidth />
                  <span className="absolute -bottom-2.5 left-2 bg-card rounded-md px-2.5 py-0.5 font-display text-[13.5px] -rotate-2" style={{ border: '2px solid var(--tileBorder)' }}>
                    ₹{item.price}
                  </span>
                  {qty > 0 ? (
                    <span className="absolute -bottom-3 right-1" onClick={(e) => e.stopPropagation()}>
                      <Stepper qty={qty} size={30} onInc={() => addToCart(item.id)} onDec={() => decCart(item.id)} />
                    </span>
                  ) : (
                    <span
                      role="button"
                      aria-label={`Add ${item.name}`}
                      className="absolute -bottom-3 right-1 w-9 h-9 rounded-md bg-blue text-white flex items-center justify-center shadow-cta press-sm"
                      onClick={(e) => quickAdd(e, item.id)}
                    >
                      <Plus size={17} strokeWidth={2.6} />
                    </span>
                  )}
                </div>
                <div className="text-[13px] font-bold mt-4 truncate">{item.name}</div>
              </button>
            );
          })}
        </div>
      </section>

      {/* story viewer */}
      {storyIdx != null && stories[storyIdx] && (
        <StoryViewer
          story={stories[storyIdx]}
          index={storyIdx}
          count={stories.length}
          onNext={() => setStoryIdx(storyIdx + 1 < stories.length ? storyIdx + 1 : null)}
          onClose={() => setStoryIdx(null)}
        />
      )}

      {/* shop-front footer board — website-style sign-off, nothing like the info tiles */}
      <section
        className="-mx-5 -mb-24 text-white relative overflow-hidden"
        style={{ background: 'var(--hero)', borderTop: '2px solid var(--tileBorder)', padding: '24px 20px 112px' }}
      >
        <span
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'repeating-linear-gradient(-45deg, rgba(255,255,255,.025) 0 16px, transparent 16px 32px)' }}
        />
        <div className="relative flex items-center gap-2.5">
          <span
            className="w-9 h-9 rounded-md rotate-3 flex items-center justify-center font-display text-[14px] text-white"
            style={{ background: 'var(--blue)', border: '2px solid rgba(255,255,255,.25)' }}
          >
            WC
          </span>
          <span className="font-display uppercase text-[17px] tracking-[0.5px]">Wicked Chkn</span>
        </div>
        <div className="relative font-display uppercase mt-3" style={{ fontSize: 27, lineHeight: 1.02, color: '#FF8A7A' }}>
          Wicked. Crispy.
          <br />
          Served hot.
        </div>
        <div className="relative mt-4 space-y-2.5 text-[12.5px] font-semibold" style={{ color: '#E8B8B0' }}>
          <div className="flex items-center gap-2.5">
            <Clock size={14} className="shrink-0" /> Open daily · 11 AM – 10 PM
          </div>
          <div className="flex items-center gap-2.5">
            <Bike size={14} className="shrink-0" /> Delivery within 7 km · flat ₹35
          </div>
          <div className="flex items-center gap-2.5">
            <MapPin size={14} className="shrink-0" /> Down Town Market, BRS Nagar, Ludhiana
          </div>
        </div>
        <div className="relative flex gap-2.5 mt-5">
          <a
            href="tel:+911610000000"
            className="rounded-md bg-blue text-white text-[12.5px] font-extrabold px-4 py-2.5 flex items-center gap-1.5"
            style={{ boxShadow: '3px 3px 0 rgba(0,0,0,.35)' }}
          >
            <Phone size={13} /> Call us
          </a>
          <button
            className="rounded-md text-[12.5px] font-extrabold px-4 py-2.5 flex items-center gap-1.5"
            style={{ background: '#FFF3EC', color: '#4A0E0B', boxShadow: '3px 3px 0 rgba(0,0,0,.35)' }}
            onClick={() => setScreen('chat')}
          >
            <MessageCircle size={13} /> Chat with us
          </button>
        </div>
        <div className="relative mt-6 text-[9.5px] font-extrabold tracking-[2.5px] uppercase" style={{ color: 'rgba(255,255,255,.35)' }}>
          Order direct · Skip aggregator fees
        </div>
      </section>

      {/* mini cart bar — same behaviour as the menu screen */}
      {cartCount > 0 && (
        <button
          className="sheet-up fixed bottom-[84px] inset-x-0 max-w-[420px] mx-auto z-20 flex items-center gap-3 rounded-lg text-white p-3.5 shadow-lg"
          style={{ background: 'var(--blue)', width: 'calc(100% - 40px)', left: 0, right: 0, marginLeft: 'auto', marginRight: 'auto', maxWidth: 380, border: '2px solid var(--tileBorder)' }}
          onClick={() => setScreen('cart')}
        >
          <ShoppingCart size={18} />
          <span className="flex-1 text-left text-[13.5px] font-bold">
            {cartCount} item{cartCount > 1 ? 's' : ''} · ₹{total}
          </span>
          <span className="text-[13.5px] font-extrabold">View cart →</span>
        </button>
      )}
    </div>
  );
}

// fullscreen story viewer with auto-advance
function StoryViewer({ story, index, count, onNext, onClose }) {
  React.useEffect(() => {
    const t = setTimeout(onNext, 5000);
    return () => clearTimeout(t);
  }, [story.id, onNext]);
  return (
    <div className="fixed inset-0 z-50 max-w-[420px] mx-auto flex flex-col" style={{ background: STORY_THEMES[story.theme] || STORY_THEMES.fire }} onClick={onNext}>
      <div className="flex gap-1.5 p-3 pt-4">
        {Array.from({ length: count }).map((_, i) => (
          <span key={i} className="flex-1 h-[3px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,.3)' }}>
            {i === index && <span className="block h-full bg-white progress-anim" style={{ width: '100%', animation: 'sb-story-bar 5s linear' }} />}
            {i < index && <span className="block h-full bg-white w-full" />}
          </span>
        ))}
      </div>
      <div className="flex items-center gap-2.5 px-4">
        <span className="w-9 h-9 rounded-md bg-blue text-white font-display font-extrabold text-[13px] flex items-center justify-center">WC</span>
        <span className="text-white text-[13px] font-extrabold flex-1">Wicked Chkn</span>
        <button
          className="text-white text-[24px] leading-none font-bold px-2"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          aria-label="Close"
        >
          ×
        </button>
      </div>
      <div className="flex-1 flex items-center justify-center px-8 pb-16">
        <div className="font-display font-extrabold text-white text-center" style={{ fontSize: 34, lineHeight: 1.15, textShadow: '0 4px 24px rgba(0,0,0,.35)' }}>
          {story.caption}
        </div>
      </div>
    </div>
  );
}

// layered illustrated burger for the hero (drawn, not emoji)
function HeroBurger({ width = 140 }) {
  return (
    <svg width={width} viewBox="0 0 120 100" aria-hidden="true">
      <ellipse cx="60" cy="94" rx="42" ry="6" fill="rgba(0,0,0,.3)" />
      <rect x="22" y="77" width="76" height="13" rx="6.5" fill="#E89A4B" />
      <rect x="20" y="62" width="80" height="13" rx="6.5" fill="#6E3A1E" />
      <circle cx="38" cy="68" r="1.6" fill="rgba(0,0,0,.35)" />
      <circle cx="60" cy="70" r="1.6" fill="rgba(0,0,0,.35)" />
      <circle cx="82" cy="68" r="1.6" fill="rgba(0,0,0,.35)" />
      <path d="M22 56h76v4l-8 12-8-10-8 12-8-10-8 12-8-10-8 12-8-10-8 8z" fill="#FFC93C" />
      <rect x="24" y="52" width="72" height="7" rx="3.5" fill="#E4573D" />
      <path d="M16 48h88v3q-5 6-11 0t-11 0t-11 0t-11 0t-11 0t-11 0t-11 0t-11 0z" fill="#7BC96F" />
      <path d="M16 44a44 32 0 0 1 88 0v6H16z" fill="#F5A95B" />
      <path d="M34 25a30 15 0 0 1 22-8" stroke="#FFD9A0" strokeWidth="5" strokeLinecap="round" fill="none" opacity="0.85" />
      <ellipse cx="44" cy="30" rx="3" ry="2" fill="#FFE9C9" />
      <ellipse cx="62" cy="24" rx="3" ry="2" fill="#FFE9C9" />
      <ellipse cx="80" cy="31" rx="3" ry="2" fill="#FFE9C9" />
    </svg>
  );
}
