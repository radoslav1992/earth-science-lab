// Shareable Contour Map Playground settings in the URL query string, e.g.
//   ?preset=river&sea=0&ci=20&ov=index,vrule&ab=600,1200,5400,3100&view=3d     or     ?mode=challenge&preset=hill&…
// Hand-sculpted changes are not part of the link (they stay in this browser's local storage).
// Invalid values fall back to defaults, and each fallback produces a friendly note.
import { PRESET_IDS, DEFAULT_PRESET, WIDTH, HEIGHT } from './terrain.mjs';
import { OVERLAYS } from './contour-svg.mjs';

export const MODES = ['sculpt', 'challenge'];
export const INTERVALS = [10, 20, 50];
export const SEA_RANGE = [0, 600];
// The cross-section line shown until someone draws their own, in meters from the north-west corner.
export const DEFAULT_LINE = { a: { x: 700, y: 2900 }, b: { x: 5300, y: 1300 } };
export const DEFAULT_STATE = { mode: 'sculpt', preset: DEFAULT_PRESET, sea: 0, interval: 20, overlays: ['index'], line: DEFAULT_LINE, view: '2d' };

const num = value => (value === null || value.trim() === '' ? NaN : Number(value));

export function parseState(search) {
  const params = new URLSearchParams(search);
  const notes = [];
  const state = { ...DEFAULT_STATE, overlays: [...DEFAULT_STATE.overlays] };
  if (params.has('mode')) {
    const mode = params.get('mode');
    if (MODES.includes(mode)) state.mode = mode;
    else notes.push(`“${mode}” isn't a mode here, so the playground opened in Sculpt mode.`);
  }
  if (params.has('preset')) {
    const preset = params.get('preset');
    if (PRESET_IDS.includes(preset)) state.preset = preset;
    else notes.push(`There is no “${preset}” landscape, so the single hill was loaded.`);
  }
  if (params.has('sea')) {
    const sea = num(params.get('sea'));
    if (Number.isInteger(sea) && sea >= SEA_RANGE[0] && sea <= SEA_RANGE[1]) state.sea = sea;
    else notes.push('The sea level in the link was out of range, so it was set to 0 m.');
  }
  if (params.has('ci')) {
    const ci = num(params.get('ci'));
    if (INTERVALS.includes(ci)) state.interval = ci;
    else notes.push('Contour intervals here are 10, 20 or 50 m, so the link’s interval was replaced with 20 m.');
  }
  if (params.has('ov')) {
    const names = params.get('ov') === 'none' ? [] : params.get('ov').split(',');
    const valid = names.filter(name => OVERLAYS.includes(name));
    if (valid.length === names.length) state.overlays = OVERLAYS.filter(name => valid.includes(name));
    else notes.push('Some overlays in the link weren’t recognized, so the default overlays were used.');
  }
  if (params.has('ab')) {
    const v = params.get('ab').split(',').map(num);
    const inside = (x, y) => x >= 0 && x <= WIDTH && y >= 0 && y <= HEIGHT;
    if (v.length === 4 && v.every(Number.isFinite) && inside(v[0], v[1]) && inside(v[2], v[3]) && Math.hypot(v[2] - v[0], v[3] - v[1]) >= 100) {
      state.line = { a: { x: v[0], y: v[1] }, b: { x: v[2], y: v[3] } };
    } else notes.push('The cross-section line in the link was outside the map, so the standard line was drawn.');
  }
  if (params.has('view')) {
    const view = params.get('view');
    if (view === '2d' || view === '3d') state.view = view;
    else notes.push('The landscape view in the link wasn’t recognized, so the flat view was used.');
  }
  return { state, notes };
}

export function serializeState({ mode, preset, sea, interval, overlays, line, view }) {
  const params = new URLSearchParams();
  if (mode === 'challenge') params.set('mode', 'challenge');
  params.set('preset', PRESET_IDS.includes(preset) ? preset : DEFAULT_PRESET);
  params.set('sea', String(Math.round(sea ?? 0)));
  params.set('ci', String(INTERVALS.includes(interval) ? interval : 20));
  const ov = OVERLAYS.filter(name => overlays?.includes(name));
  params.set('ov', ov.length ? ov.join(',') : 'none');
  if (line) params.set('ab', [line.a.x, line.a.y, line.b.x, line.b.y].map(v => Math.round(v)).join(','));
  if (view === '3d') params.set('view', '3d');
  return params.toString().replace(/%2C/g, ',');
}
