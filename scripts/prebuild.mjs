#!/usr/bin/env node
/**
 * Pre-build migration step (runs as part of `npm run build`, i.e. on every
 * Vercel deployment).
 *
 * The project previously synced its schema with `prisma db push`, so existing
 * databases (production included) hold the full schema but have no migration
 * history. Prisma refuses to apply the first migration to such a database
 * (P3005) — it would otherwise try to recreate every table. This script
 * bridges that once per database:
 *
 *   1. If the database has tables but no `_prisma_migrations` history, the
 *      idempotent baseline migration (20260815000000_init) is recorded as
 *      applied via `prisma migrate resolve`. No SQL runs, so no data is
 *      touched — the tables are already there.
 *   2. `prisma migrate deploy` then applies only genuinely new migrations
 *      (e.g. 20260815000001_messenger_identity), automatically, on deploy.
 *
 * Future schema changes are just new committed migrations — they ship with the
 * next deployment, no manual steps.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

// Vercel injects env vars into the build; local runs load .env. Never
// override an already-set variable (Vercel's values win).
if (existsSync(".env")) {
  for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) {
      process.env[m[1]] = m[2].trim().replace(/^"(.*)"$/, "$1");
    }
  }
}

const BASELINE = "20260815000000_init";

function run(cmd) {
  const r = spawnSync(cmd, { shell: true, stdio: "inherit" });
  if (r.status !== 0) throw new Error(`command failed (exit ${r.status}): ${cmd}`);
}

async function main() {
  const prisma = new PrismaClient();
  let needsBaseline = false;
  try {
    const tables = await prisma.$queryRawUnsafe(
      "SELECT COUNT(*)::int AS n FROM information_schema.tables WHERE table_schema = current_schema()"
    );
    const history = await prisma.$queryRawUnsafe(
      'SELECT to_regclass(\'"_prisma_migrations"\')::text AS t'
    );
    needsBaseline = (tables[0]?.n ?? 0) > 0 && !history[0]?.t;
  } catch (e) {
    console.warn("[prebuild] could not inspect migration state:", e.message);
  } finally {
    await prisma.$disconnect().catch(() => {});
  }

  if (needsBaseline) {
    console.warn(
      "[prebuild] database has tables but no migration history — recording baseline " +
        `${BASELINE} as applied (no data touched).`
    );
    try {
      run(`npx prisma migrate resolve --applied ${BASELINE}`);
    } catch (e) {
      // A concurrent build may have baselined it first — that's fine.
      console.warn("[prebuild] baseline resolve did not run:", e.message);
    }
  }

  run("npx prisma migrate deploy");
}

main().catch((e) => {
  console.error("[prebuild] failed:", e.message);
  process.exit(1);
});
