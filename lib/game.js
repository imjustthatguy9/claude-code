'use strict';

const { TIERS, TIER_BY_KEY, MAX_POINTS_PER_PROMPT } = require('./tiers');
const { matchGuess, parseAnswer } = require('./match');
const { addDays } = require('./days');

const MAX_GUESS_LEN = 60;

function playFor(player, date) {
  return player?.plays?.[date] || { guesses: [] };
}

function isComplete(store, player, date) {
  const total = store.promptsFor(date).length;
  const g = playFor(player, date).guesses.length;
  return total > 0 && g >= total;
}

function score(play) {
  return play.guesses.reduce((s, g) => s + (g.points || 0), 0);
}

/** What the player is allowed to see about a day right now. Never contains unrevealed answers. */
function publicPlay(store, player, date) {
  const prompts = store.promptsFor(date);
  const play = playFor(player, date);
  const total = prompts.length;
  const answered = play.guesses.length;
  const done = total > 0 && answered >= total;
  const visible = [];
  for (let i = 0; i < total && i <= answered; i++) {
    // Prompts already answered show the text the player actually saw.
    visible.push({ index: i, text: play.guesses[i]?.prompt ?? prompts[i].text });
  }
  return {
    date,
    total,
    current: done ? null : answered,
    done,
    score: score(play),
    maxScore: total * MAX_POINTS_PER_PROMPT,
    prompts: done ? visible : visible.slice(0, answered + 1),
    guesses: play.guesses.map(publicGuess),
  };
}

function publicGuess(g) {
  return {
    index: g.index, prompt: g.prompt, guess: g.guess,
    tier: g.tier, matched: g.display, corrected: !!g.corrected,
    points: g.points, depth: g.depth,
  };
}

class GuessError extends Error {
  constructor(code, message, status = 400) { super(message); this.code = code; this.status = status; }
}

/** Server-authoritative guess: checks the day, the order, and that it hasn't been answered. */
function submitGuess(store, playerId, { date, index, guess }, today) {
  if (date !== today) throw new GuessError('day_changed', 'A new day has started — reload to dive again.', 409);
  const prompts = store.promptsFor(today);
  if (!prompts.length) throw new GuessError('no_prompts', 'There are no prompts today.', 404);

  const text = typeof guess === 'string' ? guess.trim().replace(/\s+/g, ' ') : '';
  if (!text) throw new GuessError('empty', 'Type an answer first.');
  if (text.length > MAX_GUESS_LEN) throw new GuessError('too_long', `Keep it under ${MAX_GUESS_LEN} characters.`);

  const player = store.ensurePlayer(playerId);
  const play = player.plays[today] || (player.plays[today] = { guesses: [] });
  const expected = play.guesses.length;
  if (expected >= prompts.length) throw new GuessError('done', 'You already finished today’s dive.', 409);
  if (index !== expected) throw new GuessError('out_of_order', 'That prompt was already answered.', 409);

  const prompt = prompts[index];
  const m = matchGuess(text, prompt.answers);
  const tier = m ? TIER_BY_KEY[m.tier] : null;
  const record = {
    index,
    prompt: prompt.text,
    guess: text,
    tier: tier ? tier.key : null,
    display: m ? m.display : null,
    corrected: m ? m.corrected : false,
    points: tier ? tier.points : 0,
    depth: tier ? tier.depth : 0,
    at: new Date().toISOString(),
  };
  play.guesses.push(record);
  store.save();
  return publicGuess(record);
}

/**
 * Streaks count completed days. Days with no prompts set are skipped (they
 * neither extend nor break a streak), and today only counts once it's done —
 * not having played *yet* today doesn't break yesterday's streak.
 */
function stats(store, player, today) {
  const plays = player?.plays || {};
  const dates = Object.keys(plays).filter(d => d <= today).sort();
  const completed = dates.filter(d => isComplete(store, player, d));
  const scores = completed.map(d => score(plays[d]));

  let streak = 0, best = 0;
  if (dates.length) {
    let run = 0;
    for (let d = dates[0]; d <= today; d = addDays(d, 1)) {
      const hasPrompts = store.promptsFor(d).length > 0;
      if (!hasPrompts) continue;
      if (isComplete(store, player, d)) { run++; best = Math.max(best, run); }
      else if (d !== today) run = 0;
    }
    streak = run;
  }

  return {
    played: completed.length,
    streak,
    bestStreak: best,
    bestScore: scores.length ? Math.max(...scores) : 0,
    avgScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
  };
}

/** Full answer sheet for a past day, by tier, display names only. */
function answerSheet(store, date) {
  return store.promptsFor(date).map((p, i) => ({
    index: i,
    text: p.text,
    tiers: TIERS.map(t => ({
      key: t.key,
      answers: (p.answers?.[t.key] || []).map(parseAnswer).filter(Boolean).map(a => a.display),
    })),
  }));
}

module.exports = { publicPlay, submitGuess, stats, answerSheet, GuessError, isComplete, MAX_GUESS_LEN };
