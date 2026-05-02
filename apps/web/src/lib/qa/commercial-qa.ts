import fs from "node:fs";
import path from "node:path";
import type { SceneDocument } from "../domain/scene-document";
import { inspectSceneDocumentIntegrity } from "../domain/scene-integrity";
import { summarizeRoomShellTextureQuality } from "../textures/room-shell-textures";
import {
  compatibilityVerificationLedger,
  placementRegressionEvidenceLedger,
  viewerParityEvidenceLedger,
  type QaVerificationStatus
} from "./verification-ledger";

type RuntimePackageIndexEntry = {
  key: string;
  label: string;
  packagePath: string;
  qaStatus: "passed" | "failed" | "warning";
  warningCount: number;
  surfaceCount: number;
  attachmentPointCount: number;
  materialVariantCount: number;
  commercialTier?: "hero_sku" | "generic_catalog" | "draft";
  sku?: string;
  manufacturer?: string;
  releaseEligible?: boolean;
};

type RuntimePackageIndex = {
  schemaVersion: string;
  generatedAt: string;
  assets: RuntimePackageIndexEntry[];
};

type RuntimePackageDescriptor = {
  key: string;
  label: string;
  dimensionsMm: {
    width: number;
    depth: number;
    height: number;
  };
  scaleLocked: boolean;
  files: Record<string, { path: string; required: boolean; exists: boolean }>;
  runtimeAsset: {
    units: "mm";
    dimensionsMm: {
      width: number;
      depth: number;
      height: number;
    };
    scaleLocked: boolean;
    productId?: string;
    sourceProvenance?: {
      manufacturer?: string;
      license?: string;
    };
    colliders: unknown[];
    supportSurfaces: unknown[];
    attachmentPoints: unknown[];
    materialVariants?: Array<{
      slotMaterials?: Array<{
        qaStatus?: "pending" | "passed" | "failed" | "waived";
      }>;
    }>;
    commercialReadiness?: RuntimeCommercialReadiness;
    qaStatus?: {
      commercialFidelity?: RuntimeCommercialFidelity;
    };
  };
  commercialReadiness?: RuntimeCommercialReadiness;
  qa: {
    status: "passed" | "failed" | "warning";
    warnings: unknown[];
  };
};

type CommercialQaStatus = "pass" | "warning" | "fail";
type CompatibilityProfileStatus = "target" | "verify" | "fallback";

type RuntimeCommercialFidelity = {
  referencePackStatus: "candidate" | "reference_collected" | "dimension_verified" | "visual_verified" | "release_ready";
  visualFidelityScore: number;
  dimensionToleranceMm: number;
  dimensionTolerancePercent: number;
  supportSurfaceToleranceMm?: number;
  footprintToleranceMm?: number;
  materialQaStatus: "pending" | "passed" | "failed" | "waived";
  releaseEligible: boolean;
};

type RuntimeCommercialReadiness = {
  tier: "hero_sku" | "generic_catalog" | "draft";
  sku: string;
  manufacturer: string;
  referencePack: {
    status: RuntimeCommercialFidelity["referencePackStatus"];
    referenceImages: Array<{
      required: boolean;
    }>;
  };
  visualFidelityScore: number;
  dimensionToleranceMm: number;
  dimensionTolerancePercent: number;
  supportSurfaceToleranceMm?: number;
  footprintToleranceMm?: number;
  materialQaStatus: RuntimeCommercialFidelity["materialQaStatus"];
  releaseEligible: boolean;
};

type BenchmarkBaselineEntry = {
  scenario: string;
  title: string;
  objects: number;
  runtimeAssetCount: number;
  budgetHints: {
    drawCallsBudget: number;
    triangleBudget: number;
    objectCountBudget: number;
    textureBudgetMb: number;
  };
  telemetry: {
    fpsAvg: number | null;
    frameTimeP95Ms: number | null;
    heapGrowthPercentPoints: number | null;
    reactRenderCount: number | null;
    raycastLatencyP95Ms: number | null;
    assetLoadMs: number | null;
    firstUsableMs: number | null;
    drawCalls: number | null;
    triangles: number | null;
    gpuMemoryEstimateMb: number | null;
    inputLatencyP95Ms: number | null;
  };
};

type BenchmarkBaseline = {
  generatedAt: string;
  entries: BenchmarkBaselineEntry[];
};

export type CommercialReleaseGate = {
  id: string;
  label: string;
  status: CommercialQaStatus;
  detail: string;
};

export type CommercialQaSnapshot = {
  generatedAt: string;
  readinessScore: {
    score: number;
    status: CommercialQaStatus;
    passedGates: number;
    warningGates: number;
    failedGates: number;
    blockers: string[];
    warnings: string[];
    summary: string;
  };
  releaseGates: CommercialReleaseGate[];
  assetStatus: {
    totalAssets: number;
    passedAssets: number;
    warningAssets: number;
    failedAssets: number;
    missingRequiredFiles: number;
    assetsWithSupportSurfaces: number;
    assetsWithAttachmentPoints: number;
    metadataGatePassedAssets: number;
    metadataGateFailedAssets: number;
    releaseReadyAssets: number;
    heroSkuAssets: number;
    releaseEligibleHeroAssets: number;
    referenceReadyAssets: number;
    materialQaPassedAssets: number;
    visualFidelityAverage: number;
    atRiskAssets: number;
    qaCoveragePercent: number;
    supportCoveragePercent: number;
    attachmentCoveragePercent: number;
    topRiskRows: Array<{
      key: string;
      label: string;
      severity: CommercialQaStatus;
      reasons: string[];
    }>;
    rows: Array<{
      key: string;
      label: string;
      scaleLocked: boolean;
      qaStatus: RuntimePackageIndexEntry["qaStatus"];
      warningCount: number;
      commercialTier: RuntimeCommercialReadiness["tier"] | "unclassified";
      sku: string | null;
      manufacturer: string | null;
      releaseEligible: boolean;
      visualFidelityScore: number | null;
      referencePackStatus: RuntimeCommercialFidelity["referencePackStatus"] | "missing";
      materialQaStatus: RuntimeCommercialFidelity["materialQaStatus"] | "missing";
      supportSurfaceCount: number;
      attachmentPointCount: number;
      materialVariantCount: number;
      missingRequiredFiles: number;
      missingRequiredFileNames: string[];
      metadataGatePassed: boolean;
      metadataGateFailureReasons: string[];
    }>;
  };
  performanceBaseline: {
    generatedAt: string;
    scenarios: BenchmarkBaselineEntry[];
  };
  textureQuality: ReturnType<typeof summarizeRoomShellTextureQuality>;
  focusPlacementTasks: Array<{
    task: string;
    metric: string;
    target: string;
  }>;
  placementRegression: {
    registeredScripts: string[];
    verifiedSuites: number;
    requiredSuites: number;
    suites: Array<{
      id: string;
      label: string;
      script: string;
      status: CommercialQaStatus;
      target: string;
      coverage: string[];
      detail: string;
      lastVerifiedAt: string | null;
      verificationMethod: string;
      evidence: string[];
    }>;
  };
  viewerParity: {
    registeredScripts: string[];
    verifiedSuites: number;
    requiredSuites: number;
    suites: Array<{
      id: string;
      label: string;
      script: string;
      status: CommercialQaStatus;
      target: string;
      coverage: string[];
      detail: string;
      lastVerifiedAt: string | null;
      verificationMethod: string;
      evidence: string[];
    }>;
  };
  compatibilitySummary: {
    requiredProfiles: number;
    verifiedProfiles: number;
    pendingProfiles: number;
    fallbackProfiles: number;
  };
  compatibilityMatrix: Array<{
    profile: string;
    browser: string;
    deviceClass: string;
    status: CompatibilityProfileStatus;
    verificationStatus: QaVerificationStatus;
    requiredForRelease: boolean;
    lastVerifiedAt: string | null;
    verificationMethod: string;
    evidence: string[];
    notes: string;
  }>;
  sceneIntegrity: {
    sampleStatus: ReturnType<typeof inspectSceneDocumentIntegrity>["status"];
    sampleIssueCodes: string[];
    severitySummary: {
      info: number;
      warning: number;
      error: number;
    };
    sampleIssues: Array<{
      code: string;
      severity: string;
      message: string;
    }>;
    sampleSuggestedActions: string[];
    sampleRecoverySnapshot: ReturnType<typeof inspectSceneDocumentIntegrity>["recoverySnapshot"];
    prioritizedActions: Array<{
      action: string;
      reason: string;
    }>;
    ruleSummary: string[];
  };
};

function resolveWorkspaceRoot() {
  const candidates = [
    process.cwd(),
    path.resolve(process.cwd(), ".."),
    path.resolve(process.cwd(), "..", "..")
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, "benchmark-scenes"))) {
      return candidate;
    }
  }

  throw new Error("unable to resolve workspace root for commercial QA snapshot");
}

function readJsonFile<T>(filePath: string) {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function isPositiveFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function dimensionsArePositive(dimensions: RuntimePackageDescriptor["dimensionsMm"]) {
  return (
    isPositiveFiniteNumber(dimensions.width) &&
    isPositiveFiniteNumber(dimensions.depth) &&
    isPositiveFiniteNumber(dimensions.height)
  );
}

function dimensionsEqual(left: RuntimePackageDescriptor["dimensionsMm"], right: RuntimePackageDescriptor["dimensionsMm"]) {
  return left.width === right.width && left.depth === right.depth && left.height === right.height;
}

function buildReadinessScore(releaseGates: CommercialReleaseGate[]): CommercialQaSnapshot["readinessScore"] {
  const passedGates = releaseGates.filter((gate) => gate.status === "pass");
  const warningGates = releaseGates.filter((gate) => gate.status === "warning");
  const failedGates = releaseGates.filter((gate) => gate.status === "fail");
  const rawScore =
    releaseGates.length > 0
      ? ((passedGates.length + warningGates.length * 0.5) / releaseGates.length) * 100
      : 0;
  const score = Math.round(rawScore);
  const status: CommercialQaStatus =
    failedGates.length > 0 ? "fail" : warningGates.length > 0 || score < 90 ? "warning" : "pass";

  return {
    score,
    status,
    passedGates: passedGates.length,
    warningGates: warningGates.length,
    failedGates: failedGates.length,
    blockers: failedGates.map((gate) => gate.label),
    warnings: warningGates.map((gate) => gate.label),
    summary:
      status === "pass"
        ? "All commercial release gates are green."
        : failedGates.length > 0
          ? `${failedGates.length} release blockers must be resolved before commercial demo.`
          : `${warningGates.length} warning gates remain before paid-beta readiness.`
  };
}

function loadVerifyScripts(workspaceRoot: string) {
  const packageJsonPath = path.join(workspaceRoot, "apps/web/package.json");
  const packageJson = readJsonFile<{ scripts?: Record<string, string> }>(packageJsonPath);
  return Object.keys(packageJson.scripts ?? {})
    .filter((key) => key.startsWith("verify:"))
    .sort();
}

function buildSampleCorruptScene(): SceneDocument {
  return {
    schemaVersion: 2,
    roomShell: {
      scale: 1,
      scaleInfo: {
        value: 1,
        source: "unknown",
        confidence: 0
      },
      walls: [],
      openings: [],
      floors: [],
      ceilings: [],
      rooms: [],
      cameraAnchors: [],
      navGraph: {
        nodes: [],
        edges: []
      }
    },
    nodes: [
      {
        id: "desk-1",
        assetId: "p2s_desk_oak",
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        materialId: null
      },
      {
        id: "monitor-1",
        assetId: "",
        supportAssetId: "missing-desk",
        placement: {
          mode: "surface_local",
          attachmentType: "place_on_surface",
          supportObjectId: "missing-desk",
          surfaceId: "",
          localPose: {
            uMm: 0,
            vMm: 0,
            normalOffsetMm: 0,
            rotationMilliDeg: 0
          },
          scalePermille: [1000, 1000, 1000]
        },
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [0, 1, 1],
        materialId: null
      },
      {
        id: "tray-1",
        assetId: "p2s_underdesk_tray",
        supportAssetId: "desk-1",
        placement: {
          mode: "surface_local",
          attachmentType: "underside_screw",
          supportObjectId: "desk-2",
          surfaceId: "desk_underside",
          localPose: {
            uMm: 120,
            vMm: 80,
            normalOffsetMm: 0,
            rotationMilliDeg: 0
          },
          scalePermille: [1000, 1000, 1000]
        },
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        materialId: null
      }
    ],
    materialOverride: {
      wallMaterialIndex: 0,
      floorMaterialIndex: 0
    },
    lighting: {
      mode: "direct",
      ambientIntensity: 0.44,
      hemisphereIntensity: 0.54,
      directionalIntensity: 1.24,
      environmentBlur: 0.14,
      accentIntensity: 0.82,
      beamOpacity: 0.18
    }
  };
}

export function loadCommercialQaSnapshot(): CommercialQaSnapshot {
  const workspaceRoot = resolveWorkspaceRoot();
  const packageIndexPath = path.join(
    workspaceRoot,
    "apps/web/public/assets/catalog/runtime-packages.json"
  );
  const baselinePath = path.join(workspaceRoot, "benchmark-scenes/baseline.template.json");

  const packageIndex = readJsonFile<RuntimePackageIndex>(packageIndexPath);
  const baseline = readJsonFile<BenchmarkBaseline>(baselinePath);
  const verifyScripts = loadVerifyScripts(workspaceRoot);
  const textureQuality = summarizeRoomShellTextureQuality();

  const packageRows = packageIndex.assets.map((asset) => {
    const descriptorPath = path.join(workspaceRoot, "apps/web/public", asset.packagePath.replace(/^\//, ""));
    const descriptor = readJsonFile<RuntimePackageDescriptor>(descriptorPath);
    const missingRequiredFileEntries = Object.entries(descriptor.files).filter(
      ([, file]) => file.required && !file.exists
    );
    const commercial = descriptor.runtimeAsset.commercialReadiness ?? descriptor.commercialReadiness ?? null;
    const commercialFidelity = descriptor.runtimeAsset.qaStatus?.commercialFidelity ?? null;
    const slotMaterialQaStatuses = descriptor.runtimeAsset.materialVariants
      ?.flatMap((variant) => variant.slotMaterials ?? [])
      .map((slot) => slot.qaStatus ?? "pending") ?? [];
    const materialQaStatus: RuntimeCommercialFidelity["materialQaStatus"] | "missing" =
      commercialFidelity?.materialQaStatus ??
      commercial?.materialQaStatus ??
      (slotMaterialQaStatuses.length > 0 && slotMaterialQaStatuses.every((status) => status === "passed")
        ? "passed"
        : slotMaterialQaStatuses.length > 0
          ? "pending"
          : "missing");
    const referencePackStatus: RuntimeCommercialFidelity["referencePackStatus"] | "missing" =
      commercialFidelity?.referencePackStatus ?? commercial?.referencePack.status ?? "missing";
    const commercialTier: RuntimeCommercialReadiness["tier"] | "unclassified" =
      commercial?.tier ?? asset.commercialTier ?? "unclassified";
    const metadataGateFailureReasons: string[] = [];

    if (!descriptor.scaleLocked || !descriptor.runtimeAsset.scaleLocked) {
      metadataGateFailureReasons.push("scale lock missing");
    }
    if (descriptor.runtimeAsset.units !== "mm") {
      metadataGateFailureReasons.push("runtime units are not mm");
    }
    if (!dimensionsArePositive(descriptor.dimensionsMm) || !dimensionsArePositive(descriptor.runtimeAsset.dimensionsMm)) {
      metadataGateFailureReasons.push("dimensionsMm is not positive finite");
    } else if (!dimensionsEqual(descriptor.dimensionsMm, descriptor.runtimeAsset.dimensionsMm)) {
      metadataGateFailureReasons.push("descriptor/runtime dimensions drift");
    }
    if (descriptor.runtimeAsset.colliders.length === 0) {
      metadataGateFailureReasons.push("collider sidecar is empty");
    }
    if (!descriptor.runtimeAsset.productId) {
      metadataGateFailureReasons.push("productId missing");
    }
    if (!descriptor.runtimeAsset.sourceProvenance?.manufacturer || !descriptor.runtimeAsset.sourceProvenance.license) {
      metadataGateFailureReasons.push("source provenance incomplete");
    }
    if (!commercial?.sku || !commercial.manufacturer) {
      metadataGateFailureReasons.push("sku/manufacturer missing");
    }
    if (missingRequiredFileEntries.length > 0) {
      metadataGateFailureReasons.push("required runtime sidecar missing");
    }

    return {
      key: asset.key,
      label: asset.label,
      scaleLocked: descriptor.scaleLocked,
      qaStatus: descriptor.qa.status,
      warningCount: asset.warningCount,
      commercialTier,
      sku: commercial?.sku ?? asset.sku ?? null,
      manufacturer: commercial?.manufacturer ?? asset.manufacturer ?? null,
      releaseEligible: commercial?.releaseEligible ?? asset.releaseEligible ?? false,
      visualFidelityScore: commercialFidelity?.visualFidelityScore ?? commercial?.visualFidelityScore ?? null,
      referencePackStatus,
      materialQaStatus,
      supportSurfaceCount: descriptor.runtimeAsset.supportSurfaces.length,
      attachmentPointCount: descriptor.runtimeAsset.attachmentPoints.length,
      materialVariantCount: asset.materialVariantCount,
      missingRequiredFiles: missingRequiredFileEntries.length,
      missingRequiredFileNames: missingRequiredFileEntries.map(([key]) => key),
      metadataGatePassed: metadataGateFailureReasons.length === 0,
      metadataGateFailureReasons
    };
  });
  const packageRiskRows = packageRows
    .map((row) => {
      const reasons: string[] = [];
      let severity: CommercialQaStatus = "pass";

      if (row.qaStatus === "failed") {
        severity = "fail";
        reasons.push("asset QA failed");
      } else if (row.qaStatus === "warning") {
        severity = "warning";
        reasons.push("asset QA warnings remain");
      }

      if (row.missingRequiredFiles > 0) {
        severity = "fail";
        reasons.push(`missing files: ${row.missingRequiredFileNames.join(", ")}`);
      }

      if (!row.metadataGatePassed) {
        severity = "fail";
        reasons.push(`metadata gate failed: ${row.metadataGateFailureReasons.join(", ")}`);
      }

      if (row.warningCount > 0 && !reasons.includes("asset QA warnings remain")) {
        if (severity !== "fail") {
          severity = "warning";
        }
        reasons.push(`${row.warningCount} package warnings`);
      }

      if (row.commercialTier === "hero_sku" && !row.releaseEligible) {
        severity = "fail";
        reasons.push("hero SKU is not release eligible");
      } else if (row.referencePackStatus === "candidate" || row.referencePackStatus === "missing") {
        if (severity !== "fail") {
          severity = "warning";
        }
        reasons.push("reference pack not ready");
      }

      if (row.materialQaStatus !== "passed" && row.materialQaStatus !== "waived") {
        if (severity !== "fail") {
          severity = "warning";
        }
        reasons.push("slot material QA pending");
      }

      return {
        key: row.key,
        label: row.label,
        severity,
        reasons
      };
    })
    .filter((row) => row.reasons.length > 0)
    .sort((left, right) => {
      const severityScore = { fail: 0, warning: 1, pass: 2 };
      return severityScore[left.severity] - severityScore[right.severity];
    });

  const corruptSceneReport = inspectSceneDocumentIntegrity(buildSampleCorruptScene());
  const expectedBenchmarkScenarios = ["empty-room", "standard-room", "dense-desk", "heavy-assets"];
  const availableScenarios = new Set(baseline.entries.map((entry) => entry.scenario));
  const placementRegressionSuites = [
    {
      id: "placement-kernel",
      label: "Placement Kernel Surface Rules",
      script: "verify:placement-kernel",
      target: "surface-local placement / no-place-zone / mounted compatibility",
      coverage: ["desktop_top", "desk_edge", "underside", "wall", "collision guard"]
    },
    {
      id: "focus-placement",
      label: "Walkthrough Focus Placement",
      script: "verify:focus-placement",
      target: "walkthrough session / candidate cycle / snapped HUD",
      coverage: ["desktop_top", "desk_edge", "desk_underside", "wall", "candidate cycle"]
    },
    {
      id: "advanced-attachments",
      label: "Advanced Attachment Flow",
      script: "verify:advanced-attachments",
      target: "VESA / monitor-arm / wall screw / grommet / articulation reachability",
      coverage: ["edge_clamp", "vesa_mount", "monitor_arm", "wall_screw", "grommet_hole", "same-surface overlap", "wizard target pose"]
    }
  ].map((suite) => {
    const isRegistered = verifyScripts.includes(suite.script);
    const evidenceRecord =
      placementRegressionEvidenceLedger.find((record) => record.id === suite.id || record.script === suite.script) ?? null;
    const isVerified = Boolean(isRegistered && evidenceRecord && evidenceRecord.status === "verified");
    return {
      ...suite,
      status: (isVerified ? "pass" : isRegistered ? "warning" : "fail") as CommercialQaStatus,
      detail: !isRegistered
        ? `${suite.script} is missing from apps/web/package.json.`
        : evidenceRecord
          ? `${suite.script} is registered and has a verification ledger entry.`
          : `${suite.script} is registered but missing verification evidence.`,
      lastVerifiedAt: evidenceRecord?.lastVerifiedAt ?? null,
      verificationMethod: evidenceRecord?.verificationMethod ?? "untracked",
      evidence: evidenceRecord?.evidence ?? []
    };
  });
  const viewerParitySuites = [
    {
      id: "viewer-parity",
      label: "Consolidated Viewer Parity Gate",
      script: "verify:viewer-parity",
      target: "shared payload / showcase card / community thumbnail parity",
      coverage: ["public scene payload", "showcase scene consistency", "community thumbnail parity"]
    },
    {
      id: "public-scene-payload",
      label: "Public Scene Payload Parity",
      script: "verify:public-scene",
      target: "pinned project version / scene document hash / runtime asset refs",
      coverage: ["scene document snapshot", "project version pin", "runtime asset refs", "product metadata snapshots"]
    },
    {
      id: "showcase-scene-consistency",
      label: "Shared / Showcase / Community Parity",
      script: "verify:showcase-scene",
      target: "shared payload / showcase card / community thumbnail source",
      coverage: ["shared token", "version badge", "thumbnail source", "scene snapshot refs"]
    }
  ].map((suite) => {
    const isRegistered = verifyScripts.includes(suite.script);
    const evidenceRecord =
      viewerParityEvidenceLedger.find((record) => record.id === suite.id || record.script === suite.script) ?? null;
    const isVerified = Boolean(isRegistered && evidenceRecord && evidenceRecord.status === "verified");
    return {
      ...suite,
      status: (isVerified ? "pass" : isRegistered ? "warning" : "fail") as CommercialQaStatus,
      detail: !isRegistered
        ? `${suite.script} is missing from apps/web/package.json.`
        : evidenceRecord
          ? `${suite.script} is registered and has a verification ledger entry.`
          : `${suite.script} is registered but missing verification evidence.`,
      lastVerifiedAt: evidenceRecord?.lastVerifiedAt ?? null,
      verificationMethod: evidenceRecord?.verificationMethod ?? "untracked",
      evidence: evidenceRecord?.evidence ?? []
    };
  });
  const requiredCompatibilityProfiles = compatibilityVerificationLedger.filter((entry) => entry.requiredForRelease);
  const verifiedCompatibilityProfiles = requiredCompatibilityProfiles.filter((entry) => entry.status === "verified");
  const pendingCompatibilityProfiles = requiredCompatibilityProfiles.filter((entry) => entry.status !== "verified");
  const heroSkuAssets = packageRows.filter((row) => row.commercialTier === "hero_sku");
  const releaseEligibleHeroAssets = heroSkuAssets.filter((row) => row.releaseEligible);
  const referenceReadyAssets = packageRows.filter((row) =>
    row.referencePackStatus === "dimension_verified" ||
    row.referencePackStatus === "visual_verified" ||
    row.referencePackStatus === "release_ready"
  );
  const materialQaPassedAssets = packageRows.filter((row) => row.materialQaStatus === "passed");
  const visualScores = packageRows
    .map((row) => row.visualFidelityScore)
    .filter((score): score is number => typeof score === "number" && Number.isFinite(score));
  const visualFidelityAverage =
    visualScores.length > 0
      ? Math.round((visualScores.reduce((sum, score) => sum + score, 0) / visualScores.length) * 100) / 100
      : 0;

  const releaseGates: CommercialReleaseGate[] = [
    {
      id: "runtime-packages",
      label: "Runtime asset packages published",
      status: packageRows.every((row) => row.missingRequiredFiles === 0) ? "pass" : "fail",
      detail: `${packageRows.length} assets indexed, ${packageRows.reduce((sum, row) => sum + row.missingRequiredFiles, 0)} missing required files.`
    },
    {
      id: "asset-qa",
      label: "Asset QA gate",
      status: packageRows.every((row) => row.qaStatus === "passed")
        ? "pass"
        : packageRows.some((row) => row.qaStatus === "failed")
          ? "fail"
          : "warning",
      detail: `${packageRows.filter((row) => row.qaStatus === "passed").length}/${packageRows.length} assets passed QA.`
    },
    {
      id: "asset-metadata-gate",
      label: "Runtime asset metadata gate",
      status: packageRows.every((row) => row.metadataGatePassed) ? "pass" : "fail",
      detail: `${packageRows.filter((row) => row.metadataGatePassed).length}/${packageRows.length} assets include dimensions, scale lock, colliders, provenance, and SKU metadata.`
    },
    {
      id: "actual-sku-hero-catalog",
      label: "Actual SKU hero catalog",
      status: releaseEligibleHeroAssets.length >= 20 ? "pass" : "warning",
      detail: `${releaseEligibleHeroAssets.length}/20 paid-beta hero SKUs are release eligible; ${heroSkuAssets.length} hero SKU packages are registered.`
    },
    {
      id: "texture-material-library",
      label: "Wall/floor PBR texture library",
      status:
        textureQuality.commercialReady && textureQuality.candidateAiTextureCount === 0
          ? "pass"
          : textureQuality.commercialReady
            ? "warning"
            : "fail",
      detail: `${textureQuality.wallPresetCount}/${textureQuality.wallPresetLimit} wall presets, ${textureQuality.floorPresetCount}/${textureQuality.floorPresetLimit} floor presets, ${textureQuality.candidateAiTextureCount} AI candidate textures.`
    },
    {
      id: "benchmark-baseline",
      label: "Benchmark baseline template",
      status: expectedBenchmarkScenarios.every((scenario) => availableScenarios.has(scenario)) ? "pass" : "fail",
      detail: `${baseline.entries.length} benchmark scenarios registered in baseline template.`
    },
    {
      id: "compatibility-matrix",
      label: "Browser/device compatibility matrix",
      status: pendingCompatibilityProfiles.length === 0 ? "pass" : "warning",
      detail: `${verifiedCompatibilityProfiles.length}/${requiredCompatibilityProfiles.length} required browser/device profiles have verification records.`
    },
    {
      id: "placement-regression",
      label: "Placement regression suite",
      status: placementRegressionSuites.every((suite) => suite.status === "pass") ? "pass" : "fail",
      detail: `${placementRegressionSuites.filter((suite) => suite.status === "pass").length}/${placementRegressionSuites.length} placement regression scripts are registered.`
    },
    {
      id: "scene-integrity",
      label: "Scene corruption detector",
      status: corruptSceneReport.status === "corrupt" ? "pass" : "fail",
      detail: `Sample corrupt scene resolves to ${corruptSceneReport.status} with ${corruptSceneReport.issues.length} detected issues and ${corruptSceneReport.recoverySnapshot.mismatchedSupportReferenceCount} support mismatches.`
    },
    {
      id: "viewer-parity",
      label: "Shared viewer parity",
      status: viewerParitySuites.every((suite) => suite.status === "pass") ? "pass" : "fail",
      detail: `${viewerParitySuites.filter((suite) => suite.status === "pass").length}/${viewerParitySuites.length} viewer parity scripts are registered with evidence.`
    }
  ];
  const integritySeveritySummary = corruptSceneReport.issues.reduce(
    (summary, issue) => {
      summary[issue.severity] += 1;
      return summary;
    },
    { info: 0, warning: 0, error: 0 } as Record<"info" | "warning" | "error", number>
  );
  const prioritizedIntegrityActions = corruptSceneReport.suggestedActions.map((action) => {
    switch (action) {
      case "repair_scene_nodes":
        return {
          action,
          reason: "duplicate ids or invalid scale vectors must be repaired before reliable runtime restore."
        };
      case "rebuild_support_relations":
        return {
          action,
          reason: "support references or surface-local attachments are inconsistent and can break mounted placement."
        };
      case "restore_asset_links":
        return {
          action,
          reason: "missing asset ids prevent runtime package resolution and block editor launch fidelity."
        };
      default:
        return {
          action,
          reason: "room shell fallback should be reviewed before release."
        };
    }
  });

  return {
    generatedAt: new Date().toISOString(),
    readinessScore: buildReadinessScore(releaseGates),
    releaseGates,
    assetStatus: {
      totalAssets: packageRows.length,
      passedAssets: packageRows.filter((row) => row.qaStatus === "passed").length,
      warningAssets: packageRows.filter((row) => row.qaStatus === "warning").length,
      failedAssets: packageRows.filter((row) => row.qaStatus === "failed").length,
      missingRequiredFiles: packageRows.reduce((sum, row) => sum + row.missingRequiredFiles, 0),
      assetsWithSupportSurfaces: packageRows.filter((row) => row.supportSurfaceCount > 0).length,
      assetsWithAttachmentPoints: packageRows.filter((row) => row.attachmentPointCount > 0).length,
      metadataGatePassedAssets: packageRows.filter((row) => row.metadataGatePassed).length,
      metadataGateFailedAssets: packageRows.filter((row) => !row.metadataGatePassed).length,
      releaseReadyAssets: packageRows.filter(
        (row) => row.qaStatus === "passed" && row.missingRequiredFiles === 0 && row.metadataGatePassed
      ).length,
      heroSkuAssets: heroSkuAssets.length,
      releaseEligibleHeroAssets: releaseEligibleHeroAssets.length,
      referenceReadyAssets: referenceReadyAssets.length,
      materialQaPassedAssets: materialQaPassedAssets.length,
      visualFidelityAverage,
      atRiskAssets: packageRiskRows.length,
      qaCoveragePercent: packageRows.length > 0 ? Math.round((packageRows.filter((row) => row.qaStatus === "passed").length / packageRows.length) * 100) : 0,
      supportCoveragePercent: packageRows.length > 0 ? Math.round((packageRows.filter((row) => row.supportSurfaceCount > 0).length / packageRows.length) * 100) : 0,
      attachmentCoveragePercent: packageRows.length > 0 ? Math.round((packageRows.filter((row) => row.attachmentPointCount > 0).length / packageRows.length) * 100) : 0,
      topRiskRows: packageRiskRows.slice(0, 5),
      rows: packageRows
    },
    performanceBaseline: {
      generatedAt: baseline.generatedAt,
      scenarios: baseline.entries
    },
    textureQuality,
    focusPlacementTasks: [
      {
        task: "desk top keyboard / mouse / speaker placement",
        metric: "completion time / adjustment count",
        target: "5mm / 1deg default, 1mm / 0.1deg fine-mode walkthrough placement"
      },
      {
        task: "monitor arm edge clamp install",
        metric: "failure rate / warning quality",
        target: "deterministic mounted validation"
      },
      {
        task: "under-desk tray install",
        metric: "clearance error rate",
        target: "knee-clearance warnings visible before commit"
      },
      {
        task: "desk move with attached dependents",
        metric: "relation preservation",
        target: "support-linked objects remain attached"
      }
    ],
    placementRegression: {
      registeredScripts: verifyScripts,
      verifiedSuites: placementRegressionSuites.filter((suite) => suite.status === "pass").length,
      requiredSuites: placementRegressionSuites.length,
      suites: placementRegressionSuites
    },
    viewerParity: {
      registeredScripts: verifyScripts,
      verifiedSuites: viewerParitySuites.filter((suite) => suite.status === "pass").length,
      requiredSuites: viewerParitySuites.length,
      suites: viewerParitySuites
    },
    compatibilitySummary: {
      requiredProfiles: requiredCompatibilityProfiles.length,
      verifiedProfiles: verifiedCompatibilityProfiles.length,
      pendingProfiles: pendingCompatibilityProfiles.length,
      fallbackProfiles: compatibilityVerificationLedger.filter((entry) => entry.status === "fallback").length
    },
    compatibilityMatrix: [
      ...compatibilityVerificationLedger.map((entry) => ({
        profile: entry.profile,
        browser: entry.browser,
        deviceClass: entry.deviceClass,
        status: (
          entry.status === "fallback" ? "fallback" : entry.requiredForRelease ? "target" : "verify"
        ) as CompatibilityProfileStatus,
        verificationStatus: entry.status,
        requiredForRelease: entry.requiredForRelease,
        lastVerifiedAt: entry.lastVerifiedAt,
        verificationMethod: entry.verificationMethod,
        evidence: entry.evidence,
        notes: entry.notes
      }))
    ],
    sceneIntegrity: {
      sampleStatus: corruptSceneReport.status,
      sampleIssueCodes: corruptSceneReport.issues.map((issue) => issue.code),
      severitySummary: {
        info: integritySeveritySummary.info,
        warning: integritySeveritySummary.warning,
        error: integritySeveritySummary.error
      },
      sampleIssues: corruptSceneReport.issues.map((issue) => ({
        code: issue.code,
        severity: issue.severity,
        message: issue.message
      })),
      sampleSuggestedActions: corruptSceneReport.suggestedActions,
      sampleRecoverySnapshot: corruptSceneReport.recoverySnapshot,
      prioritizedActions: prioritizedIntegrityActions,
      ruleSummary: [
        "scene node ids must be present and unique",
        "assetId must exist for every persisted node",
        "scene node scale vectors must stay finite and positive",
        "surface-local placements require supportObjectId + surfaceId",
      "support asset references must resolve to an existing scene node",
        "supportAssetId and placement.supportObjectId must not drift apart",
        "runtime assets require mm dimensions, scale lock, colliders, provenance, and SKU/manufacturer metadata",
        "commercial hero SKU assets require referencePack, material QA, and releaseEligible=true before paid beta"
      ]
    }
  };
}
