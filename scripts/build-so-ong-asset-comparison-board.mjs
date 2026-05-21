#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const repoRoot = process.cwd();
const require = createRequire(join(repoRoot, "apps/web/package.json"));
const sharp = require("sharp");
const sceneRoot = join(repoRoot, "assets/references/video-scenes/so-ong-space-2026-05-desk-setup");
const reportPath = join(sceneRoot, "meshy-generation-report.json");
const referenceRoot = join(sceneRoot, "meshy-reference-images");
const renderRoot = join(sceneRoot, "asset-comparison-renders");
const outputPath = join(sceneRoot, "so-ong-meshy-asset-comparison-board.png");

const report = JSON.parse(readFileSync(reportPath, "utf8"));
const rowWidth = 1420;
const rowHeight = 360;
const headerHeight = 96;
const margin = 28;
const labelWidth = 360;
const imageWidth = 460;
const imageHeight = 280;
const gap = 30;
const boardHeight = headerHeight + report.items.length * rowHeight + margin;

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function labelSvg(item, index, x, y) {
  const lines = [
    `${String(index + 1).padStart(2, "0")} · ${item.label}`,
    item.catalogItemId.replace("p2s_video_so_ong_", ""),
    `source: ${item.referenceSource}`,
    `status: ${item.finalizerStatus}`
  ];
  return Buffer.from(`
    <svg width="${labelWidth}" height="${imageHeight}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" rx="18" fill="#f5f3ee"/>
      <text x="20" y="38" font-family="Arial, sans-serif" font-size="19" font-weight="700" fill="#171411">${escapeXml(lines[0])}</text>
      <text x="20" y="78" font-family="Arial, sans-serif" font-size="15" fill="#4f4941">${escapeXml(lines[1])}</text>
      <text x="20" y="116" font-family="Arial, sans-serif" font-size="14" fill="#756c61">${escapeXml(lines[2])}</text>
      <text x="20" y="148" font-family="Arial, sans-serif" font-size="14" fill="#756c61">${escapeXml(lines[3])}</text>
      <text x="20" y="228" font-family="Arial, sans-serif" font-size="12" fill="#92887c">left: reference image used</text>
      <text x="20" y="252" font-family="Arial, sans-serif" font-size="12" fill="#92887c">right: current generated GLB render</text>
    </svg>
  `);
}

function headerSvg() {
  return Buffer.from(`
    <svg width="${rowWidth}" height="${headerHeight}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#171411"/>
      <text x="${margin}" y="42" font-family="Arial, sans-serif" font-size="26" font-weight="800" fill="#fff">So Ong visible products · Meshy input vs generated asset</text>
      <text x="${margin}" y="72" font-family="Arial, sans-serif" font-size="15" fill="#c9c0b4">17 visible products only. Each row shows the image sent/selected for generation and the current repaired GLB render.</text>
      <text x="${margin + labelWidth + gap + 145}" y="72" font-family="Arial, sans-serif" font-size="13" font-weight="700" fill="#efe8dd">REFERENCE IMAGE</text>
      <text x="${margin + labelWidth + gap + imageWidth + gap + 150}" y="72" font-family="Arial, sans-serif" font-size="13" font-weight="700" fill="#efe8dd">GENERATED ASSET</text>
    </svg>
  `);
}

async function imageComposite(path, x, y) {
  const image = await sharp(path)
    .resize(imageWidth, imageHeight, { fit: "contain", background: "#ffffff" })
    .png()
    .toBuffer();
  return { input: image, left: x, top: y };
}

const composites = [{ input: headerSvg(), left: 0, top: 0 }];

for (const [index, item] of report.items.entries()) {
  const y = headerHeight + index * rowHeight + margin;
  const assetId = item.catalogItemId;
  const referencePath = join(referenceRoot, `${assetId}.png`);
  const renderPath = join(renderRoot, `${assetId}.png`);
  if (!existsSync(referencePath)) {
    throw new Error(`Missing reference image for ${assetId}: ${referencePath}`);
  }
  if (!existsSync(renderPath)) {
    throw new Error(`Missing generated asset render for ${assetId}: ${renderPath}`);
  }
  composites.push({ input: labelSvg(item, index), left: margin, top: y });
  composites.push(await imageComposite(referencePath, margin + labelWidth + gap, y));
  composites.push(await imageComposite(renderPath, margin + labelWidth + gap + imageWidth + gap, y));
}

mkdirSync(dirname(outputPath), { recursive: true });
await sharp({
  create: {
    width: rowWidth,
    height: boardHeight,
    channels: 4,
    background: "#eeeae2"
  }
})
  .composite(composites)
  .png()
  .toFile(outputPath);

console.log(outputPath);
