"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Heart } from "lucide-react";
import { ProductCard } from "@/components/product-card";
import { RefreshButton } from "@/components/ui/refresh-button";
import type { Product } from "@prisma/client";

export default function WishlistPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const load = useCallback(() => {
    fetch("/api/account/wishlist")
      .then((r) => r.json())
      .then(setProducts)
      .catch(() => {});
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold text-white">
          <Heart className="h-6 w-6 text-neon-pink" /> My Wishlist
        </h1>
        <RefreshButton label="Refresh" onRefresh={load} />
      </div>
      {products.length === 0 ? (
        <div className="card p-10 text-center text-slate-400">
          Your wishlist is empty. <Link href="/shop" className="text-neon-purple">Discover products</Link>.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
