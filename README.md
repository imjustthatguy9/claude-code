# 🌊 Mansellion

A daily pixel-art ocean guessing game. Each day has up to **five prompts** and you get **one guess** for each. Common answers keep you in the shallows. Rarer answers sink your little sub deeper and score more points.

| Tier | Depth | Points |
|---|---|---|
| 🦠 Plankton | 10 m | 10 |
| 🐙 Too Clever | 15 m | 15 |
| 🐟 Schooler | 30 m | 30 |
| 🐢 Rare | 60 m | 60 |
| 🏮 Deep Cut | 85 m | 85 |
| 🦁 Mansellion | 100 m | 100 |

A guess that isn't on the board scores 0 and the sub stays where it is.

## Run it

Requires Node 18 or newer. There are no dependencies to install.

```bash
ADMIN_PASSWORD=choose-something npm start
# game:  http://localhost:3000
# admin: http://localhost:3000/admin
```

Optional: `npm run seed` adds sample prompts for yesterday, today and tomorrow so you can try it out. `npm test` runs the matcher and anti-cheat tests.

### Settings (environment variables)

| Variable | Default | What it does |
|---|---|---|
| `ADMIN_PASSWORD` | generated | Admin login. If you don't set it, a random one is written to `data/admin-password.txt` and printed on first start. |
| `GAME_TZ` | `America/New_York` | The time zone where each day starts at midnight. All players share it. |
| `PORT` | `3000` | HTTP port. |
| `DATA_DIR` | `./data` | Where `db.json` (prompts, players, guesses) and the cookie-signing key are stored. **Back this up.** |
| `SECURE_COOKIES` | off | Set to `1` when serving over HTTPS. |

## Admin

Open `/admin` and log in. Then:

- **Calendar.** Each day shows how many prompts it has (gold = all 5). Today has a gold outline. The panel also lists any of the next 7 days that have no prompts.
- **Editor.** A day holds 1–5 prompts. Each prompt has six boxes, one per tier, with **one answer per line**. To accept other spellings, separate them with `|`, as in `New York City | NYC | Big Apple`. Players see the first spelling.
- **Test a guess.** Type a guess under a prompt to see which tier it would land in, including any auto-correction. It works on unsaved edits too.
- A warning appears when the same answer is listed in two tiers.
- Use **Export** / **Import** to back up all prompts as JSON or load them from a file.
- You can edit today while it's live. Players who already answered keep their scores.

### Auto-correct

Capital letters, punctuation, accents, a leading "the/a/an" and simple plurals are all ignored. Small typos are forgiven based on the answer's length: answers of 1–3 letters must be exact, 4–5 letters allow 1 typo, 6–9 allow 2, and 10 or more allow 3. Swapping two neighbouring letters counts as one typo. When a typo could match answers in two tiers, an exact match wins first, then the closer match.

## Fair play

- The answers stay on the server. During a day the browser only ever receives the current prompt's text. Your own result is revealed after you guess, and the full answer sheet only appears the next day under **Yesterday's depths**.
- The server scores every guess and records it against a signed, HttpOnly player cookie. Each prompt takes exactly one guess, in order. Re-guessing, skipping ahead and forged cookies are all rejected.
- The day comes from the **server's** clock in `GAME_TZ`, so changing your device's clock does nothing. Future days can only be read by the admin.
- Admin endpoints need a signed session cookie and a JSON body, which blocks cross-site form posts. Repeated wrong passwords are rate-limited.
- One limit: players are anonymous, so someone who clears their cookies or opens a private window gets a fresh player. To stop that completely you'd need player accounts.

## Hosting

`server.js` is a single Node process that stores everything in `DATA_DIR`. Any host that runs Node and has a **persistent disk** will work, such as a small VPS, Fly.io with a volume, or Render with a disk. On a host without a persistent disk, prompts and streaks are lost on every redeploy.

## Layout

```
server.js            HTTP server, API routes, cookies, admin auth
lib/match.js         answer normalising + fuzzy matching (auto-correct)
lib/game.js          guesses, scoring, streaks, what players may see
lib/days.js          time-zone-aware "today"
lib/store.js         JSON file storage (atomic writes)
public/              game (index.html) and admin (admin.html) front ends
  js/sprites.js      hand-placed pixel sprites
  js/ocean.js        the scrolling, dithered ocean background
  js/charts.js       results charts
scripts/seed.js      sample prompts
test/                node:test suites
```
