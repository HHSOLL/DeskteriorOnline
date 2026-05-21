"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, OrbitControls, PerspectiveCamera, RoundedBox, useGLTF } from "@react-three/drei";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { CheckCircle2, Cpu, Save, Volume2 } from "lucide-react";
import { Suspense, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import * as THREE from "three";
import {
  COMPZ_P2364W_BUILD,
  evaluateBuildCompatibility,
  evaluatePhysicalFit,
  getAssemblyStateEvidence,
  getAttachmentSummary,
  mergeBuildEvaluations
} from "../../../../features/pc-system";
import { configureRuntimeAssetLoaders } from "../../../../lib/loaders/AssetLoader";
import { RuntimeTextureLoader } from "../../../../lib/loaders/RuntimeTextureLoader";
import {
  MESHY_COMMUNITY_ASSETS,
  MESHY_COMMUNITY_SCENE_PLACEMENTS,
  getMeshyCommunityAssetBySlug,
  getMeshyCommunityRuntimeUrl
} from "../../../../lib/qa/meshy-community-assets";

const ASSEMBLY_STEPS = [
  { id: "workspace-prep", label: "정전기 방지/작업 공간 준비", sound: "soft-tool-set" },
  { id: "motherboard-on-box", label: "메인보드를 박스 위에 올리기", sound: "soft-part-place" },
  { id: "socket-lever-opened", label: "AM5 소켓 레버 열기", sound: "metal-lever-click" },
  { id: "cpu-aligned", label: "CPU 삼각 마커 정렬", sound: "cpu-seat-tick" },
  { id: "cpu-seated", label: "CPU 소켓에 안착", sound: "cpu-seat-tick" },
  { id: "cpu-retention-locked", label: "CPU 고정 레버 잠금", sound: "metal-latch-snap" },
  { id: "m2-heatsink-removed", label: "M.2 방열판 분리", sound: "screw-loosen" },
  { id: "ssd-inserted", label: "M.2 NVMe SSD 삽입", sound: "m2-snap" },
  { id: "m2-screw-tightened", label: "M.2 고정 나사 조임", sound: "screw-tighten" },
  { id: "m2-heatsink-reinstalled", label: "M.2 방열판 재장착", sound: "screw-tighten" },
  { id: "ram-latches-opened", label: "DDR5 슬롯 래치 열기", sound: "plastic-latch-click" },
  { id: "ram-a2-inserted", label: "RAM A2 슬롯 체결", sound: "ram-latch-click" },
  { id: "ram-b2-inserted", label: "RAM B2 슬롯 체결", sound: "ram-latch-click" },
  { id: "case-side-panels-removed", label: "케이스 양쪽 패널 분리", sound: "glass-panel-slide" },
  { id: "case-standoffs-checked", label: "M-ATX 스탠드오프 위치 확인", sound: "standoff-tap" },
  { id: "io-shield-aligned", label: "후면 I/O 포트 정렬", sound: "soft-part-place" },
  { id: "motherboard-lowered", label: "메인보드 케이스에 안착", sound: "soft-part-place" },
  { id: "motherboard-screws-tightened", label: "메인보드 나사 체결", sound: "screw-tighten" },
  { id: "psu-bracket-mounted", label: "PSU 브래킷 결합", sound: "psu-rail-thunk" },
  { id: "psu-mounted", label: "파워서플라이 장착", sound: "psu-rail-thunk" },
  { id: "atx-24pin-connected", label: "24핀 ATX 전원 연결", sound: "cable-plug-click" },
  { id: "eps-8pin-connected", label: "CPU EPS 8핀 전원 연결", sound: "cable-plug-click" },
  { id: "cooler-brackets-mounted", label: "수랭 쿨러 브래킷 장착", sound: "screw-tighten" },
  { id: "thermal-paste-applied", label: "CPU 써멀 도포", sound: "thermal-paste-press" },
  { id: "pump-block-mounted", label: "펌프/콜드플레이트 고정", sound: "cooler-pump-seat" },
  { id: "radiator-mounted", label: "360mm 라디에이터 장착", sound: "screw-tighten" },
  { id: "radiator-fans-connected", label: "라디에이터 팬/PWM 연결", sound: "fan-magnetic-snap" },
  { id: "case-fans-mounted", label: "케이스 팬 장착", sound: "fan-magnetic-snap" },
  { id: "front-panel-connected", label: "전원/리셋/LED 헤더 연결", sound: "tiny-header-click" },
  { id: "usb-audio-connected", label: "USB/오디오 헤더 연결", sound: "tiny-header-click" },
  { id: "gpu-slot-covers-removed", label: "PCIe 슬롯 커버 분리", sound: "screw-loosen" },
  { id: "gpu-inserted", label: "그래픽카드 PCIe 체결", sound: "gpu-latch-click" },
  { id: "gpu-power-connected", label: "GPU 보조전원 연결", sound: "cable-plug-click" },
  { id: "cable-management-tied", label: "케이블 정리/벨크로 고정", sound: "cable-tie-pull" },
  { id: "side-panels-closed", label: "강화유리/측면 패널 닫기", sound: "panel-close-click" },
  { id: "external-cables-connected", label: "모니터/키보드/전원 연결", sound: "cable-plug-click" },
  { id: "first-boot-powered", label: "첫 전원 인가", sound: "power-boot-chime" },
  { id: "bios-post-confirmed", label: "BIOS POST 확인", sound: "bios-post-beep" }
] as const;

const TOTAL_ASSEMBLY_STEPS = ASSEMBLY_STEPS.length;
const COMPZ_P2364W_PRODUCT_URL =
  "https://www.compuzone.co.kr/product/product_detail.htm?ProductNo=1336041&BigDivNo=1&MediumDivNo=1447&DivNo=4703&SearchType=Y";

const PC_CASE_OPTIONS = [
  {
    id: "lian-li-o11d-mini-v2-flow-white",
    label: "LIAN-LI O11D MINI V2 FLOW White",
    maker: "LIAN-LI",
    fit: "M-ATX / white airflow showcase",
    finish: "white glass, dual-chamber"
  }
] as const;

const ROOM_SETUP_STEPS = [
  { id: "pc-placed-on-desk", label: "완성 PC를 책상 위에 배치", sound: "desk-placement-thud" },
  { id: "monitor-mounted", label: "모니터와 암을 책상에 고정", sound: "monitor-stand-click" },
  { id: "keyboard-mouse-placed", label: "키보드와 마우스 배치", sound: "desk-soft-tap" },
  { id: "microphone-arm-clamped", label: "마이크 암 클램프 조임", sound: "arm-clamp-tighten" },
  { id: "lamp-positioned", label: "데스크 램프 위치 조정", sound: "lamp-switch-click" },
  { id: "plant-and-books-styled", label: "식물과 책으로 선반 꾸미기", sound: "decor-soft-place" },
  { id: "collectibles-stacked", label: "컬러 오브젝트 스택 배치", sound: "toy-stack-tap" },
  { id: "wall-leds-enabled", label: "벽면 LED 컬러 조명 켜기", sound: "led-power-chime" },
  { id: "media-console-styled", label: "TV 콘솔과 소품 정리", sound: "drawer-soft-close" },
  { id: "sofa-zone-styled", label: "소파와 러그 영역 완성", sound: "fabric-cushion-thump" },
  { id: "room-lighting-set", label: "따뜻한/차가운 룸 조명 밸런스", sound: "room-light-swell" }
] as const;

const TOTAL_ROOM_SETUP_STEPS = ROOM_SETUP_STEPS.length;
const MESHY_PC_BUILD_KIT_URL =
  "/assets/models/compuzone_p2364w_pc_build_kit/compuzone_p2364w_pc_build_kit.proxy.glb";
const MESHY_SHOWCASE_CASE_URL =
  "/assets/models/p2s_video_so_ong_hyte_y70_snow_white/p2s_video_so_ong_hyte_y70_snow_white.proxy.glb";
const MESHY_ROOM_DECOR_URL = "/assets/models/p2s_meshy_pastel_mascot_stack/p2s_meshy_pastel_mascot_stack.proxy.glb";
const MESHY_DESK_MONITOR_URL =
  "/assets/models/p2s_video_so_ong_tfg40q14wp_monitor/p2s_video_so_ong_tfg40q14wp_monitor.proxy.glb";
const MESHY_STUDIO_SPEAKER_URL =
  "/assets/models/p2s_video_so_ong_reproducer_epic5/p2s_video_so_ong_reproducer_epic5.proxy.glb";
const MESHY_IVY_PLANTER_URL = "/assets/models/p2s_video_so_ong_ivy_planter/p2s_video_so_ong_ivy_planter.proxy.glb";
const MESHY_KEYBOARD_URL = "/assets/models/p2s_low_profile_keyboard/p2s_low_profile_keyboard.proxy.glb";
const MESHY_MOUSE_URL = "/assets/models/p2s_wireless_mouse/p2s_wireless_mouse.proxy.glb";
const MESHY_DESK_LAMP_URL = "/assets/models/p2s_desk_lamp_glow/p2s_desk_lamp_glow.proxy.glb";
const MESHY_CERAMIC_MUG_URL = "/assets/models/p2s_ceramic_mug/p2s_ceramic_mug.proxy.glb";
const MESHY_BOOK_STACK_URL = "/assets/models/p2s_book_stack_warm/p2s_book_stack_warm.proxy.glb";
const MESHY_CABLE_REEL_URL =
  "/assets/models/p2s_video_so_ong_charging_reel_cable/p2s_video_so_ong_charging_reel_cable.proxy.glb";
const MESHY_PIXEL_DISPLAY_URL =
  "/assets/models/p2s_video_so_ong_divoom_times_gate/p2s_video_so_ong_divoom_times_gate.proxy.glb";
const DETAIL_COFFEE_TABLE_URL = "/assets/models/modern_coffee_table_02/modern_coffee_table_02_1k.gltf";
const DETAIL_SHELVES_URL = "/assets/models/steel_frame_shelves_03/steel_frame_shelves_03_1k.gltf";
const DETAIL_SOFA_URL = "/assets/models/sofa_02/sofa_02_1k.gltf";
const PREMIUM_DARK_SOFA_URL = "/assets/models/p2s_premium_dark_sofa/p2s_premium_dark_sofa.glb";
const PREMIUM_WORKSTATION_HERO_URL =
  "/assets/models/p2s_premium_workstation_hero/p2s_premium_workstation_hero.glb";
const ENABLE_PREMIUM_WORKSTATION_HERO = false;
const COMMERCIAL_DESK_HERO_REVISION = "20260520-commercial-desk-no-drawer-uv-v3";
const COMMERCIAL_DESK_HERO_URL =
  `/assets/models/p2s_commercial_desk_hero_v1/p2s_commercial_desk_hero_v1.glb?v=${COMMERCIAL_DESK_HERO_REVISION}`;
const COMMERCIAL_TASK_CHAIR_HERO_REVISION = "20260521-commercial-task-chair-meshopt-v1";
const COMMERCIAL_TASK_CHAIR_HERO_URL =
  `/assets/models/p2s_commercial_task_chair_hero_v1/p2s_commercial_task_chair_hero_v1.glb?v=${COMMERCIAL_TASK_CHAIR_HERO_REVISION}`;
const COMMERCIAL_DESK_ACCESSORY_KIT_REVISION = "20260521-commercial-desk-accessory-kit-v2-real-scale-meshopt";
const COMMERCIAL_DESK_ACCESSORY_KIT_URL =
  `/assets/models/p2s_commercial_desk_accessory_kit_v2/p2s_commercial_desk_accessory_kit_v2.glb?v=${COMMERCIAL_DESK_ACCESSORY_KIT_REVISION}`;
const MECHANICAL_KEYBOARD_SWITCH_LAB_REVISION = "20260521-abko-ar108g-sage-green-keyboard-v1-meshopt";
const MECHANICAL_KEYBOARD_SWITCH_LAB_URL =
  `/assets/models/p2s_abko_ar108g_sage_green_keyboard_v1/p2s_abko_ar108g_sage_green_keyboard_v1.glb?v=${MECHANICAL_KEYBOARD_SWITCH_LAB_REVISION}`;
const DETAIL_MEDIA_CABINET_URL = "/assets/models/modern_wooden_cabinet/modern_wooden_cabinet_1k.gltf";
const DETAIL_CEILING_LAMP_URL = "/assets/models/modern_ceiling_lamp_01/modern_ceiling_lamp_01_1k.gltf";
const DETAIL_WALL_SCONCE_URL = "/assets/models/industrial_wall_sconce/industrial_wall_sconce_1k.gltf";
const DETAIL_DESK_URL = "/assets/models/p2s_fursys_setina_zdq012j/p2s_fursys_setina_zdq012j.proxy.glb";
const DETAIL_DESK_PLANTER_URL = "/assets/models/p2s_desk_planter_pilea/p2s_desk_planter_pilea.proxy.glb";
const DETAIL_DESK_TRAY_URL = "/assets/models/p2s_desk_tray_oak/p2s_desk_tray_oak.proxy.glb";
const DETAIL_UNDER_DESK_TRAY_URL =
  "/assets/models/p2s_under_desk_tray_mount/p2s_under_desk_tray_mount.proxy.glb";
const KENNEY_QA_ASSET_BASE_URL = "/api/qa-assets/open-license/kenney-furniture-kit";
const KENNEY_BOOKCASE_URL = `${KENNEY_QA_ASSET_BASE_URL}/bookcaseOpen.glb`;
const KENNEY_WALL_LAMP_URL = `${KENNEY_QA_ASSET_BASE_URL}/lampWall.glb`;
const KENNEY_SOFA_URL = `${KENNEY_QA_ASSET_BASE_URL}/loungeSofaLong.glb`;
const KENNEY_POTTED_PLANT_URL = `${KENNEY_QA_ASSET_BASE_URL}/pottedPlant.glb`;
const KENNEY_RUG_URL = `${KENNEY_QA_ASSET_BASE_URL}/rugRounded.glb`;
const KENNEY_COFFEE_TABLE_URL = `${KENNEY_QA_ASSET_BASE_URL}/tableCoffeeGlass.glb`;
const BLENDER_ROOM_DETAIL_KIT_URL =
  "/assets/models/p2s_bruno_room_detail_kit/p2s_bruno_room_detail_kit.glb";
const BLENDER_ROOM_SURFACE_KIT_URL =
  "/assets/models/p2s_bruno_room_surface_kit/p2s_bruno_room_surface_kit.glb";
const BRUNO_FURNITURE_HERO_REVISION = "20260520-furniture-art-pass-v3";
const BLENDER_FURNITURE_HERO_KIT_URL =
  `/assets/models/p2s_bruno_furniture_hero_kit_v3/p2s_bruno_furniture_hero_kit_v3.glb?v=${BRUNO_FURNITURE_HERO_REVISION}`;
const BRUNO_ROOM_SURFACE_TEXTURE_PACKAGE_URL =
  "/assets/models/p2s_bruno_room_surface_kit/texture-package-2026-05-19.json";
const BRUNO_FURNITURE_HERO_TEXTURE_PACKAGE_URL =
  `/assets/models/p2s_bruno_furniture_hero_kit_v3/texture-package-2026-05-20.json?v=${BRUNO_FURNITURE_HERO_REVISION}`;

const BRUNO_ROOM_SURFACE_ORM_ROLES = ["floorWoodOrm", "plasterWallOrm", "trimOrm"] as const;
const BRUNO_FURNITURE_ORM_ROLES = [
  "furnitureWoodOrm",
  "furnitureFabricOrm",
  "furnitureLacquerOrm",
  "furnitureSpeakerOrm"
] as const;

type CompletedAssemblyStep = (typeof ASSEMBLY_STEPS)[number]["id"];
type CompletedRoomSetupStep = (typeof ROOM_SETUP_STEPS)[number]["id"];
type FlowStep = "not-started" | CompletedAssemblyStep | CompletedRoomSetupStep;
type AssemblySound = (typeof ASSEMBLY_STEPS)[number]["sound"];
type CaseSelectionSound = "case-choice-confirm";
type RoomSetupSound = (typeof ROOM_SETUP_STEPS)[number]["sound"];
type ExperienceSound = AssemblySound | CaseSelectionSound | RoomSetupSound;
type PcCaseId = (typeof PC_CASE_OPTIONS)[number]["id"];
const KEYBOARD_SWITCH_PROFILES = {
  "linear-red": {
    label: "적축 Linear",
    forceCN: 45,
    preTravelMm: 2.0,
    totalTravelMm: 4.0,
    character: "smooth"
  },
  "clicky-blue": {
    label: "ABKO AR108G 청축",
    forceCN: 50,
    preTravelMm: 2.2,
    totalTravelMm: 4.0,
    character: "clicky"
  },
  "tactile-brown": {
    label: "갈축 Tactile",
    forceCN: 55,
    preTravelMm: 2.0,
    totalTravelMm: 4.0,
    character: "tactile"
  }
} as const;
type KeyboardSwitchKind = keyof typeof KEYBOARD_SWITCH_PROFILES;
type KeyboardSwitchPressEvent = `keyboard-switch-${KeyboardSwitchKind}-press`;
const KEYBOARD_SWITCH_OPTIONS = Object.keys(KEYBOARD_SWITCH_PROFILES) as KeyboardSwitchKind[];
const MECHANICAL_KEYBOARD_PRESS_TARGETS = [
  { id: "abko-ar108g-key-esc", label: "Esc", position: [-0.5, 0.2462, 0.204], size: [0.0141, 0.02, 0.0141] },
  { id: "abko-ar108g-key-arow_a", label: "A", position: [-0.4664, 0.2462, 0.1434], size: [0.0141, 0.02, 0.0141] },
  { id: "abko-ar108g-key-space", label: "Space", position: [-0.3776, 0.2462, 0.103], size: [0.0968, 0.02, 0.0141] },
  { id: "abko-ar108g-key-enter", label: "Enter", position: [-0.2432, 0.2462, 0.1434], size: [0.0338, 0.02, 0.0141] },
  { id: "abko-ar108g-key-numenter", label: "Num Enter", position: [-0.0574, 0.2462, 0.1232], size: [0.0141, 0.02, 0.0307] }
] as const;
type BrunoRoomSurfaceOrmRole = (typeof BRUNO_ROOM_SURFACE_ORM_ROLES)[number];
type BrunoFurnitureOrmRole = (typeof BRUNO_FURNITURE_ORM_ROLES)[number];

type BrunoRoomSurfaceTexturePackage = {
  maps?: Array<{
    role?: string;
    publicPath?: string | null;
    ktx2Path?: string | null;
  }>;
};

type BrunoFurnitureTexturePackage = BrunoRoomSurfaceTexturePackage;
type BrunoRoomSurfaceOrmTextures = Partial<Record<BrunoRoomSurfaceOrmRole, THREE.Texture>>;
type BrunoFurnitureOrmTextures = Partial<Record<BrunoFurnitureOrmRole, THREE.Texture>>;
type BrunoRoomSurfaceOrmTextureState = {
  textures: BrunoRoomSurfaceOrmTextures;
  textureUrls: Partial<Record<BrunoRoomSurfaceOrmRole, string>>;
};
type BrunoFurnitureOrmTextureState = {
  textures: BrunoFurnitureOrmTextures;
  textureUrls: Partial<Record<BrunoFurnitureOrmRole, string>>;
};

type BrunoSurfaceMaterialRuntimeQa = {
  texturePackageUrl: string;
  ktx2PackageConsumed: boolean;
  loadedRoles: BrunoRoomSurfaceOrmRole[];
  requestedTextureUrls: Partial<Record<BrunoRoomSurfaceOrmRole, string>>;
  enhancedMaterialNames: string[];
  aoUv2ReadyMeshCount: number;
  uv2PatchedMeshCount: number;
};

type BrunoFurnitureMaterialRuntimeQa = {
  texturePackageUrl: string;
  ktx2PackageConsumed: boolean;
  loadedRoles: BrunoFurnitureOrmRole[];
  requestedTextureUrls: Partial<Record<BrunoFurnitureOrmRole, string>>;
  enhancedMaterialNames: string[];
  aoUv2ReadyMeshCount: number;
  uv2PatchedMeshCount: number;
};

type QuotePart = {
  category: string;
  label: string;
  slot: string;
};

const COMPZ_P2364W_PARTS: QuotePart[] = [
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

type PcAssemblyPayload = {
  version: 1;
  savedAt: string;
  mode: "pc-assembly-workbench";
  currentStep: FlowStep;
  selectedCase: {
    id: PcCaseId;
    label: string;
    maker: string;
    fit: string;
    finish: string;
  };
  completedSteps: CompletedAssemblyStep[];
  totalSteps: number;
  components: {
    caseOpen: boolean;
    psuMounted: boolean;
    motherboardMounted: boolean;
    cpuSeated: boolean;
    thermalPasteApplied: boolean;
    coolerMounted: boolean;
    ramInserted: boolean;
    ssdInstalled: boolean;
    gpuInstalled: boolean;
    fanInstalled: boolean;
    cablesManaged: boolean;
    firstBootPassed: boolean;
  };
  roomSetup: {
    currentStep: "not-started" | CompletedRoomSetupStep;
    completedSteps: CompletedRoomSetupStep[];
    totalSteps: number;
    pcPlacedOnDesk: boolean;
    deskStyled: boolean;
    roomStyled: boolean;
    brunoSimonMood: boolean;
  };
  interactions: {
    thermalPasteCoverage: number;
    audioEvents: ExperienceSound[];
    keyboardSwitchProfile: KeyboardSwitchKind;
    keyboardSwitchEvents: KeyboardSwitchPressEvent[];
    keyboardLastPressedTargetId: string | null;
  };
  pcSystem: {
    compatibilityStatus: "pass" | "warning" | "fail";
    compatibilityChecks: number;
    physicalFitStatus: "pass" | "warning" | "fail";
    physicalFitChecks: number;
    attachmentAnchors: number;
    occupiedAttachmentAnchors: number;
    stateMachineComplete: boolean;
    uniqueCompletedAnchorCount: number;
  };
  quote: {
    productNo: "1336041";
    productUrl: string;
    parts: QuotePart[];
  };
};

type PcAssemblyQaRegistry = {
  currentStep: FlowStep;
  selectedCaseId: PcCaseId | null;
  caseSelectionComplete: boolean;
  completedSteps: CompletedAssemblyStep[];
  stepCount: number;
  totalSteps: number;
  completedRoomSteps: CompletedRoomSetupStep[];
  roomCurrentStep: "not-started" | CompletedRoomSetupStep;
  roomStepCount: number;
  totalRoomSteps: number;
  caseOpen: boolean;
  psuMounted: boolean;
  motherboardMounted: boolean;
  cpuSeated: boolean;
  thermalPasteApplied: boolean;
  coolerMounted: boolean;
  ramInserted: boolean;
  ssdInstalled: boolean;
  gpuInstalled: boolean;
  fanInstalled: boolean;
  cablesManaged: boolean;
  firstBootPassed: boolean;
  pcPlacedOnDesk: boolean;
  deskStyled: boolean;
  roomStyled: boolean;
  brunoSimonMood: boolean;
  thermalPasteCoverage: number;
  audioEvents: ExperienceSound[];
  keyboardSwitchProfile: KeyboardSwitchKind;
  keyboardSwitchEvents: KeyboardSwitchPressEvent[];
  keyboardLastPressedTargetId: string | null;
  savedPayload: PcAssemblyPayload | null;
  pcSystem: PcAssemblyPayload["pcSystem"];
  flowComplete: boolean;
  checklistComplete: boolean;
};

declare global {
  interface Window {
    __DESKTERIORONLINE_PC_ASSEMBLY_QA__?: PcAssemblyQaRegistry;
    __DESKTERIORONLINE_BRUNO_SURFACE_QA__?: BrunoSurfaceMaterialRuntimeQa;
    __DESKTERIORONLINE_BRUNO_FURNITURE_QA__?: BrunoFurnitureMaterialRuntimeQa;
    __DESKTERIORONLINE_DISABLE_PC_AUDIO__?: boolean;
  }
}

const STORAGE_KEY = "deskterioronline.pcAssembly.qaPayload";

function getCurrentStep(completedSteps: CompletedAssemblyStep[], completedRoomSteps: CompletedRoomSetupStep[]): FlowStep {
  if (completedRoomSteps.length > 0) return completedRoomSteps[completedRoomSteps.length - 1] ?? "not-started";
  if (completedSteps.length === 0) return "not-started";
  return completedSteps[completedSteps.length - 1] ?? "not-started";
}

function getRoomCurrentStep(completedRoomSteps: CompletedRoomSetupStep[]): "not-started" | CompletedRoomSetupStep {
  if (completedRoomSteps.length === 0) return "not-started";
  return completedRoomSteps[completedRoomSteps.length - 1] ?? "not-started";
}

function playAssemblyCue(sound: ExperienceSound) {
  if (typeof window === "undefined") return;
  if (window.__DESKTERIORONLINE_DISABLE_PC_AUDIO__) return;

  type AudioContextConstructor = new () => AudioContext;
  const AudioContextClass =
    window.AudioContext ??
    (window as Window & { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext;

  if (!AudioContextClass) return;

  const soundProfile: Record<ExperienceSound, { primary: number; secondary: number; duration: number; gain: number }> = {
    "case-choice-confirm": { primary: 620, secondary: 1240, duration: 0.11, gain: 0.12 },
    "soft-tool-set": { primary: 340, secondary: 680, duration: 0.09, gain: 0.08 },
    "soft-part-place": { primary: 280, secondary: 560, duration: 0.12, gain: 0.09 },
    "metal-lever-click": { primary: 840, secondary: 1480, duration: 0.075, gain: 0.13 },
    "cpu-seat-tick": { primary: 520, secondary: 1180, duration: 0.065, gain: 0.09 },
    "metal-latch-snap": { primary: 940, secondary: 1420, duration: 0.075, gain: 0.13 },
    "screw-loosen": { primary: 560, secondary: 980, duration: 0.1, gain: 0.09 },
    "screw-tighten": { primary: 640, secondary: 1100, duration: 0.1, gain: 0.1 },
    "m2-snap": { primary: 740, secondary: 1240, duration: 0.08, gain: 0.1 },
    "plastic-latch-click": { primary: 760, secondary: 1380, duration: 0.08, gain: 0.11 },
    "ram-latch-click": { primary: 860, secondary: 1520, duration: 0.09, gain: 0.18 },
    "glass-panel-slide": { primary: 260, secondary: 520, duration: 0.13, gain: 0.12 },
    "standoff-tap": { primary: 420, secondary: 900, duration: 0.08, gain: 0.09 },
    "psu-rail-thunk": { primary: 180, secondary: 360, duration: 0.11, gain: 0.16 },
    "cable-plug-click": { primary: 520, secondary: 980, duration: 0.085, gain: 0.11 },
    "thermal-paste-press": { primary: 220, secondary: 330, duration: 0.16, gain: 0.08 },
    "cooler-pump-seat": { primary: 320, secondary: 650, duration: 0.12, gain: 0.12 },
    "fan-magnetic-snap": { primary: 420, secondary: 980, duration: 0.095, gain: 0.13 },
    "tiny-header-click": { primary: 980, secondary: 1680, duration: 0.055, gain: 0.08 },
    "gpu-latch-click": { primary: 520, secondary: 1240, duration: 0.1, gain: 0.15 },
    "cable-tie-pull": { primary: 300, secondary: 720, duration: 0.12, gain: 0.07 },
    "panel-close-click": { primary: 360, secondary: 740, duration: 0.1, gain: 0.12 },
    "power-boot-chime": { primary: 520, secondary: 780, duration: 0.18, gain: 0.1 },
    "bios-post-beep": { primary: 880, secondary: 1760, duration: 0.12, gain: 0.12 },
    "desk-placement-thud": { primary: 160, secondary: 320, duration: 0.13, gain: 0.15 },
    "monitor-stand-click": { primary: 540, secondary: 1020, duration: 0.09, gain: 0.11 },
    "desk-soft-tap": { primary: 260, secondary: 520, duration: 0.08, gain: 0.08 },
    "arm-clamp-tighten": { primary: 460, secondary: 880, duration: 0.12, gain: 0.1 },
    "lamp-switch-click": { primary: 720, secondary: 1440, duration: 0.07, gain: 0.1 },
    "decor-soft-place": { primary: 240, secondary: 480, duration: 0.11, gain: 0.08 },
    "toy-stack-tap": { primary: 380, secondary: 760, duration: 0.08, gain: 0.1 },
    "led-power-chime": { primary: 660, secondary: 1320, duration: 0.16, gain: 0.11 },
    "drawer-soft-close": { primary: 210, secondary: 410, duration: 0.13, gain: 0.1 },
    "fabric-cushion-thump": { primary: 140, secondary: 260, duration: 0.14, gain: 0.12 },
    "room-light-swell": { primary: 520, secondary: 1040, duration: 0.2, gain: 0.1 }
  };
  const profile = soundProfile[sound];
  const context = new AudioContextClass();
  const oscillator = context.createOscillator();
  const snap = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = "square";
  oscillator.frequency.setValueAtTime(profile.primary, context.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(120, profile.primary * 0.48), context.currentTime + profile.duration);

  snap.type = "triangle";
  snap.frequency.setValueAtTime(profile.secondary, context.currentTime);
  snap.frequency.exponentialRampToValueAtTime(Math.max(180, profile.secondary * 0.62), context.currentTime + profile.duration * 0.55);

  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(profile.gain, context.currentTime + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + profile.duration);

  oscillator.connect(gain);
  snap.connect(gain);
  gain.connect(context.destination);

  oscillator.start();
  snap.start(context.currentTime + 0.012);
  oscillator.stop(context.currentTime + profile.duration);
  snap.stop(context.currentTime + profile.duration * 0.84);
  oscillator.onended = () => {
    void context.close().catch(() => undefined);
  };
}

function playKeyboardSwitchCue(switchKind: KeyboardSwitchKind) {
  if (typeof window === "undefined") return;
  if (window.__DESKTERIORONLINE_DISABLE_PC_AUDIO__) return;

  type AudioContextConstructor = new () => AudioContext;
  const AudioContextClass =
    window.AudioContext ??
    (window as Window & { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext;

  if (!AudioContextClass) return;

  const soundProfile: Record<
    KeyboardSwitchKind,
    {
      body: number;
      release: number;
      click?: number;
      bump?: number;
      duration: number;
      gain: number;
      noiseGain: number;
      clickDelay: number;
    }
  > = {
    "linear-red": { body: 210, release: 420, duration: 0.072, gain: 0.075, noiseGain: 0.024, clickDelay: 0.014 },
    "clicky-blue": { body: 245, release: 760, click: 2450, duration: 0.095, gain: 0.12, noiseGain: 0.045, clickDelay: 0.02 },
    "tactile-brown": { body: 225, release: 560, bump: 1320, duration: 0.082, gain: 0.09, noiseGain: 0.033, clickDelay: 0.017 }
  };
  const profile = soundProfile[switchKind];
  const context = new AudioContextClass();
  const master = context.createGain();
  master.gain.setValueAtTime(0.0001, context.currentTime);
  master.gain.exponentialRampToValueAtTime(profile.gain, context.currentTime + 0.004);
  master.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + profile.duration);
  master.connect(context.destination);

  const bottomOut = context.createOscillator();
  bottomOut.type = switchKind === "clicky-blue" ? "square" : "triangle";
  bottomOut.frequency.setValueAtTime(profile.body, context.currentTime);
  bottomOut.frequency.exponentialRampToValueAtTime(Math.max(120, profile.body * 0.54), context.currentTime + profile.duration * 0.62);
  bottomOut.connect(master);
  bottomOut.start(context.currentTime);
  bottomOut.stop(context.currentTime + profile.duration * 0.72);

  const release = context.createOscillator();
  release.type = "triangle";
  release.frequency.setValueAtTime(profile.release, context.currentTime + profile.duration * 0.48);
  release.frequency.exponentialRampToValueAtTime(Math.max(140, profile.release * 0.5), context.currentTime + profile.duration);
  release.connect(master);
  release.start(context.currentTime + profile.duration * 0.48);
  release.stop(context.currentTime + profile.duration);

  if (profile.click || profile.bump) {
    const click = context.createOscillator();
    click.type = profile.click ? "square" : "sawtooth";
    click.frequency.setValueAtTime(profile.click ?? profile.bump ?? 1200, context.currentTime + profile.clickDelay);
    click.frequency.exponentialRampToValueAtTime((profile.click ?? profile.bump ?? 1200) * 0.72, context.currentTime + profile.clickDelay + 0.018);
    click.connect(master);
    click.start(context.currentTime + profile.clickDelay);
    click.stop(context.currentTime + profile.clickDelay + 0.026);
  }

  const bufferLength = Math.max(1, Math.floor(context.sampleRate * profile.duration));
  const noiseBuffer = context.createBuffer(1, bufferLength, context.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferLength; i += 1) {
    const decay = 1 - i / bufferLength;
    data[i] = (Math.random() * 2 - 1) * decay * decay;
  }
  const noise = context.createBufferSource();
  const noiseGain = context.createGain();
  noise.buffer = noiseBuffer;
  noiseGain.gain.setValueAtTime(profile.noiseGain, context.currentTime);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + profile.duration);
  noise.connect(noiseGain);
  noiseGain.connect(master);
  noise.start(context.currentTime);
  noise.stop(context.currentTime + profile.duration);

  window.setTimeout(() => {
    void context.close().catch(() => undefined);
  }, Math.ceil(profile.duration * 1000) + 40);
}

function StepButton({
  testId,
  label,
  icon,
  disabled,
  complete,
  onClick
}: {
  testId: string;
  label: string;
  icon: ReactNode;
  disabled?: boolean;
  complete?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      disabled={disabled}
      onClick={onClick}
      className="group flex min-h-[48px] items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.08] px-4 text-left text-sm font-semibold text-[#f8f1e8] transition hover:border-[#8fd7ff]/45 hover:bg-[#8fd7ff]/12 disabled:cursor-not-allowed disabled:opacity-45"
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className="grid h-8 w-8 place-items-center rounded-md bg-[#111820] text-[#8fd7ff]">{icon}</span>
        <span className="truncate">{label}</span>
      </span>
      {complete ? <CheckCircle2 className="h-5 w-5 shrink-0 text-[#7de0aa]" /> : null}
    </button>
  );
}

function Chassis({ caseOpen }: { caseOpen: boolean }) {
  const shellOpacity = caseOpen ? 0.34 : 1;
  const topOpacity = caseOpen ? 0.16 : 1;
  const glassOpacity = caseOpen ? 0.18 : 0.5;

  return (
    <group position={[0, 0, 0]}>
      <mesh position={[0, 0.04, 0]} receiveShadow castShadow>
        <boxGeometry args={[3.8, 0.08, 2.25]} />
        <meshStandardMaterial color="#1b2027" roughness={0.72} metalness={0.28} />
      </mesh>
      <mesh position={[-1.94, 0.73, 0]} receiveShadow castShadow>
        <boxGeometry args={[0.08, 1.38, 2.25]} />
        <meshStandardMaterial color="#223142" roughness={0.6} metalness={0.38} transparent={caseOpen} opacity={shellOpacity} />
      </mesh>
      <mesh position={[1.94, 0.73, 0]} receiveShadow castShadow>
        <boxGeometry args={[0.08, 1.38, 2.25]} />
        <meshStandardMaterial color="#1f2c3b" roughness={0.58} metalness={0.42} transparent={caseOpen} opacity={shellOpacity} />
      </mesh>
      <mesh position={[0, 0.73, -1.16]} receiveShadow castShadow>
        <boxGeometry args={[3.8, 1.38, 0.08]} />
        <meshStandardMaterial color="#1c2836" roughness={0.62} metalness={0.36} transparent={caseOpen} opacity={shellOpacity} />
      </mesh>
      <mesh position={[0, 1.44, 0]} receiveShadow castShadow>
        <boxGeometry args={[3.8, 0.08, 2.25]} />
        <meshStandardMaterial color="#263545" roughness={0.62} metalness={0.36} transparent={caseOpen} opacity={topOpacity} />
      </mesh>
      <mesh position={[0.18, 0.75, caseOpen ? 1.54 : 1.16]} rotation={[0, caseOpen ? -0.28 : 0, 0]} castShadow>
        <boxGeometry args={[3.35, 1.18, 0.035]} />
        <meshPhysicalMaterial
          color="#84c7ff"
          roughness={0.16}
          metalness={0}
          transmission={0.38}
          transparent
          opacity={glassOpacity}
        />
      </mesh>
    </group>
  );
}

function Motherboard() {
  return (
    <group position={[-0.25, 0.16, -0.1]}>
      <mesh receiveShadow castShadow>
        <boxGeometry args={[2.35, 0.055, 1.45]} />
        <meshStandardMaterial color="#1f4a43" roughness={0.82} metalness={0.1} />
      </mesh>
      <mesh position={[-0.55, 0.055, 0.05]} castShadow>
        <boxGeometry args={[0.58, 0.04, 0.58]} />
        <meshStandardMaterial color="#303944" roughness={0.58} metalness={0.45} />
      </mesh>
      <mesh position={[0.48, 0.065, -0.03]} castShadow>
        <boxGeometry args={[0.12, 0.055, 1.08]} />
        <meshStandardMaterial color="#10151b" roughness={0.65} metalness={0.28} />
      </mesh>
      <mesh position={[0.66, 0.065, -0.03]} castShadow>
        <boxGeometry args={[0.12, 0.055, 1.08]} />
        <meshStandardMaterial color="#10151b" roughness={0.65} metalness={0.28} />
      </mesh>
      <mesh position={[-0.93, 0.075, -0.55]} castShadow>
        <boxGeometry args={[0.56, 0.09, 0.18]} />
        <meshStandardMaterial color="#5d6570" roughness={0.48} metalness={0.58} />
      </mesh>
      <mesh position={[-0.91, 0.075, 0.6]} castShadow>
        <boxGeometry args={[0.62, 0.09, 0.16]} />
        <meshStandardMaterial color="#53616d" roughness={0.48} metalness={0.58} />
      </mesh>
      {[-0.95, -0.35, 0.25, 0.85].map((x) => (
        <mesh key={x} position={[x, 0.07, -0.82]} castShadow>
          <boxGeometry args={[0.18, 0.055, 0.28]} />
          <meshStandardMaterial color="#203d51" roughness={0.68} metalness={0.24} />
        </mesh>
      ))}
    </group>
  );
}

function PsuModule({ mounted }: { mounted: boolean }) {
  if (!mounted) return null;
  return (
    <group position={[1.15, 0.28, -0.5]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.76, 0.36, 0.58]} />
        <meshStandardMaterial color="#f6f8fb" roughness={0.42} metalness={0.2} />
      </mesh>
      <mesh position={[0.39, 0, 0]} rotation={[0, Math.PI / 2, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.16, 0.018, 36]} />
        <meshStandardMaterial color="#d9e3ee" roughness={0.46} metalness={0.35} />
      </mesh>
      <mesh position={[0.4, 0, 0]} rotation={[0, Math.PI / 2, 0]} castShadow>
        <torusGeometry args={[0.12, 0.008, 8, 28]} />
        <meshStandardMaterial color="#92d9ff" emissive="#145b80" emissiveIntensity={0.18} roughness={0.36} />
      </mesh>
    </group>
  );
}

function CpuAssembly({
  cpuSeated,
  thermalPasteApplied
}: {
  cpuSeated: boolean;
  thermalPasteApplied: boolean;
}) {
  return (
    <group position={[-0.8, 0.245, -0.05]}>
      <mesh position={[0, cpuSeated ? 0 : 0.44, 0]} castShadow>
        <boxGeometry args={[0.48, 0.045, 0.48]} />
        <meshStandardMaterial color={cpuSeated ? "#c8d4d8" : "#98aeb7"} roughness={0.32} metalness={0.74} />
      </mesh>
      {thermalPasteApplied ? (
        <>
          <mesh position={[0, 0.04, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.115, 0.115, 0.012, 28]} />
            <meshStandardMaterial color="#e9eef0" roughness={0.92} metalness={0} />
          </mesh>
          <mesh position={[0.105, 0.046, -0.04]} rotation={[Math.PI / 2, 0, 0.6]} castShadow>
            <boxGeometry args={[0.2, 0.012, 0.035]} />
            <meshStandardMaterial color="#d8e0e4" roughness={0.95} metalness={0} />
          </mesh>
        </>
      ) : null}
    </group>
  );
}

function CoolerAssembly({ mounted }: { mounted: boolean }) {
  if (!mounted) return null;
  return (
    <group>
      <mesh position={[-0.8, 0.36, -0.05]} castShadow>
        <cylinderGeometry args={[0.24, 0.24, 0.09, 36]} />
        <meshStandardMaterial color="#f5f7fb" roughness={0.32} metalness={0.28} />
      </mesh>
      <mesh position={[-0.8, 0.415, -0.05]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.17, 0.17, 0.02, 36]} />
        <meshStandardMaterial color="#151b22" emissive="#235879" emissiveIntensity={0.22} roughness={0.42} />
      </mesh>
      <mesh position={[0.25, 1.18, -0.98]} castShadow>
        <boxGeometry args={[1.65, 0.18, 0.32]} />
        <meshStandardMaterial color="#edf3f8" roughness={0.38} metalness={0.22} />
      </mesh>
      {[-0.5, 0.25, 1.0].map((x) => (
        <mesh key={x} position={[x, 1.2, -0.8]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.17, 0.17, 0.05, 36]} />
          <meshStandardMaterial color="#ffffff" roughness={0.46} metalness={0.12} />
        </mesh>
      ))}
      <mesh position={[-0.4, 0.67, -0.6]} rotation={[0, 0, -0.7]} castShadow>
        <torusGeometry args={[0.42, 0.012, 8, 36]} />
        <meshStandardMaterial color="#d9e3ee" roughness={0.52} metalness={0.18} />
      </mesh>
    </group>
  );
}

function RamModule({ inserted }: { inserted: boolean }) {
  if (!inserted) return null;
  return (
    <group position={[0.4, 0.29, -0.13]} rotation={[0, 0, 0.05]}>
      <mesh castShadow>
        <boxGeometry args={[0.11, 0.42, 1.0]} />
        <meshStandardMaterial color="#17222f" roughness={0.64} metalness={0.28} />
      </mesh>
      {[-0.35, -0.12, 0.12, 0.35].map((z) => (
        <mesh key={z} position={[0, 0.005, z]} castShadow>
          <boxGeometry args={[0.12, 0.44, 0.08]} />
          <meshStandardMaterial color="#27303b" roughness={0.44} metalness={0.52} />
        </mesh>
      ))}
      <mesh position={[0, 0.23, 0]} castShadow>
        <boxGeometry args={[0.125, 0.045, 0.94]} />
        <meshStandardMaterial color="#8fd7ff" emissive="#235879" emissiveIntensity={inserted ? 0.26 : 0.1} roughness={0.42} />
      </mesh>
    </group>
  );
}

function SsdModule({ installed }: { installed: boolean }) {
  if (!installed) return null;
  return (
    <group position={[-0.34, 0.3, 0.54]} rotation={[0, 0.12, 0]}>
      <mesh castShadow>
        <boxGeometry args={[0.62, 0.035, 0.2]} />
        <meshStandardMaterial color="#10141a" roughness={0.5} metalness={0.46} />
      </mesh>
      <mesh position={[-0.18, 0.023, 0]} castShadow>
        <boxGeometry args={[0.16, 0.018, 0.16]} />
        <meshStandardMaterial color="#d9e3ee" roughness={0.42} metalness={0.36} />
      </mesh>
    </group>
  );
}

function GpuModule({ installed }: { installed: boolean }) {
  if (!installed) return null;
  return (
    <group position={[0.35, 0.42, 0.35]} rotation={[0, 0.02, 0]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[1.42, 0.22, 0.42]} />
        <meshStandardMaterial color="#f9fbff" roughness={0.36} metalness={0.18} />
      </mesh>
      {[-0.43, 0, 0.43].map((x) => (
        <mesh key={x} position={[x, 0.125, 0.015]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.15, 0.15, 0.035, 36]} />
          <meshStandardMaterial color="#e2eaf2" roughness={0.5} metalness={0.24} />
        </mesh>
      ))}
      <mesh position={[0.66, 0.15, -0.22]} castShadow>
        <boxGeometry args={[0.22, 0.05, 0.08]} />
        <meshStandardMaterial color="#151b22" roughness={0.5} metalness={0.52} />
      </mesh>
    </group>
  );
}

function CaseFan({ installed }: { installed: boolean }) {
  if (!installed) return null;
  return (
    <group position={[1.25, 0.82, 0.78]}>
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.28, 0.28, 0.055, 36]} />
        <meshStandardMaterial color="#ffffff" roughness={0.44} metalness={0.14} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
        <torusGeometry args={[0.2, 0.015, 8, 36]} />
        <meshStandardMaterial color="#8fd7ff" emissive="#164f73" emissiveIntensity={0.32} roughness={0.35} />
      </mesh>
    </group>
  );
}

function PowerCableHarness({ connected, managed }: { connected: boolean; managed: boolean }) {
  if (!connected) return null;
  return (
    <group>
      <mesh position={[0.25, 0.45, 0.5]} rotation={[0.06, 0, -0.08]} castShadow>
        <boxGeometry args={[1.25, 0.035, 0.05]} />
        <meshStandardMaterial color="#eef3f8" roughness={0.5} metalness={0.08} />
      </mesh>
      <mesh position={[-0.35, 0.5, -0.45]} rotation={[0, 0.18, 0.18]} castShadow>
        <boxGeometry args={[0.78, 0.032, 0.045]} />
        <meshStandardMaterial color="#eef3f8" roughness={0.5} metalness={0.08} />
      </mesh>
      <mesh position={[0.78, 0.52, 0.14]} rotation={[0, -0.22, 0]} castShadow>
        <boxGeometry args={[0.64, 0.035, 0.055]} />
        <meshStandardMaterial color="#e9edf2" roughness={0.5} metalness={0.08} />
      </mesh>
      {managed ? (
        <>
          <mesh position={[0.1, 0.5, 0.48]} castShadow>
            <boxGeometry args={[0.08, 0.075, 0.12]} />
            <meshStandardMaterial color="#8fd7ff" emissive="#164f73" emissiveIntensity={0.22} roughness={0.42} />
          </mesh>
          <mesh position={[-0.42, 0.56, -0.44]} castShadow>
            <boxGeometry args={[0.075, 0.07, 0.1]} />
            <meshStandardMaterial color="#f7c76b" emissive="#7c4e10" emissiveIntensity={0.2} roughness={0.5} />
          </mesh>
        </>
      ) : null}
    </group>
  );
}

function BootPostIndicator({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <group position={[-1.48, 0.32, 0.94]}>
      <mesh castShadow>
        <sphereGeometry args={[0.055, 20, 20]} />
        <meshStandardMaterial color="#7de0aa" emissive="#1f8f4c" emissiveIntensity={0.75} roughness={0.3} />
      </mesh>
      <pointLight color="#7de0aa" intensity={0.7} distance={1.2} />
    </group>
  );
}

function CaseDetails() {
  return (
    <group>
      <mesh position={[0.75, 0.36, 0.48]} castShadow>
        <boxGeometry args={[1.2, 0.14, 0.28]} />
        <meshStandardMaterial color="#252d36" roughness={0.5} metalness={0.55} />
      </mesh>
      <mesh position={[0.75, 0.46, 0.49]} castShadow>
        <boxGeometry args={[1.12, 0.045, 0.32]} />
        <meshStandardMaterial color="#f66f9a" emissive="#7b1838" emissiveIntensity={0.28} roughness={0.36} />
      </mesh>
      <mesh position={[0.05, 0.3, 0.78]} rotation={[Math.PI / 2, 0, Math.PI / 2]} castShadow>
        <torusGeometry args={[0.32, 0.014, 8, 32]} />
        <meshStandardMaterial color="#f7c76b" emissive="#7c4e10" emissiveIntensity={0.22} roughness={0.48} />
      </mesh>
      <mesh position={[0.38, 0.31, 0.72]} rotation={[Math.PI / 2, 0, Math.PI / 2]} castShadow>
        <torusGeometry args={[0.28, 0.012, 8, 32]} />
        <meshStandardMaterial color="#7de0aa" emissive="#155b36" emissiveIntensity={0.24} roughness={0.5} />
      </mesh>
      {[
        [-1.35, 0.19, 0.78, "#d7dbe0"],
        [-1.15, 0.19, 0.78, "#8fd7ff"],
        [-0.95, 0.19, 0.78, "#f7c76b"],
        [-0.75, 0.19, 0.78, "#f66f9a"]
      ].map(([x, y, z, color]) => (
        <mesh key={`${x}-${color}`} position={[Number(x), Number(y), Number(z)]} castShadow>
          <cylinderGeometry args={[0.045, 0.045, 0.12, 18]} />
          <meshStandardMaterial color={String(color)} roughness={0.42} metalness={0.28} />
        </mesh>
      ))}
    </group>
  );
}

function CompletedPcTower() {
  return (
    <group>
      <Chassis caseOpen={false} />
      <PsuModule mounted />
      <Motherboard />
      <CpuAssembly cpuSeated thermalPasteApplied />
      <CoolerAssembly mounted />
      <RamModule inserted />
      <SsdModule installed />
      <GpuModule installed />
      <CaseFan installed />
      <PowerCableHarness connected managed />
      <BootPostIndicator active />
      <CaseDetails />
    </group>
  );
}

function WallLeds({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <group>
      <mesh position={[-1.0, 2.08, -1.78]} castShadow>
        <boxGeometry args={[2.05, 0.032, 0.026]} />
        <meshStandardMaterial color="#8fd7ff" emissive="#2a8bc8" emissiveIntensity={0.2} roughness={0.38} transparent opacity={0.34} />
      </mesh>
      <mesh position={[2.88, 1.55, -0.55]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <boxGeometry args={[1.56, 0.032, 0.026]} />
        <meshStandardMaterial color="#f66f9a" emissive="#b91b52" emissiveIntensity={0.26} roughness={0.38} transparent opacity={0.36} />
      </mesh>
      <pointLight color="#69cfff" intensity={0.42} distance={3.6} position={[-1.2, 1.78, -1.3]} />
      <pointLight color="#ff5f99" intensity={0.58} distance={3.8} position={[2.18, 1.48, -0.8]} />
    </group>
  );
}

type Vec3 = [number, number, number];

type RoundedBlockProps = {
  args: Vec3;
  position?: Vec3;
  rotation?: Vec3;
  color: string;
  radius?: number;
  roughness?: number;
  metalness?: number;
  emissive?: string;
  emissiveIntensity?: number;
  opacity?: number;
};

type MeshyMaterialTone = {
  tint?: string;
  tintStrength?: number;
  colorScale?: number;
  roughness?: number;
  metalness?: number;
  envMapIntensity?: number;
  opacity?: number;
  emissiveIntensity?: number;
};

function toneMeshyMaterial(material: THREE.Material, tone: MeshyMaterialTone) {
  const cloned = material.clone();
  const mutable = cloned as THREE.MeshStandardMaterial & THREE.MeshPhysicalMaterial;

  if (mutable.color) {
    if (tone.tint) {
      mutable.color.lerp(new THREE.Color(tone.tint), tone.tintStrength ?? 0.2);
    }
    if (typeof tone.colorScale === "number") {
      mutable.color.multiplyScalar(tone.colorScale);
    }
  }
  if (typeof tone.roughness === "number" && "roughness" in mutable) {
    mutable.roughness = tone.roughness;
  }
  if (typeof tone.metalness === "number" && "metalness" in mutable) {
    mutable.metalness = tone.metalness;
  }
  if (typeof tone.envMapIntensity === "number" && "envMapIntensity" in mutable) {
    mutable.envMapIntensity = tone.envMapIntensity;
  }
  if (typeof tone.opacity === "number") {
    const shouldRemainOpaque = tone.opacity >= 0.78;
    mutable.transparent = !shouldRemainOpaque;
    mutable.opacity = shouldRemainOpaque ? 1 : tone.opacity;
    mutable.depthWrite = shouldRemainOpaque || tone.opacity >= 0.5;
  }
  if (typeof tone.emissiveIntensity === "number" && "emissiveIntensity" in mutable) {
    mutable.emissiveIntensity = tone.emissiveIntensity;
  }
  mutable.needsUpdate = true;

  return cloned;
}

function tuneHeroSofaMaterial(meshName: string, material: THREE.Material) {
  if (!meshName.startsWith("hero_sofa_")) return material;

  const mutable = material as THREE.MeshStandardMaterial & THREE.MeshPhysicalMaterial;
  if (!mutable.color) return material;

  const normalizedName = meshName.toLowerCase();
  const targetColor = new THREE.Color(
    /pillow_light|linen/.test(normalizedName)
      ? "#b9ada8"
      : /pillow_blue|throw|tassel/.test(normalizedName)
        ? "#465f80"
        : /leg|glide|metal/.test(normalizedName)
          ? "#141922"
          : /welt|shadow|button|recessed|skirt|piping|stitch/.test(normalizedName)
            ? "#101826"
            : "#223047"
  );

  const colorScale =
    /pillow_light|linen/.test(normalizedName)
      ? 0.9
      : /pillow_blue|throw|tassel/.test(normalizedName)
        ? 0.78
        : /welt|shadow|button|recessed|skirt|piping|stitch/.test(normalizedName)
          ? 0.58
          : 0.66;

  mutable.color.copy(targetColor);
  mutable.color.multiplyScalar(colorScale);
  if ("roughness" in mutable) {
    mutable.roughness = /leg|glide|metal/.test(normalizedName) ? 0.54 : 0.92;
  }
  if ("metalness" in mutable) {
    mutable.metalness = /leg|glide|metal/.test(normalizedName) ? 0.28 : 0.0;
  }
  if ("envMapIntensity" in mutable) {
    mutable.envMapIntensity = /leg|glide|metal/.test(normalizedName) ? 0.42 : 0.28;
  }
  mutable.side = THREE.DoubleSide;
  mutable.needsUpdate = true;

  return material;
}

function loadRuntimeBrunoOrmTexture(url: string) {
  return new Promise<THREE.Texture>((resolve, reject) => {
    const loader = new RuntimeTextureLoader();
    loader.load(
      url,
      (texture) => {
        texture.colorSpace = THREE.NoColorSpace;
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.generateMipmaps = true;
        texture.needsUpdate = true;
        resolve(texture);
      },
      undefined,
      reject
    );
  });
}

function isBrunoRoomSurfaceOrmRole(role: string | undefined): role is BrunoRoomSurfaceOrmRole {
  return BRUNO_ROOM_SURFACE_ORM_ROLES.includes(role as BrunoRoomSurfaceOrmRole);
}

function isBrunoFurnitureOrmRole(role: string | undefined): role is BrunoFurnitureOrmRole {
  return BRUNO_FURNITURE_ORM_ROLES.includes(role as BrunoFurnitureOrmRole);
}

function useBrunoRoomSurfaceOrmTextures() {
  const { gl } = useThree();
  const [textureState, setTextureState] = useState<BrunoRoomSurfaceOrmTextureState | null>(null);

  useEffect(() => {
    let cancelled = false;
    configureRuntimeAssetLoaders(gl);

    const loadTexturePackage = async () => {
      const response = await fetch(BRUNO_ROOM_SURFACE_TEXTURE_PACKAGE_URL, { cache: "force-cache" });
      if (!response.ok) {
        throw new Error(`Failed to load Bruno surface texture package: ${response.status}`);
      }

      const texturePackage = (await response.json()) as BrunoRoomSurfaceTexturePackage;
      const entries = (texturePackage.maps ?? []).filter((entry) => isBrunoRoomSurfaceOrmRole(entry.role));
      const loadedPairs = await Promise.all(
        entries.map(async (entry) => {
          const textureUrl = entry.ktx2Path ?? entry.publicPath;
          if (!textureUrl) return null;
          const texture = await loadRuntimeBrunoOrmTexture(textureUrl);
          return [entry.role, texture, textureUrl] as const;
        })
      );

      const nextTextures: BrunoRoomSurfaceOrmTextures = {};
      const nextTextureUrls: Partial<Record<BrunoRoomSurfaceOrmRole, string>> = {};
      loadedPairs.forEach((pair) => {
        if (!pair) return;
        nextTextures[pair[0]] = pair[1];
        nextTextureUrls[pair[0]] = pair[2];
      });

      if (cancelled) {
        Object.values(nextTextures).forEach((texture) => texture?.dispose());
        return;
      }
      setTextureState({ textures: nextTextures, textureUrls: nextTextureUrls });
    };

    loadTexturePackage().catch(() => {
      if (!cancelled) {
        setTextureState(null);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [gl]);

  useEffect(() => {
    return () => {
      Object.values(textureState?.textures ?? {}).forEach((texture) => texture?.dispose());
    };
  }, [textureState]);

  return textureState;
}

function useBrunoFurnitureOrmTextures() {
  const { gl } = useThree();
  const [textureState, setTextureState] = useState<BrunoFurnitureOrmTextureState | null>(null);

  useEffect(() => {
    let cancelled = false;
    configureRuntimeAssetLoaders(gl);

    const loadTexturePackage = async () => {
      const response = await fetch(BRUNO_FURNITURE_HERO_TEXTURE_PACKAGE_URL, { cache: "force-cache" });
      if (!response.ok) {
        throw new Error(`Failed to load Bruno furniture texture package: ${response.status}`);
      }

      const texturePackage = (await response.json()) as BrunoFurnitureTexturePackage;
      const entries = (texturePackage.maps ?? []).filter((entry) => isBrunoFurnitureOrmRole(entry.role));
      const loadedPairs = await Promise.all(
        entries.map(async (entry) => {
          const textureUrl = entry.ktx2Path ?? entry.publicPath;
          if (!textureUrl) return null;
          const texture = await loadRuntimeBrunoOrmTexture(textureUrl);
          return [entry.role, texture, textureUrl] as const;
        })
      );

      const nextTextures: BrunoFurnitureOrmTextures = {};
      const nextTextureUrls: Partial<Record<BrunoFurnitureOrmRole, string>> = {};
      loadedPairs.forEach((pair) => {
        if (!pair) return;
        nextTextures[pair[0]] = pair[1];
        nextTextureUrls[pair[0]] = pair[2];
      });

      if (cancelled) {
        Object.values(nextTextures).forEach((texture) => texture?.dispose());
        return;
      }
      setTextureState({ textures: nextTextures, textureUrls: nextTextureUrls });
    };

    loadTexturePackage().catch(() => {
      if (!cancelled) {
        setTextureState(null);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [gl]);

  useEffect(() => {
    return () => {
      Object.values(textureState?.textures ?? {}).forEach((texture) => texture?.dispose());
    };
  }, [textureState]);

  return textureState;
}

function resolveBrunoSurfaceOrmRole(materialName: string): BrunoRoomSurfaceOrmRole | null {
  const normalized = materialName.toLowerCase();
  if (/(lightmap|shadow|strip|bounce|contact|wash|recess)/.test(normalized)) return null;
  if (/(wood|plank|floor)/.test(normalized)) return "floorWoodOrm";
  if (/(trim|satin|baseboard|crown)/.test(normalized)) return "trimOrm";
  if (/(plaster|wall|reveal)/.test(normalized)) return "plasterWallOrm";
  return null;
}

function resolveBrunoFurnitureOrmRole(materialName: string): BrunoFurnitureOrmRole | null {
  const normalized = materialName.toLowerCase();
  if (/(glass|screen|metal|rgb|light|emissive|black_plastic|satin_black)/.test(normalized)) return null;
  if (/(speaker|grille)/.test(normalized)) return "furnitureSpeakerOrm";
  if (/(fabric|linen|pillow|throw|rug|navy|bluegrey|cushion|sofa)/.test(normalized)) return "furnitureFabricOrm";
  if (/(lacquer|cream|paper|book|ceramic|pot|warm)/.test(normalized)) return "furnitureLacquerOrm";
  if (/(wood|walnut|oak|shelf|desk|table|console)/.test(normalized)) return "furnitureWoodOrm";
  return null;
}

function ensureAoUv2(geometry: THREE.BufferGeometry | undefined) {
  if (!geometry?.attributes.uv || geometry.attributes.uv1 || geometry.attributes.uv2) return false;
  geometry.setAttribute("uv1", geometry.attributes.uv.clone());
  return true;
}

function hasAoUv2(geometry: THREE.BufferGeometry | undefined) {
  return Boolean(geometry?.attributes.uv1 ?? geometry?.attributes.uv2);
}

function applyBrunoPackedOrmMaterial(
  material: THREE.Material,
  ormTexture: THREE.Texture,
  role: BrunoRoomSurfaceOrmRole,
  textureChannel: number
) {
  const mutable = material as THREE.MeshStandardMaterial & THREE.MeshPhysicalMaterial;
  ormTexture.channel = textureChannel;
  mutable.aoMap = ormTexture;
  mutable.roughnessMap = ormTexture;
  mutable.metalnessMap = ormTexture;
  mutable.aoMapIntensity = role === "floorWoodOrm" ? 0.55 : role === "plasterWallOrm" ? 0.42 : 0.34;
  if ("roughness" in mutable) {
    mutable.roughness = role === "floorWoodOrm" ? 0.86 : role === "plasterWallOrm" ? 0.9 : 0.66;
  }
  if ("metalness" in mutable) {
    mutable.metalness = role === "trimOrm" ? 0.04 : 0.015;
  }
  mutable.needsUpdate = true;
  return material;
}

function applyBrunoFurniturePackedOrmMaterial(
  material: THREE.Material,
  ormTexture: THREE.Texture,
  role: BrunoFurnitureOrmRole,
  textureChannel: number
) {
  const mutable = material as THREE.MeshStandardMaterial & THREE.MeshPhysicalMaterial;
  ormTexture.channel = textureChannel;
  mutable.aoMap = ormTexture;
  mutable.roughnessMap = ormTexture;
  mutable.metalnessMap = ormTexture;
  mutable.aoMapIntensity =
    role === "furnitureWoodOrm"
      ? 0.5
      : role === "furnitureFabricOrm"
        ? 0.44
        : role === "furnitureSpeakerOrm"
          ? 0.3
          : 0.34;
  if ("roughness" in mutable) {
    mutable.roughness =
      role === "furnitureFabricOrm"
        ? 0.9
        : role === "furnitureWoodOrm"
          ? 0.78
          : role === "furnitureSpeakerOrm"
            ? 0.74
            : 0.64;
  }
  if ("metalness" in mutable) {
    mutable.metalness =
      role === "furnitureSpeakerOrm" ? 0.04 : role === "furnitureLacquerOrm" ? 0.03 : role === "furnitureWoodOrm" ? 0.02 : 0;
  }
  mutable.needsUpdate = true;
  return material;
}

function RoundedBlock({
  args,
  position,
  rotation,
  color,
  radius = 0.035,
  roughness = 0.62,
  metalness = 0.04,
  emissive = "#000000",
  emissiveIntensity = 0,
  opacity = 1
}: RoundedBlockProps) {
  const safeRadius = Math.max(0.002, Math.min(radius, args[0] * 0.45, args[1] * 0.45, args[2] * 0.45));

  return (
    <RoundedBox
      args={args}
      radius={safeRadius}
      smoothness={5}
      position={position}
      rotation={rotation}
      castShadow
      receiveShadow
    >
      <meshStandardMaterial
        color={color}
        roughness={roughness}
        metalness={metalness}
        emissive={emissive}
        emissiveIntensity={emissiveIntensity}
        transparent={opacity < 1}
        opacity={opacity}
        depthWrite={opacity >= 1}
      />
    </RoundedBox>
  );
}

function MeshyModel({
  url,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  materialTone
}: {
  url: string;
  position?: Vec3;
  rotation?: Vec3;
  scale?: number | Vec3;
  materialTone?: MeshyMaterialTone;
}) {
  const gltf = useGLTF(url);
  const scene = useMemo(() => {
    const cloned = gltf.scene.clone(true);
    cloned.traverse((object) => {
      if ((object as THREE.Mesh).isMesh) {
        const mesh = object as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        if (materialTone) {
          mesh.material = Array.isArray(mesh.material)
            ? mesh.material.map((material) => toneMeshyMaterial(material, materialTone))
            : toneMeshyMaterial(mesh.material, materialTone);
        }
      }
    });
    return cloned;
  }, [gltf.scene, materialTone]);

  return <primitive object={scene} position={position} rotation={rotation} scale={scale} />;
}

useGLTF.preload(MESHY_PC_BUILD_KIT_URL);
useGLTF.preload(MESHY_SHOWCASE_CASE_URL);
useGLTF.preload(MESHY_ROOM_DECOR_URL);
useGLTF.preload(MESHY_DESK_MONITOR_URL);
useGLTF.preload(MESHY_STUDIO_SPEAKER_URL);
useGLTF.preload(MESHY_IVY_PLANTER_URL);
useGLTF.preload(MESHY_KEYBOARD_URL);
useGLTF.preload(MESHY_MOUSE_URL);
useGLTF.preload(MESHY_DESK_LAMP_URL);
useGLTF.preload(MESHY_CERAMIC_MUG_URL);
useGLTF.preload(MESHY_BOOK_STACK_URL);
useGLTF.preload(MESHY_CABLE_REEL_URL);
useGLTF.preload(MESHY_PIXEL_DISPLAY_URL);
useGLTF.preload(DETAIL_COFFEE_TABLE_URL);
useGLTF.preload(DETAIL_SHELVES_URL);
useGLTF.preload(DETAIL_SOFA_URL);
useGLTF.preload(PREMIUM_DARK_SOFA_URL);
useGLTF.preload(PREMIUM_WORKSTATION_HERO_URL);
useGLTF.preload(COMMERCIAL_DESK_HERO_URL);
useGLTF.preload(COMMERCIAL_TASK_CHAIR_HERO_URL);
useGLTF.preload(COMMERCIAL_DESK_ACCESSORY_KIT_URL);
useGLTF.preload(MECHANICAL_KEYBOARD_SWITCH_LAB_URL);
useGLTF.preload(DETAIL_MEDIA_CABINET_URL);
useGLTF.preload(DETAIL_CEILING_LAMP_URL);
useGLTF.preload(DETAIL_WALL_SCONCE_URL);
useGLTF.preload(DETAIL_DESK_URL);
useGLTF.preload(DETAIL_DESK_PLANTER_URL);
useGLTF.preload(DETAIL_DESK_TRAY_URL);
useGLTF.preload(DETAIL_UNDER_DESK_TRAY_URL);
useGLTF.preload(KENNEY_BOOKCASE_URL);
useGLTF.preload(KENNEY_WALL_LAMP_URL);
useGLTF.preload(KENNEY_SOFA_URL);
useGLTF.preload(KENNEY_POTTED_PLANT_URL);
useGLTF.preload(KENNEY_RUG_URL);
useGLTF.preload(KENNEY_COFFEE_TABLE_URL);
useGLTF.preload(BLENDER_ROOM_DETAIL_KIT_URL);
useGLTF.preload(BLENDER_ROOM_SURFACE_KIT_URL);
useGLTF.preload(BLENDER_FURNITURE_HERO_KIT_URL);
MESHY_COMMUNITY_ASSETS.forEach((asset) => {
  useGLTF.preload(getMeshyCommunityRuntimeUrl(asset.file));
});

function FloorPlanks() {
  const boardColors = ["#8b573d", "#956047", "#a0674c", "#7e4d38", "#9a664d", "#aa7254", "#85523d"];
  const boardWidths = [0.74, 0.92, 1.08, 0.66, 0.84, 1.0, 0.78];

  return (
    <group>
      <RoundedBlock args={[6.7, 0.08, 4.35]} position={[0, -0.055, 0]} color="#4f2f22" radius={0.025} roughness={0.88} />
      {Array.from({ length: 10 }, (_, row) => {
        const z = -1.72 + row * 0.46;
        const rowOffset = row % 2 === 0 ? 0 : 0.34;

        return Array.from({ length: 10 }, (_, column) => {
          const width = boardWidths[(row + column) % boardWidths.length] ?? 1;
          const x = -3.14 + column * 0.72 + rowOffset;

          if (x < -3.18 || x > 3.18) return null;

          return (
            <RoundedBlock
              key={`${row}-${column}`}
              args={[width, 0.032, 0.37]}
              position={[x, 0.005, z]}
              color={boardColors[(row * 2 + column) % boardColors.length] ?? "#bd7447"}
              radius={0.012}
              roughness={0.84}
              metalness={0.01}
            />
          );
        });
      })}
      {[-1.96, -1.5, -1.04, -0.58, -0.12, 0.34, 0.8, 1.26, 1.72].map((z) => (
        <mesh key={z} position={[0, 0.034, z + 0.23]} receiveShadow>
          <boxGeometry args={[6.42, 0.012, 0.014]} />
          <meshStandardMaterial color="#5b3829" roughness={0.92} transparent opacity={0.24} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

function WindowAssembly() {
  return (
    <group position={[3.08, 1.42, -0.72]} rotation={[0, Math.PI / 2, 0]}>
      <RoundedBlock args={[1.12, 1.86, 0.082]} color="#e9e3e6" radius={0.032} roughness={0.56} metalness={0.04} />
      <RoundedBlock args={[0.78, 1.42, 0.09]} position={[0, -0.04, 0.038]} color="#03060c" radius={0.02} roughness={0.76} metalness={0.04} />
      <RoundedBlock args={[0.7, 1.24, 0.012]} position={[0.02, -0.05, 0.098]} color="#193252" radius={0.018} roughness={0.22} metalness={0.02} opacity={0.26} emissive="#102b49" emissiveIntensity={0.16} />
      <RoundedBlock args={[0.13, 1.6, 0.13]} position={[-0.52, -0.04, 0.09]} color="#f1edf0" radius={0.02} roughness={0.44} metalness={0.04} />
      <RoundedBlock args={[0.13, 1.6, 0.13]} position={[0.52, -0.04, 0.09]} color="#f1edf0" radius={0.02} roughness={0.44} metalness={0.04} />
      <RoundedBlock args={[1.16, 0.12, 0.13]} position={[0, 0.78, 0.09]} color="#f3edf0" radius={0.02} roughness={0.42} metalness={0.04} />
      <RoundedBlock args={[1.16, 0.12, 0.13]} position={[0, -0.86, 0.09]} color="#e5dfe4" radius={0.02} roughness={0.48} metalness={0.04} />
      <RoundedBlock args={[0.88, 0.18, 0.15]} position={[0, 1.1, 0.04]} color="#efe8ec" radius={0.025} roughness={0.5} />
      <RoundedBlock args={[0.64, 0.026, 0.026]} position={[0.02, 0.54, 0.14]} color="#fff2cf" radius={0.01} roughness={0.24} emissive="#ffd18b" emissiveIntensity={0.26} opacity={0.74} />
      {[-0.36, -0.1, 0.17, 0.44].map((y, index) => (
        <RoundedBlock
          key={y}
          args={[0.68 - index * 0.03, 0.045, 0.055]}
          position={[0.04, y, 0.12]}
          color={index % 2 ? "#b9efff" : "#8fd7ff"}
          radius={0.018}
          roughness={0.34}
          emissive="#4aa7ff"
          emissiveIntensity={index === 1 ? 0.44 : 0.32}
        />
      ))}
      {[-0.28, 0.22].map((x) => (
        <RoundedBlock
          key={`window-vertical-reflection-${x}`}
          args={[0.018, 1.08, 0.02]}
          position={[x, -0.06, 0.135]}
          color="#d9f7ff"
          radius={0.006}
          roughness={0.22}
          emissive="#3ca7ff"
          emissiveIntensity={0.08}
          opacity={0.34}
        />
      ))}
      <pointLight color="#7bc8ff" intensity={0.42} distance={2.18} position={[0.12, 0.18, 0.46]} />
      <pointLight color="#ff7fa8" intensity={0.16} distance={1.6} position={[0.5, -0.28, 0.44]} />
    </group>
  );
}

function RoomCutawayArchitecture({ lightingSet }: { lightingSet: boolean }) {
  return (
    <group>
      <RoundedBlock args={[0.082, 2.24, 3.42]} position={[-3.32, 1.18, 0.02]} color="#a97467" radius={0.022} roughness={0.82} metalness={0.02} opacity={0.14} />
      <RoundedBlock args={[0.032, 1.94, 2.92]} position={[-3.22, 1.3, -0.05]} color="#ffe1d6" radius={0.014} roughness={0.82} opacity={0.055} />
      <RoundedBlock args={[0.05, 1.66, 0.08]} position={[-3.16, 1.3, -1.42]} color="#d2a094" radius={0.012} roughness={0.64} metalness={0.03} opacity={0.42} />
      <RoundedBlock args={[0.052, 1.42, 0.076]} position={[-3.16, 1.15, 1.4]} color="#d2a094" radius={0.012} roughness={0.64} metalness={0.03} opacity={0.34} />
      {[-1.36, -0.48, 0.42, 1.28].map((z, index) => (
        <RoundedBlock
          key={`left-cutaway-upright-${z}`}
          args={[0.068, 2.18 - index * 0.07, 0.04]}
          position={[-3.15, 1.18, z]}
          color={index % 2 ? "#b17867" : "#e7b8a8"}
          radius={0.014}
          roughness={0.62}
          metalness={0.04}
          opacity={index === 0 ? 0.38 : 0.24}
        />
      ))}
      {[0.46, 1.26, 2.08].map((y, index) => (
        <RoundedBlock
          key={`left-cutaway-rail-${y}`}
          args={[0.054, 0.035, 2.84]}
          position={[-3.13, y, -0.06]}
          color={index === 1 ? "#f5d4c9" : "#b17867"}
          radius={0.012}
          roughness={0.62}
          opacity={index === 1 ? 0.18 : 0.22}
        />
      ))}
      <group position={[-3.16, 1.55, -0.74]} rotation={[0, Math.PI / 2, 0]}>
        <RoundedBlock args={[0.68, 0.42, 0.034]} color="#e8d7cb" radius={0.018} roughness={0.66} />
        <RoundedBlock args={[0.48, 0.25, 0.018]} position={[0, 0, 0.027]} color="#27384a" radius={0.01} roughness={0.56} emissive="#13253b" emissiveIntensity={0.12} />
        <RoundedBlock args={[0.24, 0.024, 0.018]} position={[-0.08, 0.06, 0.046]} color="#f5a26d" radius={0.006} roughness={0.5} emissive="#6b3218" emissiveIntensity={0.1} />
        <RoundedBlock args={[0.3, 0.024, 0.018]} position={[0.06, -0.07, 0.046]} color="#8fd7ff" radius={0.006} roughness={0.5} emissive="#1f77b6" emissiveIntensity={0.12} />
      </group>
      <group position={[-3.16, 0.72, 0.94]} rotation={[0, Math.PI / 2, 0]}>
        <RoundedBlock args={[0.74, 0.05, 0.09]} color="#e4c0aa" radius={0.014} roughness={0.58} />
        {[-0.24, -0.08, 0.1, 0.28].map((x, index) => (
          <RoundedBlock
            key={`left-mini-book-${x}`}
            args={[0.07, 0.2 + index * 0.025, 0.09]}
            position={[x, 0.13 + index * 0.01, 0.03]}
            color={index % 2 ? "#8fd7ff" : "#f5a26d"}
            radius={0.008}
            roughness={0.62}
            opacity={0.88}
          />
        ))}
      </group>
      <group position={[-3.13, 1.84, 0.58]} rotation={[0, Math.PI / 2, 0]}>
        {[0, 1, 2].map((row) =>
          [-0.18, 0.0, 0.18].map((x, column) => (
            <RoundedBlock
              key={`left-shadowbox-${row}-${column}`}
              args={[0.1, 0.1, 0.032]}
              position={[x, row * 0.15, 0.018]}
              color={(row + column) % 2 ? "#f5a26d" : "#8fd7ff"}
              radius={0.018}
              roughness={0.54}
              emissive={(row + column) % 2 ? "#7b2a12" : "#155d83"}
              emissiveIntensity={lightingSet ? 0.12 : 0.05}
              opacity={0.82}
            />
          ))
        )}
      </group>
      <RoundedBlock args={[0.18, 2.84, 0.18]} position={[-3.28, 1.38, -2.03]} color="#543044" radius={0.026} roughness={0.56} metalness={0.1} />
      <RoundedBlock args={[0.18, 2.84, 0.18]} position={[3.18, 1.38, -2.03]} color="#2d2c76" radius={0.026} roughness={0.54} metalness={0.12} />
      <RoundedBlock args={[6.62, 0.14, 0.16]} position={[-0.04, 2.84, -2.03]} color="#282865" radius={0.024} roughness={0.54} metalness={0.08} />
      <RoundedBlock args={[0.16, 0.14, 4.18]} position={[3.2, 2.84, 0.04]} color="#4d1f36" radius={0.024} roughness={0.56} metalness={0.08} />
      <RoundedBlock args={[0.14, 0.14, 4.18]} position={[-3.28, 2.84, 0.04]} color="#684039" radius={0.024} roughness={0.6} metalness={0.04} />

      <RoundedBlock args={[6.54, 0.055, 0.09]} position={[-0.08, 0.32, -1.94]} color="#f1e0dc" radius={0.018} roughness={0.55} />
      <RoundedBlock args={[0.09, 0.055, 4.08]} position={[3.02, 0.32, 0.03]} color="#f1e0dc" radius={0.018} roughness={0.55} />
      <RoundedBlock args={[0.09, 0.055, 4.04]} position={[-3.16, 0.32, 0.02]} color="#ddb0a1" radius={0.018} roughness={0.62} opacity={0.72} />
      <RoundedBlock args={[6.58, 0.035, 0.052]} position={[-0.08, 2.48, -1.955]} color="#e7d2d4" radius={0.012} roughness={0.5} />
      <RoundedBlock args={[0.052, 0.035, 4.02]} position={[3.02, 2.48, 0.04]} color="#f3bac9" radius={0.012} roughness={0.5} emissive="#7b183d" emissiveIntensity={lightingSet ? 0.08 : 0.02} />

      {[-2.34, -1.42, -0.5, 0.42, 1.34, 2.26].map((x, index) => (
        <RoundedBlock
          key={`ceiling-rib-back-${x}`}
          args={[0.045, 0.03, 0.28]}
          position={[x, 2.77, -1.88]}
          color={index % 2 ? "#6ca4d0" : "#d799a6"}
          radius={0.01}
          roughness={0.48}
          opacity={0.26}
        />
      ))}
      {[-1.38, -0.52, 0.34, 1.2].map((z, index) => (
        <RoundedBlock
          key={`ceiling-rib-side-${z}`}
          args={[0.25, 0.03, 0.045]}
          position={[3.04, 2.77, z]}
          color={index % 2 ? "#d76d93" : "#8ecfeb"}
          radius={0.01}
          roughness={0.48}
          opacity={0.22}
        />
      ))}
      <RoundedBlock args={[5.24, 0.018, 0.018]} position={[-0.2, 2.6, -1.86]} color="#99dfff" radius={0.01} roughness={0.44} emissive="#2c94d7" emissiveIntensity={lightingSet ? 0.026 : 0.012} opacity={0.13} />
      <RoundedBlock args={[0.018, 0.018, 3.26]} position={[2.94, 2.6, -0.04]} color="#ff8fb3" radius={0.01} roughness={0.44} emissive="#b91b52" emissiveIntensity={lightingSet ? 0.028 : 0.012} opacity={0.13} />
    </group>
  );
}

function useSoftPatchAlphaMap() {
  return useMemo(() => {
    if (typeof document === "undefined") return null;

    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const context = canvas.getContext("2d");
    if (!context) return null;

    const gradient = context.createRadialGradient(128, 128, 8, 128, 128, 128);
    gradient.addColorStop(0, "rgba(255,255,255,0.86)");
    gradient.addColorStop(0.42, "rgba(255,255,255,0.48)");
    gradient.addColorStop(0.72, "rgba(255,255,255,0.16)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }, []);
}

function BackWallPatch({
  position,
  scale,
  color,
  opacity,
  rotation = 0
}: {
  position: Vec3;
  scale: [number, number];
  color: string;
  opacity: number;
  rotation?: number;
}) {
  const alphaMap = useSoftPatchAlphaMap();

  return (
    <mesh position={position} rotation={[0, 0, rotation]} scale={[scale[0], scale[1], 1]} renderOrder={1}>
      <circleGeometry args={[0.5, 64]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} alphaMap={alphaMap ?? undefined} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  );
}

function SideWallPatch({
  position,
  scale,
  color,
  opacity,
  rotation = 0
}: {
  position: Vec3;
  scale: [number, number];
  color: string;
  opacity: number;
  rotation?: number;
}) {
  const alphaMap = useSoftPatchAlphaMap();

  return (
    <mesh position={position} rotation={[0, Math.PI / 2, rotation]} scale={[scale[0], scale[1], 1]} renderOrder={1}>
      <circleGeometry args={[0.5, 64]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} alphaMap={alphaMap ?? undefined} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  );
}

function RoomShell({ lightingSet, authoredSurfaceActive = false }: { lightingSet: boolean; authoredSurfaceActive?: boolean }) {
  if (authoredSurfaceActive) {
    return (
      <group name="authored-room-shell-cutaway-frame">
        <RoundedBlock args={[6.68, 0.095, 0.13]} position={[0, 0.105, -2.015]} color="#e5d1cf" radius={0.022} roughness={0.62} opacity={0.92} />
        <RoundedBlock args={[0.12, 0.095, 4.12]} position={[3.06, 0.105, 0.02]} color="#e5d1cf" radius={0.022} roughness={0.62} opacity={0.9} />
        <RoundedBlock args={[6.58, 0.115, 0.14]} position={[-0.04, 2.67, -2.025]} color="#2c2f66" radius={0.024} roughness={0.56} metalness={0.08} opacity={0.88} />
        <RoundedBlock args={[0.14, 0.115, 4.02]} position={[3.08, 2.67, 0.02]} color="#5a253b" radius={0.024} roughness={0.58} metalness={0.06} opacity={0.86} />
        <RoundedBlock args={[0.13, 2.42, 0.13]} position={[-3.18, 1.26, -2.02]} color="#c78368" radius={0.022} roughness={0.64} metalness={0.04} opacity={0.9} />
        <RoundedBlock args={[0.13, 2.42, 0.13]} position={[3.1, 1.26, -2.02]} color="#303075" radius={0.022} roughness={0.58} metalness={0.08} opacity={0.88} />
        <RoundedBlock args={[0.12, 2.34, 0.13]} position={[3.08, 1.25, 1.88]} color="#7b3249" radius={0.022} roughness={0.6} metalness={0.05} opacity={0.86} />
        <RoundedBlock args={[6.76, 0.13, 0.16]} position={[0, -0.125, 2.14]} color="#11182a" radius={0.025} roughness={0.58} metalness={0.16} opacity={0.9} />
        <RoundedBlock args={[0.16, 0.13, 4.28]} position={[3.29, -0.125, 0]} color="#11182a" radius={0.025} roughness={0.58} metalness={0.16} opacity={0.88} />
        <RoundedBlock args={[5.58, 0.026, 0.028]} position={[-0.22, 2.55, -1.86]} color="#9fe4ff" radius={0.009} roughness={0.42} emissive="#2c94d7" emissiveIntensity={lightingSet ? 0.02 : 0.008} opacity={0.09} />
        <RoundedBlock args={[0.028, 0.026, 3.26]} position={[2.94, 2.55, -0.04]} color="#ff9ab9" radius={0.009} roughness={0.42} emissive="#b91b52" emissiveIntensity={lightingSet ? 0.02 : 0.008} opacity={0.08} />
        <WindowAssembly />
      </group>
    );
  }

  return (
    <group>
      <FloorPlanks />
      <RoundedBlock args={[6.86, 0.18, 0.16]} position={[0, -0.12, 2.16]} color="#11182a" radius={0.025} roughness={0.55} metalness={0.2} />
      <RoundedBlock args={[0.16, 0.18, 4.44]} position={[3.32, -0.12, 0]} color="#11182a" radius={0.025} roughness={0.55} metalness={0.2} />
      <RoundedBlock args={[5.88, 0.035, 0.052]} position={[-0.2, 2.68, -1.92]} color="#8fd7ff" radius={0.014} roughness={0.44} emissive="#2c7fb6" emissiveIntensity={lightingSet ? 0.1 : 0.04} opacity={0.34} />
      <RoundedBlock args={[0.042, 0.035, 3.18]} position={[3.08, 2.68, 0.02]} color="#f06f9f" radius={0.014} roughness={0.44} emissive="#981d4b" emissiveIntensity={lightingSet ? 0.06 : 0.025} opacity={0.2} />
      <RoundedBlock args={[6.86, 0.16, 0.16]} position={[0, 2.86, -2.08]} color="#25236c" radius={0.022} roughness={0.48} metalness={0.14} />
      <RoundedBlock args={[6.7, 2.88, 0.11]} position={[0, 1.38, -2.1]} color="#967f91" radius={0.018} roughness={0.86} />
      <RoundedBlock args={[0.11, 2.88, 4.35]} position={[3.23, 1.38, 0]} color="#5a2c3c" radius={0.018} roughness={0.86} opacity={0.78} />
      <RoundedBlock args={[6.74, 0.12, 0.13]} position={[0, 0.1, -2.02]} color="#d8c5c7" radius={0.025} roughness={0.6} />
      <RoundedBlock args={[0.14, 0.12, 4.24]} position={[3.08, 0.1, 0.02]} color="#d8c5c7" radius={0.025} roughness={0.6} />
      <RoundedBlock args={[6.68, 0.08, 0.1]} position={[0, 2.74, -2.02]} color="#907f8b" radius={0.018} roughness={0.6} />
      <RoundedBlock args={[0.1, 2.7, 0.12]} position={[-3.24, 1.32, -2.03]} color="#cf7447" radius={0.024} roughness={0.5} />
      <RoundedBlock args={[0.1, 2.7, 0.12]} position={[3.16, 1.32, -2.03]} color="#2b2f77" radius={0.024} roughness={0.5} />
      {[-2.78, -1.72, -0.66, 0.42, 1.5, 2.58].map((x, index) => (
        <RoundedBlock
          key={`back-wall-panel-vertical-${x}`}
          args={[0.018, 2.16, 0.018]}
          position={[x, 1.46, -2.026]}
          color={index % 2 ? "#f3c9d2" : "#d3efff"}
          radius={0.006}
          roughness={0.54}
          opacity={0.007}
          emissive={index % 2 ? "#842142" : "#1e6d9c"}
          emissiveIntensity={lightingSet ? 0.003 : 0.001}
        />
      ))}
      {[0.78, 1.3, 1.84, 2.36].map((y, index) => (
        <RoundedBlock
          key={`back-wall-panel-horizontal-${y}`}
          args={[6.18, 0.018, 0.018]}
          position={[-0.08, y, -2.024]}
          color={index % 2 ? "#efd7dd" : "#d5e7f0"}
          radius={0.006}
          roughness={0.54}
          opacity={0.006}
        />
      ))}
      {[-1.42, -0.44, 0.54, 1.52].map((z, index) => (
        <RoundedBlock
          key={`right-wall-panel-depth-${z}`}
          args={[0.018, 2.08, 0.018]}
          position={[3.172, 1.42, z]}
          color={index % 2 ? "#ffb3c7" : "#bddff0"}
          radius={0.006}
          roughness={0.54}
          opacity={0.007}
          emissive={index % 2 ? "#8a1740" : "#1f668c"}
          emissiveIntensity={lightingSet ? 0.003 : 0.001}
        />
      ))}
      {[0.72, 1.34, 1.96].map((y) => (
        <RoundedBlock
          key={`right-wall-panel-horizontal-${y}`}
          args={[0.018, 0.018, 3.76]}
          position={[3.174, y, 0.02]}
          color="#f3c4d0"
          radius={0.006}
          roughness={0.54}
          opacity={0.005}
        />
      ))}
      <BackWallPatch position={[-0.12, 0.72, -2.032]} scale={[7.0, 1.9]} color="#151016" opacity={0.074} />
      <SideWallPatch position={[3.176, 0.84, 0.16]} scale={[4.8, 2.15]} color="#170811" opacity={0.072} />
      <BackWallPatch position={[-1.08, 1.86, -2.035]} scale={[4.9, 2.2]} color="#4f9dff" opacity={lightingSet ? 0.026 : 0.012} rotation={-0.08} />
      <BackWallPatch position={[2.28, 1.42, -2.03]} scale={[3.35, 2.35]} color="#ff2f73" opacity={lightingSet ? 0.032 : 0.016} rotation={0.12} />
      <SideWallPatch position={[3.178, 1.52, -0.72]} scale={[2.4, 2.05]} color="#7bc8ff" opacity={lightingSet ? 0.03 : 0.014} rotation={-0.08} />
      <SideWallPatch position={[3.18, 1.12, 1.02]} scale={[2.5, 1.76]} color="#ff3d78" opacity={lightingSet ? 0.028 : 0.014} rotation={0.16} />
      <WindowAssembly />
      <RoomCutawayArchitecture lightingSet={lightingSet} />
    </group>
  );
}

function WallDressing({ active }: { active: boolean }) {
  if (!active) return null;

  const noteColors = ["#ffe3a4", "#f4a9bc", "#98d8ff", "#b2e5c5"];

  return (
    <group>
      {[-2.08, -0.74, 0.74, 2.08].map((x) => (
        <RoundedBlock
          key={`rear-panel-v-${x}`}
          args={[0.024, 2.16, 0.028]}
          position={[x, 1.48, -2.012]}
          color="#c7aeb8"
          radius={0.006}
          roughness={0.72}
          opacity={0.018}
        />
      ))}
      {[0.86, 1.63, 2.28].map((y) => (
        <RoundedBlock
          key={`rear-panel-h-${y}`}
          args={[5.78, 0.024, 0.028]}
          position={[-0.08, y, -2.01]}
          color="#d2bcc4"
          radius={0.006}
          roughness={0.72}
          opacity={0.016}
        />
      ))}

      <group position={[-2.48, 1.66, -1.976]}>
        <RoundedBlock args={[0.72, 1.12, 0.035]} color="#6f4b4e" radius={0.024} roughness={0.88} opacity={0.42} />
        {[-0.27, -0.16, -0.05, 0.06, 0.17, 0.28].map((x, index) => (
          <RoundedBlock
            key={`felt-slat-left-${x}`}
            args={[0.034, 0.96, 0.038]}
            position={[x, 0, 0.026]}
            color={index % 2 ? "#80585c" : "#5f4147"}
            radius={0.01}
            roughness={0.9}
            opacity={0.7}
          />
        ))}
        <RoundedBlock args={[0.62, 0.022, 0.025]} position={[0, 0.5, 0.05]} color="#f2c6b6" radius={0.008} roughness={0.58} opacity={0.54} />
        <RoundedBlock args={[0.62, 0.022, 0.025]} position={[0, -0.5, 0.05]} color="#52333a" radius={0.008} roughness={0.66} opacity={0.48} />
      </group>

      <group position={[2.22, 1.08, -1.972]}>
        <RoundedBlock args={[0.96, 0.62, 0.034]} color="#d5c2bc" radius={0.026} roughness={0.68} opacity={0.5} />
        {[-0.36, -0.12, 0.12, 0.36].map((x, index) => (
          <RoundedBlock
            key={`small-art-tile-${x}`}
            args={[0.16, 0.34 + (index % 2) * 0.06, 0.026]}
            position={[x, -0.02 + (index % 2) * 0.05, 0.036]}
            color={index % 2 ? "#8fd7ff" : "#f5a26d"}
            radius={0.018}
            roughness={0.62}
            emissive={index % 2 ? "#174f78" : "#743018"}
            emissiveIntensity={0.08}
            opacity={0.82}
          />
        ))}
      </group>

      <group position={[-1.06, 1.52, -1.965]}>
        <RoundedBlock args={[0.96, 0.62, 0.04]} color="#a56f58" radius={0.025} roughness={0.78} />
        <RoundedBlock args={[1.05, 0.7, 0.045]} position={[0, 0, -0.018]} color="#4a2d24" radius={0.025} roughness={0.65} />
        {[-0.28, -0.08, 0.16, 0.35].map((x, index) => (
          <RoundedBlock
            key={`note-${x}`}
            args={[0.16, 0.12, 0.012]}
            position={[x, 0.1 - index * 0.1, 0.036]}
            rotation={[0, 0, index % 2 ? -0.1 : 0.12]}
            color={noteColors[index % noteColors.length] ?? "#ffe3a4"}
            radius={0.006}
            roughness={0.66}
          />
        ))}
        <RoundedBlock args={[0.64, 0.018, 0.018]} position={[0.04, -0.22, 0.042]} color="#5e392d" radius={0.006} roughness={0.6} />
      </group>

      <group position={[0.48, 1.93, -1.965]}>
        <RoundedBlock args={[0.74, 0.48, 0.045]} color="#f2e4dd" radius={0.022} roughness={0.58} />
        <RoundedBlock args={[0.56, 0.34, 0.02]} position={[0, 0, 0.034]} color="#1a2736" radius={0.012} roughness={0.52} emissive="#203b64" emissiveIntensity={0.16} />
        <RoundedBlock args={[0.22, 0.03, 0.024]} position={[0.14, 0.08, 0.052]} color="#f7c76b" radius={0.006} roughness={0.5} emissive="#7c4e10" emissiveIntensity={0.2} />
        <RoundedBlock args={[0.3, 0.03, 0.024]} position={[-0.06, -0.08, 0.052]} color="#8fd7ff" radius={0.006} roughness={0.5} emissive="#2a8bc8" emissiveIntensity={0.18} />
      </group>

      <group position={[1.48, 2.16, -1.965]}>
        <RoundedBlock args={[1.08, 0.08, 0.12]} color="#e7dfe2" radius={0.025} roughness={0.54} />
        {[-0.38, -0.2, -0.02, 0.2].map((x, index) => (
          <RoundedBlock
            key={`wall-shelf-book-${x}`}
            args={[0.08, 0.28 + index * 0.03, 0.14]}
            position={[x, 0.18 + index * 0.015, 0.04]}
            color={noteColors[(index + 1) % noteColors.length] ?? "#98d8ff"}
            radius={0.01}
            roughness={0.62}
          />
        ))}
        <mesh position={[0.43, 0.18, 0.05]} castShadow>
          <boxGeometry args={[0.2, 0.14, 0.16]} />
          <meshStandardMaterial color="#232a31" roughness={0.54} metalness={0.2} />
        </mesh>
        <mesh position={[0.43, 0.18, 0.14]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.05, 0.05, 0.025, 22]} />
          <meshStandardMaterial color="#0b0d10" roughness={0.48} metalness={0.28} />
        </mesh>
      </group>

      <group position={[3.145, 1.72, 0.62]} rotation={[0, Math.PI / 2, 0]}>
        {[-0.48, 0, 0.48].map((x, index) => (
          <RoundedBlock
            key={`side-acoustic-${x}`}
            args={[0.32, 0.72, 0.035]}
            position={[x, 0, 0]}
            color={index === 1 ? "#7b3d49" : "#8d4754"}
            radius={0.02}
            roughness={0.82}
            opacity={0.74}
          />
        ))}
      </group>
    </group>
  );
}

function WallBakedShadows({ active }: { active: boolean }) {
  if (!active) return null;

  return (
    <group>
      <BackWallPatch position={[-0.38, 0.9, -1.998]} scale={[3.45, 0.92]} color="#160b10" opacity={0.062} rotation={0.02} />
      <BackWallPatch position={[1.1, 1.28, -1.996]} scale={[1.34, 1.58]} color="#13080c" opacity={0.056} rotation={-0.08} />
      <BackWallPatch position={[-2.62, 1.32, -1.997]} scale={[1.1, 2.1]} color="#180b0d" opacity={0.048} rotation={0.1} />
      {Array.from({ length: 9 }, (_, index) => {
        const x = 1.42 + Math.cos(index * 0.92) * 0.28;
        const y = 1.12 + Math.sin(index * 1.28) * 0.22 + index * 0.035;
        return (
          <mesh
            key={`plant-wall-shadow-${index}`}
            position={[x, y, -1.994]}
            rotation={[0, 0, index * 0.44]}
            scale={[1.9, 0.36, 0.2]}
            renderOrder={1}
          >
            <sphereGeometry args={[0.105, 18, 10]} />
            <meshBasicMaterial color="#18271c" transparent opacity={0.13} depthWrite={false} />
          </mesh>
        );
      })}

      <SideWallPatch position={[3.132, 1.04, 0.24]} scale={[2.4, 2.18]} color="#2a0714" opacity={0.035} rotation={0.04} />
      <SideWallPatch position={[3.128, 1.82, -0.56]} scale={[1.18, 1.82]} color="#ff5b94" opacity={0.024} rotation={-0.08} />
      <BackWallPatch position={[0.05, 0.26, -1.994]} scale={[6.35, 0.54]} color="#12070a" opacity={0.056} />
      <SideWallPatch position={[3.127, 0.24, 0.0]} scale={[4.02, 0.48]} color="#15060b" opacity={0.042} />
    </group>
  );
}

function MonitorRig({ mounted }: { mounted: boolean }) {
  if (!mounted) return null;
  return (
    <group position={[-0.36, 0.43, -0.16]}>
      <Suspense fallback={null}>
        <MeshyModel url={MESHY_DESK_MONITOR_URL} position={[-0.18, -0.21, -0.04]} rotation={[0.02, -0.04, 0]} scale={1.22} />
      </Suspense>
      <RoundedBlock args={[1.1, 0.66, 0.07]} position={[-0.2, 0.13, -0.08]} color="#111820" radius={0.035} roughness={0.38} metalness={0.32} />
      <RoundedBlock
        args={[0.96, 0.52, 0.018]}
        position={[-0.2, 0.13, -0.037]}
        color="#f49b52"
        radius={0.012}
        roughness={0.5}
        emissive="#7d320e"
        emissiveIntensity={0.24}
      />
      {[-0.44, -0.2, 0.04, 0.28].map((x) => (
        <RoundedBlock
          key={x}
          args={[0.11, 0.05, 0.02]}
          position={[x, 0.25 - (x + 0.44) * 0.12, -0.02]}
          color="#ffe3a4"
          radius={0.01}
          emissive="#f49b52"
          emissiveIntensity={0.22}
        />
      ))}
      <RoundedBlock args={[0.08, 0.46, 0.07]} position={[-0.2, -0.36, -0.08]} color="#242c34" radius={0.015} roughness={0.44} metalness={0.46} />
      <RoundedBlock args={[0.46, 0.06, 0.3]} position={[-0.2, -0.61, -0.05]} color="#242c34" radius={0.018} roughness={0.44} metalness={0.46} />
      <group position={[0.67, 0.0, 0.03]} rotation={[0.06, -0.16, 0]}>
        <RoundedBlock args={[0.72, 0.43, 0.05]} position={[0, 0.1, 0]} color="#18212b" radius={0.025} roughness={0.4} metalness={0.32} />
        <RoundedBlock args={[0.62, 0.35, 0.018]} position={[0, 0.1, 0.035]} color="#263a4d" radius={0.012} roughness={0.45} emissive="#2f7bb3" emissiveIntensity={0.32} />
        <RoundedBlock args={[0.68, 0.035, 0.46]} position={[0, -0.15, 0.2]} color="#dfe6ef" radius={0.018} roughness={0.5} metalness={0.1} />
      </group>
    </group>
  );
}

function DeskControls({ visible }: { visible: boolean }) {
  if (!visible) return null;

  return (
    <group position={[-0.48, 0.16, 0.16]}>
      <RoundedBlock args={[0.78, 0.045, 0.22]} position={[-0.16, 0, 0]} color="#eef4fb" radius={0.02} roughness={0.46} metalness={0.12} />
      {[-0.46, -0.34, -0.22, -0.1, 0.02, 0.14].map((x) => (
        <RoundedBlock key={x} args={[0.075, 0.018, 0.052]} position={[x, 0.035, -0.02]} color="#cfd8e2" radius={0.008} roughness={0.52} />
      ))}
      <mesh position={[0.49, 0.035, 0.03]} castShadow>
        <sphereGeometry args={[0.1, 28, 16]} />
        <meshStandardMaterial color="#dfe7ef" roughness={0.42} metalness={0.16} />
      </mesh>
      <RoundedBlock args={[0.38, 0.035, 0.28]} position={[0.72, 0.0, -0.04]} color="#1d252f" radius={0.022} roughness={0.52} metalness={0.12} />
      <RoundedBlock args={[0.22, 0.04, 0.12]} position={[-0.98, 0.0, 0.02]} color="#111820" radius={0.02} roughness={0.52} metalness={0.34} />
      <RoundedBlock args={[0.1, 0.18, 0.1]} position={[-1.18, 0.09, 0.0]} color="#20252a" radius={0.024} roughness={0.56} />
      <Suspense fallback={null}>
        <MeshyModel url={MESHY_KEYBOARD_URL} position={[-0.16, 0.045, 0.01]} rotation={[0, -0.06, 0]} scale={0.28} />
        <MeshyModel url={MESHY_MOUSE_URL} position={[0.5, 0.055, 0.04]} rotation={[0, -0.18, 0]} scale={0.22} />
        <MeshyModel url={MESHY_CERAMIC_MUG_URL} position={[-1.17, 0.12, 0.0]} rotation={[0, 0.2, 0]} scale={0.24} />
        <MeshyModel url={MESHY_CABLE_REEL_URL} position={[0.85, 0.045, -0.04]} rotation={[0, -0.28, 0]} scale={0.34} />
      </Suspense>
    </group>
  );
}

function MicrophoneAndLamp({ micVisible, lampVisible }: { micVisible: boolean; lampVisible: boolean }) {
  return (
    <group>
      {micVisible ? (
        <group position={[-1.2, 0.2, 0.17]}>
          <RoundedBlock args={[0.06, 0.72, 0.06]} position={[0, 0.16, 0]} rotation={[0, 0, -0.68]} color="#111820" radius={0.012} roughness={0.52} metalness={0.52} />
          <RoundedBlock args={[0.05, 0.68, 0.05]} position={[0.39, 0.49, 0]} rotation={[0, 0, -0.18]} color="#111820" radius={0.012} roughness={0.52} metalness={0.52} />
          <mesh position={[0.59, 0.2, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.08, 0.08, 0.2, 28]} />
            <meshStandardMaterial color="#1d252d" roughness={0.5} metalness={0.42} />
          </mesh>
        </group>
      ) : null}
      {lampVisible ? (
        <group position={[-1.18, 0.18, -0.2]}>
          <RoundedBlock args={[0.07, 0.46, 0.07]} position={[0, 0.22, 0]} color="#f4f6f8" radius={0.015} roughness={0.34} metalness={0.28} />
          <mesh position={[0.14, 0.53, 0.04]} rotation={[0.36, 0, -0.5]} castShadow>
            <cylinderGeometry args={[0.15, 0.21, 0.21, 32]} />
            <meshStandardMaterial color="#fff0c2" emissive="#ffd580" emissiveIntensity={0.12} roughness={0.38} />
          </mesh>
          <Suspense fallback={null}>
            <MeshyModel url={MESHY_DESK_LAMP_URL} position={[0.08, 0.08, 0.04]} rotation={[0, -0.25, 0]} scale={0.44} />
          </Suspense>
          <pointLight color="#ffd580" intensity={0.28} distance={1.15} position={[0.12, 0.58, 0.08]} />
        </group>
      ) : null}
    </group>
  );
}

function DeskCableDressing({ visible }: { visible: boolean }) {
  if (!visible) return null;

  return (
    <group>
      <mesh position={[1.18, 0.153, 0.17]} rotation={[-Math.PI / 2, 0, -0.08]} renderOrder={3}>
        <planeGeometry args={[1.08, 0.66]} />
        <meshBasicMaterial color="#05070a" transparent opacity={0.22} depthWrite={false} />
      </mesh>
      <RoundedBlock args={[1.56, 0.025, 0.025]} position={[0.34, 0.19, 0.42]} rotation={[0, -0.18, 0]} color="#141a20" radius={0.008} roughness={0.58} metalness={0.18} />
      <RoundedBlock args={[1.18, 0.022, 0.022]} position={[0.76, 0.22, 0.2]} rotation={[0, -0.62, 0]} color="#e7edf2" radius={0.008} roughness={0.52} metalness={0.1} />
      <RoundedBlock args={[1.05, 0.03, 0.055]} position={[0.18, -0.2, 0.46]} color="#111820" radius={0.012} roughness={0.56} metalness={0.2} />
      {[-0.24, 0.08, 0.42].map((x) => (
        <RoundedBlock
          key={`desk-cable-tie-${x}`}
          args={[0.055, 0.05, 0.085]}
          position={[x, -0.18, 0.48]}
          color="#8fd7ff"
          radius={0.01}
          roughness={0.46}
          emissive="#1f77b6"
          emissiveIntensity={0.16}
        />
      ))}
      <RoundedBlock args={[2.36, 0.025, 0.04]} position={[-0.02, -0.03, -0.46]} color="#26313d" radius={0.008} roughness={0.52} metalness={0.18} emissive="#183650" emissiveIntensity={0.18} />
    </group>
  );
}

function DeskMaterialAndClutterPass() {
  const grainColors = ["#b9794d", "#6c3f2b", "#c78355", "#4e2d20", "#a86d45"];

  return (
    <group>
      {[-1.24, -0.78, -0.32, 0.18, 0.7, 1.14].map((x, index) => (
        <RoundedBlock
          key={`desk-top-grain-${x}`}
          args={[0.34 + (index % 3) * 0.12, 0.009, 0.012]}
          position={[x, 0.129, -0.36 + (index % 2) * 0.72]}
          rotation={[0, 0.04 + index * 0.015, 0]}
          color={grainColors[index % grainColors.length] ?? "#9c6040"}
          radius={0.004}
          roughness={0.9}
          opacity={0.28}
        />
      ))}
      {[-1.24, 1.24].map((x) => (
        <RoundedBlock key={`desk-end-cap-${x}`} args={[0.035, 0.022, 0.82]} position={[x, 0.132, 0.0]} color="#5a3424" radius={0.008} roughness={0.76} opacity={0.42} />
      ))}
      <RoundedBlock args={[2.58, 0.012, 0.018]} position={[0.0, 0.138, 0.42]} color="#d59b70" radius={0.006} roughness={0.7} opacity={0.24} />
      <RoundedBlock args={[2.48, 0.01, 0.014]} position={[0.02, 0.141, -0.39]} color="#3f251a" radius={0.005} roughness={0.82} opacity={0.26} />

      <group position={[-0.96, 0.232, 0.2]} rotation={[0, -0.16, 0]}>
        <RoundedBlock args={[0.22, 0.016, 0.15]} color="#f2eadf" radius={0.01} roughness={0.78} />
        <RoundedBlock args={[0.18, 0.008, 0.012]} position={[0, 0.013, -0.045]} color="#d49c6c" radius={0.004} roughness={0.78} />
        <RoundedBlock args={[0.14, 0.008, 0.012]} position={[-0.02, 0.014, 0.018]} color="#768da5" radius={0.004} roughness={0.78} />
      </group>
      <group position={[-0.72, 0.226, 0.35]} rotation={[0, 0.22, 0]}>
        <RoundedBlock args={[0.32, 0.018, 0.18]} color="#10151b" radius={0.018} roughness={0.62} metalness={0.18} />
        <RoundedBlock args={[0.25, 0.009, 0.012]} position={[0.02, 0.018, -0.04]} color="#8fd7ff" radius={0.004} roughness={0.42} emissive="#1f77b6" emissiveIntensity={0.09} />
      </group>
      <group position={[0.26, 0.228, 0.38]} rotation={[0, -0.34, 0]}>
        <RoundedBlock args={[0.36, 0.022, 0.12]} color="#202832" radius={0.018} roughness={0.58} metalness={0.12} />
        <RoundedBlock args={[0.28, 0.01, 0.012]} position={[0, 0.019, 0.025]} color="#f7c76b" radius={0.004} roughness={0.48} emissive="#7c4e10" emissiveIntensity={0.08} />
      </group>
      {[-0.88, -0.62, -0.36, -0.1, 0.16, 0.42].map((x, index) => (
        <RoundedBlock
          key={`desk-mat-stitch-front-${x}`}
          args={[0.08, 0.01, 0.012]}
          position={[x, 0.219, 0.35]}
          color={index % 2 ? "#96a8b8" : "#172334"}
          radius={0.004}
          roughness={0.9}
          opacity={0.58}
        />
      ))}
    </group>
  );
}

function DeskSurfaceStyling({ visible }: { visible: boolean }) {
  if (!visible) return null;

  return (
    <group>
      <DeskMaterialAndClutterPass />
      <RoundedBlock args={[1.62, 0.018, 0.5]} position={[-0.2, 0.19, 0.1]} color="#26313d" radius={0.026} roughness={0.86} metalness={0.02} opacity={0.88} />
      <RoundedBlock args={[1.48, 0.012, 0.035]} position={[-0.22, 0.205, -0.13]} color="#4c6178" radius={0.008} roughness={0.82} opacity={0.48} />
      <RoundedBlock args={[1.48, 0.012, 0.03]} position={[-0.22, 0.205, 0.33]} color="#162437" radius={0.008} roughness={0.88} opacity={0.46} />
      {[-0.62, -0.34, -0.06, 0.22].map((x, index) => (
        <RoundedBlock
          key={`desk-mat-weave-${x}`}
          args={[0.018, 0.011, 0.42]}
          position={[x, 0.213, 0.1 + (index % 2) * 0.01]}
          color={index % 2 ? "#435870" : "#1b2d44"}
          radius={0.004}
          roughness={0.9}
          opacity={0.34}
        />
      ))}
      <group position={[-0.94, 0.22, -0.2]} rotation={[0, -0.08, 0]}>
        <RoundedBlock args={[0.32, 0.03, 0.24]} color="#eee1d4" radius={0.014} roughness={0.72} />
        <RoundedBlock args={[0.28, 0.012, 0.02]} position={[0, 0.026, -0.06]} color="#9f6a45" radius={0.005} roughness={0.7} />
        <RoundedBlock args={[0.2, 0.012, 0.018]} position={[-0.03, 0.028, 0.02]} color="#6f849c" radius={0.005} roughness={0.74} />
      </group>
      <group position={[0.82, 0.215, -0.26]} rotation={[0, 0.22, 0]}>
        <RoundedBlock args={[0.36, 0.038, 0.18]} color="#181f27" radius={0.02} roughness={0.55} metalness={0.24} />
        <RoundedBlock args={[0.26, 0.018, 0.026]} position={[0, 0.036, -0.03]} color="#8fd7ff" radius={0.008} roughness={0.36} emissive="#1f77b6" emissiveIntensity={0.18} />
        <RoundedBlock args={[0.18, 0.018, 0.026]} position={[0.04, 0.038, 0.05]} color="#f66f9a" radius={0.008} roughness={0.36} emissive="#b91b52" emissiveIntensity={0.14} />
      </group>
      <group position={[1.12, -0.19, -0.16]}>
        <RoundedBlock args={[0.62, 0.08, 0.24]} color="#161d24" radius={0.018} roughness={0.6} metalness={0.16} />
        {[-0.2, 0, 0.2].map((x) => (
          <RoundedBlock key={`underdesk-tray-line-${x}`} args={[0.026, 0.09, 0.25]} position={[x, 0.02, 0]} color="#2f3e4a" radius={0.006} roughness={0.58} metalness={0.16} />
        ))}
      </group>
    </group>
  );
}

function DeskCuratedAssetLayer({ visible }: { visible: boolean }) {
  if (!visible) return null;

  return (
    <Suspense fallback={null}>
      <MeshyModel
        url={DETAIL_DESK_TRAY_URL}
        position={[-0.98, 0.235, -0.2]}
        rotation={[0, -0.1, 0]}
        scale={1.65}
        materialTone={{ tint: "#c99162", tintStrength: 0.22, colorScale: 0.94, roughness: 0.78 }}
      />
      <MeshyModel
        url={DETAIL_DESK_PLANTER_URL}
        position={[0.94, 0.232, 0.32]}
        rotation={[0, 0.22, 0]}
        scale={2.42}
        materialTone={{ tint: "#d9e5dd", tintStrength: 0.1, colorScale: 1.02, roughness: 0.82 }}
      />
      <MeshyModel
        url={DETAIL_UNDER_DESK_TRAY_URL}
        position={[1.08, -0.23, -0.16]}
        rotation={[0, 0.02, 0]}
        scale={1.16}
        materialTone={{ tint: "#24313b", tintStrength: 0.18, colorScale: 0.72, roughness: 0.72, metalness: 0.16, opacity: 0.82 }}
      />
    </Suspense>
  );
}

function DeskPcFanFace({ x, y, accent }: { x: number; y: number; accent: string }) {
  return (
    <group position={[x, y, 0.392]}>
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.112, 0.112, 0.018, 36]} />
        <meshStandardMaterial color="#aebfca" roughness={0.5} metalness={0.1} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
        <torusGeometry args={[0.086, 0.009, 8, 36]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.18} roughness={0.42} />
      </mesh>
      {[0, 1, 2].map((index) => (
        <RoundedBlock
          key={`fan-blade-${x}-${y}-${index}`}
          args={[0.095, 0.012, 0.012]}
          position={[Math.cos(index * 2.1) * 0.02, Math.sin(index * 2.1) * 0.02, 0.012]}
          rotation={[0, 0, index * 2.1 + 0.42]}
          color="#9fb3c0"
          radius={0.005}
          roughness={0.5}
          metalness={0.08}
        />
      ))}
      <mesh position={[0, 0, 0.022]} castShadow>
        <sphereGeometry args={[0.026, 18, 12]} />
        <meshStandardMaterial color="#aebdc6" roughness={0.46} metalness={0.12} />
      </mesh>
    </group>
  );
}

function DeskPcShowcaseDetails() {
  return (
    <group>
      <RoundedBlock args={[0.72, 0.86, 0.018]} position={[-0.02, 0.02, 0.388]} color="#9ec3d0" radius={0.022} roughness={0.26} metalness={0.02} opacity={0.11} />
      <RoundedBlock args={[0.76, 0.025, 0.026]} position={[-0.02, 0.47, 0.404]} color="#adbec8" radius={0.008} roughness={0.52} metalness={0.08} opacity={0.54} />
      <RoundedBlock args={[0.76, 0.025, 0.026]} position={[-0.02, -0.42, 0.404]} color="#a6b8c3" radius={0.008} roughness={0.54} metalness={0.08} opacity={0.52} />
      <RoundedBlock args={[0.025, 0.86, 0.026]} position={[-0.42, 0.02, 0.404]} color="#abbcc7" radius={0.008} roughness={0.52} metalness={0.08} opacity={0.54} />
      <RoundedBlock args={[0.025, 0.86, 0.026]} position={[0.38, 0.02, 0.404]} color="#a6b7c1" radius={0.008} roughness={0.54} metalness={0.08} opacity={0.52} />

      <RoundedBlock args={[0.38, 0.46, 0.028]} position={[-0.15, 0.08, 0.412]} color="#253642" radius={0.018} roughness={0.62} metalness={0.22} />
      <RoundedBlock args={[0.18, 0.18, 0.034]} position={[-0.22, 0.22, 0.432]} color="#d9e3ea" radius={0.024} roughness={0.44} metalness={0.24} />
      <mesh position={[-0.22, 0.22, 0.454]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <torusGeometry args={[0.07, 0.009, 8, 32]} />
        <meshStandardMaterial color="#8fd7ff" emissive="#2a8bc8" emissiveIntensity={0.2} roughness={0.42} />
      </mesh>
      <RoundedBlock args={[0.26, 0.052, 0.026]} position={[-0.02, -0.11, 0.438]} color="#aebdc7" radius={0.012} roughness={0.5} metalness={0.12} />
      <RoundedBlock args={[0.34, 0.072, 0.034]} position={[0.03, -0.22, 0.434]} color="#2d3540" radius={0.014} roughness={0.52} metalness={0.38} />
      <RoundedBlock args={[0.28, 0.026, 0.024]} position={[0.03, -0.22, 0.462]} color="#f66f9a" radius={0.008} roughness={0.42} emissive="#b91b52" emissiveIntensity={0.16} />
      {[-0.08, 0.0, 0.08].map((x) => (
        <RoundedBlock
          key={`desk-pc-ram-${x}`}
          args={[0.026, 0.21, 0.024]}
          position={[x, 0.17, 0.454]}
          color="#dbe7ee"
          radius={0.007}
          roughness={0.35}
          metalness={0.12}
          emissive={x === 0 ? "#8fd7ff" : x === 0.08 ? "#f66f9a" : "#f7c76b"}
          emissiveIntensity={0.1}
        />
      ))}
      <RoundedBlock args={[0.46, 0.055, 0.03]} position={[0.02, 0.42, 0.43]} color="#aebdc6" radius={0.012} roughness={0.5} metalness={0.12} />
      {[-0.2, 0.0, 0.2].map((x, index) => (
        <DeskPcFanFace key={`top-fan-${x}`} x={x} y={0.34} accent={index === 1 ? "#f66f9a" : "#8fd7ff"} />
      ))}
      <RoundedBlock args={[0.42, 0.024, 0.022]} position={[-0.02, 0.02, 0.462]} rotation={[0, 0, 0.62]} color="#c6d9e4" radius={0.008} roughness={0.52} metalness={0.16} />
      <RoundedBlock args={[0.36, 0.024, 0.022]} position={[-0.11, 0.02, 0.462]} rotation={[0, 0, 0.92]} color="#d48aa5" radius={0.008} roughness={0.5} metalness={0.06} />
      <RoundedBlock args={[0.08, 0.36, 0.025]} position={[0.31, 0.04, 0.432]} color="#111820" radius={0.01} roughness={0.58} metalness={0.24} />
      <RoundedBlock args={[0.036, 0.34, 0.02]} position={[0.33, 0.04, 0.458]} color="#8fd7ff" radius={0.01} roughness={0.42} emissive="#1f77b6" emissiveIntensity={0.16} />
    </group>
  );
}

function DeskPcExteriorDetails() {
  return (
    <group>
      <RoundedBlock args={[0.68, 0.026, 0.28]} position={[-0.03, 0.535, -0.04]} color="#aebdc7" radius={0.014} roughness={0.56} metalness={0.08} />
      {[-0.28, -0.16, -0.04, 0.08, 0.2].map((x) => (
        <RoundedBlock key={`pc-top-mesh-x-${x}`} args={[0.025, 0.018, 0.24]} position={[x, 0.555, -0.04]} color="#a5bac8" radius={0.005} roughness={0.58} opacity={0.72} />
      ))}
      {[-0.13, -0.05, 0.03, 0.11].map((z) => (
        <RoundedBlock key={`pc-top-mesh-z-${z}`} args={[0.58, 0.018, 0.014]} position={[-0.03, 0.558, z]} color="#bdcbd5" radius={0.005} roughness={0.58} opacity={0.56} />
      ))}
      <RoundedBlock args={[0.1, 0.86, 0.035]} position={[0.455, 0.02, 0.02]} color="#aebdc7" radius={0.018} roughness={0.54} metalness={0.08} opacity={0.58} />
      <RoundedBlock args={[0.035, 0.66, 0.02]} position={[0.505, 0.04, 0.16]} color="#a5b6c0" radius={0.01} roughness={0.52} metalness={0.06} opacity={0.5} />
      <RoundedBlock args={[0.022, 0.72, 0.018]} position={[0.527, 0.05, 0.19]} color="#a5b6c0" radius={0.007} roughness={0.56} opacity={0.48} />
      {[-0.25, 0.25].map((y) => (
        <mesh key={`pc-panel-screw-${y}`} position={[0.398, y, 0.446]} castShadow>
          <sphereGeometry args={[0.018, 14, 8]} />
          <meshStandardMaterial color="#aebdc7" roughness={0.44} metalness={0.22} />
        </mesh>
      ))}
      <RoundedBlock args={[0.18, 0.028, 0.018]} position={[0.488, 0.42, 0.2]} color="#a7bcc8" radius={0.007} roughness={0.48} metalness={0.16} />
      <RoundedBlock args={[0.026, 0.026, 0.02]} position={[0.388, 0.42, 0.2]} color="#8fd7ff" radius={0.012} roughness={0.38} emissive="#1f77b6" emissiveIntensity={0.1} />
      <RoundedBlock args={[0.026, 0.026, 0.02]} position={[0.44, 0.42, 0.2]} color="#f66f9a" radius={0.012} roughness={0.38} emissive="#b91b52" emissiveIntensity={0.09} />
      {[-0.3, 0.32].map((x) => (
        <RoundedBlock key={`pc-foot-${x}`} args={[0.16, 0.055, 0.11]} position={[x, -0.565, 0.04]} color="#aebdc7" radius={0.02} roughness={0.52} metalness={0.1} />
      ))}
    </group>
  );
}

function DeskPcCaseDepthDetails() {
  return (
    <group>
      <RoundedBlock args={[0.84, 0.98, 0.3]} position={[-0.02, 0.01, 0.18]} color="#101923" radius={0.045} roughness={0.72} metalness={0.18} opacity={0.54} />
      <RoundedBlock args={[0.78, 0.9, 0.018]} position={[-0.02, 0.01, 0.506]} color="#071018" radius={0.022} roughness={0.5} metalness={0.08} opacity={0.28} />
      <RoundedBlock args={[0.2, 0.94, 0.26]} position={[0.34, 0.0, 0.16]} color="#182432" radius={0.03} roughness={0.64} metalness={0.18} opacity={0.74} />
      <RoundedBlock args={[0.72, 0.038, 0.28]} position={[-0.02, -0.51, 0.16]} color="#a8b8c2" radius={0.012} roughness={0.56} metalness={0.08} opacity={0.52} />
      <RoundedBlock args={[0.72, 0.036, 0.28]} position={[-0.02, 0.51, 0.16]} color="#adbdc7" radius={0.012} roughness={0.56} metalness={0.08} opacity={0.5} />
      <RoundedBlock args={[0.04, 0.92, 0.28]} position={[-0.46, 0.0, 0.16]} color="#a8b8c2" radius={0.012} roughness={0.54} metalness={0.08} opacity={0.5} />
      <RoundedBlock args={[0.042, 0.88, 0.28]} position={[0.43, 0.01, 0.16]} color="#aabac4" radius={0.012} roughness={0.54} metalness={0.08} opacity={0.48} />
      {[0.18, -0.02, -0.22].map((y, index) => (
        <RoundedBlock
          key={`pc-depth-shadow-slot-${y}`}
          args={[0.58 - index * 0.08, 0.026, 0.02]}
          position={[-0.04, y, 0.336]}
          color="#05070a"
          radius={0.006}
          roughness={0.68}
          metalness={0.1}
          opacity={0.26}
        />
      ))}
    </group>
  );
}

function DeskPcCaseSignatureDetails() {
  return (
    <group>
      <RoundedBlock args={[0.76, 0.9, 0.014]} position={[-0.02, 0.02, 0.474]} color="#061018" radius={0.022} roughness={0.46} metalness={0.08} opacity={0.38} />
      <RoundedBlock args={[0.71, 0.84, 0.012]} position={[-0.02, 0.02, 0.49]} color="#88c7df" radius={0.02} roughness={0.24} metalness={0.04} opacity={0.085} />
      <RoundedBlock args={[0.8, 0.03, 0.03]} position={[-0.02, 0.48, 0.5]} color="#a8b8c2" radius={0.008} roughness={0.56} metalness={0.08} opacity={0.5} />
      <RoundedBlock args={[0.8, 0.03, 0.03]} position={[-0.02, -0.45, 0.5]} color="#9fb1bc" radius={0.008} roughness={0.58} metalness={0.08} opacity={0.48} />
      <RoundedBlock args={[0.03, 0.88, 0.03]} position={[-0.44, 0.02, 0.5]} color="#a6b7c1" radius={0.008} roughness={0.56} metalness={0.08} opacity={0.48} />
      <RoundedBlock args={[0.03, 0.88, 0.03]} position={[0.4, 0.02, 0.5]} color="#a6b7c1" radius={0.008} roughness={0.56} metalness={0.08} opacity={0.48} />

      <RoundedBlock args={[0.45, 0.08, 0.028]} position={[-0.08, 0.38, 0.516]} color="#d9e5ec" radius={0.012} roughness={0.44} metalness={0.16} />
      {[-0.24, -0.08, 0.08].map((x, index) => (
        <group key={`signature-radiator-fan-${x}`} position={[x, 0.38, 0.536]}>
          <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.055, 0.055, 0.014, 30]} />
            <meshStandardMaterial color="#aebdc7" roughness={0.5} metalness={0.08} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
            <torusGeometry args={[0.043, 0.006, 8, 30]} />
            <meshStandardMaterial color={index === 1 ? "#f66f9a" : "#8fd7ff"} emissive={index === 1 ? "#b91b52" : "#1f77b6"} emissiveIntensity={0.16} roughness={0.42} />
          </mesh>
        </group>
      ))}

      <RoundedBlock args={[0.3, 0.48, 0.024]} position={[-0.17, 0.05, 0.516]} color="#1d2b36" radius={0.018} roughness={0.58} metalness={0.22} />
      {[-0.28, -0.19, -0.1, -0.01].map((x, index) => (
        <RoundedBlock
          key={`signature-dimm-${x}`}
          args={[0.024, 0.28, 0.018]}
          position={[x, 0.13, 0.542]}
          color="#adbdc7"
          radius={0.006}
          roughness={0.34}
          metalness={0.12}
          emissive={index % 2 ? "#f66f9a" : "#8fd7ff"}
          emissiveIntensity={0.1}
        />
      ))}
      <RoundedBlock args={[0.34, 0.075, 0.032]} position={[0.08, -0.21, 0.535]} color="#212b35" radius={0.016} roughness={0.5} metalness={0.34} />
      <RoundedBlock args={[0.3, 0.022, 0.018]} position={[0.08, -0.21, 0.56]} color="#f66f9a" radius={0.006} roughness={0.42} emissive="#b91b52" emissiveIntensity={0.14} />
      <RoundedBlock args={[0.5, 0.082, 0.03]} position={[-0.02, -0.37, 0.522]} color="#a9b9c3" radius={0.014} roughness={0.56} metalness={0.08} />
      {[-0.19, -0.1, -0.01, 0.08, 0.17].map((x) => (
        <RoundedBlock key={`signature-cable-comb-${x}`} args={[0.022, 0.18, 0.016]} position={[x, -0.04, 0.56]} color="#9fb1bc" radius={0.006} roughness={0.54} metalness={0.08} />
      ))}
      <RoundedBlock args={[0.44, 0.018, 0.014]} position={[-0.05, 0.01, 0.57]} rotation={[0, 0, 0.72]} color="#8fd7ff" radius={0.006} roughness={0.42} emissive="#1f77b6" emissiveIntensity={0.12} />
      <RoundedBlock args={[0.36, 0.018, 0.014]} position={[-0.11, 0.02, 0.572]} rotation={[0, 0, 1.0]} color="#d48aa5" radius={0.006} roughness={0.42} emissive="#b91b52" emissiveIntensity={0.1} />
    </group>
  );
}

function MeshyPcOnDesk({ visible }: { visible: boolean }) {
  if (!visible) {
    return (
      <RoundedBlock
        args={[1.04, 0.96, 0.62]}
        position={[1.45, 0.54, -0.08]}
        color="#25313d"
        radius={0.045}
        roughness={0.65}
        metalness={0.2}
        opacity={0.34}
      />
    );
  }

  return (
    <group position={[1.52, 0.56, -0.12]} rotation={[0, -0.86, 0]} scale={0.72}>
      <mesh position={[0, -0.52, 0.04]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={4}>
        <planeGeometry args={[0.98, 0.58]} />
        <meshBasicMaterial color="#05070a" transparent opacity={0.28} depthWrite={false} />
      </mesh>
      <mesh position={[0.04, -0.50, 0.1]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={5}>
        <planeGeometry args={[1.08, 0.72]} />
        <meshBasicMaterial color="#76d9ff" transparent opacity={0.018} depthWrite={false} />
      </mesh>
      <RoundedBlock args={[0.94, 1.06, 0.58]} color="#dfe8ec" radius={0.05} roughness={0.58} metalness={0.12} opacity={0.16} />
      <RoundedBlock args={[0.88, 0.98, 0.035]} position={[0, 0, 0.31]} color="#6fbfd8" radius={0.025} roughness={0.28} metalness={0.04} opacity={0.12} />
      <RoundedBlock args={[0.98, 1.1, 0.036]} position={[0.03, 0.0, -0.18]} color="#172334" radius={0.035} roughness={0.58} metalness={0.18} opacity={0.64} />
      <DeskPcCaseDepthDetails />
      <Suspense
        fallback={
          <group position={[0, -0.04, 0]} scale={0.24}>
            <CompletedPcTower />
          </group>
        }
      >
        <MeshyModel
          url={MESHY_PC_BUILD_KIT_URL}
          position={[-0.03, -0.08, -0.02]}
          rotation={[0, 0.18, 0]}
          scale={1.34}
          materialTone={{ tint: "#f8fbff", tintStrength: 0.045, colorScale: 0.96, roughness: 0.58, opacity: 0.92, emissiveIntensity: 0.045 }}
        />
      </Suspense>
      <DeskPcShowcaseDetails />
      <DeskPcCaseSignatureDetails />
      <DeskPcExteriorDetails />
      {[-0.22, 0, 0.22].map((x) => (
        <mesh key={x} position={[x, 0.22, 0.345]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.105, 0.105, 0.03, 30]} />
          <meshStandardMaterial color="#b4c2ca" roughness={0.46} metalness={0.1} />
        </mesh>
      ))}
      {[-0.22, 0, 0.22].map((x) => (
        <mesh key={`ring-${x}`} position={[x, 0.22, 0.365]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <torusGeometry args={[0.081, 0.01, 8, 30]} />
          <meshStandardMaterial color={x === 0 ? "#f66f9a" : "#8fd7ff"} emissive={x === 0 ? "#b91b52" : "#1f77b6"} emissiveIntensity={0.32} roughness={0.36} />
        </mesh>
      ))}
      <RoundedBlock args={[0.045, 0.92, 0.026]} position={[0.43, 0.05, 0.36]} color="#f66f9a" radius={0.012} roughness={0.36} emissive="#b91b52" emissiveIntensity={0.26} />
      <RoundedBlock args={[0.045, 0.92, 0.026]} position={[-0.43, 0.05, 0.36]} color="#8fd7ff" radius={0.012} roughness={0.36} emissive="#1f77b6" emissiveIntensity={0.22} />
      <RoundedBlock args={[0.8, 0.024, 0.018]} position={[-0.02, -0.56, 0.36]} color="#7dc9e8" radius={0.008} roughness={0.42} emissive="#1f77b6" emissiveIntensity={0.055} opacity={0.34} />
      <pointLight color="#8fd7ff" intensity={0.065} distance={0.72} position={[0.1, 0.24, 0.44]} />
      <pointLight color="#ff7aa8" intensity={0.052} distance={0.66} position={[-0.3, -0.12, 0.34]} />
    </group>
  );
}

function PremiumWorkstationHeroAsset() {
  return (
    <Suspense fallback={null}>
      <MeshyModel
        url={PREMIUM_WORKSTATION_HERO_URL}
        position={[0, 0, 0]}
        rotation={[0, 0, 0]}
        scale={1}
        materialTone={{ roughness: 0.72, metalness: 0.04, envMapIntensity: 0.52, emissiveIntensity: 0.08 }}
      />
    </Suspense>
  );
}

function CommercialDeskHeroAsset() {
  const gltf = useGLTF(COMMERCIAL_DESK_HERO_URL);
  const scene = useMemo(() => {
    const cloned = gltf.scene.clone(true);
    cloned.traverse((object) => {
      if (!(object as THREE.Mesh).isMesh) return;
      const mesh = object as THREE.Mesh;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const material = mesh.material;
      if (Array.isArray(material)) {
        material.forEach((item) => {
          if ("envMapIntensity" in item) item.envMapIntensity = 0.72;
        });
        return;
      }
      if (material && "envMapIntensity" in material) material.envMapIntensity = 0.72;
    });
    return cloned;
  }, [gltf.scene]);

  return <primitive object={scene} />;
}

function CommercialDeskAccessoryKitAsset({ hideKeyboardMouse = false }: { hideKeyboardMouse?: boolean }) {
  const gltf = useGLTF(COMMERCIAL_DESK_ACCESSORY_KIT_URL);
  const scene = useMemo(() => {
    const cloned = gltf.scene.clone(true);
    cloned.traverse((object) => {
      if (hideKeyboardMouse) {
        const lowerName = object.name.toLowerCase();
        if (lowerName.includes("keyboard") || lowerName.includes("mouse")) {
          object.visible = false;
          return;
        }
      }
      if (!(object as THREE.Mesh).isMesh) return;
      const mesh = object as THREE.Mesh;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const material = mesh.material;
      const tuneMaterial = (item: THREE.Material) => {
        if ("envMapIntensity" in item) item.envMapIntensity = 0.82;
        if ("roughness" in item && typeof item.roughness === "number") item.roughness = Math.max(0.32, item.roughness);
      };
      if (Array.isArray(material)) {
        material.forEach(tuneMaterial);
        return;
      }
      if (material) tuneMaterial(material);
    });
    return cloned;
  }, [gltf.scene, hideKeyboardMouse]);

  return <primitive object={scene} />;
}

function MechanicalKeyboardSwitchLabAsset({
  visible,
  selectedSwitch,
  pressedTargetId,
  onPress
}: {
  visible: boolean;
  selectedSwitch: KeyboardSwitchKind;
  pressedTargetId: string | null;
  onPress: (targetId: string) => void;
}) {
  const gltf = useGLTF(MECHANICAL_KEYBOARD_SWITCH_LAB_URL);
  const scene = useMemo(() => {
    const cloned = gltf.scene.clone(true);
    cloned.traverse((object) => {
      if (!(object as THREE.Mesh).isMesh) return;
      const mesh = object as THREE.Mesh;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.forEach((material) => {
        if (!material) return;
        if ("envMapIntensity" in material) material.envMapIntensity = 0.92;
        if ("roughness" in material && typeof material.roughness === "number") material.roughness = Math.max(0.28, material.roughness);
      });
    });
    return cloned;
  }, [gltf.scene]);

  if (!visible) return null;

  return (
    <group>
      <primitive object={scene} />
      {MECHANICAL_KEYBOARD_PRESS_TARGETS.map((target) => {
        const isPressed = pressedTargetId === target.id;
        return (
          <group key={target.id}>
            <mesh
              position={target.position}
              onPointerDown={(event) => {
                event.stopPropagation();
                onPress(target.id);
              }}
              onClick={(event) => {
                event.stopPropagation();
              }}
            >
              <boxGeometry args={[target.size[0], target.size[1], target.size[2]]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
            {isPressed ? (
              <RoundedBlock
                args={[target.size[0], 0.003, target.size[2]]}
                position={[target.position[0], target.position[1] - 0.017, target.position[2]]}
                color={selectedSwitch === "clicky-blue" ? "#7cc7ff" : selectedSwitch === "tactile-brown" ? "#d8a06a" : "#ff8782"}
                radius={0.003}
                roughness={0.45}
                emissive={selectedSwitch === "clicky-blue" ? "#4ba9ff" : "#ff8b73"}
                emissiveIntensity={0.35}
                opacity={0.44}
              />
            ) : null}
          </group>
        );
      })}
    </group>
  );
}

function DeskAssembly({
  pcPlacedOnDesk,
  monitorMounted,
  keyboardMousePlaced,
  microphoneArmClamped,
  lampPositioned,
  authoredHeroActive = false,
  selectedKeyboardSwitch,
  pressedKeyboardTargetId,
  onKeyboardPress
}: {
  pcPlacedOnDesk: boolean;
  monitorMounted: boolean;
  keyboardMousePlaced: boolean;
  microphoneArmClamped: boolean;
  lampPositioned: boolean;
  authoredHeroActive?: boolean;
  selectedKeyboardSwitch: KeyboardSwitchKind;
  pressedKeyboardTargetId: string | null;
  onKeyboardPress: (targetId: string) => void;
}) {
  const workstationHeroActive =
    ENABLE_PREMIUM_WORKSTATION_HERO &&
    authoredHeroActive &&
    pcPlacedOnDesk &&
    monitorMounted &&
    keyboardMousePlaced &&
    microphoneArmClamped &&
    lampPositioned;
  const commercialDeskAccessoryKitActive =
    authoredHeroActive &&
    !workstationHeroActive &&
    monitorMounted &&
    keyboardMousePlaced &&
    microphoneArmClamped &&
    lampPositioned;
  const mechanicalKeyboardActive = keyboardMousePlaced;

  return (
    <group position={[-0.72, 0.72, -0.86]}>
      {workstationHeroActive ? <PremiumWorkstationHeroAsset /> : null}
      {authoredHeroActive && !workstationHeroActive ? (
        <Suspense fallback={null}>
          <CommercialDeskHeroAsset />
        </Suspense>
      ) : null}
      {authoredHeroActive || workstationHeroActive ? null : (
        <Suspense fallback={null}>
          <MeshyModel
            url={DETAIL_DESK_URL}
            position={[0, -0.56, 0]}
            rotation={[0, 0, 0]}
            scale={[2.42, 1.15, 1.42]}
            materialTone={{ tint: "#a96f48", tintStrength: 0.18, colorScale: 0.9, roughness: 0.78, metalness: 0.08, opacity: 0.92 }}
          />
        </Suspense>
      )}
      {authoredHeroActive || workstationHeroActive ? null : (
        <>
          <RoundedBlock args={[2.95, 0.14, 0.94]} color="#835233" radius={0.035} roughness={0.7} metalness={0.05} />
          <RoundedBlock args={[2.72, 0.035, 0.78]} position={[0, 0.095, 0]} color="#a9693f" radius={0.018} roughness={0.66} metalness={0.03} />
          <RoundedBlock args={[2.58, 0.018, 0.035]} position={[0, 0.125, -0.43]} color="#4a2c1f" radius={0.01} roughness={0.74} metalness={0.02} />
          <RoundedBlock args={[0.035, 0.018, 0.72]} position={[-1.32, 0.126, 0]} color="#5b3424" radius={0.01} roughness={0.74} metalness={0.02} />
          {[-1.22, 1.22].map((x) =>
            [-0.34, 0.34].map((z) => (
              <RoundedBlock key={`${x}-${z}`} args={[0.09, 0.9, 0.09]} position={[x, -0.47, z]} color="#1b2027" radius={0.018} roughness={0.52} metalness={0.38} />
            ))
          )}
          <group position={[-1.04, -0.28, 0.36]}>
            <RoundedBlock args={[0.56, 0.62, 0.36]} color="#e6dce1" radius={0.025} roughness={0.55} metalness={0.08} />
            {[-0.19, 0, 0.19].map((y) => (
              <RoundedBlock key={y} args={[0.48, 0.025, 0.04]} position={[0, y, 0.2]} color="#242c34" radius={0.01} roughness={0.48} metalness={0.25} />
            ))}
          </group>
        </>
      )}
      {workstationHeroActive ? null : (
        <>
          {commercialDeskAccessoryKitActive ? (
            <Suspense fallback={null}>
              <CommercialDeskAccessoryKitAsset hideKeyboardMouse={mechanicalKeyboardActive} />
            </Suspense>
          ) : null}
          <MonitorRig mounted={!commercialDeskAccessoryKitActive && monitorMounted} />
          <DeskControls visible={!commercialDeskAccessoryKitActive && keyboardMousePlaced && !mechanicalKeyboardActive} />
          <Suspense fallback={null}>
            <MechanicalKeyboardSwitchLabAsset
              visible={mechanicalKeyboardActive}
              selectedSwitch={selectedKeyboardSwitch}
              pressedTargetId={pressedKeyboardTargetId}
              onPress={onKeyboardPress}
            />
          </Suspense>
          <MicrophoneAndLamp micVisible={!commercialDeskAccessoryKitActive && microphoneArmClamped} lampVisible={!commercialDeskAccessoryKitActive && lampPositioned} />
          <MeshyPcOnDesk visible={pcPlacedOnDesk} />
          <DeskCableDressing visible={!commercialDeskAccessoryKitActive && (monitorMounted || pcPlacedOnDesk || keyboardMousePlaced)} />
          <DeskSurfaceStyling visible={!commercialDeskAccessoryKitActive && (monitorMounted || keyboardMousePlaced || pcPlacedOnDesk)} />
          <DeskCuratedAssetLayer visible={!commercialDeskAccessoryKitActive && (monitorMounted || keyboardMousePlaced || pcPlacedOnDesk)} />
          <mesh position={[0.12, 0.19, 0.48]} rotation={[0.02, 0, 0]} castShadow>
            <boxGeometry args={[1.45, 0.018, 0.03]} />
            <meshStandardMaterial color="#28313b" roughness={0.5} metalness={0.25} />
          </mesh>
        </>
      )}
    </group>
  );
}

function ShelfMicroDetails({ styled }: { styled: boolean }) {
  if (!styled) return null;

  const labelColors = ["#f4d8c8", "#d8eef8", "#f7e6a8", "#c7e8d1"];

  return (
    <group>
      {[0.54, 1.08, 1.62].map((y) => (
        <RoundedBlock
          key={`shelf-under-shadow-${y}`}
          args={[1.28, 0.018, 0.032]}
          position={[0.01, y - 0.062, 0.22]}
          color="#2a1c1a"
          radius={0.006}
          roughness={0.82}
          opacity={0.22}
        />
      ))}
      {[-0.46, -0.31, -0.18, -0.04, 0.15, 0.29, 0.42].map((x, index) => (
        <RoundedBlock
          key={`upper-book-label-${x}`}
          args={[0.052, 0.012, 0.012]}
          position={[x, 0.23 + (index % 3) * 0.04, 0.167]}
          color={labelColors[index % labelColors.length] ?? "#f4d8c8"}
          radius={0.003}
          roughness={0.68}
          opacity={0.84}
        />
      ))}
      {[-0.44, -0.27, -0.1, 0.09, 0.3].map((x, index) => (
        <RoundedBlock
          key={`lower-book-label-${x}`}
          args={[0.058, 0.012, 0.012]}
          position={[x, 1.34 + index * 0.012, 0.167]}
          color={labelColors[(index + 1) % labelColors.length] ?? "#d8eef8"}
          radius={0.003}
          roughness={0.68}
          opacity={0.78}
        />
      ))}
      <group position={[0.2, 0.64, 0.12]} rotation={[0, -0.22, 0]}>
        <RoundedBlock args={[0.34, 0.095, 0.24]} color="#f1e8de" radius={0.018} roughness={0.66} />
        <RoundedBlock args={[0.28, 0.018, 0.018]} position={[0, 0.056, 0.08]} color="#d59b70" radius={0.005} roughness={0.68} />
        <RoundedBlock args={[0.2, 0.014, 0.014]} position={[-0.03, 0.057, -0.01]} color="#6f849c" radius={0.005} roughness={0.72} />
      </group>
      <group position={[-0.47, 1.55, 0.09]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.09, 0.12, 0.16, 20]} />
          <meshStandardMaterial color="#1f2a25" roughness={0.62} metalness={0.04} />
        </mesh>
        {[0, 1, 2, 3].map((index) => (
          <mesh
            key={`shelf-trailing-leaf-${index}`}
            position={[0.06 + index * 0.045, 0.12 + index * 0.035, 0.03 - index * 0.01]}
            rotation={[0.55, index * 0.65, 0.28]}
            scale={[1.25, 0.22, 0.64]}
            castShadow
          >
            <sphereGeometry args={[0.052, 16, 10]} />
            <meshStandardMaterial color={index % 2 ? "#4a936b" : "#367a58"} roughness={0.82} metalness={0.02} />
          </mesh>
        ))}
      </group>
      <group position={[0.44, 0.15, 0.13]} rotation={[0, 0.18, 0]}>
        <RoundedBlock args={[0.18, 0.14, 0.16]} color="#202832" radius={0.022} roughness={0.54} metalness={0.18} />
        <mesh position={[0, 0.005, 0.09]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.04, 0.04, 0.02, 22]} />
          <meshStandardMaterial color="#0d1014" roughness={0.46} metalness={0.26} />
        </mesh>
      </group>
    </group>
  );
}

function ShelfAndDecor({
  styled,
  collectiblesStacked,
  curatedOnly = false
}: {
  styled: boolean;
  collectiblesStacked: boolean;
  curatedOnly?: boolean;
}) {
  if (!styled && !collectiblesStacked) return null;

  if (curatedOnly) {
    return null;
  }

  const bookColors = ["#f66f9a", "#8fd7ff", "#f7c76b", "#7de0aa", "#6f5bd9", "#e98955"];

  return (
    <group position={[-2.75, 0.72, -1.52]}>
      <Suspense fallback={null}>
        <MeshyModel
          url={DETAIL_SHELVES_URL}
          position={[-0.04, -0.67, 0.02]}
          rotation={[0, 0.02, 0]}
          scale={0.66}
          materialTone={{ tint: "#f0e4df", tintStrength: 0.16, colorScale: 0.86, roughness: 0.72, metalness: 0.08, opacity: 0.82 }}
        />
        <MeshyModel
          url={KENNEY_BOOKCASE_URL}
          position={[0.0, 0.64, -0.015]}
          rotation={[0, 0.01, 0]}
          scale={[1.42, 1.58, 1.18]}
          materialTone={{ tint: "#f1dfd6", tintStrength: 0.3, colorScale: 0.76, roughness: 0.78, metalness: 0.02, opacity: 0.42 }}
        />
      </Suspense>
      {[-0.62, 0.62].map((x) => (
        <RoundedBlock key={x} args={[0.1, 2.18, 0.18]} position={[x, 0.48, 0]} color="#b8683e" radius={0.025} roughness={0.58} />
      ))}
      {[0.0, 0.54, 1.08, 1.62].map((y) => (
        <RoundedBlock key={y} args={[1.45, 0.08, 0.42]} position={[0, y, 0]} color="#ebe5e4" radius={0.018} roughness={0.56} />
      ))}
      <RoundedBlock args={[0.78, 0.48, 0.32]} position={[0.03, 0.77, 0.02]} color="#dfd2d6" radius={0.024} roughness={0.58} />
      <ShelfMicroDetails styled={styled} />
      {styled
        ? [-0.45, -0.33, -0.2, -0.07, 0.12, 0.26, 0.39].map((x, index) => (
            <RoundedBlock
              key={x}
              args={[0.09, 0.32 + (index % 3) * 0.08, 0.24]}
              position={[x, 0.18 + (index % 3) * 0.04, 0.04]}
              color={bookColors[index % bookColors.length] ?? "#8fd7ff"}
              radius={0.012}
              roughness={0.62}
            />
          ))
        : null}
      {styled
        ? [-0.42, -0.25, -0.08, 0.09, 0.29].map((x, index) => (
            <RoundedBlock
              key={`lower-${x}`}
              args={[0.1, 0.38 + index * 0.02, 0.24]}
              position={[x, 1.27 + index * 0.01, 0.04]}
              color={bookColors[(index + 2) % bookColors.length] ?? "#f7c76b"}
              radius={0.012}
              roughness={0.62}
            />
          ))
        : null}
      {styled ? (
        <Suspense fallback={null}>
          <MeshyModel url={MESHY_BOOK_STACK_URL} position={[-0.26, 0.66, 0.08]} rotation={[0, 0.15, 0]} scale={0.42} />
        </Suspense>
      ) : null}
      {collectiblesStacked ? (
        <group position={[-0.05, 1.78, 0.03]} scale={0.82}>
          <Suspense
            fallback={
              <group>
                {[
                  [-0.22, 0, "#395bd9"],
                  [0, 0, "#f66f9a"],
                  [0.22, 0, "#f7c76b"],
                  [-0.1, 0.18, "#7de0aa"],
                  [0.14, 0.2, "#8fd7ff"],
                  [0.03, 0.39, "#f18c4e"]
                ].map(([x, y, color]) => (
                  <mesh key={`${x}-${y}-${color}`} position={[Number(x), Number(y), 0]} castShadow>
                    <sphereGeometry args={[0.12, 22, 16]} />
                    <meshStandardMaterial color={String(color)} roughness={0.58} metalness={0.08} />
                  </mesh>
                ))}
              </group>
            }
          >
            <MeshyModel url={MESHY_ROOM_DECOR_URL} position={[0.02, 0.08, 0.02]} rotation={[0, -0.22, 0]} scale={3.55} />
          </Suspense>
        </group>
      ) : null}
      {styled ? (
        <group position={[0.46, 1.29, 0.03]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.09, 0.12, 0.18, 18]} />
            <meshStandardMaterial color="#202b23" roughness={0.56} metalness={0.08} />
          </mesh>
          {[0, 1, 2, 3, 4].map((index) => (
            <mesh
              key={index}
              position={[Math.cos(index * 1.2) * 0.11, 0.17 + index * 0.015, Math.sin(index * 1.2) * 0.08]}
              rotation={[0.4, index * 0.5, 0.3]}
              scale={[1.5, 0.26, 0.72]}
              castShadow
            >
              <sphereGeometry args={[0.07, 18, 12]} />
              <meshStandardMaterial color="#3a8c67" roughness={0.76} metalness={0.02} />
            </mesh>
          ))}
        </group>
      ) : null}
    </group>
  );
}

function RoomPlant({ visible }: { visible: boolean }) {
  if (!visible) return null;

  return (
    <group position={[1.52, 0.38, -1.64]} scale={0.9}>
      <Suspense fallback={null}>
        <MeshyModel url={MESHY_IVY_PLANTER_URL} position={[0.02, -0.11, 0.02]} rotation={[0, -0.28, 0]} scale={3.7} />
        <MeshyModel
          url={KENNEY_POTTED_PLANT_URL}
          position={[0.08, -0.22, 0.04]}
          rotation={[0, 0.16, 0]}
          scale={[1.14, 1.08, 1.14]}
          materialTone={{ tint: "#5d8c63", tintStrength: 0.28, colorScale: 0.72, roughness: 0.84, metalness: 0.02, opacity: 0.58 }}
        />
      </Suspense>
      <mesh castShadow>
        <cylinderGeometry args={[0.17, 0.24, 0.32, 22]} />
        <meshStandardMaterial color="#4b332e" roughness={0.72} metalness={0.04} />
      </mesh>
      <mesh position={[0, 0.36, 0]} rotation={[0.25, 0, -0.12]} castShadow>
        <cylinderGeometry args={[0.026, 0.044, 0.78, 12]} />
        <meshStandardMaterial color="#31593f" roughness={0.74} />
      </mesh>
      {Array.from({ length: 12 }, (_, index) => {
        const angle = (index / 12) * Math.PI * 2;
        const y = 0.78 + (index % 3) * 0.08;
        return (
          <mesh
            key={index}
            position={[Math.cos(angle) * 0.23, y, Math.sin(angle) * 0.2]}
            rotation={[0.48, angle, index % 2 ? -0.35 : 0.35]}
            scale={[2.2, 0.22, 0.82]}
            castShadow
          >
            <sphereGeometry args={[0.12, 22, 14]} />
            <meshStandardMaterial color={index % 2 ? "#4f9b73" : "#3d815f"} roughness={0.78} metalness={0.02} />
          </mesh>
        );
      })}
    </group>
  );
}

function FloorShadow({
  args,
  position,
  rotation = 0,
  opacity = 0.18
}: {
  args: [number, number];
  position: [number, number];
  rotation?: number;
  opacity?: number;
}) {
  const alphaMap = useSoftPatchAlphaMap();

  return (
    <mesh position={[position[0], 0.046, position[1]]} rotation={[-Math.PI / 2, 0, rotation]} scale={[args[0], args[1], 1]} renderOrder={2}>
      <circleGeometry args={[0.5, 56]} />
      <meshBasicMaterial color="#05070a" transparent opacity={opacity} alphaMap={alphaMap ?? undefined} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  );
}

function FloorColorPatch({
  args,
  position,
  color,
  opacity,
  rotation = 0
}: {
  args: [number, number];
  position: [number, number];
  color: string;
  opacity: number;
  rotation?: number;
}) {
  const alphaMap = useSoftPatchAlphaMap();

  return (
    <mesh position={[position[0], 0.075, position[1]]} rotation={[-Math.PI / 2, 0, rotation]} scale={[args[0], args[1], 1]} renderOrder={2}>
      <circleGeometry args={[0.5, 56]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} alphaMap={alphaMap ?? undefined} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  );
}

function RoomBakedShadows() {
  return (
    <group>
      <FloorShadow args={[1.42, 0.72]} position={[-2.75, -1.48]} opacity={0.16} />
      <FloorShadow args={[3.24, 1.06]} position={[-0.72, -0.82]} opacity={0.14} />
      <FloorShadow args={[1.1, 0.98]} position={[0.38, -0.05]} rotation={0.28} opacity={0.15} />
      <FloorShadow args={[2.2, 0.92]} position={[-1.45, 1.2]} opacity={0.17} />
      <FloorShadow args={[1.7, 0.54]} position={[1.95, -1.72]} opacity={0.13} />
      <FloorShadow args={[1.2, 0.52]} position={[2.46, 0.46]} rotation={Math.PI / 2} opacity={0.13} />
      <FloorShadow args={[6.25, 0.48]} position={[-0.06, -1.82]} opacity={0.12} />
      <FloorShadow args={[0.5, 3.7]} position={[2.78, 0.02]} rotation={Math.PI / 2} opacity={0.12} />
      <FloorShadow args={[1.46, 0.52]} position={[1.2, 0.24]} rotation={-0.4} opacity={0.12} />
    </group>
  );
}

function RoomCinematicContactOcclusionPass({ active }: { active: boolean }) {
  return (
    <group name="room-cinematic-contact-occlusion-pass">
      <FloorShadow args={[2.96, 0.6]} position={[-0.62, -0.92]} opacity={active ? 0.19 : 0.13} />
      <FloorShadow args={[0.82, 0.34]} position={[-1.78, -0.48]} rotation={0.06} opacity={active ? 0.16 : 0.1} />
      <FloorShadow args={[0.72, 0.3]} position={[0.56, -0.44]} rotation={-0.12} opacity={active ? 0.14 : 0.09} />
      <FloorShadow args={[1.5, 0.74]} position={[1.92, -1.54]} opacity={active ? 0.17 : 0.11} />
      <FloorShadow args={[1.92, 0.56]} position={[-2.72, -1.5]} opacity={active ? 0.18 : 0.12} />
      <FloorShadow args={[1.42, 0.52]} position={[-1.54, 1.16]} opacity={active ? 0.2 : 0.14} />
      <FloorShadow args={[1.16, 0.48]} position={[0.32, 1.04]} rotation={-0.08} opacity={active ? 0.18 : 0.12} />
      <FloorShadow args={[0.7, 0.42]} position={[1.34, -0.62]} rotation={0.18} opacity={active ? 0.13 : 0.09} />
      <FloorColorPatch args={[2.2, 0.72]} position={[-1.18, -0.18]} color="#ffd3a4" opacity={active ? 0.009 : 0.005} rotation={-0.16} />
      <FloorColorPatch args={[2.15, 0.88]} position={[1.72, -0.22]} color="#7fcfff" opacity={active ? 0.007 : 0.004} rotation={0.24} />
      <BackWallPatch position={[-0.72, 0.88, -1.968]} scale={[5.3, 0.96]} color="#09070a" opacity={active ? 0.052 : 0.034} rotation={0.02} />
      <BackWallPatch position={[-0.86, 2.08, -1.966]} scale={[4.2, 0.72]} color="#05070a" opacity={active ? 0.032 : 0.02} rotation={-0.04} />
      <SideWallPatch position={[3.108, 0.78, 0.28]} scale={[3.8, 0.92]} color="#070509" opacity={active ? 0.044 : 0.028} rotation={-0.02} />
      <SideWallPatch position={[3.106, 2.0, -0.16]} scale={[3.1, 0.7]} color="#05070a" opacity={active ? 0.026 : 0.018} rotation={0.04} />
    </group>
  );
}

function RoomMaterialDepthPass({ active }: { active: boolean }) {
  return (
    <group>
      <BackWallPatch position={[-0.28, 1.62, -1.991]} scale={[5.85, 2.24]} color="#fff0df" opacity={active ? 0.016 : 0.01} rotation={-0.03} />
      <BackWallPatch position={[0.72, 0.74, -1.992]} scale={[5.7, 1.08]} color="#160c0c" opacity={active ? 0.03 : 0.024} rotation={0.02} />
      <SideWallPatch position={[3.129, 1.46, 0.12]} scale={[3.95, 2.18]} color="#ffced8" opacity={active ? 0.014 : 0.008} rotation={0.04} />
      <SideWallPatch position={[3.126, 0.7, 0.22]} scale={[3.86, 0.92]} color="#14070b" opacity={active ? 0.032 : 0.024} rotation={-0.03} />
      <FloorColorPatch args={[4.7, 1.55]} position={[-0.72, -0.34]} color="#ffd7a3" opacity={active ? 0.008 : 0.005} rotation={-0.12} />
      <FloorColorPatch args={[2.85, 1.22]} position={[1.68, 0.5]} color="#7fcfff" opacity={active ? 0.006 : 0.004} rotation={0.18} />
      <FloorShadow args={[6.08, 0.34]} position={[-0.12, -1.78]} opacity={active ? 0.068 : 0.052} />
      <FloorShadow args={[0.38, 3.62]} position={[2.78, 0.08]} rotation={Math.PI / 2} opacity={active ? 0.064 : 0.048} />
      <RoundedBlock args={[6.32, 0.026, 0.022]} position={[-0.1, 0.365, -1.948]} color="#2a1718" radius={0.008} roughness={0.82} opacity={0.18} />
      <RoundedBlock args={[0.024, 0.026, 3.86]} position={[3.015, 0.365, 0.05]} color="#271018" radius={0.008} roughness={0.82} opacity={0.16} />
      <RoundedBlock args={[5.86, 0.028, 0.018]} position={[-0.2, 2.525, -1.942]} color="#eef1f3" radius={0.008} roughness={0.58} opacity={0.16} />
      <RoundedBlock args={[0.018, 0.028, 3.66]} position={[2.992, 2.525, 0.02]} color="#ffd3dc" radius={0.008} roughness={0.58} opacity={0.12} />
    </group>
  );
}

function RoomLightCast({ active }: { active: boolean }) {
  if (!active) return null;

  return (
    <group>
      <FloorColorPatch args={[2.35, 0.8]} position={[1.82, 0.18]} color="#8fd7ff" opacity={0.009} rotation={-0.28} />
      <FloorColorPatch args={[1.7, 0.62]} position={[2.3, -0.52]} color="#ff8fb3" opacity={0.008} rotation={-0.14} />
      <BackWallPatch position={[1.84, 1.08, -1.992]} scale={[1.9, 1.25]} color="#ff7fa8" opacity={0.022} rotation={-0.08} />
      <BackWallPatch position={[-1.7, 1.26, -1.993]} scale={[1.82, 1.16]} color="#8fd7ff" opacity={0.02} rotation={0.12} />
    </group>
  );
}

function WallPlasterSofteningPass({ active, authoredSurfaceActive = false }: { active: boolean; authoredSurfaceActive?: boolean }) {
  return (
    <group>
      {!authoredSurfaceActive ? (
        <RoundedBlock
          args={[5.96, 0.038, 3.5]}
          position={[-0.02, 2.715, -0.08]}
          color="#6c5a78"
          radius={0.024}
          roughness={0.88}
          metalness={0}
          opacity={active ? 0.15 : 0.1}
        />
      ) : null}
      <RoundedBlock
        args={[6.12, 2.22, 0.018]}
        position={[-0.1, 1.48, -1.988]}
        color={active ? "#bca4b4" : "#a58f9e"}
        radius={0.018}
        roughness={0.94}
        metalness={0}
        opacity={authoredSurfaceActive ? (active ? 0.045 : 0.028) : active ? 0.32 : 0.2}
      />
      {!authoredSurfaceActive ? (
        <RoundedBlock
          args={[0.018, 2.18, 3.68]}
          position={[3.125, 1.46, 0.03]}
          color={active ? "#73394f" : "#633243"}
          radius={0.018}
          roughness={0.92}
          metalness={0}
          opacity={active ? 0.24 : 0.16}
        />
      ) : null}
      <BackWallPatch position={[-0.76, 1.54, -1.976]} scale={[5.4, 2.2]} color="#ffe5d6" opacity={authoredSurfaceActive ? (active ? 0.01 : 0.007) : active ? 0.018 : 0.012} rotation={-0.04} />
      <BackWallPatch position={[1.94, 1.24, -1.974]} scale={[2.5, 1.75]} color="#ff709d" opacity={authoredSurfaceActive ? (active ? 0.011 : 0.007) : active ? 0.018 : 0.012} rotation={0.1} />
      <SideWallPatch position={[3.115, 1.42, 0.18]} scale={[3.3, 2.15]} color="#ffb3ca" opacity={authoredSurfaceActive ? (active ? 0.002 : 0.0015) : active ? 0.014 : 0.01} rotation={0.05} />
    </group>
  );
}

function CeilingPendant({ active }: { active: boolean }) {
  return (
    <group position={[-0.82, 2.18, -0.92]}>
      <Suspense fallback={null}>
        <MeshyModel
          url={DETAIL_CEILING_LAMP_URL}
          position={[0, 0, 0]}
          rotation={[0, -0.22, 0]}
          scale={0.36}
          materialTone={{ tint: "#f2ddca", tintStrength: 0.16, colorScale: 0.68, roughness: 0.66, metalness: 0.08 }}
        />
      </Suspense>
      <mesh position={[0, -0.12, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={4}>
        <circleGeometry args={[0.34, 48]} />
        <meshBasicMaterial color="#ffd79a" transparent opacity={active ? 0.018 : 0.012} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <pointLight color="#ffd79a" intensity={active ? 0.075 : 0.04} distance={1.35} position={[0, -0.18, 0.04]} />
    </group>
  );
}

function WallPracticalLights({ active }: { active: boolean }) {
  return (
    <group>
      <group position={[-2.64, 1.75, -1.95]}>
        <Suspense fallback={null}>
          <MeshyModel
            url={DETAIL_WALL_SCONCE_URL}
            position={[0, 0, 0]}
            rotation={[0, 0.02, 0]}
            scale={0.11}
            materialTone={{
              tint: "#d4a477",
              tintStrength: 0.18,
              colorScale: 0.28,
              roughness: 0.72,
              metalness: 0.12,
              opacity: 0.38,
              emissiveIntensity: 0.006
            }}
          />
          <MeshyModel
            url={KENNEY_WALL_LAMP_URL}
            position={[0.02, -0.08, 0.01]}
            rotation={[0, -0.04, 0]}
            scale={0.34}
            materialTone={{ tint: "#f0c28d", tintStrength: 0.24, colorScale: 0.34, roughness: 0.78, metalness: 0.08, opacity: 0.22, emissiveIntensity: 0.004 }}
          />
        </Suspense>
        <BackWallPatch position={[0, -0.08, 0.014]} scale={[0.64, 0.56]} color="#ffd19a" opacity={active ? 0.009 : 0.006} />
        <pointLight color="#ffd19a" intensity={active ? 0.045 : 0.025} distance={0.85} position={[0.08, -0.02, 0.28]} />
      </group>
      <group position={[3.03, 1.62, 1.2]} rotation={[0, Math.PI / 2, 0]}>
        <Suspense fallback={null}>
          <MeshyModel
            url={DETAIL_WALL_SCONCE_URL}
            position={[0, 0, 0]}
            rotation={[0, 0.04, 0]}
            scale={0.1}
            materialTone={{
              tint: "#d6a16f",
              tintStrength: 0.18,
              colorScale: 0.28,
              roughness: 0.72,
              metalness: 0.12,
              opacity: 0.36,
              emissiveIntensity: 0.006
            }}
          />
          <MeshyModel
            url={KENNEY_WALL_LAMP_URL}
            position={[0.02, -0.07, 0.01]}
            rotation={[0, -0.02, 0]}
            scale={0.32}
            materialTone={{ tint: "#f0c28d", tintStrength: 0.22, colorScale: 0.32, roughness: 0.8, metalness: 0.08, opacity: 0.2, emissiveIntensity: 0.004 }}
          />
        </Suspense>
        <SideWallPatch position={[0.006, -0.04, 0]} scale={[0.54, 0.5]} color="#ffd19a" opacity={active ? 0.008 : 0.005} />
        <pointLight color="#ffd19a" intensity={active ? 0.035 : 0.02} distance={0.75} position={[-0.22, -0.02, 0.04]} />
      </group>
    </group>
  );
}

function MediaConsoleQualityPass() {
  return (
    <group>
      <RoundedBlock args={[1.46, 0.038, 0.025]} position={[0, 0.44, 0.13]} color="#d5dce4" radius={0.008} roughness={0.58} opacity={0.62} />
      <RoundedBlock args={[0.03, 0.24, 0.25]} position={[-0.74, 0.0, 0.08]} color="#cdd5de" radius={0.01} roughness={0.6} opacity={0.62} />
      <RoundedBlock args={[0.03, 0.24, 0.25]} position={[0.74, 0.0, 0.08]} color="#cdd5de" radius={0.01} roughness={0.6} opacity={0.62} />
      {[-0.36, 0.16, 0.54].map((x, index) => (
        <RoundedBlock
          key={`media-console-front-slat-${x}`}
          args={[0.36, 0.018, 0.022]}
          position={[x, 0.18 + index * 0.015, 0.205]}
          color={index === 1 ? "#6f432a" : "#f1e5df"}
          radius={0.006}
          roughness={0.62}
          opacity={0.54}
        />
      ))}
      <RoundedBlock args={[1.32, 0.034, 0.032]} position={[0, 1.11, -0.08]} color="#0b0f14" radius={0.01} roughness={0.44} metalness={0.34} />
      <RoundedBlock args={[0.18, 0.05, 0.18]} position={[-0.34, 0.34, 0.15]} color="#151b22" radius={0.014} roughness={0.52} metalness={0.24} />
      <RoundedBlock args={[0.18, 0.05, 0.18]} position={[0.36, 0.34, 0.15]} color="#151b22" radius={0.014} roughness={0.52} metalness={0.24} />
      {[-0.69, 0.7].map((x) => (
        <group key={`speaker-detail-${x}`} position={[x, 0.31, 0.275]}>
          <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.064, 0.064, 0.018, 28]} />
            <meshStandardMaterial color="#0d1117" roughness={0.48} metalness={0.18} />
          </mesh>
          <mesh position={[0, 0.105, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.035, 0.035, 0.016, 24]} />
            <meshStandardMaterial color="#202832" roughness={0.46} metalness={0.2} />
          </mesh>
        </group>
      ))}
      <group position={[-0.18, 0.27, 0.23]} rotation={[0, -0.08, 0]}>
        <RoundedBlock args={[0.36, 0.022, 0.2]} color="#191f26" radius={0.018} roughness={0.58} metalness={0.12} />
        <RoundedBlock args={[0.26, 0.012, 0.016]} position={[0, 0.022, -0.04]} color="#8fd7ff" radius={0.004} roughness={0.44} emissive="#1f77b6" emissiveIntensity={0.08} />
      </group>
    </group>
  );
}

function GamingChair({ visible }: { visible: boolean }) {
  if (!visible) return null;

  return (
    <group position={[0.18, 0.035, 0.68]} rotation={[0, 0.28, 0]} scale={0.58}>
      <Suspense fallback={null}>
        <MeshyModel
          url={COMMERCIAL_TASK_CHAIR_HERO_URL}
          materialTone={{ envMapIntensity: 0.68 }}
        />
      </Suspense>
    </group>
  );
}

function MediaConsole({ visible, curatedOnly = false }: { visible: boolean; curatedOnly?: boolean }) {
  if (!visible) return null;

  if (curatedOnly) {
    return (
      <group position={[1.92, 0.45, -1.72]}>
        <Suspense fallback={null}>
          <MeshyModel url={MESHY_STUDIO_SPEAKER_URL} position={[-0.69, 0.21, 0.16]} rotation={[0, 0.08, 0]} scale={1.62} />
          <MeshyModel url={MESHY_STUDIO_SPEAKER_URL} position={[0.7, 0.21, 0.16]} rotation={[0, -0.08, 0]} scale={1.62} />
          <MeshyModel url={MESHY_PIXEL_DISPLAY_URL} position={[0.0, 0.23, 0.12]} rotation={[0, -0.04, 0]} scale={0.42} />
        </Suspense>
      </group>
    );
  }

  return (
    <group position={[1.92, 0.45, -1.72]}>
      <RoundedBlock args={[1.62, 0.28, 0.36]} color="#e9edf2" radius={0.035} roughness={0.52} metalness={0.08} />
      <RoundedBlock args={[0.86, 0.16, 0.28]} position={[0.18, 0.17, 0.04]} color="#a7673f" radius={0.02} roughness={0.58} metalness={0.04} />
      <RoundedBlock args={[1.36, 0.74, 0.07]} position={[0, 0.72, -0.08]} color="#111820" radius={0.035} roughness={0.42} metalness={0.32} />
      <RoundedBlock args={[1.14, 0.54, 0.018]} position={[0, 0.72, -0.035]} color="#141419" radius={0.014} roughness={0.5} emissive="#5d1c75" emissiveIntensity={0.18} />
      <MediaConsoleQualityPass />
      <Suspense fallback={null}>
        <MeshyModel
          url={DETAIL_MEDIA_CABINET_URL}
          position={[0, -0.12, 0.035]}
          rotation={[0, 0, 0]}
          scale={0.66}
          materialTone={{ tint: "#c48a63", tintStrength: 0.2, colorScale: 0.88, roughness: 0.72, metalness: 0.04, opacity: 0.88 }}
        />
        <MeshyModel url={MESHY_STUDIO_SPEAKER_URL} position={[-0.69, 0.21, 0.16]} rotation={[0, 0.08, 0]} scale={1.62} />
        <MeshyModel url={MESHY_STUDIO_SPEAKER_URL} position={[0.7, 0.21, 0.16]} rotation={[0, -0.08, 0]} scale={1.62} />
        <MeshyModel url={MESHY_PIXEL_DISPLAY_URL} position={[0.0, 0.23, 0.12]} rotation={[0, -0.04, 0]} scale={0.42} />
      </Suspense>
      <RoundedBlock args={[0.34, 0.18, 0.2]} position={[-0.62, 0.28, 0.08]} color="#1f252b" radius={0.025} roughness={0.52} metalness={0.18} />
      <RoundedBlock args={[0.09, 0.22, 0.08]} position={[-0.82, 0.31, 0.08]} color="#61d5e8" radius={0.025} roughness={0.48} />
      <RoundedBlock args={[0.09, 0.22, 0.08]} position={[-0.42, 0.31, 0.08]} color="#ff6f6f" radius={0.025} roughness={0.48} />
      <group position={[0.78, 0.29, 0.1]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.1, 0.13, 0.18, 18]} />
          <meshStandardMaterial color="#171b1e" roughness={0.58} metalness={0.08} />
        </mesh>
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <mesh
            key={index}
            position={[Math.cos(index) * 0.09, 0.13 + index * 0.012, Math.sin(index) * 0.065]}
            rotation={[0.3, index, 0.25]}
            scale={[1.5, 0.28, 0.7]}
            castShadow
          >
            <sphereGeometry args={[0.055, 16, 10]} />
            <meshStandardMaterial color={index % 2 ? "#496a52" : "#567a5c"} roughness={0.8} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function RightWallEntertainment({ visible }: { visible: boolean }) {
  if (!visible) return null;

  return (
    <group position={[2.82, 0.76, 0.22]} rotation={[0, Math.PI / 2, 0]} scale={0.88}>
      <RoundedBlock args={[1.42, 0.72, 0.07]} position={[0, 0.62, 0]} color="#10151c" radius={0.035} roughness={0.46} metalness={0.32} />
      <RoundedBlock
        args={[1.22, 0.52, 0.018]}
        position={[0, 0.62, -0.04]}
        color="#17111d"
        radius={0.014}
        roughness={0.5}
        emissive="#44105e"
        emissiveIntensity={0.22}
      />
      <RoundedBlock args={[0.48, 0.034, 0.02]} position={[-0.12, 0.73, -0.028]} rotation={[0, 0, -0.12]} color="#f06aa0" radius={0.008} roughness={0.45} emissive="#a91555" emissiveIntensity={0.28} />
      <RoundedBlock args={[0.32, 0.026, 0.02]} position={[0.16, 0.58, -0.026]} rotation={[0, 0, 0.2]} color="#8fd7ff" radius={0.008} roughness={0.45} emissive="#1f77b6" emissiveIntensity={0.24} />
      <RoundedBlock args={[0.58, 0.028, 0.02]} position={[-0.02, 0.46, -0.026]} color="#51366c" radius={0.008} roughness={0.45} emissive="#321451" emissiveIntensity={0.18} />
      <RoundedBlock args={[1.22, 0.12, 0.34]} position={[0, 0.08, -0.01]} color="#f0eef1" radius={0.025} roughness={0.52} metalness={0.08} />
      <RoundedBlock args={[0.68, 0.12, 0.27]} position={[0.08, 0.18, -0.02]} color="#9c5f39" radius={0.018} roughness={0.6} metalness={0.04} />
      <RoundedBlock args={[0.36, 0.06, 0.22]} position={[-0.48, 0.2, -0.04]} color="#202833" radius={0.02} roughness={0.5} metalness={0.22} />
      <RoundedBlock args={[0.18, 0.04, 0.14]} position={[0.54, 0.2, -0.04]} color="#10151b" radius={0.018} roughness={0.5} metalness={0.2} />
      <RoundedBlock args={[1.28, 0.026, 0.028]} position={[0, 0.99, -0.005]} color="#0a0e13" radius={0.008} roughness={0.44} metalness={0.3} />
      <RoundedBlock args={[0.24, 0.045, 0.14]} position={[-0.38, 0.02, 0.08]} color="#dbe1e8" radius={0.012} roughness={0.58} opacity={0.76} />
      <RoundedBlock args={[0.24, 0.045, 0.14]} position={[0.38, 0.02, 0.08]} color="#dbe1e8" radius={0.012} roughness={0.58} opacity={0.76} />
      {[-0.42, -0.14, 0.14, 0.42].map((x, index) => (
        <RoundedBlock
          key={`right-console-drawer-cut-${x}`}
          args={[0.18, 0.012, 0.018]}
          position={[x, 0.16 + (index % 2) * 0.02, 0.16]}
          color="#704324"
          radius={0.004}
          roughness={0.72}
          opacity={0.44}
        />
      ))}
      <RoundedBlock args={[0.82, 0.02, 0.018]} position={[0.03, 0.78, -0.018]} rotation={[0, 0, -0.1]} color="#d9f7ff" radius={0.006} roughness={0.3} emissive="#3ca7ff" emissiveIntensity={0.1} opacity={0.24} />
      <RoundedBlock args={[0.64, 0.018, 0.016]} position={[-0.04, 0.52, -0.018]} rotation={[0, 0, 0.12]} color="#ffd5e2" radius={0.006} roughness={0.3} emissive="#f04f87" emissiveIntensity={0.09} opacity={0.22} />
      <mesh position={[-0.52, 0.92, -0.025]} castShadow>
        <sphereGeometry args={[0.045, 18, 12]} />
        <meshStandardMaterial color="#5f58ff" emissive="#413bff" emissiveIntensity={0.46} roughness={0.42} />
      </mesh>
      <pointLight color="#f04f87" intensity={0.52} distance={1.55} position={[-0.1, 0.72, -0.2]} />
    </group>
  );
}

function LivingRugDetail() {
  const stripeColors = ["#3e536a", "#24384d", "#58708d", "#2d4259"];

  return (
    <group position={[-0.9, 0.052, 1.08]}>
      <Suspense fallback={null}>
        <MeshyModel
          url={KENNEY_RUG_URL}
          position={[0.0, 0.012, 0.0]}
          rotation={[0, 0.02, 0]}
          scale={[1.72, 1, 1.58]}
          materialTone={{ tint: "#415a73", tintStrength: 0.34, colorScale: 0.58, roughness: 0.98, metalness: 0, opacity: 0.18 }}
        />
      </Suspense>
      <RoundedBlock args={[2.72, 0.034, 1.46]} color="#26394f" radius={0.045} roughness={0.92} metalness={0.01} />
      <RoundedBlock args={[2.46, 0.014, 1.2]} position={[0, 0.031, 0]} color="#31465e" radius={0.035} roughness={0.96} metalness={0.01} opacity={0.78} />
      <RoundedBlock args={[2.58, 0.018, 0.04]} position={[0, 0.052, -0.66]} color="#6f849c" radius={0.012} roughness={0.88} opacity={0.74} />
      <RoundedBlock args={[2.58, 0.018, 0.04]} position={[0, 0.052, 0.66]} color="#17273a" radius={0.012} roughness={0.88} opacity={0.74} />
      {[-0.5, -0.28, -0.06, 0.18, 0.42].map((z, index) => (
        <RoundedBlock
          key={`rug-thread-z-${z}`}
          args={[2.34 - index * 0.04, 0.012, 0.022]}
          position={[0.02 * (index % 2), 0.057, z]}
          color={stripeColors[index % stripeColors.length] ?? "#3e536a"}
          radius={0.006}
          roughness={0.96}
          opacity={0.68}
        />
      ))}
      {[-1.17, -0.94, -0.71, -0.48, -0.25, -0.02, 0.21, 0.44, 0.67, 0.9, 1.13].map((x, index) => (
        <RoundedBlock
          key={`rug-thread-x-${x}`}
          args={[0.018, 0.011, 1.22]}
          position={[x, 0.061, 0.02 * (index % 2)]}
          color={index % 3 === 0 ? "#435975" : "#203247"}
          radius={0.005}
          roughness={0.96}
          opacity={0.34}
        />
      ))}
      {[-1.18, -0.98, -0.78, -0.58, -0.38, -0.18, 0.02, 0.22, 0.42, 0.62, 0.82, 1.02, 1.22].map((x) => (
        <RoundedBlock key={`rug-fringe-front-${x}`} args={[0.075, 0.012, 0.018]} position={[x, 0.06, 0.78]} color="#a6b6c4" radius={0.005} roughness={0.98} opacity={0.62} />
      ))}
      {[-1.18, -0.98, -0.78, -0.58, -0.38, -0.18, 0.02, 0.22, 0.42, 0.62, 0.82, 1.02, 1.22].map((x) => (
        <RoundedBlock key={`rug-fringe-back-${x}`} args={[0.075, 0.012, 0.018]} position={[x, 0.06, -0.78]} color="#7f93a8" radius={0.005} roughness={0.98} opacity={0.5} />
      ))}
      {[-0.58, -0.28, 0.02, 0.32, 0.62].map((z, index) => (
        <RoundedBlock
          key={`rug-border-side-${z}`}
          args={[0.026, 0.014, 0.12]}
          position={[-1.32, 0.064, z]}
          color={index % 2 ? "#17273a" : "#6f849c"}
          radius={0.005}
          roughness={0.96}
          opacity={0.42}
        />
      ))}
    </group>
  );
}

function SofaTextileDetailPass() {
  return (
    <group>
      <RoundedBlock args={[1.3, 0.018, 0.026]} position={[-1.56, 0.51, 0.91]} color="#182133" radius={0.006} roughness={0.92} opacity={0.7} />
      <RoundedBlock args={[1.32, 0.018, 0.024]} position={[-1.56, 0.79, 1.51]} color="#121a28" radius={0.006} roughness={0.92} opacity={0.48} />
      {[-2.24, -0.88].map((x) => (
        <RoundedBlock key={`sofa-arm-piping-${x}`} args={[0.026, 0.26, 0.5]} position={[x, 0.55, 1.06]} color="#151e2d" radius={0.006} roughness={0.9} opacity={0.62} />
      ))}
      {[-1.95, -1.72, -1.49, -1.26].map((x, index) => (
        <mesh key={`sofa-tuft-${x}`} position={[x, 0.56, 0.88]} castShadow>
          <sphereGeometry args={[0.026, 14, 8]} />
          <meshStandardMaterial color={index % 2 ? "#3c4c67" : "#1c2738"} roughness={0.86} metalness={0.02} />
        </mesh>
      ))}
      {[-2.02, -1.21].map((x, index) => (
        <group key={`pillow-detail-${x}`} position={[x, 0.72 - index * 0.03, 1.355 - index * 0.02]} rotation={[-0.08, index ? -0.1 : 0.08, 0]}>
          <RoundedBlock args={[0.5, 0.018, 0.018]} color={index ? "#b8aca8" : "#59708f"} radius={0.005} roughness={0.9} opacity={0.7} />
          <RoundedBlock args={[0.018, 0.22, 0.018]} position={[-0.22, 0.0, 0.0]} color={index ? "#b8aca8" : "#59708f"} radius={0.005} roughness={0.9} opacity={0.58} />
          <RoundedBlock args={[0.018, 0.22, 0.018]} position={[0.22, 0.0, 0.0]} color={index ? "#b8aca8" : "#59708f"} radius={0.005} roughness={0.9} opacity={0.58} />
        </group>
      ))}
      {[-2.2, -0.92].map((x) => (
        <RoundedBlock key={`sofa-small-leg-${x}`} args={[0.08, 0.12, 0.08]} position={[x, 0.08, 0.92]} color="#15191f" radius={0.018} roughness={0.54} metalness={0.28} />
      ))}
      {[-2.2, -0.92].map((x) => (
        <RoundedBlock key={`sofa-small-back-leg-${x}`} args={[0.08, 0.12, 0.08]} position={[x, 0.08, 1.5]} color="#15191f" radius={0.018} roughness={0.54} metalness={0.28} />
      ))}
    </group>
  );
}

function SofaCuratedAssetLayer({ showFallbackSilhouette = true }: { showFallbackSilhouette?: boolean }) {
  return (
    <Suspense fallback={null}>
      <MeshyModel
        url={DETAIL_SOFA_URL}
        position={[-1.56, 0.08, 1.25]}
        rotation={[0, 0.03, 0]}
        scale={0.96}
        materialTone={{ tint: "#2f3f58", tintStrength: 0.28, colorScale: 0.76, roughness: 0.92, metalness: 0.02, opacity: 0.96 }}
      />
      {showFallbackSilhouette ? (
        <MeshyModel
          url={KENNEY_SOFA_URL}
          position={[-1.54, 0.1, 1.2]}
          rotation={[0, 0.03, 0]}
          scale={[1.54, 1.06, 0.9]}
          materialTone={{ tint: "#273653", tintStrength: 0.36, colorScale: 0.44, roughness: 0.94, metalness: 0.02, opacity: 0.14 }}
        />
      ) : null}
    </Suspense>
  );
}

function CoffeeTableSurfaceProps() {
  return (
    <>
      <mesh position={[0.1, 0.5, 1.05]} castShadow>
        <sphereGeometry args={[0.08, 24, 14]} />
        <meshStandardMaterial color="#28313b" roughness={0.58} metalness={0.12} />
      </mesh>
      <RoundedBlock args={[0.22, 0.06, 0.14]} position={[0.48, 0.505, 1.05]} color="#191d24" radius={0.025} roughness={0.54} />
      <RoundedBlock args={[0.28, 0.028, 0.18]} position={[0.72, 0.5, 0.88]} rotation={[0, -0.18, 0]} color="#202832" radius={0.025} roughness={0.52} metalness={0.2} />
      <group position={[0.15, 0.505, 1.28]} rotation={[0, 0.18, 0]}>
        <RoundedBlock args={[0.42, 0.035, 0.28]} color="#ebe2d7" radius={0.018} roughness={0.78} />
        <RoundedBlock args={[0.34, 0.014, 0.022]} position={[-0.02, 0.03, -0.08]} color="#9f6a45" radius={0.005} roughness={0.74} />
        <RoundedBlock args={[0.28, 0.014, 0.02]} position={[0.02, 0.032, 0.02]} color="#6f849c" radius={0.005} roughness={0.76} />
      </group>
      <group position={[0.54, 0.51, 1.28]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.055, 0.07, 0.09, 18]} />
          <meshStandardMaterial color="#e9dfd4" roughness={0.72} metalness={0.02} />
        </mesh>
        <mesh position={[0, 0.052, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <torusGeometry args={[0.055, 0.006, 8, 20]} />
          <meshStandardMaterial color="#8c5a3b" roughness={0.66} metalness={0.08} />
        </mesh>
      </group>
      <mesh position={[0.66, 0.525, 0.82]} castShadow>
        <sphereGeometry args={[0.025, 14, 8]} />
        <meshStandardMaterial color="#8fd7ff" emissive="#1f77b6" emissiveIntensity={0.28} roughness={0.48} />
      </mesh>
      <mesh position={[0.78, 0.525, 0.93]} castShadow>
        <sphereGeometry args={[0.025, 14, 8]} />
        <meshStandardMaterial color="#f66f9a" emissive="#b91b52" emissiveIntensity={0.28} roughness={0.48} />
      </mesh>
    </>
  );
}

function SofaForegroundRefinementPass() {
  return (
    <Suspense fallback={null}>
      <MeshyModel
        url={PREMIUM_DARK_SOFA_URL}
        position={[-1.56, 0.01, 1.2]}
        rotation={[0, 0, 0]}
        scale={1}
        materialTone={{ roughness: 0.94, metalness: 0, envMapIntensity: 0.34 }}
      />
    </Suspense>
  );
}

function SofaArea({ visible, authoredHeroActive = false }: { visible: boolean; authoredHeroActive?: boolean }) {
  if (!visible) return null;

  if (authoredHeroActive) {
    return <SofaForegroundRefinementPass />;
  }

  return (
    <group>
      <LivingRugDetail />
      <RoundedBlock args={[1.52, 0.38, 0.64]} position={[-1.56, 0.28, 1.2]} color="#263246" radius={0.09} roughness={0.82} metalness={0.02} />
      <RoundedBlock args={[0.68, 0.055, 0.55]} position={[-1.92, 0.49, 1.08]} color="#2f3d54" radius={0.055} roughness={0.84} />
      <RoundedBlock args={[0.68, 0.055, 0.55]} position={[-1.2, 0.49, 1.08]} color="#2b394f" radius={0.055} roughness={0.84} />
      <RoundedBlock args={[0.035, 0.04, 0.58]} position={[-1.56, 0.52, 1.08]} color="#192233" radius={0.01} roughness={0.9} />
      <RoundedBlock args={[1.56, 0.68, 0.2]} position={[-1.56, 0.62, 1.52]} color="#202a3a" radius={0.09} roughness={0.84} metalness={0.02} />
      <RoundedBlock args={[0.58, 0.36, 0.08]} position={[-1.98, 0.72, 1.4]} rotation={[-0.08, 0.08, 0]} color="#405170" radius={0.055} roughness={0.8} />
      <RoundedBlock args={[0.45, 0.28, 0.08]} position={[-1.2, 0.69, 1.38]} rotation={[-0.08, -0.1, 0]} color="#d9d2ce" radius={0.05} roughness={0.68} />
      <RoundedBlock args={[0.78, 0.035, 0.48]} position={[-1.56, 0.76, 1.18]} rotation={[0, 0, -0.04]} color="#566b8c" radius={0.028} roughness={0.86} />
      <RoundedBlock args={[0.96, 0.042, 0.5]} position={[-1.48, 0.78, 1.02]} rotation={[0.02, 0.04, -0.08]} color="#49617d" radius={0.03} roughness={0.92} opacity={0.9} />
      {[-1.86, -1.62, -1.38, -1.14].map((x, index) => (
        <RoundedBlock
          key={`sofa-throw-thread-${x}`}
          args={[0.03, 0.02, 0.48]}
          position={[x, 0.81, 1.02 + (index % 2) * 0.015]}
          rotation={[0.02, 0.04, -0.08]}
          color={index % 2 ? "#7891ac" : "#263a56"}
          radius={0.006}
          roughness={0.96}
          opacity={0.55}
        />
      ))}
      {[-1.92, -1.56, -1.2].map((x) => (
        <RoundedBlock key={`sofa-front-seam-${x}`} args={[0.28, 0.018, 0.035]} position={[x, 0.48, 0.78]} color="#172136" radius={0.006} roughness={0.88} />
      ))}
      <SofaTextileDetailPass />
      <RoundedBlock args={[0.22, 0.36, 0.58]} position={[-2.38, 0.38, 1.18]} color="#222d3d" radius={0.07} roughness={0.82} opacity={0.72} />
      <RoundedBlock args={[0.22, 0.36, 0.58]} position={[-0.74, 0.38, 1.18]} color="#222d3d" radius={0.07} roughness={0.82} opacity={0.72} />
      <SofaCuratedAssetLayer />
      <Suspense fallback={null}>
        <MeshyModel
          url={DETAIL_COFFEE_TABLE_URL}
          position={[0.3, 0.19, 1.0]}
          rotation={[0, -0.08, 0]}
          scale={0.78}
          materialTone={{ tint: "#9d6540", tintStrength: 0.14, colorScale: 0.9, roughness: 0.78, metalness: 0.04, opacity: 0.88 }}
        />
        <MeshyModel
          url={KENNEY_COFFEE_TABLE_URL}
          position={[0.3, 0.31, 1.0]}
          rotation={[0, -0.08, 0]}
          scale={[1.36, 1.0, 1.4]}
          materialTone={{ tint: "#a86f49", tintStrength: 0.22, colorScale: 0.52, roughness: 0.78, metalness: 0.06, opacity: 0.12 }}
        />
      </Suspense>
      <RoundedBlock args={[1.16, 0.22, 0.72]} position={[0.28, 0.29, 1.02]} color="#4a3326" radius={0.045} roughness={0.72} metalness={0.04} opacity={0.88} />
      <RoundedBlock args={[1.06, 0.035, 0.62]} position={[0.28, 0.445, 1.02]} color="#9d6540" radius={0.025} roughness={0.68} metalness={0.04} opacity={0.92} />
      <RoundedBlock args={[0.018, 0.018, 0.54]} position={[0.28, 0.472, 1.02]} color="#704324" radius={0.006} roughness={0.72} metalness={0.02} opacity={0.7} />
      <RoundedBlock args={[0.9, 0.014, 0.024]} position={[0.3, 0.478, 0.74]} color="#f4d2ad" radius={0.006} roughness={0.78} opacity={0.64} />
      <CoffeeTableSurfaceProps />
    </group>
  );
}

function MeshyCommunityFurnitureLayer({
  visible,
  suppressLounge = false,
  suppressAuthoredOverlap = false
}: {
  visible: boolean;
  suppressLounge?: boolean;
  suppressAuthoredOverlap?: boolean;
}) {
  if (!visible) return null;

  return (
    <Suspense fallback={null}>
      {MESHY_COMMUNITY_SCENE_PLACEMENTS.map((placement) => {
        if (suppressLounge && placement.layer.startsWith("lounge-")) return null;
        if (suppressAuthoredOverlap && (placement.layer === "wall-accent" || placement.layer === "storage-density")) return null;
        const asset = getMeshyCommunityAssetBySlug(placement.slug);
        if (!asset) return null;

        return (
          <group key={placement.slug} position={placement.position} rotation={placement.rotation} scale={placement.scale}>
            <MeshyModel url={getMeshyCommunityRuntimeUrl(asset.file)} materialTone={placement.materialTone} />
          </group>
        );
      })}
    </Suspense>
  );
}

function BlenderAuthoredWallDetailKit({ visible }: { visible: boolean }) {
  if (!visible) return null;

  return (
    <Suspense fallback={null}>
      <group position={[-1.38, 1.38, -1.945]} rotation={[0, 0.015, 0]} scale={0.58}>
        <MeshyModel
          url={BLENDER_ROOM_DETAIL_KIT_URL}
        materialTone={{
          tint: "#f1d3c4",
          tintStrength: 0.08,
          colorScale: 0.88,
          roughness: 0.7,
          metalness: 0.02,
          envMapIntensity: 0.7,
          emissiveIntensity: 0.05
        }}
      />
      </group>
      <BackWallPatch position={[-1.35, 1.36, -1.982]} scale={[1.38, 1.0]} color="#07070a" opacity={0.08} rotation={-0.02} />
      <BackWallPatch position={[-1.62, 1.7, -1.979]} scale={[1.1, 0.72]} color="#7fcfff" opacity={0.018} rotation={-0.12} />
      <BackWallPatch position={[-0.96, 1.18, -1.978]} scale={[0.92, 0.66]} color="#ff7fa8" opacity={0.016} rotation={0.08} />
    </Suspense>
  );
}

function BrunoRoomSurfaceRuntimeModel() {
  const gltf = useGLTF(BLENDER_ROOM_SURFACE_KIT_URL);
  const ormTextureState = useBrunoRoomSurfaceOrmTextures();
  const materialTone = useMemo<MeshyMaterialTone>(
    () => ({
      tint: "#f3d8c9",
      tintStrength: 0.035,
      colorScale: 0.94,
      roughness: 0.78,
      metalness: 0.02,
      envMapIntensity: 0.62,
      emissiveIntensity: 0.025
    }),
    []
  );
  const { scene, qaEvidence } = useMemo(() => {
    const cloned = gltf.scene.clone(true);
    const enhancedMaterialNames = new Set<string>();
    let aoUv2ReadyMeshCount = 0;
    let uv2PatchedMeshCount = 0;

    cloned.traverse((object) => {
      if (!(object as THREE.Mesh).isMesh) return;
      const mesh = object as THREE.Mesh;
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      const enhanceMaterial = (material: THREE.Material) => {
        const nextMaterial = toneMeshyMaterial(material, materialTone);
        const materialName = nextMaterial.name || material.name || mesh.name;
        const role = resolveBrunoSurfaceOrmRole(materialName);
        const ormTexture = role ? ormTextureState?.textures[role] : null;

        if (role && ormTexture) {
          if (ensureAoUv2(mesh.geometry)) {
            uv2PatchedMeshCount += 1;
          }
          const textureChannel = hasAoUv2(mesh.geometry) ? 1 : 0;
          if (textureChannel === 1) {
            aoUv2ReadyMeshCount += 1;
          }
          applyBrunoPackedOrmMaterial(nextMaterial, ormTexture, role, textureChannel);
          enhancedMaterialNames.add(materialName);
        }

        return nextMaterial;
      };

      mesh.material = Array.isArray(mesh.material)
        ? mesh.material.map((material) => enhanceMaterial(material))
        : enhanceMaterial(mesh.material);
    });

    const loadedRoles = BRUNO_ROOM_SURFACE_ORM_ROLES.filter((role) => Boolean(ormTextureState?.textures[role]));

    return {
      scene: cloned,
      qaEvidence: {
        texturePackageUrl: BRUNO_ROOM_SURFACE_TEXTURE_PACKAGE_URL,
        ktx2PackageConsumed: loadedRoles.length === BRUNO_ROOM_SURFACE_ORM_ROLES.length && enhancedMaterialNames.size >= 3,
        loadedRoles,
        requestedTextureUrls: ormTextureState?.textureUrls ?? {},
        enhancedMaterialNames: Array.from(enhancedMaterialNames).sort(),
        aoUv2ReadyMeshCount,
        uv2PatchedMeshCount
      } satisfies BrunoSurfaceMaterialRuntimeQa
    };
  }, [gltf.scene, materialTone, ormTextureState]);

  useEffect(() => {
    window.__DESKTERIORONLINE_BRUNO_SURFACE_QA__ = qaEvidence;
    return () => {
      delete window.__DESKTERIORONLINE_BRUNO_SURFACE_QA__;
    };
  }, [qaEvidence]);

  return <primitive object={scene} />;
}

function BlenderAuthoredRoomSurfaceKit() {
  return (
    <Suspense fallback={null}>
      <BrunoRoomSurfaceRuntimeModel />
    </Suspense>
  );
}

function BrunoFurnitureHeroRuntimeModel({
  hideWorkstation = false,
  hideDesk = false
}: {
  hideWorkstation?: boolean;
  hideDesk?: boolean;
}) {
  const gltf = useGLTF(BLENDER_FURNITURE_HERO_KIT_URL);
  const ormTextureState = useBrunoFurnitureOrmTextures();
  const materialTone = useMemo<MeshyMaterialTone>(
    () => ({
      tint: "#f0d4c5",
      tintStrength: 0.028,
      colorScale: 0.94,
      roughness: 0.72,
      metalness: 0.03,
      envMapIntensity: 0.76,
      emissiveIntensity: 0.06
    }),
    []
  );
  const { scene, qaEvidence } = useMemo(() => {
    const cloned = gltf.scene.clone(true);
    const enhancedMaterialNames = new Set<string>();
    let aoUv2ReadyMeshCount = 0;
    let uv2PatchedMeshCount = 0;

    cloned.traverse((object) => {
      if (!(object as THREE.Mesh).isMesh) return;
      const mesh = object as THREE.Mesh;
      if (mesh.name.startsWith("hero_sofa_")) {
        mesh.visible = false;
        return;
      }
      if ((hideWorkstation || hideDesk) && mesh.name.startsWith("hero_desk_")) {
        mesh.visible = false;
        return;
      }
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      const enhanceMaterial = (material: THREE.Material) => {
        const nextMaterial = toneMeshyMaterial(material, materialTone);
        const materialName = nextMaterial.name || material.name || mesh.name;
        const role = resolveBrunoFurnitureOrmRole(materialName);
        const ormTexture = role ? ormTextureState?.textures[role] : null;

        if (role && ormTexture) {
          if (ensureAoUv2(mesh.geometry)) {
            uv2PatchedMeshCount += 1;
          }
          const textureChannel = hasAoUv2(mesh.geometry) ? 1 : 0;
          if (textureChannel === 1) {
            aoUv2ReadyMeshCount += 1;
          }
          applyBrunoFurniturePackedOrmMaterial(nextMaterial, ormTexture, role, textureChannel);
          enhancedMaterialNames.add(materialName);
        }

        return tuneHeroSofaMaterial(mesh.name, nextMaterial);
      };

      mesh.material = Array.isArray(mesh.material)
        ? mesh.material.map((material) => enhanceMaterial(material))
        : enhanceMaterial(mesh.material);
    });

    const loadedRoles = BRUNO_FURNITURE_ORM_ROLES.filter((role) => Boolean(ormTextureState?.textures[role]));

    return {
      scene: cloned,
      qaEvidence: {
        texturePackageUrl: BRUNO_FURNITURE_HERO_TEXTURE_PACKAGE_URL,
        ktx2PackageConsumed: loadedRoles.length === BRUNO_FURNITURE_ORM_ROLES.length && enhancedMaterialNames.size >= 4,
        loadedRoles,
        requestedTextureUrls: ormTextureState?.textureUrls ?? {},
        enhancedMaterialNames: Array.from(enhancedMaterialNames).sort(),
        aoUv2ReadyMeshCount,
        uv2PatchedMeshCount
      } satisfies BrunoFurnitureMaterialRuntimeQa
    };
  }, [gltf.scene, hideDesk, hideWorkstation, materialTone, ormTextureState]);

  useEffect(() => {
    window.__DESKTERIORONLINE_BRUNO_FURNITURE_QA__ = qaEvidence;
    return () => {
      delete window.__DESKTERIORONLINE_BRUNO_FURNITURE_QA__;
    };
  }, [qaEvidence]);

  return <primitive object={scene} />;
}

function BlenderAuthoredFurnitureHeroKit({
  visible,
  hideWorkstation = false,
  hideDesk = false
}: {
  visible: boolean;
  hideWorkstation?: boolean;
  hideDesk?: boolean;
}) {
  if (!visible) return null;

  return (
    <Suspense fallback={null}>
      <BrunoFurnitureHeroRuntimeModel hideWorkstation={hideWorkstation} hideDesk={hideDesk} />
    </Suspense>
  );
}

function Guitar({ visible }: { visible: boolean }) {
  if (!visible) return null;

  return (
    <group position={[-2.1, 0.38, -0.72]} rotation={[0, 0, -0.14]}>
      <mesh position={[0, 0.07, 0]} scale={[0.72, 1, 0.25]} castShadow>
        <sphereGeometry args={[0.23, 26, 16]} />
        <meshStandardMaterial color="#191a1f" roughness={0.52} metalness={0.18} />
      </mesh>
      <mesh position={[0, -0.05, 0.02]} scale={[0.85, 0.62, 0.25]} castShadow>
        <sphereGeometry args={[0.25, 26, 16]} />
        <meshStandardMaterial color="#15161a" roughness={0.5} metalness={0.18} />
      </mesh>
      <RoundedBlock args={[0.07, 1.05, 0.055]} position={[0.02, 0.58, 0]} color="#3a2218" radius={0.015} roughness={0.54} />
      <RoundedBlock args={[0.24, 0.1, 0.055]} position={[0.02, 1.12, 0]} color="#171717" radius={0.02} roughness={0.48} metalness={0.2} />
      <mesh position={[0, 0.03, 0.08]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <torusGeometry args={[0.1, 0.01, 8, 28]} />
        <meshStandardMaterial color="#d2a96d" roughness={0.45} metalness={0.22} />
      </mesh>
    </group>
  );
}

function DeskRoomScene({
  pcPlacedOnDesk,
  monitorMounted,
  keyboardMousePlaced,
  microphoneArmClamped,
  lampPositioned,
  plantBooksStyled,
  collectiblesStacked,
  wallLedsEnabled,
  mediaConsoleStyled,
  sofaZoneStyled,
  roomLightingSet,
  selectedKeyboardSwitch,
  pressedKeyboardTargetId,
  onKeyboardPress
}: {
  pcPlacedOnDesk: boolean;
  monitorMounted: boolean;
  keyboardMousePlaced: boolean;
  microphoneArmClamped: boolean;
  lampPositioned: boolean;
  plantBooksStyled: boolean;
  collectiblesStacked: boolean;
  wallLedsEnabled: boolean;
  mediaConsoleStyled: boolean;
  sofaZoneStyled: boolean;
  roomLightingSet: boolean;
  selectedKeyboardSwitch: KeyboardSwitchKind;
  pressedKeyboardTargetId: string | null;
  onKeyboardPress: (targetId: string) => void;
}) {
  const authoredFurnitureHeroActive =
    monitorMounted ||
    keyboardMousePlaced ||
    pcPlacedOnDesk ||
    plantBooksStyled ||
    mediaConsoleStyled ||
    sofaZoneStyled ||
    roomLightingSet;
  const workstationHeroActive =
    authoredFurnitureHeroActive && pcPlacedOnDesk && monitorMounted && keyboardMousePlaced && microphoneArmClamped && lampPositioned;
  const commercialDeskHeroActive = authoredFurnitureHeroActive;
  const suppressCommunityAssetsForQa =
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("qaNoCommunity") === "1";
  const cinematicRoomLightingProfile = roomLightingSet
    ? {
        ambient: 0.024,
        directional: 0.24,
        warmWall: 0.42,
        coolWall: 0.34,
        rgbWall: 0.24,
        warmPractical: 0.052,
        coolPractical: 0.098,
        warmSpot: 0.26,
        coolSpot: 0.2,
        vignetteDarkness: 0.58
      }
    : {
        ambient: 0.042,
        directional: 0.4,
        warmWall: 0.32,
        coolWall: 0.28,
        rgbWall: 0.18,
        warmPractical: 0.052,
        coolPractical: 0.078,
        warmSpot: 0.15,
        coolSpot: 0.12,
        vignetteDarkness: 0.48
      };

  return (
    <>
      <color attach="background" args={["#05070a"]} />
      <fog attach="fog" args={["#05070a", 6.9, 10.6]} />
      <PerspectiveCamera makeDefault position={[5.18, 3.08, 5.62]} fov={34} />
      <ambientLight intensity={cinematicRoomLightingProfile.ambient} />
      <directionalLight
        position={[2.25, 6.4, 3.0]}
        intensity={cinematicRoomLightingProfile.directional}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-5}
        shadow-camera-right={5}
        shadow-camera-top={5}
        shadow-camera-bottom={-5}
      />
      <pointLight color="#ff9b62" intensity={cinematicRoomLightingProfile.warmWall} distance={4.45} position={[-2.55, 2.05, 1.75]} />
      <pointLight color="#7fcfff" intensity={cinematicRoomLightingProfile.coolWall} distance={4.18} position={[2.72, 1.92, 0.58]} />
      <pointLight color="#f04f87" intensity={wallLedsEnabled || roomLightingSet ? cinematicRoomLightingProfile.rgbWall : 0.18} distance={3.35} position={[2.58, 1.62, -1.42]} />
      <pointLight color="#fff0b8" intensity={cinematicRoomLightingProfile.warmPractical} distance={1.28} position={[-1.52, 1.62, -0.78]} />
      <pointLight color="#8fd7ff" intensity={cinematicRoomLightingProfile.coolPractical} distance={1.22} position={[-1.12, 1.64, -1.48]} />
      <spotLight color="#fff2cf" position={[-2.25, 4.2, 1.7]} target-position={[-0.62, 0.78, -0.42]} intensity={cinematicRoomLightingProfile.warmSpot} angle={0.56} penumbra={0.84} distance={5.8} castShadow shadow-mapSize={[1024, 1024]} />
      <spotLight color="#7fcfff" position={[2.9, 3.32, 1.2]} target-position={[0.85, 0.86, -0.3]} intensity={cinematicRoomLightingProfile.coolSpot} angle={0.48} penumbra={0.9} distance={4.85} />
      <Environment preset="apartment" />

      <group rotation={[0, 0.18, 0]} position={[-0.08, -0.1, -0.08]} scale={0.86}>
        <RoomShell lightingSet={roomLightingSet} authoredSurfaceActive />
        <BlenderAuthoredRoomSurfaceKit />
        <WallDressing active={plantBooksStyled || roomLightingSet} />
        <BlenderAuthoredWallDetailKit visible={plantBooksStyled || roomLightingSet} />
        <BlenderAuthoredFurnitureHeroKit
          visible={authoredFurnitureHeroActive}
          hideWorkstation={workstationHeroActive}
          hideDesk={commercialDeskHeroActive}
        />
        <WallBakedShadows active={roomLightingSet} />
        <RoomBakedShadows />
        <RoomCinematicContactOcclusionPass active={roomLightingSet} />
        <RoomMaterialDepthPass active={roomLightingSet} />
        <WallPlasterSofteningPass active={roomLightingSet} authoredSurfaceActive />
        <RoomLightCast active={roomLightingSet} />
        <CeilingPendant active={roomLightingSet} />
        <WallPracticalLights active={roomLightingSet} />
        <WallLeds active={wallLedsEnabled || roomLightingSet} />
        <DeskAssembly
          pcPlacedOnDesk={pcPlacedOnDesk}
          monitorMounted={monitorMounted}
          keyboardMousePlaced={keyboardMousePlaced}
          microphoneArmClamped={microphoneArmClamped}
          lampPositioned={lampPositioned}
          authoredHeroActive={authoredFurnitureHeroActive}
          selectedKeyboardSwitch={selectedKeyboardSwitch}
          pressedKeyboardTargetId={pressedKeyboardTargetId}
          onKeyboardPress={onKeyboardPress}
        />
        <ShelfAndDecor
          styled={plantBooksStyled}
          collectiblesStacked={collectiblesStacked}
          curatedOnly={authoredFurnitureHeroActive}
        />
        <RoomPlant visible={plantBooksStyled || roomLightingSet} />
        <MeshyCommunityFurnitureLayer
          visible={!suppressCommunityAssetsForQa && (plantBooksStyled || mediaConsoleStyled || sofaZoneStyled || roomLightingSet)}
          suppressLounge={authoredFurnitureHeroActive}
          suppressAuthoredOverlap={authoredFurnitureHeroActive}
        />
        <GamingChair visible={sofaZoneStyled || pcPlacedOnDesk} />
        <Guitar visible={plantBooksStyled} />
        <MediaConsole visible={mediaConsoleStyled} curatedOnly={authoredFurnitureHeroActive} />
        <RightWallEntertainment visible={mediaConsoleStyled || roomLightingSet} />
        <SofaArea visible={sofaZoneStyled} authoredHeroActive={authoredFurnitureHeroActive} />
      </group>
      <ContactShadows position={[0, 0.035, 0]} opacity={0.68} scale={8.4} blur={2.85} far={5.4} />
      <OrbitControls
        enablePan={false}
        minDistance={4.0}
        maxDistance={7.4}
        maxPolarAngle={Math.PI / 2.08}
        target={[-0.24, 0.92, -0.22]}
      />
      <EffectComposer multisampling={4} enableNormalPass={false}>
        <Bloom intensity={0.012} luminanceThreshold={1.18} luminanceSmoothing={0.28} mipmapBlur />
        <Vignette offset={0.3} darkness={cinematicRoomLightingProfile.vignetteDarkness} eskil={false} />
      </EffectComposer>
    </>
  );
}

function WorkbenchScene({
  caseOpen,
  psuMounted,
  motherboardMounted,
  cpuSeated,
  thermalPasteApplied,
  coolerMounted,
  ramInserted,
  ssdInstalled,
  gpuInstalled,
  fanInstalled,
  powerConnected,
  cablesManaged,
  firstBootPassed,
  showRoomPreview,
  pcPlacedOnDesk,
  monitorMounted,
  keyboardMousePlaced,
  microphoneArmClamped,
  lampPositioned,
  plantBooksStyled,
  collectiblesStacked,
  wallLedsEnabled,
  mediaConsoleStyled,
  sofaZoneStyled,
  roomLightingSet,
  selectedKeyboardSwitch,
  pressedKeyboardTargetId,
  onKeyboardPress
}: {
  caseOpen: boolean;
  psuMounted: boolean;
  motherboardMounted: boolean;
  cpuSeated: boolean;
  thermalPasteApplied: boolean;
  coolerMounted: boolean;
  ramInserted: boolean;
  ssdInstalled: boolean;
  gpuInstalled: boolean;
  fanInstalled: boolean;
  powerConnected: boolean;
  cablesManaged: boolean;
  firstBootPassed: boolean;
  showRoomPreview: boolean;
  pcPlacedOnDesk: boolean;
  monitorMounted: boolean;
  keyboardMousePlaced: boolean;
  microphoneArmClamped: boolean;
  lampPositioned: boolean;
  plantBooksStyled: boolean;
  collectiblesStacked: boolean;
  wallLedsEnabled: boolean;
  mediaConsoleStyled: boolean;
  sofaZoneStyled: boolean;
  roomLightingSet: boolean;
  selectedKeyboardSwitch: KeyboardSwitchKind;
  pressedKeyboardTargetId: string | null;
  onKeyboardPress: (targetId: string) => void;
}) {
  if (showRoomPreview) {
    return (
      <DeskRoomScene
        pcPlacedOnDesk={pcPlacedOnDesk}
        monitorMounted={monitorMounted}
        keyboardMousePlaced={keyboardMousePlaced}
        microphoneArmClamped={microphoneArmClamped}
        lampPositioned={lampPositioned}
        plantBooksStyled={plantBooksStyled}
        collectiblesStacked={collectiblesStacked}
        wallLedsEnabled={wallLedsEnabled}
        mediaConsoleStyled={mediaConsoleStyled}
        sofaZoneStyled={sofaZoneStyled}
        roomLightingSet={roomLightingSet}
        selectedKeyboardSwitch={selectedKeyboardSwitch}
        pressedKeyboardTargetId={pressedKeyboardTargetId}
        onKeyboardPress={onKeyboardPress}
      />
    );
  }

  return (
    <>
      <color attach="background" args={["#070a0e"]} />
      <ambientLight intensity={0.78} />
      <directionalLight position={[2.5, 4.8, 3.2]} intensity={2.8} castShadow shadow-mapSize={[1024, 1024]} />
      <pointLight position={[-2.4, 1.8, 2.4]} color="#ff7b94" intensity={2.1} distance={7} />
      <pointLight position={[2.1, 1.4, 1.6]} color="#7fd7ff" intensity={2.4} distance={6} />
      <group rotation={[0, 0.35, 0]} position={[0, -0.24, 0]} scale={0.72}>
        <mesh position={[0, -0.04, 0]} receiveShadow>
          <boxGeometry args={[4.9, 0.08, 3.2]} />
          <meshStandardMaterial color="#30251f" roughness={0.82} metalness={0.05} />
        </mesh>
        <Chassis caseOpen={caseOpen} />
        <PsuModule mounted={psuMounted} />
        {motherboardMounted ? <Motherboard /> : null}
        {motherboardMounted ? <CpuAssembly cpuSeated={cpuSeated} thermalPasteApplied={thermalPasteApplied} /> : null}
        <CoolerAssembly mounted={coolerMounted} />
        <RamModule inserted={ramInserted} />
        <SsdModule installed={ssdInstalled} />
        <GpuModule installed={gpuInstalled} />
        <CaseFan installed={fanInstalled} />
        <PowerCableHarness connected={powerConnected} managed={cablesManaged} />
        <BootPostIndicator active={firstBootPassed} />
        <CaseDetails />
        <mesh position={[1.28, 0.64, -0.72]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.28, 0.28, 0.055, 36]} />
          <meshStandardMaterial color="#111820" roughness={0.46} metalness={0.42} />
        </mesh>
        <mesh position={[1.28, 0.64, -0.72]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <torusGeometry args={[0.2, 0.015, 8, 36]} />
          <meshStandardMaterial color="#8fd7ff" emissive="#164f73" emissiveIntensity={0.32} roughness={0.35} />
        </mesh>
      </group>
      <OrbitControls
        enablePan={false}
        minDistance={3.2}
        maxDistance={7.2}
        maxPolarAngle={Math.PI / 2.05}
        target={[0, 0.04, 0]}
      />
    </>
  );
}

export default function PcAssemblyWorkbenchQaPage() {
  const [selectedCaseId, setSelectedCaseId] = useState<PcCaseId | null>(null);
  const [completedSteps, setCompletedSteps] = useState<CompletedAssemblyStep[]>([]);
  const [completedRoomSteps, setCompletedRoomSteps] = useState<CompletedRoomSetupStep[]>([]);
  const [audioEvents, setAudioEvents] = useState<ExperienceSound[]>([]);
  const [keyboardSwitchProfile, setKeyboardSwitchProfile] = useState<KeyboardSwitchKind>("clicky-blue");
  const [keyboardSwitchEvents, setKeyboardSwitchEvents] = useState<KeyboardSwitchPressEvent[]>([]);
  const [keyboardLastPressedTargetId, setKeyboardLastPressedTargetId] = useState<string | null>(null);
  const [savedPayload, setSavedPayload] = useState<PcAssemblyPayload | null>(null);
  const [cinematicQa, setCinematicQa] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shouldCompleteForCinematicQa = params.get("qaCinematic") === "1" && params.get("qaComplete") === "1";

    setCinematicQa(params.get("qaCinematic") === "1");
    if (!shouldCompleteForCinematicQa) return;

    setSelectedCaseId("lian-li-o11d-mini-v2-flow-white");
    setCompletedSteps(ASSEMBLY_STEPS.map((step) => step.id));
    setCompletedRoomSteps(ROOM_SETUP_STEPS.map((step) => step.id));
    setAudioEvents(["case-choice-confirm", ...ASSEMBLY_STEPS.map((step) => step.sound), ...ROOM_SETUP_STEPS.map((step) => step.sound)]);
  }, []);

  const selectedCase = PC_CASE_OPTIONS.find((caseOption) => caseOption.id === selectedCaseId) ?? null;
  const hasCompletedStep = (step: CompletedAssemblyStep) => completedSteps.includes(step);
  const hasCompletedRoomStep = (step: CompletedRoomSetupStep) => completedRoomSteps.includes(step);
  const caseOpen = hasCompletedStep("case-side-panels-removed") && !hasCompletedStep("side-panels-closed");
  const psuMounted = hasCompletedStep("psu-mounted");
  const motherboardMounted = hasCompletedStep("motherboard-screws-tightened");
  const cpuSeated = hasCompletedStep("cpu-seated") || hasCompletedStep("cpu-retention-locked");
  const thermalPasteApplied = hasCompletedStep("thermal-paste-applied");
  const coolerMounted = hasCompletedStep("pump-block-mounted") || hasCompletedStep("radiator-mounted");
  const ramInserted = hasCompletedStep("ram-a2-inserted") && hasCompletedStep("ram-b2-inserted");
  const ssdInstalled = hasCompletedStep("m2-heatsink-reinstalled");
  const gpuInstalled = hasCompletedStep("gpu-inserted");
  const fanInstalled = hasCompletedStep("case-fans-mounted") || hasCompletedStep("radiator-fans-connected");
  const powerConnected =
    hasCompletedStep("atx-24pin-connected") ||
    hasCompletedStep("eps-8pin-connected") ||
    hasCompletedStep("gpu-power-connected") ||
    hasCompletedStep("external-cables-connected");
  const cablesManaged = hasCompletedStep("cable-management-tied");
  const firstBootPassed = hasCompletedStep("bios-post-confirmed");
  const pcPlacedOnDesk = hasCompletedRoomStep("pc-placed-on-desk");
  const monitorMounted = hasCompletedRoomStep("monitor-mounted");
  const keyboardMousePlaced = hasCompletedRoomStep("keyboard-mouse-placed");
  const microphoneArmClamped = hasCompletedRoomStep("microphone-arm-clamped");
  const lampPositioned = hasCompletedRoomStep("lamp-positioned");
  const plantBooksStyled = hasCompletedRoomStep("plant-and-books-styled");
  const collectiblesStacked = hasCompletedRoomStep("collectibles-stacked");
  const wallLedsEnabled = hasCompletedRoomStep("wall-leds-enabled");
  const mediaConsoleStyled = hasCompletedRoomStep("media-console-styled");
  const sofaZoneStyled = hasCompletedRoomStep("sofa-zone-styled");
  const roomLightingSet = hasCompletedRoomStep("room-lighting-set");
  const deskStyled = pcPlacedOnDesk && monitorMounted && keyboardMousePlaced && microphoneArmClamped && lampPositioned;
  const roomStyled =
    plantBooksStyled && collectiblesStacked && wallLedsEnabled && mediaConsoleStyled && sofaZoneStyled && roomLightingSet;
  const roomCurrentStep = getRoomCurrentStep(completedRoomSteps);
  const currentStep = getCurrentStep(completedSteps, completedRoomSteps);
  const thermalPasteCoverage = thermalPasteApplied ? 0.74 : 0;
  const allStepsComplete = completedSteps.length === TOTAL_ASSEMBLY_STEPS;
  const roomSetupComplete = completedRoomSteps.length === TOTAL_ROOM_SETUP_STEPS;
  const brunoSimonMood = roomSetupComplete;
  const flowComplete = selectedCaseId !== null && allStepsComplete && roomSetupComplete;
  const showRoomPreview = allStepsComplete || completedRoomSteps.length > 0;
  const checklistComplete = flowComplete && savedPayload !== null;
  const compatibilityEvaluation = useMemo(() => evaluateBuildCompatibility(COMPZ_P2364W_BUILD), []);
  const physicalFitEvaluation = useMemo(() => evaluatePhysicalFit(COMPZ_P2364W_BUILD), []);
  const buildEvaluation = useMemo(
    () => mergeBuildEvaluations(compatibilityEvaluation, physicalFitEvaluation),
    [compatibilityEvaluation, physicalFitEvaluation]
  );
  const attachmentSummary = useMemo(() => getAttachmentSummary(COMPZ_P2364W_BUILD, completedSteps), [completedSteps]);
  const assemblyStateEvidence = useMemo(() => getAssemblyStateEvidence(completedSteps), [completedSteps]);
  const pcSystemEvidence: PcAssemblyPayload["pcSystem"] = useMemo(
    () => ({
      compatibilityStatus: compatibilityEvaluation.status,
      compatibilityChecks: compatibilityEvaluation.checks.length,
      physicalFitStatus: physicalFitEvaluation.status,
      physicalFitChecks: physicalFitEvaluation.checks.length,
      attachmentAnchors: attachmentSummary.anchorCount,
      occupiedAttachmentAnchors: attachmentSummary.occupiedAnchorCount,
      stateMachineComplete: assemblyStateEvidence.stateMachineComplete,
      uniqueCompletedAnchorCount: assemblyStateEvidence.uniqueCompletedAnchorCount
    }),
    [
      compatibilityEvaluation,
      physicalFitEvaluation,
      attachmentSummary,
      assemblyStateEvidence
    ]
  );

  const qaRegistry = useMemo<PcAssemblyQaRegistry>(
    () => ({
      currentStep,
      selectedCaseId,
      caseSelectionComplete: selectedCaseId !== null,
      completedSteps,
      stepCount: completedSteps.length,
      totalSteps: TOTAL_ASSEMBLY_STEPS,
      completedRoomSteps,
      roomCurrentStep,
      roomStepCount: completedRoomSteps.length,
      totalRoomSteps: TOTAL_ROOM_SETUP_STEPS,
      caseOpen,
      psuMounted,
      motherboardMounted,
      cpuSeated,
      thermalPasteApplied,
      coolerMounted,
      ramInserted,
      ssdInstalled,
      gpuInstalled,
      fanInstalled,
      cablesManaged,
      firstBootPassed,
      pcPlacedOnDesk,
      deskStyled,
      roomStyled,
      brunoSimonMood,
      thermalPasteCoverage,
      audioEvents,
      keyboardSwitchProfile,
      keyboardSwitchEvents,
      keyboardLastPressedTargetId,
      savedPayload,
      pcSystem: pcSystemEvidence,
      flowComplete,
      checklistComplete
    }),
    [
      currentStep,
      selectedCaseId,
      completedSteps,
      completedRoomSteps,
      roomCurrentStep,
      caseOpen,
      psuMounted,
      motherboardMounted,
      cpuSeated,
      thermalPasteApplied,
      coolerMounted,
      ramInserted,
      ssdInstalled,
      gpuInstalled,
      fanInstalled,
      cablesManaged,
      firstBootPassed,
      pcPlacedOnDesk,
      deskStyled,
      roomStyled,
      brunoSimonMood,
      thermalPasteCoverage,
      audioEvents,
      keyboardSwitchProfile,
      keyboardSwitchEvents,
      keyboardLastPressedTargetId,
      savedPayload,
      pcSystemEvidence,
      flowComplete,
      checklistComplete
    ]
  );

  useEffect(() => {
    window.__DESKTERIORONLINE_PC_ASSEMBLY_QA__ = qaRegistry;
    return () => {
      delete window.__DESKTERIORONLINE_PC_ASSEMBLY_QA__;
    };
  }, [qaRegistry]);

  const saveAssemblyState = () => {
    if (!selectedCase) return;
    const payload: PcAssemblyPayload = {
      version: 1,
      savedAt: new Date().toISOString(),
      mode: "pc-assembly-workbench",
      currentStep,
      selectedCase: {
        id: selectedCase.id,
        label: selectedCase.label,
        maker: selectedCase.maker,
        fit: selectedCase.fit,
        finish: selectedCase.finish
      },
      completedSteps,
      totalSteps: TOTAL_ASSEMBLY_STEPS,
      components: {
        caseOpen,
        psuMounted,
        motherboardMounted,
        cpuSeated,
        thermalPasteApplied,
        coolerMounted,
        ramInserted,
        ssdInstalled,
        gpuInstalled,
        fanInstalled,
        cablesManaged,
        firstBootPassed
      },
      roomSetup: {
        currentStep: roomCurrentStep,
        completedSteps: completedRoomSteps,
        totalSteps: TOTAL_ROOM_SETUP_STEPS,
        pcPlacedOnDesk,
        deskStyled,
        roomStyled,
        brunoSimonMood
      },
      interactions: {
        thermalPasteCoverage,
        audioEvents,
        keyboardSwitchProfile,
        keyboardSwitchEvents,
        keyboardLastPressedTargetId
      },
      pcSystem: pcSystemEvidence,
      quote: {
        productNo: "1336041",
        productUrl: COMPZ_P2364W_PRODUCT_URL,
        parts: COMPZ_P2364W_PARTS
      }
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    setSavedPayload(payload);
  };

  const selectCase = (caseId: PcCaseId) => {
    if (selectedCaseId === caseId) return;
    setSelectedCaseId(caseId);
    setSavedPayload(null);
    setAudioEvents((previous) => [...previous, "case-choice-confirm"]);
    try {
      playAssemblyCue("case-choice-confirm");
    } catch {
      // Audio playback must not block the assembly state machine in muted or restricted browser contexts.
    }
  };

  const completeAssemblyStep = (step: (typeof ASSEMBLY_STEPS)[number]) => {
    if (completedSteps.includes(step.id)) return;
    setSavedPayload(null);
    setCompletedSteps((previous) => [...previous, step.id]);
    setAudioEvents((previous) => [...previous, step.sound]);
    try {
      playAssemblyCue(step.sound);
    } catch {
      // Audio playback must not block the assembly state machine in muted or restricted browser contexts.
    }
  };

  const completeRoomSetupStep = (step: (typeof ROOM_SETUP_STEPS)[number]) => {
    if (completedRoomSteps.includes(step.id)) return;
    setSavedPayload(null);
    setCompletedRoomSteps((previous) => [...previous, step.id]);
    setAudioEvents((previous) => [...previous, step.sound]);
    try {
      playAssemblyCue(step.sound);
    } catch {
      // Audio playback must not block the room setup state machine in muted or restricted browser contexts.
    }
  };

  const pressKeyboardSwitch = (targetId: string) => {
    const eventName = `keyboard-switch-${keyboardSwitchProfile}-press` as KeyboardSwitchPressEvent;
    setSavedPayload(null);
    setKeyboardLastPressedTargetId(targetId);
    setKeyboardSwitchEvents((previous) => [...previous, eventName]);
    window.setTimeout(() => {
      setKeyboardLastPressedTargetId((previous) => (previous === targetId ? null : previous));
    }, 120);
    try {
      playKeyboardSwitchCue(keyboardSwitchProfile);
    } catch {
      // Keyboard audio is an optional tactile layer; UI state remains valid if browser audio is blocked.
    }
  };

  const canRunStep = (stepIndex: number) => {
    if (!selectedCaseId) return false;
    if (stepIndex === 0) return true;
    const previousStep = ASSEMBLY_STEPS[stepIndex - 1];
    return previousStep ? completedSteps.includes(previousStep.id) : false;
  };

  const canRunRoomStep = (stepIndex: number) => {
    if (!allStepsComplete) return false;
    if (stepIndex === 0) return true;
    const previousStep = ROOM_SETUP_STEPS[stepIndex - 1];
    return previousStep ? completedRoomSteps.includes(previousStep.id) : false;
  };

  return (
    <main className={cinematicQa ? "fixed inset-0 z-[9999] bg-[#05070a] text-[#f8f1e8]" : "min-h-[calc(100vh-49px)] bg-[#080a0d] text-[#f8f1e8]"}>
      <section
        className={
          cinematicQa
            ? "h-screen w-screen"
            : "mx-auto grid min-h-[calc(100vh-49px)] max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-8"
        }
      >
        <div
          className={
            cinematicQa
              ? "relative h-screen w-screen overflow-hidden bg-[#05070a]"
              : "relative overflow-hidden rounded-[22px] border border-white/10 bg-[#0d1117] shadow-[0_24px_72px_rgba(0,0,0,0.32)]"
          }
        >
          {cinematicQa ? null : (
            <div className="absolute left-5 top-5 z-10 rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#b9c9d6] backdrop-blur">
              PC assembly workbench QA
            </div>
          )}
          <div data-testid="pc-assembly-canvas" className={cinematicQa ? "h-screen w-screen" : "h-[64vh] min-h-[520px] w-full lg:h-full"}>
            <Canvas
              camera={{ position: [4.8, 3.0, 5.4], fov: 38 }}
              frameloop="demand"
              dpr={cinematicQa ? 1.5 : 1.25}
              shadows
              gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true }}
              onCreated={({ gl }) => {
                const isCinematicCapture =
                  typeof window !== "undefined" && new URLSearchParams(window.location.search).get("qaCinematic") === "1";
                gl.toneMapping = THREE.ACESFilmicToneMapping;
                gl.toneMappingExposure = isCinematicCapture ? 0.42 : 0.5;
                gl.outputColorSpace = THREE.SRGBColorSpace;
                gl.shadowMap.type = THREE.PCFSoftShadowMap;
                configureRuntimeAssetLoaders(gl);
              }}
            >
          <WorkbenchScene
                caseOpen={caseOpen}
                psuMounted={psuMounted}
                motherboardMounted={motherboardMounted}
                cpuSeated={cpuSeated}
                thermalPasteApplied={thermalPasteApplied}
                coolerMounted={coolerMounted}
                ramInserted={ramInserted}
                ssdInstalled={ssdInstalled}
                gpuInstalled={gpuInstalled}
                fanInstalled={fanInstalled}
                powerConnected={powerConnected}
                cablesManaged={cablesManaged}
                firstBootPassed={firstBootPassed}
                showRoomPreview={showRoomPreview}
                pcPlacedOnDesk={pcPlacedOnDesk}
                monitorMounted={monitorMounted}
                keyboardMousePlaced={keyboardMousePlaced}
                microphoneArmClamped={microphoneArmClamped}
                lampPositioned={lampPositioned}
                plantBooksStyled={plantBooksStyled}
                collectiblesStacked={collectiblesStacked}
                wallLedsEnabled={wallLedsEnabled}
                mediaConsoleStyled={mediaConsoleStyled}
                sofaZoneStyled={sofaZoneStyled}
                roomLightingSet={roomLightingSet}
                selectedKeyboardSwitch={keyboardSwitchProfile}
                pressedKeyboardTargetId={keyboardLastPressedTargetId}
                onKeyboardPress={pressKeyboardSwitch}
              />
            </Canvas>
            {cinematicQa ? (
              <>
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background:
                      "radial-gradient(circle at 50% 38%, rgba(255,255,255,0) 48%, rgba(3,5,9,0.22) 76%, rgba(0,0,0,0.5) 100%)",
                    mixBlendMode: "multiply"
                  }}
                />
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(120deg, rgba(63,142,255,0.1) 0%, rgba(255,255,255,0) 44%, rgba(255,75,132,0.12) 100%)",
                    mixBlendMode: "screen",
                    opacity: 0.74
                  }}
                />
              </>
            ) : null}
          </div>
        </div>

        {cinematicQa ? null : (
        <aside className="flex flex-col justify-between gap-5 rounded-[22px] border border-white/10 bg-[#111820] p-5 shadow-[0_24px_72px_rgba(0,0,0,0.28)]">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#8fd7ff]">
              <Cpu className="h-4 w-4" />
              조립 단계
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-normal text-white">PC 본체 조립 랩</h1>
            <p className="mt-3 text-sm leading-6 text-[#b8c2cc]">
              Compuzone P2364W 견적 기준으로 케이스를 고르고, 실제 PC 조립 순서를 거친 뒤 완성 본체를 책상과 방 안에 배치한다.
            </p>

            <div className="mt-5 rounded-lg border border-white/10 bg-black/20 p-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8fd7ff]">case selection</div>
              <div className="mt-3 grid gap-3">
                {PC_CASE_OPTIONS.map((caseOption) => (
                  <button
                    key={caseOption.id}
                    type="button"
                    data-testid={`pc-case-${caseOption.id}`}
                    onClick={() => selectCase(caseOption.id)}
                    className="grid min-h-[70px] gap-1 rounded-lg border border-white/10 bg-white/[0.08] p-3 text-left transition hover:border-[#8fd7ff]/45 hover:bg-[#8fd7ff]/12"
                  >
                    <span className="flex items-center justify-between gap-3 text-sm font-semibold text-white">
                      {caseOption.label}
                      {selectedCaseId === caseOption.id ? <CheckCircle2 className="h-5 w-5 text-[#7de0aa]" /> : null}
                    </span>
                    <span className="text-xs leading-5 text-[#aeb9c4]">
                      {caseOption.fit} / {caseOption.finish}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 rounded-lg border border-white/10 bg-black/20 p-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8fd7ff]">pc system</div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-lg border border-white/10 bg-white/[0.06] p-3">
                  <div className="font-semibold text-[#83919d]">Compatibility</div>
                  <div data-testid="pc-compatibility-status" className="mt-2 text-sm font-bold text-white">
                    {compatibilityEvaluation.status.toUpperCase()} · {compatibilityEvaluation.passCount}/{compatibilityEvaluation.checks.length}
                  </div>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/[0.06] p-3">
                  <div className="font-semibold text-[#83919d]">Physical fit</div>
                  <div data-testid="pc-physical-fit-status" className="mt-2 text-sm font-bold text-white">
                    {physicalFitEvaluation.status.toUpperCase()} · {physicalFitEvaluation.passCount}/{physicalFitEvaluation.checks.length}
                  </div>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/[0.06] p-3">
                  <div className="font-semibold text-[#83919d]">Attachment</div>
                  <div data-testid="pc-attachment-anchors" className="mt-2 text-sm font-bold text-white">
                    {attachmentSummary.occupiedAnchorCount}/{attachmentSummary.anchorCount}
                  </div>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/[0.06] p-3">
                  <div className="font-semibold text-[#83919d]">State machine</div>
                  <div data-testid="pc-state-machine-status" className="mt-2 text-sm font-bold text-white">
                    {assemblyStateEvidence.orderedStepCount}/{assemblyStateEvidence.totalStepCount}
                  </div>
                </div>
              </div>
            </div>

            <div data-testid="keyboard-switch-panel" className="mt-5 rounded-lg border border-white/10 bg-black/20 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8fd7ff]">keyboard switch</div>
                  <div data-testid="keyboard-switch-selected" className="mt-1 text-xs font-semibold text-white">
                    {KEYBOARD_SWITCH_PROFILES[keyboardSwitchProfile].label} · {KEYBOARD_SWITCH_PROFILES[keyboardSwitchProfile].forceCN}cN
                  </div>
                </div>
                <button
                  type="button"
                  data-testid="keyboard-switch-test-press"
                  onClick={() => pressKeyboardSwitch("panel-test")}
                  className="inline-flex min-h-[34px] items-center gap-2 rounded-lg border border-[#8fd7ff]/30 bg-[#8fd7ff]/12 px-3 text-xs font-bold text-[#d9f4ff] transition hover:bg-[#8fd7ff]/20"
                >
                  <Volume2 className="h-4 w-4" />
                  타건
                </button>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {KEYBOARD_SWITCH_OPTIONS.map((switchKind) => {
                  const profile = KEYBOARD_SWITCH_PROFILES[switchKind];
                  const selected = keyboardSwitchProfile === switchKind;
                  return (
                    <button
                      type="button"
                      key={switchKind}
                      data-testid={`keyboard-switch-option-${switchKind}`}
                      onClick={() => setKeyboardSwitchProfile(switchKind)}
                      className={
                        selected
                          ? "min-h-[46px] rounded-lg border border-[#f7c76b] bg-[#f7c76b]/18 px-2 text-left text-xs font-bold text-white"
                          : "min-h-[46px] rounded-lg border border-white/10 bg-white/[0.05] px-2 text-left text-xs font-semibold text-[#aeb9c4] transition hover:border-white/20 hover:bg-white/[0.08]"
                      }
                    >
                      <span className="block">{profile.label}</span>
                      <span className="mt-1 block text-[10px] font-semibold text-[#83919d]">
                        {profile.preTravelMm}/{profile.totalTravelMm}mm
                      </span>
                    </button>
                  );
                })}
              </div>
              <div data-testid="keyboard-switch-events" className="mt-3 text-xs font-semibold text-[#aeb9c4]">
                switch events {keyboardSwitchEvents.length}
              </div>
            </div>

            <div className="mt-5 grid max-h-[30vh] gap-3 overflow-auto pr-1">
              {ASSEMBLY_STEPS.map((step, index) => (
                <StepButton
                  key={step.id}
                  testId={`pc-step-${step.id}`}
                  label={`${String(index + 1).padStart(2, "0")}. ${step.label}`}
                  icon={step.sound.includes("click") || step.sound.includes("beep") ? <Volume2 className="h-4 w-4" /> : <Cpu className="h-4 w-4" />}
                  disabled={!canRunStep(index)}
                  complete={completedSteps.includes(step.id)}
                  onClick={() => completeAssemblyStep(step)}
                />
              ))}
            </div>

            <div className="mt-5 rounded-lg border border-white/10 bg-black/20 p-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8fd7ff]">deskterior room setup</div>
              <div className="mt-3 grid max-h-[24vh] gap-3 overflow-auto pr-1">
                {ROOM_SETUP_STEPS.map((step, index) => (
                  <StepButton
                    key={step.id}
                    testId={`room-step-${step.id}`}
                    label={`${String(index + 1).padStart(2, "0")}. ${step.label}`}
                    icon={step.sound.includes("chime") || step.sound.includes("swell") ? <Volume2 className="h-4 w-4" /> : <Cpu className="h-4 w-4" />}
                    disabled={!canRunRoomStep(index)}
                    complete={completedRoomSteps.includes(step.id)}
                    onClick={() => completeRoomSetupStep(step)}
                  />
                ))}
              </div>
            </div>

            <div className="mt-5 max-h-[220px] overflow-auto rounded-lg border border-white/10 bg-black/20 p-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8fd7ff]">quote 1336041</div>
              <ul className="mt-3 space-y-2">
                {COMPZ_P2364W_PARTS.map((part) => (
                  <li key={`${part.category}-${part.slot}`} className="grid gap-1 border-b border-white/[0.06] pb-2 last:border-0 last:pb-0">
                    <span className="text-xs font-semibold text-white">{part.category}</span>
                    <span className="text-xs leading-5 text-[#aeb9c4]">{part.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="space-y-4">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border border-white/10 bg-white/[0.06] p-3">
                <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#83919d]">case</dt>
                <dd data-testid="pc-selected-case" className="mt-2 font-semibold text-white">
                  {selectedCaseId ? "selected" : "none"}
                </dd>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.06] p-3">
                <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#83919d]">assembly</dt>
                <dd data-testid="pc-current-step" className="mt-2 font-semibold text-white">
                  {completedSteps.length}/{TOTAL_ASSEMBLY_STEPS}
                </dd>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.06] p-3">
                <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#83919d]">room</dt>
                <dd data-testid="pc-room-step" className="mt-2 font-semibold text-white">
                  {completedRoomSteps.length}/{TOTAL_ROOM_SETUP_STEPS}
                </dd>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.06] p-3">
                <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#83919d]">thermal</dt>
                <dd data-testid="pc-thermal-coverage" className="mt-2 font-semibold text-white">
                  {Math.round(thermalPasteCoverage * 100)}%
                </dd>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.06] p-3">
                <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#83919d]">sound</dt>
                <dd data-testid="pc-audio-events" className="mt-2 font-semibold text-white">
                  {audioEvents.length}
                </dd>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.06] p-3">
                <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#83919d]">saved</dt>
                <dd data-testid="pc-save-status" className="mt-2 font-semibold text-white">
                  {savedPayload ? "yes" : "no"}
                </dd>
              </div>
            </dl>

            <button
              type="button"
              data-testid="pc-assembly-save-state"
              disabled={!flowComplete}
              onClick={saveAssemblyState}
              className="flex min-h-[50px] w-full items-center justify-center gap-2 rounded-lg bg-[#f7c76b] px-4 text-sm font-bold text-[#1a130a] transition hover:bg-[#ffd98d] disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Save className="h-4 w-4" />
              상태 저장
            </button>
          </div>
        </aside>
        )}
      </section>
    </main>
  );
}
