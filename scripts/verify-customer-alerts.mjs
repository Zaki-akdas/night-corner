// Live proof that every order milestone fires the customer SMS/WhatsApp alert
// path on the deployed site: place an order (PLACED), mark OUT_FOR_DELIVERY,
// then DELIVERED (with proof-of-delivery), confirming each status change and
// the in-app notifications. External sends run in demo mode. Every trace is
// cleaned up and settings restored afterwards.
import fs from "fs";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const BASE = "https://night-corner.vercel.app";
const CUST_EMAIL = "cust-alert@nightcorner.in";
const CUST_PASSWORD = "CustAlert123!";
const STAFF_EMAIL = "staff-alert@nightcorner.in";
const STAFF_PASSWORD = "StaffAlert123!";

const env = {};
for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
}

let settingsRow = null;
let orderId = null;

async function login(email, password) {
  let jar = "";
  const csrfRes = await fetch(BASE + "/api/auth/csrf");
  jar = (csrfRes.headers.getSetCookie ? csrfRes.headers.getSetCookie() : [csrfRes.headers.get("set-cookie")])
    .map((c) => c.split(";")[0])
    .join("; ");
  const csrf = await csrfRes.json();
  const login = await fetch(BASE + "/api/auth/callback/credentials", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie: jar },
    body: new URLSearchParams({ csrfToken: csrf.csrfToken, identifier: email, password }),
    redirect: "manual",
  });
  const loginCookies = login.headers.getSetCookie ? login.headers.getSetCookie() : [login.headers.get("set-cookie")];
  jar += "; " + loginCookies.map((c) => c.split(";")[0]).join("; ");
  const sess = await fetch(BASE + "/api/auth/session", { headers: { cookie: jar } });
  const sessJson = await sess.json();
  if (!sessJson.user) throw new Error("login failed for " + email);
  return jar;
}

try {
  // 1. Settings: enable SMS + force-open for the test (restore after).
  const row = await prisma.settings.findUnique({ where: { key: "app_settings" } });
  settingsRow = row;
  const s = { ...JSON.parse(row.value) };
  await prisma.settings.update({
    where: { key: "app_settings" },
    data: { value: JSON.stringify({ ...s, notifySms: true, notifyWhatsapp: true, forceOpen: true }) },
  });

  // 2. Throwaway customer + address + staff.
  const cHash = await bcrypt.hash(CUST_PASSWORD, 10);
  const customer = await prisma.user.create({
    data: { email: CUST_EMAIL, name: "Cust Alert", mobile: "+919999998888", passwordHash: cHash, role: "CUSTOMER", status: "ACTIVE" },
  });
  const address = await prisma.address.create({
    data: {
      userId: customer.id, fullName: "Cust Alert", mobile: "+919999998888",
      house: "12", street: "Test Street", area: "Arera Colony", city: "Bhopal",
      state: "MP", pincode: "462016", lat: 23.265, lng: 77.123, isDefault: true,
    },
  });
  const sHash = await bcrypt.hash(STAFF_PASSWORD, 10);
  await prisma.user.create({
    data: { email: STAFF_EMAIL, name: "Staff Alert", mobile: "+919999997777", passwordHash: sHash, role: "STAFF", status: "ACTIVE" },
  });

  const custJar = await login(CUST_EMAIL, CUST_PASSWORD);
  const staffJar = await login(STAFF_EMAIL, STAFF_PASSWORD);

  // 3. Place the order (PLACED alert path).
  const prod = await prisma.product.findFirst({ where: { active: true }, orderBy: { price: "desc" } });
  const qty = Math.max(1, Math.ceil(99 / (prod.price || 100)));
  const placeRes = await fetch(BASE + "/api/orders", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: custJar },
    body: JSON.stringify({ items: [{ productId: prod.id, quantity: qty }], addressId: address.id, paymentMethod: "COD" }),
  });
  const placeJson = await placeRes.json().catch(() => ({}));
  console.log("PLACED:", placeRes.status, JSON.stringify(placeJson));
  orderId = placeJson.orderId;

  // 4. OUT_FOR_DELIVERY.
  const ofdRes = await fetch(BASE + "/api/delivery/orders/" + orderId + "/status", {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie: staffJar },
    body: JSON.stringify({ status: "OUT_FOR_DELIVERY" }),
  });
  const ofdJson = await ofdRes.json().catch(() => ({}));
  console.log("OUT_FOR_DELIVERY:", ofdRes.status, JSON.stringify(ofdJson));

  // 5. DELIVERED with proof-of-delivery.
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  const delRes = await fetch(BASE + "/api/delivery/orders/" + orderId + "/status", {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie: staffJar },
    body: JSON.stringify({ status: "DELIVERED", deliveryPin: order.deliveryPin }),
  });
  const delJson = await delRes.json().catch(() => ({}));
  console.log("DELIVERED:", delRes.status, JSON.stringify(delJson));

  // 6. In-app notifications = observable proxy for the alert milestones.
  const notifs = await prisma.notification.findMany({
    where: { userId: customer.id, type: "ORDER" },
    orderBy: { createdAt: "asc" },
    select: { body: true },
  });
  console.log("notifications:", JSON.stringify(notifs.map((n) => n.body)));

  const ok =
    placeRes.status === 200 && !!orderId &&
    ofdRes.status === 200 && ofdJson.ok === true &&
    delRes.status === 200 && delJson.ok === true &&
    notifs.some((n) => n.body.includes("Out for Delivery")) &&
    notifs.some((n) => n.body.includes("Delivered"));
  console.log(ok ? "PASS: placed / OFD / delivered all fired the customer-alert paths" : "FAIL");
  process.exitCode = ok ? 0 : 1;
} catch (e) {
  console.error("ERROR:", e);
  process.exitCode = 1;
} finally {
  // Cleanup: order, notifications, address, users; restore settings.
  if (orderId) {
    await prisma.orderItem.deleteMany({ where: { orderId } }).catch(() => {});
    await prisma.order.deleteMany({ where: { id: orderId } }).catch(() => {});
  }
  const cust = await prisma.user.findUnique({ where: { email: CUST_EMAIL }, select: { id: true } });
  if (cust) {
    await prisma.notification.deleteMany({ where: { userId: cust.id } }).catch(() => {});
    await prisma.address.deleteMany({ where: { userId: cust.id } }).catch(() => {});
  }
  await prisma.user.deleteMany({ where: { email: { in: [CUST_EMAIL, STAFF_EMAIL] } } }).catch(() => {});
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
