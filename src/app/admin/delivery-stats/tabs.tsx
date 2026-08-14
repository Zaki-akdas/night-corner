"use client";
import { useState } from "react";
import { BarChart3, Trophy } from "lucide-react";

export function StatsTabs({
  overview,
  leaderboard,
}: {
  overview: React.ReactNode;
  leaderboard: React.ReactNode;
}) {
  const [tab, setTab] = useState<"overview" | "leaderboard">("overview");
  return (
    <div className="space-y-5">
      <div className="flex gap-1 rounded-2xl border border-white/10 bg-night-900/60 p-1">
        <button
          onClick={() => setTab("overview")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${
            tab === "overview" ? "bg-gradient-to-r from-neon-purple/30 to-neon-blue/20 text-white ring-1 ring-neon-purple/40" : "text-slate-400 hover:text-white"
          }`}
        >
          <BarChart3 className="h-4 w-4" /> Overview
        </button>
        <button
          onClick={() => setTab("leaderboard")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${
            tab === "leaderboard" ? "bg-gradient-to-r from-neon-purple/30 to-neon-blue/20 text-white ring-1 ring-neon-purple/40" : "text-slate-400 hover:text-white"
          }`}
        >
          <Trophy className="h-4 w-4" /> Monthly Leaderboard
        </button>
      </div>
      {tab === "overview" ? overview : leaderboard}
    </div>
  );
}
