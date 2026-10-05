# Thy Will — Cloud Architecture & Build Handoff

**Project:** Thy Will  
**Purpose:** Canonical implementation handoff for the Babylon.js + Firebase + Google Cloud architecture  
**Status:** Initial architecture baseline  
**Last reviewed:** 2026-10-05  

---

## 1. Executive Decision

Build **Thy Will** as a browser-first, cloud-backed action RPG with:

- **Babylon.js + TypeScript** as the complete player-facing runtime.
- A **shared, headless TypeScript simulation package** containing game rules.
- **Firebase Authentication** for player identity.
- **Cloud Firestore** for persistent player/account/game state.
- **Firebase Realtime Database** only where low-frequency presence/lobby/chat synchronization is useful.
- **Firebase Hosting** for the initial Babylon application shell and small static files.
- **Cloud Storage + Cloud CDN** later for large immutable game assets when traffic justifies the extra setup.
- **Cloud Run** for secure APIs, matchmaking, asynchronous backend work, and early multiplayer experiments.
- **Authoritative dedicated game servers** for production multiplayer.
- **GKE + Agones** as the long-term dedicated multiplayer hosting layer if/when real-time multiplayer reaches the point where Cloud Run is no longer the right session host.
- **GitHub** as the source of truth.
- **Cloud-based CI/CD** so builds, tests, asset processing, containers, and deployments are performed remotely rather than depending on one local machine.

The architectural rule that should not be broken is:

> **Babylon.js presents the game. The shared simulation defines the game. Cloud services persist, validate, distribute, and eventually host the authoritative multiplayer simulation.**

This keeps single-player simple while preventing the project from becoming impossible to convert to multiplayer later.

---

# 2. Core Architecture

```text
                            GitHub
                               |
                    source / data / assets
                               |
                    cloud CI / build pipeline
                               |
             +-----------------+------------------+
             |                                    |
      Firebase Hosting                     Artifact Registry
      Babylon web shell                    server containers
             |                                    |
             v                                    v
  +-----------------------------------------------------------+
  |                    BABYLON.JS CLIENT                      |
  |-----------------------------------------------------------|
  | Rendering | Input | GUI | Audio | VFX | Animation        |
  | Client prediction | interpolation | presentation          |
  +--------------------------+--------------------------------+
                             |
                       Game Commands
                             |
                +------------+-------------+
                |                          |
          SOLO AUTHORITY             REMOTE AUTHORITY
                |                          |
                v                          v
      Shared Simulation Package       Game Server
                |                          |
                +------------+-------------+
                             |
                         Game Events
                             |
                             v
                     Babylon Presentation

Persistent / cloud services:

Firebase Authentication
        |
Cloud Firestore <---- player saves, inventory, progression, crafting
        |
Realtime Database <-- presence / party / lobby / chat where useful
        |
Cloud Run ---------- secure APIs / matchmaking / jobs
        |
Cloud Storage/CDN -- large content packs
        |
GKE + Agones ------- production dedicated multiplayer sessions
```

---

# 3. Repository Structure

Use one monorepo until there is a strong reason not to.

```text
Thy-Will/
|
|-- apps/
|   |-- client/
|   |   |-- Babylon.js application
|   |   |-- rendering
|   |   |-- cameras
|   |   |-- input
|   |   |-- GUI
|   |   |-- animation
|   |   |-- VFX
|   |   |-- audio
|   |   `-- networking adapters
|   |
|   |-- game-server/
|   |   |-- authoritative simulation host
|   |   |-- session lifecycle
|   |   |-- replication
|   |   `-- anti-cheat validation
|   |
|   `-- backend/
|       |-- account APIs
|       |-- save APIs
|       |-- matchmaking
|       |-- crafting validation
|       `-- admin/background jobs
|
|-- packages/
|   |-- simulation/
|   |   |-- entities
|   |   |-- combat
|   |   |-- stats
|   |   |-- abilities
|   |   |-- effects
|   |   |-- loot
|   |   |-- crafting
|   |   |-- inventory
|   |   |-- AI rules
|   |   `-- world rules
|   |
|   |-- protocol/
|   |   |-- commands
|   |   |-- events
|   |   |-- snapshots
|   |   `-- network serialization
|   |
|   |-- content/
|   |   |-- item definitions
|   |   |-- affixes
|   |   |-- abilities
|   |   |-- enemies
|   |   |-- recipes
|   |   `-- progression tables
|   |
|   `-- shared/
|       `-- utilities and common types
|
|-- assets/
|   |-- source/
|   |-- processed/
|   `-- manifests/
|
|-- cloud/
|   |-- firebase/
|   |-- firestore/
|   |-- cloud-run/
|   |-- storage/
|   |-- cdn/
|   |-- gke/
|   `-- agones/
|
|-- tests/
|   |-- simulation/
|   |-- protocol/
|   `-- integration/
|
|-- sources/
|   `-- architecture and research handoff documents
|
`-- README.md
```

**Important:** game rules must not be buried in `apps/client/`.

If combat math, loot generation, item affixes, crafting outcomes, enemy decisions, or progression rules require Babylon meshes or browser APIs to function, the architecture has drifted in the wrong direction.

---

# 4. The Shared Simulation Contract

The shared simulation is the most important technical decision in the project.

## 4.1 Command Flow

Input should become a command.

Examples:

```text
MoveCommand
AttackCommand
UseAbilityCommand
EquipItemCommand
CraftItemCommand
InteractCommand
PickUpItemCommand
UseConsumableCommand
```

The simulation consumes commands.

The simulation emits events.

Examples:

```text
EntityMoved
AttackStarted
DamageApplied
StatusApplied
EntityKilled
ItemDropped
ItemCrafted
ItemEquipped
ExperienceGranted
LevelGained
```

Babylon.js listens to the resulting state/events and displays them.

Example:

```text
Player presses attack
        |
        v
AttackCommand
        |
        v
Combat simulation
        |
        +--> DamageApplied
        +--> EntityKilled
        +--> LootGenerated
        |
        v
Babylon presentation
        |
        +--> animation
        +--> particles
        +--> hit flash
        +--> sound
        +--> floating damage
        +--> ragdoll / death animation
        `--> loot visual
```

## 4.2 Why This Matters

Single-player:

```text
Babylon Client
   |
LocalAuthority
   |
Shared Simulation
```

Multiplayer:

```text
Babylon Client
   |
RemoteAuthority
   |
Dedicated Game Server
   |
Shared Simulation
```

The rules package stays substantially the same.

The authority changes.

That is the bridge between the individually customized single-player game and future multiplayer.

---

# 5. Babylon.js Responsibilities

Babylon should own everything the player sees, hears, and directly controls.

Use Babylon for:

- World rendering
- WebGL/WebGPU graphics
- Cameras
- Character rendering
- Animation
- Skeletal animation
- Physics presentation/integration
- Havok-based physics where useful
- Particles
- GPU effects
- Materials
- Lighting
- Audio
- GUI
- Input
- Controller support
- Client-side prediction
- Interpolation
- Local responsiveness
- Cosmetic effects
- Debug visualization

Do **not** treat Babylon scene objects as canonical gameplay records.

Bad:

```text
enemyMesh.metadata.hp -= swordDamage
```

Preferred:

```text
simulation.apply(AttackCommand)
-> DamageApplied(entityId, amount)
-> presentation updates enemy mesh
```

Babylon meshes are views of entities.

They are not the entities themselves.

---

# 6. Data-Driven RPG Construction

Thy Will is intentionally a "Frankenstein RPG." Therefore mechanics should be composable data wherever possible.

Example conceptual item definition:

```yaml
id: storm_crown
base: heavy_helm

stats:
  strength: 42
  lightning_damage_pct: 25

triggers:
  - event: critical_hit
    effect: chain_lightning
    chance: 0.15

visual:
  model: storm_crown.glb
  vfx: storm_crown_fx_03
```

The engine should interpret reusable components such as:

- stat modifiers
- damage conversions
- triggered effects
- conditional bonuses
- resource modifiers
- ability grants
- cooldown changes
- projectile modifiers
- area modifiers
- status effects
- summons
- on-hit effects
- on-kill effects
- damage-over-time
- proc chains

This is preferable to creating a custom code path for every item.

---

# 7. Firebase Responsibilities

## 7.1 Firebase Authentication

Use for:

- anonymous first-session accounts
- email/password or federated account upgrades
- persistent player identity
- linking guest progress to a permanent account
- authentication tokens passed to backend services

Recommended first flow:

```text
First launch
   |
Anonymous Firebase account
   |
Player begins immediately
   |
Optional account upgrade later
   |
Anonymous identity linked to permanent login
```

## 7.2 Cloud Firestore

Use Firestore for persistent state that does not need frame-by-frame updates.

Good Firestore data:

```text
users/{uid}
characters/{characterId}
inventories/{characterId}
items/{itemId}
craftingProfiles/{characterId}
progression/{characterId}
unlocks/{characterId}
settings/{uid}
accountEntitlements/{uid}
```

Typical persistent data:

- character level
- experience
- permanent stats
- inventory
- equipped items
- crafted item records
- unlocked recipes
- quest/progression state
- account settings
- cosmetics
- achievements
- build/loadout definitions

### Important rule

Do **not** write every combat event to Firestore.

Persist checkpoints and durable consequences, not every frame.

Good pattern:

```text
player enters dungeon
server/local simulation owns temporary session state
player completes dungeon
validated rewards committed to Firestore
```

## 7.3 Realtime Database

Realtime Database is optional.

Use it only for systems such as:

- online/offline presence
- lightweight party state
- low-frequency lobby state
- chat
- simple coordination
- notifications

Do not use it as the authoritative combat transport.

A single Realtime Database has guidance around **1,000 writes/second** before sustained activity may be rate-limited.

A 100-player combat system sending 20 updates per second already creates:

```text
100 players x 20 updates/sec = 2,000 updates/sec
```

before enemies, projectiles, status effects, or other state are included.

---

# 8. Static Hosting and Asset Delivery

## Phase A — Early Development

Use **Firebase Hosting** for:

- `index.html`
- compiled JavaScript
- CSS
- small configuration
- bootstrap assets
- development builds

Firebase Hosting already provides global CDN-backed distribution.

## Phase B — Asset Growth

When the game contains substantial `.glb`, textures, music, voice, VFX resources, environment packs, or content bundles, move large immutable assets toward:

```text
Cloud Storage
     |
Cloud CDN
     |
Babylon client
```

Use versioned paths such as:

```text
/assets/v12/characters/knight.glb
/assets/v12/textures/armor_iron.ktx2
/assets/v12/audio/combat_01.ogg
```

The client should load assets from a manifest.

Use aggressive caching for immutable versioned assets.

---

# 9. Asset Pipeline

Recommended pipeline:

```text
raw source asset
      |
validation
      |
conversion / optimization
      |
texture compression
      |
mesh optimization
      |
LOD generation where useful
      |
manifest generation
      |
upload
      |
CDN
```

Do not ship source-quality art files to the browser.

---

# 10. Cloud Run Responsibilities

Use Cloud Run for:

- authenticated HTTP APIs
- player-save validation
- secure crafting operations where needed
- account operations
- leaderboards
- entitlement checks
- matchmaking
- scheduled/background processing
- asset-processing helpers
- telemetry ingestion
- administrative services
- early WebSocket multiplayer prototypes

Cloud Run can support WebSockets and up to **1,000 concurrent connections per container**, but WebSockets are long-running requests.

Important limitations:

- an open WebSocket keeps the instance active for billing
- Cloud Run request timeout is currently configurable up to 60 minutes
- clients must reconnect safely
- session affinity is best-effort for subsequent connections
- multiple instances do not automatically share in-memory state

Therefore:

> **Cloud Run is excellent for services and prototypes. Do not make the long-term architecture depend on Cloud Run being the permanent host for every authoritative ARPG session.**

---

# 11. Multiplayer Architecture

## Stage 1 — Single Player

```text
Input
  |
LocalAuthority
  |
Simulation
  |
Events
  |
Babylon
```

## Stage 2 — Multiplayer Prototype

Run an authoritative simulation process in Cloud Run over WebSockets.

Use this stage to measure:

- CPU/session
- memory/session
- player density
- network bandwidth
- prediction/reconciliation behavior

## Stage 3 — Production Multiplayer

Move latency-sensitive session simulation to dedicated game-server processes.

Target stack:

```text
Matchmaking/API
     |
GameServer allocation
     |
Agones
     |
GKE
     |
Dedicated Thy Will server process
     |
Players connect directly to allocated session
```

Agones is designed to host, run, allocate, and scale dedicated game servers on Kubernetes.

The server session owns canonical temporary state for:

- player positions
- monsters
- projectiles
- combat
- buffs
- encounter AI
- authoritative physics decisions
- loot rolls before durable commit

At the end of a validated session, durable results are committed to Firestore.

---

# 12. Networking Rules

### Client -> Server

Send:

- input intent
- commands
- aim/direction
- ability choice
- interaction target
- sequence/tick information

### Server -> Client

Send:

- relevant entity snapshots
- authoritative corrections
- event notifications
- spawn/despawn messages
- health/state changes
- combat outcomes

Use:

- interest management
- relevance filtering
- delta compression
- quantized values where reasonable
- event batching
- lower update rates for distant/unimportant entities

Avoid sending every property of every entity every tick.

Bandwidth is likely to become more expensive than raw server CPU.

---

# 13. Authority and Anti-Cheat

Never trust the browser for durable rewards.

The browser can predict.

The server decides.

The client may say:

```text
"I attempted AttackCommand #921 at tick 18823."
```

The server determines whether that command was legal and what actually happened.

Persistent valuable changes should be validated server-side before committing.

---

# 14. Save Model

Separate state into:

## Durable State

Persist:

- character identity
- level
- permanent progression
- inventory
- equipment
- crafted items
- unlocked systems
- achievements
- currencies
- account-wide progression

## Session State

Normally ephemeral:

- monster positions
- projectiles
- temporary status effects
- current attack animation
- momentary physics state
- encounter-local temporary objects

## Checkpoints

Persist meaningful boundaries:

- town return
- dungeon completion
- item craft completion
- boss reward
- equipment change
- character progression milestone
- explicit safe checkpoint

---

# 15. CI/CD and Cloud-First Development

GitHub is the canonical source.

Target pipeline:

```text
GitHub push / pull request
        |
        v
Cloud build runner
        |
        +--> install dependencies
        +--> type checking
        +--> simulation unit tests
        +--> protocol compatibility tests
        +--> client build
        +--> server build
        +--> asset validation
        +--> asset optimization
        +--> container build
        |
        +--> preview deployment
        |
merge to main
        |
        +--> Firebase Hosting deploy
        +--> Storage/CDN asset publish
        +--> Cloud Run deploy
        `--> Artifact Registry publish
```

Later:

```text
release tag
   |
build dedicated game server image
   |
Artifact Registry
   |
GKE / Agones rollout
```

---

# 16. Environment Strategy

Use at least:

```text
development
staging
production
```

Recommended project separation:

```text
thy-will-dev
thy-will-staging
thy-will-prod
```

Do not use the production player database for routine development.

Environment-specific secrets must not live in Git.

---

# 17. Security Baseline

Before public release:

- Require Firebase Authentication for player-owned state.
- Write Firestore Security Rules.
- Prevent clients from writing arbitrary other-user records.
- Validate sensitive mutations through backend APIs.
- Never put server credentials in browser bundles.
- Store secrets in managed secret storage.
- Apply least-privilege service accounts.
- Rate-limit public APIs.
- Validate item/crafting requests.
- Validate multiplayer commands.
- Log suspicious mutation patterns.
- Consider App Check for abuse reduction.
- Set billing alerts immediately after enabling Blaze.
- Separate development and production environments.

---

# 18. Observability

Track:

## Client

- loading time
- asset download size
- FPS
- frame-time percentiles
- WebGPU/WebGL selection
- crashes
- disconnects
- reconnects

## Simulation

- simulation tick time
- entity counts
- projectile counts
- AI cost
- ability/effect cost
- worst-case build interactions

## Backend

- Firestore reads
- Firestore writes
- Firestore bandwidth
- Cloud Run CPU
- Cloud Run memory
- request count
- API latency
- WebSocket concurrency
- outbound network traffic

## Multiplayer

- player-hours
- server-hours
- players/server process
- bytes/player-second
- input packets/sec
- snapshots/sec
- correction rate
- latency
- packet loss
- session duration

---

# 19. Current Cost Baseline

Prices change. Treat this section as a dated model, not a permanent quote.

**Pricing checked: 2026-10-05.**

## Firebase Hosting

- first **10 GB storage**: no cost
- first **10 GB/month data transfer**: no cost
- additional storage: about **$0.026/GB**
- additional transfer: about **$0.15/GB**

## Cloud CDN

North America current first-tier cached egress:

- about **$0.08/GiB** up to 10 TiB/month
- about **$0.055/GiB** from 10–150 TiB
- about **$0.03/GiB** in the next listed high-volume tier
- cache-fill and lookup request charges also apply

Google's published example for 500 GiB cached delivery, 25 GiB cache fill, and 5,000,000 lookups is approximately **$44/month**.

## Firestore Standard — us-central1 Example

- reads: **$0.03 / 100,000**
- writes: **$0.09 / 100,000**
- deletes: **$0.01 / 100,000**

Free daily quota:

- 50,000 reads
- 20,000 writes
- 20,000 deletes

## Realtime Database

Current Blaze baseline includes:

- approximately 10 GB/month downloaded at no cost
- additional downloaded data: about **$1/GB**
- storage above the free allowance: about **$5/GB**
- up to 200,000 simultaneous connections per database on the relevant paid limit
- sustained write guidance around 1,000 writes/sec per database

## Cloud Run Instance-Based Compute

Current `us-central1` instance-based baseline:

- CPU: **$0.000018 per vCPU-second**
- memory: **$0.000002 per GiB-second**
- monthly free tier:
  - 240,000 vCPU-seconds
  - 450,000 GiB-seconds

A continuously active 1 vCPU / 0.5 GiB instance costs before free allowance:

```text
CPU:
3600 x $0.000018 = $0.0648/hour

Memory:
3600 x 0.5 x $0.000002 = $0.0036/hour

Total:
~$0.0684/hour
```

## Realtime Game Network Baseline

For North-American Premium Tier internet egress, the current first paid tier is approximately:

```text
$0.12/GiB
```

---

# 20. Multiplayer Cost Model

This is a planning model, not a guaranteed bill.

Assumptions:

```text
1 vCPU server process
0.5 GiB memory
25 concurrent players/server process
25 KiB/sec average downstream traffic/player
North-American-heavy audience
Cloud Run instance-based rate used for early model
Premium network egress baseline used for game traffic
```

## Bandwidth Per Player-Hour

```text
25 KiB/sec x 3600 sec
= 90,000 KiB
= ~87.9 MiB
= ~0.0858 GiB/player-hour
```

At $0.12/GiB:

```text
~$0.0103 network cost/player-hour