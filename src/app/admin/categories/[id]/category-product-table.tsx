"use client";
import { useState, useMemo } from "react";
import { Search, ArrowUpDown, ChevronUp, ChevronDown } from "lucide-react";
import { CategoryProductRow } from "./category-product-row";

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

type SortKey = "name-asc" | "name-desc" | "price-asc" | "price-desc" | "stock-asc" | "stock-desc" | "newest" | "oldest";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "name-asc", label: "Name A→Z" },
  { value: "name-desc", label: "Name Z→A" },
  { value: "price-asc", label: "Price low→high" },
  { value: "price-desc", label: "Price high→low" },
  { value: "stock-asc", label: "Stock low→high" },
  { value: "stock-desc", label: "Stock high→low" },
];

export function CategoryProductTable({
  products,
  totalCount,
  categories,
}: {
  products: Product[];
  totalCount: number;
  categories: { id: string; name: string }[];
}) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    let list = q
      ? products.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.sku.toLowerCase().includes(q)
        )
      : [...products];

    list.sort((a, b) => {
      switch (sort) {
        case "name-asc":
          return a.name.localeCompare(b.name);
        case "name-desc":
          return b.name.localeCompare(a.name);
        case "price-asc":
          return a.price - b.price;
        case "price-desc":
          return b.price - a.price;
        case "stock-asc":
          return a.stock - b.stock;
        case "stock-desc":
          return b.stock - a.stock;
        default:
          return 0; // newest/oldest keeps server order
      }
    });

    return list;
  }, [products, search, sort]);

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search by name or SKU…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-9 text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <ArrowUpDown className="h-4 w-4 text-slate-500" />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="input py-1.5 text-sm"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <span className="text-xs text-slate-500">
          {filtered.length === totalCount
            ? `${totalCount} product${totalCount !== 1 ? "s" : ""}`
            : `${filtered.length} of ${totalCount} product${totalCount !== 1 ? "s" : ""}`}
        </span>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="card flex flex-col items-center justify-center p-8 text-center">
          <p className="text-sm text-slate-400">
            No products match "<span className="text-white">{search}</span>"
          </p>
        </div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-left text-xs uppercase tracking-wider text-slate-400">
              <tr>
                <th className="p-3">Product</th>
                <th className="p-3">Price</th>
                <th className="p-3">MRP</th>
                <th className="p-3">Stock</th>
                <th className="p-3">Category</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <CategoryProductRow key={p.id} product={p} categories={categories} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
