# DeskteriorOnline

DeskteriorOnline는 **홈에서 빠르게 방을 고르고 만들고, 데스크테리어를 편집한 뒤, 발행하고, 동일한 읽기 전용 3D 뷰어로 공유하는 공간 우선 인테리어 제품**입니다.

## 핵심 사용자 흐름

1. `/`에서 `공간 선택` 또는 `공간 만들기` 진입
2. `/studio/select`에서 빈 공간/가구 배치 템플릿 선택 또는 `/studio/builder?intent=custom`으로 맞춤 빌더 진입
3. `/studio/builder`에서 방 모양/치수/문창/스타일 설정
4. `/project/[id]` 에디터에서 가구 배치, 이동/회전, 저장
5. 공유 모달에서 링크 발행 및 갤러리 공개
6. `/shared/[token]`, `/gallery`, `/community`에서 동일한 읽기 전용 3D 뷰어로 확인

## 빠른 시작

요구사항: Node.js >= 20

```bash
npm install
npm run dev:web
```

- 로컬 서버: `http://127.0.0.1:3100`
- Next.js 앱 위치: `apps/web`

## 환경 변수 (`apps/web/.env.local`)

필수:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `RAILWAY_API_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PROJECT_MEDIA_BUCKET` (선택, 기본값 `project-media`)

권장:
- `E2E_RAILWAY_API_URL`
- `E2E_ROOM_FLOW_STRICT`
- `E2E_ROOM_FLOW_BASE_URL`
- `E2E_ROOM_FLOW_SHARED_TOKEN`
- `E2E_ROOM_FLOW_PROJECT_ID`
- `NEXT_PUBLIC_ENABLE_REALTIME_LABS` (`1`일 때 local-only `/labs/realtime` 실험 게이트 활성화)
- `NEXT_PUBLIC_ENABLE_KTX2_TEXTURES` (`1`일 때 room shell floor/wall texture set이 `.ktx2` 우선 로드)
- `NEXT_PUBLIC_KTX2_TRANSCODER_PATH` (기본값 `/assets/transcoders/basis/`)

## 스크립트

```bash
npm run dev:web
npm --workspace apps/web run qa:primary
npm --workspace apps/web run primary:e2e:room-flow
npm --workspace apps/web run assets:sync:deskterior
npm --workspace apps/web run assets:sync:ktx2-transcoder
npm --workspace apps/web run assets:setup:gltfpack
npm --workspace apps/web run assets:probe:gltfpack
npm --workspace apps/web run textures:encode:room-shell:ktx2
npm --workspace apps/web run textures:check:room-shell:ktx2
npm --workspace apps/web run assets:optimize:deskterior
npm --workspace apps/web run assets:optimize:deskterior:native -- --gltfpack-bin /absolute/path/to/gltfpack
npm --workspace apps/web run assets:validate:deskterior
npm --workspace apps/web run assets:verify:deskterior

# strict 모드(실패를 fail-fast로 처리)
E2E_ROOM_FLOW_STRICT=1 npm --workspace apps/web run primary:e2e:room-flow:strict

# full flow (Supabase env 필요)
npm --workspace apps/web run primary:e2e:room-flow:full

```

## 데스크테리어 자산 파이프라인 (Blender + OSS)

- Blender 원본: `assets/blender/deskterior/*.blend`
- 런타임 모델: `apps/web/public/assets/models/`
- Khronos glTF 검증: `npm --workspace apps/web run assets:validate:deskterior`
- 카탈로그 동기화: `npm --workspace apps/web run assets:sync:deskterior`
- 오픈소스 자산은 라이선스 명시(CC0 우선)된 항목만 사용

## 핵심 문서

- `docs/master-guide.md`
- `docs/implementation-plan.md`
- `docs/file-role-index.md`
- `docs/performance-budget.md`
- `docs/3d-visual-engine.md`
- `docs/user-action-guide.md`
- `docs/developer-handbook.md`

## 캐시 문제 대응

```bash
rm -rf apps/web/.next
npm run dev:web
```
