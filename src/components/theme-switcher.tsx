"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Palette, Volume2 } from "lucide-react";
import { useSession } from "next-auth/react";

export type ThemeId = "midnight" | "gold" | "emerald" | "rose" | "ocean";

const THEMES: { id: ThemeId; label: string; swatch: string }[] = [
  { id: "midnight", label: "Midnight", swatch: "linear-gradient(135deg,#a855f7,#38bdf8)" },
  { id: "gold", label: "Royal Gold", swatch: "linear-gradient(135deg,#f59e0b,#fbbf24)" },
  { id: "emerald", label: "Emerald", swatch: "linear-gradient(135deg,#10b981,#2dd4bf)" },
  { id: "rose", label: "Rose", swatch: "linear-gradient(135deg,#e11d48,#f472b6)" },
  { id: "ocean", label: "Ocean", swatch: "linear-gradient(135deg,#0ea5e9,#22d3ee)" },
];

export const THEME_IDS: ThemeId[] = THEMES.map((t) => t.id);
export const THEME_LABELS: Record<string, string> = Object.fromEntries(
  THEMES.map((t) => [t.id, t.label])
);

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

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

export function ThemeSwitcher() {
  const { status } = useSession();
  const loggedIn = status === "authenticated";
  const [theme, setTheme] = useState<ThemeId>("midnight");
  const [open, setOpen] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const flashTimer = useRef<number | null>(null);
  const syncedRef = useRef(false);

  // Initial value from device storage (fast first paint after pre-paint script).
  useEffect(() => {
    setTheme(getStoredTheme());
  }, []);

  // Once auth resolves, pull the account-saved theme so it follows the user
  // across devices. Only runs once per mount.
  useEffect(() => {
    if (status === "loading" || syncedRef.current) return;
    syncedRef.current = true;
    if (status !== "authenticated") return;
    fetch("/api/account/theme")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d?.theme) return;
        const t = d.theme as ThemeId;
        if (!THEMES.some((x) => x.id === t)) return;
        setTheme(t);
        const root = document.documentElement;
        root.setAttribute("data-theme", t);
        try {
          localStorage.setItem(STORAGE_KEY, t); // cache for next load's pre-paint
        } catch {
          /* ignore */
        }
      })
      .catch(() => {
        /* offline — device theme is fine */
      });
  }, [status]);

  // Close on outside click.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  const showFlash = useCallback((label: string) => {
    setFlash(label);
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlash(null), 1400);
  }, []);

  const apply = useCallback(
    (t: ThemeId, opts?: { silent?: boolean }) => {
      setTheme(t);
      setOpen(false);
      const root = document.documentElement;
      root.setAttribute("data-theme", t);
      if (!opts?.silent) {
        root.classList.add("theme-anim");
        window.setTimeout(() => root.classList.remove("theme-anim"), 500);
      }
      try {
        localStorage.setItem(STORAGE_KEY, t);
      } catch {
        /* ignore */
      }
      if (loggedIn) {
        fetch("/api/account/theme", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ theme: t }),
        }).catch(() => {
          /* non-fatal — next successful save will catch up */
        });
      }
      if (!opts?.silent) showFlash(THEME_LABELS[t] ?? t);
    },
    [loggedIn, showFlash]
  );

  // Keyboard shortcut: Alt+T cycles through the themes (ignored while typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || e.key.toLowerCase() !== "t") return;
      if (isTypingTarget(e.target)) return;
      e.preventDefault();
      const idx = THEMES.findIndex((t) => t.id === theme);
      const next = THEMES[(idx + 1) % THEMES.length];
      apply(next.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [apply, theme]);

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
      {flash && (
        <div className="pointer-events-none absolute right-0 top-full z-50 mt-2 flex items-center gap-1.5 whitespace-nowrap rounded-full border border-white/10 bg-night-900/95 px-3 py-1.5 text-xs font-semibold text-white shadow-2xl backdrop-blur-xl">
          <Volume2 className="h-3.5 w-3.5" style={{ color: "rgb(var(--accent-purple))" }} />
          Theme: {flash}
        </div>
      )}
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-48 overflow-hidden rounded-2xl border border-white/10 bg-night-900/95 p-2 shadow-2xl backdrop-blur-xl">
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
          <div className="mt-1 border-t border-white/5 px-3 pt-2 text-[10px] leading-relaxed text-slate-500">
            {loggedIn ? (
              <p>
                {current.label} — synced to your account
              </p>
            ) : (
              <p>{current.label} — saved on this device</p>
            )}
            <p className="mt-0.5 text-slate-600">Press Alt+T to cycle themes</p>
          </div>
        </div>
      )}
    </div>
  );
}
