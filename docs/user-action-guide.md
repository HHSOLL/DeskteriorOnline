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

## 2) 핵심 QA/E2E 순서

아래 체크리스트를 기본 회귀 기준으로 사용합니다.

1. 홈(`/`)에서 상단 bar에 브랜드와 로그인/로그아웃 버튼이 노출되는지 확인하기
2. 홈(`/`)에서 `공간 선택` 카드 진입하기
3. `빈 공간` 템플릿 하나를 골라 builder가 아니라 editor로 바로 진입하는지 확인하기
4. 홈(`/`)로 돌아와 `가구가 비치된 공간` 템플릿 목록으로 진입하기
5. 가구 배치 템플릿 하나를 골라 pre-seeded editor 흐름이 생성되는지 확인하기
6. 템플릿 목록에서 `더보기` 버튼이 같은 mode 안에서만 동작하고, 실제 추가 템플릿이 없으면 노출되지 않는지 확인하기
7. 홈(`/`)로 돌아와 `공간 만들기` 카드 진입하기
8. builder step 2/3/4/5가 데스크톱 viewport 안에서 고정 navbar 아래에 가려지지 않고 보이는지 확인하기
9. 치수 조정 시 overlay와 실제 room shape가 같이 바뀌는지 확인하기
10. step 2 좌측 guide와 우측 preview가 같은 실제 outline을 보여주는지 확인하기
11. step 3/4/5 preview에서 휠 줌 + 드래그 orbit이 방 중심 기준으로 동작하는지 확인하기
12. 문/창문 추가 시 asset이 바닥에 눕지 않고 wall plane에 수직으로 서 보이며, style 선택 전에는 기본 흰 벽/흰 바닥 shell이 유지되는지 확인하기
13. 스타일과 조명 모드(직접등/간접등)를 선택한 뒤 에디터로 진입하기
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
26. desk precision mode에서 선택 자산을 고르면 inspector와 measurement overlay가 같은 X/Z/Y(mm), Yaw(deg), 실측 W/D/H(mm)를 일관되게 보여주는지 확인하기
27. desk precision mode에서 surface anchor 제품을 고르면 inspector와 overlay에 같은 support asset / support surface / surface size / margin / top 높이가 표시되고, 비-surface anchor에서는 lock off로 보이는지 확인하기
28. desk precision mode에서 surface anchor 제품을 고르면 inspector와 overlay의 micro-view marker가 같은 support-local 위치를 가리키고, offset 수치와도 일치하는지 확인하기
29. desk precision mode에서 surface anchor 제품을 고르면 inspector와 overlay가 같은 footprint / projected footprint / edge clearance / relative yaw를 보여주고, usable area를 넘기면 overflow 상태로 바뀌는지 확인하기
30. desk precision mode에서 surface anchor 제품을 고르면 inspector와 overlay의 `front(X/H)` / `side(Z/H)` helper view가 같은 projected span, gap, reach를 보여주는지 확인하기
31. desk precision mode에서 small asset 다수 장면에서도 hover/select 시작 지연이 `deskterioronline:interaction-latency` 기준으로 급격히 튀지 않는지 확인하기
32. builder lighting step에서 `직접등` 선택 시 beam glow가, `간접등` 선택 시 천장 확산광이 preview에 반영되는지 확인하기
33. room mode에서는 후처리/동적 조명이 꺼지고, desk precision mode에서는 정밀 확인에 필요한 저비용 bloom/조명만 선택적으로 올라오는지 확인하기
34. shared viewer는 editor보다 더 가벼운 read-only preset으로 열리고, hotspot drawer 동작에는 영향이 없는지 확인하기
35. shared viewer 첫 진입 시 어떤 제품도 자동 선택되지 않고, hotspot 또는 목록 선택 이후에만 상세 카드가 열리는지 확인하기
36. gallery/community에서 room/tone/density 필터를 건 뒤 header count와 다음 페이지 total이 현재 필터 결과 기준으로 유지되는지 확인하기
37. community에서 최신 게시, featured 장면, 주요 컬렉션 summary가 현재 페이지 카드 조각이 아니라 active filter scope 전체 기준으로 유지되는지 확인하기
38. shared viewer와 builder preview가 constrained 환경에서 fill light + bloom 없이도 읽기 흐름을 유지하고, walk/showcase에서만 richer shadow/bloom이 유지되는지 확인하기
39. `NEXT_PUBLIC_ENABLE_REALTIME_LABS=1`로 로컬 실행 시 `/labs/realtime`만 열리고, primary navigation에는 realtime/presence 진입점이 생기지 않는지 확인하기
40. `assets:verify:deskterior` 실행 시 curated `p2s_*` 자산이 `source/license/pivot/collisionProxy/textureSet/lodProfile` 계약까지 모두 통과하는지 확인하기
41. `verify:scene-document`, `verify:public-scene` 실행 시 위 product contract metadata가 save/load/share roundtrip에서 유지되는지 확인하기
42. `verify:asset-lod` 실행 시 complex asset은 room mode에서 더 빨리 proxy fallback 되고, simple asset은 desk precision에서 full detail을 유지하는지 확인하기
43. `verify:asset-instancing` 실행 시 read-only top/walk와 builder preview, editor `desk precision`, editor `room mode` idle에서 repeated `single_mesh` 자산이 cluster로 묶이고, room mode dragging 중에는 selected asset이 cluster 안에서 live drag 되다가 pointer-up 후 개별 경로로 빠지는지 확인하기
44. desk precision / builder preview / richer showcase 경로는 Neutral tone mapping으로, room mode / shared viewer / 기본 walk viewer는 ACES tone mapping으로 읽히며 하이라이트 clipping과 white balance가 mode 목적에 맞게 유지되는지 확인하기
45. editor walk와 richer showcase 경로에서만 SSR이 보수적으로 올라오고, shared viewer / top-view / builder preview에서는 SSR이 꺼져 있는지 확인하기
46. `verify:showcase-activity` 실행 시 recent/rich scene이 older/sparse scene보다 높은 activity rank를 받고, community featured / conversation link가 showcase presentation 경로를 유지하는지 확인하기
47. showcase 카드 진입 shared viewer는 일반 shared 링크보다 walk framing이 더 타이트하고, top framing이 살짝 더 조여지며, walk mode에서 rim/fill light가 더 풍부하게 읽히는지 확인하기

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
E2E_ROOM_FLOW_STRICT=1 npm --workspace apps/web run primary:e2e:room-flow:strict
npm --workspace apps/web run primary:e2e:room-flow:full
```

`primary:e2e:room-flow:full`은 Supabase 환경 변수가 없는 환경에서는 실행되지 않습니다.

성능 계측 팁:
- dev에서는 브라우저 콘솔에서 바로 `deskterioronline:renderer-stats`, `deskterioronline:interaction-latency` 이벤트를 구독하면 된다.
- production build 측정 시에는 URL에 `?telemetry=1`을 붙이거나 콘솔에서 `window.__DESKTERIORONLINE_TELEMETRY__ = true`를 설정한 뒤 새로고침한다.
- 최신 샘플은 `window.__DESKTERIORONLINE_LAST_RENDERER_STATS__`, `window.__DESKTERIORONLINE_LAST_INTERACTION_LATENCY__`에서도 확인할 수 있다.
- regression report는 `window.__DESKTERIORONLINE_TELEMETRY_CAPTURE__.start(...)`로 측정을 시작하고 `stop(...)`으로 JSON entry를 얻는다.
- 측정이 끝나면 `npm --workspace apps/web run perf:report:verify -- --report=/absolute/path/to/perf-report.json`으로 예산과 coverage를 검증한다.
- baseline 비교가 필요하면 `--baseline=/absolute/path/to/previous-report.json`을 같이 준다.

## 3) 배포 전 체크리스트

- 빌더/에디터/뷰어 공통 레이아웃이 유지되는지 확인
- 에디터 상단 bar, 좌측 rail, 우측 zoom rail, 하단 pill toolbar가 레퍼런스 7번 shell로 노출되는지 확인
- 상단뷰에서는 `목록/속성/항목뷰/이동/회전` 보조 UI가 사라지고 `추가/설정` drawer 패턴만 남는지 확인
- 상단뷰 하단 pill toolbar에서 `룸 배치` / `데스크 정밀` 토글이 보이고, 워크뷰에서는 사라지는지 확인
- builder opening preview에서 문/창문이 실제 opening asset처럼 서 있고, style 선택 전에는 white wall/white floor shell이 유지되는지 확인
- builder opening preview에서 문/창문이 floor에 눕지 않고 wall plane에 수직으로 붙는지 확인
- builder style 선택지에 room shape 8종, wall finish 7종, floor finish 9종 이상이 노출되는지 확인
- room mode와 desk precision mode 전환 시 체감 화질과 idle 비용이 달라지고, 워크뷰 품질에는 영향을 주지 않는지 확인
- editor 상단뷰가 orthographic footprint처럼만 보이지 않고, builder와 비슷한 perspective orbit 품질로 열리는지 확인
- walk view에서 카메라를 돌렸을 때 벽 backface/near clip 때문에 검정 화면이 나오지 않는지 확인
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
- shared viewer가 generic showcase viewer와 다른 경량 preset으로 동작해도 제품 hotspot / drawer 읽기 흐름은 유지되는지 확인
- shared viewer walk HUD는 터치 조작용 요소만 남고 crosshair는 보이지 않는지 확인
- shared viewer가 상단 light bar, 우측 zoom rail, 하단 readonly status pill 기준으로 노출되는지 확인
- shared viewer와 builder preview는 lean light rig(no fill light)를 유지하고, constrained 환경에서는 directional shadow + bloom이 제거되는지 확인
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
  - 브랜드
  - 가격
  - 옵션/규격
  - 실제 규격(W/D/H mm)
  - 마감 색상/재질
  - 디테일 노트
  - 원본 상품 링크

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
- `assets:sync:ktx2-transcoder -- --check`와 idle 안정화 확인 항목을 QA 체크리스트에 추가했다.
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
- `verify:asset-instancing`로 read-only top/walk + builder preview instancing eligibility와 repeated cluster grouping을 검증하는 QA 항목을 추가했다.

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
