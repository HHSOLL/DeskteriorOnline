import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveSceneRenderQuality } from "../src/lib/scene/render-quality";

function readSource(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

const builderPreviewQuality = resolveSceneRenderQuality({
  interactionMode: "preview",
  viewMode: "builder-preview",
  topMode: "room",
  coarsePointer: false,
  devicePixelRatio: 1,
  hardwareConcurrency: 10,
  viewportWidth: 1440
});

assert.equal(builderPreviewQuality.frameLoop, "demand", "builder preview should idle on demand");
assert.equal(
  builderPreviewQuality.enableShadows,
  true,
  "builder preview should keep bounded dynamic shadows for furnished diorama grounding"
);
assert.equal(
  builderPreviewQuality.enableContactShadows,
  true,
  "builder preview should render bounded contact shadow planes for furnished diorama grounding"
);
assert.equal(builderPreviewQuality.enablePostEffects, false, "builder preview should disable heavy post effects");
assert.equal(builderPreviewQuality.enableSSR, false, "builder preview should disable SSR");
assert.equal(builderPreviewQuality.enableBloom, false, "builder preview should disable bloom");
assert.equal(builderPreviewQuality.shadowMapSize <= 896, true, "builder preview shadow map should stay bounded");
assert.equal(builderPreviewQuality.contactShadowResolution <= 320, true, "builder preview contact shadow resolution should stay bounded");
assert.equal(builderPreviewQuality.contactShadowFar <= 8, true, "builder preview contact shadow capture should stay bounded");
assert.equal(builderPreviewQuality.dpr[1] <= 1.24, true, "builder preview DPR should stay bounded");

const sceneViewportSource = readSource("src/components/editor/SceneViewport.tsx");
assert.match(
  sceneViewportSource,
  /<Suspense fallback=\{<ProceduralFloorFallback \/>\}>/,
  "floor shell should keep a visible fallback during material loading"
);
assert.match(
  sceneViewportSource,
  /<Suspense fallback=\{<ProceduralWallFallback \/>\}>/,
  "wall shell should keep a visible fallback during material loading"
);

const wallSource = readSource("src/components/canvas/features/ProceduralWall.tsx");
const floorSource = readSource("src/components/canvas/features/ProceduralFloor.tsx");
const cameraRigSource = readSource("src/components/canvas/core/CameraRig.tsx");
assert.match(
  wallSource,
  /function useRetainedTextureSet/,
  "wall material swaps should retain the previous texture set while loading"
);
assert.match(
  floorSource,
  /function useRetainedTextureSet/,
  "floor material swaps should retain the previous texture set while loading"
);

const lightingStepSource = readSource("src/features/builder/steps/BuilderLightingStep.tsx");
const seededAssetsSource = readSource("src/lib/builder/seeded-assets.ts");
const builderStyleSource = readSource("src/features/builder/steps/BuilderStyleStep.tsx");
assert.match(
  lightingStepSource,
  /requestAnimationFrame\(flushPendingDragUpdate\)/,
  "lighting drag should batch pointer-move payload writes with requestAnimationFrame"
);
assert.match(
  lightingStepSource,
  /cancelAnimationFrame\(dragFrameRef\.current\)/,
  "lighting drag should clean up pending animation frames"
);
assert.match(
  cameraRigSource,
  /<OrthographicCamera[\s\S]*?zoom=\{builderZoom\}/,
  "builder preview should keep an orthographic diorama camera with explicit zoom"
);
assert.match(
  cameraRigSource,
  /<CameraPoseSync position=\{builderCameraPosition\} target=\{builderCameraTarget\} \/>/,
  "builder preview camera pose should be explicitly synchronized on mode changes"
);
assert.match(
  cameraRigSource,
  /const builderPresentationDistance = Math\.max\(4\.4, radius \* 1\.22\);/,
  "builder preview camera should sit outside the room diagonal instead of inside the corner"
);
assert.match(
  cameraRigSource,
  /const builderHeight = Math\.max\(4\.15, Math\.min\(5\.4, radius \* 0\.86\)\);/,
  "builder preview camera should stay low enough for diorama depth while avoiding foreground occlusion"
);
assert.match(
  cameraRigSource,
  /const builderTargetY = Math\.max\(0\.98, radius \* 0\.13\);/,
  "builder preview camera should look into furniture height, not only at the floor center"
);
assert.match(
  cameraRigSource,
  /const builderZoom = Math\.max\(88, Math\.min\(148, 840 \/ radius\)\);/,
  "builder preview camera zoom should keep a tighter compact-room framing"
);
assert.match(
  cameraRigSource,
  /minPolarAngle=\{Math\.PI \* 0\.24\}/,
  "builder preview orbit should avoid drifting back to a high top-down angle"
);
assert.match(
  cameraRigSource,
  /maxPolarAngle=\{Math\.PI \* 0\.46\}/,
  "builder preview orbit should allow a lower immersive diorama angle"
);
assert.match(
  seededAssetsSource,
  /export const WORKSPACE_FLEX_CLUSTER_PRESETS = \[/,
  "workspace-flex should expose purpose-built cluster presets for fast room composition changes"
);
assert.match(
  seededAssetsSource,
  /id: "creator-desk"[\s\S]*?clusterIds: \["workstation", "display"\]/,
  "workspace-flex creator desk preset should focus on workstation and display clusters"
);
assert.match(
  seededAssetsSource,
  /id: "media-lounge"[\s\S]*?clusterIds: \["media", "lounge"\]/,
  "workspace-flex media lounge preset should focus on media and lounge clusters"
);
assert.match(
  builderStyleSource,
  /data-testid="workspace-cluster-preset-controls"/,
  "builder style step should render workspace cluster preset controls"
);
assert.match(
  builderStyleSource,
  /data-testid=\{`workspace-cluster-preset-\$\{preset\.id\}`\}/,
  "workspace cluster preset buttons should be directly targetable in browser QA"
);
assert.match(
  builderStyleSource,
  /onWorkspaceClusterIdsChange\(\[\.\.\.preset\.clusterIds\]\)/,
  "workspace cluster presets should reuse the existing cluster state and URL/payload flow"
);
assert.match(
  builderStyleSource,
  /describeWorkspaceFlexClusterSelection/,
  "builder style step should disclose generated decor from the workspace-flex seed contract before project creation"
);
assert.match(
  builderStyleSource,
  /data-testid=\{`workspace-cluster-preset-generated-badge-\$\{preset\.id\}`\}/,
  "builder style preset buttons should expose generated decor badges for browser QA"
);
assert.match(
  builderStyleSource,
  /data-testid=\{`workspace-cluster-generated-badge-\$\{option\.id\}`\}/,
  "builder style cluster toggles should expose generated decor badges for browser QA"
);

const furnitureSource = readSource("src/components/canvas/features/Furniture.tsx");
assert.match(
  furnitureSource,
  /function BuilderPreviewGroundDressing/,
  "builder preview should keep renderer-only ground dressing for lounge rug anchoring"
);
assert.match(
  furnitureSource,
  /viewMode === "builder-preview" \? <BuilderPreviewGroundDressing assets=\{visibleAssets\} \/> : null/,
  "builder preview ground dressing must stay scoped to the builder preview render path"
);
assert.match(
  furnitureSource,
  /name="builder-preview-ground-dressing"/,
  "builder preview ground dressing should remain identifiable for visual smoke checks"
);
assert.match(
  furnitureSource,
  /type FurnitureRenderSource =/,
  "furniture render paths should expose explicit source contracts for visual QA"
);
assert.match(
  furnitureSource,
  /function FurnitureRenderSourceMarker/,
  "furniture render paths should wrap runtime output with identifiable source markers"
);
assert.match(
  furnitureSource,
  /__DESKTERIORONLINE_FURNITURE_RENDER_SOURCES__/,
  "furniture render paths should expose a browser-readable source registry for visual smoke checks"
);
assert.match(
  furnitureSource,
  /function resolveFurnitureRenderSource/,
  "furniture render source resolution should stay centralized for QA and browser registry checks"
);
assert.match(
  furnitureSource,
  /<FurnitureRenderSourceMarker source="builder-preview-proxy" assetId=\{asset\.id\}>/,
  "builder preview proxies should be distinguishable from real GLB output"
);
assert.match(
  furnitureSource,
  /<FurnitureRenderSourceMarker source="placeholder-fallback" assetId=\{asset\.id\}>/,
  "placeholder fallbacks should be distinguishable from authored or generated GLB output"
);
assert.match(
  furnitureSource,
  /<FurnitureRenderSourceMarker source="model-loading-fallback" assetId=\{asset\.id\}>/,
  "temporary model-loading fallback boxes should be distinguishable during visual smoke checks"
);
assert.match(
  furnitureSource,
  /source=\{lodPlan\.useProxyBox && lodPlan\.lowDetailDistance !== null \? "real-glb-lod" : "real-glb"\}/,
  "real GLB output should report whether runtime LOD proxying is active"
);
assert.match(
  furnitureSource,
  /resolveFurnitureRenderSourceName\("lod-proxy", asset\.id\)/,
  "LOD proxy boxes should remain identifiable instead of masquerading as source GLB geometry"
);
assert.match(
  furnitureSource,
  /userData=\{\{ furnitureRenderSource: source, assetId \}\}/,
  "render source markers should expose runtime metadata for browser-side checks"
);
assert.match(
  furnitureSource,
  /registry\[asset\.id\] = \{[\s\S]*?source: renderSource,[\s\S]*?usesLodProxy: lodPlan\.useProxyBox && lodPlan\.lowDetailDistance !== null[\s\S]*?\};/,
  "browser source registry should include each visible furniture asset's source and LOD state"
);
assert.match(
  furnitureSource,
  /key=\{`rug-weave-\$\{z\}`\}/,
  "builder preview lounge rug should include woven edge detail instead of a flat color block"
);
assert.match(
  furnitureSource,
  /position=\{\[lx\(-0\.18\), localY\(0\.305\), lz\(0\.08\)\]\}/,
  "coffee-table proxy should keep small tabletop object density for diorama legibility"
);
const surfaceDressingSource = furnitureSource.match(
  /function BuilderPreviewSurfaceDressing[\s\S]*?\n}\n\nfunction BuilderPreviewProxy/
);
const wallDressingSource = furnitureSource.match(
  /function BuilderPreviewWallDressing[\s\S]*?\n}\n\nfunction resolveBuilderPreviewWorldDimensions/
);
assert.ok(surfaceDressingSource, "builder preview should keep renderer-only desk/shelf/media surface dressing");
assert.ok(wallDressingSource, "builder preview should keep renderer-only wall dressing for gallery and LED density");
assert.match(
  furnitureSource,
  /viewMode === "builder-preview" \? <BuilderPreviewSurfaceDressing assets=\{visibleAssets\} \/> : null/,
  "builder preview surface dressing must stay scoped to the builder preview render path"
);
assert.match(
  furnitureSource,
  /viewMode === "builder-preview" \? <BuilderPreviewWallDressing \/> : null/,
  "builder preview wall dressing must stay scoped to the builder preview render path"
);
assert.match(
  furnitureSource,
  /name="builder-preview-surface-dressing"/,
  "builder preview surface dressing should remain identifiable for visual smoke checks"
);
assert.match(
  furnitureSource,
  /name="builder-preview-wall-dressing"/,
  "builder preview wall dressing should remain identifiable for visual smoke checks"
);
assert.match(
  furnitureSource,
  /name="builder-preview-desk-surface-kit"/,
  "desk proxy should keep small surface props for creator-room density"
);
assert.match(
  furnitureSource,
  /name="builder-preview-headphones"/,
  "desk proxy should keep headphone silhouette detail for personal object staging"
);
assert.match(
  furnitureSource,
  /name="builder-preview-media-console-surface-kit"/,
  "media console proxy should keep surface console and remote detail"
);
assert.match(
  furnitureSource,
  /name="builder-preview-shelf-collectibles"/,
  "shelf proxy should keep small collectible staging for vertical object density"
);
assert.match(
  furnitureSource,
  /name="builder-preview-rear-wall-gallery"/,
  "builder preview wall dressing should add framed wall art to reduce blank wall surface"
);
assert.match(
  furnitureSource,
  /name="builder-preview-rear-wall-shelf"/,
  "builder preview wall dressing should add shelf props for vertical room density"
);
assert.match(
  furnitureSource,
  /name="builder-preview-side-warm-led"/,
  "builder preview wall dressing should add warm LED strip geometry without dynamic emitters"
);
assert.doesNotMatch(
  surfaceDressingSource[0],
  /<(?:pointLight|spotLight|directionalLight|ambientLight)\b/,
  "builder preview surface dressing should not add dynamic light emitters"
);
assert.doesNotMatch(
  wallDressingSource[0],
  /<(?:pointLight|spotLight|directionalLight|ambientLight)\b/,
  "builder preview wall dressing should not add dynamic light emitters"
);

console.log("[verify:builder-performance] PASS");
