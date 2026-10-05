import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import type { AssetContainer } from '@babylonjs/core/assetContainer.js';
import type { Scene } from '@babylonjs/core/scene.js';
import type { CharacterRecord, Position } from '@thy-will/simulation';
export type Demonstration = 'idle' | 'run' | 'swing';

/** Player views use the imported rig exclusively; loading failures are explicit. */
export function createCharacterPresentation(scene: Scene) {
  const root = new TransformNode('kaykit-character', scene);
  const variants = new Map<CharacterRecord['appearance']['palette'], AssetContainer>();
  let record: CharacterRecord | undefined;
  let current: AssetContainer | undefined;
  let clip = ''; let attackAt = -10;
  const applyRecord = () => {
    if (!record || variants.size !== 2) return;
    const next = variants.get(record.appearance.palette)!;
    if (current !== next) { current?.animationGroups.forEach(group => group.stop()); clip = ''; }
    current = next;
    for (const [palette, container] of variants) {
      for (const node of container.rootNodes) node.setEnabled(palette === record.appearance.palette);
      container.meshes.find(mesh => mesh.name === '1H_Sword')?.setEnabled(record.equipment.weapon !== null);
      container.meshes.find(mesh => mesh.name === 'Badge_Shield')?.setEnabled(record.equipment.offhand !== null);
    }
  };
  return {
    get animation() { return clip || 'loading'; },
    attach(slate: AssetContainer, crimson: AssetContainer) {
      for (const [palette, container] of [['slate', slate], ['crimson', crimson]] as const) {
        container.addAllToScene(); container.animationGroups.forEach(group => group.stop());
        for (const node of container.rootNodes) node.parent = root;
        const model = container.rootNodes[0];
        if (model instanceof TransformNode) {
          const bounds = model.getHierarchyBoundingVectors();
          const scale = 2.2 / (bounds.max.y - bounds.min.y);
          model.scaling.scaleInPlace(scale); model.position.y -= bounds.min.y * scale;
        }
        variants.set(palette, container);
      }
      applyRecord();
    },
    attack(time: number) { attackAt = time; clip = ''; },
    updateCharacter(value: CharacterRecord) { record = value; applyRecord(); },
    display(position: Position, rotation: number, time: number, moving: boolean, demo: Demonstration) {
      if (!current) return;
      root.position.set(position.x, 0, position.z); root.rotation.y = rotation;
      const attacking = time - attackAt < 0.4;
      const next = demo === 'swing' || attacking ? (record?.equipment.weapon ? '1H_Melee_Attack_Chop' : 'Unarmed_Melee_Attack_Punch_A') : moving || demo === 'run' ? 'Running_A' : 'Idle';
      if (clip !== next) {
        current.animationGroups.forEach(group => group.stop());
        const group = current.animationGroups.find(group => group.name === next);
        group?.start(demo === 'swing' || !attacking, attacking ? 1.5 : 1);
        clip = next;
      }
    },
    dispose() { root.dispose(); },
  };
}
