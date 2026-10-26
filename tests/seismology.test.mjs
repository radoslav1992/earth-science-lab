import test from 'node:test';
import assert from 'node:assert/strict';
import * as s from '../src/lib/seismology.mjs';
import { traceSamples, traceSeed } from '../src/lib/seismogram.mjs';

const close = (actual, expected, tolerance, message) => assert.ok(Math.abs(actual - expected) <= tolerance, `${message ?? ''} ${actual} ≉ ${expected} (±${tolerance})`);

test('the 8.4 rule follows from the wave speeds', () => {
  assert.equal(s.VP, 6.0);
  assert.equal(s.VS, 3.5);
  close(s.KM_PER_SECOND_LAG, 8.4, 1e-12);
  close(s.LAG_PER_KM, 1 / 3.5 - 1 / 6, 1e-15);
});

test('distance and S–P lag convert both ways', () => {
  for (const km of [0, 1, 8.4, 50, 162.25, 318, 577.4]) close(s.distanceFromLag(s.lagFromDistance(km)), km, 1e-9, `${km} km`);
  for (const lag of [0, 1, 13.8, 37.9]) close(s.lagFromDistance(s.distanceFromLag(lag)), lag, 1e-9, `${lag} s`);
  close(s.distanceFromLag(10), 84, 1e-9);
  const a = s.arrivals(84, 10);
  close(a.p, 10 + 84 / 6, 1e-12);
  close(a.s, 10 + 84 / 3.5, 1e-12);
  close(a.s - a.p, 10, 1e-12, 'lag of 84 km');
});

test('every reading of every scenario fits on the 200 s record', () => {
  for (let seed = 1; seed <= 300; seed++) {
    for (const r of s.readings(s.scenario(seed))) assert.ok(r.p > 0 && r.s < s.RECORD_SECONDS - 10, `seed ${seed} ${r.station.code}`);
  }
  for (const [x, y] of [[0, 0], [600, 0], [0, 400], [600, 400]]) {
    for (const r of s.readings({ ...s.EXPLORE_DEFAULT, quake: { x, y } })) assert.ok(r.s < s.RECORD_SECONDS, `corner ${x},${y}`);
  }
});

test('trilateration recovers an exact epicenter', () => {
  for (const quake of [s.GUIDED.quake, { x: 450, y: 60 }, { x: 40, y: 380 }, { x: 300, y: 200 }]) {
    const circles = s.STATIONS.map(st => ({ x: st.x, y: st.y, r: s.distance(st, quake) }));
    const fit = s.trilaterate(circles);
    close(fit.x, quake.x, 1e-6, 'x');
    close(fit.y, quake.y, 1e-6, 'y');
    close(fit.rms, 0, 1e-6, 'rms');
    const tri = s.errorTriangle(circles, quake);
    close(tri.size, 0, 1e-6, 'error triangle');
  }
  assert.equal(s.trilaterate([{ x: 0, y: 0, r: 1 }, { x: 1, y: 0, r: 1 }]), null, 'two circles are not enough');
});

test('trilateration with noisy distances stays close and reports the misfit', () => {
  const rand = s.mulberry32(99);
  for (let trial = 0; trial < 200; trial++) {
    const { quake } = s.scenario(1000 + trial);
    const circles = s.STATIONS.map(st => ({ x: st.x, y: st.y, r: s.distance(st, quake) + (rand() * 2 - 1) * 4 }));
    const fit = s.trilaterate(circles);
    assert.ok(s.distance(fit, quake) < 25, `trial ${trial}: ${s.distance(fit, quake).toFixed(1)} km`);
    assert.ok(fit.rms <= 4 + 1e-9, `trial ${trial}: rms ${fit.rms}`);
  }
  // The guided quake read to 0.1 s (what a careful student gets) lands within a kilometer.
  const read = s.readings(s.GUIDED).map(r => ({ x: r.station.x, y: r.station.y, r: s.picked(r).km }));
  const fit = s.trilaterate(read);
  assert.ok(s.distance(fit, s.GUIDED.quake) < 1);
  assert.ok(s.errorTriangle(read, fit).size < 5);
});

test('circle intersections and the error triangle', () => {
  const hits = s.circleIntersections({ x: 0, y: 0, r: 5 }, { x: 8, y: 0, r: 5 });
  assert.equal(hits.length, 2);
  for (const p of hits) { close(p.x, 4, 1e-9); close(Math.abs(p.y), 3, 1e-9); }
  assert.deepEqual(s.circleIntersections({ x: 0, y: 0, r: 1 }, { x: 5, y: 0, r: 1 }), []);
  // Circles that miss still produce a triangle near the true point.
  const tri = s.errorTriangle([{ x: 0, y: 0, r: 4.9 }, { x: 10, y: 0, r: 4.9 }, { x: 5, y: 10, r: 9.8 }], { x: 5, y: 0 });
  assert.equal(tri.points.length, 3);
  assert.ok(tri.size < 1);
});

test('local magnitude spot values and inverse', () => {
  // ML = log10(A) + 3·log10(8·Δt) − 2.92
  close(s.localMagnitude(1, 1), 3 * Math.log10(8) - 2.92, 1e-12);
  close(s.localMagnitude(10, 10), 1 + 3 * Math.log10(80) - 2.92, 1e-12);
  close(s.localMagnitude(10, 10), 3.789, 0.001, 'A = 10 mm, Δt = 10 s');
  close(s.localMagnitude(100, 25), 5.983, 0.001, 'A = 100 mm, Δt = 25 s');
  close(s.localMagnitude(1, 5), 1.886, 0.001, 'A = 1 mm, Δt = 5 s');
  close(s.localMagnitude(15.5, 16.1), 4.6, 0.01, 'worksheet example');
  for (const m of [2.5, 4.6, 7]) for (const lag of [5, 20, 60]) close(s.localMagnitude(s.amplitudeFor(m, lag), lag), m, 1e-9);
});

test('seeded scenarios are deterministic, in range and away from stations', () => {
  assert.deepEqual(s.scenario(4821), s.scenario(4821));
  assert.notDeepEqual(s.scenario(1), s.scenario(2));
  assert.deepEqual(s.scenario(1), { seed: 1, quake: { x: 366, y: 31 }, magnitude: 4.3, origin: 19.8 });
  for (let seed = 1; seed <= 500; seed++) {
    const sc = s.scenario(seed);
    assert.ok(sc.quake.x >= 40 && sc.quake.x <= 560 && sc.quake.y >= 30 && sc.quake.y <= 370, `seed ${seed} position`);
    assert.ok(s.STATIONS.every(st => s.distance(st, sc.quake) >= 35), `seed ${seed} too close to a station`);
    assert.ok(sc.magnitude >= 3 && sc.magnitude <= 5.5 && sc.origin >= 8 && sc.origin <= 20, `seed ${seed} ranges`);
  }
  const rounds = [0, 1, 2].map(i => s.roundSeed(4821, i));
  assert.equal(new Set(rounds).size, 3);
  assert.deepEqual(rounds, [0, 1, 2].map(i => s.roundSeed(4821, i)));
  assert.equal(s.roundScore(0), 100);
  assert.equal(s.roundScore(12.4), 88);
  assert.equal(s.roundScore(250), 0);
});

test('a careful reading rounds times to 0.1 s and subtracts them', () => {
  const r = { p: 40.52, s: 62.31 };
  assert.deepEqual(s.picked(r), { p: 40.5, s: 62.3, lag: 21.8, km: s.distanceFromLag(21.8) });
});

test('synthetic seismograms are deterministic and quiet before the P wave', () => {
  const [ash] = s.readings(s.GUIDED);
  const a = traceSamples({ p: ash.p, s: ash.s, seed: traceSeed(1, 0) });
  const b = traceSamples({ p: ash.p, s: ash.s, seed: traceSeed(1, 0) });
  assert.deepEqual(a, b);
  const at = t => Math.round(t / 0.2);
  const peak = (from, to) => Math.max(...a.slice(at(from), at(to)).map(Math.abs));
  assert.ok(peak(0, ash.p - 1) < 0.15, 'noise before P is small');
  assert.ok(peak(ash.p, ash.s - 1) > peak(0, ash.p - 1) * 2, 'P burst stands out');
  assert.ok(peak(ash.s, ash.s + 15) > peak(ash.p, ash.s - 1) * 1.5, 'S burst is bigger than P');
  close(Math.max(...a.map(Math.abs)), 0.95, 1e-9, 'normalized peak');
});
