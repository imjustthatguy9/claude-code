'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { matchGuess, editDistance, normalize, findDuplicates } = require('../src/engine');

const answers = {
  plankton: ['Apple', 'Banana'],
  clever: ['Strawberry'],
  schooler: ['Grape | Grapes'],
  rare: ['Kiwi'],
  deepcut: ['Dragon fruit | Pitaya'],
  nichion: ['Durian', 'Starfruit | Carambola', 'New York City | NYC'],
};

test('exact and case/punctuation-insensitive matches', () => {
  assert.equal(matchGuess('apple', answers).tier, 'plankton');
  assert.equal(matchGuess('  APPLE!! ', answers).tier, 'plankton');
  assert.equal(matchGuess('The Durian', answers).tier, 'nichion');
  assert.equal(matchGuess('dragonfruit', answers).tier, 'deepcut');
  assert.equal(matchGuess('apple', answers).corrected, false);
});

test('aliases and plurals', () => {
  const m = matchGuess('pitaya', answers);
  assert.equal(m.tier, 'deepcut');
  assert.equal(m.display, 'Dragon fruit');
  assert.equal(matchGuess('nyc', answers).display, 'New York City');
  assert.equal(matchGuess('bananas', answers).tier, 'plankton');
  assert.equal(matchGuess('kiwis', answers).tier, 'rare');
});

test('auto-corrects small typos', () => {
  const m = matchGuess('strawbery', answers);
  assert.equal(m.tier, 'clever');
  assert.equal(m.corrected, true);
  assert.equal(matchGuess('duraian', answers).tier, 'nichion');
  assert.equal(matchGuess('carambolla', answers).tier, 'nichion');
  assert.equal(matchGuess('kiwj', answers).tier, 'rare');           // 1 typo on 4 letters
  assert.equal(matchGuess('strwabrery', answers).tier, 'clever');   // transposition + typo
});

test('does not over-correct', () => {
  assert.equal(matchGuess('pear', answers), null);
  assert.equal(matchGuess('grapefruit', answers), null);
  assert.equal(matchGuess('kw', answers), null);
  assert.equal(matchGuess('', answers), null);
  assert.equal(matchGuess('!!!', answers), null);
});

test('exact match beats a fuzzy match in a deeper tier', () => {
  const a = { plankton: ['Cat'], nichion: ['Cats eye'] , rare: ['Mace'], deepcut: ['Maze'] };
  assert.equal(matchGuess('maze', a).tier, 'deepcut');
  assert.equal(matchGuess('mace', a).tier, 'rare');
});

test('helpers', () => {
  assert.equal(editDistance('kitten', 'sitting'), 3);
  assert.equal(editDistance('ab', 'ba'), 1);
  assert.equal(normalize('Crème Brûlée'), 'creme brulee');
  assert.equal(findDuplicates({ plankton: ['Apple'], rare: ['apple'] }).length, 1);
  assert.equal(findDuplicates({ rare: ['Iran'], deepcut: ['Iraq'] }).length, 0, 'different short answers are not merged');
});

test('a guess that contains the answer (with only a little extra) counts', () => {
  const A = {
    nichion: ['fox', 'Golden Retriever', 'dragonfruit'], deepcut: ['retriever', 'cat'], rare: ['Mars'],
    schooler: ['dog'], clever: ['Go'], plankton: ['New York City | NYC'],
  };
  const hit = (g, display) => {
    const m = matchGuess(g, A);
    assert.ok(m, `${g} should match`);
    assert.equal(m.display, display, g);
    assert.equal(m.corrected, true);
  };
  hit('red fox', 'fox');
  hit('the planet mars', 'Mars');
  hit('i think its a golden retriever', 'Golden Retriever');
  hit('golden retreiver puppy', 'Golden Retriever');       // typo + extra
  hit('dragon fruit smoothie', 'dragonfruit');
  hit('nyc baby', 'New York City');
  assert.equal(matchGuess('red fox', A).contained, true);
  // Not matched:
  for (const g of ['cat dog', 'cat and a dog', 'catfish', 'go fish', 'big fluffy orange fox', 'mars bar chocolate']) {
    assert.equal(matchGuess(g, A), null, g);
  }
  // A direct match always wins over "contains".
  assert.equal(matchGuess('retriever', A).tier, 'deepcut');
});

test('auto-correct only when the guess is close to exactly one answer', () => {
  const { matchDetailed } = require('../src/engine');
  const A = { nichion: ['Australia', 'fox'], deepcut: ['Austria', 'cat'], rare: ['Iraq'], schooler: ['Iran', 'dog'], clever: [], plankton: [] };
  const amb = g => { const r = matchDetailed(g, A); assert.equal(r.match, null, g); assert.ok(r.ambiguous && r.ambiguous.length >= 2, g); };
  amb('Irak');            // Iraq or Iran?
  amb('Austrlia');        // Australia or Austria?
  amb('cat dog');         // contains two answers
  amb('red fox and cat');
  // Exact always counts, even when another answer is one letter away.
  assert.equal(matchDetailed('iraq', A).match.display, 'Iraq');
  assert.equal(matchDetailed('Austria', A).match.display, 'Austria');
  // Close to only one: still auto-corrected.
  assert.equal(matchDetailed('Austrailia', A).match.display, 'Australia');
  assert.equal(matchDetailed('a red fox', A).match.display, 'fox');
});

test('players are told a guess is ambiguous, never which answers', () => {
  const E = require('../src/engine');
  const salt = 's', D = '2026-03-10';
  const data = { salt, days: { [D]: E.encodeDay(salt, D, [{ text: 'Q', answers: { rare: ['Iraq'], schooler: ['Iran'] } }]) } };
  let v = null;
  const g = new E.Game(data, { get: () => v, set: x => { v = x; } }, () => new Date(2026, 2, 10, 12));
  const r = g.guess({ date: D, index: 0, guess: 'Irak' });
  assert.equal(r.invalid, true);
  assert.equal(r.ambiguous, true);
  assert.ok(!JSON.stringify(r).includes('Iran') && !JSON.stringify(r).includes('Iraq'));
});
