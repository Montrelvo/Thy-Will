export type TouchAction = 'up' | 'down' | 'left' | 'right' | 'sprint';
/** Each held pointer owns its action; releasing one finger keeps other holds. */
export function attachTouchControls(canvas: HTMLCanvasElement, hit: (x: number, y: number) => TouchAction | undefined, set: (action: TouchAction, active: boolean) => void) {
  const pointers = new Map<number, TouchAction>(); const abort = new AbortController();
  const refresh = () => { for (const action of ['up', 'down', 'left', 'right', 'sprint'] as const) set(action, [...pointers.values()].includes(action)); };
  const options = { signal: abort.signal };
  canvas.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'touch') return;
    const rect = canvas.getBoundingClientRect(); const action = hit(event.clientX - rect.left, event.clientY - rect.top);
    if (!action) return;
    pointers.set(event.pointerId, action); canvas.setPointerCapture(event.pointerId); refresh();
  }, options);
  canvas.addEventListener('pointermove', event => {
    if (!pointers.has(event.pointerId)) return;
    const rect = canvas.getBoundingClientRect(); const action = hit(event.clientX - rect.left, event.clientY - rect.top);
    if (action) pointers.set(event.pointerId, action); else pointers.delete(event.pointerId);
    refresh();
  }, options);
  const release = (event: PointerEvent) => { if (pointers.delete(event.pointerId)) refresh(); };
  const clear = () => { pointers.clear(); refresh(); };
  window.addEventListener('pointerup', release, options); window.addEventListener('pointercancel', release, options);
  canvas.addEventListener('lostpointercapture', release, options);
  window.addEventListener('blur', clear, options);
  canvas.addEventListener('blur', clear, options);
  document.addEventListener('visibilitychange', () => { if (document.hidden) clear(); }, options);
  return { clear, dispose() { abort.abort(); clear(); } };
}
