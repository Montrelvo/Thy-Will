export const PROTOCOL_VERSION = 1;
export const SNAPSHOT_VERSION = 1;
export type EntityId = string;
export interface Position { x: number; z: number }
export interface Transform { position: Position; rotationY: number }
export interface Stats { walkSpeed: number; sprintSpeed: number }
export interface Health { current: number; maximum: number }
export interface Entity { id: EntityId; transform: Transform; stats: Stats; health: Health }
export type GameCommand =
  | { type: 'Move'; entityId: EntityId; direction: Position; sprint: boolean }
  | { type: 'ResetPosition'; entityId: EntityId };
export type GameEvent =
  | { type: 'EntitySpawned'; tick: number; entity: Entity }
  | { type: 'EntityMoved'; tick: number; entityId: EntityId; position: Position }
  | { type: 'PositionReset'; tick: number; entityId: EntityId }
  | { type: 'CommandRejected'; tick: number; entityId: EntityId; reason: 'unknown-entity' };
export interface WorldSnapshot {
  schemaVersion: typeof SNAPSHOT_VERSION;
  protocolVersion: typeof PROTOCOL_VERSION;
  tick: number;
  random: { algorithm: 'lcg32'; state: number };
  entities: Entity[];
}
