// Legacy bootstrap movement helper; the client now uses Simulation commands.
export interface Position { x: number; z: number }
export interface MovementIntent { x: number; z: number; sprint: boolean }
export const ARENA_LIMIT = 18;
export const WALK_SPEED = 5;
export const SPRINT_SPEED = 9;

export function advancePosition(position: Position, intent: MovementIntent, seconds: number): Position {
  if (![position.x, position.z, intent.x, intent.z, seconds].every(Number.isFinite)) {
    throw new RangeError('Movement values must be finite');
  }
  const magnitude = Math.hypot(intent.x, intent.z);
  const scale = magnitude > 1 ? 1 / magnitude : 1;
  const distance = (intent.sprint ? SPRINT_SPEED : WALK_SPEED) * Math.max(0, Math.min(seconds, 0.05));
  const clamp = (value: number) => Math.max(-ARENA_LIMIT, Math.min(ARENA_LIMIT, value));
  return { x: clamp(position.x + intent.x * scale * distance), z: clamp(position.z + intent.z * scale * distance) };
}
