"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { ImageUpload } from "@/components/admin/image-upload";
import type { Category, Product } from "@prisma/client";

export function ProductForm({
  categories,
  product,
}: {
  categories: Pick<Category, "id" | "name">[];
  product?: Product;
}) {
  const router = useRouter();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: product?.name ?? "",
    shortDesc: product?.shortDesc ?? "",
    description: product?.description ?? "",
    categoryId: product?.categoryId ?? categories[0]?.id ?? "",
    price: product?.price ?? 0,
    mrp: product?.mrp ?? 0,
    stock: product?.stock ?? 0,
    unit: product?.unit ?? "1 pc",
    sku: product?.sku ?? "",
    isVeg: product?.isVeg ?? true,
    featured: product?.featured ?? false,
    bestSeller: product?.bestSeller ?? false,
    active: product?.active ?? true,
    keywords: product?.keywords ?? "",
    freshnessNote: product?.freshnessNote ?? "",
    lowStockAt: product?.lowStockAt ?? 3,
    image: product?.image ?? "",
    gallery: product?.gallery ?? "[]",
  });

  const set = (k: keyof typeof form, v: string | number | boolean) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const url = product ? `/api/admin/products/${product.id}` : "/api/admin/products";
    const method = product ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      toast.push({ type: "error", message: d.error || "Could not save" });
      return;
    }
    toast.push({ type: "success", message: product ? "Product updated" : "Product created" });
    router.push("/admin/products");
    router.refresh();
  };

  const discountPct =
    form.mrp > form.price ? Math.round(((form.mrp - form.price) / form.mrp) * 100) : 0;

  const addToGallery = (url: string) => {
    setForm((f) => {
      let arr: string[] = [];
      try {
        arr = JSON.parse(f.gallery || "[]");
      } catch {
        arr = [];
      }
      if (!Array.isArray(arr)) arr = [];
      if (arr.includes(url)) return f;
      return { ...f, gallery: JSON.stringify([...arr, url]) };
    });
  };

  return (
    <form onSubmit={submit} className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <div className="card space-y-4 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name*">
            <input className="input" value={form.name} onChange={(e) => set("name", e.target.value)} required />
          </Field>
          <Field label="SKU*">
            <input className="input" value={form.sku} onChange={(e) => set("sku", e.target.value)} required />
          </Field>
          <Field label="Short description">
            <input className="input" value={form.shortDesc} onChange={(e) => set("shortDesc", e.target.value)} />
          </Field>
          <Field label="Unit (e.g. 70 g)">
            <input className="input" value={form.unit} onChange={(e) => set("unit", e.target.value)} />
          </Field>
        </div>
        <Field label="Description*">
          <textarea className="input min-h-[100px]" value={form.description} onChange={(e) => set("description", e.target.value)} required />
        </Field>
        <Field label="Search keywords (comma separated)">
          <input className="input" value={form.keywords} onChange={(e) => set("keywords", e.target.value)} />
        </Field>
        <Field label="Freshness note (bakery)">
          <input className="input" value={form.freshnessNote ?? ""} onChange={(e) => set("freshnessNote", e.target.value)} placeholder="Baked fresh tonight" />
        </Field>

        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="Selling price (₹)*">
            <input type="number" step="0.01" className="input" value={form.price} onChange={(e) => set("price", Number(e.target.value))} required />
          </Field>
          <Field label="MRP (₹)*">
            <input type="number" step="0.01" className="input" value={form.mrp} onChange={(e) => set("mrp", Number(e.target.value))} required />
          </Field>
          <Field label="Stock*">
            <input type="number" className="input" value={form.stock} onChange={(e) => set("stock", Number(e.target.value))} required />
          </Field>
          <Field label="Low-stock at">
            <input type="number" className="input" value={form.lowStockAt} onChange={(e) => set("lowStockAt", Number(e.target.value))} />
          </Field>
        </div>
        {discountPct > 0 && (
          <div className="rounded-xl bg-emerald-500/10 p-3 text-sm text-emerald-300">
            {discountPct}% discount applied
          </div>
        )}

        <Field label="Hero Image URL">
          <div className="flex items-start gap-2">
            <input className="input" value={form.image} onChange={(e) => set("image", e.target.value)} placeholder="/images/products/example/1.jpg" />
            <ImageUpload
              label="Upload photo"
              onUpload={(url) => set("image", url)}
              className="shrink-0"
            />
          </div>
        </Field>
        <Field label='Gallery (JSON array of image URLs, e.g. ["/img/1.jpg","/img/2.jpg"] )'>
          <div className="flex items-start gap-2">
            <textarea
              className="input min-h-[80px] flex-1 font-mono text-xs"
              value={form.gallery}
              onChange={(e) => set("gallery", e.target.value)}
              placeholder='["/images/products/example/1.jpg","/images/products/example/2.jpg"]'
            />
            <ImageUpload
              label="Add to gallery"
              onUpload={addToGallery}
              className="shrink-0"
            />
          </div>
        </Field>
      </div>

      <aside className="card space-y-4 p-5">
        <Field label="Category*">
          <select className="input" value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </Field>

        {form.image && (
          <div className="relative aspect-square overflow-hidden rounded-xl bg-night-900/60">
            <Image src={form.image} alt="preview" fill className="object-contain p-4" />
          </div>
        )}

        <Toggle label="Veg" on={form.isVeg} onClick={() => set("isVeg", !form.isVeg)} />
        <Toggle label="Featured" on={form.featured} onClick={() => set("featured", !form.featured)} />
        <Toggle label="Best seller" on={form.bestSeller} onClick={() => set("bestSeller", !form.bestSeller)} />
        <Toggle label="Active (published)" on={form.active} onClick={() => set("active", !form.active)} />

        <button disabled={saving} className="btn-primary w-full">
          {saving && <Loader2 className="h-5 w-5 animate-spin" />}
          {product ? "Save Changes" : "Create Product"}
        </button>
      </aside>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

function Toggle({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-sm ${
        on ? "border-neon-purple bg-neon-purple/10 text-white" : "border-white/10 text-slate-300"
      }`}
    >
      <span>{label}</span>
      <span className={`relative h-5 w-9 rounded-full transition ${on ? "bg-neon-purple" : "bg-white/10"}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${on ? "left-4" : "left-0.5"}`} />
      </span>
    </button>
  );
}
