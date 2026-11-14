# Thy Will project summary

Reviewed November 14, 2026. This review covers the six prior Babylon Action RPG project chats, the public game repository, and the status of the companion developer preview. The game source reviewed on `main` was [265f0c3](https://github.com/Montrelvo/Thy-Will/commit/265f0c385750c38c9a8d9c4b2532f908526080ad). GitHub confirmed the merge and pull request states below. The live player build could not be independently reopened during this review.

## Project decisions from the chats

| Chat | Decision or outcome |
| --- | --- |
| Create Thy Will Repository | Established a browser-first action RPG about escalating power, build experimentation, loot and player-directed crafting. Chose Babylon.js for presentation, a shared headless TypeScript simulation for rules, and a staged Firebase/Google Cloud path for persistence and multiplayer. |
| Review Step One Build | Established the npm workspaces, strict TypeScript boundaries, build checks and CI. Followed with a controllable Babylon scene and headless movement. |
| Verify Forward Facing Build | Added Step 2.5 so the project could be reviewed from a phone. It introduced a GitHub Pages preview, touch orbit and pinch zoom, and portrait/landscape support. |
| Check Thy Will Repo | Separated public play from private art review. The companion repo's phone-friendly Codespaces preview launcher and URL handoff have since merged. Live authenticated preview access was outside this review. |
| Check integration progress | Reviewed equipment and crafting, kept the crafting assertions intact while fixing strict type errors, and began anonymous Firebase identity on a separate branch. |
| Firebase setup plan | Defined Step 7.5 as the live Firebase project setup and reload test before Step 8. The plan calls for a development web app, anonymous sign-in, Firestore and Hosting, with billing deferred. |

## In the game on main

| Milestone | Progress |
| --- | --- |
| 1–3 | Six npm workspaces, CI and browser acceptance tests. Babylon.js/Vite renders a bounded training arena with an orbit camera and HUD. The headless simulation uses 50 Hz ticks, commands/events, seeded randomness and versioned snapshots. |
| 3.2–3.8 | A locally saved character profile is shared by Character inspection and Arena. Phones open inspection by default and desktops open Arena. Touch, keyboard and standard-controller input are supported. Inspection previews are cosmetic and pause the encounter. Story is reserved in the mode UI. |
| 4 | Target, approach and melee a stationary sentinel, then collect its seeded loot. The simulation controls range, cooldown, health, drops and pickup. The enemy has no AI or retaliation. |
| 4.5 | Both modes use a rigged KayKit knight. The enemy and arena remain placeholders. Normal builds use committed art, and a manual GitHub workflow can rebuild it with Blender. |
| 5 | Loot instances have stable IDs and affixes. Weapon/offhand equipment affects simulation-derived stats. Inventory and equipment are included in simulation snapshots. |
| 6 | Recipes combine components, add, upgrade, replace or reroll modifiers, and attach effects. The simulation validates targets and consumes materials transactionally. Crafted state is included in snapshots. Merged in [PR #11](https://github.com/Montrelvo/Thy-Will/pull/11). |

The prototype covers movement, a basic fight, loot, equipping and crafting. Character identity and appearance persist on the device. Inventory and crafting can serialize to a simulation snapshot, while durable player save/load is still a later milestone. The fuller vertical slice calls for groups of enemies, a stronger follow-up encounter, and saved progression. [Implementation history](Implementation_Status.md) · [Architecture and vertical slice](Thy_Will_Cloud_Architecture_Handoff.md)

## Character model and animation

The player character is Kay Lousberg's CC0 **KayKit Adventurers Knight**. The headless Blender 4.5.3 pipeline uses the pinned upstream `Knight.glb`, recolors cloth slate or crimson, scales the badge shield by 12%, removes unused accessories, and exports two GLBs with embedded textures, a skin and five original KayKit clips. The shipped files are [knight-slate.glb](../apps/client/public/assets/kaykit/knight-slate.glb) and [knight-crimson.glb](../apps/client/public/assets/kaykit/knight-crimson.glb).

The five embedded clips are `Idle`, `Walking_A`, `Running_A`, `1H_Melee_Attack_Chop` and `Unarmed_Melee_Attack_Punch_A`. Babylon plays the imported animation in the viewer and arena. Combat events drive attack presentation, and the headless simulation controls gameplay movement and damage. [Art plan](Art_Development_Step_4_5.md) · [Blender export script](../scripts/art/process_knight.py) · [Pinned source and license](art/assets.lock.json)

**ActionForge can be used to extend these animations.** Its documented custom-rig workflow accepts a rigged GLB, maps its existing skeleton and exports motion on that same skeleton. A first test would import the slate knight as a rigged character, map the KayKit bones, preview an in-place hit reaction or dodge, export GLB, and verify the result in Blender and Babylon. Check skeleton paths, root motion, sword/shield attachment, foot contact and both palettes. A dodge animation would still need a separate gameplay ability before it could move the player. Add a verified clip to the repeatable art pipeline and Babylon's playback mapping. ActionForge's animation-import documentation lists specific source rigs, so editing an existing KayKit clip in ActionForge is a separate compatibility test. The actual KayKit round-trip has yet to be tested. [ActionForge character import, retargeting and export](https://actionforge.app/help/main-page)

## Planned work and current progress

| Plan | Status |
| --- | --- |
| Step 7 and 7.5 — Firebase identity and live acceptance | Repository foundation is in open draft [PR #12](https://github.com/Montrelvo/Thy-Will/pull/12). It includes anonymous authentication, browser-local identity persistence, character ownership binding, owner-scoped Firestore rules and Hosting/emulator configuration. [Workspace checks passed](https://github.com/Montrelvo/Thy-Will/actions/runs/37555742916). Live setup and verification of the same anonymous UID after reload remain the next documented checkpoint. |
| Step 8 — Durable saves | Planned after live identity acceptance. Versioned Firestore save/restore for progression, inventory, equipment, currencies, unlocks and settings. |
| Steps 9–10 — Firebase deployment and cloud CI | GitHub Actions checks and a Pages deployment workflow exist. Firebase HTTPS deployment, environment separation, cache configuration and automated staging remain roadmap work. |
| Steps 11–13 — Backend and asset delivery | Planned authenticated Cloud Run APIs for profile/save/craft/session/matchmaking. The KayKit rebuild and asset manifest are early pieces of the broader asset pipeline. Larger asset delivery via Cloud Storage/CDN depends on measured need. |
| Steps 14–17 — Multiplayer | Shared rules and versioned local commands/snapshots are foundations. Remote replication, server authority and a multi-client Cloud Run WebSocket test remain planned. Performance and cost measurements govern the dedicated-server decision, with GKE/Agones as the later option. |
| Game content and art | Story stages/objectives, enemy AI and groups, tougher encounters, broader progression/build options, projectiles, summons, movement/defensive skills, status and triggered/chained effects, and richer visual feedback remain planned. The art plan calls for a KayKit enemy, Dungeon Remastered arena dressing, lighting and HUD polish, armor variation and mobile performance validation. |

[Full roadmap](Thy_Will_Cloud_Architecture_Handoff.md) · [Art follow-up](Art_Development_Step_4_5.md)
