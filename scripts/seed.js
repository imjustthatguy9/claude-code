'use strict';
// Seeds sample prompts for yesterday, today and tomorrow so you can try the game.
// Existing days are left alone unless you pass --force.
//   node scripts/seed.js [--force]
const path = require('path');
const { Store } = require('../lib/store');
const { todayIn, addDays } = require('../lib/days');

const TZ = process.env.GAME_TZ || 'America/New_York';
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, '..', 'data'));
const force = process.argv.includes('--force');

const P = (text, plankton, clever, schooler, rare, deepcut, mansellion) =>
  ({ text, answers: { plankton, clever, schooler, rare, deepcut, mansellion } });

const SETS = [
  [ // yesterday
    P('Name a fruit',
      ['Apple', 'Banana', 'Orange'],
      ['Strawberry', 'Grape | Grapes', 'Watermelon'],
      ['Mango', 'Pineapple', 'Peach', 'Pear', 'Cherry', 'Blueberry'],
      ['Kiwi', 'Papaya', 'Pomegranate', 'Plum', 'Lemon', 'Lime', 'Cantaloupe', 'Raspberry'],
      ['Lychee', 'Guava', 'Persimmon', 'Fig', 'Apricot', 'Passion fruit', 'Dragon fruit | Pitaya', 'Coconut', 'Nectarine'],
      ['Durian', 'Rambutan', 'Mangosteen', 'Jackfruit', 'Kumquat', 'Quince', 'Starfruit | Carambola', 'Ackee', 'Cherimoya']),
    P('Name a planet or dwarf planet',
      ['Mars', 'Earth'], ['Jupiter', 'Saturn'], ['Venus', 'Mercury'], ['Neptune', 'Uranus', 'Pluto'],
      ['Ceres', 'Eris'], ['Haumea', 'Makemake', 'Sedna', 'Gonggong', 'Quaoar']),
    P('Name a dog breed',
      ['Golden Retriever', 'Labrador | Lab | Labrador Retriever'],
      ['German Shepherd', 'Poodle', 'Bulldog'],
      ['Beagle', 'Husky | Siberian Husky', 'Chihuahua', 'Pug', 'Dachshund | Wiener dog', 'Rottweiler'],
      ['Corgi', 'Boxer', 'Great Dane', 'Doberman', 'Shih Tzu', 'Pomeranian', 'Border Collie'],
      ['Basenji', 'Weimaraner', 'Vizsla', 'Shiba Inu', 'Akita', 'Samoyed', 'Bernese Mountain Dog'],
      ['Xoloitzcuintli | Xolo', 'Komondor', 'Puli', 'Lagotto Romagnolo', 'Otterhound', 'Azawakh', 'Catahoula']),
    P('Name a breakfast food',
      ['Eggs', 'Pancakes', 'Cereal'], ['Bacon', 'Waffles', 'Toast'],
      ['Oatmeal', 'French Toast', 'Bagel', 'Yogurt', 'Sausage'],
      ['Hash browns', 'Omelette | Omelet', 'Muffin', 'Croissant', 'Grits'],
      ['Eggs Benedict', 'Shakshuka', 'Biscuits and gravy', 'Granola', 'Crepes'],
      ['Congee', 'Kedgeree', 'Scrapple', 'Chilaquiles', 'Huevos rancheros', 'Natto', 'Black pudding']),
    P('Name something you’d find at the beach',
      ['Sand', 'Shells | Seashell', 'Water'], ['Towel', 'Umbrella', 'Sunscreen'],
      ['Crab', 'Seagull', 'Bucket', 'Surfboard', 'Lifeguard'],
      ['Sandcastle', 'Kite', 'Cooler', 'Volleyball', 'Seaweed'],
      ['Driftwood', 'Sea glass', 'Jellyfish', 'Sand dollar', 'Flip flops'],
      ['Sandpiper', 'Lugworm', 'Mermaid’s purse', 'Tide pool', 'Barnacle']),
  ],
  [ // today
    P('Name a musical instrument',
      ['Guitar', 'Piano'], ['Drums', 'Violin'], ['Flute', 'Trumpet', 'Saxophone | Sax', 'Bass'],
      ['Cello', 'Clarinet', 'Harp', 'Ukulele', 'Trombone', 'Harmonica'],
      ['Oboe', 'Bassoon', 'Banjo', 'Accordion', 'Xylophone', 'Tuba', 'French horn', 'Mandolin'],
      ['Theremin', 'Didgeridoo', 'Hurdy-gurdy', 'Sitar', 'Bagpipes', 'Kalimba', 'Glockenspiel', 'Ocarina']),
    P('Name a famous painter',
      ['Picasso | Pablo Picasso', 'Van Gogh | Vincent van Gogh'], ['Da Vinci | Leonardo da Vinci | Leonardo'],
      ['Monet | Claude Monet', 'Michelangelo', 'Bob Ross'],
      ['Rembrandt', 'Dali | Salvador Dali', 'Frida Kahlo | Kahlo', 'Warhol | Andy Warhol'],
      ['Matisse', 'Vermeer', 'Klimt', 'Pollock | Jackson Pollock', 'Renoir', 'Cezanne', 'Raphael', 'Hopper | Edward Hopper'],
      ['Caravaggio', 'Bosch | Hieronymus Bosch', 'Turner', 'Basquiat', 'Hokusai', 'Kandinsky', 'Magritte', 'Rothko', 'Bruegel']),
    P('Name a sport played with a ball',
      ['Soccer | Football', 'Basketball'], ['Baseball', 'Tennis'], ['Volleyball', 'Golf', 'American football'],
      ['Rugby', 'Cricket', 'Bowling', 'Softball', 'Ping pong | Table tennis'],
      ['Lacrosse', 'Water polo', 'Handball', 'Squash', 'Dodgeball', 'Polo', 'Kickball'],
      ['Sepak takraw', 'Jai alai', 'Pickleball', 'Hurling', 'Bocce', 'Croquet', 'Pelota', 'Korfball']),
    P('Name a country in Europe',
      ['France', 'Germany'], ['Italy', 'Spain'], ['England | UK | United Kingdom', 'Greece', 'Portugal', 'Ireland'],
      ['Sweden', 'Norway', 'Poland', 'Switzerland', 'Netherlands | Holland', 'Belgium', 'Austria'],
      ['Croatia', 'Hungary', 'Czechia | Czech Republic', 'Finland', 'Iceland', 'Romania', 'Denmark', 'Ukraine'],
      ['Liechtenstein', 'Andorra', 'San Marino', 'Moldova', 'Montenegro', 'Estonia', 'Latvia', 'Lithuania', 'Slovenia', 'North Macedonia']),
    P('Name a type of cheese',
      ['Cheddar', 'Mozzarella'], ['Swiss', 'Parmesan'], ['American', 'Brie', 'Gouda', 'Provolone'],
      ['Feta', 'Blue cheese', 'Pepper jack', 'Ricotta', 'Colby'],
      ['Gruyere', 'Camembert', 'Havarti', 'Manchego', 'Halloumi', 'Gorgonzola', 'Roquefort', 'Burrata'],
      ['Limburger', 'Epoisses', 'Taleggio', 'Raclette', 'Comte', 'Paneer', 'Casu marzu', 'Stilton', 'Emmental']),
  ],
  [ // tomorrow (only 3, to show a short day)
    P('Name a color',
      ['Blue', 'Red'], ['Green', 'Purple'], ['Yellow', 'Orange', 'Pink', 'Black'],
      ['Teal', 'Turquoise', 'Maroon', 'Navy', 'Brown', 'Gray | Grey'],
      ['Magenta', 'Chartreuse', 'Lavender', 'Indigo', 'Cyan', 'Burgundy', 'Beige'],
      ['Vermilion', 'Cerulean', 'Puce', 'Fuchsia', 'Mauve', 'Ochre', 'Periwinkle', 'Celadon']),
    P('Name a board game',
      ['Monopoly', 'Chess'], ['Scrabble', 'Clue | Cluedo'], ['Checkers', 'Sorry', 'Risk', 'Candy Land'],
      ['Catan | Settlers of Catan', 'Battleship', 'Trivial Pursuit', 'Life | The Game of Life', 'Operation'],
      ['Ticket to Ride', 'Pandemic', 'Mouse Trap', 'Backgammon', 'Stratego', 'Othello'],
      ['Go', 'Carcassonne', 'Azul', 'Wingspan', 'Mancala', 'Parcheesi', 'Twilight Imperium']),
    P('Name a pasta shape',
      ['Spaghetti', 'Penne'], ['Macaroni', 'Fettuccine'], ['Lasagna', 'Ravioli', 'Linguine', 'Rigatoni'],
      ['Farfalle | Bowtie', 'Rotini', 'Tortellini', 'Ziti', 'Angel hair'],
      ['Orzo', 'Gnocchi', 'Orecchiette', 'Pappardelle', 'Fusilli', 'Cavatappi'],
      ['Bucatini', 'Radiatori', 'Casarecce', 'Strozzapreti', 'Trofie', 'Gemelli', 'Conchiglie']),
  ],
];

const store = new Store(path.join(DATA_DIR, 'db.json'));
const today = todayIn(TZ);
[-1, 0, 1].forEach((off, i) => {
  const date = addDays(today, off);
  if (store.getDay(date) && !force) return console.log(`skip ${date} (already has prompts)`);
  store.setDay(date, SETS[i]);
  console.log(`seeded ${date}: ${SETS[i].length} prompts`);
});
store.flush();
