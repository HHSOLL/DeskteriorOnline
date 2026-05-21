import type { BuilderTemplateId } from "./templates";

export type TemplateSeedPreset = "none" | "partial" | "full";
export type FurnishedTemplateCategory = "all" | "living" | "kids" | "bedroom" | "workspace" | "dining";
export type FurnishedRoomTemplateId =
  | "living-modern-lounge"
  | "workspace-flex"
  | "living-playful"
  | "living-fresh"
  | "kids-vintage"
  | "bedroom-practical"
  | "bedroom-european"
  | "bedroom-suite";

const FURNISHED_ROOM_TEMPLATE_ID_SET = new Set<FurnishedRoomTemplateId>([
  "living-modern-lounge",
  "workspace-flex",
  "living-playful",
  "living-fresh",
  "kids-vintage",
  "bedroom-practical",
  "bedroom-european",
  "bedroom-suite"
]);

export type EmptyRoomTemplateCard = {
  id: string;
  title: string;
  areaLabel: string;
  templateId: BuilderTemplateId;
  width: number;
  depth: number;
  nookWidth?: number;
  nookDepth?: number;
  wallMaterialIndex: number;
  floorMaterialIndex: number;
  wallColor: string;
  floorColor: string;
  accentWallColor?: string;
  hasWideWindow?: boolean;
  hasFrenchDoor?: boolean;
};

export type FurnishedRoomTemplateCard = {
  id: FurnishedRoomTemplateId;
  title: string;
  areaLabel: string;
  category: Exclude<FurnishedTemplateCategory, "all">;
  density: Exclude<TemplateSeedPreset, "none">;
  thumbnailSrc: string;
  templateId: BuilderTemplateId;
  width: number;
  depth: number;
  nookWidth?: number;
  nookDepth?: number;
  wallMaterialIndex: number;
  floorMaterialIndex: number;
  projectName: string;
};

export function isFurnishedRoomTemplateId(value: string | null): value is FurnishedRoomTemplateId {
  if (!value) return false;
  return FURNISHED_ROOM_TEMPLATE_ID_SET.has(value as FurnishedRoomTemplateId);
}

export const EMPTY_ROOM_TEMPLATE_CARDS: EmptyRoomTemplateCard[] = [
  {
    id: "blank-basic",
    title: "기본 공간",
    areaLabel: "23 m²",
    templateId: "rect-studio",
    width: 6,
    depth: 4,
    wallMaterialIndex: 0,
    floorMaterialIndex: 0,
    wallColor: "#f2f1ed",
    floorColor: "#bb9769"
  },
  {
    id: "blank-open",
    title: "개방적이고 넓은 공간",
    areaLabel: "44 m²",
    templateId: "rect-studio",
    width: 8.2,
    depth: 5.4,
    wallMaterialIndex: 1,
    floorMaterialIndex: 0,
    wallColor: "#f5f4ef",
    floorColor: "#a5794f",
    hasFrenchDoor: true
  },
  {
    id: "blank-bright",
    title: "밝고 넓은 공간",
    areaLabel: "26 m²",
    templateId: "l-shape",
    width: 6.8,
    depth: 4.6,
    nookWidth: 2.2,
    nookDepth: 1.8,
    wallMaterialIndex: 1,
    floorMaterialIndex: 0,
    wallColor: "#f4f4f2",
    floorColor: "#b48c60",
    hasFrenchDoor: true
  },
  {
    id: "blank-modern-dark",
    title: "아늑하고 현대적인 스타일",
    areaLabel: "18 m²",
    templateId: "rect-studio",
    width: 5.2,
    depth: 3.5,
    wallMaterialIndex: 2,
    floorMaterialIndex: 0,
    wallColor: "#7b4d35",
    floorColor: "#b28658"
  },
  {
    id: "blank-patio",
    title: "아늑하면서 현대적인 공간",
    areaLabel: "16 m²",
    templateId: "cut-shape",
    width: 5.1,
    depth: 3.8,
    nookWidth: 1,
    nookDepth: 1.1,
    wallMaterialIndex: 0,
    floorMaterialIndex: 2,
    wallColor: "#c4b396",
    floorColor: "#dad6ce",
    hasWideWindow: true
  },
  {
    id: "blank-calm",
    title: "평화로운 은신처",
    areaLabel: "15.3 m²",
    templateId: "cut-shape",
    width: 4.8,
    depth: 3.5,
    nookWidth: 0.9,
    nookDepth: 0.7,
    wallMaterialIndex: 0,
    floorMaterialIndex: 0,
    wallColor: "#efe7e1",
    floorColor: "#a87744"
  },
  {
    id: "blank-oasis",
    title: "상쾌한 오아시스",
    areaLabel: "21 m²",
    templateId: "rect-studio",
    width: 5.7,
    depth: 3.9,
    wallMaterialIndex: 0,
    floorMaterialIndex: 0,
    wallColor: "#8eb1bc",
    accentWallColor: "#6f94a1",
    floorColor: "#b48a60"
  },
  {
    id: "blank-natural",
    title: "맑은 내추럴",
    areaLabel: "21 m²",
    templateId: "rect-studio",
    width: 5.8,
    depth: 3.7,
    wallMaterialIndex: 1,
    floorMaterialIndex: 0,
    wallColor: "#f3f2ef",
    floorColor: "#b68a5d"
  }
];

export const FURNISHED_ROOM_TEMPLATE_CARDS: FurnishedRoomTemplateCard[] = [
  {
    id: "living-modern-lounge",
    title: "현대적인 거실 라운지",
    areaLabel: "16 m²",
    category: "living",
    density: "full",
    thumbnailSrc: "/home/img1.jpg",
    templateId: "rect-studio",
    width: 5.6,
    depth: 4.1,
    wallMaterialIndex: 0,
    floorMaterialIndex: 0,
    projectName: "현대적인 거실 라운지"
  },
  {
    id: "workspace-flex",
    title: "나만의 3D 작업방",
    areaLabel: "19 m²",
    category: "workspace",
    density: "full",
    thumbnailSrc: "/home/img2.jpg",
    templateId: "rect-studio",
    width: 5.2,
    depth: 3.6,
    wallMaterialIndex: 1,
    floorMaterialIndex: 0,
    projectName: "나만의 3D 작업방"
  },
  {
    id: "living-playful",
    title: "활기찬 거실",
    areaLabel: "23 m²",
    category: "living",
    density: "full",
    thumbnailSrc: "/home/img3.jpg",
    templateId: "rect-studio",
    width: 6.1,
    depth: 4.4,
    wallMaterialIndex: 0,
    floorMaterialIndex: 0,
    projectName: "활기찬 거실"
  },
  {
    id: "living-fresh",
    title: "산뜻하고 모던한 거실",
    areaLabel: "22.9 m²",
    category: "living",
    density: "partial",
    thumbnailSrc: "/home/img4.jpg",
    templateId: "rect-studio",
    width: 6.2,
    depth: 4.2,
    wallMaterialIndex: 0,
    floorMaterialIndex: 0,
    projectName: "산뜻하고 모던한 거실"
  },
  {
    id: "kids-vintage",
    title: "빈티지 스타일의 아이 방",
    areaLabel: "21 m²",
    category: "kids",
    density: "partial",
    thumbnailSrc: "/home/img5.jpg",
    templateId: "rect-studio",
    width: 5.8,
    depth: 4.0,
    wallMaterialIndex: 0,
    floorMaterialIndex: 0,
    projectName: "빈티지 스타일의 아이 방"
  },
  {
    id: "bedroom-practical",
    title: "실용적이면서 현대적인 침실",
    areaLabel: "21 m²",
    category: "bedroom",
    density: "full",
    thumbnailSrc: "/home/img6.jpg",
    templateId: "rect-studio",
    width: 5.9,
    depth: 4.1,
    wallMaterialIndex: 0,
    floorMaterialIndex: 1,
    projectName: "실용적이면서 현대적인 침실"
  },
  {
    id: "bedroom-european",
    title: "차분한 북유럽 스타일의 침실",
    areaLabel: "24 m²",
    category: "bedroom",
    density: "partial",
    thumbnailSrc: "/home/img7.jpg",
    templateId: "rect-studio",
    width: 6.6,
    depth: 4.5,
    wallMaterialIndex: 1,
    floorMaterialIndex: 0,
    projectName: "차분한 북유럽 스타일의 침실"
  },
  {
    id: "bedroom-suite",
    title: "세련된 스위트 침실",
    areaLabel: "19 m²",
    category: "bedroom",
    density: "full",
    thumbnailSrc: "/home/img2.jpg",
    templateId: "rect-studio",
    width: 5.4,
    depth: 3.8,
    wallMaterialIndex: 2,
    floorMaterialIndex: 0,
    projectName: "세련된 스위트 침실"
  }
];
