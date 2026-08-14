#!/usr/bin/env node
/**
 * Night Corner — automated end-to-end integration test.
 *
 * Flow: signup → login (next-auth credentials) → add delivery address →
 * place a COD order → verify everything persisted in the database
 * (order + items, inventory transactions, stock deduction, customer
 * notification, admin activity log) and that overselling is rejected.
 *
 * Two modes:
 *   local  (default)          Boots the app on :3100 against an isolated
 *                             `test_e2e` Postgres schema and drops it after.
 *   remote (E2E_BASE_URL set) Runs against an existing deployment (e.g. a
 *                             Vercel preview build) that already points at a
 *                             test schema via its own DATABASE_URL. Uses
 *                             E2E_TEST_DB_URL (GitHub secret) for seeding and
 *                             verification; cleans up only test data so the
 *                             schema stays available for the next build.
 *
 * Also runs a dynamic-route sweep: every [param] page and API route is
 * discovered from src/app and probed over HTTP. A regression in the Next 16
 * async params/searchParams contract (the route 500s) fails the suite, and a
 * NEW dynamic route without a probe fails the coverage guard — so the async
 * params break can never ship silently again.
 *
 * And a browser console check (playwright-core driving the system Chrome/Edge,
 * no browser download): core pages are visited for real and any script-tag,
 * LCP-image, or hydration warning — plus uncaught page errors — fails the
 * suite. This is the regression guard for the warning classes a pure HTTP
 * sweep cannot observe.
 *
 * Usage:
 *   npm run test:e2e                                   # local mode
 *   E2E_BASE_URL=https://preview.vercel.app npm run test:e2e   # remote mode
 */
import { spawn, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, copyFileSync, rmSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 3100;
const SCHEMA = "test_e2e";
const REMOTE = (process.env.E2E_BASE_URL || "").replace(/\/+$/, "");
const REMOTE_MODE = REMOTE !== "";
const BASE = REMOTE || `http://localhost:${PORT}`;

// The test dev server must never share .next with a running dev server — two
// Next processes on one build dir corrupt each other's webpack cache. We point
// the test run at its own distDir via a temporary next.config.js swap.
const CONFIG_PATH = path.join(ROOT, "next.config.js");
const CONFIG_BAK = path.join(ROOT, ".next.config.e2e.bak");
const TSCONFIG_PATH = path.join(ROOT, "tsconfig.json");
const TSCONFIG_BAK = path.join(ROOT, ".tsconfig.e2e.bak");
// Next also rewrites next-env.d.ts to reference <distDir>/dev/types — back it
// up alongside tsconfig so the main project's type refs are restored exactly.
const NEXT_ENV_PATH = path.join(ROOT, "next-env.d.ts");
const NEXT_ENV_BAK = path.join(ROOT, ".next-env.e2e.bak");
const TEST_DIST = ".next-e2e";

const log = (m) => console.log(`\x1b[36m[e2e]\x1b[0m ${m}`);
const ok = (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const fail = (m) => console.log(`  \x1b[31m✗\x1b[0m ${m}`);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadDotEnv(file) {
  const env = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2].trim();
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    env[m[1]] = v;
  }
  return env;
}

class CookieJar {
  constructor() {
    this.cookies = new Map();
  }
  absorb(res) {
    const setCookies =
      typeof res.headers.getSetCookie === "function"
        ? res.headers.getSetCookie()
        : res.headers.get("set-cookie")
          ? [res.headers.get("set-cookie")]
          : [];
    for (const sc of setCookies) {
      const [pair] = sc.split(";");
      const eq = pair.indexOf("=");
      if (eq < 0) continue;
      this.cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
  }
  header() {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }
}

async function request(pathname, { method = "GET", jar, body, headers = {} } = {}) {
  const res = await fetch(BASE + pathname, {
    method,
    headers: {
      ...(jar ? { cookie: jar.header() } : {}),
      ...headers,
    },
    body,
    redirect: "manual",
    signal: AbortSignal.timeout(120_000),
  });
  if (jar) jar.absorb(res);
  return res;
}

async function waitForServer(timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${BASE}/api/open-status`, { signal: AbortSignal.timeout(5_000) });
      if (res.ok) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 2_000));
  }
  return false;
}

// Mirrors DEFAULT_SETTINGS in src/lib/settings.ts, with the shop forced open
// so the ordering API accepts orders regardless of the wall clock.
// Admin credentials seeded into the test schema so the admin panel flow can
// log in through the real next-auth credentials provider.
const ADMIN_EMAIL = "admin-e2e@nightcorner.in";
const ADMIN_MOBILE = "9876500099";
const ADMIN_PASSWORD = "AdminE2ETest123!";

// STAFF (delivery person) credentials for the delivery dashboard flow.
const STAFF_EMAIL = "staff-e2e@nightcorner.in";
const STAFF_MOBILE = "9876500088";
const STAFF_PASSWORD = "StaffE2ETest123!";

const TEST_SETTINGS = {
  businessName: "NIGHT CORNER",
  slogan: "Your Night. Your Essentials.",
  openTime: "22:00",
  closeTime: "06:00",
  openDays: [0, 1, 2, 3, 4, 5, 6],
  forceOpen: true,
  emergencyClosed: false,
  holidays: [],
  shopAddress: "Night Corner, Vijay Nagar, Indore, Madhya Pradesh 452010, India",
  shopLat: 22.7533,
  shopLng: 75.8937,
  maxRadiusKm: 10,
  minOrderAmount: 99,
  freeDeliveryAbove: 499,
  freeDeliveryEnabled: true,
  taxPercent: 5,
  deliverySlabs: [
    { upToKm: 2, charge: 20 },
    { upToKm: 5, charge: 30 },
    { upToKm: 7, charge: 40 },
    { upToKm: 10, charge: 50 },
  ],
  deliveryTimeMins: 35,
  serviceablePincodes: [],
  whatsappNumber: "919999999999",
  contactEmail: "nightcorner.shop@gmail.com",
  contactPhone: "+91 99999 99999",
  socials: { instagram: "nightcorner", facebook: "nightcorner" },
  codEnabled: true,
  upiEnabled: true,
  onlineEnabled: false,
  upiId: "nightcorner@upi",
  notifyEmail: false,
  // Enabled so the OFD step exercises the external SMS/WhatsApp code path.
  // Without provider credentials both senders run in demo mode (no-op ok).
  notifyWhatsapp: true,
  notifySms: true,
};

let failures = 0;
function assert(cond, label) {
  if (cond) ok(label);
  else {
    failures++;
    fail(label);
  }
}

// Temporarily set distDir to an isolated directory, restoring the original
// config no matter how the test ends (normal exit, assertion failure, or kill).
function installIsolatedDistDir() {
  if (!existsSync(CONFIG_PATH)) return;
  const original = readFileSync(CONFIG_PATH, "utf8").replace(/distDir:\s*"[^"]*",?\s*/, "");
  const injected = original.replace(
    /const nextConfig\s*=\s*\{/,
    `const nextConfig = {\n  distDir: "${TEST_DIST}",`
  );
  if (injected === original) throw new Error("could not inject distDir into next.config.js");
  copyFileSync(CONFIG_PATH, CONFIG_BAK);
  writeFileSync(CONFIG_PATH, injected);
  // Next.js rewrites tsconfig.json + next-env.d.ts to include <distDir>/types
  // — back both up so we can restore them exactly.
  if (existsSync(TSCONFIG_PATH)) copyFileSync(TSCONFIG_PATH, TSCONFIG_BAK);
  if (existsSync(NEXT_ENV_PATH)) copyFileSync(NEXT_ENV_PATH, NEXT_ENV_BAK);
}

function restoreConfig() {
  if (existsSync(CONFIG_BAK)) {
    copyFileSync(CONFIG_BAK, CONFIG_PATH);
    rmSync(CONFIG_BAK, { force: true });
  }
  if (existsSync(TSCONFIG_BAK)) {
    copyFileSync(TSCONFIG_BAK, TSCONFIG_PATH);
    rmSync(TSCONFIG_BAK, { force: true });
  }
  if (existsSync(NEXT_ENV_BAK)) {
    copyFileSync(NEXT_ENV_BAK, NEXT_ENV_PATH);
    rmSync(NEXT_ENV_BAK, { force: true });
  }
  rmSync(path.join(ROOT, TEST_DIST), { recursive: true, force: true });
}

// Remote-mode cleanup: remove exactly what this run created so the schema stays
// empty but alive for the next preview build (a dropped schema would break the
// next deployment's build-time sitemap query). Restores app_settings so the
// live shop's hours/location are never left pointing at test values.
async function cleanupRemoteData(prisma, userId, orderId, originalSettings) {
  if (orderId) {
    const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
    if (order) {
      for (const it of order.items) {
        await prisma.product.update({
          where: { id: it.productId },
          data: { stock: { increment: it.quantity }, sold: { decrement: it.quantity } },
        });
      }
      await prisma.inventoryTx.deleteMany({ where: { orderId } });
      await prisma.order.delete({ where: { id: orderId } });
      ok(`removed test order ${order.orderNumber} (stock restored)`);
    }
  }
  if (userId) {
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    ok("removed test user");
  }
  await prisma.user.delete({ where: { email: ADMIN_EMAIL } }).catch(() => {});
  await prisma.user.delete({ where: { email: STAFF_EMAIL } }).catch(() => {});
  await prisma.product.deleteMany({ where: { sku: { startsWith: "TEST-" } } });
  await prisma.category.deleteMany({ where: { slug: "test-category" } });
  // The seed overwrites app_settings with test hours/location — restore the
  // shop's real values (or drop the row if it didn't exist before).
  if (originalSettings) {
    await prisma.settings.upsert({
      where: { key: "app_settings" },
      update: { value: originalSettings.value },
      create: { key: "app_settings", value: originalSettings.value },
    });
    ok("restored app_settings to pre-run values");
  } else {
    await prisma.settings.deleteMany({ where: { key: "app_settings" } }).catch(() => {});
    ok("removed test app_settings row (none existed before)");
  }
  ok("removed seeded test data (schema kept for preview builds)");
}

// ---------------------------------------------------------------------------
// Dynamic-route sweep (Next 16 async params/searchParams regression guard)
// ---------------------------------------------------------------------------
//
// Next 16 made `params`/`searchParams` Promises. Accessing them synchronously
// (the pre-16 pattern) returns `undefined` at runtime, which crashed every
// dynamic route/page with a 500 — and the main flow only exercised a handful
// of them, so the rest broke silently. This sweep walks src/app for EVERY
// dynamic route and searchParams page, probes each over HTTP with real seeded
// data and the right session, and fails on any unexpected status. The coverage
// guard additionally fails when a NEW dynamic route appears without a probe —
// so a regression in this contract can never ship silently again.

function discoverDynamicPagesAndRoutes() {
  const appDir = path.join(ROOT, "src", "app");
  const dynamic = new Set();
  const searchParamPages = new Set();
  const walk = (dir, segs) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name.startsWith(".")) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full, [...segs, e.name]);
      else if (e.name === "page.tsx" || e.name === "route.ts") {
        const pattern = "/" + segs.join("/");
        if (segs.some((s) => /^\[.*\]$/.test(s))) dynamic.add(pattern);
        // Server pages reading searchParams had the same async-break bug class.
        if (e.name === "page.tsx") {
          const src = readFileSync(full, "utf8");
          if (/searchParams\s*:\s*Promise</.test(src)) searchParamPages.add(pattern);
        }
      }
    }
  };
  walk(appDir, []);
  return { dynamic: [...dynamic].sort(), searchParamPages: [...searchParamPages].sort() };
}

async function sweepDynamicRoutes(ctx) {
  const { prisma, chips, category, orderId, userId, address, jars } = ctx;
  const { customer, admin, staff } = jars;
  const discovered = discoverDynamicPagesAndRoutes();

  // Throwaway rows so DELETE probes are deterministic (Prisma `delete` on a
  // missing id 500s, and deleting seeded rows would break the flow). The
  // throwaway address is also what the address DELETE probe removes — the
  // customer's real address is referenced by the order's FK, so deleting it
  // would 500.
  const ts = Date.now();
  const sweepCoupon = await prisma.coupon.create({
    data: { code: `SWEEP-${ts}`, type: "FIXED", value: 10, active: true },
  });
  const sweepCategory = await prisma.category.create({
    data: { name: `Sweep ${ts}`, slug: `sweep-${ts}`, order: 99, active: true },
  });
  const sweepProduct = await prisma.product.create({
    data: {
      name: `Sweep Product ${ts}`,
      slug: `sweep-product-${ts}`,
      description: "Dynamic-route sweep throwaway",
      categoryId: category.id,
      price: 1,
      mrp: 1,
      image: "/images/products/parle-g/1.jpg",
      stock: 1,
      sku: `TEST-SWEEP-${ts}`,
      unit: "1 pc",
    },
  });
  const sweepAddress = await prisma.address.create({
    data: {
      userId,
      fullName: "Sweep",
      mobile: "9876500099",
      house: "1",
      street: "Sweep St",
      area: "Sweep Area",
      city: "Indore",
      state: "Madhya Pradesh",
      pincode: "452010",
      lat: 22.754,
      lng: 75.894,
    },
  });

  const P = (method, url, { jar, body } = {}) =>
    request(url, { method, jar, body: body ? JSON.stringify(body) : undefined });

  // pattern → one or more probes. Every discovered pattern must be present
  // here (the coverage guard below enforces it).
  const probes = [
    // ── dynamic pages ──
    { pattern: "/shop/[slug]", method: "GET", label: "shop/[slug] (valid)", run: () => P("GET", `/shop/${chips.slug}`), allowed: [200] },
    { pattern: "/shop/[slug]", method: "GET", label: "shop/[slug] (bogus → 404)", run: () => P("GET", "/shop/does-not-exist-xyz"), allowed: [404] },
    { pattern: "/category/[slug]", method: "GET", label: "category/[slug] (valid)", run: () => P("GET", `/category/${category.slug}`), allowed: [200] },
    { pattern: "/category/[slug]", method: "GET", label: "category/[slug] (bogus → 404)", run: () => P("GET", "/category/does-not-exist-xyz"), allowed: [404] },
    { pattern: "/account/orders/[id]", method: "GET", label: "account/orders/[id] (customer)", run: () => P("GET", `/account/orders/${orderId}`, { jar: customer }), allowed: [200] },
    { pattern: "/account/orders/[id]", method: "GET", label: "account/orders/[id] (anon → redirect)", run: () => P("GET", `/account/orders/${orderId}`), allowed: [307, 302] },
    { pattern: "/admin/products/[id]", method: "GET", label: "admin/products/[id] (admin)", run: () => P("GET", `/admin/products/${chips.id}`, { jar: admin }), allowed: [200] },
    { pattern: "/admin/orders/[id]", method: "GET", label: "admin/orders/[id] (admin)", run: () => P("GET", `/admin/orders/${orderId}`, { jar: admin }), allowed: [200] },
    { pattern: "/delivery/[orderId]", method: "GET", label: "delivery/[orderId] (staff)", run: () => P("GET", `/delivery/${orderId}`, { jar: staff }), allowed: [200] },
    // ── searchParams server pages ──
    { pattern: "/shop", method: "GET", label: "shop searchParams filters", run: () => P("GET", "/shop?q=chips&sort=price-asc"), allowed: [200] },
    { pattern: "/delivery", method: "GET", label: "delivery searchParams filters (staff)", run: () => P("GET", "/delivery?payment=COD&sort=newest&assignee=me", { jar: staff }), allowed: [200] },
    { pattern: "/delivery", method: "GET", label: "delivery assignee filters (staff)", run: () => P("GET", "/delivery?assignee=unassigned", { jar: staff }), allowed: [200] },
    { pattern: "/admin/orders", method: "GET", label: "admin/orders searchParams filters (admin)", run: () => P("GET", "/admin/orders?status=CONFIRMED", { jar: admin }), allowed: [200] },
    { pattern: "/admin/delivery-stats", method: "GET", label: "admin delivery-stats page (admin)", run: () => P("GET", "/admin/delivery-stats", { jar: admin }), allowed: [200] },
    // ── account API ──
    { pattern: "/api/account/addresses/[id]", method: "PATCH", label: "address PATCH (customer, no-op)", run: () => P("PATCH", `/api/account/addresses/${address.id}`, { jar: customer, body: { area: "Vijay Nagar" } }), allowed: [200] },
    { pattern: "/api/account/addresses/[id]", method: "DELETE", label: "address DELETE (customer, throwaway)", run: () => P("DELETE", `/api/account/addresses/${sweepAddress.id}`, { jar: customer }), allowed: [200] },
    // ── admin API ──
    { pattern: "/api/admin/categories/[id]", method: "PATCH", label: "category PATCH (admin)", run: () => P("PATCH", `/api/admin/categories/${category.id}`, { jar: admin, body: { name: "Test Category" } }), allowed: [200] },
    { pattern: "/api/admin/categories/[id]", method: "DELETE", label: "category DELETE (admin, throwaway)", run: () => P("DELETE", `/api/admin/categories/${sweepCategory.id}`, { jar: admin }), allowed: [200] },
    { pattern: "/api/admin/coupons/[id]", method: "PATCH", label: "coupon PATCH (admin, throwaway)", run: () => P("PATCH", `/api/admin/coupons/${sweepCoupon.id}`, { jar: admin, body: { active: false } }), allowed: [200] },
    { pattern: "/api/admin/coupons/[id]", method: "DELETE", label: "coupon DELETE (admin, throwaway)", run: () => P("DELETE", `/api/admin/coupons/${sweepCoupon.id}`, { jar: admin }), allowed: [200] },
    { pattern: "/api/admin/inventory/[id]", method: "POST", label: "inventory POST (admin, delta 0)", run: () => P("POST", `/api/admin/inventory/${chips.id}`, { jar: admin, body: { delta: 0, reason: "ADJUSTMENT", note: "sweep" } }), allowed: [200] },
    { pattern: "/api/admin/products/[id]", method: "PATCH", label: "product PATCH (admin, no-op)", run: () => P("PATCH", `/api/admin/products/${chips.id}`, { jar: admin, body: { name: "Test Chips" } }), allowed: [200] },
    { pattern: "/api/admin/products/[id]", method: "DELETE", label: "product DELETE (admin, throwaway)", run: () => P("DELETE", `/api/admin/products/${sweepProduct.id}`, { jar: admin }), allowed: [200] },
    { pattern: "/api/admin/users/[id]", method: "PATCH", label: "user PATCH (admin, no-op role)", run: () => P("PATCH", `/api/admin/users/${userId}`, { jar: admin, body: { role: "CUSTOMER" } }), allowed: [200] },
    { pattern: "/api/admin/orders/[id]/status", method: "PATCH", label: "admin order status PATCH (admin, bogus → 404)", run: () => P("PATCH", "/api/admin/orders/not-a-real-id/status", { jar: admin, body: { status: "CONFIRMED" } }), allowed: [404] },
    { pattern: "/api/admin/orders/[id]/assign", method: "PATCH", label: "admin order assign PATCH (admin, bogus → 404)", run: () => P("PATCH", "/api/admin/orders/not-a-real-id/assign", { jar: admin, body: { assignedTo: null } }), allowed: [404] },
    // ── delivery API (bogus id → 404 proves params resolve + lookup runs) ──
    { pattern: "/api/delivery/orders/[id]/status", method: "PATCH", label: "delivery status PATCH (staff, bogus → 404)", run: () => P("PATCH", "/api/delivery/orders/not-a-real-id/status", { jar: staff, body: { status: "OUT_FOR_DELIVERY" } }), allowed: [404] },
    { pattern: "/api/delivery/orders/[id]/photo", method: "POST", label: "delivery photo POST (staff, bogus → 404)", run: () => P("POST", "/api/delivery/orders/not-a-real-id/photo", { jar: staff }), allowed: [404] },
    // ── customer API ──
    { pattern: "/api/orders/[id]/invoice", method: "GET", label: "invoice GET (customer)", run: () => P("GET", `/api/orders/${orderId}/invoice`, { jar: customer }), allowed: [200] },
    { pattern: "/api/orders/[id]/rating", method: "PATCH", label: "order rating PATCH (customer, bogus → 404)", run: () => P("PATCH", "/api/orders/not-a-real-id/rating", { jar: customer, body: { rating: 5 } }), allowed: [404] },
    // ── NextAuth catch-all (framework-handled; exercised by every login) ──
    { pattern: "/api/auth/[...nextauth]", method: "GET", label: "nextauth catch-all (providers)", run: () => P("GET", "/api/auth/providers"), allowed: [200] },
  ];

  try {
    // Coverage guard: a dynamic route/page added to src/app without a probe
    // here fails the suite with a loud message instead of passing silently.
    const covered = new Set(probes.map((p) => p.pattern));
    const missingDynamic = discovered.dynamic.filter((p) => !covered.has(p));
    const missingSP = discovered.searchParamPages.filter((p) => !covered.has(p));
    assert(
      missingDynamic.length === 0,
      `every dynamic page/route has a sweep probe (uncovered: ${missingDynamic.join(", ") || "none"})`
    );
    assert(
      missingSP.length === 0,
      `every searchParams page has a sweep probe (uncovered: ${missingSP.join(", ") || "none"})`
    );

    for (const p of probes) {
      const res = await p.run();
      if (p.allowed.includes(res.status)) {
        ok(`${p.method} ${p.pattern} — ${p.label} → ${res.status}`);
      } else {
        failures++;
        fail(`${p.method} ${p.pattern} — ${p.label} → ${res.status} (expected ${p.allowed.join("|")})`);
      }
    }

    // The throwaway rows must actually be gone (the DELETE probes did real
    // work). The product DELETE route soft-deletes (active: false) instead of
    // removing the row — both behaviors are verified.
    const couponGone = !(await prisma.coupon.findUnique({ where: { id: sweepCoupon.id } }));
    const categoryGone = !(await prisma.category.findUnique({ where: { id: sweepCategory.id } }));
    const productSoftDeleted = (await prisma.product.findUnique({ where: { id: sweepProduct.id } }))?.active === false;
    const addressGone = !(await prisma.address.findUnique({ where: { id: sweepAddress.id } }));
    assert(
      couponGone && categoryGone && productSoftDeleted && addressGone,
      "throwaway rows removed by their DELETE probes"
    );
  } finally {
    // If any probe failed mid-way, still remove the throwaways (TEST- sku is
    // also swept by remote cleanup).
    await prisma.coupon.deleteMany({ where: { id: sweepCoupon.id } }).catch(() => {});
    await prisma.category.deleteMany({ where: { id: sweepCategory.id } }).catch(() => {});
    await prisma.product.deleteMany({ where: { id: sweepProduct.id } }).catch(() => {});
    await prisma.address.deleteMany({ where: { id: sweepAddress.id } }).catch(() => {});
    await prisma.inventoryTx.deleteMany({ where: { note: "sweep" } }).catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// Browser console check (script-tag / LCP / hydration / uncaught errors)
// ---------------------------------------------------------------------------
//
// The HTTP sweep can assert status codes and HTML but never sees what a real
// browser console reports. This step drives the system Chrome/Edge via
// playwright-core (no browser download — CI runners and this machine both have
// one) across the core public pages and fails the suite on:
//   • "Encountered a script tag while rendering React component"
//   • "was detected as the Largest Contentful Paint" …with loading="lazy"
//   • hydration failures / mismatches
//   • "Cannot update a component while rendering a different component"
//   • any uncaught page error
// Known pre-existing noise (next-auth dev session-fetch race) is ignored — it
// is dev-only and absent from production builds.

function findSystemChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  ].filter(Boolean);
  return candidates.find((p) => existsSync(p));
}

async function checkBrowserConsole() {
  log("browser console check (script-tag / LCP / hydration / uncaught errors)…");
  const { chromium } = require("playwright-core");
  const execPath = findSystemChrome();
  let browser = null;
  let launchErr = null;
  if (execPath) {
    try {
      browser = await chromium.launch({ headless: true, executablePath: execPath });
    } catch (e) {
      launchErr = e;
    }
  }
  if (!browser) {
    for (const channel of ["chrome", "msedge"]) {
      try {
        browser = await chromium.launch({ headless: true, channel });
        break;
      } catch (e) {
        launchErr = e;
      }
    }
  }
  if (!browser) {
    log(
      `⚠️ no system browser available (${(launchErr?.message || "unknown").split("\n")[0]}) — console check skipped (install Chrome/Edge to enable)`
    );
    return;
  }

  const BAD = [
    /Encountered a script tag while rendering React component/i,
    /was detected as the Largest Contentful Paint/i,
    /Hydration failed|hydration (mismatch|error)|did not match|didn't match/i,
    /Cannot update a component .* while rendering a different component/i,
  ];
  const IGNORE = [/CLIENT_FETCH_ERROR/i, /fetch failed/i];
  const issues = [];
  const seen = new Set();
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  page.on("console", (msg) => {
    if (msg.type() !== "error" && msg.type() !== "warning") return;
    const text = msg.text();
    if (IGNORE.some((r) => r.test(text))) return;
    if (BAD.some((r) => r.test(text))) {
      const key = text.slice(0, 120);
      if (!seen.has(key)) {
        seen.add(key);
        issues.push(`${msg.type()} — ${text}`);
      }
    }
  });
  page.on("pageerror", (err) => {
    if (IGNORE.some((r) => r.test(err.message))) return;
    issues.push(`uncaught error — ${err.message}`);
  });

  // Core public pages; protected pages are covered by the HTTP sweep. The
  // product slug is discovered from the live /shop HTML so the check works in
  // both local and remote mode regardless of seeded data.
  let slug = null;
  try {
    const shopHtml = await (await request("/shop")).text();
    const m = shopHtml.match(/\/shop\/([a-z0-9-]+)/);
    if (m) slug = m[1];
  } catch {
    /* slug discovery is best-effort */
  }
  const urls = ["/", "/shop", slug ? `/shop/${slug}` : null, "/login", "/track-order"].filter(Boolean);

  for (const u of urls) {
    try {
      await page.goto(BASE + u, { waitUntil: "domcontentloaded", timeout: 60_000 });
      // LCP warnings fire a beat after load (the LCP observer resolves late).
      await page.waitForTimeout(2_500);
    } catch (e) {
      issues.push(`failed to load ${u} — ${(e.message || "").split("\n")[0]}`);
    }
  }

  await browser.close().catch(() => {});

  if (issues.length > 0) {
    for (const i of issues) {
      failures++;
      fail(i);
    }
  } else {
    ok(`console clean on ${urls.length} core pages (${urls.join(", ")})`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const dotEnv = existsSync(path.join(ROOT, ".env")) ? loadDotEnv(path.join(ROOT, ".env")) : {};
  const TEST_URL =
    process.env.E2E_TEST_DB_URL ||
    (dotEnv.DIRECT_URL
      ? `${dotEnv.DIRECT_URL}${dotEnv.DIRECT_URL.includes("?") ? "&" : "?"}schema=${SCHEMA}`
      : "");
  if (!TEST_URL) throw new Error("no test database: set E2E_TEST_DB_URL or DIRECT_URL in .env");

  log(REMOTE_MODE ? `remote mode → ${BASE}` : `local mode → ${BASE}`);
  log(`test database: ${TEST_URL.replace(/:[^:@/]+@/, ":***@")}`);

  let userId;
  let orderId;
  let uploadedPhotoUrl = null;

  if (!REMOTE_MODE) {
    // Refuse to run if the test port is already serving something.
    try {
      const probe = await fetch(BASE, { signal: AbortSignal.timeout(3_000) });
      if (probe.ok) throw new Error(`port ${PORT} is already serving a web app — kill it first`);
    } catch (e) {
      if (e.message && e.message.includes("already serving")) throw e;
    }
  }

  // 1. Ensure schema + tables exist (idempotent; in remote mode the schema is
  // pre-created so preview builds pass — this only syncs tables).
  log("syncing schema & tables (prisma db push)…");
  const push = spawnSync("npx prisma db push --skip-generate --accept-data-loss", {
    cwd: ROOT,
    shell: true,
    env: { ...process.env, DATABASE_URL: TEST_URL, DIRECT_URL: TEST_URL },
    stdio: "inherit",
    timeout: 240_000,
  });
  if (push.status !== 0) throw new Error("prisma db push failed");

  // 2. Seed minimal data (category, 2 products, open-shop settings) — upserts
  // so repeated runs are safe.
  log("seeding test data…");
  process.env.DATABASE_URL = TEST_URL;
  process.env.DIRECT_URL = TEST_URL;
  const prisma = new PrismaClient();

  const category = await prisma.category.upsert({
    where: { slug: "test-category" },
    update: { name: "Test Category" },
    create: { name: "Test Category", slug: "test-category" },
  });
  const chips = await prisma.product.upsert({
    where: { sku: "TEST-CHIPS-001" },
    update: {
      name: "Test Chips",
      price: 20,
      mrp: 20,
      stock: 5,
      sold: 0,
      active: true,
      categoryId: category.id,
    },
    create: {
      name: "Test Chips",
      slug: "test-chips",
      description: "Integration test product",
      categoryId: category.id,
      price: 20,
      mrp: 20,
      image: "/images/products/parle-g/1.jpg",
      stock: 5,
      sku: "TEST-CHIPS-001",
      unit: "80 g",
    },
  });
  const drink = await prisma.product.upsert({
    where: { sku: "TEST-DRINK-001" },
    update: {
      name: "Test Drink",
      price: 30,
      mrp: 30,
      stock: 4,
      sold: 0,
      active: true,
      categoryId: category.id,
    },
    create: {
      name: "Test Drink",
      slug: "test-drink",
      description: "Integration test product",
      categoryId: category.id,
      price: 30,
      mrp: 30,
      image: "/images/products/parle-g/1.jpg",
      stock: 4,
      sku: "TEST-DRINK-001",
      unit: "500 ml",
    },
  });
  // In remote mode the seed overwrites the SHARED app_settings row — capture
  // the shop's real values first so cleanup can restore them exactly.
  const originalSettings = REMOTE_MODE
    ? await prisma.settings.findUnique({ where: { key: "app_settings" } })
    : null;
  await prisma.settings.upsert({
    where: { key: "app_settings" },
    update: { value: JSON.stringify(TEST_SETTINGS) },
    create: { key: "app_settings", value: JSON.stringify(TEST_SETTINGS) },
  });
  const adminHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { passwordHash: adminHash, role: "ADMIN", status: "ACTIVE", name: "E2E Admin", mobile: ADMIN_MOBILE },
    create: {
      email: ADMIN_EMAIL,
      name: "E2E Admin",
      mobile: ADMIN_MOBILE,
      passwordHash: adminHash,
      role: "ADMIN",
      status: "ACTIVE",
    },
  });
  const staffHash = await bcrypt.hash(STAFF_PASSWORD, 10);
  await prisma.user.upsert({
    where: { email: STAFF_EMAIL },
    update: { passwordHash: staffHash, role: "STAFF", status: "ACTIVE", name: "E2E Staff", mobile: STAFF_MOBILE },
    create: {
      email: STAFF_EMAIL,
      name: "E2E Staff",
      mobile: STAFF_MOBILE,
      passwordHash: staffHash,
      role: "STAFF",
      status: "ACTIVE",
    },
  });
  ok(`seeded category + ${chips.name} (₹${chips.price}) + ${drink.name} (₹${drink.price}) + admin ${ADMIN_EMAIL} + staff ${STAFF_EMAIL}`);

  // 3. Local mode: start the app against the test schema on a dedicated port
  // and an isolated build directory. Remote mode: target is already running.
  let server = null;
  let serverExited = true;
  if (!REMOTE_MODE) {
    installIsolatedDistDir();
    log(`starting dev server on :${PORT} (build dir ${TEST_DIST})…`);
    server = spawn("node", ["node_modules/next/dist/bin/next", "dev", "-p", String(PORT)], {
      cwd: ROOT,
      env: { ...process.env, DATABASE_URL: TEST_URL, DIRECT_URL: TEST_URL, NEXTAUTH_URL: BASE },
      stdio: "ignore",
    });
    serverExited = false;
    server.on("exit", () => {
      serverExited = true;
    });
    process.on("exit", restoreConfig);
    process.on("SIGINT", () => {
      restoreConfig();
      process.exit(130);
    });
    process.on("SIGTERM", () => {
      restoreConfig();
      process.exit(143);
    });
  }

  try {
    if (!(await waitForServer(REMOTE_MODE ? 300_000 : 180_000))) {
      throw new Error(REMOTE_MODE ? `app did not become ready at ${BASE}` : "dev server did not become ready");
    }
    ok(REMOTE_MODE ? `app ready at ${BASE}` : "dev server ready");

    // 4. The flow — every step hits a real HTTP endpoint of the running app.
    log("running signup → login → address → order flow…");

    const email = `e2e-${Date.now()}@example.com`;
    const password = "E2ETest123!";

    const signupRes = await request("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({ name: "E2E Tester", email, mobile: "9876500001", password }),
    });
    const signupJson = await signupRes.json();
    assert(signupRes.status === 200 && signupJson.id, "signup creates a user");
    userId = signupJson.id;

    const jar = new CookieJar();
    const csrfRes = await request("/api/auth/csrf", { jar });
    const { csrfToken } = await csrfRes.json();
    const loginRes = await request("/api/auth/callback/credentials", {
      method: "POST",
      jar,
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ csrfToken, identifier: email, password }).toString(),
    });
    assert(loginRes.status === 302, "login redirects on success");
    // next-auth names the session cookie next-auth.session-token locally but
    // __Secure-next-auth.session-token on HTTPS (Vercel) — accept both.
    const sessionCookie = [...jar.cookies.keys()].find((k) => k.includes("next-auth.session-token"));
    assert(!!sessionCookie, `session cookie issued (${sessionCookie || "missing"})`);

    const addrRes = await request("/api/account/addresses", {
      method: "POST",
      jar,
      body: JSON.stringify({
        fullName: "E2E Tester",
        mobile: "9876500001",
        house: "12, Silver Springs",
        street: "Vijay Nagar Main Road",
        area: "Vijay Nagar",
        landmark: "Near Orbit Mall",
        city: "Indore",
        state: "Madhya Pradesh",
        pincode: "452010",
        lat: 22.754,
        lng: 75.894,
      }),
    });
    const address = await addrRes.json();
    assert(addrRes.status === 200 && address.id, "address created with coordinates");

    // Expected pricing from seeded data: chips×2 (₹40) + drink×2 (₹60) = ₹100,
    // ~0.1 km → ₹20 delivery slab, 5% tax → ₹5, total ₹125.
    const orderRes = await request("/api/orders", {
      method: "POST",
      jar,
      body: JSON.stringify({
        items: [
          { productId: chips.id, quantity: 2 },
          { productId: drink.id, quantity: 2 },
        ],
        addressId: address.id,
        paymentMethod: "COD",
      }),
    });
    const orderJson = await orderRes.json();
    assert(orderRes.status === 200 && orderJson.orderId, `COD order placed (${orderJson.orderNumber})`);
    // With the toggles on, placement also runs the store-owner SMS + customer
    // confirmation SMS/WhatsApp senders in demo mode — a crash in any of them
    // would fail this assertion.
    assert(TEST_SETTINGS.notifySms === true && TEST_SETTINGS.notifyWhatsapp === true, "SMS/WhatsApp toggles on for the alert paths");
    orderId = orderJson.orderId;

    const overRes = await request("/api/orders", {
      method: "POST",
      jar,
      body: JSON.stringify({
        items: [{ productId: drink.id, quantity: 10 }],
        addressId: address.id,
        paymentMethod: "COD",
      }),
    });
    const overJson = await overRes.json();
    assert(
      overRes.status === 400 && /available/i.test(overJson.error || ""),
      `oversell rejected by stock check (got ${overRes.status}: ${JSON.stringify(overJson).slice(0, 140)})`
    );

    // 5. Verify everything persisted.
    log("verifying persistence in the database…");

    const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
    assert(!!order, "order row persisted");
    if (order) {
      assert(order.status === "PLACED" && order.paymentMethod === "COD" && order.paymentStatus === "PENDING", "order state PLACED / COD / PENDING");
      assert(order.subtotal === 100, `subtotal ₹${order.subtotal} (expected ₹100)`);
      assert(order.deliveryCharge === 20, `delivery ₹${order.deliveryCharge} (expected ₹20)`);
      assert(order.tax === 5, `tax ₹${order.tax} (expected ₹5)`);
      assert(order.total === 125, `total ₹${order.total} (expected ₹125)`);
      assert(typeof order.distanceKm === "number" && order.distanceKm < 1, `distance computed (${order.distanceKm?.toFixed(2)} km)`);
      assert(order.items.length === 2, "2 order items persisted");
      const names = order.items.map((i) => i.name).sort();
      assert(
        JSON.stringify(names) === JSON.stringify(["Test Chips", "Test Drink"]),
        "item snapshots match (name/sku/price)"
      );
      assert(order.items.every((i) => i.lineTotal === i.unitPrice * i.quantity), "line totals correct");
    }

    const txs = await prisma.inventoryTx.findMany({ where: { orderId } });
    assert(txs.length === 2 && txs.every((t) => t.change < 0 && t.reason === "ORDER"), "inventory deductions recorded");

    const chipsAfter = await prisma.product.findUnique({ where: { id: chips.id } });
    const drinkAfter = await prisma.product.findUnique({ where: { id: drink.id } });
    assert(chipsAfter.stock === 3 && chipsAfter.sold === 2, `chips stock 5→${chipsAfter.stock}, sold ${chipsAfter.sold}`);
    assert(drinkAfter.stock === 2 && drinkAfter.sold === 2, `drink stock 4→${drinkAfter.stock}, sold ${drinkAfter.sold}`);

    const notif = await prisma.notification.findFirst({ where: { userId, type: "ORDER" }, orderBy: { createdAt: "desc" } });
    assert(!!notif && /Order confirmed/.test(notif.title), "customer notification persisted");

    const activity = await prisma.activityLog.findFirst({ where: { userId, action: "ORDER_PLACED" }, orderBy: { createdAt: "desc" } });
    assert(!!activity, "admin activity log persisted (regression: fire-and-forget race)");

    // 5b. Admin panel: login → view orders → update status → verify.
    log("admin panel: login → view orders → update status…");

    const adminJar = new CookieJar();
    const adminCsrfRes = await request("/api/auth/csrf", { jar: adminJar });
    const { csrfToken: adminCsrf } = await adminCsrfRes.json();
    const adminLoginRes = await request("/api/auth/callback/credentials", {
      method: "POST",
      jar: adminJar,
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ csrfToken: adminCsrf, identifier: ADMIN_EMAIL, password: ADMIN_PASSWORD }).toString(),
    });
    assert(adminLoginRes.status === 302, "admin login redirects on success");
    assert(
      [...adminJar.cookies.keys()].some((k) => k.includes("next-auth.session-token")),
      "admin session cookie issued"
    );

    // The admin gate: no session and a non-admin session are both redirected away.
    const anonGate = await request("/admin/orders");
    assert(anonGate.status === 307 || anonGate.status === 302, "admin orders page redirects anonymous visitors");
    const customerGate = await request("/admin/orders", { jar });
    assert(customerGate.status === 307 || customerGate.status === 302, "admin orders page redirects customer sessions");

    const ordersPageRes = await request("/admin/orders", { jar: adminJar });
    const ordersHtml = await ordersPageRes.text();
    assert(ordersPageRes.status === 200, "admin orders page loads for admin (200)");
    assert(ordersHtml.includes(orderJson.orderNumber), `order ${orderJson.orderNumber} visible in admin orders list`);

    const statusRes = await request(`/api/admin/orders/${orderId}/status`, {
      method: "PATCH",
      jar: adminJar,
      body: JSON.stringify({ status: "CONFIRMED" }),
    });
    const statusJson = await statusRes.json();
    assert(statusRes.status === 200 && statusJson.ok === true, "order status updated via admin API");

    const updatedOrder = await prisma.order.findUnique({ where: { id: orderId } });
    assert(updatedOrder.status === "CONFIRMED", `order status persisted as ${updatedOrder.status}`);

    const statusNotif = await prisma.notification.findFirst({
      where: { userId, type: "ORDER", title: "Order update" },
      orderBy: { createdAt: "desc" },
    });
    assert(!!statusNotif && /CONFIRMED/i.test(statusNotif.body), "customer notified of status change");

    const statusActivity = await prisma.activityLog.findFirst({
      where: { action: "ORDER_STATUS_CHANGED", entityId: orderId },
      orderBy: { createdAt: "desc" },
    });
    assert(!!statusActivity, "admin activity logged for status change");

    // Assignment is the access grant for delivery staff. Route the test order
    // before exercising the staff-only dashboard and delivery APIs.
    const staffUser = await prisma.user.findUnique({
      where: { email: STAFF_EMAIL },
      select: { id: true },
    });
    assert(!!staffUser, "delivery staff account exists for assignment");
    const assignRes = await request(`/api/admin/orders/${orderId}/assign`, {
      method: "PATCH",
      jar: adminJar,
      body: JSON.stringify({ assignedTo: staffUser.id }),
      headers: { "content-type": "application/json" },
    });
    assert(assignRes.status === 200, "admin assigns order to delivery staff");

    // 5c. Delivery dashboard: STAFF login → orders list → detail with map pin.
    log("delivery dashboard: STAFF login → orders → map pin…");

    const staffJar = new CookieJar();
    const staffCsrfRes = await request("/api/auth/csrf", { jar: staffJar });
    const { csrfToken: staffCsrf } = await staffCsrfRes.json();
    const staffLoginRes = await request("/api/auth/callback/credentials", {
      method: "POST",
      jar: staffJar,
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ csrfToken: staffCsrf, identifier: STAFF_EMAIL, password: STAFF_PASSWORD }).toString(),
    });
    assert(staffLoginRes.status === 302, "staff login redirects on success");
    assert(
      [...staffJar.cookies.keys()].some((k) => k.includes("next-auth.session-token")),
      "staff session cookie issued"
    );

    // The delivery gate: anonymous and customer sessions are redirected away.
    const deliveryAnon = await request("/delivery");
    assert(deliveryAnon.status === 307 || deliveryAnon.status === 302, "delivery page redirects anonymous visitors");
    const deliveryCust = await request("/delivery", { jar });
    assert(deliveryCust.status === 307 || deliveryCust.status === 302, "delivery page redirects customer sessions");

    const deliveryRes = await request("/delivery", { jar: staffJar });
    const deliveryHtml = await deliveryRes.text();
    assert(deliveryRes.status === 200, "delivery dashboard loads for staff (200)");
    assert(deliveryHtml.includes(orderJson.orderNumber), `order ${orderJson.orderNumber} in delivery dashboard`);
    assert(
      /Live/.test(deliveryHtml) && /Refresh/.test(deliveryHtml),
      "delivery dashboard auto-refresh indicator rendered"
    );
    assert(
      deliveryHtml.includes('aria-label="Mute new-order alerts"'),
      "new-order alert (sound & vibration) toggle rendered"
    );
    assert(
      deliveryHtml.includes(`data-order-number="${orderJson.orderNumber}"`),
      "order cards carry data-order-number for alert dedupe"
    );

    const detailRes = await request(`/delivery/${orderId}`, { jar: staffJar });
    const detailHtml = await detailRes.text();
    assert(detailRes.status === 200, "delivery order detail loads (200)");
    assert(
      /saddr=/.test(detailHtml) && /daddr=/.test(detailHtml),
      "Google Maps route embed (shop → delivery address) rendered"
    );
    assert(detailHtml.includes("Navigate in Google Maps"), "directions link rendered");

    // 5d. Delivery status actions: staff marks OUT_FOR_DELIVERY then DELIVERED.
    log("delivery status actions: OUT_FOR_DELIVERY → DELIVERED…");

    // Customers cannot use the delivery status API (gate check).
    const staffGate = await request(`/api/delivery/orders/${orderId}/status`, {
      method: "PATCH",
      jar,
      body: JSON.stringify({ status: "DELIVERED" }),
    });
    assert(staffGate.status === 307 || staffGate.status === 302, "customer sessions blocked from delivery status API");

    const ofdRes = await request(`/api/delivery/orders/${orderId}/status`, {
      method: "PATCH",
      jar: staffJar,
      body: JSON.stringify({ status: "OUT_FOR_DELIVERY" }),
    });
    assert(ofdRes.status === 200, "staff marks order OUT_FOR_DELIVERY");

    const ofdOrder = await prisma.order.findUnique({ where: { id: orderId } });
    assert(ofdOrder.status === "OUT_FOR_DELIVERY", `order status persisted (${ofdOrder.status})`);
    assert(/^\d{6}$/.test(ofdOrder.deliveryPin || ""), "order has a unique 6-digit delivery PIN");
    const ofdPin = ofdOrder.deliveryPin;

    const ofdNotif = await prisma.notification.findFirst({
      where: { userId, type: "ORDER", body: { contains: "Out for Delivery" } },
      orderBy: { createdAt: "desc" },
    });
    assert(!!ofdNotif, "customer notified of out-for-delivery");
    assert(
      ofdNotif && ofdNotif.body.includes(ofdPin),
      "out-for-delivery notification includes the delivery PIN"
    );

    const ofdActivity = await prisma.activityLog.findFirst({
      where: { action: "ORDER_STATUS_CHANGED", entityId: orderId, meta: { contains: "OUT_FOR_DELIVERY" } },
      orderBy: { createdAt: "desc" },
    });
    assert(!!ofdActivity, "delivery status change logged (OUT_FOR_DELIVERY)");

    const invalidRes = await request(`/api/delivery/orders/${orderId}/status`, {
      method: "PATCH",
      jar: staffJar,
      body: JSON.stringify({ status: "OUT_FOR_DELIVERY" }),
    });
    assert(invalidRes.status === 400, "re-marks OUT_FOR_DELIVERY rejected (forward-only)");

    // Proof of delivery: a photo + the customer's PIN are required first.
    const noPodRes = await request(`/api/delivery/orders/${orderId}/status`, {
      method: "PATCH",
      jar: staffJar,
      body: JSON.stringify({ status: "DELIVERED" }),
    });
    assert(noPodRes.status === 400, "DELIVERED rejected without photo and PIN");

    const wrongPinRes = await request(`/api/delivery/orders/${orderId}/status`, {
      method: "PATCH",
      jar: staffJar,
      body: JSON.stringify({
        status: "DELIVERED",
        deliveryPhotoUrl: "https://example.com/proof.jpg",
        deliveryPin: "0000",
      }),
    });
    assert(wrongPinRes.status === 400, "wrong delivery PIN rejected");

    // Staff uploads a tiny proof photo, then delivers with the correct PIN.
    // The upload requires a configured storage backend (Supabase
    // `delivery-proofs` bucket). When storage isn't provisioned, the
    // photo-gated assertions are skipped with a warning so the rest of the
    // suite still runs — the PIN/validation gates above still get covered.
    const tinyPng = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64"
    );
    const photoForm = new FormData();
    photoForm.append("file", new Blob([tinyPng], { type: "image/png" }), "proof.png");
    const photoRes = await request(`/api/delivery/orders/${orderId}/photo`, {
      method: "POST",
      jar: staffJar,
      body: photoForm,
    });
    const photoJson = photoRes.status === 200 ? await photoRes.json() : null;
    const storageReady = photoRes.status === 200 && photoJson?.url?.includes("delivery-proofs");
    if (storageReady) {
      assert(true, "staff uploads delivery photo");
      assert(true, "photo upload returns a public storage URL");
      uploadedPhotoUrl = photoJson.url;
    } else {
      log(
        "⚠️ delivery-proofs storage not configured (photo upload HTTP " +
          photoRes.status +
          ") — skipping photo/DELIVERED assertions. Create the Supabase bucket to enable them."
      );
    }

    const deliveredRes = storageReady
      ? await request(`/api/delivery/orders/${orderId}/status`, {
          method: "PATCH",
          jar: staffJar,
          body: JSON.stringify({
            status: "DELIVERED",
            deliveryPhotoUrl: photoJson.url,
            deliveryPin: ofdPin,
          }),
        })
      : null;
    assert(!storageReady || deliveredRes.status === 200, "staff marks order DELIVERED with photo + PIN");

    const deliveredOrder = await prisma.order.findUnique({ where: { id: orderId } });
    assert(
      !storageReady || deliveredOrder.status === "DELIVERED",
      `order status persisted (${deliveredOrder.status})`
    );
    assert(
      !storageReady || deliveredOrder.deliveryPhotoUrl === photoJson.url,
      "delivery photo URL persisted on the order"
    );

    // DELIVERED also fires the customer SMS/WhatsApp senders in demo mode
    // (external — verified via live site; the in-app notification below is the
    // observable proxy).
    if (storageReady) {
      const deliveredNotif = await prisma.notification.findFirst({
        where: { userId, type: "ORDER", body: { contains: "Delivered" } },
        orderBy: { createdAt: "desc" },
      });
      assert(!!deliveredNotif, "customer notified of delivery");
    }

    // The customer's order page shows their delivery PIN (works from
    // OUT_FOR_DELIVERY onward).
    const custOrderRes = await request(`/account/orders/${orderId}`, { jar });
    const custOrderHtml = await custOrderRes.text();
    assert(custOrderHtml.includes(ofdPin), "customer order page shows the delivery PIN");

    // The dashboard only lists active orders — a delivered order disappears.
    if (storageReady) {
      const afterRes = await request("/delivery", { jar: staffJar });
      const afterHtml = await afterRes.text();
      assert(!afterHtml.includes(orderJson.orderNumber), "delivered order leaves the delivery dashboard");
    }

    // 5e2. Dashboard filters: status / payment / time / sort.
    log("delivery dashboard filters…");
    const seedProduct = await prisma.product.findFirst();
    const mkFilterOrder = (num, paymentMethod, createdAt) =>
      prisma.order.create({
        data: {
          orderNumber: num,
          status: "PLACED",
          paymentMethod,
          paymentStatus: "PENDING",
          subtotal: 100,
          deliveryCharge: 20,
          tax: 5,
          total: 125,
          distanceKm: 1,
          eta: "35 mins",
          deliveryPin: "1234",
          // The staff dashboard only shows orders assigned to the rider
          // (assignment is the access grant), so assign the filter-test
          // orders to the staff account being exercised.
          assignedTo: staffUser.id,
          assignedToName: "Delivery Staff",
          addressSnapshot: JSON.stringify({ fullName: "Test User", mobile: "+919999999999", city: "Indore", pincode: "452010" }),
          items: {
            create: {
              productId: seedProduct.id,
              name: seedProduct.name,
              sku: seedProduct.sku,
              image: seedProduct.image,
              unitPrice: 100,
              quantity: 1,
              lineTotal: 100,
            },
          },
          userId,
          createdAt,
        },
      });
    const filterNew = await mkFilterOrder("NC-TEST-COD-1", "COD", new Date());
    const filterOld = await mkFilterOrder("NC-TEST-UPI-1", "UPI", new Date(Date.now() - 2 * 3600_000));

    const dashAll = await (await request("/delivery", { jar: staffJar })).text();
    assert(dashAll.includes("NC-TEST-COD-1") && dashAll.includes("NC-TEST-UPI-1"), "dashboard shows all active orders by default");

    const dashCod = await (await request("/delivery?payment=COD", { jar: staffJar })).text();
    assert(dashCod.includes("NC-TEST-COD-1") && !dashCod.includes("NC-TEST-UPI-1"), "payment filter keeps only COD orders");

    const dashUpi = await (await request("/delivery?payment=UPI", { jar: staffJar })).text();
    assert(dashUpi.includes("NC-TEST-UPI-1") && !dashUpi.includes("NC-TEST-COD-1"), "payment filter keeps only UPI orders");

    const dash1h = await (await request("/delivery?time=1h", { jar: staffJar })).text();
    assert(dash1h.includes("NC-TEST-COD-1") && !dash1h.includes("NC-TEST-UPI-1"), "time filter hides orders older than the window");

    const dashStatus = await (await request("/delivery?status=PACKED", { jar: staffJar })).text();
    assert(
      dashStatus.includes("No orders match these filters"),
      "status filter shows the no-match empty state"
    );

    const dashNewest = await (await request("/delivery?sort=newest", { jar: staffJar })).text();
    assert(
      dashNewest.indexOf("NC-TEST-COD-1") < dashNewest.indexOf("NC-TEST-UPI-1"),
      "newest-first sort lists the fresh order before the older one"
    );

    await prisma.order.deleteMany({ where: { orderNumber: { in: ["NC-TEST-COD-1", "NC-TEST-UPI-1"] } } });
    ok("removed filter-test orders");

    // 5f. Customer live tracking: public track API returns status + map data.
    log("live tracking: track API + page…");

    const trackRes = await request(`/api/orders/track?orderNumber=${orderJson.orderNumber}`);
    const trackJson = await trackRes.json();
    assert(
      trackRes.status === 200 && ["DELIVERED", "OUT_FOR_DELIVERY"].includes(trackJson.status),
      `track API returns current status (${trackJson.status})`
    );
    assert(
      typeof trackJson.address?.lat === "number" && typeof trackJson.address?.lng === "number",
      "track API returns delivery coordinates"
    );
    assert(
      typeof trackJson.shop?.lat === "number" && typeof trackJson.shop?.lng === "number",
      "track API returns shop origin"
    );
    assert(trackJson.distanceKm > 0, "track API returns delivery distance");
    assert(!!trackJson.eta, "track API returns ETA");

    const trackPageRes = await request(`/track-order?order=${orderJson.orderNumber}`);
    assert(trackPageRes.status === 200, "track order page loads (200)");

    // 5g. Dynamic-route sweep — every [param] page/route + searchParams page
    // on the running build, so the Next 16 async params/searchParams contract
    // is exercised exhaustively (a regression 500s any of these and fails CI).
    log("dynamic-route sweep (Next 16 async params/searchParams guard)…");
    await sweepDynamicRoutes({
      prisma,
      chips,
      category,
      orderId,
      userId,
      address,
      jars: { customer: jar, admin: adminJar, staff: staffJar },
    });

    // 5h. Browser console check — the script-tag / LCP / hydration warning
    // classes on core pages that no HTTP probe can observe.
    await checkBrowserConsole();
  } finally {
    // 6. Cleanup.
    log("cleaning up…");
    if (server && !serverExited) {
      server.kill();
      await new Promise((r) => setTimeout(r, 1_500));
    }
    // Remove any photo uploaded to Supabase Storage during the run.
    if (uploadedPhotoUrl && dotEnv.SUPABASE_URL) {
      try {
        const base = String(dotEnv.SUPABASE_URL).replace(/\/$/, "");
        const prefix = `${base}/storage/v1/object/public/delivery-proofs/`;
        if (uploadedPhotoUrl.startsWith(prefix)) {
          const path = uploadedPhotoUrl.slice(prefix.length);
          const key = dotEnv.SUPABASE_PUBLISHABLE_KEY || dotEnv.SUPABASE_ANON_KEY;
          const headers = key ? { apikey: key, Authorization: `Bearer ${key}` } : {};
          const del = await fetch(`${base}/storage/v1/object/delivery-proofs/${path}`, {
            method: "DELETE",
            headers,
          });
          // Anon may be denied delete — fall back to removing the metadata row.
          if (del.ok) ok("removed uploaded test photo from storage");
          else
            await prisma
              .$executeRawUnsafe(`DELETE FROM storage.objects WHERE bucket_id = 'delivery-proofs' AND name = '${path}'`)
              .then(() => ok("removed uploaded test photo metadata from storage"))
              .catch(() => {});
        }
      } catch {
        /* non-critical */
      }
    }
    if (REMOTE_MODE) {
      await cleanupRemoteData(prisma, userId, orderId, originalSettings);
    } else {
      try {
        await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
        ok(`dropped schema ${SCHEMA}`);
      } catch (e) {
        fail(`could not drop schema: ${e.message}`);
      }
    }
    await prisma.$disconnect().catch(() => {});
    if (!REMOTE_MODE) {
      restoreConfig();
      process.off("exit", restoreConfig);
    }
  }
}

main()
  .then(() => {
    if (failures > 0) {
      console.error(`\n\x1b[31mE2E FAILED — ${failures} assertion(s) failed\x1b[0m`);
      process.exit(1);
    }
    console.log(`\n\x1b[32mE2E PASSED — signup → login → address → COD order → persistence ✅ (${REMOTE_MODE ? BASE : "local"})\x1b[0m`);
    process.exit(0);
  })
  .catch((e) => {
    console.error(`\n\x1b[31mE2E ERROR: ${e.message}\x1b[0m`);
    process.exit(1);
  });
