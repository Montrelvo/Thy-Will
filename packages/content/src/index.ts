export const CONTENT_VERSION = 2;

export const TRAINING_GEAR = {
  'training-sword': { label: 'Training sword', slot: 'weapon' },
  'training-shield': { label: 'Training shield', slot: 'offhand' },
} as const;

export const ARENA_ENEMY = { id: 'arena-sentinel', name: 'Arena sentinel', health: 60, position: { x: 0, z: 4 } } as const;
export const MELEE_ATTACK = { damage: 20, range: 2.6, cooldownTicks: 20 } as const;
export const PICKUP_RANGE = 2;

export const ITEM_AFFIXES = {
  keen: { label: 'Keen', modifiers: { attackDamage: 3, walkSpeed: 0, sprintSpeed: 0 } },
  fleet: { label: 'Fleet', modifiers: { attackDamage: 0, walkSpeed: 0.4, sprintSpeed: 0.6 } },
} as const;

export const ITEM_DEFINITIONS = {
  'iron-shard': {
    label: 'Iron shard',
    kind: 'material',
    modifiers: { attackDamage: 0, walkSpeed: 0, sprintSpeed: 0 },
  },
  'worn-blade': {
    label: 'Worn blade',
    kind: 'equipment',
    slot: 'weapon',
    modifiers: { attackDamage: 7, walkSpeed: 0, sprintSpeed: 0 },
    affixPool: ['keen'],
  },
} as const;

export const LOOT_DEFINITIONS = ITEM_DEFINITIONS;
export const ARENA_LOOT_TABLE = [
  { definitionId: 'iron-shard', weight: 3, minQuantity: 1, maxQuantity: 3 },
  { definitionId: 'worn-blade', weight: 1, minQuantity: 1, maxQuantity: 1 },
] as const;
