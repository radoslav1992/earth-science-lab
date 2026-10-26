// Plate Tectonics Explorer: Explore and Challenge modes on top of the shared model in src/lib/plates.mjs.
// The cross-section, the map and the evidence panel are re-drawn from the same functions the server used.
import {
  CASES, TYPES, PLATES, TYPE_NAMES, PLATE_NAMES, PAIR_HINTS, DEFAULT_PLATES, TIME_RANGE, CHALLENGE,
  caseKey, caseTitle, isValid, scene, sceneSvg, describeScene, mapSvg, describeMap, evidenceHtml,
  distanceKm, kmPerMyr, halfRate, seafloorAgeMyr, fmt, parsePlatesState, serializePlatesState,
} from '../../lib/plates.mjs';
import { track } from '../../lib/analytics';

type Type = (typeof TYPES)[number];
type Pair = (typeof PLATES)[number];
type Mode = 'explore' | 'challenge';
type Question = (typeof CHALLENGE)[number];

const PLAY_RATE = 2; // million years per second of animation: 0 to 20 Myr in 10 s
const choiceLabel = (key: string) => `${TYPE_NAMES[CASES[key].type]} · ${PLATE_NAMES[CASES[key].plates]}`;

export function initPlates(root: HTMLElement) {
  const $ = <T extends Element = HTMLElement>(selector: string) => root.querySelector(selector) as T;
  const $$ = <T extends Element = HTMLElement>(selector: string) => [...root.querySelectorAll(selector)] as T[];
  const live = $('[data-live]');
  const noteEl = $('[data-note]');
  const section = $<SVGSVGElement>('[data-section]');
  const map = $<SVGSVGElement>('[data-map]');
  const playBtn = $<HTMLButtonElement>('[data-play]');
  const timeInput = $<HTMLInputElement>('[data-time]');
  const speedInput = $<HTMLInputElement>('[data-speed]');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

  const { state: shared, notes } = parsePlatesState(location.search);
  const state = { ...shared, playing: false };
  let raf = 0, last = 0, pausedByHidden = false, drawn = '', tracked = '', trackTimer = 0, announceTimer = 0;

  const announce = (message: string) => { live.textContent = message; };
  const showNote = (message: string) => { noteEl.textContent = message; noteEl.hidden = !message; };
  if (notes.length) showNote(notes.join(' '));
  const key = () => caseKey(state.type, state.plates);

  // ---------- drawing ----------
  function draw() {
    const k = key(), sc = scene(k, state.t, state.speed);
    section.innerHTML = sceneSvg(sc);
    section.setAttribute('aria-label', describeScene(sc));
    map.innerHTML = mapSvg(k, state.t, state.speed);
    map.setAttribute('aria-label', describeMap(k, state.t, state.speed));
    $('[data-time-out]').textContent = fmt(state.t);
    $('[data-speed-out]').textContent = fmt(state.speed);
    $('[data-readout]').innerHTML = `${fmt(state.speed)} cm per year for ${fmt(state.t)} million years: the plates move <b>${Math.round(distanceKm(state.speed, state.t))} km</b>.`;
    timeInput.value = String(state.t);
    speedInput.value = String(state.speed);
    if (drawn !== k) {
      drawn = k;
      $('[data-case-name]').textContent = CASES[k].name;
      $('[data-case-sub]').textContent = caseTitle(k);
      $('[data-evidence]').innerHTML = evidenceHtml(k);
      $('[data-plates-hint]').textContent = PAIR_HINTS[state.type];
      for (const b of $$<HTMLButtonElement>('[data-type]')) b.setAttribute('aria-pressed', String(b.dataset.type === state.type));
      for (const b of $$<HTMLButtonElement>('[data-pair]')) {
        b.disabled = !isValid(state.type, b.dataset.pair);
        b.setAttribute('aria-pressed', String(b.dataset.pair === state.plates));
      }
    }
  }
  const summary = () => {
    const sc = scene(key(), state.t, state.speed);
    return `${fmt(state.t)} million years: the plates have moved ${Math.round(sc.distance)} km. Deepest earthquakes about ${Math.round(sc.deepest / 10) * 10} km.${sc.volcanoes.length ? ' Volcanoes are active.' : ''}`;
  };

  // Count a boundary as explored once someone has stayed on it for a moment.
  function trackExplore() {
    clearTimeout(trackTimer);
    trackTimer = window.setTimeout(() => {
      if (tracked === key()) return;
      tracked = key();
      track('plates_explore', { type: state.type, plates: state.plates });
    }, 1500);
  }

  function choose(type: Type, plates: Pair) {
    stop();
    const speedWasDefault = state.speed === CASES[key()].rate;
    state.type = type;
    state.plates = isValid(type, plates) ? plates : (DEFAULT_PLATES[type] as Pair);
    if (speedWasDefault) state.speed = CASES[key()].rate;
    draw();
    announce(`${CASES[key()].name}: ${caseTitle(key())}. ${CASES[key()].summary}`);
    trackExplore();
  }

  // ---------- animation ----------
  function frame(now: number) {
    state.t = Math.min(TIME_RANGE[1], Math.round((state.t + ((now - last) / 1000) * PLAY_RATE) * 1000) / 1000);
    last = now;
    draw();
    if (state.t >= TIME_RANGE[1]) { stop(); playBtn.textContent = 'Replay'; announce(`Finished. ${summary()}`); return; }
    raf = requestAnimationFrame(frame);
  }
  function start() { state.playing = true; last = performance.now(); playBtn.textContent = 'Pause'; raf = requestAnimationFrame(frame); }
  function stop() {
    cancelAnimationFrame(raf);
    if (state.playing) playBtn.textContent = state.t >= TIME_RANGE[1] ? 'Replay' : 'Play';
    state.playing = false;
    pausedByHidden = false;
  }
  playBtn.addEventListener('click', () => {
    if (state.playing) { stop(); state.t = Math.round(state.t * 10) / 10; draw(); announce(`Paused. ${summary()}`); return; }
    if (reduceMotion.matches) {
      state.t = TIME_RANGE[1];
      draw();
      playBtn.textContent = 'Play';
      announce(`Reduced motion is on, so the explorer jumps to the end. ${summary()}`);
      return;
    }
    if (state.t >= TIME_RANGE[1]) state.t = 0;
    start();
    announce('Playing.');
  });
  // The animation pauses while the tab is hidden and carries on when it comes back.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.playing) { cancelAnimationFrame(raf); state.playing = false; pausedByHidden = true; }
    else if (!document.hidden && pausedByHidden) { pausedByHidden = false; start(); }
  });

  timeInput.addEventListener('input', () => { stop(); playBtn.textContent = 'Play'; state.t = Number(timeInput.value); draw(); });
  speedInput.addEventListener('input', () => { state.speed = Number(speedInput.value); draw(); });
  for (const input of [timeInput, speedInput]) input.addEventListener('change', () => {
    clearTimeout(announceTimer);
    announceTimer = window.setTimeout(() => announce(`${fmt(state.speed)} cm per year. ${summary()}`), 250);
  });

  // ---------- pickers and toggles ----------
  for (const b of $$<HTMLButtonElement>('[data-type]')) b.addEventListener('click', () => choose(b.dataset.type as Type, state.plates as Pair));
  for (const b of $$<HTMLButtonElement>('[data-pair]')) b.addEventListener('click', () => choose(state.type as Type, b.dataset.pair as Pair));
  for (const box of $$<HTMLInputElement>('[data-toggle]')) {
    box.addEventListener('change', () => {
      root.classList.toggle(`pt-hide-${box.dataset.toggle}`, !box.checked);
      announce(`${box.parentElement?.textContent?.trim()} ${box.checked ? 'on' : 'off'}.`);
    });
  }

  // ---------- calculator ----------
  const calcInput = (name: string) => $<HTMLInputElement>(`[data-c="${name}"]`);
  const value = (name: string) => { const v = calcInput(name).value.trim(); return v === '' ? NaN : Number(v); };
  function calcDistance() {
    const rate = value('rate'), time = value('time');
    const out = $('[data-c-out="distance"]'), work = $('[data-c-work="distance"]');
    $('[data-c-title]').textContent = Number.isFinite(time) && time >= 0 ? fmt(time) : 'X';
    if (!(Number.isFinite(rate) && rate >= 0) || !(Number.isFinite(time) && time >= 0)) {
      out.textContent = '–';
      work.textContent = 'Type a speed and a time of zero or more.';
      return;
    }
    out.textContent = `${fmt(distanceKm(rate, time))} km`;
    work.textContent = `${fmt(rate, 2)} cm per year = ${fmt(kmPerMyr(rate), 2)} km per million years, and ${fmt(kmPerMyr(rate), 2)} × ${fmt(time, 2)} = ${fmt(distanceKm(rate, time))} km.`;
  }
  function calcAge() {
    const km = value('km'), full = value('full');
    const out = $('[data-c-out="age"]'), work = $('[data-c-work="age"]');
    if (!(Number.isFinite(km) && km >= 0) || !(Number.isFinite(full) && full > 0)) {
      out.textContent = '–';
      work.textContent = 'Type a distance of zero or more and a spreading rate above zero.';
      return;
    }
    const half = halfRate(full), age = seafloorAgeMyr(km, half);
    out.textContent = `${fmt(age)} million years old`;
    work.textContent = `Each plate moves away at half the rate: ${fmt(full, 2)} ÷ 2 = ${fmt(half, 2)} cm per year = ${fmt(kmPerMyr(half), 2)} km per million years. Age = ${fmt(km, 2)} ÷ ${fmt(kmPerMyr(half), 2)} = ${fmt(age)} million years.`;
  }
  for (const name of ['rate', 'time']) calcInput(name).addEventListener('input', calcDistance);
  for (const name of ['km', 'full']) calcInput(name).addEventListener('input', calcAge);
  for (const form of $$<HTMLFormElement>('[data-calc]')) form.addEventListener('submit', event => event.preventDefault());
  $('[data-c-use]').addEventListener('click', () => {
    calcInput('rate').value = String(state.speed);
    calcInput('time').value = String(Math.round(state.t * 10) / 10);
    calcDistance();
    announce(`Calculator: ${$('[data-c-work="distance"]').textContent}`);
  });

  // ---------- challenge ----------
  const quiz = { index: 0, score: 0, answered: false };
  const qShow = $('[data-q-show]'), qChoices = $('[data-q-choices]'), qFeedback = $('[data-q-feedback]');
  const qNext = $<HTMLButtonElement>('[data-q-next]'), qDone = $('[data-q-done]'), qBox = $('[data-q]');
  $('[data-q-total]').textContent = String(CHALLENGE.length);

  function showQuestion() {
    const q: Question = CHALLENGE[quiz.index];
    quiz.answered = false;
    $('[data-q-num]').textContent = String(quiz.index + 1);
    $('[data-q-score]').textContent = String(quiz.score);
    $('[data-q-prompt]').textContent = q.prompt;
    const show = q.show;
    if (show.kind === 'evidence') {
      qShow.innerHTML = '<h3>The evidence</h3><ul class="pt-q-evidence"></ul>';
      for (const item of q.evidence ?? []) qShow.querySelector('ul')!.append(Object.assign(document.createElement('li'), { textContent: item }));
    } else if (show.kind === 'section') {
      const sc = scene(show.key, show.t, show.speed);
      qShow.innerHTML = `<svg class="xs pt-mystery" viewBox="0 0 800 440" role="img">${sceneSvg(sc)}</svg>`;
      qShow.querySelector('svg')!.setAttribute('aria-label', `Mystery cross-section, labels hidden. ${q.describe}`);
    } else {
      qShow.innerHTML = `<svg class="plate-map pt-mystery" viewBox="0 0 280 190" role="img">${mapSvg(show.key, show.t, show.speed)}</svg>`;
      qShow.querySelector('svg')!.setAttribute('aria-label', `Mystery map. ${q.describe}`);
    }
    qChoices.replaceChildren(...q.choices.map(choice => {
      const b = Object.assign(document.createElement('button'), { type: 'button', className: 'btn pt-choice', textContent: choiceLabel(choice) });
      b.dataset.choice = choice;
      b.addEventListener('click', () => answer(choice));
      return b;
    }));
    qFeedback.hidden = true;
    qNext.hidden = true;
    qDone.hidden = true;
    qBox.hidden = false;
  }
  function answer(choice: string) {
    if (quiz.answered) return;
    quiz.answered = true;
    const q = CHALLENGE[quiz.index], right = choice === q.answer;
    if (right) quiz.score++;
    $('[data-q-score]').textContent = String(quiz.score);
    for (const b of $$<HTMLButtonElement>('.pt-choice')) {
      b.disabled = true;
      b.classList.toggle('right', b.dataset.choice === q.answer);
      b.classList.toggle('wrong', b.dataset.choice === choice && !right);
    }
    qFeedback.className = `pt-feedback ${right ? 'good' : 'miss'}`;
    qFeedback.textContent = `${right ? 'Correct!' : `Not quite. The answer is ${choiceLabel(q.answer)}.`} ${q.explain}`;
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
      $<HTMLButtonElement>('.pt-choice').focus();
      return;
    }
    qBox.hidden = true;
    qDone.hidden = false;
    const total = CHALLENGE.length;
    $('[data-q-final]').textContent = `You scored ${quiz.score} out of ${total}.`;
    $('[data-q-message]').textContent = quiz.score === total
      ? 'Every boundary identified. You can read the evidence like a geologist.'
      : quiz.score >= total - 2
        ? 'Great work. Check the ones you missed in Explore mode: compare the earthquake depths and volcanoes.'
        : 'Try Explore mode for each boundary, then come back: look at how deep the earthquakes go, and whether volcanoes form.';
    qDone.focus();
    track('plates_challenge_complete', { score: quiz.score, total });
  });
  function restartQuiz() { quiz.index = 0; quiz.score = 0; showQuestion(); }
  $('[data-q-restart]').addEventListener('click', () => { restartQuiz(); announce('Challenge restarted. Question 1.'); $<HTMLButtonElement>('.pt-choice').focus(); });
  $('[data-q-explore]').addEventListener('click', () => { setMode('explore'); announce('Explore mode.'); });

  // ---------- modes and sharing ----------
  function setMode(mode: Mode) {
    state.mode = mode;
    stop();
    root.dataset.mode = mode;
    $('[data-explore]').hidden = mode !== 'explore';
    $('[data-challenge]').hidden = mode !== 'challenge';
    for (const b of $$<HTMLButtonElement>('[data-mode-btn]')) b.setAttribute('aria-pressed', String(b.dataset.modeBtn === mode));
    if (mode === 'challenge') restartQuiz();
  }
  for (const b of $$<HTMLButtonElement>('[data-mode-btn]')) b.addEventListener('click', () => {
    showNote('');
    setMode(b.dataset.modeBtn as Mode);
    announce(state.mode === 'challenge' ? `Challenge: ${CHALLENGE.length} questions. ${CHALLENGE[0].prompt}` : 'Explore mode.');
  });

  const copyBtn = $<HTMLButtonElement>('[data-copy-link]');
  copyBtn.addEventListener('click', async () => {
    const url = `${location.origin}${location.pathname}?${serializePlatesState({ ...state, t: Math.round(state.t * 10) / 10 })}`;
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
  drawn = '';
  draw();
  setMode(state.mode as Mode);
  root.classList.add('pt-ready');
}
