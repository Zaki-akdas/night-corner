#!/usr/bin/env node
/**
 * Deletes expired signup OTP rows so the EmailOtp table never accumulates
 * stale codes. Runs on a schedule from GitHub Actions (otp-cleanup.yml)
 * against the production database, and can be run manually:
 *
 *   DB_URL="postgresql://..." node scripts/cleanup-expired-otp.mjs
 *
 * Safety: only touches EmailOtp, only rows past their expiresAt. Prints a
 * PASS/FAIL summary and exits non-zero on failure so CI notices.
 */
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { PrismaClient } = require("@prisma/client");

const DB_URL = process.env.DB_URL || process.env.DIRECT_URL;
if (!DB_URL) {
  console.error("set DB_URL (or DIRECT_URL) to the Postgres connection");
  process.exit(1);
}

let failures = 0;
const ok = (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const fail = (m) => {
  failures++;
  console.log(`  \x1b[31m✗\x1b[0m ${m}`);
};

const prisma = new PrismaClient({ datasources: { db: { url: DB_URL } } });

async function main() {
  const before = await prisma.emailOtp.count().catch(() => null);
  if (before === null) {
    fail("could not read EmailOtp row count");
    return;
  }
  ok(`EmailOtp table present (${before} rows before cleanup)`);

  const now = new Date();
  const expired = await prisma.emailOtp
    .findMany({ where: { expiresAt: { lt: now } }, select: { id: true } })
    .catch(() => null);
  if (expired === null) {
    fail("could not query expired rows");
    return;
  }

  const ids = expired.map((r) => r.id);
  let deleted = 0;
  if (ids.length > 0) {
    const res = await prisma.emailOtp
      .deleteMany({ where: { id: { in: ids } } })
      .catch(() => null);
    if (res === null) {
      fail("could not delete expired rows");
      return;
    }
    deleted = res.count;
  }
  ok(`deleted ${deleted} expired OTP row(s)`);

  // Un-expired rows must remain untouched.
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
  .finally(() => prisma.$disconnect().catch(() => {}))
  .then(() => process.exit(failures > 0 ? 1 : 0));
