# 구현 계획 (Room-First Deskterior)

## P0
목표: 제품 방향 전환 고정 + 레거시 하드 제거

완료:
- floorplan/intake/legacy 런타임 경로 제거 (`apps/api`, `apps/worker`, `apps/web`)
- `legacy:*` 스크립트 및 legacy CI job 제거
- `packages/floorplan-core` 및 floorplan 계약 파일 제거
- bootstrap을 saved version(`sceneDocument`) 우선 경로로 단순화
- 레거시 DB 제거용 마이그레이션 런북 + preflight/postcheck SQL 추가
- live Supabase에서 legacy `floorplan*`/`intake_sessions` row purge + `floor-plans` bucket 삭제 완료
- legacy `jobs` floorplan payload scrub 완료
- live Supabase에서 `jobs.floorplan_id`, `project_versions.floor_plan`, `floorplans`, `intake_sessions`, `layout_revisions`, `source_assets`, `revision_source_links` 제거 완료

## P1
목표: IKEA Kreativ 스타일 room builder 완성도 강화

진행:
- 홈 시작하기 2-way 진입(`공간 선택`/`공간 만들기`)과 레퍼런스형 카드 레이아웃 적용
- `빈 공간`/`가구가 비치된 공간` 템플릿 브라우저 추가
- 템플릿 선택 즉시 project draft/save 후 editor로 직행하는 bootstrap 경로 적용
- furnished template별 시드 자산 구성을 분리하고 pre-seeded editor 회귀 항목에 포함
- 빌더를 레퍼런스 5-step split shell로 재구성하고 단계별 preview camera/overlay를 정렬
- 빌더 단계(Shape/Dimension/Opening/Style/Lighting)를 레퍼런스 density 기준으로 재작성
- 개구부 스타일 retune 및 auth restore 이후 상태 덮어쓰기 버그 수정
- builder desktop shell 무스크롤 fit 및 실 floor outline 기반 dimension overlay 적용
- builder exterior polygon/snap 안정화 및 shape-specific geometry 정합성 보강
- opening/style step preview에 orbit/zoom 카메라 UX 적용
- opening step preview에서 style 선택 전 기본 흰 벽/바닥 shell 유지
- opening GLB를 wall-plane 기준 실제 door/window orientation으로 정규화
- builder room shape를 8종으로 확장하고 wall/floor finish 선택 폭을 7종/9종으로 확대
- builder style step의 wall/floor finish 선택 버튼을 실제 texture thumbnail 미리보기 기준으로 갱신
- lighting step에 direct/indirect mood 선택 및 scene lighting payload 연결
- 템플릿 기반 방 생성 속도 개선
- 저장 직후 에디터/뷰어 일관성 확인 자동화
- project-media bucket 미구성 시 thumbnail upload 복구/재시도로 저장 실패를 완화
- 서비스 브랜드/코드 문자열을 `DeskteriorOnline` 기준으로 정리

## P2
목표: 데스크테리어 편집 경험 고도화

진행:
- Blender 원본 -> GLB -> catalog sync 파이프라인 표준화
- 실제 SKU 테스트로 FURSYS SETINA ZDQ012J prototype rebuild를 Blender source/GLB/catalog metadata/runtime package 경로에 추가
- `assets:export:deskterior` / `assets:sync:deskterior` / `assets:validate:deskterior` / `assets:verify:deskterior` 4단계 CLI 계약 고정
- 저장/연산 경계에서 placement 데이터를 mm 정수 기준으로 정규화하고, 렌더 직전에만 meter float로 변환하는 계약 도입
- `/project/[id]` 편집 흐름을 room mode와 desk precision mode로 분리하고 카메라/스냅/피킹 정책을 각 모드별로 고정
- curated runtime asset delivery를 `apps/web/public/assets/*` 직접 서빙에서 storage/CDN 기반 release URL 구조로 옮기는 cutover 설계 진행
- 신규 curated binary의 `apps/web/public/assets/*` 추가 동결
- 제품 메타데이터(브랜드/가격/외부 링크/옵션) 채움률 개선
- 제품 물리 메타데이터(`dimensionsMm`, `finishColor`, `finishMaterial`, `detailNotes`, `scaleLocked`)를 catalog/save/viewer 전 구간으로 확장
- 실측 고정 제품의 스케일 변경 차단(Inspector + TransformControls) 적용
- 공유 뷰어 hotspot drawer에 W/D/H 규격 및 마감/디테일 노출 적용
- 스냅/배치/회전 정밀도 개선 및 뷰어 hotspot 신뢰도 강화
- floor/surface 배치에 wall clearance + inter-asset separation + support re-clamp 기반 물리 솔버 적용
- 상단뷰 에디터에 world/local transform space 토글과 live placement clamp 적용
- 에디터 shell을 레퍼런스 7번 기준(top bar / slim catalog rail / grey viewport / bottom pill toolbar)으로 통일
- Blender 알려진 슬롯 기준(`DeskWood`, `DeskMetal`, `StandWood`, `StandPad`, `LampBody`, `LampAccent`, `LampBulb`)의 slot-aware finish 매핑 적용
- 오픈소스/공식문서/논문 기반 개선안은 `docs/research-roadmap.md`를 기준으로 추적
- loaded GLB 자산에 `three-mesh-bvh` bounds tree를 생성해 hover/select raycast 비용을 완화
- loaded GLB BVH 생성 자체를 large non-interleaved geometry 기준 Web Worker queue로 오프로딩
- `KTX2Loader` + local basis transcoder sync 경로를 runtime decode 기본선으로 추가
- room shell floor/wall texture set에 `KTX2 우선 + JPG/PNG fallback` 경로와 encode/check 스크립트를 추가
- shared viewport에 mode-aware render quality ladder 적용(top/builder 경량화, walk/viewer 품질 유지)
- top-view 자산 drag를 local preview 후 commit 방식으로 전환해 pointer-move store churn 완화
- physics/runtime shadow/contact shadow/post FX를 walk/viewer 중심으로 재배치하되, builder preview/editor top-view에는 bounded diorama grounding shadow만 남겨 furnished scene headroom 확보
- editor top-view를 builder와 같은 perspective orbit + wheel zoom 기준으로 재조정
- editor room shell material fallback을 강화해 top/walk에서 texture decode 실패 시 black shell이 나오지 않도록 수정
- editor top-view orbit과 walk-view 시작 카메라를 안정성 우선으로 재조정해 회전 중 black flicker와 first-frame black view 가능성을 낮춤
- direct lighting beam shader / indirect ceiling glow shader를 scene shell 렌더에 연결
- editor lighting preset을 ambient/hemisphere/directional/environment blur뿐 아니라 accent/beam mood snapshot까지 적용하도록 확장
- room/desk top-view와 builder preview에 demand frame loop + explicit invalidate 경로를 적용
- creator-room starter visual pass로 workspace furnished template을 dense desk/living room 구성, warm/cool diorama lighting, tighter diagonal orbit framing 기준으로 갱신
- furnished template 선택을 builder 커스터마이징 경로로 연결하고, builder preview가 seed 가구/소품과 lightweight shadow/contact shadow를 실제로 렌더하도록 갱신

## P3
목표: 커뮤니티 공유/조회 경험 강화

진행:
- publish -> shared viewer -> gallery/community 데이터 흐름 안정화
- shared viewer shell을 editor read-only mirror(top bar / hotspot drawer / grey viewport / right zoom rail / bottom pill status)로 통일
- gallery/community를 레퍼런스 8번 이미지 기준의 4열 furnished-space feed + URL 기반 filter rail로 통일
- 공유 씬 성능 예산(초기 로드, draw call, texture budget) 모니터링
- 활동성 지표(조회/반응) 수집 및 피드 랭킹 개선

## 2026-05-15 변경 동기화 (Cozy Diorama Workspace Starter)
Added:
- Bruno Simon `my-room-in-3d`는 unlicensed reference이므로 code/asset/shader/texture/layout 복제 없이 compact diorama framing, dense personal object mix, warm/cool lighting contrast만 제품 방향으로 흡수한다.
- `workspace-flex` furnished starter는 기존 catalog asset만 사용해 desk + lounge + shelf + TV/media console + decor가 함께 보이는 24개 asset “나만의 3D 작업방”으로 확장한다.
- builder style step에 `workspace-flex` 가구 구성 cluster 토글을 추가해 workstation/media/lounge/display를 사용자가 직접 켜고 끄며 preview와 생성 payload를 확인할 수 있게 한다.
- editor inspector에 선택 제품 교체 visual picker를 추가해 같은 카테고리 catalog item을 기존 transform/support anchor 위에서 바로 바꿀 수 있게 한다.
- editor `selectedAssetId` query restore를 추가해 특정 배치 자산을 선택한 상태로 inspector QA와 deep link 진입을 시작할 수 있게 한다.
- editor 선택 제품 교체 후보에 category/anchor/치수/제품군/실측 metadata/QA score 기반 compatibility ranking과 추천 badge를 추가한다.
- editor replacement card는 실제 asset과 일치하는 thumbnail만 크게 사용하고, 공용 placeholder thumbnail은 family/치수 기반 mini isometric diorama proxy + fit label로 대체한다.

Updated:
- builder preview는 orthographic isometric starter camera와 explicit pose sync를 사용하고, editor room top-view는 완만한 drag/zoom 감도의 diagonal room-diorama 구도를 유지한다.
- builder preview camera는 높은 overhead corner view에서 낮은 external diagonal presentation pose로 조정해 furniture height와 surface detail이 더 크게 읽히도록 한다.
- lighting pass는 scene fixture 계약을 늘리지 않고 기존 ambient/hemisphere/directional/fill light 안에서 warm key와 cool fill 대비를 강화한다.
- `/studio/select`의 furnished template은 로그인 전후 모두 `/studio/builder`로 이어져 사용자가 치수, 스타일, 조명을 바꾸며 seed room을 확인한 뒤 프로젝트를 만들 수 있다.
- builder preview scene sync는 seed assets를 빈 배열로 지우지 않고 저장될 memoized asset set과 같은 배열을 렌더한다.
- builder preview shell은 preview 전용 cutaway wall과 dark canvas backdrop을 적용하고, `workspace-flex` seed는 real-scale support anchor와 dimensionsMm 기반 stylized preview proxy로 catalog GLB 단위/원점 차이에 흔들리지 않게 desk/shelf prop 구도를 보정한다.
- preview proxy/detail pass는 catalog asset 수나 저장 payload를 늘리지 않고 rounded/beveled proxy surfaces, monitor screen panels, keyboard/mouse/speaker/gamepad/mug micro-detail, desk/media/shelf surface dressing, rug, shelf books/boxes, sofa cushions, plant leaves, preview-only crown trim/framed wall panels를 렌더 전용 filler로 추가해 first-frame furnished density와 toy-like silhouette을 보강한다.
- `workspace-flex` seed staging은 같은 24개 asset을 back-wall desk cluster, side-wall TV/media-console zone, cutaway-side shelf, foreground lounge cluster로 재배치해 floor center가 비어 보이는 문제를 줄이고 첫 화면의 creator-room 밀도를 높인다.
- `workspace-flex` seed는 미디어 콘솔, 콘솔 위 TV/game-console, 사이드테이블 위 보조 램프, 스툴을 추가해 큰 시각 앵커와 사용자가 꾸밀 수 있는 surface layer를 늘린다.
- 남은 reference-level gap은 실제 GLB/PBR 제품 에셋 품질, baked/contact shadow 정교화, media/side/living cluster별 교체 후보 ranking과 세부 편집 affordance까지 확장해야 완전히 닫힌다.
- desk/sofa preview proxy는 renderer-only drawer/LED/cable, arm/cushion/seam detail을 포함해 large furniture가 단순 box로 읽히지 않게 한다.
- direct-lighting builder preview는 renderer-only transparent tint warm/cool wall/floor mood wash를 사용해 조명 대비를 강화하되, sceneDocument/fixture 저장 payload와 dynamic emitter 예산은 늘리지 않는다.
- editor lighting inspector는 `accentIntensity`와 direct `beamOpacity`를 직접 조절할 수 있고, `home-reference` preset은 강한 diorama accent/beam 값을 기본 적용한다.
- `workspace-flex` seed 생성은 cluster filter를 적용해 URL restore, auth draft, project create가 모두 같은 asset set을 사용하며, 기본 catalog만으로도 24개 starter asset을 fallback 없이 해석한다.
- editor 선택 제품 교체는 같은 scene asset id를 유지하며 `assetId/catalogItemId/product/supportProfile`을 새 catalog item으로 교체하고, 기존 position/rotation/scale/material override/supportAssetId를 보존한 뒤 anchor solver로 재클램프한다.
- editor replacement picker는 같은 category라도 제품군/footprint가 크게 다른 후보를 뒤로 밀고, 실측 metadata가 있는 후보를 동점 generic catalog보다 우선하며, 추천/호환/검토 badge와 anchor/크기 적합도 detail을 노출한다.
- editor replacement picker는 card-level visual preview가 잘못된 공용 thumbnail에 의존하지 않도록 신뢰 가능한 thumbnail과 치수 기반 isometric fallback을 구분한다.
- 남은 reference-level gap은 실제 GLB/PBR 제품 에셋 품질, baked/contact shadow 정교화, generated thumbnail 품질 고도화와 cluster-specific affordance까지 확장해야 완전히 닫힌다.

Removed/Deprecated:
- workspace starter를 책상/의자/선반/램프 정도의 sparse 배치로 유지해 첫 화면에서 커스터마이징 가능성을 충분히 보여주지 못하는 방식.
- furnished template 품질을 카드 thumbnail과 editor 진입 이후에만 확인하게 하는 방식.
- media/lounge/display starter cluster가 catalog 누락으로 unrelated fallback item을 섞어 의미가 바뀌어도 허용하던 방식.
- 선택 제품을 삭제하고 새 제품을 추가하는 방식으로 교체해 위치, selection, support lock, undo snapshot 의미가 끊기는 방식.

Follow-up risk:
- 현재 diorama detail은 renderer-only proxy/shell dressing과 lighting mood control 중심이므로 reference-level 품질에 더 가까워지려면 catalog GLB 자체의 고품질 desk props, fabric/plant/monitor material polish, baked-style contact shadow refinement, 교체 후보 compatibility/preview refinement가 별도 패스로 필요하다.
- replacement ranking과 card-level isometric proxy fallback은 1차 완료됐지만 실제 generated/catalog thumbnail 자체의 제품별 품질은 아직 asset pipeline 산출물에 의존하므로, 다음 시각 품질 pass에서 better generated thumbnail 또는 card-level live 3D preview를 붙여야 한다.

## 2026-05-16 변경 동기화 (Diorama Grounding Shadow)
Added:
- `SceneRenderQuality` contact shadow profile에 scale/far/color/y offset을 추가해 builder preview/editor top-view의 baked-style grounding을 정책으로 고정한다.
- builder preview는 post FX/SSR/bloom 없이 bounded dynamic shadow + warm-tinted contact shadow로 dense furnished starter의 바닥 접지를 보강한다.
- Clean Paint/Clean Plaster 기본 wall preset은 dirty source diffuse texture 대신 clean color material과 clean thumbnail을 사용해 furnished starter 첫인상을 보강한다.

Updated:
- `verify:builder-performance`와 `verify:material-presets`는 builder preview를 no-shadow profile로 보지 않고 bounded diorama grounding profile로 검증한다.
- `verify:render-quality`는 builder preview contact shadow footprint/far/color와 editor top-view lightweight contact grounding, shared top-view contact shadow off 정책을 함께 확인한다.
- `verify:material-presets`는 clean default wall preset의 clean thumbnail과 runtime clean paint material guard를 함께 확인한다.

Removed/Deprecated:
- builder preview 성능 검증이 contact shadow와 dynamic shadow를 항상 실패 조건으로 간주하던 과거 기준.
- 기본 wall preset이 dirty concrete/plaster diffuse map을 그대로 사용해도 clean commercial default로 볼 수 있다는 기준.

## 2026-05-16 변경 동기화 (Builder Preview Ground Dressing)
Added:
- builder preview root에 renderer-only `BuilderPreviewGroundDressing`을 추가해 lounge/coffee-table cluster 아래 큰 rug, woven edge/thread strips를 렌더한다.
- coffee-table proxy에는 작은 tabletop prop mass를, sofa proxy에는 throw blanket과 seat seam을 추가해 furnished starter의 중심부 밀도를 보강한다.
- `verify:builder-performance`가 ground dressing scope, group name, rug weave, coffee-table prop density source contract를 회귀 검증한다.

Updated:
- P2 visual pass의 남은 gap 중 “floor center가 비어 보이는 문제”를 builder-preview-only rug/detail pass로 1차 축소했다.
- 이번 pass는 `sceneDocument`, seeded asset count, cluster toggle payload, fixture/dynamic emitter budget을 바꾸지 않는다.

Removed/Deprecated:
- coffee table 주변 바닥 rug/detail이 보이지 않아도 creator-room density가 충분하다는 판단.

Follow-up risk:
- renderer-only detail은 첫 프레임 인상 개선에는 유효하지만 reference-level 완성도를 완전히 닫으려면 실제 GLB/PBR asset material, plant/fabric geometry, baked shadow/lightmap 수준의 asset pass가 계속 필요하다.

## 2026-05-16 변경 동기화 (Builder Preview Surface Dressing)
Added:
- `Furniture.tsx` builder preview root에 renderer-only `BuilderPreviewSurfaceDressing`을 추가해 desk 위 헤드폰/케이블/노트, media-console 위 콘솔/리모컨, shelf 위 collectible silhouettes를 렌더한다.
- `verify:builder-performance`가 surface dressing scope, group names, desk/media/shelf marker, dynamic emitter 미증가 source contract를 회귀 검증한다.

Updated:
- P2 visual pass의 남은 gap 중 “desk/media/shelf surface가 아직 빈 furniture proxy처럼 보이는 문제”를 builder-preview-only micro-prop pass로 축소했다.
- 이번 pass는 `sceneDocument`, seeded asset count, cluster toggle payload, fixture/dynamic emitter budget을 바꾸지 않는다.

Removed/Deprecated:
- desk/media/shelf zone이 seed asset 24개와 기존 proxy 디테일만으로 충분히 personal room density를 만든다는 판단.

Follow-up risk:
- surface dressing은 renderer-only silhouette이라 reference-level 소품 품질을 완전히 대체하지 않는다. 다음 단계에서는 실제 GLB/PBR desk props, wall decor, shelf decor asset과 baked-style shadow/material pass가 계속 필요하다.

## 2026-05-16 변경 동기화 (Builder Preview Wall Dressing)
Added:
- `Furniture.tsx` builder preview root에 renderer-only `BuilderPreviewWallDressing`을 추가해 rear/side wall framed art, rear wall shelf decor, warm/cool LED strip geometry를 렌더한다.
- `verify:builder-performance`가 wall dressing scope, group names, gallery/shelf/LED marker, dynamic emitter 미증가 source contract를 회귀 검증한다.
- `verify:lighting-layout`가 builder preview warm/cool floor/wall wash 최소 강도 source marker를 확인한다.

Updated:
- P2 visual pass의 남은 gap 중 “가구와 상판은 채워졌지만 벽면이 여전히 빈 흰 박스처럼 보이는 문제”를 preview-only wall decor pass로 축소했다.
- 이번 pass는 `sceneDocument`, seeded asset count, cluster toggle payload, fixture/dynamic emitter budget을 바꾸지 않는다.

Removed/Deprecated:
- wall decor 없이 floor/surface props만 늘리면 Bruno Simon 스타일 compact room density가 충분하다는 판단.

Follow-up risk:
- wall dressing은 lightweight geometry라 실제 reference-level wall shelf/LED/프레임 GLB와 baked material 품질을 완전히 대체하지 않는다.

## 2026-05-16 변경 동기화 (Builder Preview Presentation Camera)
Added:
- `CameraRig.tsx` builder-preview branch의 orthographic camera를 낮은 external diagonal pose, raised furniture target, tighter zoom으로 조정했다.
- `verify:builder-performance`가 builder preview camera source contract를 검증해 orthographic camera, pose sync, presentation distance/height/target/zoom/polar limit 회귀를 막는다.

Updated:
- P2 visual pass의 남은 gap 중 “소품은 추가됐지만 카메라가 너무 top-down이라 밀도가 작게 읽히는 문제”를 camera presentation pass로 축소했다.
- 이번 pass는 `sceneDocument`, cluster state, furniture placement, fixture budget을 바꾸지 않는다.

Removed/Deprecated:
- builder preview를 floor plan에 가까운 높은 overhead framing으로 두고 소품 수만 늘려 density 문제를 해결한다는 판단.

Follow-up risk:
- 낮은 orthographic presentation은 첫 프레임 인상을 개선하지만, reference-level 품질을 더 닫으려면 실제 wall decor/desk props/TV wall composition과 material pass가 계속 필요하다.

## 2026-05-16 변경 동기화 (Builder Preview Mood Lighting)
Added:
- builder preview direct mode에 `builder-preview-mood-wash` renderer-only overlay 계약을 고정해 warm/cool floor/wall bleed가 저장 payload 없이 캔버스에 보이도록 했다.
- `verify:lighting-layout`가 builder-preview scope, normal-blend tint, dynamic emitter 미증가, builder preview light scale source marker를 확인한다.

Updated:
- 기존 additive wash는 clean white wall/floor에서 거의 사라질 수 있어 transparent normal-blend tint로 전환했다.
- builder preview global light scale은 ambient/hemisphere의 flatness를 낮추고 warm key/cool fill 대비를 강화한다.
- 이번 pass도 `sceneDocument`, fixture count, dynamic emitter budget, cluster URL state를 바꾸지 않는다.

Removed/Deprecated:
- builder preview가 high-key white wall/floor 위에서 warm/cool contrast를 거의 보여주지 못해도 reference-style lighting gap이 충분히 줄었다고 보는 판단.

Follow-up risk:
- renderer-only mood wash는 첫 화면의 색 대비를 보강하지만, reference-level 완성도를 더 닫으려면 실제 GLB material, fixture mesh, baked shadow/lightmap, wall decor asset 품질 개선이 계속 필요하다.

## 2026-05-16 변경 동기화 (Builder Preview Visual Smoke Gate)
Added:
- `apps/web/scripts/verify-builder-preview-diorama.ts`를 추가해 builder style/lighting preview를 실제 Chromium에서 열고 WebGL canvas pixel metrics로 diorama first-frame 품질을 검증한다.
- 검증 시 `workspace-cluster-preset-media-lounge`를 클릭해 preset이 URL `clusters=media,lounge`와 canvas preview에 함께 반영되는지 확인한다.
- 성공 캡처는 `output/playwright/builder-preview-diorama-smoke.png`에 저장한다.
- visual smoke는 furniture render source registry를 함께 읽어 full style/lighting preview 24개, media-lounge preview 8개가 모두 `builder-preview-proxy`이고 placeholder/model-loading fallback이 0개인지 확인한다.

Updated:
- P2 visual pass의 검증 범위를 source contract와 manual screenshot에서 자동 browser visual smoke로 확장했다.
- 이번 pass는 production scene schema, seeded asset count, renderer dynamic emitter budget, cluster payload를 바꾸지 않고 QA evidence만 강화한다.
- visual smoke는 Next dev server의 known RSC browser-navigation fallback console noise와 의도적 route 전환 중 `ERR_ABORTED` 된 in-flight resource request는 제외하되, 실제 page error/non-aborted request failure/canvas metric failure는 계속 실패로 처리한다.
- full style/lighting visual smoke는 `p2s_meshy_pastel_mascot_stack` catalog item이 source registry에 포함되는지 확인해 Meshy-generated decor가 room-first starter preview에 들어왔다는 evidence를 남긴다.

Removed/Deprecated:
- builder preview visual fidelity를 source regex gate와 수동 확인만으로 닫았다고 보는 판단.
- nonblank canvas만 통과하면 placeholder/fallback geometry가 섞여도 furnished preview 품질을 통과시키는 판단.

Follow-up risk:
- visual smoke는 nonblank/contrast/color-diversity 회귀를 자동으로 잡지만, reference-level material/asset fidelity 판단은 여전히 실제 GLB/PBR asset QA와 human visual review가 필요하다.

## 2026-05-16 변경 동기화 (Workspace Cluster Presets)
Added:
- `WORKSPACE_FLEX_CLUSTER_PRESETS`를 추가해 `workspace-flex` furnished starter를 풀 룸, 크리에이터 데스크, 미디어 라운지, 갤러리 스튜디오 구성으로 빠르게 전환할 수 있게 했다.
- builder style step에 preset button group을 추가하고 각 버튼에 browser QA용 `workspace-cluster-preset-*` test id를 부여했다.
- `verify:builder-performance`가 preset source contract, 대표 preset cluster 조합, preset 버튼 wiring을 회귀 검증한다.

Updated:
- `workspace-flex` 커스터마이징은 개별 workstation/media/lounge/display 토글만이 아니라 목적별 preset으로 큰 구성을 고른 뒤 세부 토글로 조정하는 흐름을 기준으로 한다.
- 이번 pass는 기존 `workspaceClusterIds` 상태를 그대로 재사용하므로 preview asset set, URL `clusters`, auth draft, project create payload 흐름은 유지하고 `sceneDocument` schema에는 새 필드를 추가하지 않는다.

Removed/Deprecated:
- 사용자가 의미 있는 dense creator-room 구성을 얻기 위해 cluster 토글 조합을 직접 실험해야 한다는 UX 가정.

Follow-up risk:
- preset은 seed set 선택 UX를 개선하지만 editor 안에서 이미 생성된 방의 zone-level batch replace/style affordance는 아직 별도 패스로 남아 있다.

## 2026-05-16 변경 동기화 (Editor Replacement Zone Hints)
Added:
- replacement candidate model에 catalog text 기반 `roomZone` hint를 추가해 workstation/media/lounge/display/flex 맥락을 후보마다 보존한다.
- editor inspector 선택 항목 메타 영역에 현재 asset의 inferred room zone badge를 표시하고, replacement card에도 후보 room zone label을 표시한다.
- editor replacement picker에 같은 존 후보와 전체 후보를 전환하는 segmented filter를 추가한다.
- `verify:replacement-candidates`가 room zone inference, same-zone workstation replacement preference, inspector selected-zone badge, 후보 카드 zone label, same-zone/all filter source contract를 검증한다.

Updated:
- editor replacement ranking은 category/anchor/dimension/family/QA뿐 아니라 선택 제품과 후보의 room zone 일치도도 가벼운 compatibility 신호로 사용한다.
- 이번 pass는 `sceneDocument` schema, asset placement, support anchor, replacement update path를 바꾸지 않고 inspector affordance, ranking hint, 후보 탐색 scope만 보강한다.

Removed/Deprecated:
- 사용자가 이미 만든 방의 workstation/media/lounge/display 맥락을 replacement card에서 추론하거나, 같은 존 후보만 먼저 보려면 전체 후보 목록을 수동으로 훑어야 하는 UI 가정.

Follow-up risk:
- zone hint/filter는 단일 선택 항목 교체의 맥락을 보강하지만, editor 안에서 특정 zone 전체를 batch style/replace 하는 기능은 아직 별도 패스로 남아 있다.

## 2026-05-16 변경 동기화 (Editor Replacement Zone Actions)
Added:
- `buildReplacementZoneSummary`를 추가해 replacement 후보를 room zone별 count, 추천 수, 평균 match, 대표 후보 label로 요약한다.
- `BuilderInspectorPanel` replacement 영역에 `존 커스터마이징` action rows를 추가해 사용자가 워크존/미디어존/라운지/디스플레이 후보만 바로 필터링할 수 있게 했다.
- `verify:replacement-candidates`가 zone summary count coverage, selected zone first ordering, action row test id, zone action filtering source contract를 검증한다.

Updated:
- 이번 pass는 editor customization gap 중 “교체 후보가 카드 목록으로만 보여 zone-level room styling 의도가 약한 문제”를 줄인다.
- scene asset id, transform, support anchor, `sceneDocument` schema는 변경하지 않고 inspector affordance와 candidate metadata 소비만 보강한다.

Removed/Deprecated:
- same-zone/all 토글만으로 사용자가 방의 zone별 꾸미기 방향을 충분히 이해할 수 있다는 판단.

Follow-up risk:
- zone action은 후보 탐색을 돕는 UI이며 아직 zone 전체 일괄 교체나 live 3D card preview는 별도 작업으로 남아 있다.

## 2026-05-16 변경 동기화 (Editor Zone Quick Apply)
Added:
- `ReplacementZoneSummary`에 `topCandidateItemId`를 추가해 각 room zone의 대표 후보를 UI에서 직접 적용할 수 있게 했다.
- `BuilderInspectorPanel`의 `존 커스터마이징` row에 quick apply 버튼을 추가해 사용자가 zone별 대표 후보로 선택 제품을 즉시 교체할 수 있게 했다.
- `verify:replacement-candidates`가 summary top candidate id/label 정합성과 quick apply source contract를 검증한다.

Updated:
- 이번 pass는 replacement zone action을 필터 탐색 보조에서 실제 one-click customization affordance로 승격한다.
- quick apply는 기존 `onReplaceAsset`/`updateFurniture` replacement 경로를 재사용하므로 `sceneDocument` schema, asset id, transform/support anchor 보존 계약은 변경하지 않는다.

Removed/Deprecated:
- zone row를 누른 뒤 별도 후보 카드를 다시 찾아야만 현재 제품을 다른 zone 스타일로 바꿀 수 있는 흐름.

Follow-up risk:
- quick apply는 선택 제품 단위의 빠른 적용이며, zone 전체 일괄 교체와 live 3D card preview는 아직 별도 작업으로 남아 있다.

## 2026-05-16 변경 동기화 (Editor Placed Zone Overview)
Added:
- `buildPlacedAssetZoneSummary`를 추가해 현재 scene의 배치 제품을 room zone별 count, 대표 제품, selected-zone ordering으로 요약한다.
- `ProjectEditorPage`가 현재 `assets`와 catalog lookup에서 placed zone summary를 파생하고 `BuilderInspectorPanel`에 전달한다.
- `BuilderInspectorPanel`의 `공간 요약`에 `배치 존` overview를 추가해 사용자가 zone row를 눌러 해당 zone의 대표 제품을 바로 선택할 수 있게 했다.
- `verify:replacement-candidates`가 placed zone summary count coverage, selected zone first ordering, inspector QA id, 기존 selection store 연결을 검증한다.

Updated:
- 이번 pass는 editor customization gap 중 “방 전체의 zone 구성을 inspector에서 파악하고 바로 꾸미기 시작하기 어려운 문제”를 줄인다.
- scene asset id, transform, support anchor, `sceneDocument` schema는 변경하지 않고 catalog metadata 기반 room-zone inference만 재사용한다.

Removed/Deprecated:
- 공간 요약이 단순 수량 통계만 보여주고, 실제 배치된 workstation/media/lounge/display 구성을 navigation affordance로 제공하지 않는 상태.

Follow-up risk:
- placed zone overview는 대표 제품 선택 단위였으며, 다음 batch replace pass에서 독립 제품 일괄 교체까지 확장한다. support-carrier cascade와 live 3D card preview는 별도 작업으로 남아 있다.

## 2026-05-16 변경 동기화 (Editor Placed Zone Batch Replace)
Added:
- `ReplacementPlacedAssetZoneSummary`에 `replaceableCount`, 대표 replacement 후보 id/label을 추가해 zone overview가 실제 적용 가능한 추천 교체 수를 보여줄 수 있게 했다.
- `ProjectEditorPage`에 `applyPlacedZoneReplacements`를 추가해 선택한 room zone의 독립 제품을 각 제품별 compatibility-ranked 후보로 일괄 교체할 수 있게 했다.
- `BuilderInspectorPanel`의 `배치 존` row에 `교체` action을 추가해 zone overview에서 바로 zone 분위기를 바꿔 볼 수 있게 했다.
- `ProjectEditorPage`가 support-carrier 후보를 교체 전 projected scene으로 검증해 하위 surface anchor가 같은 부모에 남는 경우에만 batch plan에 포함한다.
- `verify:replacement-candidates`가 placed zone replacement 후보 요약, support-carrier cascade preflight, batch action QA id, 기존 replacement update path 재사용, 단일 undo snapshot source contract를 검증한다.

Updated:
- 이번 pass는 editor customization gap 중 “zone overview를 봐도 실제 꾸미기는 제품별 반복 작업으로 남는 문제”를 줄인다.
- batch replace는 기존 `updateFurniture` replacement semantics를 page-local helper로 재사용하므로 `sceneDocument` schema, scene asset id, transform/support anchor 보존 계약은 변경하지 않는다.
- support-carrier 부모 가구는 projected batch scene에서 dependent surface anchors가 같은 부모에 유지되는지 다시 검증하고, 독립/자식 제품 교체 후 마지막에 적용해 store-level re-anchor가 최종 규격 기준으로 수렴하게 한다.

Removed/Deprecated:
- zone 단위 꾸미기를 시작하려면 대표 제품 선택 후 동일한 replacement 작업을 제품마다 반복해야 한다는 흐름.
- support surface 부모 가구를 항상 batch 후보에서 제외하는 보수적 제한.

Follow-up risk:
- batch replace는 support-carrier cascade preflight까지 포함하고 replacement card fallback은 isometric proxy로 보강됐지만, 실제 WebGL live 3D card preview는 별도 작업으로 남아 있다.

## 2026-05-16 변경 동기화 (Editor Placed Zone Replacement Preview)
Added:
- `ReplacementPlacedAssetZoneSummary`가 대표 replacement 후보의 match percent와 preview family를 보존하도록 확장했다.
- `ReplacementPlacedAssetZoneSummary`가 대표 replacement 후보의 support dependent count를 보존하도록 확장했다.
- `ProjectEditorPage`가 batch 후보를 계산할 때 `matchPercent`/`previewFamily`를 placed zone summary로 전달한다.
- `BuilderInspectorPanel`의 `배치 존` row가 대표 replacement label, 추천 match percent, compact isometric preview, support cascade 유지 개수를 visible preview로 보여준다.
- `verify:replacement-candidates`가 preview target QA id, silhouette compatibility QA id, compact isometric QA id, match score 노출, editor data wiring 계약을 검증한다.

Updated:
- 이번 pass는 editor customization gap 중 “zone batch replace 결과가 버튼을 누르기 전에는 충분히 예측되지 않는 문제”를 줄인다.
- scene asset id, transform, support anchor, `sceneDocument` schema, batch replacement update path는 변경하지 않고 inspector affordance와 summary metadata만 보강한다.

Removed/Deprecated:
- zone row가 교체 가능 개수만 보여주고 대표 replacement 대상과 추천 신뢰도를 UI에 노출하지 않는 상태.

Follow-up risk:
- visible preview는 lightweight isometric proxy 기반이며, 실제 WebGL live 3D preview는 별도 작업으로 남아 있다.

## 2026-05-16 변경 동기화 (Editor Replacement Isometric Proxy)
Added:
- `BuilderInspectorPanel` replacement card fallback에 `ReplacementIsometricPreview`를 추가해 후보 family와 `previewScale` 기반 floor footprint/object volume을 보여준다.
- `CatalogLiveModelPreview`를 추가해 전용 thumbnail이 없는 실제 `/assets/models/*.(glb|gltf)` 후보에는 inspector card 안에서 demand WebGL live model overlay를 progressive enhancement로 얹는다.
- placed zone compact preview에도 `placed-zone-replacement-isometric-*` QA id를 추가해 대표 replacement의 실행 전 visual expectation을 검증한다.
- `ReplacementPlacedAssetZoneSummary`가 대표 후보의 `previewScale`을 `topReplacementPreviewScale`로 보존하고, placed zone compact preview가 이 값을 우선 사용하도록 연결했다.
- `hasSpecificCatalogThumbnail`을 catalog helper로 승격해 library shelf와 inspector replacement card가 공유 placeholder thumbnail을 item-specific render로 표시하지 않도록 고정했다.
- `verify:replacement-candidates`가 isometric proxy source contract, live model overlay source contract, `asset-replacement-isometric-preview-*`, `asset-replacement-live-preview-*`, `placed-zone-replacement-isometric-*`, isometric transform, `candidate.previewScale`, `topReplacementPreviewScale` 연결을 검증한다.
- `verify:inventory-thumbnails`가 shared placeholder thumbnail fixture를 거부하고 shelf가 `hasSpecificCatalogThumbnail`을 쓰는지 검증한다.

Updated:
- 이번 pass는 replacement ranking, scene asset id, transform/support anchor 보존, batch replace update path, `sceneDocument` schema를 바꾸지 않고 visual fallback만 고도화한다.
- 부정확한 공용 thumbnail fallback은 먼저 숨기고, live model overlay가 가능한 후보는 실제 GLB를 card 안에서 보여주며, 불가능하거나 실패한 후보는 mini diorama proxy로 width/depth/height 인상을 전달한다.
- zone batch 실행 전 row preview도 대표 후보 dimensions metadata를 공유해, 작은 desk-surface accessory와 큰 floor furniture가 같은 compact scale로 보이는 문제를 줄인다.

Removed/Deprecated:
- replacement 후보 fallback이 flat silhouette만 보여 사용자가 교체 후 방 분위기와 scale을 충분히 예측하기 어려운 상태.
- placed zone compact preview가 대표 후보 `previewScale`을 버리고 하드코딩 scale만 쓰는 상태.
- chair/sofa/decor replacement 후보가 desk 등 다른 asset의 shared thumbnail로 표시되어 교체 결과를 오해하게 만드는 상태.

Follow-up risk:
- live model overlay는 replacement card 내부 preview만 개선하며, Meshi/Meshy 기반 신규 자산 생성이나 editor canvas 내 full live replacement staging은 별도 작업으로 남아 있다.

## 2026-05-16 변경 동기화 (Editor Room Mood Recipes)
Added:
- `room-mood-recipes.ts`를 추가해 Clean Gallery, Warm Studio, Soft Lounge, Walnut Media recipe가 기존 wall/floor/ceiling preset index와 lighting preset을 해석하도록 했다.
- `BuilderInspectorPanel`에 `editor-room-mood-recipes` quick action UI를 추가하고, 각 recipe card가 material swatch 3개와 stable QA id를 노출한다.
- `ProjectEditorPage`가 `applyRoomMoodRecipe`로 wall/floor/ceiling setter와 `getLightingPreset(...).settings`를 한 번에 적용하고 단일 undo snapshot을 기록한다.
- `verify:lighting-layout`와 `verify:material-presets`가 recipe UI, combined handler, preset/index resolution, swatch contract를 검증한다.

Updated:
- 이번 pass는 `sceneDocument`, asset placement, replacement ranking, lighting fixture payload를 바꾸지 않고 editor customization speed와 mood discoverability를 개선한다.
- 개별 마감/조명 control은 유지하되, 사용자는 recipe로 큰 분위기를 먼저 잡고 기존 세부 control로 보정할 수 있다.

Removed/Deprecated:
- editor 방 분위기 변경이 개별 finish grid와 lighting preset을 각각 눌러야만 가능한 상태.

Follow-up risk:
- recipe는 기존 preset 조합이므로 reference-level 완성도를 더 닫으려면 실제 material/lighting thumbnail preview와 editor canvas visual smoke를 추가로 확장해야 한다.

## 2026-05-16 변경 동기화 (Builder Room Mood Recipes)
Added:
- `BuilderStyleStep`에 `builder-room-mood-recipes` quick action UI를 추가해 사용자가 프로젝트 생성 전 Clean Gallery, Warm Studio, Soft Lounge, Walnut Media 분위기를 바로 적용할 수 있게 했다.
- `StudioBuilderPage`가 recipe 적용 시 wall/floor material index와 existing lighting preset settings를 builder preview/save lighting에 함께 반영한다.
- builder recipe 선택은 URL `mood`와 auth draft에 유지되어 로그인 복귀 후에도 같은 bundled mood preview를 복원한다.
- `verify:lighting-layout`와 `verify:material-presets`가 builder recipe UI, swatch, URL/auth restore, existing-state handler 계약을 검증한다.

Updated:
- 이번 pass는 editor room mood recipe helper를 재사용해 builder와 editor의 bundled mood vocabulary를 맞춘다.
- scene schema, ceiling 저장 필드, seed asset count, workspace cluster payload, dynamic fixture budget은 변경하지 않는다.

Removed/Deprecated:
- builder preview에서 방 분위기를 빠르게 잡으려면 벽/바닥 finish와 lighting mode를 각각 별도로 찾아 조합해야 하는 흐름.

Follow-up risk:
- builder recipe는 existing preset 조합이므로 reference-level 완성도를 더 닫으려면 builder recipe별 실제 browser canvas visual smoke와 material/lighting thumbnail preview가 추가로 필요하다.

## 2026-05-02 실행 계획 (Web-native Interaction Engine)

목표:
- “3D 뷰어”가 아니라 walk placement, desk precision, surface-local attachment, ghost preview, commit-only document patch를 하나의 제품 계약으로 잠근다.

진행:
- Phase 0 / PR 1 완료: `packages/interaction-engine` 생성, state/event/result/blocked reason/candidate ranking 타입 추가.
- `FocusPlacementMachine`을 React 없이 테스트 가능한 순수 상태 머신으로 추가.
- `docs/interaction-engine-contract.md` 작성.
- `verify:interaction-engine` 추가로 preview 상태 document patch 0건, commit patch intent 1건을 검증.
- PR 2 완료: `FocusPlacementController`가 keyboard/pointer/numeric/candidate/commit/cancel state transition을 `FocusPlacementMachine` event/result로 위임한다.
- PR 3 완료: `resolveSceneRenderQuality`의 frameLoop 정책을 walk=`always`, top/desk/builder/shared top=`demand` 기준으로 정리하고 `verify:render-quality`로 고정한다.
- PR 4 완료: surface candidate 생성이 interaction-engine ranking/blocked reason/visual affordance를 보존하고, HUD candidate list가 동일한 결과로 후보 상태와 직접 선택을 제공한다.
- PR 5 완료: walk crosshair가 pointer-lock 상태와 focus placement valid/warning/blocked feedback을 표시하고, `verify:walk-placement-ux`로 pointer-lock HUD 상태 계약을 검증한다.
- PR 6 완료: desk precision top policy를 확인 전용에서 5mm/1deg gizmo + hotkey 정밀 편집 모드로 승격하고 `verify:desk-precision`으로 고정한다.
- PR 7 완료: `wall_screw`/`grommet_hole`을 kernel + focus candidate admission에 포함하고, mounted point/footprint/normal offset/동일 surface collision commit guard를 `verify:advanced-attachments`와 `verify:focus-placement`로 고정한다.

다음 순서:
- PR 8 이후: asset metadata gate, viewer parity gate, commercial QA dashboard 순서로 진행한다.

Added:
- `interaction-engine` Phase 0 foundation과 검증 스크립트.
- `FocusPlacementController` adapter wiring.
- focus placement candidate ranking metadata와 HUD candidate selector.
- walk placement pointer-lock state HUD와 valid/blocked crosshair feedback.
- desk precision gizmo/hotkey policy gate.
- wall screw/grommet hole mounted candidate admission과 commit guard 회귀.

Updated:
- P2 데스크테리어 편집 경험 고도화의 핵심 경로를 React component 중심에서 interaction-engine 중심으로 재정렬한다.
- Focus placement keyboard/numeric/candidate 전이는 machine event/result를 통해 처리한다.
- Candidate score/order/block reason은 `interaction-engine` helper 결과를 source of truth로 사용한다.
- Walk placement HUD는 target hint, active candidate feedback, pointer-lock status를 같은 overlay에서 표시한다.
- Desk precision은 기존 surface lock inspector/micro-view를 유지하면서 transform controls와 keyboard nudge/rotate를 사용할 수 있어야 한다.
- Attachment/collision hardening은 `edge_clamp`/`underside_screw`/`vesa_mount`에서 `wall_screw`/`grommet_hole`와 same-surface footprint collision까지 확장한다.

Removed/Deprecated:
- preview 중 scene document/store mutation이 발생해도 UI가 맞아 보이면 허용한다는 가정.
- controller가 candidate switch와 commit 가능 여부를 독자 판단하는 구조.
- wall/grommet attachment가 schema에만 존재하고 focus/kernel 제품 경로에서는 검증되지 않아도 된다는 가정.

## 2026-05-11 변경 동기화 (Actual SKU Prototype Asset)
Added:
- `p2s_fursys_setina_zdq012j`를 테스트용 실제 SKU reference rebuild로 추가한다.
- 이 SKU는 공개 제품 페이지의 1172x590x587mm, 높이 조절 587~1073mm, 23T 상판 정보를 기준으로 Blender source와 runtime GLB를 가진다.
- 제품 공개 페이지 URL, 상세 이미지 URL, prototype-only reference license, `releaseEligible=false`를 commercial readiness에 기록한다.

Updated:
- 실제 브랜드 제품을 repo catalog에 넣을 때는 운영 승격 전까지 `tier="draft"`와 `materialQaStatus="pending"`을 유지한다.
- 제조사 허가/CAD/reference license가 없는 실제 SKU rebuild는 테스트 catalog 검증에는 사용할 수 있지만 paid-beta hero catalog로 승격하지 않는다.

Removed/Deprecated:
- 공개 제품 사진만 보고 만든 브랜드 SKU를 바로 release eligible catalog로 취급하는 방식.

## 2026-05-12 변경 동기화 (Product URL Private Asset Runtime Pipeline)
목표:
- 현재 `ASSET_GENERATION` worker 구조를 확장해 `상품 상세링크 -> private generated asset -> editor catalog` 흐름을 런타임 job으로 연결한다.

진행:
- `packages/contracts/src/product-assets.ts`에 product URL request, private-only visibility, user generated asset catalog item contract를 추가했다.
- web route `POST /api/v1/product-assets/generate`가 Supabase session bearer token으로 API `/v1/product-assets/generate`를 프록시한다.
- API가 `PRODUCT_ASSET_GENERATION` job을 enqueue하고, private generated assets를 `GET /v1/assets`에서 owner-scoped signed URL catalog item으로 반환한다.
- worker claim/dispatch가 `PRODUCT_ASSET_GENERATION`을 처리하고, `asset-compiler` URL 분석 결과와 provider candidate GLB 중 best candidate를 Supabase `assets`에 private row로 등록한다.
- worker는 category profile을 적용한 뒤 provider candidate를 Blender finalizer로 정규화하고 candidate evaluator 점수로 best candidate를 고른다.
- Blender finalizer는 `scripts/blender/finalize-product-asset.py`에서 GLB import/export, 공식 치수 scale, floor-centered pivot, material slot 정리, thumbnail render, dimension QA report를 처리한다.
- evaluator는 reference image score, output size, finalizer status, dimension fit, thumbnail similarity를 점수화하고 `qa.candidateEvaluation`과 `qa.finalizerReport`에 증거를 남긴다.
- provider candidate 생성은 transient provider 오류(429/5xx/network/timeout)에 대해 후보별 retry/backoff를 먼저 수행하고, 후보 전체 실패 시에만 job retry/dead-letter를 사용한다.
- provider candidate 입력 이미지는 제품 단독 hero/front image를 우선하고, 긴 상세페이지 sheet/detail image는 reference evidence로는 보존하되 기본 생성 입력 1순위에서 제외한다.
- Meshy provider candidate 생성은 `MESHY_BUDGET_MODE=required`를 기본값으로 두며, remaining/cost budget env가 없거나 retry worst-case 예약량이 잔여 token/credit을 넘으면 외부 POST 전에 non-recoverable failure로 처리한다.
- editor catalog fetch가 static catalog 뒤에 `GET /api/v1/assets` private generated asset을 병합한다.
- walk/editor inventory shelf에 상품 URL 입력 폼을 추가하고, job succeeded 후 catalog를 refresh해 private asset을 선택 가능하게 한다.
- generated asset catalog item은 `qualityScore`를 보존하며, inventory card에서 `QA xx` 또는 `검수 필요` 상태를 표시한다.
- jobs RLS는 기존 `owner_id` payload와 현재 코드의 `ownerId` payload를 모두 인정하도록 마이그레이션을 추가했다.
- `verify:product-asset-generation`로 route, worker, DB/RLS, metadata, private catalog merge 계약을 고정했다.
- 로컬 Meshy smoke는 FURSYS `ZDQ012J` URL에서 `maxCandidates=1`로 성공했고, private asset `9b1c4c1a-0b4f-4342-a92c-782ffaf226eb`를 생성했다. GLB validation은 error 0, warning 1(tangent space)이며, 공식 치수 누락으로 QA는 `needs_review`다.
- So Ong visible-product Meshy/prototype preview는 `so-ong-space-meshy-preview-color-v2.png`를 별도 color QA artifact로 남기고, `verify:video-scene-reference`가 non-white / dark material / accent color coverage를 검사해 all-white fallback preview를 차단한다.

다음 순서:
- worker Docker/Railway image에 Blender binary와 optional Playwright crawler를 배포 환경으로 추가한다.
- provider별 multi-image/multi-view API adapter를 분리해 실제 Meshy/Tripo의 다중 이미지 입력을 쓰도록 확장한다.
- generated asset 상세 review UI에서 evaluator component breakdown과 finalizer warnings를 열람할 수 있게 한다.
- provider credential이 있는 환경에서 실제 product URL E2E job을 실행하고 `qualityScore`와 thumbnail 결과를 수동 검수한다.

Removed/Deprecated:
- 상품 URL generated asset을 public/static catalog manifest에 직접 쓰는 방식.
- provider candidate 산출물을 `referencePack`/private legal metadata 없이 에디터에 노출하는 방식.
- provider 산출물의 첫 번째 성공 후보를 QA evidence 없이 그대로 등록하는 방식.
- provider의 일시적 실패를 candidate retry 없이 곧장 job 실패로 처리하는 방식.
- Meshy API credential만 있으면 budget 확인 없이 생성 요청을 보내는 방식.

## 2026-04-19 심층 분석 기반 실행 순서
이 순서는 `/Users/sol/Downloads/DeskteriorOnline 정밀 공간 편집 시스템 심층 분석 보고서.docx`의 제안을 현재 room-first 제품 흐름에 맞게 재배열한 것이다. P0~P3의 큰 축은 유지하되, 실제 실행은 아래 Phase와 Slice 단위로 끊어서 진행한다.

### Phase 1. 측정 기반 고정
목표:
- 추측이 아니라 숫자로 회귀를 잡을 수 있는 기준선을 먼저 만든다.

이번 범위:
- `docs/performance-budget.md`를 route shell 지표 중심 문서에서 편집/렌더/피킹 예산 문서로 확장
- empty room, furnished room, dense desk, high fidelity toggle의 4개 시나리오를 공통 벤치마크로 고정
- DevTools와 `renderer.info` 기준의 수집 템플릿을 정의

세부 Slice:
- Slice 1. 문서 기준선 정리
- Slice 2. 계측 훅/로그 포인트 배치 (완료 2026-04-19)
- Slice 3. 회귀 비교 포맷과 QA 루틴 연결 (완료 2026-04-19)

완료 기준:
- draw call, textures, geometries, heap, picking latency, placement tolerance 예산이 문서화된다.
- 같은 장면을 dev/build 모두에서 반복 측정하는 절차가 고정된다.

## 2026-04-19 변경 동기화 (Phase 1 Slice 2 Complete)
Added:
- `SceneViewport`에 `deskterioronline:renderer-stats` 1초 샘플러를 붙여 FPS / draw calls / triangles / textures / geometries를 공통 이벤트 계약으로 노출했다.
- hover / select / drag-start / gizmo-drag-start의 next-paint 지연을 `deskterioronline:interaction-latency` 이벤트로 기록하는 계측 훅을 추가했다.

Updated:
- Phase 1 Slice 2를 `계측 훅/로그 포인트 배치` 완료 상태로 갱신한다.
- 원문 보고서의 `renderer.info 1초 샘플링 + 조작 지연 로그` 권고를 코드 계약 수준으로 반영한다.

Removed/Deprecated:
- SceneViewport 성능 계측을 수동 DevTools 세션에만 의존하던 상태.

## 2026-04-19 변경 동기화 (Phase 1 Slice 3 Complete)
Added:
- `window.__DESKTERIORONLINE_TELEMETRY_CAPTURE__` capture helper로 telemetry 이벤트를 regression entry JSON으로 묶는 경로를 추가했다.
- `perf:report:verify` / `qa:primary:perf` 스크립트로 예산 검증과 baseline delta 비교 루틴을 추가했다.

Updated:
- Phase 1 Slice 3을 `회귀 비교 포맷과 QA 루틴 연결` 완료 상태로 갱신한다.
- 원문 보고서의 `같은 장면 dev/build 비교` 권고를 JSON report + CLI 검증 흐름으로 고정한다.

Removed/Deprecated:
- 회귀 수치를 개발자별 자유 형식 메모에만 의존하던 상태.

### Phase 2. 자산 파이프라인 강제
목표:
- Blender source -> runtime GLB -> manifest -> 검증/최적화까지를 끊기지 않는 체인으로 만든다.

이번 범위:
- `assets:sync:deskterior` 이후에 validate -> optimize -> verify 실행 순서를 고정
- manifest에 물리 메타와 배치 앵커 품질 검증을 강화
- 신규 curated binary의 repo-public 추가 동결 원칙을 storage/CDN cutover와 같이 추적

세부 Slice:
- Slice 1. validate:gltf 추가 (완료 2026-04-19)
- Slice 2. optimize:gltf와 asset size/draw-call/triangle budget 연결 (완료 2026-04-19)
- Slice 3. anchor/support metadata 검증 확장 (완료 2026-04-19)

완료 기준:
- 새 deskterior 자산은 export -> sync -> validate -> optimize -> verify를 통과해야 한다.
- hero asset size와 texture 예산 초과가 CI 혹은 verify 단계에서 드러난다.

### Phase 3. 정밀 편집 엔진 분리
목표:
- room layout 편집과 desk precision 편집을 다른 조작 체계로 분리한다.

이번 범위:
- 저장 단위는 mm 정수, 렌더 경계는 meter float로 고정
- room mode는 top-down layout, desk precision mode는 surface/anchor 중심 미세 배치로 분리
- numeric inspector, measurement overlay, micro-view, surface lock의 우선순위를 명시

세부 Slice:
- Slice 1. 데이터 계약과 단위 타입 정리 (완료 2026-04-19)
- Slice 2. 카메라/스냅/피킹 정책 분리
- Slice 3. 정밀 배치 UI와 측정 오버레이
- Slice 4. save/load와 viewer 재현성 검증

완료 기준:
- 책상 위 자산 배치가 1~5mm 체감 오차 범위에서 유지된다.
- room mode와 desk precision mode가 서로의 조작 정책을 침범하지 않는다.

## 2026-04-19 변경 동기화 (Phase 3 Slice 3 Sub-slice 1)
Added:
- desk precision mode에서 선택 자산의 X/Y/Z + Yaw를 `mm/deg` 기준으로 보여주는 numeric inspector와 measurement overlay를 추가했다.

Updated:
- Phase 3 Slice 3을 `정밀 배치 UI와 측정 오버레이` 전체 완료 전 단계로 유지하되, sub-slice 1 범위를 `mm/deg numeric inspector + measurement overlay` 완료 상태로 기록한다.

Removed/Deprecated:
- inspector가 내부 meter/radian 값을 그대로 노출하던 기준.

## 2026-04-19 변경 동기화 (Phase 3 Slice 3 Sub-slice 2)
Added:
- desk precision mode에서 surface anchor 제품의 support asset / support surface / surface size / margin / top 높이를 보여주는 surface lock 상태 노출을 추가했다.

Updated:
- Phase 3 Slice 3은 여전히 진행 중으로 유지하되, sub-slice 2 범위를 `surface lock status exposure` 완료 상태로 기록한다.

Removed/Deprecated:
- support surface lock 상태를 별도 UI 없이 사용자가 추정해야 한다는 기준.

## 2026-04-19 변경 동기화 (Phase 3 Slice 3 Sub-slice 3)
Added:
- desk precision mode에서 support surface 내부 상대 위치를 보여주는 micro-view를 inspector/overlay 양쪽에 추가했다.

Updated:
- Phase 3 Slice 3은 여전히 진행 중으로 유지하되, sub-slice 3 범위를 `surface-local micro-view` 완료 상태로 기록한다.

Removed/Deprecated:
- support-local 위치를 숫자 텍스트만으로 확인하던 기준.

## 2026-04-19 변경 동기화 (Phase 3 Slice 3 Sub-slice 4)
Added:
- desk precision mode에서 surface anchor 제품의 footprint, projected footprint, edge clearance, relative yaw를 inspector/overlay/micro-view에 함께 노출했다.

Updated:
- Phase 3 Slice 3을 `정밀 배치 UI와 측정 오버레이` 완료 상태로 갱신한다.
- Phase 3 전체를 `Slice 1~4 완료` 상태로 갱신한다.

Removed/Deprecated:
- surface-local 위치를 point marker와 offset만으로 확인하던 기준.

### Phase 4. 모드별 렌더 품질 사다리
목표:
- top view, desk precision, walk/viewer가 같은 렌더 비용을 계속 지지 않도록 분리한다.

이번 범위:
- lazy load, active finish only, selective post FX, shadow budget, light budget을 모드별로 고정
- builder/editor/viewer에 서로 다른 render ladder와 idle profile을 적용

세부 Slice:
- Slice 1. top-entry lazy load 정리
- Slice 2. desk showcase preset과 shared viewer preset 분리
- Slice 3. 조명/후처리/그림자 토글의 비용 재배치

완료 기준:
- room mode와 shared viewer는 안정적인 route shell 성능을 유지한다.
- desk precision mode에서만 필요한 품질 효과가 선택적으로 활성화된다.

## 2026-04-19 변경 동기화 (Phase 4 Slice 1 Complete)
Added:
- top-view render-quality가 `topMode`를 읽고 room mode / desk precision mode에 다른 DPR, post FX, dynamic light budget을 적용하도록 연결했다.

Updated:
- Phase 4 Slice 1을 `top-entry lean preset + desk precision selective fidelity preset` 완료 상태로 갱신한다.
- room mode는 no post FX / no dynamic lights, desk precision mode는 capped dynamic lights / selective post FX 기준으로 범위를 구체화한다.

Removed/Deprecated:
- Phase 4 Slice 1을 단순 lazy-load 정리만 남은 상태로 보는 서술.

## 2026-04-19 변경 동기화 (Phase 4 Slice 2 Complete)
Added:
- `viewer-shared`와 `viewer-showcase` 품질 슬롯을 추가하고, shared viewer를 전용 preset으로 연결했다.

Updated:
- Phase 4 Slice 2를 `desk showcase preset과 shared viewer preset 분리` 완료 상태로 갱신한다.
- shared viewer는 hotspot/read-only 중심 경량 preset, showcase는 richer viewer preset 슬롯으로 문서상 역할을 분리한다.

Removed/Deprecated:
- shared viewer를 generic viewer preset에 계속 묶어두는 서술.

## 2026-04-19 변경 동기화 (Phase 4 Slice 3 Complete)
Added:
- shared viewer / showcase-walk 간 fill light, bloom, shadow 제거 순서를 명시한 cost reallocation 규칙을 추가했다.
- builder preview는 shared viewer와 별도 diorama profile로 분리해 bounded dynamic shadow + warm-tinted contact shadow를 유지하고 SSR/bloom/post FX를 끄는 비용 재배치 규칙을 추가했다.

Updated:
- Phase 4 Slice 3을 `조명/후처리/그림자 토글의 비용 재배치` 완료 상태로 갱신한다.
- shared viewer는 lean light rig, shared subtle post FX, constrained no shadow/contact shadow/bloom 기준으로 구체화하고, builder preview는 bounded diorama grounding profile로 분리한다.

Removed/Deprecated:
- Slice 3가 단순 토글 분리만 남은 상태라는 서술.

## 2026-04-19 변경 동기화 (KTX2 Runtime Ready + Demand Frame Loop)
Added:
- `assets:sync:ktx2-transcoder` 스크립트와 local basis transcoder public sync 경로를 추가했다.
- editor top-view와 builder preview에 demand frame loop + explicit invalidation 경로를 추가했다.

Updated:
- P2 자산 파이프라인 범위를 `Meshopt optimize + validate`에서 `Meshopt optimize + KTX2 runtime-ready decode + validate/require-ktx2 gate`까지 확장했다.
- `assets:optimize:deskterior` 기준을 단순 Meshopt extension write에서 `glTF Transform dedup + prune + meshopt` 체인으로 구체화했다.
- Phase 4 idle profile 범위를 품질 ladder 설명에서 실제 frame loop 정책 적용까지 확장했다.

Removed/Deprecated:
- top-view와 builder preview가 idle 상태에서도 continuous frame loop를 유지한다는 서술.

## 2026-04-20 변경 동기화 (Deskterior Optimize Chain Phase 1)
Added:
- `assets:optimize:deskterior -- --force --level high` 기준으로 curated `p2s_*` 런타임 GLB에 `glTF Transform dedup + prune + meshopt`를 재적용하는 안정화 단계를 추가했다.

Updated:
- 원문 보고서 기준 남은 `고급 자산 최적화 체인`을 “phase 1 완료, native gltfpack/instancing/LOD 운영화만 남음” 상태로 갱신한다.
- P2 자산 최적화 루프의 정의를 `meshopt 압축`에서 `dedup/prune + meshopt + validate/verify`로 확장한다.

Removed/Deprecated:
- 고급 자산 최적화 체인이 아직 meshopt 단일 패스밖에 없는 상태라는 서술.

### Phase 5. 공유/커뮤니티 안정화
목표:
- 정밀 편집 결과가 publish, shared viewer, gallery/community까지 동일하게 이어지게 한다.

이번 범위:
- read-only viewer 경량화
- shared snapshot과 community feed의 메타/썸네일/sceneDocument 일치성 강화
- 이후 collaboration/presence는 별도 실험 트랙으로 분리

세부 Slice:
- Slice 1. shared viewer runtime 경량화
- Slice 2. gallery/community summary와 필터 정확도 보강
- Slice 3. presence/realtime은 분리 브랜치에서 평가

## 2026-04-19 변경 동기화 (Phase 5 Slice 1 Complete)
Added:
- shared viewer 첫 진입을 `선택 없음` 상태로 시작하고, read-only HUD를 crosshair 제거 + walk touch HUD 유지 구조로 경량화했다.

Updated:
- Phase 5 Slice 1을 `shared viewer runtime 경량화` 완료 상태로 갱신한다.

Removed/Deprecated:
- shared viewer가 첫 자산 자동 선택과 editor형 HUD를 기본으로 유지한다는 서술.

## 2026-04-19 변경 동기화 (Phase 5 Slice 2 Complete)
Added:
- gallery/community 아카이브 summary를 active filter scope 기준으로 계산하는 서버 계층을 추가했다.

Updated:
- Phase 5 Slice 2를 `gallery/community summary와 필터 정확도 보강` 완료 상태로 갱신한다.
- gallery/community header, featured, latest, top collection, pagination total이 현재 페이지 조각이 아니라 filter scope 전체를 기준으로 읽히도록 정리한다.

Removed/Deprecated:
- filter 적용 후에도 total/latest/featured summary가 전체 공개 수나 현재 페이지 카드 일부에 의존해도 된다는 서술.

## 2026-04-19 변경 동기화 (Phase 5 Slice 3 Complete)
Added:
- presence/realtime 실험을 hidden route `/labs/realtime`와 local-only feature gate로 분리하는 경계를 추가했다.

Updated:
- Phase 5 Slice 3을 `presence/realtime은 분리 브랜치에서 평가`에서 실제 `primary flow 미연결 local-only lab isolation` 완료 상태로 갱신한다.

Removed/Deprecated:
- Slice 3가 향후 즉시 community/editor flow에 섞여도 된다는 서술.

## 2026-04-20 변경 동기화 (Presence/Broadcast Phase 1 Complete)
Added:
- `/labs/realtime`에 room query bootstrap, session key, heartbeat, occupancy snapshot panel, stale participant 표시를 추가했다.
- `useRealtime`, `useRealtimeSync`, `realtime-presence` helper를 도입해 local-only lab에서만 room/session foundation을 관리한다.
- `verify:realtime-lab`를 추가해 room normalization, channel name, stale cleanup snapshot 규칙을 검증한다.

Updated:
- `presence / broadcast` 남은 작업을 `Phase 1 foundation 완료` 상태로 갱신한다.
- 다음 후보를 `Phase 2 presence basics(cursor/camera/selection)`, `Phase 3 broadcast state`, `Phase 4 lab-only collaborative edit draft`, `Phase 5 hardening` 순으로 재정렬한다.

Removed/Deprecated:
- presence 실험이 hidden route 분리까지만 되어 있고 실제 room/session foundation은 전혀 없는 상태.

## 2026-04-20 변경 동기화 (Presence/Broadcast Phase 2 Complete)
Added:
- `/labs/realtime`에 cursor presence surface, view mode toggle, selected asset toggle을 추가해 lab 참가자끼리 ephemeral participant state를 공유하도록 확장했다.
- realtime presence contract를 `accentColor`, `viewMode`, `selectedAssetId`, `cursor(x/y)`까지 포함하도록 넓혔다.
- `verify:realtime-lab`를 Phase 2 기준으로 확장해 cursor/view/selection presence roundtrip을 검증한다.

Updated:
- `presence / broadcast` 남은 작업을 `Phase 2 basics 완료` 상태로 갱신한다.
- 다음 후보를 `Phase 3 broadcast state`, `Phase 4 lab-only collaborative edit draft`, `Phase 5 hardening` 순으로 재정렬한다.

Removed/Deprecated:
- lab이 active/stale occupancy만 보여주고 participant ephemeral state는 표현하지 않는 상태.

## 2026-04-20 변경 동기화 (Presence/Broadcast Phase 3 Complete)
Added:
- `/labs/realtime`에 presenter claim/release, follow presenter, spotlight asset, attention ping snapshot을 추가해 broadcast state 실험 범위를 닫았다.
- realtime presence contract를 `role`, `followingPresenterSessionKey`, `spotlightAssetId`까지 확장하고, active participant 기준으로 current presenter/spotlight를 파생한다.
- `verify:realtime-lab`를 Phase 3 기준으로 확장해 presenter resolution, spotlight, attention ping payload roundtrip을 검증한다.

Updated:
- `presence / broadcast` 남은 작업을 `Phase 3 broadcast state 완료` 상태로 갱신한다.
- 다음 후보를 `Phase 4 lab-only collaborative edit draft`, `Phase 5 hardening` 순으로 재정렬한다.

Removed/Deprecated:
- lab에서 presenter/follow/spotlight/ping이 전혀 다뤄지지 않고 presence basics까지만 있는 상태.

## 2026-04-20 변경 동기화 (Presence/Broadcast Phase 4 Complete)
Added:
- `/labs/realtime`에 sample asset board를 추가해 optimistic lock, drag move intent, release, conflict banner를 갖는 lab-only collaborative draft를 구현했다.
- collaborative draft helper를 도입해 `asset position`, `lock owner`, `last conflict`를 순수 함수로 전이시키고, `verify:realtime-lab`에서 lock/move/conflict/release 시퀀스를 검증한다.
- selection handoff를 lock owner와 연결해 asset claim 시 presence selected asset도 같이 갱신되도록 정리했다.

Updated:
- `presence / broadcast` 남은 작업을 `Phase 4 collaborative draft 완료` 상태로 갱신한다.
- 다음 후보를 `Phase 5 hardening` 하나로 축소한다.

Removed/Deprecated:
- lab이 presenter/follow/ping까지만 다루고 실제 collaborative draft 편집 보드는 없는 상태.

## 2026-04-20 변경 동기화 (Presence/Broadcast Phase 5 Complete)
Added:
- `/labs/realtime`에 runtime pause/resume, reconnect retry, reconnect count, stale participant archive 상태를 추가해 local-only lab hardening을 마감했다.
- `verify:realtime-lab`에서 stale archive health와 exit gate checklist까지 검증하도록 범위를 확장했다.
- exit gate checklist를 도입해 `local-only isolation`, `kill switch`, `reconnect control`, `stale cleanup`, `broadcast + draft coverage`를 한 화면에서 확인할 수 있게 했다.

Updated:
- `presence / broadcast` 남은 작업을 `Phase 5 hardening 완료` 상태로 갱신한다.
- 다음 후보를 `presence / broadcast lab 범위 완료`로 정리하고, 추가 협업 제품화는 별도 범위 재정의 후 착수하도록 갱신한다.

Removed/Deprecated:
- realtime lab에 reconnect hardening, stale archive, exit gate가 아직 없고 다음 단계로만 남아 있는 상태.

완료 기준:
- publish 후 shared viewer와 community 카드가 같은 장면 상태를 재현한다.
- viewer에는 editor 전용 affordance가 남지 않는다.

현재 착수:
- 완료: Phase 1 / Slice 1, Phase 1 / Slice 2, Phase 1 / Slice 3, Phase 2 / Slice 1, Phase 2 / Slice 2, Phase 2 / Slice 3, Phase 3 / Slice 1, Phase 3 / Slice 2, Phase 3 / Slice 3, Phase 3 / Slice 4, Phase 4 / Slice 1, Phase 4 / Slice 2, Phase 4 / Slice 3, Phase 5 / Slice 1, Phase 5 / Slice 2, Phase 5 / Slice 3
- 다음 후보: editor-side instancing 확대, 실사 강화 2차(SSR feasibility), P3 활동성 지표(조회/반응) 수집 및 피드 랭킹 개선

## 2026-04-20 변경 동기화 (BVH Worker Offload)
Added:
- loaded GLB 자산의 large non-interleaved geometry에 대해 `three-mesh-bvh` bounds tree 생성을 Web Worker queue로 오프로딩하는 경로를 추가했다.
- `deskterioronline:bvh-build` 브라우저 이벤트와 `window.__DESKTERIORONLINE_LAST_BVH_BUILD__` 스냅샷으로 worker/sync BVH build mode, triangle count, duration을 확인하는 측정 지점을 추가했다.

Updated:
- 원문 보고서 기준 남은 작업에서 `worker offload`의 첫 안전한 범위를 `loaded GLB BVH generation offload` 완료 상태로 갱신한다.
- P2 성능 개선 범위를 `BVH raycast baseline`에서 `BVH raycast + BVH generation worker offload`까지 확장한다.

Removed/Deprecated:
- loaded GLB bounds tree 생성이 항상 main thread sync compute에만 의존한다는 가정.

## 2026-04-20 변경 동기화 (Deskterior Metadata Contract Reinforcement)
Added:
- curated `p2s_*` 자산에 `source/license/pivot/collisionProxy/textureSet/lodProfile` 메타데이터 계약을 추가했다.
- `assets:sync:deskterior`, `assets:verify:deskterior`가 위 계약을 manifest 기준으로 강제하고, `verify:scene-document`, `verify:public-scene`가 save/load/share roundtrip 보존 여부를 점검하도록 확장했다.

Updated:
- 원문 보고서 기준 남은 작업에서 `자산 메타데이터 계약 보강`을 완료 상태로 갱신한다.
- 자산 품질 기준을 `supportProfile + physical metadata`에서 `supportProfile + physical metadata + source/license/pivot/collisionProxy/textureSet/lodProfile`까지 확장한다.

Removed/Deprecated:
- curated deskterior 자산 계약이 물리 메타데이터만 보장하면 충분하다는 가정.

## 2026-04-20 변경 동기화 (LOD Policy Operationalization)
Added:
- `lodProfile`를 room mode / desk precision / walk / builder preview 런타임 fallback 거리 정책으로 실제 연결했다.
- `verify:asset-lod` 스크립트를 추가해 complexity별 proxy fallback과 manual-lod bonus를 회귀 검증하도록 했다.

Updated:
- 원문 보고서 기준 남은 `instancing/LOD 운영화`를 “LOD policy phase 완료, native instancing만 남음” 상태로 갱신한다.

Removed/Deprecated:
- `lodProfile`가 문서/manifest에만 있고 런타임이 고정 거리 box proxy만 사용하는 상태라는 서술.

## 2026-04-20 변경 동기화 (Scene Instancing Phase 1)
Added:
- read-only top/walk에서 반복된 `single_mesh` low/medium complexity 자산을 instanced cluster로 묶는 첫 운영 단계를 추가했다. builder preview instancing은 2026-05-15 furnished starter proxy 기준으로 대체한다.
- `verify:asset-instancing` 스크립트로 editable top mode 제외, selected 제외, dynamic light 제외, manual LOD 제외, repeated cluster grouping 정책을 회귀 검증하도록 했다.

Updated:
- 원문 보고서 기준 남은 `instancing/LOD 운영화`를 “LOD policy 완료, read-only instancing 1차 완료, editor-side/native pass만 남음” 상태로 갱신한다.
- 다음 후보를 `native gltfpack pass`, `editor-side instancing 확대`, `실사 강화 2차` 중심으로 재정렬한다.

Removed/Deprecated:
- 반복 자산 instancing이 아직 전혀 런타임에 적용되지 않았다는 서술.

## 2026-04-20 변경 동기화 (Editor Desk Precision Instancing)
Added:
- editor `desk precision` top-view에서 반복된 `single_mesh` low/medium complexity 자산을 instanced cluster로 유지하는 2차 운영 단계를 추가했다.
- `verify:asset-instancing`가 editable `desk precision` eligibility와 selected asset 제외 후 cluster regrouping까지 점검하도록 확장했다.

Updated:
- 원문 보고서 기준 남은 `instancing/LOD 운영화`를 “LOD policy 완료, read-only instancing + editor desk precision instancing 완료, room-mode direct drag 확대만 남음” 상태로 갱신한다.
- 다음 후보를 `실사 강화 2차(SSR feasibility)`, `room mode direct-drag와 공존하는 editor instancing feasibility`, `P3 활동성 지표(조회/반응) 수집 및 피드 랭킹 개선` 순서로 재정렬한다.

Removed/Deprecated:
- editor top-view 전체가 instancing에서 제외되어야 한다는 서술.

## 2026-04-20 변경 동기화 (Native gltfpack Optional Chain)
Added:
- `assets:probe:gltfpack`와 `assets:optimize:deskterior:native` 스크립트를 추가해 native gltfpack binary를 저장소 파이프라인에서 직접 probe/run할 수 있게 했다.
- `assets:optimize:deskterior -- --native-gltfpack [--gltfpack-bin /path/to/gltfpack]` 경로를 추가해 기존 glTF Transform optimize 뒤에 optional native pass를 연결했다.

Updated:
- 원문 보고서 기준 남은 `native gltfpack pass`를 “probe + wrapper + pipeline wiring 완료, binary provision 후 실제 run만 남음” 상태로 갱신한다.
- 다음 후보를 `native gltfpack 실 run`, `editor-side instancing 확대`, `실사 강화 2차` 순서로 재정렬한다.

Removed/Deprecated:
- native gltfpack 적용이 저장소 밖 수동 명령에만 의존하던 상태.

## 2026-04-20 변경 동기화 (Repo-local gltfpack Environment)
Added:
- `assets:setup:gltfpack` 스크립트를 추가해 공식 `meshoptimizer` release의 `gltfpack-macos.zip`을 `.tools/gltfpack/current/gltfpack` 경로에 설치하는 repo-local 환경 구성을 추가했다.

Updated:
- native gltfpack 남은 작업 상태를 “probe + wrapper만 있음”에서 “repo-local setup + probe + wrapper 완료, 실제 native optimize run/검증만 남음” 상태로 갱신한다.

Removed/Deprecated:
- native gltfpack 환경 준비가 개발자별 전역 설치나 PATH 수동 설정에만 의존하던 상태.

## 2026-04-20 변경 동기화 (PBR Neutral Tone Mapping Phase 1)
Added:
- `SceneViewport` renderer 설정이 mode-aware tone mapping / exposure 값을 반영하도록 정리했다.
- `desk precision`, `builder preview`, `viewer-showcase`에 Neutral tone mapping을 연결하고, `room mode`, `viewer-shared`, 기본 walk-viewer는 ACES를 유지하는 품질 계단을 추가했다.

Updated:
- 원문 보고서 기준 남은 `실사 강화 2차`를 “PBR Neutral tone mapping phase 1 완료, SSR feasibility / showcase polish만 남음” 상태로 갱신한다.
- 다음 후보를 `editor-side instancing 확대`, `실사 강화 2차(SSR feasibility)`, `P3 활동성 지표(조회/반응) 수집 및 피드 랭킹 개선` 순서로 재정렬한다.

Removed/Deprecated:
- mode-aware render ladder가 light/post FX만 나누고 tone mapping/exposure는 SceneViewport 고정값에 묶여 있던 상태.

## 2026-04-20 변경 동기화 (SSR Feasibility Phase 1)
Added:
- `editor walk`와 `viewer-showcase` non-constrained profile에만 보수적 SSR을 연결하는 첫 운영 단계를 추가했다.

Updated:
- 원문 보고서 기준 남은 `실사 강화 2차`를 “PBR Neutral + selective SSR feasibility phase 1 완료, showcase polish만 남음” 상태로 갱신한다.
- 다음 후보를 `room mode direct-drag와 공존하는 editor instancing feasibility`, `P3 활동성 지표(조회/반응) 수집 및 피드 랭킹 개선`, `showcase polish` 순서로 재정렬한다.

Removed/Deprecated:
- SSR feasibility가 문서 계획만 있고 실제 품질 ladder에는 반영되지 않은 상태.

## 2026-04-20 변경 동기화 (Showcase Polish Phase 2)
Added:
- `viewer-showcase` 전용 camera/light polish preset을 추가해 walk FOV, top framing, accent fill/rim lighting을 일반 shared viewer와 분리했다.
- `verify:showcase-scene`가 showcase presentation preset의 tighter framing / richer lighting 계약까지 같이 점검하도록 확장했다.

Updated:
- 남은 `showcase polish` 상태를 “phase 2 camera/lighting fine-tune 완료”로 갱신한다.
- 다음 후보를 `presence / broadcast` 순서로 단순화한다.

Removed/Deprecated:
- showcase polish가 아직 카메라/라이팅 미세 조정 없이 SSR/tone mapping 단계에서만 멈춰 있다는 이전 상태 설명.

## 2026-04-20 변경 동기화 (Desk Precision Helper View)
Added:
- desk precision mode에서 support surface 기준 `front(X/H)` / `side(Z/H)` helper view를 inspector와 overlay에 추가했다.
- surface lock 계산에 `asset height`, `bottom gap`, `top reach`를 포함해 단면 보조 시각화에 필요한 vertical metric을 추가했다.

Updated:
- 원문 보고서 기준 남은 항목에서 `side/front helper view`를 완료 상태로 갱신한다.
- Phase 3의 정밀 측정 범위를 `numeric inspector + overlay + micro-view + helper view + verify chain`까지 포함한 확장 완료 상태로 정리한다.

Removed/Deprecated:
- side/front helper view를 아직 미구현인 다음 후보로 유지하던 서술.

## 2026-04-20 변경 동기화 (Room Shell KTX2 Wiring)
Added:
- room shell floor/wall procedural texture set에 `NEXT_PUBLIC_ENABLE_KTX2_TEXTURES=1`일 때 `.ktx2`를 우선 로드하고, 없으면 기존 JPG/PNG 경로를 유지하는 runtime wiring을 추가했다.
- `textures:encode:room-shell:ktx2`, `textures:check:room-shell:ktx2` 스크립트로 room shell texture set의 expected `.ktx2` 산출물을 encode/check 하는 파이프라인을 추가했다.

Updated:
- KTX2 남은 작업 범위를 "decode path 준비"에서 "room shell runtime wiring + encode/check 파이프라인 + 첫 room shell encode pass 완료 상태"로 갱신한다.

Removed/Deprecated:
- room shell texture set이 KTX2 산출물이 생겨도 별도 런타임 전환 경로 없이 JPG/PNG만 직접 참조한다는 가정.

## 2026-04-19 변경 동기화 (Phase 3 Slice 4 Sub-slice 1)
Added:
- save payload -> sceneDocument -> parse/load roundtrip에서 placement/support/product metadata를 검증하는 `verify:scene-document` 스크립트를 추가했다.

Updated:
- Phase 3 Slice 4를 구현 전 단계에서 `재현성 검증 게이트 추가` 진행 상태로 갱신한다.

Removed/Deprecated:
- save/load 재현성 점검이 수동 editor/viewer 확인에만 의존하던 기준.

## 2026-04-19 변경 동기화 (Phase 3 Slice 4 Sub-slice 2)
Added:
- shared_projects + pinned version + preview meta 조합에서 shared viewer payload 재현성을 검증하는 `verify:public-scene` 스크립트를 추가했다.

Updated:
- Phase 3 Slice 4를 `sceneDocument roundtrip verify`에서 `shared viewer payload verify`까지 포함한 상태로 확장한다.

Removed/Deprecated:
- publish/shared 재현성 점검이 수동 링크 확인에만 의존하던 기준.

## 2026-04-19 변경 동기화 (Phase 3 Slice 4 Sub-slice 3)
Added:
- gallery/community 카드 projection이 shared viewer public payload와 같은 token/version/preview asset summary를 유지하는지 검증하는 `verify:showcase-scene` 스크립트를 추가했다.

Updated:
- Phase 3 Slice 4를 `sceneDocument roundtrip -> shared viewer payload -> showcase card projection`까지 포함한 완료 상태로 갱신한다.

Removed/Deprecated:
- gallery/community 카드 메타 정합성을 수동 피드 확인에만 의존하던 기준.

## 품질/회귀 게이트
- `npm --workspace apps/web run type-check`
- `npm --workspace apps/web run lint`
- `npm --workspace apps/web run build`
- `npm --workspace apps/api run typecheck`
- `npm --workspace apps/worker run typecheck`

## 리스크
- 기존 DB의 floorplan/intake 관련 historical data는 더 이상 bootstrap source로 사용하지 않는다.
- `sceneDocument`가 없는 오래된 프로젝트는 초기 로드 시 empty bootstrap으로 처리될 수 있다.
- 자산 품질 편차(폴리곤/텍스처/스케일)는 Blender export 규칙 미준수 시 즉시 UX 저하로 이어진다.
- Blender 실행 파일 미탐지 환경에서는 export 자동화가 실패할 수 있으며(`BLENDER_BIN` 필요), preflight/report 모드로 사전 점검이 필요하다.
- 신규 자산 추가 경로에서 `activeAsset` 메타가 누락되면 fallback 규격으로 솔버가 동작하므로, catalog/입력 메타 품질 의존도가 남아 있다.
- Vercel/Railway 원격 프로젝트/환경 변수 정리는 인증된 inventory 확인 전까지 자동 삭제할 수 없다.
- mm 정수 계약 전환은 save/load, anchor solver, viewer 재현성을 동시에 건드리므로 단계적 마이그레이션이 필요하다.
- room mode와 desk precision mode 분리가 늦어지면 카메라/스냅/피킹 회귀가 계속 교차 발생할 수 있다.

## 2026-04-14 변경 동기화 (Legacy Hard Retirement + Deskterior Focus)
Added:
- floorplan/intake 레거시 제거를 P0 완료조건으로 명시.
- asset generation + Blender 파이프라인 중심의 P2 실행 항목.

Updated:
- 제품 완성 기준을 room-first deskterior + community shared viewer로 재정렬.
- 품질 게이트에 api/worker 타입체크를 병행하도록 추가.

Removed/Deprecated:
- legacy 트랙 및 존재하지 않는 `docs/legacy/*` 아카이브 경로 의존.
- floorplan eval/blind gate/intake e2e 기반 완료 조건.

## 2026-04-16 변경 동기화 (Reference Start Flow + Template Browser)
Added:
- P1 범위에 홈 시작하기 화면, 공간 선택 브라우저, seeded template bootstrapping을 명시.

Updated:
- room builder 완료 조건을 "직접 생성" 단일 경로에서 "템플릿 선택 + 맞춤 생성" 이중 경로로 확장.

Removed/Deprecated:
- 사용자가 빌더 내부에서만 템플릿을 고른다는 전제.

## 2026-04-16 변경 동기화 (Reference 4-Step Builder Shell)
Added:
- P1 범위에 레퍼런스 4-step builder shell, dimension overlay, opening/style step catalog UI를 명시.

Updated:
- builder 완료 기준을 "기능 존재"에서 "레퍼런스 쉘/단계 밀도/복원 안정성"까지 확장.

Removed/Deprecated:
- 이전 builder 상단 퀵 액션/step chip/summary card 중심 레이아웃.

## 2026-04-16 변경 동기화 (Editor Precision Controls)
Added:
- P2 범위에 `world/local` transform space 토글과 live placement clamp를 명시.

Updated:
- 상단뷰 편집 정확도 목표를 “snap + solver”에서 “snap + solver + live bounds”까지 확장.

Removed/Deprecated:
- gizmo 배치 보정이 drag 종료 후 한 번만 일어난다는 전제.

## 2026-04-16 변경 동기화 (Editor Reference Chrome Pass)
Added:
- P2 범위에 editor reference chrome 통일(top bar, slim catalog rail, right zoom rail, bottom pill toolbar, light share modal)을 명시.

Updated:
- 데스크테리어 편집 경험 목표를 “정밀 배치”에서 “정밀 배치 + 레퍼런스형 shell 일관성”까지 확장.

Removed/Deprecated:
- editor 상단/하단을 개별 floating card들로 유지하던 이전 shell.

## 2026-04-16 변경 동기화 (Shared Viewer + Furnished Feed Reference Pass)
Added:
- P3 범위에 shared viewer read-only mirror shell과 hotspot drawer 중심 상세 정보 구조를 명시.
- gallery/community의 레퍼런스 8번식 4열 furnished feed와 URL 기반 filter rail 유지 규칙을 명시.

Updated:
- 커뮤니티 공유/조회 경험 목표를 “데이터 흐름 안정화”에서 “데이터 흐름 안정화 + 레퍼런스형 viewer/feed chrome 일관성”까지 확장.

Removed/Deprecated:
- shared viewer hero metric strip과 community featured/recent 분리 카드 레이아웃.

## 2026-04-16 변경 동기화 (Start Flow Fixes + Builder Shell Fit)
Added:
- P1 범위에 `템플릿 선택 -> 즉시 editor 진입` 경로와 desktop builder shell fit을 명시.
- thumbnail storage bucket 누락 시 save fallback/retry를 P1 안정화 항목에 추가.
- P1 안정화 항목에 shape별 치수 clamp 정규화와 geometry 동기화 검증을 추가.

Updated:
- 템플릿 진입 완료 기준을 "builder 초기값 복원"에서 "saved project 생성 후 editor 직행"으로 변경.
- builder 완료 기준에 "페이지 무스크롤", "실제 floor outline 기반 치수 overlay"를 추가.
- P2 editor chrome 기준을 "slim rail" 일반론에서 "desktop left catalog 고정 + compact header + compact bottom toolbar"로 구체화.

Removed/Deprecated:
- 템플릿 선택이 항상 builder step flow를 지난다는 완료 조건.

## 2026-04-16 변경 동기화 (Community + Studio Shell Differentiation)
Added:
- P3 범위에 community 대화형 허브 구조(토론/챌린지/최신 게시물 구분)를 추가.

## 2026-04-17 변경 동기화 (Builder Shell Alignment Fix)
Added:
- P1 안정화 항목에 "builder step 3/4 wall/opening/collider exterior offset 정렬" 검증을 추가.
- P1 안정화 항목에 rect/L/U shape 브라우저 shell smoke를 명시.

Updated:
- builder opening step 완료 기준을 "개구부 배치 가능"에서 "wall/floor/opening이 한 좌표계에서 닫힌 shell로 보임"으로 강화.

Removed/Deprecated:
- rect template만 정상이어도 builder shell 안정화가 완료된다는 가정.

## 2026-04-17 변경 동기화 (Editor Top-View Interaction Fixes)
Added:
- P2 범위에 rotate-only orthographic top-view camera와 좌측 add/settings shared drawer UX를 명시.
- P2 회귀 항목에 mobile share modal fit과 top-view/walk-view ceiling visibility 분리를 추가.

Updated:
- 편집 경험 목표를 `reference chrome`에서 `reference chrome + top-view legibility + walk-view entry framing`까지 확장.
- P2 안정화 기준에 top-view camera drag와 furniture transform interaction 분리, concave room wall offset 정합성을 추가.

Removed/Deprecated:
- top-view 편집이 pan/move affordance와 별도 `목록/속성/항목뷰` 보조 UI에 의존한다는 가정.
- `/studio` 개인 아카이브를 gallery 톤 카드 피드 + 필터/검색 구조로 정리하는 UI 슬라이스를 추가.

Updated:
- 전역 navbar 정렬 기준을 우측 탭 구조로 맞추고, non-editor surface 레이아웃 오프셋 점검을 P3 UX 안정화 항목에 포함.

Removed/Deprecated:
- `/community`와 `/gallery`가 동일한 구조로만 유지된다는 가정.

## 2026-04-17 변경 동기화 (Platform Cleanup Audit)
Added:
- P0 완료 항목에 live Supabase legacy data purge(`floorplan_match_events`, `floorplan_results`, `floorplans`, `intake_sessions`, `floor-plans` bucket)를 추가.
- P2 진행 항목에 curated runtime asset의 storage/CDN cutover와 repo-public freeze를 추가.

Updated:
- platform cleanup 우선순위를 `live data purge -> direct DB migration -> Vercel/Railway authenticated inventory cleanup` 순서로 고정.

Removed/Deprecated:
- `apps/web/public/assets/*`를 계속 늘려도 운영 구조에 큰 문제가 없다는 가정.

## 2026-04-18 변경 동기화 (Platform Runtime Hard Cleanup)
Added:
- P0 완료 항목에 live Supabase legacy schema drop(`jobs.floorplan_id`, `project_versions.floor_plan`, `floorplans`, `intake_sessions`, `layout_revisions`, `source_assets`, `revision_source_links`)을 추가.
- Vercel preview 환경에 `RAILWAY_API_URL`, `SUPABASE_SERVICE_ROLE_KEY`를 채워 preview server-route parity를 확보한 운영 정리를 추가.

Updated:
- platform cleanup 상태를 `row purge only`에서 `row purge + schema drop + preview env parity` 완료로 상향.

Removed/Deprecated:
- legacy schema drop이 별도 maintenance window에 남아 있다는 이전 리스크.

## 2026-04-18 변경 동기화 (Viewport Performance Budget Pass)
Added:
- P2 진행 항목에 shared viewport mode-aware 품질 계단(top/builder 경량화, walk/viewer 유지)을 추가.

## 2026-04-18 변경 동기화 (Opening Asset Pass + Builder Entry Perf)
Added:
- P1 안정화 항목에 `선택한 벽으로 door/window 재배치`, `wall corner closed shell`, `opening asset runtime 경로 검증`을 추가.
- P2 진행 항목에 `top-view entry lazy load(HDRI/interactive lights/opening assets/full finish textures)`와 `opening GLB source/runtime 관리`를 추가.

Updated:
- builder opening step 완료 기준을 `wall 선택 + width/offset 조절 가능`에서 `wall reassignment가 시각적으로 즉시 반영되고, 코너 seam 없이 닫힌 shell이 유지됨`으로 강화.
- 렌더 최적화 범위를 `quality ladder`에서 `top-entry lazy load + active finish only texture load`까지 확장.

Removed/Deprecated:
- builder opening preview 내부 delete FAB와 하단 preview instruction 카드 의존.
- P2 안정화 항목에 top-view furniture drag local preview/commit 경로를 추가.

Updated:
- 데스크테리어 편집 성능 목표를 “기능 유지”에서 “60fps floor 확보를 위한 physics/shadow/post FX/drag churn 예산 관리”까지 확장.

Removed/Deprecated:
- builder/editor/viewer가 동일한 렌더 예산을 계속 공유해도 괜찮다는 가정.

## 2026-04-18 변경 동기화 (Builder Lighting Step + Top-View Interaction Cleanup)
Added:
- P1 범위에 builder final lighting step과 direct/indirect 저장 계약을 추가.
- P2 범위에 editor top-view button rotation 및 hidden material toggle 제거를 추가.

Updated:
- builder 완료 기준을 `4-step shell`에서 `5-step shell + lighting preview`까지 확장.
- 상단뷰 안정화 목표를 `drag 충돌 방지`에서 `drag 제거 + explicit rotate control`까지 강화.

Removed/Deprecated:
- 상단뷰 빈 공간 drag 회전 전제.
- 바닥/벽 클릭으로 재질을 바꾸는 임시 shortcut.

## 2026-04-18 변경 동기화 (Deskterior Asset Density Pass)
Added:
- P2 진행 항목에 Blender deskterior 자산 5종(머그/북스택/트레이/스피커/플랜터) 추가와 catalog verify 범위 확장을 명시.
- P2 안정화 항목에 `assets:optimize:deskterior` 기반 Meshopt 압축 루프를 추가.

Updated:
- 자산 품질 목표를 “source/export/sync 존재”에서 “source/export/sync/verify + open-source metadata density”까지 확장.

Removed/Deprecated:
- deskterior 신규 자산이 3종 curated baseline에만 머문다는 가정.

## 2026-04-19 변경 동기화 (Precision Editor Phase Plan From Analysis)
Added:
- 심층 분석 보고서 기반의 5단계 실행 순서(측정 기반 고정 -> 자산 파이프라인 강제 -> 정밀 편집 엔진 분리 -> 모드별 렌더 품질 사다리 -> 공유/커뮤니티 안정화)를 추가.
- P2 범위에 mm 정수 기반 placement 계약과 room mode / desk precision mode 분리 계획을 명시.
- 리스크 항목에 단위 계약 전환과 모드 분리 지연 리스크를 추가.

Updated:
- P2 Slice 1/2를 validate + optimize + budget gate 완료 상태로 갱신했다.
- deskterior 자산 완료 기준을 file size, draw call, triangle budget까지 포함하는 runtime gate로 강화했다.
- P2 Slice 3를 supportProfile surface/anchor metadata verify 완료 상태로 갱신했다.
- Phase 3 Slice 1을 `sceneDocument` mm 정수 placement snapshot 계약 도입 완료 상태로 갱신했다.

Updated:
- P2를 단일 대형 트랙이 아니라 Slice 단위로 끊어서 진행하는 실행 방식을 명시.
- 현재 착수 범위를 Phase 1 / Slice 1(성능 예산 재정렬)로 고정.

Removed/Deprecated:
- 정밀 편집 엔진, 자산 파이프라인, 실사 렌더 개선을 한 번에 병렬 추진한다는 가정.

## 2026-04-19 변경 동기화 (Phase 3 Slice 2 Complete)
Added:
- editor 상단뷰에 `room mode` / `desk precision mode` 토글을 추가하고, mode badge + bottom notice로 현재 정책을 노출한다.
- desk precision mode에서만 transform gizmo / hotkey / local transform space를 기본 사용하도록 편집 경계를 추가한다.

Updated:
- Phase 3 Slice 2를 `camera + snap + picking 정책 분리` 완료 상태로 갱신한다.
- room mode는 direct drag + 250mm snap, desk precision mode는 gizmo + 25mm / 15도 snap 기준으로 완료 조건을 구체화한다.

Removed/Deprecated:
- Phase 3 Slice 2를 단순 “향후 분리 예정” 상태로 두는 서술.

## 2026-04-14 변경 동기화 (Physical Fidelity Stage-1)
Added:
- Blender 실측 envelope를 기준으로 curated deskterior 규격 메타를 동기화하고 pipeline verify PASS 확보.
- 구조화된 물리 메타 기반의 에디터/뷰어 표시 및 스케일 잠금 런타임 적용.

Updated:
- P2 목표를 “메타 채움률”에서 “실측 정합성(표시+편집 보호)”까지 확장.

Removed/Deprecated:
- 규격을 `options` 텍스트로만 전달하던 방식.

## 2026-04-14 변경 동기화 (Physical Fidelity Stage-2)
Added:
- `anchors`/`support-profiles` 경로에 `dimensionsMm` 기반 support surface size/top 계산을 연결해 배치 정합성 개선.
- curated 자산 검증 스크립트에서 구조화된 물리 메타(`dimensionsMm/finishColor/finishMaterial/detailNotes/scaleLocked`)를 엄격 검증.

Updated:
- 런타임 GLB 렌더 경로에서 `finishColor`/`finishMaterial` 힌트를 보수적으로 재질 tint/roughness/metalness에 반영.

Removed/Deprecated:
- 물리 메타데이터가 뷰어 텍스트 표시 전용이라는 가정.

## 2026-04-14 변경 동기화 (Physical Fidelity Stage-3)
Added:
- `anchors` 물리 솔버에 wall clearance + inter-asset separation + bounded relaxation 루프를 추가.
- 신규 배치 경로(`project page`, `AI panel`)에 `activeAsset` 전달을 연결해 첫 배치부터 실측 규격 사용을 보장.
- `Furniture` 런타임 재질 경로에 Blender 알려진 슬롯 기반 slot-aware finish 매핑을 추가.

Updated:
- P2 목표를 support top 정합성에서 “표면 overhang/벽 간섭/자산 간 충돌 완화 + 슬롯별 재질 디테일”까지 확장.

Removed/Deprecated:
- 신규 자산은 물리 솔버에서 fallback bounds만 사용한다는 가정.

## 2026-04-14 변경 동기화 (Physical Fidelity Stage-4)
Added:
- 렌더 파이프라인에 홈 레퍼런스 룩 패스(HDRI 우선 선택 + 조명 리밸런싱 + 포스트FX 보정) 적용.
- fallback lighting 기본값을 레퍼런스 톤 기준으로 상향(ambient/hemisphere/directional/environmentBlur).

Updated:
- P2의 품질 범위를 물리 정합성 중심에서 "물리 정합성 + 홈 레퍼런스 시각 퀄리티"로 확장.

Removed/Deprecated:
- 톤 일관성 없이 scene별 초기 조명 체감이 달라지는 기존 기본값 전제.

## 2026-04-20 변경 동기화 (Showcase Viewer Presentation Phase 1)
Added:
- gallery/community 카드가 shared viewer를 `showcase presentation`으로 열도록 URL 계약(`source=showcase`)을 추가했다.

Updated:
- `showcase polish` 범위를 “viewer-showcase 렌더 ladder 정의”에서 “gallery/community 진입 경로까지 실제 연결”로 확장하고 phase 1 완료 상태로 갱신한다.
- 다음 후보를 `room mode direct-drag와 공존하는 editor instancing feasibility`, `P3 활동성 지표(조회/반응) 수집 및 피드 랭킹 개선`, `showcase polish phase 2(카메라/lighting fine-tune)` 순서로 재정렬한다.

Removed/Deprecated:
- `viewer-showcase`가 아직 실제 제품 플로우에는 연결되지 않았다는 이전 상태 설명.

## 2026-04-20 변경 동기화 (Room Mode Direct-Drag Instancing Phase 1)
Added:
- editor `room mode` top-view repeated asset도 idle 상태에선 instanced cluster로 유지하고, pointer-down 이후 live drag로 handoff 하는 범위를 추가했다.
- `verify:asset-instancing`가 room mode idle cluster와 dragging 중 selected asset 유지 정책까지 점검하도록 확장했다.

Updated:
- 원문 보고서 기준 남은 `instancing/LOD 운영화`를 “native pass 완료, editor desk precision + room mode idle instancing 완료, 후속은 polish/metrics뿐” 상태로 갱신한다.
- 다음 후보를 `P3 활동성 지표(조회/반응) 수집 및 피드 랭킹 개선`, `showcase polish phase 2(카메라/lighting fine-tune)`, `presence / broadcast` 순서로 재정렬한다.

Removed/Deprecated:
- `room mode direct-drag와 공존하는 editor instancing feasibility`가 아직 미해결이라는 이전 상태 설명.

## 2026-04-20 변경 동기화 (Showcase Activity Ranking Phase 1)
Added:
- `preview_meta + published_at` 기반 derived activity baseline과 community ranking helper를 추가했다.
- `verify:showcase-activity`로 recent/rich scene이 older/sparse scene보다 높은 rank를 받는지 회귀 검증하는 항목을 추가했다.

Updated:
- `P3 활동성 지표(조회/반응) 수집 및 피드 랭킹 개선` 상태를 “phase 1 derived ranking baseline 완료, phase 2 persisted engagement events 남음”으로 갱신한다.
- 다음 후보를 `P3 phase 2 persisted activity events`, `showcase polish phase 2(카메라/lighting fine-tune)`, `presence / broadcast` 순서로 재정렬한다.

Removed/Deprecated:
- community page가 화면 로컬 휴리스틱 like/reply 계산에만 의존하던 상태.

## 2026-04-20 변경 동기화 (Showcase Activity Ranking Phase 2)
Added:
- `shared_project_activity_events` 테이블과 shared viewer activity route를 추가해 `view`, `product_focus`를 session dedupe 기준으로 저장한다.
- shared viewer가 mount 시 `view`, 제품 선택 시 `product_focus`를 best-effort로 기록하고, community/feed가 persisted count를 ranking과 카드 지표에 반영하도록 확장했다.

Updated:
- `P3 활동성 지표(조회/반응) 수집 및 피드 랭킹 개선` 상태를 “phase 1 derived baseline 완료, phase 2 persisted activity events 완료”로 갱신한다.
- community conversation card 지표를 추정 `reply/like` 표기에서 persisted `포커스/조회` 표기로 전환한다.
- 다음 후보를 `showcase polish phase 2(카메라/lighting fine-tune)`, `presence / broadcast` 순서로 재정렬한다.

Removed/Deprecated:
- persisted activity 없이 `preview_meta + published_at` 추정치만으로 P3 활동성 지표를 마감할 수 있다는 이전 상태 설명.

## 2026-04-21 변경 동기화 (Editor Walk/Top QA Fixes)
Added:
- 배포 QA 이슈 대응 범위로 `project name inline edit/save`, `shared top 360 orbit`, `room shell texture fallback`, `desk precision detail pin` 작업을 추가했다.

Updated:
- P2 편집 품질 범위를 “mode split + precision overlay”에서 “mode split + precision overlay + top/walk presentation regression fixes”까지 확장한다.
- P3 shared viewer 범위를 “walk/shared/showcase shell”에서 “read-only top orbit + clearer walkthrough fallback”까지 확장한다.

Removed/Deprecated:
- 배포 환경에서 top-view flat shell과 walk-view texture failure를 별도 후속으로 미룬다는 가정.

## 2026-04-22 변경 동기화 (Revised Commercial Engine Refactor Kickoff)
Added:
- `benchmark-scenes` 4종과 `benchmark-runner/collect-baseline.ts` 기반 baseline artifact 경로를 추가했다.
- `packages/scene-schema`, `packages/engine-core`, `packages/renderer-three`, `packages/placement-kernel` alpha skeleton을 추가했다.
- `verify:runtime-engine`, `verify:placement-kernel`, `benchmarks:collect:baseline` 스크립트를 추가했다.

Updated:
- 초기 리팩터링 실행 순서를 `Baseline -> Minimal Package Split -> Asset Contract First -> Document/Runtime Split` 기준으로 재정렬한다.
- viewport migration을 `CanvasHost -> runtime bridge -> legacy SceneViewport` compatibility path 기준으로 시작한다.

Removed/Deprecated:
- 첫 단계에서 `asset-compiler`, `ui-kit`, `math`, `geometry`, extra apps/services`까지 동시에 열어야 한다는 가정.

## 2026-04-22 변경 동기화 (Document/Runtime Split Follow-up)
Added:
- `runtime-asset-bridge`를 추가해 top-view direct drag, gizmo transform, rotation hotkey가 runtime preview를 거친 뒤 commit 시점에만 store/document bridge를 통과하도록 연결했다.
- `verify:runtime-editor-bridge` smoke 검증을 추가해 preview 중 store 불변성과 commit 시 runtime patch + store update를 같이 점검한다.

Updated:
- `Document/Runtime Split`의 다음 실구현 범위를 “runtime skeleton 존재”에서 “실제 editor transform 경로 일부가 runtime preview/commit 브리지로 전환됨” 상태로 갱신한다.

Removed/Deprecated:
- top-view instanced drag 경로가 Phase 2 이전 상태 그대로 pointer-move store churn을 유지한다는 설명.

## 2026-04-22 변경 동기화 (Renderer Compatibility Follow-up)
Added:
- `runtime-engine-context`와 `runtime-render-sync` helper를 추가해 선택 자산 렌더 경로가 runtime object registry preview/transform을 직접 읽도록 연결했다.
- `verify:runtime-render-sync` smoke 검증을 추가해 runtime preview transform이 renderer object mutation helper로 반영되는지 점검한다.

Updated:
- `Renderer Adapter` 이전 compatibility 목표를 “CanvasHost에서 runtime bootstrap만 수행”에서 “CanvasHost + selected asset renderer sync까지 연결” 상태로 갱신한다.

Removed/Deprecated:
- renderer compatibility path가 아직 transform 소비 측면에서는 전부 legacy asset props에만 의존한다는 설명.

## 2026-04-22 변경 동기화 (Renderer Adapter Runtime Sync)
Added:
- `RuntimeRendererSync`와 `runtime-renderer-context`를 추가해 `CanvasHost` 하위 canvas tree가 `renderer-three` 어댑터를 직접 소비하도록 연결했다.
- `verify:runtime-renderer-adapter` smoke 검증을 추가해 runtime scene dirty object sync, object handle matrix, instance batch 생성을 점검한다.
- renderer adapter는 runtime scene generation 변경과 object removal까지 처리해 document replace 이후 stale handle/batch를 정리한다.

Updated:
- `Renderer Adapter` 단계의 실구현 상태를 “selected asset transform 소비”에서 “selected asset + instanced cluster가 renderer adapter snapshot과 버전 기반 sync를 사용함” 상태로 갱신한다.

Removed/Deprecated:
- instanced cluster imperative sync가 여전히 scene store asset props 변경에만 의존한다는 설명.

## 2026-04-23 변경 동기화 (Renderer Adapter Single-Object Follow-up)
Added:
- legacy material assignment를 `SceneDocumentV2.materials -> runtime object -> renderer adapter material registry`로 이어지는 snapshot 경로에 포함했다.
- single object render sync helper가 runtime engine fallback 전에 renderer adapter matrix snapshot을 우선 소비하도록 확장했다.

Updated:
- `Renderer Adapter` 단계의 실구현 상태를 “selected asset + instanced cluster sync”에서 “selected/single object + instanced cluster가 모두 renderer adapter snapshot을 우선 소비” 상태로 갱신한다.

Removed/Deprecated:
- single object 경로가 runtime preview 시점에도 engine object registry를 직접 읽어야 한다는 설명.

## 2026-04-23 변경 동기화 (Runtime Engine Incremental Object Sync)
Added:
- `Engine.syncDocument()`와 `verify:runtime-engine-document-sync` smoke 검증을 추가해 same-room object add/remove/material/placement 변경을 incremental runtime sync로 처리한다.
- `useRuntimeEngineBridge`는 room/environment 변화만 full replace로 보내고, object/material 변화는 incremental sync로 보낸다.
- renderer adapter는 same-object `assetId/runtimeAssetId` 교체와 removed selection/hover cleanup까지 incremental lifecycle 범위에 포함한다.

Updated:
- `Document/Runtime Split` 이후 브리지 상태를 “store commit 후 전체 document replace 재수렴”에서 “room은 replace, object는 incremental sync” 상태로 갱신한다.

Removed/Deprecated:
- runtime bridge가 asset lifecycle 변경마다 `replaceDocument()`만 사용해야 한다는 설명.

## 2026-04-23 변경 동기화 (Visibility Runtime Bridge Slice)
Added:
- `SceneAsset.visible -> SceneDocumentV2.object.visible -> RuntimeObjectRecord.visible -> renderer handle.visible` 경로를 추가했다.
- `Furniture`는 hidden object를 visible asset set 기준으로 제외해 instancing/single-object path 모두 runtime visibility를 따른다.

Updated:
- `Phase 3` compatibility path 범위를 transform/material lifecycle에서 visibility lifecycle까지 확장한다.

Removed/Deprecated:
- visibility가 store render에서만 처리되고 runtime bridge/renderer adapter는 모를 수 있다는 설명.

## 2026-04-23 변경 동기화 (Focus Placement Prototype Phase 5.5A)
Added:
- `useFocusPlacementStore`, `FocusPlacementController`, `FocusPlacementHud`를 추가해 walkthrough 기반 `desktop_top` 한정 focus placement session을 제품 경로에 연결했다.
- `verify:focus-placement` smoke 검증을 추가해 placement transaction preview, `surface_local` commit, `supportAssetId`/`anchorType` store bridge를 확인한다.

Updated:
- `Phase 5.5 Focus Placement Prototype` 상태를 “미착수”에서 “desk-top / selected-asset / keyboard nudge / commit alpha 완료”로 갱신한다.
- current phase의 남은 범위를 `camera-forward focus surface resolve polish`, `local grid overlay`, `asset compatibility filter`, `collision overlay`, `edge/underside/wall 확장`으로 정리한다.

Removed/Deprecated:
- focus placement prototype이 asset persistence bridge 없이 바로 full HUD부터 붙는다는 가정.

## 2026-04-23 변경 동기화 (Phase 5.5 Focus Placement Prototype Complete)
Added:
- `resolveFocusPlacementAvailability`와 interaction hint tone을 추가해 walk mode에서 desk surface를 바라볼 때 `정밀 배치`, `제품 선택 필요`, `규격 없음` 같은 진입 힌트를 제품 경로에서 바로 보여주게 했다.
- `FocusPlacementHud`는 local grid minimap, preferred/no-place zone count, snapped footprint 상태, collision/warning count를 함께 보여주는 richer status HUD로 확장됐다.
- focus placement request/session은 `surfaceBoundsMm`, `preferredZones`, `noPlaceZones`, `objectDimensionsMm`를 포함해 HUD가 support surface 로컬 맥락을 직접 렌더링할 수 있게 됐다.
- `verify:focus-placement`는 availability helper, snapped session pose, blocked HUD feedback, Enter 전 patch 0건, commit 이후 patch 1건까지 함께 검증한다.

Updated:
- `Phase 5.5 Focus Placement Prototype` 상태를 “desk-top / selected-asset / keyboard nudge / commit alpha 완료”에서 “desktop_top flow의 availability hint + local grid + collision/status HUD + snapped session consistency 완료”로 갱신한다.
- 다음 phase의 우선순위를 `Phase 6 Full Focus Placement Mode(edge/underside/wall/compatibility expansion)`로 올린다.

Removed/Deprecated:
- `camera-forward focus surface resolve polish`, `local grid overlay`, `asset compatibility filter`, `collision overlay`가 여전히 Phase 5.5 잔여라는 상태 설명.

## 2026-04-28 변경 동기화 (Walk Inventory Placement Slice)
Added:
- Walk inventory slice는 `I` shortcut drawer, selected asset draft, focused surface click/`E` session start, click/`Enter` commit, draft cancel cleanup을 포함한다.
- Functional browser E2E는 walk view에서 inventory shortcut으로 제품을 선택하고 focus placement HUD로 commit하는 경로를 검증해야 한다.

Updated:
- Top view scope is reduced to view-only orbit/zoom inspection; feature work for precise deskterior placement belongs in walk mode.
- Autosave payload must filter uncommitted walk inventory drafts until focus placement commits.

Removed/Deprecated:
- 상단뷰 direct drag와 desk precision gizmo를 이번 제품 배치 완성의 주 경로로 유지하는 계획.

## 2026-04-23 변경 동기화 (Phase 4 Asset Compiler Alpha Slice 1)
Added:
- `packages/asset-compiler` 패키지와 `apps/web/scripts/asset-compiler.ts` command surface를 추가했다.
- `asset:compile`, `asset:validate`, `asset:optimize`, `asset:verify`, `asset:publish`, `verify:asset-compiler` 스크립트를 추가했다.
- `asset:publish`는 alpha `runtime-packages.json`와 per-asset package descriptor를 생성한다.

Updated:
- `Phase 4 Asset Compiler Alpha` 상태를 “미착수”에서 “slice 1: package scaffold + command surface + alpha runtime package publish 완료”로 갱신한다.
- current phase의 남은 범위를 `ingest CLI`, `export/sync/validate/optimize 로직의 package 내부 이전`, `QA report enrichment`, `publish gate 강화`로 정리한다.

Removed/Deprecated:
- Phase 4가 시작되기 전까지 curated asset 정의와 compiler entrypoint가 app-local script에만 남아 있어도 된다는 가정.

## 2026-04-23 변경 동기화 (Phase 4 Asset Compiler Alpha Slice 2)
Added:
- `asset:ingest` command를 추가해 source path 기준 ingest draft를 `assets/ingest-staging`에 생성할 수 있게 했다.
- `asset:publish`는 per-asset descriptor 외에 `*.colliders.json`, `*.support-surfaces.json`, `*.attachment-points.json`, `*.material-variants.json`, `*.qa-report.json`을 함께 생성한다.
- descriptor에는 embedded `runtimeAsset`, generated file manifest, catalog-level `qaStatus/warningCount/surfaceCount/materialVariantCount`가 포함된다.

Updated:
- `asset:compile`는 `export -> sync -> verify -> publish` 순서로 alpha compiler gate를 통과한 뒤에만 package publish를 진행한다.
- `Phase 4 Asset Compiler Alpha` 상태를 “slice 1: scaffold + publish surface”에서 “slice 2: runtime package contract + sidecars + stronger publish gate + ingest scaffold 완료”로 갱신한다.
- current phase의 남은 범위를 `export/sync/validate/optimize package 내부 이전`, `attachment authoring enrichment`, `proxy/thumbnail 실제 산출`, `QA rule 고도화`로 재정렬한다.

Removed/Deprecated:
- descriptor JSON 하나만 있으면 alpha runtime package contract를 충분히 대표할 수 있다는 가정.

## 2026-04-23 변경 동기화 (Phase 4 Asset Compiler Alpha Complete)
Added:
- `packages/asset-compiler`가 `export/sync/validate/optimize/verify/verify-packages` 구현을 직접 소유하고, `apps/web/scripts/*deskterior*` 계열 스크립트는 thin adapter로만 남긴다.
- `asset:publish`는 curated asset별 실제 `*.proxy.glb`와 `thumbnails/*.webp`를 생성하고, runtime package directory/thumbnails directory의 stale artifact를 정리한다.
- `verify:asset-compiler`는 published descriptor, sidecar parity, file manifest, support surface bound, thumbnail/proxy 존재, runtime package directory hygiene까지 검증한다.

Updated:
- `asset:compile`는 `export -> sync -> verify -> validate -> publish -> published-package verify` 순서로 끝까지 통과해야 성공으로 본다.
- `Phase 4 Asset Compiler Alpha` 상태를 “slice 2 완료”에서 “package-owned compiler stages + actual proxy/thumbnail outputs + published package QA complete”로 갱신한다.
- 다음 phase의 우선순위를 `Phase 5 Placement Kernel Alpha 잔여 범위(surface resolver/snap/collision/attachment graph)`로 되돌린다.

Removed/Deprecated:
- app-local asset compiler script가 여전히 compiler business logic의 canonical 위치라는 가정.

## 2026-04-23 변경 동기화 (Phase 5 Placement Kernel Alpha Slice 1)
Added:
- `packages/placement-kernel`에 footprint helper, richer constraint validation, same-surface sibling collision validation, attachment graph query를 추가했다.
- `verify:placement-kernel`은 happy-path patch 생성뿐 아니라 `NO_PLACE_ZONE_OVERLAP`, `ATTACHMENT_NOT_ALLOWED`, sibling overlap collision을 함께 점검한다.

Updated:
- `Phase 5 Placement Kernel Alpha` 상태를 “foundation only”에서 “surface-local footprint bounds + restricted zone + attachment compatibility + same-surface collision alpha 완료”로 갱신한다.
- current phase의 남은 범위를 `snap candidate/grid quantization`, `ray picker real input`, `surface resolver compatibility enrichment`, `attachment point 기반 mounted flow`, `constraint report 확장`으로 재정렬한다.

Removed/Deprecated:
- placement kernel이 commit 전에도 사실상 happy-path만 통과시키고 invalid placement를 거의 걸러내지 못하는 상태 설명.

## 2026-04-23 변경 동기화 (Phase 5 Placement Kernel Alpha Complete)
Added:
- `SnapCandidateGenerator`, hit-candidate aware `RayPicker`, compatibility-enriched `SurfaceResolver`를 통해 surface-local snap quantization과 mounted surface auto-resolve를 kernel 기본 경로에 포함했다.
- `ConstraintSolver`는 `attachmentPoints[].compatibleWith`, attachment thickness constraint, mounted surface compatibility를 실제 오류 코드(`ATTACHMENT_SURFACE_INCOMPATIBLE`, `SURFACE_THICKNESS_INCOMPATIBLE`)로 검증한다.
- `PlacementTransaction.commit()`는 `update()`를 통한 candidate evaluation 없이 실행될 수 없도록 guard를 추가했다.
- `verify:placement-kernel`은 `begin -> commit` 금지, invalid candidate commit 차단, hit-driven mounted auto-resolve, snapped mounted placement persistence까지 검증한다.
- `verify:focus-placement`는 snapped session pose, Enter 전 `runtime-document-patch` 미발행, invalid candidate commit 차단, Esc/cancel preview cleanup까지 함께 검증한다.

Updated:
- `Phase 5 Placement Kernel Alpha` 상태를 “slice 1: validation alpha”에서 “snap + compatible surface resolve + mounted attachment validation + commit guard + product-path smoke complete”로 갱신한다.
- 다음 phase의 우선순위를 `Phase 5.5 Focus Placement Prototype 잔여 polish(local grid/compatibility hint/collision HUD)` 이후 `Phase 6 Full Focus Placement Mode`로 되돌린다.

Removed/Deprecated:
- `snap candidate/grid quantization`, `ray picker real input`, `surface resolver compatibility enrichment`, `attachment point 기반 mounted flow`, `constraint report 확장`이 여전히 Phase 5 잔여 범위라는 상태 설명.

## 2026-04-23 변경 동기화 (Phase 6 Full Focus Placement Mode Complete)
Added:
- focus placement request/session은 `surfaceCandidates`, `preferredCandidateIndex`, `activeCandidateIndex`를 포함해 하나의 walkthrough 세션 안에서 top/edge/underside/wall 후보를 순환할 수 있게 됐다.
- `Furniture`는 support asset의 runtime `supportSurfaces`와 선택 자산의 runtime `attachmentPoints`를 함께 읽어 focus placement 후보를 만들고, mounted candidate가 있으면 `edge_clamp` 같은 설치 흐름을 우선 노출한다.
- `FocusPlacementController`는 `Tab` 후보 순환, `F` 기본 후보 복귀, candidate별 step budget 재설정을 같은 runtime preview transaction 경로에서 처리한다.
- `verify:focus-placement`는 mounted edge 우선순위, candidate cycling helper, underside/wall candidate surfacing까지 함께 검증한다.

Updated:
- `Phase 6 Full Focus Placement Mode(edge/underside/wall/compatibility expansion)` 상태를 “다음 우선순위”에서 “multi-surface candidate + mounted compatibility + candidate cycle complete”로 갱신한다.
- 다음 phase의 우선순위를 `Phase 7 Advanced Attachments`로 올린다.

Removed/Deprecated:
- full focus placement mode가 여전히 `desktop_top` 한 경로만 제품에서 다룬다는 상태 설명.

## 2026-04-23 변경 동기화 (Phase 7 Advanced Attachments Slice 1)
Added:
- `packages/placement-kernel`에 `MonitorArmSolver`를 추가해 `monitor_arm` articulation의 revolute/prismatic joint 값을 target pose 기준으로 해석하는 첫 analytic solver를 도입했다.
- `ConstraintSolver`는 `vesa_mount` candidate에 대해 placed asset의 VESA pattern, support object의 VESA target 또는 articulation end-effector compatibility를 함께 검증한다.
- `PlacementTransaction`은 constraint evaluation 시 support object의 runtime asset metadata까지 함께 공급해 support-side attachment validation을 수행한다.
- `verify:advanced-attachments` smoke를 추가해 edge clamp 성공, VESA mount 성공, VESA pattern mismatch 차단, articulation unreachable detection을 함께 검증한다.

Updated:
- `Phase 7 Advanced Attachments` 상태를 “미착수”에서 “slice 1: vesa/articulation/kernel validation foundation 완료”로 갱신한다.
- current phase의 남은 범위를 `wizard UX`, `monitor target pose product-path 연결`, `clearance visualization`, `advanced attachment authoring enrichment`로 정리한다.

Removed/Deprecated:
- advanced attachment phase가 제품 경로 UI 이전에는 `edge_clamp` 외 mounted 타입을 전혀 검증하지 않아도 된다는 가정.

## 2026-04-23 변경 동기화 (Phase 7 Advanced Attachments Slice 2)
Added:
- walkthrough focus placement product path가 `vesa_mount` candidate를 실제 session 타입으로 올려 monitor-arm support surface에 바로 진입할 수 있게 됐다.
- `FocusPlacementController`는 `PageUp/PageDown` reach nudge와 monitor-arm default target pose seed를 추가해 target-pose 기반 wizard 조작을 runtime preview 경로에서 처리한다.
- `FocusPlacementHud`는 VESA panel/target pattern, wizard step badge, solved joint summary를 노출해 arm joint 직접 편집 없이 target pose 중심 흐름을 제공한다.
- `verify:focus-placement`는 monitor-arm VESA entry, articulated step budget, wizard model/shortcut exposure까지 함께 검증한다.

Updated:
- `Phase 7 Advanced Attachments` 상태를 “slice 1: vesa/articulation/kernel validation foundation 완료”에서 “slice 2: monitor-arm wizard + target-pose product path 완료”로 갱신한다.
- current phase의 남은 범위를 `clearance visualization`, `advanced attachment authoring enrichment`, `monitor-arm wizard polish`로 재정리한다.

Removed/Deprecated:
- monitor-arm target pose flow가 kernel validation만 있으면 제품 경로는 나중에 붙여도 된다는 가정.

## 2026-04-23 변경 동기화 (Phase 7 Advanced Attachments Complete)
Added:
- focus placement HUD는 authored `requiredThicknessMm`, `minClearanceMm`, `vesaPatternMm`, articulation reach limit을 requirement 카드와 clearance readout으로 노출한다.
- `verify:focus-placement`는 mounted authored requirement(thickness/clearance)와 monitor-arm authored requirement(VESA/reach) 노출까지 함께 검증한다.

Updated:
- `Phase 7 Advanced Attachments` 상태를 “slice 2: monitor-arm wizard + target-pose product path 완료”에서 “완료”로 갱신한다.
- 다음 phase 우선순위를 `Phase 8 Performance Hardening`으로 올린다.

Removed/Deprecated:
- advanced attachment authored metadata는 runtime validation에만 쓰고 사용자에게는 노출하지 않아도 된다는 가정.

## 2026-04-23 변경 동기화 (Phase 8 Performance Hardening Slice 1)
Added:
- `performance-budgets.ts` 공통 helper를 추가해 live renderer sample, interaction latency sample, BVH build sample, regression report entry가 같은 예산 함수를 사용하도록 정리했다.
- `SceneViewport` overlay에 `ScenePerformanceBudgetHud`를 추가해 telemetry 활성 중 draw call / FPS floor / heap growth / interaction latency / BVH offload 경고를 바로 읽을 수 있게 했다.
- `verify:performance-budget` 스모크를 추가해 live budget signal 경로와 regression entry budget 경로를 같이 검증한다.

Updated:
- `Phase 8 Performance Hardening` 상태를 “미착수”에서 “slice 1: live budget HUD + shared budget helper + signal smoke 완료”로 갱신한다.
- current phase의 남은 범위를 `dense-scene instancing hardening`, `memory leak detection`, `streaming/LOD tuning`, `benchmark CI tighten`으로 정리한다.

Removed/Deprecated:
- performance hardening이 regression JSON 수집만으로 충분하고, 편집 중 live 예산 피드백은 나중에 붙여도 된다는 가정.

## 2026-04-23 변경 동기화 (Phase 8 Performance Hardening Slice 2)
Added:
- `InstancedFurnitureCluster`는 cluster membership key를 기준으로 mesh rebuild와 transform sync를 분리해 dense-scene repeated asset churn 비용을 줄인다.
- `verify:asset-instancing`는 transform-only update가 cluster membership key를 유지하는지 함께 검증한다.

Updated:
- `Phase 8 Performance Hardening` 상태를 “slice 1: live budget HUD + shared budget helper + signal smoke 완료”에서 “slice 2: dense-scene instancing hardening(cluster rebuild avoidance) 완료”까지 확장한다.
- current phase의 남은 범위를 `memory leak detection`, `streaming/LOD tuning`, `benchmark CI tighten`으로 재정리한다.

Removed/Deprecated:
- dense-scene instancing churn 최적화가 아직 미착수라는 상태 설명.

## 2026-04-23 변경 동기화 (Phase 8 Performance Hardening Slice 3)
Added:
- `ScenePerformanceTelemetry` live renderer sample에 optional heap metrics(`heapUsedMb`, `heapLimitMb`, `heapGrowthPercentPoints`)를 추가한다.
- `verify:performance-budget`는 heap growth live issue까지 함께 검증한다.

Updated:
- `Phase 8 Performance Hardening` 상태를 “slice 2: dense-scene instancing hardening(cluster rebuild avoidance) 완료”에서 “slice 3: memory leak detection(live heap telemetry + HUD warning) 완료”까지 확장한다.
- current phase의 남은 범위를 `streaming/LOD tuning`, `benchmark CI tighten`으로 축소한다.

Removed/Deprecated:
- memory leak detection이 아직 미착수라는 상태 설명.

## 2026-04-23 변경 동기화 (Phase 8 Performance Hardening Slice 4)
Added:
- `resolveAssetLodPlan`에 focus priority를 추가해 selected/support/focus-placement asset이 top desk precision과 walk focus placement에서 full-detail LOD를 유지하도록 했다.
- `verify:benchmark-baseline`를 추가하고 `qa:primary:perf`를 self-contained performance gate로 고쳐 baseline template / live budget / instancing / LOD smoke를 한 번에 검증하도록 했다.

Updated:
- `Phase 8 Performance Hardening` 상태를 “slice 3: memory leak detection(live heap telemetry + HUD warning) 완료”에서 “완료”로 갱신한다.
- current phase의 남은 범위를 `0%`로 닫고 다음 phase 우선순위를 `Phase 9 Commercial QA`로 올린다.

Removed/Deprecated:
- `qa:primary:perf`가 외부 report 경로 인자 없이도 깨질 수 있는 느슨한 상태 설명.

## 2026-04-23 변경 동기화 (Phase 9 Commercial QA Slice 1)
Added:
- hidden route `apps/web/src/app/labs/qa/page.tsx`를 추가해 release gates, runtime asset publish 상태, benchmark baseline, compatibility matrix, scene integrity detector를 한 화면에서 읽는 commercial QA surface를 만든다.
- `apps/web/src/lib/qa/commercial-qa.ts`를 추가해 checked-in runtime package index와 benchmark baseline을 읽어 `verify:commercial-qa`와 lab route가 같은 snapshot을 공유하도록 한다.
- `apps/web/src/lib/domain/scene-integrity.ts`를 추가해 scene node id/assetId/support relation/surface-local placement 무결성을 검사하고 recovery snapshot을 산출한다.

Updated:
- `Phase 9 Commercial QA` 상태를 “다음 활성 타깃”에서 “slice 1: hidden QA dashboard + scene integrity detector 완료”로 올린다.
- project bootstrap diagnostics 기준을 단순 `source` 문자열에서 `source + integrity report + recovery snapshot` 구조로 확장한다.
- current phase의 남은 범위를 `asset status dashboard polish`, `placement regression suite aggregation`, `compatibility matrix 운영 검증`, `recovery snapshot / corruption detector 확장`으로 명시한다.

Removed/Deprecated:
- commercial QA 시작 단계에서는 별도 dashboard 없이 scattered verify script만으로 충분하다는 가정.

## 2026-04-23 변경 동기화 (Phase 9 Commercial QA Slice 2)
Added:
- commercial QA snapshot에 placement regression suite aggregation(`verify:placement-kernel`, `verify:focus-placement`, `verify:advanced-attachments`)을 추가해 mounted/surface placement 회귀 커버리지를 한 곳에서 읽도록 한다.
- scene integrity sample은 recovery snapshot 세부 수치(`duplicateNodeIdCount`, `selfSupportReferenceCount`, `invalidSurfacePlacementCount`)와 suggested action을 함께 노출한다.
- hidden QA surface에 runtime asset inventory table과 placement regression suite card를 추가해 asset status dashboard의 첫 운영형 표면을 제공한다.

Updated:
- `Phase 9 Commercial QA` 상태를 “slice 1: hidden QA dashboard + scene integrity detector 완료”에서 “slice 2: placement regression aggregation + recovery snapshot 확장 완료”로 올린다.
- current phase의 남은 범위를 `compatibility matrix 운영 검증`, `placement regression 실제 결과 집계`, `scene corruption detector 추가 규칙`, `asset status dashboard polish`로 다시 축소한다.

Removed/Deprecated:
- commercial QA가 release gate와 baseline만 보여주고 placement regression coverage는 별도 문맥에서 따로 추적해도 된다는 가정.

## 2026-04-23 변경 동기화 (Phase 9 Commercial QA Slice 3)
Added:
- compatibility matrix에 `requiredForRelease`, `lastVerifiedAt`, `verificationMethod`, `evidence`를 포함한 운영형 verification ledger를 추가한다.
- placement regression suite도 `lastVerifiedAt`, `verificationMethod`, `evidence`를 가진 운영형 ledger를 commercial QA snapshot에 포함한다.
- hidden QA surface는 compatibility verification evidence와 placement regression evidence를 같이 보여줘 release readiness 판단을 한 화면에서 내릴 수 있어야 한다.

Updated:
- `Phase 9 Commercial QA` 상태를 “slice 2: placement regression aggregation + recovery snapshot 확장 완료”에서 “slice 3: compatibility verification ledger + regression evidence ledger 완료”로 올린다.
- current phase의 남은 범위를 `scene corruption detector 추가 규칙`, `asset status dashboard polish`, `commercial QA release dashboard finish`로 다시 축소한다.

Removed/Deprecated:
- compatibility matrix가 profile 목록과 notes만 있으면 운영 검증 기록 없이도 충분하다는 가정.

## 2026-04-23 변경 동기화 (Phase 9 Commercial QA Slice 4 / Complete)
Added:
- commercial QA snapshot의 asset status에 `releaseReadyAssets`, `atRiskAssets`, `qaCoveragePercent`, `supportCoveragePercent`, `attachmentCoveragePercent`, `topRiskRows`를 추가한다.
- scene corruption detector에 `INVALID_NODE_SCALE`, `SUPPORT_REFERENCE_MISMATCH` 규칙과 `invalidScaleCount`, `mismatchedSupportReferenceCount` recovery snapshot 필드를 추가한다.
- hidden QA surface는 integrity severity summary와 prioritized recovery action까지 보여주는 release dashboard여야 한다.

Updated:
- `Phase 9 Commercial QA` 상태를 “slice 3: compatibility verification ledger + regression evidence ledger 완료”에서 “slice 4: asset risk summary + integrity detector expansion + release dashboard finish 완료”로 올리고 close 한다.
- current phase의 남은 범위를 `없음`으로 정리하고 다음 활성 타깃을 post-phase 운영 또는 신규 roadmap phase로 넘긴다.

Removed/Deprecated:
- asset inventory table과 기본 integrity count만 있으면 commercial QA release dashboard가 충분하다는 가정.

## 2026-04-24 변경 동기화 (P0 Audit Fix Slice)
Added:
- `primary:e2e:room-flow:strict`가 외부 base URL 없이도 로컬 production build/server를 자체 부트스트랩해 route shell contract를 검증하는 경로를 추가한다.
- editor undo/redo를 snapshot history 기반 `Cmd/Ctrl+Z`, `Shift+Cmd/Ctrl+Z`, `Ctrl+Y` 단축키로 노출하고, focus placement commit의 undo/redo smoke를 `verify:editor-undo-redo`로 고정한다.
- published `p2s_desk_oak` runtime package가 `desktop_top` 외에 `desk_edge`, `desk_underside` support surface를 함께 발행하도록 support profile authoring을 확장한다.
- apps/web catalog/store/runtime bridge가 authored support surface semantics(`surfaceType`, `allowedAttachments`, `thicknessMm`, `localFrame`)를 실제 focus placement runtime까지 보존하도록 보강한다.

Updated:
- post-phase P0 release blocker 중 `strict E2E self-contained`와 `desk package support surface semantics`를 코드 수정 대상으로 우선 처리한다.

Removed/Deprecated:
- strict room-flow 검증이 외부에서 이미 떠 있는 base URL에만 의존해도 충분하다는 가정.

## 2026-04-28 변경 동기화 (Walk Pointer Lock + AI Texture Slice)
Added:
- 워크뷰 pointer lock 입력 회귀 수정 slice를 추가해 canvas pointerdown/focus/requestPointerLock 이후 DevTools 없이 mouse-look + WASD를 확인한다.
- room shell 기본 텍스처 개선 slice로 생성형 wall/floor color texture를 public runtime asset에 추가하고 첫 번째 material preset에 연결한다.

Updated:
- P2 렌더/워크뷰 안정화 범위에 pointer lock state canonicalization과 생성형 texture baseline 교체를 포함한다.

Removed/Deprecated:
- 워크뷰 입력 문제를 사용자 DevTools focus workaround로 남겨두는 상태.

## 2026-04-24 변경 동기화 (Feature Completion Slice 1)
Added:
- Room visual quality 작업으로 wall/floor/ceiling shell에 real-scale texture repeat, material preview thumbnail metadata, 자동 baseboard, walk-mode ceiling trim/corner cap 기준을 추가한다.
- editor inspector는 wall/floor/ceiling 재질을 별도로 선택하고 preview thumbnail + category로 구분해 보여줘야 한다.
- walk-mode asset drawer와 focus placement numeric micro-adjust를 실제 editor UI 경로에서 사용할 수 있어야 한다.
- `functional:e2e:browser`를 추가해 로컬 브라우저에서 builder step, material selection, preview render, lighting selection을 검증한다.

Updated:
- 기능 완성도 평가는 P0 운영 gate와 분리하고, 실제 사용자 조작 기준으로 room quality / walk placement / catalog depth를 별도 판단한다.
- builder-preview render quality는 visual E2E와 사용자 preview를 위해 demand frameloop + explicit camera invalidation + post effect off + capture buffer on 조합을 사용한다.

Removed/Deprecated:
- verify script 통과만으로 데스크테리어 기능 RC를 선언할 수 있다는 가정.
- wall/floor만 재질 선택이 가능하면 room material system이 충분하다는 가정.

## 2026-05-01 변경 동기화 (Commercial Quality Gates Foundation)
Added:
- Phase 10 후보 범위를 `Actual SKU Asset Fidelity + Texture Material + Precision Placement + Lighting Realism`으로 추가한다.
- `packages/scene-schema/src/runtime-asset.ts`의 RuntimeAsset 계약에 `commercialReadiness`, `ProductReferencePack`, slot-level material metadata를 추가한다.
- `packages/asset-compiler` publish/verify는 commercial metadata를 descriptor/index/runtimeAsset/qa-report에 발행하고, missing/mismatched commercial readiness를 asset compiler verify에서 차단한다.
- `/labs/qa`는 actual SKU hero catalog gate와 wall/floor texture library gate를 포함한다.
- focus placement는 기본 `5mm / 1deg`, fine `1mm / 0.1deg` kernel snap을 지원한다.

Updated:
- Phase 2 자산 파이프라인 목표를 `source/export/sync/verify`에서 `referencePack + commercialReadiness + material QA + published package verify`까지 확장한다.
- Phase 3 정밀 편집 목표를 1~5mm 체감 오차에서 `5mm 기본 snap + 1mm fine snap + kernel/HUD/save 좌표 동기화`로 구체화한다.
- Phase 4 렌더 품질 목표를 mode별 비용 분리에서 lighting QA profile과 wall/floor texture quality tier까지 확장한다.

Removed/Deprecated:
- 현재 generic catalog가 곧바로 paid-beta hero SKU로 간주될 수 있다는 가정.
- AI 생성 texture baseline을 최종 상용 material로 보는 가정.

## 2026-05-02 변경 동기화 (Interaction Engine PR8 Asset Metadata Gate)
Added:
- `verify:asset-compiler`는 published runtime package마다 positive finite `dimensionsMm`, `units: "mm"`, descriptor/runtime dimension parity, `scaleLocked=true`, bounds-box collider, support surface frame/bounds, attachment point vectors/compatibility, `productId`, source provenance, SKU/manufacturer metadata를 검증한다.
- commercial QA snapshot은 `asset-metadata-gate` release gate와 `metadataGatePassedAssets` / `metadataGateFailedAssets` 집계를 포함한다.
- `verify:commercial-qa`는 모든 catalog asset이 metadata gate를 통과하고 placement regression coverage에 `wall_screw` / `grommet_hole`이 포함되는지 확인한다.

Updated:
- Phase 7 asset/product metadata pipeline 목표를 “sidecar 존재”에서 “sidecar 존재 + 값 유효성 + catalog traceability + commercial identity”까지 확장한다.
- release-ready asset 산정은 QA/file presence뿐 아니라 runtime metadata gate 통과를 전제로 한다.

Removed/Deprecated:
- runtime package descriptor와 sidecar가 존재하기만 하면 상용 catalog metadata로 충분하다는 가정.

## 2026-05-02 변경 동기화 (Interaction Engine PR9 Viewer Parity Gate)
Added:
- public scene payload는 `sceneSnapshot` parity metadata를 포함한다: pinned project version, document hash, schema version, node count, placement snapshot count, preview asset count, runtime asset ids, per-node runtime asset refs.
- `verify:viewer-parity`를 추가해 `verify:public-scene`과 `verify:showcase-scene`을 하나의 shared/showcase/community parity gate로 묶는다.
- commercial QA snapshot은 `viewer-parity` release gate와 viewer parity suite evidence를 포함한다.

Updated:
- shared viewer / showcase / community card는 같은 token, pinned version, preview asset summary, thumbnail source, scene snapshot refs를 기준으로 검증한다.
- shared scene payload 검증은 product metadata 보존뿐 아니라 scene document hash 안정성과 runtime asset ref parity를 확인한다.

Removed/Deprecated:
- shared viewer와 community/showcase card parity를 별도 smoke script 결과로만 보고 release gate에서 분리해도 된다는 가정.

## 2026-05-02 변경 동기화 (Interaction Engine PR10 Commercial QA Dashboard)
Added:
- commercial QA snapshot은 release gate 상태를 `readinessScore`로 압축한다: 0~100 score, pass/warning/fail status, gate count, blockers, warnings, summary.
- `/labs/qa` header는 readiness score와 warning/blocker 목록을 먼저 보여줘 기업 데모 가능성을 숫자로 판단할 수 있어야 한다.

Updated:
- commercial QA dashboard는 개별 카드 모음이 아니라 release readiness score를 가진 운영 판정 화면으로 취급한다.

Removed/Deprecated:
- release gate 카드들을 사람이 수동으로 훑어야만 현재 빌드의 상용 시연 가능성을 판단할 수 있다는 가정.

## 2026-05-02 변경 동기화 (Commercial Gate Closure + Docs Cleanup)
Added:
- 20개 내부 P2S hero SKU를 `hero_sku + release_ready + materialQaStatus=passed + releaseEligible=true` 기준으로 paid-beta demo catalog에 등록한다.
- `verify:commercial-qa`는 모든 release gate가 pass이고 readiness score가 100인지 확인한다.
- `docs/specs/README.md`는 DeskteriorOnline 활성 제품 스펙만 보관하고 외부 샘플/벤더 템플릿 문서는 배제한다는 기준을 명시한다.

Updated:
- `asset-qa`, `actual-sku-hero-catalog`, `texture-material-library` warning gate를 모두 pass 상태로 닫는다.
- generic catalog asset은 paid-beta hero SKU 미충족만으로 asset QA warning을 만들지 않고, hero SKU 승격 여부는 별도 release gate에서 판단한다.
- wall/floor commercial texture preset은 AI 1K 후보를 제외하고 2K PBR source + KTX2 target + 1K fallback metadata 기준만 commercial library로 본다.

Removed/Deprecated:
- AI 후보 텍스처가 commercial preset library에 섞여 있어도 paid-beta readiness를 pass로 볼 수 있다는 가정.
- 존재하지 않는 legacy docs path나 외부 샘플 프로젝트 문서를 활성 프로젝트 문서처럼 유지하는 방식.

## 2026-05-02 변경 동기화 (Walk Aim + Desk Preview Closure)
Added:
- PR 11 완료: `InteractionManager` crosshair raycast가 focus placement 가능한 support object를 조준하면 `deskterioronline:focus-placement:aim`을 발행하고 `FocusPlacementController`가 이를 `AIM_AT_SURFACE` + pending request로 연결한다.
- PR 11 완료: `walk-focus-aim` helper를 추가해 focus placement request -> interaction candidate 변환과 crosshair aim de-dup key를 공유한다.
- PR 11 완료: `desk-precision-hotkeys` helper와 batched preview commit을 추가해 keyboard nudge/rotate가 preview-only 상태를 거친 뒤 idle batch로 한 번만 commit한다.

Updated:
- `verify:walk-placement-ux`는 선택 제품 + crosshair target + candidate ranking + preview command + valid commit patch intent를 확인한다.
- `verify:desk-precision`은 5mm/1deg 정책뿐 아니라 keyboard hotkey가 `preview-batched` commit mode인지 확인한다.
- Focus placement의 목록 launcher는 보조 fallback이고, walk mode의 핵심 흐름은 crosshair aim driven preview로 격상한다.

Removed/Deprecated:
- `AIM_AT_SURFACE`가 타입/테스트에만 있고 앱 adapter에 연결되지 않은 상태.
- desk precision keyboard path가 `commitRuntimeAssetUpdateToStore`와 `recordSnapshot`을 keydown마다 직접 호출하는 상태.

## 2026-05-03 변경 동기화 (Walk Aim Confidence + Hotkey Exception Closure)
Added:
- PR 12 완료: `FocusPlacementRequest.aimRayHitConfidence`를 추가해 crosshair aim confidence가 pending request와 `START_PLACEMENT` candidate ranking까지 유지되도록 한다.
- PR 12 완료: `R` rotate hotkey를 desk precision preview-batched helper에 포함해 방향키/Q/E/R 모두 같은 renderer preview -> idle batch commit 계약을 따른다.
- PR 12 완료: `verify:walk-placement-ux`가 pending request confidence preservation을, `verify:desk-precision`이 `R` preview-batched rotate를 검증한다.
- PR 12 완료: shared viewer activity logging은 best-effort API로 유지하되 tracking 저장 실패가 브라우저 500 응답으로 남지 않도록 degraded 200 응답으로 낮춘다.

Updated:
- 기존 commit asset의 walk crosshair relocation은 자동 aim 대상이 아니라 명시 relocate/launcher 흐름으로 유지한다. 기존 asset 자동 재배치는 별도 제품 결정 후 phase backlog로만 추가한다.
- `functional:e2e:browser`의 현재 보장 범위를 로컬 브라우저 + 로컬 Supabase-backed save/reload/share parity로 명확히 하고, 운영 Supabase/prod 검증은 별도 gate로 남긴다.
- `functional:e2e:browser`는 shared viewer 렌더링 중 5xx 응답을 release-blocking regression으로 취급한다.

Removed/Deprecated:
- walk aim confidence가 이벤트 처리 이후 pending request activation에서 손실되는 상태.
- desk precision `R` 키가 keyboard transform preview/commit 계약에서 빠져 있는 상태.

## 2026-05-04 변경 동기화 (Walk Input Layout + Pointer Lock Fallback)
Added:
- PR 13 범위: `walk-keyboard` helper를 추가해 walk movement, inventory, interact shortcut을 physical `KeyboardEvent.code` 기준으로 판정한다.
- PR 13 범위: walk canvas는 pointer lock 요청 전에 focus를 먼저 확보하고, pointer lock이 실패한 경우에도 focused canvas에서는 WASD movement fallback을 허용한다.
- PR 13 범위: `verify:walk-placement-ux`가 non-English key label에서도 `KeyW`/`KeyA`/`KeyI`/`KeyE`가 동작하고 editable field에서는 shortcut을 무시하는지 확인한다.
- PR 13 범위: desk precision `Q/E/R` hotkey도 physical `KeyQ`/`KeyE`/`KeyR`를 우선해 preview-batched 계약을 유지한다.

Updated:
- P2 렌더/워크뷰 안정화 범위의 pointer lock 회귀 수정은 browser pointer lock 성공만이 아니라 focus fallback, layout-independent shortcuts, HUD recovery 안내까지 포함한다.
- Vercel 운영 진단은 dashboard preview panel 403, Deployment Protection, 앱 직접 접속, Supabase browser session persistence를 분리해 판단한다.

Removed/Deprecated:
- pointer lock이 실패하면 WASD가 완전히 무반응이어도 되는 상태.
- `event.key` label만으로 walk/desk precision shortcut을 판정하는 구현.
- 새 배포가 기존 브라우저 로그인 세션을 자동으로 초기화해야 한다는 배포 기준.

## 2026-05-04 변경 동기화 (Inventory Asset Thumbnails)
Added:
- Walk inventory/library slice는 asset 선택 카드에 catalog thumbnail image를 표시하는 것을 포함한다.
- `verify:inventory-thumbnails`를 추가해 catalog thumbnail coverage, public asset file existence, relative `/assets/...` image path preservation을 release-adjacent check로 둔다.

Updated:
- P2 editor chrome 기준의 catalog/inventory rail은 compact text list가 아니라 visual asset picker로 취급한다. thumbnail이 없는 item도 fallback preview를 보여줘 selection affordance를 유지해야 한다.

Removed/Deprecated:
- inventory에서 asset 이름과 collection text만으로 제품 생김새를 유추하게 하는 구현.

## 2026-05-06 변경 동기화 (Commercial Builder/Editor Acceptance Pass)
목표:
- room builder와 walk placement를 preview -> validate -> commit -> save/reload/share parity 계약으로 묶고, 임시 데모처럼 보이던 opening/material/lighting/inventory 흐름을 조작 가능한 상용 builder 기능으로 승격한다.

진행:
- PR 4 완료: inventory click은 canonical scene store를 오염시키지 않고 `placementDraft`와 renderer ghost preview만 시작한다. valid floor/world click 또는 active focus placement commit에서만 draft asset이 store/document에 추가된다.
- PR 1 완료: builder opening step에서 벽 선택, opening 선택/드래그, offset/width/height/sill 조정, 삭제, edge clearance/overlap block을 지원하고 `verify:room-openings`로 payload persistence와 GLB 존재를 검증한다.
- PR 2 완료: wall/floor preset을 clean commercial default 중심으로 재분류하고, builder finish 목록과 thumbnail preview를 texture preset metadata에서 파생한다. `verify:material-presets`로 preset 수, default cleanliness, asset existence, builder parity를 검증한다.
- PR 3 완료: builder lighting step은 direct fixture count 1/2/3/4/6, 2D layout drag, intensity, color temperature, beam radius/spread 조정을 지원한다. `LightingSettings.fixtures[]`를 save/load/viewer payload에 보존하고 `verify:lighting-layout`로 검증한다.

다음 순서:
- 전체 gate(`type-check`, `lint`, `build`, interaction/focus/placement/render/viewer parity, 신규 4개 verify)를 통과시킨다.
- 가능하면 local Supabase와 production Supabase evidence를 구분해 `functional:e2e:browser` 결과를 기록한다.

Added:
- `verify:inventory-ghost-placement`, `verify:room-openings`, `verify:material-presets`, `verify:lighting-layout`.
- `LightingFixture` 저장 계약과 direct fixture layout builder UI.
- opening placement issue contract(`EDGE_CLEARANCE`, `OPENING_OVERLAP`, `WALL_MISSING`).

Updated:
- P1 room builder 범위는 shape/dimension/style에서 opening 조작, clean material preset, persisted lighting fixture layout까지 확장한다.
- P2 walk placement의 핵심 acceptance는 inventory ghost placement의 no-auto-commit 원칙을 포함한다.

Removed/Deprecated:
- inventory click 즉시 확정 배치.
- direct lighting fixed 3 auto layout.
- default material preset에 damaged/dirty/industrial wall을 노출하는 구성.

## 2026-05-07 변경 동기화 (Opening Renderer Hardening)
Added:
- `verify:room-openings`는 opening normalization 외에 renderer path wiring, variant metadata, procedural fallback smoke nodes, material contrast를 확인해야 한다.

Updated:
- builder/editor/shared opening parity 작업을 file existence gate에서 shared renderer contract gate로 강화한다.

Removed/Deprecated:
- opening verify가 GLB 파일 존재 여부만 확인하는 상태.

## 2026-05-07 변경 동기화 (Walk Pointer Lock HUD Fix)
Added:
- `verify:walk-keyboard`와 `functional:e2e:browser`는 pointer lock denied 상태에서 canvas-focus movement/mouse-look fallback과 HUD 문구 회귀를 같이 검증해야 한다.

Updated:
- walk shortcut 회귀 대응 범위는 WASD/I/E뿐 아니라 pointer lock 실패 후 crosshair control text가 unavailable에 고정되지 않는지까지 포함한다.

Removed/Deprecated:
- pointer lock 실패를 movement-blocked 상태로 저장해 사용 가능한 fallback UX 위에 경고를 계속 띄우는 상태.

## 2026-05-11 변경 동기화 (Product URL -> Prototype SKU Asset)
Added:
- `packages/asset-compiler`에 `analyze-url` command를 추가해 제품 URL에서 prototype-only `reference-pack.json`을 생성한다.
- FURSYS SETINA/TIERRA `ZDQ012J` 책상은 URL 분석 결과, 공식 치수 override, procedural PBR material pass, slot-level pending material metadata를 가진 draft SKU asset으로 유지한다.
- `verify:product-url-reference`를 추가해 URL 분석 contract를 네트워크 없는 fixture 기반 smoke로 고정한다.

Updated:
- 실제 SKU asset 자동화 목표는 `URL scrape -> referencePack draft -> Blender rebuild/material pass -> runtime GLB export -> asset publish/verify` 순서로 진행한다.
- FURSYS prototype asset의 visual fidelity score는 material pass 반영으로 0.84로 올리되, material QA와 license가 pending이므로 `releaseEligible=false`를 유지한다.
- 제품 URL 기반 material hint는 운영 catalog 승격 증거가 아니라 Blender authoring seed로만 사용한다.
- FURSYS prototype desk budget은 visible material veneers, tangent-bearing normal map, 실제 SKU silhouette 세부를 포함하기 위해 `maxTriangleCount=9000`, `maxFileSizeBytes=1.65MB`, `maxDrawCalls=24`로 관리한다.

Removed/Deprecated:
- 링크 분석 없이 수동 메모만으로 실제 SKU reference metadata를 관리하는 방식.
- 공개 제품 이미지를 직접 texture로 쓰거나, 제조사 허가 없이 실제 브랜드 asset을 release-ready로 표시하는 방식.

## 2026-05-12 변경 동기화 (Private Product Asset Factory)
Added:
- `packages/asset-compiler`에 `factory` command를 추가해 product URL reference pack을 asset 제작 지시서와 QA/repair loop로 변환한다.
- factory output은 `assets/references/product-pages/<assetKey>/asset-factory/` 아래에 `asset-plan.json`, `factory-qa-report.json`, `repair-instructions.json`, `private-catalog-entry.json`, `build-<assetKey>.py`를 남긴다.
- `verify:product-asset-factory`는 FURSYS `ZDQ012J`를 기준으로 Blender source, runtime GLB/proxy, inventory thumbnail, runtime sidecars, dimension fidelity, material pending state, private-only visibility, release blocking을 검증한다.

Updated:
- 실제 SKU asset 자동화 목표는 `URL scrape -> referencePack draft -> factory plan -> Blender/procedural rebuild -> runtime sidecars/thumbnail -> factory QA -> repair instruction -> private catalog entry` 순서로 확장한다.
- 개인 테스트용 asset은 `ready_for_private_use`가 될 수 있지만, material QA와 licensing이 pending이면 `commercialStatus=needs_repair`, `releaseEligible=false`를 유지한다.
- FURSYS `ZDQ012J` factory fixture는 치수 오차 0mm, artifact completeness 1.0, private readiness 0.885를 기준 evidence로 남긴다.

Removed/Deprecated:
- Blender asset 생성 지시서와 runtime artifact QA를 분리하지 않고 “대충 만들어진 GLB”만 catalog에 넣는 방식.
- prototype/private asset과 commercial hero SKU의 gate를 같은 상태값으로 관리하는 방식.

## 2026-05-11 변경 동기화 (Creator Video Reference Pack)
Added:
- So Ong desk setup video의 comment-listed 제품 20개를 `p2s_video_so_ong_*` namespace의 `prototype_reference_only` catalog asset으로 추가한다.
- 각 제품은 procedural GLB, inventory SVG thumbnail, source product URL, prototype-only license, scale-locked dimensions, reference layout entry를 가진다.
- `verify:video-scene-reference`를 추가해 20개 제품 coverage, catalog exposure, GLB/thumbnail existence, prototype-only gate, scene layout coverage, preview render artifact를 검증한다.

Updated:
- 영상/크리에이터 셋업 기반 asset 작업은 상용 SKU promotion이 아니라 reference scene pack으로 시작한다. 제조사 CAD/권리/치수/재질 QA가 붙기 전까지 `releaseEligible=false`로 유지한다.
- “영상과 같은 느낌” 검증은 먼저 흰 데스크, 초대형 모니터, 보조 디스플레이, PC 타워, 스피커, 소품, 라벤더 조명감이 맞는지 visual smoke render로 확인하고, 이후 service browser scene parity로 승격한다.

Removed/Deprecated:
- YouTube/product 링크만으로 실제 브랜드 제품을 release-ready catalog asset으로 취급하는 방식.
- 제품명이 있는 catalog entry를 만들고 실제 모델/썸네일/배치 레이아웃 검증을 생략하는 방식.

## 2026-05-11 변경 동기화 (Creator Video Reference Pack Extended)
Added:
- So Ong reference pack을 사용자가 추가 제공한 제품까지 포함해 28개 unique product reference로 확장한다.
- 추가 asset: OFRAME dual monitor riser, Razer Cobra Pro White, Zionworks/Aiglatson SYNCHRONIZE mat, Angry Miao AM HATSU, Elgato Stream Deck Neo, reProducer Epic 5, HYTE Y70 Snow White, Itsub x Atom 60th figure.
- reference smoke render는 HYTE Y70 내부 RGB 팬/유리 케이스, Epic 5 스피커, AM HATSU split keyboard, Cobra Pro mouse, Stream Deck Neo, SYNCHRONIZE mat가 보이는 screenshot-match composition을 포함한다.

Updated:
- `verify:video-scene-reference`의 count gate는 20개에서 28개로 갱신하고, 새 primary visible 제품이 scene layout에 포함되는지 확인한다.
- 접근 가능한 공식/판매 상세 페이지에서 확인 가능한 dimensions는 `manufacturer_or_vendor_page`로 승격하되, 직접 접근이 막힌 제휴/단축 링크는 제품명 기반 보조 검색과 visual estimate로만 유지한다.

Removed/Deprecated:
- 영상 속 핵심 제품을 generic keyboard/mouse/speaker/mat/PC case catalog asset으로 대체하는 reference scene 구성.

## 2026-05-11 변경 동기화 (Creator Video Product Detail Reconciliation)
Added:
- So Ong reference pack에 product-detail reconciliation pass를 추가해 공개 상세/스펙 페이지에서 확인 가능한 치수와 실제 화면 실루엣의 불일치를 다시 보정한다.

Updated:
- GravaStar Mars Pro는 201 x 180 x 191 mm 외곽 기준으로 procedural envelope를 재조정한다.
- OFRAME dual monitor riser는 1000 x 250 x 120 mm shelf layer로 확대해 좌측 PC/소품 stack의 실제 reference 비율에 맞춘다.
- Elgato Stream Deck Neo는 107 x 78 x 26 mm low tabletop controller footprint로 수정하고, 기존의 세로로 높은 임시 블록 형태를 폐기한다.
- smoke render는 darker woven desk mat, off-white desktop, lavender wall wash, reduced neutral fill을 기준으로 재생성해 reference still의 보라색 조명감과 흰색/검정 재질 대비를 더 가깝게 맞춘다.

Removed/Deprecated:
- public/product detail page에서 확인 가능한 치수를 알면서도 visual-estimate scale만 유지하는 방식.
- controller, speaker, mat처럼 사용자가 가까이 보는 소품을 단순 box silhouette로 남기는 방식.

## 2026-05-12 변경 동기화 (Creator Video Reference Fidelity Pass)
Added:
- So Ong reference pack inventory thumbnail은 실제 Blender model render 기반 WebP artifact로 생성하며, `verify:video-scene-reference`가 placeholder 수준 파일을 차단한다.
- reference smoke render는 HYTE Y70/OFRAME stack, Epic 5 양쪽 스피커, TFG40Q14WP, CPM1610IQ, AM HATSU, Cobra Pro White, Stream Deck Neo, SYNCHRONIZE mat, IVY, Mars Pro, Times Gate를 같은 배치 contract로 보여준다.

Updated:
- 흰색 plastic/laminate material과 preview lighting을 재보정해 desk surface가 blank white plane처럼 날아가지 않도록 한다.
- reference preview room은 라벤더 wall wash와 확장된 desk/wall shell을 사용해 영상 still의 cool-white desk setup mood를 우선 검증한다.
- 영상 기반 제품 asset은 계속 `prototype_reference_only`, `releaseEligible=false`로 유지하고, 제조사 CAD/라이선스/정밀 material QA가 붙기 전까지 실제 상용 SKU asset으로 승격하지 않는다.

Removed/Deprecated:
- inventory thumbnail을 generic SVG/card로 대체해 사용자가 제품 생김새를 이름으로만 추론하게 만드는 방식.
- smoke render가 제품 배치 대신 파일 존재 검증만 통과하는 상태.

## 2026-05-12 변경 동기화 (Creator Reference Signature Rebuild)
Added:
- So Ong reference pack 생성 스크립트가 hero asset별 product-signature fragments를 정의하고 `visual-fidelity-report.json`에 signature score, object count, GLB size, private prototype status를 기록한다.
- reference smoke render는 product-only GLB existence가 아니라 실제 still에서 식별되는 요소를 기준으로 보정한다: TFG ultrawide clock cards/light bar, HYTE Y70 glass/fans/GPU/AIO, Epic 5 baffle/driver/feet, AM HATSU split sculpted keyboard, Stream Deck Neo keys/infobar/cable, SYNCHRONIZE mat weave/wordmark, Times Gate five screens.
- preview-only placement scale을 지원해 실제 제품 치수는 유지하되 reference still smoke render에서는 카메라/배치 비율을 별도로 보정한다.

Updated:
- `verify:video-scene-reference`는 visual fidelity report existence, private/prototype legal boundary, hero signature score, hero object count, non-placeholder GLB size를 검증한다.
- So Ong preview render는 hard rectangular glow panel을 제거하고 lighting/wall wash, camera framing, PC/speaker/mouse scale을 reference still에 맞게 재조정한다.
- Razer Cobra Pro White prototype은 reference still에서 읽히는 dark top shell과 bright cut lines를 추가해 흰색 blob처럼 보이는 상태를 막는다.

Removed/Deprecated:
- reference still 품질을 사람이 보는 composition과 무관한 “파일 수/썸네일 수 통과”로 완료 처리하는 방식.
- 제품 고유 signature 없이 procedural primitive만 쌓아 90% reference target이라고 주장하는 방식.

## 2026-05-13 변경 동기화 (Creator Reference Visible Crop Scope)
Added:
- So Ong reference pack에 `visibleInStill=listed_only` 분리 정책을 고정해, 전체 댓글/상품 목록은 metadata로 추적하되 supplied still crop에 실제로 보이는 제품만 generated catalog asset으로 노출한다.
- `SO_ONG_VIDEO_VISIBLE_PRODUCTS`와 `SO_ONG_VIDEO_LISTED_ONLY_PRODUCTS`를 분리하고, catalog variant export는 visible-crop 제품만 사용한다.
- `verify:video-scene-reference`는 28개 reference metadata, 17개 visible generated asset, 11개 listed-only non-generated asset, scene layout exclusion을 각각 검증한다.

Updated:
- reference smoke render는 Stream Deck Neo, ceiling light, Movlabs/S32DG800 side setup, blind/switch/Atom figure처럼 현재 crop에 보이지 않는 제품을 제외하고, MiniFuse 2, Mars Pro, IVY, diecast, Square1처럼 crop에서 식별되는 제품만 보이는 배치로 재생성한다.
- Blender generation script는 `ASSETS_TO_GENERATE`를 visible-crop product id로 제한해 non-visible reference 산출물이 다시 생성되지 않게 한다.

Removed/Deprecated:
- 사용자가 제공한 전체 제품 목록을 현재 reference still에 모두 생성/노출하는 방식.
- `listed_only` reference를 scene layout이나 inventory catalog에 포함해 사용자가 현재 crop과 무관한 제품까지 생성된 것으로 오해하게 만드는 방식.

## 2026-05-15 변경 동기화 (Editor Lighting Fixture Controls)
Added:
- editor properties inspector 조명 섹션에 direct/indirect mode segmented control, direct fixture count control, room-bounds mini grid marker drag, fixture color temperature swatches, fixture별 enabled/intensity/beam/spread controls를 추가한다.
- `verify:lighting-layout` source gate가 editor inspector fixture controls, pointer drag commit, project editor `computeLightingBoundsMm(walls, scale)` 연결, fixture detail controls를 검증하도록 확장한다.

Updated:
- “방을 꾸미는” 커스터마이징 범위는 제품 교체뿐 아니라 builder 이후 조명 mood와 direct fixture 구성을 editor에서 다시 다듬는 흐름까지 포함한다.
- 남은 visual fidelity gap은 실제 GLB/PBR SKU 품질과 authenticated editor visual smoke를 중심으로 관리한다.

Removed/Deprecated:
- direct fixture layout/detail 값을 builder에서만 조정하고 editor에서는 preset/slider만 만지는 계획.

## 2026-05-16 변경 동기화 (Editor Room Styling Bundles)
Added:
- editor properties panel에 `editor-room-styling-bundles` 섹션을 추가해 complete-room, creator-desk, media-lounge, gallery-studio 구성을 프로젝트 생성 후에도 바로 적용할 수 있게 한다.
- `buildEditorRoomStylingBundleAssets` helper는 `workspace-flex` seed contract를 재사용하되 기존 asset count를 기준으로 중복을 건너뛰고, 누락 asset만 추가한 `nextAssets`를 반환한다.
- `verify:editor-styling-bundles`를 추가해 dense bundle count, repeated apply dedupe, surface support id validity, inspector/project wiring을 검증한다.

Updated:
- editor customization 우선순위는 개별 inventory 배치와 zone replacement 다음에 “이미 있는 방의 밀도를 빠르게 올리는 bundle apply”를 포함한다.
- bundle apply는 `setAssets(result.nextAssets)`와 단일 `recordSnapshot`으로 처리해 autosave/undo surface를 좁게 유지한다.

Removed/Deprecated:
- builder에서 starter를 고르지 않은 사용자가 editor에서 같은 수준의 dense room composition을 얻기 어렵게 두는 방식.

Follow-up Risk:
- 이번 pass는 기존 catalog/seed asset만 재사용한다. reference-level 품질에 더 가까워지려면 bundle 내부 개별 GLB의 material polish, desk/shelf prop silhouette, authenticated editor visual smoke를 다음 패스로 보강해야 한다.

## 2026-05-16 변경 동기화 (Meshy Room Decor Asset)
Added:
- Meshy text-to-3D preview/refine로 `p2s_meshy_pastel_mascot_stack` generated decor prototype을 생성했다.
- 산출물은 `apps/web/public/assets/models/p2s_meshy_pastel_mascot_stack/`, `apps/web/public/assets/catalog/thumbnails/p2s_meshy_pastel_mascot_stack.webp`, `assets/references/meshy-room-decor/meshy-room-decor-report.json`에 저장한다.
- catalog에 Meshy-generated decor item을 추가하고, `workspace-flex` starter의 display cluster 소품 슬롯을 해당 asset으로 교체한다.
- `verify:meshy-room-decor`를 추가해 generation report, budget guard, catalog exposure, seed 연결, GLB validation을 확인한다.

Updated:
- P2 visual fidelity gap 중 실제 GLB/PBR 소품 품질은 renderer-only proxy가 아니라 generated catalog asset을 포함하는 방향으로 축소한다.
- standalone Meshy run은 잔여 credit 1160을 balance API로 확인하고 preview/refine 합산 보수 예약 60 안에서 실행한 evidence를 report에 남긴다.

Removed/Deprecated:
- Meshy output을 수동으로 받은 뒤 검증/문서/카탈로그 계약 없이 임시 파일로만 보관하는 방식.

Follow-up Risk:
- 현재 generated asset은 prototype-only qualityScore 0.76으로 catalog에 연결했다. KTX2 압축, triangle budget 최적화, human visual QA, release/legal review는 별도 후속 작업으로 남는다.

## 2026-05-16 변경 동기화 (Generated Asset Review UX)
Added:
- catalog domain에 generated/prototype badge helper를 추가해 Meshy provider label과 `검수 필요` 상태를 일관되게 계산한다.
- editor library/inventory shelf에 `AI 생성` filter와 generated asset badge를 추가해 사용자가 Meshy-generated decor만 빠르게 찾을 수 있게 한다.
- replacement picker와 selected asset inspector에도 generated/provider/review badge를 노출해 교체 후보와 현재 선택 asset의 prototype 상태를 구분한다.
- Blender finalizer thumbnail render를 낮은 노출/불투명 배경으로 조정하고 Meshy decor thumbnail을 다시 렌더링했다.
- editor room styling bundle preview helper를 추가해 `workspace-flex` seed contract에서 bundle asset count와 generated Meshy item을 계산한다.
- editor inspector의 styling bundle 버튼은 generated Meshy decor가 포함된 번들에 provider/review badge를 표시한다.
- builder style step의 workspace preset/cluster card도 같은 seed preview helper를 사용해 프로젝트 생성 전 generated Meshy decor 포함 여부를 표시한다.

Updated:
- `verify:meshy-room-decor`는 Meshy generated asset의 catalog exposure뿐 아니라 generated badge contract, UI source hooks, thumbnail render contract까지 확인한다.
- `verify:editor-styling-bundles`는 generated Meshy decor가 display cluster bundle에 포함되고, project editor가 catalog를 inspector에 전달하며, bundle badge test id가 유지되는지 확인한다.
- `verify:builder-performance`는 builder style preset/cluster generated badge source hook을 확인해 room-first builder disclosure가 빠지지 않게 한다.

Removed/Deprecated:
- generated asset을 일반 catalog item과 동일하게만 노출해 사용자가 provider와 review 상태를 확인할 수 없던 방식.
- room styling bundle을 적용하기 전에는 generated prototype 포함 여부를 알 수 없는 방식.
- builder style step에서는 generated prototype을 숨기고 editor 진입 후에만 review 상태를 표시하는 방식.

Follow-up Risk:
- generated asset filter는 현재 catalog card UI affordance이며, private generated asset의 owner-scoped 서버 데이터와 release/legal approval workflow는 기존 product asset pipeline의 후속 gate를 계속 따라야 한다.
- 인증이 필요한 실제 `/project/[id]` visual smoke는 동적 seed/auth flow에 흩어져 있어, generated bundle badge의 브라우저 E2E assertion은 후속 pass에서 기존 editor visual QA flow에 통합해야 한다.

## 2026-05-16 변경 동기화 (Furniture Render Source QA)
Added:
- `Furniture.tsx` runtime tree에 `furniture-render-source-real-glb`, `builder-preview-proxy`, `placeholder-fallback`, `model-loading-fallback`, `lod-proxy` marker를 추가해 Meshy/generated GLB가 fallback geometry와 구분되도록 했다.
- `verify:builder-performance`가 render source marker와 runtime metadata source contract를 검증한다.
- `Furniture.tsx`가 실제 GLB 로드 완료 시 `window.__DESKTERIORONLINE_FURNITURE_GLB_LOADS__`에 mesh/material count와 bounds를 기록해 full-room QA에서 로드 성공을 확인할 수 있게 했다.
- `CatalogLiveModelPreview`에 browser-visible live preview registry를 추가해 replacement card의 실제 GLB overlay가 `real-glb-live-preview`로 로드됐는지 추적한다.
- `/labs/qa/meshy-live-preview`와 `verify:meshy-live-preview`를 추가해 Meshy text-to-3D GLB가 브라우저 canvas에서 실제 픽셀로 보이고, provider/review/source report provenance가 registry와 일치하는지 확인한다.
- `/labs/qa/meshy-editor-scene`와 `verify:meshy-editor-scene`를 추가해 `workspace-flex` display cluster room scene 안에서 Meshy decor가 cutaway top-view QA의 강제 real-GLB path로 로드되는지 검증한다.

Updated:
- generated asset 품질 추적은 파일/thumbnail/catalog badge에서 끝나지 않고, 실제 editor renderer가 GLB source를 쓰는지 확인할 수 있는 source marker까지 포함한다.
- builder preview proxy는 의도된 경량 diorama path로 허용하되, placeholder/loading fallback은 visual QA에서 실제 GLB 품질 증거로 취급하지 않는다.
- 실제 editor/replacement/full-room GLB evidence는 builder preview proxy smoke와 별도로 live model preview registry, full-room GLB load registry, canvas pixel gate를 통과해야 한다.

Removed/Deprecated:
- placeholder box나 LOD proxy가 화면을 채우면 generated Meshy asset이 정상 렌더된 것으로 간주하는 검증 방식.
- Meshy-generated asset이 catalog에 존재하고 badge가 보이면 replacement/editor preview 렌더까지 검증된 것으로 처리하는 방식.

Follow-up Risk:
- Meshy editor scene hidden QA는 seeded full-room top-view renderer path와 real-GLB load registry를 검증하지만, authenticated `/project/[id]`에서 server-backed save/reload/share까지 이어지는 E2E는 후속 패스로 남는다.
- 로컬 production build gate는 Node 20 clean build 기준으로 통과한다. 이전 `.next/server/app/**/route.js` 또는 `page.js.nft.json` output tracing 누락은 루트 페이지 server/client boundary 정리 후 stale `.next`를 제거한 clean build에서 재현되지 않았다.
- 루트 `/`는 server page가 client-only landing interaction component를 감싸는 구조를 유지해야 한다. 다시 전체 `page.tsx`를 `"use client"`로 되돌리면 App Router prerender/build trace 안정성이 깨질 수 있다.

## 2026-05-17 변경 동기화 (Meshy Editor Customization Save QA)
Added:
- `/labs/qa/meshy-editor-customization` hidden QA route를 추가해 실제 `BuilderInspectorPanel`, `SceneViewport`, `ProjectEditorHeader`, `useEditorSaveSession` 조합으로 source decor를 Meshy-generated decor로 교체하는 흐름을 재현한다.
- `verify:meshy-editor-customization`를 추가해 replacement card 클릭, generated badge, 같은 scene asset id 유지, forced real-GLB top-view render source, GLB mesh/material load, manual save payload capture를 브라우저에서 검증한다.
- QA route는 DB 인증 없이 project-version POST만 fetch interceptor로 캡처해 save payload의 `assets[]`, product source metadata, Meshy text-to-3D provenance URL이 유지되는지 확인한다.

Updated:
- Meshy/generated QA 기준은 catalog/seed/live-preview/full-room 렌더 검증에서 한 단계 더 나아가 editor-style 선택 제품 교체와 저장 payload 계약까지 포함한다.
- `verify:meshy-editor-customization` 결과는 `output/playwright/meshy-editor-customization.png`와 JSON log의 `saveCaptureCount`, real GLB source, mesh/material count, canvas color/contrast metrics를 evidence로 남긴다.

Removed/Deprecated:
- seeded full-room top-view GLB evidence만으로 사용자의 교체/저장 커스터마이징 흐름까지 검증됐다고 보는 기준.

Follow-up Risk:
- 이번 route는 실제 editor 컴포넌트와 save hook을 쓰지만 인증된 `/project/[id]` 서버 버전 저장, reload, publish/share parity는 아직 별도 authenticated E2E로 남는다.

## 2026-05-17 변경 동기화 (PC Assembly Workbench QA)
Added:
- `/labs/qa/pc-assembly-workbench` hidden QA route를 추가해 PC 본체 조립 모드의 첫 상호작용 계약을 검증한다.
- QA route는 현재 단일 case option인 `LIAN-LI O11D MINI V2 FLOW White` 선택을 조립 시작 조건으로 둔다.
- QA route는 Compuzone product `1336041` 견적의 CPU/GPU/메인보드/메모리/SSD/케이스/파워/케이스쿨러/쿨러 9개 label과 slot을 저장 payload에 포함한다.
- QA route는 작업 공간 준비부터 메인보드 선조립, AM5 CPU 체결, M.2 SSD/방열판, DDR5 RAM A2/B2, 케이스 패널/스탠드오프/I/O 정렬, 메인보드 이식, PSU, 24핀/CPU EPS, 수랭 브래킷/써멀/펌프/라디에이터/팬, 프런트패널/USB/오디오 헤더, GPU/보조전원, 케이블 정리, 패널 닫기, 외부 케이블, 첫 전원, BIOS POST까지 38단계를 React Three Fiber workbench scene과 저장 payload로 재현한다.
- QA route는 조립 완료 후 완성 PC tower를 책상에 올리고, 모니터/키보드/마우스/마이크/램프/소품/LED/TV 콘솔/소파 zone/room lighting을 11단계로 꾸미는 Bruno Simon-inspired room diorama state를 저장 payload에 포함한다.
- 각 체결/배치 단계는 WebAudio 기반 cue를 발생시키고, `window.__DESKTERIORONLINE_PC_ASSEMBLY_QA__` registry에 selected case, current step, completed assembly steps, completed room steps, counts, visual booleans, thermal paste coverage, audio events, saved payload, quote parts를 노출한다.
- `scripts/generate-meshy-compuzone-pc-build-kit.ts`와 `npm --workspace apps/web run asset:generate:compuzone-pc-kit`를 추가해 해당 견적을 하나의 Meshy private prototype exploded PC build kit GLB로 생성한다.
- Final room QA pass는 Compuzone Meshy build kit과 pastel mascot Meshy asset을 실제 R3F scene에 올리고, procedural rounded room dressing으로 desk/shelf/media/sofa/chair/cutaway thickness/LED mood를 보강한다.
- `verify:pc-assembly-workbench`는 브라우저에서 case selection, 38개 조립 버튼 순서, 11개 room setup 버튼 순서, 50개 sound event, thermal paste coverage, cable management, BIOS POST, quote/room saved payload, canvas color/contrast metrics, screenshot evidence를 확인한다.

Updated:
- 데스크테리어 편집 범위는 책상/가구/조명 배치뿐 아니라 PC tower 내부 조립 경험까지 확장 가능하다. 단, PC 조립은 일반 furniture replacement가 아니라 별도 assembly state machine과 slot validation을 가진 editor mode로 취급한다.
- 이번 pass의 PC 부품은 procedural QA geometry와 Meshy private prototype kit asset의 조합이며, release-ready PC part SKU가 아니다. 상용 전환에는 case/motherboard/CPU/RAM/GPU/cooler/PSU/cable을 개별 GLB로 분리하고 정확한 pivot/slot/collision metadata가 필요하다.
- PC 조립 결과는 최종적으로 sceneDocument에 `assemblyState` 또는 equivalent runtime extension으로 저장되어 `/project/[id]` reload, publish/share viewer, community viewer에서 같은 단계 상태를 재현해야 한다.
- Visual target은 `verify:pc-assembly-workbench` pass뿐 아니라 screenshot review에서 room framing, PC desk placement, Meshy asset visibility, object grounding, and warm/cool contrast가 Bruno Simon-inspired cutaway room으로 읽히는지 확인하는 반복 기준을 포함한다.

Removed/Deprecated:
- PC 본체를 단순 static decor/case mesh로만 배치하면 데스크테리어 핵심 경험이 충분하다고 보는 기준.
- RAM/CPU/써멀 같은 조립 affordance를 영상/텍스트 안내만으로 대체하고 실제 3D state, sound cue, 저장 payload 없이 완료 처리하는 방식.

Follow-up Risk:
- 현재 PC workbench는 hidden QA lab이며 메인 editor navigation, authenticated project save, share/viewer parity에는 아직 연결되지 않았다.
- 현재 room diorama는 QA route 내부의 Meshy GLB + procedural preview이며, 상용 editor 통합 시 sceneDocument asset placement, desk surface collision, reusable room template, camera preset 저장, per-part GLB 분리, renderer material QA가 필요하다.
- Meshy text-to-3D 또는 image-to-3D로 PC 부품을 만들 수 있지만, 상용 노출 전에는 reference pack/license, dimension fit, Blender finalizer, slot metadata, human visual QA를 통과해야 한다. 이번 Compuzone build kit은 exact quote assembly UX 검증용 private prototype이다.
- 사운드는 사용자 gesture 기반 WebAudio cue로 검증했다. 상용 UI에는 mute/accessibility preference와 기기별 autoplay 정책 fallback이 필요하다.

## 2026-05-17 변경 동기화 (PC Assembly Cinematic Room Polish)
Added:
- PC assembly workbench에 `qaCinematic=1&qaComplete=1` full-screen QA mode를 추가해 조립 완료 + 방 배치 완료 상태를 즉시 열고 final room screenshot만 캡처할 수 있게 했다.
- Final room scene에 Compuzone PC build kit, Meshy pastel mascot stack에 더해 Meshy monitor, studio speaker, ivy planter proxy GLB를 배치해 desk/media/plant zones의 generated/prototype asset evidence를 늘렸다.
- `verify:pc-assembly-workbench`는 일반 screenshot `output/playwright/pc-assembly-workbench.png`와 cinematic screenshot `output/playwright/pc-assembly-workbench-cinematic.png`를 모두 생성하고, cinematic canvas color bucket/luminance contrast를 별도 JSON evidence로 출력한다.

Updated:
- QA driver는 38개 assembly step, 11개 room setup step, 50개 audio event, saved payload 검증을 유지하되, room setup 클릭은 queued DOM click으로 안정화하고 screenshot은 full page cinematic capture로 저장한다.
- Room preview camera는 더 가까운 isometric cutaway framing과 larger scene scale로 조정해 nav 없는 캡처에서 방이 프레임을 채우도록 했다.

Removed/Deprecated:
- final visual review를 일반 UI 포함 screenshot 하나에 의존하는 방식.

Follow-up Risk:
- 이번 pass는 hidden QA route의 visual polish다. 상용 수준으로 올리려면 PC part를 개별 GLB/snap/collision 단위로 분리하고, editor sceneDocument 저장/재로드/공유 viewer parity, stronger baked-style lighting/material pass, human visual QA가 계속 필요하다.

## 2026-05-17 변경 동기화 (PC Assembly Cinematic Room Polish II)
Added:
- Final room preview에 staggered wood plank floor, fake baked floor AO shadows, right-wall entertainment shelf/TV zone, Meshy keyboard/mouse/lamp/mug/cable reel/book stack/pixel display evidence를 추가했다.
- PC build kit material tone, LED intensity, tone mapping exposure를 낮춰 white PC/LED 하이라이트가 과노출되지 않도록 조정했다.
- `verify:pc-assembly-workbench`는 별도 cinematic URL navigation 대신 완료된 동일 페이지를 full-screen capture layout으로 승격해 Next dev chunk 404에 영향을 받지 않는 screenshot evidence를 만든다.

Updated:
- Bruno-inspired visual review 기준은 frame fill뿐 아니라 floor pattern scale, object grounding, right-wall density, PC highlight control, and final screenshot readability까지 포함한다.
- Room preview post-processing은 현재 QA 캡처에서 tone instability가 있어 제외하고, deterministic lighting/material/geometry pass를 우선한다.

Removed/Deprecated:
- dev 서버에서 query-only cinematic route로 재진입해 static chunk 404에 취약한 자동 QA 방식.
- Bloom/post-processing으로 하이라이트를 밀어 올려 Bruno-quality polish로 간주하는 방식.

Follow-up Risk:
- 현재 visual pass는 procedural QA diorama를 계속 개선한 상태다. 상용 Bruno-level target에는 authored room shell lightmaps, real per-part PC GLBs, reusable placement metadata, and human art review가 계속 필요하다.

## 2026-05-17 변경 동기화 (PC Assembly Cinematic Room Polish III)
Added:
- Final room preview에 wall panel seams, cork board, floating wall shelf/books/camera, side-wall acoustic panels, desk cable dressing, PC desk contact shadow, sofa cushions/throw/seams, cinematic vignette/color grade overlay를 추가했다.
- PC build kit placement를 더 크게 조정하고 chair/plant occlusion을 줄여 final screenshot에서 완성 PC 본체가 책상 위 주요 오브젝트로 읽히도록 했다.

Updated:
- Cinematic QA camera는 더 낮고 가까운 presentation pose로 조정해 final room screenshot이 평면 top-view보다 cutaway diorama에 가깝게 보이도록 했다.
- `verify:pc-assembly-workbench` 최신 evidence는 `cinematicUniqueColorBuckets=407`, `cinematicLuminanceStdDev=68.42`로, 이전 pass보다 final screenshot의 색/명암 대비가 증가했다.

Removed/Deprecated:
- PC 본체가 chair/plant 뒤에 작게 보이는 구도를 최종 visual evidence로 취급하는 방식.

Follow-up Risk:
- 이번 pass도 hidden QA route visual polish다. 상용 Bruno-level 목표에는 still real baked lighting/lightmap, authored high-poly room props, per-part PC GLB/snap metadata, and repeated human visual QA가 남아 있다.

## 2026-05-17 변경 동기화 (PC Assembly Cinematic Room Polish IV)
Added:
- Final room preview는 Compuzone Meshy build kit 내부 evidence 위에 white showcase PC shell prototype GLB를 겹쳐 final desk placement screenshot에서 PC tower silhouette가 더 깨끗하게 읽히도록 한다.
- Living zone에는 woven rug detail, coffee-table props, softer floor decal shadows, radial-alpha wall light patches, 3/4 cutaway camera framing을 추가해 front-facing flat room 구도를 줄인다.
- `verify:pc-assembly-workbench`는 추가 PC shell proxy GLB 존재를 확인하며, room setup 버튼은 disabled 상태가 해제된 뒤 클릭해 heavy GLB hydration 중에도 state machine 검증이 안정적으로 진행되도록 한다.

Updated:
- 최신 QA evidence는 `cinematicUniqueColorBuckets=380`, `cinematicLuminanceStdDev=73.45`, `stepCount=38`, `roomStepCount=11`, `audioEvents=50`, `saved=true`다.
- Bruno-inspired screenshot review는 이제 PC tower shell readability, 3/4 wall/floor depth, rug/sofa foreground density, and non-rectangular baked-style light/shadow patches를 함께 본다.

Removed/Deprecated:
- 정면에 가까운 평면 room screenshot을 최종 cutaway-room evidence로 유지하는 방식.

Follow-up Risk:
- white showcase shell은 final room visual prototype 보강용이며 Compuzone/Lian-Li exact commercial case asset으로 승인된 것이 아니다. 상용화 전에는 quote-specific case GLB, individual PC part GLB, collision/snap metadata, and human art review가 계속 필요하다.

## 2026-05-17 변경 동기화 (PC Assembly Cinematic Room Polish V)
Added:
- Final room preview는 high-detail decorative GLTF evidence를 제한적으로 사용한다: steel-frame shelf와 modern coffee table은 PBR texture/detail 보강용이며, procedural primitives는 silhouette/fallback 보조로 유지한다.
- Floor/wall baked-style shadow는 shared radial alpha patch를 floor contact decals에도 적용해 hard-edged shadow sticker 느낌을 줄인다.
- Cinematic camera는 더 긴 렌즈와 높은 3/4 viewpoint를 사용해 final screenshot이 front-facing room보다 miniature cutaway presentation에 가깝게 보이도록 한다.

Updated:
- 최신 `verify:pc-assembly-workbench -- --base-url=http://127.0.0.1:3100` evidence는 `stepCount=38`, `roomStepCount=11`, `audioEvents=50`, `saved=true`, `cinematicUniqueColorBuckets=244`, `cinematicLuminanceStdDev=52.1`다.
- Bruno-inspired review 기준은 단순 color-bucket 증가보다 PC tower readability, full room framing, right-wall media visibility, floor/wall soft AO, and decorative GLTF/procedural style fit을 함께 본다.

Removed/Deprecated:
- 장면에 맞지 않는 realistic sofa GLTF를 억지로 겹쳐 고품질으로 간주하는 방식. 현재 소파는 stylized primitive를 유지하고, 상용화 시 별도 authored sofa asset QA가 필요하다.

Follow-up Risk:
- 이번 pass도 hidden QA route의 visual polish다. 상용 Bruno-level 목표에는 exact PC part GLBs, authored/baked room shell, material/lightmap pass, editor save/share parity, and repeated human visual QA가 계속 남아 있다.

## 2026-05-17 변경 동기화 (PC Assembly Cinematic Tower Detail Pass)
Added:
- Final room preview의 완성 PC tower는 quote-derived Meshy build-kit GLB를 더 잘 보이게 하고, renderer-only showcase detail layer를 추가해 glass panel, motherboard, AIO pump, RAM, GPU strip, top mesh, front IO, panel screws, feet, RGB fan rings가 screenshot에서 읽히도록 했다.
- Gaming chair는 더 낮고 옆으로 빠진 cinematic pose를 사용해 PC 본체가 최종 컷에서 주요 desk object로 보이게 했다.

Updated:
- 최신 `verify:pc-assembly-workbench -- --base-url=http://127.0.0.1:3100` evidence는 `stepCount=38`, `roomStepCount=11`, `audioEvents=50`, `saved=true`, `cinematicUniqueColorBuckets=248`, `cinematicLuminanceStdDev=52.16`다.
- 기존 Meshy PC build-kit GLB는 존재하지만 현재 환경에는 `MESHY_API_KEY`/budget env가 없어 신규 Meshy provider POST는 실행하지 않았다. 이번 pass는 existing generated/prototype GLB와 renderer polish를 사용한 visual QA 개선이다.

Removed/Deprecated:
- PC tower가 흰 박스 silhouette 또는 chair occlusion 뒤에 묻혀도 final deskterior placement가 충분하다고 보는 기준.

Follow-up Risk:
- Bruno Simon room급 상용 품질에는 여전히 exact per-part GLB, real case/GPU/AIO asset authoring, snap/collision metadata, baked lightmap/material pass, editor save/share parity, and human art QA가 필요하다.

## 2026-05-17 변경 동기화 (PC Assembly Cinematic Cutaway Architecture Pass)
Added:
- Final room preview에 좌측 return wall, rear/right corner posts, top/corner cutaway rim, baseboards, ceiling ribs, cove LED strips를 추가해 방 envelope가 평면 배경이 아니라 miniature cutaway room으로 읽히도록 했다.
- `RoomCutawayArchitecture`는 room shell 내부의 renderer-only architecture polish layer로 유지하며, PC assembly state machine이나 saved payload는 변경하지 않는다.

Updated:
- 최신 `verify:pc-assembly-workbench -- --base-url=http://127.0.0.1:3100` evidence는 `stepCount=38`, `roomStepCount=11`, `audioEvents=50`, `saved=true`, `cinematicUniqueColorBuckets=258`, `cinematicLuminanceStdDev=50.29`다.
- stale dev chunk 404가 verifier registry timeout을 만들 수 있으므로 visual QA 전 dev server를 재시작해 fresh chunks로 확인했다.

Removed/Deprecated:
- 좌/상단/코너 구조 없이 back wall + right wall + floor만으로 Bruno-inspired cutaway room envelope가 충분하다고 보는 기준.

Follow-up Risk:
- 좌측 return wall은 방 깊이를 올리지만 화면에서 강하게 읽힌다. 다음 human visual QA에서는 shelf/sofa foreground를 가리지 않는 선에서 색상/높이/카메라를 추가 조정해야 한다.

## 2026-05-17 변경 동기화 (PC Assembly Cinematic Open Cutaway Wall Pass)
Added:
- 좌측 return wall을 큰 단색 면에서 낮은 투명 panel + vertical uprights + horizontal rails + small wall art + mini shelf detail로 바꿔 열린 컷어웨이 룸처럼 읽히도록 했다.
- 좌측 wall detail은 renderer-only polish로 유지하며, PC assembly/room setup state machine, sound event, saved payload는 변경하지 않는다.

Updated:
- 최신 `verify:pc-assembly-workbench -- --base-url=http://127.0.0.1:3100` evidence는 `stepCount=38`, `roomStepCount=11`, `audioEvents=50`, `saved=true`, `cinematicUniqueColorBuckets=279`, `cinematicLuminanceStdDev=51.98`다.
- Bruno-style review 기준은 room envelope depth뿐 아니라 “열린 시야”도 포함한다. 벽/프레임이 소품과 PC를 막으면 architecture polish가 아니라 occlusion defect로 본다.

Removed/Deprecated:
- 방 깊이를 만든다는 이유로 큰 단색 좌측 wall을 그대로 유지해 shelf/sofa/desk 시야를 막는 방식.

Follow-up Risk:
- 다음 visual pass에서는 orthographic/perspective camera tradeoff, left wall color balance, and shelf/PC hero framing을 함께 조정해 최종 컷을 더 Bruno-style miniature presentation에 가깝게 만들어야 한다.

## 2026-05-17 변경 동기화 (PC Assembly Cinematic Camera + Lighting Balance Pass)
Added:
- Final room preview는 higher 3/4 camera, reduced flat-facing framing, slimmer open cutaway wall details, subtle post FX Bloom/Vignette를 사용해 QA screenshot보다 cinematic miniature-room presentation에 가깝게 보이도록 했다.
- 좌측 open cutaway wall은 큰 slab/rail dominance를 줄이고 translucent wall skin, lighter uprights, small wall art, mini shelf, colored shadowbox details로 재구성했다.

Updated:
- 최신 `npm --workspace apps/web run type-check && npm --workspace apps/web run verify:pc-assembly-workbench -- --base-url=http://127.0.0.1:3100` evidence는 `stepCount=38`, `roomStepCount=11`, `audioEvents=50`, `saved=true`, `cinematicUniqueColorBuckets=397`, `cinematicLuminanceStdDev=72.38`다.
- Renderer exposure는 `0.62`로 낮추고 room key/fill light는 white PC shell 과노출을 줄이는 방향으로 조정했다. 다만 현재 screenshot은 아직 authored/baked Bruno-level asset quality라고 판단하지 않는다.

Removed/Deprecated:
- 자동 지표만 상승하면 visual pass가 성공이라는 판단. 이번 pass는 metrics가 좋아졌지만 human review상 white PC shell/proxy assets, wall rail styling, exact PC part GLB 부재가 여전히 blocker다.

Follow-up Risk:
- 다음 단계는 신규 Meshy/provider asset이 아니라도 authored-looking room shell, exact PC part silhouette replacement, wall/window composition cleanup, softer material response를 우선해야 한다. Bruno-level 완료 판단에는 사람 눈 기준 반복 스크린샷 리뷰가 계속 필요하다.

## 2026-05-17 변경 동기화 (PC Assembly Desk PC Readability Pass)
Added:
- Final room preview는 camera azimuth를 room rotation과 어긋나게 조정해 정면 무대감을 줄이고, desk layout과 조립된 PC가 데스크테리어 안에서 읽히도록 framing을 재조정했다.
- PC tower는 renderer-authored Lian-Li style detail layer로 조립 가능한 본체 단서가 읽히도록 하고, Meshy Compuzone build-kit GLB는 provenance/evidence layer로 낮은 opacity와 작은 scale로만 유지한다.
- Back/right wall soft shadow opacity, LED intensity, open cutaway rail opacity를 재조정해 과한 proxy glow와 난간 느낌을 줄였다.

Updated:
- 최신 `npm --workspace apps/web run type-check && npm --workspace apps/web run verify:pc-assembly-workbench -- --base-url=http://127.0.0.1:3100` evidence는 `stepCount=38`, `roomStepCount=11`, `audioEvents=50`, `saved=true`, `uniqueColorBuckets=306`, `luminanceStdDev=64.57`, `cinematicUniqueColorBuckets=392`, `cinematicLuminanceStdDev=64.71`다.
- 정식 screenshot review에서 HYTE showcase proxy가 큰 반투명 흰 박스로 나타나는 문제가 확인되어 final desk PC layer에서 제거했다. quote-specific PC visual은 existing Compuzone build-kit + authored renderer details 조합으로 제한한다.

Removed/Deprecated:
- quote와 다른 showcase case GLB를 큰 shell overlay로 써서 final PC silhouette를 보강하는 방식.
- Meshy GLB가 고스트/파편처럼 보이는데도 asset provenance만으로 final visual pass를 통과시키는 기준.

Follow-up Risk:
- 이번 pass는 이전보다 desk PC readability와 구도가 개선됐지만 Bruno Simon room급 완료는 아니다. 다음 상용화 단계에는 exact Lian-Li case, ASUS GPU, AIO/radiator, board/RAM/SSD per-part GLBs뿐 아니라 가구/방 에셋 퀄리티, baked material/lightmap pass, 조명/분위기 art QA가 계속 필요하다.

## 2026-05-17 변경 동기화 (PC Assembly Solid Tower Material Balance Pass)
Added:
- Final room preview의 완성 PC tower에 `DeskPcCaseDepthDetails` 기반 내부 암부, side volume, glass/edge frame layer를 더해 전면 유리와 케이스 깊이가 screenshot에서 분리되어 보이도록 했다.
- PC case/fan/RAM/cable/detail materials를 pure white에서 desaturated blue-grey 계열로 낮춰 white case highlight가 날아가지 않고 내부 부품 실루엣이 읽히도록 했다.

Updated:
- 최신 `npm --workspace apps/web run type-check && npm --workspace apps/web run lint && npm --workspace apps/web run verify:pc-assembly-workbench -- --base-url=http://127.0.0.1:3100` evidence는 `stepCount=38`, `roomStepCount=11`, `audioEvents=50`, `saved=true`, `uniqueColorBuckets=295`, `luminanceStdDev=65.11`, `cinematicUniqueColorBuckets=380`, `cinematicLuminanceStdDev=65.19`다.
- PC tower local blue point light intensity를 낮춰 white case front clipping을 줄이고, top collectibles와 room rim/LED는 가구/데스크/룸 조명을 방해하지 않는 보조 요소로 유지한다.

Removed/Deprecated:
- 완성 PC가 과노출된 흰 평면처럼 보여도 조립/배치 완료만으로 final visual evidence를 통과시키는 기준.

Follow-up Risk:
- 현재 pass는 prototype QA route 기준에서 PC 본체의 물성/부피감이 개선된 상태다. 상용 Bruno-level 완료에는 exact quote part GLBs, baked lighting/material authoring, per-part snap/collision metadata, and repeated human art QA가 계속 필요하다.

## 2026-05-17 변경 동기화 (PC System Configurator Foundation Pass)
Added:
- `apps/web/src/features/pc-system/` feature module을 추가해 PC를 static model이 아니라 configurator/assembly system으로 다루는 기반을 만들었다.
- 신규 모듈은 quote catalog, part metadata, attachment anchors, ordered assembly state machine, compatibility checks, physical fit checks를 renderer와 분리해 제공한다.
- PC assembly QA route는 `pcSystem` evidence를 QA registry와 saved payload에 포함한다: compatibility status, physical fit status, attachment anchor counts, state-machine completion.

Updated:
- 최신 `npm --workspace apps/web run type-check && npm --workspace apps/web run lint && npm --workspace apps/web run verify:pc-assembly-workbench -- --base-url=http://127.0.0.1:3100` evidence는 `stepCount=38`, `roomStepCount=11`, `audioEvents=50`, `saved=true`, `uniqueColorBuckets=291`, `luminanceStdDev=65.13`, `cinematicUniqueColorBuckets=379`, `cinematicLuminanceStdDev=65.30`다.
- Verifier는 이제 단순 조립/사운드/이미지뿐 아니라 `compatibilityStatus=pass`, `physicalFitStatus=pass`, `stateMachineComplete=true`, attachment anchor exposure도 검증한다.
- 제품 방향은 "PC 조립 게임" 단독이 아니라 Deskterior room customization 안의 중요한 조립 가능 PC configurator로 유지한다. Prebuilt PC placement와 Custom Build Flow가 같은 PC system catalog/attachment/evaluation 기반을 공유해야 한다.

Removed/Deprecated:
- PC를 room object로 배치하기만 하는 static mesh viewer 접근.
- 조립 순서, 호환성, physical fit, attachment metadata 없이 visual asset만 추가하는 방식.

Follow-up Risk:
- 현재 compatibility/fit metadata는 Compuzone quote 기반의 초기 rule layer다. 상용 수준에는 SKU별 공식 치수 검증, collision volume/OBB/BVH, slot-specific snap transforms, cable routing constraints, and editor save/share integration이 추가로 필요하다.

## 2026-05-17 변경 동기화 (PC Assembly Window + Wall Panel Polish Pass)
Added:
- Final room preview에 back/right wall panel grid, window night stripes/reflection strips, stronger warm/cool room light separation, and solid authored coffee-table geometry를 추가해 Bruno-inspired miniature-room depth를 보강했다.
- Ghosty PBR coffee-table GLB는 final cinematic proof에서 제거하고, stylized low-poly solid table로 교체해 sofa zone이 반투명 프록시처럼 보이는 문제를 줄였다.

Updated:
- 최신 `npm --workspace apps/web run type-check && npm --workspace apps/web run lint && npm --workspace apps/web run verify:pc-assembly-workbench -- --base-url=http://127.0.0.1:3100` evidence는 `stepCount=38`, `roomStepCount=11`, `audioEvents=50`, `saved=true`, `uniqueColorBuckets=280`, `luminanceStdDev=65.30`, `cinematicUniqueColorBuckets=390`, `cinematicLuminanceStdDev=65.56`다.
- 사용자 요구 기준은 PC 조립 게임 단독이 아니라 Deskterior의 중요한 조립 가능 요소로서의 PC configurator + room customization system이다. 이번 pass는 그 방향에 맞춰 조립 검증, 호환성/fit evidence, 방 배치, 최종 room screenshot을 하나의 QA route에서 계속 검증한다.

Removed/Deprecated:
- 방 꾸미기 품질을 올리기 위해 PBR/GLB asset을 무조건 유지하는 방식. screenshot에서 ghosting, over-bright shell, non-quote silhouette가 발생하면 renderer-authored stylized geometry가 더 안전한 proof layer다.

Follow-up Risk:
- Bruno Simon room급 완료에는 아직 exact Compuzone quote part GLBs, 고품질 가구/방 에셋, baked material/lightmap pass, slot-level collision/snap transforms, cable-routing constraints, and human art QA가 필요하다. 현재 결과는 verified prototype visual polish이며 full goal complete가 아니다.

## 2026-05-17 변경 동기화 (Furniture + Lighting Atmosphere Pass)
Added:
- Final room preview에 wall felt/slat panels, small art tiles, desk mat weave, notebook/tray details, under-desk cable tray, sofa throw textile, coffee-table magazine/cup styling, and soft floor/wall light patches를 추가했다.
- PC tower는 방의 중심이 아니라 조립 가능한 데스크테리어 요소로 유지하기 위해 Meshy PC layer opacity/colorScale, local RGB point lights, and bottom glow를 낮췄다.

Updated:
- 최신 `npm --workspace apps/web run type-check && npm --workspace apps/web run lint && npm --workspace apps/web run verify:pc-assembly-workbench -- --base-url=http://127.0.0.1:3100 && npm --workspace apps/web run build` evidence는 `stepCount=38`, `roomStepCount=11`, `audioEvents=50`, `saved=true`, `uniqueColorBuckets=275`, `luminanceStdDev=64.66`, `cinematicUniqueColorBuckets=405`, `cinematicLuminanceStdDev=64.98`다.
- Bruno-style 진행 기준은 PC 크기/존재감보다 furniture/decor density, room material layering, lighting atmosphere, and screenshot human review를 우선한다.

Removed/Deprecated:
- 창문광을 얇은 hard strip으로 바닥에 깔아 분위기를 만드는 방식. screenshot에서 선형 artifact처럼 보이면 soft radial light patch로 바꾼다.
- PC가 과도하게 밝아 방/가구보다 먼저 보이는 상태를 “데스크테리어 통합”으로 간주하는 기준.

Follow-up Risk:
- 이번 pass는 프로토타입 씬의 밀도와 분위기를 올렸지만, 상용 Bruno-level에는 실제 고품질 furniture/decor GLB, baked/stylized material authoring, coherent color grading, and repeated human art QA가 더 필요하다.

## 2026-05-17 변경 동기화 (Room Material Depth + PC De-emphasis Pass)
Added:
- Final room preview에 `RoomMaterialDepthPass`를 추가해 back/right wall 및 floor/wall junction에 낮은 opacity의 baked-looking occlusion, warm/cool material wash, baseboard/ceiling trim depth를 더했다.
- Floor plank seam과 floor shadow opacity를 낮춰 바닥이 hard grid/artifact처럼 보이는 문제를 줄이고, PC tower scale/local emissive/material brightness를 더 낮춰 데스크 구성요소로 읽히게 했다.

Updated:
- 최신 `npm --workspace apps/web run type-check && npm --workspace apps/web run lint && npm --workspace apps/web run verify:pc-assembly-workbench -- --base-url=http://127.0.0.1:3100 && npm --workspace apps/web run build` evidence는 `stepCount=38`, `roomStepCount=11`, `audioEvents=50`, `saved=true`, `uniqueColorBuckets=271`, `luminanceStdDev=61.14`, `cinematicUniqueColorBuckets=401`, `cinematicLuminanceStdDev=63.61`다.
- 제품 방향은 PC 중심 room이 아니라 room/furniture/decor/material/lighting 품질이 우선이고, PC는 사용자가 직접 조립할 수 있는 중요한 deskterior 구성품으로 통합한다는 기준을 재확인했다.

Removed/Deprecated:
- PC tower의 밝기, 크기, RGB glow가 방/가구/조명보다 먼저 보이는 상태를 최종 deskterior 품질로 간주하는 기준.
- 바닥 plank seam과 shadow patch가 강하게 보여 artifact처럼 읽히는데도 baked lighting polish로 보는 기준.

Follow-up Risk:
- 현재 결과는 verified prototype visual polish다. Bruno Simon room급 상용 품질에는 여전히 고품질 furniture/decor GLB, stylized/baked material authoring, exact quote PC part assets, coherent color grading, and repeated human art QA가 필요하다.

## 2026-05-17 변경 동기화 (Furniture Asset Microdetail + Wall De-graphic Pass)
Added:
- Final room preview에 desk material/clutter pass, shelf book-label/plant/camera microdetails, media-console speaker/drawer/screen details, sofa textile piping/tuft/legs, rug back fringe/side border, and coffee-table GLTF support layer를 추가했다.
- Back-wall panel guide lines를 더 낮춰 방이 product-grid UI처럼 보이는 문제를 줄이고, PC는 이전 de-emphasis 상태를 유지했다.

Updated:
- 최신 `npm --workspace apps/web run type-check && npm --workspace apps/web run lint && npm --workspace apps/web run verify:pc-assembly-workbench -- --base-url=http://127.0.0.1:3100 && npm --workspace apps/web run build` evidence는 `stepCount=38`, `roomStepCount=11`, `audioEvents=50`, `saved=true`, `uniqueColorBuckets=273`, `luminanceStdDev=60.99`, `cinematicUniqueColorBuckets=394`, `cinematicLuminanceStdDev=63.53`다.
- 사용자 수정 방향을 반영해 PC는 room centerpiece가 아니라 직접 조립 가능한 중요한 deskterior 구성품으로 유지하고, 이번 개선 우선순위는 furniture/decor asset density와 lighting/mood quality로 둔다.

Removed/Deprecated:
- 벽면 guide/panel line이 강하게 보여도 room material depth로 간주하는 기준.
- PC 본체를 더 밝게 하거나 크게 만들어 visual progress를 만든 것으로 판단하는 기준.

Follow-up Risk:
- 이번 pass는 renderer-authored microdetail 중심이다. 상용 Bruno-level에는 여전히 고품질 authored/processed furniture GLB, baked material/lightmap, stronger color grading, exact quote PC part GLB, and repeated human art QA가 필요하다.

## 2026-05-17 변경 동기화 (Curated Furniture GLB Integration Pass)
Added:
- Final room preview에 curated furniture GLB layer를 추가했다: `p2s_fursys_setina_zdq012j` desk structure, `sofa_02` sofa texture layer, `modern_wooden_cabinet` media console layer, `modern_coffee_table_02` stronger table layer, desk planter/tray/under-desk tray GLBs.
- 중앙 의자 scale/contrast를 낮추고 불필요한 arm-chair overlay를 제거해 PC와 chair가 scene centerpiece처럼 튀는 문제를 줄였다.
- Back-wall/WallDressing panel lines opacity를 더 낮춰 방 벽면이 product grid UI처럼 보이는 문제를 줄였다.

Updated:
- 최신 `npm --workspace apps/web run type-check && npm --workspace apps/web run lint && PC_ASSEMBLY_QA_VERBOSE=1 npm --workspace apps/web run verify:pc-assembly-workbench -- --base-url=http://127.0.0.1:3100 && npm --workspace apps/web run build` evidence는 `stepCount=38`, `roomStepCount=11`, `audioEvents=50`, `saved=true`, `uniqueColorBuckets=274`, `luminanceStdDev=62.00`, `cinematicUniqueColorBuckets=407`, `cinematicLuminanceStdDev=63.32`다.
- 사용자 수정 방향을 반영해 PC는 방의 중심이 아니라 직접 조립 가능한 중요한 deskterior 요소로 유지한다. 다음 visual 개선 우선순위는 고품질 room/furniture/decor assets, lighting atmosphere, baked/stylized material response다.

Removed/Deprecated:
- PC tower, chair, wall guide line의 존재감으로 visual progress를 만든 것으로 판단하는 기준.
- Low-quality/procedural furniture silhouette가 너무 강한데도 PC 조립 기능이 완성됐다는 이유로 final room quality를 통과시키는 기준.

Follow-up Risk:
- 이번 pass는 기존 local/generated GLB를 QA route에 큐레이션한 수준이다. Bruno Simon room급 상용 품질에는 여전히 authored high-quality furniture/decor GLB set, baked lightmap/material pass, exact quote PC part assets, color grading, and repeated human art QA가 필요하다.

## 2026-05-18 변경 동기화 (Room Lighting Priority + PC Subordinate Pass)
Added:
- Final room preview에 plaster softening layer, subdued ceiling surface, `industrial_wall_sconce` GLTF practical lights, and reduced hard LED-strip treatment를 추가/조정해 방/가구/조명 분위기를 PC보다 우선하도록 했다.
- `modern_ceiling_lamp_01` pendant는 작은 보조 조명으로 유지하고, wall sconce glow와 warm/cool light patches를 더해 데스크테리어 룸의 authored-lighting cue를 늘렸다.

Updated:
- 최신 `npm --workspace apps/web run lint && npm --workspace apps/web run type-check && PC_ASSEMBLY_QA_VERBOSE=1 npm --workspace apps/web run verify:pc-assembly-workbench -- --base-url=http://127.0.0.1:3100 && npm --workspace apps/web run build` evidence는 `stepCount=38`, `roomStepCount=11`, `audioEvents=50`, `saved=true`, `uniqueColorBuckets=286`, `luminanceStdDev=60.73`, `cinematicUniqueColorBuckets=388`, `cinematicLuminanceStdDev=60.94`다.
- 사용자 수정 방향을 반영해 PC는 방의 중심 요소가 아니라 직접 조립 가능한 중요한 deskterior 구성품으로 유지한다. 시각 우선순위는 방/가구 에셋 품질, 소재 레이어, 조명 분위기, 최종 screenshot human review다.

Removed/Deprecated:
- PC 본체나 LED 선을 더 밝게/크게 만들어 visual progress를 만든 것으로 판단하는 기준.
- 벽면/천장 light strip이 UI grid 또는 artifact처럼 읽히는데도 분위기 조명으로 간주하는 기준.

Follow-up Risk:
- 이번 pass는 verified prototype polish다. Bruno Simon room급 상용 품질에는 authored furniture/decor GLB set, baked/stylized material and lightmap pass, coherent color grading, exact quote PC part GLBs, asset LOD/proxy strategy, and repeated human art QA가 계속 필요하다.
- GLB가 누적되며 verifier가 느려졌다. 다음 pass에서는 visual quality와 runtime cost를 분리해 proxy/LOD/asset budget 기준을 세워야 한다.

## 2026-05-18 변경 동기화 (Open Asset Acquisition Pass)
Added:
- Kenney Furniture Kit 2.0 공식 CC0 소스 ZIP을 `assets/sources/open-license/kenney-furniture-kit/`에 확보하고, room/desk/decor 후보 GLB 24개를 `selected-glb/`로 추출했다.
- provenance와 선정 이유를 `assets/references/open-license-assets/kenney-furniture-kit/reference-pack.json`에 기록했다.
- Meshy 생성 후보는 실제 job을 실행하지 않고 `assets/references/meshy-preapproval/deskterior-pc-room-assets-2026-05-18.md`에 사용자 검수용 prompt/reference policy로 정리했다.

Updated:
- 공개 에셋 확보 우선순위는 room/furniture/decor/lighting atmosphere를 먼저 올리고, PC 부품은 조립 상호작용에 필요한 anchor-friendly proxy부터 확보하는 방향이다.
- 공개 GLB도 바로 public runtime catalog에 넣지 않는다. scale/origin/material/pivot/visual-fit 검수와 runtime metadata를 거친 뒤 catalog publish한다.

Removed/Deprecated:
- 쇼핑몰/제조사 이미지를 승인 없이 Meshy image-to-3D 입력으로 사용하는 방식.
- 브랜드 로고나 정확한 상표 외관을 prompt에 직접 요구하는 방식.

Follow-up Risk:
- Kenney GLB는 CC0이고 빠르게 쓸 수 있지만 Bruno Simon급 최종 품질에는 style/material normalization과 추가 authored pass가 필요하다.
- Meshy 후보는 승인 후에도 staging, preview, Blender inspection, optimization, attachment metadata 작성까지 끝나야 runtime asset으로 인정한다.

## 2026-05-18 변경 동기화 (Kenney QA Staging Integration Pass)
Added:
- QA 전용 route `/api/qa-assets/open-license/kenney-furniture-kit/[file]`를 추가해 `assets/sources/open-license/kenney-furniture-kit/selected-glb`의 승인된 파일만 서빙한다.
- PC assembly workbench final room에 Kenney GLB 6개를 보조 레이어로 연결했다: `bookcaseOpen`, `lampWall`, `loungeSofaLong`, `pottedPlant`, `rugRounded`, `tableCoffeeGlass`.
- `assets/references/open-license-assets/kenney-furniture-kit/qa-audit-2026-05-18.json`에 파일별 size/triangle/material/bounds/runtime URL과 QA 결과를 기록했다.

Updated:
- 최신 `npm --workspace apps/web run type-check && npm --workspace apps/web run lint && PC_ASSEMBLY_QA_VERBOSE=1 npm --workspace apps/web run verify:pc-assembly-workbench` evidence는 `stepCount=38`, `roomStepCount=11`, `audioEvents=50`, `saved=true`, `uniqueColorBuckets=285`, `luminanceStdDev=59.66`, `cinematicUniqueColorBuckets=396`, `cinematicLuminanceStdDev=60.79`다.
- QA 실행 중 새 route는 Kenney GLB 6개를 모두 `200`으로 응답했다. 첫 `--base-url` 실행은 기존 dev server가 `ERR_EMPTY_RESPONSE`를 반환해 실패했고, verifier가 직접 dev server를 띄운 재실행은 통과했다.
- 새 GLB는 public catalog publish가 아니라 QA visual staging이다. 프로덕션 승격 전 Blender origin/pivot/material pass와 runtime package metadata가 필요하다.

Removed/Deprecated:
- 공개 소스 GLB를 정식 카탈로그 자산처럼 바로 `apps/web/public/assets/models`에 복사하는 방식.
- PC 시각 존재감을 키우기 위해 새 에셋을 투입하는 방식. 이번 GLB 투입은 sofa/rug/shelf/plant/light/coffee-table 등 room/furniture/decor 품질 보강에 제한한다.

Follow-up Risk:
- Kenney 자산은 비용이 낮고 CC0지만 매우 저폴리다. Bruno-level commercial quality에는 여전히 authored material normalization, richer furniture silhouettes, baked lightmap/color-grade pass, and human visual review가 필요하다.
- QA-only API는 local/source staging에 의존하므로 배포 경로가 아니다. 정식 release 전 storage/catalog publish flow로 이동해야 한다.

## 2026-05-18 변경 동기화 (Meshy Community GLB Staging Pass)
Added:
- Meshy 커뮤니티 공개 모델은 생성 job 없이 public v1 task metadata의 `model.glb` signed URL에서 직접 확보할 수 있음을 확인했다.
- CC0로 확인한 Meshy community GLB 4개를 `assets/sources/meshy-community/selected-glb/`에 source-staging했다: `chair-rodiondbulatoff`, `rustic-table`, `rack-golden-arch`, `colorful-brick-wall`.
- provenance, public task API, author, prompt, SHA-256, GLB header, triangle/vertex/bounds/texture 정보를 `assets/references/meshy-community/download-audit-2026-05-18.json`에 기록했다.
- QA 전용 route `/api/qa-assets/meshy-community/[file]`를 추가하고, PC assembly workbench final room에 brick wall accent, golden arch rack, side table, accent chair로 배치했다.
- `apps/web/src/lib/qa/meshy-community-assets.ts`를 Meshy community QA 단일 registry로 추가해 route allowlist, workbench scene placement, verifier file checks가 같은 파일 목록을 사용하게 했다.
- `assets/references/meshy-community/qa-registry-2026-05-18.json`에 runtime route, per-asset QA usage, scene placement, promotion blocker를 기록했다.

Updated:
- 최신 `npm --workspace apps/web run type-check && npm --workspace apps/web run lint && PC_ASSEMBLY_QA_VERBOSE=1 npm --workspace apps/web run verify:pc-assembly-workbench` evidence는 `stepCount=38`, `roomStepCount=11`, `audioEvents=50`, `saved=true`, `uniqueColorBuckets=314`, `luminanceStdDev=59.16`, `cinematicUniqueColorBuckets=415`, `cinematicLuminanceStdDev=60.11`다.
- QA 실행 중 새 Meshy route는 4개 GLB를 모두 `200`으로 응답했다: `chair-rodiondbulatoff`, `colorful-brick-wall`, `rack-golden-arch`, `rustic-table`.
- Meshy community GLB는 room/furniture/decor density 보강용 staging asset이며, public catalog publish가 아니다. 프로덕션 승격 전 material normalization, pivot/origin cleanup, LOD/optimization, runtime package metadata, human visual QA가 필요하다.
- Meshy community QA route는 하드코딩된 중복 allowlist가 아니라 shared registry를 기준으로만 갱신해야 한다.

Removed/Deprecated:
- Meshy public page에서 받는 `.meshy` viewer binary를 GLB로 간주해 런타임에 연결하는 방식.
- Meshy community 모델을 provenance/audit 없이 바로 `apps/web/public/assets/models`로 복사하는 방식.

Follow-up Risk:
- Meshy public v2 metadata는 `.meshy` viewer binary를 노출하고, GLB는 v1 public task metadata에서만 확인됐다. 이 경로는 Meshy API/UI 변경에 취약하므로 production ingestion은 authenticated export/API contract로 재설계해야 한다.
- 새 GLB들은 scene 품질을 높이는 증거지만 Bruno-level 완료 기준은 아니다. authored high-quality furniture/decor set, baked/stylized material and lightmap pass, color grading, exact PC part GLBs, and repeated human art QA가 계속 필요하다.

## 2026-05-19 변경 동기화 (Meshy Community Runtime Candidate Pass)
Added:
- `scripts/blender/normalize-meshy-community-assets.py`를 추가해 Meshy community CC0 source GLB를 보수적으로 정규화한다. 이 pass는 scale을 임의 보정하지 않고 floor-contact pivot, normalized mesh/material name, material roughness/metallic clamp, review thumbnail, runtime-candidate sidecar를 만든다.
- 4개 후보 패키지를 `assets/runtime-candidates/meshy-community/`에 생성했다: `chair-rodiondbulatoff`, `rustic-table`, `rack-golden-arch`, `colorful-brick-wall`.
- `node scripts/meshopt-optimize.mjs --dest assets/runtime-candidates/meshy-community --force --skip-textures --level medium`로 후보 GLB에 glTF Transform dedup/prune/meshopt를 적용했다.
- `apps/web/scripts/verify-meshy-community-runtime-candidates.ts`와 `verify:meshy-community-assets`를 추가해 sidecar provenance, GLB header/v2, `EXT_meshopt_compression`, normalized node/material names, thumbnail, optimization report를 검증한다.

Updated:
- `assets/references/meshy-community/qa-registry-2026-05-18.json`에 각 후보의 `pageUrl`과 `publicTaskApi`를 명시해 정규화 sidecar가 provenance를 보존한다.
- 정규화 report는 `assets/references/meshy-community/normalization-report-2026-05-19.json`, 최종 optimized size report는 `assets/references/meshy-community/optimization-report-2026-05-19.json`로 분리한다.
- `verify:meshy-community-assets` evidence 기준 optimized bytes는 chair `1233876`, rustic table `7743740`, golden arch rack `6290460`, colorful brick wall `1661624`다.
- 현재 단계는 public catalog publish가 아니라 runtime-candidate staging이다. Bruno-level 승격에는 thumbnail/contact-sheet review, scene screenshot review, KTX2/LOD/proxy strategy, and human art QA가 계속 필요하다.

Removed/Deprecated:
- 정규화 전 source GLB size를 최종 runtime size처럼 기록하는 방식.
- community CC0 provenance와 Meshopt 압축만으로 visual/style fit을 통과 처리하는 방식.

Follow-up Risk:
- 후보 썸네일 기준 chair/table/rack/wall 모두 렌더 가능하지만 스타일과 scale은 최종 카메라에서 다시 판단해야 한다. 특히 brick wall은 21k triangles라 budget warning이 남아 있다.
- 런타임 후보는 아직 QA route와 별도이며 editor/public catalog path에 연결되지 않았다. 다음 pass는 후보를 QA route 또는 catalog promotion candidate로 연결하기 전에 visual accept/reject를 먼저 해야 한다.

## 2026-05-19 변경 동기화 (Blender Authored Room Detail Kit + Cinematic Reframe)
Added:
- Bruno Simon-inspired cutaway room의 wall/decor density를 높이기 위해 `scripts/blender/generate-bruno-room-detail-kit.py`를 추가했다. 이 스크립트는 pegboard, shelves, books, planter, camera, wall art, practical RGB bars, cable details를 하나의 authored GLB kit로 생성한다.
- 생성 산출물은 `assets/runtime-candidates/blender-authored/bruno-room-detail-kit/p2s_bruno_room_detail_kit.glb`, review thumbnail, 그리고 `assets/references/blender-authored/bruno-room-detail-kit/asset-review-2026-05-19.json`다.
- QA 런타임 사용을 위해 같은 GLB를 `apps/web/public/assets/models/p2s_bruno_room_detail_kit/p2s_bruno_room_detail_kit.glb`에 복사하고, PC assembly workbench final room에 `BlenderAuthoredWallDetailKit` 레이어로 배치했다.
- `verify:pc-assembly-workbench`는 authored kit의 GLB 크기, review report schema, object/material count, triangle budget, catalog-promotion blocker를 검사한다.

Updated:
- Meshy `colorful-brick-wall`은 large wall material이 아니라 작은 accent layer로 demote했다. Bruno-level room 품질은 벽 하나의 강한 패턴보다 authored furniture/decor density, material response, lighting hierarchy로 판단한다.
- Final-room cinematic composition은 더 넓은 room cutaway가 보이도록 camera, room scale, orbit target, bloom, exposure, blue practical light intensity를 조정했다.
- Latest verified evidence는 `stepCount=38`, `roomStepCount=11`, `audioEvents=50`, `saved=true`, `uniqueColorBuckets=332`, `luminanceStdDev=67.14`, `cinematicUniqueColorBuckets=417`, `cinematicLuminanceStdDev=64.73`, screenshot `output/playwright/pc-assembly-workbench-cinematic.png`다.

Removed/Deprecated:
- Meshy community brick wall을 primary wall finish처럼 크게 쓰는 방식.
- Procedural Blender GLB를 review thumbnail과 QA verifier만으로 release catalog-ready 또는 Bruno-level commercial final로 간주하는 방식.

Follow-up Risk:
- 이번 authored kit는 첫 번째 project-authored runtime QA candidate다. 아직 baked AO atlas, hand-painted normal/roughness maps, KTX2 texture package, LOD/proxy, and paid/commercial reference comparison이 없다.
- 상용 수준 승격 전에는 room shell, sofa/media cabinet/desk/shelf 같은 핵심 가구를 같은 기준으로 다시 제작하거나 고품질 오픈/상용 레퍼런스와 비교해 교체해야 한다.

## 2026-05-19 변경 동기화 (Blender Authored Room Surface Kit Pass)
Added:
- `scripts/blender/generate-bruno-room-surface-kit.py`를 추가해 대형 표면 품질 병목을 직접 개선한다. 산출물은 Blender 원본 `.blend`, runtime candidate GLB, public QA GLB, thumbnail, review JSON을 모두 생성한다.
- `p2s_bruno_room_surface_kit`는 generated diffuse atlas 기반 wood floor planks, plaster wall overlays, trim/baseboard/crown, cove LED strips, baked-shadow cards를 포함한다.
- PC assembly workbench final room은 `BlenderAuthoredRoomSurfaceKit`를 `RoomShell` 위에 얇은 authored material layer로 로드한다.
- `verify:pc-assembly-workbench`는 surface kit GLB, review report, object/material/texture count, triangle budget, commercial-promotion blocker를 추가 검증한다.

Updated:
- Codex 내부 브라우저 캡처에서 첫 surface kit가 back-wall/ceiling 좌표 문제로 카메라 앞을 막는 것을 확인했고, `export_yup` 좌표 반전을 반영해 back-wall placement를 수정했다.
- 같은 브라우저 캡처에서 우측 전면 trim과 wall reveal line이 과하게 강한 것을 확인해 full ceiling panel을 제거하고 reveal material을 낮은 alpha로 바꿨다.
- Latest verified evidence는 `stepCount=38`, `roomStepCount=11`, `audioEvents=50`, `saved=true`, `uniqueColorBuckets=337`, `luminanceStdDev=67.79`, `cinematicUniqueColorBuckets=416`, `cinematicLuminanceStdDev=65.35`, screenshot `output/playwright/pc-assembly-workbench-cinematic.png`다.

Removed/Deprecated:
- 방 품질을 React procedural `RoundedBlock` wall/floor만으로 계속 보강하는 방식.
- 전체 ceiling panel을 추가해 cutaway room 내부 시야를 막는 방식.
- 강한 검은 wall grid/reveal line을 material depth로 간주하는 방식.

Follow-up Risk:
- surface kit는 diffuse-only atlas라 상용 승격 전 normal/roughness/AO split maps, KTX2 transcode, true baked GI, LOD/proxy, commercial room-pack comparison이 필요하다.
- 이제 큰 표면은 한 단계 개선됐지만 sofa, desk, media cabinet, wall shelf 같은 핵심 가구는 여전히 prototype/mixed-source 품질이라 다음 반복의 주 대상이다.

## 2026-05-19 변경 동기화 (Blender Authored Furniture Hero Kit + Final-Room QA)
Added:
- `scripts/blender/generate-bruno-furniture-hero-kit.py`를 추가해 desk, shelf, media console/TV/speakers, plant, sofa, rug, coffee table을 포함한 대형 가구 GLB candidate를 직접 생성한다.
- 산출물은 `assets/blender/deskterior/p2s_bruno_furniture_hero_kit.blend`, `assets/runtime-candidates/blender-authored/bruno-furniture-hero-kit/p2s_bruno_furniture_hero_kit.glb`, review thumbnail, `asset-review-2026-05-19.json`, 그리고 QA public path `apps/web/public/assets/models/p2s_bruno_furniture_hero_kit/p2s_bruno_furniture_hero_kit.glb`다.
- PC assembly workbench final room은 `BlenderAuthoredFurnitureHeroKit` 레이어를 surface/detail kit 위에 로드하고, verifier는 furniture kit GLB size, review schema, object/material/texture/triangle budget, promotion gap을 검사한다.

Updated:
- 최신 hidden QA evidence는 `stepCount=38`, `roomStepCount=11`, `audioEvents=50`, `saved=true`, `uniqueColorBuckets=326`, `luminanceStdDev=63.58`, `cinematicUniqueColorBuckets=398`, `cinematicLuminanceStdDev=62.26`, screenshot `output/playwright/pc-assembly-workbench-cinematic.png`다.
- 조명 pass에서 authored GLB emissive, practical wall lamp, room point lights, bloom, cinematic exposure를 낮춰 PC/RGB/벽등이 장면을 지배하지 않도록 조정했다.
- 이번 단계는 “큰 가구 밀도와 방 구성의 직접 제작 루프가 작동한다”는 증거다. Bruno Simon급 또는 상용 catalog-ready 완료는 아니다.

Removed/Deprecated:
- 대형 가구를 React primitive와 작은 소품 GLB만으로 계속 보강하는 방식.
- generated/public GLB가 screenshot에 보인다는 이유만으로 commercial-ready 또는 Bruno-level로 완료 처리하는 방식.

Follow-up Risk:
- furniture hero kit는 158 objects, 22 materials, 6 embedded textures, 32,232 triangles, 약 5.5 MB GLB로 QA candidate 기준은 통과했지만 normal/roughness/AO split maps, KTX2, LOD/proxy, colliders, baked lighting, exact commercial reference comparison이 없다.
- 최신 screenshot은 방 밀도는 증가했지만 여전히 중심 practical highlight, 투명 GLB overlap, diffuse-only material flatness가 남아 있다. 다음 pass는 material bake/normal map, camera composition, transparent depth ordering, asset-by-asset commercial reference board를 우선한다.

## 2026-05-19 변경 동기화 (Furniture Hero Kit PBR Helper Map + Visual Cleanup Pass)
Added:
- `p2s_bruno_furniture_hero_kit` 생성 스크립트가 wood/fabric/warm-lacquer/speaker-grille material family별 `baseColor`, `normal`, `roughness`, `ambientOcclusion` helper map을 생성한다.
- `asset-review-2026-05-19.json`에 `asset.textureSet`, `generatedPbrMapCount=16`, `commercialBenchmarkRubric`를 추가해 상용 승격 전 어떤 기준이 통과/미달인지 기록한다.
- `verify:pc-assembly-workbench`는 furniture hero kit texture count 12개 이상, PBR helper map role, KTX2 미준비 상태, commercial benchmark rubric 존재를 검증한다.

Updated:
- 생성된 furniture hero kit evidence는 `158 objects`, `22 materials`, `18 embedded textures`, `32,232 triangles`, `9,980,828 bytes`다.
- Final-room pass는 high-opacity imported GLB를 opaque 렌더링으로 정리하고, Kenney/low-poly staging layer opacity, desk lamp glare, warm/cool point light, bloom, camera framing을 조정했다.
- 최신 브라우저 QA evidence는 `stepCount=38`, `roomStepCount=11`, `audioEvents=50`, `saved=true`, `uniqueColorBuckets=365`, `luminanceStdDev=64.00`, `cinematicUniqueColorBuckets=381`, `cinematicLuminanceStdDev=62.81`, screenshot `output/playwright/pc-assembly-workbench-cinematic.png`다.

Removed/Deprecated:
- diffuse-only furniture candidate를 다음 상용 비교 대상으로 그대로 유지하는 방식.
- 반투명 GLB staging layer가 sofa/rug/coffee-table silhouette를 지배해도 visual progress로 인정하는 방식.

Follow-up Risk:
- 이번 PBR map은 절차적 helper map이다. 상용 Bruno-level에는 sculpt/high-poly 또는 hand-authored texture bake, real UV unwrap, KTX2/ORM packing, meshopt/LOD/proxy/collider, baked GI/lightmap, reference-board comparison이 계속 필요하다.
- 카메라/조명은 개선됐지만 아직 사람 눈 기준으로 Bruno Simon room급 최종은 아니다. 다음 pass는 primitive 기반 가구 topology를 줄이고, 상용/open reference GLB와 나란히 비교하는 asset-by-asset contact sheet를 만들어 교체 우선순위를 정한다.

## 2026-05-19 변경 동기화 (Bruno Asset Benchmark Board + Foreground Furniture Topology Pass)
Added:
- `apps/web/scripts/build-bruno-asset-benchmark-board.ts`와 `qa:bruno-asset-benchmark`를 추가해 최신 final-room screenshot, Blender-authored furniture/surface/detail kit thumbnail, Meshy community contact sheet, 기존 product asset comparison board를 하나의 visual QA contact sheet로 묶는다.
- 새 benchmark ledger는 `assets/references/blender-authored/bruno-furniture-hero-kit/benchmark-ledger-2026-05-19.json`이며, contact sheet는 `output/visual-qa/bruno-room-asset-benchmark-contact-sheet.png`다.
- `verify:pc-assembly-workbench`는 benchmark ledger/contact sheet 존재, schema, comparison policy, panel count, benchmark gate, weakest-area ranking, next iteration order를 검증한다.
- `scripts/blender/generate-bruno-furniture-hero-kit.py`의 foreground sofa/coffee-table pass를 개선해 sofa recessed plinth, modular cushion panels, front bulges, seam piping, rounded arm caps, coffee-table aprons, inset top, lower slats, rounded corner caps, remote/controller/mug detail을 추가했다.

Updated:
- furniture hero kit 최신 evidence는 `193 objects`, `22 materials`, `18 embedded textures`, `42,956 triangles`, `10,584,100 bytes`다.
- 최신 브라우저 QA evidence는 `stepCount=38`, `roomStepCount=11`, `audioEvents=50`, `saved=true`, `uniqueColorBuckets=365`, `luminanceStdDev=64.08`, `cinematicUniqueColorBuckets=380`, `cinematicLuminanceStdDev=62.74`, screenshot `output/playwright/pc-assembly-workbench-cinematic.png`다.
- Benchmark status는 명시적으로 `not-commercial-ready`다. 이번 pass는 품질 판단 루프와 foreground topology 개선 evidence이며 Bruno Simon급 최종 완료가 아니다.

Removed/Deprecated:
- 사람 눈 기준 비교 없이 “GLB가 보이고 verifier가 통과했다”는 이유만으로 Bruno-level progress를 승인하는 방식.
- unlicensed commercial reference image를 contact sheet에 직접 포함하는 방식. 현재 board는 local authored/open/community evidence만 embed한다.

Follow-up Risk:
- screenshot 기준으로 sofa/coffee-table은 개선됐지만 아직 commercial bespoke topology, baked GI/lightmap, KTX2/ORM packing, split catalog package, collider/LOD/proxy, exact asset license review가 남아 있다.
- 다음 iteration은 ledger의 우선순위대로 foreground sofa/coffee-table 추가 sculpt pass, center lamp glare control, surface normal/roughness/AO map pass, kit split/package metadata 순서로 진행한다.

## 2026-05-19 변경 동기화 (Cinematic Highlight Metric + Contact Occlusion Pass)
Added:
- PC assembly final-room cinematic scene에 `RoomCinematicContactOcclusionPass`를 추가해 desk, sofa, shelf/media, PC 주변의 접지 그림자와 subtle floor/wall color bleed를 명시적인 QA layer로 둔다.
- `verify:pc-assembly-workbench`가 cinematic canvas의 `brightPixelRatio`와 `clippedHighlightRatio`를 측정하고, broad highlight washout과 clipped glare를 gate로 검증한다.
- Bruno benchmark ledger가 `visualMetrics.finalRoomBrightPixelRatio`와 `visualMetrics.finalRoomClippedHighlightRatio`를 기록한다.

Updated:
- 최신 검증 evidence는 `stepCount=38`, `roomStepCount=11`, `audioEvents=50`, `saved=true`, `cinematicUniqueColorBuckets=375`, `cinematicLuminanceStdDev=62.52`, `cinematicBrightPixelRatio=0.033`, `cinematicClippedHighlightRatio=0.019`다.
- Benchmark status는 계속 `not-commercial-ready`다. 이번 pass는 하이라이트/접지 계측과 runtime glare control 개선이며, true baked GI/lightmap이나 상용 topology 완료가 아니다.
- `lighting and bake` gate는 blocked가 아니라 partial로 기록한다. 런타임 contact-occlusion pass는 존재하지만 Blender-authored baked AO/lightmap pass가 아직 없다.

Removed/Deprecated:
- screenshot이 밝고 contrast가 높다는 이유만으로 조명 품질이 상용 수준이라고 판단하는 방식.
- clipped practical light나 runtime bloom을 Bruno-inspired atmosphere의 대체물로 쓰는 방식.

Follow-up Risk:
- 다음 asset pass는 ledger 1순위인 foreground sofa/coffee-table topology rebuild를 우선한다.
- 조명 쪽 다음 pass는 true baked AO/contact-shadow lightmap을 desk, sofa, shelf, media zone별로 만들고 benchmark ledger에서 runtime overlay와 분리해 기록해야 한다.

## 2026-05-19 변경 동기화 (Foreground Furniture Detail Second Pass)
Added:
- `scripts/blender/generate-bruno-furniture-hero-kit.py`의 lounge foreground pass에 sofa cushion crease/dimple, quilted back seams, arm welt piping, leg floor glides, coffee-table smoked-glass inlay, tray lips, crossbars, foot levelers, lower slats, remote buttons, controller thumbsticks, mug liquid detail을 추가했다.
- Blender headless regenerate로 `.blend`, runtime GLB, public QA GLB, thumbnail, review JSON을 다시 생성했다.

Updated:
- furniture hero kit 최신 evidence는 `249 objects`, `22 materials`, `18 embedded textures`, `53,940 triangles`, `11,234,844 bytes`다. QA triangle budget `65,000` 안에 남아 있다.
- 최신 browser QA evidence는 `stepCount=38`, `roomStepCount=11`, `audioEvents=50`, `saved=true`, `cinematicUniqueColorBuckets=376`, `cinematicLuminanceStdDev=62.36`, `cinematicBrightPixelRatio=0.032`, `cinematicClippedHighlightRatio=0.019`다.
- Benchmark ledger의 furniture topology blocker는 새 metrics를 읽도록 갱신했다. 상태는 계속 `blocked`이며, primitive-derived silhouette가 사람 눈에 남는 것이 blocker다.

Removed/Deprecated:
- `193 objects` 기준의 이전 foreground topology evidence를 최신 pass의 증거로 계속 쓰는 방식.
- 디테일 object 수 증가만으로 commercial-ready를 통과시키는 방식.

Follow-up Risk:
- 다음 geometry pass는 단순 object 추가가 아니라 sofa cushion/arm/coffee-table rail을 bespoke curved mesh로 치환해야 한다.
- 이후에는 true baked AO/contact-shadow lightmap과 surface normal/roughness/AO map pass를 진행한다.

## 2026-05-19 변경 동기화 (Surface PBR Helper + Contact Lightmap Pass)
Added:
- `scripts/blender/generate-bruno-room-surface-kit.py`가 floor/wall/trim용 `baseColor`, `normal`, `roughness`, `ambientOcclusion` helper map과 `contactShadowLightmap` RGBA texture를 생성한다.
- surface kit review JSON에 `asset.textureSet`과 `asset.bakedContactShadowPass`를 추가해 floor contact zone 7개(desk, desk accessories, PC tower, sofa, coffee table, media console, shelf)와 wall contact zone 4개를 기록한다.
- `verify:pc-assembly-workbench`와 Bruno benchmark ledger가 surface PBR/contact-shadow evidence를 별도 gate로 검증한다.

Updated:
- surface kit 최신 evidence는 `123 objects`, `11 materials`, `15 embedded textures`, `12,118 triangles`, `9,124,460 bytes`다.
- 최신 browser QA evidence는 `stepCount=38`, `roomStepCount=11`, `audioEvents=50`, `saved=true`, `cinematicUniqueColorBuckets=375`, `cinematicLuminanceStdDev=62.42`, `cinematicBrightPixelRatio=0.033`, `cinematicClippedHighlightRatio=0.019`다.
- Codex 내부 브라우저에서도 `/labs/qa/pc-assembly-workbench?qaNoLoader=1&qaComplete=1&qaCinematic=1`를 열어 `1280x720` WebGL canvas 렌더를 확인했다.
- Benchmark status는 계속 `not-commercial-ready`다. 이번 pass는 authored contact-shadow/PBR-helper evidence이며 물리적으로 path-traced 된 GI bake가 아니다.

Removed/Deprecated:
- surface kit를 diffuse-only atlas로 두고 material-depth blocker를 계속 같은 상태로 기록하는 방식.
- runtime contact-occlusion overlay만으로 baked/lightmap evidence를 대체했다고 보는 방식.

Follow-up Risk:
- 사람 눈 기준 screenshot은 여전히 sofa/coffee-table primitive silhouette, wall reveal/grid 느낌, path-traced GI 부재, KTX2/ORM packaging 부재가 보인다.
- 다음 pass는 foreground bespoke curved topology와 real AO/GI atlas 또는 art-directed ORM/KTX2 package로 이어져야 한다.

## 2026-05-19 변경 동기화 (Foreground Furniture Bespoke Curvature Pass)
Added:
- `scripts/blender/generate-bruno-furniture-hero-kit.py`에 `rounded_rect_slab`, `vertical_cylinder`, source-to-Blender vertex transform helper를 추가해 전경 소파/커피테이블 일부를 bevel cube가 아닌 명시적 rounded perimeter mesh로 생성한다.
- Furniture review JSON에 `asset.bespokeCurvaturePass`를 추가해 mesh families, sofa mesh targets, coffee-table mesh targets, human art review requirement를 기록한다.
- `verify:pc-assembly-workbench`가 furniture hero kit의 bespoke curvature metadata를 검증한다.

Updated:
- furniture hero kit 최신 evidence는 `252 objects`, `22 materials`, `18 embedded textures`, `54,822 triangles`, `11,131,040 bytes`다. QA triangle budget `65,000` 안에 남아 있다.
- 최신 automated browser QA evidence는 `stepCount=38`, `roomStepCount=11`, `audioEvents=50`, `saved=true`, `cinematicUniqueColorBuckets=375`, `cinematicLuminanceStdDev=62.45`, `cinematicBrightPixelRatio=0.033`, `cinematicClippedHighlightRatio=0.019`다.
- Codex 내부 브라우저에서 `/labs/qa/pc-assembly-workbench?qaNoLoader=1&qaComplete=1&qaCinematic=1`를 열어 `1280x720` WebGL canvas final-room을 확인했다.
- Benchmark ledger의 furniture topology gate는 `blocked`에서 `partial`로 이동했지만, 전체 status는 계속 `not-commercial-ready`다.

Removed/Deprecated:
- foreground sofa/coffee-table을 bevel cube와 소형 detail 증가만으로 계속 개선했다고 기록하는 방식.
- bespoke curvature metadata 없이 Blender regeneration만 수행하고 visual QA evidence를 갱신하지 않는 방식.

Follow-up Risk:
- 내부 브라우저 screenshot 기준 전경은 개선됐지만 wall grid/reveal, flat procedural materials, true baked GI 부재, KTX2/ORM/LOD/collider packaging 부재가 여전히 상용 품질을 막는다.
- 다음 high-value pass는 real AO/GI atlas 또는 wall/floor material bake + grid/reveal cleanup이다. 필요하면 그 다음에 소파/테이블을 full high-poly sculpt/UV unwrap/runtime proxy로 다시 제작한다.

## 2026-05-19 변경 동기화 (Wall Reveal Cleanup + Runtime Line De-emphasis)
Added:
- `scripts/blender/generate-bruno-room-surface-kit.py`가 `surface_wall_reveal_soft_wash_rgba_1k`와 `asset.wallRevealCleanupPass`를 생성한다.
- `verify:pc-assembly-workbench`가 surface kit의 wall reveal cleanup metadata를 검증한다.
- PC assembly runtime room에서 floor seam, right-wall cove strip, ceiling rib/LED line opacity를 낮춰 material cue와 UI-like grid artifact를 분리한다.

Updated:
- surface kit 최신 evidence는 `127 objects`, `12 materials`, `16 embedded textures`, `12,126 triangles`, `10,547,540 bytes`다.
- latest automated QA evidence는 `stepCount=38`, `roomStepCount=11`, `audioEvents=50`, `saved=true`, `uniqueColorBuckets=368`, `luminanceStdDev=62.99`, `cinematicUniqueColorBuckets=379`, `cinematicLuminanceStdDev=62.37`, `bright=0.033`, `clipped=0.019`다.
- Benchmark ledger는 wall reveal opacity `0.085`와 4 soft-wash zones를 surface evidence로 기록한다.

Removed/Deprecated:
- wall/floor/ceiling 선명한 seam line을 Bruno-inspired polish의 근거로 삼는 방식.
- GLB bounds 검토 없이 large wall-wash card를 추가하는 방식. 이번 pass에서 right-wall card 축 오류를 잡아 `dimensionsM[2]`를 `2.68m`로 되돌렸다.

Follow-up Risk:
- 이번 pass는 grid/reveal artifact를 줄였지만 true baked GI/AO, UV-authored commercial material, KTX2/ORM package, split catalog asset, collider/LOD/proxy readiness는 여전히 남아 있다.
- 다음 high-value pass는 실제 baked/art-directed AO/GI atlas 또는 surface ORM/KTX2 packaging이며, 그 다음은 furniture high-poly/UV rebuild와 package split이다.

## 2026-05-19 변경 동기화 (Art-Directed Bounce Lightmap Pass)
Added:
- `scripts/blender/generate-bruno-room-surface-kit.py`가 `surface_art_directed_bounce_lightmap_rgba_1k`를 생성하고 floor/wall bounce card 9개를 GLB에 추가한다.
- Surface review JSON에 `asset.artDirectedGiPass`를 추가해 floor bounce 5 zones, wall bounce 4 zones, `physicallyBaked=false`, `runtimeOverlayReplacement=false`, `stillRequiresPathTracedBake=true`를 기록한다.
- `verify:pc-assembly-workbench`가 `artDirectedBounceLightmap` texture role과 bounce-zone metadata를 검증한다.
- Bruno benchmark ledger가 lighting/bake gate와 next iteration order를 새 bounce evidence 기준으로 갱신한다.

Updated:
- surface kit 최신 evidence는 `136 objects`, `13 materials`, `17 embedded textures`, `12,144 triangles`, `11,880,204 bytes`다.
- latest automated QA evidence는 `stepCount=38`, `roomStepCount=11`, `audioEvents=50`, `saved=true`, `uniqueColorBuckets=368`, `luminanceStdDev=62.88`, `cinematicUniqueColorBuckets=378`, `cinematicLuminanceStdDev=62.31`, `bright=0.033`, `clipped=0.019`다.
- Codex 내부 브라우저에서 `/labs/qa/pc-assembly-workbench?qaNoLoader=1&qaComplete=1&qaCinematic=1`를 열어 `1280x720` canvas와 final-room 렌더를 확인했고, `output/playwright/pc-assembly-workbench-codex-browser.png`를 저장했다.

Removed/Deprecated:
- contact/wall-wash pass까지만으로 lighting bake blocker를 충분히 줄였다고 기록하는 방식.
- hand-authored bounce card를 path-traced GI, release-ready material bake, 또는 Meshy/provider generation evidence로 표현하는 방식.

Follow-up Risk:
- 이번 pass는 상용 조명 품질을 향한 중간 evidence다. 다음은 true path-traced AO/GI bake 또는 comparable UV atlas, surface ORM/KTX2 package, kit split/LOD/collider sidecar, 그리고 furniture high-poly/UV rebuild다.

## 2026-05-19 변경 동기화 (Cycles AO Bake Probe Pass)
Added:
- `scripts/blender/generate-bruno-room-surface-kit.py`가 Blender Cycles `AO` bake probe를 수행한다. 임시 floor receiver와 `desk`, `pc_tower`, `task_chair`, `sofa`, `coffee_table`, `media_console`, `shelf` blocker proxy 7개를 만들고, 48 samples로 `512x512` floor AO preview를 굽는다.
- Surface review JSON에 `asset.cyclesAoBakePass`를 추가해 `engine=CYCLES`, `bakeType=AO`, `physicallyBakedAo=true`, `pathTracedGi=false`, `stillRequiresPathTracedGi=true`, `stillRequiresFinalUvBake=true`를 기록한다.
- GLB에는 `cyclesAoBakeLightmap` texture role과 `surface_cycles_baked_floor_ao_probe_full_room` transparent floor lightmap card가 포함된다.
- raw bake preview는 `assets/runtime-candidates/blender-authored/bruno-room-surface-kit/p2s_bruno_room_surface_kit.cycles-floor-ao-bake.png`에 저장한다.

Updated:
- surface kit 최신 evidence는 `137 objects`, `14 materials`, `18 embedded textures`, `12,146 triangles`, `12,088,420 bytes`다.
- latest automated QA evidence는 `stepCount=38`, `roomStepCount=11`, `audioEvents=50`, `saved=true`, `uniqueColorBuckets=368`, `luminanceStdDev=63.03`, `cinematicUniqueColorBuckets=378`, `cinematicLuminanceStdDev=62.37`, `bright=0.033`, `clipped=0.019`다.
- Bruno benchmark ledger는 Cycles AO sample count와 blocker proxy count를 surface evidence로 기록하지만 status는 계속 `not-commercial-ready`다.
- Codex 내부 브라우저에서 `/labs/qa/pc-assembly-workbench?qaNoLoader=1&qaComplete=1&qaCinematic=1`를 열어 final room 렌더를 확인하고 `output/playwright/pc-assembly-workbench-codex-browser.png`를 갱신했다.

Removed/Deprecated:
- hand-authored bounce card만 있는 상태를 baked AO evidence로 보고하는 방식.
- Cycles AO probe를 path-traced GI, final UV bake, KTX2/ORM package, 또는 Bruno Simon급 상용 완료로 표현하는 방식.

Follow-up Risk:
- 이번 pass는 물리적으로 구운 floor AO probe이지만 단일 floor card projection이다. 다음은 room/furniture 최종 UV에 직접 굽는 AO/GI atlas, ORM/KTX2 package, split asset/LOD/collider sidecar, 그리고 human art review다.

## 2026-05-19 변경 동기화 (Surface Packed ORM Sidecar Package Pass)
Added:
- `scripts/blender/generate-bruno-room-surface-kit.py`가 floor, plaster wall, trim용 packed ORM PNG sidecar 3개를 생성한다. 채널 계약은 `R=ambientOcclusion`, `G=roughness`, `B=metallic`, `A=constantOne`이다.
- Surface review JSON에 `asset.texturePackagingPass`를 추가해 `packageStatus=orm-png-sidecar-ready-ktx2-pending`, `packedOrmMapCount=3`, `ktx2Ready=false`, `stillRequiresRuntimeKtx2Transcode=true`, `stillRequiresFinalUvBake=true`를 기록한다.
- `verify:pc-assembly-workbench`와 Bruno benchmark ledger가 `packedOrm` texture role, sidecar 파일 존재, channel semantics, texture package manifest를 검증한다.

Updated:
- surface kit 최신 evidence는 `137 objects`, `14 materials`, `21 textures`, `12,146 triangles`, `12,088,404 bytes`다.
- latest automated QA evidence는 `stepCount=38`, `roomStepCount=11`, `audioEvents=50`, `saved=true`, `uniqueColorBuckets=368`, `luminanceStdDev=63.03`, `cinematicUniqueColorBuckets=378`, `cinematicLuminanceStdDev=62.37`, `bright=0.033`, `clipped=0.019`다.
- Codex 내부 브라우저에서 `/labs/qa/pc-assembly-workbench?qaNoLoader=1&qaComplete=1&qaCinematic=1`를 열어 visible final-room render를 확인하고 `output/playwright/pc-assembly-workbench-codex-browser.png`를 갱신했다.
- Bruno benchmark status는 계속 `not-commercial-ready`다. 이번 pass는 ORM packaging evidence의 첫 단계이며 KTX2 transcode, final UV-authored bake, split runtime package, LOD/proxy/collider sidecar를 완료하지 않는다.

Removed/Deprecated:
- ORM/KTX2 package blocker를 “전부 없음”으로 기록하는 방식. 현재는 packed ORM PNG sidecar까지는 존재하고, KTX2 transcode와 final UV bake가 남은 상태로 구분한다.
- packed ORM PNG sidecar를 release-ready `.ktx2` package, final material bake, or Bruno Simon급 상용 완료로 표현하는 방식.

Follow-up Risk:
- local 환경에 `toktx` encoder가 없어 KTX2 transcode는 실행되지 않았다. 다음 pass는 `toktx` 확보 또는 CI texture encoder path를 붙여 sidecar를 KTX2로 변환하고, asset compiler/runtime catalog가 이를 참조하도록 나눠야 한다.
- Blender glTF export는 복수 `ShaderNodeTexImage` 경고를 계속 낸다. 이는 fatal은 아니지만 final material graph 정리와 UV-authored atlas packaging 전에 해결해야 한다.

## 2026-05-19 변경 동기화 (Runtime ORM Sidecar Catalog + Cinematic Clarity Pass)
Added:
- `asset:publish:bruno-room-runtime-package`가 Bruno room surface kit의 packed ORM PNG sidecar를 public runtime package descriptor와 runtime package index에 연결한다.
- Runtime package descriptor `p2s_bruno_room_surface_kit.json`가 `texturePackages[0].kind=packed_orm`, `status=orm-png-sidecar-ready-ktx2-pending`, `ktx2Ready=false`, `stillRequiresRuntimeKtx2Transcode=true`, `stillRequiresFinalUvBake=true`를 기록한다.
- `verify:pc-assembly-workbench`가 public texture manifest, public sidecar 파일 3개, runtime package index entry, channel semantics, `releaseEligible=false`를 검증한다.
- PC assembly cinematic room은 render-only로 DPR/AA, material environment response, tone exposure, room light balance를 조정해 final-room screenshot clarity를 개선한다.

Updated:
- Public runtime outputs는 `apps/web/public/assets/catalog/runtime-packages/p2s_bruno_room_surface_kit.json`, `runtime-packages.json`, `/assets/models/p2s_bruno_room_surface_kit/texture-package-2026-05-19.json`, `/assets/models/p2s_bruno_room_surface_kit/textures/*_orm_*.png`다.
- 최신 automated QA evidence는 `stepCount=38`, `roomStepCount=11`, `audioEvents=50`, `saved=true`, `uniqueColorBuckets=368`, `luminanceStdDev=65.54`, `cinematicUniqueColorBuckets=380`, `cinematicLuminanceStdDev=64.47`, `bright=0.048`, `clipped=0.021`다.
- Codex 내부 브라우저가 `/labs/qa/pc-assembly-workbench?qaNoLoader=1&qaComplete=1&qaCinematic=1`를 열어 visible final-room render를 확인하고 `output/playwright/pc-assembly-workbench-codex-browser.png`를 갱신했다.

Removed/Deprecated:
- packed ORM sidecar가 source candidate 경로에만 있고 runtime catalog에서 추적되지 않는 상태.
- DPR 1 / no MSAA cinematic capture를 최종 시각 QA 기준으로 유지하는 방식.
- runtime package descriptor에 sidecar를 붙였다는 이유로 KTX2-ready, final UV bake, split LOD/proxy/collider, 또는 Bruno Simon급 상용 완료로 표현하는 방식.

Follow-up Risk:
- `toktx`가 없어 KTX2 transcode는 여전히 미완료다. 다음 material packaging pass는 encoder path를 확보하고 `ktx2Ready=true` package만 release candidate로 승격해야 한다.
- 현재 runtime descriptor는 full GLB를 proxy fallback으로 쓰므로 true LOD/proxy/collider split이 필요하다.
- 내부 브라우저 review 기준으로 clarity는 개선됐지만 asset topology, material bake, wall/floor detail, commercial art direction은 여전히 `not-commercial-ready`다.

## 2026-05-19 변경 동기화 (Bruno Surface ORM KTX2 Promotion Pass)
Added:
- `textures:encode:bruno-surface-orm:ktx2`와 `textures:check:bruno-surface-orm:ktx2`가 Bruno room surface kit의 packed ORM sidecar 3개를 public `.ktx2`로 변환/검증한다.
- Local encoder fallback은 `ktx`, `toktx`, `basisu` 순으로 탐색한다. 현재 로컬 검증은 Homebrew `basis_universal`의 `basisu`로 실행됐다.
- `asset:publish:bruno-room-runtime-package`는 public `.ktx2` sidecar가 모두 존재할 때 runtime texture package를 `status=ktx2-ready`, `ktx2Ready=true`, `stillRequiresRuntimeKtx2Transcode=false`로 승격한다.

Updated:
- Public runtime outputs now include `/assets/models/p2s_bruno_room_surface_kit/textures/surface_floor_plank_orm_1k.ktx2`, `surface_plaster_warm_cool_orm_1k.ktx2`, and `surface_trim_warm_orm_512.ktx2`.
- Latest automated QA evidence is `stepCount=38`, `roomStepCount=11`, `audioEvents=50`, `saved=true`, `uniqueColorBuckets=368`, `luminanceStdDev=65.54`, `cinematicUniqueColorBuckets=380`, `cinematicLuminanceStdDev=64.47`, `bright=0.048`, `clipped=0.021`.
- Visual review of `output/playwright/pc-assembly-workbench-cinematic.png` still reads as QA-candidate, not Bruno Simon-level commercial final.

Removed/Deprecated:
- Recording the runtime surface package as KTX2-blocked after all three public sidecars exist and validate.
- Treating KTX2-ready ORM sidecars as final UV-authored material bake, true GI, split LOD/proxy/collider package, or commercial art approval.

Follow-up Risk:
- KTX2 transcode blocker is reduced, but final UV-authored AO/GI/ORM atlases, material graph cleanup, true LOD/proxy/collider split, stronger furniture/prop topology, and human art review remain required before commercial promotion.

## 2026-05-19 변경 동기화 (Runtime KTX2 ORM Material Binding Pass)
Added:
- PC assembly workbench now loads the Bruno surface texture package manifest at runtime and applies the packed ORM `.ktx2` sidecars to the actual GLB material instances for floor wood, plaster wall, subtle plaster reveal, and trim.
- `p2s_bruno_room_surface_kit.glb` now carries source-authored second UV data for AO/lightmap sampling. The runtime accepts glTF `TEXCOORD_1` as Three.js `geometry.attributes.uv1` and only falls back to copying `uv` when a mesh truly lacks a second UV.
- `verify:pc-assembly-workbench` now waits for browser-side material evidence through `window.__DESKTERIORONLINE_BRUNO_SURFACE_QA__` and fails if the KTX2 package is not consumed by visible scene materials.

Updated:
- Latest verified QA evidence is `stepCount=38`, `roomStepCount=11`, `audioEvents=50`, `saved=true`, `brunoSurfaceOrmConsumed=true`, `brunoSurfaceOrmRoles=floorWoodOrm,plasterWallOrm,trimOrm`, `brunoSurfaceAoUv2ReadyMeshCount=89`, and `brunoSurfaceUv2PatchedMeshCount=0`.
- Latest screenshot evidence is `uniqueColorBuckets=369`, `luminanceStdDev=65.31`, `cinematicUniqueColorBuckets=377`, `cinematicLuminanceStdDev=64.11`, `cinematicBrightPixelRatio=0.047`, and `cinematicClippedHighlightRatio=0.021`.
- Verification passed: `type-check`, `lint`, `verify:pc-assembly-workbench`, and production `build`.

Removed/Deprecated:
- Treating KTX2 ORM sidecars as meaningful visual progress when the runtime material graph still ignores the package manifest.
- Treating runtime-generated UV fallback as equivalent to source-authored second UV evidence.

Follow-up Risk:
- This clears the runtime material-binding gap only. The current screenshot is still `not-commercial-ready`; next work remains final UV-authored AO/GI/ORM atlases, material graph cleanup, furniture/prop topology, room composition, split LOD/proxy/collider packages, and human art review.

## 2026-05-19 변경 동기화 (Authored Furniture Overlap + Curvature Expansion Pass)
Added:
- PC assembly cinematic room now centralizes `authoredFurnitureHeroActive` so the Blender-authored furniture hero kit controls the lounge foreground layer.
- When the authored furniture hero is active, the runtime suppresses legacy lounge community meshes and skips the large procedural block sofa/table bodies. Only lightweight sofa textile details and coffee-table surface props remain as overlay accents.
- `scripts/blender/generate-bruno-furniture-hero-kit.py` expanded the bespoke curvature pass: sofa back panels, pillows, throw blanket, round legs, coffee-table tray lips, and aprons now use rounded/tapered generated geometry instead of only bevelled cubes.
- `verify:pc-assembly-workbench` now asserts the overlap-control wiring so future work cannot accidentally draw the legacy block sofa over the authored hero kit.

Updated:
- Latest furniture hero kit evidence is `252 objects`, `22 materials`, `18 textures`, `56,408 triangles`, and `11,006,448 bytes` for both runtime and public GLB outputs.
- Latest verified QA evidence is `stepCount=38`, `roomStepCount=11`, `audioEvents=50`, `brunoSurfaceOrmConsumed=true`, `brunoSurfaceAoUv2ReadyMeshCount=89`, `brunoSurfaceUv2PatchedMeshCount=0`, `cinematicUniqueColorBuckets=368`, `cinematicLuminanceStdDev=64.38`, `cinematicBrightPixelRatio=0.047`, and `cinematicClippedHighlightRatio=0.021`.
- Verification passed: `type-check`, `lint`, `qa:bruno-asset-benchmark`, `verify:pc-assembly-workbench`, production `build`, and Codex internal browser load of `/labs/qa/pc-assembly-workbench?qaNoLoader=1&qaComplete=1&qaCinematic=1`.

Removed/Deprecated:
- Drawing the legacy block sofa/table and authored furniture hero kit in the same final cinematic state.
- Counting community lounge chair/table meshes as foreground quality evidence when the authored hero furniture is already active.
- Describing this curvature expansion as a commercial-ready furniture asset; the benchmark ledger remains `not-commercial-ready`.

Follow-up Risk:
- The foreground now reads less like duplicated blocks, but the screenshot is still not Bruno Simon/commercial-ready. Remaining blockers are final UV-authored material/bake atlases, deeper wall/floor lightmap/GI work, camera/composition art direction, split LOD/proxy/collider packages, and human comparison review against licensed/open commercial-quality references.

## 2026-05-19 변경 동기화 (Cinematic Exposure + QA Stability Pass)
Added:
- PC assembly cinematic room now uses a centralized `cinematicRoomLightingProfile` for ambient, directional, warm/cool wall lights, practical lights, spotlights, and vignette darkness.
- Cinematic capture exposure is lowered to `0.42` and the final room camera/fog are tightened to reduce pastel wash and improve furniture/wall depth.
- `verify:pc-assembly-workbench` now waits for a stable QA registry before clicking controls so Next dev transient reloads do not make the test flaky.
- The same verifier now keeps stricter cinematic exposure gates: `brightPixelRatio <= 0.12` and `clippedHighlightRatio <= 0.055`.

Updated:
- Latest verified evidence is `stepCount=38`, `roomStepCount=11`, `audioEvents=50`, `brunoSurfaceOrmConsumed=true`, `brunoSurfaceAoUv2ReadyMeshCount=89`, `brunoSurfaceUv2PatchedMeshCount=0`, `cinematicUniqueColorBuckets=345`, `cinematicLuminanceStdDev=58.28`, `cinematicBrightPixelRatio=0.028`, and `cinematicClippedHighlightRatio=0.013`.
- Verification passed: `type-check`, `lint`, `verify:pc-assembly-workbench`, and production `build`.
- The current screenshot evidence is `output/playwright/pc-assembly-workbench-cinematic.png`.

Removed/Deprecated:
- Scattered high-key room light values that can drift back toward broad wall/furniture washout.
- Treating a QA registry as ready immediately after first creation during local Next dev reloads.

Follow-up Risk:
- This improves exposure and test stability only. The screenshot still reads below Bruno Simon/commercial level because final UV-authored AO/GI/lightmap atlases, material graph cleanup, stronger furniture/prop topology, split LOD/proxy/collider packages, and human art review remain open.

## 2026-05-19 변경 동기화 (Asset Quality Triage + Curated Overlay Pass)
Added:
- PC assembly cinematic room now suppresses low-quality procedural fallback overlap for the authored hero state: desk, shelf, media-console, lounge, and selected community placements are reduced to curated GLB/overlay layers.
- The Compuzone PC build kit is rendered more opaquely in the desk scene so the imported GLB reads as hardware instead of a ghosted placeholder.
- Asset audit now explicitly tracks the quality gap: `p2s_bruno_furniture_hero_kit.glb` has `56,408` triangles, `252` meshes, `20` materials, and `12` textures, but much of the topology is still cube/sphere-derived and lacks tangents; `p2s_bruno_room_surface_kit.glb` has `12,146` triangles and remains slab-heavy.

Updated:
- Latest verified QA evidence is `stepCount=38`, `roomStepCount=11`, `audioEvents=50`, `saved=true`, `brunoSurfaceOrmConsumed=true`, `brunoFurnitureOrmConsumed=true`, `brunoSurfaceAoUv2ReadyMeshCount=89`, `brunoFurnitureAoUv2ReadyMeshCount=117`, `cinematicUniqueColorBuckets=310`, `cinematicLuminanceStdDev=58.75`, `cinematicBrightPixelRatio=0.030`, and `cinematicClippedHighlightRatio=0.013`.
- Current screenshot evidence remains `output/playwright/pc-assembly-workbench-cinematic.png`.
- The primary blocker is now recorded as source asset quality, not exposure or QA wiring.

Removed/Deprecated:
- Treating fallback/procedural block furniture overlays as acceptable final-room quality evidence.
- Presenting the current authored kits as Bruno Simon/commercial-ready assets.

Follow-up Risk:
- The next high-impact work is true replacement/remake of large visible assets: room shell/cutaway walls, sofa, desk, shelf/books, media console/right-wall unit, PC case material pass, and dense desk props.
- Commercial promotion still requires final UV bakes, tangents/normal maps, authored AO/GI atlases, LOD/collider/proxy packages, and side-by-side human reference review against open or licensed high-quality assets.

## 2026-05-19 변경 동기화 (Authored Surface De-overlap Pass)
Added:
- PC assembly cinematic room now has an authored-surface mode that suppresses the heavy legacy procedural room shell/floor plank/wall-panel fallback when the Blender-authored Bruno surface GLB is active.
- Wall plaster softening now respects the authored-surface mode: the ceiling/top slab overlay is skipped, and the back/right wall color overlays are reduced so authored wall and floor geometry can read more clearly.

Updated:
- Latest verified QA evidence is `stepCount=38`, `roomStepCount=11`, `audioEvents=50`, `saved=true`, `brunoSurfaceOrmConsumed=true`, `brunoFurnitureOrmConsumed=true`, `brunoSurfaceAoUv2ReadyMeshCount=89`, `brunoFurnitureAoUv2ReadyMeshCount=117`, `cinematicUniqueColorBuckets=299`, `cinematicLuminanceStdDev=67.66`, `cinematicBrightPixelRatio=0.046`, and `cinematicClippedHighlightRatio=0.026`.
- Visual review of `output/playwright/pc-assembly-workbench-cinematic.png` confirms the previous fallback overlap is reduced, but the result still reads below Bruno Simon/commercial asset quality.
- The current primary quality blocker is source asset authorship: visible forms are still too slab/cube-derived, UV/tangent/material bake coverage is not final, and large props lack the silhouette/detail density expected from commercial GLB assets.

Removed/Deprecated:
- Treating legacy procedural block floor/wall/ceiling overlays as acceptable final-room visual evidence when authored surface GLB assets are present.
- Continuing to tune exposure/lighting as the main path to Bruno Simon-level quality while the large visible room and furniture assets remain below target.

Follow-up Risk:
- Next work should prioritize replacing or remaking the large visible assets in this order: room shell/cutaway walls/window, floor material and edge trim, sofa/chair, desk/shelf/books, media console/right-wall unit, PC case material pass, and dense desk props.
- Commercial promotion still requires final UV-authored AO/GI/ORM bakes, tangents/normal maps, LOD/proxy/collider splits, and side-by-side human review against open or licensed commercial-quality reference assets.

## 2026-05-19 변경 동기화 (Room Surface Asset Quality Pass)
Added:
- `p2s_bruno_room_surface_kit` was regenerated with a warmer floor-gap substrate, tighter long-plank flooring, layered cutaway plywood/dark reveal edges, and authored right-wall window recess/glass/sill/blind details.
- The Bruno room surface runtime package was republished after KTX2 ORM sidecars were re-encoded and re-validated.
- Current asset quality triage treats source GLB authorship as the primary blocker, ahead of interaction logic, QA wiring, or exposure tuning.

Updated:
- Latest `p2s_bruno_room_surface_kit` metrics are `142` objects, `18` materials, `21` textures, `12,686` triangles, and `12,048,000` runtime/public GLB bytes.
- Latest verified QA evidence is `stepCount=38`, `roomStepCount=11`, `audioEvents=50`, `saved=true`, `brunoSurfaceOrmConsumed=true`, `brunoFurnitureOrmConsumed=true`, `brunoSurfaceAoUv2ReadyMeshCount=86`, `brunoSurfaceUv2PatchedMeshCount=86`, `brunoFurnitureAoUv2ReadyMeshCount=117`, `cinematicUniqueColorBuckets=299`, `cinematicLuminanceStdDev=67.06`, `cinematicBrightPixelRatio=0.043`, and `cinematicClippedHighlightRatio=0.026`.
- Visual review of `output/playwright/pc-assembly-workbench-cinematic.png` confirms floor readability and cutaway edge layering improved, but the room still reads below Bruno Simon/commercial asset quality.
- Verification passed after this pass: `type-check`, `lint`, `qa:bruno-asset-benchmark`, `verify:pc-assembly-workbench`, and production `build`.

Removed/Deprecated:
- Treating black-grid/tile-like floor seams, flat single-layer cutaway slabs, or large translucent wall overlays as acceptable room-surface final quality.
- Treating the current authored room/furniture kits as commercial-ready simply because runtime package, KTX2 sidecars, and QA hooks are wired.

Follow-up Risk:
- The right wall/window remains a high-visibility blocker because the authored window detail still sits against slab-like wall geometry; the next surface pass should split the right wall into real sections around the opening instead of relying on overlay detail.
- Furniture/desk/shelf/media-console/PC case assets remain the bigger commercial-quality gap: silhouettes are still too block-derived, material response is procedural-heavy, and dense prop detailing is below the Bruno Simon reference.
- Commercial promotion still requires stronger source GLB assets, UV unwrap/tangent cleanup, baked AO/GI/ORM atlases, normal/detail maps, true LOD/proxy/collider splits, and side-by-side review against open or licensed commercial-quality references.

## 2026-05-19 변경 동기화 (Right Wall Cutout + Overlay Solidification Pass)
Added:
- `p2s_bruno_room_surface_kit` now authors the right wall as segmented plaster around a real window opening instead of a single full-height slab behind the glass.
- The authored side wall includes inner reveal jamb/head/sill pieces, split horizontal reveal lines, and split right-wall wash cards so the window zone is not covered by a full overlay card.
- PC assembly cinematic runtime now suppresses the large authored-surface side-wall tint block and makes cutaway frame rails/posts read more solid instead of glass-like.

Updated:
- Latest room surface GLB metrics are `152` objects, `18` materials, `21` textures, `13,554` triangles, and `12,095,920` runtime/public GLB bytes.
- Latest verified QA evidence is `stepCount=38`, `roomStepCount=11`, `audioEvents=50`, `saved=true`, `brunoSurfaceOrmConsumed=true`, `brunoFurnitureOrmConsumed=true`, `brunoSurfaceAoUv2ReadyMeshCount=94`, `brunoSurfaceUv2PatchedMeshCount=94`, `brunoFurnitureAoUv2ReadyMeshCount=117`, `cinematicUniqueColorBuckets=307`, `cinematicLuminanceStdDev=67.08`, `cinematicBrightPixelRatio=0.043`, and `cinematicClippedHighlightRatio=0.027`.
- Visual review of `output/playwright/pc-assembly-workbench-cinematic.png` confirms the right cutaway frame reads less like a transparent slab. The result remains below Bruno Simon/commercial asset quality.
- Verification passed: `type-check`, `lint`, `qa:bruno-asset-benchmark`, `textures:encode:bruno-surface-orm:ktx2 -- --force`, `textures:check:bruno-surface-orm:ktx2`, `asset:publish:bruno-room-runtime-package`, `verify:pc-assembly-workbench`, and production `build`.

Removed/Deprecated:
- Using one transparent runtime side-wall plaster tint block over the authored right-wall GLB in the final cinematic state.
- Low-opacity authored cutaway frame rails/posts that make wall thickness read like glass instead of solid room construction.

Follow-up Risk:
- The wall/window pass is improved but still not a commercial asset. It still needs real UV-authored wall sections, better mitered trim, higher-quality glass/blinds, and path-traced wall/floor GI.
- The dominant remaining asset-quality blocker has moved back to the large furniture/deskterior props: sofa/chair, desk, shelf/books, media console, PC case, and dense desk accessories require replacement or a higher-detail Blender/Meshy/open-license asset pass.

## 2026-05-19 변경 동기화 (Furniture Source Asset Quality Pass)
Added:
- Authored furniture mode now returns no legacy `SofaArea` overlay when `authoredHeroActive=true`, so low-quality fallback sofa/table meshes no longer sit on top of the Blender-authored furniture GLB.
- `scripts/blender/generate-bruno-furniture-hero-kit.py` adds source GLB details for the visible lounge area: rear upholstered sofa shell, rear top/lower bolsters, rear panel seams, recessed fabric tufts, cushion-front bulges, side stitches, throw blanket hems/tassel knots, pillow corner pinches, coffee-table recessed drawer front, pull highlight, screw caps, and glass reflection streaks.
- Furniture ORM sidecars were re-encoded to KTX2 after regeneration, and the benchmark board was regenerated.

Updated:
- Latest furniture hero kit evidence is `307 objects`, `22 materials`, `22 textures`, `64,990 triangles`, and `11,499,724 bytes` for both runtime and public GLB outputs. The triangle count stays just inside the QA budget of `65,000`.
- Latest verified QA evidence is `stepCount=38`, `roomStepCount=11`, `audioEvents=50`, `saved=true`, `brunoSurfaceOrmConsumed=true`, `brunoSurfaceAoUv2ReadyMeshCount=94`, `brunoSurfaceUv2PatchedMeshCount=94`, `brunoFurnitureOrmConsumed=true`, `brunoFurnitureAoUv2ReadyMeshCount=134`, `brunoFurnitureUv2PatchedMeshCount=134`, `cinematicUniqueColorBuckets=309`, `cinematicLuminanceStdDev=67.17`, `cinematicBrightPixelRatio=0.043`, and `cinematicClippedHighlightRatio=0.027`.
- Visual review of `output/playwright/pc-assembly-workbench-cinematic.png` confirms the duplicated/low-quality fallback sofa is gone and foreground furniture has more authored detail, but the room still reads like a stylized low-poly authored set rather than Bruno Simon/commercial-quality GLB content.
- Verification passed: `textures:encode:bruno-furniture-orm:ktx2 -- --force`, `textures:check:bruno-furniture-orm:ktx2`, `type-check`, `lint`, `qa:bruno-asset-benchmark`, and `verify:pc-assembly-workbench`.

Removed/Deprecated:
- Treating runtime overlay cleanup as sufficient for asset quality. The current blocker is source GLB authoring quality, not simply lighting or overlap.
- Rendering curated/legacy lounge fallback meshes as final cinematic quality evidence when the authored furniture package is active.

Follow-up Risk:
- This pass improves the current GLB, but it is still not commercial-ready because the geometry is procedural and primitive-derived. Bruno-level next steps are replacing/remaking the largest visible assets with higher-quality open/licensed/Meshy-approved/source-authored GLBs, final UV unwraps, tangent/normal detail, baked AO/GI/lightmap atlases, LOD/proxy/collider sidecars, and repeated side-by-side art review.

## 2026-05-19 변경 동기화 (Continuous Upholstery Asset Pass)
Added:
- `p2s_bruno_furniture_hero_kit` now replaces the separate sofa seat/back block groups with continuous UV-bearing upholstery meshes: `soft_horizontal_upholstery_surface` and `soft_vertical_upholstery_surface`.
- The new sofa surfaces carry crown/depression shaping, integrated seam/welt evidence, soft button detail, and explicit triangle-budget metadata in the asset review JSON.
- Furniture ORM sidecars were re-encoded to KTX2 after regeneration, and the Bruno benchmark board plus full PC assembly workbench verifier were rerun.

Updated:
- Latest furniture hero kit evidence is `292 objects`, `22 materials`, `22 textures`, `63,714 triangles`, `triangleBudgetStatus=pass`, and `11,337,852 bytes` for runtime/public GLB outputs.
- Latest verified QA evidence is `stepCount=38`, `roomStepCount=11`, `audioEvents=50`, `saved=true`, `brunoSurfaceOrmConsumed=true`, `brunoSurfaceAoUv2ReadyMeshCount=94`, `brunoSurfaceUv2PatchedMeshCount=94`, `brunoFurnitureOrmConsumed=true`, `brunoFurnitureAoUv2ReadyMeshCount=119`, `brunoFurnitureUv2PatchedMeshCount=119`, `cinematicUniqueColorBuckets=309`, `cinematicLuminanceStdDev=67.24`, `cinematicBrightPixelRatio=0.043`, and `cinematicClippedHighlightRatio=0.027`.
- Verification passed: `textures:encode:bruno-furniture-orm:ktx2 -- --force`, `textures:check:bruno-furniture-orm:ktx2`, `type-check`, `lint`, `qa:bruno-asset-benchmark`, `verify:pc-assembly-workbench`, and production `build`.
- Visual review of `output/playwright/pc-assembly-workbench-cinematic.png` confirms the sofa foreground reads less like separate block cushions, but the full room remains below Bruno Simon/commercial asset quality.

Removed/Deprecated:
- Adding more cube/sphere seam objects as the main path to quality once the furniture GLB is already at the triangle budget ceiling.
- Treating a 65k-triangle procedural furniture kit as commercial-ready without continuous surfaces, final UV bake, LOD/proxy/collider splits, and human art review.

Follow-up Risk:
- The next asset-quality pass should split the monolithic furniture hero kit into selectable/LOD-managed sub-assets and replace the desk, shelving/books, media console, and PC case with stronger open/licensed/Meshy-approved/source-authored GLBs.
- Commercial promotion remains blocked by source asset authorship, final UV/tangent cleanup, baked AO/GI/lightmap atlases, material depth, package splits, and side-by-side human review.

## 2026-05-19 변경 동기화 (Foreground Sofa Rear Continuous Shell Pass)
Added:
- `p2s_bruno_furniture_hero_kit` now replaces the visible foreground sofa rear's grid/tuft/block construction with a single `soft_rear_upholstery_shell` mesh family.
- The new rear shell records `hero_sofa_rear_continuous_wrapped_upholstery_shell`, top piping, lower fabric skirt, subtle vertical welts, and corner fold details in the furniture review metadata.
- Furniture KTX2 package state is now synchronized into the asset-review JSON after encoding so runtime texture readiness no longer contradicts the generated sidecar files.

Updated:
- Latest furniture hero kit evidence is `282 objects`, `22 materials`, `22 textures`, `63,896 triangles`, `triangleBudgetStatus=pass`, and `11,300,956 bytes` for runtime/public GLB outputs.
- Latest verified QA evidence is `stepCount=38`, `roomStepCount=11`, `audioEvents=50`, `saved=true`, `brunoSurfaceOrmConsumed=true`, `brunoSurfaceAoUv2ReadyMeshCount=94`, `brunoSurfaceUv2PatchedMeshCount=94`, `brunoFurnitureOrmConsumed=true`, `brunoFurnitureAoUv2ReadyMeshCount=121`, `brunoFurnitureUv2PatchedMeshCount=121`, `cinematicUniqueColorBuckets=309`, `cinematicLuminanceStdDev=67.34`, `cinematicBrightPixelRatio=0.043`, and `cinematicClippedHighlightRatio=0.027`.
- Verification passed: `textures:encode:bruno-furniture-orm:ktx2 -- --force`, `textures:check:bruno-furniture-orm:ktx2`, `type-check`, `lint`, production `build`, `verify:pc-assembly-workbench`, and `qa:bruno-asset-benchmark`.
- Visual review of `output/playwright/pc-assembly-workbench-cinematic.png` confirms the foreground sofa rear reads less like a drawer/grid panel. The full scene still remains below Bruno Simon/commercial asset quality.

Removed/Deprecated:
- Treating rear sofa quality as a collection of primitive seam cubes, tuft spheres, and separate bolsters when it is a large foreground upholstery surface.
- Treating KTX2 readiness as a runtime-only fact while stale review metadata still reports the package as pending.

Follow-up Risk:
- The core blocker remains source asset quality. The next highest ROI work is replacing/remaking the desk, shelf/books, media console, PC case, dense desk props, and remaining sofa/chair forms with stronger open/licensed/Meshy-approved/source-authored GLBs.
- Commercial promotion remains blocked by final UV unwraps, tangents, baked AO/GI/lightmaps, material-depth maps, LOD/proxy/collider splits, and side-by-side human review against licensed/open high-quality references.

## 2026-05-20 변경 동기화 (Standalone Foreground Sofa GLB Pass)
Added:
- Foreground lounge sofa is now split out as a standalone Blender-authored GLB: `p2s_premium_dark_sofa`.
- `scripts/blender/generate-premium-sofa-asset.py` generates the source `.blend` and public GLB with separate named materials for deep navy fabric, lifted cushion fabric, seam/welt material, muted blue throw, warm linen pillow, and blackened metal feet.
- The PC assembly cinematic route hides `hero_sofa_*` meshes from the monolithic furniture hero kit and places the standalone sofa GLB in the lounge foreground.

Updated:
- Standalone sofa evidence is `33 nodes`, `33 meshes`, `6 materials`, `23,436 triangles`, and `1.0M` public GLB bytes.
- Verification passed: `npm --workspace apps/web run type-check`, `npm --workspace apps/web run lint`, and Playwright screenshot capture at `output/playwright/pc-assembly-workbench-sofa-glb-asset.png`.
- Manual visual verdict: the foreground sofa now has a dedicated GLB asset path and clearer rear panel, legs, seams, throw, and pillow silhouette. It is still not Bruno Simon/commercial-ready because the asset is procedurally authored and lacks final UV fabric texture, baked AO/GI/lightmap, and close-up material detail.

Removed/Deprecated:
- Treating React-only sofa overlays as the quality path for the foreground lounge sofa.
- Keeping the monolithic furniture hero kit's `hero_sofa_*` meshes visible when a dedicated sofa asset is active.

Follow-up Risk:
- The sofa pass is a scoped improvement, not full scene parity. Remaining high-impact blockers are desk/shelf/media-console/PC-case source asset quality, final material baking, lighting/GI, and side-by-side human review against licensed/open commercial-quality references.

## 2026-05-20 변경 동기화 (Standalone Workstation Hero GLB Failed Candidate)
Added:
- Desk/workstation cluster was split out as a standalone Blender-authored candidate GLB: `p2s_premium_workstation_hero`.
- `scripts/blender/generate-premium-workstation-asset.py` generated the source `.blend`, public GLB, and review JSON for the desk, monitor, secondary display, keyboard, mouse, microphone arm, desk lamp, desk mat, notebook, mug, planter, speakers, managed cables, and white glass PC tower.
- The failed candidate is kept as evidence only. It is not approved as a commercial-quality asset and must not be promoted without a reference comparison + regeneration loop.
- Comparison loop artifact: `assets/references/blender-authored/premium-workstation-hero/generation-loop-2026-05-20.md`.

Updated:
- Standalone workstation exported GLB evidence is `157 nodes`, `157 meshes`, `29 materials`, `1 embedded texture`, `55,076 triangles`, and `2.7M` public GLB bytes.
- Review metadata records `159 nodes`, `157 exportable meshes`, `31 source materials`, and `55,076 triangles` before glTF material pruning.
- The route-level workstation activation is disabled by `ENABLE_PREMIUM_WORKSTATION_HERO=false` because the visual review failed.
- Previous build/QA passing only proved load/integration behavior. It did not prove commercial visual quality.
- Failed workstation screenshot artifact is `output/playwright/pc-assembly-workbench-workstation-hero.png`; latest full cinematic QA artifact is `output/playwright/pc-assembly-workbench-cinematic.png`.

Removed/Deprecated:
- Treating generated triangle/material counts, GLB load success, or Playwright flow completion as evidence of Bruno/commercial-level asset quality.
- Promoting a procedural Blender candidate into the active room before standalone reference comparison, failure diagnosis, and regeneration.

Follow-up Risk:
- The desk/workstation area still needs a new Blender-authored candidate generated from the comparison loop. Remaining blockers are silhouette fidelity, bevel/detail hierarchy, final UV texture atlases, baked AO/GI/lightmaps, LOD/proxy/collider packaging, and side-by-side human review against licensed/open commercial workstation assets.

## 2026-05-20 변경 동기화 (Workstation Asset Generation Loop V2/V3)
Added:
- Workstation asset generation now keeps failed and current candidates in versioned standalone paths instead of overwriting the active room asset path.
- V2 candidate outputs: `p2s_premium_workstation_hero_v2.blend`, `p2s_premium_workstation_hero_v2.glb`, and `workstation-v2-review-board.png`.
- V3 candidate outputs: `p2s_premium_workstation_hero_v3.blend`, `p2s_premium_workstation_hero_v3.glb`, and `workstation-v3-review-board.png`.
- The generation loop artifact records reference targets, V1 failure analysis, V2 rejection, V3 regeneration, and remaining blockers.

Updated:
- V2 was rejected because large visible planes rendered like magenta fallback/over-saturated material, making the desk mat and PC front visually worse.
- V3 removes generated texture dependence from large planes, uses a satin-white PC front with graphite mesh insert, changes the desk mat to charcoal, and replaces screen texture dependence with muted geometry UI bars.
- V3 evidence: `377 nodes`, `372 mesh/curve objects`, `94,684 triangles`, `4.7M` GLB bytes, and post-export reopen audit with `0` missing external images and `0` unmaterialed objects.

Removed/Deprecated:
- Promoting any generated workstation candidate into the room scene before the standalone review board and generation-loop artifact identify it as approved.
- Treating a later iteration as automatically acceptable just because it improves one failure mode from the previous iteration.

Follow-up Risk:
- V3 is better than V2, but still not commercial/Bruno-level. It needs true UV atlas, authored PBR texture maps, baked AO/GI/lightmap, product-accurate PC internals, LOD/proxy/collider package, and human side-by-side visual approval before scene integration.

## 2026-05-20 변경 동기화 (Workstation V4/V5 UV/PBR 결함 처리)
Added:
- V4/V5 workstation 후보를 standalone versioned asset으로 생성했다: `p2s_premium_workstation_hero_v4`, `p2s_premium_workstation_hero_v5`.
- V4/V5 산출물은 source `.blend`, public GLB, basecolor atlas, ORM atlas, preview renders, review board, review JSON을 함께 남긴다.
- V5 review board는 `assets/references/blender-authored/premium-workstation-hero/workstation-v5-review-board.png`이며 V4의 atlas sampling regression과 V5 결과를 나란히 비교한다.

Updated:
- V4는 `UVAtlas`, `LightmapUV2`, packed atlas artifacts, contact AO decals, richer PC internals를 추가했지만 shader가 `UVAtlas`를 명시적으로 샘플링하지 않아 visible patchwork regression이 생겼다.
- V5는 shared material에 explicit UV Map node를 연결하고 `UVAtlas`를 active/render-active로 지정해 V4의 패치워크 결함을 제거했다.
- V5 evidence: `425 nodes`, `420 mesh/curve objects`, `116,580 triangles`, `4` texture images, `6.0M` GLB bytes, `212` atlas-assigned meshes, `212` active UVAtlas meshes, `212` LightmapUV2 meshes, `0` missing external images, `0` unmaterialed objects.

Removed/Deprecated:
- UV layer를 생성했다는 사실만으로 material이 올바른 UV channel을 사용한다고 간주하는 방식.
- generated atlas를 만든 뒤 shader/preview에서 실제 sampling channel을 검증하지 않고 scene promotion 후보로 보는 방식.

Follow-up Risk:
- V5는 V4의 핵심 시각 결함을 고친 후보지만 아직 상용/Bruno-level 승인본이 아니다. 남은 결함은 hand-authored texture polish, true renderer-baked GI/lightmap, exact product geometry, LOD/proxy/collider/support metadata, 그리고 human side-by-side approval이다.

## 2026-05-20 변경 동기화 (Workstation V6/V7/V8 Desk Detail Loop)
Added:
- V6/V7/V8 workstation 후보를 standalone versioned asset으로 생성했다: `p2s_premium_workstation_hero_v6`, `p2s_premium_workstation_hero_v7`, `p2s_premium_workstation_hero_v8`.
- V6는 desk/desktop object micro-detail을 추가했고, V7은 V6의 tabletop seam/grid regression을 수정했으며, V8은 keyboard/mouse/monitor/speaker/PC case/desk/small props의 product-scale detail을 추가했다.
- 최신 review board는 `assets/references/blender-authored/premium-workstation-hero/workstation-v8-review-board.png`다.
- 최신 review JSON은 `assets/references/blender-authored/premium-workstation-hero/asset-review-v8-2026-05-20.json`이며 post-export audit과 pixel regression evidence를 포함한다.

Updated:
- V8 evidence: `716 nodes`, `710 mesh/curve objects`, `160,500 triangles`, `4` texture images, `9.0M` GLB bytes, `290` marked desktop micro-detail objects.
- V8 reopen audit: `212` UVAtlas meshes, `212` active UVAtlas meshes, `283` DetailUV meshes, `495` LightmapUV2 meshes, `0` unmaterialed objects, `0` missing external images.
- V8 tabletop regression check: V7 tabletop high-chroma-edge ratio `0.1076` -> V8 `0.0742`; V7 tabletop warm ratio `0.1036` -> V8 `0.0893`.
- V8 is the strongest standalone workstation candidate in this loop, but it remains review-only and is not connected to the active room scene.

Removed/Deprecated:
- Adding desk details without checking whether they create UI-like seam/grid artifacts.
- Treating product-scale prop detail count as commercial approval without hand-authored texture polish, true GI/lightmap bake, runtime LOD/proxy packaging, and human side-by-side review.

Follow-up Risk:
- The next workstation pass should not simply add more tiny blocks. Highest ROI is authored texture polish, final UV/normal/roughness/AO maps, a real static bake, and then a split/LOD runtime package before scene promotion.

## 2026-05-20 변경 동기화 (Whole-Room Furniture V2 Commercial-Pass Candidate)
Added:
- 방 안의 대형 가구 묶음은 기존 monolithic furniture hero kit을 덮어쓰지 않고 versioned 후보 `p2s_bruno_furniture_hero_kit_v2`로 생성한다.
- 신규 생성 스크립트는 `scripts/blender/generate-bruno-furniture-hero-kit-v2.py`이며, V1 가구 위에 책상/선반/미디어 콘솔/러그/소파/커피테이블 construction detail pass를 추가한다.
- V2 산출물은 `assets/blender/deskterior/p2s_bruno_furniture_hero_kit_v2.blend`, `apps/web/public/assets/models/p2s_bruno_furniture_hero_kit_v2/p2s_bruno_furniture_hero_kit_v2.glb`, `assets/references/blender-authored/bruno-furniture-hero-kit-v2/asset-review-2026-05-20.json`, 그리고 `furniture-v2-*.png` preview renders를 포함한다.

Updated:
- QA room의 `BLENDER_FURNITURE_HERO_KIT_URL`은 V2 public GLB를 사용하도록 전환했다.
- Furniture texture package도 `texture-package-2026-05-20.json`로 전환했고, V2 package는 기존 KTX2 sidecar를 복사해 `ktx2Ready=true` 상태로 로드된다.
- V2 evidence: `518` mesh objects, `85,188` triangles, `28` materials, `22` texture images, public GLB 약 `12M`, `190` marked V2 detail objects, reopen audit `0` unmaterialed objects / `0` missing external images.
- 첫 V2 preview에서 밝은 스티치가 사다리처럼 보이는 결함이 발견되어, 책상 매트/러그/소파 throw thread를 어둡고 얇게 줄인 뒤 재생성했다.
- 소파는 현재 standalone `p2s_premium_dark_sofa`가 foreground 품질 경로이므로 monolithic `hero_sofa_*` hide rule을 유지한다.

Removed/Deprecated:
- GLB 오브젝트 수를 늘렸다는 이유만으로 scene에 바로 통합하는 방식.
- 밝은 seam/grid/detail line이 tabletop, rug, upholstery를 장난감처럼 보이게 해도 디테일 증가로 간주하는 방식.

Follow-up Risk:
- V2는 active room에 연결된 commercial-pass 후보지만, 아직 최종 상용 카탈로그 승인본은 아니다. 남은 핵심 결함은 split object catalog, collider/support/LOD package, final UV/light bake, hand-authored material polish, and human side-by-side approval이다.

## 2026-05-20 변경 동기화 (Whole-Room Furniture V3 Art-Pass Candidate)
Added:
- V2의 과한 stitch/grid artifact를 줄인 versioned 후보 `p2s_bruno_furniture_hero_kit_v3`를 생성했다.
- 신규 생성 스크립트는 `scripts/blender/generate-bruno-furniture-hero-kit-v3.py`이며, V2 위에 책상/선반/미디어 콘솔/소파/러그/커피테이블별 quieter construction pass를 추가한다.
- V3 산출물은 `assets/blender/deskterior/p2s_bruno_furniture_hero_kit_v3.blend`, `apps/web/public/assets/models/p2s_bruno_furniture_hero_kit_v3/p2s_bruno_furniture_hero_kit_v3.glb`, `assets/references/blender-authored/bruno-furniture-hero-kit-v3/asset-review-2026-05-20.json`, `furniture-v3-*.png` preview renders를 포함한다.

Updated:
- QA room의 `BLENDER_FURNITURE_HERO_KIT_URL`은 V3 public GLB로 전환했다.
- Furniture texture package URL도 V3 `texture-package-2026-05-20.json`로 전환했다.
- V3 evidence: `627` visible mesh/curve objects, `94,672` triangles, `39` generated materials in review, `22` texture images, public GLB 약 `12M`, `134` marked V3 detail objects, `25` noisy V2 line objects suppressed, reopen audit `0` unmaterialed objects / `0` missing external images.
- Runtime smoke on clean 3100 dev confirmed no `_next/static` 404 regression, V3 GLB fetched with `200 model/gltf-binary`, PC QA registry present, and screenshot written to `output/playwright/qa-3100-furniture-v3-runtime.png`.

Removed/Deprecated:
- V2의 high-contrast mat/rug/throw line을 “디테일 증가”로 간주하는 기준.
- 3100 서버가 stale chunk를 반환하는 상태에서 QA 화면을 보고 품질을 판단하는 절차.

Follow-up Risk:
- V3는 V2보다 시각적으로 안정된 art-pass 후보지만 final commercial catalog asset은 아니다. 다음 상용화 작업은 개별 furniture SKU split, collider/LOD/meshopt package, final UV/light bake, authored normal/roughness maps, runtime performance pass다.

## 2026-05-20 변경 동기화 (Commercial Desk Image-Texture Pass)
Added:
- 책상 단독 개선 경로로 `scripts/blender/generate-commercial-desk-hero-v1.py`를 사용한다.
- 이미지모델로 생성한 월넛 텍스처 원본을 보존하고, Blender 단계에서 톤다운된 basecolor와 파생 roughness/height를 만들어 GLB에 패킹한다.
- 산출물:
  - `apps/web/public/assets/models/p2s_commercial_desk_hero_v1/p2s_commercial_desk_hero_v1.glb`
  - `assets/blender/deskterior/p2s_commercial_desk_hero_v1.blend`
  - `assets/references/blender-authored/commercial-desk-hero-v1/asset-review-2026-05-20.json`
  - `assets/references/blender-authored/commercial-desk-hero-v1/previews/commercial-desk-v1-*.png`

Updated:
- QA room의 commercial desk cache-bust revision을 `20260520-commercial-desk-no-drawer-uv-v3`로 올렸다.
- 시각적으로 설득되지 않던 서랍 모듈을 제거하고, 오픈 프레임 책상 실루엣으로 단순화했다.
- 상판 UV를 authored planar UV로 고정하고, 앞쪽 bullnose/side band도 이미지 기반 월넛 재질을 공유하도록 바꿔 단색 플라스틱 엣지처럼 보이는 문제를 줄였다.
- 이번 책상 후보 evidence: `74` mesh objects, `22,092` triangles, packed texture images `3`, GLB 약 `4.8M`.

Removed/Deprecated:
- 절차형 목재 노이즈만으로 상판 품질을 판단하는 방식.
- 설득력 없는 서랍 facade를 디테일 보강처럼 유지하는 방식.
- 브라우저 캡처가 실패한 상태에서 runtime screenshot을 완료 evidence로 기록하는 방식.

Follow-up Risk:
- 책상은 Blender standalone preview 기준으로 개선됐지만, runtime screenshot은 Playwright font wait/headless capture 문제로 확보하지 못했다. 다음 단계는 clean browser capture 경로 복구 후 desktop props와의 scale/occlusion 확인이다.

## 2026-05-21 변경 동기화 (Standalone Task Chair GLB Pass)
Added:
- 책상 주변 고영향 가구 중 chair를 단독 asset loop로 분리했다.
- 신규 생성 스크립트는 `scripts/blender/generate-commercial-task-chair-hero-v1.py`다.
- 산출물:
  - `apps/web/public/assets/models/p2s_commercial_task_chair_hero_v1/p2s_commercial_task_chair_hero_v1.glb`
  - `apps/web/public/assets/models/p2s_commercial_task_chair_hero_v1/runtime-package.json`
  - `assets/blender/deskterior/p2s_commercial_task_chair_hero_v1.blend`
  - `assets/references/blender-authored/commercial-task-chair-hero-v1/asset-review-2026-05-21.json`
  - `assets/references/blender-authored/commercial-task-chair-hero-v1/meshy-prompt-pack-2026-05-21.json`

Updated:
- QA room의 `GamingChair`는 기존 block-based procedural geometry 대신 `p2s_commercial_task_chair_hero_v1` GLB를 로드한다.
- 이번 chair evidence: `78` mesh/curve objects, `30,708` triangles, meshopt 후 GLB `5,525,212` bytes, fabric/mesh PBR helper maps `6` files.
- 레퍼런스는 특정 제품 복제가 아니라 commercial task-chair construction cues를 학습하는 용도로만 기록하며, review JSON은 third-party model/image copy가 없고 `releaseEligible=false`임을 명시한다.
- Meshy API generation은 prompt pack까지 준비했지만, 유료 provider POST는 사전 prompt/reference 검수 조건 때문에 보내지 않았다.

Removed/Deprecated:
- 의자 레이어를 상용급 품질 판단에서 제외하거나, 단순 block proxy를 최종 방 검수 기준으로 유지하는 방식.
- Meshy 또는 생성형 결과를 사람 검수 없이 바로 public catalog/release-ready asset으로 취급하는 방식.

Follow-up Risk:
- chair standalone preview는 개선됐지만 final room screenshot에서는 desk/PC/sofa와의 scale, darkness, occlusion을 다시 봐야 한다. 다음 패스는 clean browser capture 복구와, desk 위 모니터/키보드/램프 등 desktop prop GLB 품질 개선이다.

## 2026-05-21 변경 동기화 (Standalone Desk Accessory GLB Pass)
Added:
- 책상 위 핵심 오브젝트 cluster를 단독 asset loop로 분리했다.
- 신규 생성 스크립트는 `scripts/blender/generate-commercial-desk-accessory-kit-v1.py`다.
- 산출물:
  - `apps/web/public/assets/models/p2s_commercial_desk_accessory_kit_v1/p2s_commercial_desk_accessory_kit_v1.glb`
  - `apps/web/public/assets/models/p2s_commercial_desk_accessory_kit_v1/runtime-package.json`
  - `assets/blender/deskterior/p2s_commercial_desk_accessory_kit_v1.blend`
  - `assets/references/blender-authored/commercial-desk-accessory-kit-v1/asset-review-2026-05-21.json`
  - `assets/references/blender-authored/commercial-desk-accessory-kit-v1/meshy-prompt-pack-2026-05-21.json`

Updated:
- QA room의 completed desktop setup path는 기존 `MonitorRig`/`DeskControls`/`MicrophoneAndLamp` proxy 조합 대신 `p2s_commercial_desk_accessory_kit_v1` GLB를 로드한다.
- 이번 accessory evidence: `107` objects, `44,256` triangles, `19` materials, `12` texture images, meshopt 후 GLB `9,232,916` bytes.
- 인터넷 reference는 BenQ monitor light bar, Logitech low-profile keyboard/mouse, Kanto compact speakers, ASUS OLED monitor family를 비복제 proportion/material study 용도로 기록한다.
- Meshy API balance preflight는 성공했지만, 유료 text-to-3D provider POST는 prompt/reference 검수 조건 때문에 보내지 않았다.

Removed/Deprecated:
- desktop prop 개선을 작은 proxy asset을 더 얹는 방식으로만 진행하는 방식.
- 왜곡된 tiny text label을 키보드 디테일로 유지하는 방식.
- Meshy/open/reference 비교와 human art approval 없이 generated workstation props를 release-ready로 표현하는 방식.

Follow-up Risk:
- standalone preview는 개선됐지만 runtime room camera에서는 desk/PC/monitor/keyboard/speaker 간 scale과 occlusion을 다시 검수해야 한다. 다음 패스는 scene capture 기준으로 조명, desk top clutter 위치, PC case와 accessory kit 사이 간섭을 조정한다.

## 2026-05-21 변경 동기화 (Standalone Desk Accessory GLB V2 Real-Scale Pass)
Added:
- `scripts/blender/generate-commercial-desk-accessory-kit-v2.py`를 추가해 V1의 oversized desktop prop scale을 교정했다.
- 산출물:
  - `apps/web/public/assets/models/p2s_commercial_desk_accessory_kit_v2/p2s_commercial_desk_accessory_kit_v2.glb`
  - `apps/web/public/assets/models/p2s_commercial_desk_accessory_kit_v2/runtime-package.json`
  - `assets/blender/deskterior/p2s_commercial_desk_accessory_kit_v2.blend`
  - `assets/references/blender-authored/commercial-desk-accessory-kit-v2/asset-review-2026-05-21.json`
  - `assets/references/blender-authored/commercial-desk-accessory-kit-v2/meshy-prompt-pack-2026-05-21.json`

Updated:
- QA room의 completed desktop setup path는 `p2s_commercial_desk_accessory_kit_v2` GLB를 로드한다.
- 이번 accessory V2 evidence: `153` objects, `48,016` triangles, `19` materials, `12` texture images, meshopt 후 GLB `9,354,728` bytes.
- 레퍼런스 치수는 review/runtime JSON의 `realScaleReferenceMm`에 기록한다. 제품 페이지는 proportion/material study 용도이며 third-party model/image copy는 없다.
- Meshy API balance preflight는 성공했지만, 유료 generation POST는 prompt/reference 검수 조건 때문에 보내지 않았다.

Removed/Deprecated:
- V1 accessory GLB를 최신 desk prop 품질 기준으로 사용하는 방식.
- 단순 프록시 스케일 보정 없이 키보드/마우스/스피커를 “상용수준”으로 보고하는 방식.

Follow-up Risk:
- V2는 real-scale correction 후보지만 완전한 상용 카탈로그 자산은 아니다. 다음 패스는 browser screenshot에서 PC case와의 간섭, desk mat 반사 강도, mouse shell detail, KTX2/LOD/collider split을 검수한다.

## 2026-05-21 변경 동기화 (Mechanical Keyboard Switch Lab V1)
Added:
- 키보드를 desktop accessory kit 내부의 단순 prop이 아니라 standalone mechanical keyboard asset loop로 분리했다.
- 신규 생성 스크립트는 `scripts/blender/generate-mechanical-keyboard-switch-lab-v1.py`다.
- 산출물:
  - `apps/web/public/assets/models/p2s_mechanical_keyboard_switch_lab_v1/p2s_mechanical_keyboard_switch_lab_v1.glb`
  - `apps/web/public/assets/models/p2s_mechanical_keyboard_switch_lab_v1/runtime-package.json`
  - `assets/blender/deskterior/p2s_mechanical_keyboard_switch_lab_v1.blend`
  - `assets/references/blender-authored/mechanical-keyboard-switch-lab-v1/asset-review-2026-05-21.json`
  - `assets/references/blender-authored/mechanical-keyboard-switch-lab-v1/previews/mechanical-keyboard-v1-isometric.png`
  - `assets/references/blender-authored/mechanical-keyboard-switch-lab-v1/previews/mechanical-keyboard-v1-switch-closeup.png`

Updated:
- QA room의 keyboard step은 `p2s_mechanical_keyboard_switch_lab_v1` GLB를 로드하고, 기존 accessory kit의 keyboard/mouse mesh는 새 keyboard GLB가 활성화될 때 숨긴다.
- runtime은 적축/청축/갈축 profile을 노출한다: red `45cN/2.0mm/4.0mm`, blue `60cN/2.2mm/4.0mm`, brown `55cN/2.0mm/4.0mm`.
- 사용자는 UI에서 switch profile을 선택하고 `타건` 버튼 또는 3D press target을 통해 profile-specific WebAudio cue를 재생할 수 있다.
- 이번 GLB는 meshopt 후 `1.25MB`이며, 개별 keycap, plate/PCB/gasket stack, spacebar stabilizer, exposed switch housing/stem/spring/contact를 포함한다.
- 레퍼런스는 사용자가 제공한 keyboard construction 글과 CHERRY 공식 switch spec을 비복제 reference로만 기록한다.

Removed/Deprecated:
- 키보드를 low-profile block/key grid만으로 final desk prop evidence로 유지하는 방식.
- 축별 차이를 static label로만 보여주고 실제 타건 사운드/press event state 없이 “기계식”으로 부르는 방식.

Follow-up Risk:
- WebAudio 사운드는 합성 cue다. 상용 수준까지는 실제 녹음 기반 WAV layer, per-key animation binding, LOD/collider split, UV decal legend workflow가 필요하다.

## 2026-05-21 변경 동기화 (ABKO AR108G Reference Keyboard Pass)
Added:
- 사용자가 제공한 Compuzone `ProductNo=1297630`을 private reference로 삼아 `p2s_abko_ar108g_sage_green_keyboard_v1` standalone keyboard GLB를 생성했다.
- 신규 생성 스크립트는 `scripts/blender/generate-abko-ar108g-sage-green-keyboard-v1.py`다.
- 산출물:
  - `apps/web/public/assets/models/p2s_abko_ar108g_sage_green_keyboard_v1/p2s_abko_ar108g_sage_green_keyboard_v1.glb`
  - `apps/web/public/assets/models/p2s_abko_ar108g_sage_green_keyboard_v1/runtime-package.json`
  - `assets/blender/deskterior/p2s_abko_ar108g_sage_green_keyboard_v1.blend`
  - `assets/references/blender-authored/abko-ar108g-sage-green-keyboard-v1/asset-review-2026-05-21.json`
  - `assets/references/blender-authored/abko-ar108g-sage-green-keyboard-v1/previews/abko-ar108g-v1-isometric.png`
  - `assets/references/blender-authored/abko-ar108g-sage-green-keyboard-v1/previews/abko-ar108g-v1-keycap-closeup.png`

Updated:
- QA room의 keyboard step은 기존 `p2s_mechanical_keyboard_switch_lab_v1` 대신 ABKO AR108G reference keyboard GLB를 로드한다.
- runtime package는 ABKO/AR108G/product URL, `releaseEligible=false`, `pressTargets=107`, 청축 `50G` reference profile, material slot evidence를 기록한다.
- GLB는 meshopt 후 `943.2KB`이며, full-size layout, 세이지/크림/코랄 키캡 색상, 전면 RGB lightbar, 하단 feet/receiver/tilt detail을 포함한다.

Removed/Deprecated:
- 노출 switch sample 중심의 switch-lab 키보드를 최신 reference keyboard visual evidence로 보는 방식.
- 제조사 라이선스/CAD/공식 decal 승인 없이 ABKO reference asset을 public catalog release-ready로 승격하는 방식.

Follow-up Risk:
- 현재 모델은 reference-prototype이다. 완전 상용 수준까지는 공식 치수, licensed legend/decal, 더 정확한 row profile, recorded blue-switch WAV layer, LOD/collider split, browser scene side-by-side QA가 필요하다.

## 2026-05-21 변경 동기화 (Hybrid Product Asset Factory Router)
Added:
- `apps/worker/src/processors/product-asset-generation-strategy.ts`를 추가해 product URL reference 분석 후 `generationStrategy`를 결정한다.
- `apps/worker/src/processors/product-asset-cad-generator.ts`를 추가해 CAD-first private runtime package POC를 생성한다.
- CAD-first POC는 build123d/Python source, STEP placeholder, runtime GLB, runtime package, collider, support surface, attachment point, interaction anchor, material variant, QA sidecar를 worker workdir에 생성하고 private asset upload sidecar로 등록한다.
- Worker test가 desk, keyboard, PC case POC를 검증한다: desk는 `desktop_top`, keyboard는 5개 이상 interaction anchor, PC case는 5개 이상 assembly attachment anchor를 가져야 한다.

Updated:
- `product-asset-generation-processor`는 provider 호출 전 category profile과 generation strategy를 먼저 결정한다.
- `image_to_3d` 전략에서만 Meshy/Tripo provider path를 사용한다.
- Desk/shelf/monitor arm/cable tray/keyboard/PC case/PSU/fan/radiator는 `cad_parametric`로, mouse/GPU/motherboard/monitor는 `hybrid_cad_blender`로, decor/plant/generic은 `image_to_3d`로 라우팅한다.
- `createGeneratedAsset`는 CAD/runtime sidecar upload 목록을 받아 private asset result에 보존한다.
- `verify:product-asset-generation`는 strategy router, CAD generator, sidecar, structural QA, private/reference-only release boundary를 정적 계약으로 검증한다.

Removed/Deprecated:
- Product URL 기반 hard-surface asset을 모두 image-to-3D provider 후보로 보내는 방식.
- Blender finalizer가 스케일/피벗/thumbnail만 맞춘 provider output을 조립 가능한 제품 자산으로 간주하는 방식.
- 파일 크기/평균 색상/thumbnail 중심 QA를 hard-surface 제품 구조 품질의 주된 기준으로 삼는 방식.

Follow-up Risk:
- 현재 CAD-first POC는 source/sidecar/runtime package 구조를 잠그는 1차 구현이다. 실제 build123d execution, true STEP validation, CAD-to-GLB tessellation quality, Blender material/UV polish, storage-side sidecar URL consumption in editor runtime, and multi-view render comparison remain follow-up work.

## 2026-05-22 변경 동기화 (Generated Asset Sidecar Runtime Wiring)
Added:
- Worker `createGeneratedAsset`가 CAD/runtime sidecar upload 결과를 `assets.meta.generation.sidecarUploads`와 `assets.meta.runtimeAsset.sidecars`에 저장한다.
- API private asset listing이 owner-scoped signed sidecar URLs, `runtimePackage`, `runtimeAsset`, generated support profile, interaction anchors, and attachment points를 반환한다.
- Web catalog/store/runtime bridge가 generated `runtimeAsset`와 sidecar metadata를 보존하고, runtime placement에서 generated support surfaces, colliders, attachment points, material variants를 소비한다.
- `case fan`, 120mm fan, AIO/radiator product routing 회귀 테스트를 worker test에 추가했다.
- Vercel preview packaging guard로 QA-only GLB routes가 explicit file map을 사용하게 해 `.nft` trace에서 `.git`과 대형 unrelated asset/public trees를 제외한다.

Updated:
- Vercel preview failure 원인이었던 `@deskterioronline/contracts/product-assets` module resolution은 `apps/web/package.json`의 workspace dependency 선언으로 해결한다.
- `verify:product-asset-generation`는 sidecar path persistence, signed sidecar exposure, catalog preservation, runtime bridge consumption, and non-bare `case` classification guard를 검증한다.
- Product URL CAD-first sidecar runtime consumption은 더 이상 전부 follow-up이 아니지만, interaction anchor execution UI, true STEP export, and Blender visual QA는 별도 단계로 남는다.
- Vercel failure triage는 module resolution 이후 serverless function packaging으로 이어질 수 있으므로, build logs의 `Max serverless function size`와 route `.nft.json` 파일 수를 함께 확인한다.

Removed/Deprecated:
- sidecar upload 목록을 worker 반환값에만 두고 DB/catalog/runtime에서 잃어버리는 구조.
- `case` 단어 하나로 case fan 또는 radiator product를 `pc_case`로 분류하는 방식.
- QA source GLB route에서 request param을 디렉터리 path join에 직접 넣어 Next output tracing이 repository root를 포괄하게 만드는 방식.

Follow-up Risk:
- 아직 실제 build123d/OCP STEP export, official STEP ingest, CAD-to-GLB tessellation, Blender material/UV/decal polish queue, hybrid mouse/GPU/motherboard detail pass, live Supabase signed sidecar fetch smoke, and multi-view render comparison이 남아 있다.
- 새 커밋 푸시 후 Vercel은 module resolution 수정으로 다시 빌드되어야 하며, 원격 deploy status는 새 run 결과를 확인해야 한다.
