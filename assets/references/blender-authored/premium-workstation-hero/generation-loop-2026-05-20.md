# Premium Workstation Asset Generation Loop - 2026-05-20

## Status

The current `p2s_premium_workstation_hero` asset is a failed visual candidate. It remains in the repository as source evidence, but it must not be treated as an approved or commercial-quality deskterior asset.

Active scene status:
- Runtime flag: `ENABLE_PREMIUM_WORKSTATION_HERO = false`
- Failed GLB: `apps/web/public/assets/models/p2s_premium_workstation_hero/p2s_premium_workstation_hero.glb`
- Source blend: `assets/blender/deskterior/p2s_premium_workstation_hero.blend`
- Failed screenshot: `output/playwright/pc-assembly-workbench-workstation-hero.png`

## External Reference Set

These are comparison references, not automatic import approvals. Any direct download/import still needs license and attribution handling before use.

1. Bruno Simon reference implementation
   - Source: https://github.com/brunosimon/my-room-in-3d
   - Role: target composition quality, lighting mood, asset density, stylized detail language.

2. Sketchfab - Modern Desk Setup Game Ready
   - Source: https://sketchfab.com/3d-models/modern-desk-setup-game-ready-3d-model-346abd870f044ccf955a68bae0365c4a
   - Observed benchmark: approximately `52.1k` triangles with a complete desk, PC, RGB, monitor, laptop, input devices, webcam, plant, mug, notebook, and stationery.
   - Role: web/game-ready density benchmark at a triangle budget close to the failed candidate.

3. Sketchfab - Modern PC Desk Setup
   - Source: https://sketchfab.com/3d-models/modern-pc-desk-setup-3d-model-a02e91614dbe4f15b667ba80244e96a9
   - Observed benchmark: approximately `125.5k` triangles and a clean desk, PC tower, ultrawide display, keyboard, mouse, and speakers.
   - Role: organized modern workstation proportions and component readability.

4. Sketchfab - Programmer Desk Setup Stylized 3D Room
   - Source: https://sketchfab.com/3d-models/programmer-desk-setup-stylized-3d-room-ede58cf414534e47b57bf788dc075b17
   - Observed benchmark: approximately `188.2k` triangles and a full stylized room with multiple monitors, shelves, tech decor, and neon mood.
   - Role: room-level deskterior density and vertical wall/shelf composition.

5. CGTrader - Modern Gaming Setup Desk 3D Model
   - Source: https://www.cgtrader.com/3d-models/furniture/furniture-set/modern-gaming-desk-setup-3d-model-corona
   - Observed benchmark: commercial render asset with UV mapping, textures, materials, large texture payload, and Corona render target.
   - Role: commercial asset expectation for UV/textures/material depth. Not a web budget target.

## Why The Current Candidate Failed

Current candidate metrics:
- `157` exported nodes
- `157` exported meshes
- `29` exported materials
- `1` embedded texture
- `55,076` triangles
- Public GLB size: about `2.7M`

Failures:
- The mesh count is high, but most forms read as primitive blocks rather than authored products.
- The PC tower silhouette is too simple: flat transparent box, weak bevel hierarchy, no believable side-panel thickness, no layered fan housing, no internal component depth.
- The desk surface lacks convincing material treatment: one procedural wood texture is not enough without UV intent, edge wear, bevel highlights, roughness variation, and ambient occlusion.
- Monitor, keyboard, mouse, lamp, mic arm, speakers, and props do not carry enough close-range shape detail to survive the cinematic camera.
- Cable management reads as decorative curves, not real routed cables with clamps, strain relief, and attachment points.
- Scale/proportion is inconsistent: PC, monitors, lamp, and tabletop props compete without a coherent real-world desk system.
- There is no baked AO/GI/lightmap pass, so contact and underside detail depend too much on runtime lighting.
- There is no side-by-side asset preview gate; the candidate was inserted into the room before visual comparison.

## Regeneration Gate

A new Blender-authored workstation candidate cannot be activated in the scene until all of these checks are passed:

1. Standalone asset preview
   - Render the GLB alone from at least front-isometric, side, and close-up crop views.
   - Compare against the reference set before scene integration.

2. Shape language
   - Large forms must have bevel hierarchy, panel thickness, inset seams, visible attachment detail, and consistent scale.
   - PC case must show believable glass, metal frame, front/side ventilation, fans, motherboard/GPU mass, and routed cable silhouettes.

3. Material language
   - Use slot-level PBR materials with roughness/metalness variation.
   - Use UV or generated texture maps for wood, fabric/rubber mat, glass, anodized metal, plastics, LED emissive surfaces, and screen content.
   - One generic embedded texture is not enough for promotion.

4. Detail density
   - Desktop cluster must include monitor arms/stands, cable clips, keyboard key rows, mouse detail, desk mat seams, lamp joints, speaker drivers, mug thickness, plant leaf separation, and paper/notebook layering.
   - Detail should be concentrated where the camera sees it, not evenly sprinkled.

5. Runtime package
   - GLB plus review JSON must record triangle count, material count, texture count, named nodes, and known missing work.
   - If accepted, add LOD/proxy/collider/support metadata separately before treating it as a reusable catalog asset.

## Next Iteration Constraint

The next iteration should not start as a full room replacement. It should start with a single high-value workstation cluster asset preview, then enter the room only after it beats the current failed candidate in a side-by-side screenshot.

## Iteration Log

### V2 Candidate

Outputs:
- Script: `scripts/blender/generate-premium-workstation-asset-v2.py`
- Blend: `assets/blender/deskterior/p2s_premium_workstation_hero_v2.blend`
- GLB: `apps/web/public/assets/models/p2s_premium_workstation_hero_v2/p2s_premium_workstation_hero_v2.glb`
- Review board: `assets/references/blender-authored/premium-workstation-hero/workstation-v2-review-board.png`

Result:
- Failed.

Why:
- Large visible planes rendered like magenta fallback or over-saturated emissive material.
- The PC front and desk mat became visually dominant instead of supporting the workstation.
- Extra geometry improved density, but color/material discipline regressed.

### V3 Candidate

Outputs:
- Script: `scripts/blender/generate-premium-workstation-asset-v3.py`
- Blend: `assets/blender/deskterior/p2s_premium_workstation_hero_v3.blend`
- GLB: `apps/web/public/assets/models/p2s_premium_workstation_hero_v3/p2s_premium_workstation_hero_v3.glb`
- Review board: `assets/references/blender-authored/premium-workstation-hero/workstation-v3-review-board.png`

Result:
- Improved over V2, still review-only.

Evidence:
- V2 isometric magenta-pixel ratio: `0.0733`
- V3 isometric magenta-pixel ratio: `0.0`
- V3 metrics: `377 nodes`, `372 mesh/curve objects`, `44 generated materials`, `94,684 triangles`, `4.7M` GLB bytes.
- Re-open audit: `372 mesh/curve objects`, `40 materials`, `2 texture images`, `0 unmaterialed objects`, `0 missing external images`.

Remaining blockers:
- Still procedural rather than hand-authored commercial asset quality.
- Needs true UV atlas, normal/roughness/AO texture pass, baked AO/GI/lightmap, and product-accurate PC internals.
- Must not be active in the room scene until standalone visual review approves it.

### V4 Candidate

Outputs:
- Script: `scripts/blender/generate-premium-workstation-asset-v4.py`
- Blend: `assets/blender/deskterior/p2s_premium_workstation_hero_v4.blend`
- GLB: `apps/web/public/assets/models/p2s_premium_workstation_hero_v4/p2s_premium_workstation_hero_v4.glb`
- Review board: `assets/references/blender-authored/premium-workstation-hero/workstation-v4-review-board.png`
- Texture artifacts: `workstation-v4-basecolor-atlas.png`, `workstation-v4-orm-atlas.png`

Result:
- Technical progress, visual regression, still review-only.

Evidence:
- V4 metrics: `425 nodes`, `420 mesh/curve objects`, `116,580 triangles`, `4` texture images, `6.0M` GLB bytes.
- Re-open audit: `212` UVAtlas mesh objects, `212` LightmapUV2 mesh objects, `0` unmaterialed objects, `0` missing external images.
- Added AM5 socket frame, DDR5 slots/RAM, M.2 heatsink, VRM blocks, RTX-style GPU, LCD pump, AIO tubes/radiator, PSU shroud, and routed 24-pin sleeve hints.

Why it did not pass:
- The generated atlas was assigned, but the material did not explicitly sample the `UVAtlas` channel.
- Blender rendered the material from unrelated/default UVs on some meshes, making the candidate read as a patchwork texture bug.
- This candidate must not be promoted even though it filled several technical package gaps.

### V5 Candidate

Outputs:
- Script: `scripts/blender/generate-premium-workstation-asset-v5.py`
- Blend: `assets/blender/deskterior/p2s_premium_workstation_hero_v5.blend`
- GLB: `apps/web/public/assets/models/p2s_premium_workstation_hero_v5/p2s_premium_workstation_hero_v5.glb`
- Review board: `assets/references/blender-authored/premium-workstation-hero/workstation-v5-review-board.png`
- Texture artifacts: `workstation-v5-basecolor-atlas.png`, `workstation-v5-orm-atlas.png`

Result:
- Fixes the V4 UV sampling regression, still review-only.

Evidence:
- V5 metrics: `425 nodes`, `420 mesh/curve objects`, `116,580 triangles`, `4` texture images, `6.0M` GLB bytes.
- Re-open audit: `212` UVAtlas mesh objects, `212` active UVAtlas mesh objects, `212` LightmapUV2 mesh objects, `0` unmaterialed objects, `0` missing external images.
- V4 isometric cyan-pixel ratio was `0.0384`; V5 isometric cyan-pixel ratio is `0.0009`, confirming the visible atlas patchwork regression was reduced.

Remaining blockers:
- V5 is a better standalone review candidate, not a scene-approved commercial asset.
- The atlas is generated/procedural rather than hand-authored production texture work.
- AO is still contact-authored and baked-style; full static GI/lightmap baking remains separate.
- Product geometry is inspired by the Compuzone-style white PC build, not exact manufacturer CAD/scans.
- LOD/proxy/collider/support metadata and side-by-side human visual approval are still required before live room integration.

### V6 Candidate

Outputs:
- Script: `scripts/blender/generate-premium-workstation-asset-v6.py`
- Blend: `assets/blender/deskterior/p2s_premium_workstation_hero_v6.blend`
- GLB: `apps/web/public/assets/models/p2s_premium_workstation_hero_v6/p2s_premium_workstation_hero_v6.glb`
- Review board: `assets/references/blender-authored/premium-workstation-hero/workstation-v6-review-board.png`

Result:
- Detail progress, visual regression, still review-only.

Evidence:
- V6 metrics: `615 nodes`, `609 mesh/curve objects`, `141,480 triangles`, `4` texture images, `7.6M` GLB bytes.
- Added `184+` marked desktop micro-detail objects across cables, desk, display, keyboard, lamp, mic, monitor, mouse, mug, paper, plant, and speaker categories.
- Added runtime sidecars for colliders and support surfaces.

Why it did not pass:
- The desktop gained micro-detail, but the plank/cross seams became too bright and grid-like in the close-up camera.
- This repeated the same failure class as prior room wall/grid artifacts: visible construction lines read as UI overlay rather than material detail.

### V7 Candidate

Outputs:
- Script: `scripts/blender/generate-premium-workstation-asset-v7.py`
- Blend: `assets/blender/deskterior/p2s_premium_workstation_hero_v7.blend`
- GLB: `apps/web/public/assets/models/p2s_premium_workstation_hero_v7/p2s_premium_workstation_hero_v7.glb`
- Review board: `assets/references/blender-authored/premium-workstation-hero/workstation-v7-review-board.png`

Result:
- Fixes the V6 tabletop seam regression, still review-only.

Evidence:
- V7 metrics: `610 nodes`, `604 mesh/curve objects`, `141,260 triangles`, `4` texture images, `7.6M` GLB bytes.
- Re-open audit: `212` UVAtlas mesh objects, `212` active UVAtlas mesh objects, `177` DetailUV mesh objects, `389` LightmapUV2 mesh objects, `0` unmaterialed objects, `0` missing external images.
- V7 removed cross-grid tabletop seams and lowered the remaining plank seam contrast.

Remaining blockers:
- V7 improved material readability but desk props still looked schematic at close range.
- Keyboard/mouse/monitor/speaker/PC case details needed product-scale seams, fasteners, ports, labels, and visual hierarchy.

### V8 Candidate

Outputs:
- Script: `scripts/blender/generate-premium-workstation-asset-v8.py`
- Blend: `assets/blender/deskterior/p2s_premium_workstation_hero_v8.blend`
- GLB: `apps/web/public/assets/models/p2s_premium_workstation_hero_v8/p2s_premium_workstation_hero_v8.glb`
- Review board: `assets/references/blender-authored/premium-workstation-hero/workstation-v8-review-board.png`
- Review JSON: `assets/references/blender-authored/premium-workstation-hero/asset-review-v8-2026-05-20.json`

Result:
- Best standalone desk/desktop-object candidate in this loop, still not live-scene or commercial-approved.

Evidence:
- V8 metrics: `716 nodes`, `710 mesh/curve objects`, `160,500 triangles`, `4` texture images, `9.0M` GLB bytes.
- Detail pass: `290` marked desktop micro-detail objects.
- Re-open audit: `212` UVAtlas mesh objects, `212` active UVAtlas mesh objects, `283` DetailUV mesh objects, `495` LightmapUV2 mesh objects, `0` unmaterialed objects, `0` missing external images.
- Pixel regression check: V7 tabletop high-chroma-edge ratio `0.1076`; V8 tabletop high-chroma-edge ratio `0.0742`. V7 tabletop warm ratio `0.1036`; V8 tabletop warm ratio `0.0893`.

What improved:
- Monitor surfaces now have denser UI layers instead of flat black panels.
- Keyboard, mouse, speakers, PC case, desk, notebook, pens, plant, mug, and cable grommet gained product-scale seams, fasteners, labels, ports, vents, and material cues.
- The V7 tabletop seam fix is preserved.

Still not approval:
- Procedural materials still need hand-authored texture polish or stronger authored atlas work.
- This is not a full room integration pass; lighting/context parity with the Bruno reference still needs final scene review.
- Runtime LOD/proxy packaging is still pending before replacing active QA scene geometry.
- Human side-by-side approval against licensed/open commercial-quality references is still required.
