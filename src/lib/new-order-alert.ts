/**
 * Browser-side "new order" alert for the delivery dashboard: a synthesized
 * chime (pure Web Audio, no asset file) plus a distinctive vibration pattern.
 * Everything is wrapped in try/catch so an unavailable audio context or
 * vibrate API can never break the dashboard — the visual card + live badge
 * still update regardless.
 *
 * Browsers only let audio play after a user gesture; the delivery person has
 * logged in and interacted with the page, so the AudioContext is allowed to
 * run — including while the tab sits in the background.
 */
export function playNewOrderAlert(): void {
  try {
    vibrate();
    playChime();
  } catch {
    // audio/vibration unavailable — nothing to do
  }
}

function vibrate(): void {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    // Two short pulses + a longer buzz — distinct from a plain notification.
    navigator.vibrate([120, 60, 120, 60, 240]);
  }
}

function playChime(): void {
  if (typeof window === "undefined") return;
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return;

  const ctx = new Ctor();
  // Rising two-tone "ding-dong" (A5 → E6) — attention-getting but pleasant.
  const notes = [880, 1318.5];
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    const t0 = ctx.currentTime + i * 0.3;
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
