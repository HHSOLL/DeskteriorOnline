import { SceneViewport } from "../editor/SceneViewport";
import type { SharedViewerPresentation } from "../../lib/viewer/presentation";

type ReadOnlyViewerViewportProps = {
  viewMode: "top" | "walk";
  selectedLabel: string | null;
  showReadOnlyNotice: boolean;
  presentation: SharedViewerPresentation;
};

export function ReadOnlyViewerViewport({
  viewMode,
  selectedLabel,
  showReadOnlyNotice,
  presentation
}: ReadOnlyViewerViewportProps) {
  const isShowcasePresentation = presentation === "showcase";
  const viewLabel = isShowcasePresentation
    ? viewMode === "top"
      ? "쇼케이스 상단뷰"
      : "쇼케이스 워크뷰"
    : viewMode === "top"
      ? "읽기 전용 상단뷰"
      : "읽기 전용 워크뷰";

  const triggerZoomControl = (direction: "in" | "out") => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent("deskterioronline:zoom", { detail: { direction } }));
  };

  return (
    <div className="relative xl:order-2">
      <div className="relative overflow-hidden p2s-workspace-viewport">
        <div className="pointer-events-none absolute left-4 top-4 z-[24] flex flex-wrap items-center gap-2">
          <div className="rounded-full border border-black/10 bg-white/92 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#4e463d]">
            {viewLabel}
          </div>
          <div className="rounded-full border border-black/10 bg-white/92 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#7a7064]">
            {selectedLabel ? `${selectedLabel} 선택됨` : "선택된 제품 없음"}
          </div>
        </div>

        <div className="pointer-events-none absolute right-4 top-4 z-[24] flex flex-col gap-3">
          <div className="pointer-events-auto flex flex-col overflow-hidden rounded-full border border-black/10 bg-white/96 p-1 shadow-[0_10px_24px_rgba(19,21,24,0.12)]">
            <button
              type="button"
              onClick={() => triggerZoomControl("in")}
              className="rounded-full px-3 py-2 text-[16px] font-bold text-[#4d453a] transition hover:bg-[#f2eee7]"
              aria-label="확대"
            >
              +
            </button>
            <div className="mx-2 h-px bg-black/10" />
            <button
              type="button"
              onClick={() => triggerZoomControl("out")}
              className="rounded-full px-3 py-2 text-[16px] font-bold text-[#4d453a] transition hover:bg-[#f2eee7]"
              aria-label="축소"
            >
              -
            </button>
          </div>
        </div>

        <SceneViewport
          className="h-[72vh] rounded-none border-0 shadow-none sm:h-[78vh]"
          camera={{ fov: 45, position: [0, 8, 14] }}
          chromeTone="light"
          interactionMode={isShowcasePresentation ? "viewer-showcase" : "viewer-shared"}
          showHud={true}
          hudProfile="shared-viewer"
        />

        {(showReadOnlyNotice || selectedLabel) ? (
          <div className="pointer-events-none absolute inset-x-4 bottom-4 z-[24] flex justify-center">
            <div className="rounded-full border border-black/10 bg-white/94 px-4 py-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[#625a51] shadow-[0_10px_24px_rgba(19,21,24,0.12)]">
              {showReadOnlyNotice
                ? "이 링크는 읽기 전용으로만 감상할 수 있습니다."
                : `${selectedLabel} 정보를 확인할 수 있습니다.`}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
