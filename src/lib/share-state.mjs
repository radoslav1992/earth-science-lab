// Shareable Epicenter Finder settings in the URL query string, e.g.
//   ?mode=challenge&seed=4821&snap=0     or     ?mode=explore&x=320&y=150&m=5.2
// Invalid values fall back to defaults, and each fallback produces a friendly note.
import { REGION } from './seismology.mjs';

export const MODES = ['guided', 'challenge', 'explore'];
export const MAGNITUDE_RANGE = [2.5, 7];

const num = value => (value === null || value.trim() === '' ? NaN : Number(value));

export function parseState(search) {
  const params = new URLSearchParams(search);
  const notes = [];
  const state = { mode: 'guided', seed: null, snap: null, quake: null, magnitude: null };
  if (params.has('mode')) {
    const mode = params.get('mode');
    if (MODES.includes(mode)) state.mode = mode;
    else notes.push(`“${mode}” isn't a mode here, so the finder opened in Guided mode.`);
  }
  if (params.has('seed')) {
    const seed = num(params.get('seed'));
    if (Number.isInteger(seed) && seed >= 1 && seed <= 999999) state.seed = seed;
    else notes.push('The challenge number in the link wasn’t valid, so a new challenge was picked.');
  }
  if (params.has('snap')) {
    const snap = params.get('snap');
    if (snap === '1' || snap === '0') state.snap = snap === '1';
    else notes.push('The “snap to arrivals” setting in the link wasn’t valid, so the default was used.');
  }
  if (params.has('x') || params.has('y')) {
    const x = num(params.get('x')), y = num(params.get('y'));
    if (Number.isFinite(x) && Number.isFinite(y) && x >= 0 && x <= REGION.width && y >= 0 && y <= REGION.height) state.quake = { x, y };
    else notes.push('The earthquake position in the link was outside the map, so the default position was used.');
  }
  if (params.has('m')) {
    const m = num(params.get('m'));
    if (Number.isFinite(m) && m >= MAGNITUDE_RANGE[0] && m <= MAGNITUDE_RANGE[1]) state.magnitude = m;
    else notes.push('The magnitude in the link was out of range, so the default was used.');
  }
  return { state, notes };
}

export function serializeState({ mode, seed, snap, quake, magnitude }) {
  const params = new URLSearchParams();
  params.set('mode', MODES.includes(mode) ? mode : 'guided');
  if (mode === 'challenge' && seed) params.set('seed', String(seed));
  if (mode !== 'explore' && typeof snap === 'boolean') params.set('snap', snap ? '1' : '0');
  if (mode === 'explore' && quake) { params.set('x', String(Math.round(quake.x))); params.set('y', String(Math.round(quake.y))); }
  if (mode === 'explore' && typeof magnitude === 'number') params.set('m', magnitude.toFixed(1));
  return params.toString();
}
