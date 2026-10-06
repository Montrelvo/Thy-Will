export const PROTOCOL_VERSION = 3;
export const SNAPSHOT_VERSION = 3;
export type EntityId = string;
export interface Position { x: number; z: number }
export interface Transform { position: Position; rotationY: number }
export interface Stats { walkSpeed: number; sprintSpeed: number }
export interface Health { current: number; maximum: number }
export interface CombatState { targetId: EntityId | null; nextAttackTick: number }
export interface Entity { id: EntityId; transform: Transform; stats: Stats; health: Health; kind?: 'player' | 'enemy'; combat?: CombatState }

export type LootDefinitionId = 'iron-shard' | 'worn-blade';
export type ItemAffixId = 'keen' | 'fleet';
export type EquipmentSlot = 'weapon' | 'offhand';
export interface ItemAffix { id: ItemAffixId; roll: number }
export interface CollectedItem { id: string; definitionId: LootDefinitionId; quantity: number; affixes: ItemAffix[] }
export interface LootDrop extends CollectedItem { position: Position }
export interface EquipmentSlots { weapon: string | null; offhand: string | null }
export interface EquipmentState { entityId: EntityId; slots: EquipmentSlots }
export interface DerivedStats { walkSpeed: number; sprintSpeed: number; attackDamage: number }

export type RejectionReason =
  | 'unknown-entity'
  | 'dead-entity'
  | 'invalid-target'
  | 'out-of-range'
  | 'cooldown'
  | 'loot-unavailable'
  | 'inventory-full'
  | 'item-unavailable'
  | 'item-not-equippable';

export type GameCommand =
  | { type: 'Move'; entityId: EntityId; direction: Position; sprint: boolean }
  | { type: 'ResetPosition'; entityId: EntityId }
  | { type: 'Target'; entityId: EntityId; targetId: EntityId }
  | { type: 'Attack'; entityId: EntityId }
  | { type: 'PickUp'; entityId: EntityId; lootId: string }
  | { type: 'EquipItem'; entityId: EntityId; itemId: string };

export type GameEvent =
  | { type: 'EntitySpawned'; tick: number; entity: Entity }
  | { type: 'EntityMoved'; tick: number; entityId: EntityId; position: Position }
  | { type: 'PositionReset'; tick: number; entityId: EntityId }
  | { type: 'CommandRejected'; tick: number; entityId: EntityId; reason: RejectionReason }
  | { type: 'TargetSelected'; tick: number; entityId: EntityId; targetId: EntityId }
  | { type: 'AttackStarted'; tick: number; entityId: EntityId; targetId: EntityId }
  | { type: 'DamageApplied'; tick: number; entityId: EntityId; targetId: EntityId; amount: number; remainingHealth: number }
  | { type: 'EntityKilled'; tick: number; entityId: EntityId; killerId: EntityId }
  | { type: 'ItemDropped'; tick: number; loot: LootDrop }
  | { type: 'ItemPickedUp'; tick: number; entityId: EntityId; item: CollectedItem }
  | { type: 'ItemEquipped'; tick: number; entityId: EntityId; itemId: string; slot: EquipmentSlot };

export interface WorldSnapshot {
  schemaVersion: typeof SNAPSHOT_VERSION;
  protocolVersion: typeof PROTOCOL_VERSION;
  tick: number;
  random: { algorithm: 'lcg32'; state: number };
  entities: Entity[];
  loot: LootDrop[];
  inventories: { entityId: EntityId; items: CollectedItem[] }[];
  equipment: EquipmentState[];
}
