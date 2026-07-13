import React from 'react';
import { useStore } from '../store.jsx';
import { Sheet } from '../components/Overlays.jsx';

// Simulated Razorpay hosted checkout — replaced by the real widget when the
// server has RAZORPAY keys (see Checkout.jsx / openRazorpay).
export default function PaySheet() {
  const { paySheet, setPaySheet } = useStore();
  if (!paySheet) return null;

  return (
    <Sheet onClose={() => paySheet.onResult(false)} closeButton={false}>
      <div className="rounded-t-lg overflow-hidden">
        <div className="p-5 text-white" style={{ background: '#10141F' }}>
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-md bg-blue flex items-center justify-center font-display font-extrabold text-[15px]">WC</span>
            <div>
              <div className="text-[14px] font-extrabold">Wicked Chkn</div>
              <div className="text-[11.5px] opacity-60">Razorpay secure checkout · simulated</div>
            </div>
          </div>
          <div className="mt-5 text-[12px] opacity-60">Amount payable</div>
          <div className="font-display font-extrabold text-[30px]">₹{paySheet.amount}</div>
        </div>
        <div className="p-5 space-y-2.5">
          <div className="text-[12px] text-sub font-semibold text-center">
            This is the prototype payment sheet — production opens the real Razorpay checkout with UPI, cards and netbanking.
          </div>
          <button
            className="w-full rounded-md bg-green text-white font-extrabold text-[14.5px] h-12"
            onClick={() => paySheet.onResult(true)}
          >
            Simulate successful payment
          </button>
          <button
            className="w-full rounded-md bg-card border-2 border-line text-red font-extrabold text-[14.5px] h-12"
            onClick={() => paySheet.onResult(false)}
          >
            Simulate failed payment
          </button>
        </div>
      </div>
    </Sheet>
  );
}
