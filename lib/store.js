'use strict';

const fs = require('fs');
const path = require('path');

// Tiny JSON-file database. Single process, writes are atomic (tmp + rename)
// and coalesced so a burst of guesses is one disk write.
//
// Shape:
// {
//   days:    { "YYYY-MM-DD": { prompts: [{ text, answers: { tierKey: ["Answer | alias", ...] } }], updatedAt } },
//   players: { "<id>": { createdAt, plays: { "YYYY-MM-DD": { guesses: [...], total } } } }
// }

class Store {
  constructor(file) {
    this.file = file;
    this.data = { days: {}, players: {} };
    this._timer = null;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    if (fs.existsSync(file)) {
      const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
      this.data.days = raw.days || {};
      this.data.players = raw.players || {};
    }
  }

  save() {
    if (this._timer) return;
    this._timer = setTimeout(() => { this._timer = null; this.flush(); }, 50);
  }

  flush() {
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.data));
    fs.renameSync(tmp, this.file);
  }

  getDay(date) { return this.data.days[date] || null; }
  promptsFor(date) { return this.getDay(date)?.prompts || []; }

  setDay(date, prompts) {
    if (!prompts.length) delete this.data.days[date];
    else this.data.days[date] = { prompts, updatedAt: new Date().toISOString() };
    this.save();
  }

  player(id) { return this.data.players[id] || null; }

  ensurePlayer(id) {
    if (!this.data.players[id]) {
      this.data.players[id] = { createdAt: new Date().toISOString(), plays: {} };
      this.save();
    }
    return this.data.players[id];
  }

  playersWhoPlayed(date) {
    let n = 0;
    for (const p of Object.values(this.data.players)) if (p.plays?.[date]?.guesses?.length) n++;
    return n;
  }
}

module.exports = { Store };
