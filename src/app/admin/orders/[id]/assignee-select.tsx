"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, UserCheck, UserX } from "lucide-react";
import { useToast } from "@/components/ui/toast";

export function AssigneeSelect({
  orderId,
  orderNumber,
  current,
  staff,
}: {
  orderId: string;
  orderNumber: string;
  current: string | null;
  staff: { id: string; name: string | null }[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [value, setValue] = useState(current ?? "");

  const assign = async (next: string) => {
    setBusy(true);
    setValue(next);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/assign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedTo: next || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.push({ type: "error", message: data.error || "Could not assign" });
        setValue(current ?? "");
        return;
      }
      toast.push({
        type: "success",
        message: next ? `Assigned ${orderNumber} to a delivery person` : `${orderNumber} unassigned`,
      });
      router.refresh();
    } catch {
      toast.push({ type: "error", message: "Could not assign — try again" });
      setValue(current ?? "");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card p-5">
      <h2 className="mb-3 flex items-center gap-2 font-bold text-white">
        {value ? <UserCheck className="h-4 w-4 text-neon-blue" /> : <UserX className="h-4 w-4 text-slate-400" />}
        Delivery Person
      </h2>
      <div className="flex items-center gap-2">
        <select
          value={value}
          disabled={busy}
          onChange={(e) => assign(e.target.value)}
          className="input flex-1 py-2 text-sm"
        >
          <option value="">Unassigned</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name || s.id.slice(0, 8)}
            </option>
          ))}
        </select>
        {busy && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-neon-blue" />}
      </div>
      <p className="mt-2 text-xs text-slate-500">
        {value
          ? "This delivery person sees the order on their dashboard."
          : "Unassigned orders appear in every delivery dashboard."}
      </p>
    </div>
  );
}
