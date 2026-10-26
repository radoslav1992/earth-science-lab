// Water Cycle Explorer: the droplet journey, the conditions, "Where is Earth's water?" and Challenge mode, on
// top of the shared model in src/lib/water-cycle.mjs. The scene, the bars and the chances are re-drawn from the
// same functions the server used.
import {
  STOP, PROCESSES, CLIMATE_NAMES, CHALLENGE, MAX_STEPS, SEED_RANGE, DEFAULT_CONDITIONS, UNIT_NAMES,
  exits, formatChance, driverOf, moveName, placeName, stayText, journeyLog, journeyYears, formatDuration, stuckReason,
  chanceMove, edge, moveAllowed, sceneDynamicSvg, describeScene, whereHtml, taskResult, parseWaterState, serializeWaterState, grouped,
} from '../../lib/water-cycle.mjs';
import { track } from '../../lib/analytics';

type Mode = 'explore' | 'challenge';
type View = 'journey' | 'where';
type Conditions = { climate: string; sun: boolean; gravity: boolean };
type Exit = ReturnType<typeof exits>[number];
type Question = (typeof CHALLENGE)[number];

const MOVE_MS = 650; // droplet travel animation
const PLAY_MS = 1300; // time between moves while playing
const SUN_ICON = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><circle cx="8" cy="8" r="3.4" fill="currentColor"/><path d="M8 .8v2.4M8 12.8v2.4M.8 8h2.4M12.8 8h2.4M2.9 2.9l1.7 1.7M11.4 11.4l1.7 1.7M2.9 13.1l1.7-1.7M11.4 4.6l1.7-1.7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
const GRAVITY_ICON = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M8 1.5v10M3.8 8 8 12.4 12.2 8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 15h10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
const randomSeed = () => SEED_RANGE[0] + Math.floor(Math.random() * (SEED_RANGE[1] - SEED_RANGE[0] + 1));

export function initWater(root: HTMLElement) {
  const $ = <T extends Element = HTMLElement>(selector: string) => root.querySelector(selector) as T;
  const $$ = <T extends Element = HTMLElement>(selector: string) => [...root.querySelectorAll(selector)] as T[];
  const live = $('[data-live]');
  const noteEl = $('[data-note]');
  const scene = $<SVGSVGElement>('[data-scene]');
  const dynamic = $<SVGGElement>('[data-dynamic]');
  const exitList = $('[data-exits]');
  const seedInput = $<HTMLInputElement>('[data-seed]');
  const startSelect = $<HTMLSelectElement>('[data-start]');
  const playBtn = $<HTMLButtonElement>('[data-play]');
  const rollBtn = $<HTMLButtonElement>('[data-roll]');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

  const { state: shared, notes } = parseWaterState(location.search);
  const state = {
    mode: shared.mode as Mode,
    view: shared.view as View,
    path: shared.path as string[],
    seed: new URLSearchParams(location.search).has('seed') ? (shared.seed as number) : randomSeed(),
    climate: shared.climate as string,
    sun: shared.sun as boolean,
    gravity: shared.gravity as boolean,
    water: shared.water as string,
    unit: shared.unit as string,
  };
  const journey = { hows: new Set<string>(), tracked: false };
  let anim: { raf: number; finish: () => void } | null = null;
  let playTimer = 0, playing = false, resumeOnShow = false, trackTimer = 0, tracked = '', hinted = state.path.length > 1;

  const announce = (message: string) => { live.textContent = message; };
  const showNote = (message: string) => { noteEl.textContent = message; noteEl.hidden = !message; };
  if (notes.length) showNote(notes.join(' '));
  const cond = (): Conditions => ({ climate: state.climate, sun: state.sun, gravity: state.gravity });
  const here = () => state.path.at(-1) as string;

  // ---------- exit buttons (Explore and the challenge's steering tasks) ----------
  function exitButtons(container: HTMLElement, at: string, conditions: Conditions, onPick: (to: string) => void) {
    const options = exits(at, conditions) as Exit[];
    container.replaceChildren(...options.map(e => {
      const driver = driverOf(e);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `wc-exit-btn wc-${driver}`;
      b.dataset.go = e.to;
      b.innerHTML = `<span class="wc-exit-chance">${formatChance(e.chance)}</span><span class="wc-exit-main"><b>${PROCESSES[e.process].name}</b> to ${placeName(e.to)}<small>${e.text}</small></span><span class="wc-chip">${driver === 'sun' ? SUN_ICON + 'Sun' : GRAVITY_ICON + 'Gravity'}</span>`;
      b.setAttribute('aria-label', `${PROCESSES[e.process].name} to ${placeName(e.to)}, chance ${formatChance(e.chance)}. ${e.text}. Driven by ${driver === 'sun' ? 'the sun’s energy' : 'gravity'}.`);
      b.addEventListener('click', () => onPick(e.to));
      return b;
    }));
    return options;
  }

  // ---------- drawing ----------
  function drawScene(path: string[], conditions: Conditions, showExits = true) {
    dynamic.innerHTML = sceneDynamicSvg({ path, cond: conditions, showExits });
    scene.setAttribute('aria-label', describeScene(path, conditions));
  }

  function renderJourney() {
    const at = here(), c = cond();
    if (state.mode === 'explore') drawScene(state.path, c);
    $('[data-here]').innerHTML = `The droplet is in <b>${placeName(at)}</b>. Water typically stays there <b>${stayText(at)}</b>.`;
    const options = exitButtons(exitList, at, c, to => move(to, 'choice'));
    if (!options.length) {
      const p = document.createElement('p');
      p.className = 'wc-stuck';
      p.textContent = stuckReason(at, c);
      exitList.append(p);
    }
    const full = state.path.length > MAX_STEPS;
    rollBtn.disabled = !options.length || full;
    playBtn.disabled = !options.length || full;
    if ((!options.length || full) && playing) stopPlay();
    for (const b of $$<HTMLButtonElement>('[data-go]')) b.disabled = full || Boolean(anim);
    $('[data-hint]').hidden = hinted;
    // The log.
    const log = journeyLog(state.path);
    const body = $('[data-log]');
    if (!log.length) body.innerHTML = `<tr class="wc-log-empty"><td colspan="5">No moves yet. The droplet is waiting in ${placeName(at)}.</td></tr>`;
    else body.innerHTML = log.map(r => `<tr><td data-label="Move">${r.step}</td><td data-label="Place it left">${STOP[r.from].name}</td><td data-label="How it moved">${moveName(r.edge)}</td><td data-label="Typical time there">${stayText(r.from)}</td><td data-label="Total so far">${formatDuration(r.total)}</td></tr>`).join('')
      + `<tr class="wc-log-now"><td data-label="Move">Now</td><td colspan="4">In ${placeName(at)}${full ? `. That’s the longest journey this log keeps (${MAX_STEPS} moves).` : ''}</td></tr>`;
    const moves = state.path.length - 1, years = journeyYears(state.path);
    $('[data-total]').innerHTML = `Moves: <b>${moves}</b> · Total time: <b>${moves ? `about ${formatDuration(years)}` : '0 years'}</b>`;
    $<HTMLButtonElement>('[data-undo]').disabled = moves === 0;
    $<HTMLButtonElement>('[data-restart]').disabled = moves === 0;
    startSelect.value = state.path[0];
  }

  function renderConditions() {
    for (const b of $$<HTMLButtonElement>('[data-climate]')) b.setAttribute('aria-pressed', String(b.dataset.climate === state.climate));
    $<HTMLInputElement>('[data-switch="sun"]').checked = state.sun;
    $<HTMLInputElement>('[data-switch="gravity"]').checked = state.gravity;
    root.classList.toggle('wc-no-sun', !state.sun);
    root.classList.toggle('wc-no-gravity', !state.gravity);
    const parts = [{
      colder: 'Colder: more of the rain and snow falls as snow on ice, and less evaporates, transpires or melts.',
      today: 'Today’s climate. The chances are rounded classroom values that follow real patterns.',
      warmer: 'Warmer: more evaporation, transpiration and melting, and less snow.',
    }[state.climate]];
    if (state.climate !== 'today') parts.push('The model shows the direction of each change, not real amounts.');
    if (!state.sun) parts.push('With the sun’s energy off, evaporation, transpiration, sublimation, melting and uptake by roots stop.');
    if (!state.gravity) parts.push('With gravity off, nothing falls or flows downhill: no rain, snow, runoff or infiltration.');
    $('[data-cond-note]').textContent = parts.join(' ');
  }

  function renderWhere() {
    $('[data-where]').innerHTML = whereHtml(state.water, state.unit);
    for (const b of $$<HTMLButtonElement>('[data-water-kind]')) b.setAttribute('aria-pressed', String(b.dataset.waterKind === state.water));
    for (const b of $$<HTMLButtonElement>('[data-unit]')) b.setAttribute('aria-pressed', String(b.dataset.unit === state.unit));
  }

  // ---------- analytics ----------
  function trackExplore() {
    clearTimeout(trackTimer);
    trackTimer = window.setTimeout(() => {
      const params = { view: state.view, climate: state.climate, sun: state.sun ? 'on' : 'off', gravity: state.gravity ? 'on' : 'off' };
      const key = JSON.stringify(params);
      if (key === tracked) return;
      tracked = key;
      track('water_explore', params);
    }, 1500);
  }
  function resetJourneyTracking() { journey.hows.clear(); journey.tracked = false; }

  // ---------- moving the droplet ----------
  function animate(path: string[], from: string, to: string, conditions: Conditions, done: () => void) {
    if (reduceMotion.matches || document.hidden) { done(); return; }
    const start = performance.now();
    const finish = () => { if (!anim) return; cancelAnimationFrame(anim.raf); anim = null; done(); };
    const step = (now: number) => {
      if (!anim) return;
      const t = Math.min(1, (now - start) / MOVE_MS), eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      dynamic.innerHTML = sceneDynamicSvg({ path, cond: conditions, moving: { from, to, t: eased } });
      if (t >= 1) { finish(); return; }
      anim.raf = requestAnimationFrame(step);
    };
    anim = { raf: requestAnimationFrame(step), finish };
    for (const b of $$<HTMLButtonElement>('[data-go]')) b.disabled = true;
  }
  const finishAnimation = () => anim?.finish();

  function move(to: string, how: 'choice' | 'chance') {
    finishAnimation();
    const from = here(), e = edge(from, to);
    if (!e || !moveAllowed(e, cond()) || state.path.length > MAX_STEPS) return;
    if (how === 'choice' && playing) stopPlay();
    const before = [...state.path];
    state.path.push(to);
    hinted = true;
    journey.hows.add(how);
    if (!journey.tracked && state.path.length - 1 >= 5) {
      journey.tracked = true;
      track('water_journey', { start: state.path[0], how: journey.hows.size > 1 ? 'mixed' : how });
    }
    const after = () => {
      renderJourney();
      const now = exits(to, cond());
      announce(`${moveName(e)}: from ${placeName(from)} to ${placeName(to)}, after ${stayText(from)} in ${placeName(from)}. Total time about ${formatDuration(journeyYears(state.path))}. ${now.length ? `${now.length} way${now.length === 1 ? '' : 's'} out.` : stuckReason(to, cond())}`);
    };
    renderJourney();
    animate(before, from, to, cond(), after);
  }

  function roll() {
    const pick = chanceMove(here(), state.seed, state.path.length, cond());
    if (pick) move(pick.to, 'chance');
  }

  // Play: chance decides a move every PLAY_MS until paused or stuck. Pauses while the tab is hidden.
  function tick() {
    if (!playing) return;
    if (!exits(here(), cond()).length || state.path.length > MAX_STEPS) { stopPlay(); return; }
    roll();
    playTimer = window.setTimeout(tick, PLAY_MS);
  }
  function startPlay() {
    playing = true;
    playBtn.textContent = 'Pause';
    playBtn.setAttribute('aria-pressed', 'true');
    tick();
  }
  function stopPlay() {
    clearTimeout(playTimer);
    playing = false;
    resumeOnShow = false;
    playBtn.textContent = 'Play';
    playBtn.setAttribute('aria-pressed', 'false');
  }
  playBtn.addEventListener('click', () => {
    if (playing) { stopPlay(); announce(`Paused after ${state.path.length - 1} moves.`); }
    else { startPlay(); }
  });
  rollBtn.addEventListener('click', roll);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      finishAnimation();
      if (playing) { clearTimeout(playTimer); playing = false; resumeOnShow = true; }
    } else if (resumeOnShow) { resumeOnShow = false; startPlay(); }
  });
  // Pointer users can also click an arrow or its chance badge in the scene.
  dynamic.addEventListener('click', event => {
    const target = (event.target as Element).closest<SVGGElement>('[data-exit]');
    if (!target) return;
    if (state.mode === 'explore') move(target.dataset.exit!, 'choice');
    else if (quiz.task && !quiz.answered) stepTask(target.dataset.exit!);
  });

  // ---------- journey controls ----------
  function restart(start: string, message: string) {
    finishAnimation();
    stopPlay();
    state.path = [start];
    resetJourneyTracking();
    renderJourney();
    announce(message);
  }
  $('[data-undo]').addEventListener('click', () => {
    finishAnimation();
    stopPlay();
    if (state.path.length < 2) return;
    state.path.pop();
    renderJourney();
    announce(`Undone. The droplet is back in ${placeName(here())}.`);
  });
  $('[data-restart]').addEventListener('click', () => restart(state.path[0], `Starting again in ${placeName(state.path[0])}.`));
  startSelect.addEventListener('change', () => restart(startSelect.value, `The droplet now starts in ${placeName(startSelect.value)}. It typically stays ${stayText(startSelect.value)}.`));
  seedInput.addEventListener('change', () => {
    const value = Number(seedInput.value);
    if (Number.isInteger(value) && value >= SEED_RANGE[0] && value <= SEED_RANGE[1]) {
      state.seed = value;
      showNote('');
      announce(`Chance code ${value}.`);
    } else {
      seedInput.value = String(state.seed);
      showNote(`Chance codes are whole numbers from ${SEED_RANGE[0]} to ${grouped(SEED_RANGE[1])}, so the code is still ${state.seed}.`);
    }
  });
  $('[data-new-seed]').addEventListener('click', () => {
    state.seed = randomSeed();
    seedInput.value = String(state.seed);
    announce(`New chance code: ${state.seed}.`);
  });

  // ---------- conditions ----------
  for (const b of $$<HTMLButtonElement>('[data-climate]')) b.addEventListener('click', () => {
    finishAnimation();
    state.climate = b.dataset.climate!;
    renderConditions();
    renderJourney();
    announce(`${CLIMATE_NAMES[state.climate]} climate. ${$('[data-cond-note]').textContent}`);
    trackExplore();
  });
  for (const box of $$<HTMLInputElement>('[data-switch]')) box.addEventListener('change', () => {
    finishAnimation();
    state[box.dataset.switch as 'sun' | 'gravity'] = box.checked;
    renderConditions();
    renderJourney();
    const at = here();
    announce(`${box.dataset.switch === 'sun' ? 'The sun’s energy' : 'Gravity'} ${box.checked ? 'on' : 'off'}. ${exits(at, cond()).length ? `${exits(at, cond()).length} ways out of ${placeName(at)}.` : stuckReason(at, cond())}`);
    trackExplore();
  });
  $<HTMLInputElement>('[data-toggle-labels]').addEventListener('change', event => {
    const on = (event.target as HTMLInputElement).checked;
    root.classList.toggle('wc-hide-labels', !on);
    announce(`Process names ${on ? 'shown' : 'hidden'}.`);
  });

  // ---------- where is Earth's water? ----------
  for (const b of $$<HTMLButtonElement>('[data-water-kind]')) b.addEventListener('click', () => {
    state.water = b.dataset.waterKind!;
    renderWhere();
    announce(state.water === 'fresh' ? 'Showing fresh water only, about 2.5% of all of Earth’s water.' : 'Showing all of Earth’s water.');
    trackExplore();
  });
  for (const b of $$<HTMLButtonElement>('[data-unit]')) b.addEventListener('click', () => {
    state.unit = b.dataset.unit!;
    renderWhere();
    announce(`Units: ${UNIT_NAMES[state.unit].toLowerCase()}.`);
  });

  // ---------- challenge ----------
  const TODAY = DEFAULT_CONDITIONS as Conditions;
  const quiz = { index: 0, score: 0, answered: false, task: null as null | { start: string; target: string; maxSteps: number; maxYears?: number }, path: [] as string[] };
  const qChoices = $('[data-q-choices]'), qFeedback = $('[data-q-feedback]'), qStatus = $('[data-q-status]');
  const qNext = $<HTMLButtonElement>('[data-q-next]'), qDone = $('[data-q-done]'), qBox = $('[data-q]');

  function taskStatus() {
    const t = quiz.task!, r = taskResult(t, quiz.path);
    qStatus.textContent = `Moves: ${r.steps} of ${t.maxSteps}${t.maxYears !== undefined ? ` · Travel time: ${r.steps ? `about ${formatDuration(r.years)}` : '0'} (must stay under ${t.maxYears} year)` : ''} · Now in ${placeName(quiz.path.at(-1)!)}`;
    return r;
  }
  function renderTask() {
    drawScene(quiz.path, TODAY, !quiz.answered);
    taskStatus();
    if (!quiz.answered) exitButtons(qChoices, quiz.path.at(-1)!, TODAY, stepTask);
    else for (const b of qChoices.querySelectorAll<HTMLButtonElement>('button')) b.disabled = true;
  }
  function stepTask(to: string) {
    if (quiz.answered || anim) return;
    const from = quiz.path.at(-1)!;
    const before = [...quiz.path];
    quiz.path.push(to);
    const r = taskResult(quiz.task!, quiz.path);
    if (r.status !== 'playing') quiz.answered = true;
    for (const b of qChoices.querySelectorAll<HTMLButtonElement>('button')) b.disabled = true;
    animate(before, from, to, TODAY, () => {
      renderTask();
      if (r.status === 'playing') {
        announce(`Now in ${placeName(to)}. ${qStatus.textContent}`);
        qChoices.querySelector<HTMLButtonElement>('button')?.focus();
      } else finishQuestion(r.status === 'success', r.status === 'success' ? `You made it in ${r.steps} move${r.steps === 1 ? '' : 's'}${quiz.task!.maxYears !== undefined ? `, about ${formatDuration(r.years)} of travel` : ''}.` : quiz.path.at(-1) === quiz.task!.target ? `It got there, but it took about ${formatDuration(r.years)}.` : `Out of moves: the droplet is in ${placeName(to)}.`);
    });
  }

  function showQuestion() {
    const q: Question = CHALLENGE[quiz.index];
    quiz.answered = false;
    quiz.task = q.kind === 'path' ? (q as { task: typeof quiz.task }).task : null;
    $('[data-q-num]').textContent = String(quiz.index + 1);
    $('[data-q-score]').textContent = String(quiz.score);
    $('[data-q-prompt]').textContent = q.prompt;
    qFeedback.hidden = true;
    qNext.hidden = true;
    qDone.hidden = true;
    qBox.hidden = false;
    qStatus.hidden = !quiz.task;
    if (quiz.task) {
      quiz.path = [quiz.task.start];
      renderTask();
      return;
    }
    drawScene([], TODAY, false);
    scene.setAttribute('aria-label', 'Water cycle diagram with the processes named.');
    const choices = (q as { choices: { value: string | number; label: string }[] }).choices;
    qChoices.replaceChildren(...choices.map(choice => {
      const b = Object.assign(document.createElement('button'), { type: 'button', className: 'btn wc-choice', textContent: choice.label });
      b.dataset.choice = String(choice.value);
      b.addEventListener('click', () => answer(String(choice.value)));
      return b;
    }));
  }
  function answer(value: string) {
    if (quiz.answered) return;
    quiz.answered = true;
    const q = CHALLENGE[quiz.index] as { answer: string | number; choices: { value: string | number; label: string }[] };
    const right = value === String(q.answer);
    for (const b of qChoices.querySelectorAll<HTMLButtonElement>('.wc-choice')) {
      b.disabled = true;
      b.classList.toggle('right', b.dataset.choice === String(q.answer));
      b.classList.toggle('wrong', b.dataset.choice === value && !right);
    }
    finishQuestion(right, right ? '' : `The answer is: ${q.choices.find(c => String(c.value) === String(q.answer))!.label}.`);
  }
  function finishQuestion(right: boolean, detail: string) {
    if (right) quiz.score++;
    $('[data-q-score]').textContent = String(quiz.score);
    qFeedback.className = `wc-feedback ${right ? 'good' : 'miss'}`;
    qFeedback.textContent = `${right ? 'Correct!' : 'Not quite.'} ${detail} ${CHALLENGE[quiz.index].explain}`.replace(/\s+/g, ' ');
    qFeedback.hidden = false;
    qNext.textContent = quiz.index === CHALLENGE.length - 1 ? 'See my score' : 'Next question';
    qNext.hidden = false;
    qFeedback.focus({ preventScroll: true });
    announce(qFeedback.textContent);
  }
  qNext.addEventListener('click', () => {
    finishAnimation();
    if (quiz.index < CHALLENGE.length - 1) {
      quiz.index++;
      showQuestion();
      announce(`Question ${quiz.index + 1} of ${CHALLENGE.length}. ${CHALLENGE[quiz.index].prompt}`);
      qChoices.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
      return;
    }
    qBox.hidden = true;
    qDone.hidden = false;
    const total = CHALLENGE.length;
    $('[data-q-final]').textContent = `You scored ${quiz.score} out of ${total}.`;
    $('[data-q-message]').textContent = quiz.score === total
      ? 'Every one right. You can trace water through the whole cycle and say what drives each step.'
      : quiz.score >= total - 2
        ? 'Great work. Check the ones you missed in Explore mode: follow a droplet and look at what powers each move.'
        : 'Try Explore mode: follow a few droplets, switch the sun’s energy and gravity off, and look at Where is Earth’s water? Then come back.';
    qDone.focus({ preventScroll: true });
    announce(`${$('[data-q-final]').textContent} ${$('[data-q-message]').textContent}`);
    track('water_challenge_complete', { score: quiz.score, total });
  });
  function restartQuiz() { quiz.index = 0; quiz.score = 0; showQuestion(); }
  $('[data-q-restart]').addEventListener('click', () => { restartQuiz(); announce(`Challenge restarted. Question 1. ${CHALLENGE[0].prompt}`); qChoices.querySelector<HTMLButtonElement>('button')?.focus(); });
  $('[data-q-explore]').addEventListener('click', () => { setMode('explore'); announce('Explore mode.'); });

  // ---------- modes, views and sharing ----------
  function layout() {
    const explore = state.mode === 'explore';
    root.dataset.mode = state.mode;
    root.dataset.view = state.view;
    $('[data-stage-grid]').hidden = explore && state.view === 'where';
    $('[data-explore-side]').hidden = !explore;
    $('[data-challenge]').hidden = explore;
    $('[data-log-panel]').hidden = !explore || state.view === 'where';
    $('[data-where-view]').hidden = !explore || state.view === 'journey';
    $<HTMLElement>('.wc-views').hidden = !explore;
    $('.wc-labels-toggle').hidden = false;
    for (const b of $$<HTMLButtonElement>('[data-mode-btn]')) b.setAttribute('aria-pressed', String(b.dataset.modeBtn === state.mode));
    for (const b of $$<HTMLButtonElement>('[data-view-btn]')) b.setAttribute('aria-pressed', String(b.dataset.viewBtn === state.view));
  }
  function setMode(mode: Mode) {
    finishAnimation();
    stopPlay();
    state.mode = mode;
    layout();
    if (mode === 'challenge') restartQuiz();
    else renderJourney();
  }
  for (const b of $$<HTMLButtonElement>('[data-mode-btn]')) b.addEventListener('click', () => {
    showNote('');
    setMode(b.dataset.modeBtn as Mode);
    announce(state.mode === 'challenge' ? `Challenge: ${CHALLENGE.length} questions. ${CHALLENGE[0].prompt}` : 'Explore mode.');
  });
  for (const b of $$<HTMLButtonElement>('[data-view-btn]')) b.addEventListener('click', () => {
    finishAnimation();
    stopPlay();
    state.view = b.dataset.viewBtn as View;
    layout();
    announce(state.view === 'where' ? 'Where is Earth’s water? Each bar zooms in on the smallest parts of the one before.' : `Droplet journey. The droplet is in ${placeName(here())}.`);
    trackExplore();
  });

  const copyBtn = $<HTMLButtonElement>('[data-copy-link]');
  copyBtn.addEventListener('click', async () => {
    const url = `${location.origin}${location.pathname}?${serializeWaterState(state)}`;
    try {
      await navigator.clipboard.writeText(url);
      copyBtn.textContent = 'Link copied ✓';
      announce('Share link copied. It replays this journey with the same chance code and conditions.');
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
  root.querySelectorAll<HTMLButtonElement | HTMLInputElement | HTMLSelectElement>('[disabled]').forEach(control => { control.disabled = false; });
  seedInput.value = String(state.seed);
  // On a phone the process names crowd the small diagram, so they start hidden there.
  if (matchMedia('(max-width: 600px)').matches) {
    $<HTMLInputElement>('[data-toggle-labels]').checked = false;
    root.classList.add('wc-hide-labels');
  }
  renderConditions();
  renderWhere();
  renderJourney();
  layout();
  if (state.mode === 'challenge') restartQuiz();
  root.classList.add('wc-ready');
}
