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
  { id: 'legends', name: 'Heroes & Legends', icon: 'knight', items: [
    ['Pirate', 'pirate', 'Ship'], ['Ninja', 'ninja', 'Stealth'], ['Wizard', 'wizard', 'Spells'],
    ['Knight', 'knight', 'Armor'], ['Princess', 'princess', 'Tiara'], ['Astronaut', 'astro', 'Space'],
    ['Vampire', 'vamp', 'Fangs'], ['Alien', 'alien', 'Planet'], ['Robot', 'robot', 'Metal'],
    ['Ghost', 'ghost', 'Spooky'],
  ] },
  { id: 'ocean', name: 'Under the Sea', icon: 'whale', items: [
    ['Shark', 'shark', 'Fin'], ['Octopus', 'octopus', 'Ink'], ['Whale', 'whale', 'Huge'],
    ['Crab', 'crab', 'Pinch'], ['Jellyfish', 'jelly', 'Sting'], ['Starfish', 'starfish', 'Arms'],
    ['Seahorse', 'seahorse', 'Tiny'], ['Pufferfish', 'puffer', 'Spiky'], ['Seashell', 'shell', 'Beach'],
    ['Clownfish', 'clownfish', 'Stripes'],
  ] },
  { id: 'fruit', name: 'Fruit Stand', icon: 'strawberry', items: [
    ['Apple', 'apple', 'Teacher'], ['Banana', 'banana', 'Peel'], ['Watermelon', 'watermelon', 'Seeds'],
    ['Grapes', 'grapes', 'Bunch'], ['Strawberry', 'strawberry', 'Red'], ['Cherries', 'cherries', 'Pair'],
    ['Pineapple', 'pineapple', 'Tropical'], ['Lemon', 'lemon', 'Sour'], ['Orange', 'orange', 'Juice'],
    ['Peach', 'peach', 'Fuzzy'],
  ] },
  { id: 'gadgets', name: 'Gadget Shop', icon: 'phone', items: [
    ['Phone', 'phone', 'Call'], ['Laptop', 'laptop', 'Typing'], ['Camera', 'camera', 'Photo'],
    ['Headphones', 'headphones', 'Music'], ['Game Controller', 'gamepad', 'Buttons'], ['Smart Watch', 'watch', 'Wrist'],
    ['Microphone', 'mic', 'Sing'], ['Drone', 'drone', 'Hover'], ['Big TV', 'tv', 'Channels'],
    ['RC Car', 'rccar', 'Remote'],
  ] },
  { id: 'weather', name: 'Weather & Sky', icon: 'sun', items: [
    ['Sun', 'sun', 'Hot'], ['Moon', 'moon', 'Night'], ['Rainbow', 'rainbow', 'Colors'],
    ['Rain Cloud', 'cloud', 'Wet'], ['Snowman', 'snowman', 'Carrot'], ['Tornado', 'tornado', 'Spin'],
    ['Thunderstorm', 'bolt', 'Loud'], ['Shooting Star', 'star', 'Wish'], ['Planet', 'planet', 'Rings'],
    ['Snowflake', 'snowflake', 'Winter'],
  ] },
  { id: 'holiday', name: 'Holiday Party', icon: 'present', items: [
    ['Present', 'present', 'Wrapped'], ['Pumpkin', 'pumpkin', 'Carve'], ['Christmas Tree', 'xmastree', 'Ornaments'],
    ['Fireworks', 'fireworks', 'Bang'], ['Candy Cane', 'candycane', 'Mint'], ['Easter Egg', 'egg', 'Hunt'],
    ['Party Hat', 'partyhat', 'Pointy'], ['Balloons', 'balloons', 'Pop'], ['Birthday Cake', 'cake', 'Candles'],
    ['Gingerbread Man', 'gingerbread', 'Run'],
  ] },
  { id: 'farm', name: 'Farm Friends', icon: 'cow', items: [
    ['Cow', 'cow', 'Milk'], ['Pig', 'pig', 'Mud'], ['Chicken', 'chicken', 'Cluck'],
    ['Sheep', 'sheep', 'Wool'], ['Horse', 'horse', 'Gallop'], ['Duck', 'duck', 'Quack'],
    ['Tractor', 'tractor', 'Plow'], ['Barn', 'barn', 'Hay'], ['Corn', 'corn', 'Cob'],
    ['Fresh Egg', 'plainegg', 'Breakfast'],
  ] },
  { id: 'loot', name: 'Treasure Hunt', icon: 'chest', items: [
    ['Sword', 'sword', 'Blade'], ['Shield', 'shield', 'Block'], ['Crown', 'crown', 'King'],
    ['Potion', 'potion', 'Bubbly'], ['Magic Wand', 'wand', 'Spell'], ['Diamond', 'gem', 'Sparkle'],
    ['Treasure Chest', 'chest', 'Gold'], ['Golden Key', 'key', 'Lock'], ['Gold Coins', 'coin', 'Rich'],
    ['Magic Ring', 'ring', 'Finger'],
  ] },
  { id: 'sweets', name: 'Sweet Treats', icon: 'cupcake', items: [
    ['Cupcake', 'cupcake', 'Frosting'], ['Lollipop', 'lollipop', 'Lick'], ['Cookie', 'cookie', 'Chips'],
    ['Chocolate Bar', 'chocolate', 'Melt'], ['Gummy Bear', 'gummy', 'Chewy'], ['Cotton Candy', 'cottoncandy', 'Fluffy'],
    ['Pie', 'pie', 'Crust'], ['Pancakes', 'pancakes', 'Syrup'], ['Milkshake', 'milkshake', 'Straw'],
    ['Wrapped Candy', 'candy', 'Wrapper'],
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
  { id: 'food', name: 'Food Fight', icon: 'burger', cats: [
    ['Sandwich fillings', 'burger'], ['Breakfast cereals', 'donut'], ['Soups', 'bottle'], ['Candy bars', 'chocolate'],
    ['Cheeses', 'pizza'], ['Vegetables', 'corn'], ['Spicy foods', 'flame'], ['Things in a lunchbox', 'apple'],
    ['Pasta shapes', 'pizza'], ['Things you grill', 'hotdog'], ['Cookie flavors', 'cookie'], ['Snacks', 'popcorn'],
    ['Things made with eggs', 'plainegg'], ['Pie flavors', 'pie'], ['Things on a sundae', 'icecream'],
  ] },
  { id: 'animals', name: 'Animal Kingdom', icon: 'dog', cats: [
    ['Farm animals', 'cow'], ['Birds', 'parrot'], ['Bugs and insects', 'bug'], ['Animals with stripes', 'clownfish'],
    ['Animals in a zoo', 'snake'], ['Animals with four legs', 'horse'], ['Animals that swim', 'fish'], ['Animals that fly', 'wings'],
    ['Reptiles', 'turtle'], ['Baby animal names', 'bunny'], ['Animal sounds', 'cow'], ['Big cats', 'cat'],
    ['Dog breeds', 'dog'], ['Jungle animals', 'parrot'], ['Animals that come out at night', 'moon'],
  ] },
  { id: 'world', name: 'Around the World', icon: 'globe', cats: [
    ['Countries in Europe', 'globe'], ['Countries in Asia', 'globe'], ['US states', 'map'], ['Capital cities', 'map'],
    ['Famous landmarks', 'castle'], ['Languages', 'abc'], ['Oceans and seas', 'whale'], ['Rivers', 'boat'],
    ['Islands', 'map'], ['Big cities', 'car'], ['Foods from Italy', 'pizza'], ['Vacation spots', 'balloon'],
    ['Planets', 'planet'], ['Things you pack in a suitcase', 'present'], ['Ways to travel', 'rocket'],
  ] },
  { id: 'home', name: 'Around the House', icon: 'treehouse', cats: [
    ['Things in a bathroom', 'bottle'], ['Things in a bedroom', 'moon'], ['Furniture', 'chest'], ['Things that plug in', 'laptop'],
    ['Things in a garage', 'car'], ['Cleaning supplies', 'medkit'], ['Things in a junk drawer', 'key'], ['Things with a remote', 'tv'],
    ['Kitchen tools', 'knife'], ['Things in a closet', 'partyhat'], ['Things on a desk', 'laptop'], ['Things under the couch', 'coin'],
    ['Things with a lid', 'chest'], ['Things in a toolbox', 'axe'], ['Things in a backyard', 'treehouse'],
  ] },
  { id: 'school', name: 'School Days', icon: 'books', cats: [
    ['School supplies', 'books'], ['Things in a classroom', 'clock'], ['Math words', 'abc'], ['Science words', 'potion'],
    ['Recess games', 'soccer'], ['Things in a cafeteria', 'pizza'], ['Field trip places', 'map'], ['Things in a library', 'books'],
    ['Things you can draw', 'palette'], ['Book titles', 'books'], ['Things a teacher says', 'abc'], ['Shapes', 'star'],
    ['Things in a pencil case', 'palette'], ['Things in a backpack', 'books'],
  ] },
  { id: 'music', name: 'Music & Dance', icon: 'note', cats: [
    ['Musical instruments', 'note'], ['Dance moves', 'muscle'], ['Songs everyone knows', 'mic'], ['Music genres', 'headphones'],
    ['Famous bands', 'mic'], ['Things at a concert', 'mic'], ['Songs from movies', 'clapper'], ['Kids\' songs', 'note'],
    ['Holiday songs', 'xmastree'], ['Words that rhyme with SONG', 'abc'], ['Things that make music', 'radio'],
    ['Karaoke songs', 'mic'], ['Famous singers', 'star'],
  ] },
  { id: 'sport2', name: 'Sports Talk', icon: 'basketball', cats: [
    ['Sports with a ball', 'soccer'], ['Olympic sports', 'crown'], ['Sports teams', 'football'], ['Things in a gym', 'dumbbell'],
    ['Water sports', 'surf'], ['Winter sports', 'snowflake'], ['Sports equipment', 'baseball'], ['Ways to move fast', 'bike'],
    ['Exercises', 'muscle'], ['Things at a stadium', 'popcorn'], ['Positions in a sport', 'football'], ['Things a coach yells', 'mic'],
    ['Sports with a net', 'tennis'],
  ] },
  { id: 'fantasy', name: 'Fantasy & Magic', icon: 'wand', cats: [
    ['Magical creatures', 'dragon'], ['Magic words and spells', 'wand'], ['Fairy tale characters', 'princess'], ['Monsters', 'ghost'],
    ['Things in a castle', 'crown'], ['Things a pirate has', 'chest'], ['Halloween costumes', 'pumpkin'], ['Villains', 'vamp'],
    ['Things that glow', 'gem'], ['Treasure', 'coin'], ['Things in a potion', 'potion'], ['Knight gear', 'shield'],
    ['Things in space', 'rocket'], ['Superhero names', 'bolt'],
  ] },
  { id: 'holidays', name: 'Holidays & Parties', icon: 'present', cats: [
    ['Christmas things', 'xmastree'], ['Halloween things', 'pumpkin'], ['Birthday party things', 'cake'], ['Things at a wedding', 'ring'],
    ['Summer things', 'sun'], ['Winter things', 'snowman'], ['Gift ideas', 'present'], ['Party games', 'balloons'],
    ['Things at a sleepover', 'moon'], ['Picnic foods', 'watermelon'], ['Things in an Easter basket', 'egg'], ['Things that go BANG', 'fireworks'],
    ['Valentine\'s Day things', 'heart'], ['Costume ideas', 'spy'],
  ] },
  { id: 'nature', name: 'Great Outdoors', icon: 'tent', cats: [
    ['Trees', 'treehouse'], ['Flowers', 'strawberry'], ['Weather words', 'cloud'], ['Things in a forest', 'axe'],
    ['Camping gear', 'tent'], ['Things in the ocean', 'whale'], ['Things in space', 'planet'], ['Things on a farm', 'barn'],
    ['Bugs', 'bug'], ['Things in a garden', 'corn'], ['Rocks and gems', 'gem'], ['Things at a lake', 'rod'],
    ['Natural disasters', 'tornado'], ['Things that are wet', 'cloud'],
  ] },
  { id: 'tricky', name: 'Tricky Words', icon: 'abc', cats: [
    ['Words that start with Q', 'abc'], ['Words that end in -Y', 'abc'], ['5-letter words', 'abc'], ['Words that start with X or Z', 'abc'],
    ['Palindromes (like MOM)', 'abc'], ['Words that rhyme with LIGHT', 'moon'], ['Words that rhyme with CAKE', 'cake'],
    ['Words with a silent letter (like KNIFE)', 'knife'], ['Words with OO in them', 'abc'], ['Words that rhyme with RED', 'apple'],
    ['Words with 3 syllables', 'abc'], ['Words that start with your first letter', 'question'], ['Words that end in -TION', 'abc'],
  ] },
  { id: 'kids', name: 'Little Kids', icon: 'bunny', cats: [
    ['Animals that say MOO, BAA or OINK', 'cow'], ['Toys', 'castle'], ['Things that are red', 'apple'], ['Things that are blue', 'whale'],
    ['Shapes', 'star'], ['Things that are big', 'whale'], ['Things that are tiny', 'bug'], ['Things that go fast', 'rocket'],
    ['Things you wear', 'partyhat'], ['Things in a bath', 'duck'], ['Bedtime things', 'moon'], ['Sweet treats', 'lollipop'],
    ['Things that are round', 'soccer'], ['Animals that hop', 'frog'],
  ] },
];

const ALL_ITEMS = SETS.flatMap(s => s.items.map(([name, icon, hint]) => ({ name, icon, hint, set: s.id, setName: s.name })));
