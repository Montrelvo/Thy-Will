import { PROTOCOL_VERSION, SNAPSHOT_VERSION, type Entity, type EntityId, type GameCommand, type GameEvent, type WorldSnapshot, type LootDrop, type CollectedItem, type RejectionReason } from '@thy-will/protocol';
import { ARENA_ENEMY, MELEE_ATTACK, PICKUP_RANGE, ARENA_LOOT_TABLE } from '@thy-will/content';
import { ARENA_LIMIT } from './movement.js';
import { SeededRandom, type RandomService } from './random.js';
import { parseSnapshot, validateEntity } from './snapshot.js';

export const TICK_SECONDS = 1 / 50;
const separation = (a: Entity, p: { x: number; z: number }) => Math.hypot(a.transform.position.x - p.x, a.transform.position.z - p.z);
export function createArenaEnemy(): Entity {
  return { id: ARENA_ENEMY.id, kind: 'enemy', transform: { position: { ...ARENA_ENEMY.position }, rotationY: Math.PI }, stats: { walkSpeed: 0, sprintSpeed: 0 }, health: { current: ARENA_ENEMY.health, maximum: ARENA_ENEMY.health } };
}
export class Simulation {
  private readonly entities = new Map<EntityId, Entity>();
  private readonly loot = new Map<string, LootDrop>();
  private readonly inventories = new Map<EntityId, CollectedItem[]>();
  private commands: GameCommand[] = [];
  private events: GameEvent[] = [];
  private currentTick = 0;
  constructor(readonly random: RandomService = new SeededRandom()) {}
  get tick(): number { return this.currentTick; }
  spawn(entity: Entity): void {
    const copy = validateEntity(entity);
    if (this.entities.has(copy.id) || this.entities.size >= 10000) throw new RangeError('Duplicate id or entity limit');
    this.entities.set(copy.id, copy);
    this.events.push({ type: 'EntitySpawned', tick: this.tick, entity: validateEntity(copy) });
  }
  getEntity(id: EntityId): Entity | undefined {
    const entity = this.entities.get(id); return entity ? validateEntity(entity) : undefined;
  }
  getEntities(): Entity[] { return [...this.entities.values()].map(validateEntity); }
  getLoot(): LootDrop[] { return [...this.loot.values()].map(drop => ({ ...drop, position: { ...drop.position } })); }
  getInventory(id: EntityId): CollectedItem[] { return (this.inventories.get(id) ?? []).map(item => ({ ...item })); }
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
    else if (command.type === 'ResetPosition' || command.type === 'Attack') this.commands.push({ ...command });
    else throw new TypeError('Unsupported command');
  }
  private reject(entityId: EntityId, reason: RejectionReason): void { this.events.push({ type: 'CommandRejected', tick: this.tick, entityId, reason }); }
  private dropLoot(entity: Entity): void {
    const total = ARENA_LOOT_TABLE.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = this.random.next() * total;
    let entry: typeof ARENA_LOOT_TABLE[number] = ARENA_LOOT_TABLE[0];
    for (const candidate of ARENA_LOOT_TABLE) { entry = candidate; roll -= candidate.weight; if (roll < 0) break; }
    const drop: LootDrop = { id: `loot-${entity.id}-${this.tick}`, definitionId: entry.definitionId, quantity: entry.minQuantity + Math.floor(this.random.next() * (entry.maxQuantity - entry.minQuantity + 1)), position: { ...entity.transform.position } };
    this.loot.set(drop.id, drop);
    this.events.push({ type: 'ItemDropped', tick: this.tick, loot: { ...drop, position: { ...drop.position } } });
  }
  private process(command: GameCommand): void {
    const entity = this.entities.get(command.entityId);
    if (!entity) { this.reject(command.entityId, 'unknown-entity'); return; }
    if (entity.health.current === 0) { if (command.type !== 'Move') this.reject(entity.id, 'dead-entity'); return; }
    if (command.type === 'Move') {
      const { x, z } = command.direction; const magnitude = Math.hypot(x, z); const scale = magnitude > 1 ? 1 / magnitude : 1;
      const distance = (command.sprint ? entity.stats.sprintSpeed : entity.stats.walkSpeed) * TICK_SECONDS;
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
      const damage = Math.min(MELEE_ATTACK.damage, target.health.current); target.health.current -= damage;
      this.events.push({ type: 'DamageApplied', tick: this.tick, entityId: entity.id, targetId: target.id, amount: damage, remainingHealth: target.health.current });
      if (target.health.current === 0) {
        this.events.push({ type: 'EntityKilled', tick: this.tick, entityId: target.id, killerId: entity.id });
        this.dropLoot(target);
      }
      return;
    }
    const drop = this.loot.get(command.lootId);
    if (!drop) { this.reject(entity.id, 'loot-unavailable'); return; }
    if (separation(entity, drop.position) > PICKUP_RANGE) { this.reject(entity.id, 'out-of-range'); return; }
    const inventory = this.inventories.get(entity.id) ?? [];
    if (inventory.length >= 128) { this.reject(entity.id, 'inventory-full'); return; }
    const item = { id: drop.id, definitionId: drop.definitionId, quantity: drop.quantity };
    inventory.push(item); this.inventories.set(entity.id, inventory); this.loot.delete(drop.id);
    this.events.push({ type: 'ItemPickedUp', tick: this.tick, entityId: entity.id, item: { ...item } });
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
    return parseSnapshot({ schemaVersion: SNAPSHOT_VERSION, protocolVersion: PROTOCOL_VERSION, tick: this.tick, random: this.random.snapshot(), entities: [...this.entities.values()], loot: this.getLoot(), inventories: [...this.inventories].map(([entityId, items]) => ({ entityId, items })) });
  }
  static restore(value: unknown): Simulation {
    const snapshot = parseSnapshot(value); const world = new Simulation(new SeededRandom(snapshot.random.state)); world.currentTick = snapshot.tick;
    for (const entity of snapshot.entities) world.entities.set(entity.id, entity);
    for (const drop of snapshot.loot) world.loot.set(drop.id, drop);
    for (const entry of snapshot.inventories) world.inventories.set(entry.entityId, entry.items);
    return world;
  }
}
