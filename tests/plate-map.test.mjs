import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as m from '../src/lib/plate-map.mjs';
import * as v from '../src/lib/plate-map-view.mjs';
import { LAND } from '../src/lib/plate-map-land.mjs';
import * as plates from '../src/lib/plates.mjs';
import { activity as act, ROWS, mapRow } from '../src/lib/activities/plate-map.mjs';
import { activities, standards as allStandards } from '../src/lib/activities.mjs';

const close = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} ≈ ${b}`);
const B = id => m.boundaryById(id);
const type = id => m.boundaryType(B(id));
function inRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
/** True when a [lon, lat] point is on land in the Natural Earth outlines (some rings run on past 180°). */
const onLand = ([lon, lat]) => { const x = m.wrapLon(lon); return LAND.some(ring => inRing([x, lat], ring) || inRing([x + 360, lat], ring)); };
const landShare = id => { const pts = m.sample(B(id).pts, 0.5); return pts.filter(onLand).length / pts.length; };
// Points along every coastline, about half a degree apart (the outlines themselves have long straight edges).
const COAST = LAND.flatMap(ring => m.sample([...ring, ring[0]], 0.5));
const kmToLand = point => { const p = [m.wrapLon(point[0]), point[1]]; let best = Infinity; for (const c of COAST) { if (Math.abs(c[1] - p[1]) > 8) continue; best = Math.min(best, m.distanceKm(p, [m.wrapLon(c[0]), c[1]])); } return best; };

test('land outlines: generated from Natural Earth, small, and shaped like the world', () => {
  assert.ok(LAND.length >= 100 && LAND.length <= 250, `${LAND.length} outlines`);
  const points = LAND.reduce((sum, ring) => sum + ring.length, 0);
  assert.ok(points > 3000 && points < 7000, `${points} points`);
  for (const ring of LAND) for (const [lon, lat] of ring) {
    assert.ok(lon >= -180 && lon <= 195 && lat >= -78 && lat <= 84, `${lon}, ${lat}`);
    assert.equal(lon, Math.round(lon * 10) / 10);
  }
  const file = fs.statSync(new URL('../src/lib/plate-map-land.mjs', import.meta.url)).size;
  assert.ok(file < 90_000, `${file} bytes`);
  assert.ok(v.landPath().length < 80_000);
  // Places everyone knows are land, and oceans are not.
  const land = { Paris: [2.3, 48.9], Denver: [-105, 39.7], Brasília: [-47.9, -15.8], Nairobi: [36.8, -1.3], Delhi: [77.2, 28.6], Beijing: [116.4, 39.9], 'Alice Springs': [133.9, -23.7], Reykjavík: [-21.5, 64.3], Tokyo: [139.5, 35.9], 'far eastern Siberia, past the 180° line': [-176, 66.5], Honolulu: [-155.5, 19.6] };
  for (const [name, point] of Object.entries(land)) assert.ok(onLand(point), `${name} is on land`);
  const sea = { 'mid Pacific': [-140, 0], 'mid Atlantic': [-30, 30], 'Indian Ocean': [80, -20], 'Gulf of Mexico': [-90, 25], Mediterranean: [18, 35], 'Sea of Japan': [135, 40], 'Southern Ocean': [0, -60], 'Bering Sea': [-178, 57] };
  for (const [name, point] of Object.entries(sea)) assert.ok(!onLand(point), `${name} is water`);
  // The script that made the file, and the package it reads, are part of the repository.
  const script = fs.readFileSync(new URL('../scripts/plate-map-land.mjs', import.meta.url), 'utf8');
  assert.match(script, /world-atlas\/land-50m\.json/);
  const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.ok(pkg.devDependencies['world-atlas'], 'world-atlas is a development dependency only');
  assert.ok(!pkg.dependencies['world-atlas']);
  assert.equal(pkg.scripts['map-land'], 'node scripts/plate-map-land.mjs');
});

test('distances on the sphere, and lines that cross the 180° line', () => {
  close(m.distanceKm([0, 0], [1, 0]), (Math.PI * m.EARTH_RADIUS_KM) / 180);
  close(m.distanceKm([0, 0], [0, 90]), (Math.PI * m.EARTH_RADIUS_KM) / 2);
  close(m.distanceKm([179, 0], [-179, 0]), (2 * Math.PI * m.EARTH_RADIUS_KM) / 180, 1e-4);
  close(m.distanceKm([10, 60], [11, 60]), ((Math.PI * m.EARTH_RADIUS_KM) / 180) * 0.5, 1e-3);
  assert.equal(m.distanceKm([20, -30], [20, -30]), 0);
  // London to New York is about 5,570 km.
  assert.ok(Math.abs(m.distanceKm([-0.1, 51.5], [-74, 40.7]) - 5570) < 30);
  assert.deepEqual([-180, 0, 180, 186.8, 360, -199, 540].map(m.wrapLon), [-180, 0, 180, -173.2, 0, 161, 180]);
  assert.deepEqual(m.splitAtDateLine([[10, 0], [20, 5]]), [[[10, 0], [20, 5]]]);
  assert.deepEqual(m.splitAtDateLine([[176, 51.2], [180, 50.5], [184, 50.6]]), [[[176, 51.2], [180, 50.5]], [[-180, 50.5], [-176, 50.6]]]);
  assert.deepEqual(m.splitAtDateLine([[-172, -64.5], [-180, -65], [-186, -63.8]]), [[[-172, -64.5], [-180, -65]], [[180, -65], [174, -63.8]]]);
  const crossed = m.splitAtDateLine([[178, -16], [183, -15]]);
  assert.equal(crossed.length, 2);
  assert.deepEqual(crossed[0][1], [180, -15.6]);
  assert.deepEqual(crossed[1], [[-180, -15.6], [-177, -15]]);
  for (const b of m.BOUNDARIES) for (const piece of m.splitAtDateLine(b.pts)) {
    assert.ok(piece.length >= 2);
    for (const [lon] of piece) assert.ok(lon >= -180 && lon <= 180, `${b.id}: ${lon}`);
    for (let i = 1; i < piece.length; i++) assert.ok(Math.abs(piece[i][0] - piece[i - 1][0]) < 20, `${b.id}: no jump across the map`);
  }
  assert.equal(m.sample([[0, 0], [1, 0]], 0.25).length, 5);
  assert.deepEqual(m.sample([[0, 0], [1, 0]], 0.25).at(-1), [1, 0]);
  close(m.distanceToBoundaryKm([-122.5, 37.75], B('san-andreas')), 6, 1);
});

test('plates: fifteen named plates, each labeled on its own side of the lines', () => {
  assert.equal(m.PLATES.length, 15);
  assert.deepEqual(m.PLATE_IDS, ['pacific', 'namerica', 'samerica', 'eurasia', 'africa', 'somali', 'antarctic', 'indoaus', 'nazca', 'cocos', 'caribbean', 'arabia', 'philippine', 'juandefuca', 'scotia']);
  assert.equal(new Set(m.PLATES.map(p => p.name)).size, m.PLATES.length);
  for (const plate of m.PLATES) {
    assert.match(plate.name, / Plate$/);
    assert.ok(plate.about.length > 60 && plate.about.endsWith('.'), plate.id);
    assert.equal(m.plateById(plate.id), plate);
    const mine = m.BOUNDARIES.filter(b => b.plates.includes(plate.id));
    assert.ok(mine.length >= 2, `${plate.id} has boundaries`);
    for (const { at } of v.plateLabels(plate)) {
      const [lon, lat] = at;
      assert.ok(lon >= m.WORLD.west && lon <= m.WORLD.east && lat >= m.WORLD.south + 3 && lat <= m.WORLD.north - 3, `${plate.id} label on the map`);
      // The nearest sharp boundary to a label is one of that plate's own edges: the name sits on its own plate.
      const sharp = m.BOUNDARIES.filter(b => b.kind !== 'zone').map(b => ({ b, km: m.distanceToBoundaryKm(at, b) })).sort((p, q) => p.km - q.km)[0];
      assert.ok(sharp.b.plates.includes(plate.id), `${plate.id} label at ${at}: nearest boundary is ${sharp.b.id}`);
      assert.ok(sharp.km > 150, `${plate.id} label at ${at} is clear of the lines (${Math.round(sharp.km)} km)`);
    }
    const d = m.describePlate(plate);
    assert.match(d.neighbors, /^Neighbors on this map: .+\.$/);
    assert.match(d.boundaries, /^Its edges here: \d+ (divergent|convergent|transform)/);
  }
  // Continental plates are labeled on land, ocean plates at sea.
  for (const id of ['namerica', 'samerica', 'eurasia', 'africa', 'arabia']) assert.ok(onLand(m.plateById(id).label), `${id} label on land`);
  for (const id of ['pacific', 'nazca', 'cocos', 'philippine', 'scotia', 'juandefuca', 'caribbean']) assert.ok(!onLand(m.plateById(id).label), `${id} label at sea`);
  // Neighbors come from the boundary list.
  const neighbors = id => new Set(m.BOUNDARIES.filter(b => b.plates.includes(id)).flatMap(b => b.plates).filter(p => p !== id));
  assert.deepEqual([...neighbors('nazca')].sort(), ['antarctic', 'caribbean', 'cocos', 'pacific', 'samerica']);
  assert.deepEqual([...neighbors('juandefuca')].sort(), ['namerica', 'pacific']);
  assert.deepEqual([...neighbors('arabia')].sort(), ['africa', 'eurasia', 'indoaus', 'somali']);
  assert.ok(neighbors('pacific').size >= 7);
});

test('boundaries: complete, joined up, and no stray points', () => {
  assert.equal(new Set(m.BOUNDARY_IDS).size, m.BOUNDARIES.length);
  assert.equal(new Set(m.BOUNDARIES.map(b => b.name)).size, m.BOUNDARIES.length);
  assert.ok(m.BOUNDARIES.length >= 50 && m.BOUNDARIES.length <= 70);
  const key = ([lon, lat]) => `${Math.round(m.wrapLon(lon) * 100) / 100},${lat}`;
  const vertices = new Map();
  for (const b of m.BOUNDARIES) {
    assert.ok(m.KINDS[b.kind], `${b.id} kind`);
    assert.equal(b.plates.length, 2);
    assert.notEqual(b.plates[0], b.plates[1]);
    for (const id of b.plates) assert.ok(m.PLATE_IDS.includes(id), `${b.id}: ${id}`);
    if (b.under) {
      assert.ok(['trench', 'arc'].includes(b.kind), `${b.id}: only a subduction zone has a sinking plate`);
      assert.ok(b.plates.includes(b.under));
    }
    if (b.note) assert.ok(b.note.length > 40 && b.note.endsWith('.'), b.id);
    assert.ok(b.pts.length >= 2);
    b.pts.forEach(([lon, lat], i) => {
      assert.ok(Number.isFinite(lon) && Number.isFinite(lat) && lat >= m.WORLD.south && lat <= m.WORLD.north, `${b.id} point ${i}`);
      // A slipped digit would show up as a long jump or a sharp spike.
      if (i > 0) assert.ok(Math.hypot(lon - b.pts[i - 1][0], lat - b.pts[i - 1][1]) < 9, `${b.id}: points ${i - 1} and ${i} are close`);
      vertices.set(key([lon, lat]), [...(vertices.get(key([lon, lat])) ?? []), b.id]);
    });
    for (let i = 2; i < b.pts.length; i++) {
      const [a, c, e] = [b.pts[i - 2], b.pts[i - 1], b.pts[i]];
      const turn = Math.abs(Math.atan2(e[1] - c[1], e[0] - c[0]) - Math.atan2(c[1] - a[1], c[0] - a[0])) * 180 / Math.PI;
      assert.ok(Math.min(turn, 360 - turn) < 125, `${b.id}: no hairpin at point ${i - 1}`);
    }
    const d = m.describeBoundary(b);
    assert.equal(d.type, m.KINDS[b.kind].type);
    assert.ok(d.text.length > 60 && d.plates.startsWith('Between the ') && !/undefined/.test(d.text + d.plates));
  }
  // Every line ends at another line, except where the map says the boundary really stops or leaves the map.
  const open = { gakkel: 'start', 'mar-north': 'start', 'ear-west': 'start', 'ear-malawi': 'end', manila: 'end' };
  for (const b of m.BOUNDARIES) for (const [where, point] of [['start', b.pts[0]], ['end', b.pts.at(-1)]]) {
    const shared = vertices.get(key(point)).filter(id => id !== b.id);
    if (open[b.id] === where) assert.equal(shared.length, 0, `${b.id} ${where} is an open end`);
    else assert.ok(shared.length >= 1, `${b.id} ${where} joins another boundary`);
  }
  for (const id of ['gakkel', 'mar-north']) assert.equal(B(id).pts[0][1], m.WORLD.north, `${id} leaves by the top of the map`);
  // Three or more plates meet at the triple junctions.
  const meet = point => new Set(vertices.get(key(point)).flatMap(id => B(id).plates));
  assert.deepEqual([...meet([-29.7, 39.4])].sort(), ['africa', 'eurasia', 'namerica']);
  assert.deepEqual([...meet([70, -25.5])].sort(), ['africa', 'antarctic', 'indoaus', 'somali']);
  assert.deepEqual([...meet([-102.2, 2.2])].sort(), ['cocos', 'nazca', 'pacific']);
  assert.deepEqual([...meet([141.8, 34.4])].sort(), ['eurasia', 'namerica', 'pacific', 'philippine']);
  assert.deepEqual([...meet([42, 11.6])].sort(), ['africa', 'arabia', 'somali']);
});

test('boundary types match well-established geology', () => {
  const expected = {
    divergent: ['mar-north', 'mar-central', 'mar-south', 'gakkel', 'terceira', 'epr-north', 'epr-south', 'pacific-antarctic', 'chile-rise', 'galapagos-rift', 'juan-de-fuca', 'gulf-california', 'swir', 'seir', 'carlsberg', 'aden', 'red-sea', 'ear-east', 'ear-west', 'ear-malawi', 'america-antarctic'],
    convergent: ['peru-chile', 'chile-south', 'middle-america', 'central-america', 'cascadia', 'aleutian', 'japan', 'mariana', 'ryukyu', 'philippine', 'manila', 'sunda', 'new-guinea', 'tonga', 'antilles-north', 'antilles-south', 'sandwich', 'makran', 'mediterranean', 'himalaya', 'zagros'],
    transform: ['san-andreas', 'queen-charlotte', 'mendocino', 'alpine', 'macquarie', 'fiji', 'dead-sea', 'owen', 'chaman', 'gloria', 'caribbean-north', 'caribbean-south', 'panama-fz', 'south-panama', 'scotia-north', 'scotia-south', 'shackleton'],
    zone: ['ne-asia', 'na-sa'],
  };
  for (const [kind, ids] of Object.entries(expected)) for (const id of ids) assert.equal(type(id), kind, id);
  // Every boundary is on the list above: none is typed without being checked.
  assert.deepEqual(Object.values(expected).flat().sort(), [...m.BOUNDARY_IDS].sort());
  for (const t of m.TYPES) assert.deepEqual(m.boundariesOfType(t).map(b => b.id).sort(), [...expected[t]].sort());
  // Ridges under the sea, rifts on land, collisions between continents.
  for (const id of ['mar-south', 'epr-south', 'swir', 'seir', 'carlsberg', 'pacific-antarctic']) assert.equal(B(id).kind, 'ridge', id);
  for (const id of ['ear-east', 'ear-west', 'ear-malawi', 'red-sea']) assert.equal(B(id).kind, 'rift', id);
  for (const id of ['himalaya', 'zagros']) assert.equal(B(id).kind, 'collision', id);
  // Which plate sinks at the main subduction zones.
  const sinks = { 'peru-chile': 'nazca', 'chile-south': 'antarctic', 'middle-america': 'cocos', 'central-america': 'cocos', cascadia: 'juandefuca', aleutian: 'pacific', japan: 'pacific', mariana: 'pacific', tonga: 'pacific', ryukyu: 'philippine', philippine: 'philippine', manila: 'eurasia', sunda: 'indoaus', makran: 'arabia', 'antilles-south': 'samerica', 'antilles-north': 'namerica', sandwich: 'samerica', mediterranean: 'africa' };
  for (const [id, plate] of Object.entries(sinks)) assert.equal(B(id).under, plate, id);
  assert.deepEqual(m.BOUNDARIES.filter(b => b.under).map(b => b.id).sort(), Object.keys(sinks).sort());
  // The plates on each side of the best-known boundaries.
  const between = { 'san-andreas': ['namerica', 'pacific'], 'peru-chile': ['nazca', 'samerica'], himalaya: ['eurasia', 'indoaus'], 'mar-south': ['africa', 'samerica'], 'mar-north': ['eurasia', 'namerica'], alpine: ['indoaus', 'pacific'], 'red-sea': ['africa', 'arabia'], cascadia: ['juandefuca', 'namerica'], mariana: ['pacific', 'philippine'], zagros: ['arabia', 'eurasia'], 'epr-south': ['nazca', 'pacific'], seir: ['antarctic', 'indoaus'] };
  for (const [id, pair] of Object.entries(between)) assert.deepEqual([...B(id).plates].sort(), pair, id);
  // Each kind links to the matching cross-section in the Plate Tectonics Explorer, and the link is one it accepts.
  for (const b of m.BOUNDARIES) {
    const key = m.KINDS[b.kind].explorer;
    if (!key) { assert.equal(m.explorerHref(b), null); continue; }
    assert.equal(plates.CASES[key].type, m.boundaryType(b), `${b.id}: the cross-section is the same type`);
    const { state, notes } = plates.parsePlatesState(m.explorerHref(b).split('?')[1]);
    assert.deepEqual(notes, []);
    assert.equal(plates.caseKey(state.type, state.plates), key);
    assert.ok(m.explorerTitle(b).includes(plates.CASES[key].name));
  }
  assert.equal(m.KINDS.collision.explorer, 'convergent-cc');
  assert.equal(plates.CASES['convergent-cc'].volcanoes, false);
  assert.equal(plates.CASES[m.KINDS.fault.explorer].volcanoes, false);
  // What happens to crust, as the explorer's own table has it.
  for (const row of plates.CRUST_BUDGET) assert.ok(m.TYPES.includes(row.type));
});

test('boundaries sit where the geography says: trenches offshore, ridges at sea, faults and rifts on land', () => {
  // Deep-sea trenches lie in water, a short way off the coast or island arc they follow.
  for (const id of ['peru-chile', 'chile-south', 'middle-america', 'central-america', 'cascadia', 'japan', 'aleutian', 'makran', 'manila', 'mariana', 'tonga', 'sandwich', 'antilles-south']) {
    assert.ok(landShare(id) < 0.06, `${id}: ${Math.round(landShare(id) * 100)}% on land`);
  }
  for (const id of ['peru-chile', 'middle-america', 'central-america', 'cascadia', 'japan', 'chile-south']) {
    // (The Kuril Islands are too small for the land outlines, so that stretch of the Japan–Kuril line is skipped.)
    const along = m.sample(B(id).pts, 2).filter(p => id !== 'japan' || p[1] < 41.5 || p[1] > 50.5);
    for (const p of along) { const km = kmToLand(p); assert.ok(km < 330, `${id}: trench within reach of the coast at ${p} (${Math.round(km)} km)`); }
    const inner = m.sample(B(id).pts, 1).slice(3, -3).map(kmToLand);
    assert.ok(Math.min(...inner) > 8, `${id}: stays off the coast`);
  }
  // Mid-ocean ridges are at sea.
  for (const id of ['mar-central', 'mar-south', 'epr-north', 'epr-south', 'pacific-antarctic', 'chile-rise', 'swir', 'seir', 'carlsberg', 'america-antarctic', 'galapagos-rift', 'juan-de-fuca', 'gakkel']) {
    assert.ok(landShare(id) < 0.04, `${id}: ${Math.round(landShare(id) * 100)}% on land`);
  }
  // The Mid-Atlantic Ridge runs down the middle of the ocean: far from both coasts.
  for (const p of m.sample(B('mar-south').pts, 3).slice(2, -4)) assert.ok(kmToLand(p) > 700, `mar-south at ${p}`);
  // It crosses Iceland, and only Iceland.
  const northOnLand = m.sample(B('mar-north').pts, 0.25).filter(onLand);
  assert.ok(northOnLand.length >= 8);
  for (const [lon, lat] of northOnLand) assert.ok(lon > -25 && lon < -13 && lat > 63 && lat < 67, `the ridge is on land only in Iceland (${lon}, ${lat})`);
  // The Red Sea rift runs down the Red Sea and the Gulf of Aden ridge down the gulf (both start on land, in Afar);
  // the Gulf of California line runs down its gulf.
  assert.ok(landShare('red-sea') < 0.25);
  assert.ok(landShare('aden') < 0.12);
  assert.ok(landShare('gulf-california') < 0.3);
  // Collision zones, continental rifts and continental transform faults are on land.
  for (const id of ['himalaya', 'zagros', 'chaman', 'ear-east', 'ear-west', 'ear-malawi']) assert.ok(landShare(id) > 0.85, `${id}: ${Math.round(landShare(id) * 100)}% on land`);
  // The Dead Sea Transform starts in the Gulf of Aqaba, and the San Andreas and Alpine faults run partly offshore.
  assert.ok(landShare('dead-sea') > 0.7 && landShare('san-andreas') > 0.6 && landShare('alpine') > 0.5);
  // Fixed points the lines must pass close to.
  const passes = (id, point, km) => assert.ok(m.distanceToBoundaryKm(point, B(id)) < km, `${id} passes within ${km} km of ${point}`);
  passes('san-andreas', [-122.45, 37.75], 30); // San Francisco
  passes('san-andreas', [-120.43, 35.9], 30); // Parkfield
  passes('mar-north', [-21.1, 64.26], 40); // Þingvellir, Iceland
  passes('mar-south', [-14.4, -7.95], 150); // Ascension Island, just west of the ridge
  passes('alpine', [170.2, -43.4], 30); // Franz Josef, New Zealand
  passes('dead-sea', [35.5, 31.5], 30); // the Dead Sea
  passes('ear-east', [36.1, 0.6], 40); // Lake Baringo, Kenya
  passes('ear-west', [29.6, -5.5], 60); // Lake Tanganyika
  passes('himalaya', [85.3, 27.7], 90); // Kathmandu lies just north of the mountain front
  passes('mariana', [142.2, 11.35], 60); // Challenger Deep
  passes('galapagos-rift', [-86.2, 0.8], 40); // the 1977 vent field
  passes('epr-north', [-104.3, 9.83], 40); // the 9°50′N vent field
  passes('caribbean-north', [-89.1, 15.3], 40); // the Motagua Fault
  passes('red-sea', [38, 21], 60);
});

test('examples: real, well placed, and assigned to the right boundary', () => {
  assert.ok(m.QUAKES.length >= 40 && m.QUAKES.length <= 80);
  assert.ok(m.VOLCANOES.length >= 40 && m.VOLCANOES.length <= 80);
  const ids = [...m.QUAKES, ...m.VOLCANOES].map(f => f.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(new Set(m.QUAKES.map(q => `${q.name} ${q.year}`)).size, m.QUAKES.length);
  assert.equal(new Set(m.VOLCANOES.map(x => x.name)).size, m.VOLCANOES.length);
  for (const f of [...m.QUAKES, ...m.VOLCANOES]) {
    assert.ok(f.lon >= -180 && f.lon <= 180 && f.lat >= m.WORLD.south && f.lat <= m.WORLD.north, f.name);
    assert.equal(m.featureById(f.id), f);
  }
  assert.equal(m.featureById('q0'), null);
  for (const q of m.QUAKES) {
    assert.ok(q.magnitude >= 6.5 && q.magnitude <= 9.5, q.name);
    assert.ok(Number.isInteger(q.year) && q.year >= 1700 && q.year <= 2025, q.name);
  }
  // Known facts about the largest earthquakes.
  const quake = (name, year) => m.QUAKES.find(q => q.name.startsWith(name) && q.year === year);
  const top = [...m.QUAKES].sort((a, b) => b.magnitude - a.magnitude);
  assert.equal(top[0], quake('Valdivia', 1960));
  assert.equal(top[0].magnitude, 9.5);
  assert.equal(quake('Prince William Sound', 1964).magnitude, 9.2);
  assert.equal(quake('Sumatra–Andaman', 2004).magnitude, 9.1);
  assert.equal(quake('Tōhoku', 2011).magnitude, 9.1);
  assert.equal(quake('Kamchatka', 1952).magnitude, 9.0);
  assert.equal(quake('San Francisco', 1906).magnitude, 7.9);
  // Every earthquake is close to the boundary it is assigned to; the giant ones are all at convergent boundaries.
  for (const q of m.QUAKES_NEAR) {
    assert.ok(q.km <= m.QUAKE_NEAR_KM, `${q.name}: ${Math.round(q.km)} km from ${q.boundary}`);
    close(q.km, m.distanceToBoundaryKm([q.lon, q.lat], B(q.boundary)));
    if (q.magnitude >= 8.6) assert.equal(type(q.boundary), 'convergent', q.name);
  }
  const at = name => [...m.QUAKES_NEAR, ...m.VOLCANOES_NEAR].find(f => f.name.startsWith(name)).boundary;
  const where = { Valdivia: 'peru-chile', 'San Francisco': 'san-andreas', 'Tōhoku': 'japan', 'Sumatra–Andaman': 'sunda', 'Gorkha': 'himalaya', Haiti: 'caribbean-north', 'Prince William Sound': 'aleutian', 'Kaikōura': 'alpine', 'South Iceland': 'mar-north', 'Kahramanmaraş': 'dead-sea', Guatemala: 'caribbean-north', 'Michoacán': 'middle-america', 'Lake Tanganyika': 'ear-west', 'Kermanshah': 'zagros', 'Great Kantō': 'ryukyu',
    'Mount St. Helens': 'cascadia', 'Mount Fuji': 'mariana', Krakatau: 'sunda', 'Mount Pinatubo': 'manila', Cotopaxi: 'peru-chile', 'Popocatépetl': 'middle-america', Fuego: 'central-america', 'Mount Etna': 'mediterranean', Kilimanjaro: 'ear-east', Nyiragongo: 'ear-west', 'Eyjafjallajökull': 'mar-north', 'Soufrière Hills': 'antilles-north', Ruapehu: 'tonga', Klyuchevskoy: 'japan', Redoubt: 'aleutian', Pico: 'terceira' };
  for (const [name, id] of Object.entries(where)) assert.equal(at(name), id, name);
  // Volcanoes: all near a boundary where plates move apart or together, except the hotspots; none on a transform.
  const hotspots = m.VOLCANOES_NEAR.filter(x => x.hotspot);
  assert.deepEqual(hotspots.map(x => x.name), ['Kīlauea', 'Yellowstone', 'Piton de la Fournaise', 'Cumbre Vieja', 'Fernandina']);
  for (const x of hotspots.slice(0, 4)) assert.ok(x.km > 800, `${x.name} is far from any boundary`);
  for (const x of m.VOLCANOES_NEAR.filter(x => !x.hotspot)) {
    assert.ok(x.km <= m.VOLCANO_NEAR_KM, `${x.name}: ${Math.round(x.km)} km from ${x.boundary}`);
    assert.ok(['divergent', 'convergent'].includes(type(x.boundary)), `${x.name} at ${x.boundary}`);
    assert.ok(!['collision', 'fault', 'fracture', 'zone'].includes(B(x.boundary).kind), `${x.name}: ${x.boundary} is a kind of boundary that makes magma`);
  }
  // Arc volcanoes stand behind their trench, not on it.
  for (const name of ['Cotopaxi', 'Villarrica', 'Mount St. Helens', 'Merapi', 'Popocatépetl', 'Klyuchevskoy']) assert.ok(m.VOLCANOES_NEAR.find(x => x.name === name).km > 150, name);
  // Big volcanoes on big land masses are on land in the Natural Earth outlines.
  for (const name of ['Mount St. Helens', 'Popocatépetl', 'Cotopaxi', 'Villarrica', 'Mount Fuji', 'Mount Etna', 'Kilimanjaro', 'Yellowstone', 'Merapi', 'Ruapehu', 'Klyuchevskoy', 'Nyiragongo', 'Toba']) {
    const x = m.VOLCANOES.find(f => f.name === name);
    assert.ok(onLand([x.lon, x.lat]), `${name} is on land`);
  }
  // The pattern the page reports.
  const e = m.evidence();
  assert.equal(e.quakes.total, m.QUAKES.length);
  assert.equal(e.quakes.near, m.QUAKES.length);
  assert.equal(e.volcanoes.near, m.VOLCANOES.length - hotspots.length);
  assert.deepEqual(e.volcanoes.away.map(x => x.name), hotspots.map(x => x.name));
  assert.equal(e.volcanoes.byType.transform, 0);
  assert.equal(e.volcanoes.byType.zone, 0);
  assert.ok(e.volcanoes.byType.convergent > e.volcanoes.byType.divergent && e.volcanoes.byType.divergent >= 8);
  assert.ok(e.quakes.byType.transform >= 8 && e.quakes.byType.divergent >= 5 && e.quakes.byType.convergent > 30);
  assert.equal(Object.values(e.quakes.byType).reduce((a, b) => a + b), e.quakes.near);
  // No volcano example is assigned to the Himalaya, although earthquakes are.
  assert.equal(m.VOLCANOES_NEAR.filter(x => ['himalaya', 'zagros', 'chaman'].includes(x.boundary)).length, 0);
  assert.ok(m.QUAKES_NEAR.filter(q => q.boundary === 'himalaya').length >= 3);
  for (const f of [...m.QUAKES, ...m.VOLCANOES]) {
    const d = m.describeFeature(f);
    assert.ok(d.title && d.fact && d.text.length > 40 && !/undefined|NaN/.test(d.title + d.fact + d.where + d.text), f.name);
    assert.match(d.where, /about [\d,]+ km from the/i);
  }
  assert.match(m.describeFeature(m.QUAKES.find(q => q.year === 1755)).fact, /estimated/);
  assert.equal(m.describeFeature(hotspots[0]).boundary, null);
});

test('views: the whole world and nine close-ups', () => {
  assert.deepEqual(m.REGION_IDS, ['world', 'pacific', 'atlantic', 'africa', 'himalaya', 'andes', 'california', 'japan', 'indonesia', 'mediterranean']);
  assert.deepEqual(['pacific', 'atlantic', 'africa', 'himalaya'].map(id => m.regionById(id).name), ['Ring of Fire', 'Mid-Atlantic Ridge', 'East African Rift', 'Himalaya']);
  for (const region of m.REGIONS) {
    const [w, e, s, n] = region.bounds;
    assert.ok(w < e && s < n && w >= -180 && e <= 360 && e - w <= 360 && s >= m.WORLD.south && n <= m.WORLD.north, region.id);
    assert.ok(region.text.length > 100 && region.text.endsWith('.'));
    const view = m.inView(region);
    for (const id of region.boundaries) assert.ok(view.boundaries.includes(B(id)), `${region.id} shows ${id}`);
    if (region.id !== 'world') assert.ok(view.quakes.length >= 3, `${region.id} has earthquake examples`);
    // The drawn box holds the region and has the shape asked for.
    for (const minAspect of [1, 1.75]) {
      const aspect = v.aspectFor(region, minAspect), box = v.viewBoxFor(region, aspect);
      assert.ok(aspect >= minAspect - 1e-9 && aspect <= v.VIEW.width / v.VIEW.height + 1e-9);
      close(box.width / box.height, aspect, 1e-2);
      assert.ok(box.x <= w * v.K + 0.06 && box.x + box.width >= e * v.K - 0.06 && box.y <= -n * v.K + 0.06 && box.y + box.height >= -s * v.K - 0.06, `${region.id} fits`);
    }
  }
  const world = m.regionById('world');
  assert.deepEqual(v.viewBoxFor(world), v.VIEW);
  assert.equal(m.inView(world).quakes.length, m.QUAKES.length);
  assert.equal(m.inView(world).volcanoes.length, m.VOLCANOES.length);
  assert.equal(m.inView(world).boundaries.length, m.BOUNDARIES.length);
  // The Ring of Fire view crosses the 180° line and holds both sides of the Pacific.
  const pacific = m.regionById('pacific');
  assert.ok(m.inRegion(pacific, [140, 36]) && m.inRegion(pacific, [-72, -35]) && m.inRegion(pacific, [-175, -20]));
  assert.ok(!m.inRegion(pacific, [0, 50]) && !m.inRegion(pacific, [140, 80]));
  assert.ok(pacific.boundaries.every(id => type(id) === 'convergent'));
  assert.equal(v.lonInView(-73.4, 95), 286.6);
  assert.equal(v.lonInView(140, 95), 140);
  // The Himalaya close-up has earthquakes but no volcano examples inside its bounds.
  assert.equal(m.inView(m.regionById('himalaya')).volcanoes.length, 0);
});

test('drawing and markup', () => {
  const svg = v.mapSvg();
  assert.equal(v.mapSvg(), svg);
  assert.ok(!/NaN|undefined|Infinity/.test(svg));
  assert.ok(svg.length < 140_000, `${svg.length} characters`);
  const pieces = m.BOUNDARIES.flatMap(b => m.splitAtDateLine(b.pts));
  assert.equal((svg.match(/class="pm-b /g) ?? []).length, pieces.length);
  assert.equal((svg.match(/class="pm-hit /g) ?? []).length, pieces.length);
  for (const b of m.BOUNDARIES) assert.ok(svg.includes(`class="pm-b pm-${m.boundaryType(b)}" data-b="${b.id}"`), b.id);
  assert.equal((svg.match(/class="pm-q"/g) ?? []).length, m.QUAKES.length);
  assert.equal((svg.match(/class="pm-v[ "]/g) ?? []).length, m.VOLCANOES.length);
  assert.equal((svg.match(/pm-hotspot/g) ?? []).length, 5);
  assert.equal((svg.match(/class="pm-name[ "]/g) ?? []).length, m.PLATES.reduce((sum, p) => sum + v.plateLabels(p).length, 0));
  assert.equal((svg.match(/ id="/g) ?? []).length, 1);
  assert.equal((svg.match(/<use /g) ?? []).length, 3, 'the land is drawn three times: once more to the west and to the east');
  const thumb = v.mapSvg({ prefix: 'thumb', markers: false });
  assert.ok(thumb.includes('id="thumb-land"') && !thumb.includes('pm-q"') && !/class="pm-name[ "]/.test(thumb) && !thumb.includes('pm-hit '));
  assert.deepEqual(v.VIEW, { x: -540, y: -246, width: 1080, height: 471 });
  assert.equal(v.mapX(-73.4), -220.2);
  assert.equal(v.mapY(-38.1), 114.3);
  // Larger earthquakes get larger dots.
  const radius = name => Number(svg.match(new RegExp(`data-f="${m.QUAKES.find(q => q.name.startsWith(name)).id}"[^>]*><circle class="pm-touch" r="11"/><circle class="pm-dot" r="([\\d.]+)"`))[1]);
  assert.ok(radius('Valdivia') > radius('San Francisco') && radius('San Francisco') > radius('Loma Prieta'));
  assert.match(v.describeMap(), /15 tectonic plates/);
  // Panels.
  const world = m.regionById('world');
  const overview = v.regionHtml(world);
  assert.ok(overview.includes(`All ${m.QUAKES.length} earthquake examples lie within ${m.QUAKE_NEAR_KM} km`));
  assert.ok(overview.includes(`${m.VOLCANOES.length - 5} of the ${m.VOLCANOES.length} volcano examples lie within ${m.VOLCANO_NEAR_KM} km`));
  assert.ok(!v.regionHtml(m.regionById('andes')).includes('pm-evidence'));
  const saf = v.boundaryHtml(B('san-andreas'));
  assert.ok(saf.includes('Transform boundary: plates slide past each other') && saf.includes('Between the Pacific Plate and the North American Plate.'));
  assert.ok(saf.includes('href="/tools/plate-tectonics/?type=transform&plates=cc"'));
  assert.ok(v.boundaryHtml(B('peru-chile')).includes('the Nazca Plate sinks under the South American Plate'));
  assert.ok(!v.boundaryHtml(B('ne-asia')).includes('href='));
  assert.ok(v.plateHtml(m.plateById('nazca')).includes('Neighbors on this map'));
  assert.ok(v.featureHtml(m.QUAKES[0]).includes('Magnitude 9.5'));
  // The lists follow the layers.
  const count = (html, attr) => (html.match(new RegExp(attr, 'g')) ?? []).length;
  const all = v.listHtml(world, m.LAYERS);
  assert.equal(count(all, 'data-pick-b='), m.BOUNDARIES.length);
  assert.equal(count(all, 'data-pick-f='), m.QUAKES.length + m.VOLCANOES.length);
  assert.equal(count(all, 'data-pick-p='), m.PLATES.length);
  const some = v.listHtml(world, ['divergent']);
  assert.equal(count(some, 'data-pick-b='), m.boundariesOfType('divergent').length + m.boundariesOfType('zone').length);
  assert.equal(count(some, 'data-pick-f=') + count(some, 'data-pick-p='), 0);
  assert.ok(v.listHtml(world, m.LAYERS, { disabled: true }).includes(' disabled') && !all.includes(' disabled'));
  assert.equal(count(v.legendHtml(), '<li>'), m.TYPES.length + 2);
});

test('share links round-trip and explain bad values', () => {
  assert.deepEqual(m.parseMapState(''), { state: m.DEFAULT_STATE, notes: [] });
  assert.deepEqual(m.parseMapState('?classroom=1').notes, []);
  assert.deepEqual(m.DEFAULT_LAYERS, ['divergent', 'convergent', 'transform', 'names']);
  for (const region of m.REGION_IDS) for (const layers of [m.LAYERS, [], ['quakes'], ['convergent', 'volcanoes', 'names']]) {
    const query = m.serializeMapState({ mode: 'explore', region, layers });
    const { state, notes } = m.parseMapState('?' + query);
    assert.deepEqual(notes, [], query);
    assert.equal(state.region, region);
    assert.deepEqual(state.layers, m.LAYERS.filter(layer => layers.includes(layer)));
    assert.equal(state.mode, 'explore');
  }
  assert.equal(m.serializeMapState({ mode: 'explore', region: 'himalaya', layers: ['volcanoes', 'convergent', 'quakes'] }), 'region=himalaya&show=convergent,quakes,volcanoes');
  assert.equal(m.serializeMapState({ mode: 'challenge', region: 'himalaya', layers: [] }), 'mode=challenge');
  assert.equal(m.serializeMapState({ mode: 'explore', region: 'atlantis', layers: ['dragons', 'names'] }), 'region=world&show=names');
  assert.equal(m.parseMapState('?mode=challenge').state.mode, 'challenge');
  assert.deepEqual(m.parseMapState('?show=').state.layers, [], 'an empty list hides every layer');
  assert.deepEqual(m.parseMapState('?show=quakes%2Cvolcanoes').state.layers, ['quakes', 'volcanoes']);
  const bad = m.parseMapState('?mode=fly&region=atlantis&show=dragons,quakes');
  assert.deepEqual(bad.state, { mode: 'explore', region: 'world', layers: ['quakes'] });
  assert.equal(bad.notes.length, 3);
  for (const note of bad.notes) assert.ok(note.length > 30 && note.endsWith('.') && !/undefined|NaN/.test(note), note);
  assert.match(m.parseMapState('?region=' + 'x'.repeat(200)).notes[0], /…/);
});

test('challenge: every answer is read from the map’s data', () => {
  assert.ok(m.CHALLENGE.length >= 6 && m.CHALLENGE.length <= 8);
  for (const q of m.CHALLENGE) {
    assert.ok(q.choices.includes(q.answer), q.prompt);
    assert.equal(new Set(q.choices).size, q.choices.length);
    assert.ok(q.prompt.endsWith('?') && q.explain.length > 60 && q.explain.endsWith('.'));
    assert.ok(m.regionById(q.region), q.region);
    if (q.show) assert.ok(m.inView(m.regionById(q.region)).boundaries.includes(B(q.show)), `${q.show} is in the ${q.region} view`);
    for (const layer of q.layers ?? []) assert.ok(m.LAYERS.includes(layer));
    for (const choice of q.choices) assert.ok(m.choiceLabel(q, choice).length > 8, choice);
    if (q.kind === 'type') {
      assert.equal(q.answer, type(q.show));
      assert.deepEqual(q.choices, ['divergent', 'convergent', 'transform']);
      assert.ok(q.explain.toLowerCase().includes(q.answer));
      assert.ok(!q.prompt.toLowerCase().includes(q.answer), 'the question does not give the answer away');
    }
    if (q.kind === 'plates') {
      assert.equal(q.answer, q.show);
      assert.equal(new Set(q.choices.map(c => [...B(c).plates].sort().join())).size, q.choices.length, 'four different pairs of plates');
      assert.equal(m.choiceLabel(q, q.answer), 'The Indo-Australian Plate and the Eurasian Plate');
    }
  }
  assert.deepEqual(m.CHALLENGE.filter(q => q.kind === 'type').map(q => q.answer), ['divergent', 'convergent', 'transform', 'divergent']);
  const none = m.CHALLENGE.find(q => q.prompt.includes('has none of them'));
  assert.equal(none.answer, 'transform');
  assert.equal(m.evidence().volcanoes.byType[none.answer], 0);
  for (const other of none.choices.filter(c => c !== none.answer)) assert.ok(m.evidence().volcanoes.byType[other] > 0);
  const himalaya = m.CHALLENGE.find(q => q.prompt.includes('no volcanoes on this map'));
  assert.equal(himalaya.answer, 'collision');
  assert.equal(B(himalaya.show).kind, 'collision');
  assert.equal(m.VOLCANOES_NEAR.filter(x => x.boundary === himalaya.show).length, 0);
  assert.ok(m.QUAKES_NEAR.filter(q => q.boundary === himalaya.show).length > 0);
  assert.equal(m.CHALLENGE.find(q => q.prompt.startsWith('Kīlauea')).answer, 'hotspot');
});

// Numbers that belong to the questions' own wording rather than to a model output.
const CONSTANTS = new Set([]);
const NUMBER = /\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g;
const value = printed => Number(printed.replace(/,/g, ''));

test('activity: the table and every printed number come from the map’s data', () => {
  assert.equal(act.tool, 'plate-map');
  assert.equal(act.rows.length, ROWS.length);
  act.rows.forEach(([label, values], i) => {
    assert.equal(label, ROWS[i].label);
    assert.deepEqual(values, mapRow(ROWS[i]));
    for (const id of ROWS[i].boundaries) assert.ok(m.regionById(ROWS[i].region).boundaries.includes(id), `${id} is highlighted in the ${ROWS[i].region} view`);
    assert.equal(values['Boundary type'], m.TYPE_LABELS[type(ROWS[i].boundaries[0])]);
    assert.equal(new Set(ROWS[i].boundaries.map(type)).size, 1, 'one type per row');
  });
  assert.deepEqual(act.rows.map(([, r]) => r['Boundary type']), ['Divergent', 'Divergent', 'Convergent', 'Convergent', 'Transform']);
  assert.deepEqual(act.rows.map(([, r]) => r['Volcanoes along it?']), ['Yes', 'Yes', 'No', 'Yes', 'No']);
  assert.equal(act.rows[3][1]['Largest earthquake example'], 'Valdivia, Chile, 1960 (M9.5)');
  assert.equal(act.rows[4][1]['Largest earthquake example'], 'San Francisco, California, 1906 (M7.9)');
  assert.equal(act.rows[4][1]['Plates that meet'], 'Pacific, North American');
  for (const col of act.record) for (const [, values] of act.rows) assert.ok(values[col], col);
  for (const block of [...act.questions, act.extraAnswer]) {
    const checked = new Set();
    for (const [printed, model] of block.checks ?? []) {
      // Distances are printed to the nearest 10 km.
      const tolerance = block.tolerance ?? (printed === String(Math.round(model)) ? 0.5 : 5);
      assert.ok(Math.abs(value(printed) - model) <= tolerance + 1e-9, `printed ${printed} vs model ${model}`);
      checked.add(printed);
    }
    for (const number of block.a.match(NUMBER) ?? []) assert.ok(checked.has(number) || CONSTANTS.has(number), `unchecked number ${number} in: ${block.a}`);
  }
  assert.ok(act.questions[1].a.startsWith('The Himalaya and the San Andreas Fault.'));
  assert.ok(act.questions[2].a.includes('Peru–Chile Trench') && act.questions[2].a.includes('They are all convergent boundaries'));
  const kilauea = m.VOLCANOES_NEAR.find(x => x.name === 'Kīlauea');
  assert.ok(act.extraAnswer.a.includes(`${(Math.round(kilauea.km / 10) * 10).toLocaleString('en-US')} km`));
});

test('activity metadata, standards and registration', () => {
  assert.equal(act.questions.length, 6);
  assert.equal(act.minutes, 15);
  assert.equal(act.grade, 'Grades 6–10');
  assert.equal(act.toolName, 'Plate Boundaries Map');
  assert.deepEqual(act.standards, ['MS-ESS2-3', 'MS-ESS3-2']);
  for (const code of act.standards) assert.ok(allStandards[code]?.length > 40, code);
  assert.match(allStandards['MS-ESS2-3'], /seafloor structures/);
  assert.match(allStandards['MS-ESS3-2'], /natural hazards/);
  assert.ok(activities.includes(act), 'registered in activities.mjs');
  assert.equal(activities.filter(a => a.tool === 'plate-map').length, 1);
  assert.ok(act.rowHeader && act.keyNote && act.extra && act.goal);
  assert.equal(act.steps.length, 4);
  for (const field of ['tool', 'toolName', 'title', 'grade', 'minutes', 'standards', 'goal', 'steps', 'record', 'rows', 'extra', 'extraAnswer', 'questions']) assert.ok(field in act, field);
  for (const q of act.questions) { assert.ok(q.q.endsWith('?') || q.q.endsWith('.'), q.q); assert.ok(q.a.length > 40 && q.lines >= 2); }
});
