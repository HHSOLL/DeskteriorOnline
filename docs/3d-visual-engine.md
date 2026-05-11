# 3D Visual Engine (Quality Bar)

이 문서는 room-first deskterior 에디터/뷰어의 렌더 품질 기준을 정의합니다.

## 렌더링 기본 설정
`apps/web/src/components/editor/SceneViewport.tsx`
`apps/web/src/components/editor/CanvasHost.tsx`
- ToneMapping: `room mode` / `viewer-shared` / 기본 walk-viewer는 `ACESFilmicToneMapping`, `desk precision` / `builder-preview` / `viewer-showcase`는 `NeutralToneMapping`
- `toneMappingExposure`는 `resolveSceneRenderQuality`가 모드/디바이스별로 관리하고, `SceneViewport` prop override는 예외적인 수동 보정에만 사용한다.
- `physicallyCorrectLights = true`
- `outputColorSpace = SRGB`
- Shadow: `PCFSoftShadowMap`
- `CanvasHost`는 runtime engine bootstrap compatibility path를 소유하고, `SceneViewport`는 renderer compatibility layer 역할을 우선 유지한다.
- drag/hover/placement preview hot path는 React props보다 runtime transform buffer + invalidate 경로를 우선 사용한다.

## 조명/환경
`apps/web/src/components/canvas/core/SceneEnvironment.tsx`
- walk/builder-preview는 고정된 우선 HDRI(`kiara_interior_1k`)를 사용한다.
- top-view는 HDRI/ContactShadows를 올리지 않고 평면 편집 가독성과 초기 진입 성능을 우선한다.
- builder/editor lighting은 `direct`/`indirect` mood를 모두 지원하고, direct mode는 fixture emissive + beam/floor glow shader를 포함한다.
- indirect mode는 천장 가장자리 확산광 위주의 additive glow를 사용하고 광원 본체 노출을 최소화한다.
- direct mode는 scene `lighting.fixtures[]`를 source of truth로 사용하고, 사용자 조작 가능한 최대 6개 fixture + spotlight/fill + beam/floor glow 조합으로 제한해 자연스러운 falloff와 성능 균형을 함께 맞춘다.
- QA 조명 preset은 `neutral-studio`, `home-reference`, `soft-evening`으로 유지하고, 각 preset은 HDRI/exposure/white balance/contact shadow QA profile을 가져야 한다.
- 제품 조명이 실제 point/spot light를 만들 수 있는 경우는 catalog/runtime metadata가 조명 제품임을 명시할 때뿐이며, 장면당 dynamic emitter 예산은 `<= 6`이다.
- SSR/contact shadow/bloom은 editor walk와 viewer showcase의 non-constrained profile에서만 허용하고, shared viewer/top-view/builder preview에는 비용을 전파하지 않는다.

## 재질/텍스처
- `apps/web/src/components/canvas/features/ProceduralWall.tsx`
- `apps/web/src/components/canvas/features/ProceduralFloor.tsx`
- `apps/web/src/components/canvas/features/ProceduralCeiling.tsx`

기준:
- `MeshStandardMaterial` 기반 PBR
- 색상 텍스처는 SRGB, roughness/normal은 Linear
- top-view는 texture decode가 실패해도 preset color 기반 fallback material로 shell을 유지해야 하며, builder-preview와 비슷한 수준의 full shell legibility를 유지한다.
- builder style step의 wall/floor 선택 버튼은 단색 swatch가 아니라 active preset의 실제 texture thumbnail을 우선 보여줘야 한다.
- builder-preview/walk만 active finish texture set을 1종씩 로드한다. 선택되지 않은 texture set preload를 기본값으로 두지 않는다.
- GLB runtime loader는 `KTX2Loader`를 기본 연결하고, basis transcoder는 `/assets/transcoders/basis/` 또는 `NEXT_PUBLIC_KTX2_TRANSCODER_PATH`에서 읽는다.
- room shell floor/wall procedural texture set은 `NEXT_PUBLIC_ENABLE_KTX2_TEXTURES=1`일 때 `.ktx2`를 우선 읽고, 없으면 JPG/PNG 원본으로 fallback 한다.
- wall/floor preset은 각각 12개 이하의 고품질 PBR set으로 관리하고, baseColor/roughness/normal/bump, real-scale repeat, source resolution, KTX2 runtime target, preview thumbnail을 가진다.
- wall preset의 기본 노출은 clean commercial default(matte/warm white paint, beige/grey plaster 등)를 우선하고, damaged/industrial 계열은 special option으로 격리한다.
- floor preset의 기본 노출은 light/natural oak, warm laminate, beige tile, subtle terrazzo 같은 실사용 재질을 우선한다.
- AI 생성 wall/floor 1K texture는 `generic_ai_candidate`로 남기고, 상용 texture preset은 2K source + runtime KTX2 + constrained 1K fallback 기준을 통과해야 한다.
- 제품 material variant는 단순 tint가 아니라 slot-level material metadata(`wood/metal/plastic/fabric/...`, roughness/normal intensity, QA status)를 가진다.
- 알려진 Blender 슬롯(`DeskWood`, `DeskMetal`, `StandWood`, `StandPad`, `LampBody`, `LampAccent`, `LampBulb`)은 slot-aware finish를 우선 적용한다.

## 카메라/모드
`apps/web/src/components/canvas/core/CameraRig.tsx`
- Editor: 배치 정확도를 위한 top 중심 카메라 UX
- Preview/Viewer: 읽기 중심 탐색 카메라 UX
- 모드 전환은 편집 상태를 깨지 않아야 한다.

추가 기준:
- builder opening/style preview는 room center를 target으로 하는 orbit camera를 사용한다.
- preview orbit은 wheel zoom과 drag rotation을 기본 제스처로 제공하고 pan은 보조 동작으로 제한하거나 비활성화한다.
- editor top-view는 builder와 같은 perspective orbit camera를 사용하고, room mode는 room shell 전체를, desk precision mode는 선택한 desk/support asset을 우선 framing 한다.
- editor top-view의 room shell은 floor 위 footprint strip과 full-height wall mesh를 함께 사용해 shell 형태가 즉시 읽혀야 한다.
- desk precision mode는 선택 제품의 위치/회전 값을 `mm/deg` measurement overlay로 함께 노출해 미세 배치 확인을 보조한다.
- desk precision mode는 surface anchor 제품의 support asset / support surface / surface size / margin / top 높이를 surface lock 상태로 함께 노출한다.
- desk precision top-view는 5mm / 1deg 기본 snap의 transform gizmo와 keyboard nudge/rotate를 허용하고, inspector numeric input은 1mm 보정 경로로 유지한다.
- desk precision mode는 support surface 내부 상대 위치를 보여주는 surface-local micro-view를 inspector/overlay에 함께 노출한다.
- desk precision mode는 support surface 기준 `front(X/H)` / `side(Z/H)` helper view를 inspector/overlay에 함께 노출해 projected span과 vertical reach를 동시에 확인할 수 있어야 한다.
- desk precision mode는 support surface 위 제품 footprint, projected footprint, edge clearance, relative yaw를 함께 노출해 usable area 침범 여부를 즉시 판단할 수 있어야 한다.
- walk view 진입 시 기본 시선은 room center/entrance target을 향해야 한다.
- walk view 진입 시 entrance spawn은 room interior bounds 안쪽으로 clamp 하고, near clip과 wall backface 문제 때문에 검은 화면이 발생하지 않아야 한다.
- editor walk-view는 entrance보다 room center anchor를 우선 사용해 첫 진입 black frame 가능성을 낮춘다.
- room mode, desk precision mode, builder preview는 idle 상태에서 `frameloop="demand"`를 기본으로 사용하고, camera zoom/rotate, hover highlight, direct drag, gizmo transform에서만 `invalidate()`를 호출한다.
- editor top-view와 editor walk-view는 회전/진입 시 black-frame flicker가 발생하면 안 되므로, 안정성 우선 프로필에서는 post FX/SSR보다 shell legibility를 우선한다.
- deskterior 자산은 `lodProfile.maxDrawCalls/maxTriangleCount` 기준으로 complexity를 나누고, room mode는 더 이른 box proxy fallback, desk precision/walk는 더 늦은 fallback을 사용한다.
- read-only top/walk와 builder preview, 그리고 editor `desk precision` top-view에서는 반복된 `single_mesh` low/medium complexity deskterior 자산을 instanced cluster로 묶어 draw call을 줄이고, selected/direct-drag 경로는 개별 오브젝트를 유지한다.
- dense-scene repeated cluster는 membership key가 유지되는 동안 mesh/material를 재생성하지 않고 instance matrix sync만으로 반영해야 한다.

## 뷰어 규칙
- `apps/web/src/components/viewer/ReadOnlySceneViewport.tsx`
- `apps/web/src/components/viewer/ProductHotspotDrawer.tsx`

기준:
- orbit/zoom/camera 이동 허용
- 제품 클릭 및 제품 정보 확인 허용
- 배치/삭제/저장/발행 등 편집 affordance 금지

## 성능 가드레일
- 프레임 루프 내부에서 네트워크 요청 금지
- 고비용 post-effect는 기본 비활성
- 에디터 대비 뷰어 interaction tree 경량화 유지
- top-view/editor precision 모드는 physics simulation, SSAO, contact shadow를 기본 비활성으로 두고 낮은 DPR/그림자 예산을 사용한다.
- builder preview는 walk/viewer보다 가벼운 품질 프로필을 사용하고, walk/viewer만 shadow + post FX를 보수적으로 유지한다.
- builder preview와 `viewer-shared`는 fill directional light를 기본으로 올리지 않고, constrained profile에서는 directional shadow와 bloom을 먼저 제거한다.
- `viewer-shared`는 subtle vignette/noise까지만 허용하고, bloom은 `desk precision` 또는 richer walk/showcase preset에서만 선택적으로 사용한다.
- `editor walk`와 `viewer-showcase`는 non-constrained profile에서만 보수적 SSR을 사용할 수 있고, `viewer-shared`, top-view, builder preview는 SSR을 올리지 않는다.
- 가구 drag는 local preview 후 pointer-up 시점에 store commit을 우선 적용해 전역 scene 재직렬화를 매 pointer move마다 유발하지 않는다.
- loaded GLB 자산의 hover/select raycast는 `three-mesh-bvh` bounds tree를 우선 사용해 작은 desk asset 다수 배치 시 raycast 비용을 낮춘다.
- loaded GLB 자산의 large non-interleaved geometry는 BVH 생성 자체를 Web Worker queue로 오프로딩하고, small/interleaved geometry만 sync 경로를 유지한다.
- telemetry가 활성일 때 `SceneViewport`는 live performance budget HUD를 같이 띄워 FPS floor, draw call 초과, heap growth, interaction latency, BVH sync fallback을 즉시 드러내야 한다.
- live HUD 경고와 CLI regression verify는 같은 budget helper를 공유해 threshold drift를 허용하지 않는다.
- focused asset/support asset은 walk focus placement와 desk precision 편집 중 proxy fallback보다 full-detail LOD를 우선 유지해야 한다.
- KTX2 encoder(`toktx`)가 없는 환경에서도 runtime decode path와 public transcoder sync는 유지해야 한다.
- `verify:asset-instancing`는 read-only top/walk + builder preview + editor `desk precision` + editor `room mode` idle instancing eligibility와 cluster grouping 정책을 회귀 검증해야 한다.
- native gltfpack output을 사용할 때는 `-kn -km -ke` 보존 플래그 기준을 유지해 slot-aware finish와 named node/material 기반 런타임 가정이 깨지지 않게 해야 한다.

## 2026-04-20 변경 동기화 (Room Mode Direct-Drag Instancing Phase 1)
Added:
- editor `room mode` top-view에서도 반복된 `single_mesh` low/medium complexity 자산을 idle 상태에 한해 instanced cluster로 유지하는 기준을 추가했다.
- instanced cluster 위를 직접 눌렀을 때 선택 자산만 live update로 움직이고, pointer-up 이후에만 개별 오브젝트 경로로 빠지는 direct-drag handoff 기준을 추가했다.

Updated:
- instancing 적용 범위를 `read-only top/walk + builder preview + editor desk precision`에서 `read-only top/walk + builder preview + editor desk precision + editor room mode idle`까지 확장한다.

Removed/Deprecated:
- room mode direct-drag 때문에 editor room top은 instancing을 전혀 사용할 수 없다는 가정.

## 2026-05-11 변경 동기화 (Actual SKU Material Pass)
Added:
- FURSYS `ZDQ012J` prototype asset은 product URL reference pack, slot-level material hints, Blender-authored procedural PBR maps를 함께 보관한다.
- 실제 SKU prototype material pass는 `DeskWood_light_laminate`, `DeskMetal_warm_grey_panel`, `DeskMetal_graphite_frame`, `DeskMetal_silver_detail`, `DeskPlastic_light_sensor` 같은 named slot을 유지해야 한다.

Updated:
- 제품 재질 개선은 이미지 텍스처를 단순히 붙이는 것이 아니라 UV scale, visible laminate surface, roughness/normal intensity, runtime GLB size budget을 동시에 통과해야 한다.
- public product page 기반 texture는 최종 상용 texture가 아니라 prototype rebuild source로만 쓰며, runtime GLB는 curated asset budget 안에서 export해야 한다.

Removed/Deprecated:
- 나뭇결을 별도 protruding geometry strip으로 구현해 reference 사진과 다르게 보이거나 runtime 예산을 낭비하는 방식.

## Scene 데이터 소비 규칙
- `apps/web/src/lib/domain/scene-document.ts`를 scene 복원의 canonical 매핑 계층으로 사용
- scene 저장/복원은 `project_versions.customization.sceneDocument`를 우선 source로 사용
- 저장 경계에서는 placement를 `unit="mm"` 정수 스냅샷으로 보관하고, renderer/store는 meter float 파생값만 소비한다.
- 제품 물리 메타데이터(`dimensionsMm`, `finishColor`, `finishMaterial`, `detailNotes`, `scaleLocked`)를 누락 없이 전달한다.
- curated deskterior 자산은 `source/license/pivot/collisionProxy/textureSet/lodProfile` 계약을 product metadata와 함께 save/load/public payload roundtrip에서 유지한다.
- curated runtime asset publish는 `packages/asset-compiler`가 생성한 alpha `runtime-packages.json`, per-asset descriptor, `colliders/support-surfaces/attachment-points/material-variants/qa-report` sidecar를 기준으로 다음 compiler 단계로 승격한다.
- alpha runtime package descriptor는 embedded `runtimeAsset` 계약을 포함해야 하며, scene-schema `RuntimeAsset`과 publish artifact가 drift 없이 대응되어야 한다.
- `verify:scene-document`는 save payload -> sceneDocument -> parse/load roundtrip에서 placement/support metadata/product metadata가 유지되는지 점검한다.
- `verify:public-scene`는 shared_projects + pinned version + preview meta에서 shared viewer payload가 같은 placement/support/product metadata를 재현하는지 점검한다.
- `verify:showcase-scene`는 gallery/community 카드 projection이 shared viewer public payload와 같은 version/preview asset summary를 유지하는지 점검한다.

## 2026-04-23 변경 동기화 (Placement Kernel Alpha Surface Validation)
Added:
- surface-local placement preview는 commit 전 `allowedAttachments`, footprint bounds, restricted zone, same-surface overlap을 최소 검증 세트로 사용해야 한다.

Updated:
- 물리 배치 품질 기준을 “support surface 배치가 가능하다”에서 “support surface 위 invalid footprint/overlap을 commit 전에 차단한다” 수준으로 강화한다.

Removed/Deprecated:
- same-surface accessory overlap을 runtime placement kernel 밖의 후속 과제로만 미뤄둘 수 있다는 가정.

## 2026-04-23 변경 동기화 (Placement Kernel Alpha Completion)
Added:
- mounted placement preview는 `attachmentPoints[].compatibleWith`와 support surface thickness를 함께 검증하고, compatible surface hit가 있으면 그 후보를 우선 사용해야 한다.
- focus placement HUD는 raw key input이 아니라 kernel snap 결과를 표시해야 하며, preview와 HUD 수치가 drift 하면 안 된다.

Updated:
- placement visual quality 기준을 “desktop_top accessory validation”에서 “desktop_top + mounted edge placement validation”까지 확장한다.

Removed/Deprecated:
- mounted flow는 Phase 6 전까지 attachment metadata를 실제로 소비하지 않아도 된다는 가정.

## 2026-04-23 변경 동기화 (Focus Placement Prototype Visual Polish)
Added:
- focus placement HUD는 support surface local grid/minimap, preferred zone, no-place zone, snapped footprint를 함께 렌더링해야 한다.
- walk mode crosshair hint는 actionable/blocked/info tone을 사용해 진입 가능 여부를 즉시 구분해야 한다.

Updated:
- focus placement visual quality 기준을 “숫자 HUD + warning text”에서 “surface-local minimap + clearer compatibility/status affordance”까지 확장한다.

Removed/Deprecated:
- focus placement local context는 숫자 오프셋만으로 충분히 전달된다는 가정.

## 2026-04-23 변경 동기화 (Phase 6 Focus Placement Visual Complete)
Added:
- focus placement HUD는 multi-candidate session일 때 현재 후보 index를 읽을 수 있는 mode badge를 포함해야 한다.
- crosshair는 active session에 후보가 여러 개 있으면 `Tab` cycle / `F` refocus affordance를 우선 보여줘야 한다.
- mounted candidate(`edge_clamp`, `underside_screw`, `wall_attach`)도 top-surface flow와 같은 snapped HUD/minimap 경로를 사용해야 한다.

Updated:
- focus placement visual quality 기준을 `desktop_top` local context 표현에서 `multi-surface candidate state + mounted compatibility feedback`까지 확장한다.

Removed/Deprecated:
- mounted focus placement가 별도 HUD 언어를 가져도 된다는 가정.

## 2026-04-23 변경 동기화 (Phase 7 Advanced Attachment Visual Foundation)
Added:
- articulated support target(`monitor_arm` end-effector)도 runtime metadata 상에서는 일반 attachment target처럼 읽히도록 유지해야 한다.

Updated:
- mounted visual quality 기준의 기반 범위를 `edge_clamp`에서 `edge_clamp + vesa target compatibility + articulation reachability feedback`까지 확장한다.

Removed/Deprecated:
- articulated support target이 visual/runtime contract 밖의 별도 시스템이라고 보는 가정.

## 2026-04-23 변경 동기화 (Phase 7 Advanced Attachment Visual Wizard)
Added:
- `vesa_mount` focus placement HUD는 VESA panel/target pattern, wizard step badge, solved joint summary를 같은 overlay 안에서 노출해야 한다.
- active monitor-arm wizard 중 crosshair/hud shortcut language는 `PageUp/PageDown` reach control을 포함해야 한다.

Updated:
- mounted visual quality 기준을 `vesa target compatibility + articulation reachability feedback`에서 `target-pose wizard + solved joint feedback`까지 확장한다.

Removed/Deprecated:
- monitor-arm flow가 generic mounted HUD만으로도 충분하다는 가정.

## 2026-04-23 변경 동기화 (Phase 7 Advanced Attachment Visual Complete)
Added:
- mounted focus placement HUD는 authored thickness/clearance requirement 카드와 clearance readout을 함께 노출해야 한다.

Updated:
- mounted visual quality 기준을 `target-pose wizard + solved joint feedback`에서 `target-pose wizard + solved joint feedback + authored requirement/clearance exposure`까지 확장한다.

Removed/Deprecated:
- mounted constraint 숫자는 inspector나 runtime 로그에서만 확인해도 충분하다는 가정.

## 2026-04-23 변경 동기화 (Phase 8 Live Performance HUD)
Added:
- `SceneViewport` overlay에 `ScenePerformanceBudgetHud`를 추가해 telemetry 활성 중 FPS / draw call / triangle 상태와 budget issue를 즉시 읽을 수 있게 했다.
- BVH large-geometry sync fallback도 live HUD 경고로 노출해 worker offload 회귀를 장면 안에서 바로 볼 수 있게 했다.

Updated:
- 성능 가드레일을 “이벤트/CLI로 나중에 확인”에서 “장면 안 live HUD + CLI verify” 구조로 확장한다.

Removed/Deprecated:
- live 성능 budget drift를 콘솔 로그만으로 추적해도 충분하다는 가정.

## 2026-04-23 변경 동기화 (Phase 8 Dense-Scene Instancing Hardening Slice 2)
Added:
- `InstancedFurnitureCluster`는 cluster membership key가 같을 때 `InstancedMesh`를 재생성하지 않고 `useLayoutEffect` matrix sync로 최신 transform을 반영한다.

Updated:
- dense-scene instancing visual/runtime 기준을 “cluster로 묶는다”에서 “cluster로 묶고 transform-only update는 rebuild 없이 반영한다”로 확장한다.

Removed/Deprecated:
- repeated asset의 transform commit이 자주 일어나도 cluster mesh를 매번 다시 만들어도 된다는 가정.

## 2026-04-23 변경 동기화 (Phase 8 Memory Leak Detection Slice 3)
Added:
- `ScenePerformanceTelemetry`는 지원 브라우저에서 heap sample을 같이 기록하고, live HUD는 heap usage와 heap growth를 같은 renderer snapshot 기준으로 노출한다.

Updated:
- live performance HUD 기준을 `FPS / draw call / triangle + issue feed`에서 `FPS / draw call / triangle / heap + issue feed`로 확장한다.

Removed/Deprecated:
- live HUD가 heap drift를 전혀 다루지 않는 상태 설명.

## 2026-04-23 변경 동기화 (Phase 8 Streaming/LOD + Benchmark CI Tighten Slice 4)
Added:
- focused asset/support asset은 `streamingPriority="focus"`로 승격해 walk focus placement와 desk precision 편집 중 full-detail LOD를 유지한다.
- `benchmark-scenes/baseline.template.json`는 telemetry heap 필드까지 포함한 shape로 고정하고, `verify:benchmark-baseline`로 drift를 막는다.

Updated:
- LOD 운영 기준을 “mode별 거리 차등”에서 “mode별 거리 차등 + focused interaction asset full-detail lock”까지 확장한다.

Removed/Deprecated:
- focus placement 중에도 selected/support asset이 기본 proxy distance만 따르는 상태 설명.

## 물리 정합성 기준
- Blender 소스(`assets/blender/deskterior`)의 실측 envelope 기준으로 카탈로그 규격을 관리한다.
- 실측 고정 제품(`scaleLocked=true`)은 변환 컨트롤/인스펙터 입력에서 스케일 변경을 저장하지 않는다.
- 뷰어 제품 정보 drawer는 규격(W/D/H mm), 마감 색상/재질, 디테일 노트를 표시한다.
- support surface 배치는 `dimensionsMm`가 있을 때 해당 실측값을 우선 사용해 surface size/top을 계산한다.
- floor/surface 배치는 active asset footprint를 반영해 wall clearance + inter-asset separation을 수행한다.
- focus placement 기본 snap은 `5mm / 1deg`, fine override는 `1mm / 0.1deg`이며, UI/HUD/저장 좌표는 모두 placement kernel의 snapped local pose를 source of truth로 사용한다.
- focus/walk/desk precision preview lifecycle은 `interaction-engine` event/result/command를 기준으로 한다. `aiming`, `candidate_preview`, `manipulating`, `blocked` 동안에는 renderer ghost preview만 갱신하고, canonical document patch는 만들지 않는다.
- blocked preview도 ghost affordance는 보여줄 수 있지만 commit은 막아야 하며, HUD/overlay는 interaction engine의 blocked reason을 표시해야 한다.
- 제품 외형 치수 오차는 `<= 1%` 또는 `<= 5mm`, desk/대형 가구 support surface 오차는 `<= 3mm`, 소품 footprint 오차는 `<= 2mm`를 paid-beta 기준으로 본다.
- 공개 제품 사진 기반 실제 SKU rebuild는 draft/prototype tier로만 두고, manufacturer CAD 또는 사용 허가가 확보되기 전에는 `releaseEligible=false`와 `materialQaStatus=pending`을 유지한다.

## 2026-05-02 변경 동기화 (Interaction Preview Contract)
Added:
- `interaction-engine` 기반 preview/commit 분리 규칙을 시각 품질 기준에 추가한다.
- surface candidate visual affordance는 `surface-ring`, `edge-band`, `mount-target`, `ghost-only` 같은 엔진 결과를 renderer/HUD가 표시하는 구조로 둔다. focus placement session candidate는 `score`, `rank`, `blockedReasons`, `visualAffordance`를 보존해야 한다.

Updated:
- focus placement visual polish 기준은 React component 내부 임시 상태가 아니라 interaction engine state machine의 `candidate_preview`, `manipulating`, `blocked` 상태를 따른다.

Removed/Deprecated:
- preview 중 store/document를 직접 갱신해 ghost 위치를 맞추는 방식.

## 2026-04-14 변경 동기화 (Deskterior Visual Baseline)
Added:
- deskterior 편집/공유 뷰어 중심 카메라 규칙.
- `sceneDocument` 우선 복원 정책을 품질 기준으로 고정.

Updated:
- floorplan 기반 3D 생성 컨텍스트 없이도 일관되게 작동하는 렌더 기준으로 재정렬.

Removed/Deprecated:
- floorplan 인식 결과를 전제로 한 시각 품질 설명.

## 2026-04-14 변경 동기화 (Physical Fidelity Quality Gate)
Added:
- 실측 규격/마감 메타데이터 전달을 visual quality bar의 필수 항목으로 추가.
- 실측 고정 제품 스케일 보호를 렌더/인터랙션 품질 기준에 추가.

Updated:
- 제품 정보 표시 기준을 옵션 문자열 중심에서 구조화된 규격/마감 중심으로 전환.

Removed/Deprecated:
- 규격 정확도 검증 없이 시각 유사성만으로 승인하던 기준.

## 2026-05-01 변경 동기화 (Commercial Visual Fidelity Gate)
Added:
- `RuntimeAsset.commercialReadiness`와 `AssetQaReport.commercialFidelity`를 visual engine의 asset 승격 기준으로 사용한다.
- room shell texture preset은 source resolution, quality tier, source kind, KTX2 requirement, 1K fallback limit을 metadata로 가진다.
- lighting preset은 QA profile을 포함해 reference lighting 비교 기준을 고정한다.

Updated:
- 시각 품질 기준을 PBR 표시 품질에서 SKU reference fidelity, mm tolerance, slot material QA, texture source quality까지 확장한다.

Removed/Deprecated:
- generic/AI candidate texture와 paid-beta texture를 같은 품질 tier로 취급하는 가정.

## 2026-04-14 변경 동기화 (Physical Fidelity Stage-2)
Added:
- `dimensionsMm` 기반 support profile 추론/배치 클램프를 렌더 상호작용 품질 기준에 포함.

Updated:
- `finishColor`/`finishMaterial`를 GLB 머티리얼 tint 및 roughness/metalness 보정에 반영하는 런타임 기준 추가.

Removed/Deprecated:
- 마감 정보가 정보 패널 텍스트로만 소비되던 기준.

## 2026-04-14 변경 동기화 (Physical Fidelity Stage-3)
Added:
- 물리 배치 품질 기준에 wall clearance + 자산 간 분리(relaxation) 루프를 추가.
- Blender 알려진 슬롯 기반의 slot-aware finish 반영 기준을 추가.

Updated:
- 신규 자산 추가 시점부터 실측 메타를 사용해 배치 클램프와 충돌 완화를 수행하도록 상호작용 기준을 강화.

Removed/Deprecated:
- 전체 자산에 단일 finish 보정만 적용하던 런타임 가정.

## 2026-04-14 변경 동기화 (Physical Fidelity Stage-4)
Added:
- HDRI 우선 선택 정책(kiara_interior -> hotel_room -> photo_studio_loft_hall -> photo_studio_01 -> small_empty_room_1).
- 홈 레퍼런스 기준의 조명 리밸런싱(웜 키라이트 + 쿨 필라이트 + 강화된 contact shadow) 품질 기준.

## 2026-04-17 변경 동기화 (Builder Shell Alignment Fix)
Added:
- builder preview/runtime shell에서 wall/door/window/collider plane은 primary floor outline 기준 exterior 방향 반 두께 오프셋을 공유해야 한다.

Updated:
- procedural wall mesh는 wall local space와 opening hole local space를 동일 좌표계로 유지하고, 코너는 반 두께 겹침으로 닫히도록 렌더링 규칙을 강화.
- builder orbit preview 기본 카메라는 room shell 전체 footprint를 우선 보여주는 framing을 사용하도록 조정.

Removed/Deprecated:
- wall mesh를 floor outline 중심선에 그대로 배치하던 preview 렌더 가정.

## 2026-04-17 변경 동기화 (Top-View Legibility + Surface Stability)
Added:
- 상단뷰 room shell legibility를 위해 wall footprint strip 렌더 규칙을 추가.
- walk view initial look target을 room center 기반으로 정렬하는 카메라 품질 기준을 추가.

Updated:
- floor texture는 저각도 시점 shimmer를 줄이기 위해 보수적 repeat와 높은 anisotropy를 사용한다.
- walk view contact shadow / directional shadow bias를 보수적으로 조정해 floor acne와 coplanar shimmer를 줄인다.
- top-view camera 조작은 빈 공간 drag가 아니라 우측 rail의 단계형 회전 버튼으로만 수행한다.

Removed/Deprecated:
- top-view에서 full-height wall mesh만으로 shell legibility를 확보한다는 가정.

## 2026-04-21 변경 동기화 (Opening Orientation + Orbit Editor Top)
Added:
- builder/editor/shared scene는 opening GLB를 local Z-up source에서 runtime Y-up wall-plane 기준으로 정규화해 door/window가 실제 opening asset처럼 서 보이게 한다.
- style 선택 전 builder opening preview는 white wall / white floor neutral shell을 사용한다.

Updated:
- editor top-view 탐색 규칙을 `orthographic + rotate button`에서 `perspective orbit + wheel zoom`으로 갱신한다.
- top-view에서도 opening asset을 숨기지 않고 shell의 일부로 렌더한다.
- procedural wall material은 walk interior readability를 위해 double-sided 렌더를 기본으로 사용한다.

Removed/Deprecated:
- opening asset이 floor plane에 눕는 source transform을 runtime에서 그대로 통과시키는 가정.
- top-view가 flat shell 표현만 사용하고 실제 opening asset을 숨기는 기준.
- 포스트FX 기준(SSAO + 보수적 bloom + 완화된 vignette + 저강도 noise) 추가.

## 2026-04-21 변경 동기화 (Builder Texture Thumbnails + Stable Editor Orbit)
Added:
- builder style step은 실제 wall/floor texture thumbnail을 선택 버튼 미리보기로 사용한다.
- walk view 기본 시선은 room center anchor가 target과 겹칠 때 전방 오프셋 target을 사용해 첫 프레임 black view 가능성을 낮춘다.

Updated:
- editor top-view는 room/desk precision 모두 `frameloop="demand"`를 기본으로 사용하고 orbit/hover/drag/preview/commit 이벤트에서 `invalidate()`를 호출한다. editor walk-view는 1인칭 이동과 pointer-lock 안정성을 위해 post FX/SSR을 비활성화한 `frameloop="always"` 프로필을 유지한다.
- editor top orbit과 builder preview orbit은 벽 내부로 파고드는 저각도 회전을 막기 위해 polar angle 범위를 더 보수적으로 제한한다.

Removed/Deprecated:
- editor top/walk에서 post FX를 유지한 채 흑화 회귀를 허용하는 가정.

Updated:
- 에디터/뷰어 기본 노출 값을 상향해 홈 레퍼런스의 밝기/재질 가독성에 맞춤.

Removed/Deprecated:
- 깊이감 보정(occlusion) 없이 bloom/vignette만으로 룩을 구성하던 기준.

## 2026-04-18 변경 동기화 (Mode-Aware Render Budget)
Added:
- top-view/editor precision 모드의 경량 렌더 예산(no physics, no SSAO, no contact shadows, capped DPR) 기준을 추가.
- builder preview와 walk/viewer 사이의 mode-aware shadow/contact shadow/post FX 품질 계단을 추가.
- top-view 진입 시 HDRI, interactive lights, runtime door/window asset, full PBR wall/floor texture를 지연 로드하는 기준을 추가.

Updated:
- shared viewport 품질 기준을 단일 최고품질 고정에서 mode/device-aware 예산 기반으로 갱신.
- 가구 drag 상호작용 기준을 live global store write에서 local preview 후 commit 우선으로 조정.

Removed/Deprecated:
- editor/viewer/builder가 동일한 post FX, shadow, physics 비용을 항상 부담해야 한다는 가정.

## 2026-04-19 변경 동기화 (Top-View Interaction Policy Split)
Added:
- room mode는 제품 본체 direct drag + 250mm snap을, desk precision mode는 transform gizmo + 25mm / 15도 snap을 기본 편집 규칙으로 추가한다.
- desk precision mode는 local transform space를 기본값으로 사용하고, room mode는 world space coarse layout을 기본값으로 사용한다.

Updated:
- 상단뷰 카메라 회전 버튼은 단일 90도 고정에서 모드별 회전 단계(room 90도, desk precision 15도)로 갱신한다.
- 상단뷰 zoom 기본값은 room shell framing 우선에서 `room layout`과 `desk surface inspection` 목적에 맞게 모드별로 재설정한다.

Removed/Deprecated:
- 상단뷰 편집에서 direct drag와 transform gizmo를 같은 picking 정책으로 항상 동시에 활성화하는 가정.

## 2026-04-19 변경 동기화 (Mode-Aware Top Render Ladder)
Added:
- desk precision mode에서만 capped dynamic light와 저비용 post FX(bloom/vignette/noise) 사용 기준을 추가한다.

Updated:
- top-view 품질 기준을 단일 경량 preset에서 `room mode=lean top entry`, `desk precision mode=inspection-oriented top entry`로 분리한다.
- room mode DPR 상한은 더 보수적으로 유지하고, desk precision mode는 근접 배치 확인을 위해 더 높은 DPR 상한을 허용하도록 갱신한다.

Removed/Deprecated:
- room mode와 desk precision mode가 같은 DPR/post FX/light budget을 공유한다는 가정.

## 2026-04-19 변경 동기화 (Viewer Preset Split)
Added:
- read-only shared viewer 전용 `viewer-shared` 품질 슬롯과, 추후 desk showcase용 `viewer-showcase` 품질 슬롯을 구분하는 기준을 추가한다.

Updated:
- shared viewer는 hotspot drawer 중심 읽기 전용 경험에 맞춰 더 낮은 DPR/보수적 shadow-contact shadow/post FX 예산을 사용하도록 갱신한다.
- generic showcase viewer는 shared viewer보다 풍부한 조명/후처리 여지를 갖는 preset으로 정의한다.

Removed/Deprecated:
- 모든 viewer 경로가 동일한 walk/top 품질 preset을 공유한다는 가정.

## 2026-04-19 변경 동기화 (Shared Viewer Runtime Lightweight Pass)
Added:
- shared viewer는 기본 선택 상태 없이 시작하고, hotspot/list 선택 시에만 상세 패널이 활성화되는 기준을 추가한다.

Updated:
- shared viewer HUD를 crosshair 제거 + walk touch HUD 유지 구조로 단순화한다.

Removed/Deprecated:
- shared viewer가 editor와 같은 crosshair 시각 피드백을 기본으로 유지한다는 가정.

## 2026-04-19 변경 동기화 (Render Cost Reallocation)
Added:
- builder preview와 `viewer-shared`는 secondary fill light 없이 기본 light rig를 구성하고, constrained profile에서는 directional shadow와 bloom을 먼저 제거하는 기준을 추가한다.

Updated:
- post FX 기준을 단순 on/off에서 `shared viewer=subtle vignette/noise`, `desk precision=selective bloom`, `walk/showcase=full bloom/vignette/noise + optional SSAO`로 세분화한다.

Removed/Deprecated:
- shared viewer와 builder preview가 full walk/showcase와 같은 fill-light/bloom/shadow pass를 기본으로 유지한다는 가정.

## 2026-04-19 변경 동기화 (Desk Precision Measurements)
Added:
- desk precision mode에서 선택 자산의 위치/회전을 `mm/deg` overlay로 표시하는 품질 기준을 추가한다.

Updated:
- 정밀 편집 inspector 입력 기준을 meter/radian이 아니라 `mm/deg` 사용자 단위 기준으로 갱신한다.

Removed/Deprecated:
- 정밀 편집 inspector가 내부 renderer 단위를 그대로 보여주는 가정.

## 2026-04-19 변경 동기화 (Desk Precision Surface Lock)
Added:
- desk precision mode에서 surface anchor 제품의 support surface lock 상태를 inspector/overlay에서 확인하는 상호작용 품질 기준을 추가한다.

Updated:
- 정밀 배치 확인 범위를 위치/회전 수치 외에 support surface size / margin / top 높이까지 확장한다.

Removed/Deprecated:
- support surface lock 상태를 사용자가 눈대중으로만 확인해도 충분하다는 가정.

## 2026-04-19 변경 동기화 (Desk Precision Micro View)
Added:
- desk precision mode에서 support surface 내부 상대 위치를 확인하는 micro-view 시각화 기준을 추가한다.

Updated:
- 정밀 배치 확인 범위를 위치/회전 수치와 surface lock 정보 외에 surface-local position 시각화까지 확장한다.

Removed/Deprecated:
- support-local 위치를 숫자만으로 확인해도 충분하다는 가정.

## 2026-04-19 변경 동기화 (KTX2 Runtime Ready + Demand Frame Loop)
Added:
- `KTX2Loader` + local basis transcoder sync 기준을 runtime texture decode 품질 항목에 추가했다.
- room/desk top-view와 builder preview의 demand frameloop + explicit invalidation 규칙을 렌더 품질 기준에 추가했다.

Updated:
- 렌더 기본 비용 절감 기준을 DPR/post FX/light budget뿐 아니라 frame loop 정책까지 포함하도록 갱신했다.

Removed/Deprecated:
- top-view와 builder preview가 입력 유무와 관계없이 계속 frame을 그린다는 가정.

## 2026-04-19 변경 동기화 (BVH Raycast Baseline)
Added:
- `useGLBAsset` 로드 경로에서 loaded scene geometry에 bounds tree를 생성하고, `THREE.Mesh.raycast`를 accelerated raycast로 교체하는 기준을 추가했다.

Updated:
- 정밀 편집 picking 성능 기준을 "telemetry로 지연 측정"뿐 아니라 "BVH-backed raycast 기본 사용"까지 포함하도록 확장한다.

Removed/Deprecated:
- desk precision picking이 raw triangle raycast 위에서만 동작한다는 가정.

## 2026-04-20 변경 동기화 (BVH Worker Offload)
Added:
- large non-interleaved GLB geometry에 대해 bounds tree 생성을 Web Worker queue로 오프로딩하는 렌더 상호작용 기준을 추가했다.

Updated:
- `useGLBAsset` 품질 기준을 `BVH raycast 사용`에서 `BVH raycast + BVH generation offload`까지 확장한다.

Removed/Deprecated:
- dense geometry BVH 생성이 항상 main thread sync compute에만 의존한다는 가정.

## 2026-04-19 변경 동기화 (SceneDocument Roundtrip Verify)
Added:
- sceneDocument roundtrip verify 스크립트가 placement/support/product metadata 재현성을 점검하는 품질 기준을 추가한다.

Updated:
- 저장/복원 품질 기준을 렌더 결과 확인뿐 아니라 sceneDocument parse/load 재현성 검증까지 포함하도록 확장한다.

Removed/Deprecated:
- sceneDocument roundtrip 회귀를 수동 뷰어 확인만으로 감지하던 기준.

## 2026-04-19 변경 동기화 (Public Scene Payload Verify)
Added:
- public scene payload verify 스크립트가 shared viewer payload의 placement/support/product metadata 재현성을 점검하는 품질 기준을 추가한다.

Updated:
- 공유 경로 품질 기준을 shared viewer 렌더 결과 확인뿐 아니라 public payload 구성 검증까지 포함하도록 확장한다.

Removed/Deprecated:
- shared viewer payload 회귀를 수동 링크 열기만으로 감지하던 기준.

## 2026-04-19 변경 동기화 (Showcase Scene Consistency Verify)
Added:
- showcase snapshot/card projection이 shared viewer public payload와 같은 version/preview asset summary를 유지하는지 점검하는 품질 기준을 추가한다.

Updated:
- Scene 데이터 소비 규칙을 `sceneDocument -> public payload -> showcase card projection` 검증 체인까지 포함하도록 확장한다.

Removed/Deprecated:
- gallery/community 카드가 shared viewer와 다른 preview version/asset summary를 참조해도 된다는 가정.

## 2026-04-19 변경 동기화 (Desk Precision Extended Measurement)
Added:
- support surface 위 제품 footprint / projected footprint / edge clearance / relative yaw를 노출하는 측정 기준을 추가한다.

Updated:
- surface-local micro-view를 point marker 중심에서 `footprint + clearance` 확인 가능한 정밀 시각화로 확장한다.

Removed/Deprecated:
- support surface 위 제품이 usable area 안에 있는지 offset 숫자만으로 판단하던 기준.

## 2026-04-20 변경 동기화 (Desk Precision Helper View)
Added:
- support surface 기준 front/side orthographic helper view와 `asset height / bottom gap / top reach` 측정 기준을 추가한다.

Updated:
- 정밀 배치 확인 범위를 top-down micro-view 단일 시점에서 `top-down + side/front section` 조합으로 확장한다.

Removed/Deprecated:
- support surface 위 제품의 수직 관계를 top height 숫자 하나로만 확인하던 기준.

## 2026-04-20 변경 동기화 (Room Shell KTX2 Wiring)
Added:
- room shell floor/wall texture set의 `.ktx2` 우선 로드와 JPG/PNG fallback 품질 기준을 추가했다.
- `textures:encode:room-shell:ktx2` / `textures:check:room-shell:ktx2`로 room shell KTX2 산출물 유무를 검증하는 운영 기준을 추가했다.

Updated:
- KTX2 준비 상태를 transcoder sync만이 아니라 room shell runtime wiring, encode/check 파이프라인, committed room shell `.ktx2` 산출물까지 포함하는 상태로 확장했다.

Removed/Deprecated:
- room shell texture KTX2 적용을 수동 파일 교체에만 의존하던 가정.

## 2026-04-20 변경 동기화 (Deskterior Metadata Contract Reinforcement)
Added:
- curated deskterior manifest에 `source/license/pivot/collisionProxy/textureSet/lodProfile` 계약을 추가했다.
- `verify:scene-document`, `verify:public-scene`가 위 계약을 포함한 product metadata roundtrip을 점검하는 기준을 추가했다.

Updated:
- scene data product metadata 기준을 실측/마감 중심에서 `실측/마감 + asset contract metadata`까지 확장했다.

Removed/Deprecated:
- save/load/public payload에서 source/license/pivot/collision/texture/lod 메타가 누락돼도 무방하다는 가정.

## 2026-04-20 변경 동기화 (LOD Policy Operationalization)
Added:
- `lodProfile`를 room mode / desk precision / walk / builder preview 런타임 LOD 거리 정책으로 실제 소비하는 기준을 추가했다.
- `verify:asset-lod` 스크립트로 complexity별 proxy fallback 거리와 manual-lod bonus를 검증하는 품질 기준을 추가했다.

Updated:
- deskterior 런타임 LOD를 “모든 자산 공통 high + box proxy”에서 `lodProfile + 모드별 거리 정책` 기반으로 구체화했다.

Removed/Deprecated:
- `lodProfile`가 문서용 메타 필드에만 머물고 런타임은 고정 거리만 사용한다는 가정.

## 2026-04-20 변경 동기화 (Scene Instancing Phase 1)
Added:
- read-only top/walk와 builder preview에서 반복된 `single_mesh` low/medium complexity 자산을 instanced cluster로 렌더링하는 품질 기준을 추가했다.
- `verify:asset-instancing` 스크립트로 editable top mode 제외, selected 제외, dynamic light 제외, manual LOD 제외 정책을 검증하는 기준을 추가했다.

Updated:
- `instancing/LOD 운영화` 상태를 `LOD policy만 적용`에서 `LOD policy + non-editable repeated asset instancing`까지 확장했다.

Removed/Deprecated:
- read-only/builder 장면에서도 반복 자산을 항상 개별 mesh clone으로만 유지해야 한다는 가정.

## 2026-04-20 변경 동기화 (Editor Desk Precision Instancing)
Added:
- editor `desk precision` top-view에서 반복된 `single_mesh` low/medium complexity 자산을 instanced cluster로 유지하는 기준을 추가했다.

Updated:
- instancing 적용 범위를 `read-only top/walk + builder preview`에서 `read-only top/walk + builder preview + editor desk precision`까지 확장한다.
- selected 자산과 `room mode` direct-drag 경로는 계속 개별 오브젝트를 유지하도록 품질 기준을 구체화한다.

Removed/Deprecated:
- editor top-view 전체가 instancing에서 무조건 제외되어야 한다는 가정.

## 2026-04-20 변경 동기화 (Native gltfpack Optional Chain)
Added:
- native gltfpack pass의 보수 플래그 기준(`-cc -mi -kn -km -ke`)을 asset optimization 품질 규칙에 추가했다.

Updated:
- 고급 자산 최적화 체인을 `glTF Transform only`에서 `glTF Transform baseline + optional native gltfpack pass` 구조로 확장했다.

Removed/Deprecated:
- native gltfpack 적용 시 named node/material/extras 보존을 별도 기준 없이 운에 맡기던 상태.

## 2026-04-20 변경 동기화 (PBR Neutral Tone Mapping Phase 1)
Added:
- `SceneViewport` renderer 설정이 mode-aware tone mapping / exposure 값을 반영하도록 갱신했다.
- `desk precision`, `builder preview`, `viewer-showcase`는 Neutral tone mapping, `room mode`, `viewer-shared`, 기본 walk viewer는 ACES tone mapping을 사용하도록 기준을 추가했다.

Updated:
- 렌더링 기본 설정을 단일 ACES 고정 설명에서 `mode-aware ACES/Neutral split + exposure ladder` 기준으로 갱신한다.

Removed/Deprecated:
- `SceneViewport`의 고정 exposure 기본값이 모드별 tone mapping/exposure ladder를 덮어쓰던 상태.

## 2026-04-20 변경 동기화 (SSR Feasibility Phase 1)
Added:
- `editor walk`와 `viewer-showcase` 슬롯에만 보수적 SSR(intensity/maxRoughness/thickness 제한, temporal resolve on)을 연결하는 기준을 추가했다.

Updated:
- 실사 강화 2차 범위를 “tone mapping split only”에서 `tone mapping split + selective SSR feasibility`까지 확장한다.

Removed/Deprecated:
- SSR feasibility가 문서 계획에만 있고 실제 render ladder에는 전혀 연결되지 않은 상태.

## 2026-04-18 변경 동기화 (Opening Asset + Top-Entry Optimization)
Added:
- builder/editor opening render에 Blender 기반 경량 GLB(`single/double/french door`, `single/wide window`) 자산 사용 기준을 추가.
- door/window/wall/collider가 같은 `wall render placement` 좌표계를 공유하고, 벽 끝은 반 두께 연장으로 코너를 닫는 규칙을 추가.

Updated:
- opening wall 변경은 단순 `wallId` 교체가 아니라 새 벽 길이에 맞춘 center-ratio 재매핑으로 보정하도록 갱신.
- direct lighting 룩을 point-light 중심에서 `spotlight + fill + softer beam/glow` 조합으로 조정.

Removed/Deprecated:
- builder preview 하단 `Preview Controls` 카드와 프리뷰 내부 휴지통 버튼을 전제한 UX.
- top-view 진입 시 HDRI manifest/모든 floor-wall texture set을 즉시 로드하던 가정.

## 2026-04-18 변경 동기화 (Lighting Mood Split + Button Rotation)
Added:
- direct lighting용 beam/floor glow shader와 indirect ceiling glow shader를 품질 기준에 추가.
- builder final step에서 선택한 lighting mode를 preview/editor save payload까지 유지하는 계약을 명시.

Updated:
- editor top-view interaction 기준을 drag rotation에서 button rotation으로 갱신.
- surface click은 material shortcut이 아니라 selection/hit-test 전용으로 유지하는 방향으로 상호작용 기준을 단순화.

Removed/Deprecated:
- top-view drag rotation 제스처 의존.
- floor/wall click material cycling.

## 2026-04-18 변경 동기화 (Deskterior Asset Density Pass)
Added:
- curated Blender 자산군에 머그/북스택/트레이/스피커/플랜터를 추가하고, runtime GLB + catalog metadata + verify 계약을 함께 관리하는 기준을 추가.
- 런타임 로더에 `EXT_meshopt_compression` 디코더와 deskterior 전용 Meshopt 최적화 스크립트 사용 기준을 추가.

Updated:
- 오픈소스 자산 활용 기준을 generic import에서 “CC0 provenance + category/brand/externalUrl 보강”까지 확장.
- deskterior optimize 기준을 단순 meshopt extension write에서 `glTF Transform dedup + prune + meshopt(reorder/quantize 포함)` 체인으로 구체화했다.

Removed/Deprecated:
- Blender source만 추가하고 runtime/export/metadata/verify는 수동으로 맞춘다는 운영 가정.

## 2026-04-20 변경 동기화 (Showcase Viewer Presentation Phase 1)
Added:
- gallery/community 카드 진입은 `/shared/[token]?source=showcase`로 통일하고, 해당 경로에서만 `viewer-showcase` 품질 ladder를 실제 사용하도록 기준을 추가했다.

Updated:
- SSR / Neutral tone mapping / richer post FX가 적용되는 `viewer-showcase` 슬롯을 “잠재 프로파일”이 아니라 “showcase 진입 전용 shared viewer presentation”으로 구체화했다.

Removed/Deprecated:
- gallery/community 카드와 일반 shared 링크가 항상 같은 lean viewer profile만 사용해야 한다는 가정.

## 2026-04-20 변경 동기화 (Showcase Polish Phase 2)
Added:
- `viewer-showcase`는 `viewer-shared`보다 tighter walk FOV, 살짝 더 공격적인 top zoom, warm rim + stronger fill light polish를 사용하는 기준을 추가했다.

Updated:
- showcase presentation 정의를 “render-quality preset 분리”에서 “camera framing + light rig까지 포함한 curated viewer presentation”으로 확장한다.

Removed/Deprecated:
- showcase/shared viewer가 같은 camera preset과 같은 light rig를 공유해야 한다는 가정.

## 2026-04-21 변경 동기화 (Editor Walk/Top QA Fixes)
Added:
- read-only shared/showcase top-view는 orbit camera로 360도 회전과 zoom을 허용하고 pan은 계속 금지한다.
- desk precision top-view에서는 선택 자산과 support asset이 full-detail 경로를 유지하도록 LOD/instancing 예외를 추가한다.

Updated:
- top-view floor 렌더 기준을 flat color footprint 우선에서 `runtime floor texture 허용 + 상향된 DPR` 기준으로 갱신한다.
- room shell texture load는 `.ktx2` decode 실패 시 원본 JPG/PNG fallback을 시도해 walk-view가 검정 background만 남지 않도록 강화한다.

Removed/Deprecated:
- shared/read-only top-view가 고정 orthographic + 회전 버튼만 제공한다는 가정.
- top-view에서 textured floor를 기본적으로 금지하던 이전 최적화 가정.

## 2026-04-22 변경 동기화 (CanvasHost Runtime Bridge)
Added:
- editor/shared viewer가 `CanvasHost`를 통해 runtime engine을 병렬 부트스트랩하는 compatibility 경로를 추가했다.

Updated:
- `SceneViewport`를 장기적인 scene ownership 계층이 아니라 renderer compatibility layer로 위치 조정한다.

Removed/Deprecated:
- viewport 컴포넌트가 장기적으로 document mutation과 runtime transform mutation을 동시에 소유한다는 가정.

## 2026-04-22 변경 동기화 (Runtime Preview Commit Bridge)
Added:
- instanced cluster direct-drag는 instance matrix local preview를 사용하고 pointer-up 시점에만 store/document bridge commit을 수행하는 기준을 추가했다.
- top-view gizmo transform과 회전 hotkey는 runtime preview를 먼저 갱신하고 commit 시 `deskterioronline:runtime-document-patch` 이벤트로 patch를 노출하는 기준을 추가했다.

Updated:
- drag/hover/placement preview hot path 규칙을 “가능하면 local preview”에서 “runtime/local preview 우선, store mutation은 commit 전용”으로 강화한다.

Removed/Deprecated:
- instanced cluster drag preview를 위해 per-pointer-move store update를 허용하던 이전 경로.

## 2026-04-22 변경 동기화 (Selected Asset Runtime Render Sync)
Added:
- selected top-view asset는 runtime object registry의 preview/transform 값을 `useFrame` mutation 경로로 직접 반영하는 기준을 추가했다.

Updated:
- renderer compatibility layer의 transform 소비 규칙을 “legacy prop 반영 + 일부 local preview”에서 “selected asset는 runtime transform 우선, commit 이후엔 legacy prop와 재수렴” 구조로 강화한다.

Removed/Deprecated:
- gizmo preview가 target object local mutation에만 머무르고 renderer compatibility layer에서는 runtime object registry를 소비하지 않는다는 가정.

## 2026-04-22 변경 동기화 (Instance Cluster Renderer Adapter Sync)
Added:
- instanced cluster는 runtime renderer adapter의 matrix/version snapshot을 읽어 dirty object만 imperative하게 재동기화하는 기준을 추가했다.
- renderer adapter snapshot은 scene generation 변경과 stale object disposal을 반영해 instanced batch membership을 재수렴한다.

Updated:
- instancing compatibility 규칙을 “local preview + commit 후 rerender”에서 “local preview + renderer adapter dirty sync + commit 후 store 재수렴” 구조로 강화한다.

Removed/Deprecated:
- instanced cluster가 pointer-up 이후 store rerender 전까지는 runtime preview/commit 결과를 직접 소비하지 못한다는 가정.

## 2026-04-23 변경 동기화 (Single Object Renderer Snapshot Priority)
Added:
- single object renderer compatibility path도 renderer adapter의 matrix snapshot을 우선 사용하고, runtime engine object registry는 fallback으로만 참조하는 기준을 추가했다.
- object별 material assignment snapshot을 renderer adapter handle/material registry에 유지하는 기준을 추가했다.

Updated:
- renderer compatibility 규칙을 “instanced cluster는 adapter snapshot, selected object는 runtime transform”에서 “single object와 instanced cluster 모두 adapter snapshot 우선” 구조로 강화한다.

Removed/Deprecated:
- single object transform sync가 renderer adapter를 우회해도 된다는 가정.

## 2026-04-23 변경 동기화 (Incremental Runtime Scene Reconciliation)
Added:
- same-room object lifecycle 변경은 runtime scene ref를 유지한 채 object registry만 incremental reconcile 하는 기준을 추가했다.
- same-object asset swap은 renderer object handle/batch를 다시 묶고, removed object는 runtime selection/hover에서 즉시 정리하는 기준을 추가했다.

Updated:
- renderer compatibility 전제를 “store commit 후 새 runtime scene이 공급될 수 있음”에서 “가능한 한 같은 runtime scene ref를 유지하고 dirty object만 재수렴”으로 강화한다.

Removed/Deprecated:
- object add/remove/material 변경이 renderer compatibility를 위해 항상 full runtime scene replace를 필요로 한다는 가정.

## 2026-04-23 변경 동기화 (Runtime Visibility Consumption)
Added:
- single object path와 instancing candidate set은 runtime visibility를 기준으로 hidden object를 제외해야 한다.

Updated:
- renderer compatibility layer의 소비 범위를 transform/material snapshot에서 transform/material/visibility snapshot으로 확장한다.

Removed/Deprecated:
- hidden object가 runtime renderer handle에 남아 있어도 실제 draw path에서 문제 없다는 가정.

## 2026-04-24 변경 동기화 (Room Visual Quality Slice)
Added:
- Wall/floor/ceiling material presets carry `repeatScaleMeters`, `rotationRadians`, and `previewThumbnail` so UV repeat stays close to real-world scale.
- Procedural walls render interior baseboards with door/opening gaps, and walk-mode ceilings render perimeter trim/corner caps.
- Builder preview must be browser-capturable for before/after evidence; preview disables unstable post effects and keeps `preserveDrawingBuffer` enabled only on the builder preview viewport.

Updated:
- Builder preview render quality uses continuous frames because scene shell and texture loading are async during step transitions.
- Room material presets must cover paint, wallpaper/acoustic panel, wood, tile, carpet, concrete, and resilient floor categories before feature RC.

Removed/Deprecated:
- A flat wall/floor color swatch without physical texture scale is no longer an acceptable room-quality default.

## 2026-04-23 변경 동기화 (Focus Placement Walk Prototype)
Added:
- walk mode의 `Focus Placement`는 선택된 배치 대상 자산을 runtime preview로만 움직이고, `Enter` 전에는 `SceneDocument`를 건드리지 않는 HUD/keyboard session으로 동작해야 한다.
- active focus placement session 중 crosshair는 `Confirm/Cancel` affordance를 우선 표시하고, 상세 상태는 별도 HUD 패널에서 `surface`, `offset`, `rotation`, `warning/error`를 보여줘야 한다.

Updated:
- walkthrough 정밀 배치 품질 기준을 “향후 시스템 분리 예정”에서 “desk top 한정 alpha session이 runtime preview와 keyboard nudge로 동작”하는 상태로 갱신한다.

Removed/Deprecated:
- walk mode에서 정밀 배치를 시작해도 top-view gizmo나 store direct mutation을 다시 써도 된다는 가정.

## 2026-04-28 변경 동기화 (Walk-First Placement UX)
Added:
- walk mode crosshair는 기본 상태에서 `I` inventory, armed item 상태에서 focused surface placement, active session 상태에서 click/Enter commit affordance를 보여줘야 한다.
- inventory drawer가 열릴 때 pointer lock은 해제되어야 하며, drawer를 닫은 뒤 canvas click으로 다시 mouse-look을 얻을 수 있어야 한다.

Updated:
- 상단뷰 렌더는 room shell inspection용 orbit/zoom만 유지하고 asset edit affordance는 숨긴다.
- focus placement 시작은 선택된 asset + camera-forward highlighted support surface 조합을 기본 경로로 한다.

Removed/Deprecated:
- top-view gizmo 또는 top-view direct drag를 데스크테리어 배치의 기본 경로로 쓰는 가정.

## 2026-04-23 변경 동기화 (Asset Compiler Alpha Publish)
Added:
- curated asset publish의 첫 단계로 manifest 외에 per-asset runtime package descriptor를 같이 생성하는 기준을 추가했다.

Updated:
- 런타임 자산 전달 기준을 “manifest + GLB path”에서 “manifest + runtime package descriptor(alpha)” 구조로 확장한다.

Removed/Deprecated:
- runtime package artifact 없이 manifest만 있으면 compiler phase를 닫을 수 있다는 가정.

## 2026-04-23 변경 동기화 (Asset Compiler Alpha Runtime Delivery)
Added:
- alpha runtime package는 descriptor/sidecar만이 아니라 실제 `proxy.glb`와 catalog thumbnail을 함께 생성해 proxy-first delivery와 catalog visibility를 동시에 보장해야 한다.
- published package 검증은 support surface가 asset envelope 밖으로 나가지 않는지, sidecar가 embedded `runtimeAsset`와 동일한지, file manifest가 실제 파일 존재와 일치하는지 확인해야 한다.

Updated:
- runtime delivery 품질 기준을 “descriptor publish 가능”에서 “descriptor + sidecar + proxy + thumbnail + published artifact verification” 구조로 강화한다.

Removed/Deprecated:
- proxy/thumbnail이 나중 단계까지 placeholder여도 compiler phase를 닫을 수 있다는 가정.

## 2026-04-23 변경 동기화 (Phase 9 Commercial QA Visual Surface)
Added:
- hidden QA surface에서도 runtime package publish 상태, benchmark budget summary, compatibility matrix, scene integrity sample이 한 화면에서 읽혀야 한다.
- editor bootstrap visual feedback 기준에 scene corruption/warning toast를 추가해, 깨진 `sceneDocument`가 조용히 로드되는 상태를 허용하지 않는다.

Updated:
- visual QA 기준을 “focus placement / mounted HUD”에서 “hidden commercial QA readout + bootstrap integrity feedback”까지 확장한다.

Removed/Deprecated:
- commercial QA는 CLI output만 있으면 되고 visual readout은 필요 없다는 가정.

## 2026-04-23 변경 동기화 (Phase 9 Commercial QA Visual Slice 2)
Added:
- hidden QA surface는 placement regression suite status와 coverage 문자열을 별도 카드로 노출해 mounted/surface placement 회귀 범위를 시각적으로 확인할 수 있어야 한다.
- integrity detector visual surface는 sample recovery snapshot 수치와 suggested recovery action을 함께 보여줘야 한다.
- asset status visual surface는 inventory table로 확장해 per-asset QA / support / attachment / variant / missing file 상태를 한 줄씩 읽을 수 있어야 한다.

Updated:
- commercial QA visual 기준을 “summary card readout”에서 “summary card + regression suite + inventory table + recovery snapshot detail”까지 확장한다.

Removed/Deprecated:
- hidden QA surface가 asset status를 summary 숫자만으로 보여줘도 충분하다는 가정.

## 2026-04-28 변경 동기화 (Walk Pointer Lock + AI Texture Baseline)
Added:
- editor walk view의 desktop mouse-look은 pointer lock ref 상태뿐 아니라 `document.pointerLockElement`를 canonical source로 확인해야 한다.
- walk canvas는 pointer lock 요청 전 focus 가능한 canvas로 전환되어야 하며, `W/A/S/D` 입력은 pointer lock 활성 중 기본 브라우저 동작을 막아야 한다.
- room shell 기본 wall/floor texture는 생성형 이미지 기반 limewash wall / light oak floor color map을 첫 번째 preset으로 사용하고, PBR 보조맵은 기존 runtime texture path와 결합한다.

Updated:
- walk view 입력 안정성 기준을 “click으로 pointer lock 진입”에서 “click 직후 DevTools focus 전환 없이 mouse-look + WASD가 즉시 동작”으로 강화한다.
- 기본 room shell visual baseline을 legacy plaster/weathered plank에서 생성형 limewash wall + light oak floor 조합으로 갱신한다.

Removed/Deprecated:
- pointer lock change 이벤트가 ref를 갱신하지 못하면 walk input이 멈춰도 된다는 가정.
- 기본 바닥이 어두운 weathered plank여야 한다는 가정.

## 2026-04-23 변경 동기화 (Phase 9 Commercial QA Visual Slice 3)
Added:
- hidden QA surface의 compatibility matrix card는 verification status, last verified timestamp, method, evidence를 함께 보여줘야 한다.
- placement regression suite card도 last verified timestamp, method, evidence를 노출해 운영형 release dashboard로 읽힐 수 있어야 한다.

Updated:
- commercial QA visual 기준을 `summary card + regression suite + inventory table + recovery snapshot detail`에서 `summary card + evidence-backed regression/compatibility dashboard + inventory table + recovery snapshot detail`까지 확장한다.

Removed/Deprecated:
- verification evidence는 숨겨두고 status pill만 보여줘도 충분하다는 가정.

## 2026-04-23 변경 동기화 (Phase 9 Commercial QA Visual Slice 4 / Complete)
Added:
- hidden QA surface는 asset package inventory 위에 QA/support/attachment coverage summary card를 함께 보여줘야 한다.
- integrity detector card는 invalid scale, support mismatch, severity summary, prioritized recovery action까지 함께 보여줘야 한다.

Updated:
- commercial QA visual 기준을 `evidence-backed regression/compatibility dashboard + inventory table + recovery snapshot detail`에서 `evidence-backed release dashboard + coverage summary + prioritized recovery detail`까지 확장한다.

Removed/Deprecated:
- integrity는 issue list와 단순 count만 보이면 충분하다는 가정.

## 2026-05-02 변경 동기화 (Attachment Guard Visual Contract)
Added:
- `wall_screw`와 `grommet_hole` 후보는 focus placement HUD에서 mount-target affordance로 표시되어야 한다.
- blocked wall/grommet preview는 ghost를 유지하되 point/footprint/normal-offset/collision 이유를 interaction-engine blocked reason으로 표시해야 한다.

Updated:
- mounted visual quality 기준을 `edge_clamp / underside_screw / wall_attach / vesa_mount`에서 `wall_screw / grommet_hole`까지 확장한다.

Removed/Deprecated:
- wall screw나 grommet hole 후보가 HUD에서 일반 surface candidate와 구분되지 않아도 된다는 가정.

## 2026-05-07 변경 동기화 (Opening Visual Fidelity + Procedural Fallback)
Added:
- `InteractiveDoors`는 door/window GLB와 같은 variant metadata를 사용하는 procedural fallback을 가져야 하며, smoke hook용 node name/renderer metadata를 노출해야 한다.
- door fallback은 최소 slab, handle/knob, frame/casing/molding, threshold를 읽을 수 있어야 하고, window fallback은 최소 glass, frame, mullion, sill, interior molding을 읽을 수 있어야 한다.

Updated:
- opening visual 기준을 asset existence에서 wall opening cut에 맞는 trim alignment, light-wall 대비가 있는 material contrast, shared renderer parity까지 확장한다.
- GLB load failure 시 opening visual은 plain white box가 아니라 structured procedural fallback으로 유지되어야 한다.

Removed/Deprecated:
- opening GLB 실패를 무구조 placeholder mesh로 감추는 방식.

## 2026-05-07 변경 동기화 (Walk Mouse-Look Fallback)
Added:
- desktop walk camera는 pointer lock이 실제로 획득되지 않아도 canvas가 focus된 상태에서는 canvas 위 mouse movement를 yaw/pitch look fallback으로 사용해야 한다.

Updated:
- pointer lock 실패는 rendering/interaction failure가 아니라 degraded input mode로 취급하고, crosshair HUD는 패널 차단 상태와 pointer lock 거부 상태를 구분해야 한다.

Removed/Deprecated:
- pointer lock 요청 실패 후 view control HUD가 unavailable 상태에 고정되는 방식.

## 2026-05-02 변경 동기화 (Asset Metadata Visual Contract)
Added:
- runtime asset은 시각적으로 보이는 GLB만이 아니라 collider, support surface, attachment point, provenance, SKU/manufacturer가 함께 검증된 package여야 catalog에 노출될 수 있다.
- `asset-metadata-gate` 실패 asset은 `/labs/qa`에서 release-blocking metadata issue로 보여야 하며, visual QA에서 누락된 collider/support/attachment metadata를 정상 package처럼 취급하지 않는다.

Updated:
- 3D asset 품질 기준을 mesh/proxy/thumbnail 중심에서 placement-ready metadata package 중심으로 확장한다.

Removed/Deprecated:
- 모델이 렌더링되면 collider/support/attachment metadata가 부실해도 visual asset으로 통과할 수 있다는 가정.

## 2026-05-02 변경 동기화 (Viewer Parity Visual Contract)
Added:
- shared/showcase/community viewer는 editor가 저장한 scene document hash와 runtime asset refs를 같은 payload contract에서 받아야 한다.
- showcase/community thumbnail source는 pinned version snapshot을 우선해야 하며, viewer parity gate에서 shared payload와 함께 검증되어야 한다.

Updated:
- visual QA 기준을 editor 화면 품질에서 shared viewer와 community card가 같은 장면 스냅샷을 가리키는지까지 확장한다.

Removed/Deprecated:
- 공유 뷰어와 커뮤니티 카드가 시각적으로 비슷하게 보이면 같은 scene state로 간주해도 된다는 가정.

## 2026-05-02 변경 동기화 (Commercial Texture Library Closure)
Added:
- commercial wall/floor preset library는 2K PBR source, KTX2 runtime target, preview thumbnail, real-scale repeat metadata를 가진 preset만 포함한다.

Updated:
- AI 생성 1K limewash/oak 후보는 commercial preset slot에서 제거하고, white plaster 2K와 wood floor 2K PBR preset을 기본 상용 후보로 사용한다.
- commercial texture gate는 wall/floor preset 수 제한뿐 아니라 `candidateAiTextureCount=0`을 통과 조건으로 본다.

Removed/Deprecated:
- AI candidate texture가 기본 wall/floor preset에 직접 연결된 상태.

## 2026-05-02 변경 동기화 (Walk Aim Preview Rendering)
Added:
- editor walk에서 crosshair가 focus placement 가능한 support object를 조준하면 renderer는 즉시 ghost preview를 갱신해야 하며, 이 조준 단계는 scene document patch를 만들지 않는다.
- desk precision keyboard nudge/rotate는 transform gizmo처럼 renderer preview를 먼저 갱신하고, idle batch commit 시점에만 store/document를 갱신한다.

Updated:
- demand frame loop 모드에서는 crosshair aim, ghost preview, keyboard nudge, batched commit 모두 명시적으로 `invalidate()`를 호출해야 한다.

Removed/Deprecated:
- keyboard nudge가 renderer preview 없이 저장 좌표를 먼저 바꾸고 후속 render sync에 의존하는 방식.

## 2026-05-03 변경 동기화 (Preview Input Consistency)
Added:
- walk focus ghost preview는 crosshair hit confidence를 pending request에서 보존한 ranking 값으로 시작해 aim 단계와 activation 단계의 visual priority가 drift되지 않아야 한다.

Updated:
- desk precision keyboard rotate preview 범위에 `R` 키를 포함한다. 방향키/Q/E/R은 모두 preview transform과 demand-frame invalidate를 먼저 수행하고 idle batch commit 후 저장 좌표를 갱신한다.

Removed/Deprecated:
- `R` rotate만 renderer preview 없이 즉시 store/document commit을 만드는 예외.

## 2026-05-06 변경 동기화 (Builder Commercial Visual Interaction Pass)
Added:
- inventory draft asset은 renderer ghost preview로만 보이며, active focus placement 또는 valid world placement commit 전에는 scene document에 저장되지 않는다.
- builder opening preview는 door/window GLB와 wall opening cut을 유지하면서, top preview에서 wall/opening hit target과 draggable opening segment를 제공해야 한다.
- material preset은 `id`, `name`, `category`, `useCategory`, `previewThumbnail`, `repeatScaleMeters` metadata를 가져 UI thumbnail, fallback color, QA gate가 같은 계약을 사용한다.
- direct lighting fixture는 `positionMm`, `intensity`, `colorTemperature`, `beamRadiusMm`, `spread`, `enabled`를 renderer light/glow/shader에 반영한다.

Updated:
- lighting visual QA는 direct/indirect mood 선택만이 아니라 fixture count/position/color/spread 변경 후 floor glow와 spotlight 위치가 같이 바뀌는지 확인해야 한다.
- wall/floor visual QA는 default preset cleanliness와 thumbnail/runtime parity를 `verify:material-presets`로 고정한다.
- opening visual QA는 style asset visibility뿐 아니라 blocked edge/overlap state와 saved opening payload parity를 포함한다.

Removed/Deprecated:
- inventory ghost preview를 실제 store asset으로 먼저 추가한 뒤 실패 시 지우는 방식.
- direct lighting renderer가 room bounds에서 매번 fixed 1/3 fixture를 암묵 계산하는 방식.
- texture label/category가 실제 runtime texture와 별도로 drift되는 상태.
