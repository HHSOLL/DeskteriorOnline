# Product URL Private Asset Pipeline

This document is the audit/runbook for the private product URL asset generation path.

## Objective
Turn a product detail URL into an owner-scoped private generated asset that can be shown in the editor catalog without promoting it to the public curated catalog.

The runtime contract is:

```txt
productUrl
-> reference pack
-> selected reference images/specs
-> provider candidates
-> provider retry/backoff
-> Blender finalizer
-> candidate evaluator
-> Supabase private assets row
-> editor generated catalog item
```

## Artifact Checklist

| Requirement | Evidence |
| --- | --- |
| Request contract for product URL generation | `packages/contracts/src/product-assets.ts` |
| Web route from editor to API | `apps/web/src/app/api/v1/product-assets/generate/route.ts` |
| API route and service enqueueing `PRODUCT_ASSET_GENERATION` | `apps/api/src/routes/product-assets.ts`, `apps/api/src/services/product-asset-service.ts` |
| Owner-scoped private generated asset listing | `apps/api/src/repositories/assets-repo.ts`, `apps/web/src/app/api/v1/assets/route.ts` |
| Worker queue can claim product jobs | `apps/worker/src/queue/claim-next-job.ts` |
| Worker dispatches product jobs | `apps/worker/src/worker.ts` |
| URL analysis reuses asset compiler reference extraction | `apps/worker/src/processors/product-asset-generation-processor.ts`, `packages/asset-compiler/src/product-url-reference.ts` |
| Provider candidate generation and async model URL polling | `apps/worker/src/processors/asset-generation-processor.ts` |
| Provider transient retry/backoff | `withAssetProviderRetry` in `apps/worker/src/processors/asset-generation-processor.ts` |
| Category-specific placement/material repair profiles | `apps/worker/src/processors/product-asset-category-profiles.ts` |
| Blender finalizer wrapper | `apps/worker/src/processors/product-asset-finalizer.ts` |
| Blender finalizer script | `scripts/blender/finalize-product-asset.py` |
| Candidate evaluation | `apps/worker/src/processors/product-asset-evaluator.ts` |
| GLB and thumbnail storage | `apps/worker/src/repositories/assets-repo.ts` |
| Editor inventory URL entry and job polling | `apps/web/src/components/editor/BuilderLibraryShelf.tsx`, `apps/web/src/app/(editor)/project/[id]/page.tsx` |
| Generated asset QA badge in inventory | `apps/web/src/components/editor/BuilderLibraryShelf.tsx`, `apps/web/src/lib/builder/catalog.ts` |
| RLS/schema support for job evidence and `ownerId` payloads | `schema.sql`, `supabase/migrations/20260512120000_product_asset_generation_jobs.sql` |
| Static verifier for pipeline wiring | `apps/web/scripts/verify-product-asset-generation.ts` |
| Product reference fixture verifier | `apps/web/scripts/verify-product-url-reference.ts` |
| Prototype factory verifier | `apps/web/scripts/verify-product-asset-factory.ts` |

## Private Metadata Requirements

Generated product URL assets must keep these fields in `assets.meta`:

- `source.kind = "product_url"`
- `source.url`
- `source.title`, `source.sku`, `source.manufacturer` when available
- `generation.pipeline = "product_url_private_asset_v1"`
- `generation.selectedProvider`
- `generation.qualityScore`
- `runtimeAsset.units = "mm"`
- `runtimeAsset.dimensionsMm`
- `runtimeAsset.scaleLocked`
- `runtimeAsset.categoryProfile`
- `runtimeAsset.placement`
- `qa.candidateEvaluation`
- `qa.finalizerReport`
- `referencePack`
- `legalUse.mode = "private_reference_only"`
- `legalUse.releaseEligible = false`

Provider output must not be written to `apps/web/public/assets/catalog/manifest.json`.

## Environment

Worker required runtime:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ASSET_STORAGE_BUCKET`
- one configured provider: `MESHY_API_URL`/`MESHY_API_KEY` or `TRIPOSR_API_URL`/`TRIPOSR_API_KEY`

Optional runtime:

- `MESHY_STATUS_URL` / `TRIPOSR_STATUS_URL` for async provider jobs
- `MESHY_BUDGET_REMAINING` and `MESHY_BUDGET_COST_PER_TASK` before enabling Meshy under the default `MESHY_BUDGET_MODE=required` guard
- `MESHY_BUDGET_RESERVE` to leave a token/credit reserve untouched
- `MESHY_MAX_BUDGET_PER_JOB` to cap worst-case Meshy spend per logical provider request, including retry attempts
- `MESHY_SCENE_BUDGET_*` overrides for standalone So Ong Meshy scene generation scripts
- `BLENDER_BIN` for finalizer execution
- `ASSET_GENERATION_PROVIDER_MAX_ATTEMPTS` for transient provider retry count
- `ASSET_GENERATION_PROVIDER_RETRY_BASE_MS` for exponential backoff base delay
- `PRODUCT_ASSET_MAX_CANDIDATES`
- `PRODUCT_ASSET_AUTO_APPROVE_THRESHOLD`

If `BLENDER_BIN` is missing, the job can still register a private asset, but `qa.finalizerReport.warnings` must include `BLENDER_BIN_NOT_CONFIGURED`.
Meshy provider requests are blocked before the external POST when the budget guard is missing or insufficient. Set `MESHY_BUDGET_MODE=optional` only for isolated smoke tests where Meshy account-level limits are already enforced outside this worker.

## Verification Commands

```bash
npm --workspace apps/worker run typecheck
npm --workspace apps/worker test
npm --workspace apps/api run typecheck
npm --workspace apps/api test
npm --workspace apps/web run type-check
npm --workspace apps/web run lint
npm --workspace apps/web run build
npm --workspace apps/web run verify:product-url-reference
npm --workspace apps/web run verify:product-asset-factory
npm --workspace apps/web run verify:product-asset-generation
```

Optional local Blender smoke:

```bash
BLENDER_BIN=/Applications/Blender.app/Contents/MacOS/Blender \
node --import tsx apps/web/scripts/verify-product-asset-generation.ts
```

For a real provider E2E, run the worker with provider credentials and submit from the editor inventory or the web route:

```bash
curl -X POST "$NEXT_PUBLIC_APP_URL/api/v1/product-assets/generate" \
  -H "Authorization: Bearer <supabase-session-token>" \
  -H "Content-Type: application/json" \
  -d '{"productUrl":"https://example.com/product","providerMode":"auto","maxCandidates":4}'
```

## Completion Boundary

This pipeline is complete for private/prototype generation when:

1. The request is authenticated and enqueued as `PRODUCT_ASSET_GENERATION`.
2. The worker produces or explicitly fails the reference pack step.
3. Provider candidates are attempted with retry/backoff.
4. The selected candidate is finalized or records an explicit finalizer warning.
5. The evaluator records component scores.
6. The asset is owner-scoped and private.
7. The editor catalog shows the generated asset thumbnail and QA status.
8. `releaseEligible` remains false.
9. Meshy generation cannot exceed configured token/credit budget because the provider POST is blocked before request dispatch when remaining budget is missing or insufficient.
10. Save/share/viewer paths consume the asset as a private runtime asset without mutating the public catalog.

Commercial exposure is out of scope. Public catalog promotion still requires CAD/licensing/material QA and a separate release gate.

## Local Meshy Smoke Result

2026-05-13 local-only validation used Meshy with `maxCandidates=1` against the FURSYS `ZDQ012J` product URL.

- Job `e6aab688-f90f-4074-bdd9-3d17e5436b41` succeeded.
- Private asset `9b1c4c1a-0b4f-4342-a92c-782ffaf226eb` was registered with a GLB and thumbnail.
- Provider input image selection now prefers product hero/front references over long detail sheets, because detail-page sheets can include unrelated page composition.
- GLB validation passed with 0 errors and 1 tangent-space warning.
- QA status remained `needs_review` with `OFFICIAL_DIMENSIONS_MISSING`; this is expected until official product dimensions or a trusted dimension override are provided.
