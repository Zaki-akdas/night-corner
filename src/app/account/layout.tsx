import Link from "next/link";
import { requireUser } from "@/lib/admin";
import {
  User,
  Package,
  MapPin,
  Heart,
  Settings,
  ShieldCheck,
} from "lucide-react";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";
  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="card h-fit p-4">
          <div className="mb-4 flex items-center gap-3 border-b border-white/10 p-2 pb-4">
            <div className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-neon-purple to-neon-blue font-bold text-white">
              {(user.name || "U")[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="truncate font-semibold text-white">{user.name}</div>
              <div className="truncate text-xs text-slate-400">{user.email}</div>
            </div>
          </div>
          <nav className="space-y-1">
            <SideLink href="/account" icon={<User className="h-4 w-4" />} label="Dashboard" exact />
            <SideLink href="/account/orders" icon={<Package className="h-4 w-4" />} label="My Orders" />
            <SideLink href="/account/addresses" icon={<MapPin className="h-4 w-4" />} label="Addresses" />
            <SideLink href="/account/wishlist" icon={<Heart className="h-4 w-4" />} label="Wishlist" />
            <SideLink href="/account/settings" icon={<Settings className="h-4 w-4" />} label="Account Settings" />
            {isAdmin && (
              <SideLink href="/admin" icon={<ShieldCheck className="h-4 w-4" />} label="Admin Panel" />
            )}
          </nav>
        </aside>
        <div>{children}</div>
      </div>
    </div>
  );
}

function SideLink({
  href,
  icon,
  label,
  exact,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  exact?: boolean;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-300 transition hover:bg-white/5 hover:text-white"
    >
      {icon}
      {label}
    </Link>
  );
}
