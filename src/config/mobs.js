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

export const MOBS_BY_ID = new Map(MOBS.map((m) => [m.id, m]));

/** Every species that lives in a biome, for the spawner to choose among. */
export function mobsForBiome(biomeId) {
  return MOBS.filter((m) => m.biomes.includes(biomeId));
}
