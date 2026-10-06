export const CONTENT_VERSION = 3;

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

export const ITEM_EFFECTS = {
  'honed-edge': { label: 'Honed edge', modifiers: { attackDamage: 2, walkSpeed: 0, sprintSpeed: 0 } },
} as const;

export const ITEM_DEFINITIONS = {
  'iron-shard': {
    label: 'Iron shard',
    kind: 'material',
    modifiers: { attackDamage: 0, walkSpeed: 0, sprintSpeed: 0 },
  },
  'refined-iron': {
    label: 'Refined iron',
    kind: 'material',
    modifiers: { attackDamage: 0, walkSpeed: 0, sprintSpeed: 0 },
  },
  'worn-blade': {
    label: 'Worn blade',
    kind: 'equipment',
    slot: 'weapon',
    modifiers: { attackDamage: 7, walkSpeed: 0, sprintSpeed: 0 },
    affixPool: ['keen', 'fleet'],
  },
} as const;

export const LOOT_DEFINITIONS = ITEM_DEFINITIONS;
export const ARENA_LOOT_TABLE = [
  { definitionId: 'iron-shard', weight: 3, minQuantity: 1, maxQuantity: 3 },
  { definitionId: 'worn-blade', weight: 1, minQuantity: 1, maxQuantity: 1 },
] as const;

/**
 * Crafting is content data. The simulation interprets these operations generically;
 * presentation code never owns their costs, outcomes, or validation rules.
 */
export const CRAFTING_RECIPES = {
  'refine-iron': {
    label: 'Refine iron',
    targetDefinitionId: null,
    costs: [{ definitionId: 'iron-shard', quantity: 3 }],
    operations: [{ type: 'combine-components', output: { definitionId: 'refined-iron', quantity: 1 } }],
  },
  'temper-worn-blade': {
    label: 'Temper worn blade',
    targetDefinitionId: 'worn-blade',
    costs: [{ definitionId: 'refined-iron', quantity: 1 }],
    operations: [{ type: 'upgrade-value', affixId: 'keen', amount: 0.5, maximum: 2 }],
  },
  'inscribe-worn-blade': {
    label: 'Inscribe fleet',
    targetDefinitionId: 'worn-blade',
    costs: [{ definitionId: 'refined-iron', quantity: 1 }],
    operations: [{ type: 'add-modifier', affixId: 'fleet', roll: 1 }],
  },
  'reforge-worn-blade': {
    label: 'Reforge to fleet',
    targetDefinitionId: 'worn-blade',
    costs: [{ definitionId: 'refined-iron', quantity: 1 }],
    operations: [{ type: 'replace-modifier', fromAffixId: 'keen', toAffixId: 'fleet', roll: 1 }],
  },
  'reroll-worn-blade': {
    label: 'Reroll blade modifier',
    targetDefinitionId: 'worn-blade',
    costs: [{ definitionId: 'refined-iron', quantity: 1 }],
    operations: [{ type: 'reroll-modifier', affixIndex: 0, pool: ['keen', 'fleet'], minimumRoll: 0.8, maximumRoll: 1.2 }],
  },
  'socket-worn-blade': {
    label: 'Socket honed edge',
    targetDefinitionId: 'worn-blade',
    costs: [{ definitionId: 'refined-iron', quantity: 1 }],
    operations: [{ type: 'attach-effect', effectId: 'honed-edge' }],
  },
} as const;
