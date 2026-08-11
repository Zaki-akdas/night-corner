"use client";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Minus, Plus, Star, ShoppingCart } from "lucide-react";
import { useCart } from "@/components/cart/cart-context";
import { formatINR } from "@/lib/settings";
import type { Product } from "@prisma/client";
import { useOpenStatus } from "@/hooks/use-open-status";
import { useMemo, useState } from "react";

export function ProductCard({ product }: { product: Product }) {
  const { add, setQty, items } = useCart();
  const open = useOpenStatus();
  const inCart = items.find((i) => i.productId === product.id);
  const outOfStock = product.stock <= 0 || !product.active;
  const discountPct =
    product.mrp > product.price
      ? Math.round(((product.mrp - product.price) / product.mrp) * 100)
      : 0;
  const orderingDisabled = outOfStock || open?.isOpen === false;
  const [qty, setLocalQty] = useState(1);
  const [hoverIdx, setHoverIdx] = useState(0);

  const gallery = useMemo<string[]>(() => {
    if (!product.gallery) return [product.image];
    try {
      const arr = JSON.parse(product.gallery);
      return Array.isArray(arr) && arr.length ? arr : [product.image];
    } catch {
      return [product.image];
    }
  }, [product.gallery, product.image]);

  return (
    <motion.div
      whileHover={{ y: -6 }}
      transition={{ type: "spring", stiffness: 260, damping: 18 }}
      className="tilt group card relative overflow-hidden p-3"
      onMouseEnter={() => setHoverIdx(0)}
    >
      {product.bestSeller && (
        <div className="absolute left-3 top-3 z-10 chip bg-warm-yellow/90 text-night-900 shadow-neon-yellow">
          <Star className="h-3 w-3 fill-night-900" /> Best Seller
        </div>
      )}
      {discountPct > 0 && (
        <div
          className={`absolute z-10 chip bg-neon-purple/90 text-white shadow-neon ${
            product.bestSeller
              ? "left-3 top-[2.7rem] sm:left-auto sm:right-3 sm:top-3"
              : "right-3 top-3"
          }`}
        >
          {discountPct}% OFF
        </div>
      )}
      {outOfStock && (
        <div className="absolute inset-0 z-20 grid place-items-center rounded-2xl bg-night-950/70 backdrop-blur-sm">
          <span className="chip bg-rose-500/90 text-white">Out of Stock</span>
        </div>
      )}

      <Link href={`/shop/${product.slug}`} className="block">
        <div
          className="relative aspect-square overflow-hidden rounded-xl bg-night-900/60"
          style={{ perspective: "800px" }}
        >
          <div className="stars opacity-30" />
          <AnimatePresence mode="wait">
            <motion.div
              key={hoverIdx}
              initial={{ opacity: 0, rotateY: 25, scale: 0.9 }}
              animate={{ opacity: 1, rotateY: 0, scale: 1 }}
              exit={{ opacity: 0, rotateY: -25, scale: 0.9 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="absolute inset-0"
            >
              <Image
                src={gallery[hoverIdx]}
                alt={product.name}
                fill
                sizes="(max-width:768px) 50vw, 280px"
                className="object-contain p-4 transition-transform duration-500 group-hover:scale-110"
              />
            </motion.div>
          </AnimatePresence>
        </div>
      </Link>

      {/* thumbnail dots / mini gallery switcher */}
      {gallery.length > 1 && (
        <div className="mt-2 flex justify-center gap-1.5">
          {gallery.slice(0, 4).map((_, i) => (
            <button
              key={i}
              onMouseEnter={() => setHoverIdx(i)}
              onClick={() => setHoverIdx(i)}
              aria-label={`View image ${i + 1}`}
              className={`h-1.5 rounded-full transition-all ${
                i === hoverIdx
                  ? "w-6 bg-neon-purple shadow-neon"
                  : "w-1.5 bg-white/20 hover:bg-white/40"
              }`}
            />
          ))}
        </div>
      )}

      <div className="mt-2 px-1">
        <Link
          href={`/shop/${product.slug}`}
          className="line-clamp-1 font-semibold text-slate-100 hover:text-neon-blue"
        >
          {product.isVeg ? "🟢 " : "🔴 "}
          {product.name}
        </Link>
        <p className="mt-0.5 line-clamp-1 text-xs text-slate-400">{product.shortDesc}</p>

        <div className="mt-2 flex flex-wrap items-end gap-x-2 gap-y-0.5">
          <span className="text-lg font-bold text-white">{formatINR(product.price)}</span>
          {product.mrp > product.price && (
            <span className="pb-0.5 text-xs text-slate-500 line-through">{formatINR(product.mrp)}</span>
          )}
          <span className="ml-auto text-[11px] text-slate-500">{product.unit}</span>
        </div>

        {inCart ? (
          <div className="mt-3 flex items-center justify-between rounded-xl bg-night-900/80 p-1">
            <button
              onClick={() => setQty(product.id, inCart.quantity - 1)}
              className="grid h-9 w-9 place-items-center rounded-lg bg-white/5 text-white hover:bg-white/10"
              aria-label="Decrease quantity"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="font-semibold text-white">{inCart.quantity}</span>
            <button
              onClick={() => setQty(product.id, inCart.quantity + 1)}
              disabled={inCart.quantity >= product.stock}
              className="grid h-9 w-9 place-items-center rounded-lg bg-white/5 text-white hover:bg-white/10 disabled:opacity-40"
              aria-label="Increase quantity"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex items-center justify-center rounded-xl bg-night-900/80 p-1">
              <button
                onClick={() => setLocalQty((q) => Math.max(1, q - 1))}
                className="grid h-9 w-9 place-items-center rounded-lg text-slate-300 hover:bg-white/10"
                aria-label="Decrease quantity"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="w-6 text-center text-sm font-semibold text-white">{qty}</span>
              <button
                onClick={() => setLocalQty((q) => Math.min(product.stock, q + 1))}
                className="grid h-9 w-9 place-items-center rounded-lg text-slate-300 hover:bg-white/10"
                aria-label="Increase quantity"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            <button
              disabled={orderingDisabled}
              onClick={() =>
                add(
                  {
                    productId: product.id,
                    name: product.name,
                    slug: product.slug,
                    image: gallery[0],
                    unitPrice: product.price,
                    mrp: product.mrp,
                    maxStock: product.stock,
                    unit: product.unit,
                  },
                  qty
                )
              }
              className="btn-primary w-full px-3 py-2 text-sm sm:flex-1"
            >
              <ShoppingCart className="h-4 w-4" /> Add
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
