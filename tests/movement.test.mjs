import assert from 'node:assert/strict';
import { test } from 'node:test';
import { advancePosition, ARENA_LIMIT } from '@thy-will/simulation';

test('diagonal movement does not outrun straight travel and sprint is faster', () => {
  const origin = { x: 0, z: 0 };
  const straight = advancePosition(origin, { x: 1, z: 0, sprint: false }, 0.05);
  const diagonal = advancePosition(origin, { x: 1, z: 1, sprint: false }, 0.05);
  const sprint = advancePosition(origin, { x: 1, z: 0, sprint: true }, 0.05);
  assert.ok(Math.abs(Math.hypot(diagonal.x, diagonal.z) - straight.x) < 1e-10);
  assert.ok(sprint.x > straight.x);
  assert.deepEqual(origin, { x: 0, z: 0 });
});

test('arena bounds and time clamping prevent escape or tab-resume teleport', () => {
  const origin = { x: ARENA_LIMIT - 0.01, z: -ARENA_LIMIT + 0.01 };
  const result = advancePosition(origin, { x: 1, z: -1, sprint: true }, 500);
  assert.deepEqual(result, { x: ARENA_LIMIT, z: -ARENA_LIMIT });
  assert.deepEqual(advancePosition({ x: 0, z: 0 }, { x: 1, z: 0, sprint: false }, 500),
    advancePosition({ x: 0, z: 0 }, { x: 1, z: 0, sprint: false }, 0.05));
  assert.throws(() => advancePosition({ x: NaN, z: 0 }, { x: 0, z: 0, sprint: false }, 0), RangeError);
});
