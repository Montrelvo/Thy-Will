# Thy Will implementation status

Updated: 2026-10-05

## Step 1 — Complete

Six npm workspaces, strict shared TypeScript configuration, reproducible lockfile,
lint/typecheck/test/build commands, dependency boundary checks, and GitHub CI.
The truncated repository handoff was restored from the complete attached source.
Clean-clone verification and GitHub CI passed. Review: pull request #1.

## Step 2 — Babylon client bootstrap

Implemented a Vite browser shell, Babylon WebGL engine, scene and resource
lifecycle, following orbit camera, placeholder capsule player, bounded grid
arena, four pillars, spawn pad, and a locally bundled glTF beacon.

Keyboard and standard-controller input produce camera-relative movement intent.
The headless simulation package updates plain position values; the presentation
copies state into meshes. This small movement boundary precedes the full entity,
command/event, random-service, serialization, and tick skeleton in Step 3.

Controls: WASD/arrows move; Shift or RB sprint; R or Y reset; right mouse drag or
right stick orbit; wheel zoom; F3 debug. Input clears on focus loss. Hidden tabs
pause movement; elapsed time is capped to prevent resume teleports. HMR/navigation
cleanup disposes input listeners, assets, GUI, scene, and engine. Back/forward
cache preserves the scene. Asset failure is nonfatal and shown in debug status.

Babylon GUI displays the control guide, distance traveled, and optional debug
information (FPS, mesh count, coordinates, input source, and asset state).

`npm run dev` opens development on port 5173. `npm run build` produces static
`apps/client/web-dist` output; preview uses port 4173. GitHub CI also runs browser
acceptance tests and uploads diagnostics on failure.

## Validation

Lint, strict source type checks, production build, and five headless tests pass.
Chromium browser tests cover rendered startup and glTF loading, keyboard movement,
sprint input, reset, focus loss, debug visibility, resize, simulated controller
movement and held-reset behavior, and missing-asset fallback. Physical controller
validation is a manual check. The rendered scene was inspected visually.

Client declaration checking uses `skipLibCheck` for Babylon's upstream optional
property type incompatibility; shared package declaration checking remains strict.
Rendering is WebGL for this bootstrap. WebGPU selection can be introduced later.
Visual props have no obstacle collision; only arena bounds constrain movement.
No combat, inventory, persistence, or cloud resources are implemented yet.

## Step 2.5 — Merged and deployed

PR #3 merged into main as `622d71a413598d84a978bd170a1de190cf093c11`.
Main Workspace checks and Mobile preview deployment both succeeded.

## Step 3 — Shared simulation skeleton

Protocol owns plain entity IDs, transforms, movement stats, health, commands,
events and versioned snapshots. Simulation owns entity state, validated spawning,
a bounded command queue, a 50 Hz fixed tick, movement and reset, event draining,
and an injectable random service with an explicit reproducible state.

The Babylon client sends world-space intents and displays entity state. A client
accumulator advances fixed ticks with the existing pause/time-cap protections.
The headless game-server entrypoint exposes the same Simulation session factory.
Meshes and browser APIs are absent from shared packages.

Snapshots validate unknown JSON, schema/protocol versions, unique IDs, finite and
bounded transforms/stats, health, tick and random state. Restoring resumes ticks
and the exact seeded random stream. Snapshots require a settled command queue;
commands and undrained events are transient and are not restored. These are local
simulation checkpoints, not authenticated cloud saves or multiplayer messages.
The current random algorithm is lcg32; future algorithms require explicit version
and restore support. The old advancePosition helper remains for compatibility.

Only the latest movement/reset command per entity is applied each tick;
ordered combat actions are also processed; movement intents last
one tick and are resubmitted by the client. Hosts must drain events regularly.
Remote transport validation and authenticated command ownership remain future work.

Validation: npm run check covers lint, type checks, architecture boundaries,
production build and 11 Node tests. Browser acceptance checks cover the existing
startup, keyboard, sprint/reset, focus loss, resize, controller and asset fallback.

## Steps 3.2–3.8 — Character and device bridge

The approved plan is in `sources/Character_Modes_Progression_Plan.md`, and the
canonical architecture handoff now includes these intermediate steps.

- 3.2: Validated, versioned headless character profile with stable ID, reserved
  owner UID, appearance, starter training loadout, progression, stats and health.
  The client repository adapter persists profile changes locally and keeps
  unsupported/corrupt data intact. Denied storage leaves a usable session.
- 3.4: One Babylon renderer builds a placeholder knight with sword/shield, color,
  movement animation and cosmetic run/swing effects. Both modes reuse it.
- 3.6: Character inspection and arena share the profile and simulation. Inspection
  preserves arena position and cannot issue movement commands. The story-stage
  registry entry is reserved and visibly disabled.
- 3.8: Babylon GUI adapts to screen density/orientation; native touch orbit/pinch
  excludes GUI hit regions. Native per-pointer controls support movement plus
  sprint and release on cancellation, blur and mode changes. Keyboard/controller
  input remains supported. Rendering density is capped by device class; safe-area
  padding protects controls around phone cutouts. Asset URLs honor the hosting base.

Local validation: lint, strict types, workspace boundaries, production build,
13 Node tests and 6 Chromium acceptance tests. Tests include persistence across
reload, mode sharing, unsupported/denied storage, real browser touch gestures,
multi-touch sprint, release/cancellation, reset and portrait/landscape layout.
Desktop and phone screenshots were inspected. Physical devices remain a manual
check. Cloud CI independently runs this same suite on the review PR.

Local character saves have no cross-device synchronization yet. Training gear
choices are visual; inventory ownership/modifiers arrive in Step 5. Demonstrations
have no damage or rewards; combat remains Step 4. No story content is fabricated.

## Step 4 — First combat loop

Authorized after PR #6 merged as `6f185996b76f2c6c75da5eeb921af37561224d05`.
One stationary sentinel provides the first complete fight: select target, approach,
attack, damage, death, deterministic weighted drop, and pickup to a session bag.

Content defines 60 enemy HP, 20 melee damage, 2.6 m attack range, 20 ticks of
cooldown and 2 m pickup range. Simulation validates living actors/targets, range,
cooldown, bag capacity and drop availability. Same-tick actions stay ordered;
movement intent cannot discard attacks. Dead targets cannot drop again, and
pickup atomically removes the ground item and adds it to its owning inventory.

The Babylon client displays enemy state, a selection ring, attack swing, hit flash,
death collapse and a gold pickup. Keyboard, controller and GUI actions use the
same commands. Inspection pauses ticks and hides the encounter; cosmetic swing
previews remain isolated from combat and rewards. Mode switches preserve the bag.

Snapshots/protocol move to version 2 with combat cooldown/target state, ground
loot and owned inventory entries, with validated references and unique item IDs.
Version 1 snapshots migrate with empty loot/inventories; original movement-only
entities remain usable for movement. RNG restoration reproduces future drops.

Validation: lint, strict types, boundaries, build, 18 headless tests, and browser
acceptance for desktop/phone fight → kill → drop → pickup, landscape touch
controls, controller combat edges and existing regression coverage (9 scenarios).
Desktop, phone portrait and phone landscape screenshots were inspected.
Physical controller/device validation remains a manual check.

This slice has no enemy AI or retaliation. The bag is session-only and clears on
reload; training equipment remains cosmetic. Full inventory/equipment and
modifiers are Step 5. Account/cloud persistence and story content remain later.

## Next — Step 5

Inventory/equipment instances, modifiers and equip-derived character stats.
Proceed after the Step 4 review and merge.

## Permissions

Repository publication is authorized. Firebase/Google project access is needed
at Step 7; paid services and billing require explicit authorization later.

## Step 2 publication status

The user explicitly authorized publishing the Step 2 source and asset to the
public repository and opening its draft pull request on 2026-10-05.
Implementation branch: `codex/step-2-babylon-client`, based on the Step 1 branch.
