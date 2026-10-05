// Data definitions will be added alongside the first playable systems.
export const CONTENT_VERSION = 1;

// Visual starter loadout definitions; gameplay item modifiers arrive in Step 5.
export const TRAINING_GEAR = {
  'training-sword': { label: 'Training sword', slot: 'weapon' },
  'training-shield': { label: 'Training shield', slot: 'offhand' },
} as const;
