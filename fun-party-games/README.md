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
- Pick as many word sets as you like (16 sets, with All/None buttons), how many imposters (1–3, depending on player count), and whether the
  imposter gets a **hint**.
- Pass the phone. Each player's card shows their name; **pull it up** to peek at what's
  underneath and **let go** to drop it back down. Underneath is the secret word with its
  picture, or "You are the IMPOSTER!" plus the hint, if hints are on.
- Once everyone has looked, the app picks who talks first, then shows a big
  **Reveal imposter** button.

### 💣 Who Has the Bomb? (2+ players)
- A random player starts, with a category such as *3-letter words* or *Sports*.
  Pick as many packs as you like: there are 16 packs and 237 categories, each with a picture.
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
- You can spend all your money at once. If you run out, you sit out the bidding, and once
  everyone who still has money is done you get the leftover items for **free**.
- At the end you can compare teams, either as cards or **side by side**, and crown the
  best one.

## Content

16 sets of 10 items are shared by Imposter (secret words and hints) and the Draft
(auction items): Snack Attack, Pet Shop, Superpowers, Island Survival, Dream House,
Ride Garage, Sports Day, Heroes & Legends, Under the Sea, Fruit Stand, Gadget Shop,
Weather & Sky, Holiday Party, Farm Friends, Treasure Hunt and Sweet Treats. Every item has
its own pixel-art icon (140 hand-drawn icons plus the 21 characters).

Bomb packs: Classic, Word Play, Pop Culture, Silly Stuff, Food Fight, Animal Kingdom,
Around the World, Around the House, School Days, Music & Dance, Sports Talk,
Fantasy & Magic, Holidays & Parties, Great Outdoors, Tricky Words and Little Kids.

## Building and testing

The source is in `src/`. `node build.js` inlines the JS, CSS, pixel fonts and favicon into
`fun-party-games.html`.

```
node build.js        # rebuild fun-party-games.html
npm test             # build, then play every game in headless Chromium (Playwright)
```

`test/e2e.js` plays through every screen on an emulated iPhone, checks the rules (one
imposter, the card drops when released, bomb stages, every draft team filled and money
adding up, players who spend everything get free leftovers, several sets/packs can be
picked at once, plus 400 random simulated drafts), and saves screenshots to `screenshots/`.

| File | What's in it |
|---|---|
| `src/art.js` | Palette, the 21 characters, item icons, the bomb sprite |
| `src/art-more.js` | Icons for the newer sets and packs, plus recoloured variants |
| `src/data.js` | Word/draft sets with hints, bomb category packs |
| `src/app.js` | Screens, game logic, sound, effects |
| `src/style.css` | The pixel-art theme |
