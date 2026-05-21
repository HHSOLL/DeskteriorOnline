# 사용자 실행 가이드 (Room-First Deskterior)

이 문서는 현재 메인 제품 경로인 **홈 시작하기 -> 공간 선택/공간 만들기 -> 데스크테리어 에디터/룸 빌더 -> 발행 -> 읽기 전용 커뮤니티 뷰어** 운영 절차를 다룹니다.

## 1) 환경 변수 설정

### Web (`apps/web/.env.local`)
필수:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (`sb_publishable_...`)
- `SUPABASE_SERVICE_ROLE_KEY` (`sb_secret_...`, server-only)
- `RAILWAY_API_URL`
- `NEXT_PUBLIC_APP_URL` (`http://127.0.0.1:3100` 또는 배포 도메인)

배포 규칙:
- Vercel Preview에도 `SUPABASE_SERVICE_ROLE_KEY`, `RAILWAY_API_URL`를 넣어 preview server route가 production과 같은 계약으로 동작하도록 유지한다.
- Vercel Preview/Production의 `SUPABASE_SERVICE_ROLE_KEY`, `RAILWAY_API_URL`는 `Sensitive`로 저장한다.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`는 legacy JWT `anon` 대신 `sb_publishable_...`를 사용한다.
- 변수 이름 `SUPABASE_SERVICE_ROLE_KEY`는 유지하지만 실제 값은 legacy JWT `service_role`가 아니라 `sb_secret_...`여야 한다.
- Preview에서 OAuth를 직접 검증하려면 Vercel Project Settings → Deployment Protection의 `Vercel Authentication`을 preview/deployment URL에 걸지 않는다. 보호가 켜져 있으면 preview `/auth/signin`과 `/auth/callback`이 Vercel 앞단에서 먼저 차단돼 PKCE 오류가 재발할 수 있다.

권장:
- `PROJECT_MEDIA_BUCKET`
- `E2E_ROOM_FLOW_BASE_URL`
- `E2E_ROOM_FLOW_STRICT`
- `E2E_ROOM_FLOW_PROJECT_ID`
- `E2E_ROOM_FLOW_SHARED_TOKEN`
- `NEXT_PUBLIC_ENABLE_REALTIME_LABS` (`1`일 때 local-only `/labs/realtime` 실험 게이트 노출)
- `NEXT_PUBLIC_ENABLE_KTX2_TEXTURES` (`1`일 때 room shell floor/wall texture set이 `.ktx2` 우선 로드)
- `NEXT_PUBLIC_KTX2_TRANSCODER_PATH` (기본값 `/assets/transcoders/basis/`, 필요 시만 override)

### API (`apps/api/.env`)
필수:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY` (`sb_publishable_...`)
- `SUPABASE_SERVICE_ROLE_KEY` (`sb_secret_...`)
- `CORS_ORIGINS`

### Worker (`apps/worker/.env`)
메인 제품 기준 필수 항목:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (`sb_secret_...`)
- `ASSET_STORAGE_BUCKET`
- `WORKER_CONCURRENCY`
- `WORKER_POLL_INTERVAL_MS`
- `ASSET_GENERATION_POLL_INTERVAL_MS`
- `ASSET_GENERATION_MAX_POLLS`
- `MESHY_API_URL` / `MESHY_API_KEY` 또는 `TRIPOSR_API_URL` / `TRIPOSR_API_KEY`

상품 URL 기반 private asset generation 권장:
- `PRODUCT_ASSET_MAX_CANDIDATES` (기본 4)
- `PRODUCT_ASSET_AUTO_APPROVE_THRESHOLD` (기본 0.82)
- `ASSET_GENERATION_WORKDIR` (기본 `/tmp/deskterior-assets`)
- `BLENDER_BIN` (Blender finalizer를 worker image에 붙인 뒤 사용)
- `MESHY_STATUS_URL` / `TRIPOSR_STATUS_URL` (provider가 async job id만 반환할 때 필요)
- `MESHY_BUDGET_REMAINING` + `MESHY_BUDGET_COST_PER_TASK` (기본 `MESHY_BUDGET_MODE=required`에서 Meshy 외부 POST 전 token/credit 예산 확인)
- `MESHY_BUDGET_RESERVE` / `MESHY_MAX_BUDGET_PER_JOB` / `MESHY_SCENE_BUDGET_*` (잔여 token/credit 보존 및 standalone Meshy scene script 예산 제한)
- `ASSET_GENERATION_PROVIDER_MAX_ATTEMPTS` (기본 3, provider transient 오류 후보별 재시도)
- `ASSET_GENERATION_PROVIDER_RETRY_BASE_MS` (기본 750, provider retry exponential backoff 기준)

## 2) 핵심 QA/E2E 순서

아래 체크리스트를 기본 회귀 기준으로 사용합니다.

1. 홈(`/`)에서 상단 bar에 브랜드와 로그인/로그아웃 버튼이 노출되는지 확인하기
2. 홈(`/`)에서 `공간 선택` 카드 진입하기
3. `빈 공간` 템플릿 하나를 골라 builder가 아니라 editor로 바로 진입하는지 확인하기
4. 홈(`/`)로 돌아와 `가구가 비치된 공간` 템플릿 목록으로 진입하기
5. 가구 배치 템플릿 하나를 골라 builder style 단계로 이동하고, 3D preview에 seed 가구/소품이 보이는지 확인하기
6. 템플릿 목록에서 `더보기` 버튼이 같은 mode 안에서만 동작하고, 실제 추가 템플릿이 없으면 노출되지 않는지 확인하기
7. 홈(`/`)로 돌아와 `공간 만들기` 카드 진입하기
8. builder step 2/3/4/5가 데스크톱 viewport 안에서 고정 navbar 아래에 가려지지 않고 보이는지 확인하기
9. 치수 조정 시 overlay와 실제 room shape가 같이 바뀌는지 확인하기
10. step 2 좌측 guide와 우측 preview가 같은 실제 outline을 보여주는지 확인하기
11. step 3/4/5 preview에서 휠 줌 + 드래그 orbit이 방 중심 기준으로 동작하는지 확인하기
12. 문/창문 추가 시 asset이 바닥에 눕지 않고 wall plane에 수직으로 서 보이며, style 선택 전에는 기본 흰 벽/흰 바닥 shell이 유지되는지 확인하기
13. 스타일과 조명 모드(직접등/간접등)를 선택한 뒤, furnished seed가 preview와 동일한 asset set으로 에디터에 저장되는지 확인하기
14. 에디터에서 데스크테리어 가구 추가하기
15. 상단뷰에서 `룸 배치`와 `데스크 정밀`을 각각 열어 가구 이동/회전 정책이 달라지는지 확인하기
16. 저장/발행하기
17. 공유 토큰 열기
18. 읽기 전용 뷰어에서 제품 클릭하기
19. 갤러리/커뮤니티에서 동일 장면 열기
20. 에디터 상단뷰에서 builder처럼 마우스 드래그 orbit + wheel zoom이 동작하고, 좌/우 회전 버튼에 의존하지 않는지 확인하기
21. `추가`/`설정` 버튼이 각각 좌측 drawer를 열고, 재클릭/바깥 클릭 시 닫히며 동시에 둘 다 열리지 않는지 확인하기
22. 워크뷰에서는 ceiling이 보이고 상단뷰에서는 ceiling이 숨겨지는지 확인하기
23. 모바일 viewport에서 share modal이 화면 안에 들어오고 내부만 스크롤되는지 확인하기
24. 상단뷰에서 바닥/벽을 클릭해도 재질이 바뀌지 않고, room mode에서는 direct drag만, desk precision mode에서는 gizmo만 활성인지 확인하기
25. room mode에서는 250mm snap과 90도 회전 단계가, desk precision mode에서는 25mm snap과 15도 회전 단계가 적용되는지 확인하기
26. desk precision mode에서 선택 자산을 고르거나 `/project/[id]?selectedAssetId=<asset-id>`로 진입하면 inspector와 measurement overlay가 같은 X/Z/Y(mm), Yaw(deg), 실측 W/D/H(mm)를 일관되게 보여주고, inspector의 교체 후보가 추천/호환/검토 badge, anchor/크기 적합도 detail, thumbnail 또는 치수 기반 mini silhouette preview로 정렬되며, 후보를 눌렀을 때 같은 위치/회전/scale/support anchor를 유지한 채 새 catalog 제품으로 바뀌는지 확인하기
27. desk precision mode에서 surface anchor 제품을 고르면 inspector와 overlay에 같은 support asset / support surface / surface size / margin / top 높이가 표시되고, 비-surface anchor에서는 lock off로 보이는지 확인하기
28. desk precision mode에서 surface anchor 제품을 고르면 inspector와 overlay의 micro-view marker가 같은 support-local 위치를 가리키고, offset 수치와도 일치하는지 확인하기
29. desk precision mode에서 surface anchor 제품을 고르면 inspector와 overlay가 같은 footprint / projected footprint / edge clearance / relative yaw를 보여주고, usable area를 넘기면 overflow 상태로 바뀌는지 확인하기
30. desk precision mode에서 surface anchor 제품을 고르면 inspector와 overlay의 `front(X/H)` / `side(Z/H)` helper view가 같은 projected span, gap, reach를 보여주는지 확인하기
31. desk precision mode에서 small asset 다수 장면에서도 hover/select 시작 지연이 `deskterioronline:interaction-latency` 기준으로 급격히 튀지 않는지 확인하기
32. builder lighting step에서 `직접등` 선택 시 beam glow가, `간접등` 선택 시 천장 확산광이 preview에 반영되고, editor 조명 preset/slider와 direct/indirect mode, direct fixture count, fixture color temperature controls가 accent wash와 direct beam glow를 함께 바꾸는지 확인하기
33. room mode에서는 후처리/동적 조명이 꺼지고, desk precision mode에서는 정밀 확인에 필요한 저비용 bloom/조명만 선택적으로 올라오는지 확인하기
34. shared viewer는 editor보다 더 가벼운 read-only preset으로 열리고, hotspot drawer 동작에는 영향이 없는지 확인하기
35. shared viewer 첫 진입 시 어떤 제품도 자동 선택되지 않고, hotspot 또는 목록 선택 이후에만 상세 카드가 열리는지 확인하기
36. gallery/community에서 room/tone/density 필터를 건 뒤 header count와 다음 페이지 total이 현재 필터 결과 기준으로 유지되는지 확인하기
37. community에서 최신 게시, featured 장면, 주요 컬렉션 summary가 현재 페이지 카드 조각이 아니라 active filter scope 전체 기준으로 유지되는지 확인하기
38. shared viewer와 builder preview가 constrained 환경에서 fill light + bloom 없이도 읽기 흐름을 유지하고, walk/showcase에서만 richer shadow/bloom이 유지되는지 확인하기
39. builder preview의 furnished room이 높은 top-down floor plan이 아니라 낮은 external diagonal orthographic presentation camera, dark backdrop, lightweight shadow/contact shadow, 직접등 fixture decor, renderer-only transparent tint warm/cool wall/floor mood wash, 24개 `workspace-flex` seed asset, back-wall desk cluster/side-wall TV+media-console/cutaway-side shelf/foreground lounge staging, support-anchored desk/shelf/console/side-table props, dimensionsMm 기반 rounded/beveled preview proxy, monitor/keyboard/mouse/speaker/gamepad/game-console/mug micro-detail, 렌더 전용 media-console/desk drawer/LED/cable, desk/media/shelf surface dressing(헤드폰/케이블/노트/콘솔·리모컨/collectibles), rug/woven-edge lounge ground dressing/coffee-table tabletop props/shelf books/sofa arm·cushion·throw·seam/plant leaf detail, preview-only crown trim/framed wall panels로 compact diorama처럼 읽히고, style step의 workspace preset(풀 룸/크리에이터 데스크/미디어 라운지/갤러리 스튜디오)과 workstation/media/lounge/display cluster 토글을 바꿨을 때 preview와 URL `clusters` 상태가 같은 seed asset set으로 바뀌는지 확인하기
40. `NEXT_PUBLIC_ENABLE_REALTIME_LABS=1`로 로컬 실행 시 `/labs/realtime`만 열리고, primary navigation에는 realtime/presence 진입점이 생기지 않는지 확인하기
41. `assets:verify:deskterior` 실행 시 curated `p2s_*` 자산이 `source/license/pivot/collisionProxy/textureSet/lodProfile` 계약까지 모두 통과하는지 확인하기
42. `verify:scene-document`, `verify:public-scene` 실행 시 위 product contract metadata가 save/load/share roundtrip에서 유지되는지 확인하기
43. `verify:asset-lod` 실행 시 complex asset은 room mode에서 더 빨리 proxy fallback 되고, simple asset은 desk precision에서 full detail을 유지하는지 확인하기
44. `verify:asset-instancing` 실행 시 read-only top/walk와 editor `desk precision`, editor `room mode` idle에서 repeated `single_mesh` 자산이 cluster로 묶이고, builder preview starter는 proxy 가독성을 위해 개별 렌더 경로를 유지하며, room mode dragging 중에는 selected asset이 cluster 안에서 live drag 되다가 pointer-up 후 개별 경로로 빠지는지 확인하기
45. dense-scene repeated asset 장면에서 transform만 바꿨을 때 cluster가 다시 만들어지지 않고 기존 instanced mesh가 유지되는지 확인하기
46. desk precision / builder preview / richer showcase 경로는 Neutral tone mapping으로, room mode / shared viewer / 기본 walk viewer는 ACES tone mapping으로 읽히며 하이라이트 clipping과 white balance가 mode 목적에 맞게 유지되는지 확인하기
47. editor walk와 richer showcase 경로에서만 SSR이 보수적으로 올라오고, shared viewer / top-view / builder preview에서는 SSR이 꺼져 있는지 확인하기
48. `verify:showcase-activity` 실행 시 recent/rich scene이 older/sparse scene보다 높은 activity rank를 받고, community featured / conversation link가 showcase presentation 경로를 유지하는지 확인하기
49. showcase 카드 진입 shared viewer는 일반 shared 링크보다 walk framing이 더 타이트하고, top framing이 살짝 더 조여지며, walk mode에서 rim/fill light가 더 풍부하게 읽히는지 확인하기
50. `/labs/qa`에서 actual SKU hero catalog gate, texture/material library gate, SKU/reference/material QA row가 보이는지 확인하기
51. 워크뷰 focus placement에서 기본 이동/회전은 5mm/1deg로 스냅되고, `Alt` fine 조작 또는 numeric pose 입력은 1mm/0.1deg로 저장되는지 확인하기
52. 새 asset을 운영 catalog에 올리기 전 `referencePack`, 공식 치수, reference image, material QA, release eligibility가 `asset:publish` 산출물에 반영되는지 확인하기
53. wall/floor texture preset이 12개 이하이고, AI 생성 1K texture는 candidate로 표시되며, 상용 preset은 2K source/KTX2/fallback metadata를 가지는지 확인하기
54. `verify:interaction-engine` 실행 시 preview 상태에서는 document patch가 0건이고, commit 상태에서만 placement patch intent가 1건 발생하는지 확인하기
55. 실제 브랜드 제품 prototype asset은 catalog에 노출되더라도 `releaseEligible=false`/draft 상태인지, 제조사 URL과 치수 출처가 runtime package에 남는지 확인하기
56. 워크뷰 인벤토리의 `상품 링크로 에셋 생성` 입력에서 URL을 넣으면 `POST /api/v1/product-assets/generate` job이 만들어지고, 완료 후 `GET /api/v1/assets`의 private generated asset이 editor catalog에 병합되는지 확인하기
57. `verify:product-asset-generation` 실행 시 product URL job type, private visibility, owner-scoped signed asset list, Blender finalizer/evaluator evidence, category profile, thumbnail persistence, `releaseEligible=false` metadata가 모두 통과하는지 확인하기
58. worker 배포 환경에서 `BLENDER_BIN`이 없으면 product asset job 결과에 `BLENDER_BIN_NOT_CONFIGURED` warning이 남는지, 있으면 thumbnail과 dimension QA report가 생성되는지 확인하기
59. provider가 429/5xx/network timeout을 반환할 때 후보별 retry가 먼저 실행되고, 모든 후보와 job retry가 소진된 경우에만 `dead_letter`로 가는지 확인하기
60. Meshy를 켠 환경에서는 `MESHY_BUDGET_REMAINING`과 `MESHY_BUDGET_COST_PER_TASK` 없이 provider POST가 나가지 않고, retry worst-case 예약량이 잔여 token/credit을 넘으면 non-recoverable failure로 끝나는지 확인하기
61. `verify:builder-preview-diorama` 실행 시 full style/lighting preview는 24개, media-lounge preset은 8개 furniture source가 모두 `builder-preview-proxy`로 잡히고, placeholder/model-loading fallback은 0개이며, full preview source registry에 `p2s_meshy_pastel_mascot_stack`가 포함되는지 확인하기

## 2026-05-15 변경 동기화 (Workspace Cluster Customization QA)
Added:
- builder style step에서 `workspace-flex`의 workstation/media/lounge/display cluster 토글을 조작하고, preview asset set과 URL restore가 같은 구성을 유지하는 QA 항목을 추가했다.
- editor inspector에서 선택 제품의 같은 카테고리 교체 후보를 눌러 같은 transform/support anchor 위에서 제품만 바뀌는 QA 항목을 추가했다.
- editor `selectedAssetId` query restore로 선택 제품 inspector QA를 안정적으로 시작하는 항목을 추가했다.
- editor replacement picker가 category만 보지 않고 anchor/치수/제품군/실측 metadata/QA score 기반 추천 순서와 badge/detail을 보여주는 QA 항목을 추가했다.
- editor replacement card가 실제 asset과 맞는 thumbnail 또는 치수 기반 mini silhouette preview와 fit label을 보여주는 QA 항목을 추가했다.
- editor lighting preset과 accent/beam slider가 warm/cool diorama mood 및 direct beam glow를 바꾸는 QA 항목을 추가했다.
- editor selected asset과 replacement card가 workstation/media/lounge/display/flex room zone label을 보여주고, 같은 존/전체 후보 filter를 전환할 수 있는 QA 항목을 추가했다.

Updated:
- furnished starter QA 기준을 “24개 asset이 보인다”에서 “24개 asset 기본값과 cluster별 축소 구성이 모두 의미 있는 real catalog asset으로 보인다”까지 확장했다.
- 커스터마이징 QA 기준을 builder cluster on/off에서 editor selected-asset replacement와 compatibility-ranked replacement picker까지 확장했다.
- replacement visual QA를 단순 label/list 검증에서 card-level thumbnail/silhouette/fit label 검증까지 확장했다.
- lighting QA를 builder direct/indirect preview 확인에서 editor preset/slider 기반 mood customization 확인까지 확장했다.
- replacement compatibility QA를 category/anchor/size/family에서 room zone context 유지와 same-zone 후보 탐색까지 확장했다.

Removed/Deprecated:
- catalog 누락 때문에 media/lounge/display cluster가 unrelated fallback item으로 바뀌어도 허용하는 QA 가정.
- 제품 교체 QA를 삭제 후 추가 동작으로만 확인하고 위치/support lock 유지 여부를 보지 않는 가정.
- 같은 category 후보를 임의 순서로 보여줘도 replacement UX가 충분하다는 가정.
- editor lighting preset이 ambient/hemisphere/directional/environment blur만 바꾸면 충분하다는 QA 가정.
- 사용자가 교체 후보의 방 구성 맥락을 label 없이 추론하거나 같은 존 후보를 전체 목록에서 수동으로 찾아도 충분하다는 QA 가정.

## 2026-05-16 변경 동기화 (Workspace Cluster Preset QA)
Added:
- builder style step에서 `workspace-flex` preset 버튼을 누르면 풀 룸/크리에이터 데스크/미디어 라운지/갤러리 스튜디오 구성이 즉시 preview seed set과 URL `clusters`에 반영되는지 확인한다.
- preset 선택 후 개별 cluster 토글을 추가 조정해도 최소 1개 cluster가 유지되고 기존 preview/auth draft/project create 경로가 같은 `workspaceClusterIds` 값을 쓰는지 확인한다.

Updated:
- workspace starter QA는 cluster 개별 on/off뿐 아니라 목적별 preset으로 빠르게 방 밀도를 바꾸는 커스터마이징 흐름까지 포함한다.

Removed/Deprecated:
- 사용자에게 cluster 조합을 하나씩 실험하게 해도 workspace customization UX가 충분하다는 가정.

## 2026-05-16 변경 동기화 (Diorama Grounding Shadow QA)
Added:
- `verify:render-quality`, `verify:builder-performance`, `verify:material-presets` 실행 시 builder preview가 bounded dynamic shadow + warm-tinted contact shadow를 유지하고 SSR/bloom/post FX는 끄는지 확인한다.
- editor room/desk top-view는 HDRI 없이 contact shadow grounding을 유지하고, shared top-view는 contact shadow를 끄는지 확인한다.
- builder style step에서 `Matte White Paint`, `Warm White Paint`, `Beige Plaster`, `Light Grey Plaster`, `Greige Clean Plaster` swatch와 preview wall이 dirty concrete/plaster처럼 보이지 않는지 확인한다.

Updated:
- builder preview 성능 QA는 shadow/contact shadow 자체를 금지하지 않고 shadow map, contact shadow resolution/far, DPR ceiling이 bounded profile 안에 있는지 확인한다.
- material preset QA는 clean default thumbnail과 runtime wall material이 같은 clean wall impression을 유지하는지 확인한다.

Removed/Deprecated:
- builder preview가 shadow/contact shadow를 렌더하면 곧바로 성능 회귀로 보는 QA 기준.
- clean default wall preset이 실제 화면에서 dirty/damaged texture처럼 보여도 통과시키는 QA 기준.

## 2026-05-16 변경 동기화 (Builder Preview Ground Dressing QA)
Added:
- builder style step에서 `workspace-flex` furnished preview를 열었을 때 coffee table 주변에 큰 lounge rug, woven edge/thread detail, tabletop props, sofa throw/seam이 보여 바닥 중심부가 빈 공간처럼 읽히지 않는지 확인한다.
- `verify:builder-performance`는 `BuilderPreviewGroundDressing`이 builder preview에만 연결되어 있고 `builder-preview-ground-dressing` group name과 rug weave/tabletop prop source marker를 유지하는지 확인한다.

Updated:
- furnished starter QA는 “가구/소품이 보인다”에서 “lounge cluster가 바닥 rug와 작은 surface props로 묶여 방처럼 읽힌다”까지 확장한다.
- 해당 QA는 저장 payload, cluster URL 상태, dynamic emitter 예산이 변하지 않는다는 전제를 같이 확인한다.

Removed/Deprecated:
- lounge/coffee-table zone이 큰 빈 바닥 위에 떠 있는 proxy처럼 보여도 compact diorama로 볼 수 있다는 기준.

## 2026-05-16 변경 동기화 (Builder Preview Surface Dressing QA)
Added:
- builder style step에서 `workspace-flex` furnished preview를 열었을 때 desk 위 헤드폰/케이블/노트, media console 위 콘솔/리모컨, shelf 위 작은 collectibles가 보여 workstation/media/display cluster가 빈 상판처럼 보이지 않는지 확인한다.
- `verify:builder-performance`는 `BuilderPreviewSurfaceDressing`이 builder preview에만 연결되어 있고 desk/media/shelf group name과 dynamic emitter 미증가 조건을 유지하는지 확인한다.

Updated:
- furnished starter QA는 lounge ground dressing뿐 아니라 desk/media/shelf 상판의 personal object density까지 포함한다.
- 해당 QA는 저장 payload, cluster URL 상태, fixture/dynamic emitter 예산이 변하지 않는다는 전제를 같이 확인한다.

Removed/Deprecated:
- desk/media/shelf zone이 큰 furniture proxy와 기존 seed props만으로 충분히 개인 방처럼 보인다는 기준.

## 2026-05-16 변경 동기화 (Builder Preview Wall Dressing QA)
Added:
- builder style step에서 `workspace-flex` furnished preview를 열었을 때 rear/side wall framed art, rear wall shelf decor, warm/cool LED strip이 보여 빈 white wall처럼 보이지 않는지 확인한다.
- `verify:builder-performance`는 `BuilderPreviewWallDressing`이 builder preview에만 연결되어 있고 gallery/shelf/LED group name과 dynamic emitter 미증가 조건을 유지하는지 확인한다.
- `verify:lighting-layout`는 builder preview warm/cool wall/floor wash가 clean white wall 위에서도 식별 가능한 최소 강도 source marker를 유지하는지 확인한다.

Updated:
- furnished starter QA는 floor/surface object density뿐 아니라 벽면 vertical decor density와 warm/cool color contrast까지 포함한다.
- 해당 QA는 저장 payload, cluster URL 상태, fixture/dynamic emitter 예산이 변하지 않는다는 전제를 같이 확인한다.

Removed/Deprecated:
- 벽면이 대부분 빈 white shell이어도 가구/상판 소품만 많으면 compact diorama로 볼 수 있다는 기준.

## 2026-05-16 변경 동기화 (Builder Preview Presentation Camera QA)
Added:
- builder style step에서 `workspace-flex` furnished preview를 열었을 때 카메라가 방 바깥 대각선의 낮은 orthographic pose로 벽면, 가구 높이, desk/media/shelf surface detail을 함께 보여주는지 확인한다.
- `verify:builder-performance`는 builder preview camera가 `OrthographicCamera + CameraPoseSync + compact zoom + lower presentation angle` 계약을 유지하는지 확인한다.

Updated:
- furnished starter QA는 object density뿐 아니라 기본 카메라가 top-down floor plan처럼 소품을 작게 만들지 않는지까지 포함한다.

Removed/Deprecated:
- builder preview가 높은 overhead camera로 전체 floor를 넓게 보여주면 충분하다는 QA 기준.

## 2026-05-16 변경 동기화 (Builder Preview Mood Lighting QA)
Added:
- builder style step에서 direct lighting preview를 열었을 때 warm floor/wall bleed와 cool wall/floor bleed가 clean white wall/floor 위에서도 보이고, scene 저장 payload나 fixture count가 늘지 않는지 확인한다.
- `verify:lighting-layout`는 `builder-preview-mood-wash`가 builder preview에만 붙고 normal-blend tint 방식이며 dynamic emitter를 추가하지 않는지 확인한다.

Updated:
- lighting QA는 fixture/beam 존재 확인에서 builder-preview global light scale이 flat ambient를 낮추고 warm key/cool fill 대비를 유지하는지 확인하는 기준까지 확장한다.

Removed/Deprecated:
- warm/cool accent wash가 밝은 벽/바닥에서 거의 보이지 않아도 조명 QA를 통과시키는 기준.

## 2026-05-16 변경 동기화 (Builder Preview Visual Smoke QA)
Added:
- `npm --workspace apps/web run verify:builder-preview-diorama`로 style step, media-lounge preset 전환, lighting step의 builder preview canvas가 실제 브라우저에서 nonblank compact diorama로 렌더되는지 확인한다.
- QA 산출물 `output/playwright/builder-preview-diorama-smoke.png`를 확인해 black screen, empty shell, flat floor-plan framing, warm/cool mood wash 누락이 없는지 본다.

Updated:
- builder preview QA는 source verifier와 manual checklist뿐 아니라 canvas size, luminance contrast, color diversity, warm/cool pixel ratio를 자동 evidence로 기록해야 한다.
- Next dev server가 RSC payload fetch 실패 후 browser navigation fallback으로 정상 복구하는 known console noise와 의도적 route 전환 중 `ERR_ABORTED` 된 in-flight resource request는 visual smoke 실패로 보지 않지만, 실제 page error/non-aborted request failure/canvas metric failure는 실패로 본다.

Removed/Deprecated:
- `verify:builder-performance`와 `verify:lighting-layout`만 통과하면 실제 preview 첫 프레임을 확인하지 않아도 되는 QA 기준.

## 2026-05-16 변경 동기화 (Editor Replacement Zone Actions QA)
Added:
- editor inspector에서 선택 자산의 replacement 영역에 `존 커스터마이징` action rows가 보이고, 각 row가 후보 수와 대표 후보를 보여주는지 확인한다.
- 워크존/미디어존/라운지/디스플레이 row를 클릭하면 replacement grid가 해당 room zone 후보만 보여주고, 같은 존/전체 토글과 충돌하지 않는지 확인한다.
- `verify:replacement-candidates` 실행 시 zone summary count coverage, selected-zone first ordering, zone action QA id가 통과하는지 확인한다.

Updated:
- replacement QA는 단일 카드 교체뿐 아니라 사용자가 현재 방의 zone 맥락으로 후보를 좁혀 꾸미는 흐름까지 포함한다.

Removed/Deprecated:
- 전체 후보 목록을 사용자가 훑어 zone별 후보 분포를 직접 추론해야 하는 QA 기준.

## 2026-05-16 변경 동기화 (Editor Zone Quick Apply QA)
Added:
- editor inspector의 `존 커스터마이징` row에서 `적용` 버튼을 누르면 해당 zone의 대표 후보가 선택 제품에 즉시 적용되는지 확인한다.
- quick apply 후 선택 제품 id, 위치/회전/scale, support anchor 재클램프, undo snapshot 의미가 기존 replacement card 교체와 동일하게 유지되는지 확인한다.
- `verify:replacement-candidates` 실행 시 zone summary의 대표 후보 id/label 정합성과 `asset-replacement-zone-apply-*` QA id가 통과하는지 확인한다.

Updated:
- replacement QA는 zone별 후보 필터링뿐 아니라 zone row에서 바로 다른 room-zone 스타일을 적용하는 one-click customization 흐름까지 포함한다.

Removed/Deprecated:
- zone row가 후보 grid만 좁히고 실제 교체는 사용자가 별도 card를 찾아야 하는 QA 기준.

## 2026-05-16 변경 동기화 (Editor Placed Zone Overview QA)
Added:
- editor inspector의 `공간 요약`에서 `배치 존` overview가 현재 배치된 workstation/media/lounge/display/flex 구성을 count와 대표 제품 label로 보여주는지 확인한다.
- overview row를 클릭하면 해당 zone의 대표 제품이 선택되고, 선택 항목/replacement 영역이 그 제품 기준으로 갱신되는지 확인한다.
- `verify:replacement-candidates` 실행 시 placed zone summary count coverage, selected-zone first ordering, `placed-zone-summary-*` QA id, 기존 `setSelectedAssetId` 연결이 통과하는지 확인한다.

Updated:
- editor QA는 선택 제품 내부의 교체 흐름뿐 아니라 방 전체 zone 구성을 inspector에서 파악하고 바로 zone별 꾸미기를 시작하는 navigation 흐름까지 포함한다.

Removed/Deprecated:
- 사용자가 canvas에서 제품을 직접 찾아 선택해야만 room-zone별 꾸미기 작업을 시작할 수 있다는 QA 기준.

## 2026-05-16 변경 동기화 (Editor Placed Zone Batch Replace QA)
Added:
- editor inspector의 `배치 존` row에서 `교체` action을 누르면 해당 zone의 제품들이 각 제품별 추천 후보로 일괄 교체되는지 확인한다.
- batch replace 후 각 제품의 scene asset id, 위치/회전/scale, material override, support anchor 재클램프 의미가 기존 단일 replacement와 동일하게 유지되는지 확인한다.
- support surface를 제공하는 부모 가구는 하위 surface anchor가 같은 부모에 재고정되는 후보일 때만 자동 batch에 포함되는지 확인한다.
- `verify:replacement-candidates` 실행 시 placed zone `replaceableCount`, `placed-zone-apply-*` QA id, support-carrier cascade preflight, batch action의 기존 replacement update path 재사용, 단일 undo snapshot 계약이 통과하는지 확인한다.

Updated:
- editor QA는 zone overview에서 대표 제품을 선택하는 흐름뿐 아니라 support-carrier 부모 가구까지 안전하게 포함해 zone 분위기를 한 번에 바꿔 보는 one-click batch customization 흐름까지 포함한다.

Removed/Deprecated:
- 사용자가 zone 안의 제품을 반복 선택/교체해야만 구역 단위 스타일 변화를 확인할 수 있다는 QA 기준.
- support surface 부모 가구는 항상 batch에서 제외되어야 한다는 QA 기준.

## 2026-05-16 변경 동기화 (Editor Placed Zone Replacement Preview QA)
Added:
- editor inspector의 `배치 존` row가 `교체` action 옆에서 대표 replacement 후보 label, 추천 match percent, compact isometric preview를 보여주는지 확인한다.
- support-carrier 대표 replacement row는 하위 surface anchor 유지 개수를 함께 보여주는지 확인한다.
- replacement card fallback이 실제 asset과 맞지 않는 thumbnail 대신 `asset-replacement-isometric-preview-*` mini diorama proxy와 fit label을 보여주는지 확인한다.
- 실제 `/assets/models/*.(glb|gltf)` 후보에 전용 thumbnail이 없을 때 replacement card가 `asset-replacement-live-preview-*` live model overlay를 보여주고, 실패 시 isometric proxy가 남는지 확인한다.
- `배치 존` compact isometric preview가 대표 replacement 후보의 normalized `previewScale`을 사용해 keyboard/decor와 desk/sofa의 visual scale 차이를 잃지 않는지 확인한다.
- `verify:replacement-candidates` 실행 시 `placed-zone-replacement-preview-*`, `placed-zone-replacement-silhouette-*`, `placed-zone-replacement-isometric-*`, `placed-zone-support-cascade-*`, `asset-replacement-isometric-preview-*`, `asset-replacement-live-preview-*` QA id, representative match score 노출, `topReplacementPreviewScale` data wiring이 통과하는지 확인한다.
- `verify:inventory-thumbnails` 실행 시 shared placeholder thumbnail이 item-specific render처럼 보이지 않는지 확인한다.

Updated:
- editor QA는 zone batch replace가 동작하는지만 보지 않고, 사용자가 실행 전 대표 교체 대상, 추천도, mini isometric visual scale을 읽고 결과를 예측할 수 있는지도 포함한다.
- replacement visual QA는 전용 thumbnail, live GLB overlay, isometric proxy의 우선순위가 지켜지는지까지 포함한다.
- placed-zone visual QA는 proxy 존재 여부뿐 아니라 대표 후보 치수 metadata가 row preview까지 유지되는지 확인한다.

Removed/Deprecated:
- batch replace의 결과 후보가 tooltip 또는 내부 상태에만 있고 row에서 label/score/isometric proxy로 보이지 않아도 충분하다는 QA 기준.
- placed-zone compact preview가 후보 치수와 무관한 고정 scale fallback만 사용해도 충분하다는 QA 기준.
- 공유 thumbnail이 실제 후보와 맞지 않아도 replacement card/library shelf에서 그대로 노출해도 된다는 QA 기준.

## 2026-05-16 변경 동기화 (Editor Room Mood Recipe QA)
Added:
- editor inspector에서 `무드 레시피` 섹션이 보이고, Clean Gallery / Warm Studio / Soft Lounge / Walnut Media 버튼이 각각 wall/floor/ceiling swatch와 함께 노출되는지 확인한다.
- recipe를 누르면 wall/floor/ceiling finish와 lighting preset이 한 번에 바뀌고, undo history가 단일 `무드 레시피 적용` snapshot으로 남는지 확인한다.
- `verify:lighting-layout` 실행 시 recipe UI, combined handler, 기존 material/lighting setter 재사용 계약이 통과하는지 확인한다.
- `verify:material-presets` 실행 시 recipe preset id와 swatch가 실제 room shell texture preset으로 해석되는지 확인한다.

Updated:
- editor 커스터마이징 QA는 개별 마감/조명 slider 조작뿐 아니라 사용자가 방 분위기를 빠르게 바꿔 보고 세부 조정으로 들어가는 recipe flow까지 포함한다.

Removed/Deprecated:
- 고품질 room mood QA를 개별 wall/floor/ceiling/light control 조작만으로 확인하고 bundled mood action은 생략해도 된다는 기준.

## 2026-05-16 변경 동기화 (Builder Room Mood Recipe QA)
Added:
- builder style step에서 `무드 레시피` 섹션이 보이고, Clean Gallery / Warm Studio / Soft Lounge / Walnut Media 버튼이 각각 material swatch와 함께 노출되는지 확인한다.
- recipe를 누르면 wall/floor finish와 lighting preset mood가 builder preview에 한 번에 반영되고, URL `mood`와 auth draft 복원 후에도 같은 recipe가 유지되는지 확인한다.
- `verify:lighting-layout` 실행 시 builder recipe UI, combined handler, existing material/lighting state 재사용, URL/auth restore 계약이 통과하는지 확인한다.
- `verify:material-presets` 실행 시 builder recipe swatch가 editor와 같은 room mood recipe source에서 파생되는지 확인한다.

Updated:
- builder 커스터마이징 QA는 개별 wall/floor swatch와 lighting step 조작뿐 아니라 프로젝트 생성 전 bundled mood action으로 전체 분위기를 빠르게 잡는 flow까지 포함한다.

Removed/Deprecated:
- 고품질 room mood QA를 editor 진입 이후에만 확인하고 builder preview 단계의 bundled mood action은 생략해도 된다는 기준.

## 2026-04-20 변경 동기화 (Room Mode Direct-Drag Instancing QA)
Added:
- room mode top-view에서 repeated asset cluster를 눌렀을 때 direct drag가 끊기지 않고, drag 종료 후 선택 자산만 개별 오브젝트로 전환되는지 확인하는 QA 항목을 추가했다.

Updated:
- instancing QA 기준을 `desk precision` 중심에서 `desk precision + room mode idle/direct-drag handoff`까지 확장했다.

Removed/Deprecated:
- editor room top은 repeated asset instancing 대상이 아니라는 QA 가정.

## 2026-04-20 변경 동기화 (Showcase Activity Ranking QA)
Added:
- `verify:showcase-activity`로 derived activity score / estimated engagement / ranking order를 회귀 검증하는 QA 항목을 추가했다.

Updated:
- community QA 기준을 “카드가 보이는지”에서 “featured/conversation ordering이 derived activity baseline을 따르고 showcase presentation 링크를 유지하는지”까지 확장했다.

Removed/Deprecated:
- community 활동 지표를 페이지 내부 ad-hoc 숫자로만 판단하던 QA 방식.

## 2026-04-20 변경 동기화 (Showcase Activity Persisted Events QA)
Added:
- shared viewer를 연 뒤 `view` 이벤트가 session 기준으로 1회만 쌓이고, 제품 핫스팟 선택 시 `product_focus`가 asset/session 기준으로 dedupe 되는지 확인하는 QA 항목을 추가한다.

Updated:
- community QA 기준을 “derived ranking이 맞는지”에서 “persisted `포커스/조회` count가 ranking/card 지표에 반영되는지”까지 확장한다.

Removed/Deprecated:
- persisted activity 경로 없이 `verify:showcase-activity` 한 항목만으로 P3를 닫는 QA 기준.

실행 명령:

```bash
npm --workspace apps/web run qa:primary
npm --workspace apps/web run verify:scene-document
npm --workspace apps/web run verify:public-scene
npm --workspace apps/web run verify:showcase-scene
npm --workspace apps/web run asset:publish
npm --workspace apps/web run verify:asset-compiler
npm --workspace apps/web run verify:commercial-qa
npm --workspace apps/web run verify:interaction-engine
E2E_ROOM_FLOW_STRICT=1 npm --workspace apps/web run primary:e2e:room-flow:strict
npm --workspace apps/web run primary:e2e:room-flow:full
```

`primary:e2e:room-flow:full`은 Supabase 환경 변수가 없는 환경에서는 실행되지 않습니다.

성능 계측 팁:
- dev에서는 브라우저 콘솔에서 바로 `deskterioronline:renderer-stats`, `deskterioronline:interaction-latency` 이벤트를 구독하면 된다.
- production build 측정 시에는 URL에 `?telemetry=1`을 붙이거나 콘솔에서 `window.__DESKTERIORONLINE_TELEMETRY__ = true`를 설정한 뒤 새로고침한다.
- telemetry를 켜면 `SceneViewport` 우하단에 live performance budget HUD가 떠 draw call / FPS floor / heap growth / interaction latency / BVH sync fallback 경고를 바로 확인할 수 있어야 한다.
- 최신 샘플은 `window.__DESKTERIORONLINE_LAST_RENDERER_STATS__`, `window.__DESKTERIORONLINE_LAST_INTERACTION_LATENCY__`에서도 확인할 수 있다.
- regression report는 `window.__DESKTERIORONLINE_TELEMETRY_CAPTURE__.start(...)`로 측정을 시작하고 `stop(...)`으로 JSON entry를 얻는다.
- 측정이 끝나면 `npm --workspace apps/web run perf:report:verify -- --report=/absolute/path/to/perf-report.json`으로 예산과 coverage를 검증한다.
- threshold drift smoke는 `npm --workspace apps/web run verify:performance-budget`로 빠르게 확인한다.
- repo 기본 perf CI gate는 `npm --workspace apps/web run qa:primary:perf`이고, 여기에는 budget/instancing/LOD/baseline smoke가 같이 들어간다.
- `npm --workspace apps/web run primary:e2e:room-flow:strict`는 `E2E_ROOM_FLOW_BASE_URL`이 없고 기본 로컬 주소(`http://127.0.0.1:3100`)가 비어 있으면 stale `.next`를 정리한 뒤 production build/server를 자체 부트스트랩해서 route shell contract를 점검한다.
- editor undo/redo 기본 단축키는 `Cmd/Ctrl+Z`, `Shift+Cmd/Ctrl+Z`, `Ctrl+Y`다.
- baseline 비교가 필요하면 `--baseline=/absolute/path/to/previous-report.json`을 같이 준다.

## 3) 배포 전 체크리스트

- 빌더/에디터/뷰어 공통 레이아웃이 유지되는지 확인
- 에디터 상단 bar, 좌측 rail, 우측 zoom rail, 하단 pill toolbar가 레퍼런스 7번 shell로 노출되는지 확인
- 룸 상단뷰에서는 `추가/설정`, asset drawer, direct drag, transform gizmo가 모두 숨겨지고 확인 전용 orbit/zoom만 남는지 확인
- 데스크 정밀 상단뷰에서는 선택 제품의 transform gizmo, 5mm/1deg snap, arrow nudge, Q/E rotate, surface lock micro-view가 노출되는지 확인
- 워크뷰에서 crosshair가 pointer-lock 상태와 compatible surface 상태를 표시하고, `I` 키로 인벤토리를 열고 제품 선택 후 화면 중앙의 compatible surface를 클릭 또는 `E`로 focus placement에 진입하는지 확인
- builder opening preview에서 문/창문이 실제 opening asset처럼 서 있고, style 선택 전에는 white wall/white floor shell이 유지되는지 확인
- builder opening preview에서 문/창문이 floor에 눕지 않고 wall plane에 수직으로 붙는지 확인
- builder style 선택지에 room shape 8종, wall finish 7종, floor finish 9종 이상이 노출되는지 확인
- builder style 선택 버튼이 단색 swatch가 아니라 실제 wall/floor texture thumbnail로 보이는지 확인
- room mode와 desk precision mode 전환 시 체감 화질과 idle 비용이 달라지고, 워크뷰 품질에는 영향을 주지 않는지 확인
- editor 상단뷰가 orthographic footprint처럼만 보이지 않고, builder와 비슷한 perspective orbit 품질로 열리는지 확인
- walk view에서 카메라를 돌렸을 때 벽 backface/near clip 때문에 검정 화면이 나오지 않는지 확인
- editor 상단뷰에서 orbit 회전 중 전체 viewport가 검게 깜빡이지 않는지 확인
- 상단뷰와 워크뷰 모두 room shell texture decode가 실패해도 black plane 대신 fallback shell color로 계속 보이는지 확인
- desk precision / builder preview / showcase 계열은 Neutral tone mapping, room mode / shared viewer / 기본 walk viewer는 ACES tone mapping을 사용해도 surface/material 읽기 흐름이 어색해지지 않는지 확인
- editor walk와 richer showcase 경로에서만 selective SSR이 반사 하이라이트를 보강하고, shared viewer / top-view / builder preview에는 비용이 전파되지 않는지 확인
- room mode, desk precision mode, builder preview는 조작을 멈췄을 때 continuous redraw 없이 idle이 안정화되는지 확인
- editor `desk precision` top-view에서는 반복 자산이 instanced cluster로 합쳐져도 단일 클릭 선택 후 gizmo 편집이 계속 가능하고, room mode direct drag는 계속 개별 오브젝트로 동작하는지 확인
- desk precision mode에서 선택 자산의 inspector와 measurement overlay가 동일한 X/Z/Y(mm), Yaw(deg), 실측 W/D/H(mm) 기준으로 동기화되는지 확인
- desk precision mode에서 surface anchor 제품의 inspector와 overlay가 동일한 support asset / support surface / surface size / margin / top 높이 기준으로 동기화되는지 확인
- desk precision mode에서 surface anchor 제품의 inspector와 overlay micro-view가 동일한 support-local marker / offset 위치를 가리키는지 확인
- desk precision mode에서 surface anchor 제품의 inspector와 overlay가 footprint / projected footprint / edge clearance / relative yaw 기준까지 동기화되는지 확인
- 필요 시 브라우저 콘솔에서 `deskterioronline:renderer-stats` / `deskterioronline:interaction-latency` 이벤트를 구독해 draw call, texture, hover/select/drag-start 지연을 같이 기록하는지 확인
- 필요 시 `window.__DESKTERIORONLINE_TELEMETRY_CAPTURE__`로 builder/editor/shared viewer 측정 세션을 각각 묶고 `perf:report:verify`로 JSON report를 검증하는지 확인
- loaded GLB 자산이 많은 장면에서 hover/select 시작 지연이 BVH 적용 후에도 50ms 예산 안에 들어오는지 확인
- large geometry가 있는 장면에서 브라우저 콘솔의 `deskterioronline:bvh-build` 이벤트가 `mode: "worker"`로 기록되고, small/interleaved geometry는 필요 시 `mode: "sync"`로 fallback 되는지 확인
- `npm --workspace apps/web run assets:sync:ktx2-transcoder -- --check`가 basis transcoder public 파일을 PASS로 검증하는지 확인
- `npm --workspace apps/web run verify:scene-document`가 placement/support/product metadata roundtrip 검증을 통과하는지 확인
- `npm --workspace apps/web run verify:public-scene`가 shared viewer payload에서 placement/support/product metadata roundtrip 검증을 통과하는지 확인
- `npm --workspace apps/web run verify:showcase-scene`가 gallery/community 카드 projection과 shared viewer public payload의 version/preview asset summary 정합성 검증을 통과하는지 확인
- `npm --workspace apps/web run asset:publish`가 `runtime-packages.json`, `runtime-packages/*.json`, `*.colliders.json`, `*.support-surfaces.json`, `*.attachment-points.json`, `*.material-variants.json`, `*.qa-report.json`을 생성하는지 확인
- `npm --workspace apps/web run verify:asset-compiler`가 alpha runtime package index, descriptor, sidecar 정합성을 통과하는지 확인
- `npm --workspace apps/web run verify:commercial-qa`가 SKU reference/material QA, placement regression, compatibility, scene integrity gate를 모두 읽는지 확인
- `npm --workspace apps/web run asset:ingest -- --source <source-path>`가 `assets/ingest-staging/<assetKey>/source.asset.json` draft를 생성하는지 확인
- `npm --workspace apps/web run asset:analyze-url -- --url <product-url> --asset-key <assetKey> --dimensions-mm <WxDxH>`가 prototype-only `assets/references/product-pages/<assetKey>/reference-pack.json`을 생성하는지 확인
- `npm --workspace apps/web run verify:product-url-reference`가 URL-derived SKU/manufacturer/options/reference image/material hint/legal boundary를 fixture 기준으로 통과하는지 확인
- `npm --workspace apps/web run asset:factory -- --reference-pack assets/references/product-pages/<assetKey>/reference-pack.json`가 private/prototype `asset-plan.json`, `factory-qa-report.json`, `repair-instructions.json`, `private-catalog-entry.json`, Blender scaffold를 생성하는지 확인
- `npm --workspace apps/web run verify:product-asset-factory`가 FURSYS fixture의 runtime GLB/proxy/thumbnail/sidecar, private-only visibility, `releaseEligible=false`, material/visual repair loop를 통과하는지 확인
- `npm --workspace apps/web run verify:video-scene-reference`가 So Ong private reference pack의 28개 제품, product URL 보존, Blender-rendered thumbnail, preview render, hero visual signature report를 통과하는지 확인
- `assets/references/video-scenes/so-ong-space-2026-05-desk-setup/so-ong-space-reference-preview.png`를 열어 ultrawide monitor, HYTE glass PC, Epic 5 speakers, AM HATSU keyboard, SYNCHRONIZE mat, Stream Deck Neo, Times Gate, planter가 한 프레임에서 reference still처럼 읽히는지 확인
- shared viewer가 generic showcase viewer와 다른 경량 preset으로 동작해도 제품 hotspot / drawer 읽기 흐름은 유지되는지 확인
- shared viewer walk HUD는 터치 조작용 요소만 남고 crosshair는 보이지 않는지 확인
- shared viewer가 상단 light bar, 우측 zoom rail, 하단 readonly status pill 기준으로 노출되는지 확인
- shared viewer는 lean light rig(no fill light)를 유지하고, constrained 환경에서는 directional shadow/contact shadow/bloom이 제거되는지 확인. builder preview는 별도 diorama profile로 bounded dynamic shadow + warm-tinted contact shadow를 유지하되 SSR/bloom/post FX가 꺼져 있는지 확인
- realtime/presence 평가는 `/labs/realtime` hidden route에서만 노출되고, 홈/에디터/뷰어/갤러리/커뮤니티에는 진입 링크가 생기지 않는지 확인
- `verify:realtime-lab` 실행 시 room id 정규화, channel name, stale participant snapshot, cursor/view/selection presence, presenter/spotlight/ping, stale archive health, exit gate 규칙이 통과하는지 확인
- `/labs/realtime?room=...`에서 같은 room id를 두 창으로 열면 occupancy snapshot이 증가하고, heartbeat가 15초 간격으로 갱신되는지 확인
- 한 창을 닫거나 heartbeat가 45초 이상 끊긴 참가자는 stale로 표시되는지 확인
- stale 참가자가 archive 임계치를 넘기면 occupancy visible count에서 빠지고 archived count가 증가하는지 확인
- 같은 room에서 presence surface 위로 포인터를 움직이면 다른 창에서 cursor marker가 보이는지 확인
- 한 창에서 room/desk/walk와 sample asset selection을 바꾸면 다른 창 badge와 occupancy snapshot에 같은 값이 반영되는지 확인
- 한 창에서 presenter를 claim하면 다른 창에서 presenter label과 spotlight 상태가 갱신되는지 확인
- 다른 창에서 follow presenter를 켜면 presenter의 mode/selection/spotlight가 로컬 badge에 반영되는지 확인
- attention ping을 보내면 다른 창에서 마지막 ping snapshot이 보이는지 확인
- sample draft board에서 자산을 잡고 드래그하면 다른 창 보드의 자산 위치가 같이 이동하는지 확인
- 이미 다른 창이 잡고 있는 자산을 다시 잡으려 하면 conflict banner가 노출되는지 확인
- 드래그를 놓으면 lock이 해제되고, occupancy/draft board에서 owner 표시가 사라지는지 확인
- runtime pause를 누르면 presence/broadcast가 멈추고, resume 후 같은 room에 다시 reconnect되는지 확인
- retry connection을 누르면 reconnect count가 증가하고 room channel이 다시 subscribe되는지 확인
- exit gate 카드가 모두 `ready` 상태로 보이고, hidden local-only lab이라는 전제가 유지되는지 확인
- 뷰어에 편집 affordance가 노출되지 않는지 확인
- 갤러리/커뮤니티 카드가 `/shared/[token]` 읽기 전용 뷰어로 이동하는지 확인
- 갤러리/커뮤니티 피드가 레퍼런스 8번 기준의 4열 카드 밀도와 상단 filter rail을 유지하는지 확인
- 갤러리 필터 결과 수, 커뮤니티 latest/featured/top collection summary가 페이지네이션 이후에도 같은 filter scope 기준으로 유지되는지 확인
- 커뮤니티가 갤러리와 달리 토론/챌린지/최신 게시물로 구분된 허브 구조를 가지는지 확인
- `/studio`가 개인 프로젝트 아카이브 톤으로 정리되고 필터/검색이 동작하는지 확인
- 제품 클릭 시 정보 drawer가 열리고 최소 필드가 노출되는지 확인
  - 제품명
  - 카테고리

## 2026-05-02 변경 동기화 (Interaction Engine QA)
Added:
- `verify:interaction-engine` 실행 명령과 QA 체크리스트 항목을 추가했다.
- preview 중 document patch 0건, commit 중 placement patch intent 1건을 배포 전 확인 기준으로 추가했다.

Updated:
- focus placement QA 기준을 HUD/스냅 확인에서 interaction state machine invariant 확인까지 확장한다.

Removed/Deprecated:
- placement preview 안정성을 수동 브라우저 조작 결과만으로 판단하는 방식.

## 2026-05-01 변경 동기화 (Commercial QA Operation)
Added:
- 상용 QA 체크리스트에 actual SKU hero catalog gate, wall/floor texture library gate, 5mm/1deg + 1mm/0.1deg focus placement 검증을 추가했다.
- `asset:publish`, `verify:asset-compiler`, `verify:commercial-qa`를 기본 실행 명령에 추가했다.

Updated:
- asset publish 확인 범위를 sidecar 생성 여부에서 SKU/reference/material QA metadata 발행 여부까지 확장한다.

Removed/Deprecated:
- `/labs/qa`가 단순 runtime package inventory만 보여주면 충분하다는 QA 가정.
  - 브랜드
  - 가격
  - 옵션/규격
  - 실제 규격(W/D/H mm)
  - 마감 색상/재질
  - 디테일 노트
  - 원본 상품 링크

## 2-1) Runtime Foundation Smoke Commands

```bash
npm --workspace apps/web run benchmarks:collect:baseline
npm --workspace apps/web run verify:runtime-engine
npm --workspace apps/web run verify:runtime-engine-document-sync
npm --workspace apps/web run verify:runtime-editor-bridge
npm --workspace apps/web run verify:runtime-render-sync
npm --workspace apps/web run verify:runtime-renderer-adapter
npm --workspace apps/web run verify:placement-kernel
```

확인 포인트:
- benchmark baseline 템플릿이 `benchmark-scenes/*` 4개 시나리오를 모두 수집하는지
- runtime preview가 source `SceneDocument`를 직접 mutate 하지 않는지
- same-room object add/remove/material 변경이 full runtime scene replace 없이 incremental sync로 반영되는지
- same-object asset 교체가 renderer batch/handle에 반영되고, removed object selection/hover가 정리되는지
- hidden object가 sceneDocument roundtrip, runtime sync, renderer visibility handle, furniture render path에서 일관되게 제외되는지

## 2026-04-23 변경 동기화 (Placement Kernel Alpha QA Slice)
Added:
- `verify:placement-kernel`에서 same-surface sibling overlap, no-place zone overlap, unsupported attachment type이 각각 collision/constraint error로 막히는지 확인하는 기준을 추가했다.

Updated:
- placement kernel smoke의 기대치를 “surface_local patch 생성”에서 “invalid placement guard + patch 생성”까지 확장한다.

Removed/Deprecated:
- placement kernel smoke가 happy-path 한 케이스만 통과해도 충분하다는 가정.

## 2026-04-23 변경 동기화 (Placement Kernel Alpha QA Complete)
Added:
- `verify:placement-kernel` 실행 시 snap quantization, hit-driven mounted surface auto-resolve, attachment point compatibility, invalid candidate commit 차단까지 통과하는지 확인한다.
- `verify:focus-placement` 실행 시 Enter 전 `runtime-document-patch`가 0건인지, snapped HUD/session pose가 commit 결과와 같은지, Esc/cancel이 preview를 정리하는지 확인한다.

Updated:
- placement/focus QA 범위를 “prototype commit happy path”에서 “invalid guard + snap consistency + mounted auto-resolve”까지 확장한다.

Removed/Deprecated:
- focus placement preview는 commit 전 patch가 발생해도 허용된다는 가정.

## 3-1) DB 레거시 정리 적용 체크리스트

대상 마이그레이션:
- `20260414123000_remove_legacy_floorplan_intake.sql`
- `20260414130000_remove_project_versions_floor_plan.sql`

실행 순서:
1. restore point 시각과 `SUPABASE_DB_URL`을 준비한다.
2. worker를 멈추고, 에디터 `저장/발행`을 maintenance window로 잠깐 묶는다.
3. `psql "$SUPABASE_DB_URL" -f supabase/checks/legacy_cleanup_preflight.sql`
4. 필요하면 아래 백업을 만든다.
5. `psql "$SUPABASE_DB_URL" -f supabase/migrations/20260414123000_remove_legacy_floorplan_intake.sql`
6. `psql "$SUPABASE_DB_URL" -f supabase/migrations/20260414130000_remove_project_versions_floor_plan.sql`
7. `psql "$SUPABASE_DB_URL" -f supabase/checks/legacy_cleanup_postcheck.sql`
8. project save 1회, asset-generation job 1회 smoke check 후 worker와 저장/발행을 재개한다.

빠른 영향도 확인 SQL:
```sql
do $$
declare
  v_count bigint;
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'jobs'
      and column_name = 'floorplan_id'
  ) then
    execute 'select count(*) from public.jobs where floorplan_id is not null' into v_count;
    raise notice '[impact] jobs.floorplan_id rows = %', v_count;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'project_versions'
      and column_name = 'floor_plan'
  ) then
    execute 'select count(*) from public.project_versions where floor_plan is not null and floor_plan <> ''{}''::jsonb' into v_count;
    raise notice '[impact] project_versions.floor_plan rows = %', v_count;
  end if;
end
$$;
```

선택 백업:
```sql
create table if not exists public.backup_project_versions_floor_plan_20260414 as
select id, project_id, version, floor_plan, now() as backed_up_at
from public.project_versions
where floor_plan is not null and floor_plan <> '{}'::jsonb;
```

실패 대응:
- step 3 이전에 문제면 중단하고 창을 다시 잡는다.
- step 5가 부분 적용되면 traffic은 열지 말고, 같은 migration file 재실행 또는 PITR 둘 중 하나만 선택한다.
- step 6이 부분 적용되면 save/publish를 계속 막은 채 migration 재실행 후 smoke check를 다시 한다.
- drop된 테이블/컬럼의 일반적인 롤백 수단은 PITR이며, optional backup table은 `floor_plan` 데이터 확인용 보조 수단이다.
- PITR 복구 시 Web/API/Worker 배포 버전도 같은 시점으로 맞춘다.

## 4) 데스크테리어 자산 운영 (Blender + 오픈소스)

1. Blender에서 `.blend` 소스를 수정/제작한다.
2. 먼저 preflight로 source/runtime 상태를 확인한다.

```bash
npm --workspace apps/web run assets:export:deskterior -- --report
```

3. Blender headless export를 실행한다.

```bash
npm --workspace apps/web run assets:export:deskterior
```

`blender` 실행 파일이 PATH에 없으면 아래처럼 명시한다.

```bash
BLENDER_BIN="/Applications/Blender.app/Contents/MacOS/Blender" \
  npm --workspace apps/web run assets:export:deskterior
```

4. 카탈로그를 동기화한다.

```bash
npm --workspace apps/web run assets:sync:deskterior
```

5. KTX2 basis transcoder public 파일을 동기화한다.

```bash
npm --workspace apps/web run assets:sync:ktx2-transcoder
```

6. 필요 시 room shell texture set의 `.ktx2` 산출물 유무를 확인하거나 인코딩한다.

```bash
PATH="/Users/sol/.nvm/versions/node/v20.11.1/bin:$PATH" npm --workspace apps/web run textures:check:room-shell:ktx2
# encoder(ktx 또는 toktx)가 설치된 환경에서만:
PATH="/Users/sol/.nvm/versions/node/v20.11.1/bin:$PATH" npm --workspace apps/web run textures:encode:room-shell:ktx2
```

7. glTF Transform 기반 `dedup + prune + meshopt(내부 reorder/quantize 포함)` 최적화와 budget re-check를 수행한다.

```bash
npm --workspace apps/web run assets:optimize:deskterior
```

강제 재적용이 필요하면:

```bash
npm --workspace apps/web run assets:optimize:deskterior -- --force --level high
```

native gltfpack binary가 있으면 먼저 probe한 뒤 optional pass를 붙일 수 있다.

```bash
npm --workspace apps/web run assets:setup:gltfpack
npm --workspace apps/web run assets:probe:gltfpack
npm --workspace apps/web run assets:optimize:deskterior:native -- --gltfpack-bin /absolute/path/to/gltfpack
# 또는 기존 체인 뒤에 바로 연결
npm --workspace apps/web run assets:optimize:deskterior -- --native-gltfpack --gltfpack-bin /absolute/path/to/gltfpack
```

7. Khronos glTF Validator로 런타임 GLB를 검증한다.

```bash
npm --workspace apps/web run assets:validate:deskterior
```

8. 파이프라인 정합성(source/runtime/manifest)을 검증한다.

```bash
npm --workspace apps/web run assets:verify:deskterior
```

9. 에디터에서 자산 배치 후 저장/발행하고 shared viewer에서 제품 정보를 검증한다.
  - 실측 고정(`scaleLocked=true`) 제품은 Inspector의 `크기 비율` 입력이 비활성화되는지 확인
  - shared viewer 제품 카드에서 W/D/H, 마감 색상/재질, 디테일 노트가 보이는지 확인
  - 데스크/선반 계열 support 배치 시 실측 기반으로 상면(top) 클램핑이 자연스럽게 유지되는지 확인
  - floor/surface 배치 시 벽 관통 없이 wall clearance가 적용되고, 인접 자산과 과도한 중첩이 완화되는지 확인
  - room mode에서는 제품 본체 direct drag만, desk precision mode에서는 gizmo와 `월드/로컬` 토글만 동작하는지 확인
  - desk precision mode에서 inspector와 measurement overlay가 선택 자산의 X/Z/Y(mm), Yaw(deg), 실측 W/D/H(mm)를 같은 값으로 유지하는지 확인
  - desk precision mode에서 surface anchor 제품의 inspector와 overlay가 support asset / support surface / surface size / margin / top 높이를 같은 값으로 유지하는지 확인
  - desk precision mode에서 surface anchor 제품의 inspector와 overlay micro-view marker가 같은 support-local 위치를 가리키고 offset 수치와 일치하는지 확인
  - gizmo 드래그 중 방 외곽으로 나가려 하면 live clamp가 걸리고, mouse-up 후 위치가 다시 튀지 않는지 확인
  - 상단뷰 room shell이 floor footprint를 감싸는 닫힌 strip 형태로 읽히는지 확인
  - finishColor/finishMaterial이 있는 제품은 GLB 표면 톤/질감이 기존 대비 반영되는지 확인
  - `DeskWood`/`DeskMetal`/`StandWood`/`StandPad`/`LampBody`/`LampAccent`/`LampBulb` 슬롯이 의도한 재질 특성으로 분리 반영되는지 확인
9. 조명 제품은 뷰어에서 실제 광원 효과가 보이는지 확인한다.

실패 대응:
- `assets:export:deskterior` 실패 시 `--report`로 누락/stale 원인을 먼저 확인한다.
- `assets:optimize:deskterior`가 실패하면 draw call, triangle, runtime size budget 초과 asset부터 확인한다.
- native gltfpack pass가 필요하면 먼저 `assets:probe:gltfpack`로 binary 경로를 확인하고, 없으면 `GLTFPACK_BIN` 또는 `--gltfpack-bin`으로 절대 경로를 준다.
- repo-local 환경을 만들 때는 `assets:setup:gltfpack`로 `.tools/gltfpack/current/gltfpack`를 먼저 준비한다.
- `assets:validate:deskterior`가 실패하면 해당 GLB의 구조 오류, 경고, draw call 수치를 먼저 확인한다.
- `assets:verify:deskterior`가 실패하면 manifest의 `assetId`/필수 메타(`brand`, `externalUrl`, `description`, `category`, `options`)를 우선 수정한다.
- support surface 자산에서 `assets:verify:deskterior`가 실패하면 `supportProfile.surfaces[].{id,anchorTypes,center,size,top,margin}` 계약을 먼저 맞춘다.
- 규격 불일치가 발견되면 `.blend` 실측 값을 기준으로 `dimensionsMm`/`supportProfile`/`options`를 함께 갱신한다.
- `p2s_desk_lamp_glow`의 `options`에는 반드시 `light-emitter` 힌트를 유지한다.

오픈소스 자산 체크:
- 라이선스(CC0 우선) 확인
- 출처 URL 기록 (`externalUrl`)
- 브랜드/옵션/설명 메타 입력

## 2026-04-14 변경 동기화 (Legacy Runtime Cleanup)
Added:
- room-first deskterior 운영 절차와 asset-generation 전용 worker 변수.

Updated:
- QA 시나리오를 공유/커뮤니티 중심으로 재정렬.

Removed/Deprecated:
- floorplan/intake/legacy pipeline 운영 절차 및 관련 환경 변수.

## 2026-04-16 변경 동기화 (Reference Start Flow + Template Browser)
Added:
- 홈 시작하기, 공간 선택 브라우저, 가구 배치 템플릿 진입을 운영 회귀 순서에 추가.

Updated:
- QA 기본 경로를 `builder 직행`에서 `홈 -> 선택/생성 -> builder -> editor -> viewer/community`로 갱신.

Removed/Deprecated:
- 새 방 만들기만으로 전체 회귀를 대표하던 단일 시작 시나리오.

## 2026-04-16 변경 동기화 (Reference 4-Step Builder Shell)
Added:
- builder QA 시 4단계 shell에서 step 2 치수 오버레이, step 3 개구부 선택/삭제, step 4 마감 선택 preview를 확인하는 기준을 추가.

Updated:
- 홈 -> builder 회귀에서 `/studio/builder`가 상단 툴바 없는 split shell로 노출되는 것을 기본 기대값으로 갱신.

Removed/Deprecated:
- builder preview summary 카드와 step chip 존재를 전제로 한 기존 확인 포인트.

## 2026-04-16 변경 동기화 (Editor Precision Controls)
Added:
- 에디터 QA에 `월드/로컬` 좌표계 토글과 live placement clamp 검증 항목을 추가.

Updated:
- top-view 편집 검증을 “이동/회전 가능”에서 “이동/회전 + 좌표계 전환 + 실시간 경계 보정”까지 확장.

Removed/Deprecated:
- 드래그 중에는 room bounds 보정이 없어도 괜찮다는 운영 가정.

## 2026-04-18 변경 동기화 (Builder Lighting Step + Top-View Controls)
Added:
- builder QA에 5단계 lighting 선택과 direct/indirect preview 차이 검증을 추가.
- editor QA에 상단뷰 버튼 회전과 surface click non-toggle 확인 항목을 추가.

Updated:
- builder shell 기대값을 `4-step split shell`에서 `5-step shell + navbar safe offset`으로 갱신.
- top-view 검증 기준을 `drag rotation`에서 `button rotation + zoom`으로 변경.

Removed/Deprecated:
- 상단뷰 drag rotation 전제.
- 바닥/벽 클릭이 재질 shortcut으로 동작하는 가정.

## 2026-04-16 변경 동기화 (Editor Reference Chrome Pass)
Added:
- editor QA에 상단 bar, slim catalog rail, right zoom rail, bottom pill toolbar, light share modal 확인 항목을 추가.

Updated:
- 배포 전 체크리스트의 editor shell 기대값을 레퍼런스 7번 이미지 기준으로 갱신.

Removed/Deprecated:
- editor share modal이 dark glass 테마를 유지한다는 기대값.

## 2026-04-17 변경 동기화 (Editor Top-View / Drawer QA)
Added:
- rotate-only orthographic top-view, shared left drawer, ceiling visibility 분리, mobile share modal fit 회귀 항목.
- top-view wall footprint strip 가독성 확인 항목.

Updated:
- 에디터 상호작용 QA를 `기능 노출`에서 `기능 노출 + top/walk 탐색 semantics` 확인까지 확장.

Removed/Deprecated:
- 상단뷰 pan/move 토글이 기본 탐색 동작이라는 가정.

## 2026-04-16 변경 동기화 (Shared Viewer + Furnished Feed Reference Pass)
Added:
- shared viewer QA에 상단 light bar, 우측 zoom rail, 하단 readonly status pill, hotspot drawer 상세 카드 확인 항목을 추가.
- gallery/community QA에 레퍼런스 8번식 4열 카드 밀도와 상단 filter rail 확인 항목을 추가.

Updated:
- 공유/커뮤니티 회귀를 “링크 열림” 수준에서 “viewer chrome + hotspot detail + furnished feed density”까지 확장.

Removed/Deprecated:
- community featured/recent 분리 섹션과 shared viewer hero metric strip을 전제로 한 확인 포인트.

## 2026-04-16 변경 동기화 (Start Flow Fixes + Builder Shell Fit)
Added:
- 홈/선택/빌더 상단 bar의 브랜드/로그인 상태 확인 항목 추가.
- 템플릿 선택 시 editor 직행과 same-mode `더보기` 검증 항목 추가.
- builder step 2 치수 overlay와 room shape 동기화 확인 항목 추가.
- shape별 `nook`/포켓/컷 치수를 과하게 넣어도 UI 값과 실제 geometry가 같은 정규화 값으로 맞춰지는지 확인하는 항목 추가.

Updated:
- 핵심 QA 순서를 `선택 템플릿 -> builder 이동`에서 `선택 템플릿 -> editor 직행`, `공간 만들기 -> builder 4-step` 분기 구조로 갱신.
- builder shell 기대값을 "split shell"에서 "desktop viewport fit + 내부 rail scroll only" 기준으로 구체화.
- editor QA 기대값을 "기능 노출"에서 "좌측 카탈로그 고정 + compact 상단바/하단 toolbar" 기준으로 구체화.

Removed/Deprecated:
- 템플릿 선택 후 builder 세부값 보정이 기본 회귀 경로라는 전제.

## 2026-04-14 변경 동기화 (Physical Fidelity Operations)
Added:
- 배포 전 체크리스트에 실측 규격/마감/디테일 노출 검증 항목 추가.
- 실측 고정 제품의 스케일 입력 차단 검증 항목 추가.

Updated:
- deskterior 운영 절차에 Blender 실측 기준의 메타데이터 동기화 지침을 포함.

Removed/Deprecated:
- 옵션 문자열만으로 규격 검증을 대체하던 점검 방식.

## 2026-04-14 변경 동기화 (Physical Fidelity Stage-2)
Added:
- 실측 기반 support surface 배치 검증 항목 추가.
- finish 메타데이터의 실제 렌더 반영 검증 항목 추가.

Updated:
- 데스크테리어 검증 절차를 “정보 표시” 중심에서 “배치 정합성 + 렌더 반영” 중심으로 확장.

Removed/Deprecated:
- 마감 정보를 텍스트 확인만으로 완료 처리하던 운영 점검.

## 2026-04-14 변경 동기화 (Physical Fidelity Stage-3)
Added:
- wall clearance 및 자산 간 중첩 완화 동작을 운영 검증 항목으로 추가.
- Blender 알려진 슬롯 기준의 slot-aware finish 반영 검증 항목 추가.

Updated:
- 데스크테리어 검증 절차를 “support top + 기본 finish”에서 “물리 충돌 완화 + 슬롯별 재질 디테일”까지 확장.

Removed/Deprecated:
- 신규 배치 초기 위치는 fallback 규격 기준 검증만으로 충분하다는 운영 가정.

## 2026-04-14 변경 동기화 (Physical Fidelity Stage-4)
Added:
- 홈 레퍼런스 사진 대비 검증 항목 추가: 밝은 우드톤 재질의 디테일 보존, 웜/쿨 조명 균형, 접지 그림자 선명도.
- 환경광 검증 항목 추가: HDRI 선택 우선순위가 적용되어 씬 톤이 일관적으로 재현되는지 확인.

Updated:
- 운영 점검을 "물리 배치 정합성"에서 "물리 + 시각 레퍼런스 정합성"으로 확장.

Removed/Deprecated:
- 장면 품질 판정을 제품 정보/배치 결과만으로 완료 처리하던 점검 방식.

## 2026-04-18 변경 동기화 (Opening Asset + Entry Perf QA)
Added:
- builder step 3에서 `Preview Controls` 카드와 프리뷰 내부 휴지통 버튼이 더 이상 노출되지 않는지 확인하는 항목 추가.
- 벽 모서리 확대 시 seam/gap 없이 반 두께 겹침으로 닫히는지, door/window cutout과 runtime asset 위치가 일치하는지 확인하는 항목 추가.
- 문/창문을 `벽 1~4`로 바꿀 때 새 벽 길이에 맞춰 자연스럽게 재배치되고, editor 진입 후에도 같은 wall에 유지되는지 확인하는 항목 추가.
- 공간 디자인 페이지 첫 진입 시 top-view가 flat finish/footprint 중심으로 먼저 뜨고, HDRI/조명/개구부 자산은 walk/builder-preview에서만 올라오는지 확인하는 항목 추가.

Updated:
- 조명 QA를 `direct/indirect 모드 차이 확인`에서 `direct spotlight falloff + indirect ceiling cove glow의 자연스러움 확인`까지 확장.

Removed/Deprecated:
- 프리뷰 내부 FAB delete와 안내 카드 존재를 전제로 한 builder QA 포인트.

## 2026-04-19 변경 동기화 (Room Mode + Desk Precision QA)
Added:
- 상단뷰 하단 pill toolbar의 `룸 배치` / `데스크 정밀` 토글 검증 항목 추가.
- room mode의 250mm snap / 90도 회전, desk precision mode의 25mm snap / 15도 회전 검증 항목 추가.

Updated:
- 에디터 QA를 `상단뷰 공통 drag/transform`에서 `room mode=direct drag`, `desk precision mode=gizmo + local/world` 분리 확인으로 갱신.

Removed/Deprecated:
- 상단뷰 하나에서 direct drag와 gizmo가 항상 동시에 활성이라는 운영 점검 가정.

## 2026-04-19 변경 동기화 (Desk Precision Measurements)
Added:
- desk precision mode에서 선택 자산의 X/Z/Y(mm), Yaw(deg), 실측 W/D/H(mm)를 inspector와 measurement overlay 양쪽에서 함께 검증하는 QA 항목을 추가.

Updated:
- 상단뷰 정밀 편집 점검 기준을 내부 meter/radian 추정보다 사용자 노출 단위인 `mm/deg` 일치 확인으로 갱신.

Removed/Deprecated:
- 정밀 편집 수치가 inspector 내부 값만 맞으면 충분하다는 QA 가정.

## 2026-04-19 변경 동기화 (Desk Precision Surface Lock)
Added:
- desk precision mode에서 surface anchor 제품의 support asset / support surface / surface size / margin / top 높이를 inspector와 overlay 양쪽에서 함께 검증하는 QA 항목을 추가.

Updated:
- 정밀 배치 QA 기준을 수치 측정만이 아니라 surface lock 상태 동기화 확인까지 확장.

Removed/Deprecated:
- support surface lock 상태를 사용자 추정에만 맡겨도 된다는 QA 가정.

## 2026-04-19 변경 동기화 (Desk Precision Micro View)
Added:
- desk precision mode에서 surface anchor 제품의 support-local micro-view marker와 offset 수치를 inspector/overlay 양쪽에서 함께 검증하는 QA 항목을 추가.

Updated:
- 정밀 배치 QA 기준을 surface lock 상태 동기화에서 support-local marker 동기화 확인까지 확장.

Removed/Deprecated:
- support-local 위치를 숫자 텍스트만 맞으면 충분하다는 QA 가정.

## 2026-04-19 변경 동기화 (SceneDocument Roundtrip Verify)
Added:
- `verify:scene-document` 실행으로 placement/support/product metadata roundtrip 검증을 수행하는 QA 항목을 추가.

Updated:
- 정밀 편집 회귀 확인을 UI 점검만이 아니라 저장/복원 재현성 스크립트 통과까지 포함하도록 확장.

Removed/Deprecated:
- save/load 재현성 검증을 수동 editor/shared viewer 확인에만 의존하던 QA 기준.

## 2026-04-19 변경 동기화 (Public Scene Payload Verify)
Added:
- `verify:public-scene` 실행으로 shared viewer payload의 placement/support/product metadata 재현성을 검증하는 QA 항목을 추가.

Updated:
- publish/shared 재현성 점검을 수동 링크 확인만이 아니라 public payload verify 통과까지 포함하도록 확장.

Removed/Deprecated:
- shared viewer payload 회귀를 수동 링크 열기만으로 감지하던 QA 기준.

## 2026-04-19 변경 동기화 (Showcase Scene Consistency Verify)
Added:
- `verify:showcase-scene` 실행으로 gallery/community 카드 projection과 shared viewer public payload의 version/preview asset summary 정합성을 검증하는 QA 항목을 추가.

Updated:
- publish/shared 재현성 점검을 `sceneDocument -> public payload -> showcase card projection` 연쇄 검증까지 포함하도록 확장했다.

Removed/Deprecated:
- gallery/community 카드 메타 회귀를 수동 피드 확인만으로 감지하던 QA 기준.

## 2026-04-19 변경 동기화 (Desk Precision Extended Measurement)
Added:
- desk precision mode에서 surface anchor 제품의 footprint / projected footprint / edge clearance / relative yaw를 inspector/overlay/micro-view 양쪽에서 함께 검증하는 QA 항목을 추가.

Updated:
- 정밀 배치 QA 기준을 `offset + micro-view marker 확인`에서 `footprint가 usable area 안에 들어오는지 판단 가능한 측정 UI 확인`까지 확장했다.

Removed/Deprecated:
- support surface 배치 품질을 offset 숫자와 점 marker만으로 확인하던 QA 기준.

## 2026-04-20 변경 동기화 (Desk Precision Helper View)
Added:
- desk precision mode에서 surface anchor 제품의 `front(X/H)` / `side(Z/H)` helper view가 inspector/overlay 양쪽에서 같은 projected span, gap, reach를 보여주는지 확인하는 QA 항목을 추가.

Updated:
- 정밀 배치 QA 기준을 `top-down micro-view + footprint 확인`에서 `side/front section helper view 확인`까지 확장했다.

Removed/Deprecated:
- support surface 위 수직 관계를 top height 숫자만 확인하면 충분하다는 QA 가정.

## 2026-04-19 변경 동기화 (KTX2 Runtime Ready + Demand Frame Loop QA)
Added:
- `assets:sync:ktx2-transcoder -- --check`, `verify:render-quality`, idle 안정화 확인 항목을 QA 체크리스트에 추가했다.
- 자산 운영 단계에 basis transcoder public sync 절차를 추가했다.

Updated:
- 배포 전 체크리스트를 render ladder 확인에서 `frameloop demand + KTX2 runtime-ready` 운영 점검까지 포함하도록 갱신했다.

Removed/Deprecated:
- runtime transcoder 동기화 없이도 KTX2 준비 상태를 추정만으로 확인하던 QA 방식.

## 2026-04-20 변경 동기화 (Room Shell KTX2 Wiring QA)
Added:
- `textures:check:room-shell:ktx2`로 room shell texture set의 expected `.ktx2` 산출물 유무를 확인하는 QA 항목을 추가했다.

Updated:
- KTX2 QA 기준을 transcoder sync 확인에서 `transcoder sync + committed room shell ktx2 output check + runtime flag` 확인까지 확장했다.

Removed/Deprecated:
- room shell texture KTX2 준비 상태를 수동 파일 탐색만으로 판단하던 QA 방식.

## 2026-04-20 변경 동기화 (BVH Worker Offload QA)
Added:
- `deskterioronline:bvh-build` 이벤트로 large geometry가 worker offload 되는지 확인하는 QA 항목을 추가했다.

Updated:
- BVH QA 기준을 `hover/select latency` 확인에서 `hover/select latency + BVH build mode(worker/sync) 확인`까지 확장했다.

Removed/Deprecated:
- BVH generation path를 코드 추측만으로 판단하던 QA 방식.

## 2026-04-20 변경 동기화 (Deskterior Metadata Contract Reinforcement QA)
Added:
- `assets:verify:deskterior`가 curated `p2s_*` 자산의 `source/license/pivot/collisionProxy/textureSet/lodProfile` 계약까지 검증하는 QA 항목을 추가했다.
- `verify:scene-document`, `verify:public-scene`가 위 product contract metadata roundtrip을 확인하는 QA 항목을 추가했다.

Updated:
- 자산 QA 기준을 source/runtime/manifest/surface metadata 확인에서 `source/runtime/manifest/surface metadata + asset contract metadata + save/share roundtrip`까지 확장했다.

Removed/Deprecated:
- curated deskterior 자산 메타 검증이 물리 메타와 supportProfile까지만 확인하면 충분하다는 가정.

## 2026-04-20 변경 동기화 (Deskterior Optimize Chain Phase 1 QA)
Added:
- `assets:optimize:deskterior`가 `glTF Transform dedup + prune + meshopt` 체인을 실행한 뒤 `assets:validate:deskterior`를 다시 통과하는지 확인하는 QA 항목을 추가했다.

Updated:
- deskterior optimize QA 기준을 “meshopt 재적용 후 budget 확인”에서 “dedup/prune + meshopt 재적용 후 validate/verify/build 확인”까지 확장했다.

Removed/Deprecated:
- optimize 패스가 meshopt extension write 한 단계뿐이라서 geometry 정리 회귀를 따로 볼 필요가 없다는 가정.

## 2026-04-20 변경 동기화 (LOD Policy Operationalization QA)
Added:
- `verify:asset-lod`로 complexity별 room/desk precision/walk fallback 거리 정책을 검증하는 QA 항목을 추가했다.

Updated:
- LOD QA 기준을 “모든 자산 공통 box proxy가 뜨는지”에서 `lodProfile + 모드별 거리 정책` 검증까지 확장했다.

Removed/Deprecated:
- 런타임 LOD가 자산 complexity와 무관한 고정 거리 규칙만 쓰면 된다는 가정.

## 2026-04-20 변경 동기화 (Scene Instancing Phase 1 QA)
Added:
- `verify:asset-instancing`로 read-only top/walk instancing eligibility와 repeated cluster grouping을 검증하는 QA 항목을 추가했다. builder preview starter는 2026-05-15 이후 개별 proxy 렌더 경로를 별도 QA한다.

Updated:
- 반복 자산 QA 기준을 “눈으로 draw call이 줄어든 것 같아 보이는지” 수준에서 `instancing policy script + build 회귀` 기준으로 강화했다.

Removed/Deprecated:
- instancing 적용 여부를 수동 viewer 확인만으로 판단하던 QA 방식.

## 2026-04-20 변경 동기화 (Native gltfpack Optional Chain QA)
Added:
- `assets:probe:gltfpack`로 native binary availability를 확인하고, `assets:optimize:deskterior:native` 또는 `assets:optimize:deskterior -- --native-gltfpack` 경로를 점검하는 QA 항목을 추가했다.

Updated:
- 고급 asset optimize QA 기준을 glTF Transform only에서 `glTF Transform baseline + optional native gltfpack pass + validate/verify/build`까지 확장했다.

Removed/Deprecated:
- native gltfpack 적용 여부를 로컬 개인 alias나 수동 메모에만 의존하던 QA 방식.

## 2026-04-20 변경 동기화 (Repo-local gltfpack Environment QA)
Added:
- `assets:setup:gltfpack`로 `.tools/gltfpack/current/gltfpack`를 만들고, 바로 `assets:probe:gltfpack`가 same path를 읽는지 확인하는 QA 항목을 추가했다.

Updated:
- native optimize 준비 절차를 “binary가 있으면 쓴다” 수준에서 `repo-local setup -> probe -> optimize -> validate/verify/build` 순서로 구체화했다.

Removed/Deprecated:
- 전역 PATH에 우연히 있는 gltfpack을 바로 쓰는 방식만 가정하던 QA 절차.

## 2026-04-20 변경 동기화 (Showcase Viewer Presentation QA)
Added:
- gallery/community 카드 클릭 시 `/shared/[token]?source=showcase`로 이동하고, 해당 진입에서만 richer showcase presentation이 적용되는지 확인하는 QA 항목을 추가했다.

Updated:
- shared viewer QA 기준을 단일 `viewer-shared` 확인에서 “plain shared link는 lean profile 유지, showcase card 진입은 `viewer-showcase` 프로파일 사용”까지 확장했다.

Removed/Deprecated:
- gallery/community 유입과 일반 shared 링크를 같은 viewer profile로만 확인하던 QA 방식.

## 2026-04-21 변경 동기화 (Editor Walk/Top QA Fixes)
Added:
- editor header에서 프로젝트 이름을 직접 입력한 뒤 저장/새로고침/재진입 후에도 같은 이름이 유지되는지 확인하는 QA 항목을 추가했다.
- shared viewer top-view에서 drag orbit으로 360도 회전과 zoom이 되는지, walk-view 전환도 계속 가능한지 확인하는 QA 항목을 추가했다.
- desk precision에서 선택 자산과 desk support asset이 proxy/cluster로 뭉개지지 않고 full-detail로 보이는지 확인하는 QA 항목을 추가했다.

Updated:
- walk-view QA 기준을 “진입 가능한지”에서 “room shell texture failure가 있어도 fallback으로 floor/wall이 보여 검정 화면이 남지 않는지”까지 확장한다.
- top-view QA 기준을 “flat shell이 보이는지”에서 “textured floor와 상향된 가독성으로 회전 변화가 식별되는지”까지 확장한다.

Removed/Deprecated:
- 프로젝트 이름은 builder에서만 정하고 editor에서는 바꿀 수 없다는 QA 가정.

## 2026-04-22 변경 동기화 (Runtime Foundation Smoke QA)
Added:
- `benchmarks:collect:baseline`, `verify:runtime-engine`, `verify:placement-kernel` smoke 명령과 확인 포인트를 추가했다.

Updated:
- 초기 상용 엔진 리팩터링 QA 범위를 화면 회귀 확인뿐 아니라 document/runtime split alpha 검증까지 확장했다.

Removed/Deprecated:
- baseline benchmark scene 정의가 문서 메모에만 있고 실행 명령이 없다는 상태.

## 2026-04-22 변경 동기화 (Runtime Editor Bridge QA)
Added:
- `verify:runtime-editor-bridge` smoke 명령과 direct drag/gizmo/hotkey commit 브리지 확인 포인트를 추가했다.

Updated:
- 초기 상용 엔진 리팩터링 QA 범위를 runtime foundation skeleton에서 editor transform commit bridge 검증까지 확장했다.

Removed/Deprecated:
- preview/commit 분리 검증이 engine-core 단위 smoke만으로 충분하다는 가정.

## 2026-04-22 변경 동기화 (Runtime Render Sync QA)
Added:
- `verify:runtime-render-sync` smoke 명령과 selected asset renderer sync 확인 포인트를 추가했다.

Updated:
- 초기 renderer compatibility QA 범위를 runtime bootstrap + commit bridge에서 runtime transform consumption까지 확장했다.

Removed/Deprecated:
- selected asset preview 렌더 sync가 브라우저 수동 확인만 있으면 충분하다는 가정.

## 2026-04-22 변경 동기화 (Runtime Renderer Adapter QA)
Added:
- `verify:runtime-renderer-adapter` smoke 명령과 runtime object handle/batch sync 확인 포인트를 추가했다.

Updated:
- 초기 renderer compatibility QA 범위를 selected asset preview 반영에서 instanced cluster renderer adapter sync, document replace 이후 stale handle cleanup 확인까지 확장했다.

Removed/Deprecated:
- renderer adapter sync 검증이 런타임 수동 확인만으로 충분하다는 가정.

## 2026-04-23 변경 동기화 (Renderer Snapshot Priority QA)
Added:
- `verify:runtime-render-sync`는 single object helper가 renderer adapter matrix snapshot과 material assignment를 같이 소비하는지 확인한다.

Updated:
- runtime renderer QA 범위를 “selected asset transform + instanced cluster batch sync”에서 “single object renderer snapshot priority + material assignment snapshot”까지 확장한다.

Removed/Deprecated:
- single object renderer sync에서 runtime engine fallback만 확인해도 충분하다는 가정.

## 2026-04-23 변경 동기화 (Incremental Runtime Engine QA)
Added:
- `verify:runtime-engine-document-sync` smoke 명령과 same-room object add/remove/material 변경이 full runtime scene replace 없이 반영되는지 확인하는 포인트를 추가했다.

Updated:
- runtime foundation QA 범위를 preview/commit 분리와 renderer snapshot 소비에서 `incremental object lifecycle sync`까지 확장한다.

Removed/Deprecated:
- object lifecycle 변경 검증이 `replaceDocument()` 기반 경로만 확인해도 충분하다는 가정.

## 2026-04-23 변경 동기화 (Runtime Visibility QA)
Added:
- hidden object visibility가 `verify:scene-document`, `verify:runtime-engine-document-sync`, `verify:runtime-renderer-adapter`, `verify:runtime-render-sync`에서 같이 검증되도록 기준을 추가했다.

Updated:
- runtime foundation QA 범위를 `incremental object lifecycle sync`에서 `incremental object lifecycle + visibility sync`까지 확장한다.

Removed/Deprecated:
- visibility 회귀는 수동 viewport 확인으로만 잡아도 충분하다는 가정.

## 2026-04-23 변경 동기화 (Focus Placement Prototype QA)
Added:
- walk mode에서 배치할 자산 하나를 선택한 뒤 책상 상판을 바라보고 `E`로 focus placement HUD가 열리는지 확인하는 QA 항목을 추가했다.
- focus placement HUD가 Arrow 이동, Alt+Arrow 미세 이동, Q/E 회전, Enter 확정, Esc 취소를 안내하고 실제 preview/commit 결과와 일치하는지 확인하는 항목을 추가했다.
- `verify:focus-placement` smoke 명령으로 `surface_local` commit과 `supportAssetId`/`anchorType` 브리지를 검증하는 절차를 추가했다.

Updated:
- runtime foundation QA 범위를 `incremental object lifecycle + visibility sync`에서 `focus placement prototype entry/preview/commit`까지 확장한다.

Removed/Deprecated:
- walk mode 정밀 배치 회귀를 수동 viewport 체험으로만 확인해도 충분하다는 가정.

## 2026-04-23 변경 동기화 (Focus Placement Prototype QA Complete)
Added:
- desk surface를 바라보되 선택 자산이 없을 때 crosshair hint가 `배치할 제품을 먼저 선택하세요`로 바뀌는지 확인한다.
- 호환되는 자산을 선택하면 crosshair hint가 actionable 상태로 바뀌고, HUD가 preferred/no-place zone count와 local grid minimap을 함께 보여주는지 확인한다.
- invalid candidate일 때 HUD badge가 blocked로 바뀌고 Enter 전 `runtime-document-patch`가 계속 0건인지 확인한다.

Updated:
- focus placement QA 범위를 `entry/preview/commit`에서 `entry hint + snapped HUD state + blocked/collision feedback`까지 확장한다.

Removed/Deprecated:
- focus placement 진입 가능 여부와 상태 tone은 수동 체감으로만 확인해도 된다는 가정.

## 2026-04-23 변경 동기화 (Asset Compiler Alpha QA)
Added:
- `asset:publish`와 `verify:asset-compiler`를 curated asset pipeline의 기본 smoke 명령에 추가했다.

Updated:
- curated asset QA 범위를 manifest 검증에서 `runtime package descriptor publish`까지 확장한다.

Removed/Deprecated:
- asset compiler 시작 단계에서는 publish artifact 검증이 필요 없다는 가정.

## 2026-04-23 변경 동기화 (Asset Compiler Alpha QA Slice 2)
Added:
- `asset:ingest`를 curated asset compiler의 기본 entrypoint smoke 명령으로 추가했다.
- `verify:asset-compiler`는 descriptor뿐 아니라 generated sidecar와 embedded `runtimeAsset` 계약까지 검증한다.

Updated:
- curated asset QA 범위를 `descriptor publish`에서 `descriptor + sidecar + publish file manifest` 검증으로 확장한다.

Removed/Deprecated:
- alpha 단계에서는 source/runtime file 누락이 있어도 publish artifact 일부를 남겨둘 수 있다는 가정.

## 2026-04-23 변경 동기화 (Asset Compiler Alpha QA Slice 3)
Added:
- `asset:compile` 실행 후에는 published package verification까지 자동으로 통과해야 성공으로 본다.
- `verify:asset-compiler`는 proxy/thumbnails 존재, descriptor file manifest, runtime package directory의 unexpected JSON 잔존 여부까지 함께 점검한다.
- `asset:optimize -- --dry-run`을 통해 package-owned optimize adapter가 proxy GLB까지 대상으로 잡히는지 smoke 확인하는 절차를 추가했다.

Updated:
- Phase 4 asset QA 기본 절차를 `asset:ingest -> asset:compile -> verify:asset-compiler` 순으로 정리한다.

Removed/Deprecated:
- published package 검증을 `asset:publish` 이후 별도 수동 점검으로만 남겨도 된다는 가정.

## 2026-04-23 변경 동기화 (Phase 6 Focus Placement QA)
Added:
- focus placement 대상 support asset이 여러 후보 surface를 제공하면 crosshair/HUD가 mode count를 표시하고 `Tab`으로 후보가 순환되는지 확인한다.
- `F`를 누르면 preferred candidate로 복귀하고, 이 전환이 commit 전 document patch를 만들지 않는지 확인한다.
- mounted attachment metadata를 가진 선택 자산은 `edge_clamp` candidate가 `place_on_surface`보다 먼저 노출되는지 확인한다.
- `verify:focus-placement`는 edge candidate priority, candidate cycling helper, underside/wall candidate surfacing을 함께 통과해야 한다.

Updated:
- focus placement QA 범위를 `desktop_top hint + snapped HUD + blocked feedback`에서 `multi-surface candidate cycle + mounted compatibility priority`까지 확장한다.

Removed/Deprecated:
- Phase 6 회귀를 수동 `desktop_top` 한 경로 확인만으로 충분하다고 보는 가정.

## 2026-04-23 변경 동기화 (Phase 7 Advanced Attachments QA Slice 1)
Added:
- `npm --workspace apps/web run verify:advanced-attachments`가 edge clamp success, VESA mount success, VESA pattern mismatch failure, articulation unreachable failure를 모두 통과하는지 확인한다.
- monitor-arm support object가 `vesa_mount` target을 제공할 때 support-side attachment metadata 또는 articulation end-effector metadata 둘 중 하나로 validation이 통과하는지 확인한다.

Updated:
- attachment QA 범위를 `edge_clamp`와 focus placement candidate 정도에서 `vesa_mount + articulation reachability`까지 확장한다.

Removed/Deprecated:
- advanced attachment 회귀를 placement kernel smoke 하나만으로 충분하다고 보는 가정.

## 2026-04-23 변경 동기화 (Phase 7 Advanced Attachments QA Slice 2)
Added:
- monitor 선택 후 monitor arm을 바라보고 focus placement 진입 시 `VESA Mount` candidate와 monitor-arm wizard HUD가 뜨는지 확인한다.
- active wizard에서 `PageUp/PageDown`이 reach를, `Arrow`가 swing/height를, `Q/E`가 roll을 바꾸고 solved joint summary가 함께 갱신되는지 확인한다.
- HUD에 panel VESA pattern과 target VESA pattern이 함께 보이는지 확인한다.

Updated:
- advanced attachment QA 범위를 `kernel validation + mounted candidate surfacing`에서 `kernel validation + monitor-arm target-pose wizard`까지 확장한다.

Removed/Deprecated:
- monitor-arm UX 회귀를 kernel smoke만으로 대체할 수 있다는 가정.

## 2026-04-23 변경 동기화 (Phase 7 Advanced Attachments QA Complete)
Added:
- mounted focus placement HUD에 authored `Surface Thickness`, `Clearance`, `VESA`, `Arm Reach` requirement 카드가 실제 constraint 값과 함께 보이는지 확인한다.
- place-on-surface가 아닌 mounted flow에서도 authored requirement 노출이 commit 전 document patch 없이 session update만으로 갱신되는지 확인한다.

Updated:
- advanced attachment QA 범위를 `kernel validation + monitor-arm target-pose wizard`에서 `kernel validation + monitor-arm target-pose wizard + authored requirement exposure`까지 확장한다.

Removed/Deprecated:
- requirement/clearance readout 회귀를 수동 시각 확인 없이 생략해도 된다는 가정.

## 2026-04-23 변경 동기화 (Phase 9 Commercial QA Slice 1)
Added:
- `npm --workspace apps/web run verify:commercial-qa` 실행 시 release gates, runtime asset count, benchmark scenario coverage, compatibility matrix coverage, scene integrity detector sample이 모두 통과하는지 확인한다.
- hidden QA surface 확인이 필요하면 `/labs/qa`에서 asset status / benchmark baseline / compatibility matrix / integrity detector sample이 동시에 보이는지 확인한다.
- editor bootstrap 시 corruption 또는 warning diagnostics가 있으면 toast가 뜨는지, launch metric에 무결성 상태가 표시되는지 확인한다.

Updated:
- QA 운영 가이드를 `verify:*` 개별 스모크 위주에서 “개별 smoke + commercial QA snapshot 확인”까지 확장한다.

Removed/Deprecated:
- commercial QA 시작 단계에서는 별도 snapshot surface 없이 script output만 보면 된다는 가정.

## 2026-04-23 변경 동기화 (Phase 9 Commercial QA Slice 2)
Added:
- `/labs/qa`에서 placement regression suite 카드가 `verify:placement-kernel`, `verify:focus-placement`, `verify:advanced-attachments`를 모두 보여주고 status가 `pass`인지 확인한다.
- `/labs/qa`의 integrity detector가 missing support / invalid surface / duplicate id / self-support 수치를 함께 보여주는지 확인한다.
- `/labs/qa`의 asset inventory table이 각 runtime package의 QA/support/attachment/variant/missing file 상태를 row 단위로 보여주는지 확인한다.

Updated:
- commercial QA 확인 절차를 `release gate / baseline / compatibility / integrity summary`에서 `release gate / placement regression / asset inventory / baseline / compatibility / integrity detail`까지 확장한다.

Removed/Deprecated:
- placement regression coverage는 CLI verify만 보면 되고 hidden QA surface에서 재확인하지 않아도 된다는 가정.

## 2026-04-23 변경 동기화 (Phase 9 Commercial QA Slice 3)
Added:
- `/labs/qa`의 compatibility matrix가 release-required profile별 verification timestamp, method, evidence를 함께 보여주는지 확인한다.
- `/labs/qa`의 placement regression suite 카드가 verification timestamp, method, evidence를 함께 보여주는지 확인한다.
- `npm --workspace apps/web run verify:commercial-qa`가 required compatibility profile verification ledger와 release-required placement suite ledger를 함께 검증하는지 확인한다.

Updated:
- commercial QA 확인 절차를 `release gate / placement regression / asset inventory / baseline / compatibility / integrity detail`에서 `release gate / evidence-backed regression + compatibility / asset inventory / baseline / integrity detail`까지 확장한다.

Removed/Deprecated:
- compatibility verification은 notes만 있으면 되고 별도 evidence를 남기지 않아도 된다는 가정.

## 2026-04-23 변경 동기화 (Phase 9 Commercial QA Slice 4 / Complete)
Added:
- `/labs/qa`에서 asset coverage summary와 top risk asset list가 보이는지 확인한다.
- `/labs/qa`에서 integrity detector가 invalid scale, support mismatch, severity summary, prioritized recovery action을 함께 보여주는지 확인한다.
- `npm --workspace apps/web run verify:scene-document`가 invalid scale과 support reference mismatch integrity rule까지 검증하는지 확인한다.

Updated:
- commercial QA 확인 절차를 `evidence-backed regression + compatibility / asset inventory / baseline / integrity detail`에서 `evidence-backed release dashboard / asset risk summary / integrity recovery plan`까지 확장한다.

Removed/Deprecated:
- integrity detector는 corrupt sample issue list만 확인하면 충분하다는 가정.

## 2026-04-24 변경 동기화 (Feature Browser QA)
Added:
- 기능 검증 시 `npm --workspace apps/web run functional:e2e:browser`로 로컬 브라우저에서 builder step, material selection, preview render, lighting selection을 확인한다.
- Codex 앱 내장 Node에서 Next SWC native addon code-sign 오류가 나면 bundled runtime Node를 PATH 앞에 둔다: `PATH=/Users/sol/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH`.
- Walk view 기능 검증은 asset drawer가 walk mode에서도 열리는지, focus placement HUD의 keyboard/numeric micro-adjust가 동작하는지, mounted candidate가 보이는지 실제 UI로 확인한다.

Updated:
- 기능 RC 판단은 `qa:primary`/release gate뿐 아니라 local 또는 preview browser에서 사용자가 직접 조작 가능한지까지 포함한다.

Removed/Deprecated:
- script-level smoke만으로 room quality와 walkthrough placement를 검증 완료로 처리하는 절차.

## 2026-04-28 변경 동기화 (Walk Inventory Placement QA)
Added:
- 워크뷰 QA는 `I` inventory open -> asset select -> focused surface highlight -> click/`E` placement start -> click/`Enter` commit -> save/reload 유지 순서로 확인한다.
- inventory에서 선택만 하고 commit하지 않은 draft asset은 autosave payload에 포함되지 않아야 하며, `Escape` 또는 view switch cancel 시 제거되어야 한다.

Updated:
- 상단뷰 QA는 편집 affordance 확인이 아니라 view-only 상태 확인으로 바뀐다.

Removed/Deprecated:
- 상단뷰 `룸 배치` / `데스크 정밀` 토글을 제품 배치 QA의 필수 경로로 보는 기준.

## 2026-04-28 변경 동기화 (Walk Pointer Lock QA)
Added:
- 워크뷰 진입 후 canvas를 한 번 클릭하면 마우스 커서가 숨겨지고, F12/DevTools 전환 없이 즉시 mouse-look과 `W/A/S/D` 이동이 동작하는지 확인한다.
- 워크뷰에서 inventory/properties drawer가 열리면 pointer lock이 해제되고, drawer를 닫은 뒤 canvas 클릭으로 다시 mouse-look이 복구되는지 확인한다.
- builder/editor 기본 wall/floor material 첫 preset이 생성형 limewash wall + light oak floor texture thumbnail과 runtime surface로 보이는지 확인한다.

Updated:
- 워크뷰 QA 기준을 focus placement뿐 아니라 pointer lock 진입/해제/재진입까지 포함하도록 확장한다.

Removed/Deprecated:
- F12를 눌러 DevTools focus 전환을 해야 워크뷰 이동이 정상화되는 상태를 허용하는 기준.

## 2026-05-02 변경 동기화 (Attachment Guard QA)
Added:
- `npm --workspace apps/web run verify:advanced-attachments` 실행 시 wall screw placement, wall mounted overlap blocked, grommet-hole placement, invalid grommet blocked 항목이 함께 통과하는지 확인한다.
- `npm --workspace apps/web run verify:focus-placement` 실행 시 `wall_screw`와 `grommet_hole` 후보가 focus placement candidate로 노출되고 mount-target affordance를 갖는지 확인한다.

Updated:
- 워크뷰 배치 QA는 desk/edge/underside/VESA뿐 아니라 wall screw와 grommet hole 같은 mounted point attachment까지 포함한다.

Removed/Deprecated:
- wall/grommet attachment 검증을 asset metadata 단계로만 미루고 runtime placement QA에서 제외하는 절차.

## 2026-05-02 변경 동기화 (Asset Metadata Gate QA)
Added:
- asset metadata QA는 `npm --workspace apps/web run verify:asset-compiler`에서 `Metadata gates valid`가 전체 asset 수와 같은지 확인한다.
- commercial QA는 `npm --workspace apps/web run verify:commercial-qa`에서 `asset-metadata-gate`가 `pass`이고 `metadataGatePassedAssets`가 `totalAssets`와 같은지 확인한다.

Updated:
- catalog QA는 파일 존재와 thumbnail 확인뿐 아니라 mm 치수, scale lock, collider, support/attachment metadata, provenance, SKU/manufacturer를 함께 검증한다.

Removed/Deprecated:
- asset compiler verify가 sidecar parity만 통과하면 상용 catalog QA가 충분하다는 절차.

## 2026-05-02 변경 동기화 (Viewer Parity Gate QA)
Added:
- 공유/쇼케이스/커뮤니티 parity 확인은 `npm --workspace apps/web run verify:viewer-parity`를 기본으로 실행한다.
- 세부 확인이 필요하면 `verify:public-scene`에서 scene document hash와 runtime asset refs를, `verify:showcase-scene`에서 thumbnail source와 showcase card parity를 각각 확인한다.
- commercial QA는 `viewer-parity` release gate가 `pass`인지 확인한다.

Updated:
- shared viewer QA는 링크 열림 여부뿐 아니라 pinned version, document hash, preview asset count, runtime asset ids, thumbnail source 일치성을 포함한다.

Removed/Deprecated:
- community card와 shared viewer를 별도 화면 smoke로만 보고 동일 scene snapshot 검증을 생략하는 절차.

## 2026-05-02 변경 동기화 (Commercial QA Readiness Score)
Added:
- `/labs/qa` 진입 시 readiness score, pass/warning/fail gate count, warning/blocker 목록을 먼저 확인한다.
- `npm --workspace apps/web run verify:commercial-qa`는 current build가 hero SKU/asset QA warning 때문에 `warning` 상태임을 명시적으로 검증한다.

Updated:
- commercial QA 절차는 개별 release gate 확인 후 마지막에 사람이 종합하는 방식에서 readiness score를 기준으로 먼저 판단하는 방식으로 바뀐다.

Removed/Deprecated:
- release dashboard에 숫자형 readiness 판단이 없어도 충분하다는 절차.

## 2026-05-02 변경 동기화 (Commercial Readiness Pass)
Added:
- `verify:commercial-qa`는 readiness score `100/pass`, warning gate 0개, release-eligible hero SKU 20개 이상, AI candidate texture 0개를 배포 전 기준으로 확인한다.

Updated:
- `/labs/qa`에서 warning이 남아 있는 상태는 paid-beta demo ready가 아니라 backlog 상태로 본다.
- 상용 texture 확인은 preset 수만 보지 않고 2K PBR source/KTX2/fallback metadata와 AI candidate exclusion까지 확인한다.

Removed/Deprecated:
- `verify:commercial-qa`가 hero SKU/asset QA warning을 의도된 현 상태로 허용하던 기준.

## 2026-05-02 변경 동기화 (Walk Aim + Desk Preview QA)
Added:
- 워크뷰 QA는 제품 선택 후 support object를 crosshair로 바라보면 후보 목록 버튼을 누르지 않아도 ghost preview가 뜨는지 확인한다.
- 워크뷰 배치 중 `Tab` 후보 전환, `Arrow`/`Q`/`E` 보정, click/`Enter` commit, `Escape` cancel이 같은 active focus placement session에서 동작하는지 확인한다.
- `npm --workspace apps/web run verify:walk-placement-ux`는 crosshair aim event, candidate ranking, ghost preview command, valid commit patch intent를 함께 검증한다.
- `npm --workspace apps/web run verify:desk-precision`은 keyboard nudge/rotate가 preview-batched 계약인지 확인한다.

Updated:
- `FocusPlacementLauncher` 버튼 목록은 사용자가 명시적으로 후보를 고르고 싶을 때 쓰는 fallback으로 취급한다.
- desk precision QA는 방향키/QE 입력 직후 즉시 저장 snapshot이 쌓이는지보다 preview가 먼저 움직이고 idle 후 한 번만 commit되는지를 본다.

Removed/Deprecated:
- walk placement QA를 pointer lock 상태와 launcher 버튼 클릭만으로 완료 처리하는 절차.
- desk precision keyboard 조작을 keydown마다 개별 commit/snapshot으로 검증하는 절차.

## 2026-05-03 변경 동기화 (Placement Policy QA)
Added:
- 워크뷰 QA는 crosshair 거리 기반 confidence가 pending request에 보존되어 ghost preview 시작 후에도 candidate ranking에 같은 값으로 남는지 확인한다.
- desk precision QA는 방향키/Q/E뿐 아니라 `R` 회전도 renderer preview가 먼저 움직이고 idle batch 뒤 한 번만 저장 snapshot이 생기는지 확인한다.
- `npm --workspace apps/web run functional:e2e:browser`는 로컬 Supabase 환경에서 room builder, walk placement, save/reload, share creation, shared viewer placement parity까지 확인하는 시나리오로 기록한다.
- shared viewer activity logging은 best-effort이므로 저장 실패가 있어도 렌더링과 E2E 콘솔에 5xx 응답을 남기면 안 된다.

Updated:
- 이미 배치 완료된 asset은 바라보기만으로 자동 재배치를 시작하지 않는다. 기존 asset 재배치 검증은 launcher 또는 명시 relocate 흐름이 제공될 때 별도 시나리오로 수행한다.
- 운영 Supabase/prod 환경 검증은 로컬 functional E2E와 구분해서 release checklist에 별도 evidence로 남긴다.
- functional browser QA는 pointer-lock regression뿐 아니라 shared viewer 중 발생한 5xx API 응답도 실패로 본다.

Removed/Deprecated:
- walk aim event의 confidence만 확인하고 pending request activation confidence 보존을 검증하지 않는 절차.
- desk precision `R` 키를 즉시 commit 예외로 남겨 두는 QA 기준.

## 2026-05-04 변경 동기화 (Walk Input + Deployment QA)
Added:
- 워크뷰 진입 후 canvas를 한 번 클릭하면 DevTools/F12 전환 없이 pointer lock을 요청하고, pointer lock이 browser 정책상 거절되어도 canvas focus 상태에서 `W/A/S/D` fallback 이동이 되는지 확인한다.
- `I` inventory open과 `E` focus placement start는 physical `KeyI`/`KeyE` 기준으로 확인한다. 한글 입력 상태에서도 같은 키 위치로 동작해야 한다.
- Vercel dashboard 안의 preview/thumbnail 카드가 `403: Forbidden`을 보여도 production alias 또는 deployment URL 직접 접속이 정상인지 별도로 확인한다. 직접 접속이 정상이라면 먼저 Deployment Protection/Vercel Authentication, shareable link, dashboard screenshot service 차단 여부를 본다.
- 로그인 fresh-state QA는 새 배포에 의존하지 않고 로그아웃, 시크릿 창, site data clear, 또는 preview 전용 origin/Supabase 환경으로 수행한다.

Updated:
- 워크뷰 QA 기준은 `I -> asset select -> crosshair surface -> click/E placement start` 전 단계에 `click scene -> mouse-look/WASD`와 non-English layout shortcut 확인을 포함한다.
- Vercel Preview OAuth QA는 Deployment Protection이 app route보다 앞에서 `/auth/signin`과 `/auth/callback`을 차단하지 않는 상태에서만 수행한다.

Removed/Deprecated:
- Vercel 새 배포가 기존 브라우저의 Supabase 로그인 세션을 자동 초기화한다는 기대.
- Vercel dashboard preview panel 403만으로 production app 접속 장애로 판정하는 절차.

## 2026-05-04 변경 동기화 (Inventory Thumbnail QA)
Added:
- 워크뷰에서 `I`로 inventory를 열었을 때 각 asset 카드가 제품 thumbnail image 또는 fallback visual preview를 보여주는지 확인한다.
- `npm --workspace apps/web run verify:inventory-thumbnails`로 catalog thumbnail coverage와 public thumbnail 파일 존재를 확인한다.

Updated:
- 워크뷰 asset 선택 QA는 제품명/collection text 확인에서 실제 생김새를 보고 선택할 수 있는 visual picker 확인까지 포함한다.

Removed/Deprecated:
- inventory card가 이름과 가격/치수 텍스트만 보여도 사용자가 충분히 asset을 식별할 수 있다는 QA 기준.

## 2026-05-06 변경 동기화 (Commercial Builder/Placement QA)
Added:
- 워크뷰 inventory에서 item을 클릭했을 때 즉시 배치되지 않고 ghost preview만 나타나는지 확인한다. valid 위치 click/`Enter` 전에는 저장 payload에 draft asset이 없어야 한다.
- invalid 위치 click은 commit 없이 blocked toast를 보여야 하며, `Escape`는 draft/preview를 폐기해야 한다.
- builder 3단계에서 벽을 선택하고 문/창문 segment를 드래그해 wallId/offset이 바뀌는지 확인한다. opening overlap 또는 corner edge clearance 위반 상태에서는 다음 단계 진행을 막아야 한다.
- builder 4단계에서 clean wall/floor preset thumbnail이 실제 texture와 유사하게 보이는지 확인한다. damaged/dirty wall texture는 default 선택지로 보이면 안 된다.
- builder 5단계 direct lighting에서 1/3/6개 fixture count, 2D 위치 drag, 밝기, 색온도, beam radius/spread 변경이 preview와 저장 payload에 반영되는지 확인한다.
- 신규 검증 명령:
  `npm --workspace apps/web run verify:inventory-ghost-placement`
  `npm --workspace apps/web run verify:room-openings`
  `npm --workspace apps/web run verify:material-presets`
  `npm --workspace apps/web run verify:lighting-layout`

Updated:
- room builder QA는 보기 좋은 preview만 확인하지 않고, 조작 가능성, validation, save/reload/share parity를 함께 확인한다.
- walk placement QA는 inventory thumbnail 확인 이후 ghost preview, valid commit, invalid blocked, cancel까지 한 흐름으로 확인한다.

Removed/Deprecated:
- inventory click 직후 정면 자동 배치를 정상 UX로 보는 절차.
- lighting step에서 direct/indirect 카드만 선택하면 충분하다고 보는 절차.

## 2026-05-07 변경 동기화 (Opening Visual QA Contract)
Added:
- `npm --workspace apps/web run verify:room-openings` 결과는 opening payload 검증뿐 아니라 shared renderer path, style metadata, procedural fallback smoke hook까지 포함해 읽는다.
- opening QA 시 door/window GLB를 강제로 실패시킬 수 있는 환경에서는 fallback이 plain white box가 아니라 slab/handle/frame 또는 glass/mullion/sill 구조를 유지하는지 확인한다.

Updated:
- builder 3단계와 editor/shared viewer QA는 같은 `InteractiveDoors` visual path를 사용한다는 전제로 확인한다.

Removed/Deprecated:
- opening verify PASS를 “GLB 파일이 있다” 정도의 약한 증거로 해석하는 절차.

## 2026-05-07 변경 동기화 (Walk Pointer Lock QA)
Added:
- walk QA에서 viewport 클릭 후 pointer lock이 거부되는 브라우저 조건에서도 WASD와 canvas-focus mouse-look fallback이 동작하고 `Mouse lock unavailable` 문구가 남지 않는지 확인한다.

Updated:
- `functional:e2e:browser`의 walk keyboard 단계는 pointer lock denied fallback movement, mouse look fallback, inventory `I` panel toggle과 panel-open movement block을 함께 검증한다.

Removed/Deprecated:
- WASD만 동작하면 walk input QA를 통과한 것으로 보는 절차.

## 2026-05-15 변경 동기화 (Editor Lighting Fixture QA)
Added:
- editor properties panel의 조명 섹션에서 Direct/Indirect 전환, 1/2/3/4/6 direct fixture count, Warm/Neutral/Cool color temperature swatch, mini grid marker drag가 저장 payload와 렌더 mood에 반영되는지 확인한다.
- Direct mode mini grid marker가 room bounds 기준 위치와 count를 보여주고, marker drag 후 500mm snap 좌표로 바뀌며, `verify:lighting-layout`가 editor lighting control source contract까지 통과하는지 확인한다.
- 개별 direct fixture의 On/Off, 밝기, 빔 반경, 확산 slider를 바꿨을 때 `lighting.fixtures[]` detail 값과 렌더 glow/spread가 같이 바뀌는지 확인한다.

Updated:
- 조명 QA는 builder 5단계에서 끝나지 않고, 프로젝트 생성 후 editor에서 같은 조명 구성과 fixture별 detail 값을 다시 바꿀 수 있는지까지 포함한다.

Removed/Deprecated:
- editor에서는 조명 preset과 global slider만 확인하고 fixture 위치/detail 조작을 생략해도 충분하다고 보는 절차.

## 2026-05-16 변경 동기화 (Editor Room Styling Bundle QA)
Added:
- 프로젝트 editor 상단뷰 설정 패널에서 “스타일링 번들” 버튼이 보이는지 확인하고, complete-room / creator-desk / media-lounge / gallery-studio 중 하나를 적용했을 때 누락된 제품이 추가되는지 확인한다.
- 같은 번들을 다시 적용했을 때 중복 asset이 늘어나지 않고 기존 제품을 유지했다는 안내가 나오는지 확인한다.
- desk/shelf/media surface 위 소품은 적용 후에도 부모 support 위에 붙어 있어야 하며, 저장 후 재로드/공유 화면에서 같은 구성을 유지해야 한다.

Updated:
- 방 꾸미기 QA는 walk inventory에서 제품을 하나씩 배치하는 흐름과 editor settings에서 bundle로 dense composition을 보강하는 흐름을 모두 포함한다.
- 새 source gate는 `npm --workspace apps/web run verify:editor-styling-bundles`로 실행한다.

Removed/Deprecated:
- editor에서 빠른 방 꾸미기 검증을 생략하고 inventory 개별 배치만 커스터마이징 QA로 보는 절차.

## 2026-05-16 변경 동기화 (Meshy Room Decor QA)
Added:
- Meshy text-to-3D 생성 후 `npm --workspace apps/web run verify:meshy-room-decor`를 실행해 generated decor GLB, proxy GLB, thumbnail, report, catalog entry, `workspace-flex` seed 연결, glTF validation error 0개를 확인한다.
- builder/editor에서 `workspace-flex` furnished starter 또는 room styling bundle을 적용했을 때 display cluster에 `Meshy 파스텔 마스코트 스택` decor가 catalog asset으로 포함되는지 확인한다.
- Meshy generation report의 `budget.source`, `remaining`, `reservedEstimate`, `maxBudgetPerJob`를 확인해 provider POST가 budget guard 이후에 실행됐는지 확인한다.

Updated:
- 방 꾸미기 QA는 renderer-only 소품 디테일과 별개로, 사용자가 catalog에서 실제 generated GLB decor를 선택/교체/배치할 수 있는지까지 포함한다.

Removed/Deprecated:
- Meshy로 만든 에셋을 파일 존재만 확인하고 catalog/seed/thumbnail/validation 증거 없이 완료 처리하는 절차.

## 2026-05-16 변경 동기화 (Generated Asset Review QA)
Added:
- editor library/inventory에서 `AI 생성` filter를 눌렀을 때 현재 catalog/search/category 조건 안의 generated asset만 보이고, Meshy decor card에 provider badge와 `검수 필요` 상태가 보이는지 확인한다.
- Meshy decor를 선택한 inspector에는 `Meshy · 검수 필요` badge가 보여야 하며, replacement 후보에 Meshy-generated item이 나타날 때도 generated badge가 같이 보여야 한다.
- catalog thumbnail은 더 이상 투명 black background/과노출 white blob처럼 보이지 않고, asset-specific WebP로 카드 안에서 식별 가능해야 한다.
- `npm --workspace apps/web run verify:meshy-room-decor`는 generated badge/source hook/finalizer thumbnail contract까지 함께 통과해야 한다.
- editor inspector의 스타일링 번들에서 display cluster가 포함된 bundle은 적용 전 `Meshy 생성 ... 검수 필요` badge를 표시해야 한다.
- `npm --workspace apps/web run verify:editor-styling-bundles`는 generated bundle preview helper, project editor catalog 전달, bundle badge QA id를 함께 확인한다.
- `/studio/builder` style step에서 workspace preset 또는 display cluster toggle에 Meshy-generated decor가 포함되면 프로젝트 생성 전 `Meshy 생성 ... 검수 필요` badge가 보여야 한다.
- `npm --workspace apps/web run verify:builder-performance`는 builder style preset/cluster generated badge source hook을 함께 확인한다.

Updated:
- Meshy QA는 생성/파일 검증만이 아니라 사용자가 생성 에셋을 찾고 prototype 상태를 인지한 채 배치/교체하는 편집 흐름까지 포함한다.
- 생성형 decor가 room styling bundle에 포함될 때도 library/replacement inspector와 같은 provenance/review 표시 기준을 적용한다.
- 생성형 decor QA는 room-first builder의 preset 선택 단계와 post-create editor styling bundle 단계가 같은 seed preview 기준을 쓰는지까지 포함한다.

Removed/Deprecated:
- generated/prototype 에셋을 검수 상태 표시 없이 일반 상품처럼만 보여주는 QA 절차.
- generated prototype이 방 스타일 bundle 안에 숨어 있어 적용 전 사용자가 검수 필요 상태를 확인하지 못하는 절차.

## 2026-05-16 변경 동기화 (Render Source Marker QA)
Added:
- `npm --workspace apps/web run verify:builder-performance`는 `Furniture.tsx`가 real GLB, builder preview proxy, placeholder fallback, loading fallback, LOD proxy를 `furniture-render-source-*` marker로 구분하는지 확인한다.
- Meshy-generated decor를 editor QA에서 확인할 때는 catalog badge뿐 아니라 실제 GLB render path가 placeholder/loading fallback으로 남지 않는지도 QA 대상에 포함한다.
- `npm --workspace apps/web run verify:meshy-live-preview`를 실행하면 hidden QA route `/labs/qa/meshy-live-preview`에서 Meshy text-to-3D GLB replacement live preview를 브라우저로 열고 registry + canvas pixel을 확인한다.
- 검증 결과는 `output/playwright/meshy-live-preview.png`에 남기며, QA evidence에는 `real-glb-live-preview`, mesh/material count, provider `Meshy`, review `검수 필요`, generation report path가 포함되어야 한다.
- `npm --workspace apps/web run verify:meshy-editor-scene`를 실행하면 hidden QA route `/labs/qa/meshy-editor-scene`에서 `workspace-flex` display cluster room scene을 cutaway top-view QA로 열고, Meshy decor가 forced real-GLB path에서 `real-glb`로 로드됐는지 `__DESKTERIORONLINE_FURNITURE_RENDER_SOURCES__`와 `__DESKTERIORONLINE_FURNITURE_GLB_LOADS__`로 확인한다.
- full-room 검증 결과는 `output/playwright/meshy-editor-scene.png`에 남기며, QA evidence에는 scene asset id, real GLB source, mesh/material count, canvas color diversity/contrast가 포함되어야 한다.
- `npm --workspace apps/web run verify:meshy-editor-customization`를 실행하면 hidden QA route `/labs/qa/meshy-editor-customization`에서 실제 inspector replacement card로 `p2s_decor_mug_espresso`를 `p2s_meshy_pastel_mascot_stack`로 교체하고, 같은 scene asset id 유지, selected generated badge, real GLB load, manual save payload capture를 확인한다.
- editor customization 검증 결과는 `output/playwright/meshy-editor-customization.png`에 남기며, QA evidence에는 `saveCaptureCount`, real GLB source, mesh/material count, Meshy source URL, canvas color diversity/contrast가 포함되어야 한다.

Updated:
- generated asset QA는 nonblank canvas와 badge 노출만으로 완료하지 않고, fallback/proxy가 실제 GLB 품질 증거로 섞이지 않는지까지 확인한다.
- builder preview의 proxy 기반 furnished-room smoke, editor replacement live GLB preview smoke, hidden full-room top-view GLB smoke, editor customization save smoke는 서로 다른 품질 증거로 분리해 본다.

Removed/Deprecated:
- placeholder 또는 LOD box가 보이는 상태를 Meshy asset 렌더 성공으로 간주하는 QA 절차.
- generated badge가 보이면 실제 GLB preview도 자동으로 통과했다고 보는 QA 절차.
- seeded room scene에서 Meshy asset이 로드되면 inspector 교체/저장 흐름도 검증됐다고 보는 QA 절차.

## 2026-05-17 변경 동기화 (PC Assembly Workbench QA)
Added:
- PC 조립 랩은 `http://127.0.0.1:3100/labs/qa/pc-assembly-workbench`에서 수동 확인한다.
- 수동 QA 순서는 케이스 선택 -> 작업 공간 준비 -> 메인보드 박스 위 작업 -> AM5 소켓/CPU 정렬/CPU 안착/retention 잠금 -> M.2 방열판/SSD/나사/방열판 재장착 -> DDR5 래치/RAM A2/RAM B2 -> 케이스 패널/스탠드오프/I/O/메인보드 이식/나사 -> PSU 브래킷/PSU -> 24핀 ATX/CPU EPS -> 수랭 브래킷/써멀/펌프/라디에이터/팬 -> 케이스 팬 -> 프런트패널/USB/오디오 헤더 -> PCIe 슬롯 커버/GPU/GPU 보조전원 -> 케이블 정리/패널 닫기 -> 외부 케이블/첫 전원/BIOS POST -> 완성 PC 책상 배치 -> 모니터/키보드/마우스/마이크/램프/소품/LED/TV 콘솔/소파/룸 조명 -> 상태 저장이다.
- 각 단계에서 sound count가 증가해야 하며, 최종 sound count는 case selection 1개 + assembly 38개 + room setup 11개 = 50이어야 한다.
- 써멀 도포 후 thermal coverage가 74%로 표시되어야 하며, 저장 후 saved status가 `yes`로 바뀌어야 한다.
- Compuzone product `1336041` 견적 부품 9개가 quote panel과 saved payload에 남는지 확인한다.
- Meshy 에셋 생성은 `npm --workspace apps/web run asset:generate:compuzone-pc-kit`로 실행하고, output GLB/proxy/thumbnail/report를 확인한다.
- 최종 룸 프리뷰에서 Compuzone Meshy PC build kit이 책상 위 완성 PC로 보이고, Meshy pastel mascot stack이 선반 위 소품으로 보이는지 확인한다. 둘 중 하나가 procedural fallback처럼 보이면 asset QA는 통과로 보지 않는다.
- 자동 QA는 `npm --workspace apps/web run verify:pc-assembly-workbench`로 실행한다.
- 자동 QA 결과는 `output/playwright/pc-assembly-workbench.png`와 JSON log의 `currentStep=room-lighting-set`, `selectedCaseId=lian-li-o11d-mini-v2-flow-white`, `stepCount=38`, `roomStepCount=11`, `thermalPasteCoverage=0.74`, 50개 `audioEvents`, `saved=true`를 evidence로 본다.

Updated:
- PC 본체는 데스크테리어의 주요 대상이다. PC case를 배치하는 수준을 넘어, RAM/CPU/써멀/GPU/SSD/쿨러/팬/전원 케이블/헤더/케이블 정리/첫 부팅/POST 같은 조립 행동이 3D state와 저장 payload로 남는지 확인해야 한다.
- 완성 PC는 조립 완료 후 책상 및 실제 방 scene에 배치되어야 하며, desk setup과 room styling state도 저장 payload에 남아야 한다.
- Bruno Simon-inspired visual review는 직접 비교용 asset/code 복제가 아니라 screenshot 기준의 cutaway room density, warm/cool lighting contrast, desk PC readability, shelf/media/sofa/chair object grounding을 확인하는 절차로 수행한다.
- 상용 QA에 통합할 때는 `/project/[id]` 저장/재로드, publish/share viewer, mute/accessibility setting, part compatibility 오류 상태까지 추가로 확인한다.

Removed/Deprecated:
- PC case catalog item 배치만 확인하고 PC 조립 가능 여부를 완료 처리하는 절차.
- sound cue가 실제 사용자 gesture나 registry evidence 없이 문구로만 존재하는 절차.
- Meshy prototype output을 exact commercial asset으로 간주하고 license/human visual QA를 생략하는 절차.

## 2026-05-17 변경 동기화 (PC Assembly Cinematic QA Evidence)
Added:
- PC 조립 랩 자동 QA는 이제 일반 작업 화면 screenshot과 final room만 보이는 cinematic screenshot을 모두 남긴다.
- cinematic 결과는 `output/playwright/pc-assembly-workbench-cinematic.png`에서 확인한다. 이 파일은 상단 nav/오른쪽 단계 panel 없이 완성 PC가 배치된 방만 보여야 한다.
- 자동 QA JSON에서 `cinematicUniqueColorBuckets`와 `cinematicLuminanceStdDev`가 함께 출력되면 final room 캔버스가 빈 화면이 아니라 색/명암 대비를 가진 상태로 렌더됐다는 evidence로 본다.

Updated:
- 수동 visual review는 `pc-assembly-workbench.png`보다 `pc-assembly-workbench-cinematic.png`를 우선 확인한다.
- final room screenshot에서 Compuzone PC build kit, Meshy pastel mascot stack, monitor, speaker, ivy planter가 실제 방 안에 보이는지 확인한다.

Removed/Deprecated:
- side panel이 포함된 QA 화면만 보고 final room visual quality를 판단하는 절차.

## 2026-05-17 변경 동기화 (PC Assembly Cinematic Review Update)
Added:
- `npm --workspace apps/web run verify:pc-assembly-workbench` 실행 결과의 `output/playwright/pc-assembly-workbench-cinematic.png`는 final room 검토용 주 증거다.
- 수동 검토 시 바닥 마루 패턴, 오른쪽 벽 TV/콘솔, 책상 위 PC, 선반 소품, sofa/chair grounding, LED highlight clipping 여부를 함께 본다.

Updated:
- 자동 QA는 cinematic route로 새로 이동하지 않고, 완주된 페이지를 full-screen capture layout으로 바꿔 screenshot을 만든다. 따라서 수동 확인 URL은 일반 workbench route를 우선 사용한다.
- Meshy prototype 소품은 final screenshot에서 보이는지 확인하되, 검수 완료 상용 asset으로 간주하지 않는다.

Removed/Deprecated:
- 밝은 Bloom/LED 번짐이 크면 더 고품질이라고 판단하는 수동 리뷰 기준.

## 2026-05-17 변경 동기화 (PC Assembly Cinematic Polish Review)
Added:
- `output/playwright/pc-assembly-workbench-cinematic.png` 수동 검토 시 PC 본체가 책상 위에서 chair/plant에 가려지지 않는지, rear wall panel/cork board/shelf, right wall acoustic/media zone, desk cable run, sofa cushion/throw detail이 보이는지 확인한다.
- 최신 자동 QA evidence는 `stepCount=38`, `roomStepCount=11`, `audioEvents=50`, `saved=true`, `cinematicUniqueColorBuckets=407`, `cinematicLuminanceStdDev=68.42`를 기준으로 기록한다.

Updated:
- Cinematic screenshot은 단순 nonblank 여부가 아니라 PC readability, wall density, desk grounding, sofa/chair/living-zone grounding, warm/cool color contrast를 함께 검토한다.

Removed/Deprecated:
- 최종 room 검토에서 PC 본체가 작거나 숨겨져 있어도 room decor가 충분하면 통과시키는 기준.

## 2026-05-17 변경 동기화 (PC Assembly Cinematic 3/4 Review)
Added:
- 최신 final room 검토는 `output/playwright/pc-assembly-workbench-cinematic.png`에서 3/4 cutaway 구도, 책상 위 white PC shell, Compuzone build evidence, rug/sofa foreground, right-wall TV/media, soft lighting patches가 함께 보이는지 확인한다.
- 자동 QA evidence 기준은 `stepCount=38`, `roomStepCount=11`, `audioEvents=50`, `saved=true`, `cinematicUniqueColorBuckets=380`, `cinematicLuminanceStdDev=73.45`다.

Updated:
- 수동 리뷰 시 white showcase shell은 visual prototype overlay로 보고, 사용자가 요청한 견적 그대로의 상용 PC case asset 완료로 판단하지 않는다.
- 룸 setup 버튼이 비활성 상태에서 조기 클릭되지 않도록 자동 QA가 대기하므로, heavy GLB 로딩 중 실패는 verifier 안정성 이슈로 우선 확인한다.

Removed/Deprecated:
- 정면 flat screenshot이나 과한 wall patch edge가 보여도 최종 room polish를 완료 처리하는 기준.

## 2026-05-17 변경 동기화 (PC Assembly Cinematic PBR Decor Review)
Added:
- 최신 final room 검토는 `output/playwright/pc-assembly-workbench-cinematic.png`에서 shelf/table PBR detail, soft floor/wall AO, higher 3/4 miniature framing, right-wall media visibility, and desk PC grounding을 함께 확인한다.
- 자동 QA evidence 기준은 `stepCount=38`, `roomStepCount=11`, `audioEvents=50`, `saved=true`, `cinematicUniqueColorBuckets=244`, `cinematicLuminanceStdDev=52.1`다.

Updated:
- 수동 리뷰에서 PBR GLTF가 들어갔더라도 스타일이 맞지 않거나 고스트/중복처럼 보이면 제거 또는 authored primitive fallback으로 되돌린다.
- `cinematicUniqueColorBuckets`/`cinematicLuminanceStdDev`는 nonblank/contrast guardrail이며, Bruno-level 여부는 사람이 screenshot을 보고 판단해야 한다.

Removed/Deprecated:
- 더 사실적인 GLTF를 추가했다는 이유만으로 visual target을 달성했다고 보는 리뷰 절차.

## 2026-05-17 변경 동기화 (PC Tower Detail Review)
Added:
- 최신 final room 검토는 `output/playwright/pc-assembly-workbench-cinematic.png`에서 PC 본체 내부 부품 단서, 상단 메쉬, 전면 IO, 패널 스크루, RGB 팬, 책상 접지, chair occlusion 감소를 함께 확인한다.
- 자동 QA evidence 기준은 `stepCount=38`, `roomStepCount=11`, `audioEvents=50`, `saved=true`, `cinematicUniqueColorBuckets=248`, `cinematicLuminanceStdDev=52.16`다.

Updated:
- Meshy 신규 생성이 필요한 리뷰에서는 먼저 `MESHY_API_KEY`와 Meshy budget env가 설정되어 있는지 확인한다. 설정이 없으면 기존 generated/prototype GLB와 renderer overlay 기반 리뷰로 제한하고, 상용 asset 완료로 판단하지 않는다.

Removed/Deprecated:
- PC가 화면에 존재하지만 chair/desk/white shell에 묻혀 실제 본체 조립 결과를 사람이 읽기 어려운 screenshot을 통과시키는 절차.

## 2026-05-17 변경 동기화 (Cutaway Room Architecture Review)
Added:
- 최신 final room 검토는 `output/playwright/pc-assembly-workbench-cinematic.png`에서 좌측 return wall, 상단/코너 림, baseboard, ceiling rib, cove LED가 방 깊이를 만들고 있는지 확인한다.
- 자동 QA evidence 기준은 `stepCount=38`, `roomStepCount=11`, `audioEvents=50`, `saved=true`, `cinematicUniqueColorBuckets=258`, `cinematicLuminanceStdDev=50.29`다.

Updated:
- 수동 리뷰에서 좌측 wall이 너무 강하게 보이거나 shelf/sofa/PC를 가리면 다음 visual polish 대상이다. 현재 pass는 room envelope depth를 올리는 prototype evidence로 기록한다.

Removed/Deprecated:
- back wall과 right wall만 있는 평면 세트처럼 보여도 데스크 소품 수가 많으면 Bruno-style room review를 통과시키는 절차.

## 2026-05-17 변경 동기화 (Open Cutaway Wall Review)
Added:
- 최신 final room 검토는 `output/playwright/pc-assembly-workbench-cinematic.png`에서 좌측 wall이 큰 막힌 면이 아니라 열린 frame/rail/shelf detail로 보이며, shelf/desk/sofa/PC를 가리지 않는지 확인한다.
- 자동 QA evidence 기준은 `stepCount=38`, `roomStepCount=11`, `audioEvents=50`, `saved=true`, `cinematicUniqueColorBuckets=279`, `cinematicLuminanceStdDev=51.98`다.

Updated:
- 수동 리뷰에서 wall이 방 깊이를 주더라도 PC 본체, 데스크 상판, 선반 오브젝트를 읽기 어렵게 만들면 다음 수정 대상이다.

Removed/Deprecated:
- 막힌 side wall이 생겼다는 이유만으로 컷어웨이 룸 품질이 올라갔다고 판단하는 절차.

## 2026-05-17 변경 동기화 (Camera + Lighting Balance Review)
Added:
- 최신 final room 검토는 `output/playwright/pc-assembly-workbench-cinematic.png`에서 higher 3/4 camera, open cutaway wall framing, PC tower highlight control, warm/cool LED glow, post-FX vignette를 함께 확인한다.
- 자동 QA evidence 기준은 `stepCount=38`, `roomStepCount=11`, `audioEvents=50`, `saved=true`, `cinematicUniqueColorBuckets=397`, `cinematicLuminanceStdDev=72.38`다.

Updated:
- 수동 리뷰에서 white PC case가 과노출되거나 left/right wall rails가 장난감 난간처럼 보이면 다음 visual polish 대상으로 본다.
- 현재 결과는 기능/상태/사운드/저장 검증이 완료된 개선본이지만, Bruno Simon room급 최종 품질 완료로 판단하지 않는다.

Removed/Deprecated:
- 후처리나 metric 상승만으로 사람 눈 기준 visual target을 달성했다고 처리하는 절차.

## 2026-05-17 변경 동기화 (Desk PC Readability Review)
Added:
- 최신 final room 검토는 `output/playwright/pc-assembly-workbench-cinematic.png`에서 PC 본체가 큰 흰 proxy box나 generated fragment가 아니라 책상 위 완성 본체로 읽히는지 먼저 확인한다.
- 자동 QA evidence 기준은 `stepCount=38`, `roomStepCount=11`, `audioEvents=50`, `saved=true`, `uniqueColorBuckets=306`, `luminanceStdDev=64.57`, `cinematicUniqueColorBuckets=392`, `cinematicLuminanceStdDev=64.71`다.

Updated:
- quote와 다른 showcase case GLB가 final screenshot에서 크게 보이면 실패로 본다. 현재 리뷰는 Compuzone Meshy build-kit을 낮은 opacity evidence로 유지하고, authored renderer PC detail을 visible source로 삼는다.
- 현재 결과는 이전보다 desk PC readability가 개선됐지만 Bruno Simon room급 최종 품질 완료로 판단하지 않는다.

Removed/Deprecated:
- Meshy/proxy asset이 로드됐다는 사실만으로 final visual review를 통과시키는 절차.

## 2026-05-17 변경 동기화 (Solid Tower Material Balance Review)
Added:
- 최신 final room 검토는 `output/playwright/pc-assembly-workbench-cinematic.png`에서 완성 PC 본체의 white case highlight가 과노출되지 않고, 유리 패널/암부/내부 부품/RGB strip이 분리되어 보이는지 확인한다.
- 자동 QA evidence 기준은 `stepCount=38`, `roomStepCount=11`, `audioEvents=50`, `saved=true`, `uniqueColorBuckets=295`, `luminanceStdDev=65.11`, `cinematicUniqueColorBuckets=380`, `cinematicLuminanceStdDev=65.19`다.

Updated:
- PC 본체가 커졌더라도 내부 부품이 흰 면에 묻히면 다음 visual polish 대상으로 본다. 이번 리뷰 기준은 tower size보다 material separation과 glass/interior readability를 우선한다.
- 현재 결과는 이전보다 PC 본체 부피감과 과노출 제어가 개선됐지만 Bruno Simon room급 최종 품질 완료로 판단하지 않는다.

Removed/Deprecated:
- 완성 PC가 과밝은 흰 박스처럼 보이는데도 배치가 완료됐다는 이유만으로 visual review를 통과시키는 절차.

## 2026-05-17 변경 동기화 (PC System Configurator Review)
Added:
- 최신 PC assembly review는 UI의 `pc system` 패널에서 compatibility, physical fit, attachment, state machine 상태가 모두 정상인지 확인한다.
- 자동 QA evidence 기준은 `stepCount=38`, `roomStepCount=11`, `audioEvents=50`, `saved=true`, `uniqueColorBuckets=291`, `luminanceStdDev=65.13`, `cinematicUniqueColorBuckets=379`, `cinematicLuminanceStdDev=65.30`다.

Updated:
- PC 본체가 보기 좋게 렌더링되어도 compatibility/fit/state-machine evidence가 빠지면 Deskterior PC system review를 통과시키지 않는다.
- 현재 구현은 Prebuilt PC Flow와 Custom Build Flow를 같은 catalog/attachment/evaluation 기반으로 묶기 위한 첫 foundation pass다.

Removed/Deprecated:
- PC를 "방에 놓는 모델"로만 검토하는 절차.

## 2026-05-17 변경 동기화 (PC Deskterior Room Review)
Added:
- 최신 final room 검토는 `output/playwright/pc-assembly-workbench-cinematic.png`에서 furniture/decor asset quality, back/right wall panel depth, window night-light strips, solid sofa/coffee-table zone, lighting mood, and assembled desk PC readability를 함께 확인한다.
- 자동 QA evidence 기준은 `stepCount=38`, `roomStepCount=11`, `audioEvents=50`, `saved=true`, `uniqueColorBuckets=280`, `luminanceStdDev=65.30`, `cinematicUniqueColorBuckets=390`, `cinematicLuminanceStdDev=65.56`다.

Updated:
- PC 조립 리뷰는 조립 단계 완료만 보지 않는다. `pc system` evidence의 compatibility/physical fit/state-machine 상태, room placement, RGB/room light integration, furniture/decor quality, and screenshot human review를 함께 확인한다.
- 현재 결과는 verified prototype polish다. Bruno Simon room급 최종 품질 완료로 판단하지 않으며, exact part GLB와 baked material pass가 남아 있다.

Removed/Deprecated:
- PBR asset이 로드됐다는 이유만으로 최종 room review를 통과시키는 절차. 최종 카메라에서 ghosting/overbright/proxy read가 있으면 실패로 본다.

## 2026-05-17 변경 동기화 (Furniture + Atmosphere Review)
Added:
- 최신 final room 검토는 `output/playwright/pc-assembly-workbench-cinematic.png`에서 벽 패브릭/슬랫 패널, 아트 타일, 데스크 매트/노트/트레이, 소파 패브릭, 커피테이블 소품, soft light patches가 방 분위기에 자연스럽게 들어오는지 확인한다.
- 자동 QA evidence 기준은 `stepCount=38`, `roomStepCount=11`, `audioEvents=50`, `saved=true`, `uniqueColorBuckets=275`, `luminanceStdDev=64.66`, `cinematicUniqueColorBuckets=405`, `cinematicLuminanceStdDev=64.98`다.

Updated:
- PC 본체는 직접 조립 가능한 중요 요소로 읽히면 충분하다. 방/가구/조명보다 먼저 튀거나 과노출되면 다음 polish 대상이다.

Removed/Deprecated:
- 바닥에 얇은 빛 막대를 깔아 분위기를 만든 것으로 판단하는 절차. 최종 컷에서 artifact처럼 보이면 soft patch로 대체한다.

## 2026-05-17 변경 동기화 (Room Material Depth + PC Balance Review)
Added:
- 최신 final room 검토는 `output/playwright/pc-assembly-workbench-cinematic.png`에서 wall/floor junction occlusion, baseboard/ceiling trim depth, softened floor plank seams, and reduced PC tower brightness/scale을 함께 확인한다.
- 자동 QA evidence 기준은 `stepCount=38`, `roomStepCount=11`, `audioEvents=50`, `saved=true`, `uniqueColorBuckets=271`, `luminanceStdDev=61.14`, `cinematicUniqueColorBuckets=401`, `cinematicLuminanceStdDev=63.61`다.

Updated:
- PC는 방의 중심요소가 아니라 사용자가 직접 조립할 수 있는 중요한 deskterior 구성품으로 검토한다. 방/가구/조명/분위기보다 먼저 보이면 다음 polish 대상이다.
- final screenshot에서 floor seam 또는 soft shadow patch가 artifact처럼 보이면 shadow/opacity/material balance를 먼저 낮춘 뒤 소품 추가를 검토한다.

Removed/Deprecated:
- PC 본체를 크게/밝게 만드는 것으로 데스크테리어 품질이 올라갔다고 판단하는 리뷰 절차.

## 2026-05-17 변경 동기화 (Furniture Microdetail Review)
Added:
- 최신 final room 검토는 `output/playwright/pc-assembly-workbench-cinematic.png`에서 desk wood grain/clutter, shelf labels/plant/camera, media-console slats/speaker cones, sofa piping/tuft/legs, rug fringe, and softened wall panel lines가 보이는지 확인한다.
- 자동 QA evidence 기준은 `stepCount=38`, `roomStepCount=11`, `audioEvents=50`, `saved=true`, `uniqueColorBuckets=273`, `luminanceStdDev=60.99`, `cinematicUniqueColorBuckets=394`, `cinematicLuminanceStdDev=63.53`다.

Updated:
- PC는 방의 중심요소가 아니라 사용자가 직접 조립할 수 있는 중요한 deskterior 구성품으로 검토한다. 이번 리뷰에서는 PC 밝기/크기보다 가구/소품/소재/분위기 밀도 개선을 우선 확인한다.
- 벽면 패널 라인이 UI grid처럼 보이면 실패 위험으로 보고 opacity/material pass를 먼저 조정한다.

Removed/Deprecated:
- 조립 가능한 PC가 잘 보인다는 이유만으로 방/데스크테리어 가구 품질 검토를 생략하는 절차.

## 2026-05-17 변경 동기화 (Curated Furniture GLB Review)
Added:
- 최신 final room 검토는 `output/playwright/pc-assembly-workbench-cinematic.png`에서 desk structure GLB, sofa texture layer, media cabinet layer, coffee-table GLB, desk planter/tray, softened wall panel lines, and reduced chair/PC dominance를 함께 확인한다.
- 자동 QA evidence 기준은 `stepCount=38`, `roomStepCount=11`, `audioEvents=50`, `saved=true`, `uniqueColorBuckets=274`, `luminanceStdDev=62.00`, `cinematicUniqueColorBuckets=407`, `cinematicLuminanceStdDev=63.32`다.

Updated:
- PC는 방의 중심요소가 아니라 사용자가 직접 조립할 수 있는 중요한 deskterior 구성품으로 검토한다. 방/가구/조명/분위기 품질이 더 중요하다.
- 최종 컷에서 벽 라인이 UI grid처럼 보이거나 중앙 의자/PC가 과도하게 튀면 다음 visual polish 대상으로 기록한다.

Removed/Deprecated:
- 조립 기능과 사운드가 통과했다는 이유로 가구/데스크테리어/룸 분위기 검토를 생략하는 절차.

## 2026-05-18 변경 동기화 (Room Lighting Priority Review)
Added:
- 최신 final room 검토는 `output/playwright/pc-assembly-workbench-cinematic.png`에서 PC가 방의 중심이 아니라 직접 조립 가능한 deskterior 구성품으로 보이는지 확인한다.
- 같은 컷에서 wall/ceiling softness, practical wall sconces, pendant light scale, subdued LED strips, desk/furniture/decor asset quality, warm/cool atmosphere를 함께 확인한다.
- 자동 QA evidence 기준은 `stepCount=38`, `roomStepCount=11`, `audioEvents=50`, `saved=true`, `uniqueColorBuckets=286`, `luminanceStdDev=60.73`, `cinematicUniqueColorBuckets=388`, `cinematicLuminanceStdDev=60.94`다.

Updated:
- 최종 리뷰 우선순위는 방/가구/소품/조명/분위기다. PC는 조립 가능한 중요한 요소로 보여야 하지만 방 전체의 시선을 독점하면 다음 polish 대상으로 본다.
- GLB practical light와 furniture layer가 늘어난 만큼, 리뷰 시 시각 품질뿐 아니라 route load/QA time도 함께 기록한다.

Removed/Deprecated:
- PC 조립 흐름이 완료됐다는 이유만으로 방/가구/조명 품질 검토를 통과시키는 절차.
- 강한 LED strip이나 PC RGB를 Bruno-inspired atmosphere의 대체물로 보는 절차.

## 2026-05-18 변경 동기화 (Meshy Community QA Registry)
Added:
- Meshy community QA route 검토 시 `apps/web/src/lib/qa/meshy-community-assets.ts`가 route allowlist, workbench scene placement, verifier file checks의 단일 source인지 확인한다.
- `assets/references/meshy-community/qa-registry-2026-05-18.json`에서 per-asset runtime URL, 사용 목적, scene placement, promotion blocker를 확인한다.

Updated:
- `npm --workspace apps/web run verify:pc-assembly-workbench`는 Meshy community 파일 존재 확인을 shared registry 기반으로 수행해야 한다.
- cinematic screenshot 수동 검토 시 Meshy community chair/table/rack/brick-wall이 방/가구/소품 밀도 보강으로 읽히고, PC 본체 시선 독점이나 잘못된 scale을 만들지 않는지 같이 본다.

Removed/Deprecated:
- route, scene, verifier가 서로 다른 Meshy community 파일 목록을 하드코딩하는 절차.
- QA registry만 존재한다는 이유로 public catalog promotion을 통과시키는 절차.

## 2026-05-19 변경 동기화 (Meshy Community Runtime Candidate QA)
Added:
- Meshy community runtime candidate 검증은 `npm --workspace apps/web run verify:meshy-community-assets`로 실행한다.
- 후보 산출물은 `assets/runtime-candidates/meshy-community/<slug>/`에서 확인한다.
- contact sheet는 `output/meshy-community/runtime-candidates-contact-sheet.webp`에서 확인한다.

Updated:
- runtime candidate 수동 검토 시 GLB가 보이는지만 보지 말고 pivot/floor contact, scale, material response, scene style fit을 함께 확인한다.
- `colorful-brick-wall`은 triangle budget warning이 있으므로 wall 전체 대체재가 아니라 제한적인 accent 후보로 검토한다.
- public catalog promotion 전에는 `normalization-report-2026-05-19.json`, `optimization-report-2026-05-19.json`, screenshot review evidence가 모두 필요하다.

Removed/Deprecated:
- source-staged Meshy 파일을 검증 스크립트 없이 editor/public catalog에 연결하는 절차.
- contact sheet가 nonblank라는 이유만으로 final room visual QA를 통과시키는 절차.

## 2026-05-19 변경 동기화 (Furniture Hero Kit 수동 검토 절차)
Added:
- 최종 방 스크린샷 검토 시 `output/playwright/pc-assembly-workbench-cinematic.png`에서 authored furniture hero kit가 desk/shelf/media/sofa/rug/coffee table의 큰 실루엣과 공간 밀도를 실제로 높였는지 확인한다.
- asset review는 `assets/references/blender-authored/bruno-furniture-hero-kit/asset-review-2026-05-19.json`에서 object/material/texture/triangle count와 `knownGaps`를 함께 확인한다.
- 자동 검증은 `npm --workspace apps/web run verify:pc-assembly-workbench`로 수행하며, 최신 기준 evidence는 `stepCount=38`, `roomStepCount=11`, `audioEvents=50`, `saved=true`, `cinematicUniqueColorBuckets=398`, `cinematicLuminanceStdDev=62.26`다.

Updated:
- 수동 검토에서 “방이 꽉 찼다”와 “상용 수준이다”를 분리한다. 현재 furniture kit는 QA candidate이며, 중심 벽등 highlight, 투명 overlap, diffuse-only material flatness가 남아 있으면 다음 art pass 대상으로 기록한다.
- PC는 직접 조립 가능한 중요한 deskterior 요소로만 본다. 가구/방/조명/분위기보다 먼저 시선을 잡으면 PC 밝기, scale, camera framing을 낮추는 쪽을 우선 검토한다.

Removed/Deprecated:
- GLB가 public QA path에 존재하거나 verifier가 통과했다는 이유만으로 사용자-facing catalog asset으로 승인하는 절차.
- Meshy text-to-3D/image-to-3D 사전 검수 없이 새 provider generation을 실행하는 절차. 이번 furniture hero kit는 Meshy 생성물이 아니라 Blender-authored candidate다.

## 2026-05-19 변경 동기화 (Furniture PBR/Opacity Cleanup Review)
Added:
- furniture hero kit 검토 시 `asset-review-2026-05-19.json`에서 `asset.textureSet.authoredMaps`, `generatedPbrMapCount=16`, `metrics.textureCount=18`, `comparisonReview.commercialBenchmarkRubric`를 확인한다.
- 최신 final room 검토는 `output/playwright/pc-assembly-workbench-cinematic.png`에서 과한 데스크 램프 flare, 투명 sofa/rug/table ghosting, PC 시선 독점 여부를 함께 확인한다.
- 자동 검증은 `npm --workspace apps/web run verify:pc-assembly-workbench`로 수행하며, 최신 기준 evidence는 `stepCount=38`, `roomStepCount=11`, `audioEvents=50`, `saved=true`, `cinematicUniqueColorBuckets=381`, `cinematicLuminanceStdDev=62.81`다.

Updated:
- high-opacity imported GLB는 solid furniture처럼 보여야 한다. 반투명으로 남겨야 하는 경우는 provenance/ghost layer 의도가 명확할 때뿐이다.
- PBR helper map이 생겼더라도 상용 승격은 아니다. 수동 리뷰에서 topology, silhouette, UV/texture quality, KTX2/LOD readiness, baked lighting, reference-board comparison을 분리해서 판정한다.

Removed/Deprecated:
- diffuse-only gap을 해결했다고 해서 곧바로 Bruno Simon급이라고 판단하는 절차.
- low-poly support GLB를 반투명으로 많이 겹쳐 장면 밀도처럼 보이게 하는 절차.

## 2026-05-19 변경 동기화 (Benchmark Board 수동 검토 절차)
Added:
- Bruno-inspired room quality pass를 검토할 때 먼저 `output/visual-qa/bruno-room-asset-benchmark-contact-sheet.png`를 열어 current screenshot, authored kit thumbnails, Meshy/open candidate board, product asset comparison board를 함께 본다.
- `assets/references/blender-authored/bruno-furniture-hero-kit/benchmark-ledger-2026-05-19.json`에서 `weakestAreas`와 `nextIterationOrder`를 확인하고, 다음 작업이 ledger의 1순위 blocker를 실제로 줄였는지 판단한다.
- 자동 검증은 `npm --workspace apps/web run qa:bruno-asset-benchmark` 후 `PC_ASSEMBLY_QA_VERBOSE=1 npm --workspace apps/web run verify:pc-assembly-workbench`로 수행한다.

Updated:
- 최신 foreground furniture pass 기준은 `193 objects`, `42,956 triangles`, final-room QA `cinematicUniqueColorBuckets=380`, `cinematicLuminanceStdDev=62.74`다.
- 수동 판정은 `not-commercial-ready`가 기본값이다. ledger에서 blocker가 제거되고 screenshot에서 사람 눈으로 commercial-quality topology/material/lighting이 확인되기 전까지 Bruno Simon급 완료로 보지 않는다.

Removed/Deprecated:
- final-room screenshot만 보고 다음 개선 우선순위를 정하는 절차.
- 상용 reference 이미지를 라이선스 검토 없이 QA board에 직접 넣는 절차.

## 2026-05-19 변경 동기화 (Cinematic Highlight 수동 검토 절차)
Added:
- final room 조명 pass를 검토할 때 `PC_ASSEMBLY_QA_VERBOSE=1 npm --workspace apps/web run verify:pc-assembly-workbench` 출력의 `cinematicBrightPixelRatio`와 `cinematicClippedHighlightRatio`를 함께 기록한다.
- Bruno benchmark board를 다시 만들려면 `npm --workspace apps/web run qa:bruno-asset-benchmark`를 실행한 뒤 `output/visual-qa/bruno-room-asset-benchmark-contact-sheet.png`를 열어 current-room panel의 highlight evidence를 확인한다.

Updated:
- 최신 기준 evidence는 `cinematicBrightPixelRatio=0.033`, `cinematicClippedHighlightRatio=0.019`이며, 이 값은 과노출이 줄었다는 신호일 뿐 상용 lighting bake 완료 판정은 아니다.
- 수동 검토 시 하이라이트 지표가 통과해도 sofa/coffee-table topology, surface material depth, baked AO/lightmap, catalog packaging blocker가 남아 있으면 `not-commercial-ready`로 유지한다.

Removed/Deprecated:
- 화면이 어둡지 않고 색이 많다는 이유만으로 Bruno Simon급 분위기가 완성됐다고 판단하는 절차.

## 2026-05-19 변경 동기화 (Foreground Furniture 재검토 절차)
Added:
- furniture hero kit를 재생성한 뒤에는 `assets/references/blender-authored/bruno-furniture-hero-kit/asset-review-2026-05-19.json`에서 object/triangle/bytes가 최신 값인지 확인한다.
- 최신 기준은 `249 objects`, `53,940 triangles`, `11,234,844 bytes`이며, `output/playwright/pc-assembly-workbench-cinematic.png`에서 sofa/coffee-table foreground detail이 실제로 보이는지 사람 눈으로 검토한다.

Updated:
- 자동 검증 순서는 `PC_ASSEMBLY_QA_VERBOSE=1 npm --workspace apps/web run verify:pc-assembly-workbench` 후 `npm --workspace apps/web run qa:bruno-asset-benchmark`다.
- benchmark ledger의 furniture topology gate가 최신 metrics를 말하지 않으면 QA evidence가 stale한 것으로 보고 다시 생성한다.

Removed/Deprecated:
- Blender GLB만 다시 뽑고 브라우저 final-room screenshot과 benchmark ledger를 갱신하지 않는 절차.

## 2026-05-19 변경 동기화 (Surface Lightmap 재검토 절차)
Added:
- surface kit pass를 검토할 때 `assets/references/blender-authored/bruno-room-surface-kit/asset-review-2026-05-19.json`에서 `asset.textureSet.authoredMaps`가 `baseColor/normal/roughness/ambientOcclusion/contactShadowLightmap`를 모두 포함하는지 확인한다.
- 같은 JSON에서 `asset.bakedContactShadowPass.floorZones` 7개와 `wallZones` 4개가 기록됐는지 확인한다.
- Codex 내부 브라우저 또는 QA screenshot에서 `/labs/qa/pc-assembly-workbench?qaNoLoader=1&qaComplete=1&qaCinematic=1` final-room이 보이는지 확인하되, 상용 완료 판정은 benchmark ledger를 따른다.

Updated:
- 자동 검증 순서는 `npm --workspace apps/web run qa:bruno-asset-benchmark` 후 `PC_ASSEMBLY_QA_VERBOSE=1 npm --workspace apps/web run verify:pc-assembly-workbench`다.
- 최신 surface 기준은 `123 objects`, `15 textures`, `12,118 triangles`이고 최신 cinematic metric은 `bright=0.033`, `clipped=0.019`다.

Removed/Deprecated:
- runtime shadow overlay가 보인다는 이유만으로 surface material/lightmap pass를 완료 처리하는 절차.

## 2026-05-19 변경 동기화 (Foreground Curvature 재검토 절차)
Added:
- furniture hero kit curvature pass를 검토할 때 `assets/references/blender-authored/bruno-furniture-hero-kit/asset-review-2026-05-19.json`에서 `asset.bespokeCurvaturePass.meshFamilies`, `sofaMeshes`, `coffeeTableMeshes`, `stillRequiresHumanArtReview=true`를 확인한다.
- 최신 final-room 검토는 `output/playwright/pc-assembly-workbench-cinematic.png`와 Codex 내부 브라우저 route `/labs/qa/pc-assembly-workbench?qaNoLoader=1&qaComplete=1&qaCinematic=1`를 함께 본다.

Updated:
- 최신 furniture 기준은 `252 objects`, `54,822 triangles`, `11,131,040 bytes`다.
- 최신 automated QA 기준은 `stepCount=38`, `roomStepCount=11`, `audioEvents=50`, `saved=true`, `cinematicUniqueColorBuckets=375`, `cinematicLuminanceStdDev=62.45`, `bright=0.033`, `clipped=0.019`다.
- 수동 판정은 여전히 `not-commercial-ready`다. 내부 브라우저에서 소파/커피테이블 box-read는 줄었지만 wall grid/reveal, material bake, GI/lightmap, package readiness blocker가 남아 있다.

Removed/Deprecated:
- `249 objects / 53,940 triangles` 이전 furniture detail pass metrics를 최신 curvature evidence로 보고하는 절차.
- foreground curvature pass만으로 Bruno Simon급 완성이라고 판단하는 절차.

## 2026-05-19 변경 동기화 (Wall/Floor Line Cleanup 재검토 절차)
Added:
- surface kit를 재생성한 뒤에는 `assets/references/blender-authored/bruno-room-surface-kit/asset-review-2026-05-19.json`에서 `asset.wallRevealCleanupPass.lineOpacityAfter`, `softWashZones`, `gridOverlayRisk`, `stillRequiresBrowserHumanReview`를 확인한다.
- Codex 내부 브라우저 또는 screenshot에서 `/labs/qa/pc-assembly-workbench?qaNoLoader=1&qaComplete=1&qaCinematic=1`를 열어 floor seam, ceiling rib, cove strip, right-wall slab이 장면을 지배하지 않는지 수동 확인한다.

Updated:
- 최신 surface 기준은 `127 objects`, `16 textures`, `12,126 triangles`, `10,547,540 bytes`다.
- 최신 automated QA 기준은 `stepCount=38`, `roomStepCount=11`, `audioEvents=50`, `saved=true`, `cinematicUniqueColorBuckets=379`, `cinematicLuminanceStdDev=62.37`, `bright=0.033`, `clipped=0.019`다.
- 수동 판정은 여전히 `not-commercial-ready`다. wall/floor line cleanup은 artifact 감소 evidence일 뿐 true baked GI/AO, UV/KTX2/ORM, catalog split, human art review를 대체하지 않는다.

Removed/Deprecated:
- grid/reveal line이 눈에 띄는데도 “디테일이 많다”는 이유로 통과시키는 절차.
- 자동 metric만 보고 wall/floor material cleanup을 완료 처리하는 절차.

## 2026-05-19 변경 동기화 (Art-Directed Bounce 재검토 절차)
Added:
- surface kit bounce pass를 검토할 때 `assets/references/blender-authored/bruno-room-surface-kit/asset-review-2026-05-19.json`에서 `asset.textureSet.authoredMaps`에 `artDirectedBounceLightmap`가 포함되는지 확인한다.
- 같은 JSON에서 `asset.artDirectedGiPass.floorBounceZones` 5개와 `wallBounceZones` 4개, `physicallyBaked=false`, `stillRequiresPathTracedBake=true`를 확인한다.
- Codex 내부 브라우저 screenshot `output/playwright/pc-assembly-workbench-codex-browser.png`와 automated cinematic screenshot `output/playwright/pc-assembly-workbench-cinematic.png`를 함께 열어 bounce가 분위기만 더하고 UI-like overlay처럼 보이지 않는지 수동 확인한다.

Updated:
- 최신 surface 기준은 `136 objects`, `17 textures`, `12,144 triangles`, `11,880,204 bytes`다.
- 최신 automated QA 기준은 `stepCount=38`, `roomStepCount=11`, `audioEvents=50`, `saved=true`, `cinematicUniqueColorBuckets=378`, `cinematicLuminanceStdDev=62.31`, `bright=0.033`, `clipped=0.019`다.
- 수동 판정은 여전히 `not-commercial-ready`다. bounce pass는 lighting/bake blocker를 줄이는 중간 evidence이며 true GI, KTX2/ORM package, split catalog asset readiness를 대체하지 않는다.

Removed/Deprecated:
- bounce card 색이 보인다는 이유만으로 GI bake가 완료됐다고 판단하는 절차.
- Meshy/provider generation 없이 만든 로컬 Blender lightmap을 provider asset 확보 evidence로 기록하는 절차.

## 2026-05-19 변경 동기화 (Cycles AO Bake 재검토 절차)
Added:
- surface kit Cycles AO pass를 검토할 때 `assets/references/blender-authored/bruno-room-surface-kit/asset-review-2026-05-19.json`에서 `asset.cyclesAoBakePass.engine=CYCLES`, `bakeType=AO`, `samples=48`, `physicallyBakedAo=true`, `pathTracedGi=false`, `stillRequiresPathTracedGi=true`를 확인한다.
- raw bake preview `assets/runtime-candidates/blender-authored/bruno-room-surface-kit/p2s_bruno_room_surface_kit.cycles-floor-ao-bake.png`와 final room screenshot `output/playwright/pc-assembly-workbench-codex-browser.png`를 함께 열어 AO가 바닥 접지만 돕고 UI-like 얼룩처럼 보이지 않는지 본다.

Updated:
- 최신 surface 기준은 `137 objects`, `18 textures`, `12,146 triangles`, `12,088,420 bytes`다.
- 최신 automated QA 기준은 `stepCount=38`, `roomStepCount=11`, `audioEvents=50`, `saved=true`, `cinematicUniqueColorBuckets=378`, `cinematicLuminanceStdDev=62.37`, `bright=0.033`, `clipped=0.019`다.
- 수동 판정은 여전히 `not-commercial-ready`다. Cycles AO probe는 baked AO evidence지만 path-traced GI, final UV bake, KTX2/ORM package, split catalog readiness를 대체하지 않는다.

Removed/Deprecated:
- Cycles AO probe가 생겼다는 이유만으로 Bruno Simon급 조명 완성 또는 상용 material bake 완료로 판단하는 절차.
- Meshy/provider 호출 없이 만든 Blender AO bake를 외부 에셋 확보 evidence로 기록하는 절차.

## 2026-05-19 변경 동기화 (Packed ORM Sidecar 재검토 절차)
Added:
- surface kit ORM package pass를 검토할 때 `assets/references/blender-authored/bruno-room-surface-kit/asset-review-2026-05-19.json`에서 `asset.textureSet.authoredMaps`에 `packedOrm`이 포함되는지 확인한다.
- 같은 JSON에서 `asset.texturePackagingPass.packageStatus=orm-png-sidecar-ready-ktx2-pending`, `packedOrmMapCount=3`, `packedOrmChannels.r=ambientOcclusion`, `g=roughness`, `b=metallic`, `a=constantOne`, `ktx2Ready=false`, `stillRequiresRuntimeKtx2Transcode=true`, `stillRequiresFinalUvBake=true`를 확인한다.
- sidecar manifest `assets/runtime-candidates/blender-authored/bruno-room-surface-kit/texture-package-2026-05-19.json`와 `textures/*_orm_*.png` 3개가 존재하는지 확인한다.

Updated:
- 최신 surface 기준은 `137 objects`, `21 textures`, `12,146 triangles`, `12,088,404 bytes`다.
- 최신 automated QA 기준은 `stepCount=38`, `roomStepCount=11`, `audioEvents=50`, `saved=true`, `cinematicUniqueColorBuckets=378`, `cinematicLuminanceStdDev=62.37`, `bright=0.033`, `clipped=0.019`다.
- 수동 판정은 여전히 `not-commercial-ready`다. packed ORM PNG sidecar는 material-package blocker를 줄이는 중간 evidence이며 KTX2 transcode, final UV bake, split catalog readiness를 대체하지 않는다.

Removed/Deprecated:
- ORM sidecar가 존재한다는 이유만으로 KTX2 runtime package 또는 Bruno Simon급 상용 material 완료로 판단하는 절차.
- Meshy/provider 호출 없이 만든 Blender PNG package를 외부 에셋 확보 evidence로 기록하는 절차.

## 2026-05-19 변경 동기화 (Runtime Sidecar + Visual Clarity 재검토 절차)
Added:
- ORM sidecar package pass를 재검토할 때 public runtime descriptor `apps/web/public/assets/catalog/runtime-packages/p2s_bruno_room_surface_kit.json`와 runtime index `apps/web/public/assets/catalog/runtime-packages.json`도 함께 확인한다.
- public texture manifest `/assets/models/p2s_bruno_room_surface_kit/texture-package-2026-05-19.json`와 public sidecar 3개가 존재하는지 확인한다.
- final-room visual QA는 `output/playwright/pc-assembly-workbench-cinematic.png`와 Codex 내부 브라우저 screenshot `output/playwright/pc-assembly-workbench-codex-browser.png`를 함께 본다.

Updated:
- 최신 automated QA 기준은 `stepCount=38`, `roomStepCount=11`, `audioEvents=50`, `saved=true`, `cinematicUniqueColorBuckets=380`, `cinematicLuminanceStdDev=64.47`, `bright=0.048`, `clipped=0.021`다.
- 최신 capture clarity pass는 DPR/MSAA/material-response/tone exposure tuning이며 조립 state machine은 변경하지 않았다.
- 수동 판정은 여전히 `not-commercial-ready`다. 화면이 더 선명해졌더라도 KTX2, final UV bake, split LOD/proxy/collider, human art review가 남아 있다.

Removed/Deprecated:
- source candidate manifest만 보고 runtime integration 완료로 판단하는 절차.
- screenshot이 선명해졌다는 이유만으로 상용 에셋 품질 또는 Bruno Simon급 parity를 승인하는 절차.

## 2026-05-19 변경 동기화 (Bruno Surface ORM KTX2 재검토 절차)
Added:
- Bruno surface ORM KTX2 상태를 확인할 때 `npm --workspace apps/web run textures:check:bruno-surface-orm:ktx2 -- --json`을 실행한다.
- 필요 시 `npm --workspace apps/web run textures:encode:bruno-surface-orm:ktx2 -- --json`으로 public ORM PNG 3개를 `.ktx2`로 변환한다. 현재 로컬 encoder는 Homebrew `basis_universal`의 `basisu`다.
- `apps/web/public/assets/models/p2s_bruno_room_surface_kit/texture-package-2026-05-19.json`에서 `packageStatus=ktx2-ready`, `ktx2Ready=true`, `stillRequiresRuntimeKtx2Transcode=false`, maps[].`ktx2Path` 3개를 확인한다.

Updated:
- runtime descriptor와 index도 같은 KTX2 상태를 가져야 한다. `verify:pc-assembly-workbench`는 pending/ready 양쪽을 파일 존재 기준으로 검증한다.
- 최신 QA 기준은 `stepCount=38`, `roomStepCount=11`, `audioEvents=50`, `saved=true`, `cinematicUniqueColorBuckets=380`, `cinematicLuminanceStdDev=64.47`, `bright=0.048`, `clipped=0.021`다.
- 수동 판정은 여전히 `not-commercial-ready`다. KTX2 sidecar는 runtime delivery blocker를 줄였지만 final UV bake, GI, topology, art review를 대체하지 않는다.

Removed/Deprecated:
- `toktx`만 KTX2 승격 경로로 인정하는 절차. 검증된 `basisu` KTX2도 이 QA lane에서 허용한다.
- KTX2 sidecar readiness를 Bruno Simon급 시각 품질 완료로 판단하는 절차.

## 2026-05-19 변경 동기화 (Cinematic Exposure QA 절차)
Added:
- PC assembly final-room exposure를 확인할 때 `PC_ASSEMBLY_QA_VERBOSE=1 npm --workspace apps/web run verify:pc-assembly-workbench`를 실행하고 `cinematicBrightPixelRatio <= 0.12`, `cinematicClippedHighlightRatio <= 0.055`를 확인한다.
- 로컬 dev 서버가 이미 떠 있거나 transient reload가 보이면 새 포트에서 `npm --workspace apps/web run dev -- -p 3101 -H 127.0.0.1`를 띄운 뒤 `-- --base-url=http://127.0.0.1:3101`로 verifier를 실행할 수 있다.
- 결과 스크린샷은 `output/playwright/pc-assembly-workbench-cinematic.png`를 열어 사람이 직접 과노출, 평면감, 에셋 품질을 확인한다.

Updated:
- 최신 기준 수치는 `stepCount=38`, `roomStepCount=11`, `audioEvents=50`, `cinematicUniqueColorBuckets=345`, `cinematicLuminanceStdDev=58.28`, `bright=0.028`, `clipped=0.013`이다.
- QA registry는 첫 생성 직후가 아니라 안정화 후 조작되어야 한다.

Removed/Deprecated:
- route가 처음 렌더됐다는 이유만으로 버튼 조작을 바로 시작하는 절차.
- exposure metric 통과를 Bruno Simon급 상용 승인으로 해석하는 절차.

## 2026-05-19 변경 동기화 (Furniture Continuous Surface QA 절차)
Added:
- furniture hero kit 품질을 재검토할 때 `assets/references/blender-authored/bruno-furniture-hero-kit/asset-review-2026-05-19.json`에서 `triangleBudgetStatus=pass`, `triangleCount <= 65000`, `soft_horizontal_upholstery_surface`, `soft_vertical_upholstery_surface` evidence를 확인한다.
- KTX2 상태는 `npm --workspace apps/web run textures:check:bruno-furniture-orm:ktx2`로 확인한다.
- 최종 장면은 `PC_ASSEMBLY_QA_VERBOSE=1 npm --workspace apps/web run verify:pc-assembly-workbench -- --base-url=http://127.0.0.1:3100`를 실행한 뒤 `output/playwright/pc-assembly-workbench-cinematic.png`를 사람이 직접 확인한다.

Updated:
- 최신 furniture 기준은 `292 objects`, `22 materials`, `22 textures`, `63,714 triangles`, `triangleBudgetStatus=pass`, `11,337,852 bytes`다.
- 최신 automated QA 기준은 `stepCount=38`, `roomStepCount=11`, `audioEvents=50`, `brunoFurnitureOrmConsumed=true`, `brunoFurnitureAoUv2ReadyMeshCount=119`, `cinematicUniqueColorBuckets=309`, `cinematicLuminanceStdDev=67.24`, `bright=0.043`, `clipped=0.027`이다.
- 수동 판정은 여전히 `not-commercial-ready`다. 연속 소파 곡면은 block-read를 줄이는 중간 evidence이며 commercial source asset, final UV bake, GI/lightmap, split LOD/collider package, human art review를 대체하지 않는다.

Removed/Deprecated:
- 오브젝트 수나 장식 수가 늘었다는 이유만으로 furniture asset quality가 상용급이라고 판단하는 절차.
- verifier 통과를 Bruno Simon급 시각 품질 승인으로 해석하는 절차.

## 2026-05-19 변경 동기화 (Foreground Sofa Rear QA 절차)
Added:
- sofa rear 품질을 재검토할 때 `assets/references/blender-authored/bruno-furniture-hero-kit/asset-review-2026-05-19.json`에서 `meshFamilies`에 `soft_rear_upholstery_shell`이 있고 `sofaMeshes`에 `hero_sofa_rear_continuous_wrapped_upholstery_shell`이 포함되는지 확인한다.
- furniture KTX2 상태는 `npm --workspace apps/web run textures:check:bruno-furniture-orm:ktx2`로 확인하고, review JSON의 `texturePackagingPass.packageStatus=ktx2-ready`, `ktx2Ready=true`, `stillRequiresRuntimeKtx2Transcode=false`도 함께 확인한다.
- 최종 장면은 `PC_ASSEMBLY_QA_VERBOSE=1 npm --workspace apps/web run verify:pc-assembly-workbench -- --base-url=http://127.0.0.1:3100`를 실행한 뒤 `output/playwright/pc-assembly-workbench-cinematic.png`에서 sofa rear가 drawer/grid 패널처럼 보이지 않는지 사람이 직접 확인한다.

Updated:
- 최신 furniture 기준은 `282 objects`, `22 materials`, `22 textures`, `63,896 triangles`, `triangleBudgetStatus=pass`, `11,300,956 bytes`다.
- 최신 automated QA 기준은 `stepCount=38`, `roomStepCount=11`, `audioEvents=50`, `brunoFurnitureOrmConsumed=true`, `brunoFurnitureAoUv2ReadyMeshCount=121`, `cinematicUniqueColorBuckets=309`, `cinematicLuminanceStdDev=67.34`, `bright=0.043`, `clipped=0.027`이다.
- 수동 판정은 여전히 `not-commercial-ready`다. sofa rear 연속 shell은 foreground primitive artifact를 줄이는 evidence이며 commercial GLB 확보, final UV bake, GI/lightmap, LOD/collider package, human art review를 대체하지 않는다.

Removed/Deprecated:
- sofa rear의 많은 seam cube/tuft sphere를 상용 upholstery 품질로 판단하는 절차.
- runtime KTX2 파일이 있는데 review metadata가 pending인 상태를 허용하는 절차.

## 2026-05-20 변경 동기화 (Standalone Sofa QA 절차)
Added:
- Foreground sofa QA는 `p2s_premium_dark_sofa.glb`가 브라우저에서 로드되고, authored mode에서 monolithic furniture kit의 `hero_sofa_*` mesh가 숨겨지는지 확인한다.
- 이번 수동 검토 screenshot artifact는 `output/playwright/pc-assembly-workbench-sofa-glb-asset.png`다.

Updated:
- sofa asset 변경 후 기본 검증은 `npm --workspace apps/web run type-check`, `npm --workspace apps/web run lint`, 그리고 `qaComplete=1&qaCinematic=1` route screenshot 확인 순서다.
- 현재 standalone sofa metrics는 `33 nodes`, `33 meshes`, `6 materials`, `23,436 triangles`다.

Removed/Deprecated:
- React overlay-only 변경을 foreground sofa 품질 승인 evidence로 사용하는 절차.

## 2026-05-20 변경 동기화 (Standalone Workstation QA 절차 - Failed Candidate)
Added:
- `p2s_premium_workstation_hero.glb`는 현재 실패 후보로 보관하며, 활성 room path에는 올리지 않는다.
- 재생성 전 필수 QA 문서는 `assets/references/blender-authored/premium-workstation-hero/generation-loop-2026-05-20.md`다.
- 실패 후보의 수동 검토 screenshot artifact는 `output/playwright/pc-assembly-workbench-workstation-hero.png`다.

Updated:
- workstation asset 변경 후 기본 검증은 먼저 standalone asset preview와 reference comparison을 통과한 뒤 `npm --workspace apps/web run type-check`, `npm --workspace apps/web run lint`, `PC_ASSEMBLY_QA_VERBOSE=1 npm --workspace apps/web run verify:pc-assembly-workbench -- --base-url=http://127.0.0.1:3101` 순서다.
- 현재 standalone workstation exported metrics는 `157 nodes`, `157 meshes`, `29 materials`, `1 texture`, `55,076 triangles`다.
- 위 metrics는 로딩/복잡도 evidence일 뿐이며 시각 품질 approval evidence가 아니다.

Removed/Deprecated:
- completed desk setup을 개별 React primitive와 proxy GLB 조합만 보고 승인하는 절차.
- workstation GLB 로드만 확인하고 사람 눈으로 PC 케이스 앞면, 모니터/키보드 비례, 책상 상판 재질, 소품 밀도를 확인하지 않는 절차.
- Blender 생성 후보를 상용/Bruno 레퍼런스와 비교하지 않고 곧바로 scene에 통합하는 절차.

## 2026-05-20 변경 동기화 (Workstation V2/V3 Review Procedure)
Added:
- workstation 후보는 `workstation-v2-review-board.png`, `workstation-v3-review-board.png`처럼 iteration별 review board를 남겨 이전 후보보다 실제로 나아졌는지 확인한다.
- v2가 실패하면 실패 원인을 문서화하고 v3에서 해당 실패 원인을 제거했는지 정량/시각 evidence를 함께 남긴다.

Updated:
- 현재 v3 후보는 `apps/web/public/assets/models/p2s_premium_workstation_hero_v3/p2s_premium_workstation_hero_v3.glb`에 있지만, user-facing room scene에는 연결하지 않는다.
- v3 검토 evidence는 `377 nodes`, `372 mesh/curve objects`, `94,684 triangles`, `4.7M` GLB bytes, magenta-pixel ratio `0.0`, missing external images `0`, unmaterialed objects `0`이다.

Removed/Deprecated:
- "이전보다 좋아 보이는 한 장"만 보고 active scene에 넣는 절차.
- magenta fallback/과채도 같은 명확한 시각 퇴행을 무시하고 세부 오브젝트 수 증가만 성공으로 보는 절차.

## 2026-05-20 변경 동기화 (Workstation V5 UV/PBR 검수 절차)
Added:
- workstation V4/V5 검토 시 `assets/references/blender-authored/premium-workstation-hero/workstation-v5-review-board.png`를 열어 V4 패치워크 결함과 V5 UVAtlas 수정 결과를 비교한다.
- V5 검토 JSON은 `assets/references/blender-authored/premium-workstation-hero/asset-review-v5-2026-05-20.json`이다.
- V5 `.blend` reopen audit에서 `uvAtlasObjects=212`, `activeUvAtlasObjects=212`, `lightmapUv2Objects=212`, `unmaterialedObjects=[]`, `missingExternalImages=[]`를 확인한다.

Updated:
- V4는 atlas와 LightmapUV2를 만들었지만 shader가 `UVAtlas` channel을 명시적으로 쓰지 않아 제품 표면이 patchwork처럼 보이는 결함이 있었다.
- V5는 material에 explicit UV Map node를 추가해 V4 sampling 결함을 고쳤고, isometric cyan-pixel ratio를 `0.0384`에서 `0.0009`로 낮췄다.
- 현재 V5 후보는 `apps/web/public/assets/models/p2s_premium_workstation_hero_v5/p2s_premium_workstation_hero_v5.glb`에 있으며 user-facing room scene에는 아직 연결하지 않는다.

Removed/Deprecated:
- `UVAtlas` layer 존재만 확인하고 실제 preview에서 같은 UV channel이 material에 쓰였는지 확인하지 않는 절차.
- V5를 hand-authored atlas, full GI bake, exact product geometry, LOD/proxy/collider/support package 없이 상용/Bruno-level asset으로 승인하는 절차.

## 2026-05-20 변경 동기화 (Workstation V8 Desk Detail 검수 절차)
Added:
- workstation desk/desktop-object 품질을 검토할 때 `assets/references/blender-authored/premium-workstation-hero/workstation-v8-review-board.png`를 먼저 연다.
- V8 검토 JSON은 `assets/references/blender-authored/premium-workstation-hero/asset-review-v8-2026-05-20.json`이다.
- V8 `.blend` reopen audit 기준은 `uvAtlasObjects=212`, `activeUvAtlasObjects=212`, `detailUvObjects=283`, `lightmapUv2Objects=495`, `unmaterialedObjects=[]`, `missingExternalImages=[]`다.
- V8에서 확인할 사람 눈 기준은 keyboard/mouse/monitor/speaker/PC case/desk/small props가 가까운 카메라에서도 schematic block이 아니라 제품 표면처럼 읽히는지다.

Updated:
- V8 후보는 `apps/web/public/assets/models/p2s_premium_workstation_hero_v8/p2s_premium_workstation_hero_v8.glb`에 있으며 user-facing room scene에는 아직 연결하지 않는다.
- V8 evidence는 `716 nodes`, `710 mesh/curve objects`, `160,500 triangles`, `4` texture images, `9.0M` GLB bytes, `290` marked desktop micro-detail objects다.
- tabletop close-up pixel check는 V7 high-chroma-edge ratio `0.1076`에서 V8 `0.0742`로 낮아졌다.

Removed/Deprecated:
- V8의 오브젝트 수 증가만 보고 상용/Bruno-level 승인으로 처리하는 절차.
- standalone review board 없이 active QA room에 새 workstation GLB를 연결하는 절차.

## 2026-05-20 변경 동기화 (Furniture V2 검수 절차)
Added:
- 방 전체 대형 가구 품질을 검토할 때 `assets/references/blender-authored/bruno-furniture-hero-kit-v2/furniture-v2-overall.png`, `furniture-v2-desk-shelf-closeup.png`, `furniture-v2-lounge-media-closeup.png`를 먼저 확인한다.
- V2 검토 JSON은 `assets/references/blender-authored/bruno-furniture-hero-kit-v2/asset-review-2026-05-20.json`이다.
- V2 `.blend` reopen audit 기준은 `meshOrCurveObjects=518`, `unmaterialedObjects=[]`, `missingExternalImages=[]`다.

Updated:
- 현재 QA room은 V2 furniture GLB와 `texture-package-2026-05-20.json`을 로드한다.
- 검수 시 특히 책상 매트, 러그, 소파 throw의 detail line이 상용 fabric/edge detail이 아니라 사다리/grid artifact처럼 보이는지 확인해야 한다.
- foreground sofa는 `p2s_premium_dark_sofa.glb` 독립 경로를 유지하므로, furniture hero kit의 `hero_sofa_*` mesh hide rule은 정상 동작으로 본다.

Removed/Deprecated:
- 대형 가구 전체를 한 번에 바꾼 뒤 브라우저 screenshot 없이 상용급 개선으로 보고하는 절차.
- V2처럼 active scene에 연결된 후보를 final catalog asset으로 표현하는 절차.

## 2026-05-20 변경 동기화 (Furniture V3 검수 절차)
Added:
- 방 전체 대형 가구 품질을 검토할 때 V3 preview 3장을 먼저 확인한다:
  - `assets/references/blender-authored/bruno-furniture-hero-kit-v3/furniture-v3-overall.png`
  - `assets/references/blender-authored/bruno-furniture-hero-kit-v3/furniture-v3-desk-shelf-closeup.png`
  - `assets/references/blender-authored/bruno-furniture-hero-kit-v3/furniture-v3-lounge-media-closeup.png`
- V3 검토 JSON은 `assets/references/blender-authored/bruno-furniture-hero-kit-v3/asset-review-2026-05-20.json`이다.
- Runtime screenshot evidence는 `output/playwright/qa-3100-furniture-v3-runtime.png`를 사용한다.

Updated:
- 현재 QA room은 V3 furniture GLB와 V3 `texture-package-2026-05-20.json`을 로드한다.
- V3 `.blend` reopen audit 기준은 visible mesh/curve `627`, `unmaterialedObjects=[]`, `missingExternalImages=[]`다.
- V3 검수 시 V2에서 문제가 됐던 책상 매트/러그/소파 throw의 ladder/grid artifact가 사라졌는지 먼저 확인하고, 그 다음 가구별 silhouette과 material response를 본다.

Removed/Deprecated:
- stale 3100 서버가 `_next/static` 404를 내는 상태에서 “변화 없음”으로 판단하거나 완료 보고하는 절차.
- V3 art-pass 후보를 최종 상용 카탈로그 자산으로 표현하는 절차.

## 2026-05-20 변경 동기화 (Commercial Desk Image-Texture 검수 절차)
Added:
- 책상 단독 품질을 볼 때 아래 세 장을 먼저 확인한다:
  - `assets/references/blender-authored/commercial-desk-hero-v1/previews/commercial-desk-v1-isometric.png`
  - `assets/references/blender-authored/commercial-desk-hero-v1/previews/commercial-desk-v1-surface-closeup.png`
  - `assets/references/blender-authored/commercial-desk-hero-v1/previews/commercial-desk-v1-left-frame-closeup.png`
- 이미지모델 원본 텍스처는 `assets/references/blender-authored/commercial-desk-hero-v1/imagegen/walnut-desktop-source-imagegen-20260520.png`에서 확인한다.
- 검수 기준은 상판과 앞쪽 bullnose/side band가 절차형 노이즈나 플라스틱 판이 아니라 실제 오일드 우드 표면처럼 보이는지, 제거된 서랍부가 다시 생기지 않았는지다.

Updated:
- 브라우저 QA는 `?qaNoLoader=1&qaComplete=1&qaCinematic=1&qaNoCommunity=1`로 커뮤니티 에셋을 끄고 확인한다.

Removed/Deprecated:
- 이미지모델 원본을 바로 최종 재질로 간주하는 절차. 원본은 source이고, runtime GLB에는 톤 보정된 basecolor와 파생 roughness/height가 들어가야 한다.

## 2026-05-21 변경 동기화 (Commercial Task Chair 검수 절차)
Added:
- chair 단독 품질을 볼 때 아래 세 장을 먼저 확인한다:
  - `assets/references/blender-authored/commercial-task-chair-hero-v1/previews/commercial-task-chair-v1-isometric.png`
  - `assets/references/blender-authored/commercial-task-chair-hero-v1/previews/commercial-task-chair-v1-back-mesh-closeup.png`
  - `assets/references/blender-authored/commercial-task-chair-hero-v1/previews/commercial-task-chair-v1-base-caster-closeup.png`
- 검토 JSON은 `assets/references/blender-authored/commercial-task-chair-hero-v1/asset-review-2026-05-21.json`이다.
- Meshy 생성 후보를 만들려면 먼저 `assets/references/blender-authored/commercial-task-chair-hero-v1/meshy-prompt-pack-2026-05-21.json`의 prompt/reference policy를 확인하고 승인된 뒤에만 provider POST를 보낸다.

Updated:
- `/labs/qa/pc-assembly-workbench?qaNoLoader=1&qaComplete=1&qaCinematic=1&qaNoCommunity=1`에서 chair가 기존 블록 proxy가 아니라 `p2s_commercial_task_chair_hero_v1` GLB로 보이는지 확인한다.
- chair runtime package는 meshopt 적용 여부, `releaseEligible=false`, `reviewRequired=true`, procedural PBR map 경로를 함께 확인한다.

Removed/Deprecated:
- block-based procedural chair를 방 전체 visual QA의 최종 chair evidence로 보는 절차.
- Meshy prompt/reference 검토 없이 새 유료 generation을 실행하는 절차.

## 2026-05-21 변경 동기화 (Commercial Desk Accessory Kit 검수 절차)
Added:
- 책상 위 prop cluster 품질을 볼 때 아래 세 장을 먼저 확인한다:
  - `assets/references/blender-authored/commercial-desk-accessory-kit-v1/previews/commercial-desk-accessory-kit-v1-isometric.png`
  - `assets/references/blender-authored/commercial-desk-accessory-kit-v1/previews/commercial-desk-accessory-kit-v1-keyboard-closeup.png`
  - `assets/references/blender-authored/commercial-desk-accessory-kit-v1/previews/commercial-desk-accessory-kit-v1-speaker-monitor-closeup.png`
- 검토 JSON은 `assets/references/blender-authored/commercial-desk-accessory-kit-v1/asset-review-2026-05-21.json`이다.
- Meshy 생성 후보를 만들려면 먼저 `assets/references/blender-authored/commercial-desk-accessory-kit-v1/meshy-prompt-pack-2026-05-21.json`의 prompt/reference policy를 확인하고 승인된 뒤에만 provider POST를 보낸다.

Updated:
- `/labs/qa/pc-assembly-workbench?qaNoLoader=1&qaComplete=1&qaCinematic=1&qaNoCommunity=1`에서 completed desktop setup이 기존 scattered proxy가 아니라 `p2s_commercial_desk_accessory_kit_v1` GLB로 보이는지 확인한다.
- desk accessory runtime package는 meshopt 적용 여부, `releaseEligible=false`, `reviewRequired=true`, procedural PBR map 경로, `ktx2Ready=false` 상태를 함께 확인한다.
- 키보드는 tiny text decal이 아니라 keycap shape, spacing, subtle inset marks로 평가한다.

Removed/Deprecated:
- 모니터/키보드/마우스/램프/스피커를 각기 다른 proxy scale로 섞은 화면을 desktop prop final evidence로 보는 절차.
- distorted text label을 close-up 검수에서 허용하는 절차.

## 2026-05-21 변경 동기화 (Commercial Desk Accessory Kit V2 검수 절차)
Added:
- 책상 위 prop cluster 품질을 볼 때 이제 V2 preview 3장을 먼저 확인한다:
  - `assets/references/blender-authored/commercial-desk-accessory-kit-v2/previews/commercial-desk-accessory-kit-v2-isometric.png`
  - `assets/references/blender-authored/commercial-desk-accessory-kit-v2/previews/commercial-desk-accessory-kit-v2-keyboard-mouse-closeup.png`
  - `assets/references/blender-authored/commercial-desk-accessory-kit-v2/previews/commercial-desk-accessory-kit-v2-monitor-speaker-closeup.png`
- 검토 JSON은 `assets/references/blender-authored/commercial-desk-accessory-kit-v2/asset-review-2026-05-21.json`이다.
- Meshy 생성 후보를 만들려면 먼저 `assets/references/blender-authored/commercial-desk-accessory-kit-v2/meshy-prompt-pack-2026-05-21.json`의 prompt/reference policy를 확인하고 승인된 뒤에만 provider POST를 보낸다.

Updated:
- `/labs/qa/pc-assembly-workbench?qaNoLoader=1&qaComplete=1&qaCinematic=1&qaNoCommunity=1`에서 completed desktop setup이 `p2s_commercial_desk_accessory_kit_v2` GLB로 보이는지 확인한다.
- 검수 우선순위는 실제 치수와 비례다: compact keyboard 약 312mm, productivity mouse 약 125mm, compact speakers 약 100x175x141mm, monitor light bar 약 500mm.
- runtime package는 meshopt byte reduction, `releaseEligible=false`, `reviewRequired=true`, `realScaleReferenceMm`, Meshy provider POST 미실행 상태를 함께 확인한다.

Removed/Deprecated:
- V1 accessory GLB를 최신 desktop prop 품질 evidence로 보는 절차.
- 제품 로고나 보호되는 정확한 외형 복제를 “실제와 동일”의 구현 방식으로 해석하는 절차. 실제 구현은 치수/재질/구성 hierarchy를 맞추되 generic self-authored geometry로 유지한다.

## 2026-05-21 변경 동기화 (Mechanical Keyboard Switch Lab 검수 절차)
Added:
- 키보드 단독 품질을 볼 때 아래 두 장을 먼저 확인한다:
  - `assets/references/blender-authored/mechanical-keyboard-switch-lab-v1/previews/mechanical-keyboard-v1-isometric.png`
  - `assets/references/blender-authored/mechanical-keyboard-switch-lab-v1/previews/mechanical-keyboard-v1-switch-closeup.png`
- 검토 JSON은 `assets/references/blender-authored/mechanical-keyboard-switch-lab-v1/asset-review-2026-05-21.json`이다.

Updated:
- `/labs/qa/pc-assembly-workbench?qaNoLoader=1&qaComplete=1&qaCinematic=1&qaNoCommunity=1`에서 keyboard/mouse placed 이후 keyboard가 `p2s_mechanical_keyboard_switch_lab_v1` GLB로 보이는지 확인한다.
- 우측 `keyboard switch` 패널에서 적축/청축/갈축을 선택한 뒤 `타건`을 눌러 축별 cue가 다르게 들리는지 확인한다.
- runtime package는 `pressTargets`, `switchProfiles`, `defaultSwitchProfile=linear-red`, self-authored license 상태를 함께 확인한다.

Removed/Deprecated:
- 키보드 close-up에서 단순 키캡 배열만 보고 mechanical keyboard 구현 완료로 판단하는 절차.
- WebAudio 합성음을 최종 상용 사운드로 승인하는 절차. 최종 승격에는 녹음 기반 WAV layer와 human audio QA가 필요하다.

## 2026-05-21 변경 동기화 (ABKO AR108G Reference Keyboard 검수 절차)
Added:
- Compuzone ABKO AR108G reference keyboard 품질을 볼 때 아래 preview를 먼저 확인한다:
  - `assets/references/blender-authored/abko-ar108g-sage-green-keyboard-v1/previews/abko-ar108g-v1-isometric.png`
  - `assets/references/blender-authored/abko-ar108g-sage-green-keyboard-v1/previews/abko-ar108g-v1-keycap-closeup.png`
  - `assets/references/blender-authored/abko-ar108g-sage-green-keyboard-v1/previews/abko-ar108g-v1-underside.png`
- 검토 JSON은 `assets/references/blender-authored/abko-ar108g-sage-green-keyboard-v1/asset-review-2026-05-21.json`이다.

Updated:
- `/labs/qa/pc-assembly-workbench?qaNoLoader=1&qaComplete=1&qaCinematic=1&qaNoCommunity=1`에서 keyboard/mouse placed 이후 keyboard가 `p2s_abko_ar108g_sage_green_keyboard_v1` GLB로 보이는지 확인한다.
- runtime package는 ABKO/AR108G/product URL, `releaseEligible=false`, `pressTargets >= 100`, 청축 `50G`, material slots를 함께 확인한다.
- 우측 `keyboard switch` 패널 기본값은 ABKO AR108G 청축이고, `타건` 버튼은 합성 clicky-blue cue를 재생해야 한다.

Removed/Deprecated:
- `p2s_mechanical_keyboard_switch_lab_v1`를 최신 키보드 visual QA evidence로 보는 절차.
- 라이선스가 정리되지 않은 브랜드 reference asset을 public catalog/release-ready로 판단하는 절차.
