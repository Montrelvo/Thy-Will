"""Run with Blender 4.5.3 --background --factory-startup --python this-file."""
import json
from pathlib import Path
import bpy

ROOT = Path(__file__).resolve().parents[2]
if bpy.app.version[:3] != (4, 5, 3):
    raise RuntimeError('Use the pinned Blender 4.5.3 build')
OUTPUT = ROOT / 'apps/client/public/assets/kaykit'
OUTPUT.mkdir(parents=True, exist_ok=True)
CLIPS = {'Idle', 'Walking_A', 'Running_A', '1H_Melee_Attack_Chop', 'Unarmed_Melee_Attack_Punch_A'}
for palette, color in [('slate', (0.055, 0.115, 0.21)), ('crimson', (0.32, 0.05, 0.08))]:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(ROOT / '.art-cache/Knight.glb'))
    for obj in list(bpy.data.objects):
        if obj.name in {'1H_Sword_Offhand', '2H_Sword', 'Rectangle_Shield', 'Round_Shield', 'Spike_Shield'}:
            bpy.data.objects.remove(obj, do_unlink=True)
    shield = bpy.data.objects['Badge_Shield']
    for vertex in shield.data.vertices:
        vertex.co *= 1.12
    # Edit the red cloth swatches in Blender's image data; steel/skin remain intact.
    for image in bpy.data.images:
        pixels = list(image.pixels[:])
        for i in range(0, len(pixels), 4):
            r, g, b = pixels[i:i+3]
            if r > g * 1.6 and r > b * 1.6 and r > 0.12:
                strength = min(1.4, r / 0.55)
                pixels[i:i+3] = [min(1, component * strength) for component in color]
        image.pixels[:] = pixels
        image.update()
        image.pack()
    for obj in bpy.data.objects:
        if obj.animation_data:
            obj.animation_data.action = None
            for track in list(obj.animation_data.nla_tracks):
                if track.name not in CLIPS:
                    obj.animation_data.nla_tracks.remove(track)
    for action in list(bpy.data.actions):
        if action.name not in CLIPS:
            bpy.data.actions.remove(action)
    bpy.ops.export_scene.gltf(filepath=str(OUTPUT / f'knight-{palette}.glb'), export_format='GLB', export_animation_mode='NLA_TRACKS', export_animations=True, export_apply=False, export_yup=True)
print('Exported two edited knight variants with five animation clips each.')
