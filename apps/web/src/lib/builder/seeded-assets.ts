import {
  findCatalogItemByAssetId,
  getCatalogGenerationBadge,
  isGeneratedCatalogItem,
  selectStarterSetItems,
  toCatalogProductSnapshot,
  type LibraryCatalogItem
} from "./catalog";
import type { DerivedRoomShell } from "../domain/room-shell";
import type { SceneAnchorType } from "../scene/anchor-types";
import {
  constrainPlacementToAnchor,
  inferAnchorTypeForCatalogItem
} from "../scene/anchors";
import type { SceneAsset } from "../stores/useSceneStore";
import type { FurnishedRoomTemplateId, TemplateSeedPreset } from "./template-browser";

type SeedPresetConfig = {
  assetIds: string[];
  offsets: Array<[number, number]>;
  rotations?: Array<[number, number, number]>;
  anchorTypes?: Array<SceneAnchorType | null>;
  scales?: Array<[number, number, number]>;
  supportCatalogItemIds?: Array<string | null>;
  workspaceClusterIds?: Array<WorkspaceFlexClusterId | null>;
};

type ResolvedSeedItem = {
  item: LibraryCatalogItem;
  seedIndex: number;
};

export const WORKSPACE_FLEX_CLUSTER_OPTIONS = [
  {
    id: "workstation",
    label: "워크스테이션",
    description: "책상, 의자, 모니터, 입력 장비",
    accentColor: "#6a8cff"
  },
  {
    id: "media",
    label: "미디어 존",
    description: "TV, 콘솔, 낮은 수납장",
    accentColor: "#ff537a"
  },
  {
    id: "lounge",
    label: "라운지",
    description: "소파, 커피 테이블, 사이드 조명",
    accentColor: "#f3a447"
  },
  {
    id: "display",
    label: "디스플레이 선반",
    description: "선반, 책, 식물, 장식 소품",
    accentColor: "#4aa77a"
  }
] as const;

export type WorkspaceFlexClusterId = (typeof WORKSPACE_FLEX_CLUSTER_OPTIONS)[number]["id"];

export const DEFAULT_WORKSPACE_FLEX_CLUSTER_IDS: WorkspaceFlexClusterId[] = WORKSPACE_FLEX_CLUSTER_OPTIONS.map(
  (option) => option.id
);

export const WORKSPACE_FLEX_CLUSTER_PRESETS = [
  {
    id: "complete-room",
    label: "풀 룸",
    description: "데스크, 미디어, 라운지, 선반까지 모두 배치",
    clusterIds: DEFAULT_WORKSPACE_FLEX_CLUSTER_IDS
  },
  {
    id: "creator-desk",
    label: "크리에이터 데스크",
    description: "작업대와 디스플레이 선반 중심",
    clusterIds: ["workstation", "display"]
  },
  {
    id: "media-lounge",
    label: "미디어 라운지",
    description: "TV, 콘솔, 소파, 테이블 중심",
    clusterIds: ["media", "lounge"]
  },
  {
    id: "gallery-studio",
    label: "갤러리 스튜디오",
    description: "선반, 데스크 소품, 라운지 균형",
    clusterIds: ["display", "workstation", "lounge"]
  }
] as const satisfies ReadonlyArray<{
  id: string;
  label: string;
  description: string;
  clusterIds: readonly WorkspaceFlexClusterId[];
}>;

const WORKSPACE_FLEX_CLUSTER_ID_SET = new Set<WorkspaceFlexClusterId>(DEFAULT_WORKSPACE_FLEX_CLUSTER_IDS);

export function normalizeWorkspaceFlexClusterIds(values: readonly string[] | null | undefined): WorkspaceFlexClusterId[] {
  if (!values || values.length === 0) {
    return DEFAULT_WORKSPACE_FLEX_CLUSTER_IDS;
  }

  const requested = new Set(
    values.filter((value): value is WorkspaceFlexClusterId =>
      WORKSPACE_FLEX_CLUSTER_ID_SET.has(value as WorkspaceFlexClusterId)
    )
  );
  const normalized = DEFAULT_WORKSPACE_FLEX_CLUSTER_IDS.filter((id) => requested.has(id));
  return normalized.length > 0 ? normalized : DEFAULT_WORKSPACE_FLEX_CLUSTER_IDS;
}

export function parseWorkspaceFlexClusterIds(value: string | null | undefined): WorkspaceFlexClusterId[] {
  if (!value) {
    return DEFAULT_WORKSPACE_FLEX_CLUSTER_IDS;
  }
  return normalizeWorkspaceFlexClusterIds(value.split(","));
}

export function serializeWorkspaceFlexClusterIds(values: readonly WorkspaceFlexClusterId[]) {
  return normalizeWorkspaceFlexClusterIds(values).join(",");
}

export function areDefaultWorkspaceFlexClusterIds(values: readonly WorkspaceFlexClusterId[]) {
  const normalized = normalizeWorkspaceFlexClusterIds(values);
  return (
    normalized.length === DEFAULT_WORKSPACE_FLEX_CLUSTER_IDS.length &&
    normalized.every((id, index) => id === DEFAULT_WORKSPACE_FLEX_CLUSTER_IDS[index])
  );
}

const SEED_PRESETS: Record<Exclude<TemplateSeedPreset, "none">, SeedPresetConfig> = {
  partial: {
    assetIds: ["sofa-03", "round-table-01", "steel-shelf-03"],
    offsets: [
      [-1.3, 0.5],
      [0.2, 0.4],
      [1.8, -0.7]
    ]
  },
  full: {
    assetIds: ["sofa-03", "round-table-01", "steel-shelf-03", "ArmChair_01", "ornate-mirror-01"],
    offsets: [
      [-1.4, 0.6],
      [0.15, 0.4],
      [1.95, -0.8],
      [1.25, 1.2],
      [-2.1, -0.9]
    ]
  }
};

const FURNISHED_TEMPLATE_PRESETS: Record<FurnishedRoomTemplateId, SeedPresetConfig> = {
  "living-modern-lounge": {
    assetIds: ["sofa-03", "modern_coffee_table_01", "steel_frame_shelves_03", "side_table_01", "anthurium_botany_01"],
    offsets: [
      [-1.55, 0.55],
      [0.1, 0.25],
      [2.1, -0.8],
      [1.55, 0.95],
      [-2.05, -0.75]
    ]
  },
  "workspace-flex": {
    assetIds: [
      "p2s_desk_bamboo_minimal_140",
      "p2s_task_chair_mesh_black",
      "p2s_steel_shelf_compact",
      "sofa-03",
      "modern_coffee_table_01",
      "modern_wooden_cabinet",
      "Television_01",
      "gaming_console",
      "anthurium_botany_01",
      "side_table_01",
      "p2s_stool_guest_round",
      "p2s_led_task_lamp_slim",
      "p2s_desk_mat_felt_grey",
      "p2s_monitor_32_creator",
      "p2s_keyboard_75_white",
      "p2s_mouse_gaming_graphite",
      "p2s_speaker_pair_white",
      "p2s_desk_lamp_dome_warm",
      "p2s_decor_planter_white",
      "book_encyclopedia_set_01",
      "p2s_decor_books_large",
      "p2s_decor_gamepad",
      "p2s_decor_mug_espresso",
      "p2s_meshy_pastel_mascot_stack"
    ],
    offsets: [
      [0.62, 1.18],
      [0.62, 0.5],
      [-2.05, 0.86],
      [-0.92, -0.74],
      [-0.18, -0.48],
      [1.92, -0.34],
      [1.92, -0.34],
      [1.72, -0.42],
      [1.82, 1.15],
      [-1.46, -0.86],
      [0.86, -1.1],
      [-1.46, -0.86],
      [0.62, 1.02],
      [0.62, 1.18],
      [0.58, 0.94],
      [0.98, 0.95],
      [0.16, 1.2],
      [0.04, 1.1],
      [-2.05, 0.86],
      [-2.14, 1.02],
      [-1.92, 0.72],
      [0.92, 0.9],
      [0.24, 0.94],
      [-2.05, 0.98]
    ],
    rotations: [
      [0, 0, 0],
      [0, 0, 0],
      [0, Math.PI / 2, 0],
      [0, Math.PI / 2, 0],
      [0, Math.PI / 2, 0],
      [0, -Math.PI / 2, 0],
      [0, -Math.PI / 2, 0],
      [0, -Math.PI / 2, 0],
      [0, 0, 0],
      [0, Math.PI / 2, 0],
      [0, -Math.PI / 5, 0],
      [0, Math.PI / 2, 0],
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
      [0, -Math.PI / 12, 0],
      [0, 0, 0],
      [0, Math.PI / 12, 0],
      [0, Math.PI / 16, 0],
      [0, -Math.PI / 10, 0],
      [0, Math.PI / 8, 0],
      [0, -Math.PI / 6, 0]
    ],
    anchorTypes: [
      "floor",
      "floor",
      "floor",
      "floor",
      "floor",
      "floor",
      "furniture_surface",
      "furniture_surface",
      "floor",
      "floor",
      "floor",
      "furniture_surface",
      "desk_surface",
      "desk_surface",
      "desk_surface",
      "desk_surface",
      "desk_surface",
      "desk_surface",
      "shelf_surface",
      "shelf_surface",
      "shelf_surface",
      "desk_surface",
      "desk_surface",
      "shelf_surface"
    ],
    supportCatalogItemIds: [
      null,
      null,
      null,
      null,
      null,
      null,
      "modern_wooden_cabinet",
      "modern_wooden_cabinet",
      null,
      null,
      null,
      "side_table_01",
      "p2s_desk_bamboo_minimal_140",
      "p2s_desk_bamboo_minimal_140",
      "p2s_desk_bamboo_minimal_140",
      "p2s_desk_bamboo_minimal_140",
      "p2s_desk_bamboo_minimal_140",
      "p2s_desk_bamboo_minimal_140",
      "p2s_steel_shelf_compact",
      "p2s_steel_shelf_compact",
      "p2s_steel_shelf_compact",
      "p2s_desk_bamboo_minimal_140",
      "p2s_desk_bamboo_minimal_140",
      "p2s_steel_shelf_compact"
    ],
    workspaceClusterIds: [
      "workstation",
      "workstation",
      "display",
      "lounge",
      "lounge",
      "media",
      "media",
      "media",
      "display",
      "lounge",
      "lounge",
      "lounge",
      "workstation",
      "workstation",
      "workstation",
      "workstation",
      "workstation",
      "workstation",
      "display",
      "display",
      "display",
      "workstation",
      "workstation",
      "display"
    ],
    scales: [
      [1.05, 1, 1.05],
      [1.05, 1, 1.05],
      [1.08, 1, 1.08],
      [1.12, 1, 1.12],
      [1.1, 1, 1.1],
      [1.22, 1, 1.12],
      [1.35, 1.18, 1.12],
      [0.58, 0.58, 0.58],
      [1.12, 1.08, 1.12],
      [0.9, 0.9, 0.9],
      [1, 1, 1],
      [0.82, 0.82, 0.82],
      [1, 1, 1],
      [1, 1, 1],
      [1, 1, 1],
      [1, 1, 1],
      [1, 1, 1],
      [1, 1, 1],
      [1, 1, 1],
      [1, 1, 1],
      [1, 1, 1],
      [1, 1, 1],
      [1, 1, 1],
      [1, 1, 1]
    ]
  },
  "living-playful": {
    assetIds: ["Sofa_01", "coffee_table_round_01", "modern_wooden_cabinet", "GreenChair_01", "painted_wooden_stool"],
    offsets: [
      [-1.5, 0.55],
      [0.1, 0.3],
      [2.1, -0.7],
      [1.2, 1.1],
      [-2.05, -0.85]
    ]
  },
  "living-fresh": {
    assetIds: ["sofa_03", "round-table-01", "wooden_display_shelves_01"],
    offsets: [
      [-1.45, 0.55],
      [0.1, 0.35],
      [2.1, -0.75]
    ]
  },
  "kids-vintage": {
    assetIds: ["SchoolDesk_01", "SchoolChair_01", "wooden_bookshelf_worn", "vintage_wooden_drawer_01"],
    offsets: [
      [-0.9, 0.3],
      [-0.1, 1.05],
      [2.0, -0.8],
      [1.55, 0.9]
    ]
  },
  "bedroom-practical": {
    assetIds: ["gothic-bed-01", "ClassicNightstand_01", "modern_wooden_cabinet", "ornate-mirror-01", "painted_wooden_nightstand"],
    offsets: [
      [0, 0.15],
      [-1.95, 0.15],
      [2.2, -0.75],
      [-2.25, -0.9],
      [1.7, 0.95]
    ]
  },
  "bedroom-european": {
    assetIds: ["GothicBed_01", "painted_wooden_nightstand", "vintage_cabinet_01", "side_table_01"],
    offsets: [
      [0, 0.2],
      [-1.85, 0.2],
      [2.25, -0.75],
      [1.55, 0.95]
    ]
  },
  "bedroom-suite": {
    assetIds: ["gothic-bed-01", "modern_wooden_cabinet", "ornate-mirror-01", "ArmChair_01", "side_table_tall_01"],
    offsets: [
      [0, 0.15],
      [2.1, -0.75],
      [-2.2, -0.95],
      [1.3, 1.05],
      [-1.8, 0.85]
    ]
  }
};

function createAssetId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `seed-${Math.random().toString(36).slice(2, 10)}`;
}

function resolveSeedItems(catalog: LibraryCatalogItem[], config: SeedPresetConfig): ResolvedSeedItem[] {
  const preferred = config.assetIds
    .map((id, seedIndex) => {
      const item = catalog.find((catalogItem) => catalogItem.id === id) ?? null;
      return item ? { item, seedIndex } : null;
    })
    .filter((resolved): resolved is ResolvedSeedItem => resolved !== null);

  if (preferred.length >= 3) {
    return preferred;
  }

  const fallback = selectStarterSetItems(catalog, config.offsets.length);
  const merged = [...preferred];
  fallback.forEach((item) => {
    if (merged.some((existing) => existing.item.id === item.id)) return;
    merged.push({ item, seedIndex: merged.length });
  });
  return merged;
}

function filterWorkspaceFlexConfig(
  config: SeedPresetConfig,
  enabledClusterIds: readonly WorkspaceFlexClusterId[] | null | undefined
): SeedPresetConfig {
  if (!config.workspaceClusterIds || !enabledClusterIds) {
    return config;
  }

  const enabled = new Set(normalizeWorkspaceFlexClusterIds(enabledClusterIds));
  const indices = config.workspaceClusterIds.flatMap((clusterId, index) => {
    if (!clusterId || !enabled.has(clusterId)) return [];
    return [index];
  });

  if (indices.length === config.assetIds.length) {
    return config;
  }

  return {
    assetIds: indices.map((index) => config.assetIds[index]!),
    offsets: indices.map((index) => config.offsets[index] ?? [0, 0]),
    rotations: config.rotations ? indices.map((index) => config.rotations?.[index] ?? [0, 0, 0]) : undefined,
    anchorTypes: config.anchorTypes ? indices.map((index) => config.anchorTypes?.[index] ?? null) : undefined,
    scales: config.scales ? indices.map((index) => config.scales?.[index] ?? [1, 1, 1]) : undefined,
    supportCatalogItemIds: config.supportCatalogItemIds
      ? indices.map((index) => config.supportCatalogItemIds?.[index] ?? null)
      : undefined,
    workspaceClusterIds: indices.map((index) => config.workspaceClusterIds?.[index] ?? null)
  };
}

export function getWorkspaceFlexSeedCatalogItemIds(
  enabledClusterIds: readonly WorkspaceFlexClusterId[] | null | undefined
) {
  const config = filterWorkspaceFlexConfig(
    FURNISHED_TEMPLATE_PRESETS["workspace-flex"],
    enabledClusterIds
  );
  return config.assetIds;
}

export type WorkspaceFlexClusterSelectionPreview = {
  catalogItemIds: string[];
  assetCount: number;
  generatedCatalogItemIds: string[];
  generatedAssetCount: number;
  generatedProviderLabels: string[];
  requiresGeneratedReview: boolean;
};

export function describeWorkspaceFlexClusterSelection({
  catalog,
  clusterIds
}: {
  catalog: LibraryCatalogItem[];
  clusterIds: readonly WorkspaceFlexClusterId[];
}): WorkspaceFlexClusterSelectionPreview {
  const catalogItemsById = new Map(catalog.map((item) => [item.id, item]));
  const catalogItemIds = getWorkspaceFlexSeedCatalogItemIds(clusterIds);
  const generatedItems = catalogItemIds
    .map((id) => catalogItemsById.get(id) ?? null)
    .filter((item): item is LibraryCatalogItem => Boolean(item && isGeneratedCatalogItem(item)));
  const generatedProviderLabels = Array.from(
    new Set(
      generatedItems.map((item) => getCatalogGenerationBadge(item)?.providerLabel ?? "Generated")
    )
  );

  return {
    catalogItemIds,
    assetCount: catalogItemIds.length,
    generatedCatalogItemIds: generatedItems.map((item) => item.id),
    generatedAssetCount: generatedItems.length,
    generatedProviderLabels,
    requiresGeneratedReview: generatedItems.some(
      (item) => getCatalogGenerationBadge(item)?.reviewLabel === "검수 필요"
    )
  };
}

export function buildSeededSceneAssets(
  catalog: LibraryCatalogItem[],
  roomShell: DerivedRoomShell,
  preset: TemplateSeedPreset,
  furnishedTemplateId?: FurnishedRoomTemplateId | null,
  options?: {
    enabledWorkspaceFlexClusterIds?: readonly WorkspaceFlexClusterId[] | null;
  }
): SceneAsset[] {
  if (preset === "none") return [];

  const baseConfig = furnishedTemplateId ? FURNISHED_TEMPLATE_PRESETS[furnishedTemplateId] ?? SEED_PRESETS[preset] : SEED_PRESETS[preset];
  const config =
    furnishedTemplateId === "workspace-flex"
      ? filterWorkspaceFlexConfig(baseConfig, options?.enabledWorkspaceFlexClusterIds)
      : baseConfig;
  const selectedItems = resolveSeedItems(catalog, config).slice(0, config.offsets.length);
  const roomCenter = roomShell.rooms[0]?.center ?? [0, 0];
  const sceneAssets: SceneAsset[] = [];

  selectedItems.forEach(({ item, seedIndex }, index) => {
    const [offsetX, offsetZ] = config.offsets[seedIndex] ?? config.offsets[index] ?? [0, 0];
    const rotation: [number, number, number] = config.rotations?.[seedIndex] ?? [0, 0, 0];
    const anchorType = config.anchorTypes?.[seedIndex] ?? inferAnchorTypeForCatalogItem(item);
    const scale = config.scales?.[seedIndex] ?? item.scale;
    const preferredSupportCatalogItemId = config.supportCatalogItemIds?.[seedIndex] ?? null;
    const preferredSupportAssetId = preferredSupportCatalogItemId
      ? sceneAssets.find((asset) => asset.catalogItemId === preferredSupportCatalogItemId)?.id ?? null
      : null;
    const id = createAssetId();
    const supportProfile = item.supportProfile ?? null;
    const anchoredPlacement = constrainPlacementToAnchor(
      {
        position: [roomCenter[0] + offsetX, 0, roomCenter[1] + offsetZ],
        rotation,
        anchorType,
        supportAssetId: preferredSupportAssetId
      },
      {
        walls: roomShell.walls,
        ceilings: roomShell.ceilings,
        scale: roomShell.scale,
        sceneAssets,
        activeAsset: {
          id,
          assetId: item.assetId,
          catalogItemId: item.id,
          product: toCatalogProductSnapshot(item),
          supportProfile,
          scale
        }
      }
    );

    sceneAssets.push({
      id,
      assetId: item.assetId,
      catalogItemId: item.id,
      product: toCatalogProductSnapshot(item),
      anchorType: anchoredPlacement.anchorType,
      supportAssetId: anchoredPlacement.supportAssetId,
      supportProfile,
      position: anchoredPlacement.position,
      rotation: anchoredPlacement.rotation,
      scale,
      materialId: null
    });
  });

  return sceneAssets;
}

export function buildSeedSummaryLabel(
  catalog: LibraryCatalogItem[],
  assets: SceneAsset[]
) {
  return assets
    .map((asset) => findCatalogItemByAssetId(catalog, asset.assetId)?.label ?? asset.assetId)
    .slice(0, 3)
    .join(", ");
}
