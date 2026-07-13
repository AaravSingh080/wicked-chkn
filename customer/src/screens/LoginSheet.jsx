import React, { useState } from 'react';
import { Apple } from 'lucide-react';
import { useStore } from '../store.jsx';
import { Sheet } from '../components/Overlays.jsx';
import { api } from '../api.js';

// Steps: method (Apple / Google / phone form) → code (OTP)
//        social-connect (provider handshake) → social-phone (link number)
export default function LoginSheet() {
  const { showLogin, setShowLogin, signIn } = useStore();
  const [step, setStep] = useState('method');
  const [provider, setProvider] = useState(null); // 'apple' | 'google'
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [devHint, setDevHint] = useState('');

  if (!showLogin) return null;

  const reset = () => {
    setStep('method');
    setProvider(null);
    setCode('');
    setError('');
    setDevHint('');
  };
  const close = () => {
    setShowLogin(false);
    reset();
    setName('');
    setPhone('');
  };

  const startSocial = (p) => {
    setProvider(p);
    setError('');
    setStep('social-connect');
    // Demo: simulated OAuth handshake. Production swaps this for Sign in with
    // Apple / Google Identity Services and verifies the ID token server-side.
    setTimeout(() => setStep('social-phone'), 1100);
  };

  const finishSocial = async () => {
    setError('');
    if (phone.length !== 10) return setError('Enter a 10-digit phone number.');
    setBusy(true);
    try {
      const res = await api.post('/auth/social', { provider, phone, name });
      signIn(res);
      close();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const sendOtp = async () => {
    setError('');
    if (name.trim().length < 2) return setError('Add your name (at least 2 characters).');
    if (phone.length !== 10) return setError('Enter a 10-digit phone number.');
    setBusy(true);
    try {
      const res = await api.post('/auth/otp', { phone, name });
      if (res.devCode) setDevHint(`Demo mode — your code is ${res.devCode}`);
      setStep('code');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setError('');
    if (code.length !== 4) return setError('Enter the 4-digit code.');
    setBusy(true);
    try {
      const res = await api.post('/auth/verify', { phone, code, name });
      signIn(res);
      close();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const providerName = provider === 'apple' ? 'Apple' : 'Google';

  return (
    <Sheet onClose={close}>
      <div className="p-6 pb-8 space-y-4">
        {step === 'method' && (
          <>
            <h2 className="font-display font-extrabold text-[20px]">Sign in to Wicked Chkn</h2>
            <p className="text-[13px] text-sub font-semibold -mt-2">Save your orders, favourites and reorder in one tap.</p>

            {/* Apple */}
            <button
              className="w-full h-12 rounded-md font-bold text-[14.5px] flex items-center justify-center gap-2.5 bg-black text-white"
              onClick={() => startSocial('apple')}
            >
              <Apple size={18} fill="currentColor" /> Continue with Apple
            </button>

            {/* Google */}
            <button
              className="w-full h-12 rounded-md font-bold text-[14.5px] flex items-center justify-center gap-2.5 bg-white text-[#1F1F1F] border-2 border-line"
              onClick={() => startSocial('google')}
            >
              <GoogleG /> Continue with Google
            </button>

            <div className="flex items-center gap-3 py-1">
              <span className="flex-1 h-px bg-line" />
              <span className="text-[11.5px] font-bold text-sub">or use your phone</span>
              <span className="flex-1 h-px bg-line" />
            </div>

            <input className={inputCls} placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
            <input
              className={inputCls}
              placeholder="10-digit phone"
              inputMode="numeric"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
            />
            {error && <div className="text-red text-[12px] font-semibold">{error}</div>}
            <button
              className="w-full rounded-md bg-blue text-white font-extrabold text-[14.5px] h-12 shadow-cta disabled:opacity-60"
              onClick={sendOtp}
              disabled={busy}
            >
              {busy ? 'Sending…' : 'Send OTP'}
            </button>
          </>
        )}

        {step === 'code' && (
          <>
            <h2 className="font-display font-extrabold text-[20px]">Enter the code</h2>
            <p className="text-[13px] text-sub font-semibold -mt-2">Sent to +91 {phone}</p>
            {devHint && <div className="rounded-md bg-greenfill text-greendark text-[12px] font-bold px-3 py-2">{devHint}</div>}
            <input
              className="w-full bg-bg border-2 border-line rounded-md h-14 text-center font-extrabold outline-none"
              style={{ fontSize: 22, letterSpacing: 12 }}
              inputMode="numeric"
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
            />
            {error && <div className="text-red text-[12px] font-semibold">{error}</div>}
            <button
              className="w-full rounded-md bg-blue text-white font-extrabold text-[14.5px] h-12 shadow-cta disabled:opacity-60"
              onClick={verify}
              disabled={busy}
            >
              {busy ? 'Checking…' : 'Verify & sign in'}
            </button>
            <button className="w-full text-sub text-[13px] font-bold py-1" onClick={reset}>
              Change number
            </button>
          </>
        )}

        {step === 'social-connect' && (
          <div className="flex flex-col items-center gap-4 py-10">
            <span className="w-14 h-14 rounded-lg flex items-center justify-center bg-soft">
              {provider === 'apple' ? <Apple size={26} fill="currentColor" /> : <GoogleG size={26} />}
            </span>
            <div className="spinner" />
            <div className="text-[13.5px] font-bold text-sub">Connecting to {providerName}…</div>
          </div>
        )}

        {step === 'social-phone' && (
          <>
            <h2 className="font-display font-extrabold text-[20px]">Almost there</h2>
            <p className="text-[13px] text-sub font-semibold -mt-2">
              {providerName} connected ✓ — add your number so we can text order updates.
            </p>
            <input className={inputCls} placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
            <input
              className={inputCls}
              placeholder="10-digit phone"
              inputMode="numeric"
              autoFocus
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
            />
            {error && <div className="text-red text-[12px] font-semibold">{error}</div>}
            <button
              className="w-full rounded-md bg-blue text-white font-extrabold text-[14.5px] h-12 shadow-cta disabled:opacity-60"
              onClick={finishSocial}
              disabled={busy}
            >
              {busy ? 'Signing in…' : 'Finish sign-in'}
            </button>
            <button className="w-full text-sub text-[13px] font-bold py-1" onClick={reset}>
              Use a different method
            </button>
          </>
        )}
      </div>
    </Sheet>
  );
}

// Official multi-color Google "G"
function GoogleG({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z" />
    </svg>
  );
}

const inputCls =
  'w-full bg-bg border-2 border-line rounded-md px-3.5 h-12 text-[13.5px] font-semibold outline-none placeholder:text-sub';
