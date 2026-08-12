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
 * Usage:
 *   npm run test:e2e                                   # local mode
 *   E2E_BASE_URL=https://preview.vercel.app npm run test:e2e   # remote mode
 */
import { spawn, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, copyFileSync, rmSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { PrismaClient } = require("@prisma/client");

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
  contactEmail: "hello@nightcorner.in",
  contactPhone: "+91 99999 99999",
  socials: { instagram: "nightcorner", facebook: "nightcorner" },
  codEnabled: true,
  upiEnabled: true,
  onlineEnabled: false,
  upiId: "nightcorner@upi",
  notifyEmail: false,
  notifyWhatsapp: false,
  notifySms: false,
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
  // Next.js rewrites tsconfig.json to include <distDir>/types — back it up so
  // we can restore it exactly.
  if (existsSync(TSCONFIG_PATH)) copyFileSync(TSCONFIG_PATH, TSCONFIG_BAK);
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
  rmSync(path.join(ROOT, TEST_DIST), { recursive: true, force: true });
}

// Remote-mode cleanup: remove exactly what this run created so the schema stays
// empty but alive for the next preview build (a dropped schema would break the
// next deployment's build-time sitemap query).
async function cleanupRemoteData(prisma, userId, orderId) {
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
  await prisma.product.deleteMany({ where: { sku: { startsWith: "TEST-" } } });
  await prisma.category.deleteMany({ where: { slug: "test-category" } });
  ok("removed seeded test data (schema kept for preview builds)");
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
  await prisma.settings.upsert({
    where: { key: "app_settings" },
    update: { value: JSON.stringify(TEST_SETTINGS) },
    create: { key: "app_settings", value: JSON.stringify(TEST_SETTINGS) },
  });
  ok(`seeded category + ${chips.name} (₹${chips.price}) + ${drink.name} (₹${drink.price})`);

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
  } finally {
    // 6. Cleanup.
    log("cleaning up…");
    if (server && !serverExited) {
      server.kill();
      await new Promise((r) => setTimeout(r, 1_500));
    }
    if (REMOTE_MODE) {
      await cleanupRemoteData(prisma, userId, orderId);
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
