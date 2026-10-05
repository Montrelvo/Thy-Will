import { PROTOCOL_VERSION, SNAPSHOT_VERSION, type Entity, type WorldSnapshot } from '@thy-will/protocol';
import { ARENA_LIMIT } from './movement.js';

function record(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Expected object');
  return value as Record<string, unknown>;
}
function number(value: unknown, min = -Infinity, max = Infinity): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new RangeError('Invalid numeric state');
  return value;
}
export function validateEntity(value: unknown): Entity {
  const entity = record(value);
  if (typeof entity['id'] !== 'string' || entity['id'].length === 0 || entity['id'].length > 128) throw new TypeError('Invalid entity id');
  const transform = record(entity['transform']); const position = record(transform['position']);
  const stats = record(entity['stats']); const health = record(entity['health']);
  const maximum = number(health['maximum'], 1);
  return {
    id: entity['id'],
    transform: { position: { x: number(position['x'], -ARENA_LIMIT, ARENA_LIMIT), z: number(position['z'], -ARENA_LIMIT, ARENA_LIMIT) }, rotationY: number(transform['rotationY']) },
    stats: { walkSpeed: number(stats['walkSpeed'], 0, 100), sprintSpeed: number(stats['sprintSpeed'], 0, 100) },
    health: { current: number(health['current'], 0, maximum), maximum },
  };
}
/** Accept unknown data, validate it, and construct fresh plain records. */
export function parseSnapshot(value: unknown): WorldSnapshot {
  const data = record(value);
  if (data['schemaVersion'] !== SNAPSHOT_VERSION || data['protocolVersion'] !== PROTOCOL_VERSION) throw new RangeError('Unsupported snapshot version');
  const tick = number(data['tick'], 0, Number.MAX_SAFE_INTEGER);
  if (!Number.isInteger(tick)) throw new RangeError('Invalid tick');
  const random = record(data['random']); const state = number(random['state'], 0, 0xffffffff);
  if (random['algorithm'] !== 'lcg32' || !Number.isInteger(state)) throw new RangeError('Unsupported random state');
  if (!Array.isArray(data['entities']) || data['entities'].length > 10000) throw new RangeError('Invalid entity collection');
  const entities = data['entities'].map(validateEntity);
  if (new Set(entities.map(entity => entity.id)).size !== entities.length) throw new RangeError('Duplicate entity id');
  return { schemaVersion: SNAPSHOT_VERSION, protocolVersion: PROTOCOL_VERSION, tick, random: { algorithm: 'lcg32', state }, entities };
}
export function serializeSnapshot(snapshot: WorldSnapshot): string { return JSON.stringify(parseSnapshot(snapshot)); }
export function deserializeSnapshot(text: string): WorldSnapshot {
  if (text.length > 4_000_000) throw new RangeError('Snapshot too large');
  return parseSnapshot(JSON.parse(text) as unknown);
}
