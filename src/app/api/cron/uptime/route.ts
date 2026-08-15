import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logActivity, notifyAdmin } from "@/lib/admin";

/**
 * Uptime monitor (Vercel Cron Job — see vercel.json "crons").
 *
 * Every scheduled invocation pings the site's public pages and APIs and
 * checks for failures (HTTP 5xx, a 404 on a known-good path, or no response).
 * On failure it raises an alert in the admin activity log and in-app
 * notifications, deduped to at most one alert per 15 minutes while the site
 * stays down, plus a "recovered" notification when health returns.
 *
 * The route always answers 200 with a summary so Vercel doesn't retry the
 * cron. When CRON_SECRET is set, Vercel signs cron invocations with
 * `Authorization: Bearer <CRON_SECRET>` — the route rejects anything else so
 * the monitor can't be triggered by the public. Without it (demo/local) the
 * route is left open, matching the messenger webhook pattern.
 */

const ENDPOINTS = ["/", "/shop", "/categories", "/api/settings/public", "/api/auth/csrf"];
const ALERT_COOLDOWN_MS = 15 * 60 * 1000; // at most one alert per 15 min while down
const TIMEOUT_MS = 15_000;

async function check(base: string, path: string) {
  try {
    const res = await fetch(base + path, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "user-agent": "night-corner-uptime-monitor/1.0" },
    });
    return { path, status: res.status, error: null as string | null };
  } catch (e) {
    return { path, status: null, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const base = (
    process.env.UPTIME_BASE_URL ||
    process.env.NEXTAUTH_URL ||
    "https://night-corner.vercel.app"
  ).replace(/\/+$/, "");

  const results = await Promise.all(ENDPOINTS.map((p) => check(base, p)));
  const failures = results.filter((r) => r.status === null || r.status >= 500 || r.status === 404);

  try {
    const last = await prisma.activityLog.findFirst({
      where: { action: { in: ["UPTIME_ALERT", "UPTIME_RECOVERED"] } },
      orderBy: { createdAt: "desc" },
      select: { action: true, createdAt: true },
    });
    const lastAction = last?.action;
    const lastAge = last ? Date.now() - last.createdAt.getTime() : Infinity;

    if (failures.length > 0) {
      const detail = failures
        .map((f) => `${f.path} → ${f.status !== null ? "HTTP " + f.status : f.error}`)
        .join("; ");
      console.error(`[uptime] ALERT — ${base} failing: ${detail}`);

      const shouldAlert = lastAction !== "UPTIME_ALERT" || lastAge > ALERT_COOLDOWN_MS;
      if (shouldAlert) {
        await logActivity({
          action: "UPTIME_ALERT",
          entity: "monitor",
          meta: {
            base,
            failures: failures.map((f) => ({ path: f.path, status: f.status, error: f.error })),
          },
        });
        await notifyAdmin("SYSTEM", "Uptime alert", `${base} is failing: ${detail}`);
      }
    } else if (lastAction === "UPTIME_ALERT") {
      console.error(`[uptime] recovered — all ${ENDPOINTS.length} endpoints OK`);
      await logActivity({ action: "UPTIME_RECOVERED", entity: "monitor", meta: { base } });
      await notifyAdmin("SYSTEM", "Uptime recovered", `${base} is healthy again.`);
    }
  } catch (e) {
    // Never let the monitor itself crash the cron invocation.
    console.error("[uptime] internal error:", e);
  }

  return NextResponse.json({
    ok: failures.length === 0,
    base,
    checked: results.length,
    failures: failures.map((f) => ({ path: f.path, status: f.status, error: f.error })),
  });
}
