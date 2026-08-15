#!/usr/bin/env node
/**
 * Post-deploy schema smoke test.
 *
 * Verifies the database that the last deployment's `migrate deploy` ran
 * against actually has the expected schema — specifically the
 * `MessengerIdentity` table (added by migration 20260815000001_messenger_identity)
 * and that the migration is recorded in the `_prisma_migrations` history.
 * Run it after any deployment:
 *
 *   npm run db:check                       # default schema: public
 *   npm run db:check -- --schema test_e2e  # any specific schema
 *
 * Connection uses DATABASE_URL (the Supabase pooler) from the environment or
 * .env — same resolution as scripts/prebuild.mjs. Exit code 0 = everything
 * the Messenger feature needs is present; 1 = something is missing.
 */
import { readFileSync, existsSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

// Respect already-set env vars (Vercel / shell); fall back to .env.
if (existsSync(".env")) {
  for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) {
      process.env[m[1]] = m[2].trim().replace(/^"(.*)"$/, "$1");
    }
  }
}

const argSchema = process.argv.indexOf("--schema");
const SCHEMA =
  argSchema >= 0 && process.argv[argSchema + 1]
    ? process.argv[argSchema + 1]
    : "public";
if (!/^[a-zA-Z0-9_]+$/.test(SCHEMA)) {
  console.error(`[db:check] invalid --schema: ${SCHEMA}`);
  process.exit(1);
}

const MESSENGER_MIGRATION = "20260815000001_messenger_identity";

let pass = true;
const ok = (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const bad = (m) => {
  pass = false;
  console.log(`  \x1b[31m✗\x1b[0m ${m}`);
};
const warn = (m) => console.log(`  \x1b[33m!\x1b[0m ${m}`);

async function main() {
  const url = process.env.DATABASE_URL || process.env.DIRECT_URL;
  if (!url) {
    console.error("[db:check] no DATABASE_URL — set it or add a .env file.");
    process.exit(1);
  }
  console.log(
    `[db:check] ${url.replace(/:[^:@/]+@/, ":***@")} · schema \x1b[1m${SCHEMA}\x1b[0m`
  );

  const prisma = new PrismaClient();
  try {
    // 1. The MessengerIdentity table must exist (the actual feature requirement).
    const table = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS n FROM pg_tables WHERE schemaname = '${SCHEMA}' AND tablename = 'MessengerIdentity'`
    );
    (table[0]?.n ?? 0) === 1
      ? ok("MessengerIdentity table exists")
      : bad("MessengerIdentity table is MISSING — the deployment's migration did not run");

    // 2. Migration history: if the DB has one, the messenger migration must be
    // recorded as applied (pre-migration db-push databases have no history —
    // there the table check above is the only signal).
    const history = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS n FROM information_schema.tables WHERE table_schema = '${SCHEMA}' AND table_name = '_prisma_migrations'`
    );
    if ((history[0]?.n ?? 0) === 1) {
      const applied = await prisma.$queryRawUnsafe(
        `SELECT migration_name FROM "${SCHEMA}"."_prisma_migrations" WHERE migration_name = '${MESSENGER_MIGRATION}'`
      );
      applied.length === 1
        ? ok(`migration ${MESSENGER_MIGRATION} recorded as applied`)
        : bad(
            `migration ${MESSENGER_MIGRATION} is NOT in the migration history — ` +
              "`prisma migrate deploy` has not applied it"
          );
    } else {
      warn(
        "no _prisma_migrations history (db-push-era database) — relying on table presence only"
      );
    }
  } finally {
    await prisma.$disconnect().catch(() => {});
  }

  console.log(pass ? "\n\x1b[32mDB CHECK PASSED ✓\x1b[0m" : "\n\x1b[31mDB CHECK FAILED ✗\x1b[0m");
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error("[db:check] failed:", e.message);
  process.exit(1);
});
