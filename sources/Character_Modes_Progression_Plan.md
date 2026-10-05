# Thy Will — Steps 3.2–3.8

Approved progression: 3 → 3.2 → 3.4 → 3.6 → 3.8 → 4.
Step 4 remains on hold during this bridge. The existing simulation remains the
single gameplay rules package; these steps connect character identity and views.

| Step | Implementation | Acceptance |
| --- | --- | --- |
| 3.2 Character record | Versioned plain character profile: stable ID, future account association, appearance, training loadout, progression, baseline stats/health. Validated local storage adapter behind a repository interface. | Reload restores ID and choices. Corrupt or unavailable storage leaves a usable session and preserves the original data. Shared profile code runs headlessly. |
| 3.4 Shared presentation | One Babylon character renderer reads profile and simulation state, builds a recognizable placeholder knight, displays training equipment, animates movement and cosmetic run/swing demonstrations. | Inspection and arena use the same renderer and profile. Demonstrations produce no damage, rewards or progression. |
| 3.6 Modes | Inspection and arena share one profile and one simulation; explicit mode registry reserves a disabled story entry for later stage routing. Phone opens inspection; desktop opens arena. | Mode switches retain character choices and arena position. Inspection cannot move the gameplay entity. Story entry is visibly unavailable. |
| 3.8 Devices | Responsive Babylon GUI, touch orbit/pinch, arena touch movement/sprint/reset, existing keyboard/controller controls, adaptive rendering scale. | Same entrypoint works on phone and desktop. Touch release, cancellation, blur and mode changes clear movement. Portrait/landscape controls remain reachable. |

## Boundaries and later steps

- Firebase Authentication and cross-device profile association: Steps 7–8.
- Account UID is reserved but remains null for this local character.
- Training equipment choices are visual starter loadout previews; authoritative
  inventory, ownership and stat modifiers arrive in Step 5.
- Swing/run demonstrations are presentation only; attack commands, damage and
  combat effects driven by gameplay events arrive in Step 4.
- Story navigation is reserved; actual objectives, enemies and stage content
  require later gameplay work. No story progress is fabricated here.
- Local saves do not confer multiplayer rewards or authenticate a player.
- One web entrypoint imports device gestures. The hosted page is the same client,
  and main merges continue deploying it through the existing Pages workflow.

## Validation and delivery

Run lint, strict type/boundary checks, production build, headless profile and
simulation tests, desktop acceptance tests and new phone interaction tests.
Inspect portrait and desktop screenshots. Publish the bridge as one review PR
with all four substeps complete before proceeding to Step 4.
