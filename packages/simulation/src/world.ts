import {
  PROTOCOL_VERSION, SNAPSHOT_VERSION,
  type Entity, type EntityId, type GameCommand, type GameEvent, type WorldSnapshot,
  type LootDrop, type CollectedItem, type RejectionReason, type EquipmentState,
  type DerivedStats, type CraftOption, type CraftRecipeId,
} from '@thy-will/protocol';
import {
  ARENA_ENEMY, MELEE_ATTACK, PICKUP_RANGE, ARENA_LOOT_TABLE,
  ITEM_DEFINITIONS, ITEM_AFFIXES, ITEM_EFFECTS, CRAFTING_RECIPES,
} from '@thy-will/content';
import { ARENA_LIMIT } from './movement.js';
import { SeededRandom, type RandomService } from './random.js';
import { parseSnapshot, validateEntity } from './snapshot.js';

export const TICK_SECONDS = 1 / 50;
const separation = (a: Entity, p: { x: number; z: number }) => Math.hypot(a.transform.position.x - p.x, a.transform.position.z - p.z);

export interface CraftValidationContext {
  entityId: EntityId;
  recipeId: CraftRecipeId;
  targetItem: CollectedItem | null;
  inventory: CollectedItem[];
}
export type CraftValidationHook = (context: CraftValidationContext) => boolean;

export function createArenaEnemy(): Entity {
  return { id: ARENA_ENEMY.id, kind: 'enemy', transform: { position: { ...ARENA_ENEMY.position }, rotationY: Math.PI }, stats: { walkSpeed: 0, sprintSpeed: 0 }, health: { current: ARENA_ENEMY.health, maximum: ARENA_ENEMY.health } };
}

function cloneItem(item: CollectedItem): CollectedItem {
  return { ...item, affixes: item.affixes.map(affix => ({ ...affix })), effects: [...item.effects] };
}
function hasCosts(inventory: CollectedItem[], costs: readonly { definitionId: string; quantity: number }[]): boolean {
  return costs.every(cost => inventory.filter(item => item.definitionId === cost.definitionId).reduce((sum, item) => sum + item.quantity, 0) >= cost.quantity);
}
function consumeCosts(inventory: CollectedItem[], costs: readonly { definitionId: string; quantity: number }[]): void {
  for (const cost of costs) {
    let remaining = cost.quantity;
    for (let i = inventory.length - 1; i >= 0 && remaining > 0; i--) {
      const item = inventory[i];
      if (item.definitionId !== cost.definitionId) continue;
      const used = Math.min(remaining, item.quantity);
      item.quantity -= used; remaining -= used;
      if (item.quantity === 0) inventory.splice(i, 1);
    }
  }
}

type CraftOperation = (typeof CRAFTING_RECIPES)[keyof typeof CRAFTING_RECIPES]['operations'][number];

function canApplyOperation(target: CollectedItem | null, operation: CraftOperation): boolean {
  if (operation.type === 'combine-components') return true;
  if (!target) return false;
  if (operation.type === 'add-modifier') return target.affixes.length < 8 && !target.affixes.some(affix => affix.id === operation.affixId);
  if (operation.type === 'upgrade-value') {
    const affix = target.affixes.find(candidate => candidate.id === operation.affixId);
    return !!affix && affix.roll < operation.maximum;
  }
  if (operation.type === 'replace-modifier') {
    const index = target.affixes.findIndex(candidate => candidate.id === operation.fromAffixId);
    return index >= 0 && !target.affixes.some((candidate, i) => i !== index && candidate.id === operation.toAffixId);
  }
  if (operation.type === 'reroll-modifier') return operation.affixIndex >= 0 && operation.affixIndex < target.affixes.length && operation.pool.length > 0;
  return target.effects.length < 4 && !target.effects.includes(operation.effectId);
}

export class Simulation {
  private readonly entities = new Map<EntityId, Entity>();
  private readonly loot = new Map<string, LootDrop>();
  private readonly inventories = new Map<EntityId, CollectedItem[]>();
  private readonly equipment = new Map<EntityId, EquipmentState['slots']>();
  private commands: GameCommand[] = [];
  private events: GameEvent[] = [];
  private currentTick = 0;

  constructor(readonly random: RandomService = new SeededRandom(), private readonly craftValidator?: CraftValidationHook) {}
  get tick(): number { return this.currentTick; }

  spawn(entity: Entity): void {
    const copy = validateEntity(entity);
    if (this.entities.has(copy.id) || this.entities.size >= 10000) throw new RangeError('Duplicate id or entity limit');
    this.entities.set(copy.id, copy);
    if (copy.kind === 'player') this.equipment.set(copy.id, { weapon: null, offhand: null });
    this.events.push({ type: 'EntitySpawned', tick: this.tick, entity: validateEntity(copy) });
  }

  getEntity(id: EntityId): Entity | undefined {
    const entity = this.entities.get(id); return entity ? validateEntity(entity) : undefined;
  }
  getEntities(): Entity[] { return [...this.entities.values()].map(validateEntity); }
  getLoot(): LootDrop[] { return [...this.loot.values()].map(drop => ({ ...cloneItem(drop), position: { ...drop.position } })); }
  getInventory(id: EntityId): CollectedItem[] { return (this.inventories.get(id) ?? []).map(cloneItem); }
  getEquipment(id: EntityId): EquipmentState['slots'] {
    const slots = this.equipment.get(id) ?? { weapon: null, offhand: null };
    return { ...slots };
  }

  getDerivedStats(id: EntityId): DerivedStats | undefined {
    const entity = this.entities.get(id); if (!entity) return undefined;
    const result: DerivedStats = { walkSpeed: entity.stats.walkSpeed, sprintSpeed: entity.stats.sprintSpeed, attackDamage: MELEE_ATTACK.damage };
    const inventory = this.inventories.get(id) ?? [];
    const slots = this.equipment.get(id);
    for (const itemId of slots ? Object.values(slots) : []) {
      if (!itemId) continue;
      const item = inventory.find(candidate => candidate.id === itemId); if (!item) continue;
      const definition = ITEM_DEFINITIONS[item.definitionId];
      result.walkSpeed += definition.modifiers.walkSpeed ?? 0;
      result.sprintSpeed += definition.modifiers.sprintSpeed ?? 0;
      result.attackDamage += definition.modifiers.attackDamage ?? 0;
      for (const affix of item.affixes) {
        const modifiers = ITEM_AFFIXES[affix.id].modifiers;
        result.walkSpeed += (modifiers.walkSpeed ?? 0) * affix.roll;
        result.sprintSpeed += (modifiers.sprintSpeed ?? 0) * affix.roll;
        result.attackDamage += (modifiers.attackDamage ?? 0) * affix.roll;
      }
      for (const effectId of item.effects) {
        const modifiers = ITEM_EFFECTS[effectId].modifiers;
        result.walkSpeed += modifiers.walkSpeed ?? 0;
        result.sprintSpeed += modifiers.sprintSpeed ?? 0;
        result.attackDamage += modifiers.attackDamage ?? 0;
      }
    }
    return result;
  }

  getCraftOptions(id: EntityId): CraftOption[] {
    const entity = this.entities.get(id);
    if (!entity || entity.kind !== 'player' || entity.health.current === 0) return [];
    const inventory = this.inventories.get(id) ?? [];
    const options: CraftOption[] = [];
    for (const recipeId of Object.keys(CRAFTING_RECIPES) as CraftRecipeId[]) {
      const recipe = CRAFTING_RECIPES[recipeId];
      if (!hasCosts(inventory, recipe.costs)) continue;
      if (recipe.targetDefinitionId === null) {
        if (recipe.operations.every(operation => canApplyOperation(null, operation))) options.push({ recipeId, targetItemId: null });
      } else {
        for (const item of inventory) {
          if (item.definitionId === recipe.targetDefinitionId && recipe.operations.every(operation => canApplyOperation(item, operation))) {
            options.push({ recipeId, targetItemId: item.id });
          }
        }
      }
    }
    return options;
  }

  nearestTarget(id: EntityId): EntityId | undefined {
    const actor = this.entities.get(id); if (!actor) return undefined;
    return [...this.entities.values()].filter(entity => entity.kind === 'enemy' && entity.health.current > 0)
      .sort((a, b) => separation(actor, a.transform.position) - separation(actor, b.transform.position))[0]?.id;
  }
  nearestLoot(id: EntityId): string | undefined {
    const actor = this.entities.get(id); if (!actor) return undefined;
    return [...this.loot.values()].sort((a, b) => separation(actor, a.position) - separation(actor, b.position))[0]?.id;
  }

  /** Trusted local command boundary; remote ownership/authentication comes later. */
  apply(command: GameCommand): void {
    const validId = (value: unknown, max = 128) => typeof value === 'string' && value.length > 0 && value.length <= max;
    if (!validId(command.entityId)) throw new TypeError('Invalid entity id');
    if (this.commands.length >= 1024) throw new RangeError('Command queue full');
    if (command.type === 'Move') {
      if (![command.direction.x, command.direction.z].every(Number.isFinite) || typeof command.sprint !== 'boolean') throw new TypeError('Invalid movement intent');
      this.commands.push({ ...command, direction: { ...command.direction } });
    } else if (command.type === 'Target' && validId(command.targetId)) this.commands.push({ ...command });
    else if (command.type === 'PickUp' && validId(command.lootId, 256)) this.commands.push({ ...command });
    else if (command.type === 'EquipItem' && validId(command.itemId, 256)) this.commands.push({ ...command });
    else if (command.type === 'CraftItem' && command.recipeId in CRAFTING_RECIPES && (command.targetItemId === null || validId(command.targetItemId, 256))) this.commands.push({ ...command });
    else if (command.type === 'ResetPosition' || command.type === 'Attack') this.commands.push({ ...command });
    else throw new TypeError('Unsupported command');
  }

  private reject(entityId: EntityId, reason: RejectionReason): void {
    this.events.push({ type: 'CommandRejected', tick: this.tick, entityId, reason });
  }

  private dropLoot(entity: Entity): void {
    const total = ARENA_LOOT_TABLE.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = this.random.next() * total;
    let entry: typeof ARENA_LOOT_TABLE[number] = ARENA_LOOT_TABLE[0];
    for (const candidate of ARENA_LOOT_TABLE) { entry = candidate; roll -= candidate.weight; if (roll < 0) break; }
    const affixes = entry.definitionId === 'worn-blade' ? [{ id: 'keen' as const, roll: 1 }] : [];
    const drop: LootDrop = {
      id: `loot-${entity.id}-${this.tick}`,
      definitionId: entry.definitionId,
      quantity: entry.minQuantity + Math.floor(this.random.next() * (entry.maxQuantity - entry.minQuantity + 1)),
      affixes,
      effects: [],
      position: { ...entity.transform.position },
    };
    this.loot.set(drop.id, drop);
    this.events.push({ type: 'ItemDropped', tick: this.tick, loot: { ...cloneItem(drop), position: { ...drop.position } } });
  }

  private craft(entity: Entity, command: Extract<GameCommand, { type: 'CraftItem' }>): void {
    const recipe = CRAFTING_RECIPES[command.recipeId];
    if (!recipe) { this.reject(entity.id, 'crafting-recipe-invalid'); return; }
    const source = this.inventories.get(entity.id) ?? [];
    if (!hasCosts(source, recipe.costs)) { this.reject(entity.id, 'crafting-materials-missing'); return; }

    const target = command.targetItemId === null ? null : source.find(item => item.id === command.targetItemId) ?? null;
    if ((recipe.targetDefinitionId === null && target !== null) ||
        (recipe.targetDefinitionId !== null && (!target || target.definitionId !== recipe.targetDefinitionId))) {
      this.reject(entity.id, 'crafting-target-invalid'); return;
    }
    const context: CraftValidationContext = {
      entityId: entity.id,
      recipeId: command.recipeId,
      targetItem: target ? cloneItem(target) : null,
      inventory: source.map(cloneItem),
    };
    if (!recipe.operations.every(operation => canApplyOperation(target, operation))) { this.reject(entity.id, 'crafting-operation-invalid'); return; }
    if (this.craftValidator && !this.craftValidator(context)) { this.reject(entity.id, 'crafting-validation-failed'); return; }

    const working = source.map(cloneItem);
    const workingTarget = target ? working.find(item => item.id === target.id) ?? null : null;
    consumeCosts(working, recipe.costs);
    const createdItems: CollectedItem[] = [];

    try {
      for (const operation of recipe.operations) {
        if (operation.type === 'combine-components') {
          if (working.length >= 128) throw new Error('inventory-full');
          const created: CollectedItem = {
            id: `craft-${entity.id}-${this.tick}-${working.length + createdItems.length}`,
            definitionId: operation.output.definitionId,
            quantity: operation.output.quantity,
            affixes: [],
            effects: [],
          };
          working.push(created); createdItems.push(created);
          continue;
        }
        if (!workingTarget) throw new Error('crafting-operation-invalid');
        if (operation.type === 'add-modifier') {
          if (workingTarget.affixes.length >= 8 || workingTarget.affixes.some(affix => affix.id === operation.affixId)) throw new Error('crafting-operation-invalid');
          workingTarget.affixes.push({ id: operation.affixId, roll: operation.roll });
        } else if (operation.type === 'upgrade-value') {
          const affix = workingTarget.affixes.find(candidate => candidate.id === operation.affixId);
          if (!affix) throw new Error('crafting-operation-invalid');
          affix.roll = Math.min(operation.maximum, affix.roll + operation.amount);
        } else if (operation.type === 'replace-modifier') {
          const index = workingTarget.affixes.findIndex(candidate => candidate.id === operation.fromAffixId);
          if (index < 0 || workingTarget.affixes.some((candidate, i) => i !== index && candidate.id === operation.toAffixId)) throw new Error('crafting-operation-invalid');
          workingTarget.affixes[index] = { id: operation.toAffixId, roll: operation.roll };
        } else if (operation.type === 'reroll-modifier') {
          const existing = workingTarget.affixes[operation.affixIndex];
          if (!existing) throw new Error('crafting-operation-invalid');
          const poolIndex = Math.min(operation.pool.length - 1, Math.floor(this.random.next() * operation.pool.length));
          existing.id = operation.pool[poolIndex];
          existing.roll = operation.minimumRoll + this.random.next() * (operation.maximumRoll - operation.minimumRoll);
        } else if (operation.type === 'attach-effect') {
          if (workingTarget.effects.length >= 4 || workingTarget.effects.includes(operation.effectId)) throw new Error('crafting-operation-invalid');
          workingTarget.effects.push(operation.effectId);
        }
      }
    } catch (error) {
      this.reject(entity.id, error instanceof Error && error.message === 'inventory-full' ? 'inventory-full' : 'crafting-operation-invalid');
      return;
    }

    this.inventories.set(entity.id, working);
    this.events.push({
      type: 'ItemCrafted',
      tick: this.tick,
      entityId: entity.id,
      recipeId: command.recipeId,
      targetItemId: command.targetItemId,
      createdItems: createdItems.map(cloneItem),
      updatedItem: workingTarget ? cloneItem(workingTarget) : null,
    });
  }

  private process(command: GameCommand): void {
    const entity = this.entities.get(command.entityId);
    if (!entity) { this.reject(command.entityId, 'unknown-entity'); return; }
    if (entity.health.current === 0) { if (command.type !== 'Move') this.reject(entity.id, 'dead-entity'); return; }

    if (command.type === 'Move') {
      const { x, z } = command.direction; const magnitude = Math.hypot(x, z); const scale = magnitude > 1 ? 1 / magnitude : 1;
      const derived = this.getDerivedStats(entity.id)!;
      const distance = (command.sprint ? derived.sprintSpeed : derived.walkSpeed) * TICK_SECONDS;
      const clamp = (n: number) => Math.max(-ARENA_LIMIT, Math.min(ARENA_LIMIT, n));
      const before = entity.transform.position;
      const position = { x: clamp(before.x + x * scale * distance), z: clamp(before.z + z * scale * distance) };
      entity.transform.position = position;
      if (magnitude > 0) entity.transform.rotationY = Math.atan2(x, z);
      if (position.x !== before.x || position.z !== before.z) this.events.push({ type: 'EntityMoved', tick: this.tick, entityId: entity.id, position: { ...position } });
      return;
    }
    if (command.type === 'ResetPosition') {
      entity.transform = { position: { x: 0, z: 0 }, rotationY: 0 };
      this.events.push({ type: 'PositionReset', tick: this.tick, entityId: entity.id }); return;
    }
    if (entity.kind !== 'player' || !entity.combat) { this.reject(entity.id, 'invalid-target'); return; }

    if (command.type === 'Target') {
      const target = this.entities.get(command.targetId);
      if (!target || target.kind !== 'enemy' || target.health.current === 0) { this.reject(entity.id, 'invalid-target'); return; }
      entity.combat.targetId = target.id;
      this.events.push({ type: 'TargetSelected', tick: this.tick, entityId: entity.id, targetId: target.id }); return;
    }
    if (command.type === 'Attack') {
      const target = entity.combat.targetId ? this.entities.get(entity.combat.targetId) : undefined;
      if (!target || target.kind !== 'enemy' || target.health.current === 0) { this.reject(entity.id, 'invalid-target'); return; }
      if (separation(entity, target.transform.position) > MELEE_ATTACK.range) { this.reject(entity.id, 'out-of-range'); return; }
      if (this.tick < entity.combat.nextAttackTick) { this.reject(entity.id, 'cooldown'); return; }
      entity.combat.nextAttackTick = this.tick + MELEE_ATTACK.cooldownTicks;
      entity.transform.rotationY = Math.atan2(target.transform.position.x - entity.transform.position.x, target.transform.position.z - entity.transform.position.z);
      this.events.push({ type: 'AttackStarted', tick: this.tick, entityId: entity.id, targetId: target.id });
      const damage = Math.min(this.getDerivedStats(entity.id)!.attackDamage, target.health.current); target.health.current -= damage;
      this.events.push({ type: 'DamageApplied', tick: this.tick, entityId: entity.id, targetId: target.id, amount: damage, remainingHealth: target.health.current });
      if (target.health.current === 0) {
        this.events.push({ type: 'EntityKilled', tick: this.tick, entityId: target.id, killerId: entity.id });
        this.dropLoot(target);
      }
      return;
    }
    if (command.type === 'EquipItem') {
      const inventory = this.inventories.get(entity.id) ?? [];
      const item = inventory.find(candidate => candidate.id === command.itemId);
      if (!item) { this.reject(entity.id, 'item-unavailable'); return; }
      const definition = ITEM_DEFINITIONS[item.definitionId];
      if (definition.kind !== 'equipment' || !('slot' in definition)) { this.reject(entity.id, 'item-not-equippable'); return; }
      const slots = this.equipment.get(entity.id) ?? { weapon: null, offhand: null };
      slots[definition.slot] = item.id; this.equipment.set(entity.id, slots);
      this.events.push({ type: 'ItemEquipped', tick: this.tick, entityId: entity.id, itemId: item.id, slot: definition.slot });
      return;
    }
    if (command.type === 'CraftItem') { this.craft(entity, command); return; }

    const drop = this.loot.get(command.lootId);
    if (!drop) { this.reject(entity.id, 'loot-unavailable'); return; }
    if (separation(entity, drop.position) > PICKUP_RANGE) { this.reject(entity.id, 'out-of-range'); return; }
    const inventory = this.inventories.get(entity.id) ?? [];
    if (inventory.length >= 128) { this.reject(entity.id, 'inventory-full'); return; }
    const item = cloneItem(drop);
    inventory.push(item); this.inventories.set(entity.id, inventory); this.loot.delete(drop.id);
    this.events.push({ type: 'ItemPickedUp', tick: this.tick, entityId: entity.id, item: cloneItem(item) });
  }

  /** Latest movement/reset intent wins; actions retain their ordered sequence. */
  step(): void {
    if (this.tick >= Number.MAX_SAFE_INTEGER - MELEE_ATTACK.cooldownTicks) throw new RangeError('Tick overflow');
    this.currentTick++;
    const movements = new Map<EntityId, GameCommand>(); const actions: GameCommand[] = [];
    for (const command of this.commands) {
      if (command.type === 'Move' || command.type === 'ResetPosition') movements.set(command.entityId, command);
      else actions.push(command);
    }
    this.commands = [];
    for (const command of movements.values()) this.process(command);
    for (const command of actions) this.process(command);
  }

  drainEvents(): GameEvent[] { const result = this.events; this.events = []; return result; }

  snapshot(): WorldSnapshot {
    if (this.commands.length) throw new Error('Snapshot requires a settled tick boundary');
    return parseSnapshot({
      schemaVersion: SNAPSHOT_VERSION,
      protocolVersion: PROTOCOL_VERSION,
      tick: this.tick,
      random: this.random.snapshot(),
      entities: [...this.entities.values()],
      loot: this.getLoot(),
      inventories: [...this.inventories].map(([entityId, items]) => ({ entityId, items: items.map(cloneItem) })),
      equipment: [...this.equipment].map(([entityId, slots]) => ({ entityId, slots: { ...slots } })),
    });
  }

  static restore(value: unknown, craftValidator?: CraftValidationHook): Simulation {
    const snapshot = parseSnapshot(value); const world = new Simulation(new SeededRandom(snapshot.random.state), craftValidator); world.currentTick = snapshot.tick;
    for (const entity of snapshot.entities) world.entities.set(entity.id, entity);
    for (const drop of snapshot.loot) world.loot.set(drop.id, drop);
    for (const entry of snapshot.inventories) world.inventories.set(entry.entityId, entry.items.map(cloneItem));
    for (const entry of snapshot.equipment) world.equipment.set(entry.entityId, { ...entry.slots });
    return world;
  }
}
