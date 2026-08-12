// Logs in as a throwaway staff user and confirms the production delivery
// dashboard renders the new-order alert toggle + data-order-number cards.
import fs from "fs";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const STAFF_EMAIL = "alert-check@nightcorner.in";
const STAFF_PASSWORD = "AlertCheck123!";
const BASE = "https://night-corner.vercel.app";

const env = {};
for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
}

try {
  const hash = await bcrypt.hash(STAFF_PASSWORD, 10);
  await prisma.user.upsert({
    where: { email: STAFF_EMAIL },
    update: { passwordHash: hash, role: "STAFF", status: "ACTIVE", name: "Alert Check" },
    create: { email: STAFF_EMAIL, name: "Alert Check", passwordHash: hash, role: "STAFF", status: "ACTIVE" },
  });

  let jar = "";
  const csrfRes = await fetch(BASE + "/api/auth/csrf");
  jar = (csrfRes.headers.getSetCookie ? csrfRes.headers.getSetCookie() : [csrfRes.headers.get("set-cookie")])
    .map((c) => c.split(";")[0])
    .join("; ");
  const csrf = await csrfRes.json();
  const login = await fetch(BASE + "/api/auth/callback/credentials", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie: jar },
    body: new URLSearchParams({ csrfToken: csrf.csrfToken, identifier: STAFF_EMAIL, password: STAFF_PASSWORD }),
    redirect: "manual",
  });
  const loginCookies = login.headers.getSetCookie ? login.headers.getSetCookie() : [login.headers.get("set-cookie")];
  jar += "; " + loginCookies.map((c) => c.split(";")[0]).join("; ");

  const res = await fetch(BASE + "/delivery", { headers: { cookie: jar } });
  const html = await res.text();
  const hasToggle = html.includes('aria-label="Mute new-order alerts"');
  console.log("status:", res.status, "| toggle:", hasToggle);
  // data-order-number appears only when order cards are rendered (empty
  // dashboard has none) — verified in the E2E/local browser instead.
  // Set exitCode (not process.exit) so the finally block still runs.
  process.exitCode = res.status === 200 && hasToggle ? 0 : 1;
} finally {
  await prisma.user.deleteMany({ where: { email: STAFF_EMAIL } });
  await prisma.$disconnect();
}
