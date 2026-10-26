import test from 'node:test';
import assert from 'node:assert/strict';
import { parseState, serializeState } from '../src/lib/share-state.mjs';

test('defaults with no query', () => {
  assert.deepEqual(parseState(''), { state: { mode: 'guided', seed: null, snap: null, quake: null, magnitude: null }, notes: [] });
  assert.deepEqual(parseState('?classroom=1').notes, [], 'unrelated parameters are ignored');
});

test('round trip: challenge, guided and explore', () => {
  const cases = [
    { mode: 'challenge', seed: 4821, snap: false, quake: null, magnitude: null },
    { mode: 'guided', seed: null, snap: true, quake: null, magnitude: null },
    { mode: 'explore', seed: null, snap: null, quake: { x: 320, y: 150 }, magnitude: 5.2 },
  ];
  for (const state of cases) {
    const query = serializeState(state);
    const { state: back, notes } = parseState('?' + query);
    assert.deepEqual(notes, [], query);
    assert.equal(back.mode, state.mode);
    if (state.mode === 'challenge') assert.equal(back.seed, state.seed);
    if (state.mode !== 'explore') assert.equal(back.snap, state.snap);
    if (state.mode === 'explore') { assert.deepEqual(back.quake, state.quake); assert.equal(back.magnitude, state.magnitude); }
  }
  assert.equal(serializeState(cases[0]), 'mode=challenge&seed=4821&snap=0');
  assert.equal(serializeState(cases[2]), 'mode=explore&x=320&y=150&m=5.2');
  assert.equal(serializeState({ mode: 'explore', quake: { x: 320.6, y: 149.2 }, magnitude: 4.55 }), 'mode=explore&x=321&y=149&m=4.5');
});

test('invalid values fall back with a friendly note each', () => {
  const { state, notes } = parseState('?mode=volcano&seed=abc&snap=maybe&x=900&y=10&m=12');
  assert.deepEqual(state, { mode: 'guided', seed: null, snap: null, quake: null, magnitude: null });
  assert.equal(notes.length, 5);
  for (const note of notes) assert.ok(note.length > 20 && !/undefined|NaN/.test(note), note);
  assert.equal(parseState('?seed=0').notes.length, 1);
  assert.equal(parseState('?seed=1000000').notes.length, 1);
  assert.equal(parseState('?seed=12.5').notes.length, 1);
  assert.equal(parseState('?x=100').notes.length, 1, 'x without y');
  assert.equal(parseState('?m=').notes.length, 1, 'empty magnitude');
  assert.equal(parseState('?x=0&y=400&m=2.5').notes.length, 0, 'edges are valid');
});
