"use client";
import Link from "next/link";
import Image from "next/image";
import { useSession, signOut } from "next-auth/react";
import {
  ShoppingCart,
  Search,
  User,
  Menu,
  X,
  Moon,
  MapPin,
  ChevronDown,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useCart } from "@/components/cart/cart-context";
import { useOpenStatus } from "@/hooks/use-open-status";
import { fmtCountdown, fmtTime } from "@/lib/hours";
import { useRouter } from "next/navigation";
import type { AppSettings } from "@/lib/settings";
import { ThemeSwitcher } from "@/components/theme-switcher";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/shop", label: "Shop" },
  { href: "/categories", label: "Categories" },
  { href: "/shop?sort=popular", label: "Best Sellers" },
  { href: "/track-order", label: "Track Order" },
];

export function Header({ settings }: { settings: AppSettings }) {
  const { data: session } = useSession();
  const { count } = useCart();
  const open = useOpenStatus();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [suggestions, setSuggestions] = useState<{ name: string; slug: string }[]>([]);
  const acRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (acRef.current && !acRef.current.contains(e.target as Node)) setAccountOpen(false);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  useEffect(() => {
    if (search.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(search)}`);
        const data = await res.json();
        setSuggestions(data.products?.slice(0, 6) ?? []);
      } catch {
        /* ignore */
      }
    }, 180);
    return () => clearTimeout(t);
  }, [search]);

  const doSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) router.push(`/shop?q=${encodeURIComponent(search.trim())}`);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-night-950/70 backdrop-blur-2xl">
      {/* status bar */}
      <div
        className={`flex items-center justify-center gap-2 px-4 py-1.5 text-center text-xs font-medium ${
          open?.isOpen
            ? "bg-emerald-500/10 text-emerald-300"
            : "bg-amber-500/10 text-amber-300"
        }`}
      >
        <Moon className="hidden h-3.5 w-3.5 shrink-0 sm:block" />
        {open?.isOpen ? (
          <span className="min-w-0 truncate">
            Open now · ordering until {open.closeTime ? fmtTime(open.closeTime) : "6 AM"}
            <span className="hidden sm:inline"> · within {settings.maxRadiusKm} KM</span>
          </span>
        ) : open ? (
          <span className="min-w-0 truncate">
            🌙 Night ordering is closed · opens in {fmtCountdown(open.secondsUntilChange)}
            <span className="hidden sm:inline"> · {open.nextWindowLabel}</span>
          </span>
        ) : (
          <span className="min-w-0 truncate">Open 10 PM – 6 AM · within {settings.maxRadiusKm} KM</span>
        )}
      </div>

      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 lg:gap-6">
        <Link href="/" className="flex shrink-0 items-center">
          <Image
            src="/logo.png"
            alt="Night Corner"
            width={172}
            height={45}
            className="h-9 w-auto drop-shadow-neon sm:h-11"
            loading="eager"
          />
        </Link>

        {/* desktop search */}
        <form onSubmit={doSearch} className="relative ml-auto hidden max-w-md flex-1 lg:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Maggi, chocolate, drinks..."
            className="input pl-9"
          />
          {suggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-white/10 bg-night-900/95 shadow-2xl backdrop-blur-xl">
              {suggestions.map((s) => (
                <Link
                  key={s.slug}
                  href={`/shop/${s.slug}`}
                  onClick={() => {
                    setSearch("");
                    setSuggestions([]);
                  }}
                  className="block border-b border-white/5 px-4 py-2.5 text-sm text-slate-200 hover:bg-white/5"
                >
                  {s.name}
                </Link>
              ))}
            </div>
          )}
        </form>

        <nav className="ml-auto hidden items-center gap-1 lg:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/5 hover:text-white"
            >
              {n.label}
            </Link>
          ))}
        </nav>

        {/* account */}
        <div className="relative ml-auto" ref={acRef}>
          <button
            onClick={() => setAccountOpen((o) => !o)}
            className="btn-ghost h-10 w-10 rounded-xl p-0 lg:h-auto lg:w-auto lg:px-3"
            aria-label="Account"
          >
            <User className="h-5 w-5" />
            <span className="hidden lg:inline">{session?.user?.name?.split(" ")[0] || "Account"}</span>
            <ChevronDown className="hidden h-4 w-4 lg:inline" />
          </button>
          {accountOpen && (
            <div className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-white/10 bg-night-900/95 p-2 shadow-2xl backdrop-blur-xl">
              {session ? (
                <>
                  <div className="border-b border-white/10 px-3 py-2">
                    <div className="text-sm font-semibold text-white">{session.user.name}</div>
                    <div className="text-xs text-slate-400">{session.user.email}</div>
                  </div>
                  <MenuLink href="/account" onClick={() => setAccountOpen(false)}>My Account</MenuLink>
                  <MenuLink href="/account/orders" onClick={() => setAccountOpen(false)}>My Orders</MenuLink>
                  <MenuLink href="/account/addresses" onClick={() => setAccountOpen(false)}>Addresses</MenuLink>
                  <MenuLink href="/account/wishlist" onClick={() => setAccountOpen(false)}>Wishlist</MenuLink>
                  {["ADMIN", "STAFF"].includes((session.user as { role?: string }).role ?? "") && (
                    <MenuLink href="/delivery" onClick={() => setAccountOpen(false)}>Delivery Dashboard</MenuLink>
                  )}
                  {(session.user as { role?: string }).role === "ADMIN" && (
                    <MenuLink href="/admin" onClick={() => setAccountOpen(false)}>Admin Panel</MenuLink>
                  )}
                  <button
                    onClick={() => signOut({ callbackUrl: "/" })}
                    className="block w-full rounded-lg px-3 py-2 text-left text-sm text-rose-300 hover:bg-white/5"
                  >
                    Sign out
                  </button>
                </>
              ) : (
                <>
                  <Link href="/login" onClick={() => setAccountOpen(false)} className="block rounded-lg px-3 py-2 text-sm text-slate-200 hover:bg-white/5">
                    Login
                  </Link>
                  <Link href="/signup" onClick={() => setAccountOpen(false)} className="block rounded-lg px-3 py-2 text-sm text-slate-200 hover:bg-white/5">
                    Sign up
                  </Link>
                </>
              )}
            </div>
          )}
        </div>

        <ThemeSwitcher />

        <Link href="/cart" className="btn-ghost relative h-10 w-10 rounded-xl p-0">
          <ShoppingCart className="h-5 w-5" />
          {count > 0 && (
            <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-[20px] place-items-center rounded-full bg-neon-purple px-1 text-[11px] font-bold text-white shadow-neon">
              {count}
            </span>
          )}
        </Link>

        <button
          onClick={() => setMobileOpen((o) => !o)}
          className="btn-ghost h-10 w-10 rounded-xl p-0 lg:hidden"
          aria-label="Menu"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* mobile menu */}
      {mobileOpen && (
        <div className="border-t border-white/10 bg-night-900/95 px-4 py-4 backdrop-blur-xl lg:hidden">
          <form onSubmit={doSearch} className="relative mb-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products..."
              className="input pl-9"
            />
          </form>
          <div className="grid gap-1">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-lg px-3 py-2.5 text-slate-200 hover:bg-white/5"
              >
                {n.label}
              </Link>
            ))}
            <Link
              href="/categories"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-slate-200 hover:bg-white/5"
            >
              <MapPin className="h-4 w-4" /> Delivery Area
            </Link>
            {session ? (
              <>
                <Link href="/account" onClick={() => setMobileOpen(false)} className="rounded-lg px-3 py-2.5 text-slate-200 hover:bg-white/5">
                  My Account
                </Link>
                {["ADMIN", "STAFF"].includes((session.user as { role?: string }).role ?? "") && (
                  <Link href="/delivery" onClick={() => setMobileOpen(false)} className="rounded-lg px-3 py-2.5 text-slate-200 hover:bg-white/5">
                    Delivery Dashboard
                  </Link>
                )}
                {(session.user as { role?: string }).role === "ADMIN" && (
                  <Link href="/admin" onClick={() => setMobileOpen(false)} className="rounded-lg px-3 py-2.5 text-slate-200 hover:bg-white/5">
                    Admin Panel
                  </Link>
                )}
              </>
            ) : (
              <Link href="/login" onClick={() => setMobileOpen(false)} className="rounded-lg px-3 py-2.5 text-slate-200 hover:bg-white/5">
                Login / Sign up
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

function MenuLink({ href, children, onClick }: { href: string; children: React.ReactNode; onClick?: () => void }) {
  return (
    <Link href={href} onClick={onClick} className="block rounded-lg px-3 py-2 text-sm text-slate-200 hover:bg-white/5">
      {children}
    </Link>
  );
}
