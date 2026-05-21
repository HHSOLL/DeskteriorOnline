import type { AttachmentAnchor, PcBuildSpec, PcPartSpec, QuotePart } from "../types";

export const COMPZ_P2364W_PRODUCT_URL =
  "https://www.compuzone.co.kr/product/product_detail.htm?ProductNo=1336041&BigDivNo=1&MediumDivNo=1447&DivNo=4703&SearchType=Y";

export const PC_CASE_OPTIONS = [
  {
    id: "lian-li-o11d-mini-v2-flow-white",
    label: "LIAN-LI O11D MINI V2 FLOW White",
    maker: "LIAN-LI",
    fit: "M-ATX / white airflow showcase",
    finish: "white glass, dual-chamber"
  }
] as const;

export type PcCaseId = (typeof PC_CASE_OPTIONS)[number]["id"];

export const COMPZ_P2364W_PARTS: QuotePart[] = [
  {
    category: "CPU",
    label: "[AMD] 라이젠7 그래니트 9800X3D (8코어/16스레드/4.7GHz/쿨러미포함) [멀티팩]",
    slot: "AM5 CPU socket"
  },
  {
    category: "그래픽카드",
    label: "[ASUS] ROG Astral 지포스 RTX 5080 OC D7 16GB white 인텍앤컴퍼니",
    slot: "PCIe 5.0 x16 slot"
  },
  {
    category: "메인보드",
    label: "[GIGABYTE] B850M AORUS ELITE WIFI6E ICE 피씨디렉트 (AMD B850/M-ATX)",
    slot: "case motherboard tray"
  },
  {
    category: "메모리",
    label: "[에센코어] KLEVV DDR5 PC5-48000 CL30 URBANE V RGB WHITE 서린 [32GB (16GB*2)] (6000)",
    slot: "DDR5 DIMM slots A2/B2"
  },
  {
    category: "SSD",
    label: "[에센코어] KLEVV CRAS C930 M.2 NVMe 2280 [1TB] 히트싱크 PC",
    slot: "M.2 2280 slot"
  },
  {
    category: "케이스",
    label: "[LIAN-LI] O11D MINI V2 FLOW [미들타워] [화이트]",
    slot: "case shell"
  },
  {
    category: "파워",
    label: "[LIAN-LI] EDGE GOLD 1000 ATX3.1 1000W [화이트]",
    slot: "PSU bay"
  },
  {
    category: "케이스쿨러",
    label: "[LIAN-LI] UNI FAN TL Wireless 120 [시스템쿨러/120mm] [1PACK] [화이트]",
    slot: "case fan mount"
  },
  {
    category: "쿨러",
    label: "[LIAN-LI] Hydroshift II LCD-C 360TL [CPU쿨러] [화이트]",
    slot: "CPU cold plate and 360mm radiator mount"
  }
];

const PARTS: PcBuildSpec["parts"] = {
  "lian-li-o11d-mini-v2-flow-white": {
    id: "lian-li-o11d-mini-v2-flow-white",
    category: "case",
    brand: "LIAN-LI",
    label: "O11D MINI V2 FLOW White",
    supportedMotherboardFormFactors: ["ATX", "Micro-ATX", "Mini-ITX"],
    clearances: {
      gpuLengthMm: 400,
      cpuCoolerHeightMm: 160,
      psuLengthMm: 220,
      topRadiatorMm: [240, 280, 360],
      sideRadiatorMm: [240, 280],
      fanMounts120Mm: 7,
      expansionSlots: 7
    },
    sourceRefs: [
      {
        title: "LIAN-LI O11 Dynamic Mini V2 product page",
        url: "https://www.lian-li.com/fr/product/o11-dynamic-mini-v2/",
        note: "Used for case family, layout, radiator and clearance assumptions pending local SKU asset QA."
      }
    ]
  },
  "gigabyte-b850m-aorus-elite-wifi6e-ice": {
    id: "gigabyte-b850m-aorus-elite-wifi6e-ice",
    category: "motherboard",
    brand: "GIGABYTE",
    label: "B850M AORUS ELITE WIFI6E ICE",
    socket: "AM5",
    chipset: "AMD B850",
    motherboardFormFactor: "Micro-ATX",
    memoryType: "DDR5",
    pcieInterface: "PCIe 5.0 x16",
    sourceRefs: [
      {
        title: "GIGABYTE B850M AORUS ELITE WIFI6E ICE specifications",
        url: "https://www.gigabyte.com/us/Motherboard/B850M-AORUS-ELITE-WIFI6E-ICE/sp"
      }
    ]
  },
  "amd-ryzen-7-9800x3d": {
    id: "amd-ryzen-7-9800x3d",
    category: "cpu",
    brand: "AMD",
    label: "Ryzen 7 9800X3D",
    socket: "AM5",
    tdpW: 120,
    sourceRefs: [
      {
        title: "AMD Ryzen 7 9800X3D product page",
        url: "https://www.amd.com/en/products/processors/desktops/ryzen/9000-series/amd-ryzen-7-9800x3d.html"
      }
    ]
  },
  "kleVV-urbane-v-rgb-ddr5-6000-32gb-white": {
    id: "kleVV-urbane-v-rgb-ddr5-6000-32gb-white",
    category: "memory",
    brand: "ESSENCORE KLEVV",
    label: "DDR5 PC5-48000 CL30 URBANE V RGB White 32GB (16GBx2)",
    memoryType: "DDR5",
    memoryModules: 2,
    sourceRefs: [
      {
        title: "KLEVV URBANE V RGB DDR5 product family",
        url: "https://www.klevv.com/ken/products_details/memory/Klevv_Urbane_V_RGB"
      }
    ]
  },
  "kleVV-cras-c930-m2-2280-1tb": {
    id: "kleVV-cras-c930-m2-2280-1tb",
    category: "storage",
    brand: "ESSENCORE KLEVV",
    label: "CRAS C930 M.2 NVMe 2280 1TB",
    m2FormFactor: "2280",
    pcieInterface: "PCIe 4.0 x4",
    sourceRefs: [
      {
        title: "KLEVV CRAS C930 product family",
        url: "https://www.klevv.com/ken/products_details/ssd/Klevv_Cras_C930"
      }
    ]
  },
  "asus-rog-astral-rtx5080-o16g-white": {
    id: "asus-rog-astral-rtx5080-o16g-white",
    category: "gpu",
    brand: "ASUS",
    label: "ROG Astral GeForce RTX 5080 OC Edition 16GB White",
    pcieInterface: "PCIe 5.0 x16",
    recommendedPsuW: 850,
    gpuSlots: 3.8,
    dimensionsMm: {
      length: 357.6,
      height: 149.3,
      width: 76
    },
    sourceRefs: [
      {
        title: "ASUS ROG Astral RTX 5080 White product page",
        url: "https://rog.asus.com/id/graphics-cards/graphics-cards/rog-astral/rog-astral-rtx5080-o16g-white/"
      },
      {
        title: "B&H specifications for physical dimensions",
        url: "https://www.bhphotovideo.com/c/product/1912406-REG/asus_rog_astral_rtx5080_o16g_white_rog_astral_geforce_rtx.html/overview"
      }
    ]
  },
  "lian-li-edge-gold-1000-white": {
    id: "lian-li-edge-gold-1000-white",
    category: "psu",
    brand: "LIAN-LI",
    label: "EDGE GOLD 1000 ATX 3.1 White",
    wattageW: 1000,
    dimensionsMm: {
      length: 182
    },
    sourceRefs: [
      {
        title: "LIAN-LI EDGE GOLD product page",
        url: "https://lian-li.com/product/edge-gold/"
      },
      {
        title: "B&H specifications for physical dimensions",
        url: "https://www.bhphotovideo.com/c/product/1881422-REG/lian_li_eg1000g_bh_edge_gold_1000w_80.html/specs"
      }
    ]
  },
  "lian-li-hydroshift-ii-lcd-c-360tl-white": {
    id: "lian-li-hydroshift-ii-lcd-c-360tl-white",
    category: "cpu-cooler",
    brand: "LIAN-LI",
    label: "HydroShift II LCD-C 360TL White",
    socket: "AM5",
    radiatorSizeMm: 360,
    sourceRefs: [
      {
        title: "LIAN-LI HydroShift II LCD product page",
        url: "https://lian-li.com/product/hydroshift-ii-lcd/"
      }
    ]
  },
  "lian-li-uni-fan-tl-wireless-120-white": {
    id: "lian-li-uni-fan-tl-wireless-120-white",
    category: "case-fan",
    brand: "LIAN-LI",
    label: "UNI FAN TL Wireless 120 White",
    fanSizeMm: 120,
    sourceRefs: [
      {
        title: "LIAN-LI UNI FAN TL Wireless product page",
        url: "https://lian-li.com/product/uni-fan-tl-wireless/"
      }
    ]
  }
};

export const COMPZ_P2364W_ANCHORS: AttachmentAnchor[] = [
  {
    id: "CASE_MOTHERBOARD_TRAY_MATX",
    ownerPartId: "lian-li-o11d-mini-v2-flow-white",
    label: "M-ATX motherboard tray",
    accepts: ["motherboard"],
    position: [0, 0.18, -0.1],
    rotation: [0, 0, 0],
    metadata: { formFactor: "Micro-ATX" }
  },
  {
    id: "CASE_PSU_BAY_ATX",
    ownerPartId: "lian-li-o11d-mini-v2-flow-white",
    label: "ATX PSU bay",
    accepts: ["psu"],
    position: [1.15, 0.28, -0.5],
    rotation: [0, 0, 0],
    metadata: { maxLengthMm: 220 }
  },
  {
    id: "CASE_TOP_RADIATOR_360",
    ownerPartId: "lian-li-o11d-mini-v2-flow-white",
    label: "Top 360mm radiator rail",
    accepts: ["cpu-cooler"],
    position: [0.25, 1.18, -0.98],
    rotation: [0, 0, 0],
    metadata: { radiatorMm: 360 }
  },
  {
    id: "CASE_BOTTOM_FAN_120_1",
    ownerPartId: "lian-li-o11d-mini-v2-flow-white",
    label: "Bottom 120mm case fan mount",
    accepts: ["case-fan"],
    position: [1.28, 0.64, -0.72],
    rotation: [0, 0, 0],
    metadata: { fanMm: 120 }
  },
  {
    id: "CPU_SOCKET_AM5",
    ownerPartId: "gigabyte-b850m-aorus-elite-wifi6e-ice",
    label: "AM5 CPU socket",
    accepts: ["cpu", "cpu-cooler"],
    position: [-0.8, 0.245, -0.05],
    rotation: [0, 0, 0],
    metadata: { socket: "AM5" }
  },
  {
    id: "DIMM_A2_DDR5",
    ownerPartId: "gigabyte-b850m-aorus-elite-wifi6e-ice",
    label: "DDR5 DIMM A2",
    accepts: ["memory"],
    position: [0.4, 0.29, -0.27],
    rotation: [0, 0, 0],
    metadata: { memoryType: "DDR5" }
  },
  {
    id: "DIMM_B2_DDR5",
    ownerPartId: "gigabyte-b850m-aorus-elite-wifi6e-ice",
    label: "DDR5 DIMM B2",
    accepts: ["memory"],
    position: [0.58, 0.29, -0.27],
    rotation: [0, 0, 0],
    metadata: { memoryType: "DDR5" }
  },
  {
    id: "M2_2280_PRIMARY",
    ownerPartId: "gigabyte-b850m-aorus-elite-wifi6e-ice",
    label: "Primary M.2 2280 slot",
    accepts: ["storage"],
    position: [-0.2, 0.31, 0.38],
    rotation: [0, 0, 0],
    metadata: { m2FormFactor: "2280" }
  },
  {
    id: "PCIE_X16_PRIMARY",
    ownerPartId: "gigabyte-b850m-aorus-elite-wifi6e-ice",
    label: "Primary PCIe x16 slot",
    accepts: ["gpu"],
    position: [-0.18, 0.37, 0.54],
    rotation: [0, 0, 0],
    metadata: { pcieInterface: "PCIe 5.0 x16" }
  },
  {
    id: "ATX_24PIN",
    ownerPartId: "gigabyte-b850m-aorus-elite-wifi6e-ice",
    label: "24-pin ATX connector",
    accepts: ["psu"],
    position: [0.98, 0.38, 0.12],
    rotation: [0, 0, 0]
  },
  {
    id: "EPS_8PIN",
    ownerPartId: "gigabyte-b850m-aorus-elite-wifi6e-ice",
    label: "8-pin EPS connector",
    accepts: ["psu"],
    position: [-1.16, 0.36, -0.76],
    rotation: [0, 0, 0]
  },
  {
    id: "GPU_12V_2X6",
    ownerPartId: "asus-rog-astral-rtx5080-o16g-white",
    label: "GPU 12V-2x6 power connector",
    accepts: ["psu"],
    position: [-0.15, 0.74, 0.94],
    rotation: [0, 0, 0]
  }
];

export const COMPZ_P2364W_BUILD: PcBuildSpec = {
  id: "compuzone-p2364w-1336041",
  label: "Compuzone P2364W Deskterior Build",
  productNo: "1336041",
  productUrl: COMPZ_P2364W_PRODUCT_URL,
  primaryCaseId: "lian-li-o11d-mini-v2-flow-white",
  partIds: [
    "lian-li-o11d-mini-v2-flow-white",
    "gigabyte-b850m-aorus-elite-wifi6e-ice",
    "amd-ryzen-7-9800x3d",
    "kleVV-urbane-v-rgb-ddr5-6000-32gb-white",
    "kleVV-cras-c930-m2-2280-1tb",
    "asus-rog-astral-rtx5080-o16g-white",
    "lian-li-edge-gold-1000-white",
    "lian-li-hydroshift-ii-lcd-c-360tl-white",
    "lian-li-uni-fan-tl-wireless-120-white"
  ],
  parts: PARTS,
  quoteParts: COMPZ_P2364W_PARTS,
  anchors: COMPZ_P2364W_ANCHORS
};

export const COMPZ_P2364W_SOURCE_REFS = Object.values(PARTS).flatMap((part: PcPartSpec) => part.sourceRefs);
