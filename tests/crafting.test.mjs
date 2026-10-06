import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  Simulation, SeededRandom, characterEntity, createCharacter,
  serializeSnapshot, deserializeSnapshot,
} from '@thy-will/simulation';

const ACTOR = 'crafter';
const item = (id, definitionId, quantity = 1, affixes = [], effects = []) => ({ id, definitionId, quantity, affixes, effects });

function worldWith(items, seed = 123, validator) {
  const base = new Simulation(new SeededRandom(seed));
  base.spawn(characterEntity(createCharacter(ACTOR)));
  base.drainEvents();
  const snapshot = base.snapshot();
  snapshot.inventories = [{ entityId: ACTOR, items }];
  return Simulation.restore(snapshot, validator);
}

function command(world, type, extra = {}) {
  world.apply({ type, entityId: ACTOR, ...extra });
  world.step();
  return world.drainEvents();
}

function craft(world, recipeId, targetItemId = null) {
  return command(world, 'CraftItem', { recipeId, targetItemId });
}

function quantity(world, definitionId) {
  return world.getInventory(ACTOR)
    .filter(candidate => candidate.definitionId === definitionId)
    .reduce((sum, candidate) => sum + candidate.quantity, 0);
}

test('component combining consumes exact costs across commands and produces unique item instances in one tick', () => {
  const world = worldWith([item('shards', 'iron-shard', 6)]);
  assert.deepEqual(world.getCraftOptions(ACTOR), [{ recipeId: 'refine-iron', targetItemId: null }]);

  world.apply({ type: 'CraftItem', entityId: ACTOR, recipeId: 'refine-iron', targetItemId: null });
  world.apply({ type: 'CraftItem', entityId: ACTOR, recipeId: 'refine-iron', targetItemId: null });
  world.step();
  const events = world.drainEvents();

  assert.deepEqual(events.map(event => event.type), ['ItemCrafted', 'ItemCrafted']);
  assert.equal(quantity(world, 'iron-shard'), 0);
  assert.equal(quantity(world, 'refined-iron'), 2);
  const refined = world.getInventory(ACTOR).filter(candidate => candidate.definitionId === 'refined-iron');
  assert.equal(new Set(refined.map(candidate => candidate.id)).size, 2);
  assert.ok(refined.every(candidate => candidate.affixes.length === 0 && candidate.effects.length === 0));
});

test('upgrade, add-modifier and attach-effect recipes change equipped derived stats and persist', () => {
  const blade = item('blade', 'worn-blade', 1, [{ id: 'keen', roll: 1 }]);
  const world = worldWith([blade, item('refined', 'refined-iron', 5)]);

  assert.equal(command(world, 'EquipItem', { itemId: 'blade' })[0].type, 'ItemEquipped');
  assert.deepEqual(world.getDerivedStats(ACTOR), { walkSpeed: 5, sprintSpeed: 9, attackDamage: 30 });

  assert.equal(craft(world, 'temper-worn-blade', 'blade')[0].type, 'ItemCrafted');
  assert.equal(craft(world, 'temper-worn-blade', 'blade')[0].type, 'ItemCrafted');
  assert.equal(craft(world, 'inscribe-worn-blade', 'blade')[0].type, 'ItemCrafted');
  assert.equal(craft(world, 'socket-worn-blade', 'blade')[0].type, 'ItemCrafted');

  const crafted = world.getInventory(ACTOR).find(candidate => candidate.id === 'blade');
  assert.deepEqual(crafted.affixes, [{ id: 'keen', roll: 2 }, { id: 'fleet', roll: 1 }]);
  assert.deepEqual(crafted.effects, ['honed-edge']);
  assert.equal(quantity(world, 'refined-iron'), 1);
  assert.deepEqual(world.getDerivedStats(ACTOR), { walkSpeed: 5.4, sprintSpeed: 9.6, attackDamage: 35 });

  assert.deepEqual(world.getCraftOptions(ACTOR), [{ recipeId: 'reroll-worn-blade', targetItemId: 'blade' }]);

  const restored = Simulation.restore(deserializeSnapshot(serializeSnapshot(world.snapshot())));
  assert.deepEqual(restored.getInventory(ACTOR), world.getInventory(ACTOR));
  assert.deepEqual(restored.getEquipment(ACTOR), { weapon: 'blade', offhand: null });
  assert.deepEqual(restored.getDerivedStats(ACTOR), world.getDerivedStats(ACTOR));
});

test('replace and reroll operations are data-driven and deterministic from simulation RNG', () => {
  const make = () => worldWith([
    item('blade', 'worn-blade', 1, [{ id: 'keen', roll: 1 }]),
    item('refined', 'refined-iron', 2),
  ], 77);
  const first = make();
  const second = make();

  for (const world of [first, second]) {
    assert.equal(craft(world, 'reforge-worn-blade', 'blade')[0].type, 'ItemCrafted');
    assert.deepEqual(
      world.getCraftOptions(ACTOR).map(option => option.recipeId),
      ['reroll-worn-blade', 'socket-worn-blade'],
    );
    assert.equal(craft(world, 'reroll-worn-blade', 'blade')[0].type, 'ItemCrafted');
  }

  assert.deepEqual(first.getInventory(ACTOR), second.getInventory(ACTOR));
  const rerolled = first.getInventory(ACTOR).find(candidate => candidate.id === 'blade').affixes[0];
  assert.ok(['keen', 'fleet'].includes(rerolled.id));
  assert.ok(rerolled.roll >= 0.8 && rerolled.roll <= 1.2);
  assert.equal(quantity(first, 'refined-iron'), 0);
});

test('invalid operations and validation hooks reject transactionally without consuming materials', () => {
  const duplicate = worldWith([
    item('blade', 'worn-blade', 1, [{ id: 'fleet', roll: 1 }]),
    item('refined', 'refined-iron', 1),
  ]);
  assert.ok(!duplicate.getCraftOptions(ACTOR).some(option => option.recipeId === 'inscribe-worn-blade'));
  const beforeDuplicate = duplicate.getInventory(ACTOR);
  assert.equal(craft(duplicate, 'inscribe-worn-blade', 'blade')[0].reason, 'crafting-operation-invalid');
  assert.deepEqual(duplicate.getInventory(ACTOR), beforeDuplicate);

  let validationContext;
  const guarded = worldWith([
    item('blade', 'worn-blade', 1, [{ id: 'keen', roll: 1 }]),
    item('refined', 'refined-iron', 1),
  ], 123, context => {
    validationContext = context;
    context.inventory[1].quantity = 999;
    context.targetItem.affixes.length = 0;
    return false;
  });
  const beforeGuard = guarded.getInventory(ACTOR);
  assert.equal(craft(guarded, 'temper-worn-blade', 'blade')[0].reason, 'crafting-validation-failed');
  assert.equal(validationContext.recipeId, 'temper-worn-blade');
  assert.deepEqual(guarded.getInventory(ACTOR), beforeGuard);

  const missing = worldWith([item('blade', 'worn-blade', 1, [{ id: 'keen', roll: 1 }])]);
  assert.equal(craft(missing, 'temper-worn-blade', 'blade')[0].reason, 'crafting-materials-missing');

  const wrongTarget = worldWith([
    item('blade', 'worn-blade', 1, [{ id: 'keen', roll: 1 }]),
    item('refined', 'refined-iron', 2),
  ]);
  assert.equal(craft(wrongTarget, 'temper-worn-blade', 'refined')[0].reason, 'crafting-target-invalid');
  assert.equal(quantity(wrongTarget, 'refined-iron'), 2);
});

test('schema 3 items migrate effects while schema 4 requires the current item shape', () => {
  const world = worldWith([
    item('blade', 'worn-blade', 1, [{ id: 'keen', roll: 1 }]),
  ]);
  const current = world.snapshot();

  const malformedCurrent = JSON.parse(JSON.stringify(current));
  delete malformedCurrent.inventories[0].items[0].effects;
  assert.throws(() => Simulation.restore(malformedCurrent));

  const legacy3 = JSON.parse(JSON.stringify(current));
  legacy3.schemaVersion = 3;
  legacy3.protocolVersion = 3;
  for (const entry of legacy3.inventories) for (const legacyItem of entry.items) delete legacyItem.effects;
  const restored = Simulation.restore(legacy3);
  assert.ok(restored.getInventory(ACTOR).every(candidate => Array.isArray(candidate.effects) && candidate.effects.length === 0));

  const unknownEffect = JSON.parse(JSON.stringify(current));
  unknownEffect.inventories[0].items[0].effects = ['unknown-effect'];
  assert.throws(() => Simulation.restore(unknownEffect));
});
