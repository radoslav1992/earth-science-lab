// Plate Boundaries Map: layers, region close-ups, details for every line and marker, and Challenge mode,
// on top of the shared model in src/lib/plate-map.mjs. The map itself is drawn by the server; this script
// only moves the view, shows and hides layers and re-draws the text panels from the same functions.
import {
  LAYERS, CHALLENGE, BOUNDARIES, regionById, boundaryById, plateById, featureById, describeBoundary, describePlate, describeFeature,
  parseMapState, serializeMapState, choiceLabel,
} from '../../lib/plate-map.mjs';
import { K, WORLD_WIDTH, mapX, mapY, viewBoxFor, aspectFor, lonInView, regionHtml, boundaryHtml, plateHtml, featureHtml, listHtml } from '../../lib/plate-map-view.mjs';
import { track } from '../../lib/analytics';

type Mode = 'explore' | 'challenge';
type Selection = { kind: 'b' | 'f' | 'p'; id: string } | null;
const SVG_NS = 'http://www.w3.org/2000/svg';
// Close-ups are drawn no narrower than this shape (width ÷ height): square on a phone, wide on a desk.
const MIN_ASPECT = { narrow: 1, wide: 1.75 };

export function initPlateMap(root: HTMLElement) {
  const $ = <T extends Element = HTMLElement>(selector: string) => root.querySelector(selector) as T;
  const $$ = <T extends Element = HTMLElement>(selector: string) => [...root.querySelectorAll(selector)] as T[];
  const live = $('[data-live]');
  const noteEl = $('[data-note]');
  const hint = $('[data-hint]');
  const svg = $<SVGSVGElement>('[data-map]');
  const halo = $<SVGGElement>('[data-halo]'), ring = $<SVGGElement>('[data-ring]');
  const info = $('[data-info]'), list = $('[data-list]'), back = $<HTMLButtonElement>('[data-back]');
  const scroller = $('[data-scroll]');
  const narrow = matchMedia('(max-width: 600px)');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

  const { state: shared, notes } = parseMapState(location.search);
  let mode: Mode = shared.mode as Mode;
  const explore = { region: regionById(shared.region), layers: [...shared.layers] as string[] };
  let region = explore.region;
  let layers = explore.layers;
  let selected: Selection = null;
  let marked: string[] = [];
  let westDeg = -180, unitsPerPx = 1;
  let trackTimer = 0;

  const announce = (message: string) => { live.textContent = ''; window.setTimeout(() => { live.textContent = message; }, 30); };
  const showNote = (message: string) => { noteEl.textContent = message; noteEl.hidden = !message; };
  if (notes.length) showNote(notes.join(' '));

  // ---------- the view ----------
  const place = (lon: number, lat: number) => `translate(${mapX(lonInView(lon, westDeg))} ${mapY(lat)}) scale(${unitsPerPx.toFixed(3)})`;
  function layout() {
    const aspect = aspectFor(region, narrow.matches ? MIN_ASPECT.narrow : MIN_ASPECT.wide);
    const box = viewBoxFor(region, aspect);
    svg.setAttribute('viewBox', `${box.x} ${box.y} ${box.width} ${box.height}`);
    svg.style.aspectRatio = String(aspect);
    root.dataset.view = region.id;
    westDeg = box.x / K;
    unitsPerPx = box.width / Math.max(1, svg.clientWidth);
    for (const el of svg.querySelectorAll<SVGElement>('[data-lon]')) el.setAttribute('transform', place(Number(el.dataset.lon), Number(el.dataset.lat)));
    // Plate names: the world map shows each plate's main labels; a close-up shows one name per plate,
    // the first of its label spots that falls well inside the picture.
    const padX = box.width * 0.08, padY = box.height * 0.06;
    const inBox = (el: SVGElement) => {
      const x = lonInView(Number(el.dataset.lon), westDeg) * K, y = -Number(el.dataset.lat) * K;
      return x >= box.x + padX && x <= box.x + box.width - padX && y >= box.y + padY && y <= box.y + box.height - padY;
    };
    const shown = new Set<string>();
    for (const el of svg.querySelectorAll<SVGElement>('.pm-name')) {
      const plate = el.dataset.plate!;
      const show = region.id === 'world' ? !('alt' in el.dataset) : !shown.has(plate) && inBox(el);
      if (show) shown.add(plate);
      el.dataset.show = show ? '1' : '0';
    }
    // A boundary piece that lies wholly west of the view belongs one turn to the east (past the 180° line).
    for (const el of svg.querySelectorAll<SVGElement>('[data-east]')) {
      if (Number(el.dataset.east) < westDeg) el.setAttribute('transform', `translate(${WORLD_WIDTH} 0)`); else el.removeAttribute('transform');
    }
    // Small plates' names only fit once the map is zoomed in.
    root.classList.toggle('pm-far', K / unitsPerPx < 2.4);
    // On a phone the whole world is wider than the screen: let the keyboard scroll it too.
    if (scroller.scrollWidth > scroller.clientWidth + 1) { scroller.tabIndex = 0; scroller.setAttribute('role', 'group'); scroller.setAttribute('aria-label', 'Map: scroll sideways to see the rest of the world'); }
    else { scroller.removeAttribute('tabindex'); scroller.removeAttribute('role'); scroller.removeAttribute('aria-label'); }
    drawMarks();
  }
  function drawMarks() {
    halo.replaceChildren(...marked.flatMap(id => [...svg.querySelectorAll<SVGPathElement>(`.pm-b[data-b="${id}"]`)].map(path => {
      const copy = document.createElementNS(SVG_NS, 'path');
      copy.setAttribute('d', path.getAttribute('d')!);
      const shift = path.getAttribute('transform');
      if (shift) copy.setAttribute('transform', shift);
      return copy;
    })));
    ring.replaceChildren();
    if (selected?.kind === 'f') {
      const f = featureById(selected.id)!;
      const circle = document.createElementNS(SVG_NS, 'circle');
      circle.setAttribute('r', '11');
      circle.setAttribute('transform', place(Number(f.lon), Number(f.lat)));
      ring.append(circle);
    }
  }
  new ResizeObserver(layout).observe(svg);
  // Coming back to the page, a browser may restore the checkboxes by itself: put them back in step.
  window.addEventListener('pageshow', () => applyLayers());
  narrow.addEventListener('change', layout);

  function applyLayers() {
    for (const layer of LAYERS) root.classList.toggle(`pm-off-${layer}`, !layers.includes(layer));
    for (const box of $$<HTMLInputElement>('[data-layer]')) box.checked = layers.includes(box.dataset.layer!);
  }
  function showRegion() {
    selected = null;
    marked = region.boundaries;
    for (const b of $$<HTMLButtonElement>('[data-region]')) b.setAttribute('aria-pressed', String(b.dataset.region === region.id));
    info.innerHTML = regionHtml(region);
    back.hidden = true;
    list.innerHTML = listHtml(region, layers);
    layout();
  }
  function trackExplore() {
    clearTimeout(trackTimer);
    trackTimer = window.setTimeout(() => track('platemap_explore', { region: region.id, layers: layers.join(',') }), 1500);
  }

  // ---------- picking things on the map ----------
  function select(next: NonNullable<Selection>, focusInfo = false) {
    selected = next;
    hint.hidden = true;
    let title = '';
    if (next.kind === 'b') {
      const b = boundaryById(next.id);
      marked = [b.id];
      info.innerHTML = boundaryHtml(b);
      const d = describeBoundary(b);
      title = `${d.title}. ${d.typeLabel}. ${d.plates}`;
    } else if (next.kind === 'p') {
      const p = plateById(next.id);
      marked = BOUNDARIES.filter(b => b.plates.includes(p.id)).map(b => b.id);
      info.innerHTML = plateHtml(p);
      title = `${p.name}. ${describePlate(p).neighbors}`;
    } else {
      const f = featureById(next.id)!;
      const d = describeFeature(f);
      marked = d.boundary ? [d.boundary] : [];
      info.innerHTML = featureHtml(f);
      title = `${d.title}. ${d.fact}. ${d.where}`;
    }
    back.textContent = region.id === 'world' ? 'Back to the overview' : `Back to ${region.name}`;
    back.hidden = false;
    drawMarks();
    announce(title);
    if (focusInfo) { const heading = info.querySelector<HTMLElement>('h3')!; heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
    // On a phone the details sit under the map: bring them into view.
    info.parentElement!.scrollIntoView({ block: 'nearest', behavior: reduceMotion.matches ? 'auto' : 'smooth' });
  }
  svg.addEventListener('click', event => {
    if (mode !== 'explore') return;
    const target = event.target as Element;
    const f = target.closest<SVGElement>('[data-f]'), p = target.closest<SVGElement>('[data-plate]'), b = target.closest<SVGElement>('[data-b]');
    if (f) select({ kind: 'f', id: f.dataset.f! });
    else if (p) select({ kind: 'p', id: p.dataset.plate! });
    else if (b) select({ kind: 'b', id: b.dataset.b! });
  });
  list.addEventListener('click', event => {
    const b = (event.target as Element).closest<HTMLElement>('[data-pick-b], [data-pick-f], [data-pick-p]');
    if (!b) return;
    if (b.dataset.pickB) select({ kind: 'b', id: b.dataset.pickB }, true);
    else if (b.dataset.pickF) select({ kind: 'f', id: b.dataset.pickF }, true);
    else select({ kind: 'p', id: b.dataset.pickP! }, true);
  });
  back.addEventListener('click', () => {
    showRegion();
    announce(`${region.name}. ${region.text}`);
    $<HTMLElement>(`[data-region="${region.id}"]`).focus();
  });

  for (const box of $$<HTMLInputElement>('[data-layer]')) box.addEventListener('change', () => {
    const layer = box.dataset.layer!;
    layers = LAYERS.filter(l => (l === layer ? box.checked : layers.includes(l)));
    explore.layers = layers;
    hint.hidden = true;
    showNote('');
    applyLayers();
    list.innerHTML = listHtml(region, layers);
    announce(`${box.parentElement!.textContent!.trim()} ${box.checked ? 'shown' : 'hidden'}.`);
    trackExplore();
  });
  for (const b of $$<HTMLButtonElement>('[data-region]')) b.addEventListener('click', () => {
    region = explore.region = regionById(b.dataset.region!);
    hint.hidden = true;
    showNote('');
    showRegion();
    announce(`${region.name}. ${region.text}`);
    trackExplore();
  });

  // ---------- challenge ----------
  const quiz = { index: 0, score: 0, answered: false };
  const qChoices = $('[data-q-choices]'), qFeedback = $('[data-q-feedback]'), qNext = $<HTMLButtonElement>('[data-q-next]');
  const qBox = $('[data-q]'), qDone = $('[data-q-done]'), qPrompt = $('[data-q-prompt]');
  function showQuestion() {
    const q = CHALLENGE[quiz.index];
    quiz.answered = false;
    $('[data-q-num]').textContent = String(quiz.index + 1);
    $('[data-q-score]').textContent = String(quiz.score);
    qPrompt.textContent = q.prompt;
    qFeedback.hidden = true;
    qNext.hidden = true;
    qDone.hidden = true;
    qBox.hidden = false;
    $('.pm-figure').hidden = false;
    region = regionById(q.region);
    layers = q.layers ?? ['divergent', 'convergent', 'transform'];
    // The highlighted line keeps its color hidden until the question is answered.
    root.classList.toggle('pm-mystery', q.kind === 'type');
    selected = null;
    marked = q.show ? [q.show] : [];
    applyLayers();
    layout();
    qChoices.replaceChildren(...q.choices.map((choice: string) => {
      const b = Object.assign(document.createElement('button'), { type: 'button', className: 'btn pm-choice', textContent: choiceLabel(q, choice) });
      b.dataset.choice = choice;
      b.addEventListener('click', () => answer(choice));
      return b;
    }));
  }
  function answer(choice: string) {
    if (quiz.answered) return;
    const q = CHALLENGE[quiz.index], right = choice === q.answer;
    quiz.answered = true;
    if (right) quiz.score++;
    root.classList.remove('pm-mystery');
    for (const b of $$<HTMLButtonElement>('.pm-choice')) {
      b.disabled = true;
      b.classList.toggle('right', b.dataset.choice === q.answer);
      b.classList.toggle('wrong', b.dataset.choice === choice && !right);
    }
    $('[data-q-score]').textContent = String(quiz.score);
    qFeedback.className = `pm-feedback ${right ? 'good' : 'miss'}`;
    qFeedback.textContent = `${right ? 'Correct!' : 'Not quite.'} ${q.explain}`;
    qFeedback.hidden = false;
    qNext.textContent = quiz.index === CHALLENGE.length - 1 ? 'See my score' : 'Next question';
    qNext.hidden = false;
    qFeedback.focus();
  }
  qNext.addEventListener('click', () => {
    if (quiz.index < CHALLENGE.length - 1) {
      quiz.index++;
      showQuestion();
      announce(`Question ${quiz.index + 1} of ${CHALLENGE.length}. ${CHALLENGE[quiz.index].prompt}`);
      qPrompt.focus();
      return;
    }
    qBox.hidden = true;
    $('.pm-figure').hidden = true;
    qDone.hidden = false;
    const total = CHALLENGE.length;
    $('[data-q-final]').textContent = `You scored ${quiz.score} out of ${total}.`;
    $('[data-q-message]').textContent = quiz.score === total
      ? 'Every question right. You can read a plate map like a geologist.'
      : quiz.score >= total - 2
        ? 'Great work. Go back to Explore, zoom to the regions you missed and tap the boundaries there.'
        : 'Go back to Explore: switch on the earthquakes and volcanoes, zoom to each region and tap the boundary lines to see what kind they are.';
    qDone.focus();
    track('platemap_challenge_complete', { score: quiz.score, total });
  });
  function restartQuiz() { quiz.index = 0; quiz.score = 0; showQuestion(); }
  $('[data-q-restart]').addEventListener('click', () => { restartQuiz(); announce(`Challenge restarted. Question 1. ${CHALLENGE[0].prompt}`); qPrompt.focus(); });
  $('[data-q-explore]').addEventListener('click', () => { setMode('explore'); announce('Explore mode.'); });

  // ---------- modes and sharing ----------
  function setMode(next: Mode) {
    mode = next;
    root.dataset.mode = mode;
    root.classList.remove('pm-mystery');
    $('[data-challenge]').hidden = mode !== 'challenge';
    $('[data-controls]').hidden = mode !== 'explore';
    for (const panel of $$('[data-details]')) panel.hidden = mode !== 'explore';
    $('.pm-figure').hidden = false;
    for (const b of $$<HTMLButtonElement>('[data-mode-btn]')) b.setAttribute('aria-pressed', String(b.dataset.modeBtn === mode));
    if (mode === 'challenge') { hint.hidden = true; restartQuiz(); return; }
    region = explore.region;
    layers = explore.layers;
    applyLayers();
    showRegion();
  }
  for (const b of $$<HTMLButtonElement>('[data-mode-btn]')) b.addEventListener('click', () => {
    if (b.dataset.modeBtn === mode) return;
    showNote('');
    setMode(b.dataset.modeBtn as Mode);
    announce(mode === 'challenge' ? `Challenge: ${CHALLENGE.length} questions. Question 1. ${CHALLENGE[0].prompt}` : 'Explore mode.');
  });

  const copyBtn = $<HTMLButtonElement>('[data-copy-link]');
  copyBtn.addEventListener('click', async () => {
    const url = `${location.origin}${location.pathname}?${serializeMapState({ mode, region: explore.region.id, layers: explore.layers })}`;
    try {
      await navigator.clipboard.writeText(url);
      copyBtn.textContent = 'Link copied ✓';
      announce(mode === 'challenge' ? 'Share link to the challenge copied.' : 'Share link copied. It opens this view with these layers.');
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
  if (location.search.includes('region=') || location.search.includes('show=') || mode === 'challenge') hint.hidden = true;
  setMode(mode);
  root.classList.add('pm-ready');
}
