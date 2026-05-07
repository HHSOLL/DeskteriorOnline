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
assert.equal(builderPreviewQuality.enableShadows, false, "builder preview should not spend budget on dynamic shadows");
assert.equal(
  builderPreviewQuality.enableContactShadows,
  false,
  "builder preview should not render contact shadow planes"
);
assert.equal(builderPreviewQuality.enablePostEffects, false, "builder preview should disable heavy post effects");
assert.equal(builderPreviewQuality.dpr[1] <= 1.15, true, "builder preview DPR should stay bounded");

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

console.log("[verify:builder-performance] PASS");
