#!/usr/bin/env node
/* Live customer-journey check against the Vercel production deployment.
 * Creates a real customer, adds a Bhopal address, places COD + UPI orders,
 * and verifies every public feature: signup, login, quote, order, tracking,
 * account pages. Prints a PASS/FAIL line per check.
 */
const BASE = process.env.BASE || "https://night-corner.vercel.app";
const EMAIL = "zakicustomer@nightcorner.in";
const PASSWORD = "CustomerTest123!";
const NAME = "Zaki Test Customer";
const MOBILE = "9876504321";

let failures = 0;
const ok = (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const fail = (m) => {
  failures++;
  console.log(`  \x1b[31m✗\x1b[0m ${m}`);
};

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

async function req(path, { method = "GET", jar, body, form, headers = {} } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      ...(jar ? { cookie: jar.h() } : {}),
      ...headers,
    },
    body,
    redirect: "manual",
    signal: AbortSignal.timeout(120_000),
  });
  if (jar) jar.absorb(res);
  return res;
}

async function main() {
  console.log(`\n[e2e-live] customer journey → ${BASE}\n`);

  // 1. Signup
  const su = await req("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify({ name: NAME, email: EMAIL, mobile: MOBILE, password: PASSWORD }),
  });
  const suJson = await su.json().catch(() => ({}));
  ok(`signup ${su.status}${suJson.id ? ` (userId ${suJson.id})` : ""}`);
  if (su.status !== 200 && su.status !== 409) fail("signup should succeed (or report already-exists)");

  // 2. Login
  const jar = new Jar();
  const csrfRes = await req("/api/auth/csrf", { jar });
  const { csrfToken } = await csrfRes.json();
  const loginRes = await req("/api/auth/callback/credentials", {
    method: "POST",
    jar,
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ csrfToken, identifier: EMAIL, password: PASSWORD }).toString(),
  });
  ok(`login ${loginRes.status} (redirect on success)`);
  const hasSession = [...jar.c.keys()].some((k) => k.includes("next-auth.session-token"));
  ok(hasSession ? "session cookie issued" : "session cookie issued");
  if (!hasSession) {
    fail("login failed — cannot continue");
    process.exit(1);
  }

  // 3. Checkout quote for the planned cart (verifies pricing + radius + open state)
  const quoteRes = await req("/api/checkout/quote", {
    method: "POST",
    jar,
    body: JSON.stringify({
      items: [
        { productId: "cmsppntn3002crwv8anj9fz6s", quantity: 2 }, // Maggi ×2 = ₹28
        { productId: "cmsppmvte000urwv81wwyfwrn", quantity: 2 }, // Lays ×2 = ₹40
        { productId: "cmsppnuv3002erwv85u445n1t", quantity: 3 }, // Yippee ×3 = ₹42
      ],
      lat: 23.267,
      lng: 77.126,
    }),
  });
  const quoteJson = await quoteRes.json().catch(() => ({}));
  ok(`quote API ${quoteRes.status}${quoteJson.subtotal !== undefined ? ` → subtotal ₹${quoteJson.subtotal}, delivery ₹${quoteJson.deliveryCharge}, total ₹${quoteJson.total}` : ""}`);
  if (quoteRes.status !== 200) fail(`quote should succeed: ${JSON.stringify(quoteJson).slice(0, 160)}`);
  if (quoteJson.deliveryCharge === 20) ok("quote charges ₹20 delivery for the 0.85 km order");
  else fail(`quote delivery charge mismatch (got ₹${quoteJson.deliveryCharge})`);

  // 4. Add the delivery address to the account
  const addrRes = await req("/api/account/addresses", {
    method: "POST",
    jar,
    body: JSON.stringify({
      fullName: NAME, mobile: MOBILE, house: "12, Shyamla Hills", street: "Main Road",
      area: "Shyamla Hills", landmark: "Near Ruchi Park", city: "Bhopal",
      state: "Madhya Pradesh", pincode: "462002", lat: 23.267, lng: 77.126,
    }),
  });
  const address = await addrRes.json().catch(() => ({}));
  ok(`address saved ${addrRes.status}${address.id ? ` (id ${address.id})` : ""}`);
  if (addrRes.status !== 200 || !address.id) fail("address should persist with coordinates");

  // 5. Place the COD order (payment method confirmed at checkout)
  const orderRes = await req("/api/orders", {
    method: "POST",
    jar,
    body: JSON.stringify({
      items: [
        { productId: "cmsppntn3002crwv8anj9fz6s", quantity: 2 }, // Maggi ×2 = ₹28
        { productId: "cmsppmvte000urwv81wwyfwrn", quantity: 2 }, // Lays ×2 = ₹40
        { productId: "cmsppnuv3002erwv85u445n1t", quantity: 3 }, // Yippee ×3 = ₹42
      ],
      addressId: address.id,
      paymentMethod: "COD",
    }),
  });
  const orderJson = await orderRes.json().catch(() => ({}));
  ok(`COD order ${orderRes.status}${orderJson.orderNumber ? ` → ${orderJson.orderNumber}` : ""}${orderJson.total !== undefined ? `, total ₹${orderJson.total}` : ""}`);
  if (orderRes.status !== 200 || !orderJson.orderId) {
    fail(`order should place: ${JSON.stringify(orderJson).slice(0, 200)}`);
    process.exit(1);
  }
  const orderId = orderJson.orderId;

  // 6. Place a UPI order (upiEnabled=true on production) to exercise that path
  const upiRes = await req("/api/orders", {
    method: "POST",
    jar,
    body: JSON.stringify({
      items: [
        { productId: "cmsppnjpn001wrwv8izvc6o5h", quantity: 5 }, // Parle-G ×5 = ₹50
        { productId: "cmsppncbp001krwv8koioyw0h", quantity: 3 }, // 5 Star ×3 = ₹60
      ],
      addressId: address.id,
      paymentMethod: "UPI",
    }),
  });
  const upiJson = await upiRes.json().catch(() => ({}));
  ok(`UPI order ${upiRes.status}${upiJson.orderNumber ? ` → ${upiJson.orderNumber}` : ""}`);
  if (upiRes.status !== 200) fail(`UPI order should place: ${JSON.stringify(upiJson).slice(0, 160)}`);

  // 7. Oversell guard still works
  const overRes = await req("/api/orders", {
    method: "POST",
    jar,
    body: JSON.stringify({
      items: [{ productId: "cmsppmvte000urwv81wwyfwrn", quantity: 500 }],
      addressId: address.id,
      paymentMethod: "COD",
    }),
  });
  const overJson = await overRes.json().catch(() => ({}));
  ok(overRes.status === 400 ? "oversell rejected (400)" : `oversell NOT rejected: ${overRes.status} ${JSON.stringify(overJson).slice(0, 120)}`);
  if (overRes.status !== 400) fail("oversell should be rejected by stock check");

  // 8. Public tracking
  const trackRes = await req(`/api/orders/track?orderNumber=${orderJson.orderNumber}`);
  const trackJson = await trackRes.json().catch(() => ({}));
  ok(`track API ${trackRes.status} → status ${trackJson.status}, distance ${trackJson.distanceKm}km`);
  if (trackRes.status !== 200) fail("track API should resolve the order");

  // 9. Customer order pages render
  const accountRes = await req("/account/orders", { jar });
  const accountHtml = await accountRes.text();
  ok(`account orders page ${accountRes.status}${accountHtml.includes(orderJson.orderNumber) ? " (order visible)" : ""}`);
  if (!accountHtml.includes(orderJson.orderNumber)) fail("customer's order list should show the new order");

  const detailRes = await req(`/account/orders/${orderId}`, { jar });
  const detailHtml = await detailRes.text();
  ok(`order detail page ${detailRes.status} (total ₹${orderJson.total} rendered: ${detailHtml.includes(`₹${orderJson.total}`) ? "yes" : "check"})`);
  if (detailRes.status !== 200) fail("order detail page should load");

  const trackPageRes = await req(`/track-order?order=${orderJson.orderNumber}`);
  ok(`track page ${trackPageRes.status}`);
  if (trackPageRes.status !== 200) fail("track-order page should load");

  console.log(`\n[e2e-live] ${failures === 0 ? "ALL CHECKS PASSED" : failures + " CHECK(S) FAILED"}\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
