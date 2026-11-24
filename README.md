# 🌊 Nichion

A daily pixel-art ocean guessing game in **one HTML file**: [`nichion.html`](nichion.html). There's no server and no install. Open it in any browser, or share it the way you'd share any file.

Each day has up to **five prompts**, and you get **one guess** per prompt. Common answers keep you in the shallows. Rarer answers sink your sub deeper and score more points.

| Tier | Depth | Points |
|---|---|---|
| 🦠 Plankton | 10 m | 10 |
| 🐙 Too Clever | 15 m | 15 |
| 🐟 Schooler | 30 m | 30 |
| 🐢 Rare | 60 m | 60 |
| 🏮 Deep Cut | 85 m | 85 |
| 🦁 Nichion | 100 m | 100 |

## Running a game (admin)

1. Open `nichion.html`. Tap **?** and choose **Admin: edit prompts**, or add `#admin` to the end of the address.
2. The first time, you choose an admin password. It's saved into every game file you download from then on.
3. Pick a day on the calendar and add 1–5 prompts. Each prompt has a box for each tier, with **one answer per line**. Extra accepted spellings go after a bar: `New York City | NYC | Big Apple`. Players see the first spelling.
4. Use **Test a guess** under each prompt to check where an answer would land, including any auto-correction.
5. Press **Save Day**. This keeps your edits in your browser.
6. Press **Download game file** to get a new `nichion.html` with all your prompts inside it. **Share that file.** Players only see changes once they have the new file.

The **More** menu has: back up / restore prompts as JSON, change password, reset your own plays (for testing), and discard edits.

The file ships with sample prompts for Nov 22–25, 2026. Replace them with your own.

## How the game plays

- A day runs from each player's own local midnight to the next.
- The bar at the top shows one square per prompt and which prompt you're on. Each answer gets a **Next** button.
- The results page shows your score, a points-per-prompt chart, a dive-depth chart and your guesses. On days with fewer than 5 prompts it adds "(out of N questions today)" under the score.
- Your current streak, best streak, number of dives and best score are kept. Days with no prompts don't break a streak.
- **Yesterday's depths** lists every answer in every tier for the day before.
- When a day has no prompts, pressing Play says *the ocean is calm*.
- **Auto-correct:** capital letters, punctuation, accents, a leading "the/a/an" and simple plurals are ignored. Typos are forgiven based on the answer's length: 1–3 letters must be exact, 4–5 letters allow 1 typo, 6–9 allow 2, and 10 or more allow 3.

## Fair play — and its limits

A single file has no server to keep secrets on, so Nichion does what a standalone file can:

- **Answers are scrambled inside the file.** Viewing the page source or searching it won't show answers or future prompts. A prompt's text only appears when you reach it, and the full answer sheet only shows the next day.
- **One guess per prompt, saved before the result is shown.** Reloading the page doesn't give you another try.
- **Clock check.** Each browser remembers the latest day it has seen. If the device's date is turned back, play stops until the date is right again. If someone moves their clock forward to peek at tomorrow, that day is recorded as played, so they can't replay it when it really arrives.
- **The admin panel is password-protected.** Only a salted hash of the password is stored.

**Limits:** a determined player who reads the code could un-scramble the answers, and anyone can clear their browser data to reset their own progress. Truly cheat-proof play needs a server.

## Development

The editable source is in `src/`. Rebuild the single file after changing it:

```bash
node build.js          # → nichion.html (with src/sample-days.json)
node build.js --empty  # → nichion.html with no prompts
npm test
```

The fonts *Press Start 2P* and *Pixelify Sans* are embedded under the SIL Open Font License.
