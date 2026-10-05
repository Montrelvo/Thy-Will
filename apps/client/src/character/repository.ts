import { createCharacter, parseCharacter, type CharacterRecord } from '@thy-will/simulation';

export const CHARACTER_STORAGE_KEY = 'thy-will.character.v1';
export interface CharacterRepository {
  load(): CharacterRecord;
  save(character: CharacterRecord): void;
  readonly status: 'saved' | 'session' | 'recovery';
}
/** Only profile changes write storage; simulation frames never write saves. */
export class LocalCharacterRepository implements CharacterRepository {
  private current: CharacterRecord;
  private state: CharacterRepository['status'] = 'session';
  private storage: Storage | undefined;
  get status(): CharacterRepository['status'] { return this.state; }
  constructor() {
    this.current = createCharacter(crypto.randomUUID());
    try {
      this.storage = window.localStorage;
      const stored = this.storage.getItem(CHARACTER_STORAGE_KEY);
      if (stored !== null) {
        try {
          if (stored.length > 100000) throw new RangeError('Character record too large');
          this.current = parseCharacter(JSON.parse(stored) as unknown);
        }
        catch { this.state = 'recovery'; return; } // Preserve unsupported/corrupt data.
      }
      this.save(this.current);
    } catch { this.storage = undefined; this.state = 'session'; }
  }
  load(): CharacterRecord { return parseCharacter(this.current); }
  save(character: CharacterRecord): void {
    const next = parseCharacter(character);
    if (next.characterId !== this.current.characterId) throw new Error('Character identity cannot change');
    this.current = next;
    if (!this.storage || this.state === 'recovery') return;
    try { this.storage.setItem(CHARACTER_STORAGE_KEY, JSON.stringify(next)); this.state = 'saved'; }
    catch { this.state = 'session'; }
  }
}
