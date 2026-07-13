# Wicked Chkn — brand notes

This folder is the fully rebranded **Wicked Chkn** platform (Down Town Market,
BRS Nagar, Ludhiana) — an independent copy of the Smash Bros codebase with its own
menu, colours, database, and ports. Nothing here touches the original.

`npm run dev` → backend **4100**, customer **5273**, admin **5274**.

## What this brand uses
- **Menu**: `server/src/menu-data.js` — 24 items from the printed menu card
  (burgers served with wedges, burritos & quesadillas, wicked wedges, chicken
  snacks, iced teas). Edit there, then delete `server/data/wickedchkn.db` to reseed.
- **Colours**: red/white — deep maroon `#4A0E0B` (hero/navy), wicked red `#D92B21`
  (accent), set in `customer/src/index.css` (light + dark) and both `tailwind.config.js`.
- **Design language** (deliberately different from Smash Bros so the two apps don't
  look like the same template): street-poster / sticker style — **Anton** display +
  **Archivo** body fonts, sharp corners (6–8px), 2px ink borders, hard offset shadows
  (`--shadowInk` / `--tileBorder` vars in index.css), flat red hero with diagonal
  stripes, straight cream ticker, cut-out coupon deal, square rotated stories,
  floating dock tab bar. Smash Bros keeps its soft-rounded "midnight diner" look.
- **Codes**: promo **WICKED10** (10% off ₹499+), gift prefix **WCGIFT-**,
  order numbers **WC-xxxx**, admin PIN default **1234** (change in Settings).
- **Logo**: "WC" monogram (Splash, admin sidebar, banners) + red icons in
  `customer/public/icon-192.png` / `icon-512.png`.
- **Location**: Down Town Market, BRS Nagar, Ludhiana — coordinates `30.889, 75.808`
  in `server/src/routes/public.js` (weather + address autocomplete).
- **Loyalty**: every 8th order → free Wicked Wedges (₹149 voucher by SMS).
- **Photos**: drop JPGs in `customer/public/food/` — see `HOW-TO-ADD-PHOTOS.md`
  there for the exact filenames.

## Deploying this one separately
1. Create a **new** GitHub repo, `git init` here, push (this folder has no git
   remote, so it can't touch the Smash Bros repo).
2. On Render → New Blueprint → pick the new repo. `render.yaml` names the service
   `wickedchkn`, so it won't collide with `smashbros`.
3. You'll get a second live URL, e.g. `https://wickedchkn.onrender.com`.
4. Add keys in the Render dashboard when ready (Anthropic/OpenAI for real AI chat,
   Twilio for SMS, Razorpay for payments) — everything works keyless with mocks
   until then.

## Cloning again for a third brand
Copy this folder (minus `node_modules`, `dist`, `.git`, `server/data`,
`server/uploads`), change the three ports, then re-skin the same checklist:
menu-data.js → brand strings & AI prompts → monogram + icons → CSS variables →
promo/gift/order codes → phone/address/coordinates → loyalty reward item.
