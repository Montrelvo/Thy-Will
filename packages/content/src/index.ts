// Data definitions will be added alongside the first playable systems.
export const CONTENT_VERSION = 1;

// Visual starter loadout definitions; gameplay item modifiers arrive in Step 5.
export const TRAINING_GEAR = {
  'training-sword': { label: 'Training sword', slot: 'weapon' },
  'training-shield': { label: 'Training shield', slot: 'offhand' },
} as const;

export const ARENA_ENEMY = { id: 'arena-sentinel', name: 'Arena sentinel', health: 60, position: { x: 0, z: 4 } } as const;
export const MELEE_ATTACK = { damage: 20, range: 2.6, cooldownTicks: 20 } as const;
export const PICKUP_RANGE = 2;
export const LOOT_DEFINITIONS = {
  'iron-shard': { label: 'Iron shard' },
  'worn-blade': { label: 'Worn blade' },
} as const;
export const ARENA_LOOT_TABLE = [
  { definitionId: 'iron-shard', weight: 3, minQuantity: 1, maxQuantity: 3 },
  { definitionId: 'worn-blade', weight: 1, minQuantity: 1, maxQuantity: 1 },
] as const;
