import type {
  EditorTopMode,
  TransformMode,
  TransformSpace
} from "../stores/useEditorStore";

export type TopViewInteractionPolicy = {
  id: EditorTopMode;
  label: string;
  shortLabel: string;
  description: string;
  translationSnap: number;
  rotationSnap: number;
  rotateStep: number;
  allowDirectAssetDrag: boolean;
  allowTransformControls: boolean;
  allowTransformHotkeys: boolean;
  preferredTransformMode: TransformMode;
  preferredTransformSpace: TransformSpace;
  zoomBounds: {
    min: number;
    max: number;
  };
  preferredZoomFloor: number;
  preferredZoomMultiplier: number;
};

const TOP_VIEW_POLICIES: Record<EditorTopMode, TopViewInteractionPolicy> = {
  room: {
    id: "room",
    label: "룸 배치",
    shortLabel: "Room Mode",
    description: "방 중심 상단뷰에서 큰 위치 이동과 레이아웃 정렬에 집중합니다.",
    translationSnap: 0.25,
    rotationSnap: Math.PI / 2,
    rotateStep: Math.PI / 2,
    allowDirectAssetDrag: true,
    allowTransformControls: false,
    allowTransformHotkeys: false,
    preferredTransformMode: "translate",
    preferredTransformSpace: "world",
    zoomBounds: {
      min: 32,
      max: 360
    },
    preferredZoomFloor: 58,
    preferredZoomMultiplier: 1
  },
  "desk-precision": {
    id: "desk-precision",
    label: "데스크 정밀",
    shortLabel: "Desk Precision",
    description: "surface/anchor 기준 정밀 배치와 미세 회전을 위한 고정밀 상단뷰입니다.",
    translationSnap: 0.025,
    rotationSnap: Math.PI / 12,
    rotateStep: Math.PI / 12,
    allowDirectAssetDrag: false,
    allowTransformControls: true,
    allowTransformHotkeys: true,
    preferredTransformMode: "translate",
    preferredTransformSpace: "local",
    zoomBounds: {
      min: 72,
      max: 520
    },
    preferredZoomFloor: 96,
    preferredZoomMultiplier: 1.45
  }
};

export function resolveTopViewInteractionPolicy(mode: EditorTopMode): TopViewInteractionPolicy {
  return TOP_VIEW_POLICIES[mode];
}

export function resolvePreferredTopViewZoom(
  mode: EditorTopMode,
  baseZoom: number,
  currentZoom?: number | null
) {
  const policy = resolveTopViewInteractionPolicy(mode);
  const preferredZoom = Math.max(
    baseZoom * policy.preferredZoomMultiplier,
    policy.preferredZoomFloor
  );
  const nextZoom =
    currentZoom == null
      ? preferredZoom
      : mode === "desk-precision"
        ? Math.max(currentZoom, preferredZoom)
        : currentZoom;

  return Math.min(policy.zoomBounds.max, Math.max(policy.zoomBounds.min, nextZoom));
}
