"use client";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { SlidersHorizontal, X } from "lucide-react";
import { useState } from "react";

type Cat = { slug: string; name: string };

export function ShopFilters({
  categories,
  active,
}: {
  categories: Cat[];
  active: Record<string, string | undefined>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);
  const [min, setMin] = useState(active.min ?? "");
  const [max, setMax] = useState(active.max ?? "");

  const set = (key: string, value?: string) => {
    const sp = new URLSearchParams(params?.toString());
    if (value === undefined || value === "") sp.delete(key);
    else sp.set(key, value);
    router.push(`${pathname}?${sp.toString()}`);
  };

  const clear = () => router.push(pathname);

  const panel = (
    <div className="space-y-6">
      <div>
        <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">Category</h3>
        <div className="space-y-1">
          <button
            onClick={() => set("category", undefined)}
            className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${
              !active.category ? "bg-neon-purple/20 text-white" : "text-slate-300 hover:bg-white/5"
            }`}
          >
            All Categories
          </button>
          {categories.map((c) => (
            <button
              key={c.slug}
              onClick={() => set("category", c.slug)}
              className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${
                active.category === c.slug
                  ? "bg-neon-purple/20 text-white"
                  : "text-slate-300 hover:bg-white/5"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">Price Range</h3>
        <div className="flex gap-2">
          <input
            type="number"
            placeholder="Min"
            value={min}
            onChange={(e) => setMin(e.target.value)}
            className="input py-2 text-sm"
          />
          <input
            type="number"
            placeholder="Max"
            value={max}
            onChange={(e) => setMax(e.target.value)}
            className="input py-2 text-sm"
          />
        </div>
        <button
          onClick={() => {
            set("min", min || undefined);
            set("max", max || undefined);
          }}
          className="btn-ghost mt-2 w-full py-2 text-sm"
        >
          Apply
        </button>
      </div>

      <div>
        <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">Sort By</h3>
        <select
          value={active.sort ?? "newest"}
          onChange={(e) => set("sort", e.target.value)}
          className="input py-2 text-sm"
        >
          <option value="newest">Newest</option>
          <option value="popular">Popularity</option>
          <option value="price-asc">Price: Low to High</option>
          <option value="price-desc">Price: High to Low</option>
        </select>
      </div>

      <div className="space-y-2">
        <Toggle label="In stock only" on={active.available === "1"} onClick={() => set("available", active.available === "1" ? undefined : "1")} />
        <Toggle label="Discounted items" on={active.discount === "1"} onClick={() => set("discount", active.discount === "1" ? undefined : "1")} />
        <Toggle label="Veg only" on={active.veg === "1"} onClick={() => set("veg", active.veg === "1" ? undefined : "1")} />
      </div>

      <button onClick={clear} className="btn-ghost w-full py-2 text-sm">
        <X className="h-4 w-4" /> Clear all filters
      </button>
    </div>
  );

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="btn-ghost mb-4 w-full lg:hidden"
      >
        <SlidersHorizontal className="h-4 w-4" /> Filters & Sort
      </button>
      <aside className="hidden lg:block">
        <div className="card sticky top-28 p-5">{panel}</div>
      </aside>
      {open && (
        <div className="fixed inset-0 z-[80] lg:hidden">
          <div className="absolute inset-0 bg-night-950/80 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="absolute bottom-0 left-0 right-0 max-h-[85vh] overflow-auto rounded-t-3xl border-t border-white/10 bg-night-900 p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-bold text-white">Filters & Sort</h2>
              <button onClick={() => setOpen(false)}><X className="h-5 w-5 text-slate-400" /></button>
            </div>
            {panel}
          </div>
        </div>
      )}
    </>
  );
}

function Toggle({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-sm ${
        on ? "border-neon-purple bg-neon-purple/10 text-white" : "border-white/10 text-slate-300"
      }`}
    >
      <span>{label}</span>
      <span
        className={`relative h-5 w-9 rounded-full transition ${
          on ? "bg-neon-purple" : "bg-white/10"
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${
            on ? "left-4" : "left-0.5"
          }`}
        />
      </span>
    </button>
  );
}
