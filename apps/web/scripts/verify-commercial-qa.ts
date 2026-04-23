import { loadCommercialQaSnapshot } from "../src/lib/qa/commercial-qa";
import { inspectSceneDocumentIntegrity } from "../src/lib/domain/scene-integrity";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function main() {
  const snapshot = loadCommercialQaSnapshot();

  assert(snapshot.releaseGates.length >= 5, "expected at least 5 commercial QA release gates");
  assert(snapshot.assetStatus.totalAssets > 0, "expected published runtime assets");
  assert(snapshot.performanceBaseline.scenarios.length >= 4, "expected benchmark baseline scenarios");
  assert(snapshot.placementRegression.suites.length >= 3, "expected placement regression suites");
  assert(
    snapshot.placementRegression.suites.every((suite) => suite.status === "pass"),
    "expected all placement regression suites to be registered"
  );
  assert(
    snapshot.compatibilitySummary.requiredProfiles >= 3,
    "expected required compatibility profiles"
  );
  assert(
    snapshot.compatibilitySummary.pendingProfiles === 0,
    "expected all required compatibility profiles to be verified"
  );
  assert(snapshot.compatibilityMatrix.length >= 4, "expected browser/device compatibility matrix coverage");
  assert(
    snapshot.compatibilityMatrix.some((row) => row.requiredForRelease && row.verificationStatus === "verified"),
    "expected release-required compatibility records with verification evidence"
  );
  assert(snapshot.assetStatus.releaseReadyAssets >= 1, "expected at least one release-ready asset");
  assert(snapshot.assetStatus.qaCoveragePercent > 0, "expected QA coverage percent to be populated");
  assert(
    snapshot.sceneIntegrity.sampleStatus === "corrupt",
    `expected corrupt integrity sample, received ${snapshot.sceneIntegrity.sampleStatus}`
  );
  assert(
    snapshot.sceneIntegrity.sampleIssueCodes.includes("MISSING_SUPPORT_ASSET"),
    "expected integrity sample to report missing support asset"
  );
  assert(
    snapshot.sceneIntegrity.sampleIssueCodes.includes("INVALID_NODE_SCALE"),
    "expected integrity sample to report invalid node scale"
  );
  assert(
    snapshot.sceneIntegrity.sampleIssueCodes.includes("SUPPORT_REFERENCE_MISMATCH"),
    "expected integrity sample to report support reference mismatch"
  );
  assert(
    snapshot.sceneIntegrity.sampleRecoverySnapshot.invalidSurfacePlacementCount > 0,
    "expected integrity sample to include invalid surface placement count"
  );
  assert(
    snapshot.sceneIntegrity.sampleRecoverySnapshot.invalidScaleCount > 0,
    "expected integrity sample to include invalid scale count"
  );
  assert(
    snapshot.sceneIntegrity.sampleRecoverySnapshot.mismatchedSupportReferenceCount > 0,
    "expected integrity sample to include support mismatch count"
  );
  assert(snapshot.sceneIntegrity.severitySummary.error > 0, "expected integrity error summary");
  assert(snapshot.sceneIntegrity.prioritizedActions.length > 0, "expected prioritized integrity actions");
  assert(
    snapshot.sceneIntegrity.sampleSuggestedActions.includes("rebuild_support_relations"),
    "expected integrity sample suggested actions to include support relation rebuild"
  );

  const directReport = inspectSceneDocumentIntegrity({
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
        id: "node-a",
        assetId: "",
        supportAssetId: "node-a",
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
  });

  assert(directReport.status === "corrupt", "expected direct integrity report to be corrupt");
  assert(
    directReport.issues.some((issue) => issue.code === "SELF_SUPPORT_REFERENCE"),
    "expected self support reference issue"
  );

  console.log(
    JSON.stringify(
      {
        releaseGates: snapshot.releaseGates.map((gate) => ({ id: gate.id, status: gate.status })),
        totalAssets: snapshot.assetStatus.totalAssets,
        releaseReadyAssets: snapshot.assetStatus.releaseReadyAssets,
        topRiskAssets: snapshot.assetStatus.topRiskRows.map((row) => ({
          key: row.key,
          severity: row.severity
        })),
        scenarios: snapshot.performanceBaseline.scenarios.map((entry) => entry.scenario),
        placementSuites: snapshot.placementRegression.suites.map((suite) => suite.script),
        compatibilityProfiles: snapshot.compatibilityMatrix.map((row) => ({
          profile: row.profile,
          browser: row.browser,
          verificationStatus: row.verificationStatus
        }))
      },
      null,
      2
    )
  );
}

try {
  main();
} catch (error) {
  console.error("[verify-commercial-qa] failed");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
