"use client";
import { useEffect, useState } from "react";

type Status = {
  isOpen: boolean;
  label: string;
  nextWindowLabel: string;
  opensAt: string; // ISO
  closesAt: string;
  secondsUntilChange: number;
  openTime: string;
  closeTime: string;
};

export function useOpenStatus(refreshMs = 30_000) {
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await fetch("/api/open-status", { cache: "no-store" });
        const data = (await res.json()) as Status;
        if (active) setStatus(data);
      } catch {
        /* ignore */
      }
    };
    load();
    const i = setInterval(load, refreshMs);
    // tick the countdown locally every second
    const t = setInterval(() => {
      setStatus((s) =>
        s ? { ...s, secondsUntilChange: Math.max(0, s.secondsUntilChange - 1) } : s
      );
    }, 1000);
    return () => {
      active = false;
      clearInterval(i);
      clearInterval(t);
    };
  }, [refreshMs]);

  return status;
}
