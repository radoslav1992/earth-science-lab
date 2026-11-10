// Rock Layers Lab: part 1 (put a cross-section's events in order, then bracket an age with dated rocks) and
// part 2 (the decay model), on top of the shared model in src/lib/rock-layers.mjs.
// Every panel is re-drawn from the same functions the server used, so the page and the script agree.
import {
  SECTIONS, RULES, MAX_HALF_LIVES, sectionById, isotope, trueOrder, checkOrder, eventById, eventPhrase, datedEvents, sampleAge, sampleText,
  ageMatches, bracketQuestion, fractionLeft, ageFromFraction, atomsLeft, fmtYears, fmtMyr, fmtPercent, fmtHalfLives,
} from '../../lib/rock-layers.mjs';
import {
  ATOMS, sectionSize, sectionSvg, describeSection, poolHtml, orderHtml, storyHtml, samplesHtml, bracketHtml, eventTitle,
  decaySvg, describeDecay, atomsSvg, resultsHtml, methodHtml,
} from '../../lib/rock-layers-view.mjs';
import { parseLayersState, serializeLayersState, MIN_LEFT } from '../../lib/rock-layers-share.mjs';
import { track } from '../../lib/analytics';

type Part = 'layers' | 'decay';
type Progress = { order: string[]; tries: number; solved: boolean; shown: boolean; ages: Record<string, boolean>; bracket: string | null };

export function initLayers(root: HTMLElement) {
  const $ = <T extends Element = HTMLElement>(selector: string) => root.querySelector(selector) as T;
  const $$ = <T extends Element = HTMLElement>(selector: string) => [...root.querySelectorAll(selector)] as T[];
  const live = $('[data-live]');
  const noteEl = $('[data-note]');
  const hint = $('[data-hint]');
  const svg = $<SVGSVGElement>('[data-section-svg]');
  const pool = $('[data-pool]'), list = $('[data-order]'), empty = $('[data-order-empty]');
  const checkBtn = $<HTMLButtonElement>('[data-check]'), clearBtn = $<HTMLButtonElement>('[data-clear]'), revealBtn = $<HTMLButtonElement>('[data-reveal]');
  const feedback = $('[data-feedback]');
  const samples = $('[data-samples]'), bracket = $('[data-bracket]'), bracketChoices = $('[data-bracket-choices]'), bracketFeedback = $('[data-bracket-feedback]');
  const isoSelect = $<HTMLSelectElement>('[data-iso]'), timeInput = $<HTMLInputElement>('[data-time]'), leftInput = $<HTMLInputElement>('[data-left]');
  const banner = $('[data-banner]');

  const { state: shared, notes } = parseLayersState(location.search);
  let part: Part = shared.part as Part;
  let section = sectionById(shared.section);
  let iso = isotope(shared.iso);
  let halfLives = Math.min(MAX_HALF_LIVES, ageFromFraction(shared.left / 100, 1));
  let trackTimer = 0;
  const progress: Record<string, Progress> = Object.fromEntries(SECTIONS.map(s => [s.id, { order: [], tries: 0, solved: false, shown: false, ages: {}, bracket: null }]));
  const now = () => progress[section.id];

  const announce = (message: string) => { live.textContent = ''; window.setTimeout(() => { live.textContent = message; }, 30); };
  const showNote = (message: string) => { noteEl.textContent = message; noteEl.hidden = !message; };
  if (notes.length) showNote(notes.join(' '));

  // ---------- part 1: the cross-section and the order ----------
  function drawSection() {
    const size = sectionSize(section);
    svg.setAttribute('viewBox', `0 0 ${size.width} ${size.height}`);
    svg.innerHTML = sectionSvg(section, { prefix: 'rl-lab' });
    svg.setAttribute('aria-label', describeSection(section));
    $('[data-section-title]').textContent = `Cross-section ${section.level}: ${section.name}`;
    for (const b of $$<HTMLButtonElement>('[data-section-btn]')) {
      const id = b.dataset.sectionBtn!;
      b.setAttribute('aria-pressed', String(id === section.id));
      b.querySelector<HTMLElement>('[data-solved-mark]')!.hidden = !progress[id].solved;
    }
    const solved = SECTIONS.filter(s => progress[s.id].solved).length;
    $('[data-progress]').textContent = `Solved ${solved} of ${SECTIONS.length}`;
  }
  function drawOrder() {
    const p = now(), done = p.solved || p.shown;
    pool.innerHTML = done ? '' : poolHtml(section, p.order);
    pool.hidden = done;
    list.innerHTML = orderHtml(section, p.order, { locked: done });
    empty.hidden = p.order.length > 0;
    checkBtn.disabled = done || p.order.length !== section.events.length;
    clearBtn.disabled = p.order.length === 0;
    revealBtn.hidden = done || p.tries < 2;
  }
  function showFeedback(kind: 'good' | 'miss', html: string) {
    feedback.className = `rl-feedback ${kind}`;
    feedback.innerHTML = html;
    feedback.hidden = false;
  }
  function restoreFeedback() {
    const p = now();
    if (p.solved) showFeedback('good', `<p><strong>Solved.</strong> This is the order, with the evidence for each step:</p>${storyHtml(section)}`);
    else if (p.shown) showFeedback('miss', `<p><strong>Here is the order</strong>, with the evidence for each step. Press Start again to try it yourself.</p>${storyHtml(section)}`);
    else feedback.hidden = true;
  }
  const highlight = (id: string | null) => {
    for (const badge of svg.querySelectorAll('[data-badge]')) badge.classList.toggle('on', (badge as SVGElement).dataset.badge === id);
  };
  function changeOrder(next: string[], message: string, focus?: () => HTMLElement | null) {
    now().order = next;
    hint.hidden = true;
    showNote('');
    feedback.hidden = true;
    drawOrder();
    announce(message);
    (focus?.() ?? pool.querySelector<HTMLElement>('button') ?? checkBtn).focus();
  }
  root.addEventListener('click', event => {
    const b = (event.target as Element).closest<HTMLElement>('[data-add], [data-earlier], [data-later], [data-remove]');
    if (!b || now().solved || now().shown) return;
    const order = [...now().order];
    const id = b.dataset.add ?? b.dataset.earlier ?? b.dataset.later ?? b.dataset.remove!;
    const title = eventTitle(eventById(section, id));
    if (b.dataset.add) {
      order.push(id);
      const left = section.events.length - order.length;
      changeOrder(order, `${title} placed at number ${order.length}. ${left ? `${left} left to place.` : 'All placed. Check your order.'}`);
      return;
    }
    const i = order.indexOf(id);
    if (b.dataset.remove) {
      order.splice(i, 1);
      changeOrder(order, `${title} removed.`);
      return;
    }
    const j = b.dataset.earlier ? i - 1 : i + 1;
    if (j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    const which = b.dataset.earlier ? 'earlier' : 'later';
    changeOrder(order, `${title} moved to number ${j + 1}.`, () => {
      const same = list.querySelector<HTMLButtonElement>(`[data-${which}="${id}"]`);
      return same && !same.disabled ? same : list.querySelector<HTMLButtonElement>(`[data-${which === 'earlier' ? 'later' : 'earlier'}="${id}"]`);
    });
  });
  for (const type of ['pointerover', 'focusin'] as const) root.addEventListener(type, event => {
    const el = (event.target as Element).closest<HTMLElement>('[data-add], [data-item]');
    highlight(el ? el.dataset.add ?? el.dataset.item! : null);
  });
  root.addEventListener('pointerleave', () => highlight(null));

  checkBtn.addEventListener('click', () => {
    const p = now();
    const result = checkOrder(section, p.order);
    if (!result.complete) return;
    p.tries++;
    if (result.ok) {
      p.solved = true;
      drawOrder();
      drawSection();
      const first = p.tries === 1 ? ' First try!' : '';
      showFeedback('good', `<p><strong>Correct!${first}</strong> All ${section.events.length} events are in order. Here is the evidence for each step:</p>${storyHtml(section)}`);
      announce(`Correct. All ${section.events.length} events are in order.`);
      track('layers_order_solved', { section: section.id, tries: p.tries });
      if (SECTIONS.every(s => progress[s.id].solved)) track('layers_all_solved', { first_try: SECTIONS.filter(s => progress[s.id].tries === 1).length });
    } else {
      const c = result.first!;
      const rule = RULES[c.rule as keyof typeof RULES];
      const clue = p.tries === 1
        ? `Look again: ${c.see.charAt(0).toLowerCase()}${c.see.slice(1)}. What does that tell you?`
        : `${c.see}, so ${c.so}.`;
      showFeedback('miss', `<p><strong>Not yet.</strong> ${result.right} of ${section.events.length} events are in the right place.</p><p>${clue}</p><p class="rl-rule"><strong>${rule.name}:</strong> ${rule.text}</p>`);
      drawOrder();
      announce(`Not yet. ${result.right} of ${section.events.length} events are in the right place. ${clue}`);
    }
    feedback.focus();
  });
  clearBtn.addEventListener('click', () => {
    const p = now();
    p.order = [];
    p.solved = false;
    p.shown = false;
    feedback.hidden = true;
    drawOrder();
    drawSection();
    announce('Order cleared. Start with the oldest event.');
    pool.querySelector<HTMLElement>('button')?.focus();
  });
  revealBtn.addEventListener('click', () => {
    const p = now();
    p.order = trueOrder(section);
    p.shown = true;
    drawOrder();
    restoreFeedback();
    announce('The order is now shown, with the evidence for each step.');
    feedback.focus();
  });
  for (const b of $$<HTMLButtonElement>('[data-section-btn]')) b.addEventListener('click', () => {
    if (b.dataset.sectionBtn === section.id) return;
    section = sectionById(b.dataset.sectionBtn!);
    hint.hidden = true;
    showNote('');
    drawLayers();
    announce(`Cross-section ${section.level}: ${section.name}. ${section.events.length} events to put in order.`);
  });

  // ---------- part 1: dated rocks and the bracketing question ----------
  function drawDates() {
    const p = now();
    samples.innerHTML = samplesHtml(section);
    for (const ev of datedEvents(section)) if (p.ages[ev.id]) markAge(ev.id, true);
    drawBracket();
  }
  function markAge(id: string, right: boolean) {
    const result = samples.querySelector<HTMLElement>(`[data-age-result="${id}"]`)!;
    const input = samples.querySelector<HTMLInputElement>(`[data-age="${id}"]`)!;
    const ev = eventById(section, id), sampleIso = isotope(ev.sample.iso);
    result.hidden = false;
    result.className = `rl-sample-result ${right ? 'good' : 'miss'}`;
    if (right) {
      input.value = fmtMyr(sampleAge(section, id)).replace(/,/g, '');
      result.textContent = `Correct: ${eventPhrase(ev)} is about ${fmtMyr(sampleAge(section, id))} million years old.`;
    } else {
      result.textContent = `Not yet. Use age = half-life × log₂(100 ÷ % left), with a half-life of ${fmtMyr(sampleIso.halfLife)} million years, or work it out in part 2.`;
    }
    return result.textContent!;
  }
  function drawBracket() {
    const p = now(), q = bracketQuestion(section);
    const ready = [q.older, q.younger].every(id => p.ages[id]);
    bracket.hidden = !ready;
    if (!ready) return;
    $('[data-bracket-prompt]').textContent = q.prompt;
    bracketChoices.innerHTML = bracketHtml(section);
    bracketFeedback.hidden = true;
    if (p.bracket) answerBracket(p.bracket, false);
  }
  function answerBracket(choice: string, fresh: boolean) {
    const q = bracketQuestion(section), right = choice === q.answer;
    now().bracket = choice;
    for (const b of bracketChoices.querySelectorAll<HTMLButtonElement>('[data-bracket-choice]')) {
      b.disabled = true;
      b.classList.toggle('right', b.dataset.bracketChoice === q.answer);
      b.classList.toggle('wrong', b.dataset.bracketChoice === choice && !right);
    }
    bracketFeedback.className = `rl-feedback ${right ? 'good' : 'miss'}`;
    bracketFeedback.textContent = `${right ? 'Correct!' : 'Not quite.'} ${q.explain}`;
    bracketFeedback.hidden = false;
    if (fresh) {
      announce(bracketFeedback.textContent);
      bracketFeedback.focus();
      track('layers_bracket', { section: section.id, right });
    }
  }
  samples.addEventListener('click', event => {
    const target = event.target as Element;
    const check = target.closest<HTMLElement>('[data-age-check]');
    if (check) {
      const id = check.dataset.ageCheck!;
      const input = samples.querySelector<HTMLInputElement>(`[data-age="${id}"]`)!;
      const right = input.value.trim() !== '' && ageMatches(section, id, Number(input.value));
      now().ages[id] = right;
      announce(markAge(id, right));
      const wasHidden = bracket.hidden;
      drawBracket();
      if (wasHidden && !bracket.hidden) { announce(`Both ages are right. Now: ${bracketQuestion(section).prompt}`); $('[data-bracket-prompt]').focus(); }
      return;
    }
    const open = target.closest<HTMLElement>('[data-open-decay]');
    if (open) {
      const ev = eventById(section, open.dataset.openDecay!);
      iso = isotope(ev.sample.iso);
      halfLives = ageFromFraction(ev.sample.left / 100, 1);
      $('[data-banner-text]').textContent = `Sample: ${eventPhrase(ev)} from cross-section ${section.level}. ${sampleText(section, ev.id)} Read its age below, then go back and type it in.`;
      banner.hidden = false;
      setPart('decay');
      announce(`Part 2, the decay model, set to this sample. ${sampleText(section, ev.id)}`);
      $<HTMLElement>('[data-banner-back]').focus();
    }
  });
  samples.addEventListener('keydown', event => {
    const input = (event.target as Element).closest<HTMLInputElement>('[data-age]');
    if (input && event.key === 'Enter') samples.querySelector<HTMLButtonElement>(`[data-age-check="${input.dataset.age}"]`)!.click();
  });
  bracketChoices.addEventListener('click', event => {
    const b = (event.target as Element).closest<HTMLButtonElement>('[data-bracket-choice]');
    if (b && !now().bracket) answerBracket(b.dataset.bracketChoice!, true);
  });
  $('[data-banner-back]').addEventListener('click', () => {
    banner.hidden = true;
    setPart('layers');
    announce(`Back to cross-section ${section.level}. Type the age you found.`);
    samples.querySelector<HTMLInputElement>('[data-age]')?.focus();
  });

  function drawLayers() {
    drawSection();
    drawOrder();
    restoreFeedback();
    drawDates();
  }

  // ---------- part 2: the decay model ----------
  function drawDecay() {
    const years = halfLives * iso.halfLife;
    const left = 100 * fractionLeft(years, iso.halfLife);
    const parents = atomsLeft(left / 100, ATOMS.total);
    isoSelect.value = iso.id;
    timeInput.value = String(halfLives);
    timeInput.setAttribute('aria-valuetext', `${fmtYears(years)}, ${fmtHalfLives(halfLives)} half-lives`);
    if (document.activeElement !== leftInput) leftInput.value = fmtPercent(left);
    $('[data-time-out]').textContent = fmtYears(years);
    const curve = $<SVGSVGElement>('[data-curve]');
    curve.innerHTML = decaySvg(iso, halfLives);
    curve.setAttribute('aria-label', describeDecay(iso, halfLives));
    const atoms = $<SVGSVGElement>('[data-atoms]');
    atoms.innerHTML = atomsSvg(parents);
    atoms.setAttribute('aria-label', `${parents} of ${ATOMS.total} atoms are still the parent isotope, ${iso.parent.toLowerCase()}.`);
    $('[data-legend-parent]').textContent = iso.parent;
    $('[data-legend-daughter]').textContent = iso.daughter;
    $('[data-results]').innerHTML = resultsHtml(iso, halfLives);
    $('[data-method]').innerHTML = methodHtml(iso);
    for (const b of $$<HTMLButtonElement>('[data-jump]')) b.setAttribute('aria-pressed', String(Number(b.dataset.jump) === halfLives));
  }
  function decayChanged(message: string) {
    hint.hidden = true;
    showNote('');
    drawDecay();
    announce(message);
    clearTimeout(trackTimer);
    trackTimer = window.setTimeout(() => track('layers_decay', { isotope: iso.id, half_lives: Number(halfLives.toFixed(2)) }), 1500);
  }
  const summary = () => {
    const years = halfLives * iso.halfLife;
    return `${fmtYears(years)}: ${fmtPercent(100 * fractionLeft(years, iso.halfLife))}% of the ${iso.parent.toLowerCase()} is left.`;
  };
  isoSelect.addEventListener('change', () => {
    iso = isotope(isoSelect.value);
    decayChanged(`${iso.parent} to ${iso.daughter}, half-life ${fmtYears(iso.halfLife)}. ${summary()}`);
  });
  timeInput.addEventListener('input', () => {
    halfLives = Number(timeInput.value);
    decayChanged(summary());
  });
  leftInput.addEventListener('input', () => {
    const left = Number(leftInput.value);
    if (leftInput.value.trim() === '' || !Number.isFinite(left) || left < MIN_LEFT || left > 100) return;
    halfLives = ageFromFraction(left / 100, 1);
    decayChanged(summary());
  });
  leftInput.addEventListener('change', () => {
    const left = Number(leftInput.value);
    if (leftInput.value.trim() === '' || !Number.isFinite(left) || left < MIN_LEFT || left > 100) {
      showNote(`The percentage of parent left must be between ${fmtPercent(MIN_LEFT)} and 100.`);
      leftInput.value = fmtPercent(100 * 0.5 ** halfLives);
    }
  });
  for (const b of $$<HTMLButtonElement>('[data-jump]')) b.addEventListener('click', () => {
    halfLives = Number(b.dataset.jump);
    decayChanged(`${b.dataset.jump} half-lives. ${summary()}`);
  });

  // ---------- parts and sharing ----------
  function setPart(next: Part) {
    part = next;
    root.dataset.part = part;
    for (const panel of $$('[data-part-panel]')) panel.hidden = panel.dataset.partPanel !== part;
    for (const b of $$<HTMLButtonElement>('[data-part-btn]')) b.setAttribute('aria-pressed', String(b.dataset.partBtn === part));
    $('[data-progress]').hidden = part !== 'layers';
    if (part === 'layers') drawLayers(); else drawDecay();
  }
  for (const b of $$<HTMLButtonElement>('[data-part-btn]')) b.addEventListener('click', () => {
    if (b.dataset.partBtn === part) return;
    showNote('');
    hint.hidden = true;
    if (b.dataset.partBtn === 'layers') banner.hidden = true;
    setPart(b.dataset.partBtn as Part);
    announce(part === 'layers' ? `Part 1: rock layers. Cross-section ${section.level}, ${section.name}.` : `Part 2: radiometric dating. ${summary()}`);
  });

  const copyBtn = $<HTMLButtonElement>('[data-copy-link]');
  copyBtn.addEventListener('click', async () => {
    const url = `${location.origin}${location.pathname}?${serializeLayersState({ part, section: section.id, iso: iso.id, left: 100 * 0.5 ** halfLives })}`;
    try {
      await navigator.clipboard.writeText(url);
      copyBtn.textContent = 'Link copied ✓';
      announce(part === 'layers' ? 'Share link copied. It opens this cross-section.' : 'Share link copied. It opens the decay model with these settings.');
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
  if (location.search.includes('part=') || location.search.includes('section=')) hint.hidden = true;
  drawDecay();
  setPart(part);
  root.classList.add('rl-ready');
}
