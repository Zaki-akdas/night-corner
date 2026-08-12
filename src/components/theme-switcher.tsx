"use client";
import { useEffect, useRef, useState } from "react";
import { Palette } from "lucide-react";

export type ThemeId = "midnight" | "gold" | "emerald" | "rose";

const THEMES: { id: ThemeId; label: string; swatch: string }[] = [
  { id: "midnight", label: "Midnight", swatch: "linear-gradient(135deg,#a855f7,#38bdf8)" },
  { id: "gold", label: "Royal Gold", swatch: "linear-gradient(135deg,#f59e0b,#fbbf24)" },
  { id: "emerald", label: "Emerald", swatch: "linear-gradient(135deg,#10b981,#2dd4bf)" },
  { id: "rose", label: "Rose", swatch: "linear-gradient(135deg,#e11d48,#f472b6)" },
];

const STORAGE_KEY = "nc-theme";

export function getStoredTheme(): ThemeId {
  if (typeof window === "undefined") return "midnight";
  try {
    const t = localStorage.getItem(STORAGE_KEY);
    if (t && THEMES.some((x) => x.id === t)) return t as ThemeId;
  } catch {
    /* ignore */
  }
  return "midnight";
}

export function ThemeSwitcher() {
  const [theme, setTheme] = useState<ThemeId>("midnight");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Initial value from storage (after hydration to avoid SSR mismatch).
  useEffect(() => {
    setTheme(getStoredTheme());
  }, []);

  // Close on outside click.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  const apply = (t: ThemeId) => {
    setTheme(t);
    setOpen(false);
    const root = document.documentElement;
    root.setAttribute("data-theme", t);
    root.classList.add("theme-anim");
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {
      /* ignore */
    }
    window.setTimeout(() => root.classList.remove("theme-anim"), 500);
  };

  const current = THEMES.find((t) => t.id === theme) ?? THEMES[0];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="btn-ghost h-10 w-10 rounded-xl p-0"
        aria-label="Change theme"
        title="Theme"
      >
        <Palette className="h-5 w-5" style={{ color: "rgb(var(--accent-purple))" }} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-44 overflow-hidden rounded-2xl border border-white/10 bg-night-900/95 p-2 shadow-2xl backdrop-blur-xl">
          <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Theme
          </div>
          {THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => apply(t.id)}
              className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
                theme === t.id ? "bg-white/10 text-white" : "text-slate-300 hover:bg-white/5 hover:text-white"
              }`}
            >
              <span className="h-4 w-4 rounded-full ring-1 ring-white/20" style={{ background: t.swatch }} />
              {t.label}
              {theme === t.id && <span className="ml-auto text-[10px] text-neon-purple">●</span>}
            </button>
          ))}
          <p className="mt-1 border-t border-white/5 px-3 pt-1.5 text-[10px] text-slate-500">
            {current.label} — saved on this device
          </p>
        </div>
      )}
    </div>
  );
}
