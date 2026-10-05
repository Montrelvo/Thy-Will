export type PlayMode = 'inspection' | 'arena';
export const GAME_MODES = {
  inspection: { label: 'Character', available: true },
  arena: { label: 'Arena', available: true },
  story: { label: 'Story · later', available: false },
} as const;
export function initialMode(touch: boolean): PlayMode { return touch ? 'inspection' : 'arena'; }
