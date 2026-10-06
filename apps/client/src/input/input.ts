export type CombatAction = 'target' | 'attack' | 'pickup' | 'equip' | 'craft';
export interface InputFrame {
  actions: CombatAction[]; x: number; z: number; sprint: boolean; reset: boolean;
  orbitX: number; orbitY: number; source: 'keyboard' | 'controller' | 'touch';
}

export function deadzone(value: number, threshold = 0.18): number {
  if (!Number.isFinite(value)) return 0;
  const clamped = Math.max(-1, Math.min(1, value));
  return Math.abs(clamped) <= threshold ? 0 : Math.sign(clamped) * (Math.abs(clamped) - threshold) / (1 - threshold);
}

export class InputController {
  private readonly keys = new Set<string>();
  private reset = false;
  private actions: CombatAction[] = [];
  private padHeld = new Set<number>();
  private resetHeld = false;
  private readonly touchKeys = new Set<'up' | 'down' | 'left' | 'right' | 'sprint'>();
  private readonly abort = new AbortController();

  constructor(private readonly canvas: HTMLCanvasElement, toggleDebug: () => void) {
    const options = { signal: this.abort.signal };
    window.addEventListener('keydown', (event) => {
      if (document.activeElement !== canvas) return;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
      this.keys.add(event.code);
      if (!event.repeat) {
        const action = ({ KeyT: 'target', Space: 'attack', KeyE: 'pickup', KeyQ: 'equip', KeyC: 'craft' } as Record<string, CombatAction>)[event.code];
        if (action) this.actions.push(action);
      }
      if (!event.repeat && event.code === 'KeyR') this.reset = true;
      if (!event.repeat && event.code === 'F3') { event.preventDefault(); toggleDebug(); }
    }, options);
    window.addEventListener('keyup', (event) => this.keys.delete(event.code), options);
    window.addEventListener('blur', () => this.clear(), options);
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.clear(); }, options);
    canvas.addEventListener('pointerdown', () => canvas.focus(), options);
    canvas.addEventListener('blur', () => this.clear(), options);
  }

  setTouch(action: 'up' | 'down' | 'left' | 'right' | 'sprint', active: boolean): void {
    if (active) this.touchKeys.add(action); else this.touchKeys.delete(action);
  }
  clear(): void { this.keys.clear(); this.touchKeys.clear(); this.reset = false; this.resetHeld = false; this.actions = []; this.padHeld.clear(); }

  sample(): InputFrame {
    const key = (...codes: string[]) => codes.some((code) => this.keys.has(code)) ? 1 : 0;
    let x = key('KeyD', 'ArrowRight') - key('KeyA', 'ArrowLeft');
    let z = key('KeyW', 'ArrowUp') - key('KeyS', 'ArrowDown');
    let sprint = !!key('ShiftLeft', 'ShiftRight');
    let orbitX = 0; let orbitY = 0;
    let source: InputFrame['source'] = 'keyboard';
    const pad = Array.from(navigator.getGamepads?.() ?? []).find((pad) => pad?.connected && pad.mapping === 'standard');
    const focused = document.hasFocus() && document.activeElement === this.canvas;
    const padReset = focused && !!pad?.buttons[3]?.pressed;
    if (pad && focused) {
      const px = deadzone(pad.axes[0] ?? 0); const pz = -deadzone(pad.axes[1] ?? 0);
      orbitX = deadzone(pad.axes[2] ?? 0); orbitY = deadzone(pad.axes[3] ?? 0);
      if (Math.hypot(px, pz) > 0 || Math.hypot(orbitX, orbitY) > 0 || padReset || pad.buttons[5]?.pressed) {
        source = 'controller'; x = px; z = pz; sprint = !!pad.buttons[5]?.pressed;
      }
    }
    if (this.touchKeys.size) {
      source = 'touch'; x = Number(this.touchKeys.has('right')) - Number(this.touchKeys.has('left'));
      z = Number(this.touchKeys.has('up')) - Number(this.touchKeys.has('down')); sprint = this.touchKeys.has('sprint');
    }
    for (const [index, action] of [[2, 'target'], [0, 'attack'], [1, 'pickup'], [4, 'equip'], [3, 'craft']] as const) {
      const pressed = focused && !!pad?.buttons[index]?.pressed;
      if (pressed && !this.padHeld.has(index)) this.actions.push(action);
      if (pressed) this.padHeld.add(index); else this.padHeld.delete(index);
    }
    const actions = this.actions; this.actions = [];
    const reset = this.reset || (padReset && !this.resetHeld);
    this.reset = false; this.resetHeld = padReset;
    return { actions, x, z, sprint, reset, orbitX, orbitY, source };
  }

  dispose(): void { this.abort.abort(); this.clear(); }
}
