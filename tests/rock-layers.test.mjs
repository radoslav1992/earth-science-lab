import test from 'node:test';
import assert from 'node:assert/strict';
import * as m from '../src/lib/rock-layers.mjs';
import * as v from '../src/lib/rock-layers-view.mjs';
import { parseLayersState, serializeLayersState, DEFAULT_STATE, MIN_LEFT, linkPercent } from '../src/lib/rock-layers-share.mjs';
import { activity as act, standards, TABLE_HALF_LIVES, decayRow } from '../src/lib/activities/rock-layers.mjs';
import { activities, standards as allStandards } from '../src/lib/activities.mjs';

const close = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} ≈ ${b}`);
const ALL = [...m.SECTIONS, m.EXAMPLE_SECTION];
const index = (section, id) => m.trueOrder(section).indexOf(id);
function permutations(items) {
  if (items.length <= 1) return [items];
  return items.flatMap((item, i) => permutations([...items.slice(0, i), ...items.slice(i + 1)]).map(rest => [item, ...rest]));
}
// A small repeatable random number generator for shuffles.
function rng(seed) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; }; }

test('isotopes: the five standard parent → daughter pairs and half-lives', () => {
  assert.deepEqual(m.ISOTOPES.map(i => [i.id, i.parent, i.daughter, i.halfLife]), [
    ['c14', 'Carbon-14', 'Nitrogen-14', 5730],
    ['k40', 'Potassium-40', 'Argon-40', 1.25e9],
    ['u238', 'Uranium-238', 'Lead-206', 4.47e9],
    ['u235', 'Uranium-235', 'Lead-207', 7.04e8],
    ['rb87', 'Rubidium-87', 'Strontium-87', 4.88e10],
  ]);
  for (const iso of m.ISOTOPES) {
    assert.equal(m.isotope(iso.id), iso);
    for (const field of ['method', 'dates', 'note', 'unit']) assert.ok(iso[field].length > 3, `${iso.id}.${field}`);
    assert.ok(iso.range[0] > 0 && iso.range[0] < iso.range[1], `${iso.id} range`);
    assert.equal(iso.unitYears, iso.unit === 'years' ? 1 : 1e6);
    // A method is useless long before one half-life only for the slowest clocks; none works past ~10 half-lives.
    assert.ok(iso.range[1] <= 10 * iso.halfLife, `${iso.id} upper limit within ten half-lives`);
  }
  assert.deepEqual(m.isotope('c14').range, [100, 50000]);
  assert.ok(m.ISOTOPE_IDS.includes(m.DEFAULT_ISOTOPE));
  assert.equal(m.isotope('nope'), undefined);
});

test('half-life maths: fraction left from time, and age from fraction, both directions', () => {
  for (const iso of m.ISOTOPES) {
    const h = iso.halfLife;
    assert.equal(m.fractionLeft(0, h), 1);
    assert.equal(m.fractionLeft(h, h), 0.5);
    assert.equal(m.fractionLeft(2 * h, h), 0.25);
    assert.equal(m.fractionLeft(3 * h, h), 0.125);
    close(m.fractionLeft(h / 2, h), Math.SQRT1_2);
    assert.equal(m.ageFromFraction(1, h), 0);
    assert.ok(Object.is(m.ageFromFraction(1, h), 0), 'zero, not minus zero');
    assert.equal(m.ageFromFraction(0.5, h), h);
    close(m.ageFromFraction(0.25, h), 2 * h);
    close(m.ageFromFraction(0.125, h), 3 * h);
    // Round trips at awkward values.
    for (const years of [h * 0.01, h * 0.3219, h * 1.7, h * 9.9]) close(m.ageFromFraction(m.fractionLeft(years, h), h), years, 1e-9);
    for (const f of [0.999, 0.8, 0.31, 0.001]) close(m.fractionLeft(m.ageFromFraction(f, h), h), f, 1e-9);
    // The decay constant form gives the same answer: N = N0 × e^(−λt), λ = ln 2 ÷ half-life.
    close(m.fractionLeft(1.3 * h, h), Math.exp(-(Math.LN2 / h) * 1.3 * h), 1e-12);
  }
  assert.equal(m.halfLivesElapsed(11460, 5730), 2);
  close(m.ageFromFraction(0.8, 1.25e9), 1.25e9 * Math.log2(1.25));
  // Daughter-to-parent ratio: 1 after one half-life, 3 after two, 7 after three.
  assert.deepEqual([1, 0.5, 0.25, 0.125].map(m.daughterPerParent), [0, 1, 3, 7]);
  assert.equal(m.ageFromRatio(0, 5730), 0);
  assert.equal(m.ageFromRatio(1, 5730), 5730);
  assert.equal(m.ageFromRatio(3, 5730), 11460);
  for (const f of [0.9, 0.42, 0.01]) close(m.ageFromRatio(m.daughterPerParent(f), 7.04e8), m.ageFromFraction(f, 7.04e8));
  assert.deepEqual([1, 0.5, 0.25, 0.126, 0].map(f => m.atomsLeft(f, 200)), [200, 100, 50, 25, 0]);
});

test('half-life maths rejects impossible input', () => {
  for (const bad of [-1, NaN, Infinity, '5730', null, undefined]) {
    assert.ok(Number.isNaN(m.fractionLeft(bad, 5730)), `time ${bad}`);
    assert.ok(Number.isNaN(m.halfLivesElapsed(bad, 5730)), `time ${bad}`);
  }
  for (const bad of [0, -5730, NaN, Infinity, '5730', null, undefined]) {
    assert.ok(Number.isNaN(m.fractionLeft(100, bad)), `half-life ${bad}`);
    assert.ok(Number.isNaN(m.ageFromFraction(0.5, bad)), `half-life ${bad}`);
    assert.ok(Number.isNaN(m.ageFromRatio(1, bad)), `half-life ${bad}`);
  }
  for (const bad of [0, -0.1, 1.0001, 2, NaN, Infinity, '0.5', null, undefined]) {
    assert.ok(Number.isNaN(m.ageFromFraction(bad, 5730)), `fraction ${bad}`);
    assert.ok(Number.isNaN(m.daughterPerParent(bad)), `fraction ${bad}`);
  }
  for (const bad of [-0.5, NaN, Infinity, '1', null]) assert.ok(Number.isNaN(m.ageFromRatio(bad, 5730)), `ratio ${bad}`);
  assert.equal(m.fmtYears(-5), 'unknown');
  assert.equal(m.fmtYears(NaN), 'unknown');
});

test('formatting: years, million years, percentages and half-lives', () => {
  assert.deepEqual([0, 1, 250, 5730, 11460, 57300, 206280].map(m.fmtYears), ['0 years', '1 year', '250 years', '5,730 years', '11,460 years', '57,300 years', '206,300 years']);
  assert.deepEqual([1e6, 7.04e8, 1.408e9, 1.25e9, 4.47e9, 4.88e10].map(m.fmtYears), ['1 million years', '704 million years', '1.41 billion years', '1.25 billion years', '4.47 billion years', '48.8 billion years']);
  assert.deepEqual([0, 7.04e8, 1.408e9, 6.25e7, 4.0241e8].map(m.fmtMyr), ['0', '704', '1,408', '62.5', '402']);
  assert.deepEqual([100, 50, 25, 12.5, 6.25, 93.75, 80.05, 0.09765625].map(m.fmtPercent), ['100', '50', '25', '12.5', '6.25', '93.75', '80.05', '0.0977']);
  assert.deepEqual([0, 1, 2, 0.3219, 8.7266].map(m.fmtHalfLives), ['0', '1', '2', '0.32', '8.73']);
});

test('which method suits which age: too young, good, too old, older than the solar system', () => {
  const status = (id, years) => m.verdict(m.isotope(id), years).status;
  assert.equal(status('c14', 50), 'young');
  assert.equal(status('c14', 5730), 'ok');
  assert.equal(status('c14', 50000), 'ok');
  assert.equal(status('c14', 57300), 'old');
  assert.equal(status('c14', 1e6), 'old', 'carbon-14 cannot date something a million years old');
  assert.equal(status('c14', 1e8), 'old');
  assert.equal(status('k40', 5e4), 'young');
  assert.equal(status('k40', 4.02e8), 'ok');
  assert.equal(status('k40', 5e9), 'beyond');
  assert.equal(status('u238', 5e5), 'young');
  assert.equal(status('u238', 4.47e9), 'ok');
  assert.equal(status('u235', 1.408e9), 'ok');
  assert.equal(status('rb87', 5e6), 'young');
  assert.equal(status('rb87', 4.5e9), 'ok');
  assert.equal(status('rb87', 4.88e10), 'beyond');
  for (const iso of m.ISOTOPES) for (const years of [0, iso.range[0], iso.halfLife, 10 * iso.halfLife]) {
    const text = m.verdict(iso, years).text;
    assert.ok(text.length > 40 && text.endsWith('.') && !/NaN|undefined/.test(text), text);
  }
  // The numbers the page uses to explain why carbon-14 runs out.
  const c14 = m.isotope('c14');
  assert.ok(100 * m.fractionLeft(10 * c14.halfLife, c14.halfLife) < 0.1, 'under 0.1% after ten half-lives');
  assert.equal(Math.round(m.halfLivesElapsed(1e6, c14.halfLife)), 175);
  assert.ok(m.C14_ATOMS_PER_GRAM * m.fractionLeft(36 * c14.halfLife, c14.halfLife) < 1, 'under one atom per gram after 36 half-lives');
  assert.ok(m.C14_ATOMS_PER_GRAM * m.fractionLeft(35 * c14.halfLife, c14.halfLife) > 1);
  assert.equal(Math.ceil(Math.log2(m.C14_ATOMS_PER_GRAM)), 36);
  assert.ok(m.EARTH_AGE_YEARS < m.SOLAR_SYSTEM_AGE_YEARS);
});

test('cross-sections: five levels that get harder, with labels that give nothing away', () => {
  assert.equal(m.SECTIONS.length, 5);
  assert.deepEqual(m.SECTIONS.map(s => s.level), [1, 2, 3, 4, 5]);
  assert.deepEqual(m.SECTION_IDS, ['canyon', 'fault', 'tilted', 'granite', 'story']);
  assert.equal(m.DEFAULT_SECTION, 'canyon');
  assert.ok(m.SECTIONS[0].events.every(ev => ev.kind === 'deposit'), 'level 1 is a plain stack of layers');
  assert.ok(m.SECTIONS[4].events.length > m.SECTIONS[0].events.length);
  assert.ok(Math.max(...m.SECTIONS.map(s => s.events.length)) === m.SECTIONS[4].events.length, 'the last one has the most events');
  for (const s of ALL) {
    assert.equal(m.sectionById(s.id) ?? m.EXAMPLE_SECTION, s);
    const ids = m.trueOrder(s);
    assert.equal(new Set(ids).size, ids.length, `${s.id}: unique labels`);
    const letters = ids.filter(id => id !== 'tilt');
    assert.ok(letters.every(id => /^[A-Z]$/.test(id)), `${s.id}: single capital letters`);
    assert.notDeepEqual(letters, [...letters].sort(), `${s.id}: letters are not in age order`);
    assert.notDeepEqual(letters, [...letters].sort().reverse(), `${s.id}: nor in reverse`);
    for (const ev of s.events) {
      assert.ok(['deposit', 'tilt', 'erode', 'fault', 'dike', 'pluton'].includes(ev.kind));
      if (ev.rock) assert.ok(m.ROCKS[ev.rock], `${s.id}.${ev.id} rock`);
      assert.ok(m.eventName(ev).length > 3 && m.eventPhrase(ev).length > 3);
      assert.match(m.eventStory(ev), /^[A-Z].*\.$/);
      if (ev.kind !== 'tilt') assert.ok(m.eventPhrase(ev).endsWith(` ${ev.id}`), 'the phrase names the label');
      assert.equal(m.eventById(s, ev.id), ev);
    }
    assert.equal(s.events[0].kind, 'deposit', `${s.id}: starts with a layer`);
  }
  // Every rule is practiced somewhere, and each section lists exactly the rules its evidence uses.
  for (const s of ALL) assert.deepEqual([...s.rules].sort(), [...new Set(m.constraints(s).map(c => c.rule))].sort(), `${s.id} rules`);
  assert.deepEqual([...new Set(m.SECTIONS.flatMap(s => s.rules))].sort(), [...m.RULE_IDS].sort());
  for (const id of m.RULE_IDS) assert.ok(m.RULES[id].name.length > 5 && m.RULES[id].text.endsWith('.'));
  assert.deepEqual(m.RULE_IDS, ['superposition', 'horizontality', 'crosscut', 'inclusions', 'unconformity']);
});

test('evidence: every step of every history is backed by something you can see', () => {
  for (const s of ALL) {
    const list = m.constraints(s), ids = m.trueOrder(s);
    // One piece of evidence for each pair of events that follow each other: that is what makes the order unique.
    for (let i = 1; i < ids.length; i++) assert.ok(list.some(c => c.older === ids[i - 1] && c.younger === ids[i]), `${s.id}: ${ids[i - 1]} before ${ids[i]}`);
    for (const c of list) {
      assert.ok(index(s, c.older) < index(s, c.younger), `${s.id}: ${c.older} really is older than ${c.younger}`);
      assert.ok(m.RULES[c.rule], c.rule);
      assert.match(c.see, /^[A-Z]/);
      assert.ok(!c.see.endsWith('.') && !c.so.endsWith('.'));
      assert.match(m.evidenceSentence(c), /^[A-Z].*, so .*\.$/);
      // The sentence names both events.
      for (const id of [c.older, c.younger]) if (id !== 'tilt') assert.ok(m.evidenceSentence(c).includes(` ${id}`), `${s.id}: “${m.evidenceSentence(c)}” names ${id}`);
    }
    // Pieces of rock are only ever found inside something younger.
    for (const ev of s.events) for (const id of ev.inclusions ?? []) assert.ok(index(s, id) < index(s, ev.id), `${s.id}: ${ev.id} holds ${id}`);
  }
  const kinds = s => m.constraints(s).map(c => c.rule);
  assert.deepEqual(kinds(m.sectionById('canyon')), ['superposition', 'superposition', 'superposition', 'superposition']);
  assert.deepEqual(kinds(m.sectionById('fault')).slice(-2), ['crosscut', 'crosscut']);
  assert.ok(kinds(m.sectionById('tilted')).includes('horizontality'));
  assert.equal(kinds(m.sectionById('granite')).filter(k => k === 'inclusions').length, 3);
  // A history whose order nothing could show is refused.
  const open = { id: 'open', events: [{ id: 'A', kind: 'deposit', rock: 'shale', thick: 100 }, { id: 'tilt', kind: 'tilt', deg: 10 }, { id: 'F', kind: 'fault', x: 300, dip: 60, slip: 30 }] };
  assert.throws(() => m.constraints(open), /nothing shows that the tilting came before fault F/);
  const backwards = { id: 'backwards', events: [{ id: 'A', kind: 'deposit', rock: 'shale', thick: 100, inclusions: ['B'] }, { id: 'B', kind: 'deposit', rock: 'sandstone', thick: 100 }] };
  assert.throws(() => m.constraints(backwards), /cannot hold pieces of B/);
});

test('checking an order: only the section’s own history passes', () => {
  for (const s of ALL) {
    const truth = m.trueOrder(s);
    const good = m.checkOrder(s, truth);
    assert.deepEqual(good, { complete: true, ok: true, broken: [], first: null, right: truth.length });
    const candidates = truth.length <= 8 ? permutations(truth) : [];
    if (!candidates.length) {
      // Too many orders to list: every swap of two events, the reverse, and many shuffles.
      for (let i = 0; i < truth.length; i++) for (let j = i + 1; j < truth.length; j++) { const o = [...truth]; [o[i], o[j]] = [o[j], o[i]]; candidates.push(o); }
      candidates.push([...truth].reverse());
      const random = rng(truth.length * 977);
      for (let k = 0; k < 3000; k++) { const o = [...truth]; for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; } candidates.push(o); }
    }
    let passed = 0;
    for (const order of candidates) {
      const result = m.checkOrder(s, order);
      const same = order.every((id, i) => id === truth[i]);
      assert.equal(result.ok, same, `${s.id}: ${order.join(' ')}`);
      if (same) { passed++; continue; }
      assert.ok(result.complete && result.broken.length >= 1 && result.first === result.broken[0]);
      assert.ok(order.indexOf(result.first.older) > order.indexOf(result.first.younger), 'the hint points at two events that really are the wrong way round');
      assert.equal(result.right, order.filter((id, i) => id === truth[i]).length);
      assert.ok(result.right < truth.length);
    }
    if (truth.length <= 8) assert.equal(passed, 1, `${s.id}: exactly one order passes`);
    // Not an order at all.
    for (const bad of [null, undefined, 'MKTRB', [], truth.slice(1), [...truth, truth[0]], [...truth.slice(1), truth[1]], [...truth.slice(1), 'Q'], [...truth.slice(1), undefined]]) {
      assert.deepEqual(m.checkOrder(s, bad), { complete: false, ok: false, broken: [], first: null, right: 0 }, `${s.id}: ${JSON.stringify(bad)}`);
    }
    // The starting shuffle shows every event once and never gives the answer away.
    const shuffled = m.shuffledEvents(s);
    assert.deepEqual([...shuffled].sort(), [...truth].sort());
    assert.notDeepEqual(shuffled, truth);
    assert.deepEqual(m.shuffledEvents(s), shuffled, 'the same every time');
    assert.equal(m.checkOrder(s, shuffled).ok, false);
  }
  // Level 2, read out: the layers bottom to top, then the fault, then the dike that crosses it.
  assert.deepEqual(m.trueOrder(m.sectionById('fault')), ['H', 'C', 'W', 'N', 'J', 'F', 'D']);
  const swapped = m.checkOrder(m.sectionById('fault'), ['H', 'C', 'W', 'N', 'J', 'D', 'F']);
  assert.equal(swapped.first.rule, 'crosscut');
  assert.equal(m.evidenceSentence(swapped.first), 'Dike D crosses fault F and is not offset by it, so the dike came after the fault moved.');
});

test('the drawing shows the evidence: geometry of every cross-section', () => {
  const W = v.FRAME.width;
  for (const s of ALL) {
    const g = v.buildSection(s);
    const whole = g.polys.filter(p => !p.piece);
    const of = id => whole.filter(p => p.unit === id);
    // Everything is inside the frame, and the frame is full of rock: no gaps opened by tilting or faulting.
    for (const p of [...g.polys, ...g.lines]) for (const [x, y] of p.pts) {
      assert.ok(Number.isFinite(x) && Number.isFinite(y));
      assert.ok(x >= -1e-6 && x <= W + 1e-6 && y >= -1e-6 && y <= s.ground + 1e-6, `${s.id}: point inside the frame`);
    }
    for (let x = 3; x < W; x += 9) for (let y = 3; y < s.ground; y += 9) assert.ok(whole.some(p => v.insidePolygon([x, y], p.pts)), `${s.id}: rock at ${x}, ${y}`);
    // Every rock unit is visible and labeled inside itself, where nothing younger is drawn over it.
    for (const ev of s.events) {
      if (ev.kind === 'tilt') { assert.equal(g.labels[ev.id], undefined); continue; }
      const spot = g.labels[ev.id];
      assert.ok(spot, `${s.id}: ${ev.id} has a label`);
      assert.ok(spot[0] >= 12 && spot[0] <= W - 12 && spot[1] >= 0 && spot[1] <= s.ground, `${s.id}: label ${ev.id} in the frame`);
      if (!ev.rock) continue;
      assert.ok(of(ev.id).length >= 1, `${s.id}: ${ev.id} is visible`);
      const z = g.polys.findIndex(p => p.unit === ev.id && !p.piece && v.insidePolygon(spot, p.pts));
      assert.ok(z >= 0, `${s.id}: label ${ev.id} sits on its own rock`);
      assert.ok(!g.polys.slice(z + 1).some(p => v.insidePolygon(spot, p.pts)), `${s.id}: nothing covers label ${ev.id}`);
    }
    // Labels do not sit on top of each other.
    const spots = Object.values(g.labels);
    for (let i = 0; i < spots.length; i++) for (let j = i + 1; j < spots.length; j++) assert.ok(Math.hypot(spots[i][0] - spots[j][0], spots[i][1] - spots[j][1]) > 25, `${s.id}: labels apart`);

    const near = ([x, y], id) => of(id).some(p => [[4, 0], [-4, 0], [0, 4], [0, -4], [6, 6], [-6, 6], [6, -6], [-6, -6]].some(([dx, dy]) => v.insidePolygon([x + dx, y + dy], p.pts)));
    const along = pts => pts.flatMap((a, i) => { const b = pts[(i + 1) % pts.length]; return Array.from({ length: 24 }, (_, k) => [a[0] + ((b[0] - a[0]) * k) / 24, a[1] + ((b[1] - a[1]) * k) / 24]); });
    let tiltedSoFar = false, faulted = false;
    s.events.forEach((ev, n) => {
      const before = s.events.slice(0, n);
      if (ev.kind === 'tilt') {
        // Layers laid down before the tilting are tilted; the tilting itself is recorded as a rotation.
        for (const older of before.filter(e => e.rock)) assert.equal(g.spin[older.id], ev.deg, `${s.id}: ${older.id} is tilted`);
        tiltedSoFar = true;
      }
      if (ev.kind === 'deposit' && tiltedSoFar) assert.equal(g.spin[ev.id], 0, `${s.id}: ${ev.id} was laid down flat after the tilting`);
      if (ev.kind === 'fault') {
        const line = g.lines.filter(l => l.id === ev.id);
        assert.equal(line.length, 1, `${s.id}: one fault line`);
        const pts = along(line[0].pts.slice(0, 2)).concat(along(line[0].pts));
        // The fault reaches the rock the evidence says it cuts, and leaves it in two offset pieces.
        const cut = m.constraints(s).filter(c => c.younger === ev.id && c.rule === 'crosscut').map(c => c.older);
        assert.ok(cut.length >= 1);
        for (const id of cut) {
          assert.ok(pts.some(q => near(q, id)), `${s.id}: fault ${ev.id} reaches ${id}`);
          assert.ok(of(id).length >= 2, `${s.id}: ${id} is offset by fault ${ev.id}`);
        }
        // It offsets most of the older layers too, so the break is easy to see.
        assert.ok(before.filter(e => e.kind === 'deposit' && of(e.id).length >= 2).length >= 3, `${s.id}: fault ${ev.id} offsets several layers`);
        faulted = true;
      }
      if (ev.kind === 'dike' || ev.kind === 'pluton') {
        const body = of(ev.id);
        const edge = body.flatMap(p => along(p.pts));
        // It touches every rock the evidence says it cuts.
        const cut = m.constraints(s).filter(c => c.younger === ev.id && c.rule === 'crosscut').map(c => m.eventById(s, c.older));
        for (const older of cut.filter(e => e.rock)) assert.ok(edge.some(q => near(q, older.id)), `${s.id}: ${ev.id} cuts ${older.id}`);
        // A dike that came after a fault crosses the fault line in one unbroken piece.
        const faults = before.filter(e => e.kind === 'fault');
        const later = s.events.slice(n + 1);
        if (!later.some(e => e.kind === 'fault')) assert.equal(body.length, 1, `${s.id}: ${ev.id} is in one piece`);
        for (const f of faults) {
          const fl = g.lines.find(l => l.id === f.id);
          assert.ok(along(fl.pts.slice(0, 2)).some(q => body.some(p => v.insidePolygon(q, p.pts))), `${s.id}: ${ev.id} crosses fault ${f.id}`);
        }
      }
      if (ev.kind === 'erode') {
        // Everything older stops at the erosion surface; where no fault moved it later, that is its level.
        if (!s.events.slice(n + 1).some(e => e.kind === 'fault')) {
          for (const older of before.filter(e => e.rock)) for (const p of of(older.id)) for (const [, y] of p.pts) assert.ok(y <= ev.level + 1e-6, `${s.id}: ${older.id} ends at ${ev.id}`);
          for (const l of g.lines.filter(l => l.id === ev.id)) for (const [, y] of l.pts) assert.ok(Math.abs(y - ev.level) <= 2.3, `${s.id}: ${ev.id} is level`);
        }
        // The surface really cuts the rocks the evidence names.
        const cut = m.constraints(s).filter(c => c.younger === ev.id).map(c => c.older).filter(id => id !== 'tilt');
        const line = g.lines.filter(l => l.id === ev.id).flatMap(l => l.pts);
        for (const id of cut) assert.ok(line.some(q => near(q, id)), `${s.id}: ${ev.id} cuts ${id}`);
      }
      // Pieces of older rock lie inside the rock that holds them.
      const pieces = g.polys.filter(p => p.piece === ev.id);
      if (ev.inclusions) {
        assert.ok(pieces.length >= 3, `${s.id}: ${ev.id} shows pieces of older rock`);
        assert.deepEqual([...new Set(pieces.map(p => p.unit))].sort(), [...ev.inclusions].sort(), `${s.id}: pieces of each rock named`);
        for (const p of pieces) {
          const c = [p.pts.reduce((sum, q) => sum + q[0], 0) / p.pts.length, p.pts.reduce((sum, q) => sum + q[1], 0) / p.pts.length];
          assert.ok(of(ev.id).some(host => v.insidePolygon(c, host.pts)), `${s.id}: a piece of ${p.unit} lies inside ${ev.id}`);
        }
      } else assert.equal(pieces.length, 0);
    });
    // In flat, unfaulted stacks the younger layer is the higher one.
    if (!faulted) s.events.forEach((ev, n) => {
      const prev = s.events[n - 1];
      if (n && ev.kind === 'deposit' && prev.kind === 'deposit' && g.spin[ev.id] === 0) assert.ok(g.labels[ev.id][1] > g.labels[prev.id][1], `${s.id}: ${ev.id} lies above ${prev.id}`);
    });
  }
  // Histories that cannot be drawn are refused.
  const floating = { id: 'floating', ground: 100, events: [{ id: 'A', kind: 'deposit', rock: 'shale', thick: 100 }, { id: 'U', kind: 'erode', level: 150 }] };
  assert.throws(() => v.buildSection(floating), /above the rock/);
  const scarp = { id: 'scarp', ground: 100, events: [{ id: 'A', kind: 'deposit', rock: 'shale', thick: 100 }, { id: 'F', kind: 'fault', x: 300, dip: 60, slip: 30 }, { id: 'B', kind: 'deposit', rock: 'shale', thick: 50 }] };
  assert.throws(() => v.buildSection(scarp), /level surface/);
  assert.throws(() => v.buildSection({ ...scarp, events: scarp.events.slice(0, 2) }), /ground is above the rock/);
});

test('polygon helpers', () => {
  const square = [[0, 0], [10, 0], [10, 10], [0, 10]];
  assert.deepEqual(v.clipPolygon(square, 1, 0, -5), [[5, 0], [10, 0], [10, 10], [5, 10]]);
  assert.deepEqual(v.clipPolygon(square, 1, 0, -20), []);
  assert.equal(v.clipPolygon(square, 1, 0, 5).length, 4);
  assert.deepEqual(v.clipLine([[0, 0], [10, 0]], 1, 0, -5), [[[5, 0], [10, 0]]]);
  assert.deepEqual(v.clipLine([[0, 0], [10, 0], [0, 1]], -1, 0, 5), [[[0, 0], [5, 0]], [[5, 0.5], [0, 1]]]);
  assert.deepEqual(v.clipLine([[0, 0], [10, 0]], 1, 0, -20), []);
  assert.equal(v.insidePolygon([5, 5], square), true);
  assert.equal(v.insidePolygon([15, 5], square), false);
});

test('drawings are complete, repeatable and free of clashing ids', () => {
  for (const s of ALL) {
    const svg = v.sectionSvg(s);
    assert.equal(v.sectionSvg(s), svg);
    assert.ok(!/NaN|undefined|Infinity/.test(svg), s.id);
    const ids = [...svg.matchAll(/ id="([^"]+)"/g)].map(x => x[1]);
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(ids.every(id => id.startsWith(`rl-${s.id}-`)));
    for (const ev of s.events.filter(e => e.rock)) assert.ok(svg.includes(`url(#rl-${s.id}-${ev.id})`), `${s.id}: ${ev.id} drawn`);
    for (const ev of s.events) assert.equal(svg.includes(`data-badge="${ev.id}"`), ev.kind !== 'tilt');
    const other = v.sectionSvg(s, { prefix: 'thumb', labels: false });
    assert.ok(!other.includes('data-badge') && other.includes('id="thumb-') && !other.includes(`id="rl-${s.id}-`));
    const size = v.sectionSize(s);
    assert.deepEqual(size, { width: 720, height: s.ground + v.FRAME.sky });
    // The description lists every label and every observation, but none of the conclusions.
    const text = v.describeSection(s);
    for (const ev of s.events.filter(e => e.kind !== 'tilt')) assert.ok(text.includes(`${ev.id}, `), `${s.id}: describes ${ev.id}`);
    for (const c of m.constraints(s)) { assert.ok(text.includes(c.see)); assert.ok(!text.includes(c.so)); }
  }
  // A dike that crosses a fault is drawn after the fault line, so it is not hidden by it.
  const svg = v.sectionSvg(m.sectionById('fault'));
  assert.ok(svg.indexOf('rl-fault') < svg.lastIndexOf('url(#rl-fault-D)'));
  // The decay curve and the box of atoms.
  for (const iso of m.ISOTOPES) for (const h of [0, 0.3219, 1, 10]) {
    const curve = v.decaySvg(iso, h);
    assert.ok(!/NaN|undefined|Infinity/.test(curve), `${iso.id} at ${h}`);
    assert.ok(curve.includes(iso.parent) && curve.includes(iso.daughter));
    assert.match(v.describeDecay(iso, h), /% of the parent atoms are left/);
  }
  assert.equal(v.ATOMS.total, v.ATOMS.cols * v.ATOMS.rows);
  let last = null;
  for (let parents = v.ATOMS.total; parents >= 0; parents--) {
    const kinds = [...v.atomsSvg(parents).matchAll(/class="at-(parent|daughter)"/g)].map(x => x[1]);
    assert.equal(kinds.length, v.ATOMS.total);
    assert.equal(kinds.filter(k => k === 'parent').length, parents);
    // An atom that has decayed never turns back.
    if (last) kinds.forEach((k, i) => { if (last[i] === 'daughter') assert.equal(k, 'daughter'); });
    last = kinds;
  }
});

test('markup: event cards, the order list, the story and the decay readout', () => {
  const s = m.sectionById('story'), truth = m.trueOrder(s);
  const pool = v.poolHtml(s, []);
  assert.equal((pool.match(/data-add=/g) ?? []).length, truth.length);
  assert.deepEqual([...pool.matchAll(/data-add="([^"]+)"/g)].map(x => x[1]), m.shuffledEvents(s));
  assert.ok(!pool.includes(' disabled') && v.poolHtml(s, [], { disabled: true }).includes(' disabled'));
  assert.equal((v.poolHtml(s, truth.slice(0, 4)).match(/data-add=/g) ?? []).length, truth.length - 4);
  assert.match(v.poolHtml(s, truth), /Every event is placed/);
  const list = v.orderHtml(s, truth);
  assert.deepEqual([...list.matchAll(/data-item="([^"]+)"/g)].map(x => x[1]), truth);
  assert.ok(list.includes('oldest') && list.includes('youngest'));
  assert.equal((list.match(/ disabled/g) ?? []).length, 2, 'first cannot move earlier, last cannot move later');
  assert.ok(!v.orderHtml(s, truth, { locked: true }).includes('<button'));
  assert.ok(!v.orderHtml(s, truth.slice(0, 3)).includes('youngest'), 'no “youngest” tag until the list is full');
  assert.equal(v.eventTitle(s.events[0]), 'Sandstone R');
  assert.equal(v.eventTitle(m.eventById(s, 'tilt')), 'Tilting of the layers');
  const story = v.storyHtml(s);
  assert.equal((story.match(/<li>/g) ?? []).length, truth.length);
  for (const c of m.constraints(s)) assert.ok(story.includes(m.evidenceSentence(c)));
  for (const ev of s.events) assert.ok(story.includes(m.eventStory(ev)));
  // Dated rocks.
  for (const section of m.SECTIONS) {
    const html = v.samplesHtml(section);
    for (const ev of m.datedEvents(section)) {
      assert.ok(html.includes(`data-age="${ev.id}"`) && html.includes(`for="rl-age-${ev.id}"`) && html.includes(`id="rl-age-${ev.id}"`));
      assert.ok(html.includes(m.sampleText(section, ev.id)));
    }
    const choices = [...v.bracketHtml(section).matchAll(/data-bracket-choice="([^"]+)"/g)].map(x => x[1]);
    assert.deepEqual(choices, m.bracketOrder(section));
  }
  // The readout prints the model's numbers, and its worked formula multiplies out.
  for (const iso of m.ISOTOPES) for (const h of [0, 1, 2, 0.3219, 3.5, 10]) {
    const html = v.resultsHtml(iso, h), years = h * iso.halfLife;
    assert.ok(!/NaN|undefined/.test(html));
    assert.ok(html.includes(`<strong>${m.fmtPercent(100 * 0.5 ** h)}%</strong>`));
    assert.ok(html.includes(`<strong>${m.fmtYears(years)}</strong>`));
    assert.ok(html.includes(m.verdict(iso, years).text));
    const formula = html.match(/= ([\d,.]+) × ([\d.]+) = ([\d,.]+) (years|million years)<\/p>/);
    assert.ok(formula, html);
    const [halfLife, times, age] = formula.slice(1, 4).map(x => Number(x.replace(/,/g, '')));
    assert.equal(halfLife, iso.halfLife / iso.unitYears);
    assert.equal(formula[4], iso.unit);
    assert.ok(Math.abs(halfLife * times - age) <= Math.max(0.5, age * 0.0006), `${iso.id}: ${halfLife} × ${times} = ${age}`);
    assert.ok(Math.abs(age - years / iso.unitYears) <= Math.max(0.5, (years / iso.unitYears) * 0.0006));
  }
  assert.equal(v.fmtInUnit(m.isotope('c14'), 11460), '11,460');
  assert.equal(v.fmtInUnit(m.isotope('u235'), 1.408e9), '1,408');
  for (const iso of m.ISOTOPES) assert.ok(v.methodHtml(iso).includes(iso.dates) && v.methodHtml(iso).includes(m.fmtYears(iso.halfLife)));
});

test('dated rocks: igneous only, consistent with the order, and they bracket something', () => {
  for (const s of m.SECTIONS) {
    const dated = m.datedEvents(s);
    assert.ok(dated.length >= 2, `${s.id}: two dated rocks`);
    for (const ev of s.events) {
      if (!ev.sample) { assert.ok(Number.isNaN(m.sampleAge(s, ev.id))); continue; }
      assert.ok(m.ROCKS[ev.rock].igneous, `${s.id}: ${ev.id} is igneous`);
      // Potassium–argon for basalt, uranium–lead in zircon for ash and granite.
      assert.ok(ev.rock === 'basalt' ? ev.sample.iso === 'k40' : ['u235', 'u238'].includes(ev.sample.iso), `${s.id}: ${ev.id} method`);
      const iso = m.isotope(ev.sample.iso), age = m.sampleAge(s, ev.id);
      close(age, iso.halfLife * Math.log2(100 / ev.sample.left));
      assert.equal(m.verdict(iso, age).status, 'ok', `${s.id}: ${ev.id} is an age its method can measure`);
      assert.ok(age < m.EARTH_AGE_YEARS);
      assert.ok(m.sampleText(s, ev.id).includes(`${m.fmtPercent(ev.sample.left)}% of the ${iso.parent.toLowerCase()} is left`));
      // Typed ages: the rounded age passes, and so does anything within 2%; a careless answer does not.
      const myr = age / 1e6;
      assert.ok(m.ageMatches(s, ev.id, Math.round(myr)) && m.ageMatches(s, ev.id, myr * 1.019) && m.ageMatches(s, ev.id, myr * 0.981));
      assert.ok(!m.ageMatches(s, ev.id, myr * 1.05) && !m.ageMatches(s, ev.id, myr * 0.95) && !m.ageMatches(s, ev.id, myr * 2));
      assert.ok(!m.ageMatches(s, ev.id, (100 - ev.sample.left) / 100 * iso.halfLife / 1e6) || ev.sample.left === 50, 'treating decay as a straight line is wrong');
      for (const bad of [NaN, Infinity, '', '1408', null, undefined, -myr]) assert.equal(m.ageMatches(s, ev.id, bad), false);
    }
    assert.equal(m.ageMatches(s, 'nope', 5), false);
    // Older rocks give older ages.
    const ages = dated.map(ev => m.sampleAge(s, ev.id));
    for (let i = 1; i < ages.length; i++) assert.ok(ages[i] < ages[i - 1] - 5e7, `${s.id}: ${dated[i].id} is clearly younger than ${dated[i - 1].id}`);
    // The bracket.
    const q = m.bracketQuestion(s);
    assert.ok(index(s, q.older) < index(s, q.target) && index(s, q.target) < index(s, q.younger), `${s.id}: the target lies between the dated rocks`);
    assert.ok(!m.eventById(s, q.target).sample, 'the target cannot be dated itself');
    const oldAge = m.sampleAge(s, q.older), youngAge = m.sampleAge(s, q.younger);
    assert.equal(q.answer, 'between');
    assert.equal(q.choices.between, `Between ${m.fmtMyr(youngAge)} and ${m.fmtMyr(oldAge)} million years ago`);
    assert.equal(q.choices.older, `More than ${m.fmtMyr(oldAge)} million years ago`);
    assert.equal(q.choices.younger, `Less than ${m.fmtMyr(youngAge)} million years ago`);
    assert.deepEqual(Object.keys(q.choices), m.BRACKET_CHOICES);
    assert.ok(q.prompt.endsWith('?') && q.prompt.includes(m.eventPhrase(m.eventById(s, q.target))));
    assert.ok(q.explain.includes(m.fmtMyr(oldAge)) && q.explain.includes(m.fmtMyr(youngAge)));
    assert.deepEqual([...m.bracketOrder(s)].sort(), [...m.BRACKET_CHOICES].sort());
  }
  assert.ok(new Set(m.SECTIONS.map(s => m.bracketOrder(s).indexOf('between'))).size >= 3, 'the right answer moves around');
  // The worksheet's cross-section: two half-lives and one half-life of uranium-235.
  const canyon = m.sectionById('canyon');
  assert.equal(m.fmtMyr(m.sampleAge(canyon, 'K')), '1,408');
  assert.equal(m.fmtMyr(m.sampleAge(canyon, 'R')), '704');
  assert.equal(m.bracketQuestion(canyon).prompt, 'When was shale T laid down?');
  assert.equal(m.bracketQuestion(m.sectionById('fault')).prompt, 'When did fault F move?');
  assert.equal(m.bracketQuestion(m.sectionById('tilted')).prompt, 'When was erosion surface U worn down?');
});

test('share links round-trip and explain bad values', () => {
  assert.deepEqual(parseLayersState(''), { state: DEFAULT_STATE, notes: [] });
  assert.deepEqual(parseLayersState('?classroom=1').notes, [], 'unrelated parameters are ignored');
  for (const section of m.SECTION_IDS) {
    const query = serializeLayersState({ part: 'layers', section, iso: 'c14', left: 3 });
    assert.equal(query, `part=layers&section=${section}`);
    const { state, notes } = parseLayersState('?' + query);
    assert.deepEqual(notes, []);
    assert.equal(state.part, 'layers');
    assert.equal(state.section, section);
  }
  for (const iso of m.ISOTOPE_IDS) for (const left of [100, 50, 25, 12.5, 80.05, 0.5, MIN_LEFT]) {
    const query = serializeLayersState({ part: 'decay', section: 'story', iso, left });
    const { state, notes } = parseLayersState('?' + query);
    assert.deepEqual(notes, [], query);
    assert.equal(state.part, 'decay');
    assert.equal(state.iso, iso);
    close(state.left, left, 1e-3);
  }
  assert.equal(serializeLayersState({ part: 'decay', iso: 'k40', left: 25 }), 'part=decay&iso=k40&left=25');
  assert.equal(serializeLayersState({ part: 'decay', iso: 'nope', left: 250 }), 'part=decay&iso=u235&left=100');
  assert.equal(serializeLayersState({ part: 'decay', iso: 'c14', left: NaN }), 'part=decay&iso=c14&left=50');
  assert.equal(serializeLayersState({ part: 'decay', iso: 'c14', left: 0 }), `part=decay&iso=c14&left=${linkPercent(MIN_LEFT)}`);
  assert.equal(serializeLayersState({ part: 'elsewhere', section: 'nope' }), 'part=layers&section=canyon');
  close(MIN_LEFT, 100 * 0.5 ** m.MAX_HALF_LIVES);
  const bad = parseLayersState('?part=moon&section=nope&iso=gold&left=500');
  assert.deepEqual(bad.state, DEFAULT_STATE);
  assert.equal(bad.notes.length, 4);
  for (const note of bad.notes) assert.ok(note.length > 30 && note.endsWith('.') && !/undefined|NaN/.test(note), note);
  for (const left of ['', 'abc', '0', '-5', '100.1', '0.05']) assert.equal(parseLayersState(`?left=${left}`).notes.length, 1, `left=${left}`);
  assert.equal(parseLayersState('?left=100').notes.length, 0);
  assert.match(parseLayersState('?section=' + 'x'.repeat(200)).notes[0], /…/);
});

// Numbers that belong to an isotope's name rather than to a model output.
const CONSTANTS = new Set(['14', '40']);
const NUMBER = /\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g;
const value = printed => Number(printed.replace(/,/g, ''));

test('activity: the table and every printed number equal the model', () => {
  assert.equal(act.tool, 'rock-layers');
  const iso = m.isotope('u235');
  assert.deepEqual(TABLE_HALF_LIVES, [0, 1, 2, 3, 4]);
  assert.equal(act.rows.length, TABLE_HALF_LIVES.length);
  act.rows.forEach(([label, values], i) => {
    const h = TABLE_HALF_LIVES[i];
    assert.equal(label, String(h));
    assert.deepEqual(values, decayRow(h));
    assert.equal(value(values['Parent left (%)']), 100 / 2 ** h);
    assert.equal(value(values['Daughter (%)']), 100 - 100 / 2 ** h);
    assert.equal(value(values['Daughter ÷ parent']), 2 ** h - 1);
    assert.equal(value(values['Age (million years)']), h * 704);
    assert.equal(value(values['Parent left (%)']) + value(values['Daughter (%)']), 100, 'the two shares add up as printed');
    close(m.ageFromFraction(value(values['Parent left (%)']) / 100, iso.halfLife) / 1e6, value(values['Age (million years)']), 1e-9);
  });
  assert.deepEqual(act.rows.map(([, r]) => r['Age (million years)']), ['0', '704', '1,408', '2,112', '2,816']);
  for (const col of act.record) for (const [, values] of act.rows) assert.ok(values[col], col);
  for (const block of [...act.questions, act.extraAnswer]) {
    const checked = new Set();
    for (const [printed, model] of block.checks ?? []) {
      const decimals = (printed.split('.')[1] ?? '').length;
      // Whole numbers of 1,000 or more are printed to three or four figures.
      const tolerance = value(printed) >= 10000 ? value(printed) * 0.005 : 0.5 * 10 ** -decimals + 1e-9;
      assert.ok(Math.abs(value(printed) - model) <= tolerance, `printed ${printed} vs model ${model}`);
      checked.add(printed);
    }
    for (const number of block.a.match(NUMBER) ?? []) {
      assert.ok(checked.has(number) || CONSTANTS.has(number), `unchecked number ${number} in: ${block.a}`);
    }
  }
  // The orders on the key are the sections' own histories.
  const canyon = m.sectionById('canyon'), fault = m.sectionById('fault');
  assert.equal(act.extraAnswer.a, `Cross-section 1: ${m.trueOrder(canyon).join(', ')}. Cross-section 2: ${m.trueOrder(fault).join(', ')}.`);
  assert.equal((act.extra.match(/____/g) ?? []).length, canyon.events.length + fault.events.length, 'one blank per event');
  assert.ok(act.questions[0].a.startsWith('Limestone M, at the bottom, is the oldest, and sandstone B, at the top, is the youngest.'));
  assert.ok(act.questions[1].a.startsWith('The dike. Dike D crosses fault F and is not offset by it'));
  assert.equal(m.checkOrder(fault, m.trueOrder(fault)).ok, true);
  assert.ok(act.questions[2].q.includes('ash bed K') && act.questions[2].q.includes('25%'));
  assert.ok(act.questions[2].a.endsWith(`Age = 2 × 704 = ${m.fmtMyr(m.sampleAge(canyon, 'K'))} million years.`));
  assert.ok(act.questions[3].a.endsWith('Its age is between 704 and 1,408 million years.'));
  assert.equal(m.bracketQuestion(canyon).choices.between, 'Between 704 and 1,408 million years ago');
  assert.ok(act.questions[5].a.includes('57,300 years') && act.questions[5].a.includes('17,500 half-lives'));
  assert.equal(Math.round(m.halfLivesElapsed(1e8, 5730) / 100) * 100, 17500);
});

test('activity metadata, standards and registration', () => {
  assert.equal(act.questions.length, 6);
  assert.equal(act.minutes, 15);
  assert.equal(act.grade, 'Grades 6–10');
  assert.equal(act.toolName, 'Rock Layers Lab');
  assert.deepEqual(act.standards, ['MS-ESS1-4', 'HS-ESS1-6']);
  assert.deepEqual(Object.keys(standards), ['MS-ESS1-4', 'HS-ESS1-6']);
  assert.match(standards['MS-ESS1-4'], /rock strata.*geologic time scale/);
  assert.match(standards['HS-ESS1-6'], /ancient Earth materials/);
  for (const code of act.standards) assert.equal(allStandards[code], standards[code], 'merged into the site’s standards');
  assert.ok(activities.includes(act), 'registered in activities.mjs');
  assert.equal(activities.filter(a => a.tool === 'rock-layers').length, 1);
  assert.ok(act.rowHeader && act.keyNote && act.extra && act.goal);
  assert.equal(act.steps.length, 4);
  for (const field of ['tool', 'toolName', 'title', 'grade', 'minutes', 'standards', 'goal', 'steps', 'record', 'rows', 'extra', 'extraAnswer', 'questions']) assert.ok(field in act, field);
  for (const q of act.questions) { assert.ok(q.q.endsWith('?') || q.q.endsWith('.'), q.q); assert.ok(q.a.length > 40 && q.lines >= 2); }
});
