import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Simulation, SeededRandom, createArenaEnemy, characterEntity, createCharacter, serializeSnapshot, deserializeSnapshot } from '@thy-will/simulation';

function encounter(z = 2.1, seed = 123) {
  const world = new Simulation(new SeededRandom(seed));
  const actor = characterEntity(createCharacter('fighter')); actor.transform.position.z = z;
  world.spawn(actor); world.spawn(createArenaEnemy()); world.drainEvents(); return world;
}
function action(world, type, extra = {}) { world.apply({ type, entityId: 'fighter', ...extra }); world.step(); return world.drainEvents(); }
function select(world) { action(world, 'Target', { targetId: 'arena-sentinel' }); }
function ready(world) { while (world.tick < world.getEntity('fighter').combat.nextAttackTick) world.step(); }
function kill(world) { select(world); for (let i = 0; i < 3; i++) { ready(world); action(world, 'Attack'); } }

test('target, damage, cooldown, death, seeded drop and atomic pickup form one headless loop', () => {
  const world = encounter(); select(world);
  assert.deepEqual(action(world, 'Attack').map(e => e.type), ['AttackStarted', 'DamageApplied']);
  assert.equal(world.getEntity('arena-sentinel').health.current, 40);
  assert.equal(action(world, 'Attack')[0].reason, 'cooldown');
  ready(world); action(world, 'Attack'); ready(world);
  world.apply({ type: 'Attack', entityId: 'fighter' }); world.apply({ type: 'Attack', entityId: 'fighter' }); world.step();
  const events = world.drainEvents();
  assert.deepEqual(events.map(e => e.type), ['AttackStarted', 'DamageApplied', 'EntityKilled', 'ItemDropped', 'CommandRejected']);
  assert.equal(world.getLoot().length, 1); assert.equal(world.getEntity('arena-sentinel').health.current, 0);
  const drop = world.getLoot()[0];
  world.apply({ type: 'PickUp', entityId: 'fighter', lootId: drop.id }); world.apply({ type: 'PickUp', entityId: 'fighter', lootId: drop.id }); world.step();
  assert.deepEqual(world.drainEvents().map(e => e.type), ['ItemPickedUp', 'CommandRejected']);
  assert.equal(world.getLoot().length, 0); assert.equal(world.getInventory('fighter').length, 1);
  assert.deepEqual(Simulation.restore(deserializeSnapshot(serializeSnapshot(world.snapshot()))).snapshot(), world.snapshot());
  const detached = world.getInventory('fighter'); detached[0].quantity = 999;
  assert.equal(world.getInventory('fighter')[0].quantity, drop.quantity);
});

test('range, invalid targets, dead actors and pickup distance cannot bypass combat rules', () => {
  const world = encounter(0);
  assert.equal(action(world, 'Attack')[0].reason, 'invalid-target');
  assert.equal(action(world, 'Target', { targetId: 'fighter' })[0].reason, 'invalid-target');
  select(world); assert.equal(action(world, 'Attack')[0].reason, 'out-of-range');
  assert.equal(world.getEntity('arena-sentinel').health.current, 60);
  assert.equal(world.getEntity('fighter').combat.nextAttackTick, 0);
  const near = encounter(); kill(near); const drop = near.getLoot()[0];
  action(near, 'ResetPosition'); assert.equal(action(near, 'PickUp', { lootId: drop.id })[0].reason, 'out-of-range');
  assert.equal(near.getLoot().length, 1);
  const snapshot = near.snapshot(); snapshot.entities.find(e => e.id === 'fighter').health.current = 0;
  const dead = Simulation.restore(snapshot); assert.equal(action(dead, 'Attack')[0].reason, 'dead-entity');
  assert.equal(action(dead, 'PickUp', { lootId: drop.id })[0].reason, 'dead-entity');
});

test('movement and ordered actions coexist on a tick; restored RNG and cooldown reproduce the fight', () => {
  const world = encounter(1.35); select(world);
  world.apply({ type: 'Move', entityId: 'fighter', direction: { x: 0, z: 1 }, sprint: false });
  const events = action(world, 'Attack');
  assert.deepEqual(events.map(e => e.type), ['EntityMoved', 'AttackStarted', 'DamageApplied']);
  const restored = Simulation.restore(world.snapshot());
  assert.equal(action(restored, 'Attack')[0].reason, 'cooldown'); action(world, 'Attack');
  for (const w of [world, restored]) { ready(w); action(w, 'Attack'); ready(w); action(w, 'Attack'); }
  assert.deepEqual(restored.snapshot(), world.snapshot());
});

test('snapshot validation rejects item duplication, invalid owners and targets; schema 1 migrates', () => {
  const world = encounter(); kill(world); const original = world.snapshot();
  for (const mutate of [
    s => s.loot.push(s.loot[0]), s => { s.loot[0].quantity = 0; }, s => { s.loot[0].definitionId = 'unknown'; },
    s => { s.entities[0].combat.targetId = 'missing'; },
    s => { s.inventories = [{ entityId: 'arena-sentinel', items: [] }]; },
    s => { s.inventories = [{ entityId: 'fighter', items: [s.loot[0]] }]; },
    s => { s.equipment = [{ entityId: 'fighter', slots: { weapon: 'missing', offhand: null } }]; },
  ]) { const invalid = JSON.parse(JSON.stringify(original)); mutate(invalid); assert.throws(() => Simulation.restore(invalid)); }
  const legacy = { ...original, schemaVersion: 1, protocolVersion: 1 }; delete legacy.loot; delete legacy.inventories; delete legacy.equipment;
  assert.deepEqual(Simulation.restore(legacy).getLoot(), []);
  const legacy2 = JSON.parse(JSON.stringify(original)); legacy2.schemaVersion = 2; legacy2.protocolVersion = 2; delete legacy2.equipment;
  for (const item of [...legacy2.loot, ...legacy2.inventories.flatMap(entry => entry.items)]) delete item.affixes;
  assert.deepEqual(Simulation.restore(legacy2).getEquipment('fighter'), { weapon: null, offhand: null });
});

test('inventory capacity rejects pickup without destroying the ground drop', () => {
  const world = encounter(); kill(world); const snapshot = world.snapshot();
  snapshot.inventories = [{ entityId: 'fighter', items: Array.from({ length: 128 }, (_, i) => ({ id: `old-${i}`, definitionId: 'iron-shard', quantity: 1, affixes: [] })) }];
  const full = Simulation.restore(snapshot); const drop = full.getLoot()[0];
  assert.equal(action(full, 'PickUp', { lootId: drop.id })[0].reason, 'inventory-full');
  assert.equal(full.getLoot().length, 1); assert.equal(full.getInventory('fighter').length, 128);
});


test('Step 5 equipment instances change derived stats and combat without moving rules into presentation', () => {
  const world = encounter(2.1, 1327); kill(world);
  const drop = world.getLoot()[0];
  assert.equal(drop.definitionId, 'worn-blade');
  assert.deepEqual(drop.affixes, [{ id: 'keen', roll: 1 }]);
  action(world, 'PickUp', { lootId: drop.id });
  assert.deepEqual(world.getDerivedStats('fighter'), { walkSpeed: 5, sprintSpeed: 9, attackDamage: 20 });
  assert.equal(action(world, 'EquipItem', { itemId: drop.id })[0].type, 'ItemEquipped');
  assert.deepEqual(world.getEquipment('fighter'), { weapon: drop.id, offhand: null });
  assert.deepEqual(world.getDerivedStats('fighter'), { walkSpeed: 5, sprintSpeed: 9, attackDamage: 30 });

  const restored = Simulation.restore(deserializeSnapshot(serializeSnapshot(world.snapshot())));
  assert.deepEqual(restored.getEquipment('fighter'), world.getEquipment('fighter'));
  assert.deepEqual(restored.getDerivedStats('fighter'), world.getDerivedStats('fighter'));

  const nextEnemy = createArenaEnemy(); nextEnemy.id = 'second-sentinel'; nextEnemy.transform.position.z = 2.2;
  restored.spawn(nextEnemy); restored.drainEvents();
  action(restored, 'Target', { targetId: 'second-sentinel' });
  const hit = action(restored, 'Attack').find(event => event.type === 'DamageApplied');
  assert.equal(hit.amount, 30);
  assert.equal(restored.getEntity('second-sentinel').health.current, 30);
});

test('Step 5 rejects missing and non-equippable inventory items', () => {
  const world = encounter();
  assert.equal(action(world, 'EquipItem', { itemId: 'missing' })[0].reason, 'item-unavailable');
  kill(world); const drop = world.getLoot()[0];
  action(world, 'PickUp', { lootId: drop.id });
  if (drop.definitionId === 'iron-shard') {
    assert.equal(action(world, 'EquipItem', { itemId: drop.id })[0].reason, 'item-not-equippable');
  }
});
