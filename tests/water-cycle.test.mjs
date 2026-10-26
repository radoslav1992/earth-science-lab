import test from 'node:test';
import assert from 'node:assert/strict';
import * as w from '../src/lib/water-cycle.mjs';
import { waterCycleActivity as act, standards, WORKSHEET_JOURNEY, worksheetPath, worksheetLog } from '../src/lib/activities/water-cycle.mjs';
import { activities, standards as allStandards } from '../src/lib/activities.mjs';

const close = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} ≈ ${b}`);
const TODAY = w.DEFAULT_CONDITIONS;

test('reservoir volumes match the USGS table (after Shiklomanov 1993), with nothing counted twice', () => {
  const usgs = { oceans: 1338000000, ice: 24064000, groundwater: 23400000, permafrost: 300000, lakes: 176400, soil: 16500, atmosphere: 12900, swamps: 11470, rivers: 2120, living: 1120 };
  assert.deepEqual(Object.fromEntries(w.RESERVOIRS.map(r => [r.id, r.km3])), usgs);
  // The table's own total is 1,386,000,000 km³; the rows add up to it within rounding.
  assert.ok(Math.abs(w.TOTAL_KM3 - 1386000000) / 1386000000 < 0.0001, `total ${w.TOTAL_KM3}`);
  assert.equal(w.TOTAL_KM3, Object.values(usgs).reduce((a, b) => a + b, 0));
  // Fresh and salty parts: groundwater 10,530,000 fresh + 12,870,000 saline; lakes 91,000 fresh + 85,400 saline.
  assert.equal(w.RESERVOIR.groundwater.fresh, 10530000);
  assert.equal(w.SALTY_GROUNDWATER_KM3, 12870000);
  assert.equal(w.RESERVOIR.lakes.km3 - w.RESERVOIR.lakes.fresh, 85400);
  for (const r of w.RESERVOIRS) assert.ok(r.fresh >= 0 && r.fresh <= r.km3, r.id);
  assert.equal(w.RESERVOIR.oceans.fresh, 0);
  // The percentages the USGS prints, to their precision.
  const printed = { oceans: 96.54, ice: 1.74, groundwater: 1.69, permafrost: 0.022, lakes: 0.013, soil: 0.001, atmosphere: 0.001, swamps: 0.0008, rivers: 0.0002, living: 0.0001 };
  for (const [id, pct] of Object.entries(printed)) {
    const decimals = String(pct).split('.')[1].length;
    close(w.pctOfAll(id), pct, 0.5 * 10 ** -decimals + 1e-12);
  }
  const freshPrinted = { ice: 68.7, groundwater: 30.1, soil: 0.05, permafrost: 0.86, lakes: 0.26, atmosphere: 0.04, swamps: 0.03, rivers: 0.006, living: 0.003 };
  for (const [id, pct] of Object.entries(freshPrinted)) {
    const decimals = String(pct).split('.')[1].length;
    close(w.pctOfFresh(id), pct, 0.5 * 10 ** -decimals + 1e-12);
  }
  close(w.FRESH_PCT, 2.5, 0.05);
  close(w.RESERVOIRS.reduce((sum, r) => sum + w.pctOfAll(r.id), 0), 100, 1e-9);
  close(w.RESERVOIRS.reduce((sum, r) => sum + w.pctOfFresh(r.id), 0), 100, 1e-9);
  close(w.RESERVOIRS.reduce((sum, r) => sum + w.mlPerLiter(r.id), 0), 1000, 1e-9);
  assert.equal(w.formatPct(w.pctOfAll('oceans')), '96.5');
  assert.equal(w.formatPct(w.pctOfAll('atmosphere')), '0.00093');
  assert.equal(w.formatPct(w.pctOfAll('rivers')), '0.00015');
});

test('zoom bars: each level adds up, groups the pieces under 1% and zooms in on them', () => {
  for (const kind of w.WATER_KINDS) {
    const levels = w.whereLevels(kind);
    const ids = levels.flatMap(l => l.items.map(it => it.id));
    const expected = w.RESERVOIRS.filter(r => (kind === 'fresh' ? r.fresh : r.km3) > 0).map(r => r.id);
    assert.deepEqual([...ids].sort(), [...expected].sort(), `${kind}: every reservoir shown exactly once`);
    assert.equal(levels[0].zoom, 1);
    levels.forEach((level, i) => {
      close(level.items.reduce((s, it) => s + it.share, 0) + (level.rest?.share ?? 0), 1, 1e-12);
      if (level.rest) for (const it of level.items) assert.ok(it.share >= w.ZOOM_THRESHOLD, `${kind} level ${i}: ${it.id} is at least 1% of its bar`);
      if (level.rest) {
        assert.ok(level.rest.share < 0.05);
        close(levels[i + 1].total, level.rest.km3, 1e-6);
        assert.ok(levels[i + 1].zoom > level.zoom * 20, 'the next bar zooms in a lot');
      } else assert.equal(i, levels.length - 1);
    });
    for (const unit of w.UNITS) {
      const html = w.whereHtml(kind, unit);
      assert.ok(!/NaN|undefined|Infinity/.test(html), `${kind} ${unit}`);
      assert.equal((html.match(/class="wc-bar"/g) ?? []).length, levels.length);
    }
  }
  const all = w.whereLevels('all');
  assert.deepEqual(all[0].items.map(it => it.id), ['oceans', 'ice', 'groundwater']);
  assert.equal(all.length, 3);
  assert.equal(w.zoomText(all[1].zoom), 'about 2,700');
  assert.equal(w.zoomText(all[2].zoom), 'about 430,000');
  assert.match(w.whereHtml('all', 'ml'), /965 mL/);
  assert.match(w.whereHtml('fresh', 'pct'), /68\.7%/);
});

test('times: units, typical values from the cited table and plain-English durations', () => {
  close(w.stayYears('ocean'), 3200);
  close(w.stayYears('atmosphere') * w.DAYS_PER_YEAR, 9);
  close(w.stayYears('plants') * w.DAYS_PER_YEAR, 7);
  close(w.stayYears('soil'), 1.5 / 12);
  close(w.stayYears('river'), 4 / 12);
  close(w.stayYears('icesheet'), 20000);
  close(w.stayYears('deep'), 10000);
  // Ranges in the source; the model uses the middle.
  for (const [id, lo, hi] of [['glacier', 20, 100], ['lake', 50, 100], ['groundwater', 100, 200], ['soil', 1 / 12, 2 / 12], ['river', 2 / 12, 6 / 12]]) close(w.stayYears(id), (lo + hi) / 2, 1e-12);
  assert.deepEqual(w.STOP_IDS.map(w.stayText), ['about 3,200 years', 'about 9 days', 'about 60 years', 'about 20,000 years', 'about 1.5 months', 'about 1 week', 'about 4 months', 'about 75 years', 'about 150 years', 'about 10,000 years']);
  assert.equal(w.formatDuration(5.5 / 12), '5.5 months');
  assert.equal(w.formatDuration(3200.19), '3,200 years');
  assert.equal(w.formatDuration(2.5), '2.5 years');
  assert.equal(w.formatDuration(14 / 365.25), '2 weeks');
  assert.equal(w.formatDuration(1 / 365.25), '1 day');
  assert.equal(w.formatDuration(1 / 12), '1 month');
  assert.equal(w.formatDuration(0), 'less than a day');
  for (const s of w.STOPS) assert.ok(w.RESERVOIR[s.reservoir], s.id);
});

test('moves: today’s chances add up, the sun lifts water and gravity brings it down', () => {
  for (const id of w.STOP_IDS) {
    const out = w.EDGES.filter(e => e.from === id);
    assert.ok(out.length >= 1, `${id} has a way out`);
    assert.equal(out.reduce((s, e) => s + e.w, 0), 100, `${id} weights add up to 100`);
    assert.equal(new Set(out.map(e => e.to)).size, out.length, `${id}: one move per destination`);
    for (const climate of w.CLIMATES) {
      const ex = w.exits(id, { ...TODAY, climate });
      close(ex.reduce((s, e) => s + e.chance, 0), 1, 1e-12);
      for (let k = 1; k < ex.length; k++) assert.ok(ex[k - 1].chance >= ex[k].chance, 'largest first');
    }
  }
  for (const e of w.EDGES) {
    assert.ok(w.PROCESSES[e.process] && w.STOP[e.from] && w.STOP[e.to] && e.from !== e.to, `${e.from}>${e.to}`);
    assert.ok(['sun', 'gravity'].includes(w.driverOf(e)), `${e.from}>${e.to} has a driver`);
    assert.ok(e.text.length > 10);
    if (e.to === 'atmosphere') assert.equal(w.driverOf(e), 'sun', `${e.from} → air needs the sun’s energy`);
    if (e.from === 'atmosphere') { assert.equal(w.driverOf(e), 'gravity', 'falling needs gravity'); assert.equal(e.via, 'condensation'); }
    if (['runoff', 'infiltration', 'groundwater'].includes(e.process)) assert.equal(w.driverOf(e), 'gravity');
  }
  // Every process the lab teaches appears on at least one move (condensation as the step before rain or snow).
  for (const id of w.PROCESS_IDS) assert.ok(w.EDGES.some(e => e.process === id || e.via === id), id);
  // Rain and snow land on the ocean 77 times in 100: 373 of 486 thousand km³ a year (Trenberth et al. 2007).
  close(w.exits('atmosphere').find(e => e.to === 'ocean').chance, 373 / (373 + 113), 0.005);
  // Every place can reach every other place.
  for (const id of w.STOP_IDS) assert.deepEqual(w.reachable(id).places.sort(), [...w.STOP_IDS].sort(), id);
  assert.deepEqual(w.shortestPath('ocean', 'groundwater'), ['ocean', 'atmosphere', 'soil', 'groundwater']);
  assert.equal(w.edge('ocean', 'soil'), undefined);
  assert.equal(w.moveName(w.edge('atmosphere', 'glacier')), 'Condensation, then snow accumulation');
  assert.equal(w.formatChance(0.77), '77%');
  assert.equal(w.formatChance(0.0288), '2.9%');
  assert.equal(w.formatChance(0.005), '0.5%');
});

test('climate shifts the chances in the right direction', () => {
  const chance = (from, to, climate) => w.exits(from, { ...TODAY, climate }).find(e => e.to === to).chance;
  for (const to of ['glacier', 'icesheet']) {
    assert.ok(chance('atmosphere', to, 'colder') > chance('atmosphere', to, 'today'), `${to}: more snow when colder`);
    assert.ok(chance('atmosphere', to, 'warmer') < chance('atmosphere', to, 'today'), `${to}: less snow when warmer`);
  }
  assert.ok(chance('glacier', 'river', 'warmer') > chance('glacier', 'river', 'today'), 'more melting when warmer');
  assert.ok(chance('glacier', 'river', 'colder') < chance('glacier', 'river', 'today'), 'less melting when colder');
  assert.ok(chance('icesheet', 'ocean', 'warmer') > chance('icesheet', 'ocean', 'today'));
  for (const from of ['soil', 'lake', 'river']) {
    assert.ok(chance(from, 'atmosphere', 'warmer') > chance(from, 'atmosphere', 'today'), `${from}: more evaporation when warmer`);
    assert.ok(chance(from, 'atmosphere', 'colder') < chance(from, 'atmosphere', 'today'), `${from}: less evaporation when colder`);
  }
  assert.ok(chance('soil', 'plants', 'warmer') > chance('soil', 'plants', 'today'));
  assert.equal(chance('ocean', 'atmosphere', 'colder'), 1, 'the only way out of the ocean stays the only way');
});

test('thought experiments: no sun, no lift; no gravity, nothing falls', () => {
  const noSun = { ...TODAY, sun: false }, noGravity = { ...TODAY, gravity: false };
  for (const id of ['ocean', 'glacier', 'icesheet', 'plants']) assert.equal(w.exits(id, noSun).length, 0, `${id} stuck without the sun`);
  assert.equal(w.exits('atmosphere', noGravity).length, 0);
  for (const e of w.exits('soil', noSun)) assert.equal(w.driverOf(e), 'gravity');
  for (const id of w.STOP_IDS) {
    assert.ok(w.reachable(id, noSun).stuck.every(s => ['ocean', 'glacier', 'icesheet', 'plants'].includes(s)), `${id}: without the sun water ends up in the sea, in ice or in a plant`);
    const { stuck } = w.reachable(id, noGravity);
    assert.ok(stuck.every(s => s === 'atmosphere' || s === id), `${id}: without gravity water can only end up in the air`);
  }
  assert.deepEqual(w.reachable('soil', noSun).stuck, ['ocean']);
  assert.deepEqual(w.reachable('ocean', { ...TODAY, sun: false, gravity: false }).places, ['ocean']);
  assert.match(w.stuckReason('ocean', noSun), /stuck in the ocean: every way out \(evaporation\) needs the sun’s energy, which is switched off/);
  assert.match(w.stuckReason('atmosphere', noGravity), /needs gravity, which is switched off/);
  assert.match(w.stuckReason('soil', { ...TODAY, sun: false, gravity: false }), /the sun’s energy or gravity, and both are switched off/);
  assert.ok(w.moveAllowed(w.edge('ocean', 'atmosphere')));
  assert.ok(!w.moveAllowed(w.edge('ocean', 'atmosphere'), noSun));
});

test('seeded chance: deterministic, uniform, and true to the chances', () => {
  for (const seed of [1, 10, 2026, 9999]) for (let step = 1; step < 50; step++) {
    const r = w.chanceDraw(seed, step);
    assert.ok(r >= 0 && r < 1);
    assert.equal(w.chanceDraw(seed, step), r);
  }
  const bins = new Array(10).fill(0);
  for (let seed = 1; seed <= 2000; seed++) for (let step = 1; step <= 10; step++) bins[Math.floor(w.chanceDraw(seed, step) * 10)]++;
  for (const b of bins) assert.ok(Math.abs(b - 2000) < 160, `bin ${b}`);
  // Over many codes, the first move out of the air lands on the ocean about 77% of the time.
  let ocean = 0;
  for (let seed = 1; seed <= 9999; seed++) if (w.chanceMove('atmosphere', seed, 1).to === 'ocean') ocean++;
  close(ocean / 9999, 0.77, 0.015);
  assert.deepEqual(w.chanceJourney('ocean', 10, 6), w.chanceJourney('ocean', 10, 6));
  assert.notDeepEqual(w.chanceJourney('soil', 1, 12), w.chanceJourney('soil', 2, 12));
  assert.deepEqual(w.chanceJourney('ocean', 5, 8, { ...TODAY, sun: false }), ['ocean'], 'stuck at once');
  assert.equal(w.pickExit([{ chance: 0.5, to: 'a' }, { chance: 0.5, to: 'b' }], 0.4999).to, 'a');
  assert.equal(w.pickExit([{ chance: 0.5, to: 'a' }, { chance: 0.5, to: 'b' }], 0.5).to, 'b');
  assert.equal(w.pickExit([], 0.3), null);
  // A move's chance draw depends only on the code and the move number, so choosing earlier moves doesn't change it.
  assert.equal(w.chanceMove('soil', 77, 4).to, w.chanceMove('soil', 77, 4).to);
});

test('journey log adds the typical time of each place left', () => {
  const path = ['ocean', 'atmosphere', 'soil', 'groundwater', 'river', 'ocean'];
  const log = w.journeyLog(path);
  assert.equal(log.length, 5);
  close(log.at(-1).total, 3200 + 9 / 365.25 + 0.125 + 150 + 1 / 3, 1e-9);
  close(w.journeyYears(path), log.at(-1).total);
  assert.equal(w.formatDuration(w.journeyYears(path)), '3,350 years');
  assert.equal(w.longestStop(path), 'ocean');
  close(w.pathChance(path), 1 * 0.19 * 0.25 * 0.6 * 0.7, 1e-12);
  assert.throws(() => w.journeyLog(['ocean', 'soil']));
  assert.equal(w.journeyYears(['lake']), 0);
  assert.deepEqual(w.fastestPath('soil', 'ocean'), ['soil', 'atmosphere', 'ocean']);
});

test('share links round-trip and explain bad values', () => {
  assert.deepEqual(w.parseWaterState(''), { state: w.DEFAULT_STATE, notes: [] });
  assert.deepEqual(w.parseWaterState('?classroom=1').notes, []);
  const states = [
    { ...w.DEFAULT_STATE, path: ['ocean', 'atmosphere', 'soil', 'plants', 'atmosphere'], seed: 10 },
    { ...w.DEFAULT_STATE, mode: 'challenge', view: 'where', path: ['soil'], seed: 1, climate: 'warmer', sun: false, gravity: false, water: 'fresh', unit: 'ml' },
    { ...w.DEFAULT_STATE, path: ['icesheet', 'ocean'], seed: 9999, climate: 'colder', unit: 'km3' },
    { ...w.DEFAULT_STATE, path: w.chanceJourney('deep', 33, w.MAX_STEPS), seed: 33 },
  ];
  for (const state of states) {
    const query = w.serializeWaterState(state);
    const { state: back, notes } = w.parseWaterState('?' + query);
    assert.deepEqual(notes, [], query);
    assert.deepEqual(back, state, query);
  }
  assert.equal(w.serializeWaterState(states[0]), 'path=oc.at.so.lt.at&seed=10&climate=today');
  const bad = w.parseWaterState('?mode=race&view=map&climate=hot&sun=maybe&gravity=2&seed=0&path=oc.zz&water=salt&unit=cups');
  assert.equal(bad.notes.length, 9);
  assert.deepEqual(bad.state, { ...w.DEFAULT_STATE, path: ['ocean'] });
  const jump = w.parseWaterState('?path=oc.at.so.oc.at');
  assert.deepEqual(jump.state.path, ['ocean', 'atmosphere', 'soil']);
  assert.match(jump.notes[0], /can’t go straight from the soil to the ocean, so the journey stops just before that/);
  assert.match(w.parseWaterState('?path=xx.oc').notes[0], /doesn’t know \(“xx”\), so the droplet starts in the ocean/);
  assert.match(w.parseWaterState('?path=').notes[0], /empty, so the droplet starts in the ocean/);
  assert.match(w.parseWaterState('?seed=12.5').notes[0], /whole numbers from 1 to 9,999/);
  assert.match(w.parseWaterState('?mode=' + 'x'.repeat(200)).notes[0], /…/);
  const long = Array.from({ length: 80 }, (_, i) => (i % 2 ? 'at' : 'oc')).join('.');
  const cut = w.parseWaterState('?path=' + long);
  assert.equal(cut.state.path.length, w.MAX_STEPS + 1);
  assert.match(cut.notes[0], /up to 60 moves/);
  assert.equal(w.serializeWaterState({ ...w.DEFAULT_STATE, path: ['ocean', 'soil'], seed: 0, climate: 'hot' }), 'path=oc&seed=2026&climate=today');
  // Sun-driven moves made before the sun was switched off still replay.
  assert.deepEqual(w.parseWaterState('?path=oc.at&sun=off').state.path, ['ocean', 'atmosphere']);
});

function walkFinite(svg, label) {
  assert.ok(!/NaN|undefined|Infinity/.test(svg), label);
  for (const m of svg.matchAll(/-?\d+(?:\.\d+)?/g)) assert.ok(Number.isFinite(Number(m[0])), label);
}

test('scene: every move’s arrow stays in the frame, and the markup is complete', () => {
  const { width, height } = w.VIEW;
  for (const e of w.EDGES) {
    const pts = w.edgePoints(e.from, e.to);
    for (const [x, y] of pts) assert.ok(x >= 0 && x <= width && y >= 0 && y <= height, `${e.from}>${e.to} point ${x},${y}`);
    const [x0, y0] = pts[0], [a, b] = [w.ANCHORS[e.from], w.ANCHORS[e.to]];
    assert.ok(Math.hypot(x0 - a.x, y0 - a.y) > 10, 'clear of the droplet');
    assert.ok(Math.hypot(pts.at(-1)[0] - b.x, pts.at(-1)[1] - b.y) > 10, 'clear of the target');
  }
  walkFinite(w.sceneBaseSvg(), 'base');
  for (const id of w.STOP_IDS) {
    for (const cond of [TODAY, { ...TODAY, climate: 'colder' }, { ...TODAY, sun: false }, { ...TODAY, gravity: false }]) {
      const path = ['ocean', ...w.shortestPath('ocean', id).slice(1)];
      const svg = w.sceneDynamicSvg({ path, cond });
      walkFinite(svg, `${id} dynamic`);
      assert.equal((svg.match(/data-exit=/g) ?? []).length, w.exits(id, cond).length);
      const text = w.describeScene(path, cond);
      assert.ok(text.includes(w.placeName(id)) && !/undefined|NaN/.test(text), text);
    }
    for (const t of [0, 0.5, 1]) for (const e of w.exits(id)) walkFinite(w.sceneDynamicSvg({ path: [id], moving: { from: id, to: e.to, t } }), 'moving');
  }
  assert.equal(w.sceneDynamicSvg({ path: [] }), '', 'no droplet: nothing to draw');
  assert.match(w.describeScene(['ocean']), /Ways out: evaporation to the atmosphere \(100%\)/);
  assert.match(w.describeScene(['ocean'], { ...TODAY, sun: false }), /cannot move/);
  for (const id of w.PROCESS_IDS.filter(p => p !== 'uptake')) assert.ok(w.sceneBaseSvg().includes(`>${w.PROCESSES[id].name}<`), `${id} is named on the diagram`);
});

test('challenge: every answer is worked out from the model', () => {
  assert.ok(w.CHALLENGE.length >= 6 && w.CHALLENGE.length <= 8);
  assert.equal(new Set(w.CHALLENGE.map(q => q.id)).size, w.CHALLENGE.length);
  for (const q of w.CHALLENGE) {
    assert.ok(q.explain.length > 40 && /[?.]$/.test(q.prompt), q.id);
    if (q.kind === 'choice') {
      assert.ok(q.choices.some(c => c.value === q.answer), `${q.id}: answer is a choice`);
      assert.equal(new Set(q.choices.map(c => c.value)).size, q.choices.length);
    } else {
      const { start, target, maxSteps, maxYears } = q.task;
      const shortest = w.shortestPath(start, target);
      assert.ok(shortest.length - 1 <= maxSteps, `${q.id} can be done in ${maxSteps} moves`);
      const fastest = w.fastestPath(start, target);
      if (maxYears !== undefined) assert.ok(w.journeyYears(fastest) < maxYears && fastest.length - 1 <= maxSteps, `${q.id} can be done in time`);
      assert.equal(w.taskResult(q.task, shortest).status, maxYears === undefined || w.journeyYears(shortest) < maxYears ? 'success' : 'fail');
      assert.equal(w.taskResult(q.task, [start]).status, 'playing');
    }
  }
  const byId = Object.fromEntries(w.CHALLENGE.map(q => [q.id, q]));
  assert.equal(byId['plants-to-air'].answer, 'transpiration');
  assert.equal(byId.longest.answer, 'icesheet');
  assert.equal(byId['sun-off'].answer, 'stuck');
  assert.equal(byId['ocean-share'].answer, 96.5);
  assert.equal(byId['air-vs-rivers'].answer, 'atmosphere');
  assert.equal(byId.gravity.answer, 'gravity');
  assert.equal(byId['to-groundwater'].task.maxSteps, 3);
  // Steering tasks: a detour through the sea uses up the moves; a trip underground takes too long.
  assert.equal(w.taskResult(byId['to-groundwater'].task, ['ocean', 'atmosphere', 'ocean', 'atmosphere']).status, 'fail');
  assert.equal(w.taskResult(byId['to-groundwater'].task, ['ocean', 'atmosphere', 'lake', 'groundwater']).status, 'success');
  assert.equal(w.taskResult(byId['soil-to-ocean'].task, ['soil', 'river', 'ocean']).status, 'success');
  assert.equal(w.taskResult(byId['soil-to-ocean'].task, ['soil', 'groundwater', 'ocean']).status, 'fail');
  assert.equal(w.taskResult(byId['soil-to-ocean'].task, ['soil', 'groundwater']).status, 'playing', 'time counts when it leaves');
  assert.equal(w.taskResult(byId['soil-to-ocean'].task, ['soil', 'river', 'lake', 'river']).status, 'fail');
});

// Numbers in answers, including ones with thousands separators like 3,200.
const NUMBER = /\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g;
const asNumber = text => Number(text.replace(/,/g, ''));

test('activity: the table is chance code 10’s journey, and every printed number equals the model', () => {
  assert.equal(act.tool, 'water-cycle');
  assert.deepEqual(worksheetPath, w.chanceJourney('ocean', WORKSHEET_JOURNEY.seed, WORKSHEET_JOURNEY.moves));
  assert.deepEqual(worksheetPath, ['ocean', 'atmosphere', 'soil', 'plants', 'atmosphere', 'glacier', 'river']);
  assert.ok(new Set(worksheetPath).size >= 6, 'the journey visits many places');
  assert.equal(act.rows.length, WORKSHEET_JOURNEY.moves);
  act.rows.forEach(([move, values], i) => {
    const r = worksheetLog[i];
    assert.equal(move, String(i + 1));
    assert.equal(values['Place it left'], w.STOP[r.from].name);
    assert.equal(values['How it moved'], w.moveName(w.edge(r.from, r.to)));
    assert.equal(values['Typical time there'], w.stayText(r.from));
  });
  for (const col of act.record) for (const [, values] of act.rows) assert.ok(values[col], col);
  // Both drivers show up on the journey.
  const drivers = new Set(worksheetLog.map(r => w.driverOf(r.edge)));
  assert.deepEqual([...drivers].sort(), ['gravity', 'sun']);
  for (const block of [...act.questions, act.extraAnswer]) {
    const checked = new Set();
    for (const [printed, value, tolerance] of block.checks ?? []) {
      const decimals = (printed.split('.')[1] ?? '').length;
      assert.ok(Math.abs(asNumber(printed) - value) <= (tolerance ?? 0.5 * 10 ** -decimals) + 1e-9, `printed ${printed} vs model ${value}`);
      checked.add(printed);
    }
    for (const number of block.a.match(NUMBER) ?? []) assert.ok(checked.has(number), `unchecked number ${number} in: ${block.a}`);
  }
  assert.ok(act.extraAnswer.a.startsWith('A river.'));
  assert.ok(act.extraAnswer.a.includes(`about ${w.grouped(w.journeyYears(worksheetPath))} years`));
  assert.deepEqual(act.questions[4].stuck, w.reachable('soil', { ...TODAY, sun: false }).stuck);
  assert.ok(act.questions[1].a.includes('evaporation') && act.questions[1].a.includes('transpiration') && act.questions[1].a.includes('snow accumulation'));
  // Step 2 and 3 name the code and the number of presses the table needs.
  assert.ok(act.steps[1].includes(`type ${WORKSHEET_JOURNEY.seed}`) && act.steps[2].includes(`${WORKSHEET_JOURNEY.moves} times`));
});

test('activity metadata, standards and registration', () => {
  assert.equal(act.questions.length, 6);
  assert.equal(act.minutes, 15);
  assert.equal(act.grade, 'Grades 5–8');
  assert.deepEqual(act.standards, ['MS-ESS2-4', '5-ESS2-2']);
  assert.deepEqual(Object.keys(standards).sort(), [...act.standards].sort());
  assert.match(standards['MS-ESS2-4'], /energy from the sun and the force of gravity/);
  for (const code of act.standards) assert.equal(allStandards[code], standards[code], code);
  assert.equal(activities.filter(a => a.tool === 'water-cycle').length, 1);
  for (const field of ['tool', 'toolName', 'title', 'grade', 'minutes', 'standards', 'goal', 'steps', 'rowHeader', 'record', 'rows', 'extra', 'extraAnswer', 'questions', 'keyNote']) assert.ok(field in act, field);
  for (const q of act.questions) assert.ok(q.q.endsWith('?') && q.lines >= 1 && q.a.length > 30, q.q);
});
