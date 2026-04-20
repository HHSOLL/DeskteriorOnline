# 마스터 가이드 (엔지니어링 단일 기준)

이 문서는 Plan2Space의 현재 제품 기준을 정의합니다.

## 핵심 제품 정의
Plan2Space의 메인 제품은 **IKEA Kreativ 스타일 room-first 데스크테리어 빌더/에디터/뷰어/커뮤니티**입니다.

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
- 레이아웃 기본은 `상단 app bar + 좌측 rail + 중앙 grey viewport + 하단 pill toolbar`다.
- 좌측 rail 폭은 360~380px(기본 368px)로 고정한다.
- 뷰어는 읽기 전용이며 편집 affordance를 노출하지 않는다.
- 제품 클릭 시 제품 정보를 확인할 수 있어야 한다.
- 커뮤니티 게시물은 동일한 3D 씬 데이터 계약(`sceneDocument`)으로 재생되어야 한다.
- presence/realtime 실험은 primary 제품 경로와 분리된 hidden lab route에서만 평가하고, 홈/에디터/뷰어/갤러리/커뮤니티 navigation에는 연결하지 않는다.
- 제품 메타데이터는 실측 규격(`dimensionsMm`)과 마감(`finishColor`, `finishMaterial`, `detailNotes`)을 유지해야 한다.
- `sceneDocument` 저장 계약은 placement를 `unit="mm"` 정수 스냅샷으로 보관하고, meter float 좌표는 그 스냅샷에서 파생된 호환 필드로만 유지한다.
- `desk precision mode`에서는 선택한 제품의 위치/회전을 `mm/deg` 기준 numeric inspector와 measurement overlay로 노출한다.
- `desk precision mode`에서는 surface anchor 제품의 support asset / support surface / surface size / margin / top 높이를 surface lock 상태 카드로 노출한다.
- `desk precision mode`에서는 surface-local 상대 위치를 확인할 수 있는 micro-view를 inspector와 overlay 양쪽에서 제공한다.
- `desk precision mode`에서는 support surface 기준 `front(X/H)` / `side(Z/H)` orthographic helper view를 inspector와 overlay 양쪽에서 제공한다.
- `desk precision mode`에서는 surface anchor 제품의 footprint, projected footprint, edge clearance를 inspector와 overlay 양쪽에서 같은 값으로 제공한다.
- `SceneViewport` 기반 경로는 성능 측정 시 `plan2space:renderer-stats`와 `plan2space:interaction-latency` 브라우저 이벤트를 공용 telemetry 계약으로 사용한다.
- 성능 회귀 보고는 `window.__PLAN2SPACE_TELEMETRY_CAPTURE__`로 캡처한 JSON entry와 `perf:report:verify` CLI 검증을 기본 절차로 사용한다.
- loaded GLB 자산의 picking은 `three-mesh-bvh` 기반 bounds tree raycast를 기본값으로 사용한다.
- loaded GLB 자산의 bounds tree 생성은 large non-interleaved geometry에 한해 Web Worker queue로 오프로딩하고, small/interleaved geometry만 sync fallback을 사용한다.
- loaded GLB runtime decode는 `KTX2Loader` + local basis transcoder(`apps/web/public/assets/transcoders/basis`)를 기본 경로로 준비하고, 경로 override는 `NEXT_PUBLIC_KTX2_TRANSCODER_PATH`만 사용한다.
- room shell floor/wall procedural texture set은 `NEXT_PUBLIC_ENABLE_KTX2_TEXTURES=1`일 때 `.ktx2`를 우선 읽고, 산출물이 없거나 플래그가 꺼져 있으면 JPG/PNG 원본으로 fallback 한다.
- editor top-view(room / desk precision)와 builder preview는 기본적으로 `frameloop="demand"`를 사용하고, 카메라/hover/drag/gizmo 변경에서만 explicit invalidation 한다.
- 실측 고정 제품(`scaleLocked=true`)은 에디터에서 임의 스케일 변경을 허용하지 않는다.
- 데스크/선반 표면 배치는 실측 규격이 있으면 해당 값 기반으로 support surface를 계산한다.
- floor/surface 배치는 active asset footprint 기반 wall clearance + 자산 간 분리(relaxation)를 적용한다.
- Blender 슬롯(`DeskWood`, `DeskMetal`, `StandWood`, `StandPad`, `LampBody`, `LampAccent`, `LampBulb`)은 slot-aware finish 매핑을 우선 적용한다.
- project thumbnail storage가 일시적으로 준비되지 않았더라도 version save와 editor 진입은 계속되어야 한다.
- curated runtime binary를 `apps/web/public/assets/*`에 새로 직접 추가하지 않는다. 기존 `/assets/...` 경로는 storage cutover 전까지의 legacy fallback으로만 유지한다.

## 아키텍처 경계
- Frontend: `apps/web` (active product surface)
- API: `apps/api` (asset generation enqueue + health)
- Worker: `apps/worker` (asset generation processing)
- Supabase: auth/storage/database
- Asset pipeline: `assets/blender/deskterior`(source) + `apps/web/public/assets/models`(legacy fallback runtime) + `apps/web/public/assets/catalog/manifest.json`(catalog manifest)
- Target asset delivery: Supabase storage/CDN 기반 `catalog-public`(curated runtime), `project-media`(private snapshot/thumbnail), `assets-glb` 또는 후속 private bucket(생성형 자산 staging/publish) 구조를 사용한다.

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
- `npm --workspace apps/web run verify:public-scene`
- `npm --workspace apps/web run verify:showcase-scene`

## 필수 참조 문서
- `docs/implementation-plan.md`
- `docs/3d-visual-engine.md`
- `docs/user-action-guide.md`
- `docs/deployment.md`

## 2026-04-14 변경 동기화 (IKEA Kreativ Pivot Hard Cleanup)
Added:
- IKEA Kreativ 스타일 room-first + deskterior + community 3D viewing을 canonical 제품 정의로 고정.
- API/Worker 역할을 asset generation 전용으로 재정의.

Updated:
- 활성 계약에 자산 생성 작업(`assets/generate`, `jobs/:jobId`)을 명시.
- 경계 정의에서 floorplan/intake 파이프라인 의존을 제거.

Removed/Deprecated:
- `docs/legacy/*` 및 floorplan/intake compatibility를 메인 기준으로 참조하던 항목.
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

Removed/Deprecated:
- builder wall mesh가 floor outline 중심선 위에 그대로 앉아도 preview 품질이 충분하다는 가정.

## 2026-04-17 변경 동기화 (Editor Top-View Shell + Drawer Controls)
Added:
- editor 상단뷰는 방 중심 기준의 rotate-only orthographic camera와 zoom 동작을 기본으로 사용한다.
- editor 상단뷰의 벽 표시는 full-height wall mesh가 아니라 floor-level wall footprint strip으로 우선 표현한다.
- editor 상단 bar의 `추가`/`설정`은 좌측 slide-in drawer를 공유하고, 동시에 둘 이상 열 수 없도록 규칙을 추가.

Updated:
- 상단뷰는 ceiling을 숨기고, 워크뷰만 ceiling을 노출하는 몰입감 기준을 제품 기본값으로 고정.
- share modal은 작은 viewport에서도 카드 전체가 보이고 내부만 스크롤되도록 반응형 규칙을 강화.
- 상단뷰 카메라 회전은 빈 공간 drag에서만 시작하고, 자산 선택/드래그/transform gizmo 조작과 충돌하지 않도록 분리한다.

Removed/Deprecated:
- 상단뷰 pan 중심 탐색과 `목록/속성/항목뷰/이동/회전` 보조 affordance 의존.

## 2026-04-19 변경 동기화 (Room Mode + Desk Precision Mode Split)
Added:
- editor `top` 뷰 내부에 `room mode`와 `desk precision mode`의 별도 정책 상태를 둔다.
- room mode는 직접 드래그 기반 coarse layout, desk precision mode는 gizmo 기반 fine placement를 기본 조작으로 고정한다.

Updated:
- 상단뷰 카메라 정책을 단일 규칙에서 `room mode(넓은 framing + 90도 회전 단계)`와 `desk precision mode(더 높은 기본 zoom + 15도 회전 단계)`로 분리한다.
- 상단뷰 편집 affordance를 `가구 직접 drag + transform gizmo 혼합`에서 `room mode=drag`, `desk precision mode=gizmo`로 명확히 나눈다.

Removed/Deprecated:
- 상단뷰 하나가 room layout과 desk surface 정밀 배치를 같은 snap/picking 정책으로 동시에 처리한다는 가정.

## 2026-04-19 변경 동기화 (Scene Telemetry Contract)
Added:
- `SceneViewport` 공용 경로의 성능 계측 이벤트 계약(`plan2space:renderer-stats`, `plan2space:interaction-latency`)을 마스터 가이드에 추가했다.

Updated:
- 성능 측정 기준을 route shell 수치 문서뿐 아니라 브라우저 이벤트 훅까지 포함하는 형태로 명시한다.

Removed/Deprecated:
- 에디터/뷰어 성능 측정을 개별 개발자 로컬 스크립트에만 의존하는 가정.

## 2026-04-19 변경 동기화 (Perf Regression Contract)
Added:
- 성능 regression capture/verify 경로(`window.__PLAN2SPACE_TELEMETRY_CAPTURE__`, `perf:report:verify`)를 마스터 가이드의 운영 계약에 추가했다.

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

## 2026-04-19 변경 동기화 (KTX2 Runtime Ready + Demand Frame Loop)
Added:
- `KTX2Loader`와 local basis transcoder sync 경로를 runtime asset decode 기준에 추가했다.
- editor top-view와 builder preview에 demand frame loop + explicit invalidation 규칙을 추가했다.

Updated:
- runtime asset delivery 기준을 `Draco + Meshopt`에서 `Draco + Meshopt + KTX2-ready decode path`로 확장했다.
- idle CPU 안정화 기준을 "경량 preset" 설명 수준에서 "demand frameloop 기본 적용" 규칙까지 포함하도록 갱신했다.

Removed/Deprecated:
- top-view와 builder preview가 입력이 없어도 항상 continuous frame loop를 유지한다는 가정.

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
