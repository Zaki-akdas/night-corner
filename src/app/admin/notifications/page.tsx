import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { NotificationsClient } from "./notifications-client";
import { RefreshButton } from "@/components/ui/refresh-button";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  await requireAdmin();
  const notifications = await prisma.notification.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-extrabold text-white">Notifications</h1>
        <RefreshButton label="Refresh notifications" />
      </div>
      <NotificationsClient
        initial={notifications.map((n) => ({
          id: n.id,
          type: n.type,
          title: n.title,
          body: n.body,
          read: n.read,
          createdAt: n.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
