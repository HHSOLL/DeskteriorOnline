# Quality Bar and Guardrails

## Must-Haves
- Room builder output(`roomShell`)과 scene 저장(`sceneDocument`) 계약을 일관되게 유지.
- Publish/share/community에서 동일 scene snapshot이 읽기 전용 뷰어로 복원.
- Blender 원본 -> GLB -> catalog manifest 동기화 경로 유지.
- PBR materials + HDR environment + post-processing chain.
- Save/load versions with stable JSON contracts.

## Visual Targets
- Loading and landing match `new_guideline/` references.
- Glassmorphism UI overlays with readable contrast.

## Failure Conditions
- Retired floorplan/intake pipeline reintroduced to runtime path.
- Flat or plastic-looking materials (no PBR/HDRI).
- Shared/community viewer scene mismatch with published snapshot.
