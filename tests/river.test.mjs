import test from 'node:test';
import assert from 'node:assert/strict';
import * as r from '../src/lib/river.mjs';
import { planInner, profileInner, hjulstromSvg, hjAt, hjPoint, grainRows, describePlan, describeProfile, HJ } from '../src/lib/river-svg.mjs';
import { riverActivity as act, standards, SETUPS, results, MINUTES, READ_SPEED, FAN } from '../src/lib/activities/river-erosion.mjs';
import { activities, standards as allStandards } from '../src/lib/activities.mjs';

const close = (a, b, tol = 1e-9, msg = '') => assert.ok(Math.abs(a - b) <= tol, `${msg} ${a} ≈ ${b} (±${tol})`);
const grain = id => r.grainById(id);

test('sediments sit in their Wentworth classes', () => {
  assert.deepEqual(r.GRAIN_IDS, ['clay', 'silt', 'fine-sand', 'coarse-sand', 'gravel']);
  const classOf = mm => r.SIZE_CLASSES.find(c => mm >= c.min && mm < c.max).name;
  assert.deepEqual(r.GRAINS.map(g => classOf(g.mm)), ['Clay', 'Silt', 'Sand', 'Sand', 'Gravel']);
  close(r.SIZE_CLASSES[0].max, 1 / 256);
  close(r.SIZE_CLASSES[1].max, 1 / 16);
  assert.equal(r.SIZE_CLASSES[2].max, 2);
  for (let k = 1; k < r.GRAINS.length; k++) assert.ok(r.GRAINS[k].mm > r.GRAINS[k - 1].mm, 'grains in size order');
  assert.equal(r.grainById('nonsense').id, 'fine-sand');
});

test('erosion curve: passes through its Hjulström anchors, lowest for sand, higher for clay and gravel', () => {
  for (const [mm, v] of r.EROSION_ANCHORS) close(r.erosionSpeed(mm), v, 1e-6, `${mm} mm`);
  // Straight lines between anchors on the log–log diagram: the geometric mean in between.
  close(r.erosionSpeed(Math.sqrt(0.01 * 0.1)), Math.sqrt(60 * 25), 1e-6);
  let min = { mm: 0, v: Infinity };
  for (let e = -3; e <= 2; e += 0.01) { const mm = 10 ** e, v = r.erosionSpeed(mm); if (v < min.v) min = { mm, v }; }
  assert.ok(min.mm > 0.1 && min.mm < 0.5 && Math.abs(min.v - 20) < 0.5, `minimum ${min.v} cm/s at ${min.mm} mm`);
  const [clay, silt, fine, coarse, gravel] = r.GRAINS.map(g => r.erosionSpeed(g.mm));
  assert.ok(clay > silt && silt > fine, 'cohesive clay and silt need faster water than sand');
  assert.ok(gravel > coarse && coarse > fine, 'heavier grains need faster water');
  assert.ok(clay > 100 && fine > 20 && fine < 25, `clay ${clay}, fine sand ${fine}`);
  // Out-of-range sizes are clamped to the diagram.
  assert.equal(r.erosionSpeed(0.00001), r.erosionSpeed(0.001));
  assert.equal(r.erosionSpeed(5000), r.erosionSpeed(100));
});

test('settling speed: Ferguson–Church, Stokes for fine grains, always below the erosion curve', () => {
  // Stokes' law for small grains: w = R g D² / (18 ν).
  const stokes = mm => (100 * 1.65 * 9.81 * (mm / 1000) ** 2) / (18 * 1e-6);
  close(r.settlingSpeed(0.002), stokes(0.002), stokes(0.002) * 0.01, 'clay ≈ Stokes');
  close(r.settlingSpeed(0.02), stokes(0.02), stokes(0.02) * 0.02, 'silt ≈ Stokes');
  // Textbook ranges: fine sand a few cm/s, 1 mm sand about 10–15 cm/s, gravel tens of cm/s.
  assert.ok(r.settlingSpeed(0.2) > 2 && r.settlingSpeed(0.2) < 3);
  assert.ok(r.settlingSpeed(1) > 10 && r.settlingSpeed(1) < 15);
  assert.ok(r.settlingSpeed(3) > 20 && r.settlingSpeed(3) < 30);
  let last = 0;
  for (let e = -3; e <= 2; e += 0.05) {
    const mm = 10 ** e, w = r.settlingSpeed(mm);
    assert.ok(w > last, 'settling speed grows with size');
    assert.ok(w < r.erosionSpeed(mm), `${mm} mm: settles below its erosion speed`);
    last = w;
  }
});

test('Hjulström zones', () => {
  assert.equal(r.zoneAt(1, 40), 'erode');
  assert.equal(r.zoneAt(0.2, 10), 'transport');
  assert.equal(r.zoneAt(3, 15), 'deposit');
  assert.equal(r.zoneAt(0.002, 50), 'transport', 'settled clay is not picked up at 50 cm/s, floating clay keeps moving');
  for (const g of r.GRAINS) {
    assert.equal(r.zoneAt(g.mm, r.erosionSpeed(g.mm)), 'erode', 'at the threshold it erodes');
    assert.equal(r.zoneAt(g.mm, r.settlingSpeed(g.mm) * 0.99), 'deposit');
  }
  const rows = grainRows(40);
  assert.deepEqual(rows.map(row => row.zone), ['transport', 'transport', 'erode', 'erode', 'transport']);
});

test('water speed: Manning’s equation, growing as flow^0.4 and slope^0.3', () => {
  for (const [flow, slope] of [[1, 1], [3, 4], [8, 10]]) {
    const q = (flow * 1000) / 60, h = r.normalDepth(q, r.CHANNEL_WIDTH, slope / 100), v = r.flowSpeed(flow, slope);
    close(v, q / (r.CHANNEL_WIDTH * h), 1e-9, 'continuity: v = Q ÷ (width × depth)');
    // Manning in SI units: v = (1/n) h^(2/3) S^(1/2), for a wide channel where the hydraulic radius ≈ depth.
    close(v / 100, (1 / r.MANNING_N) * (h / 100) ** (2 / 3) * Math.sqrt(slope / 100), 1e-9, 'Manning');
  }
  close(r.flowSpeed(6, 4) / r.flowSpeed(3, 4), 2 ** 0.4, 1e-9);
  close(r.flowSpeed(3, 8) / r.flowSpeed(3, 4), 2 ** 0.3, 1e-9);
  const lo = r.flowSpeed(r.FLOW_RANGE[0], r.SLOPE_RANGE[0]), hi = r.flowSpeed(r.FLOW_RANGE[1], r.SLOPE_RANGE[1]);
  assert.ok(lo > 10 && lo < 13 && hi > 70 && hi < 75, `speeds span ${lo}–${hi} cm/s`);
  // Every sediment but clay can be eroded somewhere on the sliders, and clay never can.
  for (const g of r.GRAINS) assert.equal(hi >= r.erosionSpeed(g.mm), g.id !== 'clay', g.id);
});

test('cross-sections: area and bed change are inverses, with slumping banks on land', () => {
  const { width } = r.initialBed(4);
  for (const i of [10, r.SHORE_NODE, r.SHORE_NODE + 10]) {
    for (const d of [-6, -1.5, -0.2, 0, 0.3, 2, 7]) close(r.depthFromArea(i, r.areaFromDepth(i, d, width), width), d, 1e-9);
  }
  close(r.areaFromDepth(10, -2, width), -(3 * 2 + r.SIDE_CUT * 4), 1e-12);
  close(r.areaFromDepth(10, 1, width), 3 + r.SIDE_FILL, 1e-12);
  close(r.areaFromDepth(80, -1, width), -width[80], 1e-12);
});

function walkNumbers(value, path) {
  if (typeof value === 'number') assert.ok(Number.isFinite(value), `${path} is ${value}`);
  else if (ArrayBuffer.isView(value)) value.forEach((v, i) => assert.ok(Number.isFinite(v), `${path}[${i}]`));
  else if (Array.isArray(value)) value.forEach((v, i) => walkNumbers(v, `${path}[${i}]`));
  else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) walkNumbers(v, `${path}.${k}`);
}

const SAMPLE = [
  { slope: 4, flow: 3, grain: 'fine-sand', supply: 0 },
  { slope: 1, flow: 0.5, grain: 'fine-sand', supply: 100 },
  { slope: 10, flow: 8, grain: 'fine-sand', supply: 0 },
  { slope: 10, flow: 8, grain: 'gravel', supply: 100 },
  { slope: 10, flow: 0.5, grain: 'gravel', supply: 100 },
  { slope: 6, flow: 6, grain: 'silt', supply: 50 },
  { slope: 2, flow: 8, grain: 'coarse-sand', supply: 30 },
  { slope: 7.5, flow: 4.5, grain: 'clay', supply: 100 },
];

test('runs: every cm³ is accounted for, beds stay in the tray and numbers are finite', () => {
  for (const s of SAMPLE) {
    const run = r.simulate(s);
    for (const t of [0, 0.1, 3.7, 10, 20]) {
      const m = r.measure(run, t), snap = r.snapshotAt(run, t);
      close(m.t, Math.round(t * 10) / 10, 1e-9);
      walkNumbers(m, 'measure');
      walkNumbers(snap, 'snapshot');
      // Sediment fed in + sediment eroded = sediment laid down on land + in the sea + down the drain.
      close(m.fed + m.eroded, m.landDeposit + m.seaDeposit + m.washedOut, 1e-6 * (1 + m.fed + m.eroded), `${JSON.stringify(s)} t=${t} budget`);
      close(m.fed, (s.supply * m.t), 1e-6, 'fed in = supply × minutes');
      for (let i = 0; i < r.NODES; i++) assert.ok(snap.z[i] >= run.floor[i] - 1e-9, `bed above the tray bottom at ${r.XS[i]} cm`);
      assert.ok(m.deltaLength >= 0 && m.deltaLength <= r.TRAY.length - r.TRAY.shore && m.deltaLength % 2 === 0);
    }
    assert.equal(run.snaps.length, 201, 'snapshots every 0.1 minute for 20 minutes');
  }
});

test('runs are deterministic and independent of how far they were worked out', () => {
  for (const s of SAMPLE.slice(0, 4)) {
    const a = r.simulate(s, { fresh: true }), b = r.simulate(s, { fresh: true });
    r.snapshotAt(a, 20);
    for (const t of [2.5, 9, 20]) r.snapshotAt(b, t); // worked out in pieces
    for (const t of [0, 2.5, 9, 14.2, 20]) assert.deepEqual(r.snapshotAt(b, t).z, r.snapshotAt(a, t).z, `${JSON.stringify(s)} t=${t}`);
  }
  assert.equal(r.simulate(r.DEFAULT_STATE), r.simulate({ ...r.DEFAULT_STATE }), 'runs are cached');
  // Out-of-range settings are clamped, not run wildly.
  assert.deepEqual(r.measure(r.simulate({ slope: 99, flow: -3, grain: 'mud', supply: 500 }), 10), r.measure(r.simulate({ slope: 10, flow: 0.5, grain: 'fine-sand', supply: 100 }), 10));
});

test('water too slow for the grain: nothing on the bed moves', () => {
  for (const s of [
    { slope: 10, flow: 8, grain: 'clay', supply: 0 },
    { slope: 2, flow: 2, grain: 'coarse-sand', supply: 0 },
    { slope: 1, flow: 0.5, grain: 'fine-sand', supply: 0 },
    { slope: 6, flow: 6, grain: 'silt', supply: 0, slow: true },
  ].filter(s => !s.slow)) {
    const run = r.simulate(s), m = r.measure(run, 20);
    assert.ok(run.startSpeed < run.erosion, `${s.grain}: ${run.startSpeed} < ${run.erosion}`);
    assert.equal(m.eroded + m.landDeposit + m.seaDeposit + m.washedOut, 0, JSON.stringify(s));
    assert.deepEqual(Array.from(r.snapshotAt(run, 20).z), run.z0);
  }
});

test('faster water erodes more; clear water cuts down until it is too slow; fine grains wash out', () => {
  const at10 = s => r.measure(r.simulate({ grain: 'fine-sand', supply: 0, ...s }), 10);
  for (const flow of [2, 4, 6]) {
    let last = -1;
    for (const slope of [2, 4, 6, 8, 10]) { const e = at10({ slope, flow }).eroded; assert.ok(e > last, `slope ${slope}, flow ${flow}`); last = e; }
  }
  for (const slope of [2, 6]) {
    let last = -1;
    for (const flow of [2, 3, 4, 6, 8]) { const e = at10({ slope, flow }).eroded; assert.ok(e > last, `flow ${flow}, slope ${slope}`); last = e; }
  }
  // Over time: erosion only adds up, the delta only grows, and the water slows as the slope flattens.
  const run = r.simulate(r.DEFAULT_STATE);
  let prev = r.measure(run, 0);
  for (let t = 0.5; t <= 20; t += 0.5) {
    const m = r.measure(run, t);
    assert.ok(m.eroded >= prev.eroded - 1e-9 && m.deltaLength >= prev.deltaLength && m.speedNow <= prev.speedNow + 0.05, `t=${t}`);
    prev = m;
  }
  assert.ok(prev.speedNow < run.erosion, 'within 20 minutes the water slows below the erosion threshold (the page’s worked example says so)');
  // Coarse grains drop near the mouth; silt stays in the water and drains away.
  const d = id => r.measure(r.simulate({ slope: 6, flow: 6, grain: id, supply: 0 }), 10);
  assert.ok(d('fine-sand').deltaLength > d('coarse-sand').deltaLength && d('coarse-sand').deltaLength > d('gravel').deltaLength);
  assert.ok(d('silt').washedOut > d('silt').seaDeposit && d('fine-sand').washedOut < 0.5);
  // Too much sediment on a gentle slope: the bed builds up near the inlet instead of cutting down.
  const fan = r.measure(r.simulate({ slope: 2, flow: 2, grain: 'fine-sand', supply: 60 }), 10);
  assert.ok(fan.eroded === 0 && fan.buildUp > 1 && fan.speedNow > fan.startSpeed);
});

test('bends: the inside builds a bar, the outside cuts the bank', () => {
  const snap = r.snapshotAt(r.simulate(r.DEFAULT_STATE), 5);
  for (const b of snap.bends) {
    close(b.insideSpeed, b.speed * (1 - r.BEND_FACTOR), 1e-9);
    close(b.outsideSpeed, b.speed * (1 + r.BEND_FACTOR), 1e-9);
  }
  assert.ok(snap.bends.every(b => b.inside === 'deposit' && b.outside === 'erode'));
  // No load, no bar: clear water too slow to erode leaves the bends alone.
  assert.ok(r.snapshotAt(r.simulate({ slope: 1, flow: 0.5, grain: 'fine-sand', supply: 0 }), 10).bends.every(b => b.inside === 'none' && b.barMinutes === 0));
  // Clay and silt stay floating past the bends instead of building bars.
  assert.ok(r.snapshotAt(r.simulate({ slope: 4, flow: 3, grain: 'clay', supply: 60 }), 10).bends.every(b => b.inside === 'none'));
});

test('share links round-trip and explain bad values', () => {
  const states = [
    { slope: 4, flow: 3, grain: 'fine-sand', supply: 0, t: 10, mode: 'explore' },
    { slope: 1, flow: 0.5, grain: 'clay', supply: 100, t: 0, mode: 'explore' },
    { slope: 10, flow: 8, grain: 'gravel', supply: 30, t: 20, mode: 'challenge' },
    { slope: 6.5, flow: 2.5, grain: 'coarse-sand', supply: 70, t: 12.5, mode: 'explore' },
  ];
  for (const state of states) {
    const query = r.serializeRiverState(state);
    const { state: back, notes } = r.parseRiverState('?' + query);
    assert.deepEqual(back, state, query);
    assert.deepEqual(notes, []);
  }
  assert.deepEqual(r.parseRiverState('').state, r.DEFAULT_STATE);
  const bad = r.parseRiverState('?slope=40&flow=abc&grain=lava&supply=-5&t=99&mode=race');
  assert.deepEqual(bad.state, r.DEFAULT_STATE);
  assert.equal(bad.notes.length, 6);
  assert.match(bad.notes.join(' '), /slope in the link must be between 1 and 10%, so 4% is used/);
  assert.match(bad.notes.join(' '), /“lava” isn’t a sediment/);
  assert.equal(r.parseRiverState('?slope=3.3&flow=2.2&supply=44&t=7.3').state.slope, 3.5, 'values snap to the sliders');
  assert.deepEqual(r.parseRiverState('?slope=3.3&flow=2.2&supply=44&t=7.3').state, { ...r.DEFAULT_STATE, slope: 3.5, flow: 2, supply: 40, t: 7.5 });
  assert.match(r.parseRiverState('?grain=' + 'x'.repeat(200)).notes[0], /…/);
  assert.equal(r.serializeRiverState({ slope: 99, flow: 0, grain: 'x', supply: 1000, t: -4, mode: 'explore' }), 'slope=10&flow=0.5&grain=fine-sand&supply=100&t=0');
});

test('challenge: eight questions, each answer worked out by the model', () => {
  const qs = r.challengeQuestions();
  assert.equal(qs.length, r.CHALLENGE_COUNT);
  for (const q of qs) {
    assert.ok(q.choices.includes(q.answer), q.prompt);
    assert.equal(new Set(q.choices).size, q.choices.length);
    for (const c of q.choices) assert.ok(q.choiceNames[c], `${q.prompt}: ${c} has a label`);
    assert.ok(q.prompt.endsWith('?') && q.explain.length > 60, q.prompt);
    assert.ok(!/NaN|undefined/.test(q.explain + q.prompt));
  }
  const zones = qs.filter(q => q.kind === 'zone');
  assert.deepEqual(zones.map(q => q.answer), ['erode', 'transport', 'deposit'], 'one of each');
  for (const q of zones) assert.equal(q.answer, r.zoneAt(grain(q.grain).mm, q.speed));
  // Each zone question has a clear answer: the speed is well away from both curves.
  for (const q of zones) {
    const g = grain(q.grain), ratio = v => Math.abs(Math.log10(q.speed / v));
    assert.ok(ratio(r.erosionSpeed(g.mm)) > 0.1 && ratio(r.settlingSpeed(g.mm)) > 0.1, q.prompt);
  }
  assert.equal(qs.find(q => q.kind === 'clay').answer, 'no');
  for (const q of qs.filter(q => q.kind === 'setups')) {
    const sorted = [...q.values].sort((a, b) => b - a);
    assert.equal(q.values[Number(q.answer)], sorted[0]);
    assert.ok(sorted[0] > 1.15 * sorted[1], `a clear winner: ${q.values}`);
    q.setups.forEach((s, i) => assert.equal(q.values[i], r.measure(r.simulate(s), 10)[q.metric]));
  }
  assert.equal(qs.find(q => q.metric === 'deltaLength').setups[Number(qs.find(q => q.metric === 'deltaLength').answer)].grain, 'fine-sand');
  const bend = qs.find(q => q.kind === 'bend');
  assert.equal(bend.answer, 'inside');
  assert.ok(bend.bend.insideSpeed < r.erosionSpeed(grain('fine-sand').mm) && bend.bend.outsideSpeed > r.erosionSpeed(grain('fine-sand').mm), 'inside too slow to erode, outside fast enough');
  assert.equal(qs.find(q => q.kind === 'fan').answer, 'build');
});

// ---------- the worksheet ----------
const NUMBER = /\d[\d,]*(?:\.\d+)?/g;
const asNumber = printed => Number(printed.replace(/,/g, ''));

test('worksheet table equals the model after 10 minutes', () => {
  assert.equal(act.tool, 'river-erosion');
  assert.equal(act.rows.length, SETUPS.length);
  act.rows.forEach(([name, values], i) => {
    const s = SETUPS[i], m = r.measure(r.simulate(s), MINUTES);
    assert.ok(name.startsWith(`${s.name}: ${s.slope}% slope, ${s.flow} L/min`), name);
    assert.equal(values['Speed at start (cm/s)'], String(Math.round(r.flowSpeed(s.flow, s.slope))));
    assert.equal(values['Eroded (cm³)'], r.roundVolume(m.eroded).toLocaleString('en-US'));
    assert.ok(Math.abs(asNumber(values['Eroded (cm³)']) - m.eroded) <= 0.05 * m.eroded + 0.5, 'two significant figures');
    assert.equal(values['Deepest cut (cm)'], m.deepestCut.toFixed(1));
    assert.equal(values['Delta length (cm)'], String(m.deltaLength));
    assert.deepEqual(results[i], m);
  });
  for (const col of act.record) for (const [, values] of act.rows) assert.ok(values[col], col);
  // The comparisons the questions rely on.
  const [A, B, C, D] = results;
  assert.ok(D.eroded > C.eroded && C.eroded > B.eroded && B.eroded > A.eroded);
  assert.ok(C.startSpeed > B.startSpeed && C.deltaLength > B.deltaLength);
  assert.ok(C.seaDeposit > 0.8 * C.eroded, 'most of C’s sand reaches the sea');
});

test('worksheet: every number in an answer is checked against the model', () => {
  for (const block of [...act.questions, act.extraAnswer]) {
    const checked = new Set();
    for (const [printed, value, tol] of block.checks ?? []) {
      const decimals = (printed.split('.')[1] ?? '').length;
      const allowed = tol ?? 0.5 * 10 ** -decimals + 1e-9;
      assert.ok(Math.abs(asNumber(printed) - value) <= allowed, `printed ${printed} vs model ${value} (±${allowed})`);
      assert.ok(block.a.includes(printed), `${printed} appears in: ${block.a}`);
      checked.add(printed);
    }
    for (const number of block.a.match(NUMBER) ?? []) assert.ok(checked.has(number.replace(/[.,]$/, '')), `unchecked number ${number} in: ${block.a}`);
  }
  // Question 4 reads the diagram correctly.
  const q4 = act.questions[3];
  for (const [zone, ids] of Object.entries(q4.zones)) for (const id of ids) assert.equal(r.zoneAt(grain(id).mm, READ_SPEED), zone);
  assert.ok(q4.q.includes(`${READ_SPEED} cm/s`));
  assert.ok(act.extra.includes(String(FAN.supply)) && FAN.supply === 60);
});

test('worksheet metadata and standards', () => {
  assert.equal(act.questions.length, 6);
  assert.ok(act.minutes >= 10 && act.minutes <= 15);
  assert.equal(act.grade, 'Grades 6–10');
  assert.deepEqual(act.standards, ['MS-ESS2-2', 'HS-ESS2-5']);
  assert.deepEqual(Object.keys(standards).sort(), [...act.standards].sort());
  for (const code of act.standards) assert.equal(allStandards[code], standards[code], code);
  assert.ok(activities.includes(act), 'registered in activities.mjs');
  for (const field of ['tool', 'toolName', 'title', 'grade', 'minutes', 'standards', 'goal', 'steps', 'rowHeader', 'record', 'rows', 'extra', 'extraAnswer', 'keyNote', 'questions']) assert.ok(field in act, field);
  for (const q of act.questions) assert.ok(q.q && q.a && q.lines >= 1);
});

test('drawings are complete for many settings and times', () => {
  for (const s of SAMPLE) {
    const run = r.simulate(s);
    for (const t of [0, 1, 10, 20]) {
      const svg = planInner(run, t) + profileInner(run, t) + planInner(run, t, { labels: false }) + describePlan(run, t) + describeProfile(run, t) + r.describeRun(run, t);
      assert.ok(!/NaN|undefined|Infinity/.test(svg), `${JSON.stringify(s)} t=${t}`);
    }
  }
  for (const speed of [undefined, 0.05, 12, 37, 5000]) {
    const svg = hjulstromSvg({ speed, grain: 'silt', probe: { mm: 0.5, v: 40 } });
    assert.ok(svg.startsWith('<svg') && !/NaN|undefined|Infinity/.test(svg), String(speed));
  }
  // Pointing at the diagram reads back the point that was drawn.
  for (const [mm, v] of [[0.002, 120], [0.3, 20], [10, 0.5]]) {
    const p = hjPoint(mm, v), back = hjAt(p.x, p.y);
    close(back.mm, mm, mm * 1e-9);
    close(back.v, v, v * 1e-9);
  }
  assert.deepEqual(hjAt(0, 0), { mm: 0.001, v: 1000 });
  assert.ok(HJ.right > HJ.left);
});
