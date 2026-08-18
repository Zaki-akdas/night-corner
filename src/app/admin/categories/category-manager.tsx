"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Trash2, Loader2, GripVertical, Package, IndianRupee } from "lucide-react";
import { useToast } from "@/components/ui/toast";

type Cat = {
  id: string;
  name: string;
  slug: string;
  description: string;
  image: string;
  order: number;
  active: boolean;
  productCount: number;
  inventoryValue: number;
};

export function CategoryManager({ categories: initial }: { categories: Cat[] }) {
  const [cats, setCats] = useState(initial);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const toast = useToast();

  const create = async () => {
    setSaving(true);
    const res = await fetch("/api/admin/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (res.ok) {
      toast.push({ type: "success", message: "Category created" });
      setForm({ name: "", description: "" });
      setShowForm(false);
      router.refresh();
    } else toast.push({ type: "error", message: "Could not create" });
  };

  const toggle = async (c: Cat) => {
    await fetch(`/api/admin/categories/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !c.active }),
    });
    setCats((x) => x.map((y) => (y.id === c.id ? { ...y, active: !y.active } : y)));
  };

  const remove = async (c: Cat) => {
    if (!confirm(`Delete ${c.name}? Products will be uncategorized.`)) return;
    await fetch(`/api/admin/categories/${c.id}`, { method: "DELETE" });
    setCats((x) => x.filter((y) => y.id !== c.id));
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <button onClick={() => setShowForm((s) => !s)} className="btn-primary py-2 text-sm">
        <Plus className="h-4 w-4" /> Add Category
      </button>

      {showForm && (
        <div className="card p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <input className="input" placeholder="Category name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input className="input" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={create} disabled={saving} className="btn-primary py-2 text-sm">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
            </button>
            <button onClick={() => setShowForm(false)} className="btn-ghost py-2 text-sm">Cancel</button>
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cats.map((c) => (
          <Link
            key={c.id}
            href={`/admin/categories/${c.id}`}
            className="card group flex items-center gap-3 p-4 transition-colors hover:border-neon-purple/40 hover:bg-white/[0.03]"
          >
            <GripVertical className="h-4 w-4 text-slate-600" />
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-night-900/60">
              {c.image && <img src={c.image} alt={c.name} className="h-full w-full object-cover" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold text-white group-hover:text-neon-blue">{c.name}</div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-400">
                <span className="flex items-center gap-1">
                  <Package className="h-3 w-3" />
                  {c.productCount} product{c.productCount !== 1 ? "s" : ""}
                </span>
                {c.inventoryValue > 0 && (
                  <span className="flex items-center gap-1 text-neon-purple/80">
                    <IndianRupee className="h-3 w-3" />
                    {c.inventoryValue.toLocaleString("en-IN", { maximumFractionDigits: 0 })} inventory
                  </span>
                )}
              </div>
              <div className="text-[10px] text-slate-600">/{c.slug}</div>
            </div>
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle(c); }}
              className={`chip ${c.active ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"}`}
            >
              {c.active ? "Active" : "Hidden"}
            </button>
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); remove(c); }}
              className="text-slate-400 hover:text-rose-400"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </Link>
        ))}
      </div>
    </div>
  );
}
