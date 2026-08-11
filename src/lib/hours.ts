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

function atTime(ref: Date, h: number, m: number): Date {
  const d = new Date(ref);
  d.setHours(h, m, 0, 0);
  return d;
}

/**
 * Ordering window spans midnight: open at openTime (evening), closes at closeTime
 * (following morning). We treat any instant between openTime..midnight OR
 * midnight..closeTime as "open".
 */
export function getOpenStatus(settings: AppSettings, now = new Date()): OpenStatus {
  const { openTime, closeTime, forceOpen, emergencyClosed, holidays, openDays } =
    settings;

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

  if (forceOpen) {
    const close = atTime(now, parseHM(closeTime).h, parseHM(closeTime).m);
    const closesAt = close <= now ? new Date(close.getTime() + 86400000) : close;
    return {
      isOpen: true,
      opensAt: now,
      closesAt,
      label: "Open (Override)",
      nextWindowLabel: `Open now · closes at ${fmtTime(closeTime)}`,
      secondsUntilChange: Math.max(0, Math.floor((closesAt.getTime() - now.getTime()) / 1000)),
    };
  }

  const isHoliday = holidays.includes(now.toISOString().slice(0, 10));
  const openAllowedToday = openDays.includes(now.getDay());

  const open = parseHM(openTime);
  const close = parseHM(closeTime);

  // Window that started yesterday evening and closes this morning
  const lastNightOpen = atTime(now, open.h, open.m);
  lastNightOpen.setDate(lastNightOpen.getDate() - 1);
  const thisMorningClose = atTime(now, close.h, close.m);

  // Window that opens this evening
  const tonightOpen = atTime(now, open.h, open.m);
  const tomorrowMorningClose = atTime(now, close.h, close.m);
  tomorrowMorningClose.setDate(tomorrowMorningClose.getDate() + 1);

  const inMorningWindow = now < thisMorningClose; // after midnight, before close
  const inEveningWindow = now >= tonightOpen; // after open, before midnight

  let isOpen = (inMorningWindow || inEveningWindow) && !isHoliday;
  // If today is a closed day but we're in the morning window, the window belongs to last night
  if (inMorningWindow) {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (!openDays.includes(yesterday.getDay())) isOpen = false;
  }
  if (inEveningWindow && !openAllowedToday) isOpen = false;

  if (isOpen) {
    const closesAt = inMorningWindow ? thisMorningClose : tomorrowMorningClose;
    return {
      isOpen: true,
      opensAt: inMorningWindow ? lastNightOpen : tonightOpen,
      closesAt,
      label: "Open Now",
      nextWindowLabel: `Open now · closes at ${fmtTime(closeTime)}`,
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
  const { h, m } = parseHM(openTime);
  for (let i = 0; i < 8; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    d.setHours(h, m, 0, 0);
    if (d > now && openDays.includes(d.getDay())) return d;
  }
  const d = new Date(now);
  d.setDate(d.getDate() + 1);
  d.setHours(h, m, 0, 0);
  return d;
}

export function fmtTime(hm: string): string {
  const [h, m] = hm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:${m.toString().padStart(2, "0")} ${period}`;
}

export function fmtCountdown(seconds: number): string {
  if (seconds <= 0) return "00:00:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((x) => x.toString().padStart(2, "0")).join(":");
}
