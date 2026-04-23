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
  assert(snapshot.compatibilityMatrix.length >= 4, "expected browser/device compatibility matrix coverage");
  assert(
    snapshot.sceneIntegrity.sampleStatus === "corrupt",
    `expected corrupt integrity sample, received ${snapshot.sceneIntegrity.sampleStatus}`
  );
  assert(
    snapshot.sceneIntegrity.sampleIssueCodes.includes("MISSING_SUPPORT_ASSET"),
    "expected integrity sample to report missing support asset"
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
        scenarios: snapshot.performanceBaseline.scenarios.map((entry) => entry.scenario)
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
