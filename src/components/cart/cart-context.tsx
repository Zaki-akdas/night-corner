"use client";
import {
  createContext,
  use,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useToast } from "@/components/ui/toast";

export type CartItem = {
  productId: string;
  name: string;
  slug: string;
  image: string;
  unitPrice: number;
  mrp: number;
  quantity: number;
  maxStock: number;
  unit: string;
};

type CartCtx = {
  items: CartItem[];
  count: number;
  subtotal: number;
  add: (item: Omit<CartItem, "quantity">, qty?: number) => void;
  setQty: (productId: string, qty: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
};

const Ctx = createContext<CartCtx | null>(null);
const STORAGE_KEY = "nc_cart_v1";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const toast = useToast();

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {
      /* ignore */
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items, loaded]);

  // Keep local cart prices/stock in sync with server (cheap background refresh).
  useEffect(() => {
    if (!items.length) return;
    const sync = async () => {
      try {
        const res = await fetch("/api/cart/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })) }),
        });
        if (res.ok) {
          const data = (await res.json()) as { items: CartItem[] };
          setItems((prev) =>
            prev.map((p) => {
              const fresh = data.items.find((d) => d.productId === p.productId);
              return fresh ? { ...p, ...fresh } : p;
            })
          );
        }
      } catch {
        /* ignore */
      }
    };
    sync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  const add = useCallback<CartCtx["add"]>(
    (item, qty = 1) => {
      setItems((prev) => {
        const existing = prev.find((p) => p.productId === item.productId);
        if (existing) {
          const quantity = Math.min(item.maxStock, existing.quantity + qty);
          toast.push({ type: "success", message: `${item.name} updated in cart` });
          return prev.map((p) => (p.productId === item.productId ? { ...p, quantity } : p));
        }
        toast.push({ type: "success", message: `${item.name} added to cart 🌙` });
        return [...prev, { ...item, quantity: Math.min(item.maxStock, qty) }];
      });
    },
    [toast]
  );

  const setQty = useCallback<CartCtx["setQty"]>((productId, qty) => {
    setItems((prev) =>
      prev
        .map((p) =>
          p.productId === productId
            ? { ...p, quantity: Math.max(0, Math.min(p.maxStock, qty)) }
            : p
        )
        .filter((p) => p.quantity > 0)
    );
  }, []);

  const remove = useCallback<CartCtx["remove"]>(
    (productId) => {
      setItems((prev) => prev.filter((p) => p.productId !== productId));
      toast.push({ type: "info", message: "Item removed from cart" });
    },
    [toast]
  );

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo<CartCtx>(
    () => ({
      items,
      count: items.reduce((n, i) => n + i.quantity, 0),
      subtotal: items.reduce((n, i) => n + i.unitPrice * i.quantity, 0),
      add,
      setQty,
      remove,
      clear,
    }),
    [items, add, setQty, remove, clear]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
