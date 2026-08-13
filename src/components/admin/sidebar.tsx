"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  Layers,
  Boxes,
  Users,
  Ticket,
  Truck,
  BarChart3,
  Bell,
  Star,
  Settings,
  UserCog,
  ScrollText,
  X,
} from "lucide-react";
import { useState } from "react";

const LINKS = [
  { href: "/admin", icon: LayoutDashboard, label: "Dashboard", exact: true },
  { href: "/admin/orders", icon: ShoppingBag, label: "Orders" },
  { href: "/admin/products", icon: Package, label: "Products" },
  { href: "/admin/categories", icon: Layers, label: "Categories" },
  { href: "/admin/inventory", icon: Boxes, label: "Inventory" },
  { href: "/admin/customers", icon: Users, label: "Customers" },
  { href: "/admin/coupons", icon: Ticket, label: "Coupons" },
  { href: "/admin/delivery", icon: Truck, label: "Delivery" },
  { href: "/admin/analytics", icon: BarChart3, label: "Analytics" },
  { href: "/admin/notifications", icon: Bell, label: "Notifications" },
  { href: "/admin/reviews", icon: Star, label: "Reviews" },
  { href: "/admin/settings", icon: Settings, label: "Settings" },
  { href: "/admin/users", icon: UserCog, label: "Admin Users" },
  { href: "/admin/activity", icon: ScrollText, label: "Activity Logs" },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="btn-ghost fixed left-4 top-20 z-40 lg:hidden"
      >
        ☰ Menu
      </button>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-night-950/80" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-72 overflow-auto bg-night-900 p-4">
            <div className="mb-4 flex items-center justify-between">
              <Brand />
              <button onClick={() => setOpen(false)}><X className="h-5 w-5 text-slate-400" /></button>
            </div>
            <NavList pathname={pathname} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
      <aside className="sticky top-0 hidden h-screen border-r border-white/10 bg-night-950/80 p-4 backdrop-blur-xl lg:block">
        <Brand />
        <div className="mt-6 overflow-auto">
          <NavList pathname={pathname} />
        </div>
      </aside>
    </>
  );
}

function Brand() {
  return (
    <Link href="/admin" className="flex flex-col gap-1">
      <Image
        src="/logo.png"
        alt="Night Corner"
        width={172}
        height={45}
        className="h-9 w-auto"
      />
      <span className="text-[10px] tracking-widest text-neon-purple">ADMIN PANEL</span>
    </Link>
  );
}

function NavList({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="space-y-1">
      {LINKS.map((l) => {
        const active = l.exact ? pathname === l.href : pathname.startsWith(l.href);
        const Icon = l.icon;
        return (
          <Link
            key={l.href}
            href={l.href}
            onClick={onNavigate}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
              active
                ? "bg-gradient-to-r from-neon-purple/30 to-neon-blue/20 text-white ring-1 ring-neon-purple/40"
                : "text-slate-400 hover:bg-white/5 hover:text-white"
            }`}
          >
            <Icon className="h-4 w-4" />
            {l.label}
          </Link>
        );
      })}
      <Link href="/delivery" className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-neon-blue/20 to-neon-purple/20 px-3 py-2 text-center text-xs text-white ring-1 ring-neon-blue/30 hover:bg-neon-blue/20">
        <Truck className="h-4 w-4" /> Delivery Dashboard
      </Link>
      <Link href="/" className="mt-2 block rounded-xl border border-white/10 px-3 py-2 text-center text-xs text-slate-400 hover:bg-white/5">
        ← Back to store
      </Link>
    </nav>
  );
}
