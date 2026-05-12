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
- physics/runtime shadow/contact shadow/post FX를 walk/viewer 중심으로 재배치해 furnished scene headroom 확보
- editor top-view를 builder와 같은 perspective orbit + wheel zoom 기준으로 재조정
- editor room shell material fallback을 강화해 top/walk에서 texture decode 실패 시 black shell이 나오지 않도록 수정
- editor top-view orbit과 walk-view 시작 카메라를 안정성 우선으로 재조정해 회전 중 black flicker와 first-frame black view 가능성을 낮춤
- direct lighting beam shader / indirect ceiling glow shader를 scene shell 렌더에 연결
- room/desk top-view와 builder preview에 demand frame loop + explicit invalidate 경로를 적용

## P3
목표: 커뮤니티 공유/조회 경험 강화

진행:
- publish -> shared viewer -> gallery/community 데이터 흐름 안정화
- shared viewer shell을 editor read-only mirror(top bar / hotspot drawer / grey viewport / right zoom rail / bottom pill status)로 통일
- gallery/community를 레퍼런스 8번 이미지 기준의 4열 furnished-space feed + URL 기반 filter rail로 통일
- 공유 씬 성능 예산(초기 로드, draw call, texture budget) 모니터링
- 활동성 지표(조회/반응) 수집 및 피드 랭킹 개선

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
- builder preview / shared viewer / showcase-walk 간 fill light, bloom, shadow 제거 순서를 명시한 cost reallocation 규칙을 추가했다.

Updated:
- Phase 4 Slice 3을 `조명/후처리/그림자 토글의 비용 재배치` 완료 상태로 갱신한다.
- shared viewer와 builder preview는 lean light rig, shared subtle post FX, constrained no shadow/bloom 기준으로 구체화한다.

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
- read-only top/walk와 builder preview에서 반복된 `single_mesh` low/medium complexity 자산을 instanced cluster로 묶는 첫 운영 단계를 추가했다.
- `verify:asset-instancing` 스크립트로 editable top mode 제외, selected 제외, dynamic light 제외, manual LOD 제외, repeated cluster grouping 정책을 회귀 검증하도록 했다.

Updated:
- 원문 보고서 기준 남은 `instancing/LOD 운영화`를 “LOD policy 완료, read-only/builder instancing 1차 완료, editor-side/native pass만 남음” 상태로 갱신한다.
- 다음 후보를 `native gltfpack pass`, `editor-side instancing 확대`, `실사 강화 2차` 중심으로 재정렬한다.

Removed/Deprecated:
- 반복 자산 instancing이 아직 전혀 런타임에 적용되지 않았다는 서술.

## 2026-04-20 변경 동기화 (Editor Desk Precision Instancing)
Added:
- editor `desk precision` top-view에서 반복된 `single_mesh` low/medium complexity 자산을 instanced cluster로 유지하는 2차 운영 단계를 추가했다.
- `verify:asset-instancing`가 editable `desk precision` eligibility와 selected asset 제외 후 cluster regrouping까지 점검하도록 확장했다.

Updated:
- 원문 보고서 기준 남은 `instancing/LOD 운영화`를 “LOD policy 완료, read-only/builder instancing + editor desk precision instancing 완료, room-mode direct drag 확대만 남음” 상태로 갱신한다.
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
