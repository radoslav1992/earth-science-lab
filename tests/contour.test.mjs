import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../src/lib/terrain.mjs';
import * as C from '../src/lib/contours.mjs';
import { mapLayers, mapSvg, profileSvg, tintSvg, riverCrossings, OVERLAYS } from '../src/lib/contour-svg.mjs';
import { parseState, serializeState, DEFAULT_STATE, DEFAULT_LINE } from '../src/lib/contour-share.mjs';
import { CHALLENGES, pointOnContour } from '../src/lib/contour-challenges.mjs';
import { contourMapActivity as act, WORKSHEET_MAP, WORKSHEET_POINTS, WORKSHEET_LINE, worksheetProfile } from '../src/lib/activities/contour-map.mjs';
import { reliefPixels, rampColor } from '../src/lib/relief.mjs';

const CX = 3000, CY = 2000;
const pts = line => Array.from({ length: line.points.length / 2 }, (_, k) => [line.points[2 * k], line.points[2 * k + 1]]);
const onEdge = ([x, y]) => x < 1e-6 || y < 1e-6 || x > T.WIDTH - 1e-6 || y > T.HEIGHT - 1e-6;

/** Every segment must have higher ground on its right and lower ground on its left. */
function assertOriented(t, line, label) {
  const p = pts(line), n = p.length;
  for (let k = 0; k < n - (line.closed ? 0 : 1); k++) {
    const [a, b] = [p[k], p[(k + 1) % n]], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 15) continue;
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, rx = -(b[1] - a[1]) / len, ry = (b[0] - a[0]) / len;
    const right = T.sample(t, mx + rx * 8, my + ry * 8), left = T.sample(t, mx - rx * 8, my - ry * 8);
    assert.ok(right > left, `${label}: segment ${k} at level ${line.level} has the higher ground on its right`);
  }
}

test('marching squares: a paraboloid gives one closed circle per level at the analytic radius', () => {
  const t = T.fromFunction((x, y) => 1000 - ((x - CX) ** 2 + (y - CY) ** 2) / 10000);
  for (const level of [900, 800, 700]) {
    const r = Math.sqrt((1000 - level) * 10000);
    const lines = C.isolines(t, level);
    assert.equal(lines.length, 1, `one line at ${level} m`);
    const [line] = lines;
    assert.ok(line.closed, 'the loop around an interior peak closes');
    assert.ok(line.area > 0, 'higher ground inside: a hill, not a hollow');
    for (const [x, y] of pts(line)) assert.ok(Math.abs(Math.hypot(x - CX, y - CY) - r) < 0.5, `point within 0.5 m of radius ${r.toFixed(1)}`);
    assert.ok(Math.abs(line.area / (Math.PI * r * r) - 1) < 0.005, 'enclosed area matches πr² within 0.5%');
    assertOriented(t, line, 'paraboloid');
  }
});

test('marching squares: a cone gives circles at radius (top − level) ÷ slope', () => {
  const t = T.fromFunction((x, y) => 800 - 0.25 * Math.hypot(x - CX, y - CY));
  for (const level of [700, 600, 450]) {
    const r = (800 - level) / 0.25, [line] = C.isolines(t, level);
    assert.ok(line.closed && line.area > 0);
    for (const [x, y] of pts(line)) assert.ok(Math.abs(Math.hypot(x - CX, y - CY) - r) < 3, `cone point near radius ${r}`);
  }
});

test('marching squares: ambiguous saddle cells follow the bilinear saddle value', () => {
  const grid = (tl, tr, br, bl) => ({ nx: 2, ny: 2, cell: 10, h: [tl, tr, bl, br] });
  // High corners TL and BR, high centre (1 / 1.8 ≈ 0.56): the two low corners are cut off.
  let lines = C.isolines(grid(1, 0, 1, 0.2), 0.5);
  assert.equal(lines.length, 2);
  const corner = line => pts(line).map(([x, y]) => `${x === 0 ? 'L' : x === 10 ? 'R' : ''}${y === 0 ? 'T' : y === 10 ? 'B' : ''}`).sort().join('');
  assert.deepEqual(lines.map(corner).sort(), ['BL', 'RT'], 'one line around the low top-right corner, one around the low bottom-left');
  // Same corners but a low centre (0.36 / 1.2 = 0.3): now the two high corners are cut off instead.
  lines = C.isolines(grid(0.6, 0, 0.6, 0), 0.5);
  assert.deepEqual(lines.map(corner).sort(), ['BR', 'LT']);
  for (const line of lines) assert.ok(!line.closed);
});

test('marching squares: a saddle surface splits into two open branches either side of the saddle level', () => {
  const t = T.fromFunction((x, y) => ((x - CX) ** 2 - (y - CY) ** 2) / 10000);
  for (const level of [40, -40]) {
    const lines = C.isolines(t, level);
    assert.equal(lines.length, 2, `two branches at ${level}`);
    for (const line of lines) {
      const p = pts(line);
      assert.ok(!line.closed && onEdge(p[0]) && onEdge(p[p.length - 1]), 'each branch runs edge to edge');
      const side = level > 0 ? Math.sign(p[0][0] - CX) : Math.sign(p[0][1] - CY);
      for (const [x, y] of p) {
        assert.equal(level > 0 ? Math.sign(x - CX) : Math.sign(y - CY), side, 'a branch never crosses to the other side');
        assert.ok(Math.abs(((x - CX) ** 2 - (y - CY) ** 2) / 10000 - level) < 1, 'points lie on the hyperbola');
      }
      assertOriented(t, line, 'saddle');
    }
  }
});

test('the Saddle preset: one loop around both peaks below the saddle, one loop each above it', () => {
  const t = T.createTerrain('saddle'), [p1, p2] = T.summits(t);
  // The saddle height: the highest level whose loop still contains both peaks.
  const loops = level => C.isolines(t, level).filter(l => l.closed);
  const both = level => loops(level).some(l => C.contains(l, p1.x, p1.y) && C.contains(l, p2.x, p2.y));
  let lo = 200, hi = Math.min(p1.h, p2.h) - 1;
  for (let k = 0; k < 30; k++) { const mid = (lo + hi) / 2; if (both(mid)) lo = mid; else hi = mid; }
  const saddle = (lo + hi) / 2;
  assert.ok(saddle > 300 && saddle < Math.min(p1.h, p2.h) - 40, `saddle at ${saddle.toFixed(1)} m`);
  const below = loops(saddle - 10).filter(l => C.contains(l, p1.x, p1.y) || C.contains(l, p2.x, p2.y));
  assert.equal(below.length, 1);
  const above = loops(saddle + 10).filter(l => C.contains(l, p1.x, p1.y) || C.contains(l, p2.x, p2.y));
  assert.equal(above.length, 2);
  assert.ok(above.every(l => C.contains(l, p1.x, p1.y) !== C.contains(l, p2.x, p2.y)), 'each loop holds exactly one peak');
});

test('every preset: lines are closed loops or run edge to edge, with the higher ground on the right', () => {
  for (const id of T.PRESET_IDS) {
    const t = T.createTerrain(id);
    const map = C.contourMap(t, { interval: 20, seaLevel: 0 });
    assert.ok(map.lines.length > 5, id);
    for (const line of map.lines) {
      const p = pts(line);
      if (!line.closed) assert.ok(onEdge(p[0]) && onEdge(p[p.length - 1]), `${id} ${line.level}: open lines end on the map edge`);
      assertOriented(t, line, id);
    }
    const { max } = T.range(t);
    let edgeMax = -Infinity;
    for (let i = 0; i < T.NX; i++) edgeMax = Math.max(edgeMax, t.h[i], t.h[(T.NY - 1) * T.NX + i]);
    for (let j = 0; j < T.NY; j++) edgeMax = Math.max(edgeMax, t.h[j * T.NX], t.h[j * T.NX + T.NX - 1]);
    for (const line of map.lines) if (line.level > edgeMax) assert.ok(line.closed, `${id}: lines above the highest edge point (${edgeMax}) close`);
    assert.ok(map.lines.some(l => l.level <= max));
  }
});

test('depressions: only the volcano crater has hollow loops, and its hachures point inward', () => {
  for (const id of T.PRESET_IDS) {
    const lines = C.contourMap(T.createTerrain(id), { interval: 20, seaLevel: 0 }).lines;
    if (id !== 'volcano') assert.ok(!lines.some(l => l.depression), `${id} has no hollows`);
  }
  const t = T.createTerrain('volcano'), [pit] = T.pits(t);
  const { lines } = C.contourMap(t, { interval: 20, seaLevel: 0 });
  const hollows = lines.filter(l => l.depression);
  assert.deepEqual(hollows.map(l => l.level), [620, 640, 660, 680]);
  for (const loop of hollows) {
    assert.ok(C.contains(loop, pit.x, pit.y) && pit.h < loop.level, 'the crater floor is inside and lower');
    for (const [x1, y1, x2, y2] of C.hachures(loop)) {
      assert.ok(T.sample(t, x2, y2) < T.sample(t, x1, y1), 'tick points downhill');
      assert.ok(C.contains(loop, x2, y2), 'tick points into the hollow');
    }
  }
  // Around the rim the 700 m lines are hilltop loops: the high points of the crater's edge.
  assert.ok(lines.filter(l => l.level === 700).every(l => l.closed && !l.depression && !C.contains(l, pit.x, pit.y)));
});

test('levels, index contours and the coastline', () => {
  assert.deepEqual(C.levelsFor({ min: 95, max: 205 }, 20, 0), [100, 120, 140, 160, 180, 200]);
  assert.deepEqual(C.levelsFor({ min: -70, max: 110 }, 50, 0), [50, 100], 'nothing at or below sea level');
  assert.deepEqual(C.levelsFor({ min: 0, max: 300 }, 50, 30), [50, 100, 150, 200, 250, 300]);
  assert.ok(C.isIndex(100, 20) && !C.isIndex(120, 20) && C.isIndex(250, 50) && C.isIndex(50, 10) && !C.isIndex(40, 10));
  const island = C.contourMap(T.createTerrain('island'), { interval: 20, seaLevel: 0 });
  assert.equal(island.coast.length, 1, 'one closed coastline');
  assert.ok(island.coast[0].closed && island.coast[0].area > 0);
  const flooded = C.contourMap(T.createTerrain('hill'), { interval: 20, seaLevel: 300 });
  assert.ok(flooded.coast.length >= 1 && flooded.lines.every(l => l.level > 300));
  const water = C.regionRings(T.createTerrain('hill'), 300, true);
  assert.ok(water.every(r => r.closed), 'water rings close along the map edge');
});

test('presets are deterministic', () => {
  const expected = { hill: [141, 485], steep: [120, 500], river: [155, 649], volcano: [113, 712], island: [-70, 260], saddle: [120, 506], cliff: [169, 453] };
  for (const id of T.PRESET_IDS) {
    const a = T.createTerrain(id), b = T.createTerrain(id);
    assert.deepEqual(a.h, b.h, `${id} is the same every time`);
    const { min, max } = T.range(a);
    assert.deepEqual([Math.round(min), Math.round(max)], expected[id], id);
  }
  assert.equal(new Set(T.PRESET_IDS.map(id => T.createTerrain(id).h.join())).size, T.PRESET_IDS.length, 'all presets differ');
  assert.equal(T.WIDTH, 6000);
  assert.equal(T.HEIGHT, 4000);
  assert.equal((T.NX - 1) * (T.NY - 1), 96 * 64);
});

test('bilinear sampling and profiles', () => {
  const t = T.createTerrain('hill');
  assert.equal(T.sample(t, 10 * T.CELL, 20 * T.CELL), t.h[20 * T.NX + 10], 'nodes return their own value');
  const mid = T.sample(t, 10.5 * T.CELL, 20.5 * T.CELL), k = 20 * T.NX + 10;
  assert.ok(Math.abs(mid - (t.h[k] + t.h[k + 1] + t.h[k + T.NX] + t.h[k + T.NX + 1]) / 4) < 1e-9, 'cell centre is the mean of its corners');
  const plane = T.fromFunction((x, y) => 100 + 0.02 * x - 0.03 * y);
  for (const [x, y] of [[123.4, 987.6], [5999, 1], [3141.5, 2718.2]]) assert.ok(Math.abs(T.sample(plane, x, y) - (100 + 0.02 * x - 0.03 * y)) < 1e-9, 'exact on a plane');
  assert.equal(T.sample(t, -500, -500), t.h[0], 'outside the map is clamped');
  const s = T.slopeAt(plane, 3000, 2000);
  assert.ok(Math.abs(s.gradient - Math.hypot(0.02, 0.03)) < 1e-9 && Math.abs(s.downhill.x + 0.02 / s.gradient) < 1e-9);
  const pr = T.profile(t, { x: 500, y: 500 }, { x: 5500, y: 3500 }, 101);
  assert.equal(pr.length, 101);
  assert.ok(Math.abs(pr[100].d - Math.hypot(5000, 3000)) < 1e-9);
  assert.equal(pr[0].h, T.sample(t, 500, 500));
  assert.ok(pr.every((p, i) => i === 0 || p.d > pr[i - 1].d));
  const stats = T.profileStats(pr);
  assert.ok(stats.high.h === Math.max(...pr.map(p => p.h)) && stats.low.h === Math.min(...pr.map(p => p.h)));
  const { stats: chart } = profileSvg(pr);
  assert.ok(chart.ve > 1, 'heights are exaggerated on a 5.8 km profile');
});

test('brushes stay bounded and stable', () => {
  const t = T.createTerrain('hill'), x = 3000, y = 2000;
  for (let k = 0; k < 400; k++) T.applyBrush(t, { mode: 'raise', x, y, radius: 500, strength: 1 });
  assert.equal(T.range(t).max, T.MAX_ELEVATION, 'raise stops at the ceiling');
  for (let k = 0; k < 800; k++) T.applyBrush(t, { mode: 'lower', x, y, radius: 500, strength: 1 });
  assert.equal(T.range(t).min, T.MIN_ELEVATION, 'lower stops at the floor');

  const rough = T.fromFunction((px, py) => 300 + 80 * Math.sin(px / 90) * Math.cos(py / 70));
  const r0 = T.range(rough);
  const wiggle = () => { let s = 0; for (let k = 1; k < rough.h.length; k++) s += Math.abs(rough.h[k] - rough.h[k - 1]); return s; };
  let before = wiggle();
  for (let k = 0; k < 50; k++) {
    T.applyBrush(rough, { mode: 'smooth', x: 3000, y: 2000, radius: 1500, strength: 1 });
    const r = T.range(rough), w = wiggle();
    assert.ok(r.min >= r0.min - 1e-9 && r.max <= r0.max + 1e-9, 'smoothing never goes beyond the existing heights');
    assert.ok(w <= before + 1e-9, 'smoothing never adds roughness');
    before = w;
  }

  const flat = T.createTerrain('steep');
  for (let k = 0; k < 200; k++) T.applyBrush(flat, { mode: 'flatten', x: 3300, y: 2000, radius: 400, strength: 1, target: 250 });
  const centre = T.sample(flat, 3300, 2000);
  assert.ok(Math.abs(centre - 250) < 0.5, `flatten reaches the target (${centre})`);
  const once = T.createTerrain('steep'), v0 = T.sample(once, 3300, 2000);
  T.applyBrush(once, { mode: 'flatten', x: 3300, y: 2000, radius: 400, strength: 1, target: 250 });
  const v1 = T.sample(once, 3300, 2000);
  assert.ok(v1 < v0 && v1 > 250, 'flatten moves toward the target without overshooting');

  const fresh = T.createTerrain('hill');
  assert.equal(T.applyBrush(fresh, { mode: 'raise', x: 3000, y: 2000, radius: 400, strength: 0 }), null, 'zero strength changes nothing');
  assert.equal(T.applyBrush(fresh, { mode: 'raise', x: 99999, y: 2000, radius: 400, strength: 1 }), null, 'off the map changes nothing');
  const box = T.applyBrush(fresh, { mode: 'raise', x: 3000, y: 2000, radius: 400, strength: 0.5 });
  assert.ok(box.i0 <= 48 && box.i1 >= 48 && box.j0 <= 32 && box.j1 >= 32);
  assert.ok(Math.abs(T.sample(fresh, 3000, 2000) - T.sample(T.createTerrain('hill'), 3000, 2000) - 0.5 * T.BRUSH_LIFT) < 1e-9, 'a dab lifts the centre by strength × 8 m');
});

test('sculpted heights survive the local-storage round trip', () => {
  const t = T.createTerrain('volcano');
  T.applyBrush(t, { mode: 'raise', x: 1000, y: 1000, radius: 600, strength: 0.7 });
  const back = T.decodeHeights(T.encodeHeights(t), 'volcano');
  assert.ok(back.h.every((v, k) => Math.abs(v - t.h[k]) <= 0.05 + 1e-9), 'within half a decimeter');
  assert.equal(T.decodeHeights('not a map'), null);
  assert.equal(T.decodeHeights(btoa('short')), null);
});

test('share state: defaults, round trip and friendly fallbacks', () => {
  assert.deepEqual(parseState(''), { state: DEFAULT_STATE, notes: [] });
  assert.deepEqual(parseState('?classroom=1').notes, []);
  const cases = [
    { mode: 'sculpt', preset: 'river', sea: 120, interval: 50, overlays: ['steep', 'vrule'], line: { a: { x: 600, y: 1200 }, b: { x: 5400, y: 3100 } }, view: '3d' },
    { mode: 'challenge', preset: 'hill', sea: 0, interval: 20, overlays: [], line: DEFAULT_LINE, view: '2d' },
    { mode: 'sculpt', preset: 'island', sea: 600, interval: 10, overlays: [...OVERLAYS], line: DEFAULT_LINE, view: '2d' },
  ];
  for (const state of cases) {
    const query = serializeState(state);
    const { state: back, notes } = parseState('?' + query);
    assert.deepEqual(notes, [], query);
    assert.deepEqual(back, state, query);
  }
  assert.equal(serializeState(cases[0]), 'preset=river&sea=120&ci=50&ov=steep,vrule&ab=600,1200,5400,3100&view=3d');
  assert.equal(serializeState({ ...cases[0], line: { a: { x: 600.4, y: 1199.6 }, b: { x: 5400, y: 3100 } } }), serializeState(cases[0]), 'line rounded to whole meters');
  const bad = parseState('?mode=fly&preset=moon&sea=9000&ci=7&ov=index,glitter&ab=1,2,3&view=4d');
  assert.equal(bad.notes.length, 7);
  assert.deepEqual(bad.state, DEFAULT_STATE);
  assert.deepEqual(parseState('?ab=10,10,40,40').state.line, DEFAULT_LINE, 'a line shorter than 100 m is ignored');
});

test('Match & Read: every answer agrees with the model', () => {
  assert.ok(CHALLENGES.length >= 6 && CHALLENGES.length <= 8);
  assert.equal(new Set(CHALLENGES.map(c => c.id)).size, CHALLENGES.length);
  for (const c of CHALLENGES) {
    assert.ok(Number.isInteger(c.answer) && c.answer >= 0 && c.answer < c.choices.length, c.id);
    assert.ok(c.explain.length > 40 && c.prompt.endsWith('?'), c.id);
    if (c.kind === 'match') assert.equal(c.choices[c.answer].preset, c.map.preset, `${c.id}: the right landscape is the map's`);
    if (c.kind === 'profile') assert.deepEqual(c.choices[c.answer].profile, { preset: c.map.preset, a: c.map.line.a, b: c.map.line.b }, `${c.id}: the right profile follows the map's line from A to B`);
  }
  const byId = Object.fromEntries(CHALLENGES.map(c => [c.id, c]));
  const hill = T.createTerrain('hill'), P = byId.elevation.map.marks[0];
  assert.ok(Math.abs(T.sample(hill, P.x, P.y) - 360) < 0.01, 'P is on the 360 m line');
  assert.equal(byId.elevation.choices[byId.elevation.answer].value, 360);
  assert.equal(byId.interval.choices[byId.interval.answer].value, byId.interval.map.interval);
  const steep = T.createTerrain('steep'), [W, E] = byId.steeper.map.marks;
  assert.ok(Math.abs(T.sample(steep, W.x, W.y) - 300) < 0.01 && Math.abs(T.sample(steep, E.x, E.y) - 300) < 0.01);
  const steeper = T.slopeAt(steep, E.x, E.y).gradient > T.slopeAt(steep, W.x, W.y).gradient ? 'east' : 'west';
  assert.equal(byId.steeper.choices[byId.steeper.answer].value, steeper);
  assert.equal(steeper, 'east');
  const river = T.riverPath(T.createTerrain('river'), 'east');
  assert.equal(byId.flow.choices[byId.flow.answer].value, river[river.length - 1][0] < river[0][0] ? 'west' : 'east');
  const volcano = T.createTerrain('volcano'), X = byId.hachures.map.marks[0];
  const hollows = C.contourMap(volcano, { interval: byId.hachures.map.interval, seaLevel: 0 }).lines.filter(l => l.depression);
  assert.ok(hollows.length && hollows.every(l => C.contains(l, X.x, X.y) && T.sample(volcano, X.x, X.y) < l.level), 'X is lower than every hachured loop around it');
  assert.equal(byId.hachures.choices[byId.hachures.answer].value, 'lower');
  const island = C.contourMap(T.createTerrain('island'), { interval: 20, seaLevel: 0 });
  const peaks = T.summits(T.createTerrain('island'));
  assert.equal(peaks.length, 2, 'the island has two hills');
  for (const p of peaks) assert.ok(island.lines.some(l => l.closed && C.contains(l, p.x, p.y) && !C.contains(l, peaks[0] === p ? peaks[1].x : peaks[0].x, peaks[0] === p ? peaks[1].y : peaks[0].y)), 'each hill has its own closed loops');
  const answers = CHALLENGES.map(c => c.answer);
  assert.ok(new Set(answers).size >= 3, 'answers are spread across positions');
});

test('worksheet: the printed numbers equal the model', () => {
  const t = T.createTerrain(WORKSHEET_MAP.preset), ci = WORKSHEET_MAP.interval;
  const h = k => T.sample(t, WORKSHEET_POINTS[k].x, WORKSHEET_POINTS[k].y);
  assert.deepEqual(act.rows.map(([name]) => name), ['A', 'B', 'C (on the river)']);
  const [a, b, c] = act.rows.map(([, v]) => v);
  assert.equal(a['Elevation (m)'], '260');
  assert.ok(Math.abs(h('A') - 260) < 0.01, 'A is on the 260 m line');
  for (const [values, key] of [[b, 'B'], [c, 'C']]) {
    const [lo, hi] = values['Lines around it (m)'].split(' and ').map(Number);
    assert.ok(lo % ci === 0 && hi - lo === ci && h(key) > lo && h(key) < hi, `${key} lies between the ${lo} and ${hi} lines`);
    assert.equal(values['Elevation (m)'], `about ${lo + ci / 2}`);
  }
  const river = T.riverPath(t, 'east');
  assert.ok(river.some(([x, y]) => Math.hypot(x - WORKSHEET_POINTS.C.x, y - WORKSHEET_POINTS.C.y) < 1), 'C is on the river');
  assert.ok(act.questions[3].flowsWest, 'the river flows west');
  assert.deepEqual(worksheetProfile, T.profile(t, WORKSHEET_LINE.a, WORKSHEET_LINE.b));
  const xy = T.profileStats(worksheetProfile);
  assert.ok(xy.low.d / xy.length < 0.5, 'the river is in the northern half of X–Y: the north side is the steep side');
  assert.ok((worksheetProfile[0].h - xy.low.h) / xy.low.d > 2 * (worksheetProfile.at(-1).h - xy.low.h) / (xy.length - xy.low.d), 'north side at least twice as steep');
});

test('worksheet: every number in an answer is checked or a constant', () => {
  const CONSTANTS = new Set(['4', '5', '100', '300', '400']);
  for (const block of [...act.questions, act.extraAnswer]) {
    const checked = new Set();
    for (const [printed, value, tolerance] of block.checks ?? []) {
      const decimals = (printed.split('.')[1] ?? '').length;
      assert.ok(Math.abs(Number(printed) - value) <= (tolerance ?? 0.5 * 10 ** -decimals) + 1e-9, `printed ${printed} vs model ${value}`);
      checked.add(printed);
    }
    for (const number of block.a.match(/\d+(?:\.\d+)?/g) ?? []) {
      assert.ok(checked.has(number) || CONSTANTS.has(number), `unchecked number ${number} in: ${block.a}`);
    }
  }
  // The example index lines quoted in question 1 exist on the printed map.
  const levels = C.contourMap(T.createTerrain(WORKSHEET_MAP.preset), { interval: WORKSHEET_MAP.interval, seaLevel: 0 }).lines.map(l => l.level);
  assert.ok(levels.includes(300) && levels.includes(400) && C.isIndex(300, 20) && C.isIndex(400, 20));
});

test('worksheet metadata', () => {
  assert.equal(act.tool, 'contour-map');
  assert.equal(act.questions.length, 6);
  assert.equal(act.minutes, 15);
  assert.equal(act.grade, 'Grades 6–10');
  assert.deepEqual(act.standards, [], 'no NGSS code is claimed');
  assert.ok(act.standardsNote.startsWith('Supports map-reading skills used in MS-ESS2-2 investigations'));
  for (const key of ['tool', 'toolName', 'title', 'grade', 'minutes', 'standards', 'goal', 'steps', 'record', 'rows', 'extra', 'extraAnswer', 'questions']) assert.ok(key in act, key);
  for (const col of act.record) for (const [, values] of act.rows) assert.ok(values[col], col);
});

test('map and chart markup is complete for every preset and overlay', () => {
  for (const id of T.PRESET_IDS) {
    const t = T.createTerrain(id);
    for (const interval of [10, 20, 50]) {
      const svg = mapSvg(t, { interval, seaLevel: id === 'island' ? 0 : 150, overlays: OVERLAYS, arrows: true, line: DEFAULT_LINE, marks: [{ x: 100, y: 100, label: 'P' }] });
      assert.ok(!/NaN|undefined|Infinity/.test(svg), `${id} at ${interval} m`);
    }
    const layers = mapLayers(t, { interval: 20, overlays: ['index'] });
    assert.ok(layers.labels.includes('class="cm-label"'), `${id} has labeled index lines`);
    assert.ok(!/NaN|undefined/.test(tintSvg(t)), id);
  }
  const river = T.createTerrain('river'), path = T.riverPath(river, 'east');
  const crossings = riverCrossings(river, path, C.levelsFor(T.range(river), 20, 0));
  assert.ok(crossings.length >= 10, 'the river crosses many contour lines');
  for (let k = 1; k < crossings.length; k++) assert.ok(crossings[k].level < crossings[k - 1].level, 'downstream, each crossing is lower: the river runs downhill');
  const pixels = reliefPixels(T.createTerrain('island'), { width: 60, height: 40, seaLevel: 0 });
  assert.equal(pixels.length, 60 * 40 * 4);
  assert.ok(pixels[2] > pixels[0], 'the corner is under the sea, so it is blue');
  assert.deepEqual(rampColor(-50), rampColor(0));
});

test('performance: every contour of a 96 × 64 map in under 20 ms', () => {
  for (const id of T.PRESET_IDS) {
    const t = T.createTerrain(id);
    C.contourMap(t, { interval: 10, seaLevel: 0 });
    const times = [];
    for (let k = 0; k < 7; k++) {
      const start = performance.now();
      C.contourMap(t, { interval: 10, seaLevel: 0 });
      times.push(performance.now() - start);
    }
    times.sort((p, q) => p - q);
    assert.ok(times[3] < 20, `${id}: median ${times[3].toFixed(2)} ms`);
  }
});
