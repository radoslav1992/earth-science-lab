import test from 'node:test';
import assert from 'node:assert/strict';
import * as p from '../src/lib/plates.mjs';
import { activity as act, standards, ROWS } from '../src/lib/activities/plate-tectonics.mjs';

const close = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} ≈ ${b}`);

test('facts table: one complete case per valid boundary and plate pair', () => {
  const valid = p.TYPES.flatMap(type => p.VALID[type].map(plates => p.caseKey(type, plates)));
  assert.deepEqual([...p.CASE_KEYS].sort(), [...valid].sort());
  assert.equal(p.CASE_KEYS.length, 7);
  assert.equal(p.isValid('divergent', 'oc'), false);
  assert.equal(p.isValid('transform', 'oc'), false);
  for (const type of p.TYPES) assert.ok(p.isValid(type, p.DEFAULT_PLATES[type]), type);
  for (const [key, c] of Object.entries(p.CASES)) {
    assert.equal(key, p.caseKey(c.type, c.plates));
    for (const field of ['name', 'summary', 'quakes', 'volcanoText', 'landform']) assert.ok(c[field].length > 3, `${key}.${field}`);
    assert.ok(c.landforms.length >= 2 && c.examples.length >= 1, key);
    assert.ok(p.MOTION_NAMES[c.motion] && p.DEPTH_NAMES[c.quakeDepth], key);
    assert.equal(typeof c.volcanoes, 'boolean');
    assert.ok(c.rate >= p.SPEED_RANGE[0] && c.rate <= p.SPEED_RANGE[1] && c.rate * 2 === Math.round(c.rate * 2), `${key} rate on the slider`);
  }
  const motion = { divergent: 'apart', convergent: 'together', transform: 'past' };
  for (const c of Object.values(p.CASES)) assert.equal(c.motion, motion[c.type]);
  // Conservative facts the explorer and the page rely on.
  const facts = {
    'divergent-oo': ['shallow', true, ['Mid-Atlantic Ridge', '2–5 cm per year']],
    'divergent-cc': ['shallow', true, ['East African Rift']],
    'convergent-oc': ['deep', true, ['Andes', 'Cascades']],
    'convergent-oo': ['deep', true, ['Mariana', 'Japan']],
    'convergent-cc': ['intermediate', false, ['Himalaya']],
    'transform-oo': ['shallow', false, ['Mid-Atlantic Ridge']],
    'transform-cc': ['shallow', false, ['San Andreas']],
  };
  for (const [key, [depth, volcanoes, names]] of Object.entries(facts)) {
    const c = p.CASES[key];
    assert.equal(c.quakeDepth, depth, key);
    assert.equal(c.volcanoes, volcanoes, key);
    for (const name of names) assert.ok(c.examples.join(' ').includes(name), `${key} mentions ${name}`);
  }
});

test('rate arithmetic and unit conversions', () => {
  assert.equal(p.kmPerMyr(1), 10, '1 cm/yr = 10 km per million years');
  assert.equal(p.distanceKm(5, 10), 500);
  assert.equal(p.distanceKm(2.5, 10), 250);
  assert.equal(p.distanceKm(0, 10), 0);
  close(p.timeMyr(500, 5), 10);
  close(p.cmPerYrFromKmPerMyr(p.kmPerMyr(3.7)), 3.7);
  assert.equal(p.mmPerYr(2.5), 25);
  assert.equal(p.metersPerCentury(2.5), 2.5, '2.5 cm/yr × 100 years = 2.5 m');
  assert.equal(p.halfRate(4), 2);
  close(p.seafloorAgeMyr(200, p.halfRate(4)), 10);
  close(p.seafloorAgeMyr(300, 3), 10);
  // distance and time are inverses, and age doubles with distance.
  for (const rate of [0.5, 1, 2.5, 7]) for (const t of [0.5, 3, 20]) close(p.timeMyr(p.distanceKm(rate, t), rate), t, 1e-9);
  close(p.seafloorAgeMyr(400, 2), 2 * p.seafloorAgeMyr(200, 2));
  assert.equal(p.fmt(250), '250');
  assert.equal(p.fmt(2.5), '2.5');
  assert.equal(p.fmt(10.04), '10');
  assert.equal(p.fmt(1.25, 2), '1.25');
});

function walkNumbers(value, path = 'scene') {
  if (typeof value === 'number') assert.ok(Number.isFinite(value), `${path} is ${value}`);
  else if (Array.isArray(value)) value.forEach((v, i) => walkNumbers(v, `${path}[${i}]`));
  else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) walkNumbers(v, `${path}.${k}`);
}

test('geometry is finite, deterministic and inside the frame for every case, time and speed', () => {
  const { width, height } = p.VIEW;
  for (const key of p.CASE_KEYS) {
    for (let t = 0; t <= 20; t += 0.5) {
      for (const speed of [0.5, 3, p.CASES[key].rate, 10]) {
        const a = p.scene(key, t, speed);
        walkNumbers(a);
        assert.deepEqual(p.scene(key, t, speed), a, `${key} t=${t} deterministic`);
        assert.equal(a.distance, p.distanceKm(speed, t));
        for (const poly of [...a.polys, ...a.lines]) for (const [x, y] of poly.points) {
          assert.ok(x >= 0 && x <= width && y >= -1 && y <= height, `${key} t=${t} speed=${speed} ${poly.cls} point ${x},${y}`);
        }
        for (const q of a.quakes) {
          assert.ok(q.depth >= 0 && q.depth <= p.MAX_QUAKE_DEPTH_KM, `${key} quake depth ${q.depth}`);
          close(q.y, Math.round(p.depthToY(q.depth) * 10) / 10, 0.11);
          assert.equal(q.cls, p.depthClass(q.depth));
          assert.ok(!p.deeperThan(q.cls, p.CASES[key].quakeDepth), `${key}: ${q.depth} km is deeper than the case allows`);
          assert.ok(q.x > 48 && q.x < width, `${key} quake x ${q.x}`);
        }
        assert.ok(a.quakes.length > 0, `${key} has earthquakes`);
        if (!p.CASES[key].volcanoes) assert.equal(a.volcanoes.length + a.magma.length, 0, `${key} has no volcanoes or magma`);
        const svg = p.sceneSvg(a) + p.mapSvg(key, t, speed) + p.describeScene(a) + p.describeMap(key, t, speed);
        assert.ok(!/NaN|undefined|Infinity/.test(svg), `${key} t=${t} svg`);
      }
    }
  }
  assert.throws(() => p.scene('divergent-oc', 1, 1));
  // Out-of-range inputs are clamped, not drawn wildly.
  assert.deepEqual(p.scene('transform-cc', 99, 99), p.scene('transform-cc', 20, 10));
});

test('subduction: the slab and its earthquakes deepen with time; volcanoes need the slab at 100 km', () => {
  for (const key of ['convergent-oc', 'convergent-oo']) {
    let previous = -1;
    for (let t = 0; t <= 20; t += 1) {
      const sc = p.scene(key, t, 5);
      assert.ok(sc.deepest >= previous, `${key} deepest quake grows: ${sc.deepest} at t=${t}`);
      previous = sc.deepest;
      const slabDepth = p.slabLength(p.distanceKm(5, t)) >= p.SLAB_ARC_KM;
      assert.equal(sc.volcanoes.length > 0, slabDepth, `${key} t=${t} volcano iff slab reaches 100 km`);
    }
    assert.ok(p.scene(key, 0, 5).deepest < 70, 'young slab: shallow quakes only');
    assert.ok(p.scene(key, 20, 5).deepest > 600, 'old slab: quakes approach 700 km');
    assert.equal(p.scene(key, 20, 5).quakes.filter(q => q.cls === 'deep').length > 2, true);
  }
  for (const key of ['divergent-oo', 'divergent-cc', 'transform-oo', 'transform-cc']) {
    assert.ok(p.scene(key, 20, 10).deepest < 70, `${key} stays shallow`);
  }
  assert.ok(p.scene('convergent-cc', 10).quakes.some(q => q.cls === 'intermediate'));
  assert.ok(p.scene('convergent-cc', 10).quakes.every(q => q.depth < 100));
});

test('share links round-trip and explain bad values', () => {
  const states = [
    { type: 'convergent', plates: 'oc', t: 10, speed: 5, mode: 'explore' },
    { type: 'divergent', plates: 'cc', t: 0, speed: 0.5, mode: 'explore' },
    { type: 'transform', plates: 'oo', t: 17.3, speed: 9.5, mode: 'challenge' },
    { type: 'convergent', plates: 'cc', t: 20, speed: 10, mode: 'explore' },
  ];
  for (const state of states) {
    const query = p.serializePlatesState(state);
    const { state: back, notes } = p.parsePlatesState('?' + query);
    assert.deepEqual(back, state, query);
    assert.deepEqual(notes, []);
  }
  assert.deepEqual(p.parsePlatesState('').state, p.DEFAULT_STATE);
  assert.equal(p.parsePlatesState('?type=divergent').state.speed, p.CASES['divergent-oo'].rate, 'speed defaults to the case’s usual speed');
  const bad = p.parsePlatesState('?type=sideways&plates=xx&t=99&speed=-3&mode=race');
  assert.deepEqual(bad.state, p.DEFAULT_STATE);
  assert.equal(bad.notes.length, 5);
  const combo = p.parsePlatesState('?type=divergent&plates=oc');
  assert.equal(combo.state.plates, 'oo');
  assert.match(combo.notes[0], /divergent boundary between ocean–continent plates isn’t part of this lab/);
  assert.equal(p.parsePlatesState('?type=convergent&speed=3.3&t=4.44').state.speed, 3.5, 'speed snaps to the slider');
  assert.equal(p.parsePlatesState('?t=4.44').state.t, 4.4);
  assert.match(p.parsePlatesState('?type=' + 'x'.repeat(200)).notes[0], /…/);
  assert.equal(p.serializePlatesState({ type: 'divergent', plates: 'oc', t: 3, speed: 2, mode: 'explore' }), 'type=divergent&plates=oo&t=3&speed=2');
});

test('challenge: 6–8 questions, each with one right answer that the evidence supports', () => {
  assert.ok(p.CHALLENGE.length >= 6 && p.CHALLENGE.length <= 8);
  const answers = new Set();
  for (const q of p.CHALLENGE) {
    assert.ok(q.choices.includes(q.answer), q.prompt);
    assert.equal(new Set(q.choices).size, q.choices.length);
    for (const key of [...q.choices, q.answer]) assert.ok(p.CASES[key], key);
    assert.ok(q.prompt.endsWith('?') && q.explain.length > 40);
    answers.add(q.answer);
    if (q.show.kind === 'evidence') {
      assert.ok(q.evidence.length >= 2);
      assert.deepEqual(q.choices.filter(key => p.factsMatch(key, q.show.facts)), [q.answer], `exactly one choice fits: ${q.prompt}`);
    } else {
      assert.ok(q.describe.length > 40, 'pictures have a text description');
      assert.equal(q.show.key, q.answer, 'the picture shows the answer');
      assert.ok(!q.describe.toLowerCase().includes(p.CASES[q.answer].name.toLowerCase()), 'the description does not name the answer');
    }
  }
  assert.ok(answers.size >= 6, 'questions cover most boundaries');
  for (const type of p.TYPES) assert.ok([...answers].some(key => key.startsWith(type)), type);
});

// Numbers that belong to the formulas themselves rather than to a model output.
const CONSTANTS = new Set(['2', '10']);

test('activity: table and printed numbers equal the model', () => {
  assert.equal(act.tool, 'plate-tectonics');
  assert.equal(act.rows.length, ROWS.length);
  act.rows.forEach(([name, values], i) => {
    const c = p.CASES[ROWS[i]];
    assert.ok(name.toLowerCase().includes(c.type) && name.includes(p.PLATE_NAMES[c.plates].toLowerCase()), name);
    assert.equal(values['Main landforms'], c.landform);
    assert.equal(values['Deepest earthquakes'], p.DEPTH_NAMES[c.quakeDepth]);
    assert.equal(values['Volcanoes?'], c.volcanoes ? 'Yes' : 'No');
  });
  for (const col of act.record) for (const [, values] of act.rows) assert.ok(values[col], col);
  for (const block of [...act.questions, act.extraAnswer]) {
    const checked = new Set();
    for (const [printed, value] of block.checks ?? []) {
      const decimals = (printed.split('.')[1] ?? '').length;
      assert.ok(Math.abs(Number(printed) - value) <= 0.5 * 10 ** -decimals + 1e-9, `printed ${printed} vs model ${value}`);
      checked.add(printed);
    }
    for (const number of block.a.match(/\d+(?:\.\d+)?/g) ?? []) {
      assert.ok(checked.has(number) || CONSTANTS.has(number), `unchecked number ${number} in: ${block.a}`);
    }
  }
  // The worked numbers themselves, recomputed.
  assert.ok(act.questions[3].a.includes(`= ${p.distanceKm(2.5, 10)} km`));
  assert.ok(act.questions[4].a.includes(`= ${p.seafloorAgeMyr(300, p.halfRate(6))} million years`));
  assert.ok(act.extraAnswer.a.includes(String(p.distanceKm(5, p.TIME_RANGE[1]))));
});

test('activity metadata and standards', () => {
  assert.equal(act.questions.length, 6);
  assert.ok(act.minutes >= 10 && act.minutes <= 15);
  assert.equal(act.grade, 'Grades 6–10');
  assert.deepEqual(act.standards, ['MS-ESS2-3', 'HS-ESS2-1']);
  for (const code of act.standards) assert.ok(standards[code], code);
  assert.deepEqual(Object.keys(standards).sort(), [...act.standards].sort());
  assert.ok(act.rowHeader && act.keyNote && act.extra && act.goal);
  for (const field of ['tool', 'toolName', 'title', 'grade', 'minutes', 'standards', 'goal', 'steps', 'record', 'rows', 'extra', 'extraAnswer', 'questions']) assert.ok(field in act, field);
});
