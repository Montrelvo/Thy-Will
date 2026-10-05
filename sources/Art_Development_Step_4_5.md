# Step 4.5 — KayKit art foundation and remote asset editing

Approved 2026-10-05. Progression is now 4 → 4.5 → 5.

## Art direction

Use KayKit's free CC0 packs as the consistent foundation. Start with a readable,
stylized armored knight, slate blue/crimson cloth, steel armor, restrained gold
accents and clear silhouettes. Keep attribution even when the license does not
require it. Paid extras/source packs are future expansion, not a dependency.

The first deliverable replaces the procedural character with a rigged KayKit
knight in both Character inspection and Arena. Scripted edits enlarge the badge
shield 12% and recolor red cloth swatches. Both palette variants keep idle, walk,
run, sword attack and unarmed attack clips. Gameplay rules remain unchanged.

## Reproducible remote workflow

Source repository: https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0
Pinned commit and source hashes: `art/assets.lock.json`.
Creator license: `art/KayKit-LICENSE.txt` (CC0). Author: Kay Lousberg.

```
python scripts/art/acquire.py
python scripts/art/setup_blender.py
```

The second command downloads the official Linux x64 Blender 4.5.3 archive,
verifies its SHA-256, installs it into an ignored tools directory and runs
`process_knight.py` without a GUI. Original assets stay in an ignored cache;
only modified, optimized GLBs and license are shipped in the client. The regular
npm build does not install Blender or contact upstream asset servers.

If Blender 4.5.3 is already available:

```
blender --background --factory-startup --python-exit-code 1 --python scripts/art/process_knight.py
```

The manual **KayKit art rebuild** GitHub Actions workflow runs the same process
on a temporary runner and uploads model artifacts. It has read-only repository
permissions and does not commit or deploy automatically. It can be started from
GitHub on a phone. Scripts/configuration persist in git; the machine running
Blender can be replaced. The runtime pipeline is Linux x64 and uses Python 3.12+
for safe archive extraction.

## Acceptance

- Headless Blender imports, visibly modifies and exports the real knight.
- Processed GLBs embed textures, preserve a skin and the five required clips,
  and are smaller than the original source.
- Babylon inspection and arena use the imported character and profile choices.
- Idle/run/swing previews and attack commands animate the rig without adding
  simulation rules to meshes. Equipment toggles hide the correct accessories.
- Missing character assets show an explicit load error instead of substituting
  proof-of-concept artwork in the player viewport.
- Desktop, phone portrait and landscape remain usable; combat regression passes.
- Sources, processing scripts, license and build workflow are versioned.

## Subsequent art work

The imported knight and repeatable pipeline are the first art foundation, not a
finished visual game. Next replace the stationary enemy with a KayKit enemy,
dress one arena with Dungeon Remastered pieces, establish lighting and a matching
HUD, then validate mobile performance. Use one finished encounter as the visual
reference before expanding content. Armor progression depends on Step 5's owned
items/equipment and will require checking mesh/rig compatibility. Buying source
files later provides original authoring data that a glTF import cannot recover.
