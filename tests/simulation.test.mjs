import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Simulation, SeededRandom, TICK_SECONDS, serializeSnapshot, deserializeSnapshot } from '@thy-will/simulation';

function player(id = 'player') {
  return { id, transform: { position: { x: 0, z: 0 }, rotationY: 0 }, stats: { walkSpeed: 5, sprintSpeed: 9 }, health: { current: 100, maximum: 100 } };
}
function move(world, direction = { x: 1, z: 0 }, sprint = false, entityId = 'player') {
  world.apply({ type: 'Move', entityId, direction, sprint }); world.step();
}

test('Node authority spawns entities and consumes commands on fixed ticks with inspectable events', () => {
  const world = new Simulation(); const source = player(); world.spawn(source);
  source.health.current = 0;
  assert.equal(world.drainEvents()[0].type, 'EntitySpawned');
  world.apply({ type: 'Move', entityId: 'player', direction: { x: 1, z: 0 }, sprint: false });
  assert.equal(world.getEntity('player').transform.position.x, 0);
  world.step(); assert.equal(world.tick, 1);
  assert.equal(world.getEntity('player').transform.position.x, 5 * TICK_SECONDS);
  assert.deepEqual(world.drainEvents(), [{ type: 'EntityMoved', tick: 1, entityId: 'player', position: { x: 0.1, z: 0 } }]);
  world.step(); assert.equal(world.getEntity('player').transform.position.x, 0.1);
  const detached = world.getEntity('player'); detached.transform.position.x = 99;
  assert.equal(world.getEntity('player').transform.position.x, 0.1);
});

test('latest intent wins, movement normalizes, respects stats, bounds, reset and dead entities', () => {
  const world = new Simulation(); world.spawn(player()); world.drainEvents();
  world.apply({ type: 'Move', entityId: 'player', direction: { x: -1, z: 0 }, sprint: false });
  move(world, { x: 1, z: 1 }, true);
  const p = world.getEntity('player').transform.position;
  assert.ok(Math.abs(Math.hypot(p.x, p.z) - 9 * TICK_SECONDS) < 1e-12);
  for (let i = 0; i < 200; i++) { move(world, { x: 1, z: 0 }, true); world.drainEvents(); }
  assert.equal(world.getEntity('player').transform.position.x, 18);
  world.apply({ type: 'ResetPosition', entityId: 'player' }); world.step();
  assert.deepEqual(world.getEntity('player').transform.position, { x: 0, z: 0 });
  assert.equal(world.drainEvents().at(-1).type, 'PositionReset');
  const dead = player('dead'); dead.health.current = 0; world.spawn(dead);
  move(world, { x: 1, z: 0 }, false, 'dead');
  assert.equal(world.getEntity('dead').transform.position.x, 0);
});

test('invalid and unknown commands do not corrupt settled state; input is copied', () => {
  const world = new Simulation(); world.spawn(player()); world.drainEvents();
  assert.throws(() => world.spawn(player()));
  assert.throws(() => world.apply({ type: 'Move', entityId: 'player', direction: { x: NaN, z: 0 }, sprint: false }));
  assert.throws(() => world.apply({ type: 'Attack', entityId: 'player' }));
  const direction = { x: 1, z: 0 };
  world.apply({ type: 'Move', entityId: 'player', direction, sprint: false }); direction.x = -1;
  assert.throws(() => world.snapshot(), /settled/);
  world.step(); assert.equal(world.getEntity('player').transform.position.x, 0.1);
  world.drainEvents(); move(world, { x: 1, z: 0 }, false, 'missing');
  assert.equal(world.drainEvents()[0].type, 'CommandRejected');
});

test('versioned JSON round trip resumes entity ticks and the exact random sequence', () => {
  const world = new Simulation(new SeededRandom(123)); world.spawn(player()); move(world);
  world.random.next();
  const restored = Simulation.restore(deserializeSnapshot(serializeSnapshot(world.snapshot())));
  assert.deepEqual(restored.snapshot(), world.snapshot());
  assert.deepEqual(restored.drainEvents(), []);
  for (let i = 0; i < 10; i++) {
    assert.equal(restored.random.next(), world.random.next());
    move(world, { x: 0, z: 1 }); move(restored, { x: 0, z: 1 });
  }
  assert.deepEqual(restored.snapshot(), world.snapshot());
  assert.throws(() => new SeededRandom(-1));
});

test('snapshot boundary rejects corrupt versions, ids, stats, health, random and transforms', () => {
  const world = new Simulation(); world.spawn(player()); const snapshot = world.snapshot();
  for (const mutate of [
    s => { s.schemaVersion = 99; }, s => { s.protocolVersion = 99; }, s => { s.tick = 0.5; },
    s => { s.entities.push(s.entities[0]); }, s => { s.entities[0].health.current = 101; },
    s => { s.entities[0].transform.position.x = 19; }, s => { s.entities[0].stats.walkSpeed = -1; },
    s => { s.random.state = -1; }, s => { s.random.algorithm = 'unknown'; },
  ]) { const corrupt = JSON.parse(JSON.stringify(snapshot)); mutate(corrupt); assert.throws(() => Simulation.restore(corrupt)); }
  assert.throws(() => deserializeSnapshot('{broken'));
  assert.throws(() => Simulation.restore(null));
});

 test('server entrypoint hosts the same simulation class without browser APIs', async () => {
  const { createSimulationSession } = await import('@thy-will/game-server');
  const world = createSimulationSession(); world.spawn(player()); move(world);
  assert.ok(world instanceof Simulation);
  assert.equal(world.tick, 1);
});
