# AGENTS

DeskteriorOnline 저장소의 모든 작업은 이 문서를 기본 운영 규약으로 따릅니다.

## 1) Start Protocol (작업 시작 전 필수)
1. 아래 문서를 **반드시 순서대로** 읽고 현재 기준을 확인한다.
2. 작업 범위에 맞는 `agents/*.md` 역할 문서를 선택한다.
3. 작업 유형에 맞는 스킬을 선택한다.
4. 변경 범위/리스크/검증 계획을 정한 뒤 구현을 시작한다.

Must Read (in order):
1) `new_guideline/README.md`
2) `docs/master-guide.md`
3) `docs/ai-pipeline.md`
4) `docs/3d-visual-engine.md`
5) `docs/implementation-plan.md`
6) `docs/user-action-guide.md`

## 2) Prime Directives
- `new_guideline/README.md`를 최상위 제품 요구사항으로 취급한다.
- `docs/master-guide.md`를 엔지니어링 단일 기준 문서로 유지한다.
- Room-first builder -> deskterior editor -> publish/share -> community viewer 제품 흐름을 유지한다.
- floorplan/intake 레거시 파이프라인을 메인 제품 경로에 재도입하지 않는다.
- PBR + HDR + Post FX 품질 기준을 유지한다.

## 3) Skill Routing Matrix
- 아키텍처/범위/품질 게이트: `deskterioronline-project-core`
- 랜딩/UX/상호작용/비주얼 폴리시: `deskterioronline-studio-ux`
- 자산 생성/추천형 AI 경계: `deskterioronline-blueprint-ai` (필요 시 제한적으로 사용)
- 브라우저 E2E/시나리오 검증: `playwright`
- UI 가이드라인 점검: `web-design-guidelines`

보조 규칙:
- 여러 영역이 동시에 바뀌면 `agents/tech-lead.md`를 오케스트레이터로 사용한다.
- `~/.codex/skills`에 프로젝트 스킬이 없으면 작업 시작 시점에 이를 명시하고, 로컬 `skills/` 문서 + 관련 에이전트 문서를 폴백 기준으로 사용한다.

## 4) Agent Selection Rules
- 단일 영역 작업: 해당 역할 문서 1개 선택.
- 다중 영역 작업: `agents/tech-lead.md` + 필요한 역할 문서 병행.
- 변경 중 요구사항이 확장되면 역할 문서를 재선택하고 문서 영향도를 재평가한다.

## 5) Documentation Update Rules (작업 종료 전 필수)
- 아키텍처/품질 제약 변경: `docs/master-guide.md`
- 단계/우선순위/완료조건 변경: `docs/implementation-plan.md`
- AI 계약/오류 처리 변경: `docs/ai-pipeline.md`
- 렌더링/시각 품질 기준 변경: `docs/3d-visual-engine.md`
- 사용자 준비사항/운영 절차 변경: `docs/user-action-guide.md`

반드시 반영할 항목:
- 추가된 제약(Added)
- 수정된 제약(Updated)
- 더 이상 유효하지 않은 항목(Removed/Deprecated)

## 6) Quality Gates
코드 변경 후 아래를 기본 검증으로 실행한다.

```bash
npm --workspace apps/web run type-check
npm --workspace apps/web run lint
npm --workspace apps/web run build
```

## 7) Git Branch Policy (필수)
- 기능/버그/리팩터링 단위로 **항상 새 브랜치**를 생성하고 작업한다.
- 새 브랜치에서 구현 후 품질 게이트(`type-check`, `lint`, `build`)를 통과시킨 뒤에만 `main`에 병합한다.
- 여러 기능을 동시에 진행할 때는 기능별로 브랜치를 분리한다.
- 병합이 끝난 브랜치는 로컬/원격에서 삭제해 저장소를 정리한다.

## 8) Definition of Done
- 기능/리팩터링 구현 완료
- 품질 게이트 통과
- 관련 문서 갱신 완료
- 변경된 제약과 후속 리스크가 `docs/implementation-plan.md`에 기록됨
