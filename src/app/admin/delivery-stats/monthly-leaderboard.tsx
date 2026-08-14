"use client";
import { useMemo, useState } from "react";
import { Star, Timer, PackageCheck, Trophy } from "lucide-react";

type Staff = { id: string; name: string | null };
type Delivered = {
  id: string;
  orderNumber: string;
  assignedTo: string | null;
  assignedToName: string | null;
  createdAt: string;
  updatedAt: string;
  outForDeliveryAt: string | null;
  deliveredAt: string | null;
  deliveryRating: number | null;
};

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function minutesBetween(a: string | null, b: string | null, fallbackFrom: string, fallbackTo: string): number {
  const from = a ? new Date(a).getTime() : new Date(fallbackFrom).getTime();
  const to = b ? new Date(b).getTime() : new Date(fallbackTo).getTime();
  return Math.max(0, (to - from) / 60000);
}

export function MonthlyLeaderboard({ staff, orders }: { staff: Staff[]; orders: Delivered[] }) {
  const months = useMemo(() => {
    const now = new Date();
    const list: { key: string; label: string }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      list.push({ key: monthKey(d), label: d.toLocaleDateString("en-IN", { month: "short", year: "numeric" }) });
    }
    return list;
  }, []);
  const [month, setMonth] = useState(months[months.length - 1].key);

  const rows = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const start = new Date(y, m - 1, 1).getTime();
    const end = new Date(y, m, 1).getTime();
    const mine = orders.filter((o) => {
      const d = o.deliveredAt ? new Date(o.deliveredAt).getTime() : 0;
      return d >= start && d < end;
    });

    const per = staff.map((s) => {
      const my = mine.filter((o) => o.assignedTo === s.id);
      const delivered = my.length;
      const times = my.map((o) => minutesBetween(o.outForDeliveryAt, o.deliveredAt, o.createdAt, o.updatedAt));
      const ratings = my.filter((o) => o.deliveryRating != null).map((o) => o.deliveryRating as number);
      return {
        id: s.id,
        name: s.name || "Delivery Staff",
        delivered,
        avgMin: times.length ? times.reduce((a, b) => a + b, 0) / times.length : null,
        avgRating: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null,
        ratings: ratings.length,
      };
    });

    const maxVol = Math.max(1, ...per.map((r) => r.delivered));
    const avgTimes = per.map((r) => r.avgMin).filter((v): v is number => v != null);
    const avgRatings = per.map((r) => r.avgRating).filter((v): v is number => v != null);
    const minT = avgTimes.length ? Math.min(...avgTimes) : 0;
    const maxT = avgTimes.length ? Math.max(...avgTimes) : 0;
    const minR = avgRatings.length ? Math.min(...avgRatings) : 0;
    const maxR = avgRatings.length ? Math.max(...avgRatings) : 0;

    const scored = per.map((r) => {
      const volumeScore = (r.delivered / maxVol) * 100;
      const speedScore = r.avgMin == null ? 0 : maxT === minT ? 100 : 100 - ((r.avgMin - minT) / (maxT - minT)) * 100;
      const ratingScore = r.avgRating == null ? 0 : maxR === minR ? 100 : ((r.avgRating - minR) / (maxR - minR)) * 100;
      return { ...r, score: Math.round((volumeScore + speedScore + ratingScore) / 3) };
    });

    scored.sort((a, b) => b.score - a.score || b.delivered - a.delivered || a.name.localeCompare(b.name));
    return scored;
  }, [staff, orders, month]);

  const hasData = rows.some((r) => r.delivered > 0);
  const fmtMin = (m: number | null) => (m == null ? "—" : m < 1 ? `${Math.round(m * 60)} sec` : `${Math.round(m)} min`);
  const podium = rows.slice(0, 3);
  const MEDALS = ["🥇", "🥈", "🥉"];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-bold text-white">
          <Trophy className="h-4 w-4 text-warm-yellow" /> Monthly Leaderboard
        </h2>
        <select value={month} onChange={(e) => setMonth(e.target.value)} className="input max-w-[180px] py-2 text-sm">
          {months.map((mo) => (
            <option key={mo.key} value={mo.key}>{mo.label}</option>
          ))}
        </select>
      </div>

      {!hasData ? (
        <div className="card flex flex-col items-center gap-2 p-10 text-center text-sm text-slate-400">
          <Trophy className="h-6 w-6 text-slate-600" />
          No deliveries in {months.find((mo) => mo.key === month)?.label} yet — rankings appear once orders are delivered.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {podium.map((r, i) => (
              <div
                key={r.id}
                className={`card flex items-center gap-3 p-4 ${
                  i === 0 ? "ring-2 ring-warm-yellow/50" : i === 1 ? "ring-1 ring-slate-400/40" : ""
                }`}
              >
                <span className="text-2xl">{MEDALS[i]}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-white">{r.name}</div>
                  <div className="text-xs text-slate-400">
                    {r.delivered} delivered · {fmtMin(r.avgMin)} avg ·{" "}
                    {r.avgRating == null ? "no ratings" : `${r.avgRating.toFixed(1)}★`}
                  </div>
                </div>
                <span className="font-display text-xl font-extrabold text-warm-yellow">{r.score}</span>
              </div>
            ))}
          </div>

          <div className="card overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-left text-xs uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="p-3">Rank</th>
                  <th className="p-3">Delivery person</th>
                  <th className="p-3">Delivered</th>
                  <th className="p-3">Avg delivery time</th>
                  <th className="p-3">Avg rating</th>
                  <th className="p-3">Score</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id} className="border-t border-white/5 hover:bg-white/[0.03]">
                    <td className="p-3">
                      <span className={`font-display font-extrabold ${i < 3 ? "text-warm-yellow" : "text-slate-500"}`}>
                        #{i + 1}
                      </span>
                    </td>
                    <td className="p-3 font-semibold text-white">{r.name}</td>
                    <td className="p-3">
                      <span className="inline-flex items-center gap-1 text-slate-300">
                        <PackageCheck className="h-3.5 w-3.5 text-emerald-400" /> {r.delivered}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="inline-flex items-center gap-1 text-slate-300">
                        <Timer className="h-3.5 w-3.5 text-neon-blue" /> {fmtMin(r.avgMin)}
                      </span>
                    </td>
                    <td className="p-3">
                      {r.avgRating == null ? (
                        <span className="text-xs text-slate-500">No ratings</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-warm-yellow">
                          <Star className="h-3.5 w-3.5 fill-warm-yellow" /> {r.avgRating.toFixed(1)}
                          <span className="text-xs text-slate-500">({r.ratings})</span>
                        </span>
                      )}
                    </td>
                    <td className="p-3 font-display font-extrabold text-white">{r.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
