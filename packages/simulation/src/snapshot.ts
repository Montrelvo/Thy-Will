import { PROTOCOL_VERSION, SNAPSHOT_VERSION, type Entity, type WorldSnapshot, type LootDrop, type CollectedItem, type ItemAffix } from '@thy-will/protocol';
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

function affix(value: unknown): ItemAffix {
  const data = record(value);
  if (data['id'] !== 'keen' && data['id'] !== 'fleet') throw new TypeError('Unknown item affix');
  return { id: data['id'], roll: number(data['roll'], 0, 10) };
}
function item(value: unknown, legacy = false): CollectedItem {
  const data = record(value);
  if (data['definitionId'] !== 'iron-shard' && data['definitionId'] !== 'worn-blade') throw new TypeError('Unknown loot definition');
  const affixes = legacy ? [] : collection(data['affixes'], 8).map(affix);
  return { id: id(data['id'], 256), definitionId: data['definitionId'], quantity: integer(data['quantity'], 1, 999), affixes };
}
function collection(value: unknown, limit: number): unknown[] {
  if (!Array.isArray(value) || value.length > limit) throw new RangeError('Invalid collection'); return value;
}

/** Schema 1 and 2 checkpoints migrate to schema 3 with explicit affixes/equipment. */
export function parseSnapshot(value: unknown): WorldSnapshot {
  const data = record(value);
  const legacy1 = data['schemaVersion'] === 1 && data['protocolVersion'] === 1;
  const legacy2 = data['schemaVersion'] === 2 && data['protocolVersion'] === 2;
  if (!legacy1 && !legacy2 && (data['schemaVersion'] !== SNAPSHOT_VERSION || data['protocolVersion'] !== PROTOCOL_VERSION)) throw new RangeError('Unsupported snapshot version');

  const tick = integer(data['tick'], 0, Number.MAX_SAFE_INTEGER);
  const random = record(data['random']); const state = integer(random['state'], 0, 0xffffffff);
  if (random['algorithm'] !== 'lcg32') throw new RangeError('Unsupported random state');

  const entities = collection(data['entities'], 10000).map(validateEntity);
  const byId = new Map(entities.map(entity => [entity.id, entity]));
  if (byId.size !== entities.length) throw new RangeError('Duplicate entity id');
  for (const entity of entities) if (entity.combat?.targetId !== null && entity.combat?.targetId !== undefined && byId.get(entity.combat.targetId)?.kind !== 'enemy') throw new RangeError('Invalid target reference');

  const legacyItems = legacy1 || legacy2;
  const loot: LootDrop[] = legacy1 ? [] : collection(data['loot'], 10000).map(value => ({ ...item(value, legacyItems), position: position(record(value)['position']) }));
  const inventories = legacy1 ? [] : collection(data['inventories'], 10000).map(value => {
    const entry = record(value); const entityId = id(entry['entityId']);
    if (byId.get(entityId)?.kind !== 'player') throw new RangeError('Invalid inventory owner');
    return { entityId, items: collection(entry['items'], 128).map(value => item(value, legacyItems)) };
  });
  if (new Set(inventories.map(entry => entry.entityId)).size !== inventories.length) throw new RangeError('Duplicate inventory owner');

  const items = [...loot, ...inventories.flatMap(entry => entry.items)];
  if (new Set(items.map(entry => entry.id)).size !== items.length) throw new RangeError('Duplicate item id');

  const equipment = legacyItems
    ? entities.filter(entity => entity.kind === 'player').map(entity => ({ entityId: entity.id, slots: { weapon: null, offhand: null } }))
    : collection(data['equipment'], 10000).map(value => {
      const entry = record(value); const entityId = id(entry['entityId']); const slots = record(entry['slots']);
      if (byId.get(entityId)?.kind !== 'player') throw new RangeError('Invalid equipment owner');
      const weapon = slots['weapon'] === null ? null : id(slots['weapon'], 256);
      const offhand = slots['offhand'] === null ? null : id(slots['offhand'], 256);
      const inventory = inventories.find(candidate => candidate.entityId === entityId)?.items ?? [];
      const validItem = (itemId: string | null, slot: 'weapon' | 'offhand') => {
        if (!itemId) return;
        const owned = inventory.find(candidate => candidate.id === itemId);
        if (!owned) throw new RangeError('Equipped item is not owned');
        if (slot === 'weapon' && owned.definitionId !== 'worn-blade') throw new RangeError('Item cannot occupy weapon slot');
        if (slot === 'offhand') throw new RangeError('No offhand items exist in this schema');
      };
      validItem(weapon, 'weapon'); validItem(offhand, 'offhand');
      return { entityId, slots: { weapon, offhand } };
    });
  if (new Set(equipment.map(entry => entry.entityId)).size !== equipment.length) throw new RangeError('Duplicate equipment owner');

  return {
    schemaVersion: SNAPSHOT_VERSION,
    protocolVersion: PROTOCOL_VERSION,
    tick,
    random: { algorithm: 'lcg32', state },
    entities,
    loot,
    inventories,
    equipment,
  };
}

export function serializeSnapshot(snapshot: WorldSnapshot): string { return JSON.stringify(parseSnapshot(snapshot)); }
export function deserializeSnapshot(text: string): WorldSnapshot {
  if (text.length > 4_000_000) throw new RangeError('Snapshot too large');
  return parseSnapshot(JSON.parse(text) as unknown);
}
