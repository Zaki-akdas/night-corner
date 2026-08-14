import { NextResponse } from "next/server";
import { prisma, recentPoolErrors } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

// Supabase's transaction pooler caps client connections at 200 (observed in
// the EMAXCONN errors: "max client connections reached, limit: 200").
const CONNECTION_CAP = 200;

export async function GET() {
  await requireAdmin();

  // Live stats straight from Postgres. pg_stat_activity shows real backend
  // connections (pooler sessions); pg_stat_database has per-db totals.
  const [activity, byApp, byState, dbTotals, recentLogged] = await Promise.all([
    prisma.$queryRaw<{ total: bigint; active: bigint; idle: bigint; idle_in_txn: bigint; other: bigint }[]>`
      SELECT
        count(*)::bigint AS total,
        count(*) FILTER (WHERE state = 'active')::bigint AS active,
        count(*) FILTER (WHERE state = 'idle')::bigint AS idle,
        count(*) FILTER (WHERE state = 'idle in transaction')::bigint AS idle_in_txn,
        count(*) FILTER (WHERE state NOT IN ('active', 'idle', 'idle in transaction'))::bigint AS other
      FROM pg_stat_activity
    `,
    prisma.$queryRaw<{ app: string; n: bigint }[]>`
      SELECT COALESCE(application_name, '') AS app, count(*)::bigint AS n
      FROM pg_stat_activity
      GROUP BY application_name
      ORDER BY n DESC
    `,
    prisma.$queryRaw<{ state: string; n: bigint }[]>`
      SELECT COALESCE(state, '') AS state, count(*)::bigint AS n
      FROM pg_stat_activity
      GROUP BY state
      ORDER BY n DESC
    `,
    prisma.$queryRaw<{ db: string; backends: bigint }[]>`
      SELECT datname AS db, numbackends::bigint AS backends
      FROM pg_stat_database
      ORDER BY numbackends DESC
      LIMIT 10
    `,
    prisma.activityLog.findMany({
      where: { action: "DB_POOL_ERROR" },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, createdAt: true, meta: true },
    }),
  ]);

  const a = activity[0];
  const num = (v: bigint | undefined) => Number(v ?? 0n);
  const total = num(a?.total);
  const active = num(a?.active);
  const idle = num(a?.idle);
  const idleInTxn = num(a?.idle_in_txn);
  const other = num(a?.other);

  const bufferEvents = recentPoolErrors
    .slice()
    .reverse()
    .map((e) => ({ at: new Date(e.at).toISOString(), message: e.message }));
  const loggedEvents = recentLogged.map((l) => {
    let message = "pool error";
    try {
      const parsed = l.meta ? JSON.parse(l.meta) : null;
      if (parsed?.message) message = parsed.message;
    } catch {
      /* fall back to generic */
    }
    return { at: l.createdAt.toISOString(), message };
  });

  return NextResponse.json({
    sampledAt: new Date().toISOString(),
    connectionCap: CONNECTION_CAP,
    total,
    active,
    idle,
    idleInTxn,
    other,
    utilizationPct: Math.round((total / CONNECTION_CAP) * 100),
    byApp: byApp.map((r) => ({ app: r.app || "(none)", n: num(r.n) })),
    byState: byState.map((r) => ({ state: r.state || "(none)", n: num(r.n) })),
    dbTotals: dbTotals.map((r) => ({ db: r.db, backends: num(r.backends) })),
    recentErrors: [...loggedEvents, ...bufferEvents].slice(0, 20),
  });
}
