// SSE hub — both clients subscribe to /api/events; every write broadcasts a
// topic so the other side updates within the ≤2s sync requirement (SSE is
// effectively instant; clients also poll every 10s as a fallback).
const clients = new Set();

export function sseHandler(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });
  res.write(':connected\n\n');
  clients.add(res);
  const ping = setInterval(() => res.write(':ping\n\n'), 25000);
  req.on('close', () => {
    clearInterval(ping);
    clients.delete(res);
  });
}

export function broadcast(topic, data = {}) {
  const payload = `data: ${JSON.stringify({ topic, ...data, ts: Date.now() })}\n\n`;
  for (const res of clients) {
    try {
      res.write(payload);
    } catch {
      clients.delete(res);
    }
  }
}
