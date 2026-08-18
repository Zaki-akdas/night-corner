"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { ShoppingBag, Compass, Clock, MapPin } from "lucide-react";
import { useOpenStatus } from "@/hooks/use-open-status";
import { fmtCountdown, fmtTime } from "@/lib/hours";
import { NightScene } from "./night-scene";

export function Hero() {
  const open = useOpenStatus();
  return (
    <section className="relative overflow-hidden">
      {/* animated night sky / 3D scene */}
      <NightScene />

      <div className="relative z-10 mx-auto flex min-h-[88vh] max-w-7xl flex-col items-center justify-center px-4 py-16 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="chip glass mb-6 text-slate-200"
        >
          <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-neon-blue" />
          🌙 Open Tonight: {open ? fmtTime(open.openTime) : "10 PM"} – {open ? fmtTime(open.closeTime) : "6 AM"}
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-balance sm:text-6xl lg:text-7xl"
        >
          <span className="heading-gradient">YOUR NIGHT.</span>
          <br />
          <span className="heading-gradient">YOUR ESSENTIALS.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.25 }}
          className="mt-5 max-w-2xl text-balance text-lg text-slate-300"
        >
          Late-night cravings? We&apos;ve got you covered. Fresh bakery, snacks,
          chocolates, instant food and cold drinks — delivered to your door while
          the city sleeps.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.35 }}
          className="mt-4 flex items-center gap-2 rounded-full border border-neon-purple/20 bg-neon-purple/5 px-5 py-2 text-sm font-medium text-neon-purple/90"
        >
          🌙 Open 24×7 · We deliver all night for night people
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.4 }}
          className="mt-8 flex flex-col gap-3 sm:flex-row"
        >
          <Link href="/shop" className="btn-primary text-base">
            <ShoppingBag className="h-5 w-5" /> SHOP NOW
          </Link>
          <Link href="/categories" className="btn-ghost text-base">
            <Compass className="h-5 w-5" /> EXPLORE CATEGORIES
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.55 }}
          className="mt-10 grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3"
        >
          <InfoPill
            icon={<Clock className="h-4 w-4 text-neon-purple" />}
            label={open?.isOpen ? "Open Now" : "Opens in " + fmtCountdown(open?.secondsUntilChange ?? 0)}
            sub={open?.nextWindowLabel ?? "10 PM – 6 AM"}
            tone={open?.isOpen ? "ok" : "wait"}
          />
          <InfoPill
            icon={<MapPin className="h-4 w-4 text-neon-blue" />}
            label="Within 10 KM"
            sub="Fast night delivery"
            tone="neutral"
          />
          <InfoPill
            icon={<ShoppingBag className="h-4 w-4 text-warm-yellow" />}
            label="53+ Essentials"
            sub="Snacks, drinks & more"
            tone="neutral"
          />
        </motion.div>
      </div>
    </section>
  );
}

function InfoPill({
  icon,
  label,
  sub,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  sub: string;
  tone: "ok" | "wait" | "neutral";
}) {
  return (
    <div className="glass flex items-center gap-3 rounded-2xl p-3 text-left">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/5">{icon}</div>
      <div>
        <div
          className={`text-sm font-bold ${
            tone === "ok" ? "text-emerald-300" : tone === "wait" ? "text-warm-yellow" : "text-white"
          }`}
        >
          {label}
        </div>
        <div className="text-xs text-slate-400">{sub}</div>
      </div>
    </div>
  );
}
