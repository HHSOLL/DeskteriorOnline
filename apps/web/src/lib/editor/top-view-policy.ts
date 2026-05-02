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
    label: "상단 확인",
    shortLabel: "View Only",
    description: "상단뷰는 배치 편집 없이 전체 공간을 확인하는 읽기 전용 모드입니다.",
    translationSnap: 0.25,
    rotationSnap: Math.PI / 2,
    rotateStep: Math.PI / 2,
    allowDirectAssetDrag: false,
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
    shortLabel: "Precision",
    description: "데스크 정밀뷰는 선택 제품을 5mm / 1도 단위로 조정하고 inspector 숫자 입력으로 1mm 보정합니다.",
    translationSnap: 0.005,
    rotationSnap: Math.PI / 180,
    rotateStep: Math.PI / 180,
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
