import { AdvancedDynamicTexture } from '@babylonjs/gui/2D/advancedDynamicTexture.js';
import { Control } from '@babylonjs/gui/2D/controls/control.js';
import { TextBlock } from '@babylonjs/gui/2D/controls/textBlock.js';
import { Button } from '@babylonjs/gui/2D/controls/button.js';
import { Rectangle } from '@babylonjs/gui/2D/controls/rectangle.js';
import type { Scene } from '@babylonjs/core/scene.js';
import { TRAINING_GEAR } from '@thy-will/content';
import type { CharacterRecord } from '@thy-will/simulation';
import { GAME_MODES, type PlayMode } from '../modes.js';
import type { Demonstration } from './character.js';

export interface InterfaceActions {
  mode(mode: PlayMode): void;
  palette(): void;
  weapon(): void;
  shield(): void;
  demonstration(value: Demonstration): void;
  reset(): void;
  combat(action: 'target' | 'attack' | 'pickup'): void;
}
export function createInterface(scene: Scene, actions: InterfaceActions) {
  let compact = false;
  const ui = AdvancedDynamicTexture.CreateFullscreenUI('interface', true, scene);
  const text = (name: string, value: string, top: number, size = 15) => {
    const result = new TextBlock(name, value); result.fontFamily = 'system-ui, sans-serif'; result.fontSize = size;
    result.color = '#dce4ee'; result.height = '30px'; result.width = '100%'; result.top = `${top}px`;
    result.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP; result.isHitTestVisible = false; ui.addControl(result); return result;
  };
  const button = (name: string, label: string, x: number, top: number, callback: () => void, width = 102) => {
    const result = Button.CreateSimpleButton(name, label); result.width = `${width}px`; result.height = '38px';
    result.left = `${x}px`; result.top = `${top}px`; result.color = '#e1e6ee'; result.background = '#23364a';
    result.fontSize = 13; result.cornerRadius = 6; result.thickness = 1;
    result.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT; result.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    result.isPointerBlocker = true; result.onPointerClickObservable.add(callback); ui.addControl(result); return result;
  };
  text('title', 'THY WILL', 12, 22);
  const inspection = button('inspection', GAME_MODES.inspection.label, 12, 50, () => actions.mode('inspection'));
  const arena = button('arena', GAME_MODES.arena.label, 120, 50, () => actions.mode('arena'));
  const story = button('story', GAME_MODES.story.label, 228, 50, () => {});
  story.isEnabled = false; story.alpha = 0.5;
  const summary = text('summary', '', 94, 13);
  const instructions = text('instructions', '', 123, 12); instructions.color = '#9db0c6';
  const combatStatus = text('combat-status', '', 154, 12); combatStatus.height = '54px';
  const combatButtons = [button('target', 'Target · T', 12, 216, () => actions.combat('target')), button('attack', 'Attack · Space', 120, 216, () => actions.combat('attack')), button('pickup', 'Loot · E', 228, 216, () => actions.combat('pickup'))];
  const debug = text('debug', '', 264, 11); debug.height = '60px'; debug.isVisible = false;
  const panel = new Rectangle('character-panel'); panel.width = '330px'; panel.height = '220px';
  panel.background = '#111d2deb'; panel.color = '#4b6075'; panel.cornerRadius = 8;
  panel.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM; panel.top = '-18px'; panel.isPointerBlocker = true; ui.addControl(panel);
  const details = new TextBlock('details'); details.color = '#dce4ee'; details.fontSize = 13; details.height = '78px';
  details.top = '10px'; details.textWrapping = true; details.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP; panel.addControl(details);
  const panelButton = (name: string, label: string, x: number, y: number, cb: () => void) => {
    const b = button(name, label, x, y, cb, 98); ui.removeControl(b); panel.addControl(b); return b;
  };
  const palette = panelButton('palette', 'Color', 10, 96, actions.palette);
  const sword = panelButton('weapon', 'Sword', 116, 96, actions.weapon);
  const shield = panelButton('shield', 'Shield', 222, 96, actions.shield);
  const idle = panelButton('idle', 'Idle', 10, 143, () => actions.demonstration('idle'));
  const run = panelButton('run', 'Run preview', 116, 143, () => actions.demonstration('run'));
  const swing = panelButton('swing', 'Swing preview', 222, 143, () => actions.demonstration('swing'));
  const caption = new TextBlock('caption', 'KayKit / Kay Lousberg · Training previews'); caption.fontSize = 11; caption.color = '#9db0c6';
  caption.height = '23px'; caption.top = '191px'; caption.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP; panel.addControl(caption);
  const hint = text('hint', '', 0, 13); hint.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM; hint.top = '-12px';
  const touchButtons: Button[] = [];
  const touchButton = (action: 'up' | 'down' | 'left' | 'right' | 'sprint', label: string, x: number, bottom: number, width = 48) => {
    const b = button(action, label, x, -bottom, () => {}, width); b.height = '44px';
    b.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    touchButtons.push(b); return b;
  };
  touchButton('up', '↑', 66, 118); touchButton('left', '←', 12, 66);
  touchButton('right', '→', 120, 66); touchButton('down', '↓', 66, 14);
  const sprint = touchButton('sprint', 'Sprint', 0, 78, 90); sprint.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT; sprint.left = '-12px';
  const reset = button('reset', 'Reset', -12, -24, actions.reset, 90); reset.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT; reset.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
  return {
    debug,
    encounter(value: string) { combatStatus.text = value; },
    touchActionAt(x: number, y: number): 'up' | 'down' | 'left' | 'right' | 'sprint' | undefined {
      const scale = scene.getEngine().getHardwareScalingLevel();
      const control = touchButtons.find(b => b.isVisible && b.contains(x / scale, y / scale));
      switch (control?.name) {
        case 'up': case 'down': case 'left': case 'right': case 'sprint': return control.name;
        default: return undefined;
      }
    },
    blocksPointer(x: number, y: number) {
      const scale = scene.getEngine().getHardwareScalingLevel();
      return [inspection, arena, story, panel, reset, ...touchButtons, ...combatButtons].some(control => control.isVisible && control.contains(x / scale, y / scale));
    },
    update(record: CharacterRecord, mode: PlayMode, demo: Demonstration, touch: boolean, storage: string, distance: number) {
      inspection.background = mode === 'inspection' ? '#735c34' : '#23364a'; arena.background = mode === 'arena' ? '#735c34' : '#23364a';
      summary.isVisible = !compact || mode === 'inspection';
      instructions.isVisible = !compact || mode === 'inspection';
      summary.text = `${record.name} · Level ${record.progression.level} · ${storage}`;
      instructions.text = mode === 'inspection' ? (touch ? 'Drag to orbit · Pinch to zoom' : 'Right drag to orbit · Wheel to zoom') : (touch ? 'Hold arrows to move · Hold Sprint · Drag to orbit' : 'WASD / arrows · Shift sprint · R reset · F3 debug');
      panel.isVisible = mode === 'inspection';
      combatStatus.isVisible = mode === 'arena';
      for (const b of combatButtons) b.isVisible = mode === 'arena';
      details.text = `Health ${record.maximumHealth}  ·  Walk ${record.stats.walkSpeed}  ·  Sprint ${record.stats.sprintSpeed}\n${record.equipment.weapon ? TRAINING_GEAR[record.equipment.weapon].label : 'No weapon'}  /  ${record.equipment.offhand ? TRAINING_GEAR[record.equipment.offhand].label : 'No shield'}`;
      palette.textBlock!.text = record.appearance.palette === 'slate' ? 'Slate blue' : 'Crimson';
      sword.textBlock!.text = record.equipment.weapon ? 'Sword: on' : 'Sword: off'; shield.textBlock!.text = record.equipment.offhand ? 'Shield: on' : 'Shield: off';
      for (const [b, value] of [[idle, 'idle'], [run, 'run'], [swing, 'swing']] as const) b.background = demo === value ? '#735c34' : '#23364a';
      for (const b of touchButtons) b.isVisible = touch && mode === 'arena'; reset.isVisible = touch && mode === 'arena';
      hint.isVisible = mode === 'arena' && !touch; hint.text = distance > 0.25 ? `${distance.toFixed(1)} m traveled` : 'Move to begin';
    },
    resize(width: number, height: number) {
      ui.idealWidth = width; ui.idealHeight = height;
      compact = height < 520;
      for (const b of combatButtons) b.top = compact ? '94px' : '216px';
      combatStatus.top = compact ? '138px' : '154px';
      debug.top = compact ? '196px' : '264px';
      panel.horizontalAlignment = compact ? Control.HORIZONTAL_ALIGNMENT_RIGHT : Control.HORIZONTAL_ALIGNMENT_CENTER;
      panel.left = compact ? '-12px' : '0px'; panel.top = compact ? '-12px' : '-18px';
      panel.width = `${Math.min(330, width - 24)}px`;
      debug.fontSize = width < 600 ? 10 : 11;
    },
    dispose() { ui.dispose(); },
  };
}
