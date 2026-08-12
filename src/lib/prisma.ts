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
// cap (6 per instance × 34 instances already breaks it). 2 is plenty for a
// night shop and pushes the failure point to ~100 concurrent cold instances.
const POOL_LIMIT = 2;

function withPoolLimit(url: string | undefined): string | undefined {
  if (!url || !url.startsWith("postgres")) return url;
  if (/[?&]connection_limit=/.test(url)) return url;
  return url + (url.includes("?") ? "&" : "?") + `connection_limit=${POOL_LIMIT}`;
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
