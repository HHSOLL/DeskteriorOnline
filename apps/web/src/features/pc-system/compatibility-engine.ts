import type { BuildCheck, BuildCheckSeverity, BuildEvaluation, PcBuildSpec, PcPartSpec } from "./types";

function getStatus(checks: BuildCheck[]): BuildCheckSeverity {
  if (checks.some((check) => check.severity === "fail")) return "fail";
  if (checks.some((check) => check.severity === "warning")) return "warning";
  return "pass";
}

function summarize(checks: BuildCheck[]): BuildEvaluation {
  return {
    status: getStatus(checks),
    passCount: checks.filter((check) => check.severity === "pass").length,
    warningCount: checks.filter((check) => check.severity === "warning").length,
    failCount: checks.filter((check) => check.severity === "fail").length,
    checks
  };
}

function partByCategory(build: PcBuildSpec, category: PcPartSpec["category"]) {
  return Object.values(build.parts).find((part) => part.category === category);
}

export function evaluateBuildCompatibility(build: PcBuildSpec): BuildEvaluation {
  const motherboard = partByCategory(build, "motherboard");
  const cpu = partByCategory(build, "cpu");
  const memory = partByCategory(build, "memory");
  const storage = partByCategory(build, "storage");
  const gpu = partByCategory(build, "gpu");
  const psu = partByCategory(build, "psu");
  const cooler = partByCategory(build, "cpu-cooler");
  const checks: BuildCheck[] = [];

  checks.push({
    id: "cpu-socket",
    label: "CPU socket",
    severity: motherboard?.socket && cpu?.socket && motherboard.socket === cpu.socket ? "pass" : "fail",
    detail: `${cpu?.label ?? "CPU"} requires ${cpu?.socket ?? "unknown"} and motherboard exposes ${motherboard?.socket ?? "unknown"}.`,
    sourcePartIds: ["amd-ryzen-7-9800x3d", "gigabyte-b850m-aorus-elite-wifi6e-ice"]
  });
  checks.push({
    id: "memory-type",
    label: "Memory type",
    severity: motherboard?.memoryType && memory?.memoryType && motherboard.memoryType === memory.memoryType ? "pass" : "fail",
    detail: `${memory?.label ?? "RAM"} is ${memory?.memoryType ?? "unknown"} and board memory type is ${motherboard?.memoryType ?? "unknown"}.`,
    sourcePartIds: ["kleVV-urbane-v-rgb-ddr5-6000-32gb-white", "gigabyte-b850m-aorus-elite-wifi6e-ice"]
  });
  checks.push({
    id: "m2-form-factor",
    label: "M.2 storage",
    severity: storage?.m2FormFactor === "2280" ? "pass" : "fail",
    detail: `${storage?.label ?? "SSD"} uses ${storage?.m2FormFactor ?? "unknown"} form factor for the primary board M.2 anchor.`,
    sourcePartIds: ["kleVV-cras-c930-m2-2280-1tb", "gigabyte-b850m-aorus-elite-wifi6e-ice"]
  });
  checks.push({
    id: "gpu-interface",
    label: "GPU interface",
    severity: gpu?.pcieInterface?.includes("x16") && motherboard?.pcieInterface?.includes("x16") ? "pass" : "fail",
    detail: `${gpu?.label ?? "GPU"} targets ${gpu?.pcieInterface ?? "unknown"} and the primary board slot is ${motherboard?.pcieInterface ?? "unknown"}.`,
    sourcePartIds: ["asus-rog-astral-rtx5080-o16g-white", "gigabyte-b850m-aorus-elite-wifi6e-ice"]
  });
  checks.push({
    id: "psu-headroom",
    label: "PSU headroom",
    severity: (psu?.wattageW ?? 0) >= (gpu?.recommendedPsuW ?? 0) ? "pass" : "fail",
    detail: `${psu?.wattageW ?? 0}W PSU against GPU recommended ${gpu?.recommendedPsuW ?? 0}W.`,
    sourcePartIds: ["lian-li-edge-gold-1000-white", "asus-rog-astral-rtx5080-o16g-white"]
  });
  checks.push({
    id: "cooler-socket",
    label: "Cooler socket",
    severity: cooler?.socket === cpu?.socket ? "pass" : "fail",
    detail: `${cooler?.label ?? "Cooler"} is mapped to ${cooler?.socket ?? "unknown"} for ${cpu?.label ?? "CPU"}.`,
    sourcePartIds: ["lian-li-hydroshift-ii-lcd-c-360tl-white", "amd-ryzen-7-9800x3d"]
  });

  return summarize(checks);
}

export function evaluatePhysicalFit(build: PcBuildSpec): BuildEvaluation {
  const pcCase = partByCategory(build, "case");
  const motherboard = partByCategory(build, "motherboard");
  const gpu = partByCategory(build, "gpu");
  const psu = partByCategory(build, "psu");
  const cooler = partByCategory(build, "cpu-cooler");
  const caseFan = partByCategory(build, "case-fan");
  const clearances = pcCase?.clearances;
  const checks: BuildCheck[] = [];

  checks.push({
    id: "motherboard-tray-fit",
    label: "Motherboard tray",
    severity:
      motherboard?.motherboardFormFactor && clearances?.gpuLengthMm && pcCase?.supportedMotherboardFormFactors?.includes(motherboard.motherboardFormFactor)
        ? "pass"
        : "fail",
    detail: `${motherboard?.motherboardFormFactor ?? "unknown"} board in ${pcCase?.label ?? "case"} supported tray list.`,
    sourcePartIds: ["lian-li-o11d-mini-v2-flow-white", "gigabyte-b850m-aorus-elite-wifi6e-ice"]
  });
  checks.push({
    id: "gpu-length-fit",
    label: "GPU length",
    severity: (gpu?.dimensionsMm?.length ?? Infinity) <= (clearances?.gpuLengthMm ?? 0) ? "pass" : "fail",
    detail: `${gpu?.dimensionsMm?.length ?? "unknown"}mm GPU against ${clearances?.gpuLengthMm ?? "unknown"}mm case clearance.`,
    sourcePartIds: ["lian-li-o11d-mini-v2-flow-white", "asus-rog-astral-rtx5080-o16g-white"]
  });
  checks.push({
    id: "gpu-slot-fit",
    label: "GPU slot thickness",
    severity: (gpu?.gpuSlots ?? Infinity) <= (clearances?.expansionSlots ?? 0) ? "pass" : "fail",
    detail: `${gpu?.gpuSlots ?? "unknown"}-slot GPU against ${clearances?.expansionSlots ?? "unknown"} expansion slots.`,
    sourcePartIds: ["lian-li-o11d-mini-v2-flow-white", "asus-rog-astral-rtx5080-o16g-white"]
  });
  checks.push({
    id: "psu-length-fit",
    label: "PSU bay",
    severity: (psu?.dimensionsMm?.length ?? Infinity) <= (clearances?.psuLengthMm ?? 0) ? "pass" : "fail",
    detail: `${psu?.dimensionsMm?.length ?? "unknown"}mm PSU against ${clearances?.psuLengthMm ?? "unknown"}mm bay budget.`,
    sourcePartIds: ["lian-li-o11d-mini-v2-flow-white", "lian-li-edge-gold-1000-white"]
  });
  checks.push({
    id: "radiator-fit",
    label: "Radiator mount",
    severity: cooler?.radiatorSizeMm && clearances?.topRadiatorMm?.includes(cooler.radiatorSizeMm) ? "pass" : "fail",
    detail: `${cooler?.radiatorSizeMm ?? "unknown"}mm radiator against top radiator mounts ${clearances?.topRadiatorMm?.join("/") ?? "unknown"}.`,
    sourcePartIds: ["lian-li-o11d-mini-v2-flow-white", "lian-li-hydroshift-ii-lcd-c-360tl-white"]
  });
  checks.push({
    id: "case-fan-fit",
    label: "Case fan mount",
    severity: caseFan?.fanSizeMm === 120 && (clearances?.fanMounts120Mm ?? 0) >= 1 ? "pass" : "fail",
    detail: `${caseFan?.fanSizeMm ?? "unknown"}mm fan against ${clearances?.fanMounts120Mm ?? 0} available 120mm mount budget.`,
    sourcePartIds: ["lian-li-o11d-mini-v2-flow-white", "lian-li-uni-fan-tl-wireless-120-white"]
  });

  return summarize(checks);
}

export function mergeBuildEvaluations(...evaluations: BuildEvaluation[]): BuildEvaluation {
  return summarize(evaluations.flatMap((evaluation) => evaluation.checks));
}
