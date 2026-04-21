import type { BuilderFinishOption } from "../../../lib/api/room-templates";
import {
  FLOOR_TEXTURE_PRESETS,
  WALL_TEXTURE_PRESETS
} from "../../../lib/textures/room-shell-textures";

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
    background: swatches[finish.id] ?? "#efe9df",
    previewImage:
      WALL_TEXTURE_PRESETS[finish.id % WALL_TEXTURE_PRESETS.length]?.map ?? null
  }));
}

function buildFloorPalette(
  options: BuilderFinishOption[],
  swatches: Record<number, string>
) {
  return options.map((finish) => ({
    id: finish.id,
    name: finish.name,
    background: swatches[finish.id] ?? "#b58f67",
    previewImage:
      FLOOR_TEXTURE_PRESETS[finish.id % FLOOR_TEXTURE_PRESETS.length]?.map ?? null
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
  const activeFloorName = floorFinishOptions.find((finish) => finish.id === floorMaterialIndex)?.name ?? "";

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-base font-bold text-[#1a1714]">벽 색상</h2>
        <div className="mt-4 grid grid-cols-5 gap-3">
          {wallPalette.map((finish) => (
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
