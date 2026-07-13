// Tiny WebAudio synth — no audio files. Respects the Sounds toggle in Profile.
let ctx = null;
const ac = () => (ctx ||= new (window.AudioContext || window.webkitAudioContext)());

const enabled = () => {
  try {
    return JSON.parse(localStorage.getItem('sb_prefs') || '{}').sounds !== false;
  } catch {
    return true;
  }
};

function tone(freq, { start = 0, dur = 0.09, type = 'sine', vol = 0.16, slide = 0 }) {
  const a = ac();
  const t0 = a.currentTime + start;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t0 + dur);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(a.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

export const sfx = {
  pop() {
    if (!enabled()) return;
    tone(520, { dur: 0.07, type: 'triangle', slide: 260 });
  },
  ding() {
    if (!enabled()) return;
    tone(880, { dur: 0.16, vol: 0.12 });
    tone(1318, { start: 0.09, dur: 0.2, vol: 0.1 });
  },
  success() {
    if (!enabled()) return;
    tone(523, { dur: 0.1 });
    tone(659, { start: 0.09, dur: 0.1 });
    tone(784, { start: 0.18, dur: 0.22, vol: 0.18 });
  },
  coin() {
    if (!enabled()) return;
    tone(988, { dur: 0.07, type: 'square', vol: 0.08 });
    tone(1319, { start: 0.06, dur: 0.18, type: 'square', vol: 0.08 });
  }
};
