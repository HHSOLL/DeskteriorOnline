# DeskteriorOnline 개발 핸드북 (공간 우선)

## 1) 제품 한 줄 정의

DeskteriorOnline는 **홈에서 공간 템플릿을 고르거나 직접 방을 만든 뒤, 데스크테리어를 편집하고, 발행 후 동일한 읽기 전용 3D 뷰어로 공유하는 공간 우선 제품**입니다.

## 2) 메인 사용자 경로

1. `/`
2. `/studio/select` 또는 `/studio/builder?intent=custom`
3. `/studio/builder`
4. `/project/[id]`
5. 공유 모달에서 발행
6. `/shared/[token]`, `/gallery`, `/community`

## 3) 핵심 프론트엔드 구조

- `apps/web/src/features/builder/*`
  - 4단계 빌더 위저드
- `apps/web/src/app/studio/select/page.tsx`
  - 빈 공간/가구 배치 템플릿 브라우저
- `apps/web/src/app/(editor)/project/[id]/page.tsx`
  - 에디터 셸 + 저장/발행
- `apps/web/src/components/viewer/ReadOnlySceneViewport.tsx`
  - 읽기 전용 뷰어 뷰포트
- `apps/web/src/components/viewer/ProductHotspotDrawer.tsx`
  - 공통 제품 inspector
- `apps/web/src/lib/stores/scene-slices.ts`
  - scene 상태 접근 slice 훅

## 4) 데이터 모델 요약

- `projects`: 프로젝트 메타
- `project_versions`: 저장된 장면 스냅샷
- `shared_projects`: 공유 토큰 + 권한 + 공개 상태

메인 경로는 항상 `project_versions` 기반으로 에디터/뷰어를 복원합니다.

## 5) 품질 게이트

```bash
npm --workspace apps/web run type-check
npm --workspace apps/web run lint
npm --workspace apps/web run build
E2E_ROOM_FLOW_STRICT=1 npm --workspace apps/web run primary:e2e:room-flow:strict
```

## 6) 문서 맵

메인 문서:
- `docs/master-guide.md`
- `docs/implementation-plan.md`
- `docs/file-role-index.md`
- `docs/3d-visual-engine.md`
- `docs/user-action-guide.md`
- `docs/performance-budget.md`
