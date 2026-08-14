"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, AlertTriangle, Database, Gauge, RefreshCw } from "lucide-react";

type PoolStatus = {
  sampledAt: string;
  connectionCap: number;
  total: number;
  active: number;
  idle: number;
  idleInTxn: number;
  other: number;
  utilizationPct: number;
  byApp: { app: string; n: number }[];
  byState: { state: string; n: number }[];
  dbTotals: { db: string; backends: number }[];
  recentErrors: { at: string; message: string }[];
};

const POLL_MS = 15_000;

function levelOf(pct: number) {
  if (pct >= 85) return { label: "Critical", color: "text-rose-400", bar: "bg-rose-500", chip: "bg-rose-500/20 text-rose-300" };
  if (pct >= 60) return { label: "Elevated", color: "text-amber-400", bar: "bg-amber-500", chip: "bg-amber-500/20 text-amber-300" };
  return { label: "Healthy", color: "text-emerald-400", bar: "bg-emerald-500", chip: "bg-emerald-500/20 text-emerald-300" };
}

export function PoolStatusClient() {
  const [data, setData] = useState<PoolStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/pool-status", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData((await res.json()) as PoolStatus);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const i = setInterval(load, POLL_MS);
    return () => clearInterval(i);
  }, [load]);

  const pct = data?.utilizationPct ?? 0;
  const level = levelOf(pct);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-end gap-3">
        {data && (
          <span className="text-xs text-slate-400">
            Sampled {new Date(data.sampledAt).toLocaleTimeString("en-IN")} · auto-refreshes every {POLL_MS / 1000}s
          </span>
        )}
        <button onClick={load} className="btn-ghost inline-flex items-center gap-1.5 px-3 py-1.5 text-xs">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {error && !data && (
        <div className="card flex items-center gap-3 border-rose-500/30 p-5 text-sm text-rose-300">
          <AlertTriangle className="h-5 w-5" /> Could not load pool status: {error}
        </div>
      )}

      {!data && !error && (
        <div className="card p-10 text-center text-sm text-slate-400">
          <Activity className="mx-auto mb-3 h-8 w-8 animate-pulse text-neon-purple" />
          Loading live connection stats…
        </div>
      )}

      {data && (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            {/* Utilization gauge */}
            <div className="card min-w-0 p-5">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-white">
                  <Gauge className="h-4 w-4 text-neon-purple" /> Utilization
                </div>
                <span className={`chip ${level.chip}`}>{level.label}</span>
              </div>
              <div className="flex items-end justify-between">
                <span className="text-3xl font-extrabold text-white">
                  {data.total}
                  <span className="text-base font-semibold text-slate-500"> / {data.connectionCap}</span>
                </span>
                <span className={`text-sm font-bold ${level.color}`}>{pct}%</span>
              </div>
              <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className={`h-full rounded-full transition-all ${level.bar}`}
                  style={{ width: `${Math.min(100, pct)}%` }}
                />
              </div>
              <p className="mt-3 text-xs text-slate-400">
                Supabase pooler cap ({data.connectionCap} connections). 200 is the hard limit — stay well under it.
              </p>
            </div>

            {/* State breakdown */}
            <div className="card min-w-0 p-5">
              <div className="mb-3 flex items-center gap-2 font-bold text-white">
                <Activity className="h-4 w-4 text-neon-blue" /> Session States
              </div>
              <ul className="space-y-2 text-sm">
                {data.byState.length === 0 && <li className="text-slate-400">No sessions</li>}
                {data.byState.map((s) => (
                  <li key={s.state} className="flex items-center justify-between">
                    <span className="capitalize text-slate-300">{s.state === "(none)" ? "No state" : s.state}</span>
                    <span className="font-bold text-white">{s.n}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-white/5 p-2.5">
                  <div className="text-slate-400">Active queries</div>
                  <div className="text-lg font-extrabold text-emerald-400">{data.active}</div>
                </div>
                <div className="rounded-lg bg-white/5 p-2.5">
                  <div className="text-slate-400">Idle in txn</div>
                  <div className="text-lg font-extrabold text-amber-400">{data.idleInTxn}</div>
                </div>
                <div className="rounded-lg bg-white/5 p-2.5">
                  <div className="text-slate-400">Idle</div>
                  <div className="text-lg font-extrabold text-slate-200">{data.idle}</div>
                </div>
                <div className="rounded-lg bg-white/5 p-2.5">
                  <div className="text-slate-400">Other</div>
                  <div className="text-lg font-extrabold text-slate-200">{data.other}</div>
                </div>
              </div>
            </div>

            {/* By application */}
            <div className="card min-w-0 p-5">
              <div className="mb-3 flex items-center gap-2 font-bold text-white">
                <Database className="h-4 w-4 text-emerald-400" /> By Application
              </div>
              <ul className="space-y-2 text-sm">
                {data.byApp.length === 0 && <li className="text-slate-400">No connections</li>}
                {data.byApp.slice(0, 8).map((r) => (
                  <li key={r.app} className="flex items-center justify-between gap-2">
                    <span className="truncate text-slate-300">{r.app || "(none)"}</span>
                    <span className="font-bold text-white">{r.n}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs text-slate-400">
                Each Vercel instance opens ≤1 pooled connection to the transaction pooler.
              </p>
            </div>
          </div>

          {/* Recent pool errors */}
          <div className="card min-w-0 p-5">
            <div className="mb-3 flex items-center gap-2 font-bold text-white">
              <AlertTriangle className="h-4 w-4 text-amber-400" /> Recent Pool Errors
              {data.recentErrors.length > 0 && (
                <span className="chip bg-rose-500/20 text-rose-300">{data.recentErrors.length} recorded</span>
              )}
            </div>
            {data.recentErrors.length === 0 ? (
              <p className="text-sm text-slate-400">
                No connection errors captured. Prisma failures (EMAXCONN, timeouts, unreachable host) appear here as
                they happen.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wider text-slate-500">
                      <th className="pb-2">Time</th>
                      <th className="pb-2">Message</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentErrors.map((e, i) => (
                      <tr key={i} className="border-t border-white/5">
                        <td className="whitespace-nowrap py-2 pr-4 text-slate-400">
                          {new Date(e.at).toLocaleString("en-IN")}
                        </td>
                        <td className="py-2 font-mono text-xs text-rose-300/90">{e.message.slice(0, 160)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
