// Earthquake Epicenter Finder: Guided, Challenge and Explore modes on top of the shared model.
// All numbers come from src/lib/seismology.mjs, all traces from src/lib/seismogram.mjs.
import {
  GUIDED, EXPLORE_DEFAULT, STATIONS, TOWNS, REGION, VP, VS, RECORD_SECONDS,
  readings, picked, distance, round, trilaterate, errorTriangle, circleIntersections,
  scenario, roundSeed, roundScore, localMagnitude,
} from '../lib/seismology.mjs';
import { xForTime, timeForX, traceSamples, tracePath, traceSeed, graphX, graphY } from '../lib/seismogram.mjs';
import { parseState, serializeState } from '../lib/share-state.mjs';
import { track } from '../lib/analytics';

type Mode = 'guided' | 'challenge' | 'explore';
type Kind = 'p' | 's';
type Point = { x: number; y: number };
type Station = (typeof STATIONS)[number];
type Reading = { station: Station; distance: number; p: number; s: number; lag: number; amplitude: number };
type Scenario = { quake: Point; magnitude: number; origin: number };
type Pick = { p: number | null; s: number | null; km: number | null; kmSource: 'calc' | 'typed' | 'drag' | null; active: Kind; angle: number };

const NS = 'http://www.w3.org/2000/svg';
const ROUNDS = 3;
const SNAP_SECONDS = 6;
const PLAY_SPEED = 20; // simulated seconds per real second: 200 s of shaking in 10 s
const MAX_KM = 800;

const INTRO: Record<Mode, string> = {
  guided: 'Guided example: an earthquake has just been recorded at three seismograph stations. Follow the four steps to find where it started. Hints tell you if a reading looks off.',
  challenge: 'Challenge: three mystery earthquakes. Read the seismograms, draw your circles and click the epicenter. Each quake scores up to 100 points, minus one point for every kilometer you are off.',
  explore: 'Explore: drag the earthquake ★ anywhere on the map (or use the arrow keys) and change its magnitude. Watch the S–P lags grow as the stations get farther away, then press Play waves.',
};
const HELP: Record<Mode, string> = {
  guided: 'Type each distance or drag a circle’s edge. Then click where the three circles meet. Arrow keys move your guess.',
  challenge: 'Type each distance or drag a circle’s edge. Then click where the three circles meet. Arrow keys move your guess.',
  explore: 'Drag the star, or focus the map and use the arrow keys (Shift for 1 km steps). Dashed circles show each station’s true distance.',
};

const svg = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, parent?: Element) => {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  parent?.append(node);
  return node;
};
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const lagOf = (pk: Pick) => (pk.p !== null && pk.s !== null && pk.s > pk.p ? round(pk.s - pk.p, 1) : null);
const fmtAmp = (a: number) => (a >= 1 ? a.toFixed(1) : a.toPrecision(2));
const starPath = (cx: number, cy: number, r: number) => {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r;
    d += `${i ? 'L' : 'M'}${(cx + rr * Math.cos(a)).toFixed(1)} ${(cy + rr * Math.sin(a)).toFixed(1)}`;
  }
  return d + 'Z';
};

/** "about 40 km south-west of Pinecrest", for screen readers and result text. */
function describe(p: Point) {
  const town = TOWNS.reduce((best, t) => (distance(t, p) < distance(best, p) ? t : best));
  const d = distance(town, p);
  if (d < 8) return `right by ${town.name}`;
  const dirs = ['east', 'north-east', 'north', 'north-west', 'west', 'south-west', 'south', 'south-east'];
  const angle = Math.atan2(-(p.y - town.y), p.x - town.x);
  const dir = dirs[(Math.round(angle / (Math.PI / 4)) + 8) % 8];
  return `about ${Math.round(d)} km ${dir} of ${town.name}`;
}

function toSvg(target: SVGSVGElement, event: MouseEvent): Point {
  const m = target.getScreenCTM();
  if (!m) return { x: 0, y: 0 };
  const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(m.inverse());
  return { x: p.x, y: p.y };
}

export function initFinder(root: HTMLElement) {
  const $ = <T extends Element = HTMLElement>(sel: string, scope: ParentNode = root) => scope.querySelector(sel) as T;
  const map = $<SVGSVGElement>('[data-map]');
  const layer = (name: string) => $<SVGGElement>(`[data-layer="${name}"]`, map);
  const cards = [...root.querySelectorAll<HTMLElement>('[data-station]')];
  const resultEl = $('[data-result]');
  const live = $('[data-live]');
  const noteEl = $('[data-note]');
  const revealBtn = $<HTMLButtonElement>('[data-reveal]');
  const playBtn = $<HTMLButtonElement>('[data-play]');
  const snapBox = $<HTMLInputElement>('[data-snap]');
  const magnitudeInput = $<HTMLInputElement>('[data-magnitude]');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

  const { state: shared, notes } = parseState(location.search);
  const state = {
    mode: shared.mode as Mode,
    snap: shared.snap ?? true,
    seed: shared.seed ?? 0,
    round: 0,
    scores: [] as number[],
    explore: { quake: shared.quake ?? { ...EXPLORE_DEFAULT.quake }, magnitude: shared.magnitude ?? EXPLORE_DEFAULT.magnitude },
    current: GUIDED as Scenario,
    readings: [] as Reading[],
    samples: [] as number[][],
    picks: [] as Pick[],
    guess: null as Point | null,
    revealed: false,
    playT: RECORD_SECONDS,
    playing: false,
  };
  let raf = 0, lastFrame = 0, pausedByHidden = false;

  const announce = (message: string) => { live.textContent = message; };
  const showNote = (message: string) => { noteEl.textContent = message; noteEl.hidden = !message; };
  if (notes.length) showNote(notes.join(' '));

  // ---------- scenario ----------
  function scenarioNow(): { key: number; sc: Scenario } {
    if (state.mode === 'guided') return { key: 1, sc: GUIDED };
    if (state.mode === 'challenge') { const key = roundSeed(state.seed, state.round); return { key, sc: scenario(key) }; }
    return { key: 7, sc: { quake: state.explore.quake, magnitude: state.explore.magnitude, origin: EXPLORE_DEFAULT.origin } };
  }

  function compute() {
    const { key, sc } = scenarioNow();
    state.current = sc;
    state.readings = readings(sc) as Reading[];
    state.samples = state.readings.map((r, i) => traceSamples({ p: r.p, s: r.s, seed: traceSeed(key, i) }));
  }

  function load() {
    stopPlay();
    compute();
    state.picks = state.readings.map(() => ({ p: null, s: null, km: null, kmSource: null, active: 'p', angle: -Math.PI / 4 }));
    state.guess = null;
    state.revealed = false;
    state.playT = RECORD_SECONDS;
    cards.forEach(card => card.querySelectorAll<HTMLInputElement>('input').forEach(input => { input.value = ''; }));
    playBtn.textContent = 'Play waves';
    render();
  }

  // ---------- rendering ----------
  function gain(r: Reading) {
    if (state.mode !== 'explore') return 1;
    return clamp(0.2 + (0.8 * (Math.log10(r.amplitude) + 1)) / 3.5, 0.12, 1);
  }

  function renderTraces() {
    cards.forEach((card, i) => {
      const g = gain(state.readings[i]);
      const samples = g === 1 ? state.samples[i] : state.samples[i].map(v => v * g);
      card.querySelector('.trace-line')!.setAttribute('d', tracePath(samples, state.playT));
    });
  }

  function renderStation(i: number) {
    const card = cards[i], pk = state.picks[i], r = state.readings[i], explore = state.mode === 'explore';
    const lag = lagOf(pk);
    for (const kind of ['p', 's'] as Kind[]) {
      const g = card.querySelector(`[data-pick="${kind}"]`)!;
      const t = explore ? (state.playT >= r[kind] ? r[kind] : null) : pk[kind];
      if (t === null) g.setAttribute('visibility', 'hidden');
      else { g.removeAttribute('visibility'); g.setAttribute('transform', `translate(${xForTime(t).toFixed(1)} 0)`); }
      g.classList.toggle('active', !explore && pk.active === kind);
      const input = card.querySelector<HTMLInputElement>(`[data-field="${kind}"]`)!;
      if (document.activeElement !== input) input.value = pk[kind] === null ? '' : pk[kind]!.toFixed(1);
    }
    const kmInput = card.querySelector<HTMLInputElement>('[data-field="km"]')!;
    if (document.activeElement !== kmInput) kmInput.value = pk.km === null ? '' : String(Math.round(pk.km));
    card.querySelector('[data-lag]')!.textContent = lag !== null ? `${lag.toFixed(1)} s` : pk.p !== null && pk.s !== null ? 'S comes after P' : '–';
    card.querySelector<HTMLButtonElement>('[data-calc]')!.disabled = lag === null;

    const working = card.querySelector('[data-working]')!;
    working.textContent = explore ? ''
      : pk.kmSource === 'calc' && lag !== null ? `${lag.toFixed(1)} s × 8.4 km/s = ${Math.round(pk.km!)} km`
      : pk.kmSource === 'drag' && pk.km !== null ? `Circle drawn by hand: ${Math.round(pk.km)} km`
      : lag !== null && pk.km === null ? 'Now turn the lag into a distance: lag × 8.4 (or press × 8.4).' : '';

    const hint = card.querySelector('[data-pick-hint]')!;
    hint.toggleAttribute('hidden', explore);
    hint.innerHTML = pk.p === null ? 'Click where the first small wiggles start: the <b>P wave</b>.'
      : pk.s === null ? 'Now click where the big wiggles start: the <b>S wave</b>.'
      : 'Click near a marker to move it, or press <b>P</b> or <b>S</b> and use the arrow keys.';

    // Guided hints: compare with the true arrivals.
    const feedback = card.querySelector<HTMLElement>('[data-feedback]')!;
    let message = '', good = false;
    if (state.mode === 'guided' && pk.p !== null && pk.s !== null) {
      const dp = pk.p - r.p, ds = pk.s - r.s;
      const off = (d: number) => `about ${Math.max(1, Math.round(Math.abs(d)))} s too ${d < 0 ? 'early' : 'late'}`;
      if (Math.abs(dp) > 1.5) message = `Your P marker is ${off(dp)}. P is where the line first starts to wiggle.`;
      else if (Math.abs(ds) > 1.5) message = `Your S marker is ${off(ds)}. S is where the wiggles suddenly get much bigger.`;
      else if (lag !== null && pk.km !== null && Math.abs(pk.km - lag * 8.4) > 3) message = `Check the distance: ${lag.toFixed(1)} × 8.4 = ${Math.round(lag * 8.4)} km.`;
      else { good = true; message = pk.km === null ? '✓ Good reading.' : '✓ Good reading and distance.'; }
    }
    feedback.hidden = !message;
    feedback.textContent = message;
    feedback.className = `feedback ${good ? 'good' : 'hint'}`;

    const status = card.querySelector('[data-station-status]')!;
    status.textContent = explore ? `${Math.round(r.distance)} km away`
      : pk.km !== null ? `${Math.round(pk.km)} km`
      : lag !== null ? `Lag ${lag.toFixed(1)} s`
      : pk.p !== null ? 'P marked' : 'Not read yet';
    status.classList.toggle('good', !explore && pk.km !== null);
    card.querySelector('[data-amplitude]')!.textContent = fmtAmp(r.amplitude);
    const readout = card.querySelector<HTMLElement>('[data-explore-readout]')!;
    readout.hidden = !explore;
    if (explore) readout.innerHTML = `P <b>${r.p.toFixed(1)} s</b> · S <b>${r.s.toFixed(1)} s</b> · S–P lag <b>${r.lag.toFixed(1)} s</b> → <b>${Math.round(r.distance)} km</b>`;
    card.querySelector<HTMLElement>('[data-student-fields]')!.hidden = explore;
  }

  /** Where a circle's drag handle starts: on the map, as far from the middle (where circles cross) as possible. */
  function handleAngle(c: { x: number; y: number; r: number }) {
    let best = Math.atan2(REGION.height / 2 - c.y, REGION.width / 2 - c.x), bestScore = -1;
    for (let k = 0; k < 24; k++) {
      const a = (k * Math.PI) / 12, x = c.x + c.r * Math.cos(a), y = c.y + c.r * Math.sin(a);
      if (x < 15 || x > REGION.width - 15 || y < 15 || y > REGION.height - 15) continue;
      const score = Math.hypot(x - REGION.width / 2, y - REGION.height / 2);
      if (score > bestScore) { best = a; bestScore = score; }
    }
    return best;
  }

  /** Circles as the student drew them (only stations with a distance). */
  const studentCircles = () => state.picks.map((pk, i) => (pk.km ? { x: STATIONS[i].x, y: STATIONS[i].y, r: pk.km } : null));
  const trueCircles = () => state.readings.map(r => ({ x: r.station.x, y: r.station.y, r: r.distance }));

  function renderMap() {
    const explore = state.mode === 'explore', truth = state.current.quake;
    const circles = layer('circles'), handles = layer('handles'), truthLayer = layer('truth');
    const focusedHandle = (document.activeElement as Element | null)?.closest?.('.circle-handle')?.getAttribute('data-i');
    for (const name of ['true-circles', 'circles', 'triangle', 'ambiguity', 'error', 'truth', 'guess', 'handles']) layer(name).replaceChildren();

    if (explore || state.revealed) {
      trueCircles().forEach((c, i) => svg('circle', { class: 'true-circle', cx: c.x, cy: c.y, r: c.r, ...(explore ? { style: `stroke:${STATIONS[i].color}` } : {}) }, layer('true-circles')));
    }
    if (!explore) {
      studentCircles().forEach((c, i) => {
        if (!c) return;
        const st = STATIONS[i], pk = state.picks[i];
        svg('circle', { class: 'circle-fill', cx: c.x, cy: c.y, r: c.r, fill: st.color }, circles);
        svg('circle', { class: 'circle', cx: c.x, cy: c.y, r: c.r, stroke: st.color }, circles);
        if (state.revealed) return;
        svg('circle', { class: 'circle-hit', cx: c.x, cy: c.y, r: c.r, 'data-i': i }, circles);
        const angle = pk.kmSource === 'drag' ? pk.angle : handleAngle(c);
        const handle = svg('circle', {
          class: 'circle-handle', cx: (c.x + c.r * Math.cos(angle)).toFixed(1), cy: (c.y + c.r * Math.sin(angle)).toFixed(1), r: 8, fill: st.color,
          tabindex: 0, role: 'slider', 'aria-label': `${st.name} circle radius`, 'aria-valuemin': 0, 'aria-valuemax': MAX_KM,
          'aria-valuenow': Math.round(c.r), 'aria-valuetext': `${Math.round(c.r)} km`, 'data-i': i,
        }, handles);
        if (focusedHandle === String(i)) handle.focus();
      });
    }

    if (state.revealed && !explore) {
      const drawn = studentCircles();
      if (drawn.every(Boolean)) {
        const tri = errorTriangle(drawn as { x: number; y: number; r: number }[], state.guess ?? truth);
        svg('polygon', { class: 'error-triangle', points: tri.points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') }, layer('triangle'));
      }
      const amb = ambiguity();
      if (amb) {
        svg('circle', { cx: amb.decoy.x, cy: amb.decoy.y, r: 10 }, layer('ambiguity'));
        svg('text', { x: amb.decoy.x + 14, y: amb.decoy.y + 5 }, layer('ambiguity')).textContent = '?';
        svg('circle', { cx: truth.x, cy: truth.y, r: 16 }, layer('ambiguity'));
      }
      if (state.guess) {
        const g = state.guess, err = distance(g, truth);
        svg('line', { class: 'error-line', x1: g.x, y1: g.y, x2: truth.x, y2: truth.y }, layer('error'));
        if (err > 12) svg('text', { class: 'error-label', x: (g.x + truth.x) / 2 + 8, y: (g.y + truth.y) / 2 - 6 }, layer('error')).textContent = `${err.toFixed(1)} km`;
      }
      const star = svg('g', { class: 'epicenter' }, truthLayer);
      svg('path', { d: starPath(truth.x, truth.y, 13) }, star);
      svg('text', { x: truth.x + 16, y: truth.y - 10 }, star).textContent = 'Epicenter';
    }
    if (explore) {
      const marker = svg('g', { class: 'epicenter quake-marker' }, truthLayer);
      svg('path', { d: starPath(truth.x, truth.y, 15) }, marker);
    }
    if (state.guess && !explore) {
      const g = svg('g', { class: 'guess', transform: `translate(${state.guess.x.toFixed(1)} ${state.guess.y.toFixed(1)})` }, layer('guess'));
      svg('circle', { r: 9 }, g);
      svg('path', { d: 'M-14 0H-4M4 0H14M0 -14V-4M0 4V14' }, g);
    }
    renderWaves();
  }

  function renderWaves() {
    const waves = layer('waves');
    waves.replaceChildren();
    if (state.mode !== 'explore' || state.playT >= RECORD_SECONDS) return;
    const t = Math.max(0, state.playT - state.current.origin), q = state.current.quake;
    if (t <= 0) return;
    svg('circle', { class: 'wavefront s', cx: q.x, cy: q.y, r: (VS * t).toFixed(1) }, waves);
    svg('circle', { class: 'wavefront p', cx: q.x, cy: q.y, r: (VP * t).toFixed(1) }, waves);
  }

  /** The two crossings of one pair of true circles: the epicenter and a "decoy" a third station rules out. */
  function ambiguity() {
    const truth = state.current.quake, circles = trueCircles();
    let best: { pair: number[]; decoy: Point } | null = null;
    for (const pair of [[0, 1], [1, 2], [0, 2]]) {
      const hits = circleIntersections(circles[pair[0]], circles[pair[1]]);
      if (hits.length < 2) continue;
      const decoy = hits.reduce((a, b) => (distance(a, truth) > distance(b, truth) ? a : b));
      const inside = decoy.x > 10 && decoy.x < REGION.width - 10 && decoy.y > 10 && decoy.y < REGION.height - 10;
      if (inside && distance(decoy, truth) > 20 && (!best || distance(decoy, truth) > distance(best.decoy, truth))) best = { pair, decoy };
    }
    return best;
  }

  function renderGraph() {
    const marks = root.querySelector('[data-graph-marks]');
    if (!marks) return;
    marks.replaceChildren();
    state.readings.forEach((r, i) => {
      const lag = state.mode === 'explore' ? r.lag : lagOf(state.picks[i]);
      if (lag === null) return;
      const km = Math.min(600, lag * 8.4), x = graphX(km);
      svg('line', { x1: x, y1: graphY(km / VP), x2: x, y2: graphY(km / VS), stroke: r.station.color, 'stroke-width': 3.5 }, marks);
      svg('text', { x: x + 5, y: graphY(km / VS) - 6, style: `fill:${r.station.color};font-weight:700` }, marks).textContent = r.station.code;
    });
  }

  function renderSteps() {
    const stepper = $('[data-stepper]');
    stepper.hidden = state.mode === 'explore';
    const done = [
      state.picks.every(pk => lagOf(pk) !== null),
      state.picks.every(pk => pk.km !== null),
      state.guess !== null,
      state.revealed,
    ];
    const current = done.indexOf(false);
    stepper.querySelectorAll('li').forEach((li, i) => {
      li.className = done[i] ? 'done' : i === current ? 'current' : '';
      if (i === current) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
    });
  }

  function renderPanel() {
    const explore = state.mode === 'explore';
    $('[data-reveal-row]').hidden = explore;
    $('[data-explore-panel]').hidden = !explore;
    revealBtn.disabled = !state.guess || state.revealed;
    const readout = $('[data-guess-readout]');
    readout.textContent = state.revealed ? 'Epicenter revealed.'
      : state.guess ? `Your guess: ${Math.round(state.guess.x)} km east, ${Math.round(state.guess.y)} km south (${describe(state.guess)}).`
      : 'Place your guess on the map first.';
    if (explore) {
      const near = state.readings.reduce((a, b) => (a.distance < b.distance ? a : b));
      $('[data-explore-summary]').textContent = `Quake ${describe(state.current.quake)}. Nearest station: ${near.station.name}, ${Math.round(near.distance)} km.`;
      $('[data-magnitude-out]').textContent = state.explore.magnitude.toFixed(1);
      magnitudeInput.value = String(state.explore.magnitude);
    }
    const bar = $('[data-challenge-bar]');
    bar.hidden = state.mode !== 'challenge';
    if (state.mode === 'challenge') {
      $('[data-round]').textContent = String(state.round + 1);
      $('[data-score]').textContent = String(state.scores.reduce((a, b) => a + b, 0));
      $('[data-challenge-code]').textContent = `Challenge #${state.seed}`;
    }
  }

  function renderResult() {
    resultEl.hidden = !state.revealed || state.mode === 'explore';
    if (resultEl.hidden || !state.guess) return;
    const truth = state.current.quake, err = distance(state.guess, truth);
    const rating = err <= 5 ? 'Bullseye!' : err <= 15 ? 'Very close!' : err <= 40 ? 'Close.' : 'Not quite: check your readings and try again.';
    const drawn = studentCircles();
    const items: string[] = [];
    if (drawn.every(Boolean)) {
      const circles = drawn as { x: number; y: number; r: number }[];
      const fit = trilaterate(circles)!, tri = errorTriangle(circles, state.guess);
      items.push(`Your three circles leave an <strong>error triangle about ${tri.size.toFixed(1)} km across</strong> (shaded). The smaller it is, the more carefully the seismograms were read.`);
      items.push(`The point that best fits your three circles is ${distance(fit, truth).toFixed(1)} km from the true epicenter.`);
    } else {
      items.push(`You drew ${drawn.filter(Boolean).length} of 3 circles. With all three distances the answer becomes certain.`);
    }
    const amb = ambiguity();
    const why = amb
      ? `One station only gives a distance, so the quake could be anywhere on that circle. ${STATIONS[amb.pair[0]].name}’s and ${STATIONS[amb.pair[1]].name}’s circles cross at two points (ringed on the map). Only one of them also lies on ${STATIONS[3 - amb.pair[0] - amb.pair[1]].name}’s circle: the epicenter.`
      : 'One station only gives a distance, so the quake could be anywhere on that circle. Two circles usually cross at two points (here the second one falls off the map). The third circle passes through only one of them: the epicenter.';
    let challenge = '';
    if (state.mode === 'challenge') {
      const total = state.scores.reduce((a, b) => a + b, 0);
      challenge = state.round < ROUNDS - 1
        ? `<p><strong>Quake ${state.round + 1} score: ${state.scores[state.round]} / 100.</strong></p><p><button type="button" class="btn primary" data-next>Next quake</button></p>`
        : `<p><strong>Quake ${state.round + 1} score: ${state.scores[state.round]} / 100.</strong></p><p class="big">Challenge complete: ${total} / ${ROUNDS * 100}</p><p>Share this challenge (#${state.seed}) with Copy share link so classmates get the same three quakes.</p><p class="page-actions"><button type="button" class="btn" data-replay>Try these quakes again</button><button type="button" class="btn primary" data-new>New challenge</button></p>`;
    }
    const options = state.readings.map((r, i) => `<option value="${i}">${r.station.name}</option>`).join('');
    resultEl.innerHTML = `
      <h3>${rating}</h3>
      <p class="big">${err.toFixed(1)} km off</p>
      <p>The true epicenter was ${Math.round(truth.x)} km east and ${Math.round(truth.y)} km south, ${describe(truth)}. Your guess is the cross; the true epicenter is the star.</p>
      <ul>${items.map(item => `<li>${item}</li>`).join('')}</ul>
      <p><strong>Why three stations?</strong> ${why}</p>
      ${challenge}
      <div class="magnitude-box">
        <h3>Optional: estimate the magnitude</h3>
        <p>A classroom approximation of the Richter scale uses the largest S-wave swing <em>A</em> (mm) and the S–P lag <em>Δt</em> (s): <strong>M ≈ log₁₀(A) + 3 × log₁₀(8 × Δt) − 2.92</strong></p>
        <div class="row">
          <label class="field"><span>Station</span><select data-mag-station>${options}</select></label>
          <button type="button" class="btn small" data-mag-calc>Estimate magnitude</button>
        </div>
        <p data-mag-out aria-live="polite"></p>
      </div>`;
  }

  function render() {
    renderTraces();
    state.readings.forEach((_, i) => renderStation(i));
    renderMap();
    renderGraph();
    renderSteps();
    renderPanel();
    renderResult();
  }

  /** Light refresh while a student works on one station (keeps the result panel and focus intact). */
  function refreshStation(i: number) {
    renderStation(i);
    renderMap();
    renderGraph();
    renderSteps();
    renderPanel();
  }

  // ---------- modes ----------
  function setMode(mode: Mode, fresh = true) {
    state.mode = mode;
    root.dataset.mode = mode;
    root.querySelectorAll<HTMLButtonElement>('[data-mode-btn]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.modeBtn === mode)));
    $('[data-mode-intro]').textContent = INTRO[mode];
    $('[data-map-help]').textContent = HELP[mode];
    $('[data-snap-label]').hidden = mode === 'explore';
    if (mode === 'challenge' && (fresh || !state.seed)) {
      if (!state.seed) state.seed = 1 + Math.floor(Math.random() * 999999);
      state.round = 0;
      state.scores = [];
    }
    load();
  }

  function newChallenge() {
    state.seed = 1 + Math.floor(Math.random() * 999999);
    state.round = 0;
    state.scores = [];
    load();
    announce(`New challenge #${state.seed}. Quake 1 of ${ROUNDS}.`);
  }

  // ---------- picking arrivals ----------
  function setPick(i: number, kind: Kind, value: number | null) {
    const pk = state.picks[i];
    pk[kind] = value === null ? null : round(clamp(value, 0, RECORD_SECONDS), 1);
    const lag = lagOf(pk);
    if (pk.kmSource === 'calc') pk.km = lag === null ? null : round(lag * 8.4, 1);
  }

  function placeAt(i: number, t: number) {
    const pk = state.picks[i], r = state.readings[i];
    const kind: Kind = pk.p === null ? 'p' : pk.s === null ? (t < pk.p ? 'p' : 's') : Math.abs(t - pk.p) <= Math.abs(t - pk.s) ? 'p' : 's';
    const exact = picked(r);
    const snapped = state.snap && Math.abs(t - r[kind]) <= SNAP_SECONDS;
    setPick(i, kind, snapped ? exact[kind] : t);
    pk.active = kind === 'p' && pk.s === null ? 's' : kind;
    refreshStation(i);
    announce(`${r.station.name}: ${kind.toUpperCase()} marked at ${pk[kind]!.toFixed(1)} seconds${snapped ? ', snapped to the arrival' : ''}.${lagOf(pk) !== null ? ` S–P lag ${lagOf(pk)!.toFixed(1)} seconds.` : ''}`);
  }

  cards.forEach((card, i) => {
    const trace = card.querySelector<SVGSVGElement>('[data-trace]')!;
    trace.addEventListener('click', event => {
      if (state.mode === 'explore') return;
      placeAt(i, clamp(timeForX(toSvg(trace, event).x), 0, RECORD_SECONDS));
    });
    trace.addEventListener('keydown', event => {
      if (state.mode === 'explore') return;
      const pk = state.picks[i];
      const key = event.key.toLowerCase();
      if (key === 'p' || key === 's') { pk.active = key; refreshStation(i); announce(`Moving the ${key.toUpperCase()} marker.`); event.preventDefault(); return; }
      const steps: Record<string, number> = { arrowright: 1, arrowleft: -1, pageup: 10, pagedown: -10 };
      if (!(key in steps)) return;
      event.preventDefault();
      const kind = pk.active;
      const start = pk[kind] ?? (kind === 'p' ? 0 : (pk.p ?? 0) + 1);
      const delta = Math.abs(steps[key]) === 1 && event.shiftKey ? steps[key] * 0.1 : steps[key];
      setPick(i, kind, (pk[kind] === null ? start : start + delta));
      refreshStation(i);
      announce(`${kind.toUpperCase()} at ${pk[kind]!.toFixed(1)} seconds.`);
    });
    card.querySelectorAll<HTMLInputElement>('[data-field="p"], [data-field="s"]').forEach(input => {
      input.addEventListener('input', () => {
        const value = parseFloat(input.value);
        setPick(i, input.dataset.field as Kind, Number.isFinite(value) && value >= 0 && value <= RECORD_SECONDS ? value : null);
        refreshStation(i);
      });
    });
    const kmInput = card.querySelector<HTMLInputElement>('[data-field="km"]')!;
    kmInput.addEventListener('input', () => {
      const value = parseFloat(kmInput.value), pk = state.picks[i];
      pk.km = Number.isFinite(value) && value > 0 && value <= MAX_KM ? value : null;
      pk.kmSource = pk.km === null ? null : 'typed';
      refreshStation(i);
    });
    card.querySelector('[data-calc]')!.addEventListener('click', () => {
      const pk = state.picks[i], lag = lagOf(pk);
      if (lag === null) return;
      pk.km = round(lag * 8.4, 1);
      pk.kmSource = 'calc';
      refreshStation(i);
      announce(`${STATIONS[i].name}: ${lag.toFixed(1)} times 8.4 is ${Math.round(pk.km)} kilometers. Circle drawn.`);
    });
  });

  // ---------- map: guess, circle drags and the Explore quake ----------
  // A press on a circle's edge only resizes it once the pointer moves; a plain click still places the guess,
  // since the best place to click is exactly where the circles' edges cross.
  type Drag = { kind: 'radius'; i: number; x: number; y: number; moved: boolean; handle: boolean } | { kind: 'quake' } | { kind: 'tap'; x: number; y: number };
  let drag: Drag | null = null;

  function moveQuake(p: Point) {
    state.explore.quake = { x: round(clamp(p.x, 0, REGION.width), 0), y: round(clamp(p.y, 0, REGION.height), 0) };
    compute();
    renderTraces();
    state.readings.forEach((_, i) => renderStation(i));
    renderMap();
    renderGraph();
    renderPanel();
  }

  function setGuess(p: Point) {
    if (state.revealed) { announce('This quake is already revealed. Press Reset or go on to the next quake to guess again.'); return; }
    state.guess = { x: clamp(p.x, 0, REGION.width), y: clamp(p.y, 0, REGION.height) };
    renderMap();
    renderSteps();
    renderPanel();
  }

  map.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    const target = event.target as Element;
    const ring = target.closest('[data-i]');
    if (state.mode === 'explore') { drag = { kind: 'quake' }; moveQuake(toSvg(map, event)); event.preventDefault(); }
    else if (ring && !state.revealed) { drag = { kind: 'radius', i: Number(ring.getAttribute('data-i')), x: event.clientX, y: event.clientY, moved: false, handle: ring.matches('.circle-handle') }; event.preventDefault(); }
    else { drag = { kind: 'tap', x: event.clientX, y: event.clientY }; }
    map.setPointerCapture(event.pointerId);
  });
  map.addEventListener('pointermove', event => {
    if (!drag || drag.kind === 'tap') return;
    const p = toSvg(map, event);
    if (drag.kind === 'quake') { moveQuake(p); return; }
    if (!drag.moved && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 5) return;
    drag.moved = true;
    const st = STATIONS[drag.i], pk = state.picks[drag.i];
    pk.km = round(clamp(distance(p, st), 1, MAX_KM), 1);
    pk.angle = Math.atan2(p.y - st.y, p.x - st.x);
    pk.kmSource = 'drag';
    refreshStation(drag.i);
  });
  map.addEventListener('pointerup', event => {
    const tapped = (drag?.kind === 'tap' && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 8)
      || (drag?.kind === 'radius' && !drag.moved && !drag.handle);
    if (tapped) {
      setGuess(toSvg(map, event));
      if (state.guess && !state.revealed) announce(`Guess placed ${Math.round(state.guess.x)} km east, ${Math.round(state.guess.y)} km south, ${describe(state.guess)}.`);
    } else if (drag?.kind === 'radius' && drag.moved) announce(`${STATIONS[drag.i].name} circle: ${Math.round(state.picks[drag.i].km!)} kilometers.`);
    if (drag?.kind === 'quake') announce(`Earthquake moved ${describe(state.current.quake)}.`);
    drag = null;
  });
  map.addEventListener('pointercancel', () => { drag = null; });

  map.addEventListener('keydown', event => {
    const keys: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const handle = (event.target as Element).closest('.circle-handle');
    if (handle) {
      const i = Number(handle.getAttribute('data-i')), pk = state.picks[i];
      const dir = event.key === 'ArrowRight' || event.key === 'ArrowUp' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -1 : 0;
      if (!dir || pk.km === null) return;
      event.preventDefault();
      if (pk.kmSource !== 'drag') pk.angle = handleAngle({ x: STATIONS[i].x, y: STATIONS[i].y, r: pk.km });
      pk.km = clamp(Math.round(pk.km) + dir * (event.shiftKey ? 10 : 1), 1, MAX_KM);
      pk.kmSource = 'drag';
      refreshStation(i);
      return;
    }
    if (!(event.key in keys)) return;
    event.preventDefault();
    const step = event.shiftKey ? 1 : 5, [dx, dy] = keys[event.key];
    if (state.mode === 'explore') {
      const q = state.explore.quake;
      moveQuake({ x: q.x + dx * step, y: q.y + dy * step });
      announce(`Earthquake ${Math.round(state.current.quake.x)} km east, ${Math.round(state.current.quake.y)} km south.`);
      return;
    }
    const g = state.guess ?? { x: REGION.width / 2, y: REGION.height / 2 };
    setGuess(state.guess ? { x: g.x + dx * step, y: g.y + dy * step } : g);
    if (state.guess && !state.revealed) announce(`Guess ${Math.round(state.guess.x)} km east, ${Math.round(state.guess.y)} km south.`);
  });

  // ---------- reveal and challenge rounds ----------
  revealBtn.addEventListener('click', () => {
    if (!state.guess || state.revealed) return;
    state.revealed = true;
    const err = distance(state.guess, state.current.quake);
    if (state.mode === 'challenge') state.scores[state.round] = roundScore(err);
    render();
    track('epicenter_solved', { mode: state.mode, error_km: round(err, 1) });
    if (state.mode === 'challenge' && state.round === ROUNDS - 1) {
      track('epicenter_challenge_complete', { score: state.scores.reduce((a, b) => a + b, 0), seed: state.seed });
    }
    announce(`Epicenter revealed. Your guess was ${err.toFixed(1)} kilometers away.${state.mode === 'challenge' ? ` Score ${state.scores[state.round]} out of 100.` : ''}`);
    resultEl.focus({ preventScroll: true });
    resultEl.scrollIntoView({ block: 'nearest' });
  });

  resultEl.addEventListener('click', event => {
    const target = (event.target as Element).closest('button');
    if (!target) return;
    if (target.matches('[data-next]')) { state.round++; load(); announce(`Quake ${state.round + 1} of ${ROUNDS}. Read the new seismograms.`); cards[0].querySelector<SVGElement>('[data-trace]')?.focus(); }
    else if (target.matches('[data-replay]')) { state.round = 0; state.scores = []; load(); announce(`Challenge #${state.seed} restarted.`); }
    else if (target.matches('[data-new]')) newChallenge();
    else if (target.matches('[data-mag-calc]')) {
      const i = Number(resultEl.querySelector<HTMLSelectElement>('[data-mag-station]')!.value), r = state.readings[i];
      const lag = lagOf(state.picks[i]) ?? picked(r).lag, amplitude = Number(fmtAmp(r.amplitude));
      const m = localMagnitude(amplitude, lag);
      resultEl.querySelector('[data-mag-out]')!.textContent = `With A = ${fmtAmp(r.amplitude)} mm and Δt = ${lag.toFixed(1)} s: M ≈ log₁₀(${fmtAmp(r.amplitude)}) + 3 × log₁₀(${(8 * lag).toFixed(1)}) − 2.92 ≈ ${m.toFixed(1)}. The simulated quake was magnitude ${state.current.magnitude.toFixed(1)}.`;
    }
  });

  // ---------- Explore: magnitude and wave animation ----------
  magnitudeInput.addEventListener('input', () => {
    state.explore.magnitude = round(clamp(parseFloat(magnitudeInput.value), 2.5, 7), 1);
    compute();
    renderTraces();
    state.readings.forEach((_, i) => renderStation(i));
    renderPanel();
  });

  function frame(now: number) {
    state.playT = Math.min(RECORD_SECONDS, state.playT + ((now - lastFrame) / 1000) * PLAY_SPEED);
    lastFrame = now;
    renderTraces();
    renderWaves();
    state.readings.forEach((_, i) => renderStation(i));
    if (state.playT >= RECORD_SECONDS) { state.playing = false; playBtn.textContent = 'Replay waves'; announce('The waves have reached every station.'); return; }
    raf = requestAnimationFrame(frame);
  }
  function startPlay() { state.playing = true; lastFrame = performance.now(); playBtn.textContent = 'Pause'; raf = requestAnimationFrame(frame); }
  function stopPlay() { cancelAnimationFrame(raf); state.playing = false; pausedByHidden = false; }
  playBtn.addEventListener('click', () => {
    if (state.playing) { stopPlay(); playBtn.textContent = 'Resume'; return; }
    if (reduceMotion.matches) {
      state.playT = RECORD_SECONDS;
      render();
      announce('Reduced motion is on, so the complete recordings are shown at once.');
      return;
    }
    if (state.playT >= RECORD_SECONDS) state.playT = 0;
    startPlay();
  });
  // Animations pause while the tab is hidden and pick up where they left off.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.playing) { cancelAnimationFrame(raf); state.playing = false; pausedByHidden = true; }
    else if (!document.hidden && pausedByHidden) { pausedByHidden = false; startPlay(); }
  });

  // ---------- toolbar ----------
  root.querySelectorAll<HTMLButtonElement>('[data-mode-btn]').forEach(button => button.addEventListener('click', () => {
    showNote('');
    setMode(button.dataset.modeBtn as Mode);
    announce(`${button.textContent} mode.`);
  }));
  snapBox.checked = state.snap;
  snapBox.addEventListener('change', () => { state.snap = snapBox.checked; });
  $('[data-reset]').addEventListener('click', () => {
    if (state.mode === 'explore') state.explore = { quake: { ...EXPLORE_DEFAULT.quake }, magnitude: EXPLORE_DEFAULT.magnitude };
    if (state.mode === 'challenge') { state.round = 0; state.scores = []; }
    load();
    announce('Reset.');
  });
  const copyBtn = $<HTMLButtonElement>('[data-copy-link]');
  copyBtn.addEventListener('click', async () => {
    const query = serializeState({ mode: state.mode, seed: state.seed, snap: state.snap, quake: state.explore.quake, magnitude: state.explore.magnitude });
    const url = `${location.origin}${location.pathname}?${query}`;
    try {
      await navigator.clipboard.writeText(url);
      copyBtn.textContent = 'Link copied ✓';
      announce('Share link copied.');
      setTimeout(() => { copyBtn.textContent = 'Copy share link'; }, 2500);
    } catch {
      noteEl.replaceChildren('Copy this link: ');
      const field = Object.assign(document.createElement('input'), { value: url, readOnly: true, className: 'share-field' });
      field.setAttribute('aria-label', 'Share link');
      noteEl.append(field);
      noteEl.hidden = false;
      field.select();
    }
  });

  // Switch everything on and restore the shared state.
  root.querySelectorAll<HTMLButtonElement | HTMLInputElement>('[disabled]').forEach(control => { control.disabled = false; });
  setMode(state.mode, false);
}
