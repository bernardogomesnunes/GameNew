/**
 * The animals: what lives where, how it looks, and what it leaves behind.
 *
 * Adding one is adding an entry, the same as blocks, items and biomes. Each
 * is drawn from a handful of boxes (see MobView), sized here in blocks:
 * `body` is width × height × length, `head` one edge of a cube, `leg` how
 * tall it stands. A creature is `leg + body.h` tall at the shoulder.
 * `legs` is 2 for birds, which stand on a pair under the middle; anything
 * else has four, one at each corner.
 *
 * `biomes` are ids from config/biomes.js. `herd` is how many turn up
 * together. `skittish` animals bolt when you come near; the rest only run
 * once they've been hit. `farm` marks the ones that can be led into a pen and
 * kept — that part arrives with ranching, but it's a fact about the animal,
 * so it's written down here now.
 *
 * `drops` are [min, max] of each item on a kill.
 */
export const MOBS = [
  {
    id: 'deer', name: 'Deer', biomes: ['forestOak', 'forestBirch', 'plains', 'giantGrove'], weight: 3,
    herd: [2, 4], hp: 6, walk: 1.5, run: 6.8, skittish: true,
    body: { w: 0.5, h: 0.55, l: 1.1 }, head: 0.34, leg: 0.6,
    colour: 0xb88a62, headColour: 0xc79c73, legColour: 0x8d6a4d,
    drops: { raw_meat: [2, 3], hide: [1, 2] },
  },
  {
    id: 'rabbit', name: 'Rabbit', biomes: ['plains', 'desert', 'forestBirch'], weight: 3,
    herd: [1, 3], hp: 2, walk: 1.3, run: 7.2, skittish: true,
    body: { w: 0.28, h: 0.26, l: 0.4 }, head: 0.2, leg: 0.1,
    colour: 0xcdbba4, headColour: 0xd9c9b3, legColour: 0xb8a58c,
    drops: { raw_meat: [1, 1], hide: [0, 1] },
  },
  {
    id: 'boar', name: 'Boar', biomes: ['forestDark', 'forestOak', 'giantGrove'], weight: 2,
    herd: [1, 3], hp: 9, walk: 1.2, run: 5.2, skittish: false,
    body: { w: 0.55, h: 0.55, l: 1.0 }, head: 0.4, leg: 0.3,
    colour: 0x6f5646, headColour: 0x5f4a3c, legColour: 0x4d3c31,
    drops: { raw_meat: [2, 4], hide: [1, 2] },
  },
  {
    id: 'goat', name: 'Goat', biomes: ['mountains1', 'mountains2'], weight: 3,
    herd: [2, 4], hp: 6, walk: 1.4, run: 5.8, skittish: true,
    body: { w: 0.42, h: 0.45, l: 0.8 }, head: 0.3, leg: 0.42,
    colour: 0xe4ddd0, headColour: 0xd6cfc2, legColour: 0x9c958a,
    drops: { raw_meat: [1, 2], hide: [1, 1] },
  },
  {
    id: 'sheep', name: 'Sheep', biomes: ['plains', 'mountains1'], weight: 3, farm: true,
    herd: [2, 5], hp: 5, walk: 1.1, run: 4.6, skittish: false,
    body: { w: 0.62, h: 0.55, l: 0.95 }, head: 0.32, leg: 0.34,
    colour: 0xf1ede4, headColour: 0x8a7a6a, legColour: 0x6f6257,
    drops: { raw_meat: [1, 2], wool: [1, 3] },
  },
  {
    id: 'cow', name: 'Cow', biomes: ['plains', 'wetland'], weight: 2, farm: true,
    herd: [2, 4], hp: 9, walk: 1.0, run: 4.4, skittish: false,
    body: { w: 0.75, h: 0.7, l: 1.35 }, head: 0.42, leg: 0.55,
    colour: 0x8c6a55, headColour: 0xe8e0d6, legColour: 0x6b5344,
    drops: { raw_meat: [3, 4], hide: [1, 2] },
  },
  {
    id: 'pig', name: 'Pig', biomes: ['plains', 'forestOak', 'wetland'], weight: 2, farm: true,
    herd: [2, 3], hp: 5, walk: 1.1, run: 4.8, skittish: false,
    body: { w: 0.55, h: 0.48, l: 0.85 }, head: 0.36, leg: 0.24,
    colour: 0xe9b3aa, headColour: 0xeebdb4, legColour: 0xd49a90,
    drops: { raw_meat: [2, 3] },
  },
  {
    id: 'chicken', name: 'Chicken', biomes: ['plains', 'forestOak', 'wetland'], weight: 2, farm: true,
    herd: [2, 4], hp: 2, walk: 0.9, run: 4.2, skittish: false,
    body: { w: 0.26, h: 0.28, l: 0.34 }, head: 0.18, leg: 0.18, legs: 2,
    colour: 0xf4efe6, headColour: 0xf8f4ec, legColour: 0xe0a64a,
    drops: { raw_meat: [1, 1], feather: [1, 3] },
  },
];

// The horse (asked for directly: "horses with wooden carts, at age 2 — you
// need to have a horse and build the cart and apply the cart to the horse").
// Wild on the plains and quick to bolt; hold fruit or vegetables and press
// Place on one to tame it (Game.tameHorse), then use a cart on it.
MOBS.push({
  id: 'horse', name: 'Horse', biomes: ['plains'], weight: 2,
  herd: [2, 3], hp: 12, walk: 1.4, run: 7.5, skittish: true,
  body: { w: 0.62, h: 0.75, l: 1.5 }, head: 0.42, leg: 0.9,
  colour: 0x8a5a36, headColour: 0x7a4e2e, legColour: 0x4a3020,
  drops: { raw_meat: [2, 3], hide: [1, 2] },
  tameWith: ['fruit', 'vegetables'], rideable: true,
});

// The Past's dinosaurs (world/past.js — asked for directly: "a separate
// world of dinosaurs ... dinosaurs hit hard ... taming: feed a dinosaur to
// tame it, then ride it"). Bigger and tougher than anything at home:
//   `hunts`    comes for you when you come near, and bites — the raptor;
//   `charges`  minds its own business until struck, then comes for you;
//   `neck`     a head carried up and out on a neck (MobView).
// Each is tamed by feeding it what it eats (`tameWith`), and ridden.
//   `fight`    how it fights for you once it's yours and following (the
//              whistle — Game.tickPack): a bite, a horn, a tail.
MOBS.push(
  {
    id: 'raptor', name: 'Raptor', biomes: ['pastJungle', 'pastFerns'], weight: 3,
    herd: [2, 3], hp: 18, walk: 2.2, run: 8.4, skittish: false,
    hunts: { aggro: 16, give: 30, damage: 3, reach: 1.8, every: 1.1 },
    body: { w: 0.42, h: 0.5, l: 1.1 }, head: 0.4, leg: 0.8, legs: 2,
    colour: 0x6d7f45, headColour: 0x7d8f50, legColour: 0x55633a,
    drops: { raw_meat: [2, 3], hide: [1, 1] },
    tameWith: ['raw_meat'], rideable: true,
    fight: { damage: 4, reach: 1.9, every: 1.0 },
  },
  {
    id: 'trike', name: 'Triceratops', biomes: ['pastFerns', 'pastJungle'], weight: 3,
    herd: [2, 3], hp: 40, walk: 1.0, run: 5.8, skittish: false,
    charges: { damage: 4, reach: 2.4, every: 1.4, for: 8 },
    body: { w: 1.4, h: 1.2, l: 2.6 }, head: 0.9, leg: 0.8,
    colour: 0x8a7a5a, headColour: 0x9a8a68, legColour: 0x6a5c42,
    drops: { raw_meat: [5, 8], hide: [2, 4] },
    tameWith: ['vegetables', 'fruit'], rideable: true,
    fight: { damage: 6, reach: 2.6, every: 1.4 },
  },
  {
    id: 'longneck', name: 'Long-neck', biomes: ['pastFerns'], weight: 2,
    herd: [1, 2], hp: 60, walk: 0.9, run: 3.6, skittish: false,
    body: { w: 1.8, h: 1.8, l: 3.6 }, head: 0.7, leg: 2.0, neck: { up: 3, out: 1.4, w: 0.55 },
    colour: 0x7f8a90, headColour: 0x8e999f, legColour: 0x646d72,
    drops: { raw_meat: [8, 12], hide: [3, 5] },
    tameWith: ['vegetables', 'fruit'], rideable: true,
    fight: { damage: 8, reach: 3.6, every: 2.2 },
  },
  // And the Past's one creature out of legend (D3: "dinosaurs and
  // mythological creatures"): the Basilisk, rare in the deep jungle — a
  // crowned serpent-lizard the length of a long-neck, that nobody tames.
  {
    id: 'basilisk', name: 'Basilisk', biomes: ['pastJungle'], weight: 0.4,
    herd: [1, 1], hp: 120, walk: 1.2, run: 6.4, skittish: false,
    hunts: { aggro: 20, give: 36, damage: 6, reach: 2.8, every: 1.6 },
    body: { w: 1.1, h: 0.85, l: 3.8 }, head: 0.95, leg: 0.45,
    colour: 0x2f4a2a, headColour: 0x3a5a32, legColour: 0x243a20,
    drops: { raw_meat: [6, 10], basilisk_scale: [2, 4] },
  },
);

export const MOBS_BY_ID = new Map(MOBS.map((m) => [m.id, m]));

/** Every species that lives in a biome, for the spawner to choose among. */
export function mobsForBiome(biomeId) {
  return MOBS.filter((m) => m.biomes.includes(biomeId));
}
