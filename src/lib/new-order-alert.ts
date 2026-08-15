/**
 * Browser-side rider alerts for the delivery dashboard: synthesized chimes
 * (pure Web Audio, no asset files) plus vibration patterns. Everything is
 * wrapped in try/catch so an unavailable audio context or vibrate API can
 * never break the dashboard — the visual card + live badge still update
 * regardless.
 *
 * Browsers only let audio play after a user gesture; the delivery person has
 * logged in and interacted with the page, so the AudioContext is allowed to
 * run — including while the tab sits in the background.
 */

/**
 * System notification (Notification API) for rider alerts. Surfaces the
 * delivery-PIN reminder even when the tab is minimized or the browser is in
 * the background — unlike the in-app toast, which needs a visible tab. Only
 * fires when the browser granted permission (requested from a user gesture).
 * Uses `tag` so repeated events replace rather than stack.
 *
 * Tapping the notification deep-links to `url` (e.g. the specific order's
 * delivery page) and brings the app to the front; without a url it just
 * focuses the dashboard.
 */
export function notifyRider(title: string, body: string, tag: string, url?: string): void {
  try {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    const n = new Notification(title, { body, tag, icon: "/logo.png" });
    n.onclick = () => {
      n.close();
      // Deep-link to the order the alert was about; otherwise just surface
      // the dashboard.
      if (url) window.location.href = url;
      window.focus();
    };
  } catch {
    // notification unavailable — nothing to do
  }
}

/**
 * Requests system-notification permission. Browsers only allow this from a
 * user gesture (click/tap), so it must be called from an interaction handler,
 * never from a timer or background event. Returns true when granted.
 */
export async function enableRiderNotifications(): Promise<boolean> {
  try {
    if (typeof window === "undefined" || !("Notification" in window)) return false;
    if (Notification.permission === "granted") return true;
    if (Notification.permission === "denied") return false;
    const p = await Notification.requestPermission();
    return p === "granted";
  } catch {
    return false;
  }
}

/** New-order alert: rising two-tone "ding-dong" + two short pulses. */
export function playNewOrderAlert(): void {
  try {
    vibrate([120, 60, 120, 60, 240]);
    playChime([880, 1318.5], 0.3);
  } catch {
    // audio/vibration unavailable — nothing to do
  }
}

/**
 * Delivery-time alert: distinct lower two-tone and a longer buzz so the rider
 * knows this is the handover step — the customer's delivery PIN must be
 * collected. Fires when an order goes OUT_FOR_DELIVERY.
 */
export function playDeliveryPinAlert(): void {
  try {
    vibrate([250, 100, 150, 100, 250]);
    playChime([1046.5, 783.99], 0.18);
  } catch {
    // audio/vibration unavailable — nothing to do
  }
}

function vibrate(pattern: number[]): void {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(pattern);
  }
}

function playChime(notes: number[], stepSec: number): void {
  if (typeof window === "undefined") return;
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return;

  const ctx = new Ctor();
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    const t0 = ctx.currentTime + i * stepSec;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.3, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.55);
  });
  // Resume in case the context was created while suspended (background tab).
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
}
