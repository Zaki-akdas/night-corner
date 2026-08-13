#!/usr/bin/env node
/* Definitive check for "address is not saving when order placing":
 * creates a FRESH customer on the live site, saves an address (with and
 * without coordinates), places an order, then verifies from the DB that
 * (a) the address row exists for the account and (b) the order carries
 * addressId + full addressSnapshot.
 */
import { PrismaClient } from "@prisma/client";

const BASE = process.env.BASE || "https://night-corner.vercel.app";
const DB_URL = process.env.DB_URL;
const TS = Date.now();
const EMAIL = `addrcheck${TS}@gmail.com`;
const PASSWORD = "AddrTest123!";
const NAME = "Addr Check User";
const MOBILE = String(9876543000 + (TS % 1000000));

let failures = 0;
const ok = (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const fail = (m) => { failures++; console.log(`  \x1b[31m✗\x1b[0m ${m}`); };

class Jar {
  constructor() { this.c = new Map(); }
  absorb(res) {
    const scs = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
    for (const sc of scs) {
      const [pair] = sc.split(";");
      const eq = pair.indexOf("=");
      if (eq > 0) this.c.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
  }
  h() { return [...this.c.entries()].map(([k, v]) => `${k}=${v}`).join("; "); }
}

async function req(path, { method = "GET", jar, body, headers = {} } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { ...(jar ? { cookie: jar.h() } : {}), ...headers },
    body,
    redirect: "manual",
    signal: AbortSignal.timeout(120_000),
  });
  if (jar) jar.absorb(res);
  return res;
}

async function main() {
  console.log(`\n[verify-address-save] ${BASE} — fresh customer ${EMAIL}\n`);

  // 1. Signup
  const su = await req("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify({ name: NAME, email: EMAIL, mobile: MOBILE, password: PASSWORD }),
  });
  const suJson = await su.json().catch(() => ({}));
  ok(`signup ${su.status}${suJson.id ? ` (userId ${suJson.id})` : ""}`);
  if (su.status !== 200) { fail("signup failed"); process.exit(1); }

  // 2. Login
  const jar = new Jar();
  const csrfRes = await req("/api/auth/csrf", { jar });
  const { csrfToken } = await csrfRes.json();
  const loginRes = await req("/api/auth/callback/credentials", {
    method: "POST", jar,
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ csrfToken, identifier: EMAIL, password: PASSWORD }).toString(),
  });
  const hasSession = [...jar.c.keys()].some((k) => k.includes("next-auth.session-token"));
  ok(`login ${loginRes.status}${hasSession ? " (session cookie)" : " — NO SESSION"}`);
  if (!hasSession) { fail("cannot continue without session"); process.exit(1); }

  // 3. Save an address WITHOUT coordinates first (the "not saving" suspicion:
  //    the app allows saving without coords but requires them for delivery).
  const addrNoCoord = await req("/api/account/addresses", {
    method: "POST", jar,
    body: JSON.stringify({
      fullName: NAME, mobile: MOBILE, house: "14", street: "Lake View Road",
      area: "Shyamla Hills", city: "Bhopal", state: "Madhya Pradesh", pincode: "462002",
    }),
  });
  const noCoordJson = await addrNoCoord.json().catch(() => ({}));
  ok(`address without coords ${addrNoCoord.status}${noCoordJson.id ? ` (id ${noCoordJson.id.slice(0,8)})` : ""}`);
  if (addrNoCoord.status !== 200 || !noCoordJson.id) fail("address without coords should still persist");

  // 4. Patch coordinates onto it (the "Add delivery location" flow).
  const patch = await req(`/api/account/addresses/${noCoordJson.id}`, {
    method: "PATCH", jar,
    body: JSON.stringify({ lat: 23.2671, lng: 77.1262 }),
  });
  const patched = await patch.json().catch(() => ({}));
  ok(`patch coords ${patch.status} → lat ${patched.lat}, lng ${patched.lng}`);
  if (patch.status !== 200 || patched.lat !== 23.2671) fail("coords should persist via PATCH");

  // 5. Place an order using that address.
  const orderRes = await req("/api/orders", {
    method: "POST", jar,
    body: JSON.stringify({
      items: [
        { productId: "cmsppntn3002crwv8anj9fz6s", quantity: 4 }, // Maggi ×4 = ₹56
        { productId: "cmsppmvte000urwv81wwyfwrn", quantity: 3 }, // Lays ×3 = ₹60
      ], // total ₹116 ≥ ₹99 minimum
      addressId: noCoordJson.id,
      paymentMethod: "COD",
    }),
  });
  const orderJson = await orderRes.json().catch(() => ({}));
  ok(`order ${orderRes.status}${orderJson.orderNumber ? ` → ${orderJson.orderNumber}` : ""} ${JSON.stringify(orderJson).slice(0,120)}`);
  if (orderRes.status !== 200 || !orderJson.orderId) { fail("order should place with the saved address"); process.exit(1); }

  // 6. Verify in the DB: address row exists for the user, order has addressId + snapshot.
  if (!DB_URL) { console.log("  ⚠️ DB_URL not set — skipping DB assertions"); return; }
  const prisma = new PrismaClient({ datasources: { db: { url: DB_URL } } });
  try {
    const user = await prisma.user.findUnique({ where: { email: EMAIL } });
    ok(`DB: user exists (${user.id.slice(0,8)})`);
    if (!user) { fail("user missing in DB"); return; }

    const addr = await prisma.address.findFirst({ where: { id: noCoordJson.id } });
    ok(addr ? `DB: address row exists → lat ${addr.lat}, lng ${addr.lng}, isDefault ${addr.isDefault}` : "DB: address row MISSING");
    if (!addr) fail("address row should exist for the account");

    const order = await prisma.order.findUnique({
      where: { id: orderJson.orderId },
      include: { address: true },
    });
    const snap = order?.addressSnapshot ? JSON.parse(order.addressSnapshot) : null;
    console.log(`  DB: order.addressId = ${order?.addressId ? order.addressId.slice(0,8) : "NULL"} · addressSnapshot = ${snap ? "YES" : "NO"}`);
    order?.addressId === noCoordJson.id
      ? ok("DB: order.addressId points at the saved address")
      : fail(`DB: order.addressId mismatch (expected ${noCoordJson.id.slice(0,8)})`);
    snap?.house === "14" && snap?.city === "Bhopal"
      ? ok("DB: addressSnapshot carries the full address")
      : fail("DB: addressSnapshot missing/incomplete");

    // Address should still be listed for the account (persists after ordering).
    const listRes = await req("/api/account/addresses", { jar });
    const list = await listRes.json().catch(() => []);
    list.some((a) => a.id === noCoordJson.id)
      ? ok("account address list still shows the address after ordering")
      : fail("address disappeared from the account list after ordering");
  } finally {
    await prisma.$disconnect().catch(() => {});
  }

  console.log(`\n[verify-address-save] ${failures === 0 ? "ALL CHECKS PASSED" : failures + " CHECK(S) FAILED"}\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
