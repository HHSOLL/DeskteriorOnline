import { readFile, writeFile } from "node:fs/promises";
import { createAssetCompilerPaths } from "./paths";
import { getCuratedDeskteriorAssets } from "./curated-assets";
import type { CuratedDeskteriorAsset } from "./types";

type ProductDimensionsMm = {
  width: number;
  depth: number;
  height: number;
};

type CatalogEntry = {
  id: string;
  label: string;
  category: string;
  assetId: string;
  scale: [number, number, number];
  description: string;
  thumbnail?: string | null;
  price?: string | null;
  options?: string | null;
  externalUrl?: string | null;
  brand?: string | null;
  dimensionsMm?: ProductDimensionsMm | null;
  finishColor?: string | null;
  finishMaterial?: string | null;
  detailNotes?: string | null;
  scaleLocked?: boolean;
  source?: CuratedDeskteriorAsset["contractMetadata"]["source"];
  license?: CuratedDeskteriorAsset["contractMetadata"]["license"];
  pivot?: CuratedDeskteriorAsset["contractMetadata"]["pivot"];
  collisionProxy?: CuratedDeskteriorAsset["contractMetadata"]["collisionProxy"];
  textureSet?: CuratedDeskteriorAsset["contractMetadata"]["textureSet"];
  lodProfile?: CuratedDeskteriorAsset["contractMetadata"]["lodProfile"];
  supportProfile?: CuratedDeskteriorAsset["supportProfileExpectation"] | null;
};

function normalizeScale(value: unknown): [number, number, number] {
  if (Array.isArray(value) && value.length === 3 && value.every((entry) => typeof entry === "number")) {
    return value as [number, number, number];
  }
  return [1, 1, 1];
}

function mergeEntry(base: CatalogEntry, patch: Partial<CatalogEntry>): CatalogEntry {
  return {
    ...base,
    ...patch,
    scale: normalizeScale(patch.scale ?? base.scale)
  };
}

function requireCuratedContract(
  curatedAssets: ReturnType<typeof getCuratedDeskteriorAssets>,
  manifestId: string
) {
  const contract = curatedAssets.find((asset) => asset.manifestId === manifestId)?.contractMetadata;
  if (!contract) {
    throw new Error(`Missing curated contract metadata for ${manifestId}`);
  }
  return contract;
}

function buildCuratedInserts(curatedAssets: ReturnType<typeof getCuratedDeskteriorAssets>): CatalogEntry[] {
  return [
    {
      id: "p2s_fursys_setina_zdq012j",
      label: "FURSYS SETINA ZDQ012J 모션 사이드 데스크",
      category: "Tables",
      assetId: "/assets/models/p2s_fursys_setina_zdq012j/p2s_fursys_setina_zdq012j.glb",
      scale: [1, 1, 1],
      description:
        "퍼시스 SETINA 시리즈 ZDQ012J를 테스트용으로 재구성한 모션 사이드 데스크입니다. 실제 제품 공개 페이지 치수와 상세 이미지를 기준으로 제작한 prototype SKU입니다.",
      brand: "FURSYS",
      price: "Prototype reference",
      options: "1172x590x587 mm · height range 587~1073 mm · desktop_top only",
      externalUrl: "https://fursys-store.com/product/detail.html?product_no=2913&cate_no=118&display_group=1",
      dimensionsMm: { width: 1172, depth: 590, height: 587 },
      finishColor: "Light laminate / warm grey / graphite",
      finishMaterial: "23T laminated top, steel frame, graphite wiring channel, side laminate panel",
      detailNotes:
        "Includes top slab, front modesty/lift panel, side support panel, telescoping lift plates, collision sensor paddle, sliding power channel, and cable duct. This is not release eligible without FURSYS product-design/CAD licensing.",
      scaleLocked: true,
      ...requireCuratedContract(curatedAssets, "p2s_fursys_setina_zdq012j"),
      supportProfile:
        curatedAssets.find((asset) => asset.manifestId === "p2s_fursys_setina_zdq012j")?.supportProfileExpectation ??
        null
    },
    {
      id: "p2s_desk_oak_140",
      label: "P2S 오크 데스크 1400",
      category: "Tables",
      assetId: "/assets/models/p2s_desk_oak/p2s_desk_oak.glb",
      scale: [1, 1, 1],
      description: "DeskteriorOnline에서 Blender로 직접 제작한 기본 데스크 자산입니다.",
      brand: "DeskteriorOnline Studio",
      price: "₩189,000",
      options: "1330x581x755 mm (Blender measured envelope)",
      externalUrl: "https://www.ikea.com/kr/ko/search/?q=%EC%B1%85%EC%83%81",
      dimensionsMm: { width: 1330, depth: 581, height: 755 },
      finishColor: "Natural oak",
      finishMaterial: "Oak veneer over engineered wood",
      detailNotes:
        "Rectangular desk with a straight apron and slab top. Dimensions reflect Blender-measured envelope for runtime fidelity.",
      scaleLocked: true,
      ...requireCuratedContract(curatedAssets, "p2s_desk_oak_140"),
      supportProfile: curatedAssets.find((asset) => asset.manifestId === "p2s_desk_oak_140")?.supportProfileExpectation ?? null
    },
    {
      id: "p2s_monitor_stand_wood",
      label: "P2S 우드 모니터 스탠드",
      category: "Storage",
      assetId: "/assets/models/p2s_monitor_stand/p2s_monitor_stand.glb",
      scale: [1, 1, 1],
      description: "키보드 수납 공간이 있는 데스크 전용 모니터 스탠드입니다.",
      brand: "DeskteriorOnline Studio",
      price: "₩39,000",
      options: "560x130x71 mm (Blender measured envelope)",
      externalUrl: "https://www.ikea.com/kr/ko/search/?q=%EB%AA%A8%EB%8B%88%ED%84%B0%20%EC%8A%A4%ED%83%A0%EB%93%9C",
      dimensionsMm: { width: 560, depth: 130, height: 71 },
      finishColor: "Warm walnut",
      finishMaterial: "Walnut veneer over plywood",
      detailNotes:
        "Low-profile riser for one ultrawide or dual compact monitors. Dimensions reflect Blender-measured envelope.",
      scaleLocked: true,
      ...requireCuratedContract(curatedAssets, "p2s_monitor_stand_wood"),
      supportProfile:
        curatedAssets.find((asset) => asset.manifestId === "p2s_monitor_stand_wood")?.supportProfileExpectation ?? null
    },
    {
      id: "p2s_desk_lamp_glow",
      label: "P2S 글로우 데스크 램프",
      category: "Lighting",
      assetId: "/assets/models/p2s_desk_lamp_glow/p2s_desk_lamp_glow.glb",
      scale: [1, 1, 1],
      description: "발광 벌브가 포함된 데스크 램프입니다. 뷰어/에디터에서 조명 효과가 적용됩니다.",
      brand: "DeskteriorOnline Studio",
      price: "₩59,000",
      options: "3000K 웜 라이트 · light-emitter",
      externalUrl: "https://www.ikea.com/kr/ko/search/?q=%EB%8D%B0%EC%8A%A4%ED%81%AC%20%EB%9E%A8%ED%94%84",
      dimensionsMm: { width: 445, depth: 227, height: 483 },
      finishColor: "Matte ivory",
      finishMaterial: "Powder-coated steel with frosted acrylic diffuser",
      detailNotes:
        "Adjustable desk lamp with integrated warm emitter. Dimensions reflect Blender-measured envelope for accurate placement.",
      scaleLocked: true,
      ...requireCuratedContract(curatedAssets, "p2s_desk_lamp_glow")
    },
    {
      id: "p2s_ceramic_mug_sand",
      label: "P2S 샌드 세라믹 머그",
      category: "Decor",
      assetId: "/assets/models/p2s_ceramic_mug/p2s_ceramic_mug.glb",
      scale: [1, 1, 1],
      description: "따뜻한 샌드 톤의 손잡이 머그입니다. 데스크와 선반 위 소품으로 바로 사용할 수 있습니다.",
      brand: "DeskteriorOnline Studio",
      price: "₩14,000",
      options: "120x84x92 mm (Blender measured envelope)",
      externalUrl: "https://www.ikea.com/kr/ko/search/?q=%EB%A8%B8%EA%B7%B8",
      dimensionsMm: { width: 120, depth: 84, height: 92 },
      finishColor: "Sand beige",
      finishMaterial: "Glazed ceramic",
      detailNotes:
        "Single handled mug with thick ceramic wall and soft satin glaze. Dimensions reflect Blender-measured envelope for shelf and desk placement.",
      scaleLocked: true,
      ...requireCuratedContract(curatedAssets, "p2s_ceramic_mug_sand")
    },
    {
      id: "p2s_book_stack_warm",
      label: "P2S 웜 북 스택",
      category: "Decor",
      assetId: "/assets/models/p2s_book_stack_warm/p2s_book_stack_warm.glb",
      scale: [1, 1, 1],
      description: "따뜻한 컬러 커버로 구성한 책 3권 스택입니다. 데스크와 선반 스타일링용 기본 소품입니다.",
      brand: "DeskteriorOnline Studio",
      price: "₩28,000",
      options: "186x245x79 mm (Blender measured envelope)",
      externalUrl: "https://www.ikea.com/kr/ko/search/?q=%EC%B1%85",
      dimensionsMm: { width: 186, depth: 245, height: 79 },
      finishColor: "Terracotta / mustard / cocoa",
      finishMaterial: "Laminated paper cover over board",
      detailNotes:
        "Three-book horizontal stack with a warm editorial palette for desk, shelf, and side table styling.",
      scaleLocked: true,
      ...requireCuratedContract(curatedAssets, "p2s_book_stack_warm")
    },
    {
      id: "p2s_desk_tray_oak",
      label: "P2S 오크 데스크 트레이",
      category: "Storage",
      assetId: "/assets/models/p2s_desk_tray_oak/p2s_desk_tray_oak.glb",
      scale: [1, 1, 1],
      description: "소품과 문구류를 정리하는 얕은 오크 트레이입니다.",
      brand: "DeskteriorOnline Studio",
      price: "₩19,000",
      options: "240x160x36 mm (Blender measured envelope)",
      externalUrl: "https://www.ikea.com/kr/ko/search/?q=%ED%8A%B8%EB%A0%88%EC%9D%B4",
      dimensionsMm: { width: 240, depth: 160, height: 36 },
      finishColor: "Light oak",
      finishMaterial: "Oiled oak",
      detailNotes:
        "Low organizer tray with shallow walls sized for stationery, earbuds, or keys. The inner base acts as a furniture support surface.",
      scaleLocked: true,
      ...requireCuratedContract(curatedAssets, "p2s_desk_tray_oak"),
      supportProfile:
        curatedAssets.find((asset) => asset.manifestId === "p2s_desk_tray_oak")?.supportProfileExpectation ?? null
    },
    {
      id: "p2s_compact_speaker",
      label: "P2S 컴팩트 스피커",
      category: "Electronics",
      assetId: "/assets/models/p2s_compact_speaker/p2s_compact_speaker.glb",
      scale: [1, 1, 1],
      description: "책상 위 북쉘프 구성을 위한 컴팩트 스피커입니다.",
      brand: "DeskteriorOnline Studio",
      price: "₩79,000",
      options: "90x141x220 mm (Blender measured envelope)",
      externalUrl: "https://www.ikea.com/kr/ko/search/?q=%EC%8A%A4%ED%94%BC%EC%BB%A4",
      dimensionsMm: { width: 90, depth: 141, height: 220 },
      finishColor: "Graphite black",
      finishMaterial: "Powder-coated metal with woven grille",
      detailNotes:
        "Single compact desktop speaker with two front drivers and rounded cabinet edges for modern desk setups.",
      scaleLocked: true,
      ...requireCuratedContract(curatedAssets, "p2s_compact_speaker")
    },
    {
      id: "p2s_wireless_mouse",
      label: "P2S 무선 마우스",
      category: "Electronics",
      assetId: "/assets/models/p2s_wireless_mouse/p2s_wireless_mouse.glb",
      scale: [1, 1, 1],
      description: "책상 상판 포커스 배치를 검증하기 위한 실측형 무선 마우스 카탈로그 자산입니다.",
      brand: "DeskteriorOnline Studio",
      price: "₩49,000",
      options: "70x115x38 mm · desktop_top focus placement",
      externalUrl: "https://www.ikea.com/kr/ko/search/?q=%EB%AC%B4%EC%84%A0%20%EB%A7%88%EC%9A%B0%EC%8A%A4",
      dimensionsMm: { width: 70, depth: 115, height: 38 },
      finishColor: "Graphite black",
      finishMaterial: "Soft-touch plastic with rubber scroll wheel",
      detailNotes:
        "Compact wireless mouse authored as a shipping runtime package for golden-flow desk-top placement.",
      scaleLocked: true,
      ...requireCuratedContract(curatedAssets, "p2s_wireless_mouse")
    },
    {
      id: "p2s_low_profile_keyboard",
      label: "P2S 로우 프로파일 키보드",
      category: "Electronics",
      assetId: "/assets/models/p2s_low_profile_keyboard/p2s_low_profile_keyboard.glb",
      scale: [1, 1, 1],
      description: "책상 상판 정밀 배치와 저장/복원 플로우를 검증하기 위한 텐키리스 키보드 자산입니다.",
      brand: "DeskteriorOnline Studio",
      price: "₩89,000",
      options: "320x125x18 mm · desktop_top focus placement",
      externalUrl: "https://www.ikea.com/kr/ko/search/?q=%ED%82%A4%EB%B3%B4%EB%93%9C",
      dimensionsMm: { width: 320, depth: 125, height: 18 },
      finishColor: "Warm charcoal",
      finishMaterial: "Matte plastic chassis with low-profile keycaps",
      detailNotes:
        "Low-profile keyboard authored as a shipping runtime package for golden-flow desk-top placement.",
      scaleLocked: true,
      ...requireCuratedContract(curatedAssets, "p2s_low_profile_keyboard")
    },
    {
      id: "p2s_under_desk_tray_mount",
      label: "P2S 언더데스크 케이블 트레이",
      category: "Storage",
      assetId: "/assets/models/p2s_under_desk_tray_mount/p2s_under_desk_tray_mount.glb",
      scale: [1, 1, 1],
      description: "책상 하부에 나사로 고정하는 케이블 트레이입니다. mounted focus placement 검증용 attachment point를 포함합니다.",
      brand: "DeskteriorOnline Studio",
      price: "₩45,000",
      options: "520x220x90 mm · underside_screw mounted",
      externalUrl: "https://www.ikea.com/kr/ko/search/?q=%EC%BC%80%EC%9D%B4%EB%B8%94%20%ED%8A%B8%EB%A0%88%EC%9D%B4",
      dimensionsMm: { width: 520, depth: 220, height: 90 },
      finishColor: "Powder coated black",
      finishMaterial: "Steel basket with screw rails",
      detailNotes:
        "Under-desk cable tray with authored underside_screw attachment point compatible with desk_underside support surfaces.",
      scaleLocked: true,
      ...requireCuratedContract(curatedAssets, "p2s_under_desk_tray_mount")
    },
    {
      id: "p2s_desk_planter_pilea",
      label: "P2S 필레아 데스크 플랜터",
      category: "Plants",
      assetId: "/assets/models/p2s_desk_planter_pilea/p2s_desk_planter_pilea.glb",
      scale: [1, 1, 1],
      description: "작은 라운드 잎을 가진 필레아 화분입니다. 홈오피스와 선반 코너에 맞는 소형 식물 소품입니다.",
      brand: "DeskteriorOnline Studio",
      price: "₩24,000",
      options: "100x100x125 mm (Blender measured envelope)",
      externalUrl: "https://www.ikea.com/kr/ko/search/?q=%ED%99%94%EB%B6%84",
      dimensionsMm: { width: 100, depth: 100, height: 125 },
      finishColor: "Clay pot / fresh green",
      finishMaterial: "Unglazed ceramic pot with plant foliage",
      detailNotes:
        "Compact pilea planter with terracotta pot, soil insert, and layered leaves sized for desk corners and shelf styling.",
      scaleLocked: true,
      ...requireCuratedContract(curatedAssets, "p2s_desk_planter_pilea")
    }
  ];
}

const CURATED_UPDATES: Record<string, Partial<CatalogEntry>> = {
  SchoolDesk_01: {
    category: "Tables",
    brand: "Poly Haven (CC0)",
    options: "오픈소스 3D 자산 · school desk",
    externalUrl: "https://polyhaven.com/",
    source: { kind: "open_source", name: "Poly Haven", path: null, url: "https://polyhaven.com/" },
    license: { spdx: "CC0-1.0", label: "Creative Commons Zero v1.0 Universal", requiresAttribution: false }
  },
  SchoolChair_01: {
    category: "Seating",
    brand: "Poly Haven (CC0)",
    options: "오픈소스 3D 자산 · school chair",
    externalUrl: "https://polyhaven.com/",
    source: { kind: "open_source", name: "Poly Haven", path: null, url: "https://polyhaven.com/" },
    license: { spdx: "CC0-1.0", label: "Creative Commons Zero v1.0 Universal", requiresAttribution: false }
  },
  desk_lamp_arm_01: {
    category: "Lighting",
    brand: "Poly Haven (CC0)",
    options: "오픈소스 3D 자산 · articulated lamp · light-emitter",
    externalUrl: "https://polyhaven.com/a/desk_lamp_arm_01",
    source: {
      kind: "open_source",
      name: "Poly Haven",
      path: null,
      url: "https://polyhaven.com/a/desk_lamp_arm_01"
    },
    license: { spdx: "CC0-1.0", label: "Creative Commons Zero v1.0 Universal", requiresAttribution: false }
  },
  book_encyclopedia_set_01: {
    category: "Decor",
    brand: "Poly Haven (CC0)",
    options: "오픈소스 3D 자산 · books · desk decor",
    externalUrl: "https://polyhaven.com/a/book_encyclopedia_set_01",
    source: {
      kind: "open_source",
      name: "Poly Haven",
      path: null,
      url: "https://polyhaven.com/a/book_encyclopedia_set_01"
    },
    license: { spdx: "CC0-1.0", label: "Creative Commons Zero v1.0 Universal", requiresAttribution: false }
  },
  wooden_bookshelf_worn: {
    category: "Storage",
    brand: "Poly Haven (CC0)",
    options: "오픈소스 3D 자산 · bookshelf",
    externalUrl: "https://polyhaven.com/a/wooden_bookshelf_worn",
    source: {
      kind: "open_source",
      name: "Poly Haven",
      path: null,
      url: "https://polyhaven.com/a/wooden_bookshelf_worn"
    },
    license: { spdx: "CC0-1.0", label: "Creative Commons Zero v1.0 Universal", requiresAttribution: false }
  },
  boombox: {
    category: "Electronics",
    brand: "Poly Haven (CC0)",
    options: "오픈소스 3D 자산 · speaker",
    externalUrl: "https://polyhaven.com/a/boombox",
    source: { kind: "open_source", name: "Poly Haven", path: null, url: "https://polyhaven.com/a/boombox" },
    license: { spdx: "CC0-1.0", label: "Creative Commons Zero v1.0 Universal", requiresAttribution: false }
  },
  gamepad: {
    category: "Electronics",
    brand: "Poly Haven (CC0)",
    options: "오픈소스 3D 자산 · gamepad",
    externalUrl: "https://polyhaven.com/a/gamepad",
    source: { kind: "open_source", name: "Poly Haven", path: null, url: "https://polyhaven.com/a/gamepad" },
    license: { spdx: "CC0-1.0", label: "Creative Commons Zero v1.0 Universal", requiresAttribution: false }
  },
  gaming_console: {
    category: "Electronics",
    brand: "Poly Haven (CC0)",
    options: "오픈소스 3D 자산 · console",
    externalUrl: "https://polyhaven.com/a/gaming_console",
    source: {
      kind: "open_source",
      name: "Poly Haven",
      path: null,
      url: "https://polyhaven.com/a/gaming_console"
    },
    license: { spdx: "CC0-1.0", label: "Creative Commons Zero v1.0 Universal", requiresAttribution: false }
  }
};

export async function syncCuratedCatalog() {
  const paths = createAssetCompilerPaths();
  const curatedAssets = getCuratedDeskteriorAssets(paths);
  const raw = await readFile(paths.manifestPath, "utf8");
  const parsed = JSON.parse(raw) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error("catalog manifest 포맷이 배열이 아닙니다.");
  }

  const items = parsed as CatalogEntry[];
  const byId = new Map<string, CatalogEntry>();
  items.forEach((item) => {
    byId.set(item.id, {
      ...item,
      scale: normalizeScale(item.scale)
    });
  });

  Object.entries(CURATED_UPDATES).forEach(([id, patch]) => {
    const current = byId.get(id);
    if (!current) return;
    byId.set(id, mergeEntry(current, patch));
  });

  buildCuratedInserts(curatedAssets).forEach((entry) => {
    const current = byId.get(entry.id);
    byId.set(entry.id, current ? mergeEntry(current, entry) : entry);
  });

  const merged = Array.from(byId.values());
  await writeFile(paths.manifestPath, `${JSON.stringify(merged, null, 2)}\n`, "utf8");

  return {
    manifestPath: paths.manifestPath,
    totalItems: merged.length,
    deskteriorIds: merged
      .filter(
        (item) =>
          item.id.startsWith("p2s_") ||
          item.id === "SchoolDesk_01" ||
          item.id === "SchoolChair_01" ||
          item.id === "desk_lamp_arm_01"
      )
      .map((item) => item.id)
  };
}

export async function runSyncCuratedCatalogCli() {
  const result = await syncCuratedCatalog();
  console.log(`manifest updated: ${result.manifestPath}`);
  console.log(`total items: ${result.totalItems}`);
  console.log(`deskterior ids: ${result.deskteriorIds.join(", ")}`);
}
