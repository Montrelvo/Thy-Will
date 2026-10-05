import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { Engine } from '@babylonjs/core/Engines/engine.js';
import { Simulation, TICK_SECONDS, WALK_SPEED, SPRINT_SPEED } from '@thy-will/simulation';
import { InputController } from './input/input.js';
import { createTrainingScene } from './presentation/scene.js';
import { AssetLoader } from './assets/asset-loader.js';
import './style.css';

async function start(): Promise<() => void> {
  const canvas = document.querySelector<HTMLCanvasElement>('#game');
  const status = document.querySelector<HTMLDivElement>('#status');
  if (!canvas || !status) throw new Error('Client shell is missing');
  if (!Engine.isSupported()) throw new Error('WebGL is unavailable. Open this page in a browser with hardware acceleration enabled.');
  const engine = new Engine(canvas, true, { stencil: true, preserveDrawingBuffer: false });
  engine.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio || 1, 2));
  const view = createTrainingScene(engine, canvas);
  const assets = new AssetLoader(view.scene, { beacon: { rootUrl: '/assets/', fileName: 'beacon.gltf' } });
  const input = new InputController(canvas, () => { view.debug.isVisible = !view.debug.isVisible; });
  const simulation = new Simulation();
  simulation.spawn({ id: 'player', transform: { position: { x: 0, z: 0 }, rotationY: 0 }, stats: { walkSpeed: WALK_SPEED, sprintSpeed: SPRINT_SPEED }, health: { current: 100, maximum: 100 } });
  simulation.drainEvents();
  let accumulator = 0;
  let pendingReset = false;
  let position = { x: 0, z: 0 };
  let distance = 0; let debugTimer = 0; let assetState = 'loading'; let disposed = false;
  const events = new AbortController();
  canvas.addEventListener('contextmenu', (event) => event.preventDefault(), { signal: events.signal });
  window.addEventListener('resize', () => engine.resize(), { signal: events.signal });
  let hidden = document.hidden;
  document.addEventListener('visibilitychange', () => { hidden = document.hidden; input.clear(); accumulator = 0; }, { signal: events.signal });
  const render = () => {
    if (hidden || disposed) return;
    const seconds = Math.min(engine.getDeltaTime() / 1000, 0.05);
    const frame = input.sample();
    view.camera.alpha -= frame.orbitX * seconds * 1.8;
    view.camera.beta = Math.max(0.35, Math.min(1.2, view.camera.beta + frame.orbitY * seconds * 1.5));
    // Translate camera-relative intent into world coordinates before simulation.
    const alpha = view.camera.alpha;
    const direction = { x: -Math.sin(alpha) * frame.x - Math.cos(alpha) * frame.z, z: Math.cos(alpha) * frame.x - Math.sin(alpha) * frame.z };
    pendingReset ||= frame.reset;
    accumulator += seconds;
    while (accumulator >= TICK_SECONDS) {
      simulation.apply(pendingReset ? { type: 'ResetPosition', entityId: 'player' } : { type: 'Move', entityId: 'player', direction, sprint: frame.sprint });
      simulation.step();
      for (const event of simulation.drainEvents()) {
        if (event.type === 'PositionReset') distance = 0;
        if (event.type === 'EntityMoved') distance += Math.hypot(event.position.x - position.x, event.position.z - position.z);
      }
      position = simulation.getEntity('player')!.transform.position;
      pendingReset = false;
      accumulator -= TICK_SECONDS;
    }
    const rotation = simulation.getEntity('player')!.transform.rotationY;
    view.display(position, { x: Math.sin(rotation), z: Math.cos(rotation) });
    view.hint.text = distance > 0.25 ? `${frame.sprint ? 'SPRINTING' : 'EXPLORING'}   /   ${distance.toFixed(1)} m traveled` : 'Move to begin';
    debugTimer += seconds;
    if (debugTimer >= 0.2) {
      debugTimer = 0;
      view.debug.text = `WebGL ${engine.webGLVersion} · ${engine.getFps().toFixed(0)} FPS · ${view.scene.meshes.length} meshes\nPosition ${position.x.toFixed(2)}, ${position.z.toFixed(2)} · ${frame.source}\nAsset: ${assetState} · Solo simulation authority · tick ${simulation.tick}`;
    }
    // Read-only diagnostics also support browser acceptance tests.
    canvas.dataset['simulationTick'] = String(simulation.tick);
    canvas.dataset['positionX'] = position.x.toFixed(3);
    canvas.dataset['positionZ'] = position.z.toFixed(3);
    canvas.dataset['debug'] = String(view.debug.isVisible);
    canvas.dataset['input'] = frame.source;
    canvas.dataset['sprinting'] = String(frame.sprint);
    view.scene.render();
  };
  const dispose = () => {
    if (disposed) return; disposed = true;
    engine.stopRenderLoop(render); events.abort(); input.dispose(); assets.dispose(); view.dispose(); engine.dispose();
    canvas.dataset['ready'] = 'false';
  };
  window.addEventListener('pagehide', (event) => { if (!event.persisted) dispose(); }, { signal: events.signal });
  canvas.focus();
  engine.runRenderLoop(render);
  try {
    const beacon = await assets.load('beacon');
    beacon.addAllToScene();
    for (const node of beacon.rootNodes) if (node instanceof TransformNode) node.position.set(0, 0.2, 10);
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
