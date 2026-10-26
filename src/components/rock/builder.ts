// Rock Cycle Builder: Explore and Challenge modes on top of the shared model in src/lib/rock-cycle.mjs.
// Every panel is re-drawn from the same functions the server used, so the page and the script agree.
import {
  MATERIALS, FAMILY_NAMES, PLACES, PROCESSES, OPTIONS, CHALLENGE, START_IDS,
  apply, replay, options, conditions, startConditions, stepName, shortestPath, challengePar, choiceLabel,
} from '../../lib/rock-cycle.mjs';
import {
  sectionSvg, describeSection, cycleSvg, describeCycle, cardHtml, conditionsHtml, journeyHtml, swatchSvg, placeXY,
} from '../../lib/rock-view.mjs';
import { parseRockState, serializeRockState, MAX_STEPS } from '../../lib/rock-share.mjs';
import { track } from '../../lib/analytics';

type Mode = 'explore' | 'challenge';
type Journey = { start: string; steps: string[] };
type Question = (typeof CHALLENGE)[number];
type Point = [number, number];

const MOVE_MS = 850;
const name = (id: string) => MATERIALS[id].name;

export function initRock(root: HTMLElement) {
  const $ = <T extends Element = HTMLElement>(selector: string) => root.querySelector(selector) as T;
  const $$ = <T extends Element = HTMLElement>(selector: string) => [...root.querySelectorAll(selector)] as T[];
  const live = $('[data-live]');
  const noteEl = $('[data-note]');
  const hint = $('[data-hint]');
  const section = $<SVGSVGElement>('[data-section]');
  const cycle = $<SVGSVGElement>('[data-cycle]');
  const startSelect = $<HTMLSelectElement>('[data-start]');
  const optionButtons = $$<HTMLButtonElement>('[data-code]');
  const undoBtn = $<HTMLButtonElement>('[data-undo]');
  const resetBtn = $<HTMLButtonElement>('[data-reset]');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

  const { state: shared, notes } = parseRockState(location.search);
  const explore: Journey = { start: shared.start, steps: [...shared.steps] };
  const task: Journey = { start: START_IDS[0], steps: [] };
  let mode: Mode = shared.mode as Mode;
  let journey: Journey = explore;
  let raf = 0, target: Point | null = null, trackTimer = 0;

  const announce = (message: string) => { live.textContent = ''; window.setTimeout(() => { live.textContent = message; }, 30); };
  const showNote = (message: string) => { noteEl.textContent = message; noteEl.hidden = !message; };
  if (notes.length) showNote(notes.join(' '));
  if (explore.steps.length || mode === 'challenge') hint.hidden = true;
  const run = () => replay(journey.start, journey.steps);
  const hideWhy = () => { for (const p of $$('[data-why]')) p.hidden = true; };

  // ---------- drawing ----------
  function draw(moveFrom: Point | null = null) {
    const { states } = run();
    const now = states[states.length - 1];
    const last = journey.steps[journey.steps.length - 1] ?? '';
    section.innerHTML = sectionSvg(states, { active: last });
    section.setAttribute('aria-label', describeSection(states));
    cycle.innerHTML = cycleSvg(states);
    cycle.setAttribute('aria-label', describeCycle(states));
    $('[data-card]').innerHTML = cardHtml(now);
    const c = journey.steps.length ? conditions(last, now, states[states.length - 2]) : startConditions(now);
    $('[data-conditions]').innerHTML = conditionsHtml(c, { start: !journey.steps.length });
    $('[data-journey]').innerHTML = journeyHtml(states, journey.steps);
    const n = journey.steps.length;
    $('[data-steps]').textContent = `${n} step${n === 1 ? '' : 's'}`;
    // Which options can happen now.
    const avail = options(now);
    for (const b of optionButtons) {
      const ok = avail[b.dataset.code!].ok;
      b.setAttribute('aria-disabled', String(!ok));
      b.classList.toggle('ok', ok);
    }
    const possible = PROCESSES.filter(p => OPTIONS.some(o => o.process === p.id && avail[o.code].ok)).length;
    $('.rk-now-art').innerHTML = swatchSvg(now.id, { comp: now.comp, className: 'rk-mini', label: '' });
    $('[data-now-name]').textContent = name(now.id);
    $('[data-now-where]').textContent = PLACES[now.place].short;
    $('[data-now-count]').textContent = `${possible} of ${PROCESSES.length} processes can happen.`;
    startSelect.value = journey.start;
    const locked = mode === 'challenge' && quiz.answered;
    undoBtn.disabled = n === 0 || locked;
    resetBtn.disabled = n === 0 || locked;
    if (moveFrom) moveMarker(moveFrom, placeXY(now.place) as Point);
  }

  // The rock glides from its old place to its new one along a gentle arc.
  function moveMarker(from: Point, to: Point) {
    cancelAnimationFrame(raf);
    const marker = section.querySelector('[data-marker]');
    target = to;
    if (!marker || reduceMotion.matches || document.hidden || (from[0] === to[0] && from[1] === to[1])) return;
    const lift = Math.min(70, Math.hypot(to[0] - from[0], to[1] - from[1]) * 0.25);
    const t0 = performance.now();
    const frame = (time: number) => {
      const t = Math.min(1, (time - t0) / MOVE_MS), e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      const x = from[0] + (to[0] - from[0]) * e, y = from[1] + (to[1] - from[1]) * e - Math.sin(Math.PI * e) * lift;
      marker.setAttribute('transform', t < 1 ? `translate(${x.toFixed(1)} ${y.toFixed(1)})` : `translate(${to[0]} ${to[1]})`);
      if (t < 1) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  }
  // Pause everything that moves while the tab is hidden: finish the glide and stop the marker's pulse.
  document.addEventListener('visibilitychange', () => {
    root.classList.toggle('rk-paused', document.hidden);
    if (document.hidden && target) {
      cancelAnimationFrame(raf);
      section.querySelector('[data-marker]')?.setAttribute('transform', `translate(${target[0]} ${target[1]})`);
    }
  });

  // ---------- applying processes ----------
  function trackExplore(code: string, rock: string) {
    clearTimeout(trackTimer);
    trackTimer = window.setTimeout(() => track('rock_explore', { process: code, rock, steps: explore.steps.length }), 1500);
  }
  function applyCode(code: string, button: HTMLButtonElement) {
    hideWhy();
    if (mode === 'challenge' && quiz.answered) {
      showWhy(button, 'This task is finished. Press Next question to go on.');
      return;
    }
    const before = run();
    const now = before.states[before.states.length - 1];
    const r = apply(now, code);
    if (!r.ok) { showWhy(button, r.reason); return; }
    if (journey.steps.length >= MAX_STEPS) { showWhy(button, `A journey can have up to ${MAX_STEPS} steps. Press Undo last step or Start over to keep going.`); return; }
    journey.steps.push(code);
    hint.hidden = true;
    showNote('');
    draw(placeXY(now.place) as Point);
    const c = conditions(code, r.state, now);
    announce(`Step ${journey.steps.length}: ${stepName(code)}. Now ${name(r.state.id)}, ${FAMILY_NAMES[MATERIALS[r.state.id].family]}. ${c.where}. ${c.tempText}.`);
    if (mode === 'explore') trackExplore(code, r.state.id);
    else checkGoal();
  }
  function showWhy(button: HTMLButtonElement, reason: string) {
    const why = button.closest('[data-proc]')!.querySelector<HTMLElement>('[data-why]')!;
    why.textContent = reason;
    why.hidden = false;
    announce(reason);
  }
  for (const b of optionButtons) b.addEventListener('click', () => applyCode(b.dataset.code!, b));

  undoBtn.addEventListener('click', () => {
    if (!journey.steps.length) return;
    hideWhy();
    const from = placeXY(run().states.at(-1)!.place) as Point;
    const undone = journey.steps.pop()!;
    draw(from);
    announce(`Undid ${stepName(undone).toLowerCase()}. Now ${name(run().states.at(-1)!.id)}.`);
    (undoBtn.disabled ? resetBtn.disabled ? startSelect : resetBtn : undoBtn).focus();
  });
  resetBtn.addEventListener('click', () => {
    hideWhy();
    journey.steps = [];
    draw();
    announce(`Started over from ${name(journey.start).toLowerCase()}.`);
    (mode === 'explore' ? startSelect : $<HTMLButtonElement>('[data-code]')).focus();
  });
  startSelect.addEventListener('change', () => {
    if (mode !== 'explore') return;
    hideWhy();
    explore.start = startSelect.value;
    explore.steps = [];
    showNote('');
    draw();
    const s = run().states[0];
    announce(`Starting from ${name(s.id).toLowerCase()}, ${PLACES[s.place].name.toLowerCase()}.`);
    trackExplore('start', s.id);
  });
  $<HTMLInputElement>('[data-labels]').addEventListener('change', event => {
    const on = (event.target as HTMLInputElement).checked;
    root.classList.toggle('rk-hide-labels', !on);
    announce(`Labels ${on ? 'on' : 'off'}.`);
  });

  // ---------- challenge ----------
  const quiz = { index: 0, score: 0, answered: false };
  const qShow = $('[data-q-show]'), qChoices = $('[data-q-choices]'), qFeedback = $('[data-q-feedback]');
  const qHelp = $('[data-q-help]'), qProgress = $('[data-q-progress]');
  const qNext = $<HTMLButtonElement>('[data-q-next]'), qSkip = $<HTMLButtonElement>('[data-q-skip]'), qRoute = $<HTMLButtonElement>('[data-q-route]');
  const qDone = $('[data-q-done]'), qBox = $('[data-q]'), builder = $('[data-builder]');
  const routeText = (q: Question) => shortestPath(q.start!, q.goal!)!.map(stepName).join(' → ');

  function showQuestion() {
    const q: Question = CHALLENGE[quiz.index];
    quiz.answered = false;
    $('[data-q-num]').textContent = String(quiz.index + 1);
    $('[data-q-score]').textContent = String(quiz.score);
    $('[data-q-prompt]').textContent = q.prompt;
    qFeedback.hidden = true;
    qNext.hidden = true;
    qRoute.hidden = true;
    qDone.hidden = true;
    qBox.hidden = false;
    hideWhy();
    if (q.kind === 'build') {
      task.start = q.start!;
      task.steps = [];
      journey = task;
      builder.hidden = false;
      startSelect.disabled = true;
      qShow.hidden = true;
      qChoices.replaceChildren();
      qHelp.textContent = q.help!;
      qHelp.hidden = false;
      qSkip.hidden = false;
      updateProgress();
      draw();
    } else {
      builder.hidden = true;
      qHelp.hidden = true;
      qProgress.hidden = true;
      qSkip.hidden = true;
      if (q.kind === 'texture') {
        qShow.innerHTML = swatchSvg(q.show!, { className: 'rk-swatch rk-mystery', label: `Mystery rock drawing: ${q.describe}` });
        qShow.hidden = false;
      } else qShow.hidden = true;
      qChoices.replaceChildren(...q.choices!.map(choice => {
        const b = Object.assign(document.createElement('button'), { type: 'button', className: 'btn rk-choice', textContent: choiceLabel(q, choice) });
        b.dataset.choice = choice;
        b.addEventListener('click', () => answerChoice(choice));
        return b;
      }));
    }
  }
  function updateProgress() {
    const q = CHALLENGE[quiz.index];
    if (q.kind !== 'build') return;
    const n = task.steps.length;
    qProgress.textContent = `Goal: ${name(q.goal!).toLowerCase()}. Steps so far: ${n}.`;
    qProgress.hidden = false;
  }
  function finishQuestion(right: boolean, text: string) {
    quiz.answered = true;
    if (right) quiz.score++;
    $('[data-q-score]').textContent = String(quiz.score);
    qFeedback.className = `rk-feedback ${right ? 'good' : 'miss'}`;
    qFeedback.textContent = text;
    qFeedback.hidden = false;
    qSkip.hidden = true;
    qNext.textContent = quiz.index === CHALLENGE.length - 1 ? 'See my score' : 'Next question';
    qNext.hidden = false;
    qFeedback.focus();
  }
  function answerChoice(choice: string) {
    if (quiz.answered) return;
    const q = CHALLENGE[quiz.index], right = choice === q.answer;
    for (const b of $$<HTMLButtonElement>('.rk-choice')) {
      b.disabled = true;
      b.classList.toggle('right', b.dataset.choice === q.answer);
      b.classList.toggle('wrong', b.dataset.choice === choice && !right);
    }
    finishQuestion(right, `${right ? 'Correct!' : `Not quite. The answer is ${choiceLabel(q, q.answer!)}.`} ${q.explain}`);
  }
  function checkGoal() {
    const q = CHALLENGE[quiz.index];
    updateProgress();
    if (q.kind !== 'build' || quiz.answered) return;
    const now = run().states.at(-1)!;
    if (now.id !== q.goal) return;
    const n = task.steps.length, par = challengePar(q);
    const right = q.fewest ? n === par : true;
    const made = `You made ${name(q.goal!).toLowerCase()} in ${n} step${n === 1 ? '' : 's'}.`;
    const fewest = n === par ? `That’s the fewest possible.` : `The fewest possible is ${par}: ${routeText(q)}.`;
    const lead = right ? (q.fewest ? 'Perfect!' : 'Well done!') : 'You made it, but not in the fewest steps.';
    finishQuestion(right, `${lead} ${made} ${fewest} ${q.explain}`);
    qRoute.hidden = n === par;
    draw();
  }
  qSkip.addEventListener('click', () => {
    const q = CHALLENGE[quiz.index];
    if (quiz.answered || q.kind !== 'build') return;
    const path = shortestPath(q.start!, q.goal!)!;
    task.steps = [...path];
    finishQuestion(false, `No problem. Here is one shortest route, ${path.length} steps: ${routeText(q)}. It is now drawn in the builder. ${q.explain}`);
    updateProgress();
    draw();
  });
  qRoute.addEventListener('click', () => {
    const q = CHALLENGE[quiz.index];
    task.steps = [...shortestPath(q.start!, q.goal!)!];
    qRoute.hidden = true;
    updateProgress();
    draw();
    announce(`A shortest route is now drawn in the builder: ${routeText(q)}.`);
    qNext.focus();
  });
  qNext.addEventListener('click', () => {
    if (quiz.index < CHALLENGE.length - 1) {
      quiz.index++;
      showQuestion();
      const q = CHALLENGE[quiz.index];
      announce(`Question ${quiz.index + 1} of ${CHALLENGE.length}. ${q.prompt}`);
      (q.kind === 'build' ? $<HTMLButtonElement>('[data-q-prompt]') : $<HTMLButtonElement>('.rk-choice')).focus?.();
      if (q.kind === 'build') qBox.scrollIntoView({ block: 'nearest', behavior: reduceMotion.matches ? 'auto' : 'smooth' });
      return;
    }
    qBox.hidden = true;
    builder.hidden = true;
    qDone.hidden = false;
    const total = CHALLENGE.length;
    $('[data-q-final]').textContent = `You scored ${quiz.score} out of ${total}.`;
    $('[data-q-message]').textContent = quiz.score === total
      ? 'Every question right. You can read rocks like a geologist.'
      : quiz.score >= total - 2
        ? 'Great work. Try the ones you missed in Explore mode: look at each rock’s card and where it forms.'
        : 'Go back to Explore mode and try some journeys: melt a rock, weather it, squeeze it, and watch which family it joins.';
    qDone.focus();
    track('rock_challenge_complete', { score: quiz.score, total });
  });
  function restartQuiz() { quiz.index = 0; quiz.score = 0; showQuestion(); }
  $('[data-q-restart]').addEventListener('click', () => { restartQuiz(); announce(`Challenge restarted. Question 1. ${CHALLENGE[0].prompt}`); $('[data-q-prompt]').focus(); });
  $('[data-q-explore]').addEventListener('click', () => { setMode('explore'); announce('Explore mode.'); });
  $('[data-q-prompt]').tabIndex = -1;

  // ---------- modes and sharing ----------
  function setMode(next: Mode) {
    mode = next;
    hideWhy();
    root.dataset.mode = mode;
    $('[data-challenge]').hidden = mode !== 'challenge';
    for (const b of $$<HTMLButtonElement>('[data-mode-btn]')) b.setAttribute('aria-pressed', String(b.dataset.modeBtn === mode));
    if (mode === 'challenge') { hint.hidden = true; restartQuiz(); return; }
    journey = explore;
    builder.hidden = false;
    startSelect.disabled = false;
    draw();
  }
  for (const b of $$<HTMLButtonElement>('[data-mode-btn]')) b.addEventListener('click', () => {
    if (b.dataset.modeBtn === mode) return;
    showNote('');
    setMode(b.dataset.modeBtn as Mode);
    announce(mode === 'challenge' ? `Challenge: ${CHALLENGE.length} questions. Question 1. ${CHALLENGE[0].prompt}` : 'Explore mode.');
  });

  const copyBtn = $<HTMLButtonElement>('[data-copy-link]');
  copyBtn.addEventListener('click', async () => {
    const url = `${location.origin}${location.pathname}?${serializeRockState({ mode, start: explore.start, steps: explore.steps })}`;
    try {
      await navigator.clipboard.writeText(url);
      copyBtn.textContent = 'Link copied ✓';
      announce(mode === 'challenge' ? 'Share link to the challenge copied.' : 'Share link copied. It replays this journey.');
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
  setMode(mode);
  root.classList.add('rk-ready');
}
