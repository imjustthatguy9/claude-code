// ---------------------------------------------------------------------------
// Game content. Every item has art (an ICONS or CHARS key).
// SETS are shared by Imposter (secret words + hints) and $20 Draft (auction
// items). Each entry is [name, art, imposter hint].
// ---------------------------------------------------------------------------
const SETS = [
  { id: 'snacks', name: 'Snack Attack', icon: 'pizza', items: [
    ['Pizza', 'pizza', 'Slices'], ['Burger', 'burger', 'Grill'], ['Taco', 'taco', 'Crunchy'],
    ['Donut', 'donut', 'Glazed'], ['Ice Cream', 'icecream', 'Scoop'], ['Sushi', 'sushi', 'Rice'],
    ['Fries', 'fries', 'Salty'], ['Birthday Cake', 'cake', 'Candles'], ['Hot Dog', 'hotdog', 'Mustard'],
    ['Popcorn', 'popcorn', 'Movies'],
  ] },
  { id: 'pets', name: 'Pet Shop', icon: 'dog', items: [
    ['Dog', 'dog', 'Fetch'], ['Cat', 'cat', 'Whiskers'], ['Frog', 'frog', 'Pond'],
    ['Goldfish', 'fish', 'Bowl'], ['Bunny', 'bunny', 'Carrot'], ['Parrot', 'parrot', 'Talks'],
    ['Turtle', 'turtle', 'Shell'], ['Hamster', 'hamster', 'Wheel'], ['Snake', 'snake', 'Slither'],
    ['Baby Dragon', 'dragon', 'Wings'],
  ] },
  { id: 'powers', name: 'Superpowers', icon: 'bolt', items: [
    ['Flying', 'wings', 'Sky'], ['Invisibility', 'ghost', 'Hidden'], ['Super Strength', 'muscle', 'Lift'],
    ['Teleporting', 'portal', 'Instant'], ['Freezing Time', 'clock', 'Pause'], ['Mind Reading', 'brain', 'Thoughts'],
    ['Fire Powers', 'flame', 'Hot'], ['Ice Powers', 'snowflake', 'Frost'], ['Lightning', 'bolt', 'Storm'],
    ['Healing', 'heart', 'Doctor'],
  ] },
  { id: 'island', name: 'Island Survival', icon: 'tent', items: [
    ['Pocket Knife', 'knife', 'Sharp'], ['Rope', 'rope', 'Knot'], ['Tent', 'tent', 'Sleep'],
    ['Flashlight', 'flashlight', 'Dark'], ['Water Bottle', 'bottle', 'Thirsty'], ['Fishing Rod', 'rod', 'Catch'],
    ['Treasure Map', 'map', 'Pirate'], ['Radio', 'radio', 'Signal'], ['Axe', 'axe', 'Wood'],
    ['First Aid Kit', 'medkit', 'Ouch'],
  ] },
  { id: 'house', name: 'Dream House', icon: 'treehouse', items: [
    ['Swimming Pool', 'pool', 'Splash'], ['Water Slide', 'slide', 'Wheee'], ['Movie Theater', 'clapper', 'Screen'],
    ['Arcade', 'arcade', 'Tokens'], ['Library', 'books', 'Quiet'], ['Home Gym', 'dumbbell', 'Sweat'],
    ['Treehouse', 'treehouse', 'Branches'], ['Robot Butler', 'robot', 'Chores'], ['Bouncy Castle', 'castle', 'Jump'],
    ['Candy Room', 'candy', 'Sugar'],
  ] },
  { id: 'rides', name: 'Ride Garage', icon: 'car', items: [
    ['Sports Car', 'car', 'Fast'], ['Rocket', 'rocket', 'Space'], ['Bike', 'bike', 'Pedal'],
    ['Sailboat', 'boat', 'Wind'], ['Hot Air Balloon', 'balloon', 'Float'], ['Skateboard', 'skateboard', 'Tricks'],
    ['Helicopter', 'helicopter', 'Blades'], ['Train', 'train', 'Tracks'], ['UFO', 'ufo', 'Aliens'],
    ['Horse', 'horse', 'Saddle'],
  ] },
  { id: 'sports', name: 'Sports Day', icon: 'soccer', items: [
    ['Soccer', 'soccer', 'Goal'], ['Basketball', 'basketball', 'Hoop'], ['Football', 'football', 'Touchdown'],
    ['Baseball', 'baseball', 'Bases'], ['Tennis', 'tennis', 'Racket'], ['Bowling', 'bowling', 'Strike'],
    ['Golf', 'golf', 'Hole'], ['Hockey', 'hockey', 'Puck'], ['Boxing', 'glove', 'Ring'],
    ['Surfing', 'surf', 'Waves'],
  ] },
];

// Who Has the Bomb? category packs. Each entry is [category, art].
const BOMB_PACKS = [
  { id: 'classic', name: 'Classic', icon: 'star', cats: [
    ['Sports', 'soccer'], ['Animals', 'dog'], ['Foods', 'burger'], ['Fruits', 'apple'],
    ['Colors', 'palette'], ['Countries', 'globe'], ['Pizza toppings', 'pizza'],
    ['Ice cream flavors', 'icecream'], ['Things in a kitchen', 'knife'], ['Things at the beach', 'surf'],
    ['Things with wheels', 'car'], ['Things that fly', 'wings'], ['Pets', 'cat'],
    ['Sea creatures', 'fish'], ['Desserts', 'cake'], ['Breakfast foods', 'donut'],
    ['School subjects', 'books'], ['Drinks', 'bottle'], ['Body parts', 'muscle'],
    ['Jobs', 'spy'],
  ] },
  { id: 'words', name: 'Word Play', icon: 'abc', cats: [
    ['3-letter words', 'abc'], ['4-letter words', 'abc'], ['Words that start with B', 'abc'],
    ['Words that start with S', 'abc'], ['Words that start with T', 'abc'], ['Words that end in -ING', 'abc'],
    ['Words that rhyme with CAT', 'cat'], ['Words that rhyme with DAY', 'abc'], ['Words that rhyme with BEE', 'abc'],
    ['Compound words (like SUNFLOWER)', 'abc'], ['Words with double letters (like BOOK)', 'books'],
    ['Words with a Z in them', 'abc'], ['Animals that start with C', 'dog'],
    ['Names that start with J', 'question'], ['Foods that start with P', 'pizza'],
  ] },
  { id: 'pop', name: 'Pop Culture', icon: 'tv', cats: [
    ['Movies', 'clapper'], ['Cartoon characters', 'tv'], ['Superheroes', 'bolt'],
    ['Video games', 'gamepad'], ['Singers or bands', 'note'], ['TV shows', 'tv'],
    ['Board games', 'gamepad'], ['Apps on a phone', 'question'], ['Famous athletes', 'basketball'],
    ['Song titles', 'note'], ['Toys', 'castle'], ['Fast food places', 'fries'],
    ['Candy', 'candy'], ['Movie villains', 'spy'], ['Holidays', 'cake'],
  ] },
  { id: 'silly', name: 'Silly Stuff', icon: 'question', cats: [
    ['Things in a backpack', 'books'], ['Things that are sticky', 'donut'], ['Things that smell bad', 'fish'],
    ['Excuses for being late', 'clock'], ['Things that are round', 'soccer'], ['Things that are cold', 'snowflake'],
    ['Things in the sky', 'ufo'], ['Things you can open', 'medkit'], ['Things that make noise', 'radio'],
    ['Things that are scary', 'ghost'], ['Things with buttons', 'gamepad'], ['Things in a fridge', 'apple'],
    ['Things that are soft', 'bunny'], ['Things you can throw', 'baseball'], ['Things that are green', 'frog'],
    ['Things that are hot', 'flame'], ['Things in a park', 'treehouse'], ['Things that are yellow', 'star'],
  ] },
];

const ALL_ITEMS = SETS.flatMap(s => s.items.map(([name, icon, hint]) => ({ name, icon, hint, set: s.id, setName: s.name })));
