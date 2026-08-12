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
| Role     | Email                    | Password      |
|----------|--------------------------|---------------|
| Admin    | `admin@nightcorner.in`   | `admin123`    |
| Customer | `rahul@example.com`      | `customer123` |

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
NEXT_PUBLIC_WHATSAPP_NUMBER="919999999999"

ADMIN_EMAIL="admin@nightcorner.in"
SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD / SEED_ADMIN_NAME
```

> No secrets are exposed to the browser. Payment gateway keys, DB URL, WhatsApp
> token and service-role keys stay server-side only.

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
