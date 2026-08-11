import fs from "node:fs";
import path from "node:path";

/**
 * Node-runtime instrumentation (runs once at server startup, before user code).
 *
 * Night Corner uses SQLite via Prisma, which can't write to Vercel's read-only
 * function filesystem. On Vercel we ship `prisma/dev.db` in the bundle and copy
 * it to the writable `/tmp` directory on each cold start, then point Prisma at
 * the copy. Writes persist for the lifetime of the instance; for a production
 * deployment switch the Prisma provider to PostgreSQL (see README).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  if (process.env.VERCEL) {
    try {
      const src = path.join(process.cwd(), "prisma", "dev.db");
      const dest = "/tmp/dev.db";
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
        process.env.DATABASE_URL = `file:${dest}`;
      }
    } catch {
      // Leave DATABASE_URL untouched — local dev / other environments.
    }
  }
}
