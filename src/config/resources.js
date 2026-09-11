// Resource tiers. A resource becomes spendable once its tier is unlocked;
// tier 1 is unlocked from the start, the rest are gated behind the structures
// added in later phases. Storage caps bound idle accrual.
export const RESOURCES = [
  { id: 'wood', name: 'Wood', tier: 1, color: 0x8a5a2b, baseCap: 500 },
  { id: 'stone', name: 'Stone', tier: 2, color: 0x8a8a8d, baseCap: 400 },
  { id: 'brick', name: 'Brick', tier: 3, color: 0xa8422f, baseCap: 300 },
  { id: 'glass', name: 'Glass', tier: 4, color: 0xbfe3f0, baseCap: 250 },
  { id: 'gold', name: 'Gold', tier: 5, color: 0xf4c542, baseCap: 150 },
];

export const RESOURCES_BY_ID = new Map(RESOURCES.map((r) => [r.id, r]));

/** Enough for a few dozen blocks and a mistake or two. */
export const STARTING_STOCK = { wood: 120 };

export const STARTING_TIER = 1;

export function resourceName(id) {
  return RESOURCES_BY_ID.get(id)?.name ?? id;
}
