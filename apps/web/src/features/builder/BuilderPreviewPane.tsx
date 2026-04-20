import { motion } from "framer-motion";
import type { Opening, Vector2 } from "../../lib/stores/useSceneStore";
import { SceneViewport } from "../../components/editor/SceneViewport";
import type { EditorViewMode } from "../../lib/stores/useEditorStore";
import type { BuilderStepId, BuilderWallEntry } from "./types";

type BuilderPreviewPaneProps = {
  stepId: BuilderStepId;
  previewMode: Extract<EditorViewMode, "top" | "builder-preview">;
  unit: "ft" | "cm";
  outline: Vector2[];
  wallEntries: BuilderWallEntry[];
  wallFinishName: string;
  floorFinishName: string;
  lightingModeLabel: string;
  doorCount: number;
  windowCount: number;
  selectedWallLabel: string | null;
  selectedOpening: Opening | null;
};

function formatDimension(value: number, unit: "ft" | "cm") {
  if (unit === "ft") {
    return `${(value * 3.28084).toFixed(1)} ft`;
  }

  return `${Math.round(value * 100)} cm`;
}

function buildScaledOutline(outline: Vector2[]) {
  const fallback: Vector2[] = [
    [0, 0],
    [6.2, 0],
    [6.2, 4.4],
    [0, 4.4]
  ];
  const source = outline.length >= 3 ? outline : fallback;
  const minX = Math.min(...source.map(([x]) => x));
  const maxX = Math.max(...source.map(([x]) => x));
  const minY = Math.min(...source.map(([, y]) => y));
  const maxY = Math.max(...source.map(([, y]) => y));
  const shapeWidth = Math.max(maxX - minX, 0.01);
  const shapeHeight = Math.max(maxY - minY, 0.01);
  const viewportWidth = 420;
  const viewportHeight = 260;
  const scale = Math.min(viewportWidth / shapeWidth, viewportHeight / shapeHeight);
  const scaledWidth = shapeWidth * scale;
  const scaledHeight = shapeHeight * scale;
  const offsetX = (820 - scaledWidth) / 2;
  const offsetY = (560 - scaledHeight) / 2;

  const points = source.map(([x, y]) => {
    const scaledX = offsetX + (x - minX) * scale;
    const scaledY = offsetY + (maxY - y) * scale;
    return [scaledX, scaledY] as const;
  });

  const path = points
    .map(([x, y], index) => `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`)
    .join(" ")
    .concat(" Z");

  return {
    path,
    points
  };
}

function DimensionOverlay({
  outline,
  wallEntries,
  unit
}: {
  outline: Vector2[];
  wallEntries: BuilderWallEntry[];
  unit: "ft" | "cm";
}) {
  const scaled = buildScaledOutline(outline);
  const segments = scaled.points.map((point, index) => {
    const next = scaled.points[(index + 1) % scaled.points.length]!;
    const dx = next[0] - point[0];
    const dy = next[1] - point[1];
    const length = Math.hypot(dx, dy) || 1;
    const midpointX = (point[0] + next[0]) / 2;
    const midpointY = (point[1] + next[1]) / 2;
    const normalX = -dy / length;
    const normalY = dx / length;
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    const normalizedAngle = angle > 90 || angle < -90 ? angle + 180 : angle;
    const wall = wallEntries[index];

    return {
      id: wall?.id ?? `wall-${index}`,
      label: formatDimension(wall?.length ?? 0, unit),
      x: midpointX + normalX * 28,
      y: midpointY + normalY * 28,
      angle: normalizedAngle
    };
  });

  return (
    <>
      <path d={scaled.path} fill="rgba(255,255,255,0.14)" stroke="#202020" strokeWidth="6" strokeLinejoin="round" />

      {scaled.points.map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <circle cx={x} cy={y} r="10" fill="#ffffff" />
          <circle cx={x} cy={y} r="7" fill="#ffffff" stroke="#202020" strokeWidth="3" />
        </g>
      ))}

      {segments.map((segment) => (
        <g key={segment.id} transform={`translate(${segment.x} ${segment.y}) rotate(${segment.angle})`}>
          <rect x="-34" y="-13" width="68" height="26" rx="13" fill="rgba(255,255,255,0.94)" stroke="#d1cec7" />
          <text textAnchor="middle" dominantBaseline="central" fill="#6f6f6f" fontSize="17" fontWeight="700">
            {segment.label}
          </text>
        </g>
      ))}
    </>
  );
}

function TopPlanBoard({
  stepId,
  outline,
  wallEntries,
  unit
}: {
  stepId: BuilderStepId;
  outline: Vector2[];
  wallEntries: BuilderWallEntry[];
  unit: "ft" | "cm";
}) {
  const scaled = buildScaledOutline(outline);

  return (
    <div className="relative flex h-full min-h-[320px] items-center justify-center overflow-hidden bg-[#d7d7d3]">
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.2)_1px,transparent_1px),linear-gradient(rgba(255,255,255,0.2)_1px,transparent_1px)] bg-[size:120px_120px]" />
      <div className="absolute inset-y-0 left-1/2 w-px bg-black/18" />
      <div className="absolute inset-x-0 top-1/2 h-px bg-black/18" />

      <div className="relative w-full max-w-[960px] px-8 py-10">
        <svg viewBox="0 0 820 560" className="mx-auto h-full max-h-[560px] w-full" aria-hidden>
          {stepId === "dimension" ? (
            <DimensionOverlay outline={outline} wallEntries={wallEntries} unit={unit} />
          ) : (
            <>
              <path d={scaled.path} fill="rgba(255,255,255,0.12)" stroke="#202020" strokeWidth="6" strokeLinejoin="round" />
              {scaled.points.map(([x, y]) => (
                <g key={`${x}-${y}`}>
                  <circle cx={x} cy={y} r="10" fill="#ffffff" />
                  <circle cx={x} cy={y} r="7" fill="#ffffff" stroke="#202020" strokeWidth="3" />
                </g>
              ))}
            </>
          )}
        </svg>
      </div>
    </div>
  );
}

function OpeningOverlay({
  selectedWallLabel,
  selectedOpening
}: {
  selectedWallLabel: string | null;
  selectedOpening: Opening | null;
}) {
  const openingLabel = selectedOpening ? (selectedOpening.type === "door" ? "문 선택됨" : "창문 선택됨") : null;

  return (
    <>
      {selectedWallLabel || openingLabel ? (
        <div className="pointer-events-none absolute left-6 top-6 flex flex-wrap gap-2">
          {selectedWallLabel ? (
            <span className="rounded-full bg-white/88 px-4 py-2 text-xs font-semibold text-[#2c2924] shadow-[0_10px_28px_rgba(0,0,0,0.08)]">
              {selectedWallLabel}
            </span>
          ) : null}
          {openingLabel ? (
            <span className="rounded-full bg-white/88 px-4 py-2 text-xs font-semibold text-[#2c2924] shadow-[0_10px_28px_rgba(0,0,0,0.08)]">
              {openingLabel}
            </span>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

function StyleSummary({
  wallFinishName,
  floorFinishName,
  doorCount,
  windowCount
}: {
  wallFinishName: string;
  floorFinishName: string;
  doorCount: number;
  windowCount: number;
}) {
  return (
    <div className="pointer-events-none absolute bottom-6 left-6 flex flex-wrap gap-2">
      <span className="rounded-full bg-white/88 px-4 py-2 text-xs font-semibold text-[#2c2924] shadow-[0_10px_28px_rgba(0,0,0,0.08)]">
        벽 {wallFinishName}
      </span>
      <span className="rounded-full bg-white/88 px-4 py-2 text-xs font-semibold text-[#2c2924] shadow-[0_10px_28px_rgba(0,0,0,0.08)]">
        바닥 {floorFinishName}
      </span>
      <span className="rounded-full bg-white/88 px-4 py-2 text-xs font-semibold text-[#2c2924] shadow-[0_10px_28px_rgba(0,0,0,0.08)]">
        문 {doorCount}개 / 창문 {windowCount}개
      </span>
    </div>
  );
}

function LightingSummary({ lightingModeLabel }: { lightingModeLabel: string }) {
  return (
    <div className="pointer-events-none absolute bottom-6 left-6">
      <span className="rounded-full bg-white/88 px-4 py-2 text-xs font-semibold text-[#2c2924] shadow-[0_10px_28px_rgba(0,0,0,0.08)]">
        선택한 조명 {lightingModeLabel}
      </span>
    </div>
  );
}

export function BuilderPreviewPane({
  stepId,
  previewMode,
  unit,
  outline,
  wallEntries,
  wallFinishName,
  floorFinishName,
  lightingModeLabel,
  doorCount,
  windowCount,
  selectedWallLabel,
  selectedOpening
}: BuilderPreviewPaneProps) {
  if (previewMode === "top") {
    return (
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative min-h-[320px] overflow-hidden bg-[#d7d7d3] lg:h-full lg:min-h-0"
      >
        <TopPlanBoard stepId={stepId} outline={outline} wallEntries={wallEntries} unit={unit} />
      </motion.section>
    );
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative min-h-[320px] overflow-hidden bg-[#d7d7d3] lg:h-full lg:min-h-0"
    >
      <SceneViewport
        className="h-full min-h-[320px] !rounded-none !border-0 !shadow-none lg:h-full lg:min-h-0"
        camera={{ fov: 46, position: [8, 5, 8] }}
        chromeTone="light"
        showHud={false}
        interactionMode="preview"
      />

      {stepId === "opening" ? (
        <OpeningOverlay selectedWallLabel={selectedWallLabel} selectedOpening={selectedOpening} />
      ) : null}
      {stepId === "style" ? (
        <StyleSummary
          wallFinishName={wallFinishName}
          floorFinishName={floorFinishName}
          doorCount={doorCount}
          windowCount={windowCount}
        />
      ) : null}
      {stepId === "lighting" ? <LightingSummary lightingModeLabel={lightingModeLabel} /> : null}
    </motion.section>
  );
}
