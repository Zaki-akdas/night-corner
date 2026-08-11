"use client";
import { useSession, signOut } from "next-auth/react";
import { Bell, LogOut, Search } from "lucide-react";
import { useEffect, useState } from "react";
import Link from "next/link";

export function AdminTopbar({ user }: { user: { name: string; email: string } }) {
  const { data: session } = useSession();
  const [notifCount, setNotifCount] = useState(0);
  useEffect(() => {
    fetch("/api/admin/notifications?unread=1")
      .then((r) => r.json())
      .then((d) => setNotifCount(d.count ?? 0))
      .catch(() => {});
  }, []);
  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-white/10 bg-night-950/70 px-4 py-3 backdrop-blur-xl sm:px-6">
      <div className="relative hidden max-w-md flex-1 sm:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input className="input pl-9" placeholder="Search orders, products, customers..." />
      </div>
      <div className="ml-auto flex items-center gap-2">
        <Link href="/admin/notifications" className="relative btn-ghost h-10 w-10 rounded-xl p-0">
          <Bell className="h-5 w-5" />
          {notifCount > 0 && (
            <span className="absolute -right-1 -top-1 grid h-4 min-w-[16px] place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
              {notifCount}
            </span>
          )}
        </Link>
        <div className="hidden text-right sm:block">
          <div className="text-sm font-semibold text-white">{session?.user?.name || user.name}</div>
          <div className="text-xs text-slate-400">Administrator</div>
        </div>
        <button onClick={() => signOut({ callbackUrl: "/" })} className="btn-ghost h-10 w-10 rounded-xl p-0" title="Sign out">
          <LogOut className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}
