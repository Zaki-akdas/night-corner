/**
 * Ambient night soundscape — synthesized entirely with the Web Audio API
 * (no audio files): a low warm pad, soft wind, and randomized cricket chirps.
 * Volume is kept subtle; everything fades in/out through a master gain.
 *
 * Must be started from a user gesture (browser autoplay policy).
 */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let fadeTimer: ReturnType<typeof setTimeout> | null = null;
const active: { stop: () => void }[] = [];

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** Low warm drone (two detuned sines through a lowpass). */
function startPad(ac: AudioContext, out: AudioNode) {
  const filter = ac.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 340;
  const gain = ac.createGain();
  gain.gain.value = 0.045;
  const oscs = [55, 82.41, 110].map((f, i) => {
    const o = ac.createOscillator();
    o.type = "sine";
    o.frequency.value = f;
    o.detune.value = i === 0 ? -4 : 4;
    o.connect(filter);
    o.start();
    return o;
  });
  filter.connect(gain).connect(out);
  return {
    stop: () => oscs.forEach((o) => o.stop()),
  };
}

/** Soft wind: looping filtered noise with a slow gain LFO. */
function startWind(ac: AudioContext, out: AudioNode) {
  const len = ac.sampleRate * 2;
  const buffer = ac.createBuffer(1, len, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

  const src = ac.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  const filter = ac.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 240;
  const gain = ac.createGain();
  gain.gain.value = 0.018;
  const lfo = ac.createOscillator();
  lfo.frequency.value = 0.07;
  const lfoAmt = ac.createGain();
  lfoAmt.gain.value = 0.012;
  lfo.connect(lfoAmt).connect(gain.gain);

  src.connect(filter).connect(gain).connect(out);
  src.start();
  lfo.start();
  return {
    stop: () => {
      src.stop();
      lfo.stop();
    },
  };
}

/** Randomized cricket chirps: bursts of short high sine sweeps. */
function startCrickets(ac: AudioContext, out: AudioNode) {
  let alive = true;
  const timers: ReturnType<typeof setTimeout>[] = [];
  let nextTime = ac.currentTime;

  const scheduleBurst = () => {
    if (!alive) return;
    const ticks = 3 + Math.floor(Math.random() * 4);
    let t0 = nextTime;
    for (let i = 0; i < ticks; i++) {
      const start = t0 + i * (0.12 + Math.random() * 0.06);
      const osc = ac.createOscillator();
      const g = ac.createGain();
      osc.type = "sine";
      const f = 3900 + Math.random() * 1100;
      osc.frequency.setValueAtTime(f, start);
      osc.frequency.exponentialRampToValueAtTime(f * 0.9, start + 0.07);
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(0.05, start + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.09);
      osc.connect(g).connect(out);
      osc.start(start);
      osc.stop(start + 0.11);
    }
    // Next chirp group 1.4–3.8s after the first tick of this one.
    const gap = 1.4 + Math.random() * 2.4;
    nextTime = t0 + gap;
    timers.push(setTimeout(scheduleBurst, (nextTime - ac.currentTime) * 1000));
  };

  scheduleBurst();
  return {
    stop: () => {
      alive = false;
      timers.forEach((t) => clearTimeout(t));
    },
  };
}

/** Start the soundscape; returns false if Web Audio is unavailable. */
export function startAmbient(): boolean {
  const ac = getCtx();
  if (!ac) return false;

  stopAmbient(0);

  master = ac.createGain();
  master.gain.value = 0;
  master.connect(ac.destination);
  master.gain.linearRampToValueAtTime(1, ac.currentTime + 1.4);

  active.push(startPad(ac, master));
  active.push(startWind(ac, master));
  active.push(startCrickets(ac, master));
  return true;
}

/** Fade out (and stop) the soundscape. `fade` is the fade duration in seconds. */
export function stopAmbient(fade = 0.8) {
  if (fadeTimer) {
    clearTimeout(fadeTimer);
    fadeTimer = null;
  }
  if (!ctx || !master) {
    // Nothing running — just clear anything half-stopped.
    active.splice(0).forEach((n) => n.stop());
    return;
  }
  const m = master;
  const ac = ctx;
  const t = ac.currentTime;
  try {
    m.gain.cancelScheduledValues(t);
    m.gain.setValueAtTime(m.gain.value, t);
    m.gain.linearRampToValueAtTime(0, t + fade);
  } catch {
    /* ignore */
  }
  const pending = active.splice(0);
  fadeTimer = setTimeout(
    () => {
      pending.forEach((n) => n.stop());
      try {
        m.disconnect();
      } catch {
        /* ignore */
      }
      master = null;
      fadeTimer = null;
    },
    fade * 1000 + 120
  );
}

/** Whether the soundscape is currently running (fading counts as running). */
export function isAmbientRunning(): boolean {
  return master !== null;
}
