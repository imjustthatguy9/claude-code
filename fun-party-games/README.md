# 🎉 Fun Party Games

Pixel-art party games for a group sharing **one phone**, all in a single file:
[`fun-party-games.html`](fun-party-games.html). No install and no server. Open it in any
browser (it's built for phones) and pass it around.

## Players

Add everyone's name and pick one of **21 pixel characters** for each player
(cat, frog, robot, ghost, knight, wizard, alien, bear, penguin, dino, astronaut,
ninja, pirate, princess, bunny, mushroom, slime, fox, duck, vampire, panda).
The list is saved on the device.

## The games

### 🕵️ Imposter (3+ players)
- Pick word sets, how many imposters (1–3, depending on player count), and whether the
  imposter gets a **hint**.
- Pass the phone. Each player's card shows their name; **pull it up** to peek at what's
  underneath and **let go** to drop it back down. Underneath is the secret word with its
  picture, or "You are the IMPOSTER!" plus the hint, if hints are on.
- Once everyone has looked, the app picks who talks first, then shows a big
  **Reveal imposter** button.

### 💣 Who Has the Bomb? (2+ players)
- A random player starts, with a category such as *3-letter words* or *Sports*.
  There are 4 packs and 68 categories, each with a picture.
- Light the fuse and pass the phone. The bomb has three stages:
  1. **Dormant**: it just sits there with the fuse fizzing.
  2. **Blinking red** and beeping.
  3. Blinking and beeping **fast**, then it explodes at a random moment.
- Tap whoever was holding it. A "boom board" keeps score.

### 💰 $20 Draft (2+ players)
- Choose **3 or 5 picks** and a set to draft from.
- Everyone has $20. One item comes up at a time (every item has art). Starting with a
  random player and going around, you **bid higher** or **pass**. Passing takes you out
  of that item. If you can't afford to top the bid, you're skipped.
- You must keep $1 for every empty slot, so everyone always fills their team.
- At the end you can compare teams, either as cards or **side by side**, and crown the
  best one.

## Content

7 sets with 10 items each are shared by Imposter (secret words and hints) and the Draft
(auction items): Snack Attack, Pet Shop, Superpowers, Island Survival, Dream House,
Ride Garage and Sports Day. There are 77 hand-drawn item icons plus the 21 characters.

## Building and testing

The source is in `src/`. `node build.js` inlines the JS, CSS, pixel fonts and favicon into
`fun-party-games.html`.

```
node build.js        # rebuild fun-party-games.html
npm test             # build, then play every game in headless Chromium (Playwright)
```

`test/e2e.js` plays through every screen on an emulated iPhone, checks the rules (one
imposter, the card drops when released, bomb stages, every draft team filled and money
adding up, plus 400 random simulated drafts), and saves screenshots to `screenshots/`.

| File | What's in it |
|---|---|
| `src/art.js` | Palette, the 21 characters, item icons, the bomb sprite |
| `src/data.js` | Word/draft sets with hints, bomb category packs |
| `src/app.js` | Screens, game logic, sound, effects |
| `src/style.css` | The pixel-art theme |
