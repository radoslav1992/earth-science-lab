// River Erosion Sandbox: Explore and Challenge modes on top of the shared model in src/lib/river.mjs.
// The stream table, the side view and the Hjulström diagram are redrawn with the same functions the server used.
import {
  TIME_RANGE, CHALLENGE_COUNT, ZONE_NAMES,
  simulate, measure, describeRun, grainById, zoneAt, challengeQuestions, parseRiverState, serializeRiverState,
  fmt, fmtSpeed, fmtVolume, fmtDepth,
} from '../../lib/river.mjs';
import {
  planInner, profileInner, describePlan, describeProfile, hjSpeedLayer, hjProbeLayer, hjAt, hjulstromSvg, describeHjulstrom,
  grainRows, fmtSize, fmtSpeedPrecise,
} from '../../lib/river-svg.mjs';
import { track } from '../../lib/analytics';

type Mode = 'explore' | 'challenge';
type Settings = { slope: number; flow: number; grain: string; supply: number };
type Question = ReturnType<typeof challengeQuestions>[number];

const PLAY_RATE = 2; // model minutes per second: 20 minutes of running water in 10 s
const PROBE_STEP = 0.05; // decades per arrow-key press (Shift: 0.25)
const degrees = (pct: number) => fmt((Math.atan(pct / 100) * 180) / Math.PI, 1);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const setupText = (s: Settings) => `${fmt(s.slope)}% slope, ${fmt(s.flow)} L/min, ${grainById(s.grain).name.toLowerCase()}${s.supply ? `, ${s.supply} cm³ fed in per minute` : ''}`;

export function initRiver(root: HTMLElement) {
  const $ = <T extends Element = HTMLElement>(selector: string, scope: ParentNode = root) => scope.querySelector(selector) as T;
  const $$ = <T extends Element = HTMLElement>(selector: string) => [...root.querySelectorAll(selector)] as T[];
  const live = $('[data-live]');
  const noteEl = $('[data-note]');
  const plan = $<SVGSVGElement>('[data-plan]');
  const profile = $<SVGSVGElement>('[data-profile]');
  const hj = $<SVGSVGElement>('[data-hj]');
  const playBtn = $<HTMLButtonElement>('[data-play]');
  const input = (name: string) => $<HTMLInputElement>(`[data-input="${name}"]`);
  const out = (name: string) => $(`[data-out="${name}"]`);
  const hint = $('[data-hint]');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

  const { state: shared, notes } = parseRiverState(location.search);
  const state = { ...shared, labels: true, playing: false } as typeof shared & { labels: boolean; playing: boolean };
  let raf = 0, last = 0, pausedByHidden = false, drawnKey = '', trackTimer = 0, tracked = '', announceTimer = 0;
  let probe: { mm: number; v: number } | null = null;
  // Run starts the water from 0 minutes, unless someone paused it or picked a time on the slider.
  let resumable = false;

  const announce = (message: string) => { live.textContent = message; };
  const announceSoon = (message: string, delay = 400) => { clearTimeout(announceTimer); announceTimer = window.setTimeout(() => announce(message), delay); };
  const showNote = (message: string) => { noteEl.textContent = message; noteEl.hidden = !message; };
  if (notes.length) showNote(notes.join(' '));
  const settings = (): Settings => ({ slope: state.slope, flow: state.flow, grain: state.grain, supply: state.supply });
  const currentRun = () => simulate(settings());

  // ---------- drawing ----------
  function draw(force = false) {
    const run = currentRun();
    const t = Math.round(state.t * 10) / 10;
    const key = `${state.slope}|${state.flow}|${state.grain}|${state.supply}|${t}|${state.labels}`;
    if (!force && key === drawnKey) return;
    drawnKey = key;
    const m = measure(run, t);
    plan.innerHTML = planInner(run, t, { labels: state.labels });
    plan.setAttribute('aria-label', describePlan(run, t));
    profile.innerHTML = profileInner(run, t, { labels: state.labels });
    profile.setAttribute('aria-label', describeProfile(run, t));
    out('t').textContent = fmt(t);
    $('[data-stat="speed"]').textContent = fmtSpeed(m.startSpeed);
    $('[data-stat="speed-now"]').textContent = t > 0 ? `at the start; now ${fmtSpeed(m.speedNow)} cm/s` : 'at the start';
    $('[data-stat="eroded"]').textContent = fmtVolume(m.eroded);
    $('[data-stat="cut"]').textContent = fmtDepth(m.deepestCut);
    $('[data-stat="delta"]').textContent = String(m.deltaLength);
    $('[data-summary]').textContent = describeRun(run, t);
    drawSpeed(m.speedNow);
  }
  let speedDrawn = '';
  function drawSpeed(v: number) {
    const key = `${fmtSpeed(v)}|${state.grain}`;
    if (key === speedDrawn) return;
    speedDrawn = key;
    $('[data-layer="speed"]', hj).innerHTML = hjSpeedLayer(v, state.grain);
    hj.setAttribute('aria-label', describeHjulstrom(v, state.grain));
    $('[data-hj-speed]').textContent = fmtSpeed(v);
    $('[data-grain-rows]').innerHTML = grainRows(v).map(r => `<li${r.id === state.grain ? ' class="on"' : ''}><span class="rv-pill rv-pill-${r.zone}">${ZONE_NAMES[r.zone]}</span><span><strong>${r.name} (${fmt(r.mm, 3)} mm)</strong>${r.text.replace(/^[^.]*\. /, '')}</span></li>`).join('');
  }
  function syncControls() {
    input('slope').value = String(state.slope);
    input('flow').value = String(state.flow);
    input('supply').value = String(state.supply);
    input('t').value = String(Math.round(state.t * 2) / 2);
    out('slope').textContent = `${fmt(state.slope)}%`;
    out('degrees').textContent = `(a tilt of ${degrees(state.slope)}°)`;
    out('flow').textContent = `${fmt(state.flow)} L/min`;
    out('supply').textContent = `${state.supply} cm³ per minute`;
    out('supply-note').textContent = state.supply ? '' : '(clear water)';
    const g = grainById(state.grain);
    $('[data-grain-note]').textContent = `${g.name}: grains about ${fmt(g.mm, 3)} mm across, ${g.note}.`;
    for (const b of $$<HTMLButtonElement>('[data-grain]')) b.setAttribute('aria-pressed', String(b.dataset.grain === state.grain));
  }
  const resultSentence = () => describeRun(currentRun(), state.t);

  // Count a setup as explored once someone has stayed on it for a moment (settings only, no personal data).
  function trackExplore() {
    clearTimeout(trackTimer);
    trackTimer = window.setTimeout(() => {
      const key = `${state.slope}|${state.flow}|${state.grain}|${state.supply}`;
      if (key === tracked) return;
      tracked = key;
      track('river_explore', { slope: state.slope, flow: state.flow, grain: state.grain, supply: state.supply });
    }, 1500);
  }
  function changed(announceIt = true) {
    syncControls();
    draw();
    trackExplore();
    if (announceIt) announceSoon(resultSentence());
  }

  // ---------- running the water ----------
  function frame(now: number) {
    state.t = Math.min(TIME_RANGE[1], state.t + ((now - last) / 1000) * PLAY_RATE);
    last = now;
    input('t').value = String(Math.round(state.t * 2) / 2);
    draw();
    if (state.t >= TIME_RANGE[1]) {
      stop();
      playBtn.textContent = 'Run again';
      const m = measure(currentRun(), TIME_RANGE[1]);
      track('river_run_complete', { slope: state.slope, flow: state.flow, grain: state.grain, supply: state.supply, delta_cm: m.deltaLength, eroded_cm3: Math.round(m.eroded) });
      announce(`Finished. ${resultSentence()}`);
      return;
    }
    raf = requestAnimationFrame(frame);
  }
  function start() {
    state.playing = true;
    last = performance.now();
    playBtn.textContent = 'Pause';
    root.classList.add('rv-running');
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    cancelAnimationFrame(raf);
    if (state.playing) playBtn.textContent = state.t >= TIME_RANGE[1] ? 'Run again' : 'Run';
    state.playing = false;
    pausedByHidden = false;
    root.classList.remove('rv-running');
  }
  playBtn.addEventListener('click', () => {
    hint.hidden = true;
    if (state.playing) {
      stop();
      resumable = true;
      state.t = Math.round(state.t * 10) / 10;
      draw();
      announce(`Paused. ${resultSentence()}`);
      return;
    }
    if (reduceMotion.matches) {
      state.t = TIME_RANGE[1];
      input('t').value = String(state.t);
      draw();
      playBtn.textContent = 'Run';
      announce(`Reduced motion is on, so the sandbox jumps to ${TIME_RANGE[1]} minutes. ${resultSentence()}`);
      return;
    }
    if (!resumable || state.t >= TIME_RANGE[1] - 0.05) state.t = 0;
    resumable = false;
    start();
    announce('Running the water.');
  });
  // The water pauses while the tab is hidden and carries on when it comes back.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.playing) { cancelAnimationFrame(raf); state.playing = false; pausedByHidden = true; root.classList.remove('rv-running'); }
    else if (!document.hidden && pausedByHidden) { pausedByHidden = false; start(); }
  });

  // ---------- controls ----------
  input('t').addEventListener('input', () => { stop(); resumable = true; state.t = Number(input('t').value); playBtn.textContent = 'Run'; draw(); });
  input('t').addEventListener('change', () => announceSoon(resultSentence(), 250));
  for (const name of ['slope', 'flow', 'supply'] as const) {
    input(name).addEventListener('input', () => { state[name] = Number(input(name).value); changed(false); });
    input(name).addEventListener('change', () => announceSoon(resultSentence(), 250));
  }
  for (const b of $$<HTMLButtonElement>('[data-grain]')) b.addEventListener('click', () => {
    state.grain = b.dataset.grain!;
    changed(false);
    const g = grainById(state.grain);
    announceSoon(`${g.name}, ${fmt(g.mm, 3)} mm. ${resultSentence()}`, 100);
  });
  $<HTMLInputElement>('[data-toggle-labels]').addEventListener('change', event => {
    state.labels = (event.target as HTMLInputElement).checked;
    draw();
    announce(`Labels ${state.labels ? 'on' : 'off'}.`);
  });
  $('[data-hint-close]').addEventListener('click', () => { hint.hidden = true; playBtn.focus(); });

  // ---------- Hjulström diagram: point at it, or use the arrow keys ----------
  function setProbe(next: { mm: number; v: number } | null, speak = false) {
    probe = next;
    $('[data-layer="probe"]', hj).innerHTML = hjProbeLayer(probe);
    if (!probe) return;
    const zone = ZONE_NAMES[zoneAt(probe.mm, probe.v)].toLowerCase();
    const text = `A ${fmtSize(probe.mm)} grain in water flowing ${fmtSpeedPrecise(probe.v)} cm/s is ${zone}.`;
    $('[data-probe-out]').textContent = text;
    if (speak) announceSoon(text, 150);
  }
  function probeFromEvent(event: PointerEvent) {
    const m = hj.getScreenCTM();
    if (!m) return;
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(m.inverse());
    setProbe(hjAt(p.x, p.y));
  }
  hj.addEventListener('pointerdown', probeFromEvent);
  hj.addEventListener('pointermove', event => { if (event.pointerType === 'mouse' || event.buttons) probeFromEvent(event); });
  hj.addEventListener('focus', () => { if (!probe) setProbe({ mm: grainById(state.grain).mm, v: measure(currentRun(), state.t).speedNow }, true); });
  hj.addEventListener('keydown', event => {
    const keys: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
    if (!(event.key in keys)) return;
    event.preventDefault();
    const [dx, dy] = keys[event.key], step = event.shiftKey ? 0.25 : PROBE_STEP;
    const p = probe ?? { mm: grainById(state.grain).mm, v: 20 };
    setProbe({ mm: clamp(p.mm * 10 ** (dx * step), 0.001, 100), v: clamp(p.v * 10 ** (dy * step), 0.1, 1000) }, true);
  });

  // ---------- challenge ----------
  const quiz = { index: 0, score: 0, answered: false };
  const qShow = $('[data-q-show]'), qChoices = $('[data-q-choices]'), qFeedback = $('[data-q-feedback]');
  const qNext = $<HTMLButtonElement>('[data-q-next]'), qDone = $('[data-q-done]'), qBox = $('[data-q]');
  let questions: Question[] = [];
  const HELP: Record<string, string> = {
    zone: 'Read it from the Hjulström diagram: find the grain size along the bottom, then go up to the water speed.',
    clay: 'Use the Hjulström diagram: how fast must the water be to pick up clay?',
    setups: 'Try each one in the sandbox below: press Try, then drag the time slider to 10 minutes.',
    bend: 'Look closely at the bends in the stream table. Which side of each bend has the slower water?',
    fan: 'Try it: press Set it up, then watch the side view near the inlet.',
  };

  function loadSetup(s: Settings, t = 10) {
    stop();
    Object.assign(state, s, { t });
    playBtn.textContent = 'Run';
    changed(false);
    draw(true);
    announceSoon(`Sandbox set to ${setupText(s)}. ${resultSentence()}`, 100);
  }
  function showQuestion() {
    const q = questions[quiz.index];
    quiz.answered = false;
    $('[data-q-num]').textContent = String(quiz.index + 1);
    $('[data-q-score]').textContent = String(quiz.score);
    $('[data-q-prompt]').textContent = q.prompt;
    $('[data-q-help]').textContent = HELP[q.kind];
    qShow.innerHTML = '';
    if (q.kind === 'zone' || q.kind === 'clay') {
      const grain = q.kind === 'zone' ? q.grain! : 'clay', speed = q.kind === 'zone' ? q.speed! : 50, g = grainById(grain);
      qShow.innerHTML = hjulstromSvg({ speed, grain, neutral: true, label: `Hjulström diagram with a line at ${speed} cm/s and a dot for ${g.name.toLowerCase()} (${fmt(g.mm, 3)} mm).` });
    } else if (q.kind === 'setups') {
      const rows = q.setups!.map((s: Settings, i: number) => `<tr><th scope="row">${String.fromCharCode(65 + i)}</th><td>${fmt(s.slope)}%</td><td>${fmt(s.flow)} L/min</td><td>${grainById(s.grain).name}</td><td><button type="button" class="btn small" data-try="${i}">Try</button></td></tr>`).join('');
      qShow.innerHTML = `<div class="table-wrap rv-setups"><table><thead><tr><th scope="col">Setup</th><th scope="col">Slope</th><th scope="col">Flow</th><th scope="col">Sediment</th><th scope="col"><span class="visually-hidden">Load</span></th></tr></thead><tbody>${rows}</tbody></table></div>`;
      qShow.querySelectorAll<HTMLButtonElement>('[data-try]').forEach(b => b.addEventListener('click', () => loadSetup(q.setups![Number(b.dataset.try)])));
    } else if (q.kind === 'bend' || q.kind === 'fan') {
      const b = Object.assign(document.createElement('button'), { type: 'button', className: 'btn', textContent: 'Set it up in the sandbox' });
      const setup = q.kind === 'bend' ? q.bend!.setup : q.setup!;
      const t = q.kind === 'bend' ? q.bend!.t : 10;
      b.addEventListener('click', () => { loadSetup(setup, t); plan.scrollIntoView({ block: 'nearest', behavior: reduceMotion.matches ? 'auto' : 'smooth' }); });
      const p = Object.assign(document.createElement('p'), { className: 'rv-q-help', textContent: `Setup: ${setupText(setup)}, after ${t} minutes.` });
      qShow.append(p, b);
    }
    qChoices.replaceChildren(...q.choices.map((choice: string, i: number) => {
      const name = q.choiceNames![choice];
      const label = q.kind === 'setups' ? `${String.fromCharCode(65 + i)}: ${name.charAt(0).toUpperCase()}${name.slice(1)}` : name;
      const b = Object.assign(document.createElement('button'), { type: 'button', className: 'btn rv-choice', textContent: label });
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
    const q = questions[quiz.index], right = choice === q.answer;
    if (right) quiz.score++;
    $('[data-q-score]').textContent = String(quiz.score);
    for (const b of qChoices.querySelectorAll<HTMLButtonElement>('.rv-choice')) {
      b.disabled = true;
      b.classList.toggle('right', b.dataset.choice === q.answer);
      b.classList.toggle('wrong', b.dataset.choice === choice && !right);
    }
    const name = q.kind === 'setups' ? `${String.fromCharCode(65 + Number(q.answer))}: ${q.choiceNames![q.answer]}` : q.choiceNames![q.answer];
    qFeedback.className = `rv-feedback ${right ? 'good' : 'miss'}`;
    qFeedback.textContent = `${right ? 'Correct!' : `Not quite. The answer is ${name.charAt(0).toLowerCase() + name.slice(1)}.`} ${q.explain}`;
    qFeedback.hidden = false;
    qNext.textContent = quiz.index === questions.length - 1 ? 'See my score' : 'Next question';
    qNext.hidden = false;
    qFeedback.focus();
  }
  qNext.addEventListener('click', () => {
    if (quiz.index < questions.length - 1) {
      quiz.index++;
      showQuestion();
      announce(`Question ${quiz.index + 1} of ${questions.length}. ${questions[quiz.index].prompt}`);
      $<HTMLButtonElement>('.rv-choice').focus();
      return;
    }
    qBox.hidden = true;
    qDone.hidden = false;
    const total = questions.length;
    $('[data-q-final]').textContent = `You scored ${quiz.score} out of ${total}.`;
    $('[data-q-message]').textContent = quiz.score === total
      ? 'Every answer right. You can read a river like a geologist.'
      : quiz.score >= total - 2
        ? 'Great work. Test the ones you missed in the sandbox: change one thing at a time and watch what the water does.'
        : 'Explore a little more: try each sediment at a gentle and a steep slope, and read each one on the Hjulström diagram. Then try again.';
    qDone.focus();
    track('river_challenge_complete', { score: quiz.score, total });
  });
  function restartQuiz() { quiz.index = 0; quiz.score = 0; showQuestion(); }
  $('[data-q-restart]').addEventListener('click', () => { restartQuiz(); announce('Challenge restarted. Question 1.'); $<HTMLButtonElement>('.rv-choice').focus(); });
  $('[data-q-explore]').addEventListener('click', () => { setMode('explore'); announce('Explore mode.'); });

  // ---------- modes and sharing ----------
  function setMode(mode: Mode) {
    state.mode = mode;
    root.dataset.mode = mode;
    $('[data-challenge]').hidden = mode !== 'challenge';
    for (const b of $$<HTMLButtonElement>('[data-mode-btn]')) b.setAttribute('aria-pressed', String(b.dataset.modeBtn === mode));
    if (mode === 'challenge') {
      hint.hidden = true;
      if (!questions.length) questions = challengeQuestions();
      restartQuiz();
    }
  }
  for (const b of $$<HTMLButtonElement>('[data-mode-btn]')) b.addEventListener('click', () => {
    showNote('');
    setMode(b.dataset.modeBtn as Mode);
    announce(state.mode === 'challenge' ? `Challenge: ${CHALLENGE_COUNT} questions. ${questions[0].prompt}` : 'Explore mode.');
    if (state.mode === 'challenge') $<HTMLButtonElement>('.rv-choice').focus();
  });

  const copyBtn = $<HTMLButtonElement>('[data-copy-link]');
  copyBtn.addEventListener('click', async () => {
    const url = `${location.origin}${location.pathname}?${serializeRiverState({ ...state, t: Math.round(state.t * 2) / 2 })}`;
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

  // Switch everything on and restore the shared state. The first-use hint shows until someone runs the water.
  root.querySelectorAll<HTMLButtonElement | HTMLInputElement>('[disabled]').forEach(control => { control.disabled = false; });
  syncControls();
  draw(true);
  if (state.mode === 'explore' && !location.search.includes('slope=')) hint.hidden = false;
  setMode(state.mode as Mode);
  root.classList.add('rv-ready');
}
