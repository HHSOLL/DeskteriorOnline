import type { ReactNode } from "react";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import type { Opening, Wall } from "../../../lib/stores/useSceneStore";
import type { OpeningPlacementIssue } from "../logic/openings";
import type { BuilderWallEntry, DoorStyle, WindowStyle } from "../types";

type BuilderOpeningsStepProps = {
  doorStyle: DoorStyle;
  windowStyle: WindowStyle;
  addSecondaryWindow: boolean;
  doorStyleLabels: Record<DoorStyle, string>;
  windowStyleLabels: Record<WindowStyle, string>;
  wallEntries: BuilderWallEntry[];
  selectedWallId: string | null;
  selectedWallOpenings: Opening[];
  selectedOpeningId: string | null;
  selectedOpening: Opening | null;
  selectedOpeningWall: Wall | null;
  placementIssue: OpeningPlacementIssue | null;
  onDoorStyleChange: (style: DoorStyle) => void;
  onWindowStyleChange: (style: WindowStyle) => void;
  onAddSecondaryWindowChange: (value: boolean) => void;
  onSelectWall: (wallId: string) => void;
  onSelectOpening: (openingId: string) => void;
  onAddOpening: (type: "door" | "window") => void;
  onDeleteOpening: (openingId: string) => void;
  onPatchOpening: (openingId: string, patch: Partial<Opening>) => void;
  onSetEntrance: (openingId: string) => void;
  getWallLength: (wall: Wall) => number;
};

function DoorThumbnail({ style }: { style: DoorStyle }) {
  if (style === "double") {
    return (
      <svg viewBox="0 0 88 88" className="h-20 w-20" aria-hidden>
        <rect x="14" y="10" width="60" height="68" fill="#f4f4f4" stroke="#c9c9c9" strokeWidth="2" />
        <line x1="44" y1="10" x2="44" y2="78" stroke="#c9c9c9" strokeWidth="2" />
        <circle cx="36" cy="46" r="2" fill="#a2a2a2" />
        <circle cx="52" cy="46" r="2" fill="#a2a2a2" />
      </svg>
    );
  }

  if (style === "french") {
    return (
      <svg viewBox="0 0 88 88" className="h-20 w-20" aria-hidden>
        <rect x="14" y="10" width="60" height="68" fill="#f4f4f4" stroke="#c9c9c9" strokeWidth="2" />
        <line x1="44" y1="10" x2="44" y2="78" stroke="#c9c9c9" strokeWidth="2" />
        {[26, 38, 50, 62].map((y) => (
          <line key={y} x1="22" y1={y} x2="66" y2={y} stroke="#c9c9c9" strokeWidth="1.5" />
        ))}
        <line x1="30" y1="16" x2="30" y2="72" stroke="#c9c9c9" strokeWidth="1.5" />
        <line x1="58" y1="16" x2="58" y2="72" stroke="#c9c9c9" strokeWidth="1.5" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 88 88" className="h-20 w-20" aria-hidden>
      <rect x="18" y="10" width="52" height="68" fill="#f4f4f4" stroke="#c9c9c9" strokeWidth="2" />
      <line x1="26" y1="18" x2="62" y2="18" stroke="#dfdfdf" strokeWidth="2" />
      <circle cx="30" cy="46" r="2.2" fill="#9f9f9f" />
    </svg>
  );
}

function WindowThumbnail({ style }: { style: WindowStyle }) {
  if (style === "wide") {
    return (
      <svg viewBox="0 0 104 72" className="h-16 w-24" aria-hidden>
        <rect x="8" y="10" width="88" height="48" fill="#f3f3f3" stroke="#cacaca" strokeWidth="2" />
        <rect x="18" y="18" width="30" height="32" fill="#d9dde0" />
        <rect x="56" y="18" width="30" height="32" fill="#d9dde0" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 84 84" className="h-16 w-16" aria-hidden>
      <rect x="18" y="12" width="48" height="56" fill="#f3f3f3" stroke="#cacaca" strokeWidth="2" />
      <rect x="24" y="20" width="36" height="40" fill="#d9dde0" />
      <line x1="24" y1="40" x2="60" y2="40" stroke="#c2c6ca" strokeWidth="2" />
    </svg>
  );
}

function StyleOptionButton({
  selected,
  label,
  onClick,
  children
}: {
  selected: boolean;
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} className="text-left">
      <div
        className={`flex h-[106px] items-center justify-center rounded-[18px] border bg-white transition ${
          selected ? "border-[#171411] shadow-[0_8px_24px_rgba(0,0,0,0.08)]" : "border-black/10 hover:border-black/20"
        }`}
      >
        {children}
      </div>
      <div className="mt-2 text-sm font-medium leading-5 text-[#36312b]">{label}</div>
    </button>
  );
}

function CompactSlider({
  label,
  value,
  min,
  max,
  step,
  suffix = "m",
  onChange
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block space-y-2">
      <div className="flex items-center justify-between text-xs font-semibold text-[#474038]">
        <span>{label}</span>
        <span>{value.toFixed(2)}{suffix}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-2 w-full cursor-pointer accent-[#171411]"
      />
    </label>
  );
}

export function BuilderOpeningsStep({
  doorStyle,
  windowStyle,
  addSecondaryWindow,
  doorStyleLabels,
  windowStyleLabels,
  wallEntries,
  selectedWallId,
  selectedWallOpenings,
  selectedOpeningId,
  selectedOpening,
  selectedOpeningWall,
  placementIssue,
  onDoorStyleChange,
  onWindowStyleChange,
  onAddSecondaryWindowChange,
  onSelectWall,
  onSelectOpening,
  onAddOpening,
  onDeleteOpening,
  onPatchOpening,
  onSetEntrance,
  getWallLength
}: BuilderOpeningsStepProps) {
  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-base font-bold text-[#1a1714]">도어 스타일</h2>
        <div className="mt-4 grid grid-cols-2 gap-4">
          {(Object.keys(doorStyleLabels) as DoorStyle[]).map((style) => (
            <StyleOptionButton
              key={style}
              selected={doorStyle === style}
              label={doorStyleLabels[style]}
              onClick={() => onDoorStyleChange(style)}
            >
              <DoorThumbnail style={style} />
            </StyleOptionButton>
          ))}
        </div>
      </section>

      <div className="border-t border-black/10" />

      <section>
        <h2 className="text-base font-bold text-[#1a1714]">창문 스타일</h2>
        <div className="mt-4 grid grid-cols-2 gap-4">
          {(Object.keys(windowStyleLabels) as WindowStyle[]).map((style) => (
            <StyleOptionButton
              key={style}
              selected={windowStyle === style}
              label={windowStyleLabels[style]}
              onClick={() => onWindowStyleChange(style)}
            >
              <WindowThumbnail style={style} />
            </StyleOptionButton>
          ))}
        </div>

        <label className="mt-5 flex items-center gap-3 text-sm text-[#5f564d]">
          <input
            type="checkbox"
            checked={addSecondaryWindow}
            onChange={(event) => onAddSecondaryWindowChange(event.target.checked)}
            className="h-4 w-4 rounded border-black/20"
          />
          보조 창문 함께 배치하기
        </label>
      </section>

      <div className="border-t border-black/10" />

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-bold text-[#1a1714]">배치 편집</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onAddOpening("door")}
              className="inline-flex h-10 items-center gap-1.5 rounded-full border border-black/15 bg-white px-4 text-sm font-semibold text-[#211c17]"
            >
              <Plus className="h-4 w-4" />
              문
            </button>
            <button
              type="button"
              onClick={() => onAddOpening("window")}
              className="inline-flex h-10 items-center gap-1.5 rounded-full border border-black/15 bg-white px-4 text-sm font-semibold text-[#211c17]"
            >
              <Plus className="h-4 w-4" />
              창문
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {wallEntries.map((wall) => (
            <button
              key={wall.id}
              type="button"
              onClick={() => onSelectWall(wall.id)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                selectedWallId === wall.id ? "bg-[#111111] text-white" : "bg-[#f3f1ed] text-[#5b5247]"
              }`}
            >
              {wall.label}
            </button>
          ))}
        </div>

        {placementIssue ? (
          <div className="rounded-[18px] border border-red-900/15 bg-red-50 px-4 py-3 text-sm font-semibold text-red-900">
            {placementIssue.message}
          </div>
        ) : null}

        <div className="grid gap-2">
          {selectedWallOpenings.length > 0 ? (
            selectedWallOpenings.map((opening) => (
              <button
                key={opening.id}
                type="button"
                onClick={() => onSelectOpening(opening.id)}
                className={`flex items-center justify-between rounded-[18px] border px-4 py-3 text-left transition ${
                  selectedOpeningId === opening.id ? "border-[#171411] bg-white" : "border-black/10 bg-[#fbfaf8]"
                }`}
              >
                <span className="text-sm font-semibold text-[#2b2621]">
                  {opening.type === "door" ? "문" : "창문"}
                </span>
                <span className="text-xs font-semibold text-[#7c7266]">{opening.width.toFixed(2)}m</span>
              </button>
            ))
          ) : (
            <p className="rounded-[18px] bg-[#f4f2ee] px-4 py-3 text-sm text-[#6f665d]">이 벽에는 아직 개구부가 없습니다.</p>
          )}
        </div>

        {selectedOpening ? (
          <details className="overflow-hidden rounded-[22px] border border-black/10 bg-[#faf8f4]" open>
            <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold text-[#26211c]">
              정밀 배치 조정
              <ChevronDown className="h-4 w-4" />
            </summary>

            <div className="space-y-4 border-t border-black/10 px-4 py-4">
              <label className="block space-y-2">
                <span className="text-xs font-semibold text-[#5d554b]">배치 벽</span>
                <select
                  value={selectedOpening.wallId}
                  onChange={(event) => {
                    const wallId = event.target.value;
                    onPatchOpening(selectedOpening.id, { wallId });
                  }}
                  className="h-11 w-full rounded-[14px] border border-black/10 bg-white px-3 text-sm font-medium text-[#28231e]"
                >
                  {wallEntries.map((wall) => (
                    <option key={wall.id} value={wall.id}>
                      {wall.label} ({wall.length.toFixed(2)}m)
                    </option>
                  ))}
                </select>
              </label>

              <CompactSlider
                label="너비"
                value={selectedOpening.width}
                min={selectedOpening.type === "door" ? 0.72 : 0.92}
                max={Math.max(
                  selectedOpening.type === "door" ? 0.72 : 0.92,
                  (selectedOpeningWall ? getWallLength(selectedOpeningWall) : 1) - 0.64
                )}
                step={0.01}
                onChange={(value) => onPatchOpening(selectedOpening.id, { width: value })}
              />
              <CompactSlider
                label="오프셋"
                value={selectedOpening.offset}
                min={0.3}
                max={Math.max(
                  0.3,
                  (selectedOpeningWall ? getWallLength(selectedOpeningWall) : 1) - selectedOpening.width - 0.3
                )}
                step={0.01}
                onChange={(value) => onPatchOpening(selectedOpening.id, { offset: value })}
              />
              <CompactSlider
                label="높이"
                value={selectedOpening.height}
                min={selectedOpening.type === "door" ? 1.9 : 0.82}
                max={selectedOpening.type === "door" ? 2.4 : 2.1}
                step={0.01}
                onChange={(value) => onPatchOpening(selectedOpening.id, { height: value })}
              />

              {selectedOpening.type === "window" ? (
                <CompactSlider
                  label="창대 높이"
                  value={selectedOpening.sillHeight ?? 0.9}
                  min={0.25}
                  max={1.45}
                  step={0.01}
                  onChange={(value) => onPatchOpening(selectedOpening.id, { sillHeight: value })}
                />
              ) : (
                <>
                  <CompactSlider
                    label="도어 상승 높이"
                    value={selectedOpening.verticalOffset ?? 0}
                    min={0}
                    max={0.42}
                    step={0.01}
                    onChange={(value) => onPatchOpening(selectedOpening.id, { verticalOffset: value })}
                  />
                  <label className="flex items-center gap-3 rounded-[16px] border border-black/10 bg-white px-4 py-3 text-sm font-medium text-[#322c25]">
                    <input
                      type="checkbox"
                      checked={Boolean(selectedOpening.isEntrance)}
                      onChange={() => onSetEntrance(selectedOpening.id)}
                      className="h-4 w-4 rounded border-black/20"
                    />
                    입구 문으로 지정
                  </label>
                </>
              )}

              <button
                type="button"
                onClick={() => onDeleteOpening(selectedOpening.id)}
                className="inline-flex h-11 items-center gap-2 rounded-full border border-red-900/15 bg-white px-4 text-sm font-semibold text-red-800"
              >
                <Trash2 className="h-4 w-4" />
                선택한 개구부 삭제
              </button>
            </div>
          </details>
        ) : null}
      </section>
    </div>
  );
}
