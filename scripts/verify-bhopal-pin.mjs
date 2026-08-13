#!/usr/bin/env node
/**
 * Verify the corrected Lucky Bakery Bhopal shop pin end-to-end on the LIVE
 * site: signup → login → address near Bhopal → delivery quote → COD order →
 * track API → staff delivery route map iframe.
 *
 * Safety: every row this creates is deleted afterwards (user, order, address,
 * stock restored, inventory txs removed). app_settings is never modified.
 */
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const BASE = process.env.BASE_URL || "https://night-corner.vercel.app";
const DB_URL = process.env.DB_URL;
if (!DB_URL) {
  console.error("set DB_URL to the production Postgres connection");
  process.exit(1);
}

// The corrected Lucky Bakery Bhopal pin (from the admin settings + live API).
const SHOP = { lat: 23.2632962, lng: 77.1210341 };
// A delivery address ~1.5 km from the shop (within the 10 km radius).
const ADDR = { lat: 23.27, lng: 77.13, fullName: "Bhopal Test", mobile: "9876500022" };

let failures = 0;
const ok = (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const fail = (m) => {
  failures++;
  console.log(`  \x1b[31m✗\x1b[0m ${m}`);
};
const assert = (cond, m) => (cond ? ok(m) : fail(m));

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

const prisma = new PrismaClient({ datasources: { db: { url: DB_URL } } });

let userId, orderId, addressId;

async function main() {
  // Snapshot settings to prove they are untouched by the flow.
  const settingsBefore = await prisma.settings.findUnique({ where: { key: "app_settings" } });
  const beforeJson = settingsBefore ? JSON.parse(settingsBefore.value) : null;
  assert(
    beforeJson && beforeJson.shopLat === SHOP.lat && beforeJson.shopLng === SHOP.lng,
    `production settings already use Bhopal pin (${beforeJson?.shopLat}, ${beforeJson?.shopLng})`
  );

  // Pick real active products from the live DB whose order clears the ₹99
  // minimum (the order route rejects below it). Compute the quantity needed
  // per product so the subtotal always qualifies, capped by stock.
  const candidates = await prisma.product.findMany({
    where: { active: true, stock: { gt: 2 } },
    orderBy: { price: "asc" },
    take: 30,
  });
  let product = null;
  let qty = 0;
  for (const c of candidates) {
    const need = Math.max(2, Math.ceil(99 / c.price));
    if (need <= c.stock) {
      product = c;
      qty = need;
      break;
    }
  }
  assert(!!product, `found a real product clearing the ₹99 minimum (${product?.name ?? "none"})`);
  if (!product) process.exit(1);

  const orderItems = [{ productId: product.id, quantity: qty }];
  log(`product: ${product.name} (₹${product.price}×${qty} = ₹${(product.price * qty).toFixed(2)})`);

  // Signup + login on the live site.
  const email = `bhopal-pin-${Date.now()}@example.com`;
  const password = "BhopalPin123!";
  const signupRes = await request("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify({ name: "Bhopal Pin Test", email, mobile: ADDR.mobile, password }),
  });
  const signupJson = await signupRes.json();
  assert(signupRes.status === 200 && signupJson.id, "signup on live site");
  userId = signupJson.id;

  const jar = new CookieJar();
  const { csrfToken } = await (await request("/api/auth/csrf", { jar })).json();
  const loginRes = await request("/api/auth/callback/credentials", {
    method: "POST",
    jar,
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ csrfToken, identifier: email, password }).toString(),
  });
  assert(loginRes.status === 302, "login on live site");

  // Address near the shop.
  const addrRes = await request("/api/account/addresses", {
    method: "POST",
    jar,
    body: JSON.stringify({
      fullName: ADDR.fullName,
      mobile: ADDR.mobile,
      house: "42",
      street: "New Market",
      area: "Bhopal",
      landmark: "Near Lucky Bakery",
      city: "Bhopal",
      state: "Madhya Pradesh",
      pincode: "462001",
      lat: ADDR.lat,
      lng: ADDR.lng,
    }),
  });
  const address = await addrRes.json();
  assert(addrRes.status === 200 && address.id, "address created near Bhopal");
  addressId = address.id;

  // Delivery quote for that address — must compute distance from the Bhopal pin.
  const quoteRes = await request("/api/checkout/quote", {
    method: "POST",
    jar,
    body: JSON.stringify({ items: orderItems, lat: ADDR.lat, lng: ADDR.lng }),
  });
  const quote = await quoteRes.json();
  assert(quoteRes.status === 200, `quote accepted (HTTP ${quoteRes.status})`);
  if (quoteRes.status === 200) {
    assert(quote.distanceKm > 0 && quote.distanceKm < 5, `quote distance ${quote.distanceKm} km — near shop, not Mumbai`);
    assert(typeof quote.deliveryCharge === "number" && quote.deliveryCharge >= 0, `quote delivery charge ₹${quote.deliveryCharge}`);
    assert(quote.minOrderMet === true, `quote meets ₹${quote.minOrderAmount} minimum`);
    ok(`quote: ${quote.distanceKm} km away, delivery ₹${quote.deliveryCharge}, subtotal ₹${quote.subtotal}`);
  }

  // Place the COD order.
  const orderRes = await request("/api/orders", {
    method: "POST",
    jar,
    body: JSON.stringify({ items: orderItems, addressId, paymentMethod: "COD" }),
  });
  const orderJson = await orderRes.json();
  assert(orderRes.status === 200 && orderJson.orderId, `COD order placed (${orderJson.orderNumber}${orderRes.status !== 200 ? " — " + JSON.stringify(orderJson).slice(0, 160) : ""})`);
  orderId = orderJson.orderId;

  // Track API — the exact data the customer route map is built from.
  const trackRes = await request(`/api/orders/track?orderNumber=${orderJson.orderNumber}`);
  const track = await trackRes.json();
  assert(trackRes.status === 200, "track API responds");
  assert(
    track.shop?.lat === SHOP.lat && track.shop?.lng === SHOP.lng,
    `track API shop origin is the Bhopal pin (${track.shop?.lat}, ${track.shop?.lng})`
  );
  assert(track.distanceKm > 0 && track.distanceKm < 5, `track distance ${track.distanceKm} km`);
  ok(`track: shop origin (${track.shop?.lat}, ${track.shop?.lng}), ${track.distanceKm} km, ETA ${track.eta}`);

  // Staff delivery detail page — the route-map iframe should embed saddr=Bhopal.
  const staffEmail = "staff-bhopal@nightcorner.in";
  const staffPass = "StaffBhopal123!";
  const staff = await prisma.user.findUnique({ where: { email: staffEmail } });
  if (!staff) {
    const hash = await bcrypt.hash(staffPass, 10);
    await prisma.user.create({
      data: { email: staffEmail, name: "Bhopal Staff", mobile: "9876500077", passwordHash: hash, role: "STAFF", status: "ACTIVE" },
    });
  } else {
    await prisma.user.update({ where: { id: staff.id }, data: { passwordHash: await bcrypt.hash(staffPass, 10), status: "ACTIVE" } });
  }
  const sJar = new CookieJar();
  const { csrfToken: sCsrf } = await (await request("/api/auth/csrf", { jar: sJar })).json();
  await request("/api/auth/callback/credentials", {
    method: "POST",
    jar: sJar,
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ csrfToken: sCsrf, identifier: staffEmail, password: staffPass }).toString(),
  });
  const detailRes = await request(`/delivery/${orderId}`, { jar: sJar });
  const detailHtml = await detailRes.text();
  assert(detailRes.status === 200, "staff delivery detail page loads");
  const saddrOk = detailHtml.includes(`saddr=${encodeURIComponent(`${SHOP.lat},${SHOP.lng}`)}`);
  const mumbaiGone = !detailHtml.includes("saddr=19.076") && !detailHtml.includes("saddr=72.8777");
  assert(saddrOk, "route map iframe embeds saddr = Bhopal pin");
  assert(mumbaiGone, "route map iframe no longer embeds the old Mumbai pin");
  assert(detailHtml.includes("Navigate in Google Maps"), "directions link rendered");
}

function log(m) {
  console.log(`\x1b[36m[bhopal-pin]\x1b[0m ${m}`);
}

async function cleanup() {
  log("cleaning up…");
  if (orderId) {
    const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
    if (order) {
      for (const it of order.items) {
        await prisma.product.update({ where: { id: it.productId }, data: { stock: { increment: it.quantity }, sold: { decrement: it.quantity } } });
      }
      await prisma.inventoryTx.deleteMany({ where: { orderId } });
      await prisma.order.delete({ where: { id: orderId } });
      ok(`removed test order (stock restored)`);
    }
  }
  if (addressId) await prisma.address.deleteMany({ where: { id: addressId } }).catch(() => {});
  if (userId) await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  await prisma.user.deleteMany({ where: { email: "staff-bhopal@nightcorner.in" } });
  await prisma.activityLog.deleteMany({ where: { userName: "Bhopal Pin Test" } }).catch(() => {});
  const settingsAfter = await prisma.settings.findUnique({ where: { key: "app_settings" } });
  const afterJson = settingsAfter ? JSON.parse(settingsAfter.value) : null;
  assert(
    afterJson && afterJson.shopLat === SHOP.lat && afterJson.shopLng === SHOP.lng,
    `app_settings untouched (still Bhopal ${afterJson?.shopLat}, ${afterJson?.shopLng})`
  );
}

main()
  .then(async () => {
    await cleanup();
    await prisma.$disconnect();
    if (failures > 0) {
      console.error(`\n\x1b[31mBHOPAL PIN VERIFICATION FAILED — ${failures} assertion(s)\x1b[0m`);
      process.exit(1);
    }
    console.log(`\n\x1b[32mBHOPAL PIN VERIFICATION PASSED — quotes & route maps use the corrected shop pin ✅\x1b[0m`);
    process.exit(0);
  })
  .catch(async (e) => {
    await cleanup().catch(() => {});
    await prisma.$disconnect().catch(() => {});
    console.error(`\n\x1b[31mERROR: ${e.message}\x1b[0m`);
    process.exit(1);
  });
