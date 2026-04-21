import {
  groupAssetsForInstancing,
  resolveAssetInstancingPlan
} from "../src/lib/scene/asset-instancing";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function createAsset(id: string, overrides?: {
  assetId?: string;
  finishColor?: string | null;
  finishMaterial?: string | null;
  detailNotes?: string | null;
  lodProfile?: {
    strategy: "single_mesh" | "manual_lod";
    levelCount: number;
    maxDrawCalls: number;
    maxTriangleCount: number;
  } | null;
}) {
  return {
    id,
    assetId: overrides?.assetId ?? "p2s_ceramic_mug",
    catalogItemId: "ceramic-mug",
    product: {
      id: "ceramic-mug",
      name: "Ceramic Mug",
      category: "Decor",
      brand: "Plan2Space",
      price: null,
      options: null,
      externalUrl: null,
      thumbnail: null,
      dimensionsMm: {
        width: 96,
        depth: 96,
        height: 102
      },
      finishColor: overrides?.finishColor ?? "cream",
      finishMaterial: overrides?.finishMaterial ?? "ceramic",
      detailNotes: overrides?.detailNotes ?? "gloss finish",
      scaleLocked: true,
      source: null,
      license: null,
      pivot: null,
      collisionProxy: null,
      textureSet: null,
      lodProfile:
        overrides?.lodProfile ??
        ({
          strategy: "single_mesh",
          levelCount: 1,
          maxDrawCalls: 2,
          maxTriangleCount: 324
        } as const)
    },
    anchorType: "desk_surface" as const,
    supportAssetId: "desk-1",
    position: [0, 0.76, 0] as [number, number, number],
    rotation: [0, 0, 0] as [number, number, number],
    scale: [1, 1, 1] as [number, number, number],
    materialId: null
  };
}

const repeatedAssets = [
  createAsset("mug-1"),
  createAsset("mug-2"),
  createAsset("mug-4"),
  createAsset("mug-3", { finishColor: "black" }),
  createAsset("lamp-1", {
    assetId: "p2s_desk_lamp_glow",
    lodProfile: {
      strategy: "single_mesh",
      levelCount: 1,
      maxDrawCalls: 12,
      maxTriangleCount: 6000
    }
  }),
  createAsset("tray-1", {
    assetId: "p2s_desk_tray_oak",
    lodProfile: {
      strategy: "manual_lod",
      levelCount: 2,
      maxDrawCalls: 4,
      maxTriangleCount: 420
    }
  })
];

try {
  const readOnlyTopPlan = resolveAssetInstancingPlan({
    asset: repeatedAssets[0]!,
    viewMode: "top",
    topMode: "room",
    readOnly: true,
    enableDynamicLight: false,
    isSelected: false
  });
  const editableTopPlan = resolveAssetInstancingPlan({
    asset: repeatedAssets[0]!,
    viewMode: "top",
    topMode: "room",
    readOnly: false,
    enableDynamicLight: false,
    isSelected: false
  });
  const walkReadOnlyPlan = resolveAssetInstancingPlan({
    asset: repeatedAssets[0]!,
    viewMode: "walk",
    topMode: "room",
    readOnly: true,
    enableDynamicLight: false,
    isSelected: false
  });
  const builderPreviewPlan = resolveAssetInstancingPlan({
    asset: repeatedAssets[0]!,
    viewMode: "builder-preview",
    topMode: "room",
    readOnly: false,
    enableDynamicLight: false,
    isSelected: false
  });
  const editableDeskPrecisionPlan = resolveAssetInstancingPlan({
    asset: repeatedAssets[0]!,
    viewMode: "top",
    topMode: "desk-precision",
    readOnly: false,
    enableDynamicLight: false,
    isSelected: false
  });
  const selectedPlan = resolveAssetInstancingPlan({
    asset: repeatedAssets[0]!,
    viewMode: "top",
    topMode: "room",
    readOnly: true,
    enableDynamicLight: false,
    isSelected: true
  });
  const dynamicLightPlan = resolveAssetInstancingPlan({
    asset: repeatedAssets[3]!,
    viewMode: "walk",
    topMode: "room",
    readOnly: true,
    enableDynamicLight: true,
    isSelected: false
  });
  const manualLodPlan = resolveAssetInstancingPlan({
    asset: repeatedAssets[4]!,
    viewMode: "builder-preview",
    topMode: "room",
    readOnly: false,
    enableDynamicLight: false,
    isSelected: false
  });

  const clusters = groupAssetsForInstancing({
    assets: repeatedAssets,
    viewMode: "builder-preview",
    topMode: "room",
    readOnly: false,
    isTransforming: false,
    selectedAssetId: null,
    emitterAssetIds: new Set<string>()
  });
  const deskPrecisionClusters = groupAssetsForInstancing({
    assets: repeatedAssets,
    viewMode: "top",
    topMode: "desk-precision",
    readOnly: false,
    isTransforming: false,
    selectedAssetId: "mug-1",
    emitterAssetIds: new Set<string>()
  });
  const roomModeClusters = groupAssetsForInstancing({
    assets: repeatedAssets,
    viewMode: "top",
    topMode: "room",
    readOnly: false,
    isTransforming: false,
    selectedAssetId: "mug-1",
    emitterAssetIds: new Set<string>()
  });
  const roomModeDraggingClusters = groupAssetsForInstancing({
    assets: repeatedAssets,
    viewMode: "top",
    topMode: "room",
    readOnly: false,
    isTransforming: true,
    selectedAssetId: "mug-1",
    emitterAssetIds: new Set<string>()
  });

  assert(readOnlyTopPlan.eligible, "read-only top room asset should be instancing-eligible");
  assert(walkReadOnlyPlan.eligible, "read-only walk asset should be instancing-eligible");
  assert(builderPreviewPlan.eligible, "builder preview asset should be instancing-eligible");
  assert(
    editableDeskPrecisionPlan.eligible,
    "editable desk precision asset should be instancing-eligible"
  );
  assert(editableTopPlan.eligible, "editable top room asset should be instancing-eligible while idle");
  assert(!selectedPlan.eligible, "selected asset should stay per-instance");
  assert(!dynamicLightPlan.eligible, "dynamic light asset should stay per-instance");
  assert(!manualLodPlan.eligible, "manual LOD asset should stay per-instance");
  assert(clusters.length === 1, `expected one repeated cluster, received ${clusters.length}`);
  assert(
    clusters[0]?.assets.map((asset) => asset.id).join(",") === "mug-1,mug-2,mug-4",
    `unexpected cluster members: ${clusters[0]?.assets.map((asset) => asset.id).join(",")}`
  );
  assert(
    deskPrecisionClusters.length === 1,
    `expected one desk precision cluster, received ${deskPrecisionClusters.length}`
  );
  assert(
    deskPrecisionClusters[0]?.assets.map((asset) => asset.id).join(",") === "mug-2,mug-4",
    `unexpected desk precision cluster members: ${deskPrecisionClusters[0]?.assets
      .map((asset) => asset.id)
      .join(",")}`
  );
  assert(
    roomModeClusters.length === 1,
    `expected one room mode cluster, received ${roomModeClusters.length}`
  );
  assert(
    roomModeClusters[0]?.assets.map((asset) => asset.id).join(",") === "mug-2,mug-4",
    `unexpected room mode cluster members: ${roomModeClusters[0]?.assets
      .map((asset) => asset.id)
      .join(",")}`
  );
  assert(
    roomModeDraggingClusters.length === 1,
    `expected one room mode dragging cluster, received ${roomModeDraggingClusters.length}`
  );
  assert(
    roomModeDraggingClusters[0]?.assets.map((asset) => asset.id).join(",") === "mug-1,mug-2,mug-4",
    `unexpected room mode dragging cluster members: ${roomModeDraggingClusters[0]?.assets
      .map((asset) => asset.id)
      .join(",")}`
  );

  console.log("asset instancing policy ok");
  console.log(
    JSON.stringify(
      {
        readOnlyTopPlan,
        editableTopPlan,
        walkReadOnlyPlan,
        builderPreviewPlan,
        editableDeskPrecisionPlan,
        selectedPlan,
        dynamicLightPlan,
        manualLodPlan,
        clusters: clusters.map((cluster) => ({
          key: cluster.key,
          assetIds: cluster.assets.map((asset) => asset.id)
        })),
        deskPrecisionClusters: deskPrecisionClusters.map((cluster) => ({
          key: cluster.key,
          assetIds: cluster.assets.map((asset) => asset.id)
        })),
        roomModeClusters: roomModeClusters.map((cluster) => ({
          key: cluster.key,
          assetIds: cluster.assets.map((asset) => asset.id)
        })),
        roomModeDraggingClusters: roomModeDraggingClusters.map((cluster) => ({
          key: cluster.key,
          assetIds: cluster.assets.map((asset) => asset.id)
        }))
      },
      null,
      2
    )
  );
} catch (error) {
  console.error("[verify-asset-instancing-policy] failed");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
