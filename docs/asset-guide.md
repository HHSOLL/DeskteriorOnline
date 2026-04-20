# Asset Guide

Plan2Space의 메인 자산 경로는 **deskterior 카탈로그 + Blender/오픈소스 GLB**입니다.

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
npm --workspace apps/web run assets:optimize:deskterior
npm --workspace apps/web run assets:validate:deskterior
npm --workspace apps/web run assets:verify:deskterior
```

위 스크립트는 아래를 수행합니다.

- Blender source(.blend) 존재/신선도 검사 + 런타임 GLB export
- Plan2Space 제작 deskterior 자산(p2s_*) upsert
- basis transcoder public sync(`apps/web/public/assets/transcoders/basis`)
- Meshopt 최적화와 budget re-check
- curated supportProfile surface/anchor metadata 검증
- Khronos glTF Validator 기반 구조/리소스 검증
- 오픈소스 desk/chair/lamp 메타데이터(brand/options/externalUrl) 보강
- 제품 인스펙터 표준 필드(thumbnail/price/options/externalUrl/brand) 유지

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
