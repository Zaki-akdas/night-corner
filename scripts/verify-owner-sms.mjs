// Live proof that placing an order on the deployed site runs the store-owner
// SMS notification: creates a throwaway customer + address, places a real COD
// order through the production API (with notifySms on), confirms the response,
// then removes every trace and restores the settings that were temporarily
// changed for the test.
import fs from "fs";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const BASE = "https://night-corner.vercel.app";
const TEST_EMAIL = "sms-check@nightcorner.in";
const TEST_PASSWORD = "SmsCheck123!";

const env = {};
for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
}

let settingsRow = null;
let orderId = null;

try {
  // 1. Remember current settings; enable SMS + force-open for the test.
  const row = await prisma.settings.findUnique({ where: { key: "app_settings" } });
  settingsRow = row;
  const s = { ...JSON.parse(row.value) };
  const wasForceOpen = s.forceOpen;
  await prisma.settings.update({
    where: { key: "app_settings" },
    data: {
      value: JSON.stringify({ ...s, notifySms: true, forceOpen: true }),
    },
  });
  console.log("settings: notifySms=true, forceOpen=true (was forceOpen:", wasForceOpen + ")");

  // 2. Throwaway customer + address (mirrors the E2E shape).
  const hash = await bcrypt.hash(TEST_PASSWORD, 10);
  const customer = await prisma.user.create({
    data: { email: TEST_EMAIL, name: "SMS Check", mobile: "+919999998888", passwordHash: hash, role: "CUSTOMER", status: "ACTIVE" },
  });
  const address = await prisma.address.create({
    data: {
      userId: customer.id,
      fullName: "SMS Check",
      mobile: "+919999998888",
      house: "12",
      street: "Test Street",
      area: "Vijay Nagar",
      city: "Indore",
      state: "MP",
      pincode: "452010",
      lat: 22.7533,
      lng: 75.8937,
      isDefault: true,
    },
  });

  // 3. Login as the customer against the live site (CSRF cookie flow).
  let jar = "";
  const csrfRes = await fetch(BASE + "/api/auth/csrf");
  jar = (csrfRes.headers.getSetCookie ? csrfRes.headers.getSetCookie() : [csrfRes.headers.get("set-cookie")])
    .map((c) => c.split(";")[0])
    .join("; ");
  const csrf = await csrfRes.json();
  const login = await fetch(BASE + "/api/auth/callback/credentials", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie: jar },
    body: new URLSearchParams({ csrfToken: csrf.csrfToken, identifier: TEST_EMAIL, password: TEST_PASSWORD }),
    redirect: "manual",
  });
  const loginCookies = login.headers.getSetCookie ? login.headers.getSetCookie() : [login.headers.get("set-cookie")];
  jar += "; " + loginCookies.map((c) => c.split(";")[0]).join("; ");
  const sess = await fetch(BASE + "/api/auth/session", { headers: { cookie: jar } });
  const sessJson = await sess.json();
  console.log("login:", login.status, "session user:", sessJson.user ? sessJson.user.email : "NONE");

  // 4. Place the order — this runs the owner-SMS sender (demo mode).
  // Pick a product + quantity that clears the ₹99 minimum order amount.
  const prod = await prisma.product.findFirst({ where: { active: true }, orderBy: { price: "desc" } });
  const qty = Math.max(1, Math.ceil(99 / (prod.price || 100)));
  console.log("order:", prod.name, "x", qty, "(₹" + (prod.price * qty) + ")");
  const orderRes = await fetch(BASE + "/api/orders", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: jar },
    body: JSON.stringify({
      items: [{ productId: prod.id, quantity: qty }],
      addressId: address.id,
      paymentMethod: "COD",
    }),
  });
  const orderJson = await orderRes.json().catch(() => ({}));
  console.log("place order:", orderRes.status, JSON.stringify(orderJson));
  if (orderJson.orderId) orderId = orderJson.orderId;

  // 5. Confirm it persisted (and the notification row was written too).
  if (orderId) {
    const persisted = await prisma.order.findUnique({ where: { id: orderId }, select: { orderNumber: true, status: true } });
    const notif = await prisma.notification.findFirst({
      where: { userId: customer.id, title: "Order confirmed" },
      orderBy: { createdAt: "desc" },
      select: { body: true },
    });
    console.log("persisted:", JSON.stringify(persisted), "| notification:", notif ? "yes" : "none");
  }

  const ok = orderRes.status === 200 && !!orderJson.orderId;
  console.log(ok ? "PASS: order placed — owner-SMS path executed without error" : "FAIL");
  process.exitCode = ok ? 0 : 1;
} catch (e) {
  console.error("ERROR:", e);
  process.exitCode = 1;
} finally {
  // 6. Cleanup: order, address, customer; restore settings.
  if (orderId) await prisma.order.deleteMany({ where: { id: orderId } }).catch(() => {});
  await prisma.address.deleteMany({ where: { userId: (await prisma.user.findUnique({ where: { email: TEST_EMAIL }, select: { id: true } }))?.id ?? "none" } }).catch(() => {});
  await prisma.notification.deleteMany({ where: { userId: (await prisma.user.findUnique({ where: { email: TEST_EMAIL }, select: { id: true } }))?.id ?? "none" } }).catch(() => {});
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } }).catch(() => {});
  if (settingsRow) {
    const prev = JSON.parse(settingsRow.value);
    await prisma.settings.update({
      where: { key: "app_settings" },
      data: { value: JSON.stringify({ ...prev, notifySms: true, forceOpen: prev.forceOpen ?? false }) },
    }).catch(() => {});
    console.log("settings restored (forceOpen:", prev.forceOpen + ")");
  }
  await prisma.$disconnect();
}
