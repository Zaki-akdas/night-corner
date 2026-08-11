import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { InventoryControls } from "./inventory-controls";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  await requireAdmin();
  const products = await prisma.product.findMany({
    orderBy: { stock: "asc" },
    include: { category: true },
  });
  const lowStock = products.filter((p) => p.stock <= p.lowStockAt);
  const outOfStock = products.filter((p) => p.stock === 0);

  const rows = products.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    category: p.category.name,
    stock: p.stock,
    startingStock: p.startingStock,
    sold: p.sold,
    lowStockAt: p.lowStockAt,
  }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-white">Inventory</h1>
        <p className="text-slate-400">
          {products.length} products · {lowStock.length} low · {outOfStock.length} out of stock
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Total products" value={products.length} />
        <Stat label="In stock" value={products.filter((p) => p.stock > p.lowStockAt).length} tone="ok" />
        <Stat label="Low stock" value={lowStock.length} tone="warn" />
        <Stat label="Out of stock" value={outOfStock.length} tone="bad" />
      </div>

      <InventoryControls rows={rows} />
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "ok" | "warn" | "bad" }) {
  const color = tone === "ok" ? "text-emerald-300" : tone === "warn" ? "text-amber-300" : tone === "bad" ? "text-rose-300" : "text-white";
  return (
    <div className="card p-4">
      <div className={`text-2xl font-extrabold ${color}`}>{value}</div>
      <div className="text-xs text-slate-400">{label}</div>
    </div>
  );
}
