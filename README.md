# Thy Will

**Thy Will** is an action RPG built around one overriding principle:

> **Power fantasy should be fun.**

The goal is not to reproduce one existing ARPG formula. Instead, *Thy Will* is deliberately assembled from whatever RPG mechanics make the experience more satisfying.

Think of **Dr. Frankenstein building a Diablo / Path of Exile monster out of random RPG parts**.

If a mechanic is fun, supports the power fantasy, and works with the rest of the game, it belongs on the operating table.

## Core Fantasy

The player should grow from dangerous to absurdly powerful through a combination of:

- Fast, responsive action-RPG combat
- Large numbers of enemies
- Powerful abilities with dramatic visual feedback
- Equipment that meaningfully changes how the character plays
- Player-driven equipment crafting
- Build experimentation
- Loot hunting
- Character progression
- Increasingly excessive displays of power

The game should reward experimentation rather than force players toward one predetermined progression path.

## Combat

Combat should feel immediate, aggressive, and increasingly spectacular.

Enemies exist partly as threats and partly as opportunities for the player to demonstrate what their build can do.

Abilities should support combinations such as:

- Direct attacks
- Area attacks
- Projectiles
- Summons
- Movement abilities
- Defensive abilities
- Status effects
- Triggered effects
- Chained effects
- Equipment-granted abilities
- Effects that modify other effects

The long-term goal is a system where mechanics can interact in surprising ways without every interaction needing to be individually scripted.

## Equipment

Equipment is one of the central progression systems.

Items should be more than progressively larger stat sticks. Equipment can modify attacks, skills, defenses, movement, resource generation, damage types, triggers, and other game systems.

The player should be encouraged to ask:

**"What can I build with this?"**

rather than simply:

**"Is this number higher?"**

## Crafting

Crafting should give the player meaningful agency over equipment.

Rather than relying entirely on random drops, players should gradually gain tools for constructing, modifying, combining, rerolling, upgrading, or otherwise manipulating their gear.

The exact crafting systems can evolve during development.

The important principle is:

**Loot provides possibilities. Crafting turns those possibilities into a build.**

## Flashy Visuals

Power should be visible.

As characters become stronger, attacks should become increasingly impressive through:

- Particle effects
- Projectiles
- Impact effects
- Lighting
- Trails
- Screen-space effects
- Enemy reactions
- Environmental effects
- Increasing attack density
- Layered ability interactions

Visual spectacle should communicate mechanical escalation.

The player should be able to look at the screen and immediately understand:

**Something ridiculous is happening because my character became ridiculous.**

## Development Philosophy

*Thy Will* is intentionally modular and experimental.

Systems can be borrowed, mutated, combined, discarded, and rebuilt.

Inspirations may come from action RPGs, roguelikes, MMOs, crafting games, idle games, survival games, traditional RPGs, or anything else that contributes something useful.

No mechanic receives immunity merely because it is traditional.

No mechanic is excluded merely because another genre invented it.

The test is simple:

1. Is it fun?
2. Does it strengthen player agency?
3. Does it contribute to the power fantasy?
4. Does it create interesting interactions with other systems?
5. Is it worth the complexity it introduces?

If so, stitch it onto the monster.

## Current Status

**Early development / experimentation.**

The initial focus is establishing the fundamental playable loop:

**Fight → Loot → Craft → Equip → Become Stronger → Fight Something Worse**

Everything else can grow outward from that foundation.

---

*Thy Will*  
*A Frankenstein action RPG assembled from the best parts available.*

## Development setup

Steps 1–3 establish the TypeScript monorepo, Babylon client and shared headless
simulation. Steps 3.2–3.8 add the persistent local character and device-adapted
inspection/arena modes.

Use Node.js 24 and npm 11 (the lockfile is generated with npm 11.9.0):

```sh
npm ci
npm run check
npm run build
```

`npm run lint` runs ESLint. `npm run typecheck` checks TypeScript project
references and import/dependency boundaries. `npm test` builds and verifies the
headless workspace integration. `npm run clean` removes generated build output.

| Workspace | Responsibility |
| --- | --- |
| `apps/client` | Babylon presentation, input, GUI, and networking adapters |
| `apps/backend` | Secure APIs and later Firebase integration |
| `apps/game-server` | Future authoritative multiplayer host |
| `packages/simulation` | Shared headless game rules |
| `packages/protocol` | Versioned commands, events, and snapshots |
| `packages/content` | Data-driven definitions |
| `cloud` | Future cloud configuration |
| `sources` | Architecture handoff and implementation status |

Shared packages compile without DOM or Node ambient APIs. Simulation can depend
on protocol and content; neither can depend on applications. Package exports
point to built ESM and declaration files, and project references order the build.

GitHub Actions runs installation, lint, type checking, headless tests, builds,
and Chromium browser acceptance tests on pull requests and pushes to `main`.
A separate Pages workflow deploys the shared client on main merges. See
[sources/Implementation_Status.md](sources/Implementation_Status.md) for progress
and [the complete handoff](sources/Thy_Will_Cloud_Architecture_Handoff.md) for the
next steps.


## Run the character viewer and training grounds

```sh
npm ci
npm run dev
```

Open `http://127.0.0.1:5173`. Phones start in Character inspection; desktop
starts in Arena. Use the top buttons to switch. Both modes display the same
character. Character inspection offers slate/crimson colors, training sword and
shield visibility, and idle/run/swing previews. These choices save on this device.
Story is reserved for later stages and is unavailable.

Phone camera: drag the world to orbit and pinch to zoom. In Arena, hold the arrow
buttons to move, hold Sprint with a second finger, and tap Reset. Keyboard and
controller controls remain available. Click the canvas if it loses focus.

| Action | Keyboard / mouse | Standard controller |
| --- | --- | --- |
| Move | WASD or arrow keys | Left stick |
| Sprint | Hold Shift | Hold right bumper |
| Orbit camera | Right mouse drag | Right stick |
| Zoom | Mouse wheel | — |
| Reset to spawn | R | Y / top face button |
| Toggle debug overlay | F3 | — |

Movement follows camera direction. The arena clamps movement at its edges;
pillars and beacon are visual placeholders without collision. This milestone
contains no combat, inventory, or cloud save.

`npm run build` creates the static web app in `apps/client/web-dist` and compiled
workspace modules in each `dist` directory. To run the production build:

```sh
npm run preview --workspace @thy-will/client
```

Browser acceptance tests:

```sh
npx playwright install chromium
npm run build
npm run test:browser
```

The scene uses WebGL with Babylon GUI for the HUD, a following orbit camera,
local glTF beacon loaded through an asset manifest, and one shared procedural
knight renderer. Keyboard, controller and touch movement become commands to the
headless entity simulation at 50 Hz. Inspection run/swing previews are cosmetic
and cannot move the gameplay entity or grant progression. The client loads one
versioned local character record. Account linking and cloud saves arrive later.

See [the bridge plan](sources/Character_Modes_Progression_Plan.md) for acceptance
criteria and the dependencies carried forward to Steps 4–8.

The client alone uses `skipLibCheck` because Babylon's loader declarations conflict
with `exactOptionalPropertyTypes`; application source remains strictly checked.
Shared package declaration checking remains enabled. Controller acceptance tests
use a simulated standard gamepad; physical controller validation remains a manual
check. The pinned Playwright release has a downloadable Chromium build in the
execution environment.
