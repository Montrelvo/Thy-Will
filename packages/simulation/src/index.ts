import { CONTENT_VERSION } from "@thy-will/content";
import { PROTOCOL_VERSION } from "@thy-will/protocol";

// Shared headless compatibility boundary.
export const simulationCompatibility = Object.freeze({
  contentVersion: CONTENT_VERSION,
  protocolVersion: PROTOCOL_VERSION,
});

export { advancePosition, ARENA_LIMIT, WALK_SPEED, SPRINT_SPEED } from './movement.js';
export type { Position, MovementIntent } from './movement.js';
export { Simulation, TICK_SECONDS } from './world.js';
export { SeededRandom } from './random.js';
export type { RandomService } from './random.js';
export { parseSnapshot, serializeSnapshot, deserializeSnapshot } from './snapshot.js';
export type { EntityId, Entity, Transform, Stats, Health, GameCommand, GameEvent, WorldSnapshot } from '@thy-will/protocol';
