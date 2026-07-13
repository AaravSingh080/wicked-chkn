const BASE = '/api';

async function handle(res) {
  // expired/invalid admin token → back to the PIN screen (once)
  if (res.status === 401 && localStorage.getItem('sb_admin_token')) {
    localStorage.removeItem('sb_admin_token');
    window.location.reload();
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error(data.error || `Request failed (${res.status})`);
    e.status = res.status;
    throw e;
  }
  return data;
}

const headers = () => {
  const h = { 'Content-Type': 'application/json' };
  const t = localStorage.getItem('sb_admin_token');
  if (t) h['x-admin-token'] = t;
  return h;
};

export const api = {
  get: (p) => fetch(BASE + p, { headers: headers() }).then(handle),
  post: (p, body) => fetch(BASE + p, { method: 'POST', headers: headers(), body: JSON.stringify(body) }).then(handle),
  put: (p, body) => fetch(BASE + p, { method: 'PUT', headers: headers(), body: JSON.stringify(body) }).then(handle),
  patch: (p, body) => fetch(BASE + p, { method: 'PATCH', headers: headers(), body: JSON.stringify(body) }).then(handle)
};

export function subscribe(onEvent) {
  let es = null;
  let stopped = false;
  const connect = () => {
    if (stopped) return;
    es = new EventSource(BASE + '/events');
    es.onmessage = (m) => {
      try {
        onEvent(JSON.parse(m.data));
      } catch {}
    };
    es.onerror = () => {
      es.close();
      if (!stopped) setTimeout(connect, 2000);
    };
  };
  connect();
  const poll = setInterval(() => onEvent({ topic: 'poll' }), 10000);
  return () => {
    stopped = true;
    es?.close();
    clearInterval(poll);
  };
}

export const fmtTime = (ts) => {
  const d = new Date(ts);
  let h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ap}`;
};

export const fmtMoney = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
