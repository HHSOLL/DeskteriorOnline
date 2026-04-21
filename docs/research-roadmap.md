# Research Roadmap (Deskterior, 2026-04-14)

## 목적
- IKEA Kreativ 스타일 room-first 제품 목표에 맞춰, 즉시 적용 가능한 기술과 연구 트랙을 분리한다.
- Blender 원본 자산 파이프라인과 웹 런타임 품질 기준을 같은 계약으로 묶는다.

## Adopt Now (즉시 적용)

### 1) Blender -> GLB -> Catalog 파이프라인 고정
- 코드 반영:
  - `apps/web/scripts/export-deskterior-runtime.ts`
  - `apps/web/scripts/sync-deskterior-catalog.ts`
  - `apps/web/scripts/validate-deskterior-gltf.ts`
  - `apps/web/scripts/verify-deskterior-pipeline.ts`
- 운영 명령:
  1. `npm --workspace apps/web run assets:export:deskterior -- --report`
  2. `npm --workspace apps/web run assets:export:deskterior`
  3. `npm --workspace apps/web run assets:sync:deskterior`
  4. `npm --workspace apps/web run assets:validate:deskterior`
  5. `npm --workspace apps/web run assets:verify:deskterior`

참고:
- Khronos glTF Blender I/O (Blender 기본 내장 importer/exporter): <https://github.com/KhronosGroup/glTF-Blender-IO>
- glTF 2.0 spec: <https://github.com/KhronosGroup/glTF/tree/main/specification/2.0>

### 2) 검증/최적화 추가 계획
- glTF 포맷/리소스 유효성 자동 검증은 `assets:validate:deskterior`로 분리 적용
  - 적용 도구: glTF-Validator (`npm`, JSON report)
  - 참고: <https://github.com/KhronosGroup/glTF-Validator>
- 런타임 최적화(파일 크기/로딩 속도) 자동화
  - 후보 A: gltfpack
  - 후보 B: glTF Transform CLI
  - 참고:
    - <https://github.com/zeux/meshoptimizer/tree/master/gltf>
    - <https://gltf-transform.dev/>

### 3) 실측/색상 정합성 운영 기준 (이번 단계 반영)
- 규격 기준:
  - glTF 좌표/단위 표준(선형 거리=미터)을 단일 기준으로 사용
  - 참고: <https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html>
- Blender export 기준:
  - glTF exporter 문서의 `Transform > Y Up` 및 PBR 채널 규칙을 준수
  - 참고: <https://docs.blender.org/manual/en/latest/addons/import_export/scene_gltf2.html>
- 런타임 색상 관리 기준:
  - three.js Color Management(Linear-sRGB working + sRGB output) 기준 유지
  - 참고: <https://threejs.org/manual/en/color-management.html>
- 운영 적용:
  - `dimensionsMm`/`finishColor`/`finishMaterial`/`detailNotes`/`scaleLocked`를 catalog/save/viewer 전 구간에 전달
  - 실측 고정 제품(`scaleLocked`)은 Inspector/TransformControls에서 스케일 수정을 차단

## Research Track (중기)

### 1) 텍스트/무드 기반 방·데스크 레이아웃 추천
- LayoutGPT (layout planner로 LLM 활용): <https://arxiv.org/abs/2305.15393>
- InstructScene (instruction-driven 3D indoor synthesis): <https://arxiv.org/abs/2402.04717>
- ATISS (indoor scene synthesis baseline): <https://arxiv.org/abs/2110.03675>
- Layout Anything (범용 실내 레이아웃 추정): <https://arxiv.org/abs/2512.02952>

실행 아이디어:
- room template + desk asset candidate를 고정한 뒤, 추천 모듈은 "배치 제안(JSON)"만 생성
- 실제 배치는 현재 `sceneDocument` 계약을 그대로 사용해 안전하게 적용

### 2) 대규모 자산/장면 확장
- Objaverse (800K+ 3D objects): <https://arxiv.org/abs/2212.08051>
- Holodeck (prompt -> 3D environment generation): <https://arxiv.org/abs/2312.09067>

실행 아이디어:
- 1차는 production catalog에 직접 유입하지 않고, 내부 평가 버킷에서만 품질/라이선스/폴리곤 비용 검증
- 통과한 자산만 curated catalog에 승격

### 3) 단일 이미지 -> 3D 보조 생성
- TripoSR: <https://arxiv.org/abs/2403.02151>
- 코드: <https://github.com/VAST-AI-Research/TripoSR>

실행 아이디어:
- 현재 worker `ASSET_GENERATION` 보조 경로에 제한적으로 연결
- 생성물은 자동 curated 승격 금지 + reviewer 승인 절차 필수

## 제품 벤치마크 기준
- IKEA Kreativ 공개 기능/UX 기준 참고:
  - 소개/기능: <https://www.ikea.com/us/en/customer-service/knowledge/articles/b548fdg1-8c6f-448e-97c5-6f78e114c504.html>
  - AI 기반 3D room design 발표: <https://www.ikea.com/us/en/newsroom/corporate-news/ikea-launches-new-ai-powered-digital-experience-empowering-customers-to-create-lifelike-room-designs-pub58c94890>
  - Geomagical Labs 기술 기반 설명(공식 발표 본문): 위 뉴스 문서의 기술 설명 단락

## 메모
- 위 문헌/오픈소스는 현재 아키텍처(Next.js + R3F + Supabase + Blender source asset pipeline)와 결합 가능성이 높은 항목만 남겼다.
- 연구 트랙 항목은 즉시 프로덕션 투입이 아니라, 별도 실험 브랜치/평가 지표와 함께 진행한다.
