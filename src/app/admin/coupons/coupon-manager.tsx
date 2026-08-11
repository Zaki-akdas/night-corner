"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/toast";

type Coupon = {
  id: string;
  code: string;
  type: string;
  value: number;
  minOrder: number;
  maxDiscount: number | null;
  freeDelivery: boolean;
  usageLimit: number | null;
  usedCount: number;
  active: boolean;
  expiresAt: Date | null;
};

export function CouponManager({ coupons }: { coupons: Coupon[] }) {
  const router = useRouter();
  const toast = useToast();
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    code: "",
    type: "PERCENT",
    value: 10,
    minOrder: 0,
    maxDiscount: 0,
    freeDelivery: false,
    usageLimit: 0,
    expiresAt: "",
  });

  const create = async () => {
    setSaving(true);
    const res = await fetch("/api/admin/coupons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        code: form.code.toUpperCase(),
        maxDiscount: form.maxDiscount || null,
        usageLimit: form.usageLimit || null,
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
      }),
    });
    setSaving(false);
    if (res.ok) {
      toast.push({ type: "success", message: "Coupon created" });
      setShow(false);
      router.refresh();
    } else toast.push({ type: "error", message: "Could not create" });
  };

  const toggle = async (c: Coupon) => {
    await fetch(`/api/admin/coupons/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !c.active }),
    });
    router.refresh();
  };

  const remove = async (c: Coupon) => {
    if (!confirm("Delete coupon?")) return;
    await fetch(`/api/admin/coupons/${c.id}`, { method: "DELETE" });
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <button onClick={() => setShow((s) => !s)} className="btn-primary py-2 text-sm">
        <Plus className="h-4 w-4" /> New Coupon
      </button>

      {show && (
        <div className="card grid gap-3 p-4 sm:grid-cols-3">
          <input className="input uppercase" placeholder="CODE" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            <option value="PERCENT">Percent</option>
            <option value="FIXED">Fixed</option>
          </select>
          <input type="number" className="input" placeholder="Value" value={form.value} onChange={(e) => setForm({ ...form, value: Number(e.target.value) })} />
          <input type="number" className="input" placeholder="Min order" value={form.minOrder} onChange={(e) => setForm({ ...form, minOrder: Number(e.target.value) })} />
          <input type="number" className="input" placeholder="Max discount" value={form.maxDiscount} onChange={(e) => setForm({ ...form, maxDiscount: Number(e.target.value) })} />
          <input type="number" className="input" placeholder="Usage limit" value={form.usageLimit} onChange={(e) => setForm({ ...form, usageLimit: Number(e.target.value) })} />
          <input type="date" className="input" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} />
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={form.freeDelivery} onChange={(e) => setForm({ ...form, freeDelivery: e.target.checked })} /> Free delivery
          </label>
          <button onClick={create} disabled={saving} className="btn-primary">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
          </button>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {coupons.map((c) => (
          <div key={c.id} className="card p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-mono text-lg font-bold text-neon-purple">{c.code}</div>
                <div className="text-xs text-slate-400">
                  {c.type === "PERCENT" ? `${c.value}% off` : `₹${c.value} off`}
                  {c.freeDelivery ? " + free delivery" : ""}
                </div>
              </div>
              <button onClick={() => remove(c)} className="text-slate-400 hover:text-rose-400">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 text-xs text-slate-400">
              Used {c.usedCount}{c.usageLimit ? ` / ${c.usageLimit}` : ""} · min ₹{c.minOrder}
              {c.expiresAt && ` · expires ${new Date(c.expiresAt).toLocaleDateString("en-IN")}`}
            </div>
            <button
              onClick={() => toggle(c)}
              className={`mt-3 chip ${c.active ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"}`}
            >
              {c.active ? "Active" : "Inactive"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
