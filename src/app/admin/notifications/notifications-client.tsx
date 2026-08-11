"use client";
import { Bell, Check } from "lucide-react";
import { useRouter } from "next/navigation";

type N = { id: string; type: string; title: string; body: string; read: boolean; createdAt: string };

export function NotificationsClient({ initial }: { initial: N[] }) {
  const router = useRouter();
  const markAllRead = async () => {
    await fetch("/api/admin/notifications", { method: "POST" });
    router.refresh();
  };
  return (
    <div className="space-y-2">
      <button onClick={markAllRead} className="btn-ghost py-2 text-sm">
        <Check className="h-4 w-4" /> Mark all as read
      </button>
      {initial.length === 0 ? (
        <div className="card grid place-items-center p-10 text-slate-400">
          <Bell className="mb-2 h-8 w-8" /> No notifications yet.
        </div>
      ) : (
        initial.map((n) => (
          <div key={n.id} className={`card flex gap-3 p-4 ${n.read ? "opacity-60" : ""}`}>
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-neon-purple/20 text-neon-purple">
              <Bell className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold text-white">{n.title}</div>
                <div className="text-[11px] text-slate-500">
                  {new Date(n.createdAt).toLocaleString("en-IN")}
                </div>
              </div>
              <p className="text-sm text-slate-400">{n.body}</p>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
