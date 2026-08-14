import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * Supabase Postgres allows 200 connections, but Vercel build workers and
 * serverless instances each open their own Prisma pool (defaults to
 * num_cpus*2+1 per client). Parallel page-data collection can burst past the
 * limit and fail the build. Cap every client's pool unless the URL already
 * sets its own limit.
 */
// Keep the per-instance pool tiny: Vercel can spin many serverless instances
// during a traffic burst, and each pool counts toward Supabase's 200-connection
// cap. The Supabase transaction pooler (port 6543) also requires
// pgbouncer=true + connection_limit=1 for Prisma's PgBouncer mode — exactly
// the documented serverless setup. 1 connection per instance pushes the
// failure point to ~200 concurrent cold instances.
const POOL_LIMIT = 1;

function withPoolLimit(url: string | undefined): string | undefined {
  if (!url || !url.startsWith("postgres")) return url;
  const isPooler = /pooler\.supabase\.com|:6543\//.test(url);
  // PgBouncer transaction mode needs pgbouncer=true, and Prisma enforces
  // connection_limit=1 alongside it, so set both together on pooler URLs.
  // Strip any existing query string first to avoid malformed `?&` output.
  if (isPooler) {
    const base = url.split("?")[0];
    return base + `?pgbouncer=true&connection_limit=${POOL_LIMIT}`;
  }
  if (!/[?&]connection_limit=/.test(url)) {
    return url + (url.includes("?") ? "&" : "?") + `connection_limit=${POOL_LIMIT}`;
  }
  return url;
}

// Prisma resolves env("DATABASE_URL") / env("DIRECT_URL") at construction time,
// so normalizing here applies to every pool (build-time data collection included).
process.env.DATABASE_URL = withPoolLimit(process.env.DATABASE_URL);
process.env.DIRECT_URL = withPoolLimit(process.env.DIRECT_URL);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
