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
- lighting step에 direct/indirect mood 선택 및 scene lighting payload 연결
- 템플릿 기반 방 생성 속도 개선
- 저장 직후 에디터/뷰어 일관성 확인 자동화
- project-media bucket 미구성 시 thumbnail upload 복구/재시도로 저장 실패를 완화

## P2
목표: 데스크테리어 편집 경험 고도화

진행:
- Blender 원본 -> GLB -> catalog sync 파이프라인 표준화
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
- editor top-view 회전을 drag에서 버튼형 90도 회전 rail로 단순화
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

## 2026-04-19 심층 분석 기반 실행 순서
이 순서는 `/Users/sol/Downloads/Plan2Space 정밀 공간 편집 시스템 심층 분석 보고서.docx`의 제안을 현재 room-first 제품 흐름에 맞게 재배열한 것이다. P0~P3의 큰 축은 유지하되, 실제 실행은 아래 Phase와 Slice 단위로 끊어서 진행한다.

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
- `SceneViewport`에 `plan2space:renderer-stats` 1초 샘플러를 붙여 FPS / draw calls / triangles / textures / geometries를 공통 이벤트 계약으로 노출했다.
- hover / select / drag-start / gizmo-drag-start의 next-paint 지연을 `plan2space:interaction-latency` 이벤트로 기록하는 계측 훅을 추가했다.

Updated:
- Phase 1 Slice 2를 `계측 훅/로그 포인트 배치` 완료 상태로 갱신한다.
- 원문 보고서의 `renderer.info 1초 샘플링 + 조작 지연 로그` 권고를 코드 계약 수준으로 반영한다.

Removed/Deprecated:
- SceneViewport 성능 계측을 수동 DevTools 세션에만 의존하던 상태.

## 2026-04-19 변경 동기화 (Phase 1 Slice 3 Complete)
Added:
- `window.__PLAN2SPACE_TELEMETRY_CAPTURE__` capture helper로 telemetry 이벤트를 regression entry JSON으로 묶는 경로를 추가했다.
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
- `plan2space:bvh-build` 브라우저 이벤트와 `window.__PLAN2SPACE_LAST_BVH_BUILD__` 스냅샷으로 worker/sync BVH build mode, triangle count, duration을 확인하는 측정 지점을 추가했다.

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
- legacy 트랙 및 `docs/legacy/*` 아카이브 참조.
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

## 2026-04-21 변경 동기화 (Vercel Incident Hardening)
Added:
- Vercel/Supabase 운영 hardening 완료 항목에 `sb_publishable`/`sb_secret` 전환, Preview/Production `Sensitive` env 정리, automation bypass 단일화, `autoExposeSystemEnvs=false`를 추가한다.

Updated:
- 원격 환경 변수 운영 기준을 `preview parity`에서 `preview parity + credential rotation + control-plane hardening`까지 확장한다.

Removed/Deprecated:
- legacy JWT `anon`/`service_role` 키와 다중 automation bypass secret을 운영 env에 계속 남겨두는 가정.
