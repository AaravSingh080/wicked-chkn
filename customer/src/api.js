const BASE = '/api';

async function handle(res) {
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
  const token = localStorage.getItem('sb_token');
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
};

export const api = {
  get: (p) => fetch(BASE + p, { headers: headers() }).then(handle),
  post: (p, body) => fetch(BASE + p, { method: 'POST', headers: headers(), body: JSON.stringify(body) }).then(handle),
  put: (p, body) => fetch(BASE + p, { method: 'PUT', headers: headers(), body: JSON.stringify(body) }).then(handle),
  patch: (p, body) => fetch(BASE + p, { method: 'PATCH', headers: headers(), body: JSON.stringify(body) }).then(handle)
};

/** SSE subscription with auto-reconnect + slow poll fallback (sync ≤2s requirement). */
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
