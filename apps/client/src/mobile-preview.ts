const canvas = document.querySelector<HTMLCanvasElement>('#game');
if (!canvas) throw new Error('Mobile preview canvas is missing');

const activeTouches = new Map<number, { x: number; y: number }>();
let lastPinchDistance: number | undefined;

function syntheticPointer(type: string, source: PointerEvent, buttons: number): void {
  canvas.dispatchEvent(new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    pointerId: source.pointerId + 10000,
    pointerType: 'mouse',
    isPrimary: true,
    button: 2,
    buttons,
    clientX: source.clientX,
    clientY: source.clientY,
  }));
}

function pinchDistance(): number | undefined {
  if (activeTouches.size < 2) return undefined;
  const [a, b] = Array.from(activeTouches.values());
  return Math.hypot(b.x - a.x, b.y - a.y);
}

canvas.addEventListener('pointerdown', (event) => {
  if (event.pointerType !== 'touch') return;
  event.preventDefault();
  activeTouches.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (activeTouches.size === 1) syntheticPointer('pointerdown', event, 2);
  lastPinchDistance = pinchDistance();
}, { capture: true });

canvas.addEventListener('pointermove', (event) => {
  if (event.pointerType !== 'touch' || !activeTouches.has(event.pointerId)) return;
  event.preventDefault();
  activeTouches.set(event.pointerId, { x: event.clientX, y: event.clientY });
  const distance = pinchDistance();
  if (distance !== undefined && lastPinchDistance !== undefined) {
    const delta = distance - lastPinchDistance;
    if (Math.abs(delta) > 1) {
      canvas.dispatchEvent(new WheelEvent('wheel', {
        bubbles: true,
        cancelable: true,
        clientX: event.clientX,
        clientY: event.clientY,
        deltaY: -delta * 2.5,
      }));
      canvas.dataset['mobileZoomGesture'] = 'true';
    }
  } else if (activeTouches.size === 1) {
    syntheticPointer('pointermove', event, 2);
    canvas.dataset['mobileOrbitGesture'] = 'true';
  }
  lastPinchDistance = distance;
}, { capture: true });

function endTouch(event: PointerEvent): void {
  if (event.pointerType !== 'touch' || !activeTouches.has(event.pointerId)) return;
  event.preventDefault();
  if (activeTouches.size === 1) syntheticPointer('pointerup', event, 0);
  activeTouches.delete(event.pointerId);
  lastPinchDistance = pinchDistance();
}

canvas.addEventListener('pointerup', endTouch, { capture: true });
canvas.addEventListener('pointercancel', endTouch, { capture: true });
