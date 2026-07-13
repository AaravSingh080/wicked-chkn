import React, { useState } from 'react';
import { Search, Plus, Pencil } from 'lucide-react';
import { useAdmin } from '../store.jsx';
import { api } from '../api.js';

const CATEGORIES = [
  'Burgers & Sandwiches', 'Burritos & Quesadillas', 'Wicked Wedges', 'Chicken Snacks', 'Drinks'
];

export default function Inventory() {
  const { menu, refreshMenu } = useAdmin();
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(null); // item object | 'new'

  const filtered = menu.filter(
    (m) => !q || m.name.toLowerCase().includes(q.toLowerCase()) || m.category.toLowerCase().includes(q.toLowerCase())
  );
  const soldOut = menu.filter((m) => !m.inStock).length;

  const toggle = async (item) => {
    await api.put(`/admin/menu/${item.id}/stock`, { inStock: !item.inStock });
    refreshMenu();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2.5 bg-card border-[1.5px] border-line rounded-xl px-3.5 h-11 w-[340px]">
          <Search size={15} className="text-sub" />
          <input
            className="flex-1 bg-transparent outline-none text-[13px] font-semibold placeholder:text-sub"
            placeholder="Search by name or category…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        {soldOut > 0 && (
          <span className="rounded-full bg-redfill text-red px-3 py-1.5 text-[11.5px] font-extrabold">{soldOut} sold out</span>
        )}
        <span className="flex-1" />
        <span className="text-[12px] font-semibold text-sub">Toggles update the customer app in ≤2s</span>
        <button
          className="rounded-xl bg-blue text-white text-[13px] font-extrabold px-4 h-11 flex items-center gap-1.5"
          onClick={() => setEditing('new')}
        >
          <Plus size={15} strokeWidth={2.6} /> Add item
        </button>
      </div>

      <div className="bg-card border-[1.5px] border-line rounded-2xl overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="bg-thead text-left text-[11px] font-extrabold text-sub uppercase tracking-wide">
              <th className="px-5 py-3 w-10"></th>
              <th className="px-2 py-3">Item</th>
              <th className="px-2 py-3">Category</th>
              <th className="px-2 py-3">Price</th>
              <th className="px-2 py-3">Portions left</th>
              <th className="px-5 py-3 text-right">In stock</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => (
              <tr key={item.id} className={`border-t border-line ${item.inStock ? '' : 'opacity-55'}`}>
                <td className="px-5 py-3">
                  <VegMark veg={item.veg} />
                </td>
                <td className="px-2 py-3 font-bold">
                  <button className="flex items-center gap-2 text-left group" onClick={() => setEditing(item)}>
                    {item.name}
                    <Pencil size={12} className="text-sub opacity-0 group-hover:opacity-100" />
                  </button>
                </td>
                <td className="px-2 py-3 text-sub font-semibold">{item.category}</td>
                <td className="px-2 py-3 font-display font-bold">₹{item.price}</td>
                <td className="px-2 py-3">
                  <span className="inline-flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max="999"
                      className="w-[64px] bg-page border-[1.5px] border-line rounded-lg px-2 h-8 text-[12.5px] font-bold outline-none"
                      placeholder="—"
                      defaultValue={item.stockCount ?? ''}
                      key={item.id + ':' + (item.stockCount ?? 'off')}
                      onBlur={async (e) => {
                        const v = e.target.value.trim();
                        const next = v === '' ? null : Number(v);
                        if (next === (item.stockCount ?? null)) return;
                        await api.put(`/admin/menu/${item.id}/stock-count`, { count: next });
                        refreshMenu();
                      }}
                    />
                    {item.stockCount != null && item.stockCount <= 5 && item.stockCount > 0 && (
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-extrabold" style={{ background: '#FFF9F0', border: '1px solid #F2D8A8', color: '#8A5A16' }}>
                        LOW
                      </span>
                    )}
                  </span>
                </td>
                <td className="px-5 py-3 text-right">
                  <button
                    onClick={() => toggle(item)}
                    className="relative rounded-full transition-colors duration-200 align-middle"
                    style={{ width: 44, height: 25, background: item.inStock ? '#1FA45C' : '#F0D9D5' }}
                    role="switch"
                    aria-checked={item.inStock}
                  >
                    <span
                      className="absolute top-[3px] rounded-full bg-white shadow transition-all duration-200"
                      style={{ width: 19, height: 19, left: item.inStock ? 22 : 3 }}
                    />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && <ItemEditor item={editing} onClose={() => setEditing(null)} onSaved={refreshMenu} />}
    </div>
  );
}

// create / edit modal with photo upload
function ItemEditor({ item, onClose, onSaved }) {
  const isNew = item === 'new';
  const [f, setF] = useState(
    isNew
      ? { name: '', price: '', category: CATEGORIES[0], veg: false, spicy: false, popular: false, desc: '' }
      : { name: item.name, price: item.price, category: item.category, veg: item.veg, spicy: item.spicy, popular: item.popular, desc: item.desc || '' }
  );
  const [photo, setPhoto] = useState(null); // dataUrl pending upload
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const currentPhoto = photo || (!isNew && item.imageUrl) || null;

  const pickPhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) return setErr('Keep photos under 3 MB.');
    const reader = new FileReader();
    reader.onload = () => setPhoto(reader.result);
    reader.readAsDataURL(file);
  };

  const save = async () => {
    setErr('');
    setBusy(true);
    try {
      let id = isNew ? null : item.id;
      if (isNew) id = (await api.post('/admin/menu', f)).id;
      else await api.put(`/admin/menu/${id}`, f);
      if (photo) await api.put(`/admin/menu/${id}/photo`, { dataUrl: photo });
      onSaved();
      onClose();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const del = async () => {
    if (!window.confirm(`Delete "${item.name}" from the menu?`)) return;
    try {
      const r = await fetch(`/api/admin/menu/${item.id}`, {
        method: 'DELETE',
        headers: { 'x-admin-token': localStorage.getItem('sb_admin_token') }
      });
      if (!r.ok) throw new Error((await r.json()).error);
      onSaved();
      onClose();
    } catch (e) {
      setErr(e.message);
    }
  };

  const inCls = 'w-full bg-page border-[1.5px] border-line rounded-xl px-3 h-11 text-[13px] font-bold outline-none';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: 'rgba(10,20,36,.5)' }} onClick={onClose}>
      <div className="bg-card rounded-2xl p-6 w-[520px] max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-display font-extrabold text-[18px] mb-4">{isNew ? 'Add menu item' : `Edit ${item.name}`}</h2>
        <div className="space-y-3">
          <div className="flex gap-3">
            <input className={inCls} placeholder="Item name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            <input className={inCls + ' w-[110px] shrink-0'} placeholder="₹ Price" inputMode="numeric" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value.replace(/\D/g, '') })} />
          </div>
          <select className={inCls} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <textarea className="w-full bg-page border-[1.5px] border-line rounded-xl p-3 text-[13px] font-semibold outline-none min-h-[70px]" placeholder="Short description" value={f.desc} onChange={(e) => setF({ ...f, desc: e.target.value.slice(0, 200) })} />
          <div className="flex gap-4">
            {[
              ['veg', 'Veg'],
              ['spicy', 'Spicy'],
              ['popular', 'Popular']
            ].map(([k, label]) => (
              <label key={k} className="flex items-center gap-2 text-[13px] font-bold cursor-pointer">
                <input type="checkbox" checked={!!f[k]} onChange={(e) => setF({ ...f, [k]: e.target.checked })} className="w-4 h-4 accent-[#D92B21]" />
                {label}
              </label>
            ))}
          </div>
          {/* photo */}
          <div className="flex items-center gap-3">
            <div className="w-20 h-20 rounded-xl bg-page border-[1.5px] border-line overflow-hidden flex items-center justify-center shrink-0">
              {currentPhoto ? <img src={currentPhoto} alt="" className="w-full h-full object-cover" /> : <span className="text-[10px] text-sub font-bold text-center px-1">No photo</span>}
            </div>
            <label className="rounded-xl border-[1.5px] border-blue text-blue text-[12.5px] font-extrabold px-3.5 py-2.5 cursor-pointer">
              {currentPhoto ? 'Change photo' : 'Upload photo'}
              <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={pickPhoto} />
            </label>
            {!isNew && item.imageUrl && !photo && (
              <button
                className="text-red text-[12px] font-extrabold"
                onClick={async () => {
                  await api.put(`/admin/menu/${item.id}/photo`, { remove: true });
                  onSaved();
                  onClose();
                }}
              >
                Remove photo
              </button>
            )}
            <span className="text-[11px] text-sub font-semibold flex-1">JPG/PNG/WebP · square crops look best · shows in the app instantly</span>
          </div>
          {err && <div className="text-red text-[12.5px] font-bold">{err}</div>}
          <div className="flex gap-2.5 pt-1">
            {!isNew && (
              <button className="rounded-xl border-[1.5px] border-red text-red text-[13px] font-extrabold px-4 h-11" onClick={del}>
                Delete
              </button>
            )}
            <span className="flex-1" />
            <button className="rounded-xl border-[1.5px] border-line text-sub text-[13px] font-extrabold px-4 h-11" onClick={onClose}>
              Cancel
            </button>
            <button className="rounded-xl bg-blue text-white text-[13px] font-extrabold px-5 h-11 disabled:opacity-60" onClick={save} disabled={busy}>
              {busy ? 'Saving…' : isNew ? 'Add to menu' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function VegMark({ veg }) {
  const color = veg ? '#1FA45C' : '#C0392B';
  return (
    <span className="inline-flex items-center justify-center rounded-[3px]" style={{ width: 13, height: 13, border: `1.5px solid ${color}` }}>
      <span className="rounded-full" style={{ width: 6, height: 6, background: color }} />
    </span>
  );
}
