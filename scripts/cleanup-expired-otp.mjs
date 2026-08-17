#!/usr/bin/env node
/**
 * Deletes stale signup OTP rows so the EmailOtp table never accumulates
 * dead codes. A row is stale when it is past its 10-minute expiry OR has
 * exhausted its 5 verification attempts. Runs on a schedule from GitHub
 * Actions (otp-cleanup.yml) against the production database, and can be
 * run manually:
 *
 *   DB_URL="postgresql://..." node scripts/cleanup-expired-otp.mjs
 *
 * On any failure it SMS-alerts the store owner's phone (Fast2SMS) so DB
 * drift is noticed without opening GitHub. Prints a PASS/FAIL summary and
 * exits non-zero on failure so CI notices.
 *
 * Alert config:
 *   FAST2SMS_API_KEY  — required for a real SMS; without it the alert is
 *                       skipped (logged) and the exit code still fails.
 *   OWNER_ALERT_PHONE — optional override; defaults to the store's
 *                       settings.whatsappNumber read from the DB.
 */
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { PrismaClient } = require("@prisma/client");

const DB_URL = process.env.DB_URL || process.env.DIRECT_URL;
if (!DB_URL) {
  console.error("set DB_URL (or DIRECT_URL) to the Postgres connection");
  process.exit(1);
}

// Keep in sync with MAX_ATTEMPTS in src/lib/email-otp.ts.
const MAX_ATTEMPTS = 5;

let failures = 0;
const ok = (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const fail = (m) => {
  failures++;
  console.log(`  \x1b[31m✗\x1b[0m ${m}`);
};

const prisma = new PrismaClient({ datasources: { db: { url: DB_URL } } });

/** Owner's phone (digits only): OWNER_ALERT_PHONE env, else settings.whatsappNumber. */
async function ownerPhone() {
  if (process.env.OWNER_ALERT_PHONE) return process.env.OWNER_ALERT_PHONE.replace(/\D/g, "");
  try {
    const row = await prisma.settings.findUnique({ where: { key: "app_settings" } });
    if (row?.value) {
      const parsed = JSON.parse(row.value);
      if (parsed.whatsappNumber) return String(parsed.whatsappNumber).replace(/\D/g, "");
    }
  } catch {
    // settings read failed — fall through to "no phone"
  }
  return "";
}

/** Sentry-style alert: SMS the store owner when the sweep fails. Never throws. */
async function alertOwnerOnFailure() {
  const apiKey = process.env.FAST2SMS_API_KEY;
  if (!apiKey) {
    console.log("  \x1b[33m⚠\x1b[0m owner alert skipped — FAST2SMS_API_KEY not set (no SMS sent)");
    return;
  }
  const phone = await ownerPhone();
  if (!phone) {
    console.log(
      "  \x1b[33m⚠\x1b[0m owner alert skipped — no owner phone (set OWNER_ALERT_PHONE or settings.whatsappNumber)"
    );
    return;
  }
  const msg = [
    "🚨 NIGHT CORNER — OTP cleanup FAILED",
    `Checks failed: ${failures}`,
    `Time: ${new Date().toISOString()}`,
    "The EmailOtp table may be accumulating stale codes. Check GitHub Actions for the run log.",
  ].join(" | ");
  try {
    const res = await fetch(
      "https://www.fast2sms.com/dev/bulkV2?" +
        new URLSearchParams({
          authorization: apiKey,
          message: msg,
          language: "english",
          route: "qtp",
          numbers: phone,
        })
    );
    const data = (await res.json().catch(() => ({}))) || {};
    if (!res.ok || data.return === false) {
      console.log(`  \x1b[31m✗\x1b[0m owner alert SMS failed: ${data.message || `HTTP ${res.status}`}`);
    } else {
      console.log(`  \x1b[32m✓\x1b[0m owner alerted via SMS (${phone})`);
    }
  } catch (e) {
    console.log(`  \x1b[31m✗\x1b[0m owner alert SMS threw: ${String(e?.message ?? e)}`);
  }
}

async function main() {
  const before = await prisma.emailOtp.count().catch(() => null);
  if (before === null) {
    fail("could not read EmailOtp row count");
    return;
  }
  ok(`EmailOtp table present (${before} rows before cleanup)`);

  const now = new Date();
  const stale = await prisma.emailOtp
    .findMany({
      where: { OR: [{ expiresAt: { lt: now } }, { attempts: { gte: MAX_ATTEMPTS } }] },
      select: { id: true },
    })
    .catch(() => null);
  if (stale === null) {
    fail("could not query stale rows");
    return;
  }

  const ids = stale.map((r) => r.id);
  let deleted = 0;
  if (ids.length > 0) {
    const res = await prisma.emailOtp
      .deleteMany({ where: { id: { in: ids } } })
      .catch(() => null);
    if (res === null) {
      fail("could not delete stale rows");
      return;
    }
    deleted = res.count;
  }
  ok(`deleted ${deleted} stale OTP row(s) (expired or past ${MAX_ATTEMPTS} attempts)`);

  // Rows that are still valid must remain untouched.
  const remaining = await prisma.emailOtp.count().catch(() => null);
  if (remaining === null) {
    fail("could not re-read row count");
    return;
  }
  if (remaining !== before - deleted) {
    fail(`row count mismatch: expected ${before - deleted}, found ${remaining}`);
  } else {
    ok(`row count consistent after cleanup (${remaining} remaining)`);
  }

  console.log(failures === 0 ? "\nOTP CLEANUP OK" : `\nOTP CLEANUP FAILED — ${failures} check(s)`);
}

main()
  .catch((e) => {
    fail(String(e?.message ?? e));
    console.log(`\nOTP CLEANUP FAILED — ${failures} check(s)`);
  })
  .finally(async () => {
    if (failures > 0) await alertOwnerOnFailure();
    await prisma.$disconnect().catch(() => {});
  })
  .then(() => process.exit(failures > 0 ? 1 : 0));
