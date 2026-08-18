"use client";
import { motion } from "framer-motion";
import { fmtCountdown } from "@/lib/hours";
import { useEffect, useState } from "react";

export function OpenBadgeServer(props: {
  isOpen: boolean;
  label: string;
  nextWindowLabel: string;
  openTime: string;
  closeTime: string;
  secondsUntilChange: number;
}) {
  const [seconds, setSeconds] = useState(props.secondsUntilChange);
  useEffect(() => {
    setSeconds(props.secondsUntilChange);
    const t = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    // refresh from server every minute to catch admin overrides
    const r = setInterval(() => {
      fetch("/api/open-status")
        .then((r) => r.json())
        .then((d) => setSeconds(d.secondsUntilChange))
        .catch(() => {});
    }, 60_000);
    return () => {
      clearInterval(t);
      clearInterval(r);
    };
  }, [props.secondsUntilChange]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`glass-strong relative overflow-hidden rounded-3xl p-6 sm:p-8 ${
        props.isOpen ? "ring-2 ring-emerald-400/40" : "ring-2 ring-warm-yellow/40"
      }`}
    >
      <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
        <div
          className={`grid h-16 w-16 shrink-0 place-items-center rounded-2xl text-3xl ${
            props.isOpen ? "bg-emerald-500/20" : "bg-warm-yellow/20"
          }`}
        >
          {props.isOpen ? "🌙" : "⏰"}
        </div>
        <div className="flex-1">
          <div
            className={`text-xl font-extrabold sm:text-2xl ${
              props.isOpen ? "text-emerald-300" : "text-warm-yellow"
            }`}
          >
            {props.isOpen ? "🌙 We're Open — Order Now!" : "🌙 Night Ordering is Closed"}
          </div>
          <div className="mt-1 text-slate-300">{props.nextWindowLabel}</div>
          <div className="mt-1 text-xs uppercase tracking-widest text-slate-500">
            Open 24×7 — we deliver all night for night people
          </div>
        </div>
        {!props.isOpen && (
          <div className="rounded-2xl bg-night-900/70 px-5 py-3 text-center ring-1 ring-white/10">
            <div className="text-xs uppercase tracking-widest text-slate-500">Opens in</div>
            <div className="font-mono text-2xl font-bold text-warm-yellow">
              {fmtCountdown(seconds)}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function fmtHM(hm: string) {
  const [h, m] = hm.split(":").map(Number);
  const p = h >= 12 ? "PM" : "AM";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:${m.toString().padStart(2, "0")} ${p}`;
}
