'use strict';

const { TIERS } = require('./tiers');

// ---------------------------------------------------------------------------
// Answer format (as typed by the admin): one answer per line, aliases split by
// "|". The first spelling is the one shown to players.
//     New York City | NYC | The Big Apple
// ---------------------------------------------------------------------------

function parseAnswer(line) {
  const spellings = String(line).split('|').map(s => s.trim()).filter(Boolean);
  if (!spellings.length) return null;
  return { display: spellings[0], spellings };
}

const LEADING_ARTICLE = /^(the|a|an)\s+/;

/** Lower-case, strip accents/punctuation/articles, collapse whitespace. */
function normalize(s) {
  return String(s)
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(LEADING_ARTICLE, '')
    .replace(/\s+/g, ' ');
}

/** Spaces removed, plus a simple singular form so "wolves"/"wolf", "foxes"/"fox" line up. */
function keys(s) {
  const n = normalize(s);
  const compact = n.replace(/ /g, '');
  const out = new Set([compact]);
  const singular = n.split(' ').map(singularize).join('');
  out.add(singular);
  return [...out].filter(Boolean);
}

function singularize(w) {
  if (w.length <= 3) return w;
  if (w.endsWith('ies') && w.length > 4) return w.slice(0, -3) + 'y';
  if (w.endsWith('ves') && w.length > 4) return w.slice(0, -3) + 'f';
  if (/(ses|xes|zes|ches|shes)$/.test(w)) return w.slice(0, -2);
  if (w.endsWith('s') && !w.endsWith('ss') && !w.endsWith('us') && !w.endsWith('is')) return w.slice(0, -1);
  return w;
}

/** Optimal-string-alignment distance (Levenshtein + adjacent swaps), with an early-exit cap. */
function editDistance(a, b, cap = Infinity) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  const n = a.length, m = b.length;
  let prev2 = null;
  let prev = Array.from({ length: m + 1 }, (_, j) => j);
  for (let i = 1; i <= n; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= m; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (prev2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, prev2[j - 2] + 1);
      }
      cur[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > cap) return cap + 1;
    prev2 = prev;
    prev = cur;
  }
  return prev[m];
}

/** How many typos we forgive, by length of the real answer. Short words must be exact. */
function allowedTypos(len) {
  if (len <= 3) return 0;
  if (len <= 5) return 1;
  if (len <= 9) return 2;
  return 3;
}

/**
 * Match a player's guess against one prompt's answer sheet.
 * @param {string} guess
 * @param {Record<string,string[]>} answers  tierKey -> answer lines
 * @returns {{tier:string, display:string, corrected:boolean, distance:number} | null}
 */
function matchGuess(guess, answers) {
  const gKeys = keys(guess);
  if (!gKeys.length || !gKeys[0]) return null;

  let best = null;
  // Deeper tiers first so that a tie between tiers (e.g. an alias listed twice)
  // resolves in the player's favour.
  for (let t = TIERS.length - 1; t >= 0; t--) {
    const tier = TIERS[t];
    for (const line of answers?.[tier.key] || []) {
      const ans = parseAnswer(line);
      if (!ans) continue;
      for (const spelling of ans.spellings) {
        for (const ak of keys(spelling)) {
          const cap = allowedTypos(ak.length);
          for (const gk of gKeys) {
            const d = editDistance(gk, ak, cap);
            if (d > cap) continue;
            if (!best || d < best.distance) {
              best = { tier: tier.key, display: ans.display, corrected: d > 0, distance: d };
              if (d === 0 && t === TIERS.length - 1) return best;
            }
          }
        }
      }
    }
    if (best && best.distance === 0) return best; // exact hit in the deepest tier that has one
  }
  return best;
}

/** Find spellings that appear in more than one tier (or twice) — shown as warnings in the admin editor. */
function findDuplicates(answers) {
  const seen = new Map();
  const dups = [];
  for (const tier of TIERS) {
    for (const line of answers?.[tier.key] || []) {
      const ans = parseAnswer(line);
      if (!ans) continue;
      for (const s of ans.spellings) {
        const k = normalize(s).replace(/ /g, '');
        if (!k) continue;
        if (seen.has(k)) dups.push({ spelling: s, tiers: [seen.get(k), tier.key] });
        else seen.set(k, tier.key);
      }
    }
  }
  return dups;
}

module.exports = { normalize, keys, editDistance, allowedTypos, matchGuess, parseAnswer, findDuplicates, singularize };
