import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera.js';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight.js';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { Scene } from '@babylonjs/core/scene.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import type { Engine } from '@babylonjs/core/Engines/engine.js';
import { createCharacterPresentation } from './character.js';

export function createTrainingScene(engine: Engine, canvas: HTMLCanvasElement) {
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.035, 0.05, 0.08, 1);
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogDensity = 0.012;
  scene.fogColor = new Color3(0.035, 0.05, 0.08);
  const camera = new ArcRotateCamera('camera', -Math.PI / 2, 0.82, 24, Vector3.Zero(), scene);
  camera.lowerRadiusLimit = 12; camera.upperRadiusLimit = 36;
  camera.lowerBetaLimit = 0.35; camera.upperBetaLimit = 1.2;
  camera.panningSensibility = 0;
  camera.inputs.removeByType('ArcRotateCameraKeyboardMoveInput');
  camera.attachControl(canvas, true);
  const pointer = camera.inputs.attached['pointers'];
  if (pointer && 'buttons' in pointer) pointer.buttons = [2];
  const light = new HemisphericLight('sky', new Vector3(0.3, 1, -0.4), scene);
  light.intensity = 1.1; light.groundColor = new Color3(0.16, 0.2, 0.3);
  const material = (name: string, color: Color3, glow = false) => {
    const result = new StandardMaterial(name, scene);
    result.diffuseColor = color; result.specularColor = new Color3(0.12, 0.12, 0.12);
    if (glow) result.emissiveColor = color.scale(0.5);
    return result;
  };
  const stone = material('slate', new Color3(0.14, 0.19, 0.25));
  const edge = material('edges', new Color3(0.29, 0.36, 0.42));
  const gold = material('gold', new Color3(0.72, 0.54, 0.23));
  const ground = MeshBuilder.CreateGround('arena', { width: 40, height: 40 }, scene);
  ground.material = stone;
  // Quiet grid makes travel and scale visible without downloaded textures.
  const lines: Vector3[][] = [];
  for (let i = -18; i <= 18; i += 3) {
    lines.push([new Vector3(i, 0.015, -18), new Vector3(i, 0.015, 18)]);
    lines.push([new Vector3(-18, 0.015, i), new Vector3(18, 0.015, i)]);
  }
  MeshBuilder.CreateLineSystem('grid', { lines }, scene).color = new Color3(0.23, 0.3, 0.36);
  for (const [x, z, width, depth] of [[0, -19, 40, 1], [0, 19, 40, 1], [-19, 0, 1, 38], [19, 0, 1, 38]]) {
    const wall = MeshBuilder.CreateBox('boundary', { width: width!, depth: depth!, height: 0.65 }, scene);
    wall.position.set(x!, 0.325, z!); wall.material = edge;
  }
  for (const x of [-15, 15]) for (const z of [-15, 15]) {
    const pillar = MeshBuilder.CreateCylinder('pillar', { diameter: 1.6, height: 4, tessellation: 8 }, scene);
    pillar.position.set(x, 2, z); pillar.material = edge;
    const cap = MeshBuilder.CreateCylinder('cap', { diameter: 1.9, height: 0.3, tessellation: 8 }, scene);
    cap.position.set(x, 4.05, z); cap.material = gold;
  }
  const pad = MeshBuilder.CreateCylinder('spawn-pad', { diameter: 4, height: 0.1, tessellation: 48 }, scene);
  pad.position.y = 0.04; pad.material = gold;
  const character = createCharacterPresentation(scene);
  return {
    scene, camera, character,
    setInspection(inspection: boolean) {
      for (const mesh of scene.meshes) if (['arena', 'grid', 'boundary', 'pillar', 'cap'].includes(mesh.name)) mesh.setEnabled(!inspection);
      pad.scaling.setAll(inspection ? 0.65 : 1);
      camera.lowerRadiusLimit = inspection ? 3 : 12;
      camera.upperRadiusLimit = inspection ? 10 : 36;
      camera.radius = inspection ? 5.5 : 24;
      camera.beta = inspection ? 1.05 : 0.82;
    },
    dispose() { camera.detachControl(); character.dispose(); scene.dispose(); },
  };
}
