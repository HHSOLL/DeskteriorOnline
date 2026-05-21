import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp, { type OverlayOptions } from "sharp";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = path.resolve(SCRIPT_DIR, "..");
const REPO_ROOT = path.resolve(WEB_ROOT, "..", "..");
const OUTPUT_DIR = path.join(REPO_ROOT, "output", "visual-qa");
const LEDGER_PATH = path.join(
  REPO_ROOT,
  "assets/references/blender-authored/bruno-furniture-hero-kit/benchmark-ledger-2026-05-19.json"
);
const CONTACT_SHEET_PATH = path.join(OUTPUT_DIR, "bruno-room-asset-benchmark-contact-sheet.png");

type AssetReview = {
  schemaVersion?: string;
  asset?: {
    slug?: string;
    intent?: string;
    source?: string;
    license?: string;
    textureSet?: {
      authoredMaps?: string[];
      generatedPbrMapCount?: number;
      ktx2Ready?: boolean;
      packedOrmMapCount?: number;
      packedOrmReady?: boolean;
    };
    bakedContactShadowPass?: {
      floorZones?: string[];
      wallZones?: string[];
      runtimeOverlayReplacement?: boolean;
    };
    wallRevealCleanupPass?: {
      lineOpacityAfter?: number;
      softWashZones?: string[];
      gridOverlayRisk?: string;
      stillRequiresBrowserHumanReview?: boolean;
    };
    artDirectedGiPass?: {
      floorBounceZones?: string[];
      wallBounceZones?: string[];
      physicallyBaked?: boolean;
      stillRequiresPathTracedBake?: boolean;
    };
    cyclesAoBakePass?: {
      engine?: string;
      bakeType?: string;
      samples?: number;
      blockerProxies?: string[];
      physicallyBakedAo?: boolean;
      pathTracedGi?: boolean;
      stillRequiresPathTracedGi?: boolean;
      stillRequiresFinalUvBake?: boolean;
    };
    texturePackagingPass?: {
      packageStatus?: string;
      packedOrmMapCount?: number;
      ktx2Ready?: boolean;
      stillRequiresRuntimeKtx2Transcode?: boolean;
      stillRequiresFinalUvBake?: boolean;
    };
    bespokeCurvaturePass?: {
      meshFamilies?: string[];
      sofaMeshes?: string[];
      coffeeTableMeshes?: string[];
      stillRequiresHumanArtReview?: boolean;
    };
  };
  outputs?: Record<string, string>;
  metrics?: {
    dimensionsM?: number[];
    objectCount?: number;
    materialCount?: number;
    textureCount?: number;
    triangleCount?: number;
    runtimeBytes?: number;
    publicBytes?: number;
  };
  comparisonReview?: {
    commercialBenchmarkRubric?: Array<{
      gate?: string;
      candidateStatus?: string;
      evidence?: string;
      remainingGap?: string;
    }>;
    commercialPatternsApplied?: string[];
    knownGapsBeforeCommercialPromotion?: string[];
    currentGrade?: string;
  };
};

type BenchmarkPanel = {
  id: string;
  title: string;
  subtitle: string;
  imagePath: string;
  role: "current-result" | "authored-asset" | "reference-board" | "open-community-reference";
  evidence: string;
};

type BenchmarkLedger = {
  schemaVersion: "deskterior-bruno-room-asset-benchmark-v1";
  generatedAt: string;
  objective: string;
  status: "not-commercial-ready";
  contactSheet: string;
  visualMetrics: {
    finalRoomBrightPixelRatio: number;
    finalRoomClippedHighlightRatio: number;
  };
  comparisonPolicy: {
    noUnlicensedCommercialImagesEmbedded: true;
    benchmarkUse: string;
    meshyProviderGeneration: "not-used-in-this-pass";
  };
  inputs: {
    finalRoomScreenshot: string;
    furnitureHeroReview: string;
    surfaceKitReview: string;
    detailKitReview: string;
  };
  currentMetrics: {
    furnitureHero: AssetReview["metrics"];
    surfaceKit: AssetReview["metrics"];
    detailKit: AssetReview["metrics"];
  };
  panels: BenchmarkPanel[];
  benchmarkGates: Array<{
    gate: string;
    target: string;
    currentStatus: "pass-for-qa" | "partial" | "blocked";
    evidence: string;
    nextAction: string;
  }>;
  weakestAreas: Array<{
    rank: number;
    area: string;
    whyItBlocksCommercialQuality: string;
    nextBlenderIteration: string;
  }>;
  nextIterationOrder: string[];
};

function relative(filePath: string) {
  return path.relative(REPO_ROOT, filePath);
}

function readJson<T>(filePath: string) {
  assert.ok(fs.existsSync(filePath), `${relative(filePath)} should exist`);
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function assertImage(filePath: string, label: string) {
  assert.ok(fs.existsSync(filePath), `${label} should exist at ${relative(filePath)}`);
  assert.ok(fs.statSync(filePath).size > 8 * 1024, `${label} should be a non-empty image`);
}

function escapeXml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function textBlock(lines: string[], x: number, y: number, width: number, options: { size: number; color: string; weight?: number }) {
  const rowHeight = Math.ceil(options.size * 1.36);
  return lines
    .map((line, index) => {
      const clipped = line.length > 94 ? `${line.slice(0, 91)}...` : line;
      return `<text x="${x}" y="${y + index * rowHeight}" font-family="Arial, sans-serif" font-size="${options.size}" font-weight="${options.weight ?? 400}" fill="${options.color}" textLength="${width}" lengthAdjust="spacingAndGlyphs">${escapeXml(clipped)}</text>`;
    })
    .join("");
}

function wrapLine(value: string, maxLength: number) {
  const words = value.split(/\s+/g);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxLength && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function panelLabelSvg(panel: BenchmarkPanel, index: number, width: number, height: number) {
  const subtitleLines = wrapLine(panel.subtitle, 46).slice(0, 3);
  const evidenceLines = wrapLine(panel.evidence, 58).slice(0, 4);
  return Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" rx="18" fill="#171411"/>
      <text x="24" y="38" font-family="Arial, sans-serif" font-size="18" font-weight="800" fill="#fff">${String(index + 1).padStart(2, "0")} · ${escapeXml(panel.title)}</text>
      <text x="24" y="68" font-family="Arial, sans-serif" font-size="12" font-weight="700" fill="#d8c2a2">${escapeXml(panel.role)}</text>
      ${textBlock(subtitleLines, 24, 104, width - 48, { size: 14, color: "#ded7cc", weight: 700 })}
      ${textBlock(evidenceLines, 24, 190, width - 48, { size: 12, color: "#a99f92" })}
    </svg>
  `);
}

function headerSvg(width: number, height: number, ledger: BenchmarkLedger) {
  const gates = ledger.benchmarkGates.map((gate) => `${gate.gate}: ${gate.currentStatus}`).join("  /  ");
  return Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="headerGradient" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#12151b"/>
          <stop offset="58%" stop-color="#2a1f24"/>
          <stop offset="100%" stop-color="#5a2d2b"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#headerGradient)"/>
      <text x="36" y="52" font-family="Arial, sans-serif" font-size="28" font-weight="900" fill="#fff">Deskterior Bruno-style room asset benchmark</text>
      <text x="36" y="88" font-family="Arial, sans-serif" font-size="15" fill="#e8ded1">Current result vs authored GLB kits vs approved local reference boards. Commercial images are not embedded without license.</text>
      <text x="36" y="122" font-family="Arial, sans-serif" font-size="13" fill="#c9b7a3">${escapeXml(gates)}</text>
      <text x="36" y="154" font-family="Arial, sans-serif" font-size="13" fill="#f2b195">Status: not commercial-ready. This board is the iteration gate for topology, material, lighting, and runtime packaging work.</text>
    </svg>
  `);
}

function metricLine(label: string, review: AssetReview) {
  const metrics = review.metrics ?? {};
  return `${label}: objects ${metrics.objectCount ?? "-"}, materials ${metrics.materialCount ?? "-"}, textures ${metrics.textureCount ?? 0}, tris ${metrics.triangleCount ?? "-"}`;
}

async function analyzeHighlightMetrics(imagePath: string) {
  const { data, info } = await sharp(imagePath).raw().toBuffer({ resolveWithObject: true });
  let visiblePixels = 0;
  let brightPixels = 0;
  let clippedPixels = 0;

  for (let index = 0; index < data.length; index += info.channels) {
    const alpha = info.channels >= 4 ? data[index + 3] ?? 255 : 255;
    if (alpha <= 8) continue;
    const red = data[index] ?? 0;
    const green = data[index + 1] ?? 0;
    const blue = data[index + 2] ?? 0;
    const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    visiblePixels += 1;
    if (luminance > 205) brightPixels += 1;
    if (luminance > 230) clippedPixels += 1;
  }

  return {
    brightPixelRatio: Number((brightPixels / Math.max(1, visiblePixels)).toFixed(3)),
    clippedHighlightRatio: Number((clippedPixels / Math.max(1, visiblePixels)).toFixed(3))
  };
}

async function imageComposite(imagePath: string, x: number, y: number, width: number, height: number) {
  const image = await sharp(imagePath)
    .rotate()
    .resize(width, height, { fit: "contain", background: "#0b0c10" })
    .png()
    .toBuffer();
  return { input: image, left: x, top: y };
}

async function buildContactSheet(ledger: BenchmarkLedger) {
  const width = 1500;
  const headerHeight = 180;
  const margin = 30;
  const gap = 24;
  const labelWidth = 390;
  const imageWidth = width - margin * 2 - labelWidth - gap;
  const rowHeight = 360;
  const height = headerHeight + ledger.panels.length * rowHeight + margin;

  const composites: OverlayOptions[] = [{ input: headerSvg(width, headerHeight, ledger), left: 0, top: 0 }];
  for (const [index, panel] of ledger.panels.entries()) {
    const top = headerHeight + index * rowHeight + margin;
    composites.push({ input: panelLabelSvg(panel, index, labelWidth, rowHeight - gap), left: margin, top });
    composites.push(await imageComposite(panel.imagePath, margin + labelWidth + gap, top, imageWidth, rowHeight - gap));
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: "#ede7dc"
    }
  })
    .composite(composites)
    .png()
    .toFile(CONTACT_SHEET_PATH);
}

async function main() {
  const finalRoomScreenshot = path.join(REPO_ROOT, "output/playwright/pc-assembly-workbench-cinematic.png");
  const furnitureThumbnail = path.join(
    REPO_ROOT,
    "assets/runtime-candidates/blender-authored/bruno-furniture-hero-kit/p2s_bruno_furniture_hero_kit.thumbnail.webp"
  );
  const surfaceThumbnail = path.join(
    REPO_ROOT,
    "assets/runtime-candidates/blender-authored/bruno-room-surface-kit/p2s_bruno_room_surface_kit.thumbnail.webp"
  );
  const detailThumbnail = path.join(
    REPO_ROOT,
    "assets/runtime-candidates/blender-authored/bruno-room-detail-kit/p2s_bruno_room_detail_kit.thumbnail.webp"
  );
  const meshyCommunityContactSheet = path.join(REPO_ROOT, "output/meshy-community/runtime-candidates-contact-sheet.webp");
  const soOngComparisonBoard = path.join(
    REPO_ROOT,
    "assets/references/video-scenes/so-ong-space-2026-05-desk-setup/so-ong-meshy-asset-comparison-board.png"
  );

  for (const [filePath, label] of [
    [finalRoomScreenshot, "final room screenshot"],
    [furnitureThumbnail, "furniture hero thumbnail"],
    [surfaceThumbnail, "surface kit thumbnail"],
    [detailThumbnail, "detail kit thumbnail"],
    [meshyCommunityContactSheet, "Meshy community contact sheet"],
    [soOngComparisonBoard, "So Ong comparison board"]
  ] as const) {
    assertImage(filePath, label);
  }

  const furnitureReviewPath = path.join(
    REPO_ROOT,
    "assets/references/blender-authored/bruno-furniture-hero-kit/asset-review-2026-05-19.json"
  );
  const surfaceReviewPath = path.join(
    REPO_ROOT,
    "assets/references/blender-authored/bruno-room-surface-kit/asset-review-2026-05-19.json"
  );
  const detailReviewPath = path.join(
    REPO_ROOT,
    "assets/references/blender-authored/bruno-room-detail-kit/asset-review-2026-05-19.json"
  );
  const furnitureReview = readJson<AssetReview>(furnitureReviewPath);
  const surfaceReview = readJson<AssetReview>(surfaceReviewPath);
  const detailReview = readJson<AssetReview>(detailReviewPath);
  const finalRoomHighlightMetrics = await analyzeHighlightMetrics(finalRoomScreenshot);

  const panels: BenchmarkPanel[] = [
    {
      id: "current-cinematic-room",
      title: "Current final room",
      subtitle: "Latest browser screenshot from the PC assembly workbench after full build and room styling.",
      imagePath: finalRoomScreenshot,
      role: "current-result",
      evidence: `Warm/cool contrast is preserved and highlight washout is now tracked: bright ${finalRoomHighlightMetrics.brightPixelRatio}, clipped ${finalRoomHighlightMetrics.clippedHighlightRatio}.`
    },
    {
      id: "furniture-hero-kit",
      title: "Furniture hero GLB",
      subtitle: metricLine("Furniture", furnitureReview),
      imagePath: furnitureThumbnail,
      role: "authored-asset",
      evidence: `Project-authored Blender furniture layer with ${
        furnitureReview.asset?.textureSet?.authoredMaps?.join("/") ?? "PBR"
      } helper maps, ${furnitureReview.asset?.texturePackagingPass?.packedOrmMapCount ?? 0} packed ORM sidecars, and ${
        furnitureReview.asset?.bespokeCurvaturePass?.meshFamilies?.join("/") ?? "foreground"
      } topology pass; still not split into selectable catalog SKUs.`
    },
    {
      id: "surface-kit",
      title: "Room surface GLB",
      subtitle: metricLine("Surface", surfaceReview),
      imagePath: surfaceThumbnail,
      role: "authored-asset",
      evidence: `Wood floor, plaster, trim, cove LEDs, ${surfaceReview.asset?.textureSet?.authoredMaps?.join("/") ?? "PBR"} maps, and ${
        surfaceReview.asset?.bakedContactShadowPass?.floorZones?.length ?? 0
      } floor contact zones improve room read. The new art-directed bounce pass adds ${
        surfaceReview.asset?.artDirectedGiPass?.floorBounceZones?.length ?? 0
      } floor + ${surfaceReview.asset?.artDirectedGiPass?.wallBounceZones?.length ?? 0} wall bounce zones. Cycles AO bake uses ${
        surfaceReview.asset?.cyclesAoBakePass?.samples ?? "unknown"
      } samples across ${surfaceReview.asset?.cyclesAoBakePass?.blockerProxies?.length ?? 0} blocker proxies. Wall reveal opacity is now ${
        surfaceReview.asset?.wallRevealCleanupPass?.lineOpacityAfter ?? "unknown"
      } with ${surfaceReview.asset?.wallRevealCleanupPass?.softWashZones?.length ?? 0} soft-wash zones. ORM sidecars: ${
        surfaceReview.asset?.texturePackagingPass?.packedOrmMapCount ?? 0
      } maps; still lacks path-traced GI/KTX2 packaging.`
    },
    {
      id: "detail-kit",
      title: "Wall detail GLB",
      subtitle: metricLine("Detail", detailReview),
      imagePath: detailThumbnail,
      role: "authored-asset",
      evidence: "Pegboard, shelves, books, cable details, camera, leaves, and LED bars increase lived-in density; botanical and micro-surface quality remain stylized."
    },
    {
      id: "meshy-community-reference",
      title: "Meshy/open candidate board",
      subtitle: "Locally staged public/community runtime candidates used for asset-quality comparison, not provider generation.",
      imagePath: meshyCommunityContactSheet,
      role: "open-community-reference",
      evidence: "Useful for quick silhouette/material variety comparison; individual licenses still need release audit before catalog promotion."
    },
    {
      id: "so-ong-asset-reference",
      title: "Product asset comparison board",
      subtitle: "Existing input-vs-generated asset QA board from the So Ong desk setup pipeline.",
      imagePath: soOngComparisonBoard,
      role: "reference-board",
      evidence: "Shows the level of asset-by-asset input/render evidence expected before moving a room pack toward commercial catalog use."
    }
  ];

  const ledger: BenchmarkLedger = {
    schemaVersion: "deskterior-bruno-room-asset-benchmark-v1",
    generatedAt: new Date().toISOString(),
    objective:
      "Create an evidence-backed iteration gate for moving the PC assembly room from QA candidate toward Bruno Simon-inspired commercial room quality.",
    status: "not-commercial-ready",
    contactSheet: relative(CONTACT_SHEET_PATH),
    visualMetrics: {
      finalRoomBrightPixelRatio: finalRoomHighlightMetrics.brightPixelRatio,
      finalRoomClippedHighlightRatio: finalRoomHighlightMetrics.clippedHighlightRatio
    },
    comparisonPolicy: {
      noUnlicensedCommercialImagesEmbedded: true,
      benchmarkUse:
        "Commercial and Bruno Simon references are used as qualitative targets only; this board embeds only local authored/open/community evidence paths.",
      meshyProviderGeneration: "not-used-in-this-pass"
    },
    inputs: {
      finalRoomScreenshot: relative(finalRoomScreenshot),
      furnitureHeroReview: relative(furnitureReviewPath),
      surfaceKitReview: relative(surfaceReviewPath),
      detailKitReview: relative(detailReviewPath)
    },
    currentMetrics: {
      furnitureHero: furnitureReview.metrics,
      surfaceKit: surfaceReview.metrics,
      detailKit: detailReview.metrics
    },
    panels,
    benchmarkGates: [
      {
        gate: "room composition",
        target: "cutaway room reads as a finished deskterior scene from the first screenshot",
        currentStatus: "partial",
        evidence: `The browser screenshot has wall/surface/furniture/detail layers, and glare is now measured at clipped=${finalRoomHighlightMetrics.clippedHighlightRatio}.`,
        nextAction: "Remove leftover staging primitives, tune camera crop, and continue reducing central practical light glare without flattening contrast."
      },
      {
        gate: "furniture topology",
        target: "sofa, coffee table, shelf, desk, and media console have bespoke silhouettes, bevels, seams, legs, backs, and scale detail",
        currentStatus: "partial",
        evidence: `The furniture kit now has ${furnitureReview.metrics?.objectCount ?? "-"} authored objects, ${furnitureReview.metrics?.triangleCount ?? "-"} triangles, and records ${
          furnitureReview.asset?.bespokeCurvaturePass?.sofaMeshes?.length ?? 0
        } sofa + ${furnitureReview.asset?.bespokeCurvaturePass?.coffeeTableMeshes?.length ?? 0} coffee-table curved topology targets.`,
        nextAction: "Use internal-browser screenshot review to decide whether another sculpt pass or a full high-poly/UV furniture rebuild is required."
      },
      {
        gate: "material response",
        target: "wood, fabric, lacquer, glass, screen, wall, and floor surfaces each react plausibly under warm/cool lighting",
        currentStatus: "partial",
        evidence: `Furniture helper maps include ${
          furnitureReview.asset?.textureSet?.authoredMaps?.join(", ") ?? "PBR helper"
        } roles with ${furnitureReview.asset?.texturePackagingPass?.packedOrmMapCount ?? 0} packed ORM sidecars; surface kit reports ${
          surfaceReview.asset?.textureSet?.authoredMaps?.join(", ") ?? "PBR helper"
        } roles with ${surfaceReview.metrics?.textureCount ?? "-"} embedded textures and ${
          surfaceReview.asset?.texturePackagingPass?.packedOrmMapCount ?? 0
        } packed ORM sidecars.`,
        nextAction: "Replace procedural helper maps with art-directed UV bakes, reduce flat fabric blocks, and keep KTX2 sidecar freshness under QA."
      },
      {
        gate: "lighting and bake",
        target: "scene has authored contact shadows, soft bounce, practical lights, and minimal runtime-only flatness",
        currentStatus: "partial",
        evidence: `Runtime glare is lower, the named cinematic contact-occlusion pass is wired, and the surface GLB now carries ${
          surfaceReview.asset?.bakedContactShadowPass?.floorZones?.length ?? 0
        } floor + ${surfaceReview.asset?.bakedContactShadowPass?.wallZones?.length ?? 0} wall contact-shadow lightmap zones plus ${
          surfaceReview.asset?.wallRevealCleanupPass?.softWashZones?.length ?? 0
        } wall soft-wash zones and ${surfaceReview.asset?.artDirectedGiPass?.floorBounceZones?.length ?? 0} floor + ${
          surfaceReview.asset?.artDirectedGiPass?.wallBounceZones?.length ?? 0
        } wall art-directed bounce zones. It also has a ${surfaceReview.asset?.cyclesAoBakePass?.engine ?? "Cycles"} ${
          surfaceReview.asset?.cyclesAoBakePass?.bakeType ?? "AO"
        } probe from ${surfaceReview.asset?.cyclesAoBakePass?.blockerProxies?.length ?? 0} blocker proxies. It is still not a path-traced GI pass.`,
        nextAction: "Promote the AO probe into true baked AO/GI UV textures, then reduce runtime-only shadow overlays."
      },
      {
        gate: "asset pipeline",
        target: "assets are split, selectable, optimized, licensed, documented, and ready for catalog/runtime LOD",
        currentStatus: "blocked",
        evidence: `Current GLB kits are QA layers with reports, surface ORM sidecars (${surfaceReview.asset?.texturePackagingPass?.packageStatus ?? "missing"}), and furniture ORM sidecars (${furnitureReview.asset?.texturePackagingPass?.packageStatus ?? "missing"}). Furniture runtime KTX2 can be produced, but there is still no meshopt package, collider sidecar, LOD ladder, or catalog split metadata.`,
        nextAction: "Split kits into catalog-ready assets and add proxy, collider, KTX2/meshopt, release eligibility, and provenance records."
      },
      {
        gate: "PC assembly integration",
        target: "PC build is a believable deskterior sub-flow without overpowering room/furniture quality",
        currentStatus: "pass-for-qa",
        evidence: "38 assembly steps, 11 room setup steps, attachment/compatibility/fit checks, audio events, and saved payload are verified.",
        nextAction: "Upgrade PC part GLBs and cable routing once the room/furniture visual base is stronger."
      }
    ],
    weakestAreas: [
      {
        rank: 1,
        area: "foreground furniture silhouette",
        whyItBlocksCommercialQuality:
          "The sofa and coffee-table zone is closest to the camera. Bespoke rounded topology reduces the box-read, but it still needs human screenshot review against approved furniture references.",
        nextBlenderIteration:
          "Either refine the curved cushion/table meshes with stronger underside/contact shaping or move to a full high-poly sculpt, UV unwrap, and decimated runtime proxy."
      },
      {
        rank: 2,
        area: "lighting bake and wall softness",
        whyItBlocksCommercialQuality:
          "Glare is measured and reduced, authored surface contact/bounce zones exist, a Cycles AO probe exists, and wall reveal lines are softer, but the scene still lacks a path-traced global illumination texture pass.",
        nextBlenderIteration:
          "Promote the Cycles AO probe and hand-authored bounce atlas into true AO/GI UV atlases, keep wall guide lines below grid visibility, rebalance emissive practicals, and keep clipped highlight ratio under the QA threshold."
      },
      {
        rank: 3,
        area: "surface material depth",
        whyItBlocksCommercialQuality:
          "Floor/wall and furniture normal/roughness/AO/ORM helper maps exist now, but they are procedural package evidence and not yet real UV-unwrapped commercial texture bakes.",
        nextBlenderIteration:
          "Promote the ORM sidecars into art-directed UV bakes, keep KTX2 transcode checks in CI, and compare them against high-quality room-pack references."
      },
      {
        rank: 4,
        area: "runtime asset packaging",
        whyItBlocksCommercialQuality:
          "A single dense kit is acceptable for QA, but a product editor needs selectable assets, collider metadata, LODs, KTX2, meshopt, and provenance.",
        nextBlenderIteration:
          "Split furniture/surface/detail kits into catalog-sized runtime packages with proxy GLBs, colliders, release gates, and source metadata."
      },
      {
        rank: 5,
        area: "reference-driven iteration evidence",
        whyItBlocksCommercialQuality:
          "Commercial quality cannot be claimed from a screenshot alone; every visual pass needs a before/after board and gap ledger.",
        nextBlenderIteration:
          "Keep this contact sheet updated after each asset generation pass and promote only when visual blockers are closed."
      }
    ],
    nextIterationOrder: [
      "internal-browser visual review of foreground furniture curvature and next sculpt decision",
      "internal-browser visual review of the Cycles AO probe plus art-directed bounce atlas, then true path-traced GI bake for desk, sofa, shelf, and media zones",
      "surface/furniture final UV bake and KTX2 freshness checks from the packed ORM sidecars",
      "kit splitting and runtime packaging metadata",
      "PC part model upgrade and cable detail pass"
    ]
  };

  fs.mkdirSync(path.dirname(LEDGER_PATH), { recursive: true });
  fs.writeFileSync(LEDGER_PATH, `${JSON.stringify(ledger, null, 2)}\n`);
  await buildContactSheet(ledger);
  assertImage(CONTACT_SHEET_PATH, "Bruno room asset benchmark contact sheet");

  console.log(
    JSON.stringify(
      {
        ledger: relative(LEDGER_PATH),
        contactSheet: relative(CONTACT_SHEET_PATH),
        panelCount: ledger.panels.length,
        benchmarkGateCount: ledger.benchmarkGates.length,
        weakestAreaCount: ledger.weakestAreas.length,
        status: ledger.status
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
