# 마스터 가이드 (엔지니어링 단일 기준)

이 문서는 DeskteriorOnline의 현재 제품 기준을 정의합니다.

## 핵심 제품 정의
DeskteriorOnline의 메인 제품은 **IKEA Kreativ 스타일 room-first 데스크테리어 빌더/에디터/뷰어/커뮤니티**입니다.

핵심 경로:
1. `/` 시작하기 화면에서 `공간 선택` 또는 `공간 만들기` 진입점을 선택
2. `/studio/select`에서 빈 공간 템플릿 또는 가구가 배치된 템플릿을 고르고 즉시 프로젝트를 만든다
3. `/studio/builder`에서 맞춤형 방 생성 5단계(모양/치수/개구부/스타일/조명)를 거쳐 프로젝트를 만든다
4. `/project/[id]`에서 데스크테리어 배치/편집/저장
5. 공유 모달에서 링크 발행
6. `/shared/[token]`, `/gallery`, `/community`에서 읽기 전용 3D 뷰어로 조회

## 제품 규칙
- 홈/선택/빌더/에디터/뷰어/갤러리/커뮤니티는 같은 디자인 시스템을 사용한다.
- 홈/선택/빌더는 공통 상단 bar에서 좌측 브랜드와 우측 로그인/로그아웃 affordance를 유지한다.
- Google/Kakao OAuth는 브라우저 직접 `signInWithOAuth`가 아니라 `/auth/signin` 서버 시작 라우트와 `/auth/callback` 서버 교환 라우트의 2단계 흐름을 사용한다.
- production build가 deployment-specific Vercel URL에서 열리면 OAuth 전에 canonical alias(`plan2space.vercel.app`)로 정규화해 PKCE cookie host와 Supabase callback host를 일치시킨다.
- preview에서 Google/Kakao OAuth를 테스트해야 하는 경우 Vercel Deployment Protection의 Vercel Authentication을 preview/deployment URL에 적용하지 않는다. 이 보호 계층은 앱 라우트보다 먼저 요청을 가로채므로 preview `/auth/signin`·`/auth/callback`의 PKCE 쿠키 연속성을 깨뜨릴 수 있다.
- 레이아웃 기본은 `상단 app bar + 좌측 rail + 중앙 grey viewport + 하단 pill toolbar`다.
- 좌측 rail 폭은 360~380px(기본 368px)로 고정한다.
- 뷰어는 읽기 전용이며 편집 affordance를 노출하지 않는다.
- 제품 클릭 시 제품 정보를 확인할 수 있어야 한다.
- 커뮤니티 게시물은 동일한 3D 씬 데이터 계약(`sceneDocument`)으로 재생되어야 한다.
- presence/realtime 실험은 primary 제품 경로와 분리된 hidden lab route에서만 평가하고, 홈/에디터/뷰어/갤러리/커뮤니티 navigation에는 연결하지 않는다.
- 제품 메타데이터는 실측 규격(`dimensionsMm`)과 마감(`finishColor`, `finishMaterial`, `detailNotes`)을 유지해야 한다.
- curated deskterior 제품 메타데이터는 `source/license/pivot/collisionProxy/textureSet/lodProfile` 계약을 manifest와 sceneDocument roundtrip에서 같이 유지해야 한다.
- `lodProfile`는 문서용 필드에만 머물지 않고 room mode / desk precision / walk / builder preview 런타임 LOD 전환 거리 정책으로 실제 소비되어야 한다.
- 반복된 `single_mesh` deskterior 자산은 read-only top/walk와 builder preview, editor `desk precision` top-view에서 instanced cluster로 묶을 수 있어야 하며, 선택 중이거나 `room mode` direct-drag 대상 자산은 개별 오브젝트 경로를 유지해야 한다.
- dense-scene instanced cluster는 membership/finish가 바뀔 때만 mesh를 재생성하고, transform-only 변경은 instance matrix sync만으로 처리해야 한다.
- 렌더 품질 사다리는 mode-aware tone mapping을 포함해야 하며, `room mode` / `viewer-shared` / 기본 walk-viewer는 ACES, `desk precision` / `builder preview` / `viewer-showcase`는 Neutral tone mapping을 사용한다.
- 실사 강화 2차의 SSR은 `editor walk`와 `viewer-showcase`의 non-constrained profile에서만 보수적으로 허용하고, `viewer-shared`와 top-view/builder preview에는 적용하지 않는다.
- `sceneDocument` 저장 계약은 placement를 `unit="mm"` 정수 스냅샷으로 보관하고, meter float 좌표는 그 스냅샷에서 파생된 호환 필드로만 유지한다.
- `desk precision mode`에서는 선택한 제품의 위치/회전을 `mm/deg` 기준 numeric inspector와 measurement overlay로 노출한다.
- `desk precision mode`에서는 surface anchor 제품의 support asset / support surface / surface size / margin / top 높이를 surface lock 상태 카드로 노출한다.
- `desk precision mode`에서는 surface-local 상대 위치를 확인할 수 있는 micro-view를 inspector와 overlay 양쪽에서 제공한다.
- `desk precision mode`에서는 support surface 기준 `front(X/H)` / `side(Z/H)` orthographic helper view를 inspector와 overlay 양쪽에서 제공한다.
- `desk precision mode`에서는 surface anchor 제품의 footprint, projected footprint, edge clearance를 inspector와 overlay 양쪽에서 같은 값으로 제공한다.
- `SceneViewport` 기반 경로는 성능 측정 시 `deskterioronline:renderer-stats`와 `deskterioronline:interaction-latency` 브라우저 이벤트를 공용 telemetry 계약으로 사용한다.
- `SceneViewport` 기반 경로는 telemetry가 켜져 있을 때 live performance budget HUD로 draw call / FPS floor / heap growth / interaction latency / BVH offload 경고를 즉시 노출해야 한다.
- 성능 회귀 보고는 `window.__DESKTERIORONLINE_TELEMETRY_CAPTURE__`로 캡처한 JSON entry와 `perf:report:verify` CLI 검증을 기본 절차로 사용한다.
- `qa:primary:perf`는 `type-check + lint + build + verify:performance-budget + verify:asset-instancing + verify:asset-lod + verify:benchmark-baseline`를 한 번에 묶는 self-contained performance gate로 유지한다.
- editor undo/redo는 snapshot history를 기준으로 `Cmd/Ctrl+Z`, `Shift+Cmd/Ctrl+Z`, `Ctrl+Y` 단축키로 즉시 접근 가능해야 한다.
- `primary:e2e:room-flow:strict`는 외부 `E2E_ROOM_FLOW_BASE_URL`이 없을 때 로컬 production build/server를 스스로 올려 route shell contract를 self-contained하게 검증해야 한다.
- runtime HUD 경고와 regression report 검증은 같은 성능 budget helper를 기준으로 drift 없이 유지한다.
- loaded GLB 자산의 picking은 `three-mesh-bvh` 기반 bounds tree raycast를 기본값으로 사용한다.
- loaded GLB 자산의 bounds tree 생성은 large non-interleaved geometry에 한해 Web Worker queue로 오프로딩하고, small/interleaved geometry만 sync fallback을 사용한다.
- loaded GLB runtime decode는 `KTX2Loader` + local basis transcoder(`apps/web/public/assets/transcoders/basis`)를 기본 경로로 준비하고, 경로 override는 `NEXT_PUBLIC_KTX2_TRANSCODER_PATH`만 사용한다.
- room shell floor/wall procedural texture set은 `NEXT_PUBLIC_ENABLE_KTX2_TEXTURES=1`일 때 `.ktx2`를 우선 읽고, 산출물이 없거나 플래그가 꺼져 있으면 JPG/PNG 원본으로 fallback 한다.
- curated deskterior optimize chain은 기본 `glTF Transform dedup + prune + meshopt`를 사용하고, native `gltfpack`은 `GLTFPACK_BIN` 또는 `--gltfpack-bin`이 있을 때만 optional pass로 추가한다.
- repo-local native `gltfpack` 설치 경로는 `.tools/gltfpack/current/gltfpack`를 우선 사용한다.
- builder preview와 editor top-view(room / desk precision), shared top viewer는 `frameloop="demand"`를 기본으로 사용하고, camera/orbit/hover/drag/preview/commit 경로에서 명시적으로 `invalidate()`를 호출한다. editor walk-view와 walk shared viewer는 1인칭 이동 안정성을 위해 `frameloop="always"`를 유지한다.
- 실측 고정 제품(`scaleLocked=true`)은 에디터에서 임의 스케일 변경을 허용하지 않는다.
- 데스크/선반 표면 배치는 실측 규격이 있으면 해당 값 기반으로 support surface를 계산한다.
- 기본 desk runtime package는 `desktop_top`만이 아니라 실제 mounted validation용 `desk_edge`, `desk_underside` support surface를 함께 노출해야 한다.
- catalog -> scene store -> runtime bridge 경로는 authored `supportProfile`의 `surfaceType`, `allowedAttachments`, `thicknessMm`, `localFrame`를 손실 없이 유지해야 한다.
- floor/surface 배치는 active asset footprint 기반 wall clearance + 자산 간 분리(relaxation)를 적용한다.
- Blender 슬롯(`DeskWood`, `DeskMetal`, `StandWood`, `StandPad`, `LampBody`, `LampAccent`, `LampBulb`)은 slot-aware finish 매핑을 우선 적용한다.
- project thumbnail storage가 일시적으로 준비되지 않았더라도 version save와 editor 진입은 계속되어야 한다.
- curated runtime binary를 `apps/web/public/assets/*`에 새로 직접 추가하지 않는다. 기존 `/assets/...` 경로는 storage cutover 전까지의 legacy fallback으로만 유지한다.

## 아키텍처 경계
- Frontend: `apps/web` (active product surface)
- Runtime foundation: `packages/scene-schema`, `packages/engine-core`, `packages/renderer-three`, `packages/placement-kernel`, `packages/interaction-engine`
- API: `apps/api` (asset generation enqueue + health)
- Worker: `apps/worker` (asset generation processing)
- Supabase: auth/storage/database
- Asset pipeline: `assets/blender/deskterior`(source) + `apps/web/public/assets/models`(legacy fallback runtime) + `apps/web/public/assets/catalog/manifest.json`(catalog manifest)
- Asset compiler alpha: `packages/asset-compiler`가 curated asset 정의, alpha runtime package descriptor, compiler command surface를 소유한다.
- Target asset delivery: Supabase storage/CDN 기반 `catalog-public`(curated runtime), `project-media`(private snapshot/thumbnail), `assets-glb` 또는 후속 private bucket(생성형 자산 staging/publish) 구조를 사용한다.
- `apps/web`는 UI shell과 canvas host를 우선 책임지고, drag/hover/preview hot path mutation은 점진적으로 runtime foundation으로 이동한다.
- 저장 문서와 런타임 조작 상태를 같은 React/Zustand mutation 경로로 직접 공유하지 않는다.
- `SceneDocument`의 canonical unit은 `mm`이며, meter 변환은 renderer/runtime 경계에서만 허용한다.
- focus/walk/desk precision 배치 상태 전이는 `interaction-engine`이 소유하고, `apps/web` React component는 DOM 입력, HUD, toast, renderer invalidation, store commit adapter 역할만 수행한다.
- placement preview 상태(`aiming`, `candidate_preview`, `manipulating`, `blocked`)에서는 scene document patch가 0건이어야 하며, `committing` 상태에서만 최소 patch intent를 만들 수 있다.
- blocked placement는 항상 `NO_SURFACE`, `INCOMPATIBLE_ATTACHMENT`, `OUT_OF_SURFACE_BOUNDS`, `COLLISION`, `INSUFFICIENT_CLEARANCE`, `UNREACHABLE_ARM_TARGET`, `INVALID_CABLE_ROUTE`, `SCALE_LOCKED`, `READ_ONLY`, `MISSING_METADATA` 중 하나 이상의 이유를 노출해야 한다.

## 활성 웹 계약
- `GET /api/v1/projects/:projectId/bootstrap`
- `GET /api/v1/projects/:projectId/versions/latest`
- `POST /api/v1/projects/:projectId/versions`
- `GET /api/v1/catalog`
- `GET /api/v1/showcase`
- `GET /api/v1/public-scenes/[token]`
- `POST /api/v1/assets/generate`
- `GET /api/v1/jobs/:jobId`

## 품질 게이트
- `npm --workspace apps/web run type-check`
- `npm --workspace apps/web run lint`
- `npm --workspace apps/web run build`
- `npm --workspace apps/web run verify:scene-document`
- `npm --workspace apps/web run verify:asset-instancing`
- `npm --workspace apps/web run verify:public-scene`
- `npm --workspace apps/web run verify:showcase-scene`
- `npm --workspace apps/web run verify:showcase-activity`
- `npm --workspace apps/web run verify:interaction-engine`
- `npm --workspace apps/web run verify:focus-placement`
- `npm --workspace apps/web run verify:placement-kernel`
- `npm --workspace apps/web run verify:render-quality`
- `npm --workspace apps/web run verify:viewer-parity`
- `npm --workspace apps/web run verify:inventory-ghost-placement`
- `npm --workspace apps/web run verify:room-openings`
- `npm --workspace apps/web run verify:material-presets`
- `npm --workspace apps/web run verify:lighting-layout`
- `npm --workspace apps/web run verify:asset-compiler`
- `npm --workspace apps/web run verify:commercial-qa`

## 필수 참조 문서
- `docs/implementation-plan.md`
- `docs/3d-visual-engine.md`
- `docs/user-action-guide.md`
- `docs/deployment.md`

## 2026-05-02 변경 동기화 (Interaction Engine Foundation)
Added:
- `packages/interaction-engine`를 runtime foundation에 추가하고, React/R3F/Zustand에 독립적인 focus placement state machine 계약을 도입한다.
- `docs/interaction-engine-contract.md`를 preview/commit, blocked reason, candidate ranking, adapter 책임의 canonical 문서로 추가한다.
- `verify:interaction-engine`를 품질 게이트에 추가해 preview 중 document patch 0건, commit 시 patch intent 1건을 검증한다.
- `FocusPlacementController`가 start/switch/nudge/rotate/numeric/commit/cancel 이벤트를 `FocusPlacementMachine`에 전달하는 첫 adapter가 된다.
- focus placement entry 생성은 interaction-engine ranking helper를 사용해 `score`, `rank`, `blockedReasons`, `visualAffordance`를 session candidate에 보존한다.

Updated:
- walk placement와 desk precision 조작은 UI component 내부 판단이 아니라 interaction engine event/result/command를 따라야 한다.
- surface candidate는 단순 hidden/visible이 아니라 score와 blocked reason을 가진 explainable candidate로 관리한다.
- HUD/inspector는 candidate score/order/block reason을 표시만 하고 별도 정렬/판단 로직을 만들지 않는다.
- 현재 runtime transaction side effect는 adapter에 남기되, 상태 전이 결정은 interaction engine 결과를 기준으로 한다.

Removed/Deprecated:
- `FocusPlacementController`가 장기적으로 keyboard, pointer, candidate ranking, preview lifecycle, commit/cancel 판단을 모두 직접 소유하는 구조.

## 2026-05-01 변경 동기화 (Commercial Quality Gates Foundation)
Added:
- `RuntimeAsset`와 asset compiler package descriptor는 `sku`, `manufacturer`, `referencePack`, `visualFidelityScore`, `dimensionToleranceMm`, `materialQaStatus`, `releaseEligible`를 포함한 `commercialReadiness` 계약을 유지한다.
- 실제 SKU hero catalog는 `referencePack`과 slot-level material QA가 통과된 asset만 paid-beta release eligible로 승격한다.
- 제품 URL은 실제 SKU prototype reference 수집의 입력이 될 수 있지만, `asset:analyze-url` 산출물은 `prototype_reference_only`와 `releaseEligible=false`를 유지해야 한다.
- `/labs/qa` commercial snapshot은 actual SKU hero catalog gate, wall/floor texture library gate, SKU/reference/material QA row를 보여주는 운영 release dashboard 역할을 한다.
- walkthrough/focus placement 기본 snap은 `5mm / 1deg`, fine override는 `1mm / 0.1deg`로 고정하며 HUD/저장 좌표는 placement kernel snap 결과를 따른다.

Updated:
- 상용 판단 기준을 “예뻐 보이는 GLB”에서 “검증된 제품 패키지(referencePack + mm tolerance + material QA + release eligibility)”로 확장한다.
- room shell wall/floor texture set은 12개 이하의 PBR preset, source resolution, KTX2 runtime target, AI 후보 여부를 함께 관리한다.
- 조명 preset은 `neutral-studio`, `home-reference`, `soft-evening`별 QA profile(HDRI/exposure/white balance/contact shadow)을 가진다.

Removed/Deprecated:
- 이미지 생성 모델 결과를 실제 브랜드/SKU 최종 운영 asset으로 바로 승격하는 가정.
- mounted/wall placement가 기본 10mm/5deg coarse snap만 지원해도 충분하다는 가정.

## 2026-04-20 변경 동기화 (Room Mode Direct-Drag Instancing Phase 1)
Added:
- editor `room mode` top-view의 repeated `single_mesh` low/medium complexity 자산도 idle 상태에 한해 instancing 후보로 포함하는 제품 규칙을 추가했다.
- room mode cluster 자산은 pointer-down 시 selected asset만 live drag 대상으로 유지하고, pointer-up 후 개별 경로로 전환하는 direct-drag handoff 규칙을 추가했다.

Updated:
- `instancing/LOD 운영화` 상태를 `editor desk precision instancing 포함`에서 `editor room mode idle instancing + direct-drag handoff 포함` 상태로 확장한다.

Removed/Deprecated:
- editor room top은 direct-drag 때문에 항상 per-instance만 사용해야 한다는 가정.

## 2026-04-20 변경 동기화 (Showcase Activity Ranking Phase 1)
Added:
- persisted engagement 테이블 없이도 `preview_meta + published_at`만으로 일관된 `activity score / estimated views / likes / replies`를 계산하는 파생 지표 기준을 추가했다.
- community featured scene과 conversation card가 이 파생 activity score를 기준으로 정렬되는 제품 규칙을 추가했다.

Updated:
- P3 활동성 지표 작업 상태를 “미착수”에서 “phase 1: derived ranking baseline 완료, phase 2: persisted events 대기”로 갱신한다.

Removed/Deprecated:
- community page가 reply/like 수치를 화면 안에서 ad-hoc 식으로 따로 계산하던 상태.

## 2026-04-20 변경 동기화 (Showcase Activity Ranking Phase 2)
Added:
- shared viewer read-only 진입에서 `view`, 제품 핫스팟 선택에서 `product_focus`를 기록하는 persisted activity 계약을 추가했다.
- `shared_project_activity_events`를 community ranking과 conversation card 지표의 canonical source로 사용하는 규칙을 추가했다.

Updated:
- P3 활동성 지표 작업 상태를 “phase 1: derived ranking baseline 완료, phase 2: persisted events 대기”에서 “phase 2 persisted events 완료”로 갱신한다.
- community 지표 언어를 추정 `reply/like`에서 실제 `포커스/조회` 기준으로 수정한다.

Removed/Deprecated:
- community 활동성을 derived estimate만으로 장기 운영하는 가정.

## 2026-04-21 변경 동기화 (Editor Walk/Top QA Fixes)
Added:
- editor 상단 bar에서 프로젝트 이름을 직접 수정하고 저장 payload의 `projectName`으로 같이 보낼 수 있는 규칙을 추가했다.
- read-only shared/showcase top-view는 고정 orthographic이 아니라 orbit 기반 360도 감상 카메라를 허용하는 규칙을 추가했다.
- desk precision에서 선택 자산과 해당 support asset은 instancing/LOD proxy보다 full-detail 표시를 우선하는 규칙을 추가했다.
- builder style step의 wall/floor 선택 버튼은 실제 texture thumbnail을 노출하는 규칙을 추가했다.

Updated:
- top-view 품질 기준을 `flat floor footprint 우선`에서 `textured floor + 상향된 DPR + fill light 허용` 기준으로 갱신한다.
- room shell texture decode는 `.ktx2` 실패 시 원본 JPG/PNG로 즉시 fallback 되는 경로를 기본 계약으로 강화한다.
- editor top-view room shell은 footprint strip만이 아니라 full-height wall mesh도 함께 렌더해 builder preview와 유사한 shell legibility를 유지하도록 갱신한다.
- editor walk-view 기본 진입 anchor는 entrance 우선이 아니라 room center 우선으로 두어 첫 진입 시 wall clip으로 검정 화면이 발생하지 않도록 갱신한다.
- editor top-view / walk-view는 안정성 우선으로 post FX를 비활성화하고, top orbit polar range를 더 보수적으로 제한해 회전 중 black flicker를 줄인다.

Removed/Deprecated:
- editor header가 프로젝트 이름을 hardcoded subtitle로만 보여주고 직접 수정은 불가능하다는 가정.
- shared viewer top-view가 회전 버튼/고정 시점만 제공한다는 가정.

## 2026-04-14 변경 동기화 (IKEA Kreativ Pivot Hard Cleanup)
Added:
- IKEA Kreativ 스타일 room-first + deskterior + community 3D viewing을 canonical 제품 정의로 고정.
- API/Worker 역할을 asset generation 전용으로 재정의.

Updated:
- 활성 계약에 자산 생성 작업(`assets/generate`, `jobs/:jobId`)을 명시.
- 경계 정의에서 floorplan/intake 파이프라인 의존을 제거.

Removed/Deprecated:
- 존재하지 않는 `docs/legacy/*` 경로와 floorplan/intake compatibility를 메인 기준으로 참조하던 항목.
- legacy 파이프라인 보존 전제.

## 2026-04-16 변경 동기화 (Reference Start Flow + Template Browser)
Added:
- 홈 시작하기 화면(`/`)과 템플릿 선택 화면(`/studio/select`)을 메인 제품 경로에 추가.
- 빈 공간 템플릿과 가구 배치 템플릿을 같은 빌더/에디터 계약으로 연결하는 기준을 명시.

Updated:
- 핵심 경로를 `홈 -> 공간 선택/공간 만들기 -> builder -> editor -> share/view/community` 순서로 재정의.
- 동일 디자인 시스템 적용 범위를 홈/선택 화면까지 확장.

Removed/Deprecated:
- 사용자가 항상 `/studio/builder`에서 직접 시작한다는 가정.

## 2026-04-16 변경 동기화 (Reference 4-Step Builder Shell)
Added:
- `/studio/builder`를 레퍼런스 기준의 고정 4-step split shell(좌측 white configurator + 우측 grey viewport)로 정렬.
- step 2는 top-view 치수 오버레이, step 3/4는 isometric preview를 기본값으로 사용하는 규칙을 추가.

Updated:
- 빌더 단계 UI를 `모양 -> 치수 -> 문/창문 -> 스타일` 레퍼런스 레이아웃 기준으로 재정의.
- 개구부 스타일 변경과 로그인 복귀 초안 복원이 빌더 상태를 덮어쓰지 않도록 restore 동작을 강화.

Removed/Deprecated:
- 빌더 내부 상단 quick-start badge, step chip, preview summary 카드 중심의 이전 shell.

## 2026-04-16 변경 동기화 (Editor Precision Controls)
Added:
- `/project/[id]` 상단뷰 편집에서 `월드/로컬` transform space 토글을 기본 편집 affordance에 추가.
- TransformControls 드래그 중에도 room bounds + anchor solver를 재적용하는 live placement clamp 규칙을 추가.

Updated:
- 상단뷰 자산 조작 기준을 `이동/회전`만이 아니라 `이동/회전 + world/local 좌표계`까지 포함하도록 확장.

Removed/Deprecated:
- gizmo 보정이 mouse-up 시점에만 적용된다는 전제.

## 2026-04-16 변경 동기화 (Editor Reference Chrome Pass)
Added:
- `/project/[id]` 상단 app bar, 좌측 catalog rail, 우측 zoom rail, 하단 pill toolbar를 레퍼런스 7번 이미지 기준 shell로 고정.
- 공유 모달을 editor shell과 같은 light rail 언어로 정렬.

Updated:
- editor 기본 chrome을 floating card 조합에서 `flat top bar + slim rail + grey viewport + compact bottom toolbar` 구조로 재정의.
- 좌측 rail 기본 폭을 368px 기준으로 축소해 레퍼런스 density에 맞춤.

Removed/Deprecated:
- 에디터 상단의 개별 floating badge/card 조합과 dark glass 공유 모달.

## 2026-04-16 변경 동기화 (Shared Viewer + Furnished Feed Reference Pass)
Added:
- `/shared/[token]`를 editor shell의 읽기 전용 미러(top bar + grey viewport + right zoom rail + bottom status pill)로 고정.
- `/gallery`, `/community`를 레퍼런스 8번 이미지 기준의 furnished-space 카드 피드 shell로 고정.

Updated:
- shared viewer 제품 정보 노출 방식을 `상단 hero/metric` 중심에서 `뷰포트 우선 + hotspot drawer 상세 정보` 구조로 재정의.
- gallery/community 기본 밀도를 4열 카드 그리드와 상단 필터 rail 중심으로 정렬.

Removed/Deprecated:
- shared viewer 상단 hero metric strip과 gallery/community의 분산된 보조 status card 조합.

## 2026-04-16 변경 동기화 (Start Flow Fixes + Builder Shell Fit)
Added:
- 홈/선택/빌더 상단에 브랜드 + 로그인/로그아웃 단순 bar 규칙을 추가.
- 선택 템플릿이 builder를 거치지 않고 저장된 project를 만든 뒤 editor로 직접 진입하는 기준을 명시.
- builder step 2 치수 overlay가 실제 floor outline을 사용해야 한다는 규칙을 추가.
- builder 치수 state는 shape별 clamp를 거친 정규화 값과 실제 생성 geometry가 항상 일치해야 한다는 규칙을 추가.

Updated:
- builder를 "템플릿 보정 + 맞춤 생성" 공용 진입점에서 "맞춤형 방 생성 전용" 흐름으로 좁힘.
- builder desktop shell을 viewport 높이에 맞춰 페이지 스크롤 없이 유지하고, 내부 rail만 최소 스크롤을 허용하는 구조로 갱신.
- storage bucket 미준비 시 thumbnail upload를 복구/재시도하고, 실패해도 save 자체는 계속하도록 저장 규칙을 강화.
- 전역 top bar를 compact height + 주요 페이지 이동(home/select/create/studio/gallery/community) 기준으로 통일.
- desktop editor shell을 "좌측 카탈로그 고정 + 중앙 viewport + 필요 시 우측 inspector overlay + 축소된 bottom toolbar" 구조로 구체화.

Removed/Deprecated:
- 템플릿 선택이 `/studio/builder` 쿼리스트링 복원 경로를 항상 거친다는 가정.

## 2026-04-16 변경 동기화 (Builder 3D UX Stabilization)
Added:
- builder step 2 좌측 guide도 template icon이 아니라 실제 생성된 floor outline 기반으로 표시하는 기준을 추가.
- opening/style preview 카메라를 room center orbit + wheel zoom 중심 탐색 UX로 고정.

Updated:
- exterior polygon 복원 시 wall 좌표 snap tolerance를 meter 단위 room shell에 맞게 보수적으로 유지하도록 갱신.
- `t-shape`/`u-shape`/`slanted-shape` geometry는 정규화된 nook/bevel 값을 직접 사용하도록 명시.

Removed/Deprecated:
- preview orbit이 MapControls 기본 pan/rotate 조합에 의존한다는 가정.

## 2026-04-16 변경 동기화 (Community + Studio Shell Differentiation)
Added:
- `/community`를 질문/피드백/챌린지 성격의 커뮤니티 허브로 구분하는 규칙을 추가.
- `/studio`를 gallery 톤의 개인 프로젝트 아카이브로 재정의하고, 프로젝트 필터/검색 UI를 허용한다.
- 전역 navbar 탭을 우측 정렬로 통일하고, non-editor 페이지에는 navbar 높이만큼의 전역 오프셋을 적용한다.
- gallery/community의 summary, featured, latest metadata는 현재 페이지 조각이 아니라 active filter scope 전체를 대표해야 한다.

Updated:
- gallery는 발행 장면 아카이브, community는 대화 중심 허브라는 역할 차이를 명시.

Removed/Deprecated:
- gallery/community를 거의 동일한 피드 레이아웃으로 유지하던 이전 가정.

## 2026-04-17 변경 동기화 (Builder Shell Alignment Fix)
Added:
- builder step 3/4의 visible wall, opening, physics collider는 primary floor outline을 실내 경계로 간주하고 반 두께만큼 exterior 방향으로 오프셋하는 기준을 추가.

Updated:
- builder preview wall mesh는 local centerline이 아니라 "floor outline 내측면 정렬 + 코너 겹침 보정" 기준으로 렌더하도록 갱신.
- builder preview 기본 orbit 카메라는 room shell 전체 코너가 한 번에 보이도록 더 멀고 높은 framing을 기본값으로 사용한다.
- builder shape 선택지는 `rect`, `L`, `cut`, `T`, `U`, `slanted`, `offset`, `gallery bay`까지 기본 제공하고, 벽/바닥 마감은 7종/9종 이상을 기본 제공한다.

Removed/Deprecated:
- builder wall mesh가 floor outline 중심선 위에 그대로 앉아도 preview 품질이 충분하다는 가정.

## 2026-04-17 변경 동기화 (Editor Top-View Shell + Drawer Controls)
Added:
- editor 상단뷰는 builder와 같은 perspective orbit camera를 기본으로 사용하고, 마우스 drag 회전 + wheel zoom을 허용한다.
- editor 상단뷰의 벽 표시는 full-height wall mesh가 아니라 floor-level wall footprint strip으로 우선 표현한다.
- editor 상단 bar의 `추가`/`설정`은 좌측 slide-in drawer를 공유하고, 동시에 둘 이상 열 수 없도록 규칙을 추가.

Updated:
- 상단뷰는 ceiling을 숨기고, 워크뷰만 ceiling을 노출하는 몰입감 기준을 제품 기본값으로 고정.
- share modal은 작은 viewport에서도 카드 전체가 보이고 내부만 스크롤되도록 반응형 규칙을 강화.
- 상단뷰 카메라 회전은 orbit 기반으로 허용하되, 자산 선택/드래그/transform gizmo 조작과 충돌하지 않도록 분리한다.

Removed/Deprecated:
- 상단뷰의 explicit 좌/우 회전 버튼에만 의존하는 조작 가정.

## 2026-04-19 변경 동기화 (Room Mode + Desk Precision Mode Split)
Added:
- editor `top` 뷰 내부에 `room mode`와 `desk precision mode`의 별도 정책 상태를 둔다.
- room mode는 직접 드래그 기반 coarse layout, desk precision mode는 gizmo 기반 fine placement를 기본 조작으로 고정한다.

Updated:
- 상단뷰 카메라 정책을 단일 규칙에서 `room mode(넓은 framing orbit)`와 `desk precision mode(선택한 desk/support focus orbit)`로 분리한다.
- 상단뷰 편집 affordance를 `가구 직접 drag + transform gizmo 혼합`에서 `room mode=drag`, `desk precision mode=gizmo`로 명확히 나눈다.

Removed/Deprecated:
- 상단뷰 하나가 room layout과 desk surface 정밀 배치를 같은 snap/picking 정책으로 동시에 처리한다는 가정.

## 2026-04-21 변경 동기화 (Builder Openings + Editor Orbit + Brand Rename)
Added:
- builder step 3 opening preview는 style 선택 전 단계에서 기본 흰 벽/바닥을 사용하고, door/window GLB는 wall plane에 수직인 실제 opening asset으로 렌더한다.
- editor 상단뷰는 room mode와 desk precision 모두 perspective orbit + wheel zoom을 허용하고, desk precision은 선택한 desk/support asset을 우선 framing 한다.
- walk view는 entrance spawn을 room interior 쪽으로 더 깊게 clamp 하고, wall material은 실내 시점에서도 읽히도록 double-sided 렌더를 기본으로 사용한다.
- 서비스 표기와 내부 계약 문자열은 `DeskteriorOnline` / `deskterioronline`으로 통일한다.

Updated:
- top-view 품질 기준을 footprint legibility 우선에서 `실제 wall/opening asset + 더 높은 DPR/shadow/post FX` 기준으로 상향한다.
- builder opening step의 목표를 `개구부 배치 가능`에서 `개구부가 실제 door/window처럼 서 있고, style 선택 전에는 neutral white shell이 유지됨`으로 강화한다.

Removed/Deprecated:
- builder opening preview에서 문/창문이 바닥에 눕거나, style 선택 전 floor/wall finish가 미리 노출되는 상태.

## 2026-04-19 변경 동기화 (Scene Telemetry Contract)
Added:
- `SceneViewport` 공용 경로의 성능 계측 이벤트 계약(`deskterioronline:renderer-stats`, `deskterioronline:interaction-latency`)을 마스터 가이드에 추가했다.

Updated:
- 성능 측정 기준을 route shell 수치 문서뿐 아니라 브라우저 이벤트 훅까지 포함하는 형태로 명시한다.

Removed/Deprecated:
- 에디터/뷰어 성능 측정을 개별 개발자 로컬 스크립트에만 의존하는 가정.

## 2026-04-19 변경 동기화 (Perf Regression Contract)
Added:
- 성능 regression capture/verify 경로(`window.__DESKTERIORONLINE_TELEMETRY_CAPTURE__`, `perf:report:verify`)를 마스터 가이드의 운영 계약에 추가했다.

Updated:
- 공용 telemetry 계약 범위를 이벤트 발행만이 아니라 report JSON 검증까지 포함하도록 확장했다.

Removed/Deprecated:
- 성능 회귀 기록을 자유 형식 PR 코멘트만으로 관리하던 운영 방식.

## 2026-04-19 변경 동기화 (BVH Picking Baseline)
Added:
- loaded GLB 자산에 bounds tree를 생성하고 `three-mesh-bvh` accelerated raycast를 기본 picking 경로로 사용하는 기준을 추가했다.

Updated:
- desk precision picking 품질 기준을 triangle raw raycast 가정에서 BVH-backed raycast 기준으로 갱신한다.

Removed/Deprecated:
- 모든 GLB 자산 선택/hover가 기본 three.js triangle raycast만 사용한다는 가정.

## 2026-04-20 변경 동기화 (BVH Worker Offload)
Added:
- loaded GLB 자산의 large non-interleaved geometry는 bounds tree 생성을 Web Worker queue로 오프로딩하는 기준을 추가했다.

Updated:
- BVH 적용 범위를 `accelerated raycast 사용`에서 `accelerated raycast + generation offload`까지 확장한다.

Removed/Deprecated:
- loaded GLB bounds tree 생성이 항상 main thread sync compute에만 머문다는 가정.

## 2026-04-23 변경 동기화 (Phase 8 Live Performance Guardrail)
Added:
- telemetry 활성 시 `SceneViewport` overlay에 live performance budget HUD를 올려 draw call, FPS floor, interaction latency, BVH offload 경고를 즉시 읽을 수 있게 했다.
- runtime HUD 경고와 regression report 예산 검증이 `performance-budgets.ts` 공통 helper를 같이 쓰는 구조를 추가했다.

Updated:
- 성능 운영 계약을 “이벤트 발행 + report verify”에서 “이벤트 발행 + live HUD + report verify”까지 확장한다.

Removed/Deprecated:
- live 성능 예산 초과를 콘솔 이벤트나 사후 JSON 검증에서만 확인하던 운영 방식.

## 2026-04-23 변경 동기화 (Phase 8 Dense-Scene Instancing Hardening Slice 2)
Added:
- dense-scene instanced cluster는 asset membership key가 유지되는 동안 `InstancedMesh`를 재생성하지 않고 matrix sync만 수행하는 운영 규칙을 추가했다.
- `verify:asset-instancing`는 transform-only 업데이트가 cluster membership key를 바꾸지 않는다는 smoke를 함께 검증한다.

Updated:
- instancing 운영 기준을 “cluster eligibility와 grouping이 맞다”에서 “cluster eligibility와 grouping이 맞고, transform-only churn이 mesh rebuild로 이어지지 않는다”까지 확장한다.

Removed/Deprecated:
- dense-scene에서 repeated asset transform 변화가 cluster rebuild를 자주 유발해도 허용된다는 가정.

## 2026-04-23 변경 동기화 (Phase 8 Memory Leak Detection Slice 3)
Added:
- `ScenePerformanceTelemetry`는 지원 브라우저에서 heap sample을 renderer stat에 같이 싣고, `ScenePerformanceBudgetHud`는 heap usage와 growth를 stats card / issue feed에 같이 노출한다.
- `verify:performance-budget`는 live heap growth budget issue를 smoke에 포함한다.

Updated:
- live performance guardrail 기준을 “draw call / FPS floor / interaction latency / BVH offload”에서 “draw call / FPS floor / heap growth / interaction latency / BVH offload”까지 확장한다.

Removed/Deprecated:
- heap drift는 regression report나 DevTools에서만 보면 되고 live HUD에는 올리지 않아도 된다는 가정.

## 2026-04-23 변경 동기화 (Phase 8 Streaming/LOD + Benchmark CI Tighten Slice 4)
Added:
- focused asset/support asset은 top desk precision뿐 아니라 walk focus placement 경로에서도 full-detail LOD를 유지하도록 `resolveAssetLodPlan` priority를 확장했다.
- `verify:benchmark-baseline`를 추가해 checked-in `benchmark-scenes/baseline.template.json`이 benchmark scene inventory와 telemetry shape를 계속 따라가는지 검증한다.

Updated:
- Phase 8 performance gate를 “qa:primary + 개별 smoke 수동 실행”에서 “`qa:primary:perf` self-contained performance gate”까지 확장한다.
- `Phase 8 Performance Hardening`의 남은 범위를 `0%`로 닫고 다음 활성 타깃을 `Phase 9 Commercial QA`로 넘긴다.

Removed/Deprecated:
- focused interaction asset도 기본 room/view LOD 거리 정책만 따르면 된다는 가정.

## 2026-04-23 변경 동기화 (Phase 9 Commercial QA Slice 1)
Added:
- hidden commercial QA surface `/labs/qa`를 추가하고, 여기서 runtime package publish 상태 / benchmark baseline / compatibility matrix / scene integrity detector를 함께 읽는 기준을 둔다.
- `sceneDocument` bootstrap diagnostics는 `integrity.status`, issue list, recovery snapshot을 포함해야 하며 editor 진입 시 corruption/warning을 toast로 노출한다.
- `verify:commercial-qa`를 추가해 commercial QA snapshot이 최소 release gate 수, benchmark scenario coverage, compatibility matrix coverage, scene corruption detector sample을 모두 만족하는지 확인한다.

Updated:
- `Phase 9 Commercial QA`의 시작 기준을 “나중에 dashboard를 붙인다”에서 “hidden QA surface + bootstrap integrity diagnostics를 먼저 canonical source로 둔다”로 구체화한다.
- recovery snapshot의 의미를 단순 수동 복구 메모가 아니라 `nodeCount / surfacePlacementCount / missingSupportReferenceCount`를 포함한 structured runtime diagnostic으로 강화한다.

Removed/Deprecated:
- bootstrap 단계에서는 sceneDocument parse success만 확인하면 되고, integrity warnings는 별도 검증이 없어도 된다는 가정.

## 2026-04-23 변경 동기화 (Phase 9 Commercial QA Slice 2)
Added:
- commercial QA snapshot은 `verify:placement-kernel`, `verify:focus-placement`, `verify:advanced-attachments`를 placement regression suite로 묶어 mounted/surface placement 회귀 범위를 같은 surface에서 읽어야 한다.
- scene integrity recovery snapshot은 `missingSupportReferenceCount` 외에 `duplicateNodeIdCount`, `selfSupportReferenceCount`, `invalidSurfacePlacementCount`까지 포함해야 한다.
- hidden QA surface는 asset package inventory를 row 단위로 읽을 수 있어야 하며, scale-locked 여부 / surface count / attachment count / material variant count / missing required files를 함께 보여준다.

Updated:
- `Phase 9 Commercial QA`의 canonical snapshot 범위를 `release gates + asset status + baseline + compatibility + integrity`에서 `release gates + asset inventory + placement regression + baseline + compatibility + integrity`까지 확장한다.

Removed/Deprecated:
- placement regression coverage는 verify script 이름만 알면 충분하고 product-facing QA surface에는 드러나지 않아도 된다는 가정.

## 2026-04-23 변경 동기화 (Phase 9 Commercial QA Slice 3)
Added:
- compatibility matrix는 각 profile마다 `requiredForRelease`, `lastVerifiedAt`, `verificationMethod`, `evidence`를 가진 verification ledger를 유지해야 한다.
- placement regression suite도 단순 script registry가 아니라 verification ledger를 유지해야 하며, commercial QA snapshot에서 release-required suite의 최근 검증 흔적을 읽을 수 있어야 한다.
- hidden QA surface `/labs/qa`는 release-required compatibility profile과 placement regression suite의 verification evidence를 함께 보여주는 canonical release dashboard 역할을 해야 한다.

Updated:
- commercial QA canonical snapshot 범위를 `asset inventory + placement regression + baseline + compatibility + integrity`에서 `asset inventory + placement regression evidence + compatibility verification evidence + integrity`까지 확장한다.

Removed/Deprecated:
- release readiness 판단을 위해 CLI 실행 기억이나 수동 메모에 의존해도 된다는 가정.

## 2026-04-23 변경 동기화 (Phase 9 Commercial QA Slice 4 / Complete)
Added:
- commercial QA canonical snapshot은 asset risk summary와 release-ready coverage percentage를 포함해야 한다.
- scene corruption detector는 invalid scale과 support reference drift까지 잡아내고, recovery snapshot에서 이 수치를 직접 노출해야 한다.
- hidden QA surface `/labs/qa`는 integrity severity summary와 prioritized recovery action을 포함한 canonical release dashboard로 취급한다.

Updated:
- commercial QA canonical snapshot 범위를 `asset inventory + placement regression evidence + compatibility verification evidence + integrity`에서 `asset inventory + risk summary + evidence ledger + integrity severity/recovery plan`까지 확장한다.

Removed/Deprecated:
- integrity detector가 missing support / missing asset 같은 기본 규칙만 잡아도 상용 release gate로 충분하다는 가정.

## 2026-04-19 변경 동기화 (KTX2 Runtime Ready + Demand Frame Loop)
Added:
- `KTX2Loader`와 local basis transcoder sync 경로를 runtime asset decode 기준에 추가했다.
- editor top-view와 builder preview에 demand frame loop + explicit invalidation 규칙을 추가했다.

Updated:
- runtime asset delivery 기준을 `Draco + Meshopt`에서 `Draco + Meshopt + KTX2-ready decode path`로 확장했다.
- idle CPU 안정화 기준을 "경량 preset" 설명 수준에서 "demand frameloop 기본 적용" 규칙까지 포함하도록 갱신했다.

Removed/Deprecated:
- top-view와 builder preview가 입력이 없어도 항상 continuous frame loop를 유지한다는 가정.

## 2026-04-20 변경 동기화 (Deskterior Optimize Chain Phase 1)
Added:
- deskterior 런타임 GLB 최적화 기준에 `glTF Transform dedup + prune + meshopt` 체인을 추가한다.

Updated:
- runtime asset delivery 기준을 `Draco + Meshopt + KTX2-ready decode path`에서 `glTF Transform dedup/prune + Meshopt compression + KTX2-ready decode path`까지 확장한다.

Removed/Deprecated:
- deskterior optimize가 `EXT_meshopt_compression` extension write 한 단계만으로 충분하다는 가정.

## 2026-04-19 변경 동기화 (Top Render Ladder Split)
Added:
- room mode는 top-entry lean preset, desk precision mode는 selective high-fidelity preset을 사용하도록 렌더 정책 계단을 추가한다.

Updated:
- 상단뷰 렌더 예산을 단일 flat preset에서 `room mode=낮은 DPR + no post FX + no dynamic lights`, `desk precision mode=높은 DPR + selective post FX + capped dynamic lights`로 갱신한다.

Removed/Deprecated:
- room mode와 desk precision mode가 동일한 top-view 렌더 품질 프로필을 공유해도 된다는 가정.

## 2026-04-19 변경 동기화 (Shared Viewer Preset Split)
Added:
- read-only shared viewer는 `viewer-shared` preset, 추후 desk showcase는 `viewer-showcase` preset을 사용하도록 품질 슬롯을 분리한다.

Updated:
- shared viewer는 더 보수적인 DPR/그림자/후처리 예산을 쓰고, showcase preset은 richer visual 여지를 남기는 방향으로 기준을 갱신한다.

Removed/Deprecated:
- shared viewer와 desk showcase가 동일한 viewer 품질 preset을 그대로 공유한다는 가정.

## 2026-04-19 변경 동기화 (Shared Viewer Runtime Lightweight Pass)
Added:
- shared viewer 첫 진입은 제품 자동 선택 없이 시작하고, 사용자가 hotspot 또는 목록에서 명시적으로 선택하도록 기준을 추가한다.

Updated:
- read-only shared viewer HUD는 crosshair를 제거하고, walk 전용 모바일 조작 HUD만 유지하도록 경량화한다.

Removed/Deprecated:
- shared viewer가 editor와 같은 crosshair 계열 HUD를 기본으로 노출한다는 가정.

## 2026-04-19 변경 동기화 (Gallery + Community Filter Scope Summary)
Added:
- gallery/community가 active filter scope 기준 `matching total`, `latest publish`, `featured scene`, `top collection` summary를 읽는 규칙을 추가한다.

Updated:
- community header/side summary가 현재 페이지 카드 묶음이 아니라 필터 전체 아카이브를 대표하도록 갱신한다.

Removed/Deprecated:
- 페이지네이션 cursor 이후에도 summary가 현재 페이지 조각만 대표해도 충분하다는 가정.

## 2026-04-19 변경 동기화 (Render Cost Reallocation)
Added:
- builder preview와 `viewer-shared`는 lean light rig를 기본으로 사용하고, richer fill/bloom/shadow pass는 `desk precision` 또는 showcase/walk preset에서만 선택적으로 유지하는 규칙을 추가한다.

Updated:
- shared viewer 품질 기준을 단순 “더 보수적” 수준에서 `no fill light + subtle post FX + constrained no shadow/bloom`으로 구체화한다.

Removed/Deprecated:
- shared viewer와 builder preview가 full walk/showcase와 같은 fill-light/bloom/shadow 패스를 기본으로 유지한다는 가정.

## 2026-04-19 변경 동기화 (Presence Lab Isolation)
Added:
- presence/realtime 평가는 hidden route `/labs/realtime`와 local-only feature gate로만 다루는 규칙을 추가한다.

Updated:
- collaboration/presence는 active product surface가 아니라 분리된 실험 트랙이라는 점을 운영 기준으로 명시한다.

Removed/Deprecated:
- presence/realtime 실험을 gallery/community/editor chrome 안에 바로 연결해도 된다는 가정.

## 2026-04-20 변경 동기화 (Presence Lab Phase 1 Foundation)
Added:
- `/labs/realtime` 안에서 room query bootstrap, session key 기반 join, 15초 heartbeat, occupancy snapshot, 45초 stale participant 표시를 제공하는 local-only presence foundation을 추가한다.
- `verify:realtime-lab`로 room id 정규화, channel naming, active/stale participant snapshot 규칙을 회귀 검증하는 기준을 추가한다.

Updated:
- presence/realtime 상태를 `lab isolation only`에서 `lab isolation + phase 1 foundation complete`로 갱신한다.
- 남은 실험 범위를 `Phase 2 presence basics -> Phase 3 broadcast state -> Phase 4 lab-only collaborative draft -> Phase 5 hardening` 순으로 재정의한다.

Removed/Deprecated:
- `/labs/realtime`가 정적 설명 화면만 제공하고 실제 room/session foundation은 없는 상태.

## 2026-04-20 변경 동기화 (Presence Lab Phase 2 Basics)
Added:
- `/labs/realtime` 안에서 cursor presence surface, view mode presence, selected asset presence를 같은 realtime channel meta로 노출하는 Phase 2 basics를 추가한다.
- occupancy snapshot card와 active participant badge가 label/session뿐 아니라 accent color, view mode, selected asset, cursor 좌표를 함께 보여주도록 확장한다.
- `verify:realtime-lab` 검증 범위를 room/session foundation에서 cursor/view/selection presence roundtrip까지 확장한다.

Updated:
- presence/realtime 상태를 `lab isolation + phase 1 foundation complete`에서 `phase 2 presence basics complete`로 갱신한다.
- 남은 실험 범위를 `Phase 3 broadcast state -> Phase 4 lab-only collaborative draft -> Phase 5 hardening` 순으로 축소한다.

Removed/Deprecated:
- `/labs/realtime`가 occupancy snapshot만 보여주고 실제 ephemeral participant state(cursor/view/selection)는 전혀 노출하지 않는 상태.

## 2026-04-20 변경 동기화 (Presence Lab Phase 3 Broadcast State)
Added:
- `/labs/realtime` 안에서 presenter role, follow presenter, spotlight asset, attention ping snapshot을 제공하는 Phase 3 broadcast state를 추가한다.
- realtime presence contract에 `role`, `followingPresenterSessionKey`, `spotlightAssetId`를 추가하고, active participant 기준으로 current presenter / spotlight를 파생하는 규칙을 도입한다.
- attention ping은 realtime broadcast event로만 다루고, persistence 없이 마지막 ping snapshot만 노출하는 규칙을 추가한다.

Updated:
- presence/realtime 상태를 `phase 2 presence basics complete`에서 `phase 3 broadcast state complete`로 갱신한다.
- 남은 실험 범위를 `Phase 4 lab-only collaborative draft -> Phase 5 hardening` 순으로 축소한다.

Removed/Deprecated:
- presenter/follow/spotlight가 다음 단계로만 남아 있고 현재 lab에서는 다룰 수 없다는 상태.

## 2026-04-20 변경 동기화 (Presence Lab Phase 4 Collaborative Draft)
Added:
- `/labs/realtime` 안에서 sample asset 4종을 대상으로 optimistic lock, drag move broadcast, release, conflict banner를 제공하는 lab-only collaborative draft board를 추가한다.
- collaborative draft state를 presence/broadcast state와 분리해 `asset position / lock owner / last conflict`로 관리하고, lock 충돌 시 explicit conflict banner를 노출하는 규칙을 추가한다.
- `verify:realtime-lab` 검증 범위를 draft lock/move/conflict/release transition까지 확장한다.

Updated:
- presence/realtime 상태를 `phase 3 broadcast state complete`에서 `phase 4 collaborative draft complete`로 갱신한다.
- 남은 실험 범위를 `Phase 5 hardening` 단일 단계로 축소한다.

Removed/Deprecated:
- lab 안에서 공동 편집 draft는 아직 없고 presenter/follow까지만 실험하는 상태.

## 2026-04-20 변경 동기화 (Presence Lab Phase 5 Hardening)
Added:
- `/labs/realtime` 안에서 runtime pause/resume kill switch, manual reconnect retry, reconnect count, stale participant archive window를 제공하는 hardening 계층을 추가한다.
- realtime health helper를 도입해 `active / stale-visible / archived participant` bucket, reconnect 상태, exit gate checklist를 순수 함수로 계산한다.
- `verify:realtime-lab` 검증 범위를 stale archive health와 exit gate ready 상태까지 확장한다.

Updated:
- presence/realtime 상태를 `phase 4 collaborative draft complete`에서 `phase 5 hardening complete`로 갱신한다.
- 남은 실험 범위를 `Phase 5 hardening`에서 `presence/broadcast lab 범위 완료`로 갱신한다.

Removed/Deprecated:
- reconnect / stale cleanup / kill switch / exit gate가 다음 단계로 남아 있고 현재 lab에는 아직 없다는 상태.

## 2026-04-19 변경 동기화 (Desk Precision Measurements)
Added:
- desk precision mode에서 선택 자산의 X/Y/Z 위치와 Yaw 회전을 `mm/deg` 기준으로 보여주는 numeric inspector + measurement overlay 규칙을 추가한다.

Updated:
- 정밀 편집 수치 입력 기준을 내부 meter/radian 노출에서 사용자 단위(mm/deg) 노출로 갱신한다.

Removed/Deprecated:
- inspector가 내부 renderer 단위(meter/radian)를 그대로 노출해도 충분하다는 가정.

## 2026-04-19 변경 동기화 (Desk Precision Surface Lock)
Added:
- desk precision mode에서 surface anchor 제품이 어느 support asset / support surface에 잠겨 있는지 보여주는 surface lock 상태 카드 규칙을 추가한다.

Updated:
- 정밀 편집 확인 범위를 위치/회전 수치만이 아니라 support surface size / margin / top 높이 확인까지 확장한다.

Removed/Deprecated:
- 사용자가 Y 잠금 여부만 보고 현재 support surface를 추론해야 한다는 전제.

## 2026-04-19 변경 동기화 (Desk Precision Micro View)
Added:
- desk precision mode에서 support surface 내부 상대 위치를 보여주는 surface-local micro-view 규칙을 추가한다.

Updated:
- 정밀 편집 확인 범위를 수치 카드만이 아니라 support surface 위 상대 위치 시각화까지 확장한다.

Removed/Deprecated:
- 사용자가 support surface 위 상대 위치를 숫자만 보고 추론해야 한다는 전제.

## 2026-04-19 변경 동기화 (SceneDocument Roundtrip Verify)
Added:
- save payload -> sceneDocument -> version parse -> scene store patch roundtrip을 점검하는 `verify:scene-document` 품질 게이트를 추가한다.

Updated:
- 정밀 편집 엔진 변경은 UI 확인만이 아니라 sceneDocument 저장/복원 재현성 검증까지 통과해야 한다는 기준으로 강화한다.

Removed/Deprecated:
- save/load 재현성을 수동 UI 확인에만 의존하던 기준.

## 2026-04-19 변경 동기화 (Public Scene Payload Verify)
Added:
- share row + pinned version + preview meta를 조합한 public scene payload가 shared viewer에서 같은 `sceneDocument`를 재현하는지 점검하는 `verify:public-scene` 품질 게이트를 추가한다.

Updated:
- 공유 경로 재현성 기준을 editor 저장 검증만이 아니라 publish/shared payload 검증까지 포함하도록 확장한다.

Removed/Deprecated:
- shared viewer 재현성을 수동 링크 확인에만 의존하던 기준.

## 2026-04-19 변경 동기화 (Showcase Scene Consistency Verify)
Added:
- gallery/community 카드 projection이 shared viewer public payload와 같은 token/version/preview asset summary를 유지하는지 점검하는 `verify:showcase-scene` 품질 게이트를 추가한다.

Updated:
- 공유 경로 재현성 기준을 `sceneDocument -> shared viewer payload -> showcase card projection` 검증 체인까지 포함하도록 확장한다.

Removed/Deprecated:
- gallery/community 카드 메타 정합성을 수동 피드 확인에만 의존하던 기준.

## 2026-04-19 변경 동기화 (Desk Precision Extended Measurement)
Added:
- desk precision mode에서 surface anchor 제품의 footprint, projected footprint, edge clearance, relative yaw를 inspector/overlay/micro-view에 함께 노출하는 기준을 추가한다.

Updated:
- 정밀 편집 확인 범위를 `point offset 확인`에서 `footprint가 usable area 안에 들어오는지 판단 가능한 측정 UI`까지 확장한다.

Removed/Deprecated:
- surface-local 위치를 점 marker와 offset만으로 판단하던 기준.

## 2026-04-20 변경 동기화 (Desk Precision Helper View)
Added:
- desk precision mode에서 support surface 기준 `front(X/H)` / `side(Z/H)` orthographic helper view를 inspector와 overlay에 함께 노출하는 규칙을 추가한다.

Updated:
- 정밀 편집 확인 범위를 top-down micro-view와 clearance 카드에서 `projected span + bottom gap + top reach`까지 읽을 수 있는 단면 보조 시각화로 확장한다.

Removed/Deprecated:
- support surface 위 제품의 수직 관계를 absolute top height 숫자만으로 확인해도 충분하다는 가정.

## 2026-04-20 변경 동기화 (Room Shell KTX2 Wiring)
Added:
- room shell floor/wall procedural texture set에 `.ktx2` 우선 로드와 JPG/PNG fallback 규칙을 추가한다.
- room shell KTX2 산출물 encode/check 스크립트와 `NEXT_PUBLIC_ENABLE_KTX2_TEXTURES` 플래그를 운영 규칙에 추가한다.

Updated:
- KTX2 적용 범위를 GLB decode 준비 상태에서 `GLB decode + room shell texture runtime wiring + committed room shell KTX2 outputs`까지 확장한다.

Removed/Deprecated:
- room shell texture set이 KTX2 산출물이 생겨도 런타임에서 계속 원본 JPG/PNG만 직접 읽는다는 가정.

## 2026-04-20 변경 동기화 (Scene Instancing Phase 1)
Added:
- read-only top/walk와 builder preview에서 반복된 `single_mesh` low/medium complexity deskterior 자산을 instanced cluster로 묶는 운영 규칙을 추가한다.
- `verify:asset-instancing` 스크립트로 editable top mode 제외, selected 제외, dynamic light 제외, manual LOD 제외 정책을 회귀 검증하는 품질 게이트를 추가한다.

Updated:
- 원문 보고서 기준 남은 `instancing/LOD 운영화`를 “LOD policy 완료, read-only/builder instancing 1차 완료, editor-side/native pass만 남음” 상태로 갱신한다.

Removed/Deprecated:
- 반복 자산이 있는 read-only/builder 장면도 항상 개별 mesh clone만 사용해야 한다는 가정.

## 2026-04-20 변경 동기화 (Editor Desk Precision Instancing)
Added:
- editor `desk precision` top-view에서 반복된 `single_mesh` low/medium complexity 자산을 instanced cluster로 유지하는 운영 규칙을 추가한다.

Updated:
- `instancing/LOD 운영화` 상태를 `read-only/builder instancing 1차 완료`에서 `editor desk precision instancing 포함` 상태로 확장한다.

Removed/Deprecated:
- editor top-view 전체가 instancing eligibility에서 항상 제외되어야 한다는 가정.

## 2026-04-20 변경 동기화 (Native gltfpack Optional Chain)
Added:
- `assets:probe:gltfpack`와 `assets:optimize:deskterior:native` 운영 경로를 추가한다.
- native gltfpack pass는 `-cc -mi -kn -km -ke` 보수 플래그를 사용해 named node/material/extras 보존을 우선하는 기준을 추가한다.

Updated:
- 원문 보고서 기준 남은 `native gltfpack pass`를 “probe + wrapper + optimize chain wiring 완료, 실제 binary run만 남음” 상태로 갱신한다.

Removed/Deprecated:
- native gltfpack 적용이 수동 일회성 로컬 명령에만 의존하고 저장소 스크립트/문서 기준이 없던 상태.

## 2026-04-20 변경 동기화 (PBR Neutral Tone Mapping Phase 1)
Added:
- mode-aware render ladder에 tone mapping / exposure split을 추가해 `desk precision`, `builder preview`, `viewer-showcase`가 Neutral tone mapping을 사용하도록 기준을 고정한다.

Updated:
- shared viewer / room mode / 기본 walk viewer는 ACES를 유지하고, inspection/showcase 계열만 Neutral로 분리하는 방향으로 실사 강화 2차의 첫 단계를 반영한다.

Removed/Deprecated:
- renderer tone mapping이 SceneViewport 기본값 하나로만 고정되어 mode-aware 품질 ladder를 제대로 반영하지 못하던 상태.

## 2026-04-20 변경 동기화 (SSR Feasibility Phase 1)
Added:
- `editor walk`와 `viewer-showcase`의 non-constrained profile에 한해 보수적 SSR을 허용하는 운영 기준을 추가한다.

Updated:
- 실사 강화 2차 상태를 `PBR Neutral tone mapping phase 1`에서 `PBR Neutral + selective SSR feasibility phase 1`로 확장한다.

Removed/Deprecated:
- SSR이 향후 별도 branch에서만 검토되고 현재 render ladder에는 아무 연결이 없다는 가정.

## 2026-04-20 변경 동기화 (Showcase Polish Phase 2)
Added:
- `viewer-showcase`는 일반 shared viewer보다 tighter walk FOV, 살짝 더 가까운 top framing, accent rim/fill light rig를 사용하는 presentation polish 규칙을 추가한다.

Updated:
- showcase viewer 품질 기준을 “SSR/Neutral/post FX가 켜지는 richer slot”에서 “카메라 프레이밍과 라이트 밸런스까지 분리된 curated presentation”으로 확장한다.
- 남은 후속 항목을 `presence / broadcast` 중심 실험축만 남은 상태로 갱신한다.

Removed/Deprecated:
- `viewer-showcase`와 `viewer-shared`가 같은 카메라 framing/light rig를 공유해야 한다는 가정.

## 2026-04-20 변경 동기화 (Deskterior Metadata Contract Reinforcement)
Added:
- curated `p2s_*` 자산에 `source/license/pivot/collisionProxy/textureSet/lodProfile` 메타데이터 계약을 추가한다.
- sceneDocument save/load와 shared viewer payload가 위 계약을 product metadata와 함께 유지하는 기준을 추가한다.

Updated:
- 자산 메타데이터 기준을 `dimensionsMm + finish* + detailNotes + scaleLocked`에서 `실측/마감 + source/license/pivot/collisionProxy/textureSet/lodProfile`까지 확장한다.

Removed/Deprecated:
- curated deskterior 자산이 물리 메타데이터만 있으면 충분하다는 가정.

## 2026-04-17 변경 동기화 (Platform Cleanup + Asset Delivery Freeze)
Added:
- curated runtime asset의 장기 목표를 `repo public -> storage/CDN` cutover로 고정하고, 목적별 bucket 분리(`catalog-public`, `project-media`, generated staging/publish)를 기준 구조로 추가.

Updated:
- `apps/web/public/assets/*`는 active catalog를 위한 legacy fallback으로만 유지하고, 신규 curated binary는 여기에 직접 추가하지 않는다고 명시.
- Supabase 운영 정리 기준을 `legacy floorplan/intake live data purge -> direct DB migration -> remote env cleanup` 순서로 재정의.

Removed/Deprecated:
- `apps/web/public/assets/*`를 장기 운영용 canonical runtime asset store로 보는 가정.

## 2026-04-18 변경 동기화 (Platform Runtime Hard Cleanup)
Added:
- 운영 Supabase cleanup 범위에 `layout_revisions`, `source_assets`, `revision_source_links` 제거를 포함한다.
- 운영 Vercel preview는 production과 동일한 server-route 필수 env(`RAILWAY_API_URL`, `SUPABASE_SERVICE_ROLE_KEY`)를 유지한다.

Updated:
- Supabase 운영 정리 기준을 `legacy floorplan/intake live data purge -> direct DB migration -> remote env cleanup`에서 실제 `live data purge + live schema drop + remote env cleanup` 완료 상태로 갱신한다.

Removed/Deprecated:
- `jobs.floorplan_id`, `project_versions.floor_plan`, revision provenance 테이블이 운영 DB에 남아 있어도 무방하다는 가정.

## 2026-04-21 변경 동기화 (Vercel Incident Hardening)
Added:
- Supabase runtime key 기준을 `NEXT_PUBLIC_SUPABASE_ANON_KEY`/`SUPABASE_ANON_KEY`=`sb_publishable_...`, `SUPABASE_SERVICE_ROLE_KEY`=`sb_secret_...`로 고정한다.
- Vercel Preview/Production의 server-side env(`SUPABASE_SERVICE_ROLE_KEY`, `RAILWAY_API_URL`)는 `Sensitive`로 저장하고, Deployment Protection bypass secret은 env-backed 1개만 유지한다.

Updated:
- 플랫폼 보안 baseline을 `preview env parity` 중심에서 `publishable/secret key migration + sensitive env + single bypass + autoExposeSystemEnvs=false`까지 확장한다.

Removed/Deprecated:
- legacy JWT `anon`/`service_role`를 운영 런타임 env에 계속 두는 가정.
- Vercel에 여러 개의 automation bypass secret을 장기간 유지하는 운영 방식.
- `autoExposeSystemEnvs=true`를 기본 운영값으로 보는 가정.

## 2026-04-18 변경 동기화 (Opening Asset Fidelity + Entry Performance)
Added:
- builder/editor opening render는 Blender source(`assets/blender/openings`)와 runtime GLB(`apps/web/public/assets/models/p2s_opening_*`)를 같이 관리하는 기준을 추가.
- builder/editor top-view는 HDRI·interactive opening/light asset·full PBR floor/wall texture를 지연 로드하고, footprint/flat finish 중심으로 먼저 표시하는 성능 규칙을 추가.

Updated:
- builder step 3 opening 배치는 선택한 `벽 1~4`에 대해 center-ratio 기반 재배치로 보정하고, wall shell/collider/opening이 같은 wall placement 좌표계를 사용하도록 강화.
- direct/indirect lighting 품질 기준을 `자연스러운 falloff + builder 진입 성능` 기준으로 다시 조정.

Removed/Deprecated:
- opening preview 내부의 별도 휴지통 버튼과 `Preview Controls` 카드.
- top-view 진입 시 HDRI manifest와 모든 wall/floor texture set을 즉시 로드하는 가정.

## 2026-04-18 변경 동기화 (Builder Lighting Step + Top-View Controls)
Added:
- `/studio/builder` 최종 단계에 `직접등/간접등` 선택 step을 추가하고, 선택값을 scene lighting 계약에 저장하는 기준을 명시.
- editor 상단뷰 우측 rail에 좌/우 회전 버튼을 추가하고 90도 단위 orthographic 회전을 기본 조작으로 고정.
- 직접등 preview/editor 렌더에 광원 본체 + 바닥 빔 셰이더를 포함하는 기준을 추가.

Updated:
- builder canonical shell을 reference 4-step에서 `5-step split shell`로 갱신하고, 고정 navbar 아래에서 viewport가 가려지지 않도록 top offset 규칙을 강화.
- editor 상단뷰 카메라 회전 규칙을 `빈 공간 drag`에서 `명시적 버튼 회전 + wheel zoom`으로 변경.
- lighting 기본 품질 기준을 단일 직접광 전제에서 `직접등/간접등 selectable mood`로 확장.

Removed/Deprecated:
- floor/wall surface click으로 재질이 순환되는 hidden shortcut.
- editor 상단뷰의 빈 공간 drag 기반 회전 제스처.

## 2026-04-14 변경 동기화 (Physical Fidelity Runtime Pass)
Added:
- 실측/마감 메타데이터를 catalog -> save pipeline -> sceneDocument -> viewer hotspot까지 유지하는 계약을 기본 규칙으로 추가.
- `scaleLocked` 제품의 에디터 스케일 변경 차단 정책을 제품 규칙에 명시.

Updated:
- 공유 뷰어 제품 정보 기준을 브랜드/가격/옵션 중심에서 실측 규격/마감/디테일까지 확장.

Removed/Deprecated:
- 규격 정보가 문자열 옵션(`options`)에만 의존하던 운영 가정.

## 2026-04-14 변경 동기화 (Physical Fidelity Stage-2)
Added:
- `dimensionsMm` 기반 support 배치 정합성을 제품 규칙에 추가.

Updated:
- 마감 메타데이터 소비 범위를 정보 표시에서 런타임 재질 반영까지 확장.

Removed/Deprecated:
- support 배치가 키워드 기반 휴리스틱에만 의존한다는 가정.

## 2026-04-14 변경 동기화 (Physical Fidelity Stage-3)
Added:
- active asset footprint를 반영하는 wall clearance + inter-asset separation 솔버를 배치 기본 규칙에 추가.
- Blender 알려진 머티리얼 슬롯 우선의 slot-aware finish 반영 기준을 추가.

Updated:
- 신규 자산 추가 경로도 실측 메타를 넘겨 첫 배치 시점부터 물리 솔버가 동작하도록 갱신.

Removed/Deprecated:
- 신규 배치에서 fallback 규격만으로 배치 정합성을 판단하던 가정.

## 2026-04-19 변경 동기화 (Placement Contract Stage-1)
Added:
- `sceneDocument` 저장 시 placement를 mm 정수 스냅샷으로 직렬화하는 규칙을 제품 규칙에 추가.

Updated:
- save/load 경계의 좌표 계약을 "meter float 직접 저장"에서 "mm 정수 저장 + meter float 호환 파생"으로 갱신.

## 2026-04-14 변경 동기화 (Physical Fidelity Stage-4)
Added:
- 홈 화면 레퍼런스 사진 톤을 기준으로 3D 캔버스의 기본 룩(채광/대비/접지감) 품질 목표를 추가.
- HDRI 선택 우선순위(kiara/hotel/photo-studio 계열) 기준을 기본 렌더 규약으로 명시.

Updated:
- 배치 정확도 중심 규칙을 유지하면서도, 에디터/뷰어 기본 노출과 조명 균형을 사진 레퍼런스 수준으로 상향.

Removed/Deprecated:
- 첫 HDRI 항목을 무조건 사용하던 비결정적 환경 선택 가정.

## 2026-04-20 변경 동기화 (Showcase Viewer Presentation Phase 1)
Added:
- gallery/community 카드가 shared viewer를 `showcase presentation`으로 여는 진입 규칙을 추가했다.
- shared page가 `source=showcase` 쿼리를 받으면 `viewer-showcase` 렌더 프로파일을 사용하고, 일반 공유 링크는 기존 `viewer-shared` lean 프로파일을 유지하는 기준을 추가했다.

Updated:
- `viewer-showcase`를 문서 전용 렌더 슬롯이 아니라 gallery/community 유입 경로에서 실제로 소비되는 presentation mode로 갱신한다.

Removed/Deprecated:
- `viewer-showcase` 프로파일이 제품 경로에 연결되지 않은 dead configuration 상태.

## 2026-04-22 변경 동기화 (Commercial Engine Refactor Foundation)
Added:
- `packages/scene-schema`, `packages/engine-core`, `packages/renderer-three`, `packages/placement-kernel`를 신규 runtime foundation 패키지 경계로 추가했다.
- editor/shared viewport 위에 `CanvasHost` 기반 runtime engine bootstrap compatibility path를 추가했다.

Updated:
- `apps/web`의 역할을 scene mutation 직접 소유 경로에서 UI shell + canvas host 중심 경로로 재정렬한다.
- 저장 문서와 drag/hover/preview hot path를 분리하는 구조 전환을 canonical architecture에 포함한다.

Removed/Deprecated:
- `apps/web` 내부 React/Zustand 경로가 장기적으로 renderer/placement hot path까지 직접 책임진다는 가정.

## 2026-04-22 변경 동기화 (Runtime Editor Bridge Phase 2)
Added:
- instanced cluster direct-drag, top-view gizmo transform, 회전 hotkey가 `runtime asset preview -> pointer-up commit` 브리지 경로를 사용할 수 있도록 `deskterioronline:runtime-document-patch` 이벤트와 runtime patch helper를 추가했다.

Updated:
- editor top-view 조작 기준을 “일부 경로는 local preview, 일부 경로는 store 직접 mutation”에서 “preview는 runtime/local object 경로, commit은 store/document bridge 경로”로 더 엄격하게 정렬한다.

Removed/Deprecated:
- instanced cluster direct-drag가 pointer move마다 `useSceneStore.updateFurniture`를 직접 호출해야 한다는 가정.

## 2026-04-22 변경 동기화 (Runtime Render Sync Phase 3)
Added:
- `CanvasHost`가 runtime engine context를 내려주고, 선택 자산 렌더 경로가 runtime object registry의 preview/transform 값을 직접 읽을 수 있는 compatibility layer를 추가했다.

Updated:
- renderer compatibility path의 기준을 “SceneViewport 내부 React props 기반 transform”에서 “선택 자산은 runtime transform 우선, 나머지는 legacy prop fallback”으로 한 단계 더 전진시킨다.

Removed/Deprecated:
- renderer compatibility layer가 window global만 보고 동작하고, canvas 하위 트리에서는 runtime engine을 직접 소비하지 못한다는 가정.

## 2026-04-22 변경 동기화 (Renderer Adapter Sync Phase 3B)
Added:
- `renderer-three` 어댑터가 runtime scene object registry와 dirty object 집합을 직접 동기화하고, asset/material 기준 instance batch를 유지하는 compatibility sync 계층을 추가했다.
- renderer sync는 runtime scene generation과 object transform revision을 기준으로 문서 재컴파일 이후에도 stale matrix를 재사용하지 않도록 유지한다.

Updated:
- renderer migration 경로를 “runtime transform 직접 소비”에서 “runtime transform -> renderer adapter snapshot -> instanced cluster imperative sync” 단계까지 확장한다.

Removed/Deprecated:
- `renderer-three`가 아직 제품 경로와 완전히 분리된 패키지 골격일 뿐이라는 설명.

## 2026-04-23 변경 동기화 (Renderer Snapshot Material Sync Phase 3C)
Added:
- legacy asset `materialId`를 `SceneDocumentV2.materials` assignment와 runtime object snapshot으로 승격하는 기준을 추가했다.
- single object renderer compatibility path도 runtime engine 직접 참조보다 renderer adapter snapshot을 우선 소비하도록 기준을 확장했다.

Updated:
- renderer migration 기준을 “instanced cluster만 renderer adapter snapshot을 직접 소비”에서 “selected/single object path와 instanced cluster 모두 renderer adapter snapshot을 우선 소비” 상태로 갱신한다.

Removed/Deprecated:
- legacy asset `materialId`가 runtime renderer 경계에서는 metadata 잔재로만 남고 object snapshot에는 반영되지 않는 가정.

## 2026-04-23 변경 동기화 (Incremental Runtime Document Sync Phase 3D)
Added:
- room shell이 유지되는 asset add/remove/material/placement 변경은 `runtimeScene` 전체 교체 대신 object-level incremental sync로 흘리는 기준을 추가했다.
- runtime engine bridge는 same-room 문서 변경에서 `replaceDocument()`보다 `syncDocument()`를 우선 사용한다.
- same-room incremental sync는 removed object의 runtime selection/hover를 정리하고, `assetId/runtimeAssetId` 변경도 renderer object lifecycle에 반영해야 한다.

Updated:
- runtime foundation 경계를 “store change 후 문서 재컴파일로 재수렴”에서 “room 변경만 full replace, object 변경은 incremental sync” 구조로 강화한다.

Removed/Deprecated:
- same-room object 변경마다 runtime scene을 항상 새로 컴파일해야 한다는 가정.

## 2026-04-23 변경 동기화 (Runtime Visibility Lifecycle Phase 3E)
Added:
- `sceneDocument`와 runtime object registry는 object visibility를 canonical object lifecycle 필드로 같이 유지해야 한다.
- same-room visibility 토글은 full runtime scene replace 없이 incremental sync + dirty renderer sync로 반영해야 한다.

Updated:
- runtime lifecycle 범위를 `asset/material/placement`에서 `asset/material/placement/visibility`까지 확장한다.

Removed/Deprecated:
- visibility가 React-only render concern이라 runtime foundation으로 올릴 필요가 없다는 가정.

## 2026-04-23 변경 동기화 (Focus Placement Prototype Phase 5.5A)
Added:
- walk mode에서 선택된 배치 대상 자산이 있을 때, `desktop_top` support surface를 가진 가구를 바라보고 `E`로 `Focus Placement` 세션에 진입하는 첫 프로토타입을 추가했다.
- focus placement는 `useFocusPlacementStore`의 transient session, `FocusPlacementController`, `FocusPlacementHud`로 분리하고, Arrow/Q/E/Enter/Esc 입력은 runtime preview 경로만 사용한다.
- focus placement commit은 `surface_local` placement와 `supportAssetId`를 store/document/runtime에 함께 남겨 책상 기준 관계를 유지한다.

Updated:
- walkthrough 정밀 배치 상태를 “향후 별도 interaction mode”에서 “desk top 한정 첫 실사용 prototype 진입 완료”로 갱신한다.
- walk-mode 정밀 배치는 top-view transform control 재사용이 아니라 runtime placement transaction과 keyboard micro-adjust를 기본으로 하는 방향으로 고정한다.

Removed/Deprecated:
- walk mode 정밀 배치가 문서 수준 계획만 있고 제품 경로에는 아직 진입점이 없다는 가정.

## 2026-04-23 변경 동기화 (Focus Placement Prototype Phase 5.5 Complete)
Added:
- walk mode crosshair/hover hint는 focus surface와 선택 자산 호환성에 따라 actionable/blocked/info 톤을 구분해야 한다.
- focus placement HUD는 support surface 로컬 bounds와 preferred/no-place zone을 요약하는 minimap을 기본 포함해야 한다.
- focus placement HUD/session은 raw keyboard target이 아니라 snapped local pose와 검증 상태를 canonical 값으로 사용한다.

Updated:
- desktop_top 프로토타입 품질 기준을 “진입 + keyboard nudge + commit 가능”에서 “진입 힌트 + local grid + blocked/collision status까지 읽히는 실사용 prototype”으로 강화한다.

Removed/Deprecated:
- focus placement 제품 경로가 selected asset만 있으면 별도 compatibility/hint 없이도 충분하다는 가정.

## 2026-04-23 변경 동기화 (Asset Compiler Alpha Phase 4A)
Added:
- `packages/asset-compiler` 패키지를 추가해 curated deskterior asset 정의와 compiler command surface를 `apps/web/scripts` 밖으로 승격했다.
- `asset:publish`는 `apps/web/public/assets/catalog/runtime-packages.json`와 per-asset `runtime-packages/*.json` descriptor를 생성해 alpha `RuntimeAssetPackage` 인덱스를 유지한다.

Updated:
- curated asset pipeline 기준을 “manifest + 개별 스크립트 묶음”에서 “asset-compiler package + legacy script adapter + runtime package catalog” 구조로 한 단계 전진시킨다.

Removed/Deprecated:
- curated asset 정의가 `apps/web/scripts/deskterior-curated-assets.ts` 안에서만 canonical 하다는 가정.

## 2026-04-23 변경 동기화 (Asset Compiler Alpha Phase 4B)
Added:
- `asset:ingest --source <path>`가 `assets/ingest-staging/<assetKey>/source.asset.json` draft를 생성해 Phase 4 ingest entrypoint를 연다.
- `asset:publish`는 descriptor 외에 `colliders`, `support-surfaces`, `attachment-points`, `material-variants`, `qa-report` sidecar JSON을 함께 생성한다.
- alpha package descriptor는 embedded `runtimeAsset` 계약과 file manifest를 포함해 compile 결과를 scene-schema 기준으로 바로 점검할 수 있다.

Updated:
- curated runtime package 기준을 “descriptor only”에서 “descriptor + runtime metadata sidecars + publish fail gate” 구조로 강화한다.
- publish gate는 `source/runtime GLB 누락`, `scaleLocked 위반`, `contract metadata mismatch`, `supportProfile expectation mismatch`를 허용하지 않는다.

Removed/Deprecated:
- alpha 단계에서는 publish가 부분 성공 결과를 남겨도 된다는 가정.

## 2026-04-23 변경 동기화 (Asset Compiler Alpha Phase 4C)
Added:
- `packages/asset-compiler`는 package-owned `export/sync/validate/optimize/verify/verify-packages` 경로를 통해 curated asset compiler를 직접 소유한다.
- curated runtime package publish는 descriptor/sidecar 외에 실제 `proxy.glb`와 catalog thumbnail까지 생성하고, stale runtime package JSON과 stale `p2s_*.webp`를 publish 시 정리한다.
- published package QA는 descriptor와 embedded `runtimeAsset`뿐 아니라 sidecar parity, file manifest, support surface bounds, directory hygiene를 함께 확인한다.

Updated:
- asset compiler 성공 기준을 “publish artifact 생성”에서 “publish artifact 생성 + published package verification 통과”로 강화한다.
- fresh runtime GLB가 이미 존재하면 export 단계는 Blender 재호출 없이 sync/verify/validate/publish 흐름만 계속 진행하는 것을 기본 동작으로 고정한다.

Removed/Deprecated:
- `apps/web/scripts` wrapper가 compiler 단계별 비즈니스 로직을 계속 소유해도 된다는 가정.

## 2026-04-23 변경 동기화 (Placement Kernel Alpha Validation Slice)
Added:
- placement kernel은 surface-local commit 전에 최소한 `allowedAttachments`, support surface footprint bounds, restricted zone, same-surface sibling overlap을 검증해야 한다.
- attachment graph는 support object -> child 관계를 query할 수 있어야 하고, collision validation은 같은 support/surface 위 형제 배치를 최소 단위로 검사해야 한다.

Updated:
- `Phase 5 Placement Kernel Alpha` 기준을 “surface_local placement patch가 만들어진다”에서 “invalid surface placement를 commit 전에 차단한다” 수준으로 강화한다.

Removed/Deprecated:
- placement kernel이 preview/commit 브리지만 있으면 alpha slice로 충분하다는 가정.

## 2026-04-23 변경 동기화 (Placement Kernel Alpha Complete)
Added:
- placement kernel은 snap quantization, compatible surface auto-resolve, mounted attachment point compatibility, thickness validation을 commit 이전 필수 검증 세트로 사용한다.
- `PlacementTransaction.commit()`는 검증이 한 번도 수행되지 않은 candidate를 절대 저장하지 않는다.
- walk-mode focus placement session은 kernel이 반환한 snapped `localPose`를 HUD/store에 그대로 반영해야 한다.

Updated:
- `Phase 5 Placement Kernel Alpha` 기준을 “invalid surface placement를 commit 전에 차단한다”에서 “surface/mounted placement 모두 snap/compatibility/guard를 거친 뒤에만 commit된다” 수준으로 강화한다.

Removed/Deprecated:
- focus placement HUD/session이 raw keyboard target을 그대로 표시해도 preview/commit 정확도에는 문제가 없다는 가정.

## 2026-04-23 변경 동기화 (Phase 6 Full Focus Placement Mode Complete)
Added:
- walk-mode focus placement는 단일 `desktop_top` 표면이 아니라 `supportSurfaces + attachmentPoints` 기반 multi-candidate session으로 동작해야 하며, session은 `surfaceCandidates`, `preferredCandidateIndex`, `activeCandidateIndex`를 canonical 상태로 가진다.
- selected asset이 mounted attachment metadata를 광고하면 `place_on_surface`보다 `edge_clamp` 같은 mounted candidate를 우선 노출해야 한다.
- active focus placement session 중 candidate가 둘 이상이면 crosshair/HUD는 `Tab` cycle과 `F` refocus affordance를 기본 제공해야 한다.

Updated:
- focus placement compatibility 규칙을 “selected asset 유무 + dimensionsMm”에서 “selected asset dimensionsMm + runtime attachment metadata + surface thickness/compatibility”까지 확장한다.
- walkthrough 정밀 배치 품질 기준을 “desktop_top 실사용 prototype”에서 “top/edge/underside/wall candidate를 같은 interaction mode 안에서 전환 가능한 full mode”로 갱신한다.

Removed/Deprecated:
- mounted candidate 우선순위를 제품 경로 밖 helper 수준에서만 다뤄도 된다는 가정.

## 2026-04-23 변경 동기화 (Phase 7 Advanced Attachments Slice 1)
Added:
- `vesa_mount` 검증은 placed asset의 attachment point만이 아니라 support object의 attachment target 또는 articulation end-effector metadata까지 함께 확인해야 한다.
- `monitor_arm` articulation은 runtime kernel에서 lightweight analytic solve가 가능해야 하며, target pose가 joint limit을 넘기면 commit 전에 `ARTICULATION_TARGET_UNREACHABLE`로 차단해야 한다.

Updated:
- mounted attachment validation 범위를 `edge_clamp / underside / wall`에서 `edge_clamp + vesa_mount + articulation reachability`까지 확장한다.

Removed/Deprecated:
- support object 측 attachment metadata는 Phase 7 이후까지 미뤄도 된다는 가정.

## 2026-04-23 변경 동기화 (Phase 7 Advanced Attachments Slice 2)
Added:
- walkthrough focus placement에서 `vesa_mount` 후보가 활성화되면 primary UX는 direct joint edit가 아니라 `monitor-arm target pose wizard`여야 한다.
- monitor-arm wizard session은 `PageUp/PageDown` reach nudge와 solver-driven joint summary를 같은 runtime preview session 안에서 유지해야 한다.

Updated:
- advanced attachment 제품 규칙 범위를 `kernel validation`에서 `kernel validation + monitor-arm target-pose product path`까지 확장한다.

Removed/Deprecated:
- VESA/monitor-arm 흐름이 focus placement HUD 밖의 별도 후속 작업으로 남아 있어도 된다는 가정.

## 2026-04-23 변경 동기화 (Phase 7 Advanced Attachments Complete)
Added:
- mounted focus placement HUD는 authored attachment metadata(`requiredThicknessMm`, `minClearanceMm`, `vesaPatternMm`, articulation reach limit`)를 requirement 카드와 clearance readout으로 노출해야 한다.

Updated:
- advanced attachment 제품 규칙 범위를 `kernel validation + monitor-arm target-pose product path`에서 `kernel validation + authored requirement exposure + target-pose product path`까지 확장한다.

Removed/Deprecated:
- authored attachment constraint는 runtime 내부 검증만 통과하면 제품 UI에는 드러나지 않아도 된다는 가정.

## 2026-04-24 변경 동기화 (Room / Placement Feature Slice)
Added:
- Room shell은 단순 box wall이 아니라 architectural finish layer를 포함해야 하며, 기본 방도 baseboard, ceiling trim, visible opening/frame treatment, real-scale material repeat을 갖춰야 한다.
- Material system은 wall/floor/ceiling을 독립 assignment로 다루고, UI는 texture preview와 category를 함께 노출해야 한다.
- Walkthrough placement는 top view로 돌아가지 않고도 asset drawer -> asset select -> focus placement -> keyboard/numeric micro-adjust -> commit/cancel 경로가 이어져야 한다.
- Runtime catalog bridge는 published package metadata와 catalog variant dimensions를 조합해 mounted accessory의 support surface / attachment candidates를 복원해야 한다.

Updated:
- Feature RC 판단은 release gate dashboard가 아니라 브라우저에서 사람이 방 생성, 재질 변경, 제품 선택, walk placement, 저장/공유 재현을 실제로 수행할 수 있는지를 기준으로 한다.

Removed/Deprecated:
- production 운영 gate close 상태를 기능 완성의 대체 지표로 사용하는 기준.

## 2026-04-28 변경 동기화 (Walk Inventory Placement)
Added:
- Editor placement entry point is now walk-view first: `I` opens the asset inventory, selecting an item arms it for crosshair placement, and click/`E` on a compatible focused surface starts focus placement.
- A walk inventory draft must be excluded from autosave until the focus placement session is committed; canceling the session removes the draft asset.

Updated:
- Top view is view-only for product editing. It can frame and inspect the room but must not expose asset add drawers, direct drag, transform gizmos, or transform hotkeys.
- Walk placement confirmation accepts click or `Enter`; keyboard/numeric micro-adjust remains part of the active focus placement session.

Removed/Deprecated:
- Top-view room mode / desk precision mode as the primary asset placement surface.

## 2026-05-02 변경 동기화 (Interaction Engine PR7 Attachment Guard)
Added:
- `wall_screw`와 `grommet_hole`은 schema-only attachment가 아니라 focus placement candidate, placement kernel transaction, commit guard까지 이어지는 상용 attachment type으로 취급한다.
- placement kernel은 mounted point가 support surface 밖으로 나가거나 normal offset이 음수이면 commit 전에 차단해야 한다.
- wall/grommet footprint-bearing attachment는 same-surface collision validation을 통과해야 저장될 수 있다.

Updated:
- advanced attachment 검증 범위를 `edge_clamp / underside_screw / vesa_mount / cable_route`에서 `wall_screw / grommet_hole / same-surface mounted overlap`까지 확장한다.
- commercial QA placement regression evidence는 wall screw, grommet hole, mounted overlap blocked를 포함해야 한다.

Removed/Deprecated:
- `wall_screw`와 `grommet_hole`이 실제 제품 경로에 연결되기 전까지 누락되어도 된다는 가정.

## 2026-05-02 변경 동기화 (Interaction Engine PR8 Asset Metadata Gate)
Added:
- Published runtime package는 상용 catalog 노출 전 `asset-metadata-gate`를 통과해야 한다.
- metadata gate는 mm 치수, descriptor/runtime 치수 parity, `scaleLocked`, bounds-box collider, support surface bounds/frame, attachment point vector/compatibility, `productId`, source provenance, SKU/manufacturer를 필수 계약으로 본다.
- `/labs/qa`와 `verify:commercial-qa`는 metadata gate 통과 수를 release dashboard에 포함해야 한다.

Updated:
- asset compiler verification은 file/sidecar parity 검증에서 runtime placement에 필요한 metadata 값의 유효성 검증까지 책임진다.
- 상용 release readiness는 asset QA status와 파일 존재뿐 아니라 metadata gate 통과를 포함한다.

Removed/Deprecated:
- catalog asset metadata 검증을 UI 표시용 coverage summary 수준으로만 다뤄도 된다는 가정.

## 2026-05-02 변경 동기화 (Interaction Engine PR9 Viewer Parity Gate)
Added:
- public scene payload는 editor 저장 document를 `sceneSnapshot.documentHash`로 고정하고, runtime asset ids와 per-node asset refs를 함께 발행해야 한다.
- `verify:viewer-parity`는 public scene payload, shared/showcase token parity, version badge, thumbnail source, scene snapshot refs를 하나의 release gate로 확인한다.
- commercial QA dashboard는 viewer parity suite status와 evidence를 표시해야 한다.

Updated:
- shared viewer parity 기준을 “route가 열리는가”에서 “pinned version + document hash + runtime asset refs + showcase/community thumbnail source가 일치하는가”로 강화한다.

Removed/Deprecated:
- shared viewer와 community card가 같은 token만 쓰면 scene parity가 충분히 보장된다는 가정.

## 2026-05-02 변경 동기화 (Interaction Engine PR10 Commercial QA Dashboard)
Added:
- Commercial QA snapshot은 release gates를 `readinessScore`로 요약해 pass/warning/fail 상태와 blocker/warning 목록을 제공해야 한다.
- `/labs/qa`는 readiness score를 첫 화면에 노출해 asset, placement, viewer parity, performance, recovery diagnostics를 하나의 상용 시연 판단으로 연결한다.

Updated:
- 상용 QA 기준은 개별 verify script 나열에서 readiness score 기반 release 판단으로 확장한다.

Removed/Deprecated:
- 상용 데모 가능 여부를 dashboard 카드 상태를 사람이 임의로 종합해 판단하는 방식.

## 2026-05-02 변경 동기화 (Commercial Readiness Gate Closure)
Added:
- 상용 QA release gate는 `runtime-packages`, `asset-qa`, `asset-metadata-gate`, `actual-sku-hero-catalog`, `texture-material-library`, `benchmark-baseline`, `compatibility-matrix`, `placement-regression`, `scene-integrity`, `viewer-parity` 10개 모두 pass 상태여야 paid-beta demo ready로 본다.
- 내부 P2S hero SKU는 DeskteriorOnline Studio가 제조사인 실제 운영 SKU로 취급하며, source Blend/catalog metadata를 canonical reference pack으로 가진 경우에만 `releaseEligible=true`가 가능하다.

Updated:
- `/labs/qa` readiness score 목표를 100/pass로 상향한다.
- generic catalog asset의 reference/material QA 미완료 상태는 paid-beta hero gate가 아니라 catalog promotion backlog로 분리한다.
- wall/floor commercial library는 AI candidate texture count가 0이어야 pass다.

Removed/Deprecated:
- readiness score 85/warning을 상용 시연 가능한 최종 상태로 보는 기준.
- 외부 샘플/벤더 문서를 DeskteriorOnline 활성 docs surface에 보관하는 방식.

## 2026-05-07 변경 동기화 (Opening Visual Parity + Fallback Contract)
Added:
- builder preview, editor, shared viewer는 모두 `SceneViewport -> InteractiveDoors` 단일 개구부 렌더 경로를 사용해야 한다.
- opening renderer는 GLB variant metadata와 procedural fallback smoke-hook node names를 같은 계약으로 노출해야 한다.

Updated:
- door/window visual quality 기준을 “GLB가 보인다”에서 “GLB 실패 시에도 slab/handle/frame/threshold 또는 glass/frame/mullion/sill을 유지하는 shared renderer” 기준으로 강화한다.

Removed/Deprecated:
- opening GLB 로드 실패 시 plain white placeholder나 무구조 box로 대체되는 fallback.

## 2026-05-07 변경 동기화 (Walk Pointer Lock Fallback)
Added:
- walk view는 pointer lock 요청이 브라우저/iframe 정책으로 거부되어도 canvas focus 기반 WASD와 mouse-move look fallback을 유지해야 한다.

Updated:
- `walkPointerLockBlocked`는 패널이 열려 movement를 의도적으로 막는 상태에만 사용하고, pointer lock 요청 실패를 persistent blocked HUD로 표시하지 않는다.

Removed/Deprecated:
- pointer lock denied를 `Mouse lock unavailable` 경고로 계속 노출하는 UX.

## 2026-05-02 변경 동기화 (Walk Aim + Desk Preview Closure)
Added:
- walk placement의 기본 시작 경로는 선택 제품을 든 상태에서 crosshair가 바라본 support object의 focus placement request를 `AIM_AT_SURFACE`로 전달하고 즉시 ghost preview session을 시작하는 방식이다.
- `desk precision` keyboard nudge/rotate는 renderer preview를 먼저 갱신하고 짧은 idle batch 뒤 한 번만 scene store/document patch와 history snapshot을 만든다.
- `verify:walk-placement-ux`는 pointer lock뿐 아니라 crosshair aim candidate ranking, ghost preview command, commit patch intent까지 검증해야 한다.

Updated:
- `FocusPlacementLauncher`의 후보 목록은 fallback/명시 선택 UI로 유지하고, walkthrough의 주 UX는 바라본 표면 기반 immediate candidate preview로 본다.
- desk precision hotkey는 transform gizmo와 같은 preview -> commit 원칙을 따라야 하며 방향키 한 번마다 즉시 snapshot을 만들면 안 된다.

Removed/Deprecated:
- click/`E`로 launcher action을 호출해야만 walk placement가 시작되는 UX.
- desk precision keyboard nudge가 preview 없이 즉시 store commit을 만드는 방식.

## 2026-05-03 변경 동기화 (Placement Policy Closure)
Added:
- walk crosshair aim의 `rayHitConfidence`는 pending focus placement request에 보존되어 ghost preview 시작 시 candidate ranking에 그대로 재사용되어야 한다.
- 이미 commit된 asset의 crosshair 재배치는 자동 시작하지 않는다. 현재 자동 aim은 새 `placementDraft`에만 적용하고, 기존 asset은 launcher/명시 relocate flow로 시작하는 정책을 유지한다.
- `functional:e2e:browser`는 로컬 Supabase 설정이 있을 때 builder -> walk placement -> save/reload -> share -> shared viewer placement parity를 확인하는 브라우저 시나리오로 본다.
- shared viewer activity logging은 best-effort로 처리하며, tracking persistence 실패가 viewer 렌더링이나 브라우저 5xx 콘솔 오류로 전파되면 안 된다.

Updated:
- `desk precision` keyboard rotate 정책에 `R`을 포함한다. 방향키/Q/E/R 모두 renderer preview를 먼저 갱신하고 idle batch에서 한 번만 store/document commit을 만든다.
- walk aim 검증은 helper 직접 호출뿐 아니라 pending request에 저장된 confidence가 start 단계 ranking까지 유지되는지 확인해야 한다.
- functional browser QA는 shared viewer 중 5xx response가 발생하면 실패로 본다.

Removed/Deprecated:
- crosshair aim event의 confidence가 pending request activation에서 기본값 `0.8`로 되돌아가는 상태.
- desk precision `R` 키만 즉시 rotate commit을 만드는 예외.

## 2026-05-04 변경 동기화 (Walk Input + Vercel Session Diagnostics)
Added:
- walk mode keyboard contract는 `event.key`가 아니라 physical `event.code`를 우선한다. `W/A/S/D`, `I`, `E`, desk precision `Q/E/R`는 한글/비영문 키보드 레이아웃에서도 같은 physical key로 동작해야 한다.
- walk canvas는 pointer lock 요청 전 항상 focus를 받아야 하며, browser/iframe 정책으로 pointer lock이 거절되어도 canvas focus 상태에서는 WASD fallback movement를 허용한다.
- Vercel dashboard/preview panel의 `403: Forbidden` 화면은 앱 route가 열리는지와 분리해 진단한다. Deployment Protection/Vercel Authentication 또는 Vercel preview screenshot/thumbnail 차단이 원인일 수 있으며, canonical production alias가 정상 접속되면 app runtime failure로 단정하지 않는다.
- Supabase auth session은 같은 origin의 browser cookie/storage에 남는 운영 세션으로 취급한다. 새 배포가 기존 사용자를 자동 로그아웃시키면 안 되며, fresh-login QA는 logout/incognito/site-data-clear 또는 별도 preview origin/Supabase project로 수행한다.

Updated:
- walk pointer lock QA는 DevTools/F12 focus workaround 없이 `click scene -> mouse look/WASD`, `I -> inventory`, `E/click -> focus placement`가 동작하는지 확인해야 한다.
- pointer lock 실패/해제 HUD는 panel open뿐 아니라 browser-level lock pause에도 사용자가 다시 click scene 또는 panel close를 시도할 수 있게 안내해야 한다.

Removed/Deprecated:
- `event.key === "i"`처럼 layout-dependent key label만으로 walkthrough shortcut을 판정하는 방식.
- 새 Vercel deployment마다 사용자 로그인 세션을 강제로 초기화해야 한다는 운영 가정.

## 2026-05-04 변경 동기화 (Inventory Thumbnail Contract)
Added:
- editor library/inventory card는 catalog `thumbnail`이 있으면 실제 asset thumbnail image를 먼저 렌더링해야 한다. 이름만 보고 asset을 추측하게 만드는 text-only inventory는 상용 UX 기준을 통과하지 못한다.
- catalog API/import normalization은 `http(s)` 이미지 URL뿐 아니라 app-relative `/assets/...` thumbnail path도 보존해야 한다.
- `verify:inventory-thumbnails`는 inventory thumbnail coverage와 public thumbnail file 존재, relative thumbnail normalization을 검증한다.

Updated:
- thumbnail이 없는 legacy/generic item은 같은 카드 크기 안에서 fallback visual preview를 보여주고, 카드 레이아웃은 thumbnail 유무로 흔들리면 안 된다.

Removed/Deprecated:
- inventory/library preview를 tone gradient와 제품명 텍스트만으로 충분하다고 보는 기준.

## 2026-05-06 변경 동기화 (Commercial Builder Interaction Pass)
Added:
- inventory item click은 더 이상 즉시 scene store/document commit을 만들지 않고, `WalkInventoryPlacementDraft`와 renderer ghost preview를 시작한다.
- floor/world draft는 valid 위치에서 click/`Enter`일 때만 `commitRuntimePlacementDraftToStore`를 통해 최소 patch로 저장되고, `Escape`는 preview를 폐기한다.
- builder opening step은 3D/top preview에서 벽과 opening segment를 직접 선택/드래그할 수 있어야 하며, edge clearance와 opening overlap은 다음 단계 진행 전에 차단된다.
- room shell material preset은 clean commercial default와 special/industrial option을 metadata로 구분하고, builder finish 목록은 texture preset 계약에서 파생한다.
- builder direct lighting은 `fixtures[]` payload를 가진다. 각 fixture는 id/type/positionMm/intensity/colorTemperature/beamRadiusMm/spread/enabled를 저장하고 renderer/shared viewer가 같은 배열을 소비한다.
- 신규 release-adjacent gates로 `verify:inventory-ghost-placement`, `verify:room-openings`, `verify:material-presets`, `verify:lighting-layout`를 사용한다.

Updated:
- room builder 완료 기준은 “보이는 preview”가 아니라 조작 가능성, validation, save/reload/share parity를 포함한다.
- direct lighting은 고정 3개가 아니라 사용자가 1/2/3/4/6개 layout을 선택하고 위치를 조정하는 상용 builder 기능으로 본다.
- wall/floor 기본 preset은 matte/warm white, beige/grey plaster, oak/laminate/tile 같은 실사용 가능한 clean interior 재질을 우선 노출한다.

Removed/Deprecated:
- inventory click이 사용자 정면에 asset을 자동 확정 배치하는 방식.
- 문/창문 위치가 UI 선택 상태로만 존재하고 opening payload validation 없이 다음 단계로 진행되는 방식.
- direct lighting을 항상 3개 자동 배치로만 저장하는 방식.
- 얼룩/낡은/industrial texture를 default wall preset으로 취급하는 방식.
