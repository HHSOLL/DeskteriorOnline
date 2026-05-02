---
name: deskterioronline-project-core
description: Project-wide guidance for deskterioronline covering scope, docs, architecture, milestones, and quality bar. Use when tasks involve PRD/roadmap updates, system architecture decisions, cross-cutting constraints, or aligning implementation with the new_guideline brief.
---

# DeskteriorOnline Project Core

## Workflow
1) Read `new_guideline/README.md` and treat it as the primary brief.
2) Read `docs/master-guide.md` and `docs/implementation-plan.md`.
3) For pipeline/visual changes, also read `docs/ai-pipeline.md` and `docs/3d-visual-engine.md`.
4) When changing scope or architecture, update the relevant docs first.
5) Keep the non-negotiables intact: room-first builder, canonical sceneDocument, publish/share/community flow, and high-fidelity visuals.

## Decision Checklist
- Does this change preserve the roomShell -> sceneDocument contract?
- Does it keep published scenes consistent between editor and shared/community viewer?
- Does it keep render performance aligned with the quality bar?
- Is the user action guide still accurate?

## References
- `references/quality-bar.md` for acceptance criteria and guardrails.
