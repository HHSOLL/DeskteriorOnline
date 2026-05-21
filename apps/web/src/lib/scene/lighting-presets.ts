export type LightingSettingsSnapshot = {
  ambientIntensity: number;
  hemisphereIntensity: number;
  directionalIntensity: number;
  environmentBlur: number;
  accentIntensity: number;
  beamOpacity: number;
};

export type LightingPresetId = "home-reference" | "neutral-studio" | "soft-evening";

export type LightingQaProfile = {
  hdri: "studio-softbox-2k" | "residential-window-2k" | "warm-interior-2k";
  exposureStops: number;
  whiteBalanceKelvin: number;
  contactShadowOpacity: number;
  toneMapping: "aces";
  dynamicLightBudget: 6;
  postFxScope: "walk-showcase-only";
};

export type LightingPreset = {
  id: LightingPresetId;
  label: string;
  description: string;
  settings: LightingSettingsSnapshot;
  qaProfile: LightingQaProfile;
};

export const HOME_REFERENCE_LIGHTING: LightingSettingsSnapshot = {
  ambientIntensity: 0.44,
  hemisphereIntensity: 0.54,
  directionalIntensity: 1.24,
  environmentBlur: 0.14,
  accentIntensity: 0.96,
  beamOpacity: 0.24
};

export const LIGHTING_PRESETS: LightingPreset[] = [
  {
    id: "home-reference",
    label: "Home Reference",
    description: "홈 레퍼런스 이미지 톤에 맞춘 기본 프리셋",
    settings: HOME_REFERENCE_LIGHTING,
    qaProfile: {
      hdri: "residential-window-2k",
      exposureStops: 0,
      whiteBalanceKelvin: 5000,
      contactShadowOpacity: 0.38,
      toneMapping: "aces",
      dynamicLightBudget: 6,
      postFxScope: "walk-showcase-only"
    }
  },
  {
    id: "neutral-studio",
    label: "Neutral Studio",
    description: "재질 확인용 중립 조명",
    settings: {
      ambientIntensity: 0.34,
      hemisphereIntensity: 0.42,
      directionalIntensity: 1.02,
      environmentBlur: 0.1,
      accentIntensity: 0.52,
      beamOpacity: 0.07
    },
    qaProfile: {
      hdri: "studio-softbox-2k",
      exposureStops: -0.15,
      whiteBalanceKelvin: 5600,
      contactShadowOpacity: 0.32,
      toneMapping: "aces",
      dynamicLightBudget: 6,
      postFxScope: "walk-showcase-only"
    }
  },
  {
    id: "soft-evening",
    label: "Soft Evening",
    description: "대비를 낮춘 부드러운 저녁 톤",
    settings: {
      ambientIntensity: 0.46,
      hemisphereIntensity: 0.6,
      directionalIntensity: 0.86,
      environmentBlur: 0.24,
      accentIntensity: 0.78,
      beamOpacity: 0.12
    },
    qaProfile: {
      hdri: "warm-interior-2k",
      exposureStops: -0.25,
      whiteBalanceKelvin: 4200,
      contactShadowOpacity: 0.44,
      toneMapping: "aces",
      dynamicLightBudget: 6,
      postFxScope: "walk-showcase-only"
    }
  }
];

const PRESET_MATCH_TOLERANCE = 0.02;
const PRESET_MATCH_FIELDS: Array<keyof LightingSettingsSnapshot> = [
  "ambientIntensity",
  "hemisphereIntensity",
  "directionalIntensity",
  "environmentBlur",
  "accentIntensity",
  "beamOpacity"
];

export function getLightingPreset(id: LightingPresetId) {
  return LIGHTING_PRESETS.find((preset) => preset.id === id) ?? null;
}

export function inferLightingPresetId(
  lighting: LightingSettingsSnapshot
): LightingPresetId | null {
  for (const preset of LIGHTING_PRESETS) {
    const isPresetMatch = PRESET_MATCH_FIELDS.every(
      (field) => Math.abs(preset.settings[field] - lighting[field]) <= PRESET_MATCH_TOLERANCE
    );
    if (isPresetMatch) {
      return preset.id;
    }
  }

  return null;
}
