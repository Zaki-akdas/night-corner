import type { AppSettings } from "./settings";

export type OpenStatus = {
  isOpen: boolean;
  opensAt: Date;
  closesAt: Date;
  label: string;
  nextWindowLabel: string;
  secondsUntilChange: number;
};

function parseHM(hm: string): { h: number; m: number } {
  const [h, m] = hm.split(":").map(Number);
  return { h: h || 0, m: m || 0 };
}

type WallClock = { y: number; mo: number; d: number; h: number; m: number; wd: number };

/**
 * The shop's hours (openTime/closeTime/openDays/holidays) refer to the shop's
 * local wall clock — e.g. "opens 10 PM" means 10 PM in Bhopal. Serverless
 * runtimes (Vercel) run in UTC or other regions, so all window math is done in
 * `settings.timezone` via Intl, never in the server's own local time.
 */
function safeTimezone(tz: string | undefined): string {
  const candidate = tz && tz.trim() ? tz.trim() : "Asia/Kolkata";
  try {
    // Throws for unknown IANA names — fall back so a bad setting never breaks ordering.
    new Intl.DateTimeFormat("en-US", { timeZone: candidate });
    return candidate;
  } catch {
    return "Asia/Kolkata";
  }
}

/** Wall-clock fields of `instant` in `timeZone`. */
function wallClock(instant: Date, timeZone: string): WallClock {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  }).formatToParts(instant);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const h = parseInt(get("hour"), 10);
  const wd = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"].indexOf(
    get("weekday").toLowerCase()
  );
  return {
    y: parseInt(get("year"), 10),
    mo: parseInt(get("month"), 10),
    d: parseInt(get("day"), 10),
    h: Number.isFinite(h) ? h % 24 : 0,
    m: parseInt(get("minute"), 10),
    wd: wd >= 0 ? wd : new Date(instant).getDay(),
  };
}

/** UTC offset (ms) of `timeZone` at the given UTC instant. */
function tzOffsetMs(utcMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(utcMs));
  const get = (t: string) => parseInt(parts.find((p) => p.type === t)?.value ?? "0", 10);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - utcMs;
}

/** Builds a Date whose wall clock in `timeZone` is the given y-mo-d h:m. */
function zonedDate(
  y: number,
  mo: number,
  d: number,
  h: number,
  m: number,
  timeZone: string
): Date {
  const guess = Date.UTC(y, mo - 1, d, h, m);
  // Offset at the guessed instant, then re-evaluate at the corrected instant so
  // DST transitions (where the offset changes at midnight) still land exactly.
  const cand = new Date(guess - tzOffsetMs(guess, timeZone));
  const off2 = tzOffsetMs(cand.getTime(), timeZone);
  return new Date(guess - off2);
}

/** Shifts a wall-clock date by `days` days, returning its y/mo/d fields. */
function shiftWallDate(
  wc: Pick<WallClock, "y" | "mo" | "d">,
  days: number
): { y: number; mo: number; d: number } {
  const d = new Date(Date.UTC(wc.y, wc.mo - 1, wc.d + days));
  return { y: d.getUTCFullYear(), mo: d.getUTCMonth() + 1, d: d.getUTCDate() };
}

/**
 * Ordering window spans midnight: open at openTime (evening), closes at closeTime
 * (following morning). We treat any instant between openTime..midnight OR
 * midnight..closeTime as "open" — all in the shop's configured timezone.
 */
export function getOpenStatus(settings: AppSettings, now = new Date()): OpenStatus {
  const { openTime, closeTime, forceOpen, emergencyClosed, holidays, openDays } = settings;
  const tz = safeTimezone(settings.timezone);

  if (emergencyClosed) {
    const next = nextOpening(settings, now);
    return {
      isOpen: false,
      opensAt: next,
      closesAt: next,
      label: "Temporarily Closed",
      nextWindowLabel: "We are closed for an emergency. Please check back soon.",
      secondsUntilChange: Math.max(0, Math.floor((next.getTime() - now.getTime()) / 1000)),
    };
  }

  // 24×7 mode: always open unless emergency closed
  if (is24x7(settings)) {
    return {
      isOpen: true,
      opensAt: now,
      closesAt: new Date(now.getTime() + 86400000),
      label: "Open 24×7",
      nextWindowLabel: "Open 24×7 — we deliver all night",
      secondsUntilChange: 86400,
    };
  }

  if (forceOpen) {
    const close = parseHM(closeTime);
    const wc = wallClock(now, tz);
    let closesAt = zonedDate(wc.y, wc.mo, wc.d, close.h, close.m, tz);
    if (closesAt <= now) closesAt = new Date(closesAt.getTime() + 86400000);
    return {
      isOpen: true,
      opensAt: now,
      closesAt,
      label: "Open (Override)",
      nextWindowLabel: "When the city sleeps, we deliver.",
      secondsUntilChange: Math.max(0, Math.floor((closesAt.getTime() - now.getTime()) / 1000)),
    };
  }

  const wc = wallClock(now, tz);
  const open = parseHM(openTime);
  const close = parseHM(closeTime);

  const holidayKey = `${wc.y}-${String(wc.mo).padStart(2, "0")}-${String(wc.d).padStart(2, "0")}`;
  const isHoliday = holidays.includes(holidayKey);
  const openAllowedToday = openDays.includes(wc.wd);

  // Window that started yesterday evening and closes this morning
  const yest = shiftWallDate(wc, -1);
  const lastNightOpen = zonedDate(yest.y, yest.mo, yest.d, open.h, open.m, tz);
  const thisMorningClose = zonedDate(wc.y, wc.mo, wc.d, close.h, close.m, tz);

  // Window that opens this evening
  const tmr = shiftWallDate(wc, 1);
  const tonightOpen = zonedDate(wc.y, wc.mo, wc.d, open.h, open.m, tz);
  const tomorrowMorningClose = zonedDate(tmr.y, tmr.mo, tmr.d, close.h, close.m, tz);

  const inMorningWindow = now < thisMorningClose; // after midnight, before close
  const inEveningWindow = now >= tonightOpen; // after open, before midnight

  let isOpen = (inMorningWindow || inEveningWindow) && !isHoliday;
  // If today is a closed day but we're in the morning window, the window belongs to last night
  if (inMorningWindow) {
    const ywd = wallClock(new Date(thisMorningClose.getTime() - 86400000), tz).wd;
    if (!openDays.includes(ywd)) isOpen = false;
  }
  if (inEveningWindow && !openAllowedToday) isOpen = false;

  if (isOpen) {
    const closesAt = inMorningWindow ? thisMorningClose : tomorrowMorningClose;
    return {
      isOpen: true,
      opensAt: inMorningWindow ? lastNightOpen : tonightOpen,
      closesAt,
      label: "Open Now",
      nextWindowLabel: "When the city sleeps, we deliver.",
      secondsUntilChange: Math.max(0, Math.floor((closesAt.getTime() - now.getTime()) / 1000)),
    };
  }

  const opensAt = nextOpening(settings, now);
  return {
    isOpen: false,
    opensAt,
    closesAt: opensAt,
    label: "Closed",
    nextWindowLabel: `Ordering opens at ${fmtTime(openTime)}`,

    secondsUntilChange: Math.max(0, Math.floor((opensAt.getTime() - now.getTime()) / 1000)),
  };
}

function nextOpening(settings: AppSettings, now: Date): Date {
  const { openTime, openDays } = settings;
  const tz = safeTimezone(settings.timezone);
  const { h, m } = parseHM(openTime);
  const wc = wallClock(now, tz);
  for (let i = 0; i < 8; i++) {
    const d = shiftWallDate(wc, i);
    const cand = zonedDate(d.y, d.mo, d.d, h, m, tz);
    if (cand > now && openDays.includes(new Date(Date.UTC(d.y, d.mo - 1, d.d)).getUTCDay())) {
      return cand;
    }
  }
  const fallback = shiftWallDate(wc, 1);
  return zonedDate(fallback.y, fallback.mo, fallback.d, h, m, tz);
}

export function fmtTime(hm: string): string {
  const [h, m] = hm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:${m.toString().padStart(2, "0")} ${period}`;
}

/** Returns true when the schedule is configured for around-the-clock ordering. */
export function is24x7(settings: AppSettings): boolean {
  return (
    settings.openDays.length === 7 &&
    !settings.holidays.length &&
    settings.openTime === "00:00"
  );
}

export function fmtCountdown(seconds: number): string {
  if (seconds <= 0) return "00:00:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((x) => x.toString().padStart(2, "0")).join(":");
}
