// Synthetic seismogram traces, shared by the server-rendered pages and the interactive finder.
// Shape only: quiet background noise, a small P-wave burst, then a much larger S-wave burst
// with a slowly fading coda. Each trace is scaled to fit its box; real amplitudes are given in mm.
import { RECORD_SECONDS, mulberry32 } from './seismology.mjs';

export const TRACE = { width: 640, height: 112, left: 20, right: 620, mid: 44, half: 36, step: 0.2 };
export const xForTime = t => TRACE.left + (t / RECORD_SECONDS) * (TRACE.right - TRACE.left);
export const timeForX = x => ((x - TRACE.left) / (TRACE.right - TRACE.left)) * RECORD_SECONDS;

function envelope(t, p, s) {
  let e = 0.035;
  if (t >= p) e += Math.min(1, (t - p) / 0.6) * 0.32 * Math.exp(-(t - p) / 10) + 0.05 * Math.exp(-(t - p) / 60);
  if (t >= s) e += Math.min(1, (t - s) / 0.8) * Math.exp(-(t - s) / 16) + 0.12 * Math.exp(-(t - s) / 50);
  return e;
}

/** Trace samples in [-1, 1] every TRACE.step seconds. `seed` keeps the noise identical between server and browser. */
export function traceSamples({ p, s, seed }) {
  const rand = mulberry32(seed);
  const n = Math.round(RECORD_SECONDS / TRACE.step) + 1;
  const out = new Array(n);
  let wiggle = 0, peak = 0;
  for (let i = 0; i < n; i++) {
    const t = i * TRACE.step;
    wiggle = 0.55 * wiggle + 0.45 * (rand() * 2 - 1);
    const v = envelope(t, p, s) * wiggle * 1.8;
    out[i] = v;
    peak = Math.max(peak, Math.abs(v));
  }
  const scale = peak > 0 ? 0.95 / peak : 1;
  return out.map(v => Math.max(-1, Math.min(1, v * scale)));
}

/** SVG path data for a trace (`d` attribute), drawn up to `until` seconds. */
export function tracePath(samples, until = RECORD_SECONDS) {
  let d = '';
  for (let i = 0; i < samples.length; i++) {
    const t = i * TRACE.step;
    if (t > until) break;
    d += `${i ? 'L' : 'M'}${xForTime(t).toFixed(1)} ${(TRACE.mid - samples[i] * TRACE.half).toFixed(1)}`;
  }
  return d;
}

/** Noise seed for a station's trace in a given scenario. */
export const traceSeed = (scenarioKey, stationIndex) => (Math.imul(scenarioKey >>> 0, 2654435761) + stationIndex * 97 + 13) >>> 0;

// Travel-time graph geometry (TravelTimeGraph.astro), shared with the finder that marks measured lags on it.
export const GRAPH = { width: 520, height: 300, left: 48, right: 506, top: 14, bottom: 262, maxKm: 600, maxS: 180 };
export const graphX = km => GRAPH.left + (km / GRAPH.maxKm) * (GRAPH.right - GRAPH.left);
export const graphY = seconds => GRAPH.bottom - (seconds / GRAPH.maxS) * (GRAPH.bottom - GRAPH.top);
