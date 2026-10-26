// Contour Map Playground: sculpting, the shaded-relief landscape (flat or 3D), the live contour map,
// overlays, cross-sections, Match & Read and share links. The model is src/lib/terrain.mjs; the map and
// chart markup come from src/lib/contour-svg.mjs, the same code that draws the server-rendered map.
import {
  createTerrain, sample, slopeAt, profile, applyBrush, presetById, range, encodeHeights, decodeHeights,
  WIDTH, HEIGHT, NX, NY, CELL,
} from '../lib/terrain.mjs';
import { mapLayers, mapSvg, sectionMarkup, profileSvg, describeProfile, SCALE } from '../lib/contour-svg.mjs';
import { hillshade, reliefPixels, rampColor, waterColor, shadeFactor } from '../lib/relief.mjs';
import { parseState, serializeState } from '../lib/contour-share.mjs';
import { CHALLENGES } from '../lib/contour-challenges.mjs';
import { track } from '../lib/analytics';

type Point = { x: number; y: number };
type Line = { a: Point; b: Point };
type Terrain = { preset: string | null; nx: number; ny: number; cell: number; h: Float64Array };
type Tool = 'read' | 'raise' | 'lower' | 'smooth' | 'flatten' | 'section';
type Mode = 'sculpt' | 'challenge';
type Challenge = (typeof CHALLENGES)[number];

const STORAGE_KEY = 'contourSculpt';
const BRUSH_TOOLS = ['raise', 'lower', 'smooth', 'flatten'];
const LAYERS = ['water', 'under', 'lines', 'river', 'labels', 'over'] as const;
const KEY_STEP = 125; // meters per arrow-key press (Shift: 25 m)
const SKY = '#e8eff0';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const km = (m: number) => `${(m / 1000).toFixed(1)} km`;
const rgbText = (c: number[], s = 1) => `rgb(${Math.round(c[0] * s)} ${Math.round(c[1] * s)} ${Math.round(c[2] * s)})`;

function toMeters(target: SVGSVGElement, event: MouseEvent): Point {
  const m = target.getScreenCTM();
  if (!m) return { x: 0, y: 0 };
  const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(m.inverse());
  return { x: clamp(p.x / SCALE, 0, WIDTH), y: clamp(p.y / SCALE, 0, HEIGHT) };
}

/** "1.6 km east, 2.1 km south of the north-west corner: 352 m, slope 12°" for the readout and screen readers. */
function reading(t: Terrain, p: Point, sea: number) {
  const h = sample(t, p.x, p.y), s = slopeAt(t, p.x, p.y);
  const where = `${km(p.x)} east, ${km(p.y)} south of the north-west corner`;
  if (h < sea) return `${where}: under water, ${Math.round(sea - h)} m below sea level.`;
  return `${where}: elevation ${Math.round(h)} m, slope ${Math.round(s.degrees)}° (${Math.round(s.percent)}%).`;
}

/**
 * The landscape as an oblique block seen from the south, drawn row by row from the back (north) to the
 * front so nearer ground covers farther ground. Heights are stretched ×2 when the relief fits.
 * Returns the vertical exaggeration used.
 */
function drawOblique(ctx: CanvasRenderingContext2D, t: Terrain, sea: number, shade: Float32Array, step = 1) {
  const { width: W, height: H } = ctx.canvas;
  ctx.fillStyle = SKY;
  ctx.fillRect(0, 0, W, H);
  const { min, max } = range(t);
  const floor = Math.min(min, sea) - 40, top = Math.max(max, sea);
  const margin = W * 0.04, cw = (W - 2 * margin) / (NX - 1), row = cw * 0.42;
  const base = H - margin * 0.6 - (NY - 1) * row;
  const lift = Math.min((2 * cw) / CELL, (base - margin + (NY - 1) * row * 0.25) / (top - floor));
  const z = (k: number) => Math.max(t.h[k], sea);
  const sx = (i: number) => margin + i * cw;
  const sy = (j: number, h: number) => base + j * row - (h - floor) * lift;
  for (let j = 0; j < NY - 1; j += step) {
    const j2 = Math.min(NY - 1, j + step);
    for (let i = 0; i < NX - 1; i += step) {
      const i2 = Math.min(NX - 1, i + step);
      const k = j * NX + i, h = t.h[k];
      ctx.fillStyle = h < sea ? rgbText(waterColor(sea - h)) : rgbText(rampColor(h), shadeFactor(shade[k]));
      ctx.beginPath();
      ctx.moveTo(sx(i), sy(j, z(k)));
      ctx.lineTo(sx(i2) + 0.6, sy(j, z(j * NX + i2)));
      ctx.lineTo(sx(i2) + 0.6, sy(j2, z(j2 * NX + i2)) + 0.6);
      ctx.lineTo(sx(i), sy(j2, z(j2 * NX + i)) + 0.6);
      ctx.fill();
    }
  }
  // The block's front face (the map's south edge, cut through).
  ctx.beginPath();
  ctx.moveTo(sx(0), sy(NY - 1, floor));
  for (let i = 0; i < NX; i++) ctx.lineTo(sx(i), sy(NY - 1, z((NY - 1) * NX + i)));
  ctx.lineTo(sx(NX - 1), sy(NY - 1, floor));
  ctx.closePath();
  ctx.fillStyle = '#8d6a4c';
  ctx.fill();
  return lift / (cw / CELL);
}

export function initContour(root: HTMLElement) {
  const $ = <T extends Element = HTMLElement>(sel: string, scope: ParentNode = root) => scope.querySelector(sel) as T;
  const map = $<SVGSVGElement>('[data-map]');
  const layer = (name: string, scope: Element = map) => $<SVGGElement>(`[data-layer="${name}"]`, scope);
  const canvas = $<HTMLCanvasElement>('[data-relief]');
  const ctx = canvas.getContext('2d')!;
  const overlay = $<SVGSVGElement>('[data-relief-overlay]');
  const live = $('[data-live]');
  const noteEl = $('[data-note]');
  const readout = $('[data-readout]');
  const sectionText = $('[data-section-text]');
  const profileEl = $('[data-profile]');
  const seaInput = $<HTMLInputElement>('[data-sea]');
  const sizeInput = $<HTMLInputElement>('[data-brush-size]');
  const strengthInput = $<HTMLInputElement>('[data-brush-strength]');
  const view3d = $<HTMLInputElement>('[data-view3d]');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

  const { state: shared, notes } = parseState(location.search);
  const state = {
    mode: shared.mode as Mode,
    preset: shared.preset as string,
    sea: shared.sea as number,
    interval: shared.interval as number,
    overlays: new Set<string>(shared.overlays),
    line: shared.line as Line,
    view: shared.view as '2d' | '3d',
    tool: 'read' as Tool,
    size: 400,
    strength: 5,
    t: createTerrain(shared.preset) as Terrain,
    shade: new Float32Array(0),
    cursor: null as Point | null,
    pendingA: null as Point | null,
    draft: null as Line | null,
  };
  const dirty = { relief: true, map: true, profile: true, marks: true };
  let frame = 0, saveTimer = 0, editTimer = 0;

  const announce = (message: string) => { live.textContent = message; };
  const showNote = (message: string) => { noteEl.textContent = message; noteEl.hidden = !message; };

  // ---------- saved sculpts (one per landscape, in this browser only) ----------
  function savedMaps(): Record<string, string> {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      return saved && saved.v === 1 && typeof saved.maps === 'object' ? saved.maps : {};
    } catch { return {}; }
  }
  function writeMaps(maps: Record<string, string>) {
    try {
      if (Object.keys(maps).length) localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 1, maps }));
      else localStorage.removeItem(STORAGE_KEY);
    } catch { /* storage full or blocked: sculpting still works, it just isn't kept */ }
  }
  function loadTerrain(id: string) {
    const saved = savedMaps()[id];
    const restored = saved ? decodeHeights(saved, id) : null;
    state.t = (restored ?? createTerrain(id)) as Terrain;
    state.shade = hillshade(state.t);
    return Boolean(restored);
  }
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => writeMaps({ ...savedMaps(), [state.preset]: encodeHeights(state.t) }), 600);
    clearTimeout(editTimer);
    editTimer = window.setTimeout(() => track('contour_edit', { preset: state.preset }), 2500);
  }

  // ---------- rendering (at most once per animation frame, never while the page is hidden) ----------
  function requestRender(parts: Partial<typeof dirty> = { relief: true, map: true, profile: true, marks: true }) {
    Object.assign(dirty, parts);
    if (!frame && !document.hidden) frame = requestAnimationFrame(render);
  }
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && Object.values(dirty).some(Boolean)) requestRender({});
  });

  let stroking = false;
  function render() {
    frame = 0;
    if (dirty.relief) {
      dirty.relief = false;
      state.shade = hillshade(state.t);
      if (state.view === '3d') {
        const ve = drawOblique(ctx, state.t, state.sea, state.shade, stroking ? 2 : 1);
        $('[data-view-note]').textContent = `3D view from the south, heights stretched ×${ve.toFixed(1)}. Sculpt on the map.`;
      } else {
        ctx.putImageData(new ImageData(reliefPixels(state.t, { width: canvas.width, height: canvas.height, seaLevel: state.sea, shade: state.shade }), canvas.width, canvas.height), 0, 0);
        $('[data-view-note]').textContent = 'Seen from above, lit from the north-west.';
      }
    }
    if (dirty.map) {
      dirty.map = false;
      const layers = mapLayers(state.t, { interval: state.interval, seaLevel: state.sea, overlays: [...state.overlays] }) as Record<string, string>;
      for (const name of LAYERS) layer(name).innerHTML = layers[name];
    }
    if (dirty.marks) {
      dirty.marks = false;
      const line = state.draft ?? state.line;
      const marks = sectionMarkup(line.a, line.b) + (state.pendingA ? `<g class="cm-section"><circle cx="${(state.pendingA.x * SCALE).toFixed(1)}" cy="${(state.pendingA.y * SCALE).toFixed(1)}" r="4.5"/></g>` : '');
      layer('marks').innerHTML = marks;
      layer('section', overlay).innerHTML = marks;
      renderCursor();
    }
    if (dirty.profile) {
      dirty.profile = false;
      const line = state.draft ?? state.line;
      const chart = profileSvg(profile(state.t, line.a, line.b), { seaLevel: state.sea, label: `Cross-section from A to B across the ${presetById(state.preset).name.toLowerCase()} landscape` });
      profileEl.innerHTML = chart.svg;
      if (!state.draft) sectionText.textContent = describeProfile(chart.stats);
    }
  }

  function renderCursor() {
    const p = state.cursor;
    let markup = '';
    if (p) {
      const x = (p.x * SCALE).toFixed(1), y = (p.y * SCALE).toFixed(1);
      markup = BRUSH_TOOLS.includes(state.tool)
        ? `<circle class="cm-brush" cx="${x}" cy="${y}" r="${(state.size * SCALE).toFixed(1)}"/><circle class="cm-brush-dot" cx="${x}" cy="${y}" r="1.6"/>`
        : `<g class="cm-crosshair"><circle cx="${x}" cy="${y}" r="5"/><path d="M${x} ${(p.y * SCALE - 10).toFixed(1)}v6m0 8v6M${(p.x * SCALE - 10).toFixed(1)} ${y}h6m8 0h6"/></g>`;
    }
    layer('cursor').innerHTML = markup;
    layer('cursor', overlay).innerHTML = markup;
  }

  // ---------- settings ----------
  function setPressed(selector: string, attr: string, value: string) {
    root.querySelectorAll<HTMLButtonElement>(selector).forEach(b => b.setAttribute('aria-pressed', String(b.getAttribute(attr) === value)));
  }
  function setPreset(id: string, announceIt = true) {
    state.preset = id;
    const restored = loadTerrain(id);
    setPressed('[data-preset]', 'data-preset', id);
    canvas.setAttribute('aria-label', `Shaded relief view: ${presetById(id).summary}`);
    requestRender();
    if (announceIt) announce(`${presetById(id).name}: ${presetById(id).summary}.${restored ? ' Your sculpted changes were restored.' : ''}`);
    return restored;
  }
  function setTool(tool: Tool) {
    state.tool = tool;
    state.pendingA = null;
    setPressed('[data-tool]', 'data-tool', tool);
    $('[data-brush-controls]').hidden = !BRUSH_TOOLS.includes(tool);
    root.dataset.tool = tool;
    requestRender({ marks: true });
  }
  function setContourInterval(ci: number) {
    state.interval = ci;
    setPressed('[data-interval]', 'data-interval', String(ci));
    $('[data-interval-note]').textContent = `Contour interval ${ci} m`;
    requestRender({ map: true });
  }
  function setView(view: '2d' | '3d') {
    state.view = view;
    view3d.checked = view === '3d';
    overlay.style.display = view === '3d' ? 'none' : '';
    requestRender({ relief: true });
  }
  function setSea(sea: number) {
    state.sea = sea;
    seaInput.value = String(sea);
    $('[data-sea-out]').textContent = `${sea} m`;
    requestRender({ relief: true, map: true, profile: true });
  }

  // ---------- pointer: brushes, cross-sections and readings on either view ----------
  let stroke: { target: number; last: Point; el: SVGSVGElement } | null = null;
  const dab = (p: Point, target: number) => applyBrush(state.t, { mode: state.tool, x: p.x, y: p.y, radius: state.size, strength: state.strength / 10, target });

  function brushTo(p: Point) {
    if (!stroke) return;
    const spacing = Math.max(30, state.size / 4), d = Math.hypot(p.x - stroke.last.x, p.y - stroke.last.y);
    const steps = Math.floor(d / spacing);
    for (let k = 1; k <= steps; k++) {
      const f = (k * spacing) / d;
      dab({ x: stroke.last.x + (p.x - stroke.last.x) * f, y: stroke.last.y + (p.y - stroke.last.y) * f }, stroke.target);
    }
    if (steps) {
      const f = (steps * spacing) / d;
      stroke.last = { x: stroke.last.x + (p.x - stroke.last.x) * f, y: stroke.last.y + (p.y - stroke.last.y) * f };
      requestRender();
    }
  }

  function commitLine(line: Line, how: string) {
    if (Math.hypot(line.b.x - line.a.x, line.b.y - line.a.y) < 100) {
      announce('That line is too short. Drag at least 100 m across the map.');
      return;
    }
    state.line = line;
    state.draft = null;
    requestRender({ profile: true, marks: true });
    render();
    track('contour_profile_drawn', { preset: state.preset, how });
    announce(`Cross-section drawn. ${sectionText.textContent}`);
  }

  for (const el of [map, overlay]) {
    el.addEventListener('pointerdown', event => {
      if (state.mode !== 'sculpt' || (el === overlay && state.view === '3d')) return;
      const p = toMeters(el, event);
      state.cursor = p;
      if (BRUSH_TOOLS.includes(state.tool)) {
        el.setPointerCapture(event.pointerId);
        stroking = true;
        stroke = { target: sample(state.t, p.x, p.y), last: p, el };
        dab(p, stroke.target);
        requestRender();
      } else if (state.tool === 'section') {
        el.setPointerCapture(event.pointerId);
        state.draft = { a: p, b: p };
        requestRender({ marks: true });
      } else {
        readout.textContent = reading(state.t, p, state.sea);
        requestRender({ marks: true });
      }
      event.preventDefault();
    });
    el.addEventListener('pointermove', event => {
      if (state.mode !== 'sculpt' || (el === overlay && state.view === '3d')) return;
      const p = toMeters(el, event);
      state.cursor = p;
      if (stroke) brushTo(p);
      if (state.draft) { state.draft.b = p; requestRender({ marks: true, profile: true }); }
      readout.textContent = reading(state.t, p, state.sea);
      requestRender({ marks: true });
    });
    const end = () => {
      if (stroke) {
        stroke = null;
        stroking = false;
        requestRender();
        scheduleSave();
      }
      if (state.draft) commitLine(state.draft, 'drag');
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', () => { stroke = null; stroking = false; state.draft = null; requestRender(); });
    el.addEventListener('pointerleave', () => { if (!stroke && !state.draft) { state.cursor = null; requestRender({ marks: true }); } });
  }

  map.addEventListener('keydown', event => {
    const keys: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const p = state.cursor ?? { x: WIDTH / 2, y: HEIGHT / 2 };
    if (event.key in keys) {
      event.preventDefault();
      const step = event.shiftKey ? 25 : KEY_STEP, [dx, dy] = keys[event.key];
      state.cursor = { x: clamp(p.x + dx * step, 0, WIDTH), y: clamp(p.y + dy * step, 0, HEIGHT) };
      readout.textContent = reading(state.t, state.cursor, state.sea);
      announce(readout.textContent);
      requestRender({ marks: true });
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      state.cursor = p;
      if (BRUSH_TOOLS.includes(state.tool)) {
        const target = sample(state.t, p.x, p.y);
        for (let k = 0; k < 3; k++) dab(p, target);
        requestRender();
        scheduleSave();
        announce(`${state.tool[0].toUpperCase()}${state.tool.slice(1)}d. ${reading(state.t, p, state.sea)}`);
      } else if (state.tool === 'section') {
        if (!state.pendingA) {
          state.pendingA = p;
          requestRender({ marks: true });
          announce('Point A set. Move the cursor with the arrow keys and press Enter again to set point B.');
        } else {
          const a = state.pendingA;
          state.pendingA = null;
          commitLine({ a, b: p }, 'keyboard');
        }
      } else announce(reading(state.t, p, state.sea));
    } else if (event.key === 'Escape' && state.pendingA) {
      state.pendingA = null;
      requestRender({ marks: true });
      announce('Cross-section cancelled.');
    }
  });
  map.addEventListener('focus', () => { if (!state.cursor) { state.cursor = { x: WIDTH / 2, y: HEIGHT / 2 }; requestRender({ marks: true }); } });

  // ---------- toolbar ----------
  root.querySelectorAll<HTMLButtonElement>('[data-preset]').forEach(b => b.addEventListener('click', () => setPreset(b.dataset.preset!)));
  root.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach(b => b.addEventListener('click', () => {
    setTool(b.dataset.tool as Tool);
    announce(b.dataset.tool === 'section' ? 'Cross-section tool: drag across the map from A to B, or use the arrow keys and Enter.' : `${b.textContent} tool.`);
  }));
  $('[data-tool-shortcut]').addEventListener('click', () => {
    setTool('section');
    map.focus({ preventScroll: true });
    map.scrollIntoView({ block: 'nearest', behavior: reduceMotion.matches ? 'auto' : 'smooth' });
    announce('Cross-section tool: drag across the map from A to B, or use the arrow keys and Enter.');
  });
  root.querySelectorAll<HTMLButtonElement>('[data-interval]').forEach(b => b.addEventListener('click', () => {
    setContourInterval(Number(b.dataset.interval));
    announce(`Contour interval ${b.dataset.interval} m.`);
  }));
  root.querySelectorAll<HTMLInputElement>('[data-overlay]').forEach(box => box.addEventListener('change', () => {
    if (box.checked) state.overlays.add(box.dataset.overlay!); else state.overlays.delete(box.dataset.overlay!);
    root.querySelector(`[data-overlay-card="${box.dataset.overlay}"]`)?.classList.toggle('on', box.checked);
    if (box.dataset.overlay === 'vrule' && box.checked && !presetById(state.preset).river) showNote('This landscape has no river. Choose Ridge and valley to see the V-rule.');
    requestRender({ map: true });
  }));
  seaInput.addEventListener('input', () => setSea(Number(seaInput.value)));
  seaInput.addEventListener('change', () => announce(`Sea level ${seaInput.value} m.`));
  sizeInput.addEventListener('input', () => { state.size = Number(sizeInput.value); $('[data-size-out]').textContent = `${state.size} m`; requestRender({ marks: true }); });
  strengthInput.addEventListener('input', () => { state.strength = Number(strengthInput.value); $('[data-strength-out]').textContent = String(state.strength); });
  view3d.addEventListener('change', () => { setView(view3d.checked ? '3d' : '2d'); announce(view3d.checked ? '3D view on.' : 'Flat view.'); });

  $('[data-reset]').addEventListener('click', () => {
    const maps = savedMaps();
    delete maps[state.preset];
    writeMaps(maps);
    setPreset(state.preset, false);
    showNote('');
    announce(`${presetById(state.preset).name} reset to its starting shape.`);
  });

  const copyBtn = $<HTMLButtonElement>('[data-copy-link]');
  copyBtn.addEventListener('click', async () => {
    const query = serializeState({ mode: state.mode, preset: state.preset, sea: state.sea, interval: state.interval, overlays: [...state.overlays], line: state.line, view: state.view });
    const url = `${location.origin}${location.pathname}?${query}`;
    try {
      await navigator.clipboard.writeText(url);
      copyBtn.textContent = 'Link copied ✓';
      announce('Share link copied. It does not include hand-sculpted changes.');
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

  // ---------- Match & Read ----------
  const quiz = { index: 0, score: 0, answered: false };
  const terrains: Record<string, Terrain> = {};
  const terrainFor = (id: string) => (terrains[id] ??= createTerrain(id) as Terrain);
  const qPanel = $('[data-q-panel]'), qChoices = $('[data-choices]'), qFeedback = $('[data-q-feedback]'), qNext = $<HTMLButtonElement>('[data-q-next]');

  function thumbnail(id: string) {
    const c = document.createElement('canvas');
    c.width = 300; c.height = 200;
    c.setAttribute('aria-hidden', 'true');
    const t = terrainFor(id);
    drawOblique(c.getContext('2d')!, t, 0, hillshade(t));
    return c;
  }

  function renderQuestion() {
    const c: Challenge = CHALLENGES[quiz.index];
    quiz.answered = false;
    $('[data-q-num]').textContent = String(quiz.index + 1);
    $('[data-score]').textContent = String(quiz.score);
    $('[data-q-prompt]').textContent = c.prompt;
    $('[data-q-map]').innerHTML = mapSvg(terrainFor(c.map.preset), {
      interval: c.map.interval, seaLevel: 0, overlays: ['index'], marks: c.map.marks, line: c.map.line,
      label: `Contour map for question ${quiz.index + 1}, contour interval ${c.map.interval} m`,
    });
    qChoices.className = `cm-choices ${c.kind}`;
    qChoices.replaceChildren(...c.choices.map((choice, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'cm-choice';
      b.dataset.choice = String(i);
      if (c.kind === 'match') {
        b.append(thumbnail(choice.preset), Object.assign(document.createElement('span'), { textContent: `Landscape ${i + 1}` }));
        b.setAttribute('aria-label', `Landscape ${i + 1}: ${presetById(choice.preset).summary}`);
      } else if (c.kind === 'profile') {
        const pr = choice.profile;
        const holder = document.createElement('span');
        holder.innerHTML = profileSvg(profile(terrainFor(pr.preset), pr.a, pr.b), { className: 'cs-mini', label: '' }).svg;
        holder.firstElementChild?.setAttribute('aria-hidden', 'true');
        b.append(holder, Object.assign(document.createElement('span'), { textContent: `Profile ${i + 1}` }));
        b.setAttribute('aria-label', `Profile ${i + 1}: ${choice.label}`);
      } else b.textContent = choice.label;
      return b;
    }));
    qFeedback.hidden = true;
    qNext.hidden = true;
  }

  qChoices.addEventListener('click', event => {
    const button = (event.target as Element).closest<HTMLButtonElement>('[data-choice]');
    if (!button || quiz.answered) return;
    const c: Challenge = CHALLENGES[quiz.index], picked = Number(button.dataset.choice), right = picked === c.answer;
    quiz.answered = true;
    if (right) quiz.score++;
    qChoices.querySelectorAll<HTMLButtonElement>('[data-choice]').forEach((b, i) => {
      b.disabled = true;
      b.classList.toggle('right', i === c.answer);
      b.classList.toggle('wrong', i === picked && !right);
    });
    const name = (i: number) => (c.kind === 'match' ? `landscape ${i + 1}` : c.kind === 'profile' ? `profile ${i + 1}` : c.choices[i].label);
    qFeedback.textContent = `${right ? 'Correct!' : `Not quite: the answer is ${name(c.answer)}.`} ${c.explain}`;
    qFeedback.className = `feedback ${right ? 'good' : 'hint'}`;
    qFeedback.hidden = false;
    $('[data-score]').textContent = String(quiz.score);
    qNext.textContent = quiz.index === CHALLENGES.length - 1 ? 'See your score' : 'Next question';
    qNext.hidden = false;
    announce(qFeedback.textContent);
    qNext.focus({ preventScroll: true });
  });

  qNext.addEventListener('click', () => {
    if (quiz.index < CHALLENGES.length - 1) {
      quiz.index++;
      renderQuestion();
      qPanel.focus({ preventScroll: true });
      qPanel.scrollIntoView({ block: 'nearest', behavior: reduceMotion.matches ? 'auto' : 'smooth' });
      announce(`Question ${quiz.index + 1}: ${CHALLENGES[quiz.index].prompt}`);
      return;
    }
    if (qNext.dataset.restart) {
      delete qNext.dataset.restart;
      quiz.index = 0; quiz.score = 0;
      renderQuestion();
      announce(`Question 1: ${CHALLENGES[0].prompt}`);
      return;
    }
    track('contour_challenge_complete', { score: quiz.score });
    $('[data-q-prompt]').textContent = `You scored ${quiz.score} out of ${CHALLENGES.length}.`;
    qChoices.replaceChildren();
    qFeedback.className = 'feedback';
    qFeedback.textContent = quiz.score === CHALLENGES.length
      ? 'Every answer right: you can read a contour map like a geologist.'
      : quiz.score >= CHALLENGES.length / 2
        ? 'Good map reading. Try again to get them all, or go back to Sculpt and test the tricky ideas yourself.'
        : 'Go back to Sculpt, turn on the overlays and try the landscapes from the questions, then try again.';
    qNext.textContent = 'Try again';
    qNext.dataset.restart = '1';
    announce(`Finished. You scored ${quiz.score} out of ${CHALLENGES.length}.`);
  });

  // ---------- modes ----------
  function setMode(mode: Mode, announceIt = true) {
    state.mode = mode;
    root.dataset.mode = mode;
    setPressed('[data-mode-btn]', 'data-mode-btn', mode);
    $('[data-sculpt]').hidden = mode !== 'sculpt';
    $('[data-challenge]').hidden = mode !== 'challenge';
    $<HTMLButtonElement>('[data-reset]').hidden = mode !== 'sculpt';
    if (mode === 'challenge') {
      quiz.index = 0; quiz.score = 0;
      delete qNext.dataset.restart;
      renderQuestion();
    } else requestRender();
    if (announceIt) announce(mode === 'challenge' ? `Match and Read: ${CHALLENGES.length} questions. Question 1: ${CHALLENGES[0].prompt}` : 'Sculpt mode.');
  }
  root.querySelectorAll<HTMLButtonElement>('[data-mode-btn]').forEach(b => b.addEventListener('click', () => { showNote(''); setMode(b.dataset.modeBtn as Mode); }));

  // Switch everything on and restore the shared state.
  root.querySelectorAll<HTMLButtonElement | HTMLInputElement>('[disabled]').forEach(control => { control.disabled = false; });
  $('[data-relief-fallback]').hidden = true;
  canvas.hidden = false;
  root.querySelectorAll<HTMLInputElement>('[data-overlay]').forEach(box => {
    box.checked = state.overlays.has(box.dataset.overlay!);
    root.querySelector(`[data-overlay-card="${box.dataset.overlay}"]`)?.classList.toggle('on', box.checked);
  });
  const restored = setPreset(state.preset, false);
  if (restored) notes.push('Your sculpted landscape was restored from this browser. Press Reset landscape to start again.');
  if (notes.length) showNote(notes.join(' '));
  setContourInterval(state.interval);
  setSea(state.sea);
  setView(state.view);
  setTool('read');
  setMode(state.mode, false);
}
