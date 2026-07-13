import React, { useState } from 'react';
import { Printer, Check } from 'lucide-react';
import { useAdmin } from '../store.jsx';
import { api, fmtTime, fmtMoney } from '../api.js';

const FILTERS = [
  { key: 'all', label: 'All', test: () => true },
  { key: 'new', label: 'Needs action', test: (o) => o.statusIdx === 0 && !o.cancelled },
  { key: 'active', label: 'In progress', test: (o) => !o.done && o.statusIdx > 0 && !o.cancelled },
  { key: 'done', label: 'Completed', test: (o) => o.done && !o.cancelled }
];

export default function LiveOrders() {
  const { orders, refreshOrders } = useAdmin();
  const [kotOrder, setKotOrder] = useState(null);
  const [confirming, setConfirming] = useState(null); // order id awaiting stage confirm
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState('all');
  const visible = orders.filter(FILTERS.find((f) => f.key === filter).test);

  const act = async (order, action) => {
    if (busy) return;
    setBusy(true);
    try {
      await api.patch(`/admin/orders/${order.id}`, { action });
      await refreshOrders();
    } catch (e) {
      alert(e.message);
    } finally {
      setBusy(false);
      setConfirming(null);
    }
  };

  if (orders.length === 0) {
    return (
      <div className="bg-card border-[1.5px] border-line rounded-2xl p-12 text-center text-sub text-[13.5px] font-semibold">
        No orders yet — place one in the customer app and it lands here instantly.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {FILTERS.map((f) => {
          const n = orders.filter(f.test).length;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-full px-4 py-2 text-[12.5px] font-extrabold ${
                filter === f.key ? 'bg-navy text-white' : 'bg-card border-[1.5px] border-line text-sub'
              }`}
            >
              {f.label} {n > 0 && <span className="opacity-70">· {n}</span>}
            </button>
          );
        })}
      </div>
      {visible.length === 0 && (
        <div className="bg-card border-[1.5px] border-line rounded-2xl p-8 text-center text-sub text-[13px] font-semibold">
          Nothing here right now.
        </div>
      )}
      {visible.map((o) => {
        const placed = o.statusIdx === 0 && !o.cancelled;
        const nextStage = o.flow[o.statusIdx + 1];
        const typeLabel = { dinein: 'Dine-in', pickup: 'Pickup', delivery: 'Delivery' }[o.type];
        return (
          <div
            key={o.id}
            className={`bg-card rounded-2xl p-5 border-[1.5px] ${placed ? 'border-red' : 'border-line'} ${o.cancelled ? 'opacity-70' : ''}`}
          >
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-display font-extrabold text-[17px]">{o.num}</span>
              <span
                className={`rounded-full px-2.5 py-1 text-[10.5px] font-extrabold ${
                  o.cancelled ? 'bg-redfill text-red' : placed ? 'bg-redfill text-red' : o.done ? 'bg-greenfill text-greendark' : 'bg-bluesoft text-blue'
                }`}
              >
                {o.cancelled ? `CANCELLED · ${o.cancelled.reason}` : o.status}
              </span>
              <span className="text-[12px] font-semibold text-sub flex-1">
                {typeLabel} · {fmtTime(o.createdAt)} · {o.payMethod === 'online' ? 'Paid online' : 'Cash'}
                {o.promoCode ? ` · ${o.promoCode}` : ''}
              </span>
              <span className="font-display font-extrabold text-[17px]">{fmtMoney(o.total)}</span>
            </div>

            <div className="mt-2 text-[13px] font-semibold">
              {o.lines.map((l) => `${l.qty} × ${l.name}${l.mods?.length ? ` (${l.mods.join(', ')})` : ''}`).join(' · ')}
            </div>
            {o.arrived && (
              <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-extrabold" style={{ background: '#FFF9F0', border: '1.5px solid #F2D8A8', color: '#8A5A16' }}>
                Customer is outside{o.arrived.note ? ` · ${o.arrived.note}` : ''}
              </div>
            )}
            {o.rating && (
              <div className="mt-1.5 text-[12px] font-bold" style={{ color: '#F2A93B' }}>
                {'★'.repeat(o.rating.stars)}
                {'☆'.repeat(5 - o.rating.stars)}
                {o.rating.tags.length > 0 && <span className="text-sub font-semibold"> · {o.rating.tags.join(', ')}</span>}
              </div>
            )}
            {o.lines.some((l) => l.note) && (
              <div className="mt-1 text-[12px] text-sub font-semibold">
                Notes: {o.lines.filter((l) => l.note).map((l) => `${l.name}: “${l.note}”`).join(' · ')}
              </div>
            )}
            <div className="mt-1 text-[12px] text-sub font-semibold">
              {o.customer.name} · {o.customer.phone}
              {o.address ? ` · ${o.address}` : ''}
              {o.tableNo ? ` · Table ${o.tableNo}` : ''}
              {o.type === 'pickup' ? ' · Pickup at counter' : ''}
            </div>

            {/* action flow */}
            <div className="mt-4 flex items-center gap-2.5 flex-wrap">
              {o.cancelled && <span className="text-[12.5px] font-bold text-sub">No actions — customer was notified{o.payMethod === 'online' ? ' and the refund flagged' : ''}.</span>}
              {placed && (
                <button
                  className="rounded-xl bg-blue text-white text-[13px] font-extrabold px-4 py-2.5 disabled:opacity-60"
                  onClick={() => act(o, 'accept')}
                  disabled={busy}
                >
                  Accept order
                </button>
              )}

              {!o.cancelled && !placed && !o.kotPrinted && (
                <button
                  className="rounded-xl bg-navy text-white text-[13px] font-extrabold px-4 py-2.5 flex items-center gap-2"
                  onClick={() => setKotOrder(o)}
                >
                  <Printer size={15} /> Print KOT
                </button>
              )}

              {!o.cancelled && o.kotPrinted && (
                <>
                  <span className="text-greendark text-[12.5px] font-extrabold flex items-center gap-1">
                    <Check size={14} strokeWidth={3} /> KOT printed
                  </span>
                  <button
                    className="rounded-xl border-[1.5px] border-line text-sub text-[12.5px] font-extrabold px-3.5 py-2"
                    onClick={() => setKotOrder(o)}
                  >
                    Reprint KOT
                  </button>
                </>
              )}

              {o.type === 'delivery' && !o.cancelled && !placed && !o.done && (
                o.rider ? (
                  <span className="text-[12.5px] font-bold text-sub">Rider: {o.rider.name}{o.rider.phone ? ` · ${o.rider.phone}` : ''}</span>
                ) : (
                  <RiderAssign orderId={o.id} onDone={refreshOrders} />
                )
              )}

              {!o.cancelled && !placed && !o.done && nextStage && (
                confirming === o.id ? (
                  <span className="flex items-center gap-2 text-[12.5px] font-bold">
                    Move to “{nextStage}”?
                    <button
                      className="rounded-lg bg-green text-white font-extrabold px-3 py-1.5 disabled:opacity-60"
                      onClick={() => act(o, 'advance')}
                      disabled={busy}
                    >
                      Confirm
                    </button>
                    <button className="rounded-lg border-[1.5px] border-line font-extrabold px-3 py-1.5" onClick={() => setConfirming(null)}>
                      Cancel
                    </button>
                  </span>
                ) : (
                  <button
                    className="rounded-xl border-[1.5px] border-blue text-blue text-[13px] font-extrabold px-4 py-2.5"
                    onClick={() => setConfirming(o.id)}
                  >
                    Mark “{nextStage}”
                  </button>
                )
              )}

              {!o.cancelled && !o.done && <CancelControl orderId={o.id} onDone={refreshOrders} />}
            </div>
          </div>
        );
      })}

      {kotOrder && (
        <KotModal
          order={kotOrder}
          onClose={() => setKotOrder(null)}
          onPrint={async () => {
            await act(kotOrder, 'kot');
            setKotOrder(null);
          }}
        />
      )}
    </div>
  );
}

// cancel with a reason — customer is SMS'd, metrics exclude the order
function CancelControl({ orderId, onDone }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  if (!open)
    return (
      <button className="ml-auto text-red text-[12px] font-extrabold px-2" onClick={() => setOpen(true)}>
        Cancel order
      </button>
    );
  return (
    <span className="ml-auto flex items-center gap-2">
      <input
        className="w-[200px] bg-page border-[1.5px] border-line rounded-lg px-2.5 h-9 text-[12.5px] font-bold outline-none"
        placeholder="Reason (sent to customer)"
        value={reason}
        onChange={(e) => setReason(e.target.value.slice(0, 120))}
        autoFocus
      />
      <button
        className="rounded-lg bg-red text-white text-[12px] font-extrabold px-3 h-9"
        onClick={async () => {
          try {
            await api.patch(`/admin/orders/${orderId}`, { action: 'cancel', reason });
            onDone();
          } catch (e) {
            alert(e.message);
          }
        }}
      >
        Confirm cancel
      </button>
      <button className="rounded-lg border-[1.5px] border-line text-sub text-[12px] font-extrabold px-3 h-9" onClick={() => setOpen(false)}>
        Keep
      </button>
    </span>
  );
}

function RiderAssign({ orderId, onDone }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  if (!open)
    return (
      <button className="rounded-xl border-[1.5px] border-line text-sub text-[12.5px] font-extrabold px-3.5 py-2" onClick={() => setOpen(true)}>
        Assign rider
      </button>
    );
  return (
    <span className="flex items-center gap-2">
      <input
        className="w-[120px] bg-page border-[1.5px] border-line rounded-lg px-2.5 h-9 text-[12.5px] font-bold outline-none"
        placeholder="Rider name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus
      />
      <input
        className="w-[120px] bg-page border-[1.5px] border-line rounded-lg px-2.5 h-9 text-[12.5px] font-bold outline-none"
        placeholder="Phone"
        inputMode="numeric"
        value={phone}
        onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
      />
      <button
        className="rounded-lg bg-blue text-white text-[12px] font-extrabold px-3 h-9 disabled:opacity-50"
        disabled={!name.trim()}
        onClick={async () => {
          try {
            await api.patch(`/admin/orders/${orderId}`, { action: 'rider', name, phone });
            onDone();
          } catch (e) {
            alert(e.message);
          }
        }}
      >
        Save
      </button>
    </span>
  );
}

function KotModal({ order, onClose, onPrint }) {
  const typeLabel = { dinein: 'DINE-IN', pickup: 'PICKUP', delivery: 'DELIVERY' }[order.type];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(10,20,36,.5)' }} onClick={onClose}>
      <div className="bg-white rounded-2xl p-5 w-[320px]" onClick={(e) => e.stopPropagation()}>
        <div className="kot-ticket text-[12px] leading-relaxed border-[1.5px] border-line rounded-lg p-4 bg-[#FDFDF8]">
          <div className="text-center font-bold">WICKED CHKN</div>
          <div className="text-center">KITCHEN ORDER TICKET</div>
          <div className="border-t border-dashed border-line my-2" />
          <div>{order.num}</div>
          <div>
            {typeLabel}
            {order.tableNo ? ` · TABLE ${order.tableNo}` : ''}
          </div>
          <div>{fmtTime(order.createdAt)}</div>
          <div className="border-t border-dashed border-line my-2" />
          {order.lines.map((l) => (
            <div key={l.id}>
              <div className="flex justify-between">
                <span>{l.name}</span>
                <span>× {l.qty}</span>
              </div>
              {l.mods?.length > 0 && <div className="pl-2">&gt; {l.mods.join(', ')}</div>}
            </div>
          ))}
          {order.lines.some((l) => l.note) && (
            <>
              <div className="border-t border-dashed border-line my-2" />
              {order.lines
                .filter((l) => l.note)
                .map((l) => (
                  <div key={l.id}>NOTE: {l.note}</div>
                ))}
            </>
          )}
          <div className="border-t border-dashed border-line my-2" />
          <div className="text-center">— {order.customer.name} —</div>
        </div>
        <button className="w-full mt-4 rounded-xl bg-navy text-white text-[13px] font-extrabold py-3" onClick={onPrint}>
          Send to kitchen printer
        </button>
        <div className="text-[10.5px] text-sub text-center mt-2 font-semibold">
          Production: ESC/POS thermal printer (80mm) via print server or Bluetooth
        </div>
      </div>
    </div>
  );
}
