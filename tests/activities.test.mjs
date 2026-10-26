import test from 'node:test';
import assert from 'node:assert/strict';
import { activities, standards } from '../src/lib/activities.mjs';
import * as s from '../src/lib/seismology.mjs';

const act = activities.find(a => a.tool === 'earthquake-epicenter');
// Numbers that belong to the formulas themselves rather than to a model output.
const CONSTANTS = new Set(['1', '3', '8', '0.1', '2.92', '3.5', '6.0', '8.4']);

test('worksheet table equals the model read to 0.1 s', () => {
  const guided = s.readings(s.GUIDED);
  assert.equal(act.rows.length, guided.length);
  act.rows.forEach(([name, values], i) => {
    const r = guided[i], read = s.picked(r);
    assert.equal(name, r.station.name);
    assert.equal(values['P arrives (s)'], read.p.toFixed(1));
    assert.equal(values['S arrives (s)'], read.s.toFixed(1));
    assert.equal(values['S–P lag (s)'], read.lag.toFixed(1));
    assert.equal(Number(values['S–P lag (s)']), s.round(Number(values['S arrives (s)']) - Number(values['P arrives (s)']), 1), 'lag is S minus P as printed');
    assert.equal(values['Distance (km)'], String(Math.round(Number(values['S–P lag (s)']) * 8.4)));
    assert.ok(Math.abs(read.p - r.p) <= 0.05 && Math.abs(read.s - r.s) <= 0.05, 'readings are the true arrivals rounded');
    assert.ok(Math.abs(read.km - r.distance) < 1.5, `${name}: 8.4 rule within 1.5 km of the true distance`);
  });
  for (const col of act.record) for (const [, values] of act.rows) assert.ok(values[col], col);
});

test('every printed answer number matches the model within its rounding', () => {
  const blocks = [...act.questions.filter(q => q.a), act.extraAnswer];
  for (const block of blocks) {
    const checked = new Set();
    for (const [printed, value] of block.checks ?? []) {
      const decimals = (printed.split('.')[1] ?? '').length;
      assert.ok(Math.abs(Number(printed) - value) <= 0.5 * 10 ** -decimals + 1e-9, `printed ${printed} vs model ${value}`);
      checked.add(printed);
    }
    // No number in an answer may skip the check: each is either checked above or a formula constant.
    for (const number of block.a.match(/\d+(?:\.\d+)?/g) ?? []) {
      assert.ok(checked.has(number) || CONSTANTS.has(number), `unchecked number ${number} in: ${block.a}`);
    }
  }
});

test('the magnitude question reproduces the guided magnitude', () => {
  const cdr = s.readings(s.GUIDED)[2];
  const m = s.localMagnitude(s.round(cdr.amplitude, 1), s.picked(cdr).lag);
  assert.equal(m.toFixed(1), s.GUIDED.magnitude.toFixed(1));
  assert.ok(act.questions[5].q.includes(s.round(cdr.amplitude, 1).toFixed(1)));
});

test('activity metadata', () => {
  assert.equal(act.questions.length, 6);
  assert.ok(act.minutes >= 10 && act.minutes <= 15);
  assert.equal(act.grade, 'Grades 6–10');
  for (const code of act.standards) assert.ok(standards[code], code);
  assert.deepEqual(act.standards, ['MS-ESS3-2']);
});
