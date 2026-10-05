import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { Engine } from '@babylonjs/core/Engines/engine.js';
import { Simulation, TICK_SECONDS, characterEntity, type CharacterRecord } from '@thy-will/simulation';
import { attachTouchControls } from './input/touch-controls.js';
import { InputController } from './input/input.js';
import { createTrainingScene } from './presentation/scene.js';
import { AssetLoader } from './assets/asset-loader.js';
import { LocalCharacterRepository } from './character/repository.js';
import { createInterface } from './presentation/interface.js';
import { attachTouchCamera } from './mobile-preview.js';
import { initialMode, type PlayMode } from './modes.js';
import type { Demonstration } from './presentation/character.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import './style.css';

async function start(): Promise<() => void> {
  const canvas = document.querySelector<HTMLCanvasElement>('#game');
  const status = document.querySelector<HTMLDivElement>('#status');
  if (!canvas || !status) throw new Error('Client shell is missing');
  if (!Engine.isSupported()) throw new Error('WebGL is unavailable. Open this page in a browser with hardware acceleration enabled.');
  const engine = new Engine(canvas, true, { stencil: true, preserveDrawingBuffer: false });
  const repository = new LocalCharacterRepository();
  let character = repository.load();
  const device = window.matchMedia('(pointer: coarse)');
  let touch = device.matches;
  let mode: PlayMode = initialMode(touch);
  let demonstration: Demonstration = 'idle';
  const view = createTrainingScene(engine, canvas);
  let assetRoots: TransformNode[] = [];
  const assets = new AssetLoader(view.scene, { beacon: { rootUrl: `${import.meta.env.BASE_URL}assets/`, fileName: 'beacon.gltf' } });
  const simulation = new Simulation(); simulation.spawn(characterEntity(character)); simulation.drainEvents();
  let accumulator = 0; let pendingReset = false; let animationTime = 0;
  let position = { x: 0, z: 0 };
  const input = new InputController(canvas, () => { hud.debug.isVisible = !hud.debug.isVisible; });
  const updateCharacter = (change: (record: CharacterRecord) => void) => {
    const next = repository.load(); change(next); repository.save(next); character = repository.load();
    view.character.updateCharacter(character); canvas.focus();
  };
  const switchMode = (next: PlayMode) => {
    mode = next; demonstration = 'idle'; touchControls.clear(); input.clear(); accumulator = 0; pendingReset = false;
    view.setInspection(mode === 'inspection');
    for (const root of assetRoots) root.setEnabled(mode === 'arena');
    canvas.focus();
  };
  const hud = createInterface(view.scene, {
    mode: switchMode,
    palette: () => updateCharacter(record => { record.appearance.palette = record.appearance.palette === 'slate' ? 'crimson' : 'slate'; }),
    weapon: () => updateCharacter(record => { record.equipment.weapon = record.equipment.weapon ? null : 'training-sword'; }),
    shield: () => updateCharacter(record => { record.equipment.offhand = record.equipment.offhand ? null : 'training-shield'; }),
    demonstration: value => { demonstration = value; canvas.focus(); },
    reset: () => { pendingReset = true; },
  });
  const touchControls = attachTouchControls(canvas, hud.touchActionAt, (action, active) => input.setTouch(action, mode === 'arena' && active));
  const detachTouchCamera = attachTouchCamera(view.camera, canvas, hud.blocksPointer);
  view.character.updateCharacter(character); view.setInspection(mode === 'inspection');
  const resize = () => {
    touchControls.clear(); touch = device.matches;
    engine.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio || 1, touch ? 1.5 : 2));
    engine.resize(); hud.resize(canvas.clientWidth, canvas.clientHeight);
  };
  resize();
  let distance = 0; let debugTimer = 0; let assetState = 'loading'; let disposed = false;
  const events = new AbortController();
  canvas.addEventListener('contextmenu', (event) => event.preventDefault(), { signal: events.signal });
  window.addEventListener('resize', resize, { signal: events.signal });
  device.addEventListener('change', () => { input.clear(); resize(); }, { signal: events.signal });
  window.addEventListener('pointercancel', () => input.clear(), { signal: events.signal });
  let hidden = document.hidden;
  document.addEventListener('visibilitychange', () => { hidden = document.hidden; input.clear(); accumulator = 0; }, { signal: events.signal });
  const render = () => {
    if (hidden || disposed) return;
    const seconds = Math.min(engine.getDeltaTime() / 1000, 0.05);
    const frame = input.sample();
    animationTime += seconds;
    view.camera.alpha -= frame.orbitX * seconds * 1.8;
    view.camera.beta = Math.max(0.35, Math.min(1.2, view.camera.beta + frame.orbitY * seconds * 1.5));
    // Translate camera-relative intent into world coordinates before simulation.
    const alpha = view.camera.alpha;
    const direction = { x: -Math.sin(alpha) * frame.x - Math.cos(alpha) * frame.z, z: Math.cos(alpha) * frame.x - Math.sin(alpha) * frame.z };
    pendingReset ||= mode === 'arena' && frame.reset;
    accumulator += seconds;
    while (accumulator >= TICK_SECONDS) {
      if (mode === 'arena') simulation.apply(pendingReset ? { type: 'ResetPosition', entityId: character.characterId } : { type: 'Move', entityId: character.characterId, direction, sprint: frame.sprint });
      simulation.step();
      for (const event of simulation.drainEvents()) {
        if (event.type === 'PositionReset') distance = 0;
        if (event.type === 'EntityMoved') distance += Math.hypot(event.position.x - position.x, event.position.z - position.z);
      }
      position = simulation.getEntity(character.characterId)!.transform.position;
      pendingReset = false;
      accumulator -= TICK_SECONDS;
    }
    const rotation = simulation.getEntity(character.characterId)!.transform.rotationY;
    const displayPosition = mode === 'inspection' ? { x: 0, z: 0 } : position;
    view.character.display(displayPosition, mode === 'inspection' ? Math.PI : rotation, animationTime, mode === 'arena' && Math.hypot(frame.x, frame.z) > 0, mode === 'inspection' ? demonstration : 'idle');
    view.camera.setTarget(new Vector3(displayPosition.x, mode === 'inspection' && canvas.clientHeight < 520 ? 1.7 : 1, displayPosition.z), false, false, true);
    const storageLabel = repository.status === 'saved' ? 'Saved on this device' : repository.status === 'recovery' ? 'Saved character unavailable · session only' : 'This session only';
    hud.update(character, mode, demonstration, touch, storageLabel, distance);
    debugTimer += seconds;
    if (debugTimer >= 0.2) {
      debugTimer = 0;
      hud.debug.text = `WebGL ${engine.webGLVersion} · ${engine.getFps().toFixed(0)} FPS · ${view.scene.meshes.length} meshes\nPosition ${position.x.toFixed(2)}, ${position.z.toFixed(2)} · ${frame.source}\nAsset: ${assetState} · Solo simulation authority · tick ${simulation.tick}`;
    }
    // Read-only diagnostics also support browser acceptance tests.
    canvas.dataset['characterId'] = character.characterId;
    canvas.dataset['palette'] = character.appearance.palette;
    canvas.dataset['weapon'] = character.equipment.weapon ?? 'none';
    canvas.dataset['shield'] = character.equipment.offhand ?? 'none';
    canvas.dataset['mode'] = mode;
    canvas.dataset['demonstration'] = demonstration;
    canvas.dataset['storage'] = repository.status;
    canvas.dataset['cameraAlpha'] = String(view.camera.alpha);
    canvas.dataset['cameraRadius'] = String(view.camera.radius);
    canvas.dataset['simulationTick'] = String(simulation.tick);
    canvas.dataset['positionX'] = position.x.toFixed(3);
    canvas.dataset['positionZ'] = position.z.toFixed(3);
    canvas.dataset['debug'] = String(hud.debug.isVisible);
    canvas.dataset['input'] = frame.source;
    canvas.dataset['sprinting'] = String(frame.sprint);
    view.scene.render();
  };
  const dispose = () => {
    if (disposed) return; disposed = true;
    engine.stopRenderLoop(render); events.abort(); touchControls.dispose(); input.dispose(); detachTouchCamera(); assets.dispose(); hud.dispose(); view.dispose(); engine.dispose();
    canvas.dataset['ready'] = 'false';
  };
  window.addEventListener('pagehide', (event) => { if (!event.persisted) dispose(); }, { signal: events.signal });
  canvas.focus();
  engine.runRenderLoop(render);
  try {
    const beacon = await assets.load('beacon');
    beacon.addAllToScene();
    assetRoots = beacon.rootNodes.filter((node): node is TransformNode => node instanceof TransformNode);
    for (const node of assetRoots) { node.position.set(0, 0.2, 10); node.setEnabled(mode === 'arena'); }
    assetState = 'ready';
  } catch (error) {
    if (disposed) return dispose;
    assetState = 'unavailable'; console.warn('Optional beacon asset could not load', error);
  }
  if (!disposed) { status.hidden = true; canvas.dataset['ready'] = 'true'; canvas.dataset['asset'] = assetState; }
  return dispose;
}

void start().then((dispose) => {
  if (import.meta.hot) import.meta.hot.dispose(dispose);
}).catch((error: unknown) => {
  const status = document.querySelector<HTMLDivElement>('#status');
  if (status) { status.hidden = false; status.textContent = error instanceof Error ? error.message : 'The client could not start.'; }
  console.error(error);
});
