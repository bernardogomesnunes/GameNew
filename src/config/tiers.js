/**
 * Tiers for tools and weapons (backlog batch 2): "stone, iron, gold, sky and
 * dark, for swords, axes, shovels and armour".
 *
 * Stone is the first tier and is the plain Stone Axe, Pickaxe and Shovel
 * already in config/items.js (and the Stone Sword). Each tier past it is a
 * full set — axe, pickaxe, shovel and sword — made at the bench from wood and
 * its own metal, from the age that metal is first to hand:
 *
 *   iron   Age 4, from the foundry: lasts, and hits harder;
 *   gold   Age 5, from the mine: hits hard, but soft — wears sooner than iron;
 *   sky    Age 6, sky marble and gold: the Sky Kingdom's own, the best there is;
 *   dark   Age 6, dark stone and iron: the Stone Kingdom's, a hair heavier.
 *
 * A better tool is never slower — a stone one already takes what it's suited
 * to near enough at once — so what a tier changes is how long it lasts, how
 * hard it hits, and the wrong job: past stone, nothing is out of reach and
 * nothing slowed (a metal axe will take a swing at stone, slowly).
 *
 * Armour has its tiers in config/armour.js.
 */

export const TOOL_TIERS = [
  { key: 'iron', name: 'Iron', age: 4, durability: 300, color: 0xc9ced6, edge: 0xeef1f5, guard: 0xe2c26a, metal: 'iron_ingot', extra: {}, bonus: 1, sword: 9 },
  { key: 'gold', name: 'Gold', age: 5, durability: 200, color: 0xf0cf62, edge: 0xfbe7a1, guard: 0xb8862e, metal: 'gold', extra: {}, bonus: 1, sword: 10 },
  { key: 'sky', name: 'Sky', age: 6, durability: 500, color: 0xe6ebf2, edge: 0xffffff, guard: 0xe2c26a, metal: 'sky_marble', extra: { gold: 1 }, bonus: 2, sword: 12 },
  { key: 'dark', name: 'Dark', age: 6, durability: 500, color: 0x3f3c45, edge: 0x6a6574, guard: 0x9a2c2c, metal: 'dark_stone', extra: { iron_ingot: 1 }, bonus: 3, sword: 13 },
];

/** The four kinds in every tier: the stone tool each is modelled on, and how much metal it takes. */
const KINDS = [
  { kind: 'axe', base: 'axe', name: 'Axe', metal: 3, blurb: 'Cuts trees in a stroke' },
  { kind: 'pickaxe', base: 'pickaxe', name: 'Pickaxe', metal: 3, blurb: 'Breaks stone in a stroke' },
  { kind: 'shovel', base: 'shovel', name: 'Shovel', metal: 2, blurb: 'Digs dirt and sand in a stroke' },
  { kind: 'sword', base: 'sword_stone', name: 'Sword', metal: 3, blurb: 'Fighting bandits' },
];

/** A tier's id for a kind: `axe_iron` — and the iron sword, which came first, keeps its `sword_iron`. */
export const tieredId = (kind, tier) => (kind === 'sword' ? `sword_${tier}` : `${kind}_${tier}`);

/** Past stone, the wrong job is only slow, and a slow one goes at the ordinary pace. */
function upgraded(effectiveness = {}) {
  const out = {};
  for (const [m, e] of Object.entries(effectiveness)) out[m] = e === 'impossible' ? 'slow' : e === 'slow' ? 'normal' : e;
  return out;
}

/**
 * Every tiered tool, as an item, given the stone ones to model them on.
 * `sword_iron` is left out: it's in items.js already, from before tiers.
 */
export function tieredItems(itemsById) {
  const out = [];
  for (const t of TOOL_TIERS) {
    for (const k of KINDS) {
      const id = tieredId(k.kind, t.key);
      if (id === 'sword_iron') continue;
      const base = itemsById.get(k.base);
      out.push({
        ...base,
        id, name: `${t.name} ${k.name}`, color: t.color, tier: t.key,
        durability: k.kind === 'sword' ? Math.round(t.durability * 1.2) : t.durability,
        madeBy: `Crafted at the bench from ${t.name === 'Sky' ? 'sky marble and gold' : t.name === 'Dark' ? 'dark stone and iron' : t.name.toLowerCase()}`,
        damage: k.kind === 'sword' ? t.sword : (base.damage ?? 1) + t.bonus,
        effectiveness: k.kind === 'sword' ? base.effectiveness : upgraded(base.effectiveness),
      });
    }
  }
  return out;
}

/** The bench recipe for every tiered tool. */
export function tieredRecipes() {
  const out = [];
  for (const t of TOOL_TIERS) {
    for (const k of KINDS) {
      const id = tieredId(k.kind, t.key);
      if (id === 'sword_iron') continue;
      out.push({
        id, name: `${t.name} ${k.name}`, station: 'hand', age: t.age,
        inputs: { wood: 2, [t.metal]: k.metal, ...t.extra }, output: { id, count: 1 },
        blurb: `${k.blurb}. ${t.key === 'gold' ? 'Hits hard, but gold is soft — it wears sooner than iron.' : t.key === 'iron' ? 'Lasts longer than stone, hits harder.' : 'The best there is.'}`,
      });
    }
  }
  return out;
}
