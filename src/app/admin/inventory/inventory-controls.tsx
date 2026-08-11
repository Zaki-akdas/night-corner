"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Minus } from "lucide-react";
import { useToast } from "@/components/ui/toast";

type Row = {
  id: string;
  name: string;
  sku: string;
  category: string;
  stock: number;
  startingStock: number;
  sold: number;
  lowStockAt: number;
};

export function InventoryControls({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const toast = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);

  const adjust = async (id: string, delta: number) => {
    setBusyId(id);
    const res = await fetch(`/api/admin/inventory/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ delta, reason: delta > 0 ? "RESTOCK" : "ADJUSTMENT" }),
    });
    setBusyId(null);
    if (res.ok) {
      toast.push({ type: "success", message: `Stock ${delta > 0 ? "increased" : "decreased"}` });
      router.refresh();
    } else toast.push({ type: "error", message: "Update failed" });
  };

  return (
    <div className="card overflow-x-auto p-0">
      <table className="w-full text-sm">
        <thead className="bg-white/5 text-left text-xs uppercase tracking-wider text-slate-400">
          <tr>
            <th className="p-3">Product</th>
            <th className="p-3">SKU</th>
            <th className="p-3">Category</th>
            <th className="p-3">Starting</th>
            <th className="p-3">Sold</th>
            <th className="p-3">Remaining</th>
            <th className="p-3">Adjust</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const tone = r.stock === 0 ? "text-rose-400" : r.stock <= r.lowStockAt ? "text-amber-400" : "text-slate-200";
            return (
              <tr key={r.id} className="border-t border-white/5">
                <td className="p-3 font-semibold text-white">{r.name}</td>
                <td className="p-3 text-slate-400">{r.sku}</td>
                <td className="p-3 text-slate-400">{r.category}</td>
                <td className="p-3 text-slate-300">{r.startingStock}</td>
                <td className="p-3 text-slate-300">{r.sold}</td>
                <td className={`p-3 font-bold ${tone}`}>{r.stock}</td>
                <td className="p-3">
                  <div className="flex items-center gap-1">
                    <button onClick={() => adjust(r.id, -1)} disabled={busyId === r.id || r.stock <= 0} className="grid h-8 w-8 place-items-center rounded-lg bg-white/5 text-slate-300 hover:bg-white/10 disabled:opacity-40">
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => adjust(r.id, 1)} disabled={busyId === r.id} className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-40">
                      {busyId === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
