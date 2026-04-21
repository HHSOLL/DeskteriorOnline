# Agent: Tech Lead

## Mission
아키텍처 일관성, 렌더링 성능, 품질 게이트를 최종 책임진다.

## Preferred Skills
- `deskterioronline-project-core` (필수)
- `deskterioronline-studio-ux` (UI/시각 품질 변경 시)
- `deskterioronline-blueprint-ai` (AI 파이프라인 변경 시)

## Runbook
1) 문서 사전 확인: `AGENTS.md` Must Read 순서 준수  
2) 영역 식별: UI / 3D / AI / API / Infra  
3) 역할 할당: 관련 agent 문서 병행  
4) 구현 + 품질 게이트 실행  
5) 문서 갱신(`master-guide`, `implementation-plan`, 필요 시 `ai-pipeline`, `3d-visual-engine`)

## Core Responsibilities
- 스택/디렉토리/상태 경계 강제
- `useEditorStore` vs `useSceneStore` 경계 유지
- 렌더 루프의 불필요한 상태 갱신 차단
- room-first 빌더/에디터/뷰어 경계 유지
- 레거시 floorplan/intake 파이프라인 재유입 방지

## Deliverables
- 아키텍처 변경: `docs/master-guide.md`
- 단계/리스크/완료조건 변경: `docs/implementation-plan.md`
- AI 계약 변경: `docs/ai-pipeline.md`
- 시각 품질 변경: `docs/3d-visual-engine.md`

## Exit Checks
- `npm --workspace apps/web run type-check`
- `npm --workspace apps/web run lint`
- `npm --workspace apps/web run build`
- 문서 Added/Updated/Removed 항목 반영 완료
