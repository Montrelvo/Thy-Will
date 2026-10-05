import { PROTOCOL_VERSION, SNAPSHOT_VERSION, type Entity, type WorldSnapshot, type LootDrop, type CollectedItem } from '@thy-will/protocol';
import { ARENA_LIMIT } from './movement.js';

function record(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Expected object');
  return value as Record<string, unknown>;
}
function number(value: unknown, min = -Infinity, max = Infinity): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new RangeError('Invalid numeric state');
  return value;
}
function integer(value: unknown, min: number, max: number): number {
  const n = number(value, min, max); if (!Number.isInteger(n)) throw new RangeError('Expected integer'); return n;
}
function id(value: unknown, max = 128): string {
  if (typeof value !== 'string' || !value.length || value.length > max) throw new TypeError('Invalid id'); return value;
}
function position(value: unknown) {
  const p = record(value); return { x: number(p['x'], -ARENA_LIMIT, ARENA_LIMIT), z: number(p['z'], -ARENA_LIMIT, ARENA_LIMIT) };
}
export function validateEntity(value: unknown): Entity {
  const entity = record(value); const transform = record(entity['transform']);
  const stats = record(entity['stats']); const health = record(entity['health']);
  const maximum = number(health['maximum'], 1);
  const result: Entity = {
    id: id(entity['id']), transform: { position: position(transform['position']), rotationY: number(transform['rotationY']) },
    stats: { walkSpeed: number(stats['walkSpeed'], 0, 100), sprintSpeed: number(stats['sprintSpeed'], 0, 100) },
    health: { current: number(health['current'], 0, maximum), maximum },
  };
  if (entity['kind'] !== undefined) {
    if (entity['kind'] !== 'player' && entity['kind'] !== 'enemy') throw new TypeError('Invalid entity kind');
    result.kind = entity['kind'];
  }
  if (entity['combat'] !== undefined) {
    if (result.kind !== 'player') throw new TypeError('Only players have attack state in this slice');
    const combat = record(entity['combat']);
    result.combat = { targetId: combat['targetId'] === null ? null : id(combat['targetId']), nextAttackTick: integer(combat['nextAttackTick'], 0, Number.MAX_SAFE_INTEGER) };
  }
  return result;
}
function item(value: unknown): CollectedItem {
  const data = record(value);
  if (data['definitionId'] !== 'iron-shard' && data['definitionId'] !== 'worn-blade') throw new TypeError('Unknown loot definition');
  return { id: id(data['id'], 256), definitionId: data['definitionId'], quantity: integer(data['quantity'], 1, 999) };
}
function collection(value: unknown, limit: number): unknown[] {
  if (!Array.isArray(value) || value.length > limit) throw new RangeError('Invalid collection'); return value;
}
/** Schema 1 checkpoints migrate to schema 2 with empty ground loot and inventories. */
export function parseSnapshot(value: unknown): WorldSnapshot {
  const data = record(value);
  const legacy = data['schemaVersion'] === 1 && data['protocolVersion'] === 1;
  if (!legacy && (data['schemaVersion'] !== SNAPSHOT_VERSION || data['protocolVersion'] !== PROTOCOL_VERSION)) throw new RangeError('Unsupported snapshot version');
  const tick = integer(data['tick'], 0, Number.MAX_SAFE_INTEGER);
  const random = record(data['random']); const state = integer(random['state'], 0, 0xffffffff);
  if (random['algorithm'] !== 'lcg32') throw new RangeError('Unsupported random state');
  const entities = collection(data['entities'], 10000).map(validateEntity);
  const byId = new Map(entities.map(entity => [entity.id, entity]));
  if (byId.size !== entities.length) throw new RangeError('Duplicate entity id');
  for (const entity of entities) if (entity.combat?.targetId !== null && entity.combat?.targetId !== undefined && byId.get(entity.combat.targetId)?.kind !== 'enemy') throw new RangeError('Invalid target reference');
  const loot: LootDrop[] = legacy ? [] : collection(data['loot'], 10000).map(value => ({ ...item(value), position: position(record(value)['position']) }));
  const inventories = legacy ? [] : collection(data['inventories'], 10000).map(value => {
    const entry = record(value); const entityId = id(entry['entityId']);
    if (byId.get(entityId)?.kind !== 'player') throw new RangeError('Invalid inventory owner');
    return { entityId, items: collection(entry['items'], 128).map(item) };
  });
  if (new Set(inventories.map(entry => entry.entityId)).size !== inventories.length) throw new RangeError('Duplicate inventory owner');
  const items = [...loot, ...inventories.flatMap(entry => entry.items)];
  if (new Set(items.map(entry => entry.id)).size !== items.length) throw new RangeError('Duplicate item id');
  return { schemaVersion: SNAPSHOT_VERSION, protocolVersion: PROTOCOL_VERSION, tick, random: { algorithm: 'lcg32', state }, entities, loot, inventories };
}
export function serializeSnapshot(snapshot: WorldSnapshot): string { return JSON.stringify(parseSnapshot(snapshot)); }
export function deserializeSnapshot(text: string): WorldSnapshot {
  if (text.length > 4_000_000) throw new RangeError('Snapshot too large');
  return parseSnapshot(JSON.parse(text) as unknown);
}
