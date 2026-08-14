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

// ── Pool-health instrumentation ────────────────────────────────────────────
// Capture connection/pool failures (EMAXCONN, timeouts, unreachable host) so
// the admin pool-status view can surface capacity pressure before a full
// outage. Kept in-memory per instance plus a throttled best-effort write to
// the activity log so errors survive across serverless instances.

export type PoolErrorEvent = {
  at: number;
  message: string;
};

const POOL_ERROR_BUFFER_MAX = 50;
const POOL_ERROR_LOG_THROTTLE_MS = 30_000; // at most one activity-log row per 30s
const POOL_ERROR_RE =
  /EMAXCONN|max client connections|Can't reach database server|connection (pool|limit)|too many (open )?connections|ECONNREFUSED|connect ETIMEDOUT/i;

export const recentPoolErrors: PoolErrorEvent[] = [];
let lastPoolErrorLogged = 0;

function recordPoolError(message: string) {
  const now = Date.now();
  const clean = message.slice(0, 500);
  recentPoolErrors.push({ at: now, message: clean });
  if (recentPoolErrors.length > POOL_ERROR_BUFFER_MAX) recentPoolErrors.shift();

  // Persist sparingly — during an actual outage the DB may be unreachable,
  // and a flood of writes would make things worse. Best-effort only.
  if (now - lastPoolErrorLogged >= POOL_ERROR_LOG_THROTTLE_MS) {
    lastPoolErrorLogged = now;
    prisma.activityLog
      .create({
        data: {
          action: "DB_POOL_ERROR",
          entity: "database",
          meta: JSON.stringify({ message: clean, source: "prisma" }),
        },
      })
      .catch(() => {
        /* DB may be down — the in-memory buffer still has it */
      });
  }
}

// Prisma only emits error log events when the client is constructed with the
// "error" log level — the config above always includes it. The `$on` overload
// is inferred from the static log config, so cast through a wider interface.
try {
  (prisma as unknown as { $on(event: "error", cb: (e: { message?: string }) => void): void }).$on("error", (e) => {
    if (e?.message && POOL_ERROR_RE.test(e.message)) recordPoolError(e.message);
  });
} catch {
  /* listener is best-effort */
}
