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
// Seed-default admin credentials (override via env for other deployments).
const ADMIN_EMAIL = process.env.LIVE_ADMIN_EMAIL || "admin@nightcorner.in";
const ADMIN_PASSWORD = process.env.LIVE_ADMIN_PASSWORD || "admin123";

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

// Mirrors src/lib/settings.ts formatINR: whole rupees stay clean (₹110),
// fractional totals show both decimals (₹135.50) — never rounded up (₹136).
function formatINRLike(n) {
  const v = Math.round(n * 100) / 100;
  const frac = v % 1 !== 0;
  return (
    "₹" +
    v.toLocaleString("en-IN", {
      minimumFractionDigits: frac ? 2 : 0,
      maximumFractionDigits: frac ? 2 : 0,
    })
  );
}

async function login(email, password) {
  const jar = new Jar();
  const csrfRes = await req("/api/auth/csrf", { jar });
  const { csrfToken } = await csrfRes.json();
  const res = await req("/api/auth/callback/credentials", {
    method: "POST",
    jar,
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ csrfToken, identifier: email, password }).toString(),
  });
  const hasSession = [...jar.c.keys()].some((k) => k.includes("next-auth.session-token"));
  return { jar, res, hasSession };
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

  // 10. Invoice: exact breakdown (the ₹135.50-style check), print-to-PDF
  // wiring, and role-based access (customer, admin, anonymous).
  console.log("invoice: breakdown + print wiring + access…");

  const expSub = formatINRLike(quoteJson.subtotal);
  const expDel = quoteJson.deliveryCharge === 0 ? "FREE" : formatINRLike(quoteJson.deliveryCharge);
  const expTax = formatINRLike(quoteJson.tax);
  const expTotal = formatINRLike(quoteJson.total);
  // Guard: a fractional total must render both decimals, never the rounded-up
  // whole rupee (₹135.50, not ₹136).
  const isFractional = quoteJson.total % 1 !== 0;
  const roundedUp = formatINRLike(Math.ceil(quoteJson.total));

  const invRes = await req(`/api/orders/${orderId}/invoice`, { jar });
  const invHtml = await invRes.text();
  invRes.status === 200 ? ok(`customer invoice loads (HTTP ${invRes.status})`) : fail(`customer invoice HTTP ${invRes.status}`);
  invHtml.includes(orderJson.orderNumber) ? ok("invoice shows the order number") : fail("invoice missing order number");
  invHtml.includes("Grand Total") ? ok("invoice has a Grand Total row") : fail("invoice missing Grand Total");
  invHtml.includes(expSub) ? ok(`invoice subtotal shows ${expSub}`) : fail(`invoice subtotal ≠ ${expSub}`);
  invHtml.includes(expDel) ? ok(`invoice delivery shows ${expDel}`) : fail(`invoice delivery ≠ ${expDel}`);
  invHtml.includes(expTax) ? ok(`invoice tax shows ${expTax}`) : fail(`invoice tax ≠ ${expTax}`);
  invHtml.includes(expTotal) ? ok(`invoice grand total shows ${expTotal} (not rounded)`) : fail(`invoice grand total ≠ ${expTotal}`);
  if (isFractional) {
    !invHtml.includes(roundedUp) ? ok(`fractional total is NOT rounded up (${roundedUp} absent)`) : fail(`fractional total wrongly rounded up to ${roundedUp}`);
  } else {
    invHtml.includes(expTotal) ? ok("whole total renders clean") : fail("whole total missing");
  }
  invHtml.includes("window.print") ? ok("invoice auto-opens the print dialog (Save as PDF)") : fail("invoice missing auto-print script");
  invHtml.includes("@media print") ? ok("invoice has print CSS") : fail("invoice missing print CSS");

  // The Print / Save as PDF button on the order detail page.
  detailHtml.includes("Print / Save as PDF") ? ok("order page has the Print / Save as PDF button") : fail("order page missing Print / Save as PDF button");

  // Admin can download any order's invoice.
  const adminLogin = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
  adminLogin.hasSession ? ok("admin login succeeds") : fail("admin login failed");
  if (adminLogin.hasSession) {
    const aInv = await req(`/api/orders/${orderId}/invoice`, { jar: adminLogin.jar });
    const aHtml = await aInv.text();
    aInv.status === 200 ? ok(`admin downloads the invoice (HTTP ${aInv.status})`) : fail(`admin invoice HTTP ${aInv.status}`);
    aHtml.includes(expTotal) ? ok(`admin invoice grand total shows ${expTotal}`) : fail(`admin invoice grand total ≠ ${expTotal}`);
  }

  // Anonymous requests are blocked from invoices.
  const anonInv = await req(`/api/orders/${orderId}/invoice`);
  anonInv.status === 401 ? ok(`anonymous invoice access blocked (HTTP ${anonInv.status})`) : fail(`anonymous invoice HTTP ${anonInv.status} (expected 401)`);

  console.log(`\n[e2e-live] ${failures === 0 ? "ALL CHECKS PASSED" : failures + " CHECK(S) FAILED"}\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
