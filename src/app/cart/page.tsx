"use client";
import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight, Moon } from "lucide-react";
import { useCart } from "@/components/cart/cart-context";
import { formatINR } from "@/lib/settings";
import { useOpenStatus } from "@/hooks/use-open-status";

export default function CartPage() {
  const { items, setQty, remove, subtotal, clear } = useCart();
  const open = useOpenStatus();

  if (items.length === 0) {
    return (
      <div className="mx-auto grid min-h-[60vh] max-w-md place-items-center px-4 text-center">
        <div>
          <div className="mb-4 text-6xl">🛒🌙</div>
          <h1 className="font-display text-2xl font-bold text-white">Your cart is waiting for some midnight essentials</h1>
          <p className="mt-2 text-slate-400">Browse tonight&apos;s collection and add your favourites.</p>
          <Link href="/shop" className="btn-primary mt-6">
            <ShoppingBag className="h-5 w-5" /> Start Shopping
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="mb-6 font-display text-3xl font-extrabold text-white">Your Cart</h1>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-3">
          {items.map((item) => {
            const lineDiscount = (item.mrp - item.unitPrice) * item.quantity;
            return (
              <div key={item.productId} className="card flex gap-3 p-3 sm:gap-4">
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-night-900/60 sm:h-24 sm:w-24">
                  <Image src={item.image} alt={item.name} fill className="object-contain p-1" />
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <Link href={`/shop/${item.slug}`} className="truncate font-semibold text-white hover:text-neon-blue">
                      {item.name}
                    </Link>
                    <button onClick={() => remove(item.productId)} className="shrink-0 text-slate-400 hover:text-rose-400" aria-label="Remove">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="text-xs text-slate-400">{item.unit}</div>
                  <div className="mt-auto flex items-center justify-between pt-2">
                    <div className="flex items-center rounded-lg bg-night-900/80 p-0.5 ring-1 ring-white/10">
                      <button onClick={() => setQty(item.productId, item.quantity - 1)} className="grid h-8 w-8 place-items-center text-slate-200 hover:bg-white/10">
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-8 text-center text-sm font-semibold text-white">{item.quantity}</span>
                      <button onClick={() => setQty(item.productId, item.quantity + 1)} disabled={item.quantity >= item.maxStock} className="grid h-8 w-8 place-items-center text-slate-200 hover:bg-white/10 disabled:opacity-40">
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-white">{formatINR(item.unitPrice * item.quantity)}</div>
                      {lineDiscount > 0 && (
                        <div className="text-xs text-emerald-400">Save {formatINR(lineDiscount)}</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          <button onClick={clear} className="text-sm text-slate-400 hover:text-rose-400">
            Clear cart
          </button>
        </div>

        <aside className="card h-fit p-5">
          <h2 className="mb-4 font-display text-lg font-bold text-white">Order Summary</h2>
          <Row label="Subtotal" value={formatINR(subtotal)} />
          <p className="mt-1 text-xs text-slate-400">
            Delivery & taxes calculated at checkout based on your location.
          </p>
          {open?.isOpen === false && (
            <div className="mt-3 rounded-xl border border-warm-yellow/30 bg-warm-yellow/10 p-3 text-sm text-warm-yellow">
              <Moon className="mr-1 inline h-4 w-4" /> Ordering is closed. You can prepare your cart and check out at 10 PM.
            </div>
          )}
          <Link href="/checkout" className="btn-primary mt-5 w-full">
            Proceed to Checkout <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/shop" className="mt-2 block text-center text-sm text-slate-400 hover:text-white">
            Continue shopping
          </Link>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-white/5 py-2 text-sm">
      <span className="text-slate-300">{label}</span>
      <span className="font-semibold text-white">{value}</span>
    </div>
  );
}
