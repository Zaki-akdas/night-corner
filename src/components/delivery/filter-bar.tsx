"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Filter, X } from "lucide-react";

const STATUS_OPTIONS = ["PLACED", "CONFIRMED", "PREPARING", "PACKED", "OUT_FOR_DELIVERY"];
const PAYMENT_OPTIONS = ["COD", "UPI", "ONLINE"];
const TIME_OPTIONS = [
  { value: "", label: "All time" },
  { value: "1h", label: "Last 1 hour" },
  { value: "4h", label: "Last 4 hours" },
  { value: "8h", label: "Last 8 hours" },
];
const SORT_OPTIONS = [
  { value: "oldest", label: "Oldest first" },
  { value: "newest", label: "Newest first" },
  { value: "amount-desc", label: "Amount high → low" },
  { value: "amount-asc", label: "Amount low → high" },
];

/**
 * Filters/sorts the delivery dashboard via URL search params
 * (?status=&payment=&time=&sort=). Because state lives in the URL, the 30s
 * AutoRefresh re-render keeps the current filters applied.
 */
export function FilterBar({
  statusCounts,
  paymentCounts,
  currentUserId,
  staffList,
  isAdmin,
}: {
  statusCounts: Record<string, number>;
  paymentCounts: Record<string, number>;
  currentUserId: string;
  staffList: { id: string; name: string | null }[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const status = sp.get("status") ?? "";
  const payment = sp.get("payment") ?? "";
  const time = sp.get("time") ?? "";
  const sort = sp.get("sort") ?? "oldest";
  const assignee = sp.get("assignee") ?? "";

  const set = (patch: Record<string, string>) => {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  };

  const active = status || payment || time || sort !== "oldest" || (isAdmin && assignee);

  return (
    <div className="card space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
          <Filter className="h-3.5 w-3.5" /> Filters
        </span>
        {active && (
          <button
            onClick={() => router.replace(pathname)}
            className="inline-flex items-center gap-1 text-xs text-slate-400 transition hover:text-rose-300"
          >
            <X className="h-3 w-3" /> Clear all
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <label className="block">
          <span className="mb-1 block text-[10px] uppercase tracking-wider text-slate-500">Status</span>
          <select value={status} onChange={(e) => set({ status: e.target.value })} className="input py-2 text-xs">
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")} ({statusCounts[s] ?? 0})
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-[10px] uppercase tracking-wider text-slate-500">Payment</span>
          <select value={payment} onChange={(e) => set({ payment: e.target.value })} className="input py-2 text-xs">
            <option value="">All payments</option>
            {PAYMENT_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {p} ({paymentCounts[p] ?? 0})
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-[10px] uppercase tracking-wider text-slate-500">Placed in</span>
          <select value={time} onChange={(e) => set({ time: e.target.value })} className="input py-2 text-xs">
            {TIME_OPTIONS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-[10px] uppercase tracking-wider text-slate-500">Sort</span>
          <select value={sort} onChange={(e) => set({ sort: e.target.value })} className="input py-2 text-xs">
            {SORT_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>

        {isAdmin && <label className="block">
          <span className="mb-1 block text-[10px] uppercase tracking-wider text-slate-500">Assigned to</span>
          <select
            value={assignee}
            onChange={(e) => set({ assignee: e.target.value })}
            className="input py-2 text-xs"
          >
            <option value="">Everyone</option>
            <option value="unassigned">Unassigned</option>
            <option value="me">Me</option>
            {staffList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name || s.id.slice(0, 8)}
              </option>
            ))}
          </select>
        </label>}
      </div>
    </div>
  );
}
