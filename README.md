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

Step 1 establishes six TypeScript workspaces. There is no playable scene yet;
Babylon rendering and controls are the next step.

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
No Firebase credentials, deployment secrets, or billing are needed for Step 1.

GitHub Actions runs installation, lint, type checking, tests, and builds on pull
requests and pushes to `main`. It does not deploy. See
[sources/Implementation_Status.md](sources/Implementation_Status.md) for progress
and [the complete handoff](sources/Thy_Will_Cloud_Architecture_Handoff.md) for the
next steps.
