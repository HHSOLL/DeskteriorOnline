# 성능 예산 (핵심 경로)

이 문서는 공간 우선 핵심 경로(`빌더 -> 에디터 -> 발행 -> 읽기 전용 뷰어`) 기준의 성능 예산과 측정 절차를 정의합니다.

## Scope

- `/studio/builder`
- `/project/[id]`
- `/shared/[token]`
- `/gallery`
- `/community`

## Budget (P2)

### Route shell
- 빌더 경로 셸 FCP p95: `<= 2.8s`
- 에디터 경로 셸 FCP p95: `<= 3.2s`
- Shared/Gallery/Community route shell FCP p95: `<= 2.5s`
- 연속 2회 진입 기준 heap 증가율: `<= 0.8%p`

### Interaction
- room mode FPS: 중간급 노트북에서 `55~60 FPS`
- desk precision mode FPS: 중간급 노트북에서 `45~60 FPS`
- 에디터 상호작용은 가구 선택/이동/회전 2초 이상 반복 시 장시간 dropped frame이 지속되지 않아야 한다.
- picking latency(hover/select/drag 시작): `<= 50ms`
- room placement tolerance: `<= 10mm`
- desk placement tolerance: `1~5mm` 체감 오차 범위 유지
- idle 상태에서는 CPU가 지속적으로 상승하지 않고 안정화되어야 한다.

### Render cost
- room mode draw calls: `300~500` 범위 내 관리
- desk precision mode draw calls: `500~700` 범위 내 관리
- `renderer.info.memory.textures`와 `renderer.info.memory.geometries`는 장시간 편집 중 지속 증가하지 않아야 한다.
- hero asset runtime size: `5~15MB` 권장, 소품은 이보다 작아야 한다.
- baseColor texture: 기본 `1K`, hero `2K`, 예외적으로만 `4K`
- 동적 조명 예산:
  - 가구 기반 point/spot light 활성 수 `<= 6`
  - 조명 자산 없는 장면에서 추가 light pass 없음
- 품질 프로필 예산:
  - `viewer-shared`와 builder preview는 secondary fill directional light를 기본으로 켜지 않는다.
  - constrained shared/viewer-preview는 directional shadow + bloom을 우선 제거하고, subtle vignette/noise만 허용한다.
  - room mode, desk precision mode, builder preview는 idle 상태에서 `frameloop="demand"`를 기본으로 사용한다.

### Read-only viewer
- 읽기 전용 뷰어는 에디터 전용 transform/delete 계층을 포함하지 않는다.
- shared scene 초기 진입 시 editor보다 가벼운 interaction tree와 quality preset을 유지한다.

## Scenario Matrix

- empty room: builder 또는 editor에 빈 공간만 로드된 상태
- furnished room: 대표 가구 10개 수준의 표준 장면
- dense desk: 책상 위 소형 오브젝트 30개 이상 배치된 정밀 편집 장면
- high fidelity toggle: shadow, post FX, lighting preset이 켜진 시각 품질 확인 장면

Baseline artifacts:
- `benchmark-scenes/empty-room.json`
- `benchmark-scenes/standard-room.json`
- `benchmark-scenes/dense-desk.json`
- `benchmark-scenes/heavy-assets.json`
- `benchmark-runner/collect-baseline.ts`
- curated runtime asset benchmark는 `asset:publish`가 생성한 runtime package descriptor + sidecar(`colliders`, `support-surfaces`, `qa-report`)가 최신 상태라는 전제를 둔다.

```bash
npm --workspace apps/web run benchmarks:collect:baseline
```

## Primary Contract Check

- 스크립트: `apps/web/scripts/e2e-primary-room-flow.ts`
- 목적: primary surface 접근성/라우트 계약 검증
- 실행:

```bash
npm --workspace apps/web run primary:e2e:room-flow
E2E_ROOM_FLOW_STRICT=1 npm --workspace apps/web run primary:e2e:room-flow:strict
```

## Profiling Procedure

1. `npm --workspace apps/web run build`
2. `npm --workspace apps/web run start -- --hostname 127.0.0.1 --port 3100`
3. 가능하면 `npm run dev:web`와 production build 둘 다 측정한다.
4. DevTools Performance Monitor에서 FPS, CPU, JS heap을 켠다.
5. DevTools Performance로 각 경로 최초 진입 3회, 재진입 2회 측정한다.
6. 각 Scenario Matrix를 기준으로 20초 상호작용을 반복한다.
7. room mode, desk precision mode, builder preview는 조작을 멈춘 뒤 5초간 idle CPU와 frame 발생이 안정화되는지 본다.
8. 아래 토글을 하나씩 끄고 같은 장면을 다시 측정한다.
   - shadows
   - postprocessing
   - SSR
   - SSAO
   - envMap
   - antialias
   - physics/collision
   - selection outline
   - grid/gizmo/labels
9. Web Vitals(FCP/LCP/INP), memory timeline, `renderer.info` 수치를 함께 기록한다.
10. 결과를 PR 코멘트 또는 release note에 아래 형식으로 첨부한다.

## Required Metrics

- DevTools Performance Monitor: FPS, CPU, JS heap
- DevTools Performance: Frames, Main, GPU, Network
- `renderer.info.render.calls`
- `renderer.info.render.triangles`
- `renderer.info.memory.textures`
- `renderer.info.memory.geometries`
- custom timestamp logs for hover/select/drag latency

## Telemetry Hooks

- 개발 모드에서는 `/project/[id]`, `/shared/[token]` 등 `SceneViewport`를 쓰는 경로가 기본으로 `deskterioronline:renderer-stats`, `deskterioronline:interaction-latency` 브라우저 이벤트를 발행한다.
- production build에서는 URL에 `?telemetry=1`을 붙이거나 `window.__DESKTERIORONLINE_TELEMETRY__ = true`를 먼저 설정한 뒤 같은 이벤트를 켠다.
- 최신 샘플은 `window.__DESKTERIORONLINE_LAST_RENDERER_STATS__`, `window.__DESKTERIORONLINE_LAST_INTERACTION_LATENCY__`, `window.__DESKTERIORONLINE_LAST_BVH_BUILD__`에 남는다.
- 캡처 세션은 `window.__DESKTERIORONLINE_TELEMETRY_CAPTURE__`로 시작/종료하며, 종료 시 예산 검증용 regression entry JSON을 반환한다.
- `renderer-stats`는 약 1초 간격으로 FPS / draw calls / triangles / textures / geometries를 보낸다.
- `interaction-latency`는 hover / select / drag-start / gizmo-drag-start의 next-paint 기준 지연을 보낸다.
- `bvh-build`는 geometry UUID / triangle count / duration / worker|sync mode를 기록해 large geometry BVH offload 동작 여부를 확인한다.
- `runtime-document-patch`는 top-view transform commit 시 runtime patch 개수와 대상 object를 기록해 preview/commit 분리 여부를 확인할 수 있다.
- selected asset transform preview는 renderer object mutation 경로로 반영되어, commit 전에도 React re-render 없이 visual update가 가능한 상태를 유지해야 한다.
- instanced cluster는 dirty object 기준 matrix/version sync만 수행하고, 동일 batch 전체를 매번 재생성하지 않는 방향을 유지해야 한다.
- runtime scene이 document replace로 재컴파일될 때도 scene generation 기준으로 stale renderer snapshot을 재사용하지 않아야 한다.

```js
window.addEventListener("deskterioronline:renderer-stats", (event) => {
  console.table(event.detail);
});

window.addEventListener("deskterioronline:interaction-latency", (event) => {
  console.log(event.detail);
});

window.addEventListener("deskterioronline:bvh-build", (event) => {
  console.log(event.detail);
});
```

```js
window.__DESKTERIORONLINE_TELEMETRY_CAPTURE__.start({
  scenario: "dense-desk",
  build: "production",
  interactionProfile: "desk-precision"
});

// 20초 정도 상호작용 후
window.__DESKTERIORONLINE_TELEMETRY_CAPTURE__.stop({
  fcpP95Ms: 2890,
  heapGrowthPercentPoints: 0.4,
  placementToleranceMm: 3,
  interactionNote: "drag/rotate 중 지속 frame drop 없음"
});
```

## Regression Report Format

- 리포트 파일은 `entries` 배열을 가진 JSON 객체이거나, entry 배열 단독 JSON이어도 된다.
- 각 entry는 최소한 `route`, `scenario`, `build`, `interactionProfile`, `fcpP95Ms`, `heapGrowthPercentPoints`, `fpsAvg`, `fpsMin`, `drawCalls`, `triangles`, `textures`, `geometries`, `pickingLatencyP95Ms`, `interactionNote`를 포함해야 한다.
- `room-mode`, `desk-precision` entry는 `placementToleranceMm`도 필수다.
- 보고서 전체는 4개 시나리오(`empty-room`, `furnished-room`, `dense-desk`, `high-fidelity-toggle`)와 2개 build(`dev`, `production`)를 모두 포함해야 한다.

검증 명령:

```bash
npm --workspace apps/web run perf:report:verify -- --report=/absolute/path/to/perf-report.json
npm --workspace apps/web run perf:report:verify -- --report=/absolute/path/to/perf-report.json --baseline=/absolute/path/to/perf-baseline.json
```

`--baseline`를 같이 주면 동일한 `route + scenario + build + interactionProfile` 키 기준으로 delta를 출력한다.

```text
route: /project/[id]
scenario: dense desk
build: production
FCP p95: 2.9s
heap growth (2nd load): +0.5%p
draw calls: 612
textures: 84
geometries: 129
picking latency p95: 42ms
interaction note: drag/rotate 동안 눈에 띄는 frame drop 없음
```

## Guardrails

- 성능 회귀는 추측으로 처리하지 않고 Scenario Matrix와 Required Metrics를 같이 남긴다.
- heavy model은 lazy load를 기본으로 유지
- 읽기 전용 뷰어는 에디터보다 가벼운 interaction tree 유지
- 조명 제품은 카탈로그 힌트 기반으로만 동적 light를 켜고, 상한(6개)을 반드시 유지
- 신규 runtime 자산은 파일 크기, texture 크기, draw call 영향도를 같이 검토한다.
- top-view / builder-preview가 continuous frameloop를 다시 사용해야 한다면 이유와 invalidate 대체 경로를 함께 남긴다.
- publish/share/public 뷰어 실패는 로깅 이벤트로 남겨 재현 가능해야 함
- 회귀가 budget 초과 시, 기능 추가보다 성능 회귀 원인 제거를 우선

## 2026-04-19 변경 동기화 (Top Render Ladder Split)
Added:
- room mode는 low-DPR / no post FX / no dynamic lights, desk precision mode는 higher-DPR / selective post FX / capped dynamic lights로 측정한다.

Updated:
- top-view 측정 대상을 단일 preset에서 `room mode`와 `desk precision mode`로 분리한다.

Removed/Deprecated:
- 상단뷰 전체를 하나의 render budget으로만 취급하는 측정 가정.

## 2026-04-19 변경 동기화 (Viewer Preset Split)
Added:
- shared viewer는 `viewer-shared` 경량 preset 기준으로 측정하고, 향후 showcase viewer는 별도 `viewer-showcase` 기준으로 측정한다.

Updated:
- read-only viewer 측정을 단일 viewer preset에서 shared viewer 전용 preset 기준으로 분리한다.

Removed/Deprecated:
- shared viewer와 showcase viewer를 같은 walk/top 예산으로 합산 측정하는 가정.

## 2026-04-19 변경 동기화 (Shared Viewer Runtime Lightweight Pass)
Added:
- shared viewer 최초 진입 시 자동 제품 선택 없이 baseline idle 비용을 측정한다.

Updated:
- shared viewer HUD 측정을 crosshair 제외 기준으로 갱신한다.

Removed/Deprecated:
- shared viewer idle baseline에 자동 선택 상태와 crosshair HUD를 포함하는 가정.

## 2026-04-19 변경 동기화 (Render Cost Reallocation)
Added:
- shared viewer / builder preview의 fill light, bloom, shadow 제거 순서를 예산 문서에 고정했다.

Updated:
- post FX 측정 기준을 `shared=subtle`, `desk precision=selective bloom`, `full walk/showcase=richer pass`로 구분한다.

Removed/Deprecated:
- 모든 non-top 모드가 같은 bloom/shadow/fill-light 비용을 측정한다는 가정.

## 2026-04-19 변경 동기화 (Telemetry Hooks)
Added:
- `SceneViewport` 공용 경로에 `deskterioronline:renderer-stats` / `deskterioronline:interaction-latency` 브라우저 이벤트 기반 계측 훅을 추가했다.

Updated:
- `renderer.info` 측정 절차를 "수동 콘솔 조회"에서 "1초 샘플링 이벤트 + 최신 스냅샷 window slot" 기준으로 구체화했다.

Removed/Deprecated:
- 조작 지연을 ad-hoc DevTools 타임라인에서만 확인하던 측정 방식.

## 2026-04-20 변경 동기화 (BVH Build Telemetry)
Added:
- `deskterioronline:bvh-build` 브라우저 이벤트와 `window.__DESKTERIORONLINE_LAST_BVH_BUILD__` 스냅샷을 추가했다.

Updated:
- Telemetry Hooks 범위를 `renderer-stats + interaction-latency`에서 `renderer-stats + interaction-latency + bvh-build`까지 확장한다.

Removed/Deprecated:
- BVH generation offload 동작 여부를 코드 추측이나 수동 로그에만 의존하던 측정 방식.

## 2026-04-19 변경 동기화 (Regression Report Workflow)
Added:
- `window.__DESKTERIORONLINE_TELEMETRY_CAPTURE__` 기반 capture session과 `perf:report:verify` CLI를 regression report 표준 경로로 추가했다.

Updated:
- Phase 1 측정 절차를 `이벤트 구독`에서 `capture -> JSON report -> budget/baseline verify` 루프로 확장했다.

Removed/Deprecated:
- PR 코멘트에 수치를 자유 형식 텍스트로만 남기던 방식.

## 2026-04-19 변경 동기화 (Demand Frame Loop Budget)
Added:
- room mode, desk precision mode, builder preview의 idle 안정화 측정과 demand frameloop 기본 예산을 추가했다.

Updated:
- 성능 가드레일을 draw call/DPR/post FX 예산 중심에서 frame loop 정책과 invalidate 규칙 확인까지 포함하도록 갱신했다.

Removed/Deprecated:
- top-view와 builder preview가 idle 상태에서도 연속 프레임을 그려도 무방하다는 가정.

## 2026-04-22 변경 동기화 (Benchmark Scene Baseline Artifacts)
Added:
- benchmark scene 4종과 baseline collection runner를 성능 예산의 공식 artifact로 추가했다.

Updated:
- baseline 측정 절차를 telemetry capture JSON뿐 아니라 `benchmark-scenes` + `benchmark-runner` 기반 scene inventory와 함께 유지하도록 확장했다.

Removed/Deprecated:
- benchmark scenario 정의가 문서 텍스트에만 있고 저장소 artifact가 없던 상태.

## 2026-04-23 변경 동기화 (Renderer Snapshot Priority Budget)
Added:
- single object 경로도 renderer adapter snapshot을 우선 소비해 renderer-side object mutation과 instanced batch sync가 같은 invalidation 경로를 공유해야 한다는 기준을 추가했다.

Updated:
- compatibility renderer 예산을 “selected asset/instanced cluster 일부 경로”에서 “single object + instanced cluster 전체 snapshot 우선” 기준으로 확장한다.

Removed/Deprecated:
- single object 경로가 별도 runtime read 경로를 유지해도 성능 예산에 영향이 없다는 가정.

## 2026-04-23 변경 동기화 (Incremental Object Lifecycle Budget)
Added:
- same-room asset add/remove/material/placement commit은 full runtime scene replace보다 object-level incremental sync를 우선 사용해야 한다는 예산 기준을 추가했다.
- same-object asset swap도 full runtime replace 없이 handle/batch 재수렴으로 처리해야 한다는 기준을 추가했다.

Updated:
- runtime bridge 비용 기준을 “store commit 후 renderer 재수렴”에서 “store commit 후 incremental object reconcile + dirty renderer sync” 구조로 강화한다.

Removed/Deprecated:
- object lifecycle 변경 시 full runtime document recompilation 비용을 상시 허용하는 가정.

## 2026-04-23 변경 동기화 (Asset Compiler Alpha Guardrail)
Added:
- curated asset publish는 manifest만이 아니라 alpha runtime package descriptor를 같이 남겨야 하며, package index 누락은 compiler gate 실패로 본다.

Updated:
- asset pipeline guardrail 범위를 `GLB validate/verify`에서 `GLB validate/verify + runtime package publish`까지 확장한다.

Removed/Deprecated:
- runtime package artifact가 없어도 asset pipeline 회귀를 충분히 추적할 수 있다는 가정.

## 2026-04-23 변경 동기화 (Asset Compiler Published Artifact Guardrail)
Added:
- curated asset publish 결과는 descriptor/sidecar뿐 아니라 `proxy.glb`, thumbnail, file manifest parity, support surface bound를 모두 충족해야 한다.

Updated:
- asset compiler guardrail 범위를 `runtime package publish`에서 `runtime package publish + published artifact verification`까지 확장한다.

Removed/Deprecated:
- proxy/thumbnail/file manifest mismatch가 성능/전달 guardrail 밖의 문제라는 가정.

## 2026-04-23 변경 동기화 (Visibility Lifecycle Budget)
Added:
- hidden object는 same-room sync에서 full replace 없이 빠르게 제외되고, instancing/single-object render path에서 draw 후보 자체를 줄이는 방향을 기본 예산으로 본다.

Updated:
- incremental lifecycle budget 범위를 placement/material 갱신에서 visibility exclusion까지 확장한다.

Removed/Deprecated:
- hidden object가 renderer batch나 single-object path에 남아도 draw cost 예산에 영향이 미미하다는 가정.

## 2026-04-23 변경 동기화 (Focus Placement Prototype Budget)
Added:
- walk-mode focus placement preview는 `runtime preview only -> Enter commit` 구조를 유지하고, keyboard nudge 동안 `runtime-document-patch`가 발생하지 않는 것을 기본 예산으로 본다.
- `verify:focus-placement`를 통해 `surface_local` commit이 한 번의 patch로 끝나고, store가 runtime placement를 그대로 소비하는지 확인하는 기준을 추가했다.

Updated:
- interaction budget 범위를 top-view drag/hover 중심에서 walk-mode focus placement preview/commit까지 확장한다.

Removed/Deprecated:
- walk-mode 정밀 배치가 아직 제품 경로에 없으므로 별도 예산을 둘 필요가 없다는 가정.

## 2026-04-23 변경 동기화 (Focus Placement Prototype Budget Complete)
Added:
- focus placement session은 snapped pose, HUD status, document patch count가 drift 없이 같은 frame budget 안에서 유지돼야 한다.
- compatibility/blocked hint는 preview나 commit과 별개로 lightweight store update만 사용하고 document/runtime patch를 만들지 않는 것을 기본 예산으로 본다.

Updated:
- focus placement budget 범위를 `preview only -> Enter commit`에서 `preview only + snapped HUD consistency + compatibility hint lightweight update`까지 확장한다.

Removed/Deprecated:
- local grid/status HUD 추가가 별도 상호작용 budget 없이도 관리된다는 가정.

## 2026-04-23 변경 동기화 (Placement Kernel Guard Budget)
Added:
- placement commit 경로는 evaluated candidate가 없으면 즉시 실패해야 하며, invalid candidate가 preview 상태에서 document patch를 만들지 않는 것을 기본 budget으로 본다.
- focus placement session/HUD는 snap 이후 `localPose`를 기준으로 표시돼야 하고, preview pose와 표시 수치 drift를 허용하지 않는다.

Updated:
- interaction budget 범위를 `preview only -> Enter commit` 규칙에서 `preview only + invalid guard + snapped session consistency`까지 확장한다.

Removed/Deprecated:
- keyboard nudge session이 raw target pose를 유지해도 commit 예산 측정에는 영향이 없다는 가정.
