import React, { useEffect, useRef, useState } from 'react';
import { Send, Bot } from 'lucide-react';
import { api } from '../api.js';

const STARTERS = ['Mark Chicken Burrito out of stock', 'How are sales today?', 'Pause ordering for 30 minutes'];

export default function SupportAI() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length, busy]);

  const send = async (text) => {
    const t = (text || '').trim();
    if (!t || busy) return;
    setInput('');
    const next = [...messages, { role: 'user', text: t }];
    setMessages(next);
    setBusy(true);
    try {
      const res = await api.post('/admin/ai/staff', { messages: next });
      setMessages([...next, { role: 'assistant', text: res.reply }]);
    } catch {
      setMessages([...next, { role: 'assistant', text: 'Something glitched — try again?' }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-card border-[1.5px] border-line rounded-2xl flex flex-col" style={{ height: 560 }}>
      <div className="px-5 py-4 border-b border-line flex items-center gap-3">
        <span className="w-10 h-10 rounded-xl bg-blue text-white flex items-center justify-center">
          <Bot size={19} />
        </span>
        <div>
          <div className="text-[14px] font-extrabold">Staff assistant</div>
          <div className="text-[11.5px] text-sub font-semibold">
            Real tools — flips stock, pauses ordering, reads today's numbers
          </div>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-[13px] text-sub font-semibold">
            Ask me to change stock, pause ordering or pull today's sales — I make the changes live.
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[75%] px-4 py-3 text-[13px] font-semibold whitespace-pre-wrap ${
                m.role === 'user'
                  ? 'bg-blue text-white rounded-2xl rounded-br-[4px]'
                  : 'bg-page border-[1.5px] border-line rounded-2xl rounded-bl-[4px]'
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex justify-start">
            <div className="bg-page border-[1.5px] border-line rounded-2xl rounded-bl-[4px] px-4 py-3.5 flex gap-1.5">
              <span className="typing-dot w-2 h-2 rounded-full bg-sub" />
              <span className="typing-dot w-2 h-2 rounded-full bg-sub" />
              <span className="typing-dot w-2 h-2 rounded-full bg-sub" />
            </div>
          </div>
        )}
      </div>

      {messages.length === 0 && (
        <div className="px-5 pb-3 flex gap-2 flex-wrap">
          {STARTERS.map((s) => (
            <button
              key={s}
              className="rounded-full bg-page border-[1.5px] border-line px-3.5 py-2 text-[12px] font-bold text-sub"
              onClick={() => send(s)}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="px-5 pb-5 pt-2 flex items-center gap-2.5">
        <input
          className="flex-1 bg-page border-[1.5px] border-line rounded-full px-4 h-11 text-[13px] font-semibold outline-none placeholder:text-sub"
          placeholder="e.g. Mark Kiwi Punch back in stock"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send(input)}
        />
        <button
          className="w-11 h-11 rounded-full bg-blue text-white flex items-center justify-center shrink-0"
          onClick={() => send(input)}
          aria-label="Send"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
