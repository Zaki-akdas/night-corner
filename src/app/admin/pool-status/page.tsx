import { requireAdmin } from "@/lib/admin";
import { PoolStatusClient } from "./pool-status-client";

export const dynamic = "force-dynamic";

export default async function AdminPoolStatusPage() {
  await requireAdmin();
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-white sm:text-3xl">Database Connections</h1>
          <p className="text-sm text-slate-400">
            Live Supabase Postgres connection usage and recent pool errors — so capacity pressure is visible before it
            becomes an outage.
          </p>
        </div>
      </div>
      <PoolStatusClient />
    </div>
  );
}
