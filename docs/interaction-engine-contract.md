# Interaction Engine Contract

DeskteriorOnline의 편집 핵심은 웹 네이티브 interaction engine이다. 사용자는 walk/top/desk precision 모드에서 표면을 바라보고, 후보를 고르고, ghost preview를 조정한 뒤, commit 순간에만 `SceneDocumentV2` patch를 만든다.

## Package Boundary

Layer order:

```txt
scene-schema
  -> engine-core
  -> placement-kernel
  -> interaction-engine
  -> apps/web adapters + renderer-three
```

`packages/interaction-engine`는 React, R3F, DOM, Zustand를 직접 알지 않는다. 앱은 keyboard, pointer lock, HUD, toast, renderer invalidation, store commit을 adapter로 연결한다.

## Canonical Data Rule

- `scene-schema`의 `SceneDocumentV2`와 placement record는 `mm` 정수 계약을 유지한다.
- renderer/Three.js는 meter float 파생값만 사용한다.
- interaction preview 중에는 canonical document와 persisted store를 수정하지 않는다.
- commit 순간에만 최소 document patch를 만든다.
- shared viewer와 community viewer는 commit된 document snapshot만 재생한다.

## State Machine

```txt
idle
-> aiming
-> candidate_preview
-> manipulating
-> blocked
-> committing
-> committed
-> cancelled
```

State meaning:

- `idle`: active interaction 없음.
- `aiming`: 사용자가 surface/object를 바라보는 중.
- `candidate_preview`: 배치 후보가 선택되고 ghost preview가 준비됨.
- `manipulating`: keyboard, mouse, numeric input, micro-view로 surface-local pose를 조정 중.
- `blocked`: 후보 또는 pose가 collision/clearance/compatibility/metadata gate를 통과하지 못함.
- `committing`: document patch 적용 직전. 이 상태에서만 patch intent가 발생한다.
- `committed`: scene document/store에 반영 완료.
- `cancelled`: preview 폐기.

Required invariant:

| State | Document patch count |
| --- | ---: |
| `aiming` | 0 |
| `candidate_preview` | 0 |
| `manipulating` | 0 |
| `blocked` | 0 |
| `committing` | 1 |
| `committed` | 0 additional |
| `cancelled` | 0 |

## Events

The engine accepts these event families:

- `AIM_AT_SURFACE`: crosshair/raycast target changed.
- `START_PLACEMENT`: object/support/candidate set begins preview.
- `NUDGE`: surface-local `u`, `v`, or `normal` offset change.
- `ROTATE`: surface-local yaw/roll change in milli-degrees.
- `SWITCH_CANDIDATE`: cycle ranked candidates without losing current pose.
- `SELECT_CANDIDATE`: move to a specific ranked candidate, used by UI refocus controls.
- `SET_NUMERIC_POSE`: inspector/micro-view absolute pose update.
- `APPLY_REPORTS`: placement-kernel constraint/collision result.
- `COMMIT`: emit the single commit command if not blocked.
- `COMMIT_SUCCEEDED` / `COMMIT_FAILED`: adapter completion result.
- `CANCEL`: discard preview.

## Blocked Reasons

Every failed or blocked interaction must expose one or more reason codes:

```txt
NO_SURFACE
INCOMPATIBLE_ATTACHMENT
OUT_OF_SURFACE_BOUNDS
COLLISION
INSUFFICIENT_CLEARANCE
UNREACHABLE_ARM_TARGET
INVALID_CABLE_ROUTE
SCALE_LOCKED
READ_ONLY
MISSING_METADATA
```

UI must display engine results. UI must not re-implement placement eligibility decisions.

## Candidate Ranking

Candidates are ranked, not silently hidden. Disabled candidates remain explainable so HUD/inspector can show why they cannot be committed.

Score model:

```txt
score =
  ray_hit_confidence
+ attachment_compatibility
+ surface_visibility
+ distance_priority
+ user_selected_support_bonus
+ preferred_surface_bonus
- collision_penalty
- clearance_penalty
- out_of_bounds_penalty
```

Enabled candidates sort before disabled candidates. Within each group, higher score wins.

`apps/web/src/lib/runtime/focus-placement-session.ts` must call the shared ranking helper when it creates focus placement entries. The session candidate payload must preserve:

- `ranking`
- `score`
- `rank`
- `blockedReasons`
- `visualAffordance`

HUD, inspector, and renderer affordances consume these fields. They may format the result, but they must not compute a separate candidate order or separate blocked reason taxonomy.

## Adapter Responsibilities

`apps/web` adapters own:

- DOM keyboard/pointer/touch event mapping.
- pointer lock and panel open/close policy.
- renderer invalidation.
- ghost preview mutation through engine-core/renderer-three.
- toast/HUD text rendering.
- store/document commit after `COMMIT_PLACEMENT_PATCH`.

Adapters must not mutate `SceneDocumentV2` during preview states.

## FocusPlacementController Adapter

`apps/web/src/components/canvas/interaction/FocusPlacementController.tsx` is the first adapter for this contract.

It may still own bridge side effects:

- creating `PlacementTransaction`
- applying transaction preview updates
- committing runtime placement to the scene store
- updating the HUD Zustand store
- showing toast errors

It must route interaction decisions through `FocusPlacementMachine`:

- start placement -> `START_PLACEMENT`
- Tab/F candidate changes -> `SWITCH_CANDIDATE` / `SELECT_CANDIDATE`
- arrow/PageUp/PageDown/Q/E/numeric input -> `NUDGE` / `ROTATE` / `SET_NUMERIC_POSE`
- transaction validation -> `APPLY_REPORTS`
- Enter/click commit -> `COMMIT`
- Escape/right cancel -> `CANCEL`

## Phase 0 Acceptance

- `@deskterioronline/interaction-engine` exports state/event/result/blocked reason types.
- `FocusPlacementMachine` can be tested without React.
- candidate ranking and blocked reason mapping are deterministic.
- verification proves preview states emit zero document patches and commit emits exactly one patch intent.

## Phase 1 Acceptance

- `FocusPlacementController` uses the interaction machine for start/switch/nudge/rotate/numeric/commit/cancel transitions.
- Existing `verify:focus-placement` and `verify:placement-kernel` remain green.
- Runtime transaction side effects stay in the adapter until renderer-side preview mutation is connected.

## Phase 2 Acceptance

- Focus placement entry creation uses interaction-engine candidate ranking.
- HUD shows ranked candidate state with score, active rank, and blocked reason detail.
- Candidate selection from keyboard and HUD controls uses `SELECT_CANDIDATE`, not UI-local state.
- `verify:focus-placement` asserts candidate score, rank, blocked reason, and visual affordance metadata.

## Phase 3 Acceptance

- Walk crosshair shows target hint, active focus placement validity, and pointer-lock status.
- Pointer lock release caused by panel focus is visible to the user instead of failing silently.
- Valid/warning/blocked placement feedback uses `resolveFocusPlacementFeedback`.
- `verify:walk-placement-ux` covers the pointer-lock HUD state contract.

## Phase 4 Acceptance

- Desk precision top policy uses `5mm / 1deg` default nudge/rotate and `1mm / 0.1deg` fine hotkeys.
- Transform controls and keyboard nudges are enabled only for desk precision, while room/top view remains layout/view oriented.
- Numeric inspector, surface micro-view, and saved surface-local placement must describe the same mm pose.
- `verify:desk-precision` covers the policy contract.

## Phase 5 Acceptance

- `wall_screw` and `grommet_hole` are first-class focus placement candidates when authored runtime metadata allows them.
- Mounted wall/grommet candidates validate point-in-surface, surface-local footprint, normal offset, attachment compatibility, and authored hole diameter where required.
- Same-surface footprint collision blocks wall-mounted overlap before commit.
- `verify:advanced-attachments` covers wall screw commit, wall overlap rejection, grommet-hole commit, and invalid grommet rejection.
