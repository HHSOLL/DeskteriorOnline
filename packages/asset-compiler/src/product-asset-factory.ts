import { access, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { createAssetCompilerPaths } from "./paths";
import type {
  ProductAssetFactoryArtifactCheck,
  ProductAssetFactoryMaterialPlan,
  ProductAssetFactoryPlan,
  ProductAssetFactoryPrivateCatalogEntry,
  ProductAssetFactoryQaReport,
  ProductAssetFactorySummary,
  ProductUrlReferenceDraft,
  RuntimePackageCatalog,
  RuntimePackageDescriptor
} from "./types";

type ProductAssetFactoryOptions = {
  referencePackPath: string;
  assetKey?: string | null;
  outputDir?: string | null;
  json?: boolean;
  help?: boolean;
};

async function fileExists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJson<T>(filePath: string): Promise<T | null> {
  if (!(await fileExists(filePath))) {
    return null;
  }
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

function stringifyJson(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function toRepoRelative(repoRoot: string, filePath: string) {
  const relative = path.relative(repoRoot, filePath);
  return relative.startsWith("..") ? filePath : relative || ".";
}

function resolveLocalArtifactPath(paths: ReturnType<typeof createAssetCompilerPaths>, artifactPath: string) {
  if (path.isAbsolute(artifactPath) && !artifactPath.startsWith("/assets/")) {
    return artifactPath;
  }
  if (artifactPath.startsWith("/")) {
    return path.join(paths.publicRoot, artifactPath.slice(1));
  }
  return path.join(paths.repoRoot, artifactPath);
}

async function buildArtifactCheck(
  paths: ReturnType<typeof createAssetCompilerPaths>,
  input: Omit<ProductAssetFactoryArtifactCheck, "exists" | "sizeBytes">
): Promise<ProductAssetFactoryArtifactCheck> {
  const localPath = resolveLocalArtifactPath(paths, input.path);
  if (!(await fileExists(localPath))) {
    return {
      ...input,
      exists: false,
      sizeBytes: null
    };
  }
  const stats = await stat(localPath);
  return {
    ...input,
    exists: true,
    sizeBytes: stats.size
  };
}

function inferRequiredComponents(draft: ProductUrlReferenceDraft) {
  const evidence = [draft.product.title, draft.product.sku, draft.product.manufacturer].join(" ").toLowerCase();
  if (/zdq012j|setina|세티나|motion|모션|desk|데스크/.test(evidence)) {
    return [
      "dimension-locked desktop slab with bevelled laminate edge band",
      "front modesty/lift fascia panel with satin warm-grey finish",
      "right-side vertical support panel with matching laminate grain",
      "telescoping lift plates and graphite frame rails",
      "sliding rear power channel and black cable duct",
      "collision sensor paddle/control strip under the front edge",
      "two brushed-metal vertical pull handles",
      "black foot pads and levelling details"
    ];
  }

  if (/monitor|display|모니터/.test(evidence)) {
    return [
      "dimension-locked screen slab",
      "bezel and rear shell separated by material slot",
      "stand or VESA mount interface",
      "screen-glass roughness/reflectance variant",
      "cable and port detail blockout"
    ];
  }

  return [
    "dimension-locked primary silhouette",
    "separate visible material zones",
    "product-specific controls, openings, ports, or fasteners",
    "support/collider proxy aligned to canonical millimetre dimensions"
  ];
}

function buildMaterialPlan(
  draft: ProductUrlReferenceDraft,
  descriptor: RuntimePackageDescriptor | null
): ProductAssetFactoryMaterialPlan[] {
  const materialPlan = new Map<string, ProductAssetFactoryMaterialPlan>();
  draft.materialHints.forEach((hint) => {
    materialPlan.set(hint.slot, {
      slot: hint.slot,
      materialType: hint.materialType,
      target: hint.label,
      evidence: hint.evidence,
      qaStatus: "pending_reference"
    });
  });

  const runtimeSlots =
    descriptor?.runtimeAsset.materialVariants.flatMap((variant) => variant.slotMaterials ?? []) ?? [];
  runtimeSlots.forEach((slotMaterial) => {
    if (!materialPlan.has(slotMaterial.slot)) {
      materialPlan.set(slotMaterial.slot, {
        slot: slotMaterial.slot,
        materialType: slotMaterial.materialType,
        target: slotMaterial.referenceNote ?? "runtime-authored material slot",
        evidence: [descriptor?.label ?? draft.product.title ?? draft.assetKey, "runtime package material variant"],
        qaStatus: "runtime_authored"
      });
    }
  });

  return [...materialPlan.values()];
}

function buildBlenderScaffold(draft: ProductUrlReferenceDraft, requiredComponents: string[]) {
  const dimensions = draft.product.dimensionsMm;
  const dimensionBlock = dimensions
    ? `DIMENSIONS_MM = {"width": ${dimensions.width}, "depth": ${dimensions.depth}, "height": ${dimensions.height}}`
    : "DIMENSIONS_MM = None";
  const components = requiredComponents.map((component) => `# - ${component}`).join("\n");
  return `# Auto-generated DeskteriorOnline private prototype asset rebuild scaffold.
# Source URL: ${draft.sourceUrl}
# Asset key: ${draft.assetKey}
# This scaffold is an instruction-bearing Blender entrypoint. It must be refined by
# a Blender agent/material pass before public or commercial catalog exposure.

import bpy

ASSET_KEY = "${draft.assetKey}"
SKU = "${draft.product.sku ?? "UNKNOWN"}"
MANUFACTURER = "${draft.product.manufacturer ?? "UNKNOWN"}"
${dimensionBlock}

REQUIRED_COMPONENTS = [
${requiredComponents.map((component) => `    ${JSON.stringify(component)},`).join("\n")}
]

${components}

def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()

def mm(value):
    return value / 1000.0

def create_box(name, location, scale, material_name):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    material = bpy.data.materials.get(material_name) or bpy.data.materials.new(material_name)
    obj.data.materials.append(material)
    return obj

def build_dimension_proxy():
    if DIMENSIONS_MM is None:
        raise RuntimeError("Official dimensions are required before asset generation.")
    width = mm(DIMENSIONS_MM["width"])
    depth = mm(DIMENSIONS_MM["depth"])
    height = mm(DIMENSIONS_MM["height"])
    create_box("dimension_locked_primary_silhouette", (0, height / 2, 0), (width, height, depth), "Material_Blockout")

def main():
    clear_scene()
    build_dimension_proxy()
    bpy.ops.wm.save_as_mainfile(filepath=f"{ASSET_KEY}.blend")

if __name__ == "__main__":
    main()
`;
}

function compareDimensions(reference: ProductUrlReferenceDraft["product"]["dimensionsMm"], runtime: RuntimePackageDescriptor | null) {
  const runtimeDimensions = runtime?.dimensionsMm ?? null;
  if (!reference || !runtimeDimensions) {
    return {
      referenceMm: reference,
      runtimeMm: runtimeDimensions,
      errorMm: null,
      maxErrorMm: null,
      maxErrorPercent: null,
      passed: false
    };
  }

  const errorMm = {
    width: Math.abs(reference.width - runtimeDimensions.width),
    depth: Math.abs(reference.depth - runtimeDimensions.depth),
    height: Math.abs(reference.height - runtimeDimensions.height)
  };
  const maxErrorMm = Math.max(errorMm.width, errorMm.depth, errorMm.height);
  const maxReference = Math.max(reference.width, reference.depth, reference.height);
  const maxErrorPercent = maxReference > 0 ? (maxErrorMm / maxReference) * 100 : null;
  return {
    referenceMm: reference,
    runtimeMm: runtimeDimensions,
    errorMm,
    maxErrorMm,
    maxErrorPercent,
    passed: maxErrorMm <= 5 && (maxErrorPercent ?? Number.POSITIVE_INFINITY) <= 1
  };
}

function buildRepairInstructions(input: {
  artifactChecks: ProductAssetFactoryArtifactCheck[];
  dimensionPassed: boolean;
  visualFidelity: number;
  materialQaStatus: ProductAssetFactoryQaReport["materialCoverage"]["qaStatus"];
  referenceImageCount: number;
  releaseEligible: boolean;
}) {
  const instructions: string[] = [];
  input.artifactChecks
    .filter((check) => check.required && !check.exists)
    .forEach((check) => {
      instructions.push(`Create missing required artifact: ${check.label} (${check.path}).`);
    });
  if (!input.dimensionPassed) {
    instructions.push("Rebuild or rescale the model so runtime dimensions match the official reference within 5mm or 1%.");
  }
  if (input.referenceImageCount < 3) {
    instructions.push("Collect at least front, side/top, and detail reference images before attempting a high-fidelity rebuild.");
  }
  if (input.visualFidelity < 0.9) {
    instructions.push("Run a focused Blender rebuild pass for product-specific silhouette details and compare rendered orthographic views against references.");
  }
  if (input.materialQaStatus !== "passed") {
    instructions.push("Replace URL-inferred procedural materials with manufacturer finish swatches, calibrated PBR values, or licensed material references.");
  }
  if (!input.releaseEligible) {
    instructions.push("Keep the asset private/prototype-only until product-design, CAD, texture, trademark, and reference-image usage rights are cleared.");
  }
  return instructions;
}

export function parseProductAssetFactoryArgs(
  argv: string[]
): ProductAssetFactoryOptions & { json: boolean; help: boolean } {
  const readOption = (name: string) => {
    const prefix = `--${name}=`;
    const inline = argv.find((entry) => entry.startsWith(prefix));
    if (inline) return inline.slice(prefix.length);
    const index = argv.findIndex((entry) => entry === `--${name}`);
    return index >= 0 ? argv[index + 1] ?? null : null;
  };

  return {
    referencePackPath: readOption("reference-pack") ?? "",
    assetKey: readOption("asset-key"),
    outputDir: readOption("out"),
    json: argv.includes("--json"),
    help: argv.includes("--help")
  };
}

export async function runProductAssetFactory(
  options: ProductAssetFactoryOptions
): Promise<ProductAssetFactorySummary> {
  if (!options.referencePackPath.trim()) {
    throw new Error("asset factory requires --reference-pack <path>");
  }

  const paths = createAssetCompilerPaths();
  const referencePackPath = path.resolve(paths.repoRoot, options.referencePackPath);
  const draft = await readJson<ProductUrlReferenceDraft>(referencePackPath);
  if (!draft || draft.schemaVersion !== "product-url-reference-alpha-v1") {
    throw new Error(`invalid product URL reference pack: ${referencePackPath}`);
  }

  const assetKey = options.assetKey?.trim() || draft.assetKey;
  const outputDir = options.outputDir?.trim()
    ? path.resolve(paths.repoRoot, options.outputDir)
    : path.join(path.dirname(referencePackPath), "asset-factory");
  const descriptorPath = path.join(paths.runtimePackageDir, `${assetKey}.json`);
  const descriptor = await readJson<RuntimePackageDescriptor>(descriptorPath);
  const runtimeIndex = await readJson<RuntimePackageCatalog>(paths.runtimePackageIndexPath);
  const runtimeIndexEntry = runtimeIndex?.assets.find((entry) => entry.key === assetKey) ?? null;

  const sourceBlendPath = descriptor?.files.sourceBlend.path ?? `assets/blender/deskterior/${assetKey}.blend`;
  const runtimeModelPath = descriptor?.files.runtimeModel.path ?? `/assets/models/${assetKey}/${assetKey}.glb`;
  const proxyModelPath = descriptor?.files.proxyModel.path ?? `/assets/models/${assetKey}/${assetKey}.proxy.glb`;
  const collidersPath = descriptor?.files.colliders.path ?? `/assets/catalog/runtime-packages/${assetKey}.colliders.json`;
  const supportSurfacesPath =
    descriptor?.files.supportSurfaces.path ?? `/assets/catalog/runtime-packages/${assetKey}.support-surfaces.json`;
  const attachmentPointsPath =
    descriptor?.files.attachmentPoints.path ?? `/assets/catalog/runtime-packages/${assetKey}.attachment-points.json`;
  const materialVariantsPath =
    descriptor?.files.materialVariants.path ?? `/assets/catalog/runtime-packages/${assetKey}.material-variants.json`;
  const runtimeQaReportPath = descriptor?.files.qaReport.path ?? `/assets/catalog/runtime-packages/${assetKey}.qa-report.json`;
  const thumbnailPath = descriptor?.files.thumbnail.path ?? `/assets/catalog/thumbnails/${assetKey}.webp`;

  const artifactChecks = await Promise.all([
    buildArtifactCheck(paths, {
      id: "source_blend",
      label: "Blender source file",
      path: sourceBlendPath,
      required: true
    }),
    buildArtifactCheck(paths, {
      id: "runtime_model",
      label: "Runtime GLB model",
      path: runtimeModelPath,
      required: true
    }),
    buildArtifactCheck(paths, {
      id: "proxy_model",
      label: "Runtime proxy GLB",
      path: proxyModelPath,
      required: true
    }),
    buildArtifactCheck(paths, {
      id: "colliders",
      label: "Collider sidecar",
      path: collidersPath,
      required: true
    }),
    buildArtifactCheck(paths, {
      id: "support_surfaces",
      label: "Support surface sidecar",
      path: supportSurfacesPath,
      required: true
    }),
    buildArtifactCheck(paths, {
      id: "attachment_points",
      label: "Attachment point sidecar",
      path: attachmentPointsPath,
      required: true
    }),
    buildArtifactCheck(paths, {
      id: "material_variants",
      label: "Material variant sidecar",
      path: materialVariantsPath,
      required: true
    }),
    buildArtifactCheck(paths, {
      id: "qa_report",
      label: "Runtime QA report",
      path: runtimeQaReportPath,
      required: true
    }),
    buildArtifactCheck(paths, {
      id: "thumbnail",
      label: "Inventory thumbnail",
      path: thumbnailPath,
      required: true
    })
  ]);

  const requiredComponents = inferRequiredComponents(draft);
  const materialSlots = buildMaterialPlan(draft, descriptor);
  const blenderScriptPath = path.join(outputDir, `build-${assetKey}.py`);
  const planPath = path.join(outputDir, "asset-plan.json");
  const qaReportPath = path.join(outputDir, "factory-qa-report.json");
  const repairInstructionsPath = path.join(outputDir, "repair-instructions.json");
  const privateCatalogEntryPath = path.join(outputDir, "private-catalog-entry.json");
  const dimensionComparison = compareDimensions(draft.product.dimensionsMm, descriptor);
  const visualFidelity =
    descriptor?.commercialReadiness.visualFidelityScore ??
    descriptor?.runtimeAsset.commercialReadiness?.visualFidelityScore ??
    0;
  const materialQaStatus =
    descriptor?.commercialReadiness.materialQaStatus ??
    descriptor?.runtimeAsset.commercialReadiness?.materialQaStatus ??
    "missing";
  const releaseEligible =
    descriptor?.commercialReadiness.releaseEligible ??
    descriptor?.runtimeAsset.commercialReadiness?.releaseEligible ??
    runtimeIndexEntry?.releaseEligible ??
    false;
  const artifactCompleteness =
    artifactChecks.filter((check) => !check.required || check.exists).length / artifactChecks.length;
  const runtimeSlots =
    descriptor?.runtimeAsset.materialVariants.flatMap((variant) => variant.slotMaterials ?? []) ?? [];
  const pendingSlotCount = runtimeSlots.filter((slot) => slot.qaStatus !== "passed").length;
  const materialReferenceReadiness =
    materialQaStatus === "passed" ? 1 : materialQaStatus === "pending" ? 0.55 : 0.2;
  const dimensionFidelity =
    dimensionComparison.passed && dimensionComparison.maxErrorPercent !== null
      ? Math.max(0, 1 - dimensionComparison.maxErrorPercent / 5)
      : 0;
  const blocked = artifactChecks.some((check) => check.required && !check.exists) || !dimensionComparison.passed;
  const privateReadiness = Number(
    (
      artifactCompleteness * 0.3 +
      Math.min(visualFidelity, 1) * 0.3 +
      dimensionFidelity * 0.25 +
      materialReferenceReadiness * 0.15
    ).toFixed(3)
  );
  const repairInstructions = buildRepairInstructions({
    artifactChecks,
    dimensionPassed: dimensionComparison.passed,
    visualFidelity,
    materialQaStatus,
    referenceImageCount: draft.referenceImages.length,
    releaseEligible: Boolean(releaseEligible)
  });

  const plan: ProductAssetFactoryPlan = {
    schemaVersion: "product-asset-factory-plan-alpha-v1",
    generatedAt: new Date().toISOString(),
    assetKey,
    product: draft.product,
    sourceUrl: draft.sourceUrl,
    referencePackPath: toRepoRelative(paths.repoRoot, referencePackPath),
    visibility: {
      mode: "private_prototype",
      catalogExposure: "private_only",
      releaseEligible: false,
      reason:
        "Product detail pages and downloaded reference imagery are sufficient for private prototype rebuilding only; public/commercial catalog exposure requires explicit rights and stronger visual QA."
    },
    qualityTargets: {
      targetSimilarityPercent: 90,
      minVisualFidelityScore: 0.9,
      maxDimensionToleranceMm: 5,
      maxDimensionTolerancePercent: 1,
      requireLicensedCadForCommercial: true
    },
    build: {
      strategy: "blender_procedural_reference_rebuild",
      blenderScriptPath: toRepoRelative(paths.repoRoot, blenderScriptPath),
      outputModelPath: runtimeModelPath,
      outputProxyPath: proxyModelPath,
      outputThumbnailPath: thumbnailPath,
      requiredComponents,
      materialSlots
    },
    validationGates: [
      "reference-pack dimensions and SKU present",
      "Blender source, runtime GLB, proxy GLB, thumbnail, and sidecars exist",
      "runtime dimensions match official dimensions within 5mm or 1%",
      "material slots are separated for wood/metal/plastic/glass/fabric as applicable",
      "runtime package releaseEligible remains false until rights and commercial QA are cleared"
    ],
    referenceImages: draft.referenceImages
  };

  const qaReport: ProductAssetFactoryQaReport = {
    schemaVersion: "product-asset-factory-qa-alpha-v1",
    generatedAt: new Date().toISOString(),
    assetKey,
    status: blocked ? "blocked" : "ready_for_private_use",
    privateUseOnly: true,
    releaseEligible: false,
    commercialStatus: blocked ? "blocked" : visualFidelity < 0.9 || materialQaStatus !== "passed" ? "needs_repair" : "not_eligible_without_license",
    scores: {
      privateReadiness,
      visualFidelity,
      dimensionFidelity: Number(dimensionFidelity.toFixed(3)),
      artifactCompleteness: Number(artifactCompleteness.toFixed(3)),
      materialReferenceReadiness
    },
    dimensionComparison,
    referenceCoverage: {
      imageCount: draft.referenceImages.length,
      views: [...new Set(draft.referenceImages.map((image) => image.view))],
      finishReferenceCount: draft.referencePack.finishReferences.length,
      status: draft.referencePack.status
    },
    materialCoverage: {
      plannedSlotCount: materialSlots.length,
      runtimeSlotCount: runtimeSlots.length,
      pendingSlotCount,
      qaStatus: materialQaStatus
    },
    artifactChecks,
    catalogVisibility: {
      runtimePackageFound: Boolean(descriptor),
      runtimeIndexFound: Boolean(runtimeIndexEntry),
      publicReleaseBlocked: !releaseEligible && descriptor?.runtimeAsset.commercialReadiness?.releaseEligible === false,
      releaseEligible: false
    },
    repairInstructions
  };

  const privateCatalogEntry: ProductAssetFactoryPrivateCatalogEntry = {
    schemaVersion: "product-asset-private-catalog-alpha-v1",
    generatedAt: new Date().toISOString(),
    assetKey,
    label: descriptor?.label ?? draft.product.title ?? assetKey,
    assetId: descriptor?.assetId ?? null,
    thumbnailPath: thumbnailPath || null,
    referencePackPath: toRepoRelative(paths.repoRoot, referencePackPath),
    qaReportPath: toRepoRelative(paths.repoRoot, qaReportPath),
    visibility: "private_prototype",
    releaseEligible: false,
    restrictions: [
      "Do not expose in public catalog.",
      "Do not mark as commercial hero SKU.",
      "Do not reuse downloaded product-page imagery as runtime texture maps.",
      "Require manufacturer CAD/material/license evidence before commercial promotion."
    ]
  };

  await mkdir(outputDir, { recursive: true });
  await writeFile(blenderScriptPath, buildBlenderScaffold(draft, requiredComponents), "utf8");
  await writeFile(planPath, stringifyJson(plan), "utf8");
  await writeFile(qaReportPath, stringifyJson(qaReport), "utf8");
  await writeFile(
    repairInstructionsPath,
    stringifyJson({
      schemaVersion: "product-asset-factory-repair-alpha-v1",
      generatedAt: new Date().toISOString(),
      assetKey,
      instructions: repairInstructions
    }),
    "utf8"
  );
  await writeFile(privateCatalogEntryPath, stringifyJson(privateCatalogEntry), "utf8");

  return {
    ok: qaReport.status !== "blocked",
    assetKey,
    outputDir: toRepoRelative(paths.repoRoot, outputDir),
    planPath: toRepoRelative(paths.repoRoot, planPath),
    qaReportPath: toRepoRelative(paths.repoRoot, qaReportPath),
    repairInstructionsPath: toRepoRelative(paths.repoRoot, repairInstructionsPath),
    privateCatalogEntryPath: toRepoRelative(paths.repoRoot, privateCatalogEntryPath),
    plan,
    qaReport,
    privateCatalogEntry
  };
}

export function printProductAssetFactorySummary(summary: ProductAssetFactorySummary) {
  console.log(
    [
      "Product Asset Factory",
      `Status: ${summary.ok ? "PASS" : "FAIL"}`,
      `Asset key: ${summary.assetKey}`,
      `Output: ${summary.outputDir}`,
      "",
      "Generated:",
      `- Plan: ${summary.planPath}`,
      `- QA report: ${summary.qaReportPath}`,
      `- Repair instructions: ${summary.repairInstructionsPath}`,
      `- Private catalog entry: ${summary.privateCatalogEntryPath}`,
      "",
      "QA:",
      `- Private readiness: ${summary.qaReport.scores.privateReadiness}`,
      `- Visual fidelity: ${summary.qaReport.scores.visualFidelity}`,
      `- Dimension fidelity: ${summary.qaReport.scores.dimensionFidelity}`,
      `- Artifact completeness: ${summary.qaReport.scores.artifactCompleteness}`,
      `- Commercial status: ${summary.qaReport.commercialStatus}`,
      `- Release eligible: ${summary.qaReport.releaseEligible}`,
      ...(summary.qaReport.repairInstructions.length
        ? ["", "Repair instructions:", ...summary.qaReport.repairInstructions.map((entry) => `- ${entry}`)]
        : [])
    ].join("\n")
  );
}
