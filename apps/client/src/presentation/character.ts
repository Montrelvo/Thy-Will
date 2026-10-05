import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import type { Scene } from '@babylonjs/core/scene.js';
import type { CharacterRecord, Position } from '@thy-will/simulation';

export type Demonstration = 'idle' | 'run' | 'swing';
/** Both modes use this renderer. Animation previews never submit game commands. */
export function createCharacterPresentation(scene: Scene) {
  const root = new TransformNode('character-root', scene);
  const body = new TransformNode('character-body', scene); body.parent = root;
  const material = (name: string, color: string) => {
    const result = new StandardMaterial(name, scene); result.diffuseColor = Color3.FromHexString(color);
    result.specularColor = new Color3(0.35, 0.35, 0.35); return result;
  };
  const cloth = material('tabard', '#365e83'); const steel = material('steel', '#9ba8b3');
  const dark = material('boots', '#252e39'); const gold = material('fittings', '#b79850');
  const box = (name: string, width: number, height: number, depth: number, x: number, y: number, z: number, mat = steel, parent = body) => {
    const mesh = MeshBuilder.CreateBox(name, { width, height, depth }, scene);
    mesh.parent = parent; mesh.position.set(x, y, z); mesh.material = mat; return mesh;
  };
  box('cuirass', 0.7, 0.65, 0.38, 0, 1.18, 0);
  box('tabard', 0.5, 0.85, 0.06, 0, 1.05, 0.23, cloth);
  box('belt', 0.73, 0.09, 0.42, 0, 0.92, 0, gold);
  const helmet = MeshBuilder.CreateSphere('helmet', { diameter: 0.55, segments: 12 }, scene);
  helmet.parent = body; helmet.position.y = 1.8; helmet.material = steel;
  box('visor', 0.39, 0.065, 0.1, 0, 1.83, 0.24, dark);
  const legs = [-0.2, 0.2].map((x, i) => {
    const pivot = new TransformNode(`leg-${i}`, scene); pivot.parent = body; pivot.position.set(x, 0.9, 0);
    box(`greave-${i}`, 0.26, 0.66, 0.28, 0, -0.35, 0, steel, pivot);
    box(`boot-${i}`, 0.28, 0.2, 0.44, 0, -0.8, 0.07, dark, pivot); return pivot;
  });
  const arms = [-0.52, 0.52].map((x, i) => {
    const pivot = new TransformNode(`arm-${i}`, scene); pivot.parent = body; pivot.position.set(x, 1.48, 0);
    box(`armour-${i}`, 0.24, 0.55, 0.28, 0, -0.22, 0, steel, pivot); return pivot;
  });
  const sword = new TransformNode('training-sword', scene); sword.parent = arms[1]!; sword.position.y = -0.5;
  box('sword-blade', 0.1, 1.03, 0.055, 0, 0.7, 0.2, steel, sword);
  box('sword-guard', 0.42, 0.08, 0.1, 0, 0.16, 0.2, gold, sword);
  box('sword-grip', 0.09, 0.25, 0.09, 0, 0, 0.2, dark, sword);
  const shield = box('training-shield', 0.58, 0.84, 0.13, 0, -0.18, 0.25, cloth, arms[0]!);
  const emblem = box('shield-emblem', 0.12, 0.58, 0.03, 0, 0, 0.09, gold, body);
  emblem.parent = shield; emblem.position.set(0, 0, 0.09);
  const effectMat = material('preview-glow', '#dfb95d'); effectMat.emissiveColor = Color3.FromHexString('#bc8536');
  const slash = MeshBuilder.CreateTorus('preview-slash', { diameter: 2.5, thickness: 0.055, tessellation: 48 }, scene);
  slash.parent = root; slash.position.set(0, 1.05, 0.8); slash.rotation.x = Math.PI / 2;
  slash.material = effectMat; slash.setEnabled(false);
  let attackAt = -10;
  return {
    attack(time: number) { attackAt = time; },
    updateCharacter(record: CharacterRecord) {
      cloth.diffuseColor = Color3.FromHexString(record.appearance.palette === 'slate' ? '#365e83' : '#873e4c');
      sword.setEnabled(record.equipment.weapon !== null); shield.setEnabled(record.equipment.offhand !== null);
    },
    display(position: Position, rotation: number, time: number, moving: boolean, demonstration: Demonstration) {
      root.position.set(position.x, 0, position.z); root.rotation.y = rotation;
      const running = moving || demonstration === 'run';
      body.position.y = running ? Math.abs(Math.sin(time * 10)) * 0.06 : 0;
      for (let i = 0; i < legs.length; i++) legs[i]!.rotation.x = running ? Math.sin(time * 10 + i * Math.PI) * 0.6 : 0;
      for (let i = 0; i < arms.length; i++) arms[i]!.rotation.x = running ? -Math.sin(time * 10 + i * Math.PI) * 0.45 : 0;
      const attacking = time - attackAt < 0.35;
      if (attacking) arms[1]!.rotation.x = -1.7 + (time - attackAt) * 7;
      if (demonstration === 'swing') arms[1]!.rotation.x = -1.2 + Math.sin(time * 5) * 1.1;
      slash.setEnabled(attacking || (demonstration === 'swing' && sword.isEnabled()));
      slash.scaling.setAll(0.9 + Math.sin(time * 5) * 0.12);
    },
    dispose() { root.dispose(); for (const mat of [cloth, steel, dark, gold, effectMat]) mat.dispose(); },
  };
}
