import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate, seed } from './db.js';
import { sseHandler } from './realtime.js';
import publicRoutes from './routes/public.js';
import adminRoutes from './routes/admin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.set('trust proxy', 1); // behind Render's proxy
app.use(cors());
app.use(express.json({ limit: '256kb' }));

app.get('/api/health', (req, res) => res.json({ ok: true, ts: Date.now() }));
// owner-uploaded menu photos (written by the admin menu editor)
app.use('/api/uploads', express.static(path.join(__dirname, '..', 'uploads'), { maxAge: '1d' }));
app.get('/api/events', sseHandler);
app.use('/api', publicRoutes);
app.use('/api/admin', adminRoutes);

// production: serve the built customer app at / and the admin at /admin
const customerDist = path.join(__dirname, '..', '..', 'customer', 'dist');
const adminDist = path.join(__dirname, '..', '..', 'admin', 'dist');
if (fs.existsSync(customerDist)) {
  if (fs.existsSync(adminDist)) {
    app.use('/admin', express.static(adminDist));
    app.use('/admin', (req, res) => res.sendFile(path.join(adminDist, 'index.html')));
  }
  app.use(express.static(customerDist));
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(customerDist, 'index.html'));
  });
}

// error handler — httpError() carries a status, everything else is a 500
app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.message || 'Something went wrong' });
});

const PORT = Number(process.env.PORT) || 4100;

await migrate();
await seed();
app.listen(PORT, () => {
  console.log(`Wicked Chkn backend on http://localhost:${PORT}`);
  console.log(`  DB: ${process.env.DATABASE_URL ? 'PostgreSQL' : 'SQLite (server/data/wickedchkn.db)'}`);
  console.log(`  AI: ${process.env.ANTHROPIC_API_KEY ? 'Anthropic ready' : ''}${process.env.OPENAI_API_KEY ? ' OpenAI ready' : ''}${!process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY ? 'mock mode (no key)' : ''}`);
  console.log(`  SMS: ${process.env.TWILIO_ACCOUNT_SID ? 'Twilio ready' : 'simulated'} · Payments: ${process.env.RAZORPAY_KEY_ID ? 'Razorpay ready' : 'simulated'}`);
});
