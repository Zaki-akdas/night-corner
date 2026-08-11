"use client";
import { Minus, Plus, ShoppingCart, Zap, Heart } from "lucide-react";
import { useState } from "react";
import { useCart } from "@/components/cart/cart-context";
import { useToast } from "@/components/ui/toast";
import { useOpenStatus } from "@/hooks/use-open-status";
import { useRouter } from "next/navigation";
import type { Product } from "@prisma/client";

export function ProductDetailClient({ product }: { product: Product }) {
  const [qty, setQty] = useState(1);
  const { add } = useCart();
  const open = useOpenStatus();
  const toast = useToast();
  const router = useRouter();
  const outOfStock = product.stock <= 0 || !product.active;
  const disabled = outOfStock || open?.isOpen === false;

  const addToCart = () => {
    if (disabled) return;
    add(
      {
        productId: product.id,
        name: product.name,
        slug: product.slug,
        image: product.image,
        unitPrice: product.price,
        mrp: product.mrp,
        maxStock: product.stock,
        unit: product.unit,
      },
      qty
    );
  };

  const buyNow = () => {
    addToCart();
    router.push("/checkout");
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center rounded-xl bg-night-900/80 p-1 ring-1 ring-white/10">
          <button
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            className="grid h-11 w-11 place-items-center rounded-lg text-slate-200 hover:bg-white/10"
            aria-label="Decrease"
          >
            <Minus className="h-5 w-5" />
          </button>
          <span className="w-10 text-center text-lg font-bold text-white">{qty}</span>
          <button
            onClick={() => setQty((q) => Math.min(product.stock, q + 1))}
            disabled={qty >= product.stock}
            className="grid h-11 w-11 place-items-center rounded-lg text-slate-200 hover:bg-white/10 disabled:opacity-40"
            aria-label="Increase"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>
        <button
          onClick={addToCart}
          disabled={disabled}
          className="btn-primary min-w-0 flex-1 whitespace-nowrap px-4 py-3 text-sm sm:px-5 sm:text-base"
        >
          <ShoppingCart className="h-5 w-5" /> Add to Cart
        </button>
        <button
          onClick={buyNow}
          disabled={disabled}
          className="btn-warm w-full py-3 text-base sm:w-auto"
        >
          <Zap className="h-5 w-5" /> Buy Now
        </button>
      </div>
      <button
        onClick={() => toast.push({ type: "info", message: "Sign in to save your wishlist" })}
        className="mt-3 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-neon-pink"
      >
        <Heart className="h-4 w-4" /> Add to wishlist
      </button>
      {open?.isOpen === false && (
        <p className="mt-3 rounded-xl border border-warm-yellow/30 bg-warm-yellow/10 p-3 text-sm text-warm-yellow">
          🌙 Ordering is closed right now. You can browse, but checkout opens at 10 PM.
        </p>
      )}
    </div>
  );
}
