#!/usr/bin/env node
/**
 * Uptime monitor — pings the site's public pages and APIs and alerts when any
 * of them fails (HTTP 5xx, a 404 on a known-good path, or no response).
 *
 * Usage:
 *   node scripts/uptime-monitor.mjs                 # one check; exit 0/1
 *   node scripts/uptime-monitor.mjs --interval 60   # loop every 60s (per-minute)
 *   node scripts/uptime-monitor.mjs --interval 60 --max 1440   # loop, then stop
 *   node scripts/uptime-monitor.mjs --json          # machine-readable output
 *
 * Environment:
 *   UPTIME_BASE_URL    base URL to monitor (default https://night-corner.vercel.app)
 *   UPTIME_ENDPOINTS   comma-separated paths (defaults below)
 *
 * Exit code 0 = healthy, 1 = at least one failure (single-check mode). Any
 * scheduler can drive this — local cron, GitHub Actions, a server, etc.
 * Authentication-gated routes (307/401/403) count as healthy.
 */
import { setTimeout as sleep } from "node:timers/promises";

const BASE = (process.env.UPTIME_BASE_URL || "https://night-corner.vercel.app").replace(/\/+$/, "");
const ENDPOINTS = (process.env.UPTIME_ENDPOINTS || "/, /shop, /categories, /api/settings/public, /api/auth/csrf")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const args = process.argv.slice(2);
const argVal = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? Number(args[i + 1]) : undefined;
};
const INTERVAL = argVal("--interval");
const MAX = argVal("--max");
const JSON_MODE = args.includes("--json");

/** Returns { path, status?, error?, ok } — ok=false on 5xx, 404, or network failure. */
async function check(path) {
  try {
    const res = await fetch(BASE + path, {
      signal: AbortSignal.timeout(15_000),
      headers: { "user-agent": "night-corner-uptime-monitor/1.0" },
    });
    return { path, status: res.status, ok: res.status < 500 && res.status !== 404 };
  } catch (e) {
    return { path, error: e?.message ?? String(e), ok: false };
  }
}

function report(results) {
  const failures = results.filter((r) => !r.ok);
  const stamp = new Date().toISOString();
  if (JSON_MODE) {
    console.log(JSON.stringify({ ts: stamp, base: BASE, ok: failures.length === 0, results }));
  } else {
    for (const r of results) {
      const mark = r.ok ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m";
      console.log(`${stamp} ${mark} ${r.path}${r.status ? " → HTTP " + r.status : " → " + (r.error ?? "no response")}`);
    }
    if (failures.length > 0) {
      console.error(
        `\x1b[31mALERT\x1b[0m ${BASE} is DOWN (${failures.map((f) => `${f.path}${f.status ? " → " + f.status : ""}`).join(", ")})`
      );
    } else {
      console.log(`\x1b[32mOK\x1b[0m ${BASE} — all ${results.length} endpoints healthy`);
    }
  }
  return failures.length === 0;
}

let runs = 0;
while (true) {
  runs++;
  const healthy = report(await Promise.all(ENDPOINTS.map(check)));
  if (!INTERVAL || (MAX !== undefined && runs >= MAX)) {
    process.exit(healthy ? 0 : 1);
  }
  await sleep(INTERVAL * 1000);
}
