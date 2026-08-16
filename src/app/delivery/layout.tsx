import Link from "next/link";
import { requireRole } from "@/lib/admin";
import { Bike } from "lucide-react";

export default async function DeliveryLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("STAFF", "ADMIN");
  return (
    <div className="min-h-screen bg-night-950">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-night-950/90 backdrop-blur-xl">
        <div className="mx-auto flex min-h-14 max-w-5xl items-center justify-between gap-2 px-3 py-2 sm:h-14 sm:px-4">
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-neon-purple to-neon-blue">
              <Bike className="h-5 w-5 text-white" />
            </span>
            <div>
              <div className="font-display text-sm font-extrabold tracking-wider text-white">DELIVERY</div>
              <div className="text-[10px] tracking-widest text-neon-purple">NIGHT CORNER</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {user.role === "ADMIN" && (
              <Link href="/admin" className="btn-ghost hidden px-3 py-1.5 text-xs sm:block">
                Admin Panel
              </Link>
            )}
            <Link href="/" className="btn-ghost px-2 py-1.5 text-xs sm:px-3">
              Store
            </Link>
            <Link href="/delivery/stats" className="btn-ghost px-2 py-1.5 text-xs text-neon-purple sm:px-3">
              My Stats
            </Link>
            <Link href="/api/auth/signout" className="btn-ghost px-2 py-1.5 text-xs text-rose-300 sm:px-3">
              Sign out
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6 sm:py-8">{children}</main>
    </div>
  );
}
