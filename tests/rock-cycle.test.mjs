import test from 'node:test';
import assert from 'node:assert/strict';
import * as r from '../src/lib/rock-cycle.mjs';
import * as v from '../src/lib/rock-view.mjs';
import { parseRockState, serializeRockState, DEFAULT_STATE, MAX_STEPS } from '../src/lib/rock-share.mjs';
import { activity as act, standards, JOURNEY, journeyRow } from '../src/lib/activities/rock-cycle.mjs';
import { activities, standards as allStandards } from '../src/lib/activities.mjs';

const close = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} ≈ ${b}`);
const after = (id, code, comp) => r.apply({ ...r.startState(id), ...(comp ? { comp } : {}) }, code);
const product = (id, code, comp) => { const x = after(id, code, comp); return x.ok ? x.state.id : null; };
const stateAt = (id, place, comp = r.MATERIALS[id].comp ?? null) => ({ id, place, comp });

test('materials: every rock and state is complete, with a family, a texture and a place it forms', () => {
  assert.equal(r.ROCK_IDS.length, 21);
  assert.deepEqual(r.MAGMA_IDS, ['felsic-magma', 'intermediate-magma', 'mafic-magma']);
  const byFamily = fam => r.ROCK_IDS.filter(id => r.MATERIALS[id].family === fam).sort();
  assert.deepEqual(byFamily('intrusive'), ['diorite', 'gabbro', 'granite']);
  assert.deepEqual(byFamily('extrusive'), ['andesite', 'basalt', 'obsidian', 'pumice', 'rhyolite', 'scoria']);
  assert.deepEqual(byFamily('sedimentary'), ['conglomerate', 'limestone', 'sandstone', 'shale']);
  assert.deepEqual(byFamily('metamorphic'), ['amphibolite', 'gneiss', 'greenschist', 'marble', 'phyllite', 'quartzite', 'schist', 'slate']);
  for (const [id, m] of Object.entries(r.MATERIALS)) {
    assert.ok(r.FAMILIES.includes(m.family), id);
    for (const field of ['name', 'look', 'forms', 'example', 'madeOf']) assert.ok(m[field].length > 3, `${id}.${field}`);
    // Sentences end with a period; the short descriptions don't (the card adds it).
    for (const field of ['forms', 'example']) assert.ok(m[field].endsWith('.'), `${id}.${field}`);
    for (const field of ['look', 'madeOf']) assert.ok(!m[field].endsWith('.'), `${id}.${field}`);
    assert.ok(v.TEXTURE_IDS.includes(m.texture), `${id} texture`);
    assert.ok(r.OPTION_BY_CODE[m.formedBy], `${id} formedBy`);
    if (r.isRockFamily(m.family) || m.family === 'magma') assert.ok(r.COMPS.includes(m.comp), `${id} comp`);
    const s = r.startState(id);
    assert.ok(r.PLACES[s.place], `${id} starts at a real place`);
  }
  // Rocks start where they form.
  assert.equal(r.startState('granite').place, 'pluton');
  assert.equal(r.startState('basalt').place, 'volcano');
  assert.equal(r.startState('shale').place, 'buried');
  assert.equal(r.startState('slate').place, 'meta1');
  assert.equal(r.startState('gneiss').place, 'meta4');
  assert.equal(r.startState('mafic-magma').place, 'melt-mafic');
  for (const id of r.START_IDS) assert.ok(r.isRockFamily(r.MATERIALS[id].family) || r.MATERIALS[id].family === 'magma');
  for (const id of ['slate', 'phyllite', 'schist', 'gneiss', 'greenschist']) assert.ok(r.MATERIALS[id].foliated, `${id} is foliated`);
  for (const id of ['marble', 'quartzite']) assert.ok(!r.MATERIALS[id].foliated, `${id} is not foliated`);
});

test('cooling: the magma make-up and the cooling speed decide the igneous rock', () => {
  const expected = {
    felsic: { cs: 'granite', cf: 'rhyolite', cg: 'obsidian', cv: 'pumice' },
    intermediate: { cs: 'diorite', cf: 'andesite', cg: null, cv: 'pumice' },
    mafic: { cs: 'gabbro', cf: 'basalt', cg: null, cv: 'scoria' },
  };
  for (const [comp, codes] of Object.entries(expected)) {
    for (const [code, rock] of Object.entries(codes)) {
      const x = after(`${comp}-magma`, code);
      assert.equal(x.ok ? x.state.id : null, rock, `${comp} ${code}`);
      if (!x.ok) { assert.match(x.reason, /glass|obsidian/i); continue; }
      assert.equal(r.MATERIALS[rock].family, code === 'cs' ? 'intrusive' : 'extrusive');
      assert.equal(x.state.place, code === 'cs' ? 'pluton' : 'volcano');
      assert.equal(x.state.comp, comp, 'the rock keeps its magma’s make-up');
    }
  }
  for (const id of r.ROCK_IDS) assert.equal(product(id, 'cs'), null, `${id} can’t cool: it isn’t magma`);
});

test('metamorphism follows Earle Table 7.1: the right product at each grade, never backwards', () => {
  const grades = ['h1', 'h2', 'h3', 'h4'];
  const table = {
    shale: ['slate', 'phyllite', 'schist', 'gneiss'],
    slate: [null, 'phyllite', 'schist', 'gneiss'],
    phyllite: [null, null, 'schist', 'gneiss'],
    schist: [null, null, null, 'gneiss'],
    gneiss: [null, null, null, null],
    sandstone: [null, null, 'quartzite', 'quartzite'],
    limestone: [null, 'marble', 'marble', 'marble'],
    quartzite: [null, null, null, null],
    marble: [null, null, null, null],
    conglomerate: [null, null, null, null],
    granite: [null, null, null, 'gneiss'],
    rhyolite: [null, null, null, 'gneiss'],
    obsidian: [null, null, null, 'gneiss'],
    pumice: [null, null, null, 'gneiss'],
    basalt: ['greenschist', 'greenschist', 'amphibolite', 'amphibolite'],
    gabbro: ['greenschist', 'greenschist', 'amphibolite', 'amphibolite'],
    scoria: ['greenschist', 'greenschist', 'amphibolite', 'amphibolite'],
    andesite: ['greenschist', 'greenschist', 'amphibolite', 'amphibolite'],
    diorite: ['greenschist', 'greenschist', 'amphibolite', 'amphibolite'],
    greenschist: [null, null, 'amphibolite', 'amphibolite'],
    amphibolite: [null, null, null, null],
  };
  assert.deepEqual(Object.keys(table).sort(), [...r.ROCK_IDS].sort(), 'every rock is in the table');
  for (const [id, row] of Object.entries(table)) {
    row.forEach((expected, i) => {
      const x = after(id, grades[i]);
      assert.equal(x.ok ? x.state.id : null, expected, `${id} at ${grades[i]}`);
      if (x.ok) {
        assert.equal(r.MATERIALS[x.state.id].family, 'metamorphic');
        assert.equal(x.state.place, `meta${i + 1}`);
      } else assert.ok(x.reason.length > 30 && x.reason.endsWith('.'), x.reason);
    });
  }
  // Andesite-type rock stays andesite-type: it melts back into andesitic magma.
  assert.equal(r.replay('andesite', ['h1', 'me']).states.at(-1).id, 'intermediate-magma');
  assert.equal(r.replay('diorite', ['h4', 'me']).states.at(-1).id, 'intermediate-magma');
  // The mudrock ladder only climbs.
  for (let a = 0; a < r.MUD_LADDER.length; a++) for (const g of [1, 2, 3, 4]) {
    const x = after(r.MUD_LADDER[a], `h${g}`);
    if (x.ok) assert.ok(r.MUD_LADDER.indexOf(x.state.id) > a);
  }
  for (const id of [...r.MAGMA_IDS, 'sediment', 'gravel', 'sand', 'mud', 'shells']) assert.equal(product(id, 'h3'), null, `${id} can’t be metamorphosed`);
});

test('melting: same make-up of magma; quartz and calcite rocks don’t melt in the crust', () => {
  const felsic = ['granite', 'rhyolite', 'obsidian', 'pumice', 'shale', 'conglomerate', 'slate', 'phyllite', 'schist', 'gneiss'];
  for (const id of felsic) assert.equal(product(id, 'me'), 'felsic-magma', id);
  for (const id of ['diorite', 'andesite']) assert.equal(product(id, 'me'), 'intermediate-magma', id);
  for (const id of ['gabbro', 'basalt', 'scoria', 'greenschist', 'amphibolite']) assert.equal(product(id, 'me'), 'mafic-magma', id);
  assert.match(after('quartzite', 'me').reason, /1,700 °C/);
  assert.match(after('sandstone', 'me').reason, /quartz/);
  for (const id of ['limestone', 'marble']) assert.match(after(id, 'me').reason, /calcite/);
  assert.equal(after('pumice', 'me', 'intermediate').state.id, 'intermediate-magma', 'andesitic pumice melts back to andesitic magma');
  for (const id of [...r.MAGMA_IDS, 'sediment', 'mud']) assert.equal(product(id, 'me'), null);
  assert.equal(r.shortestPath('granite', 'basalt'), null, 'melting granite never makes basalt');
  assert.equal(r.shortestPath('gneiss', 'gabbro'), null);
});

test('surface processes: weathering needs the surface; deposition and cementation need loose sediment', () => {
  for (const id of r.ROCK_IDS) {
    const s = r.startState(id);
    const x = r.apply(s, 'we');
    assert.equal(x.ok, r.PLACES[s.place].surface === true, `${id} at ${s.place}`);
    if (!x.ok) assert.match(x.reason, /Uplift and exposure/);
    const up = r.apply(s, 'up');
    assert.equal(up.ok, !r.PLACES[s.place].surface, `${id} uplift`);
    if (up.ok) {
      assert.equal(up.state.place, 'land');
      assert.equal(up.state.id, id, 'uplift moves a rock without changing it');
      const w = r.apply(up.state, 'we');
      assert.ok(w.ok && w.state.id === 'sediment' && w.state.from === id);
    }
    for (const code of ['dg', 'ds', 'dm', 'dc', 'cc']) assert.equal(r.apply(s, code).ok, false, `${id} ${code}`);
  }
  const sed = r.apply(r.startState('basalt'), 'we').state;
  const deposits = { dg: ['gravel', 'conglomerate'], ds: ['sand', 'sandstone'], dm: ['mud', 'shale'], dc: ['shells', 'limestone'] };
  for (const [code, [layer, rock]] of Object.entries(deposits)) {
    const d = r.apply(sed, code);
    assert.equal(d.state.id, layer);
    assert.ok(r.PLACES[d.state.place].surface);
    const c = r.apply(d.state, 'cc');
    assert.equal(c.state.id, rock);
    assert.equal(c.state.place, 'buried');
    assert.equal(r.MATERIALS[rock].family, 'sedimentary');
    assert.equal(r.apply(d.state, 'we').state.id, 'sediment', 'loose layers can be eroded again');
  }
  assert.match(r.apply(sed, 'cc').reason, /Deposition/);
  assert.equal(r.apply(sed, 'we').ok, false);
  for (const code of ['up', 'we', 'cc', 'me', 'h2']) assert.equal(r.apply(r.startState('felsic-magma'), code).ok, false, `magma ${code}`);
  assert.match(r.apply(r.startState('felsic-magma'), 'up').reason, /erupting/);
});

test('every refusal explains itself, and every allowed step lands somewhere real', () => {
  for (const id of r.START_IDS) for (const place of Object.keys(r.PLACES)) for (const code of r.CODES) {
    const s = stateAt(id, place);
    const x = r.apply(s, code);
    if (x.ok) {
      assert.ok(r.MATERIALS[x.state.id] && r.PLACES[x.state.place], `${id}@${place} ${code}`);
      assert.ok(x.state.comp === null || r.COMPS.includes(x.state.comp));
    } else assert.ok(/^[A-Z“]/.test(x.reason) && x.reason.endsWith('.') && !/undefined|null/.test(x.reason), `${id}@${place} ${code}: ${x.reason}`);
  }
  assert.equal(r.apply(r.startState('granite'), 'zz').ok, false);
});

test('the cycle has no dead ends, and shortcuts exist', () => {
  const fromMagma = new Set(r.MAGMA_IDS.flatMap(id => [...r.reachable(id)]));
  for (const id of r.ROCK_IDS) assert.ok(fromMagma.has(id), `${id} can be made from some magma`);
  for (const id of r.START_IDS) {
    const ids = r.reachable(id);
    assert.ok([...ids].some(x => r.MATERIALS[x].family === 'magma'), `${id} can melt again eventually`);
    assert.ok([...ids].some(x => r.MATERIALS[x].family === 'sedimentary'), `${id} can become sedimentary`);
    assert.ok([...ids].some(x => r.MATERIALS[x].family === 'metamorphic'), `${id} can become metamorphic`);
  }
  // Shortcuts named on the page and the worksheet.
  assert.equal(product('granite', 'h4'), 'gneiss', 'igneous straight to metamorphic');
  assert.equal(r.replay('sandstone', ['up', 'we']).states.at(-1).id, 'sediment', 'sedimentary back to sediment');
  assert.equal(product('basalt', 'me'), 'mafic-magma', 'igneous straight back to magma');
  assert.equal(product('slate', 'me'), 'felsic-magma', 'metamorphic to magma');
});

test('conditions: rough ranges from the model, in the right units', () => {
  assert.deepEqual(r.GRADES.map(g => g.temp), [[200, 300], [300, 400], [400, 600], [600, 800]], 'metamorphism roughly 200–800 °C');
  for (const comp of ['felsic', 'intermediate', 'mafic']) assert.ok(r.MELT_C[comp][0] >= 650 && r.MELT_C[comp][1] <= 1200, 'melting roughly 650–1,200 °C');
  assert.ok(r.MELT_C.felsic[1] <= r.MELT_C.intermediate[0] && r.MELT_C.intermediate[1] <= r.MELT_C.mafic[0], 'silica-rich rock melts coolest');
  assert.equal(r.depthForTempKm(500), 20);
  assert.equal(r.tempAtDepthC(20), 500);
  assert.deepEqual(r.gradeDepth(3), [16, 24]);
  close(r.pressureAtm(1), 261.4, 0.1);
  assert.equal(r.twoSig(r.pressureAtm(28)), 7300);
  assert.equal(r.twoSig(4182), 4200);
  assert.equal(r.upliftMyr(20), 20, '20 km at 1 mm per year takes 20 million years');
  assert.equal(r.upliftMyr(10, 2), 5);
  for (const g of [1, 2, 3, 4]) assert.deepEqual(r.PLACES[`meta${g}`].depth, r.gradeDepth(g));
  for (const comp of ['felsic', 'intermediate', 'mafic']) assert.deepEqual(r.PLACES[`melt-${comp}`].depth, r.MELT_C[comp].map(r.depthForTempKm));
  // Every step from every start: complete conditions with sensible numbers.
  for (const id of r.START_IDS) for (const code of r.CODES) {
    const from = r.startState(id), x = r.apply(from, code);
    if (!x.ok) continue;
    const c = r.conditions(code, x.state, from);
    for (const field of ['process', 'where', 'tempText', 'time', 'energy', 'pressureText', 'depthText']) assert.ok(typeof c[field] === 'string' && c[field].length > 3, `${id} ${code} ${field}`);
    assert.ok(c.depth[0] >= 0 && c.depth[1] <= 50 && c.depth[0] <= c.depth[1], `${id} ${code} depth`);
    if (c.temp) assert.ok(c.temp[0] >= 0 && c.temp[1] <= 1200 && c.temp[0] < c.temp[1], `${id} ${code} temp`);
    assert.ok(!/NaN|undefined/.test(JSON.stringify(c)));
    if (code === 'up') assert.equal(c.upliftKm, r.midDepth(from.place));
  }
  const meta = r.conditions('h3', r.apply(r.startState('shale'), 'h3').state);
  assert.equal(meta.tempText, 'About 400–600 °C (medium grade)');
  assert.equal(meta.depthText, 'About 16–24 km down');
  assert.equal(meta.pressureText, 'About 4,200–6,300 times the air pressure at sea level');
  assert.match(r.conditions('we', r.apply(r.replay('granite', ['up']).states[1], 'we').state).energy, /Sun/);
  assert.match(r.conditions('me', r.startState('mafic-magma')).energy, /internal heat/);
});

test('replays are deterministic, and the drawings are finite and repeatable', () => {
  const codes = ['up', 'we', 'dc', 'cc', 'h2', 'up', 'we', 'dm', 'cc', 'h4', 'me', 'cg'];
  const a = r.replay('granite', codes), b = r.replay('granite', codes);
  assert.deepEqual(a, b);
  assert.equal(a.stoppedAt, -1);
  assert.equal(a.states.at(-1).id, 'obsidian');
  assert.equal(r.replay('granite', ['we', 'up']).stoppedAt, 0);
  const section = v.sectionSvg(a.states, { active: 'cg' });
  assert.equal(section, v.sectionSvg(b.states, { active: 'cg' }));
  assert.ok(section.includes('rx-zone on'), 'the last process is highlighted');
  for (const id of r.MATERIAL_IDS) {
    const swatch = v.swatchSvg(id);
    assert.equal(swatch, v.swatchSvg(id), `${id} texture is deterministic`);
    assert.ok(!/NaN|undefined|Infinity/.test(swatch), `${id} texture`);
    assert.ok(swatch.length < 14000, `${id} texture is compact (${swatch.length} bytes)`);
    assert.ok(!/ id="/.test(swatch), 'no ids, so many cards can share a page');
    const s = r.startState(id);
    const card = v.cardHtml(s);
    assert.ok(card.includes(r.MATERIALS[id].name) && !/NaN|undefined|null/.test(card), `${id} card`);
  }
  for (const place of Object.keys(r.PLACES)) {
    const [x, y] = v.placeXY(place);
    assert.ok(x > 46 && x < v.SECTION.width && y > 0 && y < v.SECTION.height, `${place} is inside the cross-section`);
  }
  for (const id of r.START_IDS) for (const code of r.CODES) {
    const run = r.replay(id, [code]);
    const markup = v.sectionSvg(run.states) + v.cycleSvg(run.states) + v.describeSection(run.states) + v.describeCycle(run.states) + v.journeyHtml(run.states, run.steps.map(s => s.code));
    assert.ok(!/NaN|undefined|Infinity/.test(markup), `${id} ${code}`);
  }
});

test('the rock cycle diagram counts the arrows a journey uses', () => {
  const run = r.replay('mafic-magma', ['cf', 'we', 'dc', 'cc', 'h2', 'up', 'we', 'dm', 'cc', 'me']);
  assert.deepEqual(v.cycleUse(run.states), {
    'magma>igneous': 1, 'igneous>sediment': 1, 'sediment>sedimentary': 2, 'sedimentary>metamorphic': 1, 'metamorphic>sediment': 1, 'sedimentary>magma': 1,
  });
  for (const key of Object.keys(v.cycleUse(run.states))) assert.ok(v.CYCLE_EDGES.some(([f, t]) => `${f}>${t}` === key), key);
  assert.deepEqual(v.cycleUse(r.replay('shale', ['h1', 'h3']).states), { 'sedimentary>metamorphic': 1, 'metamorphic>metamorphic': 1 });
  assert.deepEqual(v.cycleUse(r.replay('granite', ['up']).states), {}, 'uplift stays on the same stop');
  // Every possible single step maps to an arrow on the diagram.
  for (const id of r.START_IDS) for (const code of r.CODES) for (const key of Object.keys(v.cycleUse(r.replay(id, [code]).states))) {
    assert.ok(v.CYCLE_EDGES.some(([f, t]) => `${f}>${t}` === key), `${id} ${code}: ${key}`);
  }
});

test('share links round-trip and explain bad values', () => {
  const journeys = [
    { mode: 'explore', start: 'granite', steps: [] },
    { mode: 'explore', start: 'granite', steps: ['up', 'we', 'dm', 'cc', 'h1'] },
    { mode: 'explore', start: 'mafic-magma', steps: ['cf', 'we', 'dc', 'cc', 'h3'] },
    { mode: 'explore', start: 'limestone', steps: ['h4', 'up', 'we', 'ds', 'cc', 'h3'] },
  ];
  for (const state of journeys) {
    const query = serializeRockState(state);
    const { state: back, notes } = parseRockState('?' + query);
    assert.deepEqual(back, state, query);
    assert.deepEqual(notes, []);
  }
  assert.equal(serializeRockState(journeys[1]), 'start=granite&steps=up.we.dm.cc.h1');
  assert.equal(serializeRockState({ mode: 'challenge', start: 'basalt', steps: ['we'] }), 'mode=challenge');
  assert.deepEqual(parseRockState('?mode=challenge').state, { ...DEFAULT_STATE, mode: 'challenge' });
  assert.deepEqual(parseRockState('').state, DEFAULT_STATE);
  assert.deepEqual(parseRockState('?steps=').state, DEFAULT_STATE);
  // Bad values fall back, each with a note.
  const bad = parseRockState('?mode=race&start=kryptonite&steps=up.we');
  assert.equal(bad.state.mode, 'explore');
  assert.equal(bad.state.start, 'granite');
  assert.deepEqual(bad.state.steps, ['up', 'we'], 'steps replay from the fallback start');
  assert.equal(bad.notes.length, 2);
  assert.match(bad.notes[1], /“kryptonite” isn’t a starting rock here/);
  const unknown = parseRockState('?start=granite&steps=up.we.zap.dm');
  assert.deepEqual(unknown.state.steps, ['up', 'we']);
  assert.match(unknown.notes[0], /Step 3 in the link \(“zap”\) isn’t a process here, so the journey stops after step 2/);
  const impossible = parseRockState('?start=granite&steps=we.up');
  assert.deepEqual(impossible.state.steps, []);
  assert.match(impossible.notes[0], /Step 1 in the link \(weathering and erosion\) can’t happen there: .*Uplift and exposure.* The journey stops after step 0\./);
  const long = parseRockState('?start=shale&steps=' + Array(MAX_STEPS + 5).fill('h1').join('.'));
  assert.equal(long.notes.length, 2, 'too long, and the second h1 can’t happen');
  assert.deepEqual(long.state.steps, ['h1']);
  assert.match(parseRockState('?start=' + 'x'.repeat(200)).notes[0], /…/);
  // Serializing drops anything that can't replay.
  assert.equal(serializeRockState({ mode: 'explore', start: 'nope', steps: ['up', 'bad', 'we'] }), 'start=granite&steps=up.we');
  assert.equal(serializeRockState({ mode: 'explore', start: 'granite', steps: ['we', 'up'] }), 'start=granite', 'a step that can’t happen ends the journey');
});

test('challenge: build tasks can be done and their fewest steps come from the search; answers come from the model', () => {
  assert.ok(r.CHALLENGE.length >= 6 && r.CHALLENGE.length <= 8);
  const builds = r.CHALLENGE.filter(q => q.kind === 'build');
  assert.deepEqual(builds.map(q => [q.start, q.goal, q.fewest]), [['mafic-magma', 'marble', false], ['granite', 'slate', true]]);
  for (const q of builds) {
    const path = r.shortestPath(q.start, q.goal);
    assert.ok(path, `${q.goal} reachable`);
    const run = r.replay(q.start, path);
    assert.equal(run.stoppedAt, -1);
    assert.equal(run.states.at(-1).id, q.goal);
    assert.equal(r.challengePar(q), path.length);
    assert.ok(q.prompt.endsWith('.') && q.help.length > 20 && q.explain.length > 60);
  }
  assert.deepEqual(r.shortestPath('granite', 'slate'), ['up', 'we', 'dm', 'cc', 'h1']);
  assert.equal(r.shortestPath('mafic-magma', 'marble').length, 5);
  assert.deepEqual(r.shortestPath('granite', 'granite'), []);
  for (const q of r.CHALLENGE.filter(q => q.kind !== 'build')) {
    assert.ok(q.choices.includes(q.answer), q.prompt);
    assert.equal(new Set(q.choices).size, q.choices.length);
    assert.ok(q.prompt.endsWith('?') && q.explain.length > 40);
    for (const choice of q.choices) assert.ok(r.choiceLabel(q, choice).length > 3, choice);
    if (q.kind === 'texture') {
      assert.equal(r.MATERIALS[q.show].family, q.answer, 'the drawing shows a rock of the answer family');
      assert.ok(!q.describe.toLowerCase().includes(r.MATERIALS[q.show].name.toLowerCase()), 'the description does not name the rock');
      assert.deepEqual(q.choices, r.FAMILY_CHOICES);
    }
  }
  const families = new Set(r.CHALLENGE.filter(q => q.kind === 'texture').map(q => q.answer));
  assert.ok(families.size >= 3, 'texture questions cover three families');
  const rhyolite = r.CHALLENGE.find(q => q.prompt.startsWith('You melt granite'));
  assert.equal(rhyolite.answer, r.replay('granite', ['me', 'cf']).states.at(-1).id);
  assert.equal(rhyolite.answer, 'rhyolite');
  const foliation = r.CHALLENGE.find(q => q.prompt.includes('foliation'));
  assert.equal(foliation.answer, 'meta');
  for (const id of r.ROCK_IDS.filter(id => r.MATERIALS[id].foliated)) assert.equal(r.OPTION_BY_CODE[r.MATERIALS[id].formedBy].process, 'meta', `${id} gets its foliation from heat and pressure`);
  assert.equal(r.CHALLENGE.find(q => q.prompt.includes('weathering and erosion')).answer, 'sun');
  assert.match(r.conditions('we', { id: 'sediment', place: 'stream', comp: null }).energy, /Sun/);
});

// Numbers that belong to the questions' own wording rather than to a model output.
const CONSTANTS = new Set([]);

test('activity: the journey table and every printed number equal the model', () => {
  assert.equal(act.tool, 'rock-cycle');
  const run = r.replay(JOURNEY.start, JOURNEY.steps);
  assert.equal(run.stoppedAt, -1);
  assert.equal(act.rows.length, JOURNEY.steps.length);
  act.rows.forEach(([label, values], i) => {
    assert.ok(label.startsWith(`${i + 1}. `), label);
    assert.ok(label.toLowerCase().includes(r.PROCESS_BY_ID[r.OPTION_BY_CODE[JOURNEY.steps[i]].process].name.toLowerCase()), label);
    assert.deepEqual(values, journeyRow(run.steps[i]));
    assert.equal(values['You get'], r.MATERIALS[run.states[i + 1].id].name);
    assert.equal(values.Family, r.FAMILY_NAMES[r.MATERIALS[run.states[i + 1].id].family]);
  });
  assert.deepEqual(act.rows.map(([, v]) => v['You get']), ['Granite', 'Sediment', 'Mud layers', 'Shale', 'Schist', 'Rhyolitic magma']);
  assert.deepEqual(act.rows.map(([, v]) => v['About how hot?']), ['Surface temperature', 'Surface temperature', 'Surface temperature', '25–125 °C', '400–600 °C', '650–800 °C']);
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
  assert.ok(act.questions[2].a.startsWith(`500 ÷ 25 = ${r.depthForTempKm(500)} km`));
  assert.equal(act.questions[2].schistFrom, 'shale');
  assert.ok(act.questions[3].a.endsWith(`= ${r.upliftMyr(r.depthForTempKm(500))} million years.`));
  const magma = run.states.at(-1);
  for (const code of ['cs', 'cf', 'cg', 'cv']) {
    const rock = r.MATERIALS[r.apply(magma, code).state.id].name;
    assert.ok(act.questions[4].a.includes(rock.toLowerCase()) && act.extraAnswer.a.includes(rock), rock);
  }
  // The shortcuts in question 6 really exist in the model.
  assert.ok(act.questions[5].a.includes('granite can go straight to gneiss') && product('granite', 'h4') === 'gneiss');
  assert.ok(act.questions[5].a.includes('basalt can melt again') && product('basalt', 'me') === 'mafic-magma');
});

test('activity metadata, standards and registration', () => {
  assert.equal(act.questions.length, 6);
  assert.equal(act.minutes, 15);
  assert.equal(act.grade, 'Grades 6–10');
  assert.deepEqual(act.standards, ['MS-ESS2-1']);
  assert.deepEqual(Object.keys(standards), ['MS-ESS2-1']);
  assert.match(standards['MS-ESS2-1'], /cycle.*energy/);
  assert.equal(allStandards['MS-ESS2-1'], standards['MS-ESS2-1'], 'merged into the site’s standards');
  assert.ok(activities.includes(act), 'registered in activities.mjs');
  assert.equal(activities.filter(a => a.tool === 'rock-cycle').length, 1);
  assert.ok(act.rowHeader && act.keyNote && act.extra && act.goal);
  for (const field of ['tool', 'toolName', 'title', 'grade', 'minutes', 'standards', 'goal', 'steps', 'record', 'rows', 'extra', 'extraAnswer', 'questions']) assert.ok(field in act, field);
  for (const q of act.questions) assert.ok(q.q.endsWith('?') || q.q.endsWith('.)') || q.q.endsWith('.'), q.q);
});
