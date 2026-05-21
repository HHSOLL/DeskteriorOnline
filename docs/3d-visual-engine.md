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
- top-view는 HDRI를 올리지 않지만, editor room/desk top-view는 `resolveSceneRenderQuality`의 bounded contact shadow profile을 사용해 furniture grounding을 유지한다. shared top viewer는 contact shadow를 끈다.
- builder/editor lighting은 `direct`/`indirect` mood를 모두 지원하고, direct mode는 fixture emissive + beam/floor glow shader를 포함한다.
- indirect mode는 천장 가장자리 확산광 위주의 additive glow를 사용하고 광원 본체 노출을 최소화한다.
- direct mode는 scene `lighting.fixtures[]`를 source of truth로 사용하고, 사용자 조작 가능한 최대 6개 fixture + spotlight/fill + beam/floor glow 조합으로 제한해 자연스러운 falloff와 성능 균형을 함께 맞춘다.
- QA 조명 preset은 `neutral-studio`, `home-reference`, `soft-evening`으로 유지하고, 각 preset은 HDRI/exposure/white balance/contact shadow QA profile과 ambient/hemisphere/directional/environment blur/accent/beam snapshot을 가져야 한다.
- 제품 조명이 실제 point/spot light를 만들 수 있는 경우는 catalog/runtime metadata가 조명 제품임을 명시할 때뿐이며, 장면당 dynamic emitter 예산은 `<= 6`이다.
- SSR/bloom은 editor walk와 viewer showcase의 non-constrained profile에서만 허용한다. Contact shadow는 builder preview/editor top-view에서 bounded diorama grounding 용도로만 허용하고, shared top viewer와 constrained shared viewer에는 비용을 전파하지 않는다.

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
- video/reference prototype scene preview는 파일 존재만 검증하지 않고 픽셀 기준 non-white / dark material / accent color coverage를 확인해야 한다. 흰색 fallback geometry만 보이는 preview는 `verify:video-scene-reference`에서 실패해야 한다.

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
- read-only top/walk와 editor `desk precision` top-view에서는 반복된 `single_mesh` low/medium complexity deskterior 자산을 instanced cluster로 묶어 draw call을 줄이고, selected/direct-drag 경로는 개별 오브젝트를 유지한다. builder preview starter는 furnished-room 구도 가독성을 위해 개별 proxy 렌더 경로를 우선할 수 있다.
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
- top-view/editor precision 모드는 physics simulation, SSAO, SSR, bloom을 비활성으로 두고 낮은 DPR/그림자 예산을 사용한다. editor top-view의 contact shadow는 bounded profile 안에서만 허용한다.
- builder preview는 walk/viewer보다 가벼운 품질 프로필을 사용하되, furnished diorama legibility를 위해 bounded dynamic shadow + warm-tinted contact shadow를 유지하고 post FX/SSR/bloom은 끈다.
- `viewer-shared`는 fill directional light를 기본으로 올리지 않고, constrained profile에서는 directional shadow/contact shadow/bloom을 먼저 제거한다. builder preview는 별도 diorama profile로 관리한다.
- `viewer-shared`는 subtle vignette/noise까지만 허용하고, bloom은 `desk precision` 또는 richer walk/showcase preset에서만 선택적으로 사용한다.
- `editor walk`와 `viewer-showcase`는 non-constrained profile에서만 보수적 SSR을 사용할 수 있고, `viewer-shared`, top-view, builder preview는 SSR을 올리지 않는다.
- 가구 drag는 local preview 후 pointer-up 시점에 store commit을 우선 적용해 전역 scene 재직렬화를 매 pointer move마다 유발하지 않는다.
- loaded GLB 자산의 hover/select raycast는 `three-mesh-bvh` bounds tree를 우선 사용해 작은 desk asset 다수 배치 시 raycast 비용을 낮춘다.
- loaded GLB 자산의 large non-interleaved geometry는 BVH 생성 자체를 Web Worker queue로 오프로딩하고, small/interleaved geometry만 sync 경로를 유지한다.
- telemetry가 활성일 때 `SceneViewport`는 live performance budget HUD를 같이 띄워 FPS floor, draw call 초과, heap growth, interaction latency, BVH sync fallback을 즉시 드러내야 한다.
- live HUD 경고와 CLI regression verify는 같은 budget helper를 공유해 threshold drift를 허용하지 않는다.
- focused asset/support asset은 walk focus placement와 desk precision 편집 중 proxy fallback보다 full-detail LOD를 우선 유지해야 한다.
- editor inspector에서 선택 제품을 교체할 때는 같은 object handle이 새 catalog asset metadata를 받아 renderer batch/selection이 끊기지 않아야 하며, transform/support anchor는 anchor solver로 재클램프한 값만 반영한다.
- editor placed-zone batch replacement에서 support surface 부모 가구를 교체할 때는 projected scene 기준으로 하위 surface-anchor 자산들이 같은 부모에 남는지 preflight하고, 부모 교체를 마지막에 적용해 store-level dependent re-anchor가 최종 규격 기준으로 수렴해야 한다.
- KTX2 encoder(`toktx`)가 없는 환경에서도 runtime decode path와 public transcoder sync는 유지해야 한다.
- `verify:asset-instancing`는 read-only top/walk + editor `desk precision` + editor `room mode` idle instancing eligibility와 cluster grouping 정책을 회귀 검증해야 한다. builder preview starter는 individual proxy 렌더 경로를 우선해 seed 구도 가독성을 유지해야 한다.
- native gltfpack output을 사용할 때는 `-kn -km -ke` 보존 플래그 기준을 유지해 slot-aware finish와 named node/material 기반 런타임 가정이 깨지지 않게 해야 한다.

## 2026-05-15 변경 동기화 (Cozy Diorama Room Direction)
Added:
- 사용자 시작 템플릿과 editor top/builder preview는 작은 방을 한눈에 읽는 isometric diorama 구도를 기준으로 조정한다.
- reference room 프로젝트는 시각/상호작용 패턴만 참고하며, 외부 unlicensed code/asset/shader/texture/layout 표현은 복제하지 않는다.
- `workspace-flex` preview composition은 workstation/media/lounge/display cluster 단위로 줄어들거나 복원될 수 있어야 하며, 각 cluster 단독 상태도 3개 이상의 real catalog asset으로 읽히는 구도를 유지해야 한다.
- editor inspector는 선택 제품과 호환되는 catalog 후보를 visual picker로 제공해 같은 위치에서 다른 제품으로 교체할 수 있어야 한다. 후보 정렬은 category, anchor type, 치수 적합도, 제품군, 실측 metadata completeness, generated QA score를 함께 사용해 추천/호환/검토 상태를 보여주며, 후보 카드는 신뢰 가능한 실제 thumbnail 또는 치수 기반 mini isometric diorama fallback으로 visual scale을 읽게 해야 한다.

Updated:
- workspace furnished template은 sparse desk set이 아니라 24개 catalog asset으로 구성된 데스크, 의자, 선반, 소파, 커피 테이블, 미디어 콘솔, TV, 게임 콘솔, 사이드 테이블, 스툴, 모니터, 키보드/마우스, 스피커, 램프, 식물, 소품이 함께 보이는 creator-room starter로 취급한다.
- builder/editor room-mode light pass는 추가 dynamic emitter 없이 기존 ambient/hemisphere/key/fill 조합 안에서 warm key + cool fill 대비를 강화한다.
- builder preview는 furnished seed 자산, lightweight dynamic shadows, contact shadows, direct lighting fixture decor, dark canvas backdrop을 함께 렌더해 저장 전 커스터마이징 단계에서도 diorama 품질을 확인할 수 있어야 한다.
- builder preview는 orthographic isometric camera와 explicit camera pose sync를 사용하되, 높은 overhead가 아니라 room 바깥 대각선의 낮은 presentation pose로 첫 프레임에서 벽/가구 높이/상판 소품이 함께 읽히도록 하고, 카메라 가까운 외벽은 preview 전용 cutaway로 연다.
- starter seed는 scale-locked 제품 치수를 임의 축소하지 않고, support anchor와 dimensionsMm 기반 stylized preview proxy를 우선해 내부 가구와 소품이 벽 또는 foreground furniture에 가려지지 않아야 한다.
- stylized preview proxy와 preview-only shell dressing은 둥근 모서리/부드러운 bevel-like silhouette, monitor/TV screen panels, keyboard/mouse/speaker/gamepad/game-console/mug micro-detail, media-console cabinet detail, desk drawer/LED/cable accents, desk/media/shelf surface dressing, 커피 테이블 rug, 선반 책/박스, 소파 arm/cushion detail, 식물 잎 분할, crown trim, framed wall panels처럼 scene document에 없는 lightweight visual detail을 렌더 전용으로만 더해 furnished starter의 밀도와 toy-like diorama 질감을 보강할 수 있다.
- `workspace-flex` starter는 desk/TV+media-console/shelf/lounge를 벽면과 foreground에 붙여 compact diorama의 edge-density를 만들고, desk/shelf/console/side-table surface props는 support anchor를 유지한 채 해당 cluster 위에서 읽히도록 배치한다.
- builder preview direct-lighting 경로는 additional point/spot emitter를 늘리지 않고 renderer-only transparent tint wash plane으로 warm wall/floor glow와 cool wall/floor glow를 더해 reference-style color contrast를 만든다.
- editor room top-view는 room-mode 조명 fixture decor와 contact shadow를 유지해 reference-style room shell과 desk/living/shelf density를 한눈에 읽게 한다.
- editor lighting preset은 warm/cool accent wash와 direct beam glow까지 함께 바꿔야 하며, inspector는 `accentIntensity`와 `beamOpacity`를 수동 조정할 수 있어야 한다.
- cluster toggle은 sceneDocument에 별도 UI 상태를 저장하지 않고, 최종 생성 시점의 seed asset set만 저장한다. preview-only proxy/detail pass는 선택된 cluster asset에만 적용되어야 한다.
- 제품 교체는 scene asset id를 유지한 채 `assetId/catalogItemId/product/supportProfile`만 새 catalog item으로 바꾸며, 기존 position/rotation/scale/material override/supportAssetId를 보존한 후 solver가 허용하는 범위로 보정한다.
- replacement picker는 같은 category라도 footprint/제품군이 크게 다른 후보를 뒤로 밀어 selected object의 visual scale과 surface lock이 갑자기 어긋나지 않게 한다. 공용 placeholder thumbnail이 실제 asset과 맞지 않는 경우에는 thumbnail을 크게 노출하지 않고 family/치수 기반 isometric proxy preview를 우선한다.
- replacement picker는 catalog text에서 workstation/media/lounge/display/flex room zone을 추론해 선택 항목과 후보 카드에 표시하고, 같은 zone 후보를 가벼운 ranking 신호로 사용해 이미 구성된 방의 맥락을 유지한다. Inspector는 같은 존 후보와 전체 후보를 segmented control로 전환해 zone context를 유지하면서도 후보 탐색 범위를 넓힐 수 있어야 한다.

Removed/Deprecated:
- 빈 방에 가까운 workspace starter만으로 “사용자가 꾸밀 수 있는 방”의 첫 인상을 충분히 전달할 수 있다는 가정.
- builder preview에서 seed 자산과 shadow를 모두 비워 둔 채 벽/바닥만 보여주고, 품질 판단을 editor 진입 이후로 미루는 방식.
- media/lounge/display cluster가 누락 catalog item 때문에 unrelated fallback catalog item으로 대체되어 사용자가 선택한 방 구성이 시각적으로 바뀌는 방식.
- 제품 교체를 remove + add로 처리해 object lifecycle, renderer handle, support lock, undo snapshot 의미가 바뀌어도 허용하는 방식.
- 제품 교체 후보가 category와 크기만 보여주고 방의 workstation/media/lounge/display 맥락을 숨기거나 같은 존 후보를 별도로 좁혀 볼 수 없어도 충분하다는 방식.

## 2026-05-16 변경 동기화 (Editor Replacement Isometric Proxy)
Added:
- inspector replacement card fallback은 normalized `previewScale`을 사용해 floor footprint와 object height/depth가 보이는 mini isometric proxy를 렌더해야 한다.
- 신뢰 가능한 전용 thumbnail이 없는 실제 `/assets/models/*.(glb|gltf)` replacement 후보는 card 내부에서 demand-frameloop live model overlay를 시도하고, GLB 로드 실패 시 기존 isometric proxy가 그대로 남아야 한다.
- compact placed-zone preview도 대표 replacement family를 같은 proxy 계열로 보여줘 batch replace 실행 전 visual expectation을 제공해야 한다.
- compact placed-zone preview는 대표 replacement 후보의 normalized `previewScale`을 summary metadata로 전달받아, row 내부에서도 후보별 footprint/depth/height 차이를 유지해야 한다.

Updated:
- CSS proxy는 live WebGL card preview를 대체하는 최종 에셋 품질 기준이 아니라, 부정확한 thumbnail보다 나은 즉시 visual fallback으로 취급한다.
- replacement card의 thumbnail trust는 asset id 또는 catalog id와 thumbnail filename match를 기준으로 하며, 공유 placeholder thumbnail은 실제 후보별 render로 취급하지 않는다.
- live model overlay는 orthographic/demand 렌더, 기존 runtime GLB loader, 작은 warm/cool light rig만 사용하고 renderer scene, `sceneDocument`, fixture budget, support anchor를 변경하지 않는다.
- replacement proxy는 sceneDocument, renderer object handle, support anchor, lighting fixture budget에 영향을 주지 않는 inspector-only UI다.
- placed-zone proxy는 card fallback과 같은 dimension source를 사용하되, renderer scene이나 batch replacement update order에는 영향을 주지 않는다.

Removed/Deprecated:
- replacement fallback이 평면 silhouette만 보여 깊이/footprint가 카드에서 읽히지 않아도 충분하다는 기준.
- placed-zone compact proxy가 후보 치수와 무관한 단일 scale로만 표시되어도 충분하다는 기준.
- chair/sofa/decor 후보가 desk 등 다른 asset의 공유 thumbnail을 실제 후보 preview처럼 보여도 허용하던 기준.

## 2026-05-16 변경 동기화 (Editor Room Mood Recipes)
Added:
- inspector room mood recipe는 wall/floor/ceiling material preset과 existing lighting preset을 동시에 적용해 editor top-view의 전체 색온도와 surface impression을 빠르게 바꿔야 한다.
- recipe UI는 material swatch 3개를 함께 보여줘 적용 전 wall/floor/ceiling 조합을 예측할 수 있어야 한다.

Updated:
- visual mood 변경은 renderer-only wash나 개별 lighting slider에만 의존하지 않고, room shell material과 lighting preset을 같은 사용자 action으로 묶는 경로를 포함한다.
- recipe는 existing material indices와 lighting preset settings만 사용하므로 render quality ladder, dynamic emitter budget, contact shadow policy에는 영향을 주지 않는다.

Removed/Deprecated:
- editor에서 warm/cool room mood를 확인하려면 사용자가 재질과 조명을 별도 섹션에서 수동으로 맞춰야 한다는 기준.

## 2026-05-16 변경 동기화 (Builder Room Mood Recipes)
Added:
- builder style step의 room mood recipe는 wall/floor material preset과 existing lighting preset settings를 동시에 preview에 적용해 생성 전 전체 색온도와 surface impression을 빠르게 바꿔야 한다.
- builder recipe UI는 editor recipe와 같은 swatch source를 사용해 적용 전 wall/floor/ceiling 조합의 색감을 예측할 수 있어야 한다. Builder는 현재 ceiling UI가 없으므로 저장 payload에는 기존 ceiling 계약을 새로 추가하지 않는다.

Updated:
- builder preview visual mood 변경은 개별 wall/floor swatch와 lighting step 조작뿐 아니라 bundled mood action으로 시작할 수 있어야 한다.
- recipe는 existing material indices와 lighting preset settings만 사용하므로 render quality ladder, dynamic emitter budget, seed asset payload에는 영향을 주지 않는다.

Removed/Deprecated:
- builder preview에서 warm/cool room mood를 확인하려면 style step과 lighting step을 오가며 값을 따로 맞춰야 한다는 기준.

## 2026-05-16 변경 동기화 (Diorama Grounding Shadow)
Added:
- `resolveSceneRenderQuality`는 contact shadow의 opacity/blur/resolution뿐 아니라 scale/far/color/y offset을 mode-aware policy로 관리해야 한다.
- builder preview의 contact shadow는 warm-tinted bounded footprint를 사용해 dense starter furniture가 바닥에 떠 보이지 않게 하면서 post FX/SSR/bloom 비용을 올리지 않는다.
- Clean Paint/Clean Plaster default wall presets는 dirty source diffuse texture를 runtime wall에 직접 쓰지 않고 clean color material + runtime-matched clean thumbnail을 사용해야 한다.

Updated:
- editor room/desk top-view는 HDRI 없이 bounded contact shadow만 유지해 top camera에서도 furniture grounding을 읽을 수 있어야 한다.
- shared top viewer와 constrained shared viewer는 contact shadow를 끄고, shared walk의 non-constrained contact shadow도 bounded profile 안에서만 허용한다.
- 기본 furnished builder preview는 `Matte White Paint` 선택 시 얼룩진 concrete/plaster wall처럼 보이면 안 되며, texture thumbnail도 같은 clean wall impression을 제공해야 한다.

Removed/Deprecated:
- builder preview와 editor top-view가 항상 contact shadow를 끄고 flat shell/footprint 가독성만 우선한다는 과거 성능 가정.
- clean default wall preset의 이름만 clean이면 되고 runtime diffuse texture가 dirty/industrial로 보여도 허용한다는 가정.

## 2026-05-16 변경 동기화 (Builder Preview Ground Dressing)
Added:
- builder preview는 `Furniture.tsx`의 renderer-only ground dressing으로 lounge rug, woven edge/thread strips, coffee-table tabletop props, sofa throw/seam details를 추가해 floor center와 lounge cluster가 compact diorama처럼 읽히도록 한다.
- ground dressing은 `builder-preview-ground-dressing` group name을 유지해 visual smoke와 source verifier가 같은 계약을 확인할 수 있어야 한다.

Updated:
- coffee-table proxy는 단순 테이블/러그 조합이 아니라 책/트레이/컨트롤러처럼 읽히는 작은 tabletop mass를 포함해야 한다.
- sofa proxy는 단순 fabric block이 아니라 throw blanket, front seam, cushions가 함께 보여야 한다.
- 해당 detail pass는 builder preview에만 렌더되고, editor top/walk/shared viewer나 저장 payload에는 전파하지 않는다.

Removed/Deprecated:
- dense furnished starter에서 lounge cluster 중심부가 빈 floor plane으로 남아도 허용하던 기준.

## 2026-05-16 변경 동기화 (Builder Preview Surface Dressing)
Added:
- builder preview는 `Furniture.tsx`의 renderer-only `BuilderPreviewSurfaceDressing`으로 desk/media-console/shelf 상판에 작은 silhouette props를 추가해 workstation/media/display cluster가 개인 방처럼 읽히도록 한다.
- surface dressing은 헤드폰, 케이블, 노트, 콘솔/리모컨, collectible shape를 lightweight geometry로 표현하되 scene 저장 payload와 catalog count에는 포함하지 않는다.

Updated:
- builder preview visual quality는 large furniture proxy legibility뿐 아니라 각 cluster surface 위의 personal object density까지 포함한다.
- 해당 detail pass는 material/geometry만 사용하고 dynamic light emitter를 추가하지 않는다.

Removed/Deprecated:
- desk/media-console/shelf top이 비어 있어도 seed asset count만 충분하면 compact room density가 충분하다는 기준.

## 2026-05-16 변경 동기화 (Builder Preview Wall Dressing)
Added:
- builder preview는 `Furniture.tsx`의 renderer-only `BuilderPreviewWallDressing`으로 rear/side wall gallery, rear shelf decor, warm/cool LED strip geometry를 추가해 blank wall area를 줄여야 한다.
- wall dressing은 lightweight geometry/material만 사용하고, point/spot/directional/ambient light emitter를 추가하지 않는다.

Updated:
- builder preview visual quality는 large furniture, surface props, floor grounding뿐 아니라 wall-plane composition과 vertical decor density까지 포함한다.
- `DioramaAccentWash` opacity contract는 clean matte wall에서도 warm/cool contrast가 캔버스에서 식별될 정도로 유지해야 한다.

Removed/Deprecated:
- 밝은 벽이 비어 있어도 floor/furniture cluster만 충분하면 compact diorama 품질을 만족한다는 기준.

## 2026-05-16 변경 동기화 (Builder Preview Presentation Camera)
Added:
- builder preview camera는 `builderPresentationDistance`, 낮은 `builderHeight`, raised `builderTargetY`, compact `builderZoom`으로 room 외부 대각선에서 scene을 보여줘야 한다.
- orbit polar limit은 사용자가 preview를 돌려도 너무 높은 floor-plan top-down view로 쉽게 돌아가지 않도록 제한한다.

Updated:
- visual quality 기준은 object density뿐 아니라 default camera pitch/framing이 furniture silhouette과 wall plane을 충분히 드러내는지까지 포함한다.
- source verifier가 camera pose contract를 확인해 visual smoke 전 단계에서 high-overhead 회귀를 잡는다.

Removed/Deprecated:
- builder preview에서 카메라가 room corner 안쪽 높은 위치에 있어 floor area만 크게 보이면 충분하다는 기준.

## 2026-05-16 변경 동기화 (Builder Preview Mood Lighting)
Added:
- `InteractiveLights.tsx`의 builder preview direct-lighting 경로는 `builder-preview-mood-wash` renderer-only group을 유지해 warm/cool floor bleed와 wall bleed를 캔버스에서 식별 가능하게 렌더해야 한다.
- `verify:lighting-layout`는 mood wash source contract, builder-preview scope, normal-blend tint, dynamic emitter 미증가 조건을 함께 회귀 검증해야 한다.

Updated:
- `DioramaAccentWash`는 밝은 white wall에서 사라지는 additive 방식 대신 transparent normal-blend tint를 사용한다.
- builder preview global light는 flat ambient를 낮추고 warm directional key/cool fill 대비를 강화해 clean wall/floor material 위에서도 조명 mood가 읽히게 한다.
- floor wash는 depth test를 유지해 가구 위로 과도하게 올라오지 않게 하고, wall wash만 wall mesh depth에 묻히지 않도록 별도 depth 처리를 허용한다.

Removed/Deprecated:
- clean wall/floor가 high-key white에 가까워서 renderer-only accent wash가 보이지 않아도 통과시키는 visual 기준.

## 2026-05-16 변경 동기화 (Builder Preview Visual Smoke Gate)
Added:
- builder preview는 source-level proxy/dressing 계약과 별개로 실제 브라우저 canvas에서 nonblank, high-contrast, multi-color diorama로 읽히는지 검증되어야 한다.
- `verify:builder-preview-diorama`는 style step, media-lounge preset 전환, lighting step을 Playwright로 열고 WebGL canvas pixel을 샘플링한다.
- visual smoke는 `preserveDrawingBuffer`가 켜진 builder preview viewport를 사용해 canvas size, luminance standard deviation, color bucket count, warm/cool/bright/dark pixel ratio를 확인한다.

Updated:
- builder preview visual QA는 group marker/source verifier를 1차 gate로 유지하되, 최종 회귀 판단에는 `output/playwright/builder-preview-diorama-smoke.png` 캡처와 pixel metrics를 함께 사용한다.

Removed/Deprecated:
- source verifier가 통과하면 실제 첫 프레임이 검은 화면, 빈 흰 shell, 단색 floor plan이어도 visual 품질이 검증됐다고 보는 방식.

## 2026-04-20 변경 동기화 (Room Mode Direct-Drag Instancing Phase 1)
Added:
- editor `room mode` top-view에서도 반복된 `single_mesh` low/medium complexity 자산을 idle 상태에 한해 instanced cluster로 유지하는 기준을 추가했다.
- instanced cluster 위를 직접 눌렀을 때 선택 자산만 live update로 움직이고, pointer-up 이후에만 개별 오브젝트 경로로 빠지는 direct-drag handoff 기준을 추가했다.

Updated:
- instancing 적용 범위를 `read-only top/walk + editor desk precision`에서 `read-only top/walk + editor desk precision + editor room mode idle`까지 확장한다. builder preview는 2026-05-15 이후 furnished starter proxy 가독성을 우선한다.

Removed/Deprecated:
- room mode direct-drag 때문에 editor room top은 instancing을 전혀 사용할 수 없다는 가정.

## 2026-05-11 변경 동기화 (Actual SKU Material Pass)
Added:
- FURSYS `ZDQ012J` prototype asset은 product URL reference pack, slot-level material hints, Blender-authored procedural PBR maps를 함께 보관한다.
- 실제 SKU prototype material pass는 `DeskWood_light_laminate`, `DeskMetal_warm_grey_panel`, `DeskMetal_graphite_frame`, `DeskMetal_silver_detail`, `DeskPlastic_light_sensor` 같은 named slot을 유지해야 한다.
- `asset:factory`는 실제 SKU prototype asset마다 Blender rebuild scaffold, required component list, material slot plan, artifact QA, repair instruction을 남긴다.

Updated:
- 제품 재질 개선은 이미지 텍스처를 단순히 붙이는 것이 아니라 UV scale, visible laminate surface, roughness/normal intensity, runtime GLB size budget을 동시에 통과해야 한다.
- public product page 기반 texture는 최종 상용 texture가 아니라 prototype rebuild source로만 쓰며, runtime GLB는 curated asset budget 안에서 export해야 한다.
- private/prototype asset은 runtime GLB와 thumbnail이 있어도 material slot이 manufacturer swatch/CAD 기준으로 검증되기 전까지 visual fidelity repair loop를 유지한다.

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

## 2026-05-12 변경 동기화 (Reference-Still Fidelity Gate)
Added:
- private creator/video reference scene은 hero 제품별 `visual-fidelity-report.json`을 필수 산출물로 가진다. report는 reference target, required signature fragments, matched fragments, object count, model byte size, signature score를 기록한다.
- screenshot-match smoke render는 제품 배치 비율까지 QA 대상으로 삼는다. white desktop, lavender wall wash, ultrawide clock monitor, glass PC tower, both speakers, portable monitor, split keyboard, desk mat, right-side planter가 한 프레임에서 읽혀야 한다.

Updated:
- procedural rebuild라도 hero 제품은 제품 고유 실루엣을 만드는 visible component를 가져야 한다. 예: HYTE Y70은 panoramic glass/fan stack/vertical GPU/AIO tubes, Epic 5는 recessed black baffle/tweeter/woofer/spike feet, AM HATSU는 split organic body/key matrix/palm rest를 포함한다.
- reference-preview 조명은 hard rectangle glow plane보다 area/point light 기반 wall wash를 우선 사용해 제품 뒤에 임시 판처럼 보이는 artifact를 만들지 않는다.

Removed/Deprecated:
- hero 제품을 generic rounded cube 또는 simple panel로 남기고 “reference scene에 있다”는 이유만으로 visual QA를 통과시키는 방식.

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
- `viewer-shared`는 secondary fill light 없이 기본 light rig를 구성하고, constrained profile에서는 directional shadow/contact shadow/bloom을 먼저 제거하는 기준을 추가한다.
- builder preview는 shared viewer와 분리된 diorama profile로, bounded dynamic shadow + warm-tinted contact shadow를 유지하되 SSR/bloom/post FX를 끄는 기준을 추가한다.

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
- read-only top/walk에서 반복된 `single_mesh` low/medium complexity 자산을 instanced cluster로 렌더링하는 품질 기준을 추가했다. builder preview instancing은 2026-05-15 furnished starter proxy 기준으로 대체한다.
- `verify:asset-instancing` 스크립트로 editable top mode 제외, selected 제외, dynamic light 제외, manual LOD 제외 정책을 검증하는 기준을 추가했다.

Updated:
- `instancing/LOD 운영화` 상태를 `LOD policy만 적용`에서 `LOD policy + non-editable repeated asset instancing`까지 확장했다.

Removed/Deprecated:
- read-only 장면에서도 반복 자산을 항상 개별 mesh clone으로만 유지해야 한다는 가정. builder preview starter는 2026-05-15 이후 개별 proxy 경로를 예외로 둔다.

## 2026-04-20 변경 동기화 (Editor Desk Precision Instancing)
Added:
- editor `desk precision` top-view에서 반복된 `single_mesh` low/medium complexity 자산을 instanced cluster로 유지하는 기준을 추가했다.

Updated:
- instancing 적용 범위를 `read-only top/walk`에서 `read-only top/walk + editor desk precision`까지 확장한다.
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

## 2026-05-15 변경 동기화 (Editor Lighting Fixture Controls)
Added:
- editor inspector는 direct/indirect lighting mode를 시각 mood control로 노출하고, direct mode에서 fixture count와 color temperature를 변경할 수 있어야 한다.
- editor direct lighting grid preview는 저장된 `lighting.fixtures[]`의 snapped mm 좌표를 room bounds 위에 표시하고 marker drag로 개별 fixture 위치를 바꿀 수 있어야 한다.
- editor direct lighting detail controls는 개별 fixture의 enabled, intensity, beam radius, spread를 수정해 direct light/glow/shader가 같은 payload에서 읽는 조명 품질을 유지해야 한다.

Updated:
- direct fixture count/temperature/position/intensity/beam/spread 변경은 `normalizeLightingFixtures(..., lightingBoundsMm)`를 거쳐 저장되며, renderer는 기존 `InteractiveLights` path에서 같은 fixture 배열을 소비한다.

Removed/Deprecated:
- editor lighting slider만 제공하고 direct fixture layout/color/position/intensity/beam/spread를 builder 이후 수정할 수 없게 두는 UX.

## 2026-05-16 변경 동기화 (Editor Room Styling Bundles)
Added:
- editor room styling bundle은 `workspace-flex`의 workstation/media/lounge/display clusters를 기존 room shell 위에 재적용해 compact diorama density를 빠르게 회복하는 visual affordance로 본다.
- bundle merge 시 surface props는 support asset id를 기존 또는 새 support object로 재고정해야 하며, orphaned desk/shelf/furniture surface prop은 visual QA 실패로 본다.

Updated:
- visual quality target은 builder preview의 starter density뿐 아니라 editor에서 bundle apply 후에도 desk/media/shelf/lounge zones가 함께 보이는 room composition을 유지하는 방향으로 확장한다.
- `verify:editor-styling-bundles`는 renderer smoke 전 단계의 source/data contract gate로 사용하고, 이후 browser visual smoke에서 authenticated editor canvas 품질을 추가 확인한다.

Removed/Deprecated:
- editor visual density를 수동 개별 배치에만 의존하고, 이미 있는 seeded cluster 계약을 post-create customization에 재사용하지 않는 방식.

## 2026-05-16 변경 동기화 (Meshy Generated Shelf Decor)
Added:
- `p2s_meshy_pastel_mascot_stack`는 Meshy text-to-3D + Blender finalizer로 만든 image-based PBR decor GLB로, catalog와 `workspace-flex` display cluster에 노출된다.
- generated decor는 scale-locked 180x120x150mm, centered floor pivot, box collision proxy, `single_mesh` LOD metadata를 가져 일반 catalog asset과 같은 placement/selection path를 사용해야 한다.
- GLB validation은 error 0개를 유지해야 하며, tangent warning은 현재 Meshy output의 known warning으로 추적한다.

Updated:
- compact diorama 품질 기준은 renderer-only surface/wall dressing 외에 실제 generated GLB 소품이 선반/디스플레이 cluster를 채우는지까지 포함한다.
- Meshy-generated prototype의 texture metadata는 `image_based` PBR로 기록하고, KTX2 runtime 승격은 별도 optimization pass로 남긴다.

Removed/Deprecated:
- display shelf decor를 generic placeholder 또는 shared stand GLB만으로 유지해도 충분하다는 판단.

## 2026-05-16 변경 동기화 (Generated Thumbnail Presentation)
Added:
- product asset finalizer thumbnail render는 generated Meshy decor의 pastel material이 검은 투명 배경/과노출 artifact로 보이지 않도록 opaque background, AgX/Filmic fallback color management, reduced exposure, warm key/cool fill을 적용한다.
- editor catalog/replacement preview는 generated thumbnail을 실제 asset-specific thumbnail로 사용하되, provider/review badge를 overlay해 prototype 상태를 시각적으로 구분한다.

Updated:
- generated GLB의 visual QA는 glTF validation뿐 아니라 catalog thumbnail legibility와 editor card/replacement card에서의 provenance readability를 포함한다.

Removed/Deprecated:
- transparent thumbnail이 black card로 보이거나 pastel generated model이 white blob으로 읽혀도 catalog render artifact로 허용하는 기준.

## 2026-05-16 변경 동기화 (Generated Bundle Disclosure)
Added:
- editor styling bundle preview는 `workspace-flex` seed의 catalog item id를 기준으로 generated Meshy decor 포함 여부를 계산하고, 적용 전 `Meshy 생성 ... 검수 필요` badge를 표시한다.
- display cluster가 들어간 bundle은 generated decor가 방 구성의 visual density를 높이는 동시에 review 대상 prototype임을 UI에서 드러내야 한다.
- builder style step의 workspace cluster preset과 display cluster toggle은 같은 generated decor badge를 표시해 사용자가 room-first 생성 전부터 Meshy prototype 포함 여부를 확인할 수 있어야 한다.

Updated:
- generated decor의 시각 품질 관리는 GLB/thumbnail 검증에만 머물지 않고, 사용자가 bundle로 방을 꾸미는 affordance에서도 provenance와 review state를 확인하는 흐름까지 포함한다.
- visual density 개선을 위해 생성형 decor를 seed에 포함하더라도, builder/editor UI가 provider/review state를 숨기면 visual QA 완료로 보지 않는다.

Removed/Deprecated:
- 생성형 decor가 room bundle의 일부로 들어가면서 catalog/replacement inspector 밖에서는 review 상태가 보이지 않는 방식.

## 2026-05-16 변경 동기화 (Furniture Render Source Markers)
Added:
- `Furniture.tsx`는 실제 GLB, builder-preview proxy, placeholder fallback, model-loading fallback, LOD proxy를 `furniture-render-source-*` group/object name과 `userData.furnitureRenderSource`로 구분해야 한다.
- Meshy-generated decor와 같은 실제 generated GLB는 runtime tree에서 `real-glb` source로 식별되어야 하며, LOD box나 loading placeholder가 같은 품질로 오인되면 안 된다.
- `verify:builder-performance`는 renderer-only diorama detail뿐 아니라 render source marker 계약까지 확인한다.
- `verify:builder-preview-diorama`는 브라우저에서 `window.__DESKTERIORONLINE_FURNITURE_RENDER_SOURCES__` registry를 읽어 builder preview의 visible furniture source count, fallback 0개, Meshy decor catalog inclusion을 canvas pixel 품질과 함께 검증해야 한다.
- 실제 loaded GLB evidence는 `window.__DESKTERIORONLINE_FURNITURE_GLB_LOADS__`가 mesh/material count와 bounds를 기록해 source marker가 의도만이 아니라 로드 완료 상태임을 증명해야 한다.
- `CatalogLiveModelPreview`는 replacement card live GLB overlay가 로드되면 `window.__DESKTERIORONLINE_CATALOG_LIVE_MODEL_PREVIEWS__`에 `real-glb-live-preview`, mesh/material count, fit bounds, generated provider/review state를 기록해야 한다.
- `/labs/qa/meshy-live-preview`와 `verify:meshy-live-preview`는 Meshy text-to-3D GLB를 실제 browser canvas pixel로 샘플링해 live preview가 빈 투명 canvas나 static badge가 아닌지 확인한다.
- `/labs/qa/meshy-editor-scene`과 `verify:meshy-editor-scene`은 seeded room scene을 cutaway top-view QA로 열고, Meshy decor가 `__DESKTERIORONLINE_FORCE_REAL_GLB_TOP_VIEW_QA__` 경로의 `real-glb`로 로드되며 placeholder/loading fallback이 아닌지 확인한다.
- `/labs/qa/meshy-editor-customization`과 `verify:meshy-editor-customization`은 실제 inspector replacement card로 Meshy decor를 적용한 뒤, 같은 scene asset id에서 `real-glb` source와 GLB mesh/material load가 발생하고 manual save payload에 generated product provenance가 남는지 확인한다.

Updated:
- compact diorama visual QA는 canvas density와 color contrast만 보지 않고, 화면을 채운 geometry가 실제 catalog GLB인지 renderer proxy/fallback인지, 그리고 editor 교체 후 저장 payload에도 같은 generated provenance가 남는지 구분하는 단계까지 포함한다.
- builder preview는 성능상 stylized proxy를 사용할 수 있지만, editor renderer QA에서 generated catalog asset이 placeholder로 대체되는 경우는 별도 fallback 상태로 추적해야 한다.
- builder preview visual smoke는 full style/lighting preview에서 24개 source, media-lounge preset에서 8개 source를 확인하고, 각 source가 의도된 `builder-preview-proxy`인지 검증한다.
- replacement card live preview는 작은 decor GLB도 카드 안에서 읽히도록 bounds 기반 fit scale을 적용하되, sceneDocument나 renderer scene에는 영향을 주지 않는 inspector-only path로 유지한다. Full-room editor QA는 별도 hidden route에서 sceneDocument/store를 초기화해 실제 renderer path를 검증한다.

Removed/Deprecated:
- source tree에서 placeholder/proxy/real GLB를 구분하지 못한 채 nonblank canvas만으로 generated asset fidelity를 통과시키는 방식.
- generated badge 또는 GLB file validation만으로 editor live preview 렌더 품질까지 통과했다고 보는 방식.
- full-room seeded GLB smoke만으로 사용자의 replacement/save customization 경로까지 통과했다고 보는 방식.

## 2026-05-17 변경 동기화 (PC Assembly Visual + Audio QA)
Added:
- PC assembly workbench visual QA는 close-up case interior camera, metal/glass chassis, PSU bay, motherboard, CPU socket, CPU chip, thermal paste mark, AIO pump/radiator, RAM module 2개, M.2 SSD/heatsink, GPU, UNI FAN, 전원 케이블, 케이블 타이, POST LED detail을 한 화면에서 확인해야 한다.
- 실제 조립 흐름은 38단계 sequential state로 검증한다. 패널 분리, 소켓 레버, CPU seat/retention, M.2 나사/방열판, RAM A2/B2 latch, 스탠드오프, I/O 정렬, PSU rail, ATX/EPS/GPU cable plug, thermal paste, pump/radiator/fan, tiny header, GPU latch, cable tie, panel close, boot chime, BIOS POST beep은 visual state뿐 아니라 WebAudio cue와 `window.__DESKTERIORONLINE_PC_ASSEMBLY_QA__.audioEvents` evidence를 함께 남긴다.
- PC case 선택 후 조립이 끝나면 visual QA는 full desk-room diorama로 전환되어야 한다. 완성 PC tower desk placement, monitor/keyboard/mouse, mic arm, lamp, wall shelf/books/plant, color object stack, wall LED, media console, sofa/rug, warm/cool lighting balance가 단계별로 나타나야 한다.
- Desk-room setup은 11단계 sequential state로 검증한다. desk placement, monitor stand, desk input placement, arm clamp, lamp switch, decor placement, object stack, LED chime, media drawer close, cushion thump, room light swell cue가 `audioEvents` evidence에 남아야 한다.
- CPU thermal application은 visible paste coverage와 saved payload의 `thermalPasteCoverage`로 검증한다.
- `verify:pc-assembly-workbench`는 canvas size, color bucket diversity, luminance contrast, screenshot `output/playwright/pc-assembly-workbench.png`를 evidence로 남긴다.
- Meshy Compuzone PC build kit은 단일 exploded prototype asset으로 보관할 수 있지만, 상용 조립 편집에서는 각 부품의 pivot/snap/collision을 분리해 renderer가 installed/loose 상태를 개별적으로 전환할 수 있어야 한다.
- PC assembly room preview는 Meshy-generated Compuzone build kit GLB와 pastel mascot stack GLB를 실제 scene에 로드해야 하며, 로드 실패 fallback은 procedural QA geometry로만 남겨 실제 GLB 품질 증거와 구분한다.
- PC assembly room preview는 cutaway floor/wall thickness, rounded desk/seat/shelf/media furniture, screen/lamp/LED emissive accents, warm/cool wall wash, lowered exposure를 사용해 final screenshot에서 compact room diorama로 읽혀야 한다.

Updated:
- PC 조립의 visual fidelity 기준은 일반 product card preview보다 상호작용 상태 변화가 중요하다. 각 부품은 slot 전/후 위치 차이, 체결 완료 상태, paste/cue feedback, cable management, first boot/POST 상태가 브라우저 자동 검증에서 읽혀야 한다.
- 현재 QA lab의 primitive geometry와 room diorama는 interaction contract 검증용이다. 상용 viewer/editor에서는 Meshy/Blender/CAD 기반 part GLB, desk surface placement, room shell integration이 pivot, floor contact, slot collision, material QA, accessibility audio preference를 통과해야 한다.
- Bruno-level room target은 direct asset parity가 아니라 screenshot-visible density, object grounding, readable desk PC placement, edge/corner cutaway framing, and warm/cool lighting contrast를 매 iteration에서 비교하는 기준이다.

Removed/Deprecated:
- nonblank PC case canvas만으로 assembly visual QA를 통과시키는 기준.
- RAM/CPU/써멀 조립 feedback을 렌더 상태 없이 로그나 안내 문구만으로 검증하는 방식.
- 단일 Meshy exploded kit이 있으면 개별 부품 slot/snap state machine 검증을 생략해도 된다는 기준.
- Meshy GLB가 파일로 존재하지만 final room screenshot에는 실제로 배치되지 않아도 asset-quality 목표를 충족했다고 보는 기준.

## 2026-05-17 변경 동기화 (PC Assembly Cinematic Room Pass)
Added:
- PC assembly room preview는 full-screen cinematic QA mode를 제공해 app nav/side panel 없이 cutaway room만 캡처해야 한다.
- Cinematic QA screenshot은 `output/playwright/pc-assembly-workbench-cinematic.png`에 저장하고, canvas width/height, color bucket diversity, luminance contrast를 일반 workbench screenshot과 별도로 기록한다.
- Final room preview는 Meshy-generated Compuzone PC build kit, pastel mascot stack, monitor, studio speaker, ivy planter GLB를 실제 scene에 로드해야 하며, verifier는 각 proxy GLB 파일 존재와 최소 byte size를 확인한다.
- Cinematic room framing은 nav를 완전히 덮는 z-layer, tighter isometric camera, larger room scale, warm/cool wall wash, contact shadow, cutaway wall/floor thickness를 포함해야 한다.

Updated:
- Bruno-inspired comparison은 full UI screenshot이 아니라 cinematic room screenshot을 기준으로 수행한다. 판단 항목은 frame fill, desk PC readability, generated GLB visibility, shelf/media/plant density, toy-like bevel silhouette, floor/wall grounding, warm/cool contrast다.
- Current QA lab remains prototype-quality: it validates interaction, audio, payload, and screenshot evidence, but commercial Bruno-level parity still requires per-part authored GLB, baked/lightmap or stronger post/light treatment, material polish, and human visual QA.

Removed/Deprecated:
- 상단 nav나 side panel이 포함된 화면만으로 final room composition을 검토하는 방식.
- Meshy room asset이 source tree에 존재하지만 final cinematic screenshot에 보이지 않아도 generated asset 품질 증거로 보는 방식.

## 2026-05-17 변경 동기화 (PC Assembly Cinematic Lighting/Composition Pass)
Added:
- PC assembly room preview는 staggered plank floor geometry와 floor-level fake AO planes를 사용해 desk, sofa, chair, shelf, media console이 바닥에 접지되어 보이도록 한다.
- Right wall에는 TV/shelf/media accent geometry를 추가해 reference-style dense cutaway room composition을 보강한다.
- QA room에는 Meshy keyboard, mouse, lamp, mug, charging reel cable, book stack, pixel display proxy GLB도 배치할 수 있으며 verifier는 해당 prototype GLB 존재를 확인한다.

Updated:
- PC assembly final screenshot은 deterministic R3F lighting path를 우선한다. EffectComposer/Bloom은 QA 캡처에서 하이라이트 불안정성을 만들면 사용하지 않는다.
- Highlight policy는 white PC build kit, LED strip, screen emissive가 모두 readable detail을 유지하는 수준으로 exposure와 emissive intensity를 낮추는 것을 기본값으로 한다.
- Cinematic screenshot capture는 같은 hydrated page를 full-screen layout으로 승격하는 방식이어야 하며, dev/static chunk 재진입 실패가 visual QA를 막지 않아야 한다.

Removed/Deprecated:
- 큰 단일 floor grid/tile pattern으로 wood floor fidelity를 판단하는 방식.
- 과한 Bloom으로 room polish를 대체하는 방식.

## 2026-05-17 변경 동기화 (PC Assembly Cinematic Density Pass)
Added:
- PC assembly cinematic room은 renderer-only wall/desk/sofa detail pass를 포함할 수 있다: wall panel seams, cork board, floating shelf, side acoustic panels, desk cable tray/runs, PC desk contact shadow, sofa cushion seams, throw blanket, subtle baked wall shadows.
- Cinematic capture에는 canvas 위 DOM-only vignette/color grade overlay를 사용할 수 있지만, interaction state/canvas metrics 검증은 기존 WebGL canvas 기준으로 유지한다.

Updated:
- PC tower는 final deskterior room에서 보조 decor가 아니라 주요 desk object로 읽혀야 하므로 camera/framing, chair/plant occlusion, PC contact shadow를 함께 조정해야 한다.
- Baked-style shadow는 추가 dynamic emitter가 아니라 transparent geometry/material pass로 제한해 deterministic QA screenshot을 유지한다.

Removed/Deprecated:
- 빈 rear wall과 단순 sofa block이 남아 있어도 room object count만 많으면 Bruno-inspired density가 충분하다고 보는 기준.

## 2026-05-17 변경 동기화 (PC Assembly Cinematic Shell + Camera Pass)
Added:
- PC assembly cinematic room은 final-room readability를 위해 prototype white showcase PC shell GLB를 Compuzone build-kit evidence와 함께 사용할 수 있다. 이 shell은 visual polish overlay이며 exact commercial SKU approval이 아니다.
- Wall/floor baked-style patches는 hard rectangle/plane decal 대신 radial alpha texture가 적용된 soft patch material을 사용해 edge가 보이는 사각형/원형 스티커 느낌을 줄인다.
- Camera preset은 더 측면 3/4 cutaway composition을 사용해 rear wall, right wall, floor depth, desk PC placement가 한 장의 screenshot에서 같이 읽히도록 한다.
- Living-zone rug는 woven stripe/border/fringe detail을 포함해 foreground floor가 단순 plank field로 보이지 않게 한다.

Updated:
- QA lighting은 high white directional fill보다 lower exposure, stronger colored point lights, contact shadows를 우선해 generated white PC shell이 과노출되지 않으면서 실루엣을 유지하도록 한다.
- 최신 cinematic QA는 `cinematicUniqueColorBuckets=380`, `cinematicLuminanceStdDev=73.45`를 visual evidence로 남긴다.

Removed/Deprecated:
- hard-edged wall wash plane, flat front camera, or over-bright direct light를 Bruno-level polish로 간주하는 기준.

## 2026-05-17 변경 동기화 (PC Assembly Cinematic PBR Decor + AO Pass)
Added:
- PC assembly final room can combine prototype Meshy GLBs with curated PBR decorative GLTF assets when they improve screenshot-visible detail without changing product provenance.
- Floor contact shadows should reuse soft radial alpha maps where possible so AO reads as baked room lighting rather than rectangular/circular decals.
- Cinematic camera presets may use longer-lens, higher 3/4 framing for Bruno-inspired miniature cutaway readability.

Updated:
- Decorative PBR assets are visual polish evidence only. They do not replace exact PC quote assets, part snap metadata, or commercial asset approval.
- Latest cinematic evidence after this pass is `cinematicUniqueColorBuckets=244` and `cinematicLuminanceStdDev=52.1`; the review emphasis is human-readable composition and object grounding rather than maximizing these metrics.

Removed/Deprecated:
- Keeping a GLTF asset in the scene when it visually clashes with the target style. If a high-detail model creates ghosting, scale mismatch, or style mismatch, prefer the cleaner authored primitive until a proper replacement is made.

## 2026-05-17 변경 동기화 (PC Assembly Tower Detail + Occlusion Pass)
Added:
- PC assembly final-room renderer may add a non-catalog showcase detail layer over the generated PC kit when the goal is screenshot readability: translucent glass, internal motherboard/GPU/RAM/AIO/fan cues, exterior top mesh, front IO, panel screws, and feet.
- Chair/camera/object placement should be treated as part of visual QA when a configurable desk object must remain readable. A chair that matches the room style but fully hides the PC tower fails the PC assembly evidence goal, while the broader room/furniture quality remains the higher visual priority.

Updated:
- Current cinematic evidence after this pass is `cinematicUniqueColorBuckets=248` and `cinematicLuminanceStdDev=52.16`.
- Meshy-generated/prototype GLBs should be exposed through material tone rather than buried under opaque shell primitives. Shell overlays may remain only as light silhouette aids.

Removed/Deprecated:
- Treating a loaded GLB as visually integrated when the screenshot still reads as a plain proxy box.

## 2026-05-17 변경 동기화 (Cutaway Room Architecture Pass)
Added:
- Bruno-inspired final-room scenes should include visible cutaway architecture anchors: left return wall, rear/right corner posts, top rim, baseboards, cove lights, and ceiling ribs.
- These architecture details are renderer-only polish in the QA lab and must not alter PC assembly interaction state.

Updated:
- Current cinematic evidence after this pass is `cinematicUniqueColorBuckets=258` and `cinematicLuminanceStdDev=50.29`.
- Room-shell visual QA should evaluate envelope depth and wall/floor/ceiling corner readability, not only object count or PC visibility.

Removed/Deprecated:
- A flat back-wall stage with a floor plane is not enough evidence for a Bruno-style cutaway room target.

## 2026-05-17 변경 동기화 (Open Cutaway Wall Pass)
Added:
- Cutaway architecture should prefer open framing, rails, posts, low/translucent panels, and small wall details over a dominant opaque side wall when the camera must see shelf/desk/sofa contents.

Updated:
- Current cinematic evidence after this pass is `cinematicUniqueColorBuckets=279` and `cinematicLuminanceStdDev=51.98`.
- Room envelope quality is a balance between architectural depth and object readability. Side-wall mass that hides important furniture, desk objects, or the assembled PC should be opened or broken into frame/detail elements.

Removed/Deprecated:
- Using a large side wall slab as the main proof of cutaway depth when it reduces scene readability.

## 2026-05-17 변경 동기화 (Camera + Lighting Balance Pass)
Added:
- PC assembly cinematic preview may use a higher 3/4 camera preset, slim open-wall details, and subtle postprocessing Bloom/Vignette to improve miniature cutaway readability.
- Open cutaway wall detail should be composed as framing and small display objects rather than dominant rails or opaque slabs.

Updated:
- Current cinematic evidence after this pass is `cinematicUniqueColorBuckets=397` and `cinematicLuminanceStdDev=72.38`.
- Renderer exposure for this QA route is lowered to protect white PC/case materials from full highlight clipping while preserving warm/cool LED contrast.

Removed/Deprecated:
- Treating post FX or higher contrast metrics as a substitute for authored/baked materials, exact PC part meshes, and human visual review.

## 2026-05-17 변경 동기화 (Desk PC Readability + Meshy Layer Discipline)
Added:
- PC assembly final-room rendering should prioritize readable desk/furniture composition and a clean assembled-PC silhouette over raw generated-model density. Generated Meshy build-kit output may remain as low-opacity provenance/detail evidence when direct use creates ghosting or scale noise.
- Cinematic camera composition should intentionally avoid matching room yaw one-to-one; a slight azimuth mismatch helps floor boards, walls, and desk depth read as a miniature cutaway rather than a flat stage.
- Back/right wall AO and LED strips should be toned as supporting room mood, not brighter than the furniture/decor composition.

Updated:
- Current verified evidence is `uniqueColorBuckets=306`, `luminanceStdDev=64.57`, `cinematicUniqueColorBuckets=392`, `cinematicLuminanceStdDev=64.71`.
- The final PC tower no longer uses the unrelated HYTE showcase shell as a visible case overlay. The visible case cue is the authored renderer layer, while Compuzone Meshy output is subdued to avoid white ghost artifacts.

Removed/Deprecated:
- Keeping a generated/proxy case layer visible when it introduces a large translucent box, floating part fragments, or a non-quote case silhouette.

## 2026-05-17 변경 동기화 (Solid Tower Material Balance)
Added:
- PC assembly cinematic preview may add explicit dark interior mass, tempered-glass tint, side-column volume, and subdued frame rails to keep a white PC case readable under warm/cool room lighting.
- White hardware materials should be biased toward blue-grey/off-white PBR values with higher roughness when the renderer exposure or local RGB lights cause clipping.

Updated:
- Current verified evidence is `uniqueColorBuckets=295`, `luminanceStdDev=65.11`, `cinematicUniqueColorBuckets=380`, `cinematicLuminanceStdDev=65.19`.
- The completed desk PC now uses lower local blue point light intensity and less pure-white frame/fan/RAM material response, improving glass-panel and internal-part readability in the final screenshot.

Removed/Deprecated:
- Treating high-key white case panels as acceptable when they erase the PC interior silhouette in the cinematic proof image.

## 2026-05-17 변경 동기화 (PC Configurator Metadata Boundary)
Added:
- PC scene rendering should consume part/anchor/system metadata from `pc-system` instead of hardcoding every PC rule in the R3F route.
- Attachment anchors now define the minimum snap surfaces for the current Compuzone build: AM5 socket, DIMM A2/B2, M.2 2280, PCIe x16, PSU bay, radiator rail, fan mount, and power connectors.
- Physical-fit checks are renderer-adjacent quality gates because visual placement should not imply a build is possible if GPU/radiator/PSU dimensions fail.

Updated:
- Current verified evidence is `uniqueColorBuckets=291`, `luminanceStdDev=65.13`, `cinematicUniqueColorBuckets=379`, `cinematicLuminanceStdDev=65.30`.
- Visual QA remains separate from engineering feasibility: a screenshot can look good, but the route must also expose compatibility and fit evidence for PC system work.

Removed/Deprecated:
- Treating Three.js/R3F interaction alone as enough for a PC configurator without anchor and fit metadata.

## 2026-05-17 변경 동기화 (Window + Wall Panel + Solid Table Polish)
Added:
- Bruno-inspired QA route room shells should use panel seams, window frame depth, night reflection strips, and controlled warm/cool point lights to create readable miniature-room depth without relying only on object count.
- Sofa/coffee-table decorative assets must pass screenshot review. If a GLB renders as a translucent/ghosty block in the target camera, replace it with authored stylized geometry until the source asset is fixed.

Updated:
- Current verified evidence is `uniqueColorBuckets=280`, `luminanceStdDev=65.30`, `cinematicUniqueColorBuckets=390`, `cinematicLuminanceStdDev=65.56`.
- PC tower glow should support the desk setup rather than dominate the room. Local emissive strips and point lights should be dampened when the white/glass case starts clipping.
- Visual QA remains coupled to system QA: final screenshot quality is not enough unless the same route also proves assembly completion, compatibility pass, physical-fit pass, state-machine completion, and sound-event coverage.

Removed/Deprecated:
- Keeping decorative GLBs visible solely because they are realistic/PBR-sourced when they break the stylized final-room read.

## 2026-05-17 변경 동기화 (Furniture/Decor Atmosphere Gate)
Added:
- Final-room visual QA must prioritize furniture/decor asset quality, material layering, textile/wood/detail cues, and lighting atmosphere before increasing PC visual dominance.
- Soft lighting cues should use radial floor/wall patches or baked-looking washes. Thin hard light strips on the floor are treated as artifacts unless they are clearly physical LEDs.

Updated:
- Current verified evidence is `uniqueColorBuckets=275`, `luminanceStdDev=64.66`, `cinematicUniqueColorBuckets=405`, `cinematicLuminanceStdDev=64.98`.
- Completed PC rendering should remain readable as an assembled configurable object, but local emissive/RGB intensity should be reduced when it competes with room/furniture composition.

Removed/Deprecated:
- Treating PC brightness or scale as the shortcut to Bruno-inspired room quality.

## 2026-05-17 변경 동기화 (Room Material Depth + PC De-emphasis)
Added:
- Final-room QA scenes should include subtle wall/floor material-depth layers: low-opacity corner occlusion, baseboard/ceiling trim shadows, and restrained warm/cool floor/wall wash that reads as baked atmosphere instead of visible decals.
- Desk PC rendering should be intentionally dampened when the broader room, furniture, decor, and lighting mood are the visual priority. Scale, glass opacity, RGB strips, fan emissive, and local point lights are all valid tuning levers.

Updated:
- Current verified evidence is `uniqueColorBuckets=271`, `luminanceStdDev=61.14`, `cinematicUniqueColorBuckets=401`, `cinematicLuminanceStdDev=63.61`.
- Floor plank seams should remain readable as wood construction but not dominate the miniature-room image. If seam/shadow opacity creates hard artifact bands, lower opacity before adding more decorative props.

Removed/Deprecated:
- Treating a prominent glowing PC tower as proof of deskterior quality when it competes with furniture/decor/material/light atmosphere.
- Treating high-contrast floor seam grids or visible transparent patches as acceptable baked-lighting polish.

## 2026-05-17 변경 동기화 (Furniture Microdetail + Wall Line Discipline)
Added:
- Final-room QA scenes may use renderer-authored microdetails when source GLBs are insufficient: desk wood grain, mat stitching, trays, shelf labels, small cameras/plants, media-console slats/speaker cones, sofa piping/tuft/buttons, rug fringe, and tabletop prop layering.
- Wall panel/seam lines should support material depth and scale. If they read as a visible design-grid overlay in the cinematic screenshot, lower opacity before adding more props.
- PC assembly remains an interaction/system feature inside the Deskterior scene; visual polish should first raise room/furniture/decor asset quality and atmosphere.

Updated:
- Current verified evidence is `uniqueColorBuckets=273`, `luminanceStdDev=60.99`, `cinematicUniqueColorBuckets=394`, `cinematicLuminanceStdDev=63.53`.
- The latest pass keeps PC material/light balance stable and invests additional geometry in desk/shelf/media/sofa/rug surfaces.

Removed/Deprecated:
- Treating stronger wall-grid lines as a substitute for baked/stylized wall material.
- Treating PC centrality as the target composition when the product need is deskterior customization with a directly assembled PC component.

## 2026-05-17 변경 동기화 (Curated Furniture GLB Integration)
Added:
- PC assembly final-room QA may use curated, existing GLB furniture assets as visual proof layers when they improve deskterior realism without making the PC the scene centerpiece.
- Accepted QA-layer examples for this route: desk structure GLB, textured sofa GLB, media cabinet GLB, stronger coffee-table GLB, small desk planter/tray/under-desk tray GLBs.
- Wall guide and panel lines should be treated as scale/material cues only. If they become visible UI-like grid lines in the cinematic screenshot, reduce opacity before adding more objects.

Updated:
- Current verified visual evidence is `uniqueColorBuckets=274`, `luminanceStdDev=62.00`, `cinematicUniqueColorBuckets=407`, `cinematicLuminanceStdDev=63.32`.
- Central chair and PC tower should remain readable desk objects, but visual hierarchy must favor room shell, furniture/decor asset quality, lighting atmosphere, and material depth.

Removed/Deprecated:
- Using a larger/brighter PC or high-contrast chair back as the primary proof of progress.
- Letting procedural furniture blocks remain visually dominant when a curated GLB can provide better texture, silhouette, and shadow detail.

## 2026-05-18 변경 동기화 (Room Lighting Priority + PC Subordinate)
Added:
- PC assembly final-room QA scenes should treat practical room lighting, wall/ceiling material softness, and furniture/decor composition as higher visual priorities than PC prominence.
- Existing GLTF practical-light assets such as `industrial_wall_sconce` may be used as small authored light sources when they improve room atmosphere and do not pull focus away from the deskterior scene.
- Ceiling/cove/LED strips should be dampened when they read as hard UI-like lines; use softer wall/ceiling wash and lower-opacity material overlays first.

Updated:
- Current verified visual evidence is `uniqueColorBuckets=286`, `luminanceStdDev=60.73`, `cinematicUniqueColorBuckets=388`, `cinematicLuminanceStdDev=60.94`.
- The latest pass keeps the directly assembled PC readable on the desk but shifts visual hierarchy toward wall plaster softness, practical lights, desk/furniture layers, and warm/cool room atmosphere.

Removed/Deprecated:
- Treating bright PC RGB or hard LED strips as proof of Bruno-inspired room quality.
- Letting wall/ceiling strip lines overpower furniture/decor material cues in the final cinematic screenshot.

## 2026-05-18 변경 동기화 (Open GLB QA Staging)
Added:
- Open-license GLBs may be used as QA-only visual layers before catalog publication when provenance is recorded and the source files remain outside `apps/web/public/assets`.
- The first Kenney Furniture Kit QA layer uses six low-cost GLBs for shelf, wall lamp, sofa, plant, rug, and coffee table support. These layers should reinforce room/furniture/decor quality without increasing PC prominence.
- QA-only GLB serving should be explicit and allowlisted. The current path is `/api/qa-assets/open-license/kenney-furniture-kit/[file]`.

Updated:
- Current verified evidence after Kenney staging integration is `uniqueColorBuckets=285`, `luminanceStdDev=59.66`, `cinematicUniqueColorBuckets=396`, `cinematicLuminanceStdDev=60.79`.
- Low-poly CC0 assets are acceptable as silhouette/material-support layers only. They are not automatically Bruno-level final assets.
- Source-stage assets require human screenshot review plus Blender/glTF inspection before any runtime package or public catalog promotion.

Removed/Deprecated:
- Copying newly acquired open-license GLBs directly into the public runtime catalog without provenance, QA audit, pivot/material review, and package metadata.
- Using open-source asset count as a proxy for visual quality. If an imported GLB introduces ghosting, bad scale, wrong style, or noisy silhouette, remove or demote it even when the license is clean.

## 2026-05-18 변경 동기화 (Meshy Community GLB QA Layer)
Added:
- Meshy community published models can be used as QA-only visual layers when public metadata reports `license=cc0`, the downloaded file is a real GLB (`glTF` magic), and provenance is recorded.
- The first Meshy community QA layer adds brick wall accent, golden arch rack, rustic side table, and accent chair to the PC assembly final-room composition.
- Meshy community files must be served through an explicit allowlisted QA route, currently `/api/qa-assets/meshy-community/[file]`, and stay outside `apps/web/public/assets`.
- The Meshy community route, workbench placement, and verifier must read from `apps/web/src/lib/qa/meshy-community-assets.ts`; do not reintroduce separate hardcoded file lists.
- `assets/references/meshy-community/qa-registry-2026-05-18.json` is the visual QA registry for per-asset usage, route URL, and promotion blockers.

Updated:
- Current verified evidence after Meshy community staging is `uniqueColorBuckets=314`, `luminanceStdDev=59.16`, `cinematicUniqueColorBuckets=415`, `cinematicLuminanceStdDev=60.11`.
- Visual acceptance is screenshot-based: imported Meshy assets should improve room/furniture/decor density and atmosphere without making the PC tower the centerpiece or introducing incorrect scale.
- Meshy `.meshy` viewer binaries are not runtime GLB assets; use the public task `model.glb` URL or an authenticated Meshy export path.

Removed/Deprecated:
- Treating Meshy-generated or Meshy-community asset provenance as equivalent to visual quality.
- Using Meshy community assets in the release catalog before pivot/material normalization, optimization, LOD/proxy planning, and human art QA.

## 2026-05-19 변경 동기화 (Meshy Community Runtime Candidate QA)
Added:
- Meshy community QA GLBs have a Blender-normalized runtime-candidate lane with floor-contact pivot, deterministic object/material names, review thumbnails, and `single_mesh` sidecar metadata.
- `verify:meshy-community-assets` checks that optimized GLBs include `EXT_meshopt_compression` and that sidecar provenance matches the shared TS registry.
- Review contact sheet output for this pass: `output/meshy-community/runtime-candidates-contact-sheet.webp`.

Updated:
- Runtime-candidate status is still below catalog publication. A candidate can be loaded in QA only after style/scale/material response is accepted in final scene screenshots.
- `colorful-brick-wall` keeps a triangle-budget warning and should be treated as an accent candidate, not a general wall material system.
- KTX2 texture readiness is explicitly false until a separate texture transcode and visual review pass.

Removed/Deprecated:
- Using raw source GLBs as if their origin, floor contact, and material names are already stable.
- Counting generated thumbnails or Meshopt compression alone as Bruno-inspired visual parity.

## 2026-05-19 변경 동기화 (Blender Authored Room Detail Kit Visual Gate)
Added:
- Project-authored GLB assets can enter hidden QA when they include a Blender generation script, runtime candidate GLB, thumbnail, review JSON, and verifier assertions. The first candidate is `p2s_bruno_room_detail_kit`.
- The current authored kit uses bevelled geometry and multiple material classes for pegboard, shelves, books, planter, wall art, RGB strips, and cable details. It is intended to increase wall/decor density without making the PC tower the scene centerpiece.
- PC assembly cinematic QA must verify both source artifact quality and visual scene response: GLB size, object count, material count, triangle budget, known promotion gaps, color bucket diversity, luminance variance, and screenshot output.

Updated:
- Latest cinematic evidence after authored-kit integration and reframe is `uniqueColorBuckets=332`, `luminanceStdDev=67.14`, `cinematicUniqueColorBuckets=417`, `cinematicLuminanceStdDev=64.73`.
- Scene lighting should preserve practical warm/cool contrast while avoiding overbright bloom patches. For this pass, cinematic exposure and bloom were reduced after screenshot review.
- Meshy/open-source GLBs and project-authored GLBs are separate quality lanes. Open/community assets prove acquisition and staging; authored assets prove controllable style direction. Neither lane skips human visual QA.

Removed/Deprecated:
- Treating a decorative wall pattern or high color variance as equivalent to Bruno Simon-level room composition.
- Promoting a Blender-authored procedural candidate before baked lighting/texture, LOD, material normalization, and commercial-reference comparison.

## 2026-05-19 변경 동기화 (Large Surface Texture Layer)
Added:
- Hidden QA scenes can use authored GLB surface kits to replace flat renderer-only room shell perception when the asset includes source `.blend`, embedded texture atlases, thumbnail, review report, and verifier coverage.
- `p2s_bruno_room_surface_kit` is the current surface candidate: 116 objects, 11 materials, 5 generated embedded textures, 12,104 triangles, and ~4.1 MB GLB.
- Surface kits should be loaded as a room-shell material/depth layer before wall decor, furniture, and PC setup objects.

Updated:
- Internal browser visual QA is required for surface kits because coordinate/sign errors can pass file-level GLB checks while visually blocking the cutaway camera. This pass caught and fixed a front-wall occlusion caused by Blender `export_yup` depth inversion.
- Latest visual evidence after the surface kit pass is `uniqueColorBuckets=337`, `luminanceStdDev=67.79`, `cinematicUniqueColorBuckets=416`, `cinematicLuminanceStdDev=65.35`.
- Wall reveal/seam lines must stay subtle. If they read as a UI grid or tile wall, lower opacity or remove them before adding more props.

Removed/Deprecated:
- Full opaque ceiling overlays in the Bruno-inspired cutaway room QA path. They block the inspection angle and reduce the room-diorama read.
- Counting texture atlas presence alone as commercial readiness; atlas presence is a QA candidate signal, not a release gate.

## 2026-05-19 변경 동기화 (Large Furniture GLB Visual Gate)
Added:
- Bruno-inspired final-room QA now includes an authored furniture hero kit with large silhouettes, embedded diffuse atlases, bevelled furniture forms, decor clusters, and room-scale placement.
- Visual QA for this lane must inspect the latest `output/playwright/pc-assembly-workbench-cinematic.png` after automated workbench completion, not only the standalone Blender thumbnail.

Updated:
- Latest cinematic evidence after the furniture pass is `cinematicUniqueColorBuckets=398` and `cinematicLuminanceStdDev=62.26`.
- Authored GLB lights and runtime bloom should be subdued enough that wall/furniture/decor material response remains the primary read. Bright spots that flatten the wall or wash out shelves are follow-up art defects even if automated metrics pass.
- Furniture and room atmosphere remain higher priority than making the assembled PC tower larger or brighter. PC assembly fidelity supports deskterior; it is not the scene's visual center.

Removed/Deprecated:
- Treating high object count or GLB byte size as proof of Bruno-level visual parity.
- Allowing QA-only furniture candidates with diffuse-only texture atlases to skip commercial comparison, baked AO/normal/roughness review, or transparent-depth inspection.

## 2026-05-19 변경 동기화 (Furniture PBR Helper Map Gate)
Added:
- Furniture hero kit QA candidates must report explicit material-map roles before promotion review: `baseColor`, `normal`, `roughness`, and `ambientOcclusion`.
- Furniture asset review JSON must include a commercial benchmark rubric covering PBR response, bevel/silhouette, room-scale composition, runtime optimization, lighting/bake parity, and license/provenance.
- Final-room visual QA must include a transparent-depth inspection pass. High-opacity GLB furniture should render as opaque unless it is intentionally a ghost/provenance layer.

Updated:
- Current furniture hero kit evidence is `18 embedded textures` from 16 generated PBR helper maps plus runtime thumbnail support, with `ktx2Ready=false` until a separate texture packaging pass exists.
- The latest cinematic cleanup lowers desk-lamp glare, point-light intensity, bloom, low-poly staging opacity, and camera distance. Verified visual metrics are `cinematicUniqueColorBuckets=381` and `cinematicLuminanceStdDev=62.81`.
- Khronos glTF PBR reference behavior should guide future material gates: base color, occlusion, normal, roughness, metallic, emissive, alpha, and related extensions are separate material concerns, not a single “texture exists” checkbox.

Removed/Deprecated:
- Treating diffuse atlas count as equivalent to material depth.
- Keeping imported support GLBs semi-transparent by default when they are supposed to read as solid furniture.
- Using a bright practical light or bloom flare to hide weak furniture topology.

## 2026-05-19 변경 동기화 (Benchmark Board + Foreground Furniture Gate)
Added:
- Bruno-inspired visual progress now requires a local benchmark board when claiming asset-quality improvement. Current board: `output/visual-qa/bruno-room-asset-benchmark-contact-sheet.png`.
- Benchmark ledger: `assets/references/blender-authored/bruno-furniture-hero-kit/benchmark-ledger-2026-05-19.json`.
- The visual gate must rank remaining blockers, not only record screenshots. Current top blockers are foreground furniture silhouette, lighting bake/glare, surface material depth, runtime asset packaging, and reference-driven iteration evidence.

Updated:
- Furniture hero kit foreground topology was improved from 158 to 193 authored objects while staying under the 65k QA triangle budget (`42,956` triangles).
- The latest browser screenshot pass still reads as QA candidate, not commercial final: `cinematicUniqueColorBuckets=380`, `cinematicLuminanceStdDev=62.74`.
- Contact sheets may use locally authored, open/community, or properly licensed references. Unlicensed commercial imagery must not be embedded in repo evidence.

Removed/Deprecated:
- Using a single final screenshot as the only proof of Bruno-level asset progress.
- Calling a topology pass complete without a ledger that names what still blocks commercial quality.

## 2026-05-19 변경 동기화 (Cinematic Glare/Contact QA)
Added:
- PC assembly cinematic room now has a named `room-cinematic-contact-occlusion-pass` layer for renderer-authored grounding evidence.
- Cinematic canvas QA must track highlight washout with `brightPixelRatio` and practical-light clipping with `clippedHighlightRatio`, in addition to color bucket and luminance variance.
- The Bruno benchmark contact sheet should surface these highlight metrics in the current-room panel so human review can distinguish controlled atmosphere from overexposed glare.

Updated:
- Current verified visual evidence is `cinematicUniqueColorBuckets=375`, `cinematicLuminanceStdDev=62.52`, `cinematicBrightPixelRatio=0.033`, and `cinematicClippedHighlightRatio=0.019`.
- Runtime contact occlusion can be used as QA polish evidence, but it remains weaker than true baked AO/lightmap authored in Blender.
- Bloom/exposure/practical lights should be tuned conservatively; retaining material readability and furniture grounding is more important than making the room look bright.

Removed/Deprecated:
- Treating post-FX glare as a substitute for authored bounce, baked shadows, or material depth.
- Passing final-room lighting QA without measuring whether broad highlights or clipped practical lights are washing out the scene.

## 2026-05-19 변경 동기화 (Foreground Furniture Detail Second Pass)
Added:
- The furniture hero kit foreground lounge pass now includes more screenshot-readable sofa and coffee-table detail: cushion creases, dimples, quilted seams, arm welt piping, floor glides, glass/tray inlay, crossbars, foot levelers, lower slats, remote/controller controls, and mug surface detail.

Updated:
- Current authored furniture evidence is `249 objects`, `18 embedded textures`, `53,940 triangles`, and `11,234,844 bytes`.
- Latest verified cinematic evidence is `cinematicUniqueColorBuckets=376`, `cinematicLuminanceStdDev=62.36`, `cinematicBrightPixelRatio=0.032`, and `cinematicClippedHighlightRatio=0.019`.
- The visual judgment remains prototype-only. More small geometry improves readability, but the foreground sofa/coffee table still needs bespoke curved topology before commercial-quality claims.

Removed/Deprecated:
- Treating object-count growth as equivalent to commercial furniture topology.
- Leaving benchmark ledger text pinned to older asset metrics after a Blender regeneration pass.

## 2026-05-19 변경 동기화 (Surface PBR Helper + Authored Contact Lightmap)
Added:
- Large surface QA candidates must distinguish renderer overlays from asset-authored shading evidence. The current `p2s_bruno_room_surface_kit` now carries `baseColor`, `normal`, `roughness`, `ambientOcclusion`, and `contactShadowLightmap` roles in its review JSON.
- Surface contact shadows are tracked by zone metadata: 7 floor zones and 4 wall zones. This lets QA prove the GLB package contains authored contact-shadow evidence instead of relying only on `RoomCinematicContactOcclusionPass`.
- `verify:pc-assembly-workbench` must assert the new surface texture roles, generated map count, KTX2 readiness flag, and contact-shadow zone counts.

Updated:
- Current surface candidate evidence is `123 objects`, `11 materials`, `15 textures`, `12,118 triangles`, and `9.12 MB`.
- Current cinematic canvas evidence is `cinematicUniqueColorBuckets=375`, `cinematicLuminanceStdDev=62.42`, `cinematicBrightPixelRatio=0.033`, and `cinematicClippedHighlightRatio=0.019`.
- The lighting/bake gate remains `partial`: authored contact-shadow cards exist, but this is not path-traced global illumination and should not be treated as Bruno-level completion.

Removed/Deprecated:
- Calling a surface kit commercial-ready because it has diffuse atlases and soft transparent cards.
- Collapsing normal, roughness, AO, and contact-shadow needs into a single “texture exists” checkbox.

## 2026-05-19 변경 동기화 (Foreground Curved Mesh Review Gate)
Added:
- Large foreground lounge furniture may use local rounded perimeter mesh generation for QA candidates, but the generated mesh family must be recorded in review JSON before it is counted as topology progress.
- Sofa/coffee-table visual review must inspect both standalone thumbnail and integrated final-room screenshot because a curved mesh can still read flat if camera, wall grid, or lighting overwhelms it.
- Current foreground curvature evidence includes `rounded_rect_slab`, `vertical_tapered_cylinder`, `soft_lip_ellipsoid`, and `under_shadow_curve` mesh families.

Updated:
- Furniture hero kit now reports `252 objects`, `18 textures`, and `54,822 triangles`; this stays inside the 65k QA budget.
- The latest integrated cinematic screenshot metrics are `cinematicUniqueColorBuckets=375`, `cinematicLuminanceStdDev=62.45`, `bright=0.033`, `clipped=0.019`.
- The next visual blocker is no longer only sofa/table primitive detail. The room now needs wall grid/reveal cleanup, real baked/art-directed GI/AO material response, and runtime package readiness before any Bruno-level claim.

Removed/Deprecated:
- Treating a beveled cube plus seam decals as equivalent to a bespoke curved furniture silhouette.
- Evaluating furniture topology only from the Blender thumbnail while ignoring the final camera crop and room lighting.

## 2026-05-19 변경 동기화 (Wall Reveal Cleanup + Floor Line Discipline)
Added:
- Surface review JSON may include `asset.wallRevealCleanupPass` when the GLB deliberately reduces hard wall guide/reveal lines and adds broad wall material wash cards.
- `verify:pc-assembly-workbench` must assert wall reveal cleanup metadata before counting the pass as surface-depth progress: `lineOpacityAfter <= 0.1`, at least 4 `softWashZones`, `gridOverlayRisk=reduced-not-eliminated`, and `stillRequiresBrowserHumanReview=true`.
- Runtime cinematic room visual QA should treat floor seam, ceiling rib, and cove strip opacity as material scale cues, not hard UI-like grid proof.

Updated:
- Current surface candidate evidence is `127 objects`, `12 materials`, `16 textures`, `12,126 triangles`, and `10.55 MB`.
- Current wall reveal cleanup evidence is `lineOpacityBefore=0.34`, `lineOpacityAfter=0.085`, and 4 soft wall-wash zones.
- Latest verified cinematic evidence is `cinematicUniqueColorBuckets=379`, `cinematicLuminanceStdDev=62.37`, `cinematicBrightPixelRatio=0.033`, and `cinematicClippedHighlightRatio=0.019`.
- Codex internal browser review at `/labs/qa/pc-assembly-workbench?qaNoLoader=1&qaComplete=1&qaCinematic=1` confirmed the final room renders at `1280x720`; the scene is improved but still not Bruno-level commercial-ready.

Removed/Deprecated:
- Treating stronger floor seams, ceiling ribs, cove strips, or wall reveal lines as substitutes for baked material depth.
- Claiming wall-grid cleanup complete without both GLB metadata and a real browser screenshot pass.

## 2026-05-19 변경 동기화 (Art-Directed Surface Bounce Evidence)
Added:
- Surface-kit lighting evidence may now include `asset.artDirectedGiPass` when the GLB carries hand-authored colored bounce and low-occlusion lightmap cards.
- `verify:pc-assembly-workbench` must assert at least 5 floor bounce zones and 4 wall bounce zones, and must also assert `physicallyBaked=false`, `runtimeOverlayReplacement=false`, and `stillRequiresPathTracedBake=true`.
- `artDirectedBounceLightmap` is an explicit texture role in `asset.textureSet.authoredMaps`; it is separate from `contactShadowLightmap` and wall reveal cleanup.

Updated:
- Current surface candidate evidence is `136 objects`, `13 materials`, `17 textures`, `12,144 triangles`, and `11.88 MB`.
- Current bounce evidence records 5 floor zones and 4 wall zones for desk screen glow, PC edge fill, sofa fill, coffee-table occlusion, media pink spill, shelf occlusion, window-side cool falloff, and media wall bounce.
- Latest automated cinematic evidence is `cinematicUniqueColorBuckets=378`, `cinematicLuminanceStdDev=62.31`, `cinematicBrightPixelRatio=0.033`, and `cinematicClippedHighlightRatio=0.019`.
- Codex internal browser review saved `output/playwright/pc-assembly-workbench-codex-browser.png` and confirmed the route renders a `1280x720` WebGL canvas, but the room still reads as QA candidate rather than commercial final.

Removed/Deprecated:
- Describing hand-authored transparent bounce cards as a true physically baked global-illumination pass.
- Treating added bounce-zone metadata as a substitute for UV-authored ORM/KTX2 packaging, path-traced bake validation, or human art review.

## 2026-05-19 변경 동기화 (Cycles AO Bake Probe Evidence)
Added:
- Surface-kit review reports may include `asset.cyclesAoBakePass` only when Blender actually runs a Cycles bake and records engine, bake type, sample count, receiver surfaces, blocker proxies, and whether path-traced GI remains missing.
- The current minimum Cycles AO evidence is `engine=CYCLES`, `bakeType=AO`, `samples>=32`, `physicallyBakedAo=true`, at least 6 blocker proxies, and explicit `pathTracedGi=false`.
- `cyclesAoBakeLightmap` is a separate `textureSet.authoredMaps` role. It complements `contactShadowLightmap` and `artDirectedBounceLightmap`; it does not replace either.

Updated:
- Current surface candidate evidence is `137 objects`, `14 materials`, `18 textures`, `12,146 triangles`, and `12.09 MB`.
- The latest automated cinematic evidence is `cinematicUniqueColorBuckets=378`, `cinematicLuminanceStdDev=62.37`, `cinematicBrightPixelRatio=0.033`, and `cinematicClippedHighlightRatio=0.019`.
- Codex internal browser review saved `output/playwright/pc-assembly-workbench-codex-browser.png`; the in-app browser verified a visible final room render, while the benchmark ledger still marks the room `not-commercial-ready`.

Removed/Deprecated:
- Treating a floor-only AO probe card as final path-traced room GI.
- Claiming Bruno-level commercial quality before the AO/GI bake is promoted from probe projection into final UV-authored atlases with KTX2/ORM packaging and human visual approval.

## 2026-05-19 변경 동기화 (Packed ORM Sidecar Evidence)
Added:
- Surface kit material packaging evidence may now include packed ORM PNG sidecars when `asset.texturePackagingPass` records channel semantics and file paths.
- The current packed ORM contract is `R=ambientOcclusion`, `G=roughness`, `B=metallic`, and `A=constantOne`, with sidecar images authored in Non-Color space.
- Runtime QA must keep the KTX2 state explicit: `packageStatus=orm-png-sidecar-ready-ktx2-pending`, `ktx2Ready=false`, and `stillRequiresRuntimeKtx2Transcode=true` until a real transcode path exists.

Updated:
- Current surface candidate evidence is `137 objects`, `14 materials`, `21 textures`, `12,146 triangles`, and `12.09 MB`.
- The latest material map roles are `baseColor`, `normal`, `roughness`, `ambientOcclusion`, `contactShadowLightmap`, `artDirectedBounceLightmap`, `cyclesAoBakeLightmap`, and `packedOrm`.
- The latest verified cinematic evidence remains `cinematicUniqueColorBuckets=378`, `cinematicLuminanceStdDev=62.37`, `cinematicBrightPixelRatio=0.033`, and `cinematicClippedHighlightRatio=0.019`.

Removed/Deprecated:
- Collapsing “ORM sidecar exists” and “KTX2 runtime-ready package exists” into one checkbox.
- Treating procedural PNG sidecars as final UV-authored material bakes.

## 2026-05-19 변경 동기화 (Runtime Sidecar + Capture Clarity Contract)
Added:
- Bruno room surface kit runtime packages may now expose a `texturePackages` array for packed ORM sidecars. This is a runtime-visible material-package signal, not a release-ready texture state.
- The packed ORM runtime contract remains `R=ambientOcclusion`, `G=roughness`, `B=metallic`, `A=constantOne`; each public map must keep `ktx2Path=null` until a real transcode exists.
- Cinematic QA capture may use higher DPR and MSAA as a clarity pass when clipped-highlight ratio stays below the verifier threshold.

Updated:
- Current runtime-visible sidecar package is `p2s_bruno_room_surface_kit` with `status=orm-png-sidecar-ready-ktx2-pending`, `ktx2Ready=false`, `toktxAvailable=false`, and `releaseEligible=false`.
- Current cinematic render evidence after the clarity pass is `cinematicUniqueColorBuckets=380`, `cinematicLuminanceStdDev=64.47`, `cinematicBrightPixelRatio=0.048`, and `cinematicClippedHighlightRatio=0.021`.
- The browser screenshot evidence remains `output/playwright/pc-assembly-workbench-codex-browser.png`; this is visual QA evidence and not a commercial art approval.

Removed/Deprecated:
- Treating source-side PNG sidecars as sufficient when runtime catalog/package metadata does not reference them.
- Lowering bloom threshold to hide weak materials. The verifier keeps a high threshold so clarity must come from assets, material response, lighting, DPR, MSAA, and real bakes.
- Claiming Bruno-level parity from screenshot metrics alone.

## 2026-05-19 변경 동기화 (Bruno Surface ORM KTX2 Runtime Contract)
Added:
- Bruno surface packed ORM packages may be promoted from `orm-png-sidecar-ready-ktx2-pending` to `ktx2-ready` only when every public ORM map has a sibling `.ktx2` file and the check script reports `up-to-date`.
- The Bruno surface ORM encoder supports `basisu` in addition to `ktx`/`toktx`, using linear transfer, mipmaps, and UASTC KTX2 output for Non-Color ORM data.
- Runtime QA must validate the `.ktx2` paths in descriptor, public manifest, and runtime index together; descriptor flags cannot be updated by hand without files.

Updated:
- Current runtime-visible surface package is `p2s_bruno_room_surface_kit` with `status=ktx2-ready`, `ktx2Ready=true`, and `stillRequiresRuntimeKtx2Transcode=false`.
- `basisu -validate` confirms the three sidecars are KTX2, LINEAR transfer, ZSTANDARD supercompressed UASTC, and mipmapped.
- This KTX2 pass improves delivery readiness only. The visual benchmark remains `not-commercial-ready` because material depth, UV-authored bake, GI, topology, and art direction are still incomplete.

Removed/Deprecated:
- Requiring `toktx` specifically when `basisu` can produce valid KTX2 sidecars for this QA package.
- Marking KTX2 readiness from source review JSON alone; readiness now depends on public sidecar existence and freshness.

## 2026-05-19 변경 동기화 (Bruno Surface Runtime Material Binding)
Added:
- Bruno surface KTX2 readiness now requires browser-visible material binding, not only sidecar file validation. The QA route must fetch the texture-package manifest, request `.ktx2` sidecars, and bind them to `aoMap`, `roughnessMap`, and `metalnessMap` on the cloned GLB materials.
- GLB source assets that use AO/lightmap-style material packages must carry glTF `TEXCOORD_1`; in Three.js this is read as `geometry.attributes.uv1`. Runtime `uv` copy is a fallback and must be counted separately.
- The PC assembly visual verifier must report the consumed ORM roles, enhanced material names, source second-UV mesh count, and runtime UV fallback count.

Updated:
- Current Bruno surface runtime evidence is `roles=floorWoodOrm,plasterWallOrm,trimOrm`, `enhanced=4`, `secondUvReady=89`, and `runtimeUvFallback=0`.
- The runtime material pass improves floor/wall/trim response but does not replace final UV-authored lightmaps, true GI, or asset topology work.

Removed/Deprecated:
- Claiming a surface package is visually integrated because `.ktx2` files exist in public assets.
- Accepting hidden UV fallback as source asset quality evidence.

## 2026-05-19 변경 동기화 (Authored Furniture Foreground Control)
Added:
- Bruno-inspired PC assembly cinematic capture must prefer the Blender-authored furniture hero kit for the lounge foreground when that kit is visible.
- Legacy procedural lounge geometry is now a fallback path only. In authored-hero mode, it may provide small accents but must not draw the main sofa/table masses over the GLB.
- Furniture hero GLB review now tracks expanded rounded topology across sofa base, seat cushions, back panels, pillows, throw panel, rolled arms, coffee-table top, tray lips, aprons, lower shelf, and tapered legs.

Updated:
- Current furniture hero GLB evidence is `56,408 triangles`, under the `65,000` QA budget, after expanding curved foreground topology.
- Latest cinematic screenshot evidence is `2000x1325`, `uniqueColorBuckets=368`, `luminanceStdDev=64.38`, `brightPixelRatio=0.047`, and `clippedHighlightRatio=0.021`.
- Codex internal browser was used to open the completed cinematic QA route. Its narrow viewport confirms route/render availability, while the production Playwright screenshot remains the visual-comparison artifact.

Removed/Deprecated:
- Treating runtime block overlays as acceptable foreground furniture once a purpose-authored GLB exists.
- Using screenshot metrics alone as Bruno-level approval. Human visual review still identifies overbright lighting, insufficient baked depth, and non-commercial furniture/material finish.

## 2026-05-19 변경 동기화 (Cinematic Exposure Control)
Added:
- The PC assembly cinematic route now keeps final-room lighting in a named `cinematicRoomLightingProfile` so broad fill, warm/cool wall wash, spotlights, practicals, and vignette strength can be reviewed as one visual policy.
- Cinematic capture uses `toneMappingExposure=0.42`, tighter camera/fog, and lower broad ambient/directional energy to preserve material contrast and reduce clipped wall/practical highlights.
- Visual QA must preserve stricter exposure evidence: cinematic `brightPixelRatio <= 0.12` and `clippedHighlightRatio <= 0.055`.

Updated:
- Latest automated cinematic evidence is `2000x1325`, `uniqueColorBuckets=345`, `luminanceStdDev=58.28`, `brightPixelRatio=0.028`, and `clippedHighlightRatio=0.013`.
- The current screenshot is visually less washed out than the previous high-key pass, but still not a commercial art approval.

Removed/Deprecated:
- Increasing bloom or global exposure to make weak material work look richer.
- Claiming Bruno-level lighting from metrics alone without final baked GI/AO, UV-authored material atlases, and human comparison review.

## 2026-05-19 변경 동기화 (Furniture Continuous Surface Quality Rule)
Added:
- Foreground furniture quality passes should prefer continuous authored surfaces over many small primitive detail objects when an asset is already near its triangle budget.
- The current sofa rule is: visible upholstery masses should be shaped by UV-bearing mesh surfaces with crown/depression/seam geometry, then supplemented by a small number of welt/button details.
- Furniture asset review metrics must record triangle budget and pass/fail status, not only raw triangle count.

Updated:
- Current furniture hero evidence after this pass is `292 objects`, `63,714 triangles`, `triangleBudget=65,000`, and `triangleBudgetStatus=pass`.
- Runtime material evidence now reports `brunoFurnitureOrmConsumed=true`, four furniture ORM roles consumed, and `brunoFurnitureAoUv2ReadyMeshCount=119`.
- The visual benchmark remains `not-commercial-ready`; continuous sofa surfaces reduce block-read but do not replace final UV-authored material bakes, true GI, or commercial source asset quality.

Removed/Deprecated:
- Using many bevelled cube/sphere seam pieces to fake upholstery quality when the same budget should be spent on the main silhouette surface.
- Treating runtime KTX2 ORM binding as proof of production-grade furniture materials.

## 2026-05-19 변경 동기화 (Foreground Upholstery Rear Quality Rule)
Added:
- Large foreground upholstery rear faces must be continuous authored shell geometry, not grid-like primitive overlays, when they are visible in the final cinematic room.
- The furniture review contract should include mesh-family evidence for rear upholstery shells, including `soft_rear_upholstery_shell`, primary rear shell mesh names, welts, skirts, and fold details.
- Furniture KTX2 review metadata must reflect the actual runtime package state after encoding: `packageStatus=ktx2-ready`, `ktx2Ready=true`, and `stillRequiresRuntimeKtx2Transcode=false` when all public sidecars exist.

Updated:
- Current furniture hero evidence after this pass is `282 objects`, `63,896 triangles`, `triangleBudget=65,000`, `triangleBudgetStatus=pass`, and four runtime-bound furniture ORM roles.
- Automated cinematic QA currently reports `cinematicUniqueColorBuckets=309`, `cinematicLuminanceStdDev=67.34`, `bright=0.043`, and `clipped=0.027`.
- The visual benchmark remains `not-commercial-ready`; the continuous rear shell removes one visible primitive artifact but does not replace commercial source asset acquisition, final bake work, or human art approval.

Removed/Deprecated:
- Building prominent sofa backs from many separate bevelled cubes/spheres that read as cabinetry or a drawer grid.
- Allowing source review JSON to become stale after a successful runtime KTX2 encode.

## 2026-05-20 변경 동기화 (Standalone Foreground Sofa Asset Rule)
Added:
- Final cinematic view에서 크게 보이는 foreground furniture는 monolithic room/furniture kit 안에서만 수정하지 않고, 필요한 경우 독립 GLB asset으로 분리해 반복 개선할 수 있어야 한다.
- 현재 foreground sofa는 `apps/web/public/assets/models/p2s_premium_dark_sofa/p2s_premium_dark_sofa.glb` 독립 asset과 `assets/blender/deskterior/p2s_premium_dark_sofa.blend` source를 가진다.
- 독립 sofa asset이 활성화될 때 monolithic furniture hero kit의 겹치는 `hero_sofa_*` mesh는 runtime에서 숨겨야 한다.

Updated:
- 현재 standalone sofa evidence는 `33 nodes`, `33 meshes`, `6 materials`, `23,436 triangles`, public GLB 약 `1.0M`이다.
- 최신 시각 검토 artifact는 `output/playwright/pc-assembly-workbench-sofa-glb-asset.png`다.

Removed/Deprecated:
- 큰 foreground upholstery asset을 React block overlay만으로 최종 품질 개선했다고 판단하는 방식.
- final UV fabric atlas, baked AO/GI/lightmap, LOD/collider/proxy package, human art review 없이 generated GLB를 상용급으로 승인하는 방식.

## 2026-05-20 변경 동기화 (Standalone Workstation Asset Gate)
Added:
- Completed desk setup quality passes may use a standalone authored GLB for the full workstation cluster only after standalone visual review passes.
- Current failed workstation candidate path is `apps/web/public/assets/models/p2s_premium_workstation_hero/p2s_premium_workstation_hero.glb` with source `.blend` at `assets/blender/deskterior/p2s_premium_workstation_hero.blend`.
- Workstation promotion now requires a documented generation loop: external reference set, side-by-side visual comparison, failure diagnosis, regeneration constraints, and a fresh standalone preview before scene activation.
- If a future standalone workstation is active, overlapping monolithic `hero_desk_*` meshes and completed-state desk primitives should be suppressed.

Updated:
- Current exported workstation metrics are `157 nodes`, `157 meshes`, `29 materials`, `1 texture`, `55,076 triangles`, and `2.7M` GLB bytes.
- The metrics are insufficient for visual approval. The current candidate failed because its forms read as primitive/blockout-level, has only one texture, lacks baked AO/GI/lightmaps, and was promoted before reference comparison.
- Current failed visual artifact is `output/playwright/pc-assembly-workbench-workstation-hero.png`.

Removed/Deprecated:
- Approving completed desk quality from a mixed pile of proxy GLBs and runtime blocks.
- Claiming commercial readiness before final UV atlases, material baking, LOD/proxy/collider package, reference comparison, and human art review are complete.
- Treating build/QA pass, node count, material count, or triangle count as a substitute for visual comparison.

## 2026-05-20 변경 동기화 (Workstation Iteration Review Gate)
Added:
- Workstation candidates must keep versioned standalone preview artifacts so visual regressions can be compared directly across iterations.
- Current review boards are `assets/references/blender-authored/premium-workstation-hero/workstation-v2-review-board.png` and `assets/references/blender-authored/premium-workstation-hero/workstation-v3-review-board.png`.
- Large visible material planes must be checked for fallback-like magenta or unintended emissive domination before any scene integration.

Updated:
- V2 failed the visual gate despite higher detail density because the PC front, desk mat, and screens were over-saturated and read like fallback material.
- V3 reduces that failure mode; isometric magenta-pixel ratio moved from `0.0733` to `0.0`, but V3 remains review-only because it is still procedural and lacks authored UV/PBR/bake quality.

Removed/Deprecated:
- Approving an asset iteration merely because it fixes an object-count/detail-density issue while introducing a stronger color/material regression.

## 2026-05-20 변경 동기화 (Workstation V5 UVAtlas Sampling Gate)
Added:
- `workstation-v4-review-board.png` and `workstation-v5-review-board.png` are now part of the workstation visual regression evidence set.
- Workstation material review must confirm that any generated atlas is sampled through the intended UV channel, not just that a UV layer exists.
- V5 review JSON path: `assets/references/blender-authored/premium-workstation-hero/asset-review-v5-2026-05-20.json`.

Updated:
- V4 added basecolor/ORM atlas artifacts, LightmapUV2, contact AO decals, and richer PC internals, but failed visually because the shared material did not explicitly bind to `UVAtlas`.
- V5 fixes that defect by using a shader UV Map node bound to `UVAtlas` and by marking `UVAtlas` active on `212` assigned meshes.
- V5 standalone evidence is `116,580` triangles, `4` texture images, `6.0M` GLB bytes, `212` active UVAtlas meshes, `212` LightmapUV2 meshes, `0` missing external images, and `0` unmaterialed objects.

Removed/Deprecated:
- Treating generated atlas/PBR artifacts as sufficient when the rendered preview shows atlas bleeding, unintended patchwork, or UV-channel mismatch.
- Promoting V4 or V5 into the live room before human visual approval and LOD/proxy/collider/support packaging are complete.

## 2026-05-20 변경 동기화 (Workstation Desktop Detail Visual Gate)
Added:
- Workstation detail passes must compare tabletop and desktop-object close-up renders before scene promotion. Current evidence board: `assets/references/blender-authored/premium-workstation-hero/workstation-v8-review-board.png`.
- Tabletop material detail must avoid UI-like cross-grid or high-contrast seam overlays. Longitudinal plank seams are acceptable only when low contrast and subordinate to the object silhouettes.
- Product-scale desktop detail should be concentrated on visible interaction surfaces: keyboard legends/fasteners, mouse seam/skates/logo, monitor screen layers, speaker grille/ports, PC case vents/IO/glass screws, desk cable grommet, notebook lines, plant veins, mug rim.
- Re-open audit for workstation candidates must confirm no unmaterialed objects and no missing external images before the candidate is used as visual evidence.

Updated:
- V8 is the current strongest standalone workstation candidate with `160,500` triangles, `710` meshes, `4` texture images, `290` marked detail objects, and `0` missing external images.
- V8 preserves the V7 tabletop seam fix while reducing high-chroma-edge ratio from V7 tabletop `0.1076` to V8 tabletop `0.0742`.

Removed/Deprecated:
- Counting added prop details as visual improvement when the resulting close-up reads as grid/noise.
- Promoting a standalone workstation candidate into the full room before runtime LOD/proxy packaging and human art approval.

## 2026-05-20 변경 동기화 (Furniture V2 Active Runtime Gate)
Added:
- Whole-room furniture passes must keep versioned GLB outputs and preview renders before replacing the active QA room path.
- Current active large furniture candidate is `p2s_bruno_furniture_hero_kit_v2` with evidence at `assets/references/blender-authored/bruno-furniture-hero-kit-v2/asset-review-2026-05-20.json`.
- Furniture detail lines on tabletop mats, rugs, throws, and upholstery must be subordinate to object silhouettes; high-contrast ladder/grid patterns are visual regressions even when geometry count increases.

Updated:
- `/labs/qa/pc-assembly-workbench` now points its authored furniture layer to `/assets/models/p2s_bruno_furniture_hero_kit_v2/p2s_bruno_furniture_hero_kit_v2.glb`.
- The furniture material package URL now points to `/assets/models/p2s_bruno_furniture_hero_kit_v2/texture-package-2026-05-20.json`.
- V2 is allowed as a runtime commercial-pass candidate because it has KTX2-ready ORM sidecars, preview renders, and a clean reopen audit. It is not approved as final catalog content.

Removed/Deprecated:
- Treating monolithic furniture GLB visual load as sufficient for catalog quality without split/LOD/collider/support package metadata.
- Allowing a foreground sofa from the monolithic furniture kit to duplicate or reduce the standalone foreground sofa GLB quality path.

## 2026-05-20 변경 동기화 (Furniture V3 Active Runtime Gate)
Added:
- Active large furniture candidate is now `p2s_bruno_furniture_hero_kit_v3`, generated by `scripts/blender/generate-bruno-furniture-hero-kit-v3.py`.
- V3 suppresses `25` noisy V2 stitch/grid objects and replaces them with lower-contrast furniture construction cues: beveled desk lips, shelf panel gaps, media-console slat gaps, bound rug edges, sofa cushion breaks, and coffee-table glass/wood frame details.
- Evidence paths:
  - `assets/references/blender-authored/bruno-furniture-hero-kit-v3/asset-review-2026-05-20.json`
  - `assets/references/blender-authored/bruno-furniture-hero-kit-v3/furniture-v3-overall.png`
  - `assets/references/blender-authored/bruno-furniture-hero-kit-v3/furniture-v3-desk-shelf-closeup.png`
  - `assets/references/blender-authored/bruno-furniture-hero-kit-v3/furniture-v3-lounge-media-closeup.png`
  - `output/playwright/qa-3100-furniture-v3-runtime.png`

Updated:
- `/labs/qa/pc-assembly-workbench` authored furniture layer now points to `/assets/models/p2s_bruno_furniture_hero_kit_v3/p2s_bruno_furniture_hero_kit_v3.glb`.
- Furniture material package URL now points to `/assets/models/p2s_bruno_furniture_hero_kit_v3/texture-package-2026-05-20.json`.
- V3 reopen audit gate: visible mesh/curve objects `627`, materials `35` after reopen, images `17`, `unmaterialedObjects=[]`, `missingExternalImages=[]`.

Removed/Deprecated:
- Using stale local servers that return HTML while `_next/static` chunk assets 404. For visual QA, restart a clean 3100 dev server before judging runtime screenshots.
- Calling a furniture candidate “상용급 완료” before final SKU split, meshopt/LOD/collider package, final UV/light bake, and human side-by-side art approval.

## 2026-05-20 변경 동기화 (Commercial Desk Image-Model Texture Gate)
Added:
- Standalone desk asset `p2s_commercial_desk_hero_v1` now uses an image-model walnut source for the tabletop basecolor when available.
- The preserved image-model source is `assets/references/blender-authored/commercial-desk-hero-v1/imagegen/walnut-desktop-source-imagegen-20260520.png`.
- Blender generation derives runtime `baseColor`, `roughness`, and `height` texture artifacts and packs them into `apps/web/public/assets/models/p2s_commercial_desk_hero_v1/p2s_commercial_desk_hero_v1.glb`.
- Review evidence is recorded in `assets/references/blender-authored/commercial-desk-hero-v1/asset-review-2026-05-20.json` with isometric, surface close-up, and left-frame close-up previews.

Updated:
- `/labs/qa/pc-assembly-workbench` now cache-busts the commercial desk GLB with `20260520-commercial-desk-no-drawer-uv-v3`.
- The rejected drawer module was removed; the desk now uses an open frame silhouette with no drawer-like front block.
- The tabletop and visible bullnose/side bands now share the image-model walnut material instead of leaving the edge as a flat beige material.
- The texture gate now treats raw image-model output as a source, not final material truth; color grading and derived physical maps are required before GLB packing.

Removed/Deprecated:
- Using purely procedural tabletop grain as the preferred path for hero-visible commercial desk surfaces.
- Calling a generated wood texture complete before standalone close-up render review and human art approval.
- Keeping a non-convincing drawer facade on the desk just to add furniture detail.

## 2026-05-21 변경 동기화 (Commercial Task Chair Runtime Gate)
Added:
- Hero-visible desk chair는 절차형 block proxy가 아니라 standalone Blender-authored GLB 후보로 관리한다.
- 신규 후보 `p2s_commercial_task_chair_hero_v1`는 generic ergonomic task chair로, mesh back panel, individual weave threads, perimeter frame, lumbar pad, adjustable arms, gas lift, five-star base, caster wheels를 별도 geometry로 가진다.
- Evidence paths:
  - `assets/references/blender-authored/commercial-task-chair-hero-v1/asset-review-2026-05-21.json`
  - `assets/references/blender-authored/commercial-task-chair-hero-v1/previews/commercial-task-chair-v1-isometric.png`
  - `assets/references/blender-authored/commercial-task-chair-hero-v1/previews/commercial-task-chair-v1-back-mesh-closeup.png`
  - `assets/references/blender-authored/commercial-task-chair-hero-v1/previews/commercial-task-chair-v1-base-caster-closeup.png`

Updated:
- `/labs/qa/pc-assembly-workbench` now loads `/assets/models/p2s_commercial_task_chair_hero_v1/p2s_commercial_task_chair_hero_v1.glb` for `GamingChair`.
- The task chair GLB is meshopt packaged: `7,149,788` bytes before optimization, `5,525,212` bytes after `gltf-transform dedup + prune + meshopt`.
- The chair ships generated procedural PBR helper maps for charcoal fabric and black mesh, but remains `releaseEligible=false` until human art review and final asset QA approve it.
- Meshy text-to-3D prompt candidate is recorded at `assets/references/blender-authored/commercial-task-chair-hero-v1/meshy-prompt-pack-2026-05-21.json`; no Meshy provider POST was sent because prompt/reference review is required before new paid generation.

Removed/Deprecated:
- Treating the old R3F `RoundedBlock` chair as sufficient for final-room visual QA.
- Calling the chair commercial-ready before Meshy/open/reference comparison, collider/LOD split, and human side-by-side approval are complete.

## 2026-05-21 변경 동기화 (Commercial Desk Accessory Kit Runtime Gate)
Added:
- 책상 위 hero-visible prop cluster는 개별 proxy/rounded block 혼합이 아니라 standalone Blender-authored GLB 후보로 관리한다.
- 신규 후보 `p2s_commercial_desk_accessory_kit_v1`는 generic desktop accessory kit로, curved monitor, monitor light bar, secondary display, low-profile keyboard, sculpted mouse, compact speaker pair, task lamp, microphone arm, cables, tray, and mug를 포함한다.
- Evidence paths:
  - `assets/references/blender-authored/commercial-desk-accessory-kit-v1/asset-review-2026-05-21.json`
  - `assets/references/blender-authored/commercial-desk-accessory-kit-v1/previews/commercial-desk-accessory-kit-v1-isometric.png`
  - `assets/references/blender-authored/commercial-desk-accessory-kit-v1/previews/commercial-desk-accessory-kit-v1-keyboard-closeup.png`
  - `assets/references/blender-authored/commercial-desk-accessory-kit-v1/previews/commercial-desk-accessory-kit-v1-speaker-monitor-closeup.png`

Updated:
- `/labs/qa/pc-assembly-workbench` now loads `/assets/models/p2s_commercial_desk_accessory_kit_v1/p2s_commercial_desk_accessory_kit_v1.glb` when the authored desk hero is active and all desktop setup steps are complete.
- The desk accessory GLB is meshopt packaged: `11,944,744` bytes before optimization, `9,232,916` bytes after `gltf-transform dedup + prune + meshopt`.
- The kit ships generated procedural PBR helper maps for speaker fabric, black desk mat, PBT keycaps, and screen glass; `ktx2Ready=false` remains explicit until runtime KTX2 transcode is added.
- Meshy text-to-3D prompt candidate is recorded at `assets/references/blender-authored/commercial-desk-accessory-kit-v1/meshy-prompt-pack-2026-05-21.json`; no Meshy provider POST was sent before prompt/reference review.

Removed/Deprecated:
- Judging desktop prop quality from scattered proxy models plus overlay boxes after a scale-consistent authored kit exists.
- Rendering tiny text legends on generated keycaps when they become distorted; use physical keycap spacing and subtle inset marks until a font/UV decal workflow is production-ready.
- Calling the accessory cluster commercial-ready before Meshy/open/reference comparison, collider/LOD split, KTX2 packaging, and human side-by-side approval are complete.

## 2026-05-21 변경 동기화 (Commercial Desk Accessory Kit V2 Real-Scale Gate)
Added:
- `p2s_commercial_desk_accessory_kit_v2` replaces the V1 desktop prop candidate for QA runtime visual checks.
- V2 uses official/product-class dimensions as non-copied scale references: 32-inch monitor class, 500mm monitor light bar, 312.6mm compact keyboard, 124.9mm mouse, and 100x175x141mm compact speakers.
- Evidence paths:
  - `assets/references/blender-authored/commercial-desk-accessory-kit-v2/asset-review-2026-05-21.json`
  - `assets/references/blender-authored/commercial-desk-accessory-kit-v2/previews/commercial-desk-accessory-kit-v2-isometric.png`
  - `assets/references/blender-authored/commercial-desk-accessory-kit-v2/previews/commercial-desk-accessory-kit-v2-keyboard-mouse-closeup.png`
  - `assets/references/blender-authored/commercial-desk-accessory-kit-v2/previews/commercial-desk-accessory-kit-v2-monitor-speaker-closeup.png`

Updated:
- `/labs/qa/pc-assembly-workbench` now loads `/assets/models/p2s_commercial_desk_accessory_kit_v2/p2s_commercial_desk_accessory_kit_v2.glb`.
- V2 meshopt package is `9,354,728` bytes after optimization from `12,259,716` bytes.
- Keyboard, mouse, speakers, monitor, monitor stand, light bar, and desk lamp are evaluated first by measured proportion and silhouette before decorative color/detail.
- Meshy balance preflight succeeded, but provider generation POST remains blocked until prompt/reference review.

Removed/Deprecated:
- Treating V1 accessory scale as acceptable for commercial visual QA.
- Calling the desk accessory kit final before browser scene review confirms PC case, desk, and accessory occlusion/framing.

## 2026-05-21 변경 동기화 (Mechanical Keyboard Switch Lab Runtime Gate)
Added:
- Hero-visible keyboard는 standalone Blender-authored GLB 후보로 관리한다.
- 신규 후보 `p2s_mechanical_keyboard_switch_lab_v1`는 compact mechanical keyboard로, individual keycaps, aluminum case, black switch plate, PCB/gasket layer, spacebar stabilizer, exposed red/blue/brown switch samples, visible stem/spring/contact geometry를 가진다.
- Evidence paths:
  - `assets/references/blender-authored/mechanical-keyboard-switch-lab-v1/asset-review-2026-05-21.json`
  - `assets/references/blender-authored/mechanical-keyboard-switch-lab-v1/previews/mechanical-keyboard-v1-isometric.png`
  - `assets/references/blender-authored/mechanical-keyboard-switch-lab-v1/previews/mechanical-keyboard-v1-switch-closeup.png`

Updated:
- `/labs/qa/pc-assembly-workbench` now loads `/assets/models/p2s_mechanical_keyboard_switch_lab_v1/p2s_mechanical_keyboard_switch_lab_v1.glb` for the keyboard surface prop when the keyboard step is active.
- The keyboard GLB is meshopt packaged: `2.52MB` before optimization, `1.25MB` after `gltf-transform dedup + prune + meshopt`.
- Runtime switch profiles are explicit and data-backed: linear red `45cN/2.0mm/4.0mm`, clicky blue `60cN/2.2mm/4.0mm`, tactile brown `55cN/2.0mm/4.0mm`.
- Sound is a runtime interaction layer, not baked into the GLB: selected switch profile drives synthesized key down/click/release cues and records press events in the QA registry.

Removed/Deprecated:
- Treating the old low-profile keyboard proxy as sufficient for mechanical keyboard close-up QA.
- Claiming commercial-ready keyboard sound before recorded WAV layers, per-key animation, and final audio QA exist.

## 2026-05-21 변경 동기화 (ABKO AR108G Reference Keyboard Runtime Gate)
Added:
- The active hero-visible keyboard reference candidate is `p2s_abko_ar108g_sage_green_keyboard_v1`, generated from `scripts/blender/generate-abko-ar108g-sage-green-keyboard-v1.py`.
- Evidence paths:
  - `assets/references/blender-authored/abko-ar108g-sage-green-keyboard-v1/asset-review-2026-05-21.json`
  - `assets/references/blender-authored/abko-ar108g-sage-green-keyboard-v1/previews/abko-ar108g-v1-isometric.png`
  - `assets/references/blender-authored/abko-ar108g-sage-green-keyboard-v1/previews/abko-ar108g-v1-keycap-closeup.png`
  - `assets/references/blender-authored/abko-ar108g-sage-green-keyboard-v1/previews/abko-ar108g-v1-underside.png`

Updated:
- `/labs/qa/pc-assembly-workbench` now loads `/assets/models/p2s_abko_ar108g_sage_green_keyboard_v1/p2s_abko_ar108g_sage_green_keyboard_v1.glb` for the keyboard surface prop.
- The keyboard GLB is meshopt packaged at `943.2KB` after `gltf-transform dedup + prune + meshopt`.
- Runtime/reference metadata must keep `releaseEligible=false`, the Compuzone product URL, `pressTargets >= 100`, and blue switch `50G` evidence explicit.
- Visual QA for this keyboard must judge full-size silhouette, rounded aluminum case, sage/cream/coral keycap color blocking, front RGB lightbar, underside feet/receiver details, and material response before calling the asset improved.

Removed/Deprecated:
- Using the exposed-switch lab asset as the current product-reference keyboard evidence.
- Treating a branded product reference as public-release-safe before manufacturer/CAD/decal/license clearance.
