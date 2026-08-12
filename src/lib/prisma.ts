import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * Supabase Postgres allows 200 connections, but Vercel build workers and
 * serverless instances each open their own Prisma pool (defaults to
 * num_cpus*2+1 per client). Parallel page-data collection can burst past the
 * limit and fail the build. Cap every client's pool unless the URL already
 * sets its own limit.
 */
const POOL_LIMIT = 6;

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
