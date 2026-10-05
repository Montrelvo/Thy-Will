import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

function glb(path) {
  const data = readFileSync(path);
  assert.equal(data.readUInt32LE(0), 0x46546c67); assert.equal(data.readUInt32LE(4), 2);
  assert.equal(data.readUInt32LE(8), data.length);
  return { data, json: JSON.parse(data.subarray(20, 20 + data.readUInt32LE(12)).toString()) };
}
test('shipped edited KayKit assets embed textures, retain rigs and required animations', () => {
  for (const palette of ['slate', 'crimson']) {
    const { data, json } = glb(`apps/client/public/assets/kaykit/knight-${palette}.glb`);
    assert.ok(data.length < 750000); assert.ok(json.skins.length > 0);
    assert.ok(json.images.every(image => image.bufferView !== undefined && image.uri === undefined));
    assert.ok(json.buffers.every(buffer => buffer.uri === undefined));
    for (const clip of ['Idle', 'Walking_A', 'Running_A', '1H_Melee_Attack_Chop', 'Unarmed_Melee_Attack_Punch_A']) {
      assert.ok(json.animations.find(animation => animation.name === clip)?.channels.length > 0);
    }
    for (const mesh of ['1H_Sword', 'Badge_Shield', 'Knight_Helmet']) assert.ok(json.nodes.some(node => node.name === mesh));
    assert.ok(!json.nodes.some(node => node.name === '2H_Sword'));
  }
});
