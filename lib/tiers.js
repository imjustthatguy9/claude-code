'use strict';

// The six rarity tiers, shallowest to deepest. `depth` is metres descended,
// `points` is what the guess is worth. Order matters: it is the display order
// everywhere (admin editor, yesterday's sheet, charts).
const TIERS = [
  { key: 'plankton',   name: 'Plankton',   depth: 10,  points: 10  },
  { key: 'clever',     name: 'Too Clever', depth: 15,  points: 15  },
  { key: 'schooler',   name: 'Schooler',   depth: 30,  points: 30  },
  { key: 'rare',       name: 'Rare',       depth: 60,  points: 60  },
  { key: 'deepcut',    name: 'Deep Cut',   depth: 85,  points: 85  },
  { key: 'mansellion', name: 'Mansellion', depth: 100, points: 100 },
];

const TIER_KEYS = TIERS.map(t => t.key);
const TIER_BY_KEY = Object.fromEntries(TIERS.map(t => [t.key, t]));
const MAX_PROMPTS_PER_DAY = 5;
const MAX_POINTS_PER_PROMPT = Math.max(...TIERS.map(t => t.points));

module.exports = { TIERS, TIER_KEYS, TIER_BY_KEY, MAX_PROMPTS_PER_DAY, MAX_POINTS_PER_PROMPT };
