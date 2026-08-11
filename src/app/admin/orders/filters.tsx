"use client";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ORDER_STATUSES } from "@/lib/types";

export function AdminOrderFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const set = (k: string, v: string) => {
    const sp = new URLSearchParams(params?.toString());
    if (!v) sp.delete(k);
    else sp.set(k, v);
    router.push(`${pathname}?${sp}`);
  };
  return (
    <div className="card flex flex-wrap items-center gap-2 p-3">
      <input
        defaultValue={params?.get("q") ?? ""}
        onKeyDown={(e) => e.key === "Enter" && set("q", (e.target as HTMLInputElement).value)}
        placeholder="Search order number..."
        className="input max-w-xs py-2 text-sm"
      />
      <select
        defaultValue={params?.get("status") ?? ""}
        onChange={(e) => set("status", e.target.value)}
        className="input max-w-[180px] py-2 text-sm"
      >
        <option value="">All statuses</option>
        {ORDER_STATUSES.map((s) => (
          <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
        ))}
      </select>
      <select
        defaultValue={params?.get("payment") ?? ""}
        onChange={(e) => set("payment", e.target.value)}
        className="input max-w-[160px] py-2 text-sm"
      >
        <option value="">All payments</option>
        <option value="COD">COD</option>
        <option value="UPI">UPI</option>
        <option value="ONLINE">Online</option>
      </select>
    </div>
  );
}
