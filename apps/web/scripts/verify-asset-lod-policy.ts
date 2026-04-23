import { resolveAssetLodPlan } from "../src/lib/scene/asset-lod";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const complexAsset = {
  product: {
    id: "complex-asset",
    name: "Complex Asset",
    category: "Decor",
    dimensionsMm: null,
    finishColor: null,
    finishMaterial: null,
    detailNotes: null,
    scaleLocked: false,
    source: null,
    license: null,
    pivot: null,
    collisionProxy: null,
    textureSet: null,
    lodProfile: {
      strategy: "single_mesh" as const,
      levelCount: 1,
      maxDrawCalls: 12,
      maxTriangleCount: 6000
    }
  }
};

const simpleAsset = {
  product: {
    id: "simple-asset",
    name: "Simple Asset",
    category: "Decor",
    dimensionsMm: null,
    finishColor: null,
    finishMaterial: null,
    detailNotes: null,
    scaleLocked: false,
    source: null,
    license: null,
    pivot: null,
    collisionProxy: null,
    textureSet: null,
    lodProfile: {
      strategy: "single_mesh" as const,
      levelCount: 1,
      maxDrawCalls: 2,
      maxTriangleCount: 324
    }
  }
};

const manualLodAsset = {
  product: {
    id: "manual-lod-asset",
    name: "Manual LOD Asset",
    category: "Decor",
    dimensionsMm: null,
    finishColor: null,
    finishMaterial: null,
    detailNotes: null,
    scaleLocked: false,
    source: null,
    license: null,
    pivot: null,
    collisionProxy: null,
    textureSet: null,
    lodProfile: {
      strategy: "manual_lod" as const,
      levelCount: 2,
      maxDrawCalls: 8,
      maxTriangleCount: 3200
    }
  }
};

try {
  const roomTop = resolveAssetLodPlan({
    asset: complexAsset,
    viewMode: "top",
    topMode: "room"
  });
  const precisionTop = resolveAssetLodPlan({
    asset: complexAsset,
    viewMode: "top",
    topMode: "desk-precision"
  });
  const precisionTopFocused = resolveAssetLodPlan({
    asset: complexAsset,
    viewMode: "top",
    topMode: "desk-precision",
    priority: "focus"
  });
  const walk = resolveAssetLodPlan({
    asset: complexAsset,
    viewMode: "walk",
    topMode: "room"
  });
  const walkFocused = resolveAssetLodPlan({
    asset: complexAsset,
    viewMode: "walk",
    topMode: "room",
    priority: "focus"
  });
  const simplePrecision = resolveAssetLodPlan({
    asset: simpleAsset,
    viewMode: "top",
    topMode: "desk-precision"
  });
  const manualWalk = resolveAssetLodPlan({
    asset: manualLodAsset,
    viewMode: "walk",
    topMode: "room"
  });

  assert(roomTop.useProxyBox, "complex room top asset should use proxy fallback");
  assert(roomTop.streamingPriority === "deferred", "room top should stay deferred priority by default");
  assert(
    roomTop.lowDetailDistance !== null &&
      precisionTop.lowDetailDistance !== null &&
      roomTop.lowDetailDistance < precisionTop.lowDetailDistance,
    "room top should fall back sooner than desk precision for complex assets"
  );
  assert(
    precisionTop.lowDetailDistance !== null &&
      walk.lowDetailDistance !== null &&
      precisionTop.lowDetailDistance < walk.lowDetailDistance,
    "walk mode should preserve detail farther than desk precision for complex assets"
  );
  assert(
    precisionTop.streamingPriority === "visible" && walk.streamingPriority === "visible",
    "active editor/viewer paths should stay visible priority by default"
  );
  assert(
    precisionTopFocused.useProxyBox === false &&
      precisionTopFocused.lowDetailDistance === null &&
      precisionTopFocused.streamingPriority === "focus",
    "focused desk precision asset should stay full detail"
  );
  assert(
    walkFocused.useProxyBox === false &&
      walkFocused.lowDetailDistance === null &&
      walkFocused.streamingPriority === "focus",
    "focused walk asset should stay full detail"
  );
  assert(
    simplePrecision.useProxyBox === false && simplePrecision.lowDetailDistance === null,
    "simple precision asset should stay full detail"
  );
  assert(
    manualWalk.useProxyBox && manualWalk.lowDetailDistance === 11.5,
    `manual LOD asset should receive distance bonus, got ${manualWalk.lowDetailDistance}`
  );

  console.log("asset lod policy ok");
  console.log(
    JSON.stringify(
      {
        roomTop,
        precisionTop,
        precisionTopFocused,
        walk,
        walkFocused,
        simplePrecision,
        manualWalk
      },
      null,
      2
    )
  );
} catch (error) {
  console.error("[verify-asset-lod-policy] failed");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
