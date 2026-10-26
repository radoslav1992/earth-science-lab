// Shareable Rock Cycle Builder journeys in the URL query string, e.g.
//   ?start=granite&steps=up.we.dm.cc.h1      (a journey that replays step by step)     or     ?mode=challenge
// Invalid values fall back to defaults, and each fallback produces a friendly note. A step that can't
// happen (or isn't a process at all) ends the replay there, keeping the steps before it.
import { START_IDS, DEFAULT_START, CODES, MATERIALS, replay, stepName } from './rock-cycle.mjs';

export const MODES = ['explore', 'challenge'];
export const MAX_STEPS = 40;
export const DEFAULT_STATE = { mode: 'explore', start: DEFAULT_START, steps: [] };
const quoted = value => `“${value.length > 24 ? value.slice(0, 24) + '…' : value}”`;

export function parseRockState(search) {
  const params = new URLSearchParams(search);
  const notes = [];
  const state = { ...DEFAULT_STATE, steps: [] };
  if (params.has('mode')) {
    const mode = params.get('mode');
    if (MODES.includes(mode)) state.mode = mode;
    else notes.push(`${quoted(mode)} isn’t a mode here, so the builder opened in Explore mode.`);
  }
  if (params.has('start')) {
    const start = params.get('start');
    if (START_IDS.includes(start)) state.start = start;
    else notes.push(`${quoted(start)} isn’t a starting rock here, so the journey starts from ${MATERIALS[DEFAULT_START].name.toLowerCase()}.`);
  }
  if (params.has('steps') && params.get('steps').trim() !== '') {
    let codes = params.get('steps').split('.');
    if (codes.length > MAX_STEPS) {
      notes.push(`The link has more than ${MAX_STEPS} steps, so only the first ${MAX_STEPS} are used.`);
      codes = codes.slice(0, MAX_STEPS);
    }
    const bad = codes.findIndex(code => !CODES.includes(code));
    const known = bad < 0 ? codes : codes.slice(0, bad);
    const run = replay(state.start, known);
    if (run.stoppedAt >= 0) {
      notes.push(`Step ${run.stoppedAt + 1} in the link (${stepName(known[run.stoppedAt]).toLowerCase()}) can’t happen there: ${run.reason} The journey stops after step ${run.stoppedAt}.`);
      state.steps = known.slice(0, run.stoppedAt);
    } else {
      state.steps = known;
      if (bad >= 0) notes.push(`Step ${bad + 1} in the link (${quoted(codes[bad])}) isn’t a process here, so the journey stops after step ${bad}.`);
    }
  }
  return { state, notes };
}

export function serializeRockState({ mode, start, steps }) {
  const params = new URLSearchParams();
  if (mode === 'challenge') { params.set('mode', 'challenge'); return params.toString(); }
  const safeStart = START_IDS.includes(start) ? start : DEFAULT_START;
  params.set('start', safeStart);
  // Keep only the steps that replay cleanly from that start.
  const run = replay(safeStart, (steps ?? []).filter(code => CODES.includes(code)).slice(0, MAX_STEPS));
  const codes = run.steps.map(s => s.code);
  if (codes.length) params.set('steps', codes.join('.'));
  return params.toString();
}
