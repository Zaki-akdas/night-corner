# 🌙 NIGHT CORNER

**Your Night. Your Essentials.**

A production-ready, night-themed late-night convenience & food delivery e-commerce
platform built with Next.js 14 (App Router), TypeScript, Tailwind CSS, Prisma and
NextAuth. Open **10 PM – 6 AM**, delivery **within 10 KM**.

---

## ✨ Features

### Storefront
- Immersive dark/neon homepage: animated 3D-feel night scene (moon, floating products,
  delivery scooter, glowing shop), 18 sections including hero, categories, best
  sellers, midnight cravings, bakery, snacks, chocolates, instant food, drinks,
  deals, how-it-works, 10 KM delivery map, reviews, FAQ, WhatsApp CTA, footer.
- Shop page with category / price / availability / veg / discount filters, sort
  by price/popularity/newest, live search with autocomplete.
- Product detail pages with 3D-feel presentation, quantity selector, Add to Cart,
  Buy Now, frequently-bought-together, related products, freshness notes (bakery),
  JSON-LD Product structured data.
- Glassmorphism cards, neon accents, soft glows, micro-interactions, framer-motion
  page/card animations, reduced-motion support, skeleton loaders, toast notifications.
- Fully responsive mobile-first layout; PWA installable with offline shell and
  manifest.

### Cart & Checkout
- Persistent cart (localStorage, server-synced for live price/stock).
- Multi-step checkout: Cart → Address → Delivery → Payment → Confirmation.
- Browser geolocation + manual address entry with lat/lng; distance computed from
  the configured shop location; outside-10 KM blocked.
- Distance-based delivery slabs, min order, free-delivery threshold, coupon codes
  (NIGHT10, FREESHIP seeded) — **all recomputed on the server**.
- Payments: COD, UPI, Online (gateway configurable via env vars).
- Order confirmation, printable/downloadable HTML invoice (browser print-to-PDF),
  WhatsApp order notification to the business.

### Customer Account
- Sign up (name, email, mobile, password) / login (email **or** mobile).
- Dashboard: total/active/completed/cancelled orders, total spending.
- Orders list + live tracking timeline:
  **Placed → Confirmed → Preparing → Packed → Out for Delivery → Delivered**.
- Multiple saved addresses with set-default / delete; wishlist; profile settings.
- Guest order tracking by order number (`/track-order`).

### Admin Panel (`/admin`)
- Protected, role-based (ADMIN/STAFF). Dashboard with KPI cards and a 14-night
  sales area chart, top products, recent orders, low-stock alerts.
- **Orders**: search, filter by status/payment, view details, update status
  (cancellation/refund restores stock), print invoice, contact customer via WhatsApp.
- **Products**: full CRUD, price/MRP/discount, stock, SKU, category, veg,
  featured/best-seller, active/hide, low-stock threshold, freshness note, image.
- **Inventory**: starting/sold/remaining stock, one-click restock/adjust, low- and
  out-of-stock indicators, automatic deduction on order & restoration on cancel.
- **Categories**: create/toggle/delete, image, order.
- **Customers** list with spending/order counts; **Coupons** (percent/fixed/free-delivery,
  min order, max discount, usage limit, expiry); **Analytics** (daily/weekly/monthly
  sales, AOV, repeat vs new customers, category & product performance, cancel rate).
- **Delivery & Hours settings**: open/close time, force-open & emergency-close
  overrides, shop lat/lng/address, max radius, distance slabs, min order, free
  delivery, tax %, payment toggles, WhatsApp number.
- **General settings** (brand, notifications), notification center, reviews, admin
  users/roles, full activity log.

### Security & business rules (enforced server-side)
- Passwords hashed with bcrypt; JWT sessions; role-based route protection.
- **Never trusts prices, totals, stock, delivery or distance from the client** —
  every order re-reads products, recomputes pricing, applies coupons, computes
  haversine road-distance, and re-checks stock inside a transaction.
- Ordering only allowed 10 PM–6 AM (or admin override); 10 KM radius; min order;
  stock caps; unique `NC-YYYY-XXXXX` order numbers.

---

## 🚀 Quick start

```bash
npm install
# Requires a PostgreSQL connection (Supabase recommended):
#   DATABASE_URL  -> Supabase pooler (serverless runtime)
#   DIRECT_URL    -> Supabase direct connection (migrations/seed)
npm run db:push      # creates the schema in PostgreSQL
npm run db:seed      # categories, 53 products, coupons, admin + demo customer
npm run dev          # http://localhost:3000
```

### Demo logins
| Role           | Email                    | Password       |
|----------------|--------------------------|----------------|
| Admin          | `admin@nightcorner.in`   | `admin123`     |
| Customer       | `rahul@example.com`      | `customer123`  |
| Delivery (staff) | `delivery@nightcorner.in` | `delivery123`  |

Try coupon codes **NIGHT10** (10% off over ₹199) and **FREESHIP** (free delivery).

### 🧪 Integration test

```bash
npm run test:e2e
```

Runs an automated end-to-end flow — **signup → login → add address → COD order →
persistence** — against an isolated `test_e2e` Postgres schema on the same
Supabase project (production data is never touched; the schema is dropped
afterwards). Verifies order pricing, item snapshots, inventory deductions,
stock updates, notifications, the admin activity log, and rejection of
overselling. Uses its own `.next-e2e` build dir so it never disturbs a running
dev server.

---

## ⚙️ Environment variables (`.env`)

The app runs on **PostgreSQL via Supabase** (provider is `postgresql` in
`schema.prisma`). For production set:

```
# Supabase Postgres — pooler for serverless, direct for CLI/migrations
DATABASE_URL="postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres"
NEXTAUTH_URL="https://yourdomain"
NEXTAUTH_SECRET="<long random>"

# Supabase
SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY, SUPABASE_JWKS_URL

# Maps (optional; falls back to built-in haversine distance)
NEXT_PUBLIC_MAPS_API_KEY, MAPS_API_KEY

# Payment gateway (Razorpay-compatible)
NEXT_PUBLIC_PAYMENT_GATEWAY_KEY, PAYMENT_GATEWAY_SECRET

# WhatsApp Business Cloud API
WHATSAPP_API_TOKEN, WHATSAPP_BUSINESS_NUMBER_ID
NEXT_PUBLIC_WHATSAPP_NUMBER="918989418270"

# SMS (Fast2SMS — customer delivery alerts AND store-owner new-order alerts when notifySms is on)
FAST2SMS_API_KEY

# Messenger (Meta) — customer delivery alerts when notifyMessenger is on
# MESSENGER_PAGE_ID (public; used for the m.me connect link)
# MESSENGER_PAGE_TOKEN (Page access token — graph.facebook.com/v19.0/me/messages)
# MESSENGER_WEBHOOK_VERIFY_TOKEN (your chosen string; echoed on webhook verification)
# MESSENGER_APP_SECRET (validates X-Hub-Signature-256 on webhook POSTs)

ADMIN_EMAIL="admin@nightcorner.in"
SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD / SEED_ADMIN_NAME
```

> No secrets are exposed to the browser. Payment gateway keys, DB URL, WhatsApp
> token and service-role keys stay server-side only.

---

## 📸 Proof of delivery (photo + PIN)

Every order gets a **4-digit delivery PIN** generated at checkout. The PIN is
sent to the customer's phone (WhatsApp and/or SMS, per the store toggles) the
moment the order is placed, shown again on `/account/orders/{id}` and on the
checkout confirmation screen, so they always have it at handover. If the
customer misses the message, a **Resend PIN** button on `/account/orders/{id}`
re-sends just the PIN to their phone — throttled to once every 2 minutes so
paid SMS/WhatsApp can't be spammed (cooldown tracked in the activity log).

Riders are reminded to collect it: a chip on the delivery dashboard card, a
highlighted banner inside the **Mark Delivered** flow, and — when the rider
grants browser permission (prompted on first interaction with the dashboard) —
a **system notification** that surfaces the PIN reminder even when the tab is
minimized. The PIN value itself is never shown to the rider.

Before a delivery person can mark an order **Delivered** they must collect and
submit:

1. **A delivery photo** — uploaded to Supabase Storage (public `delivery-proofs`
   bucket) via `/api/delivery/orders/{id}/photo`, then attached to the order.
2. **The customer's PIN** — validated server-side against the order's PIN.

Rejections: missing photo/PIN → `400`, wrong PIN → `400` "Incorrect delivery
PIN". The photo and PIN are recorded on the order permanently as evidence.

Storage env vars (server-side only):
```
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY   # used for uploads via the apikey header
```
The `delivery-proofs` bucket is created via SQL (anon keys can't create
buckets): a public bucket plus INSERT/DELETE RLS policies scoped to it. Photos
are intentionally immutable — the app never deletes them.

---

## 🛵 Customer delivery notifications

The customer is notified on the phone number saved with their delivery address:

- **WhatsApp** (if `notifyWhatsapp` is enabled in Admin → Settings) — sent via the
  WhatsApp Business Cloud API when `WHATSAPP_API_TOKEN` + `WHATSAPP_BUSINESS_NUMBER_ID`
  are set; otherwise it degrades to a demo no-op (a `wa.me` deep link) so the flow
  never breaks.
- **SMS** (if `notifySms` is enabled) — sent via Fast2SMS when `FAST2SMS_API_KEY`
  is set; without a key it's a demo no-op.
- **Messenger** (if `notifyMessenger` is enabled) — sent via the Meta Graph API
  when `MESSENGER_PAGE_TOKEN` is set. Messenger addresses Page-Scoped IDs, not
  phone numbers, so a customer must first link their chat: either they message
  the Page quoting their order number (the `/api/webhooks/messenger` webhook
  picks it up and links the PSID to the order's mobile) or they tap **Connect
  on Messenger** in Account Settings, which opens an `m.me` deep link whose `ref`
  carries their userId. Until a PSID is linked the channel is silently skipped;
  without a token it's a demo no-op.

The **order-confirmation message** (sent the moment an order is placed) carries
the order number, ETA, tracking link, and the **4-digit delivery PIN** the
delivery person will ask for at handover. When the order goes **Out for
Delivery**, the customer is reminded of the PIN again. All channels are
non-blocking — external delivery failures never affect the order or the status
update. The in-app notification and admin activity log are unaffected.

---

## 🗄️ Schema changes (Prisma migrations)

Schema changes ship automatically: the build script runs `prisma generate && node scripts/prebuild.mjs && next build`, so **`prisma migrate deploy` runs on every Vercel deployment** — commit a new migration and it applies on the next deploy, no manual steps.

- **Creating a change:** edit `prisma/schema.prisma`, then run `npx prisma migrate dev --name <what-changed>` locally. Commit the generated `prisma/migrations/<timestamp>_<name>/migration.sql`.
- **One-time baseline (already handled):** databases that predate migrations (created via `prisma db push`) are baselined automatically by `scripts/prebuild.mjs` — the idempotent `20260815000000_init` migration is recorded as applied without touching data, so `migrate deploy` only applies genuinely new migrations (e.g. `20260815000001_messenger_identity`). The production database gets this treatment on the first deploy after the conversion.
- **Local sync:** `npx prisma migrate deploy` (or `npm run db:push` for the legacy schema-sync) to bring a local database up to date.
- **Post-deploy smoke test:** `npm run db:check` verifies the database actually has the `MessengerIdentity` table and that the `20260815000001_messenger_identity` migration is recorded as applied — run it after any deployment (`--schema <name>` to check a specific schema).

---

## 🧱 Tech stack

- **Framework:** Next.js 14 App Router, React 18, TypeScript
- **Styling:** Tailwind CSS + custom design tokens (neon/glass/night)
- **DB/ORM:** Prisma over PostgreSQL (Supabase)
- **Auth:** NextAuth (Credentials) with bcrypt + role-based access
- **Animation:** Framer Motion, CSS 3D (lightweight; no heavy WebGL by default)
- **Charts:** Recharts
- **Validation:** Zod
- **PWA:** service worker + web manifest

### Project structure
```
prisma/
  schema.prisma          # full relational schema
  seed.ts                # categories + 53 products + users + coupons
  products.ts            # product catalogue seed data
public/images/products/  # 53 procedurally-generated SVG product visuals
public/images/categories/# 6 category visuals
src/
  app/                   # routes (storefront, account, admin, api)
  components/            # UI, layout, admin, home sections
  lib/                   # prisma, auth, settings, hours, delivery, pricing,
                         # orders, whatsapp, invoice, admin helpers
```

### Switching to PostgreSQL
1. Set `provider = "postgresql"` in `prisma/schema.prisma`.
2. Set `DATABASE_URL` to your Postgres connection string.
3. Run `npx prisma migrate deploy && npm run db:seed`.

---

## 📋 Data model (key relationships)
Users ↔ Addresses/Orders/Cart/Wishlist/Reviews/Notifications ·
Categories → Products → Product Images/Inventory Transactions/Order Items ·
Carts → CartItems · Orders → OrderItems/Payments · Coupons · Settings (single JSON row) ·
ActivityLog. All monetary, stock and distance values are recomputed server-side at
order time.

## 🌙 Notes on imagery
Product visuals are **procedurally generated SVG artwork** (in `scripts/generate-art.mjs`)
to provide a consistent, premium, brand-safe catalogue without misrepresenting any
third-party packaging. Replace files in `public/images/products/` with real
photography when available. Brand names are used descriptively as product names.

---

© NIGHT CORNER — Your Night. Your Essentials.
