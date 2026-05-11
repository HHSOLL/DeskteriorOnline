# AI Pipeline (Deskterior)

이 문서는 현재 제품에서 사용하는 AI 경계를 정의합니다.

## 현재 운영 경계
- 메인 제품 파이프라인은 **room builder -> deskterior 편집 -> 공유/커뮤니티 조회**입니다.
- 구조 인식 기반 floorplan 분석은 제품 경계에서 제거되었습니다.

## 활성 AI 경로
1. `POST /api/v1/assets/generate`로 이미지 기반 3D 자산 생성 job enqueue
2. worker가 `ASSET_GENERATION` job 처리
3. 생성된 GLB를 Supabase storage에 저장하고 자산 레코드 생성
4. 에디터에서 커스텀 자산으로 배치 가능

## 품질 규칙
- 생성 자산은 GLB 단일 포맷으로 저장한다.
- 생성 실패는 `retrying -> failed/dead_letter` 상태로 명확히 노출한다.
- 생성형 결과는 운영 카탈로그를 대체하지 않고 보조 입력으로 취급한다.
- 운영 카탈로그로 승격할 때는 물리 메타데이터(`dimensionsMm`, `finishColor`, `finishMaterial`, `detailNotes`, `scaleLocked`)를 채운다.
- 실제 브랜드/SKU 제품 최종본에는 이미지 생성 모델 산출물을 사용하지 않는다. 실제 SKU는 제조사 URL, 공식 치수, 정면/측면/상면/디테일 reference, 마감 출처, 라이선스가 있는 `referencePack`을 통과해야 한다.
- 이미지 생성 모델은 비브랜드 generic texture 후보, wall/floor mood exploration, 내부 draft asset 탐색에만 사용한다.
- AI 생성 1K wall/floor texture는 `generic_ai_candidate`로 분류하고, 상용 preset은 2K source + runtime KTX2 + constrained 1K fallback 구조로 승격한다.

## 향후 확장(연구 트랙)
- 텍스트/무드 기반 데스크 배치 추천
- 커뮤니티 장면 임베딩 기반 유사 장면 추천
- Blender 자동 리토폴로지/LOD 제안

## 2026-04-14 변경 동기화 (Floorplan AI Retirement)
Added:
- 자산 생성 중심 AI 경로(`assets/generate` + worker)를 공식 계약으로 명시.

Updated:
- AI 문서를 deskterior 제품 맥락으로 재정의.

Removed/Deprecated:
- semantic parsing -> 2D correction -> procedural 3D floorplan 파이프라인.
- floorplan provider rollout/eval/blind gate 운영 기준.

## 2026-05-01 변경 동기화 (Commercial AI Boundary)
Added:
- 실제 SKU asset 승격 조건을 `referencePack + commercialReadiness + material QA`로 고정한다.
- 생성형 이미지는 운영 카탈로그 확정본이 아니라 candidate texture/draft exploration으로만 기록한다.

Updated:
- 운영 카탈로그 승격 기준을 기본 물리 메타데이터에서 visual fidelity score, dimension tolerance, material QA, release eligibility까지 확장한다.

Removed/Deprecated:
- AI 생성 이미지/텍스처가 실제 제품 동일성의 증거가 될 수 있다는 가정.

## 2026-05-02 변경 동기화 (Commercial Texture Boundary Closure)
Added:
- `verify:commercial-qa`는 commercial wall/floor preset에 AI candidate texture가 0개인지 확인한다.

Updated:
- AI 생성 wall/floor texture는 내부 탐색 후보로만 남고, 기본 commercial preset에는 연결하지 않는다.

Removed/Deprecated:
- AI 1K texture 후보를 paid-beta commercial PBR library에 포함하는 방식.

## 2026-05-11 변경 동기화 (Product URL Reference Pipeline)
Added:
- `asset:analyze-url`을 prototype-only 실제 SKU reference 수집 entrypoint로 추가한다. 제품 URL에서 JSON-LD, Open Graph image, 상세 이미지, option/SKU/manufacturer/price field를 수집하고 `assets/references/product-pages/<assetKey>/reference-pack.json`을 생성한다.
- `verify:product-url-reference`는 FURSYS `ZDQ012J` fixture를 기준으로 SKU/manufacturer/options/dimensions/reference image/material hint/prototype-only legal boundary를 검증한다.

Updated:
- 제품 URL 분석 결과는 실제 제품 동일성의 시작점일 뿐이며, 운영 승격에는 제조사 CAD 또는 사용 허가, 공식 finish swatch, slot-level material QA가 계속 필요하다.
- URL에서 추론한 material hint는 `qaStatus=pending`, `releaseEligible=false`로만 발행한다.

Removed/Deprecated:
- 공개 제품 페이지 이미지 또는 OCR 결과만으로 실제 SKU asset을 release eligible로 보는 방식.
