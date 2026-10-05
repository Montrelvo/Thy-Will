import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import type { Scene } from '@babylonjs/core/scene.js';
import type { Entity, LootDrop } from '@thy-will/simulation';

/** Reads authoritative state; meshes never decide damage, death, or drops. */
export function createEncounterPresentation(scene: Scene) {
  const material = new StandardMaterial('sentinel-material', scene);
  material.diffuseColor = Color3.FromHexString('#98464b');
  const enemy = MeshBuilder.CreateCylinder('arena-sentinel', { height: 2, diameter: 1.1, tessellation: 8 }, scene);
  enemy.material = material;
  const ring = MeshBuilder.CreateTorus('target-ring', { diameter: 1.7, thickness: 0.08 }, scene);
  const glow = new StandardMaterial('loot-glow', scene); glow.emissiveColor = Color3.FromHexString('#dfb95d');
  ring.material = glow;
  const drops = new Map<string, ReturnType<typeof MeshBuilder.CreateBox>>();
  let flashUntil = 0;
  return {
    hit(time: number) { flashUntil = time + 0.18; },
    update(entity: Entity, loot: LootDrop[], selected: boolean, visible: boolean, time: number) {
      const position = entity.transform.position; const alive = entity.health.current > 0;
      enemy.setEnabled(visible); enemy.position.set(position.x, alive ? 1 : 0.25, position.z);
      enemy.scaling.y = alive ? 1 : 0.25;
      material.emissiveColor = time < flashUntil ? new Color3(0.8, 0.4, 0.2) : Color3.Black();
      ring.setEnabled(visible && selected && alive); ring.position.set(position.x, 0.08, position.z);
      for (const [id, mesh] of drops) if (!loot.some(item => item.id === id)) { mesh.dispose(); drops.delete(id); }
      for (const item of loot) {
        let mesh = drops.get(item.id);
        if (!mesh) { mesh = MeshBuilder.CreateBox(item.id, { size: 0.45 }, scene); mesh.material = glow; drops.set(item.id, mesh); }
        mesh.setEnabled(visible); mesh.position.set(item.position.x, 0.5 + Math.sin(time * 3) * 0.1, item.position.z); mesh.rotation.y = time;
      }
    },
    dispose() { enemy.dispose(); ring.dispose(); for (const mesh of drops.values()) mesh.dispose(); material.dispose(); glow.dispose(); },
  };
}
