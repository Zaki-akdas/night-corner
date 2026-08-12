// Verifies the Supabase Realtime broadcast end-to-end: subscribe as a browser
// would, then trigger a real status change through the production delivery API
// (which calls broadcastOrderUpdate) and confirm the event arrives.
import fs from "fs";
import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const STAFF_EMAIL = "rt-check@nightcorner.in";
const STAFF_PASSWORD = "RtCheck123!";

// Load .env manually
const env = {};
for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
}
const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// 1. Subscribe first (browser behavior)
const sub = createClient(url, key);
const received = [];
const ch = sub
  .channel("delivery-orders")
  .on("broadcast", { event: "order-updated" }, (p) => {
    received.push(p.payload);
    console.log("LIVE EVENT:", JSON.stringify(p.payload));
  })
  .subscribe((s) => {
    if (s === "SUBSCRIBED") console.log("subscribed OK");
  });

// 2. Create a demo order
const prod = await prisma.product.findFirst({ where: { active: true }, orderBy: { price: "asc" } });
const user = await prisma.user.findFirst();
const order = await prisma.order.create({
  data: {
    orderNumber: "NC-DEMO-RT-" + Math.floor(1000 + Math.random() * 9000),
    userId: user.id,
    status: "PACKED",
    paymentMethod: "COD",
    paymentStatus: "PENDING",
    subtotal: prod.price,
    deliveryCharge: 20,
    total: prod.price + 20,
    deliveryPin: "1234",
    addressSnapshot: JSON.stringify({
      fullName: "RT Tester",
      mobile: "+919999999999",
      city: "Mumbai",
      pincode: "400001",
      lat: 19.076,
      lng: 72.8777,
    }),
    items: {
      create: {
        productId: prod.id,
        name: prod.name,
        sku: prod.sku,
        image: prod.image,
        unitPrice: prod.price,
        quantity: 1,
        lineTotal: prod.price,
      },
    },
  },
});
console.log("demo order:", order.orderNumber, order.id);

// 3. Throwaway staff user (same pattern the E2E uses), then login on the live site
const staffHash = await bcrypt.hash(STAFF_PASSWORD, 10);
const staff = await prisma.user.upsert({
  where: { email: STAFF_EMAIL },
  update: { passwordHash: staffHash, role: "STAFF", status: "ACTIVE", name: "RT Check", mobile: "+919999998888" },
  create: { email: STAFF_EMAIL, name: "RT Check", mobile: "+919999998888", passwordHash: staffHash, role: "STAFF", status: "ACTIVE" },
});
const base = "https://night-corner.vercel.app";

// Cookie-jar-aware login: the CSRF cookie from the GET must be sent back
// with the POST, and the session cookie comes out of that response.
let jar = "";
const csrfRes = await fetch(base + "/api/auth/csrf");
jar = (csrfRes.headers.getSetCookie ? csrfRes.headers.getSetCookie() : [csrfRes.headers.get("set-cookie")])
  .map((c) => c.split(";")[0])
  .join("; ");
const csrf = await csrfRes.json();
const login = await fetch(base + "/api/auth/callback/credentials", {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded", cookie: jar },
  body: new URLSearchParams({ csrfToken: csrf.csrfToken, identifier: staff.email, password: STAFF_PASSWORD }),
  redirect: "manual",
});
const loginCookies = login.headers.getSetCookie ? login.headers.getSetCookie() : [login.headers.get("set-cookie")];
jar += "; " + loginCookies.map((c) => c.split(";")[0]).join("; ");
const sess = await fetch(base + "/api/auth/session", { headers: { cookie: jar } });
const sessJson = await sess.json();
console.log("login:", login.status, "session:", sess.status, sessJson.user ? sessJson.user.email : "UNAUTHENTICATED");

// 4. Mark OUT_FOR_DELIVERY via the live delivery API
const statusRes = await fetch(base + "/api/delivery/orders/" + order.id + "/status", {
  method: "PATCH",
  headers: { "content-type": "application/json", cookie: jar },
  body: JSON.stringify({ status: "OUT_FOR_DELIVERY" }),
  redirect: "manual",
});
const body = await statusRes.json().catch(() => ({}));
console.log("status change:", statusRes.status, JSON.stringify(body));

await new Promise((r) => setTimeout(r, 4000));
console.log("events received:", received.length);
const ok = received.some((e) => e.orderId === order.id && e.status === "OUT_FOR_DELIVERY");

// Cleanup
await prisma.order.deleteMany({ where: { id: order.id } });
await prisma.user.deleteMany({ where: { email: STAFF_EMAIL } });
await prisma.$disconnect();
await sub.removeChannel(ch);
console.log(ok ? "PASS: live status change broadcast to subscriber" : "FAIL");
process.exit(ok ? 0 : 1);
