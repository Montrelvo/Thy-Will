import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCharacter, parseCharacter, characterEntity } from '@thy-will/simulation';

test('character record round trip retains identity, loadout, appearance and progression', () => {
  const character = createCharacter('local-1'); character.appearance.palette = 'crimson'; character.equipment.weapon = null;
  const restored = parseCharacter(JSON.parse(JSON.stringify(character)));
  assert.deepEqual(restored, character);
  const entity = characterEntity(restored);
  assert.equal(entity.id, 'local-1'); assert.equal(entity.health.current, 100);
  entity.stats.walkSpeed = 99; assert.equal(restored.stats.walkSpeed, 5);
  assert.equal(restored.ownerUid, null);
});
test('character validation rejects unsupported records without implicit migration', () => {
  for (const change of [
    c => { c.schemaVersion = 2; }, c => { c.characterId = ''; }, c => { c.appearance.palette = 'unknown'; },
    c => { c.equipment.weapon = 'unowned-sword'; }, c => { c.progression.level = 0; },
    c => { c.stats.walkSpeed = Infinity; }, c => { c.maximumHealth = -1; },
  ]) { const character = createCharacter('local-1'); change(character); assert.throws(() => parseCharacter(character)); }
});
