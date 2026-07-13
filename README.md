# Wicked Chkn — Direct Ordering Platform

Customer ordering PWA + staff admin dashboard + one shared live backend, built from the
`design_handoff_smash_bros` spec. A change on either client appears on the other within ~2 seconds
(Server-Sent Events with a polling fallback).

## Run it

```bash
npm install        # once, from this folder
npm run dev        # starts all three
```

| App | URL | What it is |
|---|---|---|
| Backend API | http://localhost:4000 | Express + Knex (SQLite locally, PostgreSQL via `DATABASE_URL`) |
| Customer app | http://localhost:5173 | Mobile PWA — browse → cart → checkout → pay → live tracking |
| Admin dashboard | http://localhost:5174 | Staff site — live orders, KOT, inventory, reports, AI marketing, CRM, staff AI, settings |

Open the customer app and admin side-by-side to see the live sync: place an order in the app,
accept it in the admin, watch the tracking screen move.

## Demo mode vs real keys

Everything runs with **zero keys** — payments, SMS, OTP and both AI assistants fall back to
realistic simulators. Drop real keys into `server/.env` (copy from `server/.env.example`) and the
real integrations switch on with no code changes:

- `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` — customer chat ordering, staff assistant, campaign copy
  (provider selectable in admin → Settings; Anthropic uses Claude Haiku, OpenAI uses GPT-4o-mini)
- `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN` + `TWILIO_FROM` — real SMS OTP and order-status texts
  (without them, OTP is `0000` and shown in the sign-in sheet)
- `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET` — real hosted checkout with server-side signature
  verification (without them, a simulated payment sheet)
- `DATABASE_URL` — PostgreSQL (Render); without it, SQLite at `server/data/wickedchkn.db`

## Business rules (enforced server-side)

- Hours 11:00–22:00; admin can pause ordering any time (blocks checkout, shows the closed banner)
- Delivery: 7 km radius, flat ₹35, **prepaid only**; dine-in/pickup take cash too
- Promo `WICKED10`: 10% off subtotal at ₹499+, excludes the delivery fee
- Order numbers `SB-NNNN`; customers keyed by 10-digit phone
- Status flows — dine-in: placed → accepted → being made → ready to serve;
  pickup: … → ready → picked up; delivery: … → ready → out for delivery → delivered

## Layout

```
server/    Express API — routes/, services/ (llm, sms, payments), ai/ (customer + staff brains)
customer/  React + Vite + Tailwind PWA (port 5173)
admin/     React + Vite + Tailwind desktop dashboard (port 5174)
```

To reset demo data, stop the server and delete `server/data/wickedchkn.db`.
