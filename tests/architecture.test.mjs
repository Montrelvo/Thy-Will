import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkBoundaries, validateImport } from '../scripts/check-boundaries.mjs';

test('compiled shared packages load in Node without Babylon, Firebase, or DOM', async () => {
  assert.equal(typeof globalThis.window, 'undefined');
  const simulation = await import('@thy-will/simulation');
  const client = await import('@thy-will/client');
  const server = await import('@thy-will/game-server');
  const backend = await import('@thy-will/backend');
  assert.deepEqual(client.clientCompatibility, simulation.simulationCompatibility);
  assert.deepEqual(server.gameServerCompatibility, simulation.simulationCompatibility);
  assert.equal(backend.backendCompatibility.protocolVersion, simulation.simulationCompatibility.protocolVersion);
});

test('source imports and declared dependencies preserve workspace boundaries', async () => {
  assert.deepEqual(await checkBoundaries(), []);
});

test('headless packages reject presentation, Firebase, Node APIs, and cross-workspace relative imports', () => {
  for (const specifier of ['@babylonjs/core', 'firebase/app', 'firebase-admin', 'node:fs', '@thy-will/client', '../../client/src/index.js']) {
    assert.ok(validateImport('packages/simulation', 'packages/simulation/src/index.ts', specifier), specifier);
  }
  assert.equal(validateImport('packages/simulation', 'packages/simulation/src/index.ts', '@thy-will/protocol'), null);
  assert.equal(validateImport('packages/simulation', 'packages/simulation/src/index.ts', './entities.js'), null);
});
