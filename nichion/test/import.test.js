'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { parseQuestionText, promptToText } = require('../src/engine');

test('the example format', () => {
  const [q, ...rest] = parseQuestionText('animals\n\nfox\n\ncat\nmouse\nsnail\n\ndog\ncricket\nant\n');
  assert.equal(rest.length, 0);
  assert.equal(q.text, 'animals');
  assert.deepEqual(q.answers.nichion, ['fox']);
  assert.deepEqual(q.answers.deepcut, ['cat', 'mouse', 'snail']);
  assert.deepEqual(q.answers.rare, ['dog', 'cricket', 'ant']);
  assert.deepEqual(q.answers.schooler, []);
  assert.deepEqual(q.answers.plankton, []);
  assert.deepEqual(q.warnings, []);
});

test('all six tiers, Windows newlines, extra blank lines, bullets, aliases', () => {
  const t = 'Name a fruit\r\n\r\n\r\n- Durian | Stinky fruit\r\n\r\nLychee\r\n\r\n1. Kiwi\r\n2. Fig\r\n\r\nMango\r\n\r\nGrape\r\n\r\n• Apple\r\n   \r\n';
  const [q] = parseQuestionText(t);
  assert.equal(q.text, 'Name a fruit');
  assert.deepEqual(q.answers, {
    plankton: ['Apple'], clever: ['Grape'], schooler: ['Mango'], rare: ['Kiwi', 'Fig'],
    deepcut: ['Lychee'], nichion: ['Durian | Stinky fruit'],
  });
});

test('"-" skips a tier, "---" separates questions, extras warn', () => {
  const qs = parseQuestionText('Q1\n\nfox\n\n-\n\ndog\n---\nQ2\n\na\n\nb\n\nc\n\nd\n\ne\n\nf\n\ng');
  assert.equal(qs.length, 2);
  assert.deepEqual(qs[0].answers.deepcut, []);
  assert.deepEqual(qs[0].answers.rare, ['dog']);
  assert.deepEqual(qs[1].answers.plankton, ['f']);
  assert.match(qs[1].warnings[0], /1 extra group/);
});

test('warns on duplicates and on missing answers; round-trips', () => {
  const dup = parseQuestionText('Q\n\ncat\n\nCats\ndog')[0];
  assert.deepEqual(dup.answers.deepcut, ['dog'], 'the shallower copy is removed');
  assert.match(dup.notes[0], /“Cats” removed from Deep Cut — kept as “cat” in Nichion/);
  assert.match(parseQuestionText('Just a question')[0].warnings[0], /No answers/);
  const [q] = parseQuestionText('animals\n\nfox\n\n-\n\ndog\nant');
  assert.equal(promptToText(q), 'animals\n\nfox\n\n[]\n\ndog\nant');
});

test('dedupe keeps the deepest copy, handles near-duplicates and aliases', () => {
  const { dedupeAnswers } = require('../src/engine');
  const { answers, removed } = dedupeAnswers({
    nichion: ['fox'], deepcut: ['Foxes', 'cat', 'Colombia'], rare: ['Cat', 'dog', 'Iraq', 'Columbia'],
    schooler: ['Iran', 'New York City | NYC'], clever: ['dog', 'nyc | Big Apple'], plankton: ['Mars', 'Mary', 'Mars'],
  });
  assert.deepEqual(answers, {
    nichion: ['fox'], deepcut: ['cat', 'Colombia'], rare: ['dog', 'Iraq'],
    schooler: ['Iran', 'New York City | NYC'], clever: ['Big Apple'], plankton: ['Mars', 'Mary'],
  });
  assert.equal(removed.length, 6);
});

test('[] means a tier with nothing in it', () => {
  const [q] = parseQuestionText('animals\n\n[]\n\ncat\nmouse\n\n[ ]\n\n[]\n\nant');
  assert.deepEqual(q.answers.nichion, []);
  assert.deepEqual(q.answers.deepcut, ['cat', 'mouse']);
  assert.deepEqual(q.answers.rare, []);
  assert.deepEqual(q.answers.schooler, []);
  assert.deepEqual(q.answers.clever, ['ant']);
  assert.deepEqual(q.answers.plankton, []);
  assert.deepEqual(q.warnings, []);
  // A stray [] mixed into a group is ignored rather than becoming an answer.
  assert.deepEqual(parseQuestionText('Q\n\nfox\n[]\nwolf')[0].answers.nichion, ['fox', 'wolf']);
  // Round trip writes [] for empty tiers in the middle.
  assert.equal(promptToText(q), 'animals\n\n[]\n\ncat\nmouse\n\n[]\n\n[]\n\nant');
});

test('descriptions: *( ) is parsed off the answer and kept through cleanup', () => {
  const E = require('../src/engine');
  const [q] = E.parseQuestionText('animals\n\nfox *(sly one)\ncat | kitty *(feline friend)\n\n[]\n\n[]\n\n[]\n\nowl *(wise)\n\nCats');
  assert.deepEqual(q.answers.nichion, ['fox *(sly one)', 'cat | kitty *(feline friend)']);
  assert.deepEqual(q.answers.clever, ['owl *(wise)']);
  assert.deepEqual(q.answers.plankton, [], 'Cats is a duplicate of cat (Nichion)');
  assert.deepEqual(q.warnings, []);
  const m = E.matchGuess('kitty', q.answers);
  assert.equal(m.display, 'cat');
  assert.equal(m.desc, 'feline friend');
  assert.equal(E.matchGuess('sly one', q.answers), null, 'the description is not an answer');
  assert.equal(E.matchGuess('owl', q.answers).desc, 'wise');
  // Other tiers: parsed out of the answer, flagged, never shown.
  const [r] = E.parseQuestionText('Q\n\n[]\n\n[]\n\ndog *(good boy)');
  assert.match(r.warnings[0], /Rare has 1 description/);
  assert.equal(E.matchGuess('dog', r.answers).desc, null);
});

test('descriptions reach the player and the yesterday sheet', () => {
  const E = require('../src/engine');
  const salt = 's';
  const prompts = [{ text: 'animals', answers: { nichion: ['fox *(sly one)'], clever: ['owl'], plankton: ['dog'], schooler: [], rare: [], deepcut: [] } }];
  const data = { salt, days: { '2026-03-09': E.encodeDay(salt, '2026-03-09', prompts), '2026-03-10': E.encodeDay(salt, '2026-03-10', prompts) } };
  let v = null; const store = { get: () => v, set: x => { v = JSON.parse(JSON.stringify(x)); } };
  const g = new E.Game(data, store, () => new Date(2026, 2, 10, 12));
  assert.equal(g.guess({ date: '2026-03-10', index: 0, guess: 'fox' }).desc, 'sly one');
  const y = g.yesterday();
  const nich = y.prompts[0].tiers.find(t => t.key === 'nichion');
  assert.deepEqual(nich.answers, ['fox']);
  assert.deepEqual(nich.descs, ['sly one']);
});

test('description syntax variants', () => {
  const { parseAnswer, formatAnswer } = require('../src/engine');
  const pa = s => { const a = parseAnswer(s); return [a.spellings, a.desc]; };
  assert.deepEqual(pa('cat *(feline friend)'), [['cat'], 'feline friend']);
  assert.deepEqual(pa('cat *(feline friend)*'), [['cat'], 'feline friend'], 'old trailing * still works');
  assert.deepEqual(pa('cat*(feline friend)'), [['cat'], 'feline friend'], 'no space needed');
  assert.deepEqual(pa('cat | kitty *( a cat (a big one) )'), [['cat', 'kitty'], 'a cat (a big one)'], 'brackets inside');
  assert.deepEqual(pa('cat *(feline friend'), [['cat'], 'feline friend'], 'forgot to close');
  assert.deepEqual(pa('cat *(feline) | kitty'), [['cat', 'kitty'], 'feline'], 'in the middle');
  assert.deepEqual(pa('Life (board game)'), [['Life (board game)'], null], 'plain brackets are part of the answer');
  assert.equal(formatAnswer(['cat', 'kitty'], 'feline friend'), 'cat | kitty *(feline friend)');
});
