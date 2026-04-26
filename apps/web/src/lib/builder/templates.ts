import type { Floor, Opening, ScaleInfo, Wall } from "../stores/useSceneStore";

export type BuilderTemplateId =
  | "rect-studio"
  | "l-shape"
  | "cut-shape"
  | "t-shape"
  | "u-shape"
  | "slanted-shape"
  | "offset-studio"
  | "gallery-bay";

export type BuilderTemplate = {
  id: BuilderTemplateId;
  name: string;
  eyebrow: string;
  description: string;
  accent: string;
  defaultWidth: number;
  defaultDepth: number;
  defaultNookWidth?: number;
  defaultNookDepth?: number;
};

export const builderTemplates: BuilderTemplate[] = [
  {
    id: "rect-studio",
    name: "사각형",
    eyebrow: "기본 형태",
    description: "가장 빠르게 시작할 수 있는 직사각형 방 형태입니다.",
    accent: "#c96f3b",
    defaultWidth: 6.4,
    defaultDepth: 4.8
  },
  {
    id: "l-shape",
    name: "L자형",
    eyebrow: "코너 확장",
    description: "한쪽이 확장된 L형 구조로 구역 분리가 쉬운 형태입니다.",
    accent: "#2f6c61",
    defaultWidth: 7.6,
    defaultDepth: 6.2,
    defaultNookWidth: 2.8,
    defaultNookDepth: 2.4
  },
  {
    id: "cut-shape",
    name: "잘라내기",
    eyebrow: "모서리 컷",
    description: "모서리를 사선으로 잘라낸 형태로 진입 동선을 확보하기 좋습니다.",
    accent: "#7c5c42",
    defaultWidth: 6.8,
    defaultDepth: 5.2,
    defaultNookWidth: 2.0,
    defaultNookDepth: 1.6
  },
  {
    id: "t-shape",
    name: "T자형",
    eyebrow: "복합 구역",
    description: "중앙 복도와 상단 확장부를 가진 형태로 작업/수납 구역 분리에 적합합니다.",
    accent: "#5f6d86",
    defaultWidth: 7.8,
    defaultDepth: 6.0,
    defaultNookWidth: 3.0,
    defaultNookDepth: 2.2
  },
  {
    id: "u-shape",
    name: "U자형",
    eyebrow: "집중형 배치",
    description: "내부 포켓 공간이 있어 데스크테리어 집중 배치에 유리합니다.",
    accent: "#5f6752",
    defaultWidth: 8.0,
    defaultDepth: 5.8,
    defaultNookWidth: 2.4,
    defaultNookDepth: 1.4
  },
  {
    id: "slanted-shape",
    name: "경사진 형태",
    eyebrow: "사선 외곽",
    description: "경사진 벽 라인이 포함된 형태로 전시형 장면 구성에 적합합니다.",
    accent: "#6a5a7b",
    defaultWidth: 7.2,
    defaultDepth: 5.4,
    defaultNookWidth: 1.4,
    defaultNookDepth: 1.4
  },
  {
    id: "offset-studio",
    name: "오프셋 스튜디오",
    eyebrow: "비대칭 레이아웃",
    description: "한쪽 벽이 안으로 들어간 비대칭 구조로 작업/촬영 구역을 나누기 좋습니다.",
    accent: "#896257",
    defaultWidth: 7.4,
    defaultDepth: 5.8,
    defaultNookWidth: 2.2,
    defaultNookDepth: 1.8
  },
  {
    id: "gallery-bay",
    name: "갤러리 베이",
    eyebrow: "전면 확장",
    description: "전면이 살짝 돌출된 형태로 전시형 벽면과 포컬존을 만들기 좋습니다.",
    accent: "#4e6a87",
    defaultWidth: 8.2,
    defaultDepth: 5.6,
    defaultNookWidth: 2.6,
    defaultNookDepth: 1.6
  }
];

export const builderWallFinishes = [
  { id: 0, name: "Soft Plaster", category: "Paint" },
  { id: 1, name: "Gallery White", category: "Paint" },
  { id: 2, name: "Dark Concrete", category: "Concrete" },
  { id: 3, name: "Grey Plaster", category: "Paint" },
  { id: 4, name: "Layered Concrete", category: "Concrete" },
  { id: 5, name: "Oak Panel", category: "Wood Panel" },
  { id: 6, name: "Walnut Panel", category: "Wood Panel" },
  { id: 7, name: "Worn Wood Slat", category: "Acoustic Panel" },
  { id: 8, name: "Textile Acoustic", category: "Acoustic Panel" },
  { id: 9, name: "Terrazzo Wallpaper", category: "Wallpaper" }
] as const;

export const builderFloorFinishes = [
  { id: 0, name: "Oak Boards", category: "Wood" },
  { id: 1, name: "Worn Concrete", category: "Concrete" },
  { id: 2, name: "Stone Marble", category: "Stone" },
  { id: 3, name: "Warm Laminate", category: "Wood" },
  { id: 4, name: "Classic Wood", category: "Wood" },
  { id: 5, name: "Brown Linoleum", category: "Resilient" },
  { id: 6, name: "Terrazzo Tile", category: "Tile" },
  { id: 7, name: "Anti-Skid Tile", category: "Tile" },
  { id: 8, name: "Soft Carpet", category: "Carpet" },
  { id: 9, name: "Black Carpet", category: "Carpet" },
  { id: 10, name: "Cork Desk Studio", category: "Resilient" }
] as const;

export const builderCeilingFinishes = [
  { id: 0, name: "Matte Plaster", category: "Paint" },
  { id: 1, name: "Gallery White", category: "Paint" },
  { id: 2, name: "Acoustic Textile", category: "Acoustic" },
  { id: 3, name: "Concrete Loft", category: "Concrete" }
] as const;

export type BuilderSceneInput = {
  templateId: BuilderTemplateId;
  width: number;
  depth: number;
  nookWidth?: number;
  nookDepth?: number;
};

export type BuilderDimensionField = "width" | "depth" | "nookWidth" | "nookDepth";

export type BuilderDimensionControl = {
  id: BuilderDimensionField;
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  hint?: string;
};

export type BuilderScene = {
  scale: number;
  scaleInfo: ScaleInfo;
  walls: Wall[];
  openings: Opening[];
  floors: Floor[];
};

const DEFAULT_WALL_THICKNESS = 0.16;
const DEFAULT_WALL_HEIGHT = 2.8;

type BuilderWallSegment = {
  key: string;
  start: [number, number];
  end: [number, number];
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function normalizeBuilderSceneInput(input: BuilderSceneInput): BuilderSceneInput {
  const template = builderTemplates.find((entry) => entry.id === input.templateId) ?? builderTemplates[0]!;
  const width = clamp(input.width, 4, 10);
  const depth = clamp(input.depth, 3.6, 8);
  const defaultNookWidth = input.nookWidth ?? template.defaultNookWidth ?? 2.8;
  const defaultNookDepth = input.nookDepth ?? template.defaultNookDepth ?? 2.4;

  switch (input.templateId) {
    case "l-shape":
      return {
        templateId: input.templateId,
        width,
        depth,
        nookWidth: clamp(defaultNookWidth, 1.6, Math.min(4, Math.max(1.6, width - 1.6))),
        nookDepth: clamp(defaultNookDepth, 1.4, Math.min(3.6, Math.max(1.4, depth - 1)))
      };
    case "cut-shape":
      return {
        templateId: input.templateId,
        width,
        depth,
        nookWidth: clamp(defaultNookWidth, 1.2, Math.min(3.6, Math.max(1.2, width - 1.2))),
        nookDepth: clamp(defaultNookDepth, 1, Math.min(3.2, Math.max(1, depth - 0.9)))
      };
    case "t-shape":
      return {
        templateId: input.templateId,
        width,
        depth,
        nookWidth: clamp(defaultNookWidth, 1.8, Math.min(4.8, Math.max(1.8, width - 1.2))),
        nookDepth: clamp(defaultNookDepth, 1.4, Math.min(3.8, Math.max(1.4, depth - 1.1)))
      };
    case "u-shape":
      return {
        templateId: input.templateId,
        width,
        depth,
        nookWidth: clamp(defaultNookWidth, 1.4, Math.min(4.2, Math.max(1.4, width - 1.8))),
        nookDepth: clamp(defaultNookDepth, 0.9, Math.min(2.8, Math.max(0.9, depth - 1.5)))
      };
    case "slanted-shape":
      return {
        templateId: input.templateId,
        width,
        depth,
        nookDepth: clamp(defaultNookDepth, 0.6, Math.min(2.4, Math.min(width, depth) * 0.35))
      };
    case "offset-studio":
      return {
        templateId: input.templateId,
        width,
        depth,
        nookWidth: clamp(defaultNookWidth, 1.4, Math.min(4, Math.max(1.4, width - 2))),
        nookDepth: clamp(defaultNookDepth, 1.2, Math.min(3, Math.max(1.2, depth - 1.4)))
      };
    case "gallery-bay":
      return {
        templateId: input.templateId,
        width,
        depth,
        nookWidth: clamp(defaultNookWidth, 1.8, Math.min(4.4, Math.max(1.8, width - 2))),
        nookDepth: clamp(defaultNookDepth, 1, Math.min(2.2, Math.max(1, depth - 1.8)))
      };
    case "rect-studio":
    default:
      return {
        templateId: input.templateId,
        width,
        depth
      };
  }
}

function segmentsToWalls(segments: BuilderWallSegment[]): Wall[] {
  return segments.map((segment) => {
    return {
      id: `wall-${segment.key}`,
      start: segment.start,
      end: segment.end,
      thickness: DEFAULT_WALL_THICKNESS,
      height: DEFAULT_WALL_HEIGHT,
      type: "exterior"
    } satisfies Wall;
  });
}

function getWallLength(wall: Wall) {
  return Math.hypot(wall.end[0] - wall.start[0], wall.end[1] - wall.start[1]);
}

function getWallCenter(wall: Wall) {
  return [(wall.start[0] + wall.end[0]) / 2, (wall.start[1] + wall.end[1]) / 2] as const;
}

function getWallOrientationScore(wall: Wall) {
  const horizontalSpan = Math.abs(wall.end[0] - wall.start[0]);
  const verticalSpan = Math.abs(wall.end[1] - wall.start[1]);
  return horizontalSpan - verticalSpan;
}

function buildSegments(input: BuilderSceneInput): BuilderWallSegment[] {
  const normalizedInput = normalizeBuilderSceneInput(input);
  const width = normalizedInput.width;
  const depth = normalizedInput.depth;
  const nookWidth = normalizedInput.nookWidth ?? clamp(width * 0.34, 1.2, Math.max(1.2, width - 1.6));
  const nookDepth = normalizedInput.nookDepth ?? clamp(depth * 0.32, 1.0, Math.max(1.0, depth - 1.4));

  switch (normalizedInput.templateId) {
    case "l-shape":
      return [
        { key: "south", start: [0, 0], end: [width, 0] },
        { key: "east", start: [width, 0], end: [width, depth - nookDepth] },
        { key: "inner-south", start: [width, depth - nookDepth], end: [width - nookWidth, depth - nookDepth] },
        { key: "inner-east", start: [width - nookWidth, depth - nookDepth], end: [width - nookWidth, depth] },
        { key: "north", start: [width - nookWidth, depth], end: [0, depth] },
        { key: "west", start: [0, depth], end: [0, 0] }
      ];
    case "cut-shape":
      return [
        { key: "south", start: [0, 0], end: [width, 0] },
        { key: "east", start: [width, 0], end: [width, depth - nookDepth] },
        { key: "cut", start: [width, depth - nookDepth], end: [width - nookWidth, depth] },
        { key: "north", start: [width - nookWidth, depth], end: [0, depth] },
        { key: "west", start: [0, depth], end: [0, 0] }
      ];
    case "t-shape": {
      const stemWidth = normalizedInput.nookWidth ?? clamp(width * 0.4, 1.8, Math.max(1.8, width - 1.2));
      const stemDepth = normalizedInput.nookDepth ?? clamp(depth * 0.38, 1.4, Math.max(1.4, depth - 1.1));
      const halfStem = stemWidth / 2;
      const center = width / 2;
      return [
        { key: "south", start: [0, 0], end: [width, 0] },
        { key: "east-lower", start: [width, 0], end: [width, stemDepth] },
        { key: "shoulder-east", start: [width, stemDepth], end: [center + halfStem, stemDepth] },
        { key: "stem-east", start: [center + halfStem, stemDepth], end: [center + halfStem, depth] },
        { key: "north", start: [center + halfStem, depth], end: [center - halfStem, depth] },
        { key: "stem-west", start: [center - halfStem, depth], end: [center - halfStem, stemDepth] },
        { key: "shoulder-west", start: [center - halfStem, stemDepth], end: [0, stemDepth] },
        { key: "west-lower", start: [0, stemDepth], end: [0, 0] }
      ];
    }
    case "u-shape": {
      const notchWidth = normalizedInput.nookWidth ?? clamp(width * 0.3, 1.4, Math.max(1.4, width - 1.8));
      const notchDepth = normalizedInput.nookDepth ?? clamp(depth * 0.28, 0.9, Math.max(0.9, depth - 1.5));
      const halfNotch = notchWidth / 2;
      const center = width / 2;
      return [
        { key: "south", start: [0, 0], end: [width, 0] },
        { key: "east", start: [width, 0], end: [width, depth] },
        { key: "north-east", start: [width, depth], end: [center + halfNotch, depth] },
        { key: "pocket-east", start: [center + halfNotch, depth], end: [center + halfNotch, depth - notchDepth] },
        { key: "pocket-floor", start: [center + halfNotch, depth - notchDepth], end: [center - halfNotch, depth - notchDepth] },
        { key: "pocket-west", start: [center - halfNotch, depth - notchDepth], end: [center - halfNotch, depth] },
        { key: "north-west", start: [center - halfNotch, depth], end: [0, depth] },
        { key: "west", start: [0, depth], end: [0, 0] }
      ];
    }
    case "slanted-shape": {
      const bevel = normalizedInput.nookDepth ?? clamp(Math.min(width, depth) * 0.18, 0.6, Math.min(width, depth) * 0.35);
      return [
        { key: "south", start: [0, 0], end: [width, 0] },
        { key: "east", start: [width, 0], end: [width, depth - bevel] },
        { key: "north-east-angle", start: [width, depth - bevel], end: [width - bevel, depth] },
        { key: "north", start: [width - bevel, depth], end: [bevel, depth] },
        { key: "north-west-angle", start: [bevel, depth], end: [0, depth - bevel] },
        { key: "west", start: [0, depth - bevel], end: [0, 0] }
      ];
    }
    case "offset-studio": {
      const insetWidth = normalizedInput.nookWidth ?? clamp(width * 0.32, 1.4, Math.max(1.4, width - 2));
      const insetDepth = normalizedInput.nookDepth ?? clamp(depth * 0.3, 1.2, Math.max(1.2, depth - 1.4));
      return [
        { key: "south", start: [0, 0], end: [width, 0] },
        { key: "east-lower", start: [width, 0], end: [width, depth - insetDepth] },
        { key: "inset-bottom", start: [width, depth - insetDepth], end: [width - insetWidth, depth - insetDepth] },
        { key: "inset-vertical", start: [width - insetWidth, depth - insetDepth], end: [width - insetWidth, depth] },
        { key: "north", start: [width - insetWidth, depth], end: [0, depth] },
        { key: "west", start: [0, depth], end: [0, 0] }
      ];
    }
    case "gallery-bay": {
      const bayWidth = normalizedInput.nookWidth ?? clamp(width * 0.34, 1.8, Math.max(1.8, width - 2));
      const bayDepth = normalizedInput.nookDepth ?? clamp(depth * 0.2, 1, Math.max(1, depth - 1.8));
      const bayStart = (width - bayWidth) / 2;
      const bayEnd = bayStart + bayWidth;
      return [
        { key: "south-west", start: [0, 0], end: [bayStart, 0] },
        { key: "bay-left", start: [bayStart, 0], end: [bayStart, -bayDepth] },
        { key: "bay-front", start: [bayStart, -bayDepth], end: [bayEnd, -bayDepth] },
        { key: "bay-right", start: [bayEnd, -bayDepth], end: [bayEnd, 0] },
        { key: "south-east", start: [bayEnd, 0], end: [width, 0] },
        { key: "east", start: [width, 0], end: [width, depth] },
        { key: "north", start: [width, depth], end: [0, depth] },
        { key: "west", start: [0, depth], end: [0, 0] }
      ];
    }
    case "rect-studio":
    default:
      return [
        { key: "south", start: [0, 0], end: [width, 0] },
        { key: "east", start: [width, 0], end: [width, depth] },
        { key: "north", start: [width, depth], end: [0, depth] },
        { key: "west", start: [0, depth], end: [0, 0] }
      ];
  }
}

export function getBuilderDimensionControls(input: BuilderSceneInput): BuilderDimensionControl[] {
  const normalizedInput = normalizeBuilderSceneInput(input);
  const base = [
    {
      id: "width",
      label: normalizedInput.templateId === "t-shape" ? "상단 가로" : "가로",
      min: 4,
      max: 10,
      step: 0.2,
      value: normalizedInput.width
    },
    {
      id: "depth",
      label: normalizedInput.templateId === "u-shape" ? "전체 세로" : "세로",
      min: 3.6,
      max: 8,
      step: 0.2,
      value: normalizedInput.depth
    }
  ] satisfies BuilderDimensionControl[];

  switch (normalizedInput.templateId) {
    case "l-shape":
      return [
        ...base,
        { id: "nookWidth", label: "확장부 가로", min: 1.6, max: 4, step: 0.1, value: normalizedInput.nookWidth ?? 2.8 },
        { id: "nookDepth", label: "확장부 세로", min: 1.4, max: 3.6, step: 0.1, value: normalizedInput.nookDepth ?? 2.4 }
      ];
    case "cut-shape":
      return [
        ...base,
        { id: "nookWidth", label: "컷 가로", min: 1.2, max: 3.6, step: 0.1, value: normalizedInput.nookWidth ?? 2 },
        { id: "nookDepth", label: "컷 깊이", min: 1, max: 3.2, step: 0.1, value: normalizedInput.nookDepth ?? 1.6 }
      ];
    case "t-shape":
      return [
        ...base,
        { id: "nookWidth", label: "기둥 가로", min: 1.8, max: 4.8, step: 0.1, value: normalizedInput.nookWidth ?? 3 },
        { id: "nookDepth", label: "기둥 세로", min: 1.4, max: 3.8, step: 0.1, value: normalizedInput.nookDepth ?? 2.2 }
      ];
    case "u-shape":
      return [
        ...base,
        { id: "nookWidth", label: "포켓 가로", min: 1.4, max: 4.2, step: 0.1, value: normalizedInput.nookWidth ?? 2.4 },
        { id: "nookDepth", label: "포켓 깊이", min: 0.9, max: 2.8, step: 0.1, value: normalizedInput.nookDepth ?? 1.4 }
      ];
    case "slanted-shape":
      return [
        ...base,
        { id: "nookDepth", label: "사선 깊이", min: 0.6, max: 2.4, step: 0.1, value: normalizedInput.nookDepth ?? 1.4 }
      ];
    case "offset-studio":
      return [
        ...base,
        { id: "nookWidth", label: "인셋 가로", min: 1.4, max: 4, step: 0.1, value: normalizedInput.nookWidth ?? 2.2 },
        { id: "nookDepth", label: "인셋 깊이", min: 1.2, max: 3, step: 0.1, value: normalizedInput.nookDepth ?? 1.8 }
      ];
    case "gallery-bay":
      return [
        ...base,
        { id: "nookWidth", label: "베이 가로", min: 1.8, max: 4.4, step: 0.1, value: normalizedInput.nookWidth ?? 2.6 },
        { id: "nookDepth", label: "베이 돌출", min: 1, max: 2.2, step: 0.1, value: normalizedInput.nookDepth ?? 1.6 }
      ];
    case "rect-studio":
    default:
      return base;
  }
}

function buildOpenings(walls: Wall[], templateId: BuilderTemplateId): Opening[] {
  const wallCenters = walls.map((wall) => ({
    wall,
    center: getWallCenter(wall),
    length: getWallLength(wall),
    orientation: getWallOrientationScore(wall)
  }));
  const minCenterY = Math.min(...wallCenters.map((entry) => entry.center[1]));
  const maxCenterY = Math.max(...wallCenters.map((entry) => entry.center[1]));
  const entranceWall =
    [...wallCenters]
      .sort((left, right) => {
        const leftScore = Math.abs(left.center[1] - minCenterY) * 4 - left.orientation - left.length;
        const rightScore = Math.abs(right.center[1] - minCenterY) * 4 - right.orientation - right.length;
        return leftScore - rightScore;
      })
      .map((entry) => entry.wall)[0] ?? walls[0];
  const windowWall =
    [...wallCenters]
      .filter((entry) => entry.wall.id !== entranceWall?.id)
      .sort((left, right) => {
        const leftScore = Math.abs(left.center[1] - maxCenterY) * 4 - left.orientation - left.length;
        const rightScore = Math.abs(right.center[1] - maxCenterY) * 4 - right.orientation - right.length;
        return leftScore - rightScore;
      })
      .map((entry) => entry.wall)[0] ??
    walls[Math.min(2, walls.length - 1)] ??
    walls[walls.length - 1];

  const entranceLength = entranceWall ? getWallLength(entranceWall) : 0;
  const windowLength = windowWall ? getWallLength(windowWall) : 0;

  const doorWidth = 0.92;
  const windowWidth = templateId === "u-shape" || templateId === "t-shape" ? 2.2 : 1.8;

  const openings: Opening[] = [];

  if (entranceWall) {
    openings.push({
      id: "opening-entry",
      wallId: entranceWall.id,
      type: "door",
      offset: clamp(entranceLength * 0.18, 0.48, Math.max(0.48, entranceLength - doorWidth - 0.48)),
      width: doorWidth,
      height: 2.1,
      isEntrance: true
    });
  }

  if (windowWall) {
    openings.push({
      id: "opening-window-main",
      wallId: windowWall.id,
      type: "window",
      offset: clamp(windowLength * 0.22, 0.5, Math.max(0.5, windowLength - windowWidth - 0.5)),
      width: Math.min(windowWidth, Math.max(1.2, windowLength - 1)),
      height: 1.3,
      sillHeight: 0.9
    });
  }

  return openings;
}

export function buildBuilderScene(input: BuilderSceneInput): BuilderScene {
  const segments = buildSegments(input);
  const polygon = segments.map((segment) => segment.start);
  const walls = segmentsToWalls(segments);
  const openings = buildOpenings(walls, input.templateId);

  return {
    scale: 1,
    scaleInfo: {
      value: 1,
      source: "user_measure",
      confidence: 0.94,
      evidence: {
        notes: "Builder-authored dimensions are stored directly in meters."
      }
    },
    walls,
    openings,
    floors: [
      {
        id: "floor-main",
        outline: polygon,
        materialId: null,
        label: "Main Floor"
      }
    ]
  };
}
