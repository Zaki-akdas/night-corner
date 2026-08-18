"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Pencil, Trash2, Eye, EyeOff, Check, X } from "lucide-react";
import { useToast } from "@/components/ui/toast";

type Product = {
  id: string;
  name: string;
  sku: string;
  image: string;
  categoryId: string;
  price: number;
  mrp: number;
  stock: number;
  lowStockAt: number;
  active: boolean;
};

function formatINR(n: number): string {
  const v = Math.round(n * 100) / 100;
  const frac = v % 1 !== 0;
  return (
    "₹" +
    v.toLocaleString("en-IN", {
      minimumFractionDigits: frac ? 2 : 0,
      maximumFractionDigits: frac ? 2 : 0,
    })
  );
}

function EditableCell({
  value,
  type,
  onSave,
  className,
  displayClassName,
}: {
  value: number;
  type: "price" | "stock";
  onSave: (val: number) => void;
  className?: string;
  displayClassName?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = () => {
    setDraft(value);
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const cancel = () => {
    setDraft(value);
    setEditing(false);
  };

  const save = () => {
    const v = type === "stock" ? Math.round(draft) : Math.round(draft * 100) / 100;
    if (v !== value) onSave(v);
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") save();
    if (e.key === "Escape") cancel();
  };

  if (editing) {
    return (
      <div className={`flex items-center gap-1 ${className ?? ""}`}>
        {type === "price" && <span className="text-xs text-slate-500">₹</span>}
        <input
          ref={inputRef}
          type="number"
          step={type === "stock" ? "1" : "0.01"}
          min="0"
          value={draft}
          onChange={(e) => setDraft(Number(e.target.value))}
          onKeyDown={handleKeyDown}
          onBlur={save}
          className="w-20 rounded-lg border border-neon-purple/50 bg-white/5 px-2 py-1 text-sm text-white outline-none focus:border-neon-purple"
        />
        <button onClick={save} className="rounded p-0.5 text-emerald-400 hover:bg-emerald-500/10">
          <Check className="h-3.5 w-3.5" />
        </button>
        <button onClick={cancel} className="rounded p-0.5 text-rose-400 hover:bg-rose-500/10">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={startEdit}
      className={`group/edit cursor-pointer rounded-lg px-1.5 py-0.5 transition hover:bg-white/10 ${displayClassName ?? ""}`}
      title="Click to edit"
    >
      {type === "price" ? formatINR(value) : value}
    </button>
  );
}

export function CategoryProductRow({
  product,
  categories,
}: {
  product: Product;
  categories: { id: string; name: string }[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const [currentCategoryId, setCurrentCategoryId] = useState(product.categoryId);

  const patch = async (patch: Record<string, unknown>) => {
    setBusy(true);
    const res = await fetch(`/api/admin/products/${product.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    setBusy(false);
    if (res.ok) {
      router.refresh();
    } else {
      toast.push({ type: "error", message: "Could not save" });
    }
  };

  const reassignCategory = (newCategoryId: string) => {
    if (newCategoryId === currentCategoryId) return;
    setCurrentCategoryId(newCategoryId);
    patch({ categoryId: newCategoryId });
  };

  const toggle = () => patch({ active: !product.active });

  const remove = async () => {
    if (!confirm("Delete this product?")) return;
    setBusy(true);
    await fetch(`/api/admin/products/${product.id}`, { method: "DELETE" });
    setBusy(false);
    router.refresh();
  };

  const stockColor =
    product.stock === 0
      ? "text-rose-400"
      : product.stock <= product.lowStockAt
        ? "text-amber-400"
        : "text-slate-300";

  return (
    <tr className={`border-t border-white/5 hover:bg-white/[0.03] ${busy ? "opacity-60" : ""}`}>
      <td className="p-3">
        <div className="flex items-center gap-3">
          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-night-900/60">
            <Image src={product.image} alt={product.name} fill className="object-contain p-1" />
          </div>
          <div className="min-w-0">
            <Link
              href={`/admin/products/${product.id}`}
              className="font-semibold text-white hover:text-neon-blue"
            >
              {product.name}
            </Link>
            <div className="text-xs text-slate-500">{product.sku}</div>
          </div>
        </div>
      </td>
      <td className="p-3 font-semibold text-white">
        <EditableCell
          value={product.price}
          type="price"
          onSave={(price) => patch({ price })}
          displayClassName="font-semibold text-white"
        />
      </td>
      <td className="p-3 text-slate-400">
        <EditableCell
          value={product.mrp}
          type="price"
          onSave={(mrp) => patch({ mrp })}
          displayClassName="text-slate-400 line-through"
        />
      </td>
      <td className="p-3">
        <EditableCell
          value={product.stock}
          type="stock"
          onSave={(stock) => patch({ stock })}
          displayClassName={stockColor}
        />
      </td>
      <td className="p-3">
        <select
          value={currentCategoryId}
          onChange={(e) => reassignCategory(e.target.value)}
          disabled={busy}
          className="input py-1 text-xs"
          title="Reassign to another category"
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </td>
      <td className="p-3">
        <div className="flex items-center justify-end gap-1">
          <Link
            href={`/admin/products/${product.id}`}
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white"
          >
            <Pencil className="h-4 w-4" />
          </Link>
          <button
            onClick={toggle}
            disabled={busy}
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white"
          >
            {product.active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
          <button
            onClick={remove}
            disabled={busy}
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-rose-500/10 hover:text-rose-400"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}
