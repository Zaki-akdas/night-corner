"use client";
import { useEffect, useState } from "react";
import Image from "next/image";

const FLAG = "nc-intro-seen";

/**
 * Opening brand splash — plays once per browser session. The logo glows in
 * over the night sky, then the overlay fades to reveal the site.
 * - Skips entirely when the user prefers reduced motion.
 * - Renders nothing on the server (client-only, avoids hydration mismatch).
 */
export function BrandIntro() {
  const [show, setShow] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(FLAG)) return;
    } catch {
      /* storage unavailable — just play it */
    }
    if (
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      try {
        sessionStorage.setItem(FLAG, "1");
      } catch {
        /* ignore */
      }
      return;
    }
    setShow(true);
    // Hold the logo animation ~1.2s, then fade the whole overlay out.
    const hold = setTimeout(() => setLeaving(true), 1250);
    const finish = setTimeout(() => {
      setGone(true);
      try {
        sessionStorage.setItem(FLAG, "1");
      } catch {
        /* ignore */
      }
    }, 1950);
    return () => {
      clearTimeout(hold);
      clearTimeout(finish);
    };
  }, []);

  if (!show || gone) return null;

  return (
    <div
      aria-hidden
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-night-950 ${leaving ? "intro-fade" : ""}`}
      style={{
        pointerEvents: leaving ? "none" : "auto",
        background:
          "radial-gradient(900px 500px at 50% 35%, rgb(var(--glow-a) / 0.22), transparent 65%), radial-gradient(700px 400px at 15% 80%, rgb(var(--glow-b) / 0.12), transparent 60%), #05060f",
      }}
    >
      <div className="stars pointer-events-none absolute inset-0" />
      <div className="relative flex flex-col items-center px-6">
        <div className="intro-glow rounded-3xl">
          <Image
            src="/logo.png"
            alt=""
            width={420}
            height={110}
            priority
            className="intro-logo h-auto w-[min(72vw,360px)]"
            draggable={false}
          />
        </div>
        <div className="intro-tagline mt-5 text-center text-[11px] font-medium tracking-[0.2em] text-slate-400 opacity-0">
          YOUR NIGHT · YOUR ESSENTIALS
        </div>
        <div className="mt-8 h-0.5 w-40 overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-1/2 animate-gradient-x rounded-full bg-gradient-to-r from-neon-purple via-neon-blue to-warm-yellow" />
        </div>
      </div>
    </div>
  );
}
