# Cargo & Co. — Dropshipping Storefront Starter

A working scaffold for a dropshipping store: plain HTML/CSS/JS storefront,
Node.js/Express backend, PostgreSQL database, Stripe checkout, and a real
AliExpress Open Platform integration for product import + order fulfillment.

## What actually works out of the box vs. what needs setup

| Piece | Status |
|---|---|
| Storefront, cart, product pages | Fully working once the backend is running |
| Admin panel (login, manual product add, order list) | Fully working |
| Stripe checkout | Fully working once you add your own Stripe keys (test mode works immediately) |
| AliExpress product import / order placement | **Code is complete and correct against AliExpress's real API**, but requires *you* to get approved for AliExpress Open Platform API access — see below |
| Amazon / eBay / Shopify sourcing | **Not included** — see "About the other platforms" below |

## 1. Prerequisites

- Node.js 18+
- PostgreSQL 14+ running locally or hosted (e.g. Railway, Supabase, RDS)
- A Stripe account (free, test mode is fine to start): https://dashboard.stripe.com

## 2. Database setup

```bash
createdb dropship_store
psql -d dropship_store -f backend/db/schema.sql
```

## 3. Backend setup

```bash
cd backend
npm install
cp .env.example .env
# edit .env: set DATABASE_URL, JWT_SECRET, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
npm run seed-admin you@example.com yourStrongPassword
npm run dev
```

The server runs at `http://localhost:4000` and also serves the frontend
(`/`, `/product.html`, `/cart.html`, `/checkout.html`, `/admin.html`).

## 4. Stripe setup

1. Get your **test** keys from https://dashboard.stripe.com/test/apikeys
2. Put the secret key in `backend/.env` as `STRIPE_SECRET_KEY`
3. Put the publishable key in `frontend/js/config.js`:
   ```js
   window.STRIPE_PUBLISHABLE_KEY = 'pk_test_...';
   ```
4. For webhooks (needed to mark orders "paid" after payment), install the
   Stripe CLI and run:
   ```bash
   stripe listen --forward-to localhost:4000/api/checkout/webhook
   ```
   Copy the `whsec_...` value it prints into `STRIPE_WEBHOOK_SECRET` in `.env`.
5. Test card number: `4242 4242 4242 4242`, any future expiry, any CVC.

## 5. AliExpress setup (for real dropshipping fulfillment)

This is the part that takes real-world lead time, not just code:

1. Register as a developer at https://openservice.aliexpress.com
2. Apply for API access. **Product data access** (affiliate API) is usually
   approved quickly. **Order placement** (`aliexpress.trade.buy.placeorder`)
   requires approval as a dropshipping/business partner — this is a manual
   review by AliExpress, not instant.
3. Once approved, you'll get an App Key + App Secret, and need to complete
   an OAuth flow to get an access token for the AliExpress account that
   will actually place/pay for supplier orders.
4. Add these to `backend/.env`:
   ```
   ALIEXPRESS_APP_KEY=...
   ALIEXPRESS_APP_SECRET=...
   ALIEXPRESS_ACCESS_TOKEN=...
   ```
5. In the admin panel, paste an AliExpress product URL and your sale price
   to import it. When a customer's order is marked "paid," clicking
   "Fulfill via AliExpress" in the admin Orders tab calls the real API to
   place that order with the supplier, shipping to your customer's address.

The signing/request logic in `backend/services/aliexpress.js` follows
AliExpress's actual Open Platform signature scheme, but **the exact required
parameters can vary slightly by API version and approval level** — check
your developer console's docs once you're approved, since AliExpress
sometimes adjusts fields between API versions.

## 6. About the other platforms you mentioned

Worth knowing before you build further:

- **Amazon**: Amazon's Terms of Service explicitly prohibit fulfilling orders
  placed on a different retail site using a "buy from Amazon, ship to
  customer" model — this is enforceable and Amazon does close accounts over
  it. There's no public API designed for this use case. Realistic paths:
  Amazon's own (separate) FBA/wholesale programs, or don't source from Amazon.
- **eBay**: has real APIs for product data (Browse/Buy API), but placing
  orders programmatically to fulfill a sale made on *your* site can violate
  eBay's buyer policies depending on how it's done. Safer to use eBay data
  for pricing research and source fulfillment through an authorized channel
  (e.g. their own dropship-friendly partners) rather than automated buying.
- **Shopify**: isn't a product source — it's an e-commerce platform (what
  this project's storefront is roughly analogous to). If you meant sourcing
  products from a specific Shopify merchant, that merchant would need to
  explicitly offer wholesale/dropship access (many do, via apps like
  Shopify Collective) — there's no generic "pull from any Shopify store" API.
- **Scraping any of these sites directly** (instead of using official APIs)
  breaches their Terms of Service and risks IP/account bans — this project
  intentionally doesn't include a scraper for that reason.

The architecture here (products table with a `source` field, `order_items`
with `fulfillment_status` and `supplier_order_id`) is built so you can add
another supplier integration later the same way `services/aliexpress.js`
is structured, once you have a legitimate API to call.

## 7. Project structure

```
backend/
  server.js              Express app entry point
  db/schema.sql           PostgreSQL schema
  db/pool.js               DB connection pool
  routes/products.js       Public + admin product endpoints
  routes/orders.js          Public + admin order endpoints
  routes/checkout.js         Stripe payment intent + webhook
  routes/adminAuth.js         Admin login
  services/aliexpress.js       AliExpress API integration
  middleware/auth.js            Admin JWT auth
  scripts/seedAdmin.js            Create the first admin user
frontend/
  index.html, product.html, cart.html, checkout.html, admin.html
  css/style.css
  js/  (api.js, store.js, product.js, cart-page.js, checkout.js, admin.js)
```

## 8. Deploying

- Backend: any Node host (Railway, Render, Fly.io, a VPS) — just set the
  same env vars.
- Database: managed Postgres (Railway, Supabase, RDS).
- Frontend: served by the same Express app in this scaffold, so it deploys
  together with the backend. If you split them later, update `API_BASE` in
  `frontend/js/api.js` to point at the backend's URL.
- Remember to switch Stripe keys from test to live mode, and re-run the
  webhook setup pointing at your production URL.
