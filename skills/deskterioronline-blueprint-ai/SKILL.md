---
name: deskterioronline-blueprint-ai
description: Deskterior AI guidance for deskterioronline, including asset-generation contracts, prompt design, and recommendation metadata validation. Use when working on `assets/generate` flow or recommendation/ranking contracts.
---

# DeskteriorOnline Deskterior AI

## Workflow
1) Read `docs/ai-pipeline.md` and use its schema as the contract.
2) Keep AI scope bounded to asset generation/recommendation metadata.
3) Validate provider response schema before persisting asset records.
4) Ensure generated assets are GLB-oriented and catalog-safe.
5) If provider errors appear, surface actionable retry/dead-letter diagnostics.

## Validation Rules
- Provider response must resolve a usable model URL or explicit failure reason.
- Persisted metadata should include category/tags/license context when available.
- Never reintroduce floorplan ingestion or 2D correction assumptions.

## References
- `references/schema-and-prompt.md` for the JSON schema and prompt template.
