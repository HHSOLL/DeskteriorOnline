export const ASSEMBLY_STEPS = [
  { id: "workspace-prep", label: "정전기 방지/작업 공간 준비", sound: "soft-tool-set", anchorId: null },
  { id: "motherboard-on-box", label: "메인보드를 박스 위에 올리기", sound: "soft-part-place", anchorId: null },
  { id: "socket-lever-opened", label: "AM5 소켓 레버 열기", sound: "metal-lever-click", anchorId: "CPU_SOCKET_AM5" },
  { id: "cpu-aligned", label: "CPU 삼각 마커 정렬", sound: "cpu-seat-tick", anchorId: "CPU_SOCKET_AM5" },
  { id: "cpu-seated", label: "CPU 소켓에 안착", sound: "cpu-seat-tick", anchorId: "CPU_SOCKET_AM5" },
  { id: "cpu-retention-locked", label: "CPU 고정 레버 잠금", sound: "metal-latch-snap", anchorId: "CPU_SOCKET_AM5" },
  { id: "m2-heatsink-removed", label: "M.2 방열판 분리", sound: "screw-loosen", anchorId: "M2_2280_PRIMARY" },
  { id: "ssd-inserted", label: "M.2 NVMe SSD 삽입", sound: "m2-snap", anchorId: "M2_2280_PRIMARY" },
  { id: "m2-screw-tightened", label: "M.2 고정 나사 조임", sound: "screw-tighten", anchorId: "M2_2280_PRIMARY" },
  { id: "m2-heatsink-reinstalled", label: "M.2 방열판 재장착", sound: "screw-tighten", anchorId: "M2_2280_PRIMARY" },
  { id: "ram-latches-opened", label: "DDR5 슬롯 래치 열기", sound: "plastic-latch-click", anchorId: "DIMM_A2_DDR5" },
  { id: "ram-a2-inserted", label: "RAM A2 슬롯 체결", sound: "ram-latch-click", anchorId: "DIMM_A2_DDR5" },
  { id: "ram-b2-inserted", label: "RAM B2 슬롯 체결", sound: "ram-latch-click", anchorId: "DIMM_B2_DDR5" },
  { id: "case-side-panels-removed", label: "케이스 양쪽 패널 분리", sound: "glass-panel-slide", anchorId: null },
  { id: "case-standoffs-checked", label: "M-ATX 스탠드오프 위치 확인", sound: "standoff-tap", anchorId: "CASE_MOTHERBOARD_TRAY_MATX" },
  { id: "io-shield-aligned", label: "후면 I/O 포트 정렬", sound: "soft-part-place", anchorId: "CASE_MOTHERBOARD_TRAY_MATX" },
  { id: "motherboard-lowered", label: "메인보드 케이스에 안착", sound: "soft-part-place", anchorId: "CASE_MOTHERBOARD_TRAY_MATX" },
  { id: "motherboard-screws-tightened", label: "메인보드 나사 체결", sound: "screw-tighten", anchorId: "CASE_MOTHERBOARD_TRAY_MATX" },
  { id: "psu-bracket-mounted", label: "PSU 브래킷 결합", sound: "psu-rail-thunk", anchorId: "CASE_PSU_BAY_ATX" },
  { id: "psu-mounted", label: "파워서플라이 장착", sound: "psu-rail-thunk", anchorId: "CASE_PSU_BAY_ATX" },
  { id: "atx-24pin-connected", label: "24핀 ATX 전원 연결", sound: "cable-plug-click", anchorId: "ATX_24PIN" },
  { id: "eps-8pin-connected", label: "CPU EPS 8핀 전원 연결", sound: "cable-plug-click", anchorId: "EPS_8PIN" },
  { id: "cooler-brackets-mounted", label: "수랭 쿨러 브래킷 장착", sound: "screw-tighten", anchorId: "CPU_SOCKET_AM5" },
  { id: "thermal-paste-applied", label: "CPU 써멀 도포", sound: "thermal-paste-press", anchorId: "CPU_SOCKET_AM5" },
  { id: "pump-block-mounted", label: "펌프/콜드플레이트 고정", sound: "cooler-pump-seat", anchorId: "CPU_SOCKET_AM5" },
  { id: "radiator-mounted", label: "360mm 라디에이터 장착", sound: "screw-tighten", anchorId: "CASE_TOP_RADIATOR_360" },
  { id: "radiator-fans-connected", label: "라디에이터 팬/PWM 연결", sound: "fan-magnetic-snap", anchorId: "CASE_TOP_RADIATOR_360" },
  { id: "case-fans-mounted", label: "케이스 팬 장착", sound: "fan-magnetic-snap", anchorId: "CASE_BOTTOM_FAN_120_1" },
  { id: "front-panel-connected", label: "전원/리셋/LED 헤더 연결", sound: "tiny-header-click", anchorId: "ATX_24PIN" },
  { id: "usb-audio-connected", label: "USB/오디오 헤더 연결", sound: "tiny-header-click", anchorId: "ATX_24PIN" },
  { id: "gpu-slot-covers-removed", label: "PCIe 슬롯 커버 분리", sound: "screw-loosen", anchorId: "PCIE_X16_PRIMARY" },
  { id: "gpu-inserted", label: "그래픽카드 PCIe 체결", sound: "gpu-latch-click", anchorId: "PCIE_X16_PRIMARY" },
  { id: "gpu-power-connected", label: "GPU 보조전원 연결", sound: "cable-plug-click", anchorId: "GPU_12V_2X6" },
  { id: "cable-management-tied", label: "케이블 정리/벨크로 고정", sound: "cable-tie-pull", anchorId: "GPU_12V_2X6" },
  { id: "side-panels-closed", label: "강화유리/측면 패널 닫기", sound: "panel-close-click", anchorId: null },
  { id: "external-cables-connected", label: "모니터/키보드/전원 연결", sound: "cable-plug-click", anchorId: null },
  { id: "first-boot-powered", label: "첫 전원 인가", sound: "power-boot-chime", anchorId: null },
  { id: "bios-post-confirmed", label: "BIOS POST 확인", sound: "bios-post-beep", anchorId: null }
] as const;

export const ROOM_SETUP_STEPS = [
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

export const TOTAL_ASSEMBLY_STEPS = ASSEMBLY_STEPS.length;
export const TOTAL_ROOM_SETUP_STEPS = ROOM_SETUP_STEPS.length;

export type CompletedAssemblyStep = (typeof ASSEMBLY_STEPS)[number]["id"];
export type CompletedRoomSetupStep = (typeof ROOM_SETUP_STEPS)[number]["id"];
export type FlowStep = "not-started" | CompletedAssemblyStep | CompletedRoomSetupStep;
export type AssemblySound = (typeof ASSEMBLY_STEPS)[number]["sound"];
export type CaseSelectionSound = "case-choice-confirm";
export type RoomSetupSound = (typeof ROOM_SETUP_STEPS)[number]["sound"];
export type ExperienceSound = AssemblySound | CaseSelectionSound | RoomSetupSound;

export function getCurrentStep(
  completedSteps: CompletedAssemblyStep[],
  completedRoomSteps: CompletedRoomSetupStep[]
): FlowStep {
  if (completedRoomSteps.length > 0) return completedRoomSteps[completedRoomSteps.length - 1] ?? "not-started";
  if (completedSteps.length === 0) return "not-started";
  return completedSteps[completedSteps.length - 1] ?? "not-started";
}

export function getRoomCurrentStep(
  completedRoomSteps: CompletedRoomSetupStep[]
): "not-started" | CompletedRoomSetupStep {
  if (completedRoomSteps.length === 0) return "not-started";
  return completedRoomSteps[completedRoomSteps.length - 1] ?? "not-started";
}

export function canRunOrderedStep<TStep extends string>(steps: readonly TStep[], completedSteps: readonly TStep[], index: number) {
  if (index === 0) return true;
  const previousStep = steps[index - 1];
  return previousStep ? completedSteps.includes(previousStep) : false;
}

export function getAssemblyStateEvidence(completedSteps: readonly CompletedAssemblyStep[]) {
  const completed = new Set(completedSteps);
  const anchorSteps = ASSEMBLY_STEPS.filter((step) => step.anchorId !== null);
  const completedAnchorSteps = anchorSteps.filter((step) => completed.has(step.id));
  const uniqueCompletedAnchors = new Set(completedAnchorSteps.map((step) => step.anchorId));

  return {
    orderedStepCount: completedSteps.length,
    totalStepCount: TOTAL_ASSEMBLY_STEPS,
    anchorStepCount: completedAnchorSteps.length,
    totalAnchorStepCount: anchorSteps.length,
    uniqueCompletedAnchorCount: uniqueCompletedAnchors.size,
    stateMachineComplete: completedSteps.length === TOTAL_ASSEMBLY_STEPS
  };
}
