// Logs in as a throwaway admin and confirms the production /admin/settings
// page renders the notification-channel status card (LIVE/DEMO per channel).
import fs from "fs";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const EMAIL = "status-check@nightcorner.in";
const PASSWORD = "StatusCheck123!";
const BASE = "https://night-corner.vercel.app";

try {
  const hash = await bcrypt.hash(PASSWORD, 10);
  await prisma.user.upsert({
    where: { email: EMAIL },
    update: { passwordHash: hash, role: "ADMIN", status: "ACTIVE", name: "Status Check" },
    create: { email: EMAIL, name: "Status Check", passwordHash: hash, role: "ADMIN", status: "ACTIVE" },
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
    body: new URLSearchParams({ csrfToken: csrf.csrfToken, identifier: EMAIL, password: PASSWORD }),
    redirect: "manual",
  });
  const loginCookies = login.headers.getSetCookie ? login.headers.getSetCookie() : [login.headers.get("set-cookie")];
  jar += "; " + loginCookies.map((c) => c.split(";")[0]).join("; ");

  const res = await fetch(BASE + "/admin/settings", { headers: { cookie: jar } });
  const html = await res.text();
  const hasCard = html.includes("Notification channels");
  const demoCount = (html.match(/>Demo</g) || []).length;
  console.log("status:", res.status, "| card:", hasCard, "| Demo badges:", demoCount);
  process.exitCode = res.status === 200 && hasCard && demoCount >= 2 ? 0 : 1;
} finally {
  await prisma.user.deleteMany({ where: { email: EMAIL } });
  await prisma.$disconnect();
}
