// Shareable Rock Layers Lab settings in the URL query string, e.g.
//   ?part=layers&section=tilted      (a cross-section to put in order)     or     ?part=decay&iso=k40&left=25
// Invalid values fall back to defaults, and each fallback produces a friendly note.
import { SECTION_IDS, DEFAULT_SECTION, ISOTOPE_IDS, DEFAULT_ISOTOPE, MAX_HALF_LIVES, sectionById, isotope } from './rock-layers.mjs';

export const PARTS = ['layers', 'decay'];
/** Smallest share of the parent the decay lab shows: what is left after MAX_HALF_LIVES half-lives. */
export const MIN_LEFT = 100 * 0.5 ** MAX_HALF_LIVES;
export const DEFAULT_STATE = { part: 'layers', section: DEFAULT_SECTION, iso: DEFAULT_ISOTOPE, left: 50 };
const quoted = value => `“${value.length > 24 ? value.slice(0, 24) + '…' : value}”`;
const num = value => (value === null || value.trim() === '' ? NaN : Number(value));
/** A percentage as it appears in a link: up to four significant figures. */
export const linkPercent = left => String(Number(left.toPrecision(4)));

export function parseLayersState(search) {
  const params = new URLSearchParams(search);
  const notes = [];
  const state = { ...DEFAULT_STATE };
  if (params.has('part')) {
    const part = params.get('part');
    if (PARTS.includes(part)) state.part = part;
    else notes.push(`${quoted(part)} isn’t a part of this lab, so it opened at part 1, the rock layers.`);
  }
  if (params.has('section')) {
    const section = params.get('section');
    if (SECTION_IDS.includes(section)) state.section = section;
    else notes.push(`${quoted(section)} isn’t a cross-section here, so the first one, “${sectionById(DEFAULT_SECTION).name}”, is shown.`);
  }
  if (params.has('iso')) {
    const iso = params.get('iso');
    if (ISOTOPE_IDS.includes(iso)) state.iso = iso;
    else notes.push(`${quoted(iso)} isn’t an isotope pair here, so ${isotope(DEFAULT_ISOTOPE).parent.toLowerCase()} is shown.`);
  }
  if (params.has('left')) {
    const left = num(params.get('left'));
    if (Number.isFinite(left) && left >= MIN_LEFT && left <= 100) state.left = left;
    else notes.push(`The percentage of parent left in the link must be between ${linkPercent(MIN_LEFT)} and 100, so ${DEFAULT_STATE.left}% is shown.`);
  }
  return { state, notes };
}

export function serializeLayersState({ part, section, iso, left }) {
  const params = new URLSearchParams();
  if (part === 'decay') {
    params.set('part', 'decay');
    params.set('iso', ISOTOPE_IDS.includes(iso) ? iso : DEFAULT_ISOTOPE);
    const safe = Number.isFinite(left) ? Math.min(100, Math.max(MIN_LEFT, left)) : DEFAULT_STATE.left;
    params.set('left', linkPercent(safe));
    return params.toString();
  }
  params.set('part', 'layers');
  params.set('section', SECTION_IDS.includes(section) ? section : DEFAULT_SECTION);
  return params.toString();
}
