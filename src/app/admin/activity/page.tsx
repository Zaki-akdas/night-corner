import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

export default async function ActivityPage() {
  await requireAdmin();
  const logs = await prisma.activityLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-extrabold text-white">Activity Logs</h1>
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-left text-xs uppercase tracking-wider text-slate-400">
            <tr>
              <th className="p-3">When</th>
              <th className="p-3">User</th>
              <th className="p-3">Action</th>
              <th className="p-3">Entity</th>
              <th className="p-3">IP</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} className="border-t border-white/5">
                <td className="p-3 text-xs text-slate-400">{l.createdAt.toLocaleString("en-IN")}</td>
                <td className="p-3 text-slate-200">{l.userName ?? "—"}</td>
                <td className="p-3">
                  <span className="chip bg-neon-purple/20 text-neon-purple">{l.action}</span>
                </td>
                <td className="p-3 text-slate-400">{l.entity}{l.entityId ? ` · ${l.entityId.slice(0, 8)}` : ""}</td>
                <td className="p-3 text-xs text-slate-500">{l.ip ?? "—"}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr><td colSpan={5} className="p-10 text-center text-slate-400">No activity logged yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
