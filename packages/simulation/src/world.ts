import { PROTOCOL_VERSION, SNAPSHOT_VERSION, type Entity, type EntityId, type GameCommand, type GameEvent, type WorldSnapshot } from '@thy-will/protocol';
import { ARENA_LIMIT } from './movement.js';
import { SeededRandom, type RandomService } from './random.js';
import { parseSnapshot, validateEntity } from './snapshot.js';

export const TICK_SECONDS = 1 / 50;
export class Simulation {
  private readonly entities = new Map<EntityId, Entity>();
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
  /** Trusted local command boundary; external transport validation comes later. */
  apply(command: GameCommand): void {
    if (typeof command.entityId !== 'string' || !command.entityId || command.entityId.length > 128) throw new TypeError('Invalid entity id');
    if (this.commands.length >= 1024) throw new RangeError('Command queue full');
    if (command.type === 'Move') {
      if (![command.direction.x, command.direction.z].every(Number.isFinite) || typeof command.sprint !== 'boolean') throw new TypeError('Invalid movement intent');
      this.commands.push({ ...command, direction: { ...command.direction } });
    } else if (command.type === 'ResetPosition') this.commands.push({ ...command });
    else throw new TypeError('Unsupported command');
  }
  /** One fixed step; each entity consumes its latest command once per tick. */
  step(): void {
    if (this.tick >= Number.MAX_SAFE_INTEGER) throw new RangeError('Tick overflow');
    this.currentTick++;
    const latest = new Map<EntityId, GameCommand>();
    for (const command of this.commands) latest.set(command.entityId, command);
    this.commands = [];
    for (const command of latest.values()) {
      const entity = this.entities.get(command.entityId);
      if (!entity) { this.events.push({ type: 'CommandRejected', tick: this.tick, entityId: command.entityId, reason: 'unknown-entity' }); continue; }
      if (command.type === 'ResetPosition') {
        entity.transform = { position: { x: 0, z: 0 }, rotationY: 0 };
        this.events.push({ type: 'PositionReset', tick: this.tick, entityId: entity.id });
        continue;
      }
      if (entity.health.current === 0) continue;
      const { x, z } = command.direction;
      const magnitude = Math.hypot(x, z);
      const scale = magnitude > 1 ? 1 / magnitude : 1;
      const distance = (command.sprint ? entity.stats.sprintSpeed : entity.stats.walkSpeed) * TICK_SECONDS;
      const clamp = (n: number) => Math.max(-ARENA_LIMIT, Math.min(ARENA_LIMIT, n));
      const before = entity.transform.position;
      const position = { x: clamp(before.x + x * scale * distance), z: clamp(before.z + z * scale * distance) };
      entity.transform.position = position;
      if (magnitude > 0) entity.transform.rotationY = Math.atan2(x, z);
      if (position.x !== before.x || position.z !== before.z) this.events.push({ type: 'EntityMoved', tick: this.tick, entityId: entity.id, position: { ...position } });
    }
  }
  drainEvents(): GameEvent[] { const result = this.events; this.events = []; return result; }
  /** Snapshots capture settled state; commands/events are transient session data. */
  snapshot(): WorldSnapshot {
    if (this.commands.length) throw new Error('Snapshot requires a settled tick boundary');
    return parseSnapshot({ schemaVersion: SNAPSHOT_VERSION, protocolVersion: PROTOCOL_VERSION, tick: this.tick, random: this.random.snapshot(), entities: [...this.entities.values()] });
  }
  static restore(value: unknown): Simulation {
    const snapshot = parseSnapshot(value);
    const world = new Simulation(new SeededRandom(snapshot.random.state));
    world.currentTick = snapshot.tick;
    for (const entity of snapshot.entities) world.entities.set(entity.id, entity);
    return world;
  }
}
