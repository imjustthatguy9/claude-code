'use strict';

// All "what day is it" logic lives on the server, in one game time zone, so a
// player can't change their device clock to reach tomorrow's prompts.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isDate(s) {
  if (typeof s !== 'string' || !DATE_RE.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !isNaN(d) && d.toISOString().slice(0, 10) === s;
}

function partsIn(tz, now = new Date()) {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  });
  const p = Object.fromEntries(f.formatToParts(now).map(x => [x.type, x.value]));
  return p;
}

function todayIn(tz, now = new Date()) {
  const p = partsIn(tz, now);
  return `${p.year}-${p.month}-${p.day}`;
}

function addDays(date, n) {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Milliseconds until the next local midnight in `tz` (checked by stepping, so DST is handled). */
function msUntilNextDay(tz, now = new Date()) {
  const today = todayIn(tz, now);
  const p = partsIn(tz, now);
  const secsIntoDay = (+p.hour) * 3600 + (+p.minute) * 60 + (+p.second);
  let guess = (86400 - secsIntoDay) * 1000 - now.getMilliseconds();
  // Nudge for DST days: make sure the day has actually flipped at `guess`.
  for (let i = 0; i < 3 && todayIn(tz, new Date(now.getTime() + guess)) === today; i++) guess += 3600 * 1000;
  return Math.max(1000, guess);
}

function validTimeZone(tz) {
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch { return false; }
}

module.exports = { isDate, todayIn, addDays, msUntilNextDay, validTimeZone };
