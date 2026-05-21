export type Vec3Tuple = readonly [number, number, number];

export type PcPartCategory =
  | "case"
  | "motherboard"
  | "cpu"
  | "memory"
  | "storage"
  | "gpu"
  | "psu"
  | "cpu-cooler"
  | "case-fan";

export type PcPartId =
  | "lian-li-o11d-mini-v2-flow-white"
  | "gigabyte-b850m-aorus-elite-wifi6e-ice"
  | "amd-ryzen-7-9800x3d"
  | "kleVV-urbane-v-rgb-ddr5-6000-32gb-white"
  | "kleVV-cras-c930-m2-2280-1tb"
  | "asus-rog-astral-rtx5080-o16g-white"
  | "lian-li-edge-gold-1000-white"
  | "lian-li-hydroshift-ii-lcd-c-360tl-white"
  | "lian-li-uni-fan-tl-wireless-120-white";

export type PcPartReference = {
  title: string;
  url: string;
  note?: string;
};

export type PcPartSpec = {
  id: PcPartId;
  category: PcPartCategory;
  brand: string;
  label: string;
  sourceRefs: PcPartReference[];
  socket?: "AM5";
  chipset?: "AMD B850";
  motherboardFormFactor?: "ATX" | "Micro-ATX" | "Mini-ITX";
  supportedMotherboardFormFactors?: Array<"ATX" | "Micro-ATX" | "Mini-ITX">;
  memoryType?: "DDR5";
  memoryModules?: number;
  m2FormFactor?: "2280";
  pcieInterface?: "PCIe 5.0 x16" | "PCIe 4.0 x4" | "PCIe 5.0 x4";
  wattageW?: number;
  recommendedPsuW?: number;
  tdpW?: number;
  gpuSlots?: number;
  radiatorSizeMm?: 120 | 240 | 280 | 360;
  fanSizeMm?: 120;
  dimensionsMm?: {
    length?: number;
    width?: number;
    height?: number;
    depth?: number;
  };
  clearances?: {
    gpuLengthMm?: number;
    cpuCoolerHeightMm?: number;
    psuLengthMm?: number;
    topRadiatorMm?: number[];
    sideRadiatorMm?: number[];
    fanMounts120Mm?: number;
    expansionSlots?: number;
  };
};

export type QuotePart = {
  category: string;
  label: string;
  slot: string;
};

export type AttachmentAnchorId =
  | "CASE_MOTHERBOARD_TRAY_MATX"
  | "CASE_PSU_BAY_ATX"
  | "CASE_TOP_RADIATOR_360"
  | "CASE_BOTTOM_FAN_120_1"
  | "CPU_SOCKET_AM5"
  | "DIMM_A2_DDR5"
  | "DIMM_B2_DDR5"
  | "M2_2280_PRIMARY"
  | "PCIE_X16_PRIMARY"
  | "ATX_24PIN"
  | "EPS_8PIN"
  | "GPU_12V_2X6";

export type AttachmentAnchor = {
  id: AttachmentAnchorId;
  ownerPartId: PcPartId;
  label: string;
  accepts: PcPartCategory[];
  position: Vec3Tuple;
  rotation: Vec3Tuple;
  requiredBeforeStep?: string;
  metadata?: Record<string, string | number | boolean>;
};

export type PcBuildSpec = {
  id: string;
  label: string;
  productNo: "1336041";
  productUrl: string;
  primaryCaseId: PcPartId;
  partIds: PcPartId[];
  parts: Record<PcPartId, PcPartSpec>;
  quoteParts: QuotePart[];
  anchors: AttachmentAnchor[];
};

export type BuildCheckSeverity = "pass" | "warning" | "fail";

export type BuildCheck = {
  id: string;
  label: string;
  severity: BuildCheckSeverity;
  detail: string;
  sourcePartIds: PcPartId[];
};

export type BuildEvaluation = {
  status: BuildCheckSeverity;
  passCount: number;
  warningCount: number;
  failCount: number;
  checks: BuildCheck[];
};
