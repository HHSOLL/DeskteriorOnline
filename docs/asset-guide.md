# Asset Guide

DeskteriorOnline의 메인 자산 경로는 **deskterior 카탈로그 + Blender/오픈소스 GLB**입니다.

## 1) 메인 경로: Blender + 오픈소스 카탈로그

- Blender 원본: `assets/blender/deskterior/*.blend`
- 런타임 GLB(현재 fallback): `apps/web/public/assets/models/*/*.glb|*.gltf`
- 카탈로그 manifest: `apps/web/public/assets/catalog/manifest.json`
- 운영 스크립트:

```bash
npm --workspace apps/web run assets:export:deskterior -- --report
npm --workspace apps/web run assets:export:deskterior
npm --workspace apps/web run assets:sync:deskterior
npm --workspace apps/web run assets:sync:ktx2-transcoder
npm --workspace apps/web run assets:setup:gltfpack
npm --workspace apps/web run assets:probe:gltfpack
npm --workspace apps/web run assets:optimize:deskterior
npm --workspace apps/web run assets:optimize:deskterior:native -- --gltfpack-bin /absolute/path/to/gltfpack
npm --workspace apps/web run assets:validate:deskterior
npm --workspace apps/web run assets:verify:deskterior
```

위 스크립트는 아래를 수행합니다.

- Blender source(.blend) 존재/신선도 검사 + 런타임 GLB export
- DeskteriorOnline 제작 deskterior 자산(p2s_*) upsert
- basis transcoder public sync(`apps/web/public/assets/transcoders/basis`)
- glTF Transform 기반 `dedup + prune + meshopt(내부 reorder/quantize 포함)` 최적화와 budget re-check
- optional native `gltfpack -cc -mi -kn -km -ke` 패스와 probe/wrapper 체인
- curated supportProfile surface/anchor metadata 검증
- curated `p2s_*` source/license/pivot/collisionProxy/textureSet/lodProfile metadata 검증
- Khronos glTF Validator 기반 구조/리소스 검증
- 오픈소스 desk/chair/lamp 메타데이터(brand/options/externalUrl/source/license) 보강
- 제품 인스펙터 표준 필드(thumbnail/price/options/externalUrl/brand)와 자산 계약 메타(source/license/pivot/collisionProxy/textureSet/lodProfile) 유지

운영 규칙:
- 신규 curated binary를 `apps/web/public/assets/*`에 직접 추가하지 않는다.
- 현재 `/assets/...` 경로는 storage/CDN cutover 전까지의 fallback delivery다.
- 장기 canonical delivery는 storage bucket + CDN URL이며, manifest는 절대 URL 또는 release URL을 가리켜야 한다.

## 2) 조명 자산 규칙 (Viewer/Editor 공통)

- 카탈로그 id 또는 메타에서 lamp/light 키워드를 가진 자산은 동적 광원 후보입니다.
- 성능 보호를 위해 동적 광원은 scene 당 최대 6개까지만 활성화합니다.
- `options`에 `light-emitter` 힌트를 넣으면 조명 자산으로 안정적으로 인식됩니다.

## 3) 목표 운영 구조 (Production Target)

- `catalog-public`
  - curated GLB / thumbnail / HDRI / material texture
  - immutable public URL
- `project-media`
  - project thumbnail / snapshot
  - private bucket + signed URL 또는 server-mediated read
- `assets-glb` 또는 후속 private generated bucket
  - worker 생성형 GLB staging/publish
  - 검수 또는 publish 단계를 거친 뒤 catalog/public contract에 연결

현재 상태:
- curated catalog는 아직 `apps/web/public/assets/*`를 fallback runtime으로 사용한다.
- generated asset은 Supabase Storage(`assets-glb`)를 사용한다.
- curated deskterior manifest는 이제 실측/마감 메타뿐 아니라 `source/license/pivot/collisionProxy/textureSet/lodProfile` 계약도 같이 유지한다.
- `lodProfile`는 검증용 메타에만 머물지 않고 room/desk precision/walk 런타임 LOD fallback 거리 정책에도 사용된다.
- `lodProfile.strategy="single_mesh"`인 low/medium complexity 반복 자산은 read-only top/walk와 builder preview에서 instanced cluster 후보로 소비된다.
- repo-local gltfpack 환경은 `.tools/gltfpack/current/gltfpack`를 canonical path로 사용하고, `assets:setup:gltfpack`가 최신 승인 버전(v1.1)을 이 경로에 설치한다.
- native gltfpack pass는 기본 비활성이고, `GLTFPACK_BIN` 또는 `--gltfpack-bin`으로 바이너리를 지정했을 때만 실행한다.
- KTX2 runtime decode 경로는 준비됐고, `assets:sync:ktx2-transcoder`가 three basis transcoder를 public 경로에 동기화한다.
- room shell floor/wall texture set은 `textures:encode:room-shell:ktx2` / `textures:check:room-shell:ktx2`로 `.ktx2` 산출물을 관리하고, 런타임 전환은 `NEXT_PUBLIC_ENABLE_KTX2_TEXTURES=1`로 제어한다.
- room shell texture set의 첫 `.ktx2` encode pass는 완료됐고, 현재 저장소에는 16개 room shell `.ktx2` 산출물이 포함된다.
- 2026-04-18 정리에서 legacy floorplan/intake/revision live data와 `floor-plans` bucket이 제거되었고, active bucket은 `assets-glb`, `project-media`만 남는다.

## 4) 레거시/보조 경로: Worker 생성형 GLB

이미지 → GLB 생성은 운영 보조 경로로 유지합니다.
웹은 `/api/v1/assets/generate`로 job을 enqueue하고, Vercel Route Handler가 Railway `/v1/assets/generate`로 프록시합니다.
Railway worker가 TripoSR 또는 Meshy를 호출한 뒤 결과 GLB를 Supabase Storage에 저장합니다.

## 환경 변수

`apps/worker`

```
ASSET_STORAGE_BUCKET=assets-glb
ASSET_GENERATION_POLL_INTERVAL_MS=2000
ASSET_GENERATION_MAX_POLLS=45
TRIPOSR_API_URL=
TRIPOSR_API_KEY=
TRIPOSR_STATUS_URL=

# 선택: Meshy fallback
MESHY_API_URL=
MESHY_API_KEY=
MESHY_STATUS_URL=
```

## API 사용

`POST /api/v1/assets/generate`

```json
{
  "image": "data:image/png;base64,...",
  "fileName": "chair-01",
  "provider": "triposr"
}
```

응답 예시:

```json
{
  "jobId": "uuid",
  "status": "queued"
}
```

완료 결과는 `GET /api/v1/jobs/:jobId`의 `result.asset`에서 조회합니다.

```json
{
  "id": "uuid",
  "type": "ASSET_GENERATION",
  "status": "succeeded",
  "result": {
    "asset": {
      "assetId": "...",
      "assetUrl": "https://.../assets-glb/...",
      "label": "chair-01",
      "description": "Generated via triposr",
      "category": "Custom"
    }
  }
}
```

실패 시:

```json
{
  "id": "uuid",
  "type": "ASSET_GENERATION",
  "status": "failed",
  "errorCode": "PROVIDER_NOT_CONFIGURED",
  "error": "No asset generation provider configured."
}
```

## 저장 위치

- Storage Bucket: `assets-glb` (기본값)
- DB Table: `assets`
  - `glb_path`에 저장 경로 기록
  - `meta`에 Provider/스키마 정보 기록

남은 운영 작업:
- curated catalog runtime을 storage-backed release URL로 이관
- `apps/web/public/assets/*`를 fallback에서 제거

## 최적화 (Draco)

대용량 GLB는 로딩 지연이 크므로 worker가 생성한 자산도 후속 Draco 압축 파이프라인을 추가하는 것이 좋습니다. 현재 v1 구현은 provider 결과 GLB를 그대로 저장합니다.

## 2026-05-18 공개 에셋 수집 메모

Added:
- Kenney Furniture Kit 2.0 공식 ZIP을 공개 라이선스 소스 후보로 확보했다.
- 소스 위치: `assets/sources/open-license/kenney-furniture-kit/`
- provenance 위치: `assets/references/open-license-assets/kenney-furniture-kit/reference-pack.json`
- 검수용으로 24개 GLB를 `selected-glb/`에 추출했고, GLB binary header/length 검사는 `24/24` 통과했다.
- QA route visual pass용으로 6개 GLB를 `/api/qa-assets/open-license/kenney-furniture-kit/[file]`에서 source staging 기반으로 서빙한다. 사용 목록과 수치는 `assets/references/open-license-assets/kenney-furniture-kit/qa-audit-2026-05-18.json`에 기록한다.
- Meshy 커뮤니티 공개 모델은 생성 job 없이 public v1 task metadata의 `model.glb` signed URL에서 CC0 모델만 확보한다.
- Meshy 커뮤니티 소스 위치: `assets/sources/meshy-community/selected-glb/`
- Meshy 커뮤니티 provenance/audit 위치: `assets/references/meshy-community/download-audit-2026-05-18.json`
- Meshy 커뮤니티 QA registry 위치: `assets/references/meshy-community/qa-registry-2026-05-18.json`
- 앱 구현의 단일 파일 목록/배치 source는 `apps/web/src/lib/qa/meshy-community-assets.ts`로 둔다.
- QA route visual pass용으로 4개 GLB를 `/api/qa-assets/meshy-community/[file]`에서 source staging 기반으로 서빙한다: `chair-rodiondbulatoff`, `rustic-table`, `rack-golden-arch`, `colorful-brick-wall`.

Updated:
- 해당 GLB들은 아직 runtime catalog에 publish하지 않는다. 신규 curated binary를 `apps/web/public/assets/*`에 직접 추가하지 않는 기존 규칙을 유지한다.
- 다음 단계는 Blender/glTF inspector에서 scale, origin, pivot, material count, visual fit을 검수한 뒤 proxy/full runtime package와 catalog metadata를 만든다.
- QA-only API는 public catalog나 storage-backed release URL을 대체하지 않는다. 시각 검증을 통과한 자산만 별도 runtime package 메타데이터와 최적화 산출물로 승격한다.
- Meshy community route, workbench placement, verifier는 같은 TS registry에서 파일 목록을 읽어 allowlist drift를 막는다.
- Meshy에서 사용자가 새로 생성하는 text-to-3D/image-to-3D는 사전 prompt/reference 검수를 유지하지만, 이미 공개된 커뮤니티 CC0 GLB 다운로드는 provenance와 metadata 확인 후 QA staging에 넣을 수 있다.

Removed/Deprecated:
- 라이선스와 provenance가 기록되지 않은 GLB를 final-room QA나 public catalog에 바로 연결하는 방식.
- Meshy text-to-3D 또는 image-to-3D job을 사용자 검수 없이 실행하는 방식. Meshy 후보 프롬프트와 reference image 정책은 `assets/references/meshy-preapproval/deskterior-pc-room-assets-2026-05-18.md`에서 먼저 검토한다.
- `assets/sources/open-license`의 원본 GLB를 정식 runtime asset처럼 취급하는 방식. 이 경로는 source/provenance staging이다.
- Meshy public page의 `.meshy` viewer binary를 GLB로 오인하거나 runtime asset으로 직접 로드하는 방식.

## 2026-05-19 Meshy Community Runtime Candidate 메모

Added:
- Meshy community source-staged GLB 4개를 Blender 정규화 + Meshopt 후보 패키지로 변환했다.
- 정규화 스크립트: `scripts/blender/normalize-meshy-community-assets.py`
- 후보 위치: `assets/runtime-candidates/meshy-community/<slug>/`
- 후보별 산출물: `<slug>.normalized.glb`, `<slug>.thumbnail.webp`, `<slug>.runtime-candidate.json`
- 정규화 report: `assets/references/meshy-community/normalization-report-2026-05-19.json`
- Meshopt report: `assets/references/meshy-community/optimization-report-2026-05-19.json`
- 자동 검증: `npm --workspace apps/web run verify:meshy-community-assets`

Updated:
- 후보 GLB는 center/floor/center pivot, normalized mesh/material name, image-based PBR metadata, box collision proxy, `single_mesh` LOD contract를 sidecar에 기록한다.
- Meshopt 압축은 적용됐지만 KTX2 texture 승격은 아직 보류한다. visual promotion 전까지 `textureSet.ktx2Ready=false`를 유지한다.
- `colorful-brick-wall`은 `TRIANGLE_COUNT_OVER_REVIEW_BUDGET` 경고가 있어 QA accent 후보로만 유지한다.

Removed/Deprecated:
- source-staged Meshy GLB를 pivot/material/optimization sidecar 없이 runtime candidate로 부르는 방식.
- Meshopt extension 존재만으로 public catalog promotion을 승인하는 방식. human visual QA와 package metadata gate가 여전히 필요하다.
