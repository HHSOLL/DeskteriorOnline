import { useEffect, useMemo, useState } from "react";
import type { BuilderFinishOption } from "../../../lib/api/room-templates";

type BuilderStyleStepProps = {
  wallMaterialIndex: number;
  floorMaterialIndex: number;
  wallFinishOptions: BuilderFinishOption[];
  floorFinishOptions: BuilderFinishOption[];
  wallFinishSwatch: Record<number, string>;
  floorFinishSwatch: Record<number, string>;
  onWallMaterialIndexChange: (index: number) => void;
  onFloorMaterialIndexChange: (index: number) => void;
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

export function BuilderStyleStep({
  wallMaterialIndex,
  floorMaterialIndex,
  wallFinishOptions,
  floorFinishOptions,
  wallFinishSwatch,
  floorFinishSwatch,
  onWallMaterialIndexChange,
  onFloorMaterialIndexChange
}: BuilderStyleStepProps) {
  const wallPalette = buildWallPalette(wallFinishOptions, wallFinishSwatch);
  const floorPalette = buildFloorPalette(floorFinishOptions, floorFinishSwatch);
  const [showAdvancedWalls, setShowAdvancedWalls] = useState(false);
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

  useEffect(() => {
    if (selectedWallIsAdvanced) {
      setShowAdvancedWalls(true);
    }
  }, [selectedWallIsAdvanced]);

  return (
    <div className="space-y-8">
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
