# Deskterior Blender Sources

이 디렉토리는 DeskteriorOnline의 데스크테리어 기본 자산 원본 `.blend` 파일을 보관합니다.

## 포함 자산

- `p2s_desk_oak.blend`
- `p2s_monitor_stand.blend`
- `p2s_desk_lamp_glow.blend`
- `p2s_ceramic_mug.blend`
- `p2s_book_stack_warm.blend`
- `p2s_desk_tray_oak.blend`
- `p2s_compact_speaker.blend`
- `p2s_desk_planter_pilea.blend`
- `p2s_fursys_setina_zdq012j.blend` (prototype reference rebuild from FURSYS SETINA ZDQ012J public product page)

런타임 GLB 출력 경로:

- `/apps/web/public/assets/models/p2s_desk_oak/p2s_desk_oak.glb`
- `/apps/web/public/assets/models/p2s_monitor_stand/p2s_monitor_stand.glb`
- `/apps/web/public/assets/models/p2s_desk_lamp_glow/p2s_desk_lamp_glow.glb`
- `/apps/web/public/assets/models/p2s_ceramic_mug/p2s_ceramic_mug.glb`
- `/apps/web/public/assets/models/p2s_book_stack_warm/p2s_book_stack_warm.glb`
- `/apps/web/public/assets/models/p2s_desk_tray_oak/p2s_desk_tray_oak.glb`
- `/apps/web/public/assets/models/p2s_compact_speaker/p2s_compact_speaker.glb`
- `/apps/web/public/assets/models/p2s_desk_planter_pilea/p2s_desk_planter_pilea.glb`
- `/apps/web/public/assets/models/p2s_fursys_setina_zdq012j/p2s_fursys_setina_zdq012j.glb`

## 운영 규칙

- 새 자산은 `.blend`와 `.glb`를 함께 커밋합니다.
- 카탈로그 반영은 `npm --workspace apps/web run assets:sync:deskterior`로 동기화합니다.
- 오픈소스 자산은 라이선스가 명확한 소스(CC0 권장)만 사용합니다.
- 실제 브랜드 제품 reference rebuild는 테스트/draft 용도로만 두고, 운영 catalog release 전에는 제조사 사용 허가 또는 CAD/reference 라이선스를 확보해야 합니다.
- FURSYS `ZDQ012J` material pass는 `textures/p2s_fursys_setina_zdq012j/`의 procedural PBR maps와 `assets/references/product-pages/p2s_fursys_setina_zdq012j/reference-pack.json`을 함께 봐야 합니다.
- 제품 URL 기반 reference pack은 material authoring seed일 뿐이며, runtime catalog 승격은 `releaseEligible=false`를 유지한 상태에서 QA evidence로만 기록합니다.
