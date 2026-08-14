import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/admin";
import { formatINR } from "@/lib/settings";
import { statusLabel } from "@/lib/orders";
import Link from "next/link";
import { Download } from "lucide-react";
import { RefreshButton } from "@/components/ui/refresh-button";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const user = await requireUser();
  const orders = await prisma.order.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { items: true },
  });

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-extrabold text-white">My Orders</h1>
        <RefreshButton label="Refresh" />
      </div>
      {orders.length === 0 ? (
        <div className="card p-10 text-center text-slate-400">
          No orders yet. <Link href="/shop" className="text-neon-purple">Start shopping</Link>.
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <div key={o.id} className="card p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <Link href={`/account/orders/${o.id}`} className="font-bold text-white hover:text-neon-blue">
                    {o.orderNumber}
                  </Link>
                  <div className="text-xs text-slate-400">
                    {new Date(o.createdAt).toLocaleString("en-IN")} · {o.items.length} items · {o.paymentMethod}
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-3">
                  <span className="chip bg-neon-purple/20 text-neon-purple">{statusLabel(o.status)}</span>
                  <span className="font-bold text-white">{formatINR(o.total)}</span>
                  <a
                    href={`/api/orders/${o.id}/invoice`}
                    target="_blank"
                    className="btn-ghost px-3 py-1.5 text-xs"
                  >
                    <Download className="h-3.5 w-3.5" /> Invoice
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
