import type { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera.js';

/** Native pointers retain all touches; Babylon GUI hit tests exclude its controls. */
export function attachTouchCamera(camera: ArcRotateCamera, canvas: HTMLCanvasElement, blocksPointer: (x: number, y: number) => boolean): () => void {
  const touches = new Map<number, { x: number; y: number }>();
  let pinch: number | undefined;
  const abort = new AbortController(); const options = { signal: abort.signal };
  const distance = () => {
    const [a, b] = [...touches.values()]; return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : undefined;
  };
  canvas.addEventListener('pointerdown', event => {
    const rect = canvas.getBoundingClientRect();
    if (event.pointerType !== 'touch' || blocksPointer(event.clientX - rect.left, event.clientY - rect.top)) return;
    touches.set(event.pointerId, { x: event.clientX, y: event.clientY }); pinch = distance();
    canvas.setPointerCapture(event.pointerId);
  }, options);
  canvas.addEventListener('pointermove', event => {
    const before = touches.get(event.pointerId); if (!before) return;
    touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const next = distance();
    if (next !== undefined && pinch !== undefined) {
      camera.radius = Math.max(camera.lowerRadiusLimit ?? 3, Math.min(camera.upperRadiusLimit ?? 36, camera.radius - (next - pinch) * 0.035));
      canvas.dataset['mobileZoomGesture'] = 'true';
    } else if (touches.size === 1) {
      camera.alpha -= (event.clientX - before.x) * 0.008;
      camera.beta = Math.max(0.35, Math.min(1.2, camera.beta - (event.clientY - before.y) * 0.008));
      canvas.dataset['mobileOrbitGesture'] = 'true';
    }
    pinch = next;
  }, options);
  const end = (event: PointerEvent) => { touches.delete(event.pointerId); pinch = distance(); };
  window.addEventListener('pointerup', end, options); window.addEventListener('pointercancel', end, options);
  canvas.addEventListener('lostpointercapture', end, options);
  const clear = () => { touches.clear(); pinch = undefined; };
  window.addEventListener('blur', clear, options);
  document.addEventListener('visibilitychange', () => { if (document.hidden) clear(); }, options);
  return () => { abort.abort(); clear(); };
}
