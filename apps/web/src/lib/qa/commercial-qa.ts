import fs from "node:fs";
import path from "node:path";
import type { SceneDocument } from "../domain/scene-document";
import { inspectSceneDocumentIntegrity } from "../domain/scene-integrity";
import {
  compatibilityVerificationLedger,
  placementRegressionEvidenceLedger,
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
};

type RuntimePackageIndex = {
  schemaVersion: string;
  generatedAt: string;
  assets: RuntimePackageIndexEntry[];
};

type RuntimePackageDescriptor = {
  key: string;
  label: string;
  scaleLocked: boolean;
  files: Record<string, { path: string; required: boolean; exists: boolean }>;
  runtimeAsset: {
    supportSurfaces: unknown[];
    attachmentPoints: unknown[];
  };
  qa: {
    status: "passed" | "failed" | "warning";
    warnings: unknown[];
  };
};

type CommercialQaStatus = "pass" | "warning" | "fail";
type CompatibilityProfileStatus = "target" | "verify" | "fallback";

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
  releaseGates: CommercialReleaseGate[];
  assetStatus: {
    totalAssets: number;
    passedAssets: number;
    warningAssets: number;
    failedAssets: number;
    missingRequiredFiles: number;
    assetsWithSupportSurfaces: number;
    assetsWithAttachmentPoints: number;
    rows: Array<{
      key: string;
      label: string;
      scaleLocked: boolean;
      qaStatus: RuntimePackageIndexEntry["qaStatus"];
      warningCount: number;
      supportSurfaceCount: number;
      attachmentPointCount: number;
      materialVariantCount: number;
      missingRequiredFiles: number;
      missingRequiredFileNames: string[];
    }>;
  };
  performanceBaseline: {
    generatedAt: string;
    scenarios: BenchmarkBaselineEntry[];
  };
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
    sampleIssues: Array<{
      code: string;
      severity: string;
      message: string;
    }>;
    sampleSuggestedActions: string[];
    sampleRecoverySnapshot: ReturnType<typeof inspectSceneDocumentIntegrity>["recoverySnapshot"];
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

  const packageRows = packageIndex.assets.map((asset) => {
    const descriptorPath = path.join(workspaceRoot, "apps/web/public", asset.packagePath.replace(/^\//, ""));
    const descriptor = readJsonFile<RuntimePackageDescriptor>(descriptorPath);
    const missingRequiredFileEntries = Object.entries(descriptor.files).filter(
      ([, file]) => file.required && !file.exists
    );

    return {
      key: asset.key,
      label: asset.label,
      scaleLocked: descriptor.scaleLocked,
      qaStatus: descriptor.qa.status,
      warningCount: asset.warningCount,
      supportSurfaceCount: descriptor.runtimeAsset.supportSurfaces.length,
      attachmentPointCount: descriptor.runtimeAsset.attachmentPoints.length,
      materialVariantCount: asset.materialVariantCount,
      missingRequiredFiles: missingRequiredFileEntries.length,
      missingRequiredFileNames: missingRequiredFileEntries.map(([key]) => key)
    };
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
      target: "VESA / monitor-arm / articulation reachability",
      coverage: ["edge_clamp", "vesa_mount", "monitor_arm", "wizard target pose"]
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
  const requiredCompatibilityProfiles = compatibilityVerificationLedger.filter((entry) => entry.requiredForRelease);
  const verifiedCompatibilityProfiles = requiredCompatibilityProfiles.filter((entry) => entry.status === "verified");
  const pendingCompatibilityProfiles = requiredCompatibilityProfiles.filter((entry) => entry.status !== "verified");

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
      detail: `Sample corrupt scene resolves to ${corruptSceneReport.status} with ${corruptSceneReport.issues.length} detected issues.`
    }
  ];

  return {
    generatedAt: new Date().toISOString(),
    releaseGates,
    assetStatus: {
      totalAssets: packageRows.length,
      passedAssets: packageRows.filter((row) => row.qaStatus === "passed").length,
      warningAssets: packageRows.filter((row) => row.qaStatus === "warning").length,
      failedAssets: packageRows.filter((row) => row.qaStatus === "failed").length,
      missingRequiredFiles: packageRows.reduce((sum, row) => sum + row.missingRequiredFiles, 0),
      assetsWithSupportSurfaces: packageRows.filter((row) => row.supportSurfaceCount > 0).length,
      assetsWithAttachmentPoints: packageRows.filter((row) => row.attachmentPointCount > 0).length,
      rows: packageRows
    },
    performanceBaseline: {
      generatedAt: baseline.generatedAt,
      scenarios: baseline.entries
    },
    focusPlacementTasks: [
      {
        task: "desk top keyboard / mouse / speaker placement",
        metric: "completion time / adjustment count",
        target: "stable walkthrough-only placement"
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
      sampleIssues: corruptSceneReport.issues.map((issue) => ({
        code: issue.code,
        severity: issue.severity,
        message: issue.message
      })),
      sampleSuggestedActions: corruptSceneReport.suggestedActions,
      sampleRecoverySnapshot: corruptSceneReport.recoverySnapshot,
      ruleSummary: [
        "scene node ids must be present and unique",
        "assetId must exist for every persisted node",
        "surface-local placements require supportObjectId + surfaceId",
        "support asset references must resolve to an existing scene node"
      ]
    }
  };
}
