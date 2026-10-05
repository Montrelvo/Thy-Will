import { WALK_SPEED, SPRINT_SPEED } from './movement.js';
import type { Entity, Stats } from '@thy-will/protocol';

export const CHARACTER_VERSION = 1;
export type CharacterPalette = 'slate' | 'crimson';
export interface CharacterRecord {
  schemaVersion: typeof CHARACTER_VERSION;
  characterId: string;
  ownerUid: string | null;
  name: string;
  appearance: { palette: CharacterPalette };
  equipment: { weapon: 'training-sword' | null; offhand: 'training-shield' | null };
  progression: { level: number; experience: number; storyStageId: string | null };
  stats: Stats;
  maximumHealth: number;
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid character record');
  return value as Record<string, unknown>;
}
function text(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 128) throw new TypeError('Invalid character text');
  return value;
}
function number(value: unknown, min: number, max: number, integer = false): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) throw new RangeError('Invalid character value');
  return value;
}
export function parseCharacter(value: unknown): CharacterRecord {
  const data = object(value);
  if (data['schemaVersion'] !== CHARACTER_VERSION) throw new RangeError('Unsupported character version');
  const appearance = object(data['appearance']); const equipment = object(data['equipment']);
  const progression = object(data['progression']); const stats = object(data['stats']);
  if (appearance['palette'] !== 'slate' && appearance['palette'] !== 'crimson') throw new TypeError('Invalid palette');
  if (equipment['weapon'] !== null && equipment['weapon'] !== 'training-sword') throw new TypeError('Invalid weapon');
  if (equipment['offhand'] !== null && equipment['offhand'] !== 'training-shield') throw new TypeError('Invalid offhand');
  return {
    schemaVersion: CHARACTER_VERSION, characterId: text(data['characterId']),
    ownerUid: data['ownerUid'] === null ? null : text(data['ownerUid']), name: text(data['name']),
    appearance: { palette: appearance['palette'] }, equipment: { weapon: equipment['weapon'], offhand: equipment['offhand'] },
    progression: { level: number(progression['level'], 1, 1000000, true), experience: number(progression['experience'], 0, Number.MAX_SAFE_INTEGER, true), storyStageId: progression['storyStageId'] === null ? null : text(progression['storyStageId']) },
    stats: { walkSpeed: number(stats['walkSpeed'], 0, 100), sprintSpeed: number(stats['sprintSpeed'], 0, 100) },
    maximumHealth: number(data['maximumHealth'], 1, 1000000000),
  };
}
export function createCharacter(characterId: string): CharacterRecord {
  return parseCharacter({ schemaVersion: CHARACTER_VERSION, characterId, ownerUid: null, name: 'Wanderer', appearance: { palette: 'slate' }, equipment: { weapon: 'training-sword', offhand: 'training-shield' }, progression: { level: 1, experience: 0, storyStageId: null }, stats: { walkSpeed: WALK_SPEED, sprintSpeed: SPRINT_SPEED }, maximumHealth: 100 });
}
export function characterEntity(character: CharacterRecord): Entity {
  const record = parseCharacter(character);
  return { id: record.characterId, transform: { position: { x: 0, z: 0 }, rotationY: 0 }, stats: record.stats, health: { current: record.maximumHealth, maximum: record.maximumHealth } };
}
