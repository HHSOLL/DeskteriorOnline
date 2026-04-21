import type { LightingSettings } from "../../lib/stores/useSceneStore";
import type { BuilderLightingMode, BuilderStepId, BuilderStepMeta, DoorStyle, WindowStyle } from "./types";

export const BUILDER_STEPS: BuilderStepMeta[] = [
  {
    id: "shape",
    label: "1/5단계",
    title: "모양 및 크기 설정하기",
    description: ""
  },
  {
    id: "dimension",
    label: "2/5단계",
    title: "치수 조정하기",
    description: "방의 벽 크기에 맞게 오른쪽의 평면도를 편집하세요."
  },
  {
    id: "opening",
    label: "3/5단계",
    title: "문과 창문 추가하기",
    description: ""
  },
  {
    id: "style",
    label: "4/5단계",
    title: "방 스타일 선택하기",
    description: ""
  },
  {
    id: "lighting",
    label: "5/5단계",
    title: "조명 분위기 선택하기",
    description: "직접등과 간접등 중 원하는 광원 스타일을 고르세요."
  }
];

const BUILDER_STEP_INDEX_BY_ID: Record<BuilderStepId, number> = BUILDER_STEPS.reduce(
  (accumulator, step, index) => ({
    ...accumulator,
    [step.id]: index
  }),
  {
    shape: 0,
    dimension: 1,
    opening: 2,
    style: 3,
    lighting: 4
  } satisfies Record<BuilderStepId, number>
);

export function resolveBuilderStepIndex(stepParam: string | null | undefined) {
  if (!stepParam) return 0;
  if (!(stepParam in BUILDER_STEP_INDEX_BY_ID)) return 0;
  return BUILDER_STEP_INDEX_BY_ID[stepParam as BuilderStepId];
}

export const DOOR_STYLE_LABEL: Record<DoorStyle, string> = {
  single: "싱글 패널 도어",
  double: "이중 패널 도어",
  french: "프렌치 양문형 도어"
};

export const WINDOW_STYLE_LABEL: Record<WindowStyle, string> = {
  single: "유리창 싱글",
  wide: "유리창 더블"
};

export const WALL_FINISH_SWATCH: Record<number, string> = {
  0: "#f2efe9",
  1: "#d6cdbd",
  2: "#9ea5a8",
  3: "#d2d0ca",
  4: "#ada59d",
  5: "#bf946b",
  6: "#8f6c52"
};

export const FLOOR_FINISH_SWATCH: Record<number, string> = {
  0: "linear-gradient(135deg, #c9ab7f 0%, #b98e61 100%)",
  1: "linear-gradient(135deg, #807a75 0%, #5f5954 100%)",
  2: "linear-gradient(135deg, #d2cdc4 0%, #b9b2a6 100%)",
  3: "linear-gradient(135deg, #c3a480 0%, #aa875f 100%)",
  4: "linear-gradient(135deg, #aa8159 0%, #8e6947 100%)",
  5: "linear-gradient(135deg, #8e6544 0%, #6e4f35 100%)",
  6: "linear-gradient(135deg, #ece6dd 0%, #d3ccc0 100%)",
  7: "linear-gradient(135deg, #bcc1c5 0%, #9aa0a4 100%)",
  8: "linear-gradient(135deg, #7d6e62 0%, #605248 100%)"
};

export const LIGHTING_MODE_LABEL: Record<BuilderLightingMode, string> = {
  direct: "직접등",
  indirect: "간접등"
};

export const BUILDER_LIGHTING_OPTIONS: Array<{
  id: BuilderLightingMode;
  name: string;
  description: string;
  detail: string;
}> = [
  {
    id: "direct",
    name: "직접등",
    description: "천장 다운라이트를 중심으로 또렷한 광원 포인트를 만듭니다.",
    detail: "광원 하이라이트와 바닥 빔을 보여줘서 집중감이 높은 공간에 어울립니다."
  },
  {
    id: "indirect",
    name: "간접등",
    description: "천장면을 타고 번지는 반사광으로 부드럽게 전체를 밝힙니다.",
    detail: "직광 느낌을 줄이고 은은한 분위기를 유지하고 싶을 때 적합합니다."
  }
];

export const BUILDER_LIGHTING_SCENE: Record<BuilderLightingMode, LightingSettings> = {
  direct: {
    mode: "direct",
    ambientIntensity: 0.34,
    hemisphereIntensity: 0.44,
    directionalIntensity: 1.16,
    environmentBlur: 0.18,
    accentIntensity: 0.96,
    beamOpacity: 0.24
  },
  indirect: {
    mode: "indirect",
    ambientIntensity: 0.58,
    hemisphereIntensity: 0.76,
    directionalIntensity: 0.74,
    environmentBlur: 0.3,
    accentIntensity: 0.68,
    beamOpacity: 0.08
  }
};
