import { useEffect, useRef, useState, type PointerEvent } from "react";
import { BUILDER_LIGHTING_OPTIONS } from "../constants";
import type { BuilderLightingMode } from "../types";
import {
  DEFAULT_LIGHTING_GRID_SNAP_MM,
  createDefaultDirectLightingFixtures,
  normalizeDirectLightCount,
  normalizeLightingFixtures,
  resolveLightingPositionMmFromNormalized,
  type LightingFixture,
  type LightingLayoutBoundsMm
} from "../../../lib/scene/lighting-layout";

type BuilderLightingStepProps = {
  lightingMode: BuilderLightingMode;
  fixtures: LightingFixture[];
  roomBoundsMm: LightingLayoutBoundsMm;
  onLightingModeChange: (mode: BuilderLightingMode) => void;
  onFixturesChange: (fixtures: LightingFixture[]) => void;
};

const COUNT_OPTIONS = [1, 2, 3, 4, 6] as const;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function resolvePercent(value: number, min: number, max: number) {
  if (max <= min) return 50;
  return clamp(((value - min) / (max - min)) * 100, 0, 100);
}

function formatMeters(mm: number) {
  return `${(mm / 1000).toFixed(2)}m`;
}

export function BuilderLightingStep({
  lightingMode,
  fixtures,
  roomBoundsMm,
  onLightingModeChange,
  onFixturesChange
}: BuilderLightingStepProps) {
  const planeRef = useRef<HTMLDivElement | null>(null);
  const pendingDragUpdateRef = useRef<{
    fixtureId: string;
    positionMm: LightingFixture["positionMm"];
  } | null>(null);
  const dragFrameRef = useRef<number | null>(null);
  const [draggingFixtureId, setDraggingFixtureId] = useState<string | null>(null);
  const directFixtures =
    fixtures.length > 0
      ? normalizeLightingFixtures(fixtures, roomBoundsMm)
      : createDefaultDirectLightingFixtures(roomBoundsMm, 3);

  const setDirectFixtures = (nextFixtures: LightingFixture[]) => {
    onFixturesChange(normalizeLightingFixtures(nextFixtures, roomBoundsMm));
  };

  const updateFixture = (fixtureId: string, patch: Partial<LightingFixture>) => {
    setDirectFixtures(
      directFixtures.map((fixture) => (fixture.id === fixtureId ? { ...fixture, ...patch } : fixture))
    );
  };

  const flushPendingDragUpdate = () => {
    dragFrameRef.current = null;
    const pending = pendingDragUpdateRef.current;
    pendingDragUpdateRef.current = null;
    if (!pending) return;
    updateFixture(pending.fixtureId, {
      positionMm: pending.positionMm
    });
  };

  const updateFixtureFromPointer = (fixtureId: string, event: PointerEvent<HTMLElement>) => {
    const rect = planeRef.current?.getBoundingClientRect();
    if (!rect) return;
    const xRatio = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    const zRatio = clamp((event.clientY - rect.top) / rect.height, 0, 1);
    pendingDragUpdateRef.current = {
      fixtureId,
      positionMm: resolveLightingPositionMmFromNormalized(xRatio, zRatio, roomBoundsMm)
    };
    if (dragFrameRef.current === null) {
      dragFrameRef.current = requestAnimationFrame(flushPendingDragUpdate);
    }
  };

  useEffect(() => {
    return () => {
      if (dragFrameRef.current !== null) {
        cancelAnimationFrame(dragFrameRef.current);
      }
    };
  }, []);

  const setFixtureCount = (count: number) => {
    setDirectFixtures(createDefaultDirectLightingFixtures(roomBoundsMm, normalizeDirectLightCount(count), directFixtures[0]));
  };

  const addFixture = () => {
    setFixtureCount(Math.min(6, directFixtures.length + 1));
  };

  const deleteFixture = (fixtureId: string) => {
    const nextFixtures = directFixtures.filter((fixture) => fixture.id !== fixtureId);
    setDirectFixtures(nextFixtures.length > 0 ? nextFixtures : createDefaultDirectLightingFixtures(roomBoundsMm, 1));
  };

  const autoAlignFixtures = () => {
    setFixtureCount(directFixtures.length);
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        {BUILDER_LIGHTING_OPTIONS.map((option) => {
          const isActive = lightingMode === option.id;

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onLightingModeChange(option.id)}
              className={`rounded-[20px] border px-5 py-5 text-left transition ${
                isActive
                  ? "border-[#171411] bg-[#171411] text-white shadow-[0_18px_34px_rgba(23,20,17,0.18)]"
                  : "border-black/10 bg-[#faf8f4] text-[#1f1b16] hover:border-black/20 hover:bg-white"
              }`}
            >
              <div className="text-[10px] font-bold uppercase tracking-[0.16em]">
                {option.id === "direct" ? "Direct Lighting" : "Indirect Lighting"}
              </div>
              <div className="mt-3 text-xl font-black tracking-[-0.03em]">{option.name}</div>
              <p className={`mt-3 text-sm leading-6 ${isActive ? "text-white/82" : "text-[#5d554a]"}`}>
                {option.description}
              </p>
              <p className={`mt-3 text-xs leading-5 ${isActive ? "text-white/68" : "text-[#84796d]"}`}>
                {option.detail}
              </p>
            </button>
          );
        })}
      </div>

      {lightingMode === "direct" ? (
        <div className="space-y-4 rounded-[22px] border border-black/10 bg-[#fbfaf7] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#7a7064]">Fixture Layout</div>
              <p className="mt-2 text-sm leading-6 text-[#5d554a]">
                다운라이트 개수와 위치는 scene lighting payload에 저장됩니다.
              </p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#9a6a1f]">
                Snap {DEFAULT_LIGHTING_GRID_SNAP_MM}mm
              </p>
            </div>
            <button
              type="button"
              onClick={autoAlignFixtures}
              className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-bold text-[#2c251f] hover:border-black/20"
            >
              자동 정렬
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {COUNT_OPTIONS.map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => setFixtureCount(count)}
                className={`rounded-full border px-3 py-2 text-sm font-bold transition ${
                  directFixtures.length === count
                    ? "border-[#171411] bg-[#171411] text-white"
                    : "border-black/10 bg-white text-[#2c251f] hover:border-black/20"
                }`}
              >
                {count}개
              </button>
            ))}
            <button
              type="button"
              onClick={addFixture}
              disabled={directFixtures.length >= 6}
              className="rounded-full border border-black/10 bg-white px-3 py-2 text-sm font-bold text-[#2c251f] hover:border-black/20 disabled:cursor-not-allowed disabled:opacity-45"
            >
              추가
            </button>
          </div>

          <div
            ref={planeRef}
            data-testid="builder-lighting-grid"
            className="relative aspect-[4/3] overflow-hidden rounded-[18px] border border-black/10 bg-[linear-gradient(90deg,rgba(0,0,0,0.055)_1px,transparent_1px),linear-gradient(rgba(0,0,0,0.055)_1px,transparent_1px)] bg-[length:32px_32px] bg-[#ede8df]"
          >
            {directFixtures.map((fixture, index) => {
              const left = resolvePercent(fixture.positionMm[0], roomBoundsMm.minXMm, roomBoundsMm.maxXMm);
              const top = resolvePercent(fixture.positionMm[2], roomBoundsMm.minZMm, roomBoundsMm.maxZMm);

              return (
                <button
                  key={fixture.id}
                  type="button"
                  onPointerDown={(event) => {
                    event.currentTarget.setPointerCapture(event.pointerId);
                    setDraggingFixtureId(fixture.id);
                    updateFixtureFromPointer(fixture.id, event);
                  }}
                  onPointerMove={(event) => {
                    if (draggingFixtureId === fixture.id) {
                      updateFixtureFromPointer(fixture.id, event);
                    }
                  }}
                  onPointerUp={(event) => {
                    event.currentTarget.releasePointerCapture(event.pointerId);
                    setDraggingFixtureId(null);
                  }}
                  onPointerCancel={() => setDraggingFixtureId(null)}
                  className="absolute grid size-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white bg-[#f2b65b] text-xs font-black text-[#171411] shadow-[0_8px_20px_rgba(71,50,22,0.25)]"
                  data-testid="builder-lighting-fixture-marker"
                  data-position-x-mm={fixture.positionMm[0]}
                  data-position-z-mm={fixture.positionMm[2]}
                  style={{ left: `${left}%`, top: `${top}%` }}
                  aria-label={`조명 ${index + 1} 위치 조정`}
                >
                  {index + 1}
                </button>
              );
            })}
          </div>

          <div className="space-y-3">
            {directFixtures.map((fixture, index) => (
              <div key={fixture.id} className="rounded-[18px] border border-black/10 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-black text-[#1f1b16]">조명 {index + 1}</div>
                    <div className="mt-1 text-xs text-[#7a7064]">
                      X {formatMeters(fixture.positionMm[0])} · Z {formatMeters(fixture.positionMm[2])}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteFixture(fixture.id)}
                    disabled={directFixtures.length <= 1}
                    className="rounded-full border border-black/10 px-3 py-1.5 text-xs font-bold text-[#5d554a] disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    삭제
                  </button>
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="text-xs font-bold text-[#5d554a]">
                    밝기 {fixture.intensity.toFixed(2)}
                    <input
                      type="range"
                      min="0.2"
                      max="1.8"
                      step="0.05"
                      value={fixture.intensity}
                      onChange={(event) => updateFixture(fixture.id, { intensity: Number(event.target.value) })}
                      className="mt-2 w-full accent-[#171411]"
                    />
                  </label>
                  <label className="text-xs font-bold text-[#5d554a]">
                    빔 반경 {fixture.beamRadiusMm}mm
                    <input
                      type="range"
                      min="600"
                      max="2200"
                      step="50"
                      value={fixture.beamRadiusMm}
                      onChange={(event) => updateFixture(fixture.id, { beamRadiusMm: Number(event.target.value) })}
                      className="mt-2 w-full accent-[#171411]"
                    />
                  </label>
                  <label className="text-xs font-bold text-[#5d554a]">
                    색온도
                    <select
                      value={fixture.colorTemperature}
                      onChange={(event) =>
                        updateFixture(fixture.id, {
                          colorTemperature: event.target.value as LightingFixture["colorTemperature"]
                        })
                      }
                      className="mt-2 w-full rounded-[12px] border border-black/10 bg-[#fbfaf7] px-3 py-2 text-sm text-[#171411]"
                    >
                      <option value="warm">Warm</option>
                      <option value="neutral">Neutral</option>
                      <option value="cool">Cool</option>
                    </select>
                  </label>
                  <label className="text-xs font-bold text-[#5d554a]">
                    Spread {fixture.spread.toFixed(2)}
                    <input
                      type="range"
                      min="0.3"
                      max="1.05"
                      step="0.01"
                      value={fixture.spread}
                      onChange={(event) => updateFixture(fixture.id, { spread: Number(event.target.value) })}
                      className="mt-2 w-full accent-[#171411]"
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-[22px] border border-black/10 bg-[#fbfaf7] p-5">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#7a7064]">Preview Note</div>
          <p className="mt-3 text-sm leading-6 text-[#5d554a]">
            간접등은 광원 노출을 줄이고 천장 근처의 부드러운 확산광으로 공간 톤을 만듭니다.
          </p>
        </div>
      )}
    </div>
  );
}
