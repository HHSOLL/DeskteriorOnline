import { useEffect, useMemo, useState } from "react";
import type { BuilderFinishOption } from "../../../lib/api/room-templates";
import { DEFAULT_CATALOG } from "../../../lib/builder/catalog";
import {
  WORKSPACE_FLEX_CLUSTER_OPTIONS,
  WORKSPACE_FLEX_CLUSTER_PRESETS,
  describeWorkspaceFlexClusterSelection,
  type WorkspaceFlexClusterId
} from "../../../lib/builder/seeded-assets";
import type { FurnishedRoomTemplateId, TemplateSeedPreset } from "../../../lib/builder/template-browser";
import {
  ROOM_MOOD_RECIPES,
  getRoomMoodRecipeSwatches,
  resolveRoomMoodRecipeApplication,
  type RoomMoodRecipeApplication,
  type RoomMoodRecipeId
} from "../../../lib/scene/room-mood-recipes";

type BuilderStyleStepProps = {
  wallMaterialIndex: number;
  floorMaterialIndex: number;
  activeRoomMoodRecipeId: RoomMoodRecipeId | null;
  wallFinishOptions: BuilderFinishOption[];
  floorFinishOptions: BuilderFinishOption[];
  wallFinishSwatch: Record<number, string>;
  floorFinishSwatch: Record<number, string>;
  starterSetPreset: TemplateSeedPreset;
  starterTemplateId: FurnishedRoomTemplateId | null;
  workspaceClusterIds: WorkspaceFlexClusterId[];
  onWallMaterialIndexChange: (index: number) => void;
  onFloorMaterialIndexChange: (index: number) => void;
  onRoomMoodRecipeApply: (recipe: RoomMoodRecipeApplication) => void;
  onWorkspaceClusterIdsChange: (clusterIds: WorkspaceFlexClusterId[]) => void;
};

function buildWallPalette(
  options: BuilderFinishOption[],
  swatches: Record<number, string>
) {
  return options.map((finish) => ({
    id: finish.id,
    name: finish.name,
    category: finish.category,
    defaultExposure: finish.defaultExposure,
    background: swatches[finish.id] ?? "#efe9df",
    previewImage: finish.previewThumbnail
  }));
}

function buildFloorPalette(
  options: BuilderFinishOption[],
  swatches: Record<number, string>
) {
  return options.map((finish) => ({
    id: finish.id,
    name: finish.name,
    category: finish.category,
    background: swatches[finish.id] ?? "#b58f67",
    previewImage: finish.previewThumbnail
  }));
}

function areWorkspaceClusterSetsEqual(
  currentClusterIds: readonly WorkspaceFlexClusterId[],
  presetClusterIds: readonly WorkspaceFlexClusterId[]
) {
  if (currentClusterIds.length !== presetClusterIds.length) {
    return false;
  }

  const currentClusterSet = new Set(currentClusterIds);
  return presetClusterIds.every((clusterId) => currentClusterSet.has(clusterId));
}

export function BuilderStyleStep({
  wallMaterialIndex,
  floorMaterialIndex,
  activeRoomMoodRecipeId,
  wallFinishOptions,
  floorFinishOptions,
  wallFinishSwatch,
  floorFinishSwatch,
  starterSetPreset,
  starterTemplateId,
  workspaceClusterIds,
  onWallMaterialIndexChange,
  onFloorMaterialIndexChange,
  onRoomMoodRecipeApply,
  onWorkspaceClusterIdsChange
}: BuilderStyleStepProps) {
  const wallPalette = buildWallPalette(wallFinishOptions, wallFinishSwatch);
  const floorPalette = buildFloorPalette(floorFinishOptions, floorFinishSwatch);
  const [showAdvancedWalls, setShowAdvancedWalls] = useState(false);
  const roomMoodRecipeApplications = useMemo(
    () => ROOM_MOOD_RECIPES.map((recipe) => resolveRoomMoodRecipeApplication(recipe)),
    []
  );
  const enabledWorkspaceClusterSet = useMemo(() => new Set(workspaceClusterIds), [workspaceClusterIds]);
  const workspacePresetPreviews = useMemo(
    () =>
      new Map(
        WORKSPACE_FLEX_CLUSTER_PRESETS.map((preset) => [
          preset.id,
          describeWorkspaceFlexClusterSelection({
            catalog: DEFAULT_CATALOG,
            clusterIds: preset.clusterIds
          })
        ])
      ),
    []
  );
  const workspaceClusterPreviews = useMemo(
    () =>
      new Map(
        WORKSPACE_FLEX_CLUSTER_OPTIONS.map((option) => [
          option.id,
          describeWorkspaceFlexClusterSelection({
            catalog: DEFAULT_CATALOG,
            clusterIds: [option.id]
          })
        ])
      ),
    []
  );
  const defaultWallPalette = useMemo(
    () => wallPalette.filter((finish) => finish.defaultExposure === "default"),
    [wallPalette]
  );
  const advancedWallPalette = useMemo(
    () => wallPalette.filter((finish) => finish.defaultExposure === "advanced"),
    [wallPalette]
  );
  const activeWall = wallPalette.find((finish) => finish.id === wallMaterialIndex) ?? null;
  const activeFloorName = floorFinishOptions.find((finish) => finish.id === floorMaterialIndex)?.name ?? "";
  const selectedWallIsAdvanced = activeWall?.defaultExposure === "advanced";
  const activeWorkspacePresetId = useMemo(
    () =>
      WORKSPACE_FLEX_CLUSTER_PRESETS.find((preset) =>
        areWorkspaceClusterSetsEqual(workspaceClusterIds, preset.clusterIds)
      )?.id ?? null,
    [workspaceClusterIds]
  );

  useEffect(() => {
    if (selectedWallIsAdvanced) {
      setShowAdvancedWalls(true);
    }
  }, [selectedWallIsAdvanced]);

  const showWorkspaceClusterControls = starterSetPreset !== "none" && starterTemplateId === "workspace-flex";
  const toggleWorkspaceCluster = (clusterId: WorkspaceFlexClusterId) => {
    const isEnabled = enabledWorkspaceClusterSet.has(clusterId);
    if (isEnabled && workspaceClusterIds.length === 1) {
      return;
    }

    const nextClusterIds = isEnabled
      ? workspaceClusterIds.filter((id) => id !== clusterId)
      : WORKSPACE_FLEX_CLUSTER_OPTIONS.map((option) => option.id).filter(
          (id) => id === clusterId || enabledWorkspaceClusterSet.has(id)
        );

    onWorkspaceClusterIdsChange(nextClusterIds);
  };

  return (
    <div className="space-y-8">
      {showWorkspaceClusterControls ? (
        <section data-testid="workspace-cluster-controls">
          <div className="flex items-end justify-between gap-3">
            <h2 className="text-base font-bold text-[#1a1714]">가구 구성</h2>
            <span className="text-sm text-[#766c60]">
              {workspaceClusterIds.length}/{WORKSPACE_FLEX_CLUSTER_OPTIONS.length}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2" data-testid="workspace-cluster-preset-controls">
            {WORKSPACE_FLEX_CLUSTER_PRESETS.map((preset) => {
              const isActive = activeWorkspacePresetId === preset.id;
              const preview = workspacePresetPreviews.get(preset.id);
              const providerLabel = preview?.generatedProviderLabels.join(" + ") ?? "AI";

              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => onWorkspaceClusterIdsChange([...preset.clusterIds])}
                  aria-pressed={isActive}
                  data-testid={`workspace-cluster-preset-${preset.id}`}
                  className={`min-h-[88px] rounded-[8px] border px-3 py-2 text-left transition ${
                    isActive
                      ? "border-[#1f1b16] bg-[#1f1b16] text-white shadow-[0_8px_20px_rgba(31,27,22,0.14)]"
                      : "border-black/10 bg-white text-[#4f463d] hover:border-black/20"
                  }`}
                >
                  <span className="block text-xs font-bold text-current">{preset.label}</span>
                  <span className={`mt-1 block text-[11px] leading-5 ${isActive ? "text-white/72" : "text-[#7d7368]"}`}>
                    {preset.description}
                  </span>
                  <span className={`mt-2 block text-[10px] font-bold ${isActive ? "text-white/62" : "text-[#9a6a1f]"}`}>
                    {preview?.assetCount ?? preset.clusterIds.length}개 구성
                  </span>
                  {preview && preview.generatedAssetCount > 0 ? (
                    <span
                      className={`mt-2 inline-flex max-w-full rounded-full border px-2 py-1 text-[9px] font-bold uppercase tracking-[0.08em] ${
                        isActive
                          ? "border-white/24 bg-white/12 text-white"
                          : "border-[#b87915]/25 bg-[#fff5df] text-[#8a5b18]"
                      }`}
                      data-testid={`workspace-cluster-preset-generated-badge-${preset.id}`}
                    >
                      <span className="truncate">
                        {providerLabel} 생성 {preview.generatedAssetCount}개
                        {preview.requiresGeneratedReview ? " · 검수 필요" : ""}
                      </span>
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {WORKSPACE_FLEX_CLUSTER_OPTIONS.map((option) => {
              const isEnabled = enabledWorkspaceClusterSet.has(option.id);
              const isLocked = isEnabled && workspaceClusterIds.length === 1;
              const preview = workspaceClusterPreviews.get(option.id);
              const providerLabel = preview?.generatedProviderLabels.join(" + ") ?? "AI";

              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => toggleWorkspaceCluster(option.id)}
                  aria-pressed={isEnabled}
                  disabled={isLocked}
                  data-testid={`workspace-cluster-${option.id}`}
                  className={`min-h-[82px] rounded-[8px] border p-3 text-left transition ${
                    isEnabled
                      ? "border-[#1f1b16] bg-white shadow-[0_8px_20px_rgba(31,27,22,0.08)]"
                      : "border-black/10 bg-[#f7f4ee] text-[#766c60] hover:border-black/20"
                  } ${isLocked ? "cursor-default opacity-80" : ""}`}
                >
                  <span className="flex items-center gap-2 text-sm font-bold text-[#201b16]">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: isEnabled ? option.accentColor : "#b9b0a5" }}
                    />
                    {option.label}
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-[#7d7368]">{option.description}</span>
                  {preview && preview.generatedAssetCount > 0 ? (
                    <span
                      className="mt-2 inline-flex max-w-full rounded-full border border-[#b87915]/25 bg-[#fff5df] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.08em] text-[#8a5b18]"
                      data-testid={`workspace-cluster-generated-badge-${option.id}`}
                    >
                      <span className="truncate">
                        {providerLabel} 생성 {preview.generatedAssetCount}개
                        {preview.requiresGeneratedReview ? " · 검수 필요" : ""}
                      </span>
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      <section data-testid="builder-room-mood-recipes">
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-base font-bold text-[#1a1714]">무드 레시피</h2>
          <span className="text-sm text-[#766c60]">벽 + 바닥 + 조명</span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {ROOM_MOOD_RECIPES.map((recipe) => {
            const application = roomMoodRecipeApplications.find((item) => item.id === recipe.id);
            if (!application) return null;
            const isActive = activeRoomMoodRecipeId === recipe.id;
            const swatches = getRoomMoodRecipeSwatches(recipe);

            return (
              <button
                key={recipe.id}
                type="button"
                onClick={() => onRoomMoodRecipeApply(application)}
                aria-pressed={isActive}
                data-testid={`builder-room-mood-recipe-${recipe.id}`}
                className={`min-h-[96px] rounded-[8px] border px-3 py-3 text-left transition ${
                  isActive
                    ? "border-[#1f1b16] bg-[#1f1b16] text-white shadow-[0_8px_20px_rgba(31,27,22,0.14)]"
                    : "border-black/10 bg-white text-[#4f463d] hover:border-black/20"
                }`}
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block text-xs font-bold text-current">{recipe.label}</span>
                    <span
                      className={`mt-1 block text-[11px] leading-5 ${
                        isActive ? "text-white/72" : "text-[#7d7368]"
                      }`}
                    >
                      {recipe.description}
                    </span>
                  </span>
                  <span className="flex shrink-0 overflow-hidden rounded-full border border-black/10">
                    {swatches.map((color, index) => (
                      <span
                        key={`${recipe.id}-${index}`}
                        aria-hidden="true"
                        className="h-6 w-6"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="border-t border-black/10" />

      <section>
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-base font-bold text-[#1a1714]">벽 색상</h2>
          {activeWall ? (
            <span className="text-right text-sm text-[#766c60]">
              {activeWall.name}
              <span className="ml-2 text-[#9a9083]">{activeWall.category}</span>
            </span>
          ) : null}
        </div>
        <div className="mt-4 grid grid-cols-5 gap-3">
          {defaultWallPalette.map((finish) => (
            <button
              key={finish.id}
              type="button"
              onClick={() => onWallMaterialIndexChange(finish.id)}
              className={`aspect-square rounded-[12px] border-2 transition ${
                wallMaterialIndex === finish.id ? "border-[#171411]" : "border-transparent"
              }`}
              style={{
                backgroundColor: finish.background,
                backgroundImage: finish.previewImage ? `url(${finish.previewImage})` : undefined,
                backgroundSize: "cover",
                backgroundPosition: "center"
              }}
              aria-label={finish.name}
            />
          ))}
        </div>

        {advancedWallPalette.length > 0 ? (
          <div className="mt-5 rounded-[20px] border border-black/10 bg-[#f7f4ee] p-4">
            <button
              type="button"
              onClick={() => setShowAdvancedWalls((current) => !current)}
              className="flex w-full items-center justify-between gap-3 text-left"
              aria-expanded={showAdvancedWalls}
            >
              <span>
                <span className="block text-[11px] font-bold uppercase tracking-[0.18em] text-[#8d7f6f]">
                  Advanced
                </span>
                <span className="mt-1 block text-sm font-semibold text-[#2a241d]">추가 벽 옵션</span>
              </span>
              <span className="text-xs text-[#7b6f63]">
                {showAdvancedWalls ? "접기" : `${advancedWallPalette.length}개 보기`}
              </span>
            </button>

            {showAdvancedWalls ? (
              <div className="mt-4 grid grid-cols-5 gap-3">
                {advancedWallPalette.map((finish) => (
                  <button
                    key={finish.id}
                    type="button"
                    onClick={() => onWallMaterialIndexChange(finish.id)}
                    className={`aspect-square rounded-[12px] border-2 transition ${
                      wallMaterialIndex === finish.id ? "border-[#171411]" : "border-transparent"
                    }`}
                    style={{
                      backgroundColor: finish.background,
                      backgroundImage: finish.previewImage ? `url(${finish.previewImage})` : undefined,
                      backgroundSize: "cover",
                      backgroundPosition: "center"
                    }}
                    aria-label={finish.name}
                  />
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <div className="border-t border-black/10" />

      <section>
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-base font-bold text-[#1a1714]">바닥 스타일</h2>
          {activeFloorName ? <span className="text-sm text-[#766c60]">{activeFloorName}</span> : null}
        </div>

        <div className="mt-4 grid grid-cols-4 gap-3">
          {floorPalette.map((finish) => (
            <button
              key={finish.id}
              type="button"
              onClick={() => onFloorMaterialIndexChange(finish.id)}
              className={`aspect-square rounded-[12px] border-2 bg-cover bg-center transition ${
                floorMaterialIndex === finish.id ? "border-[#171411]" : "border-transparent"
              }`}
              style={{
                backgroundColor: finish.background,
                backgroundImage: finish.previewImage ? `url(${finish.previewImage})` : undefined,
                backgroundSize: "cover",
                backgroundPosition: "center"
              }}
              aria-label={finish.name}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
