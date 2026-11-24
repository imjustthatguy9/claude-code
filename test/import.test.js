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
  assert.equal(promptToText(q), 'animals\n\nfox\n\n-\n\ndog\nant');
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
