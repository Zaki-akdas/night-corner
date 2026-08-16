"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Volume2, VolumeX } from "lucide-react";
import { startAmbient, stopAmbient } from "@/lib/ambient-sound";

const FLAG = "nc-intro-seen";
const SOUND_KEY = "nc-sound";

/**
 * Opening brand splash — plays once per browser session. The logo glows in
 * over the night sky, then the overlay fades to reveal the site.
 * - Skips entirely when the user prefers reduced motion.
 * - Renders nothing on the server (client-only, avoids hydration mismatch).
 * - Offers an opt-in ambient night soundscape that fades out with the splash.
 */
export function BrandIntro() {
  const [show, setShow] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [gone, setGone] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const soundRef = useRef(false);

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
    // Dev-only: `?intro=long` holds the splash so it can be inspected/re-watched.
    const long = process.env.NODE_ENV !== "production" && new URLSearchParams(window.location.search).get("intro") === "long";
    // Reflect the saved sound preference on the toggle (audio still needs a tap).
    try {
      if (localStorage.getItem(SOUND_KEY) === "1") setSoundOn(true);
    } catch {
      /* ignore */
    }
    // Hold the logo animation ~1.2s, then fade the whole overlay out.
    const hold = setTimeout(() => setLeaving(true), long ? 12000 : 1250);
    const finish = setTimeout(() => {
      setGone(true);
      try {
        sessionStorage.setItem(FLAG, "1");
      } catch {
        /* ignore */
      }
    }, long ? 13500 : 1950);
    return () => {
      clearTimeout(hold);
      clearTimeout(finish);
    };
  }, []);

  // Fade the ambience out in sync with the overlay's fade when the splash leaves.
  useEffect(() => {
    if (leaving && soundRef.current) stopAmbient(0.8);
  }, [leaving]);

  // Never leave audio dangling if the component unmounts mid-play.
  useEffect(() => {
    return () => {
      if (soundRef.current) stopAmbient(0);
    };
  }, []);

  const toggleSound = () => {
    if (soundOn) {
      stopAmbient(0.4);
      soundRef.current = false;
      setSoundOn(false);
      try {
        localStorage.setItem(SOUND_KEY, "0");
      } catch {
        /* ignore */
      }
    } else {
      if (startAmbient()) {
        soundRef.current = true;
        setSoundOn(true);
        try {
          localStorage.setItem(SOUND_KEY, "1");
        } catch {
          /* ignore */
        }
      }
    }
  };

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
            src="/logo.svg"
            alt=""
            width={420}
            height={110}
            loading="eager"
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
        <button
          onClick={toggleSound}
          aria-pressed={soundOn}
          className="pointer-events-auto mt-10 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-slate-300 backdrop-blur transition hover:bg-white/10 hover:text-white"
        >
          {soundOn ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
          {soundOn ? "Night ambience on" : "Enable night ambience"}
        </button>
      </div>
    </div>
  );
}
