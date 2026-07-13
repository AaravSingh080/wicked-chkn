import React, { useEffect, useRef, useState } from 'react';
import { Send, History, SquarePen, Mic, LifeBuoy } from 'lucide-react';
import { useStore } from '../store.jsx';
import { api } from '../api.js';
import { Sheet } from '../components/Overlays.jsx';
import { FOOD_ART } from '../components/ui.jsx';

const STARTERS = [
  "What's your spiciest item?",
  'Recommend a veg meal under ₹400',
  'Chicken Burrito + wedges for pickup',
  'Report a problem with my order'
];

const fmtTime = (ts) => {
  const d = new Date(ts);
  let h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ap}`;
};

const fmtDay = (ts) => {
  const d = new Date(ts);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (ts >= today.getTime()) return 'Today';
  if (ts >= today.getTime() - 864e5) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

const greeting = (name) => {
  const h = new Date().getHours();
  const part = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  const who = name ? `, ${name.split(' ')[0]}` : '';
  return `${part}${who}! I'm the Wicked assistant — I can build your order, answer anything on the menu, or log a problem for the team. What are we frying today?`;
};

export default function Chat() {
  const {
    chats, activeChat, activeChatId, setActiveChatId, newChat, appendChat,
    cart, prefs, orderType, setScreen, showToast, adoptCart, auth, phone
  } = useStore();
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [typingTs, setTypingTs] = useState(null); // ts of the reply being typed out
  const [showHistory, setShowHistory] = useState(false);
  const [listening, setListening] = useState(false);
  const scrollRef = useRef(null);
  const recRef = useRef(null);

  const messages = activeChat?.messages || [];

  const scrollDown = () => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  useEffect(scrollDown, [messages.length, busy]);

  const send = async (text) => {
    const t = (text || '').trim();
    if (!t || busy) return;
    setInput('');
    recRef.current?.stop();
    const chatId = activeChatId && activeChat ? activeChatId : newChat();
    const userMsg = { role: 'user', text: t, ts: Date.now() };
    appendChat(chatId, userMsg);
    setBusy(true);
    try {
      // a beat of "thinking" so replies land at a human pace
      const think = new Promise((r) => setTimeout(r, 650 + Math.random() * 550));
      const reqHistory = [...messages, userMsg].map((m) => ({ role: m.role, text: m.text }));
      const [res] = await Promise.all([
        api.post('/ai/chat', {
          messages: reqHistory,
          cart,
          vegMode: prefs.vegMode,
          orderType,
          customer: { name: auth?.customer?.name || '', phone: auth?.customer?.phone || phone || '' }
        }),
        think
      ]);
      if (res.cart) adoptCart(res.cart);
      const ts = Date.now();
      appendChat(chatId, { role: 'assistant', text: res.reply, ts });
      setTypingTs(ts); // typewriter targets this message
      if (res.openCheckout) {
        const dur = Math.min(4200, res.reply.split(/\s+/).length * 60 + 900);
        setTimeout(() => setScreen('cart'), dur);
      }
    } catch (e) {
      appendChat(chatId, { role: 'assistant', text: 'Something glitched — try that again?', ts: Date.now() });
      showToast(e.message);
    } finally {
      setBusy(false);
    }
  };

  // ---------- voice to text (Web Speech API) ----------
  const toggleMic = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return showToast('Voice input is not supported in this browser');
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const rec = new SR();
    recRef.current = rec;
    rec.lang = 'en-IN';
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (e) => setInput([...e.results].map((r) => r[0].transcript).join(''));
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    setListening(true);
    rec.start();
  };

  const firstDay = messages.length ? fmtDay(messages[0].ts) : null;

  return (
    <div className="flex flex-col" style={{ height: 'calc(100dvh - 64px)' }}>
      {/* header */}
      <div className="px-5 pt-5 pb-3 border-b border-line flex items-center gap-3 shrink-0 bg-bg">
        <span className="w-[42px] h-[42px] rounded-md flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg,#FF8A7A,#D92B21)' }}>
          {FOOD_ART.burger(26)}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-extrabold">Wicked assistant</div>
          <div className="text-[11.5px] text-sub font-semibold flex items-center gap-1.5">
            <span className="w-[7px] h-[7px] rounded-full bg-green blink" /> Online · replies in seconds
          </div>
        </div>
        <button
          className="w-9 h-9 rounded-md bg-card border-2 border-line flex items-center justify-center"
          onClick={() => setShowHistory(true)}
          aria-label="Chat history"
        >
          <History size={16} />
        </button>
        <button
          className="w-9 h-9 rounded-md bg-card border-2 border-line flex items-center justify-center"
          onClick={() => newChat()}
          aria-label="New chat"
        >
          <SquarePen size={16} />
        </button>
      </div>

      {/* messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-1">
        {firstDay && (
          <div className="flex justify-center pb-2">
            <span className="rounded-full bg-soft text-sub text-[10.5px] font-extrabold px-3 py-1">{firstDay}</span>
          </div>
        )}

        {messages.length === 0 && (
          <div className="msg-in">
            <div className="bg-card border-2 border-line rounded-lg rounded-bl-[4px] p-3.5 text-[13.5px] font-semibold max-w-[85%] leading-relaxed">
              {greeting(auth?.customer?.name)}
            </div>
            <div className="text-[10px] text-sub font-semibold mt-1 ml-1">{fmtTime(Date.now())}</div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={m.ts + '-' + i} className={`msg-in flex flex-col pb-2 ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div
              className={`max-w-[85%] p-3.5 text-[13.5px] font-semibold whitespace-pre-wrap leading-relaxed ${
                m.role === 'user'
                  ? 'bg-blue text-white rounded-lg rounded-br-[4px]'
                  : 'bg-card border-2 border-line rounded-lg rounded-bl-[4px]'
              }`}
            >
              {m.role === 'assistant' && m.ts === typingTs ? (
                <Typewriter text={m.text} onTick={scrollDown} onDone={() => setTypingTs(null)} />
              ) : (
                m.text
              )}
            </div>
            <div className="text-[10px] text-sub font-semibold mt-1 mx-1">{fmtTime(m.ts)}</div>
          </div>
        ))}

        {busy && (
          <div className="flex justify-start pb-2">
            <div className="bg-card border-2 border-line rounded-lg rounded-bl-[4px] px-4 py-3.5 flex gap-1.5">
              <span className="typing-dot w-2 h-2 rounded-full bg-sub" />
              <span className="typing-dot w-2 h-2 rounded-full bg-sub" />
              <span className="typing-dot w-2 h-2 rounded-full bg-sub" />
            </div>
          </div>
        )}
      </div>

      {/* starter chips — empty chat only */}
      {messages.length === 0 && !busy && (
        <div className="px-5 pb-2 flex gap-2 overflow-x-auto no-scrollbar shrink-0">
          {STARTERS.map((s) => (
            <button
              key={s}
              className="shrink-0 rounded-full bg-card border-2 border-line px-3.5 py-2 text-[12px] font-bold text-sub whitespace-nowrap flex items-center gap-1.5"
              onClick={() => send(s)}
            >
              {s.startsWith('Report') && <LifeBuoy size={13} className="text-red" />}
              {s}
            </button>
          ))}
        </div>
      )}

      {/* input */}
      <div className="px-5 pb-4 pt-2 flex items-center gap-2 shrink-0 bg-bg">
        <button
          className={`w-[46px] h-[46px] rounded-full flex items-center justify-center shrink-0 press-sm ${
            listening ? 'bg-red text-white mic-pulse' : 'bg-card border-2 border-line text-sub'
          }`}
          onClick={toggleMic}
          aria-label="Voice input"
        >
          <Mic size={18} />
        </button>
        <input
          className="flex-1 min-w-0 bg-card border-2 border-line rounded-full px-4 h-[46px] text-[13.5px] font-semibold outline-none placeholder:text-sub"
          placeholder={listening ? 'Listening…' : 'Ask for anything on the menu…'}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send(input)}
        />
        <button
          className="w-[46px] h-[46px] rounded-full bg-blue text-white flex items-center justify-center shadow-cta shrink-0 press-sm disabled:opacity-50 disabled:shadow-none"
          onClick={() => send(input)}
          disabled={busy}
          aria-label="Send"
        >
          <Send size={18} />
        </button>
      </div>

      {/* history sheet */}
      {showHistory && (
        <Sheet onClose={() => setShowHistory(false)}>
          <div className="p-5 pb-8">
            <h2 className="font-display font-extrabold text-[20px] mb-1">Your chats</h2>
            <p className="text-[12.5px] text-sub font-semibold mb-4">Conversations stay on this device — pick one up anytime.</p>
            <button
              className="w-full rounded-md bg-blue text-white font-extrabold text-[14px] h-11 shadow-cta mb-4"
              onClick={() => {
                newChat();
                setShowHistory(false);
              }}
            >
              Start a new chat
            </button>
            <div className="space-y-2.5">
              {chats.filter((c) => c.messages.length > 0).length === 0 && (
                <div className="text-[12.5px] text-sub font-semibold text-center py-6">No conversations yet.</div>
              )}
              {chats
                .filter((c) => c.messages.length > 0)
                .map((c) => {
                  const firstUser = c.messages.find((m) => m.role === 'user');
                  const last = c.messages[c.messages.length - 1];
                  return (
                    <button
                      key={c.id}
                      className={`w-full text-left rounded-lg p-3.5 border-2 ${
                        c.id === activeChatId ? 'border-blue bg-bluesoft' : 'border-line bg-card'
                      }`}
                      onClick={() => {
                        setActiveChatId(c.id);
                        setShowHistory(false);
                      }}
                    >
                      <div className="text-[13px] font-bold truncate">{firstUser?.text || 'New conversation'}</div>
                      <div className="text-[11px] text-sub font-semibold mt-0.5">
                        {fmtDay(last.ts)} · {fmtTime(last.ts)} · {c.messages.length} message{c.messages.length > 1 ? 's' : ''}
                      </div>
                    </button>
                  );
                })}
            </div>
          </div>
        </Sheet>
      )}
    </div>
  );
}

// word-by-word reveal with a blinking caret
function Typewriter({ text, onTick, onDone }) {
  const tokens = text.split(/(\s+)/);
  const [n, setN] = useState(0);
  useEffect(() => {
    if (n >= tokens.length) {
      onDone?.();
      return;
    }
    const t = setTimeout(() => {
      setN((x) => x + 2); // reveal word + following space together
      onTick?.();
    }, 55);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n]);
  return (
    <>
      {tokens.slice(0, n).join('')}
      {n < tokens.length && <span className="tw-caret" />}
    </>
  );
}
