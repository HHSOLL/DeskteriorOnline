import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  RuntimePackageCatalog,
  RuntimePackageDescriptor,
  RuntimeTexturePackageMapRef
} from "@deskterioronline/asset-compiler";

type TexturePackageStatus = "orm-png-sidecar-ready-ktx2-pending" | "ktx2-ready";

type ReviewReport = {
  asset?: {
    textureSet?: {
      authoredMaps?: string[];
      generatedPbrMapCount?: number;
      packedOrmReady?: boolean;
      ktx2Ready?: boolean;
    };
    texturePackagingPass?: TexturePackageManifest;
  };
  metrics?: {
    dimensionsM?: [number, number, number];
    triangleCount?: number;
  };
  outputs?: {
    texturePackageManifest?: string;
  };
};

type TexturePackageManifest = {
  schemaVersion?: string;
  packageStatus?: TexturePackageStatus;
  packedOrmMapCount?: number;
  packedOrmChannels?: {
    r?: string;
    g?: string;
    b?: string;
    a?: string;
  };
  ktx2Ready?: boolean;
  ktx2TranscodeAttempted?: boolean;
  toktxAvailable?: boolean;
  stillRequiresRuntimeKtx2Transcode?: boolean;
  stillRequiresFinalUvBake?: boolean;
  packedOrmMaps?: Array<{
    role?: string;
    path?: string;
    resolution?: [number, number];
    channels?: {
      r?: string;
      g?: string;
      b?: string;
      a?: string;
    };
    colorSpace?: string;
  }>;
  promotionBoundary?: string;
};

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../../..");
const publicRoot = path.join(repoRoot, "apps", "web", "public");
const assetKey = "p2s_bruno_room_surface_kit";
const publicModelPath = `/assets/models/${assetKey}/${assetKey}.glb`;
const publicModelDir = path.join(publicRoot, "assets", "models", assetKey);
const publicTextureDir = path.join(publicModelDir, "textures");
const publicTextureManifestPath = `/assets/models/${assetKey}/texture-package-2026-05-19.json`;
const reviewPath = path.join(
  repoRoot,
  "assets",
  "references",
  "blender-authored",
  "bruno-room-surface-kit",
  "asset-review-2026-05-19.json"
);
const runtimePackageDir = path.join(publicRoot, "assets", "catalog", "runtime-packages");
const runtimeIndexPath = path.join(publicRoot, "assets", "catalog", "runtime-packages.json");

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

function stringifyJson(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function repoRelativePath(filePath: string) {
  return path.relative(repoRoot, filePath).replaceAll(path.sep, "/");
}

function publicToLocalPath(publicPath: string) {
  return path.join(publicRoot, publicPath.replace(/^\//, ""));
}

function toKtx2PublicPath(publicPngPath: string) {
  return publicPngPath.replace(/\.png$/i, ".ktx2");
}

async function copyFileIfChanged(sourcePath: string, destinationPath: string) {
  if (existsSync(destinationPath)) {
    const [sourceBuffer, destinationBuffer] = await Promise.all([
      readFile(sourcePath),
      readFile(destinationPath)
    ]);
    if (sourceBuffer.equals(destinationBuffer)) {
      return false;
    }
  }

  await copyFile(sourcePath, destinationPath);
  return true;
}

function dimensionsFromReview(review: ReviewReport) {
  const dimensions = review.metrics?.dimensionsM;
  assert(Array.isArray(dimensions) && dimensions.length === 3, "surface review must include dimensionsM");
  return {
    width: Math.round(dimensions[0] * 1000),
    depth: Math.round(dimensions[1] * 1000),
    height: Math.round(dimensions[2] * 1000)
  };
}

async function main() {
  const generatedAt = new Date().toISOString();
  const review = await readJson<ReviewReport>(reviewPath);
  const sourceManifestRel = review.outputs?.texturePackageManifest;
  assert(sourceManifestRel, "surface review must point to texture package manifest");

  const sourceManifestPath = path.join(repoRoot, sourceManifestRel);
  const sourceManifest = await readJson<TexturePackageManifest>(sourceManifestPath);
  const packagingPass = review.asset?.texturePackagingPass ?? sourceManifest;
  const packedOrmMaps = packagingPass.packedOrmMaps ?? [];

  assert(review.asset?.textureSet?.authoredMaps?.includes("packedOrm"), "surface review must include packedOrm role");
  assert(review.asset.textureSet.packedOrmReady === true, "surface review must mark packed ORM sidecars ready");
  assert(review.asset.textureSet.ktx2Ready === false, "surface review must keep KTX2 readiness false");
  assert(packagingPass.packageStatus === "orm-png-sidecar-ready-ktx2-pending", "unexpected ORM package status");
  assert(packagingPass.ktx2Ready === false, "ORM package must not claim KTX2 readiness");
  assert(packagingPass.stillRequiresRuntimeKtx2Transcode === true, "ORM package must keep KTX2 follow-up");
  assert(packagingPass.stillRequiresFinalUvBake === true, "ORM package must keep final UV bake follow-up");
  assert(packedOrmMaps.length >= 3, "ORM package must list at least 3 sidecar maps");

  await mkdir(publicTextureDir, { recursive: true });
  await mkdir(runtimePackageDir, { recursive: true });

  const publicMaps: RuntimeTexturePackageMapRef[] = [];
  for (const entry of packedOrmMaps) {
    assert(entry.role && entry.path, "ORM sidecar entries must include role and path");
    assert(
      entry.channels?.r === "ambientOcclusion" &&
        entry.channels?.g === "roughness" &&
        entry.channels?.b === "metallic" &&
        entry.channels?.a === "constantOne",
      `ORM sidecar ${entry.role} has invalid channel semantics`
    );
    assert(entry.colorSpace === "Non-Color", `ORM sidecar ${entry.role} must use Non-Color space`);

    const sourcePath = path.join(repoRoot, entry.path);
    assert(existsSync(sourcePath), `ORM sidecar source is missing: ${entry.path}`);
    const publicPath = `/assets/models/${assetKey}/textures/${path.basename(entry.path)}`;
    const publicLocalPath = publicToLocalPath(publicPath);
    await copyFileIfChanged(sourcePath, publicLocalPath);
    const publicKtx2Path = toKtx2PublicPath(publicPath);
    const ktx2Exists = existsSync(publicToLocalPath(publicKtx2Path));
    publicMaps.push({
      role: entry.role,
      sourcePath: entry.path,
      publicPath,
      ktx2Path: ktx2Exists ? publicKtx2Path : null,
      required: true,
      exists: existsSync(publicLocalPath),
      resolution: entry.resolution,
      channels: {
        r: "ambientOcclusion",
        g: "roughness",
        b: "metallic",
        a: "constantOne"
      },
      colorSpace: entry.colorSpace
    });
  }

  const allKtx2Ready = publicMaps.every((entry) => entry.ktx2Path !== null);
  const runtimePackageStatus: TexturePackageStatus = allKtx2Ready
    ? "ktx2-ready"
    : packagingPass.packageStatus ?? "orm-png-sidecar-ready-ktx2-pending";
  const ktx2TranscodeAttempted = allKtx2Ready || packagingPass.ktx2TranscodeAttempted === true;
  const stillRequiresRuntimeKtx2Transcode = !allKtx2Ready;
  const promotionBoundary = allKtx2Ready
    ? "KTX2 runtime ORM sidecars are present; final UV bake and release catalog approval remain blocked."
    : packagingPass.promotionBoundary ??
      "ORM sidecar package evidence only; KTX2 transcode, final UV bake, and release catalog packaging remain blocked";

  const publicManifest = {
    schemaVersion: "deskterior-runtime-texture-package-v1",
    generatedAt,
    assetKey,
    sourceManifestPath: sourceManifestRel,
    packageStatus: runtimePackageStatus,
    ktx2Ready: allKtx2Ready,
    ktx2TranscodeAttempted,
    toktxAvailable: packagingPass.toktxAvailable === true,
    stillRequiresRuntimeKtx2Transcode,
    stillRequiresFinalUvBake: true,
    channels: {
      r: "ambientOcclusion",
      g: "roughness",
      b: "metallic",
      a: "constantOne"
    },
    maps: publicMaps,
    promotionBoundary
  };
  await writeFile(publicToLocalPath(publicTextureManifestPath), stringifyJson(publicManifest));

  const dimensionsMm = dimensionsFromReview(review);
  const triangleCount = review.metrics?.triangleCount ?? 12_146;
  const textureReadinessLabel = allKtx2Ready
    ? "KTX2 runtime ORM sidecars are present; final UV bake still pending."
    : "Packed ORM PNG sidecars are present; KTX2 transcode and final UV bake pending.";
  const textureReferenceNote = allKtx2Ready
    ? "Packed ORM KTX2 sidecar exists; final UV-authored material package remains pending."
    : "Packed ORM PNG sidecar exists; final UV-authored KTX2 material package remains pending.";
  const colliders = [
    {
      id: "bounds-box",
      kind: "box" as const,
      sizeMm: dimensionsMm,
      centerMm: [0, Math.round(dimensionsMm.height / 2), 0] as [number, number, number]
    }
  ];
  const supportSurfaces = [];
  const attachmentPoints = [];
  const materialVariants = [
    {
      id: "qa-surface-materials",
      label: "Bruno room surface QA materials",
      finishColor: "Warm wood floor, warm/cool plaster walls, cream trim",
      finishMaterial: `Local Blender-authored procedural PBR helper maps. ${textureReadinessLabel}`,
      detailNotes:
        "QA candidate only. Not a release-ready catalog package and not Bruno Simon-level final material approval.",
      slotMaterials: [
        {
          slot: "floorWood",
          materialType: "wood" as const,
          qaStatus: "pending" as const,
          referenceNote: textureReferenceNote
        },
        {
          slot: "plasterWall",
          materialType: "mixed" as const,
          qaStatus: "pending" as const,
          referenceNote: textureReferenceNote
        }
      ]
    }
  ];
  const qaReport = {
    status: "warning" as const,
    measuredBoundsMm: dimensionsMm,
    dimensionErrorMm: { width: 0, depth: 0, height: 0 },
    validatorVersion: "bruno-room-runtime-package-alpha-v1",
    issues: [
      ...(allKtx2Ready
        ? []
        : [
            {
              code: "KTX2_TRANSCODE_PENDING",
              severity: "warning" as const,
              message: "Packed ORM sidecars are public runtime package evidence, but KTX2 transcode is still pending."
            }
          ]),
      {
        code: "FINAL_UV_BAKE_PENDING",
        severity: "warning" as const,
        message: "Surface material package still requires final UV-authored AO/GI/ORM atlases."
      }
    ]
  };

  const runtimeAsset = {
    assetId: publicModelPath,
    productId: assetKey,
    units: "mm" as const,
    dimensionsMm,
    scaleLocked: true as const,
    pivot: { x: "center" as const, y: "floor" as const, z: "center" as const },
    sourceProvenance: {
      method: "manual" as const,
      manufacturer: "DeskteriorOnline",
      license: "LicenseRef-DeskteriorOnline-Prototype-QA",
      attributionRequired: false
    },
    runtime: {
      lods: [
        {
          id: "lod0",
          level: 0,
          model: publicModelPath,
          triangleCount,
          drawCallBudget: 48
        }
      ],
      proxy: publicModelPath,
      defaultLod: 0,
      triangleBudget: 25_000,
      textureBudgetMb: 48
    },
    colliders,
    supportSurfaces,
    attachmentPoints,
    materialVariants,
    commercialReadiness: {
      tier: "draft" as const,
      sku: assetKey,
      manufacturer: "DeskteriorOnline",
      referencePack: {
        sku: assetKey,
        manufacturer: "DeskteriorOnline",
        canonicalProductUrl: null,
        dimensionSourceUrl: null,
        referenceImages: [],
        finishReferences: [],
        license: {
          spdx: "LicenseRef-DeskteriorOnline-Prototype-QA",
          label: "DeskteriorOnline local Blender-authored QA candidate",
          requiresAttribution: false
        },
        status: "candidate" as const,
        notes:
          "Local Blender-authored QA candidate for Bruno-inspired room iteration. Not a commercial catalog release."
      },
      visualFidelityScore: 0.72,
      dimensionToleranceMm: 0,
      dimensionTolerancePercent: 0,
      supportSurfaceToleranceMm: 0,
      footprintToleranceMm: 0,
      materialQaStatus: "pending" as const,
      releaseEligible: false
    },
    qaStatus: qaReport
  };

  const descriptor: RuntimePackageDescriptor = {
    schemaVersion: "asset-package-alpha-v2",
    generatedAt,
    key: assetKey,
    packageKind: "curated_asset",
    baseAssetKey: null,
    manifestId: assetKey,
    label: "Bruno Room Surface Kit QA Candidate",
    assetId: publicModelPath,
    sourcePath: "assets/blender/deskterior/p2s_bruno_room_surface_kit.blend",
    runtimePath: publicModelPath,
    dimensionsMm,
    scaleLocked: true,
    contractMetadata: {
      source: {
        kind: "deskterioronline_blender",
        name: "DeskteriorOnline Bruno room surface QA kit",
        path: "assets/blender/deskterior/p2s_bruno_room_surface_kit.blend",
        url: null
      },
      license: {
        spdx: "LicenseRef-DeskteriorOnline-Prototype-QA",
        label: "DeskteriorOnline local Blender-authored QA candidate",
        requiresAttribution: false
      },
      pivot: { x: "center", y: "floor", z: "center" },
      collisionProxy: { kind: "box", derivesFrom: "dimensionsMm" },
      textureSet: {
        workflow: "pbr_metallic_roughness",
        authored: "procedural",
        ktx2Ready: allKtx2Ready
      },
      lodProfile: {
        strategy: "single_mesh",
        levelCount: 1,
        maxDrawCalls: 48,
        maxTriangleCount: 25_000
      }
    },
    supportProfile: null,
    authoring: {
      attachmentPoints: {
        mode: "none",
        reason: "Surface kit is a QA room-envelope layer, not a directly mountable catalog object."
      }
    },
    runtimeAsset,
    commercialReadiness: runtimeAsset.commercialReadiness,
    files: {
      sourceBlend: {
        path: "assets/blender/deskterior/p2s_bruno_room_surface_kit.blend",
        required: true,
        exists: existsSync(path.join(repoRoot, "assets/blender/deskterior/p2s_bruno_room_surface_kit.blend"))
      },
      runtimeModel: {
        path: publicModelPath,
        required: true,
        exists: existsSync(publicToLocalPath(publicModelPath))
      },
      proxyModel: {
        path: publicModelPath,
        required: false,
        exists: existsSync(publicToLocalPath(publicModelPath))
      },
      colliders: {
        path: `/assets/catalog/runtime-packages/${assetKey}.colliders.json`,
        required: true,
        exists: true
      },
      supportSurfaces: {
        path: `/assets/catalog/runtime-packages/${assetKey}.support-surfaces.json`,
        required: false,
        exists: true
      },
      attachmentPoints: {
        path: `/assets/catalog/runtime-packages/${assetKey}.attachment-points.json`,
        required: false,
        exists: true
      },
      materialVariants: {
        path: `/assets/catalog/runtime-packages/${assetKey}.material-variants.json`,
        required: true,
        exists: true
      },
      qaReport: {
        path: `/assets/catalog/runtime-packages/${assetKey}.qa-report.json`,
        required: true,
        exists: true
      },
      thumbnail: {
        path: "/assets/models/p2s_bruno_room_surface_kit/p2s_bruno_room_surface_kit.thumbnail.webp",
        required: false,
        exists: existsSync(publicToLocalPath("/assets/models/p2s_bruno_room_surface_kit/p2s_bruno_room_surface_kit.thumbnail.webp"))
      },
      texturePackageManifest: {
        path: publicTextureManifestPath,
        required: true,
        exists: existsSync(publicToLocalPath(publicTextureManifestPath))
      }
    },
    runtime: {
      lods: [{ level: 0, path: publicModelPath }],
      proxyPath: publicModelPath,
      collidersPath: `/assets/catalog/runtime-packages/${assetKey}.colliders.json`,
      supportSurfacesPath: `/assets/catalog/runtime-packages/${assetKey}.support-surfaces.json`,
      attachmentPointsPath: `/assets/catalog/runtime-packages/${assetKey}.attachment-points.json`,
      materialVariantsPath: `/assets/catalog/runtime-packages/${assetKey}.material-variants.json`,
      qaReportPath: `/assets/catalog/runtime-packages/${assetKey}.qa-report.json`,
      thumbnailPath: "/assets/models/p2s_bruno_room_surface_kit/p2s_bruno_room_surface_kit.thumbnail.webp"
    },
    texturePackages: [
      {
        kind: "packed_orm",
        status: runtimePackageStatus,
        manifestPath: publicTextureManifestPath,
        sourceManifestPath: sourceManifestRel,
        ktx2Ready: allKtx2Ready,
        ktx2TranscodeAttempted,
        toktxAvailable: packagingPass.toktxAvailable === true,
        stillRequiresRuntimeKtx2Transcode,
        stillRequiresFinalUvBake: true,
        channels: {
          r: "ambientOcclusion",
          g: "roughness",
          b: "metallic",
          a: "constantOne"
        },
        maps: publicMaps,
        promotionBoundary
      }
    ],
    qa: {
      status: qaReport.status,
      warnings: qaReport.issues.map((issue) => issue.message)
    }
  };

  await writeFile(path.join(runtimePackageDir, `${assetKey}.json`), stringifyJson(descriptor));
  await writeFile(path.join(runtimePackageDir, `${assetKey}.colliders.json`), stringifyJson(colliders));
  await writeFile(path.join(runtimePackageDir, `${assetKey}.support-surfaces.json`), stringifyJson(supportSurfaces));
  await writeFile(path.join(runtimePackageDir, `${assetKey}.attachment-points.json`), stringifyJson(attachmentPoints));
  await writeFile(path.join(runtimePackageDir, `${assetKey}.material-variants.json`), stringifyJson(materialVariants));
  await writeFile(path.join(runtimePackageDir, `${assetKey}.qa-report.json`), stringifyJson(qaReport));

  const runtimeIndex = existsSync(runtimeIndexPath)
    ? await readJson<RuntimePackageCatalog>(runtimeIndexPath)
    : {
        schemaVersion: "asset-package-index-alpha-v2" as const,
        generatedAt,
        assets: []
      };
  const nextAssets = runtimeIndex.assets.filter((entry) => entry.key !== assetKey);
  nextAssets.push({
    key: assetKey,
    packageKind: "curated_asset",
    baseAssetKey: null,
    manifestId: assetKey,
    label: descriptor.label,
    assetId: publicModelPath,
    packagePath: `/assets/catalog/runtime-packages/${assetKey}.json`,
    runtimeAsset,
    qaStatus: "warning",
    warningCount: descriptor.qa.warnings.length,
    surfaceCount: 0,
    attachmentPointCount: 0,
    materialVariantCount: materialVariants.length,
    texturePackageStatus: runtimePackageStatus,
    texturePackageCount: descriptor.texturePackages?.length ?? 0,
    ktx2Ready: allKtx2Ready,
    commercialTier: "draft",
    sku: assetKey,
    manufacturer: "DeskteriorOnline",
    releaseEligible: false
  });
  nextAssets.sort((left, right) => left.key.localeCompare(right.key));

  const nextRuntimeIndex: RuntimePackageCatalog = {
    schemaVersion: "asset-package-index-alpha-v2",
    generatedAt,
    assets: nextAssets
  };
  await writeFile(runtimeIndexPath, stringifyJson(nextRuntimeIndex));

  console.log(
    JSON.stringify(
      {
        ok: true,
        assetKey,
        descriptor: repoRelativePath(path.join(runtimePackageDir, `${assetKey}.json`)),
        runtimeIndex: repoRelativePath(runtimeIndexPath),
        textureManifest: publicTextureManifestPath,
        publicMaps: publicMaps.map((entry) => entry.publicPath),
        publicKtx2Maps: publicMaps.map((entry) => entry.ktx2Path).filter(Boolean),
        ktx2Ready: allKtx2Ready,
        status: allKtx2Ready ? "runtime-package-sidecar-indexed-ktx2-ready" : "runtime-package-sidecar-indexed-ktx2-pending"
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
