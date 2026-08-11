import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { formatINR } from "@/lib/settings";
import Link from "next/link";
import Image from "next/image";
import { Plus } from "lucide-react";
import { ProductRowActions } from "./row-actions";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  await requireAdmin();
  const products = await prisma.product.findMany({
    orderBy: { createdAt: "desc" },
    include: { category: true },
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-white">Products</h1>
          <p className="text-slate-400">{products.length} products · prices & stock editable</p>
        </div>
        <Link href="/admin/products/new" className="btn-primary py-2 text-sm">
          <Plus className="h-4 w-4" /> Add Product
        </Link>
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-left text-xs uppercase tracking-wider text-slate-400">
            <tr>
              <th className="p-3">Product</th>
              <th className="p-3">Category</th>
              <th className="p-3">Price</th>
              <th className="p-3">MRP</th>
              <th className="p-3">Stock</th>
              <th className="p-3">Status</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-t border-white/5 hover:bg-white/[0.03]">
                <td className="p-3">
                  <div className="flex items-center gap-3">
                    <div className="relative h-10 w-10 overflow-hidden rounded-lg bg-night-900/60">
                      <Image src={p.image} alt={p.name} fill className="object-contain p-1" />
                    </div>
                    <div>
                      <Link href={`/admin/products/${p.id}`} className="font-semibold text-white hover:text-neon-blue">
                        {p.name}
                      </Link>
                      <div className="text-xs text-slate-500">{p.sku}</div>
                    </div>
                  </div>
                </td>
                <td className="p-3 text-slate-300">{p.category.name}</td>
                <td className="p-3 font-semibold text-white">{formatINR(p.price)}</td>
                <td className="p-3 text-slate-400 line-through">{formatINR(p.mrp)}</td>
                <td className="p-3">
                  <span className={p.stock === 0 ? "text-rose-400" : p.stock <= p.lowStockAt ? "text-amber-400" : "text-slate-300"}>
                    {p.stock}
                  </span>
                </td>
                <td className="p-3">
                  {p.active ? (
                    <span className="chip bg-emerald-500/20 text-emerald-300">Active</span>
                  ) : (
                    <span className="chip bg-rose-500/20 text-rose-300">Hidden</span>
                  )}
                </td>
                <td className="p-3">
                  <ProductRowActions id={p.id} active={p.active} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
