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
```

## Compute Before Free Tier

One server:

```text
~$0.0684/hour
```

At 25 concurrent players:

```text
~$0.00274 compute/player-hour
```

## Approximate Monthly Scenarios

| Multiplayer usage | Approx server instance-hours | Compute after current free allowance* | Network at 25 KiB/s | Approx subtotal |
|---:|---:|---:|---:|---:|
| 1,000 player-hours | 40 | ~$0 | ~$10.30 | ~$10 |
| 10,000 player-hours | 400 | ~$22 | ~$103 | ~$125 |
| 100,000 player-hours | 4,000 | ~$268 | ~$1,030 | ~$1,298 |

\* Free allowances are billing-account scoped and actual bills depend on other workloads consuming them.

This table excludes database activity, logging, matchmaking requests, asset downloads, load-balancing costs, GKE infrastructure, regional differences, taxes, storage, abuse, observability ingestion, and backups.

---

# 21. Example 10,000-MAU Planning Scenario

Assume:

```text
10,000 monthly active players
500 MiB cold asset download/player/month
10 multiplayer hours/player/month
25 KiB/sec average multiplayer downstream traffic
25 concurrent players/server process
mostly North American traffic
```

Approximate major costs under these assumptions:

```text
Asset CDN cached transfer:
~$400 before request/cache-fill details

Multiplayer network:
~$1,030

Multiplayer compute:
~$268

Firestore:
likely comparatively small if save design is disciplined
```

Core planning subtotal:

```text
~$1,700/month order of magnitude
```

Most important sensitivity variables:

1. actual asset download size
2. cache hit rate
3. bytes/player-second
4. concurrent players/server process
5. simulation CPU
6. geographic distribution
7. log volume
8. persistent-state write frequency

---

# 22. Cost Controls

Implement before scale:

- Google Cloud billing budget alerts
- per-service dashboards
- network egress monitoring
- Firestore operation dashboards
- Cloud Run instance limits during development
- staging separate from production
- log retention limits
- rate limits
- asset caching
- immutable versioned assets

Budget alerts do not automatically stop all spending. Do not assume a single global cap will safely stop every Google Cloud resource.

---

# 23. Step-by-Step Build Plan

## Step 1 — Establish Monorepo

Create:

```text
apps/client
apps/backend
apps/game-server
packages/simulation
packages/protocol
packages/content
cloud
sources
```

Acceptance criteria:

- workspace builds from a clean clone
- TypeScript configuration shared
- lint/typecheck command
- test command
- no gameplay implementation depends on Firebase yet

## Step 2 — Babylon Client Bootstrap

Create:

- engine initialization
- scene lifecycle
- camera
- player placeholder
- environment placeholder
- keyboard/controller input
- debug overlay
- asset loader abstraction

Acceptance criteria:

- browser opens into a controllable 3D scene
- rendering code is isolated from simulation code

## Step 3 — Shared Simulation Skeleton

Implement:

- EntityId
- Entity
- Transform state
- Stats
- Health
- Command interface
- Event interface
- Simulation tick
- random-service abstraction
- serialization boundary

Acceptance criteria:

- simulation can execute in Node without Babylon or DOM
- tests can spawn entities, apply commands, and inspect events

## Step 4 — First Combat Loop

Implement in simulation:

```text
move
target
attack
damage
death
loot
```

Babylon visualizes results.

Acceptance criteria:

```text
Fight -> Kill -> Drop -> Pick Up
```

works without game rules being stored in meshes.

## Step 5 — Inventory / Equipment

Implement:

- item instance ID
- base item definition
- affixes
- inventory
- equip slots
- derived stats
- serialization

Acceptance criteria:

- changing equipment changes simulated stats
- Babylon UI only displays resulting state

## Step 6 — Crafting

Implement modular operations such as:

- add modifier
- reroll modifier
- upgrade value
- replace modifier
- combine components
- socket/attach effect
- server-validation hooks

Acceptance criteria:

- crafting works from data definitions
- no UI-specific crafting logic exists in simulation

## Step 7 — Firebase Project

Create development Firebase/Google Cloud project.

Enable:

- Authentication
- Firestore
- Hosting

Optionally later:

- Realtime Database

Acceptance criteria:

- anonymous user can sign in
- player identity survives reload
- development security rules exist

## Step 8 — Save / Load

Initial durable schema:

```text
uid
characterId
schemaVersion
progression
inventory
equipment
currencies
unlocks
settings
updatedAt
```

Acceptance criteria:

- character saves
- reload restores character
- schema has explicit versioning
- migration path exists

## Step 9 — Firebase Hosting

Deploy Babylon web build.

Acceptance criteria:

- public HTTPS build
- cache headers configured
- environment configuration separated
- deploy automated

## Step 10 — Cloud CI

On pull request:

- install
- typecheck
- unit tests
- build
- asset validation

On main merge:

- deploy development/staging automatically

Acceptance criteria:

- clean cloud build reproduces the game
- local machine is not a special dependency

## Step 11 — Cloud Run Backend

Initial endpoints:

```text
/health
/session
/profile
/save
/craft
/matchmaking
```

Use Firebase ID token verification.

Acceptance criteria:

- backend verifies authenticated user
- client cannot impersonate another UID
- privileged operations are not trusted directly from browser input

## Step 12 — Asset Pipeline

Acceptance criteria:

- source asset goes in
- optimized game asset comes out
- manifest is regenerated
- version/hash is produced
- client loads asset by manifest entry

## Step 13 — CDN Split

Do only once measurements justify it.

Move large immutable assets from general Hosting into:

```text
Cloud Storage -> Cloud CDN
```

## Step 14 — Multiplayer Protocol Prototype

Define:

```text
ClientCommand
ServerEvent
WorldSnapshot
EntityDelta
Spawn
Despawn
Correction
Ping/Pong
```

Acceptance criteria:

- protocol is versioned
- simulation runs unchanged under local or remote authority

## Step 15 — Cloud Run Multiplayer Experiment

Run headless server in Cloud Run via WebSocket.

Measure:

- CPU/session
- RAM/session
- players/process
- KiB/player-second
- latency
- reconnect behavior
- snapshot rate
- correction rate

Acceptance criteria:

- two or more real clients share one authoritative encounter
- reconnect works
- cost telemetry is collected

## Step 16 — Dedicated Server Decision Gate

Move toward Kubernetes only when measurements show a reason.

Examples:

- stable dedicated session routing is needed
- UDP becomes desirable
- Cloud Run timeout/reconnect behavior is undesirable
- session lifecycle needs stronger allocation semantics
- multiplayer concurrency justifies fleet orchestration
- per-session control is needed

## Step 17 — GKE + Agones

Deploy:

- GKE cluster
- Agones controller
- GameServer spec
- Fleet
- allocator
- health checks
- autoscaling

Acceptance criteria:

- matchmaker allocates a game server
- server becomes Ready
- players receive endpoint
- session transitions to Allocated
- server shuts down/recycles safely
- fleet replenishes automatically

---

# 24. First Playable Vertical Slice

Recommended first slice:

```text
Player enters one combat arena
        |
Kills a group of enemies
        |
One equipment item drops
        |
Player equips or salvages/crafts it
        |
Build becomes observably stronger
        |
Player fights a stronger enemy
        |
Progress saves to cloud
```

Required systems:

- movement
- one attack
- one enemy
- health/damage
- death
- one loot table
- inventory
- one equipment slot
- one crafting transformation
- visual feedback
- Firestore save
- Firebase Authentication
- deployed web build

---

# 25. Do Not Build Yet

Delay:

- full MMO world
- dozens of classes
- giant skill tree
- auction house
- guilds
- PvP
- Kubernetes before multiplayer measurements
- advanced matchmaking
- hundreds of crafting modifiers
- procedural world generation unless required by the first loop
- microservice fragmentation
- complex economy
- custom engine work Babylon already solves

First prove:

```text
Babylon presentation
+
headless simulation
+
cloud persistence
+
cloud deployment
```

---

# 26. Architecture Invariants

1. **Babylon is presentation/runtime, not persistent authority.**
2. **Gameplay rules live in a headless shared simulation package.**
3. **Single-player and multiplayer use the same rules package.**
4. **Persistence is not the realtime combat transport.**
5. **The client is not trusted with durable multiplayer rewards.**
6. **Game content should be data-driven where practical.**
7. **Large assets should be cacheable and versioned.**
8. **GitHub is the source of truth.**
9. **Build and deployment should be reproducible in cloud CI.**
10. **Infrastructure complexity is added only when measurements justify it.**
11. **Track bytes/player-second and player-hours from the first multiplayer test.**
12. **Measure cost per active player, not just total cloud bill.**

---

# 27. Immediate Implementation Order

```text
1. Monorepo/workspaces
2. Babylon client bootstrap
3. Shared headless simulation
4. Command/event protocol
5. Fight -> kill -> loot
6. Inventory/equipment
7. Crafting
8. Firebase Authentication
9. Firestore save/load
10. Firebase Hosting
11. Cloud CI/CD
12. Cloud Run authenticated backend
13. Asset pipeline
14. CDN split when justified
15. Multiplayer command protocol
16. Cloud Run WebSocket prototype
17. Measure
18. GKE + Agones only after the decision gate
```

If Codex or another implementation agent is handed this document, it should begin at **Step 1** and preserve the architecture invariants above.

---

# 28. Source References

Official sources checked for this architecture:

- Babylon.js engine specifications  
  https://www.babylonjs.com/specifications/

- Firebase projects and Google Cloud billing relationship  
  https://firebase.google.com/docs/projects/billing/firebase-pricing-plans

- Firebase Hosting usage, quotas, and pricing  
  https://firebase.google.com/docs/hosting/usage-quotas-pricing

- Firestore pricing and free quota  
  https://firebase.google.com/docs/firestore/pricing

- Firestore Standard operation pricing  
  https://firebase.google.com/docs/firestore/standard-edition

- Firebase Realtime Database limits  
  https://firebase.google.com/docs/database/usage/limits

- Firebase product pricing  
  https://firebase.google.com/pricing

- Cloud Run WebSockets  
  https://docs.cloud.google.com/run/docs/triggering/websockets

- Cloud Run pricing  
  https://cloud.google.com/run/pricing

- Google Cloud network pricing  
  https://cloud.google.com/vpc/network-pricing

- Cloud CDN pricing  
  https://cloud.google.com/cdn/pricing

- Agones documentation  
  https://agones.dev/site/docs/

---

# 29. Handoff Summary

**Build Thy Will as one game with two possible authority modes.**

For single-player, the browser owns the simulation.

For multiplayer, a dedicated server owns the simulation.

Both use the same game-rules package.

Babylon.js renders the result.

Firebase stores durable player state.

Cloud Run handles scalable managed services and the first multiplayer experiments.

Large assets graduate to Storage + CDN when traffic warrants it.

If dedicated real-time multiplayer grows beyond the comfortable Cloud Run model, deploy the same authoritative game-server concept to GKE + Agones.

That path maximizes cloud offloading without prematurely paying the financial or engineering cost of MMO-scale infrastructure.
