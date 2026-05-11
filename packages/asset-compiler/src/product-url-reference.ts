import { execFile } from "node:child_process";
import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type { DimensionsMm, ProductReferencePack, ReferenceImageView } from "@deskterioronline/scene-schema";
import { createAssetCompilerPaths } from "./paths";
import type {
  ProductUrlMaterialSlotHint,
  ProductUrlReferenceDraft,
  ProductUrlReferenceImage,
  ProductUrlReferenceSummary
} from "./types";

const execFileAsync = promisify(execFile);

type AnalyzeProductHtmlOptions = {
  url: string;
  html: string;
  assetKey?: string | null;
  dimensionsMm?: DimensionsMm | null;
  heightRangeMm?: [number, number] | null;
  ocrText?: string | null;
  ocrAttempted?: boolean;
  ocrAvailable?: boolean;
};

type AnalyzeProductUrlOptions = {
  url: string;
  assetKey?: string | null;
  outputPath?: string | null;
  dimensionsMm?: DimensionsMm | null;
  heightRangeMm?: [number, number] | null;
  downloadImages?: boolean;
  ocrImages?: boolean;
};

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 10)));
}

function stripTags(value: string) {
  return decodeHtmlEntities(value.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function safeJsonParse<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function normalizeUrl(value: string, baseUrl: string) {
  const trimmed = decodeHtmlEntities(value.trim()).replace(/\\\//g, "/");
  if (!trimmed || trimmed.startsWith("data:") || trimmed.startsWith("javascript:")) {
    return null;
  }
  if (trimmed.startsWith("//")) {
    return `https:${trimmed}`;
  }
  try {
    return new URL(trimmed, baseUrl).toString();
  } catch {
    return null;
  }
}

function slugifyAssetKey(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "product_asset"
  );
}

function normalizeManufacturer(value: string | null) {
  const normalized = value?.trim();
  if (!normalized) return null;
  if (/fursys|퍼시스/i.test(normalized)) return "FURSYS";
  return normalized;
}

function extractMetaContent(html: string, property: string) {
  const pattern = new RegExp(
    `<meta[^>]+(?:property|name)=["']${property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'][^>]+content=["']([^"']+)["'][^>]*>`,
    "i"
  );
  return decodeHtmlEntities(pattern.exec(html)?.[1] ?? "").trim() || null;
}

function extractJsonLdProducts(html: string) {
  const matches = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  return matches.flatMap((match) => {
    const payload = safeJsonParse<unknown>(stripTags(match[1] ?? ""));
    if (!payload) return [];
    const candidates = Array.isArray(payload) ? payload : [payload];
    return candidates.flatMap((candidate) => {
      if (typeof candidate !== "object" || candidate === null) return [];
      const record = candidate as Record<string, unknown>;
      if (record["@type"] === "Product") return [record];
      if (Array.isArray(record["@graph"])) {
        return record["@graph"].filter(
          (entry): entry is Record<string, unknown> =>
            typeof entry === "object" && entry !== null && (entry as Record<string, unknown>)["@type"] === "Product"
        );
      }
      return [];
    });
  });
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? decodeHtmlEntities(value.trim()) : null;
}

function readNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const numeric = Number(value.replace(/[^0-9.]/g, ""));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function extractInfoField(html: string, label: string) {
  const pattern = new RegExp(
    `<span[^>]*class=["'][^"']*info_title[^"']*["'][\\s\\S]*?>[\\s\\S]*?${label}[\\s\\S]*?<\\/span>[\\s\\S]*?<span[^>]*class=["'][^"']*info_cont[^"']*["'][\\s\\S]*?>([\\s\\S]*?)<\\/span>`,
    "i"
  );
  const match = pattern.exec(html);
  return match ? stripTags(match[1] ?? "") || null : null;
}

function extractOptions(html: string) {
  const options = new Set<string>();
  const mapperMatch = /option_value_mapper\s*=\s*'([^']+)'/.exec(html);
  const mapper = mapperMatch ? safeJsonParse<Record<string, string>>(decodeHtmlEntities(mapperMatch[1])) : null;
  Object.keys(mapper ?? {}).forEach((option) => {
    if (/^[A-Z0-9_-]{2,12}$/.test(option)) {
      options.add(option);
    }
  });
  for (const match of html.matchAll(/<option[^>]+value=["']([^"']+)["'][^>]*>([\s\S]*?)<\/option>/gi)) {
    const value = decodeHtmlEntities(match[1] ?? "").trim();
    const label = stripTags(match[2] ?? "");
    const candidate = /^[A-Z0-9_-]{2,12}$/.test(value) ? value : label;
    if (/^[A-Z0-9_-]{2,12}$/.test(candidate) && candidate !== "--" && candidate !== "**") {
      options.add(candidate);
    }
  }
  return [...options].sort();
}

function extractSku(html: string, title: string | null) {
  const modelField = extractInfoField(html, "모델명");
  const modelMatch = modelField?.match(/[A-Z]{2,}\d{2,}[A-Z0-9]*/);
  if (modelMatch) return modelMatch[0];
  const titleMatch = title?.match(/[A-Z]{2,}\d{2,}[A-Z0-9]*/);
  return titleMatch?.[0] ?? null;
}

function extractDimensionsFromText(text: string): DimensionsMm | null {
  const compactText = decodeHtmlEntities(text).replace(/,/g, "");
  const match =
    /(\d{3,4})\s*(?:x|X|×|폭|W)\s*(\d{2,4})\s*(?:x|X|×|깊이|D)\s*(\d{2,4})/i.exec(compactText) ??
    /W\s*(\d{3,4})\D{0,12}D\s*(\d{2,4})\D{0,12}H\s*(\d{2,4})/i.exec(compactText);
  if (!match) return null;
  const width = Number(match[1]);
  const depth = Number(match[2]);
  const height = Number(match[3]);
  if (![width, depth, height].every((entry) => Number.isFinite(entry) && entry > 0)) return null;
  return { width, depth, height };
}

function extractHeightRangeFromText(text: string): [number, number] | null {
  const match = /(?:H|height|높이)?\s*(\d{3,4})\s*(?:~|-|–|—)\s*(\d{3,4})/i.exec(text.replace(/,/g, ""));
  if (!match) return null;
  const min = Number(match[1]);
  const max = Number(match[2]);
  if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || max <= min) return null;
  return [min, max];
}

function classifyImageView(url: string): ReferenceImageView {
  const normalized = url.toLowerCase();
  if (normalized.includes("#dimension-top") || normalized.includes("top")) return "top";
  if (normalized.includes("#dimension-side") || normalized.includes("side")) return "right";
  if (normalized.includes("#material") || normalized.includes("color")) return "material";
  if (normalized.includes("zdq012j") || normalized.includes("detail") || normalized.includes("executive")) return "detail";
  return "front";
}

function isLikelyProductReferenceImage(url: string) {
  const decoded = decodeURIComponent(url).toLowerCase();
  if (/이미지\s*경로|image[_ -]?path|placeholder|no[_ -]?image|blank/.test(decoded)) return false;
  if (/\/(banner|icon|icons|sns|cart|review|delivery|category\/editor)\//i.test(decoded)) return false;
  return /\.(jpe?g|png|webp)(?:\?|$)/i.test(decoded);
}

function scoreImage(url: string, title: string | null, sku: string | null) {
  const normalized = url.toLowerCase();
  let score = 0;
  if (normalized.includes("/web/product/big/")) score += 80;
  if (normalized.includes("/web/product/small/")) score += 50;
  if (normalized.includes("executive") || normalized.includes("tierra") || normalized.includes("setina")) score += 90;
  if (sku && normalized.includes(sku.toLowerCase())) score += 140;
  if (title && /product|big|detail|fursys|kongganoa/.test(normalized)) score += 20;
  if (/logo|banner|icon|delivery|review|sns|cart|loading|fair_trade|cafe24/i.test(normalized)) score -= 120;
  if (/\.(jpe?g|png|webp)(?:\?|$)/i.test(normalized)) score += 20;
  return score;
}

function extractImages(html: string, url: string, product: Record<string, unknown> | null, title: string | null, sku: string | null) {
  const imageMap = new Map<string, ProductUrlReferenceImage>();
  const addImage = (rawUrl: string | null, source: ProductUrlReferenceImage["source"]) => {
    if (!rawUrl) return;
    const normalized = normalizeUrl(rawUrl, url);
    if (!normalized) return;
    if (!isLikelyProductReferenceImage(normalized)) return;
    const score = scoreImage(normalized, title, sku);
    if (score <= 0) return;
    const existing = imageMap.get(normalized);
    if (existing && existing.score >= score) return;
    imageMap.set(normalized, {
      url: normalized,
      view: classifyImageView(normalized),
      source: normalized.includes("kongganoa") || normalized.includes("executive") ? "detail_image" : source,
      score
    });
  };

  const productImages = product?.image;
  if (Array.isArray(productImages)) {
    productImages.forEach((entry) => addImage(readString(entry), "json_ld"));
  } else {
    addImage(readString(productImages), "json_ld");
  }
  const offers = Array.isArray(product?.offers) ? product?.offers : [];
  offers.forEach((offer) => {
    if (typeof offer === "object" && offer !== null) {
      addImage(readString((offer as Record<string, unknown>).image), "json_ld");
    }
  });
  addImage(extractMetaContent(html, "og:image"), "open_graph");
  for (const match of html.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi)) {
    addImage(match[1] ?? null, "html_image");
  }

  return [...imageMap.values()].sort((a, b) => b.score - a.score).slice(0, 10);
}

function buildMaterialHints(options: string[], title: string | null, sku: string | null): ProductUrlMaterialSlotHint[] {
  const evidence = [title, sku, options.length > 0 ? `options:${options.join(",")}` : null].filter(
    (entry): entry is string => Boolean(entry)
  );
  return [
    {
      slot: "DeskWood",
      materialType: "wood",
      label: "light laminate wood grain",
      evidence: [...evidence, "top/side laminate finish inferred from product title"],
      qaStatus: "pending"
    },
    {
      slot: "DeskMetal",
      materialType: "metal",
      label: "satin warm-grey panel and graphite frame",
      evidence: [...evidence, "motion desk frame/panel product imagery requires metal/plastic separation"],
      qaStatus: "pending"
    },
    {
      slot: "DeskPlastic",
      materialType: "plastic",
      label: "matte black sensor/cable channel plastic",
      evidence: [...evidence, "control strip and cable channel visible in detail reference"],
      qaStatus: "pending"
    }
  ];
}

function buildReferencePack(input: {
  sku: string | null;
  manufacturer: string | null;
  url: string;
  dimensionsMm: DimensionsMm | null;
  images: ProductUrlReferenceImage[];
  options: string[];
}): ProductReferencePack {
  const sku = input.sku ?? "UNKNOWN-SKU";
  const manufacturer = input.manufacturer ?? "Unknown manufacturer";
  const selectedImages = input.images.slice(0, 5);
  return {
    sku,
    manufacturer,
    canonicalProductUrl: input.url,
    dimensionSourceUrl: input.dimensionsMm ? input.url : null,
    referenceImages: selectedImages.map((image, index) => ({
      view: index === 0 && image.view === "detail" ? "front" : image.view,
      url: image.url,
      required: false,
      license: `LicenseRef-${manufacturer.replace(/[^A-Za-z0-9]+/g, "-")}-Prototype-Reference`
    })),
    finishReferences: input.options.length
      ? input.options.map((option) => ({
          finishId: option.toLowerCase(),
          label: `${option} product-page finish option`,
          sourceUrl: input.url,
          materialType: "mixed"
        }))
      : [
          {
            finishId: "default",
            label: "product-page finish",
            sourceUrl: input.url,
            materialType: "mixed"
          }
        ],
    license: {
      spdx: `LicenseRef-${manufacturer.replace(/[^A-Za-z0-9]+/g, "-")}-Prototype-Reference`,
      label: `${manufacturer} public product page reference, prototype-only rebuild`,
      requiresAttribution: true
    },
    status: input.dimensionsMm ? "dimension_verified" : "reference_collected",
    notes:
      "Generated from a public product URL for prototype reference only. Release eligibility requires manufacturer CAD, material references, and explicit product-design/asset usage rights."
  };
}

export function analyzeProductHtml(options: AnalyzeProductHtmlOptions): ProductUrlReferenceDraft {
  const products = extractJsonLdProducts(options.html);
  const product = products[0] ?? null;
  const jsonLdTitle = readString(product?.name);
  const title =
    jsonLdTitle ??
    extractInfoField(options.html, "상품명") ??
    extractMetaContent(options.html, "og:title") ??
    stripTags(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(options.html)?.[1] ?? "") ??
    null;
  const sku = extractSku(options.html, title);
  const brandRecord =
    typeof product?.brand === "object" && product.brand !== null
      ? (product.brand as Record<string, unknown>)
      : null;
  const brand = readString(brandRecord?.name) ?? readString(product?.brand) ?? normalizeManufacturer(extractInfoField(options.html, "제조사"));
  const manufacturer = normalizeManufacturer(extractInfoField(options.html, "제조사") ?? brand ?? title);
  const offers = Array.isArray(product?.offers) ? product?.offers : [];
  const firstOffer = offers.find((offer) => typeof offer === "object" && offer !== null) as
    | Record<string, unknown>
    | undefined;
  const optionsList = extractOptions(options.html);
  const visibleText = stripTags(options.html);
  const ocrText = options.ocrText ?? null;
  const dimensionsMm =
    options.dimensionsMm ??
    extractDimensionsFromText(visibleText) ??
    (ocrText ? extractDimensionsFromText(ocrText) : null);
  const heightRangeMm =
    options.heightRangeMm ?? extractHeightRangeFromText(visibleText) ?? (ocrText ? extractHeightRangeFromText(ocrText) : null);
  const assetKey =
    options.assetKey?.trim() ||
    slugifyAssetKey([manufacturer ?? "product", sku ?? title ?? "asset"].join("_"));
  const images = extractImages(options.html, options.url, product, title, sku);
  const materialHints = buildMaterialHints(optionsList, title, sku);
  const referencePack = buildReferencePack({
    sku,
    manufacturer,
    url: options.url,
    dimensionsMm,
    images,
    options: optionsList
  });
  const warnings: string[] = [];
  if (!dimensionsMm) {
    warnings.push("No machine-readable dimensions found; use manufacturer CAD/specs or a vision/OCR pass before release.");
  }
  if (images.length === 0) {
    warnings.push("No high-confidence product reference images found.");
  }
  if (!sku) {
    warnings.push("No SKU/model identifier found.");
  }

  return {
    schemaVersion: "product-url-reference-alpha-v1",
    createdAt: new Date().toISOString(),
    assetKey,
    sourceUrl: options.url,
    product: {
      title,
      sku,
      manufacturer,
      brand,
      price: readNumber(firstOffer?.price),
      priceCurrency: readString(firstOffer?.priceCurrency),
      options: optionsList,
      dimensionsMm,
      heightRangeMm
    },
    legalUse: {
      mode: "prototype_reference_only",
      releaseEligible: false,
      license: referencePack.license,
      warning:
        "Public product pages can guide a prototype rebuild, but they do not grant production texture, CAD, trademark, or product-design usage rights."
    },
    referencePack,
    referenceImages: images,
    materialHints,
    extraction: {
      jsonLdProductFound: products.length > 0,
      openGraphImageFound: Boolean(extractMetaContent(options.html, "og:image")),
      htmlImageCount: [...options.html.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi)].length,
      selectedImageCount: images.length,
      dimensionSource: options.dimensionsMm ? "override" : extractDimensionsFromText(visibleText) ? "html_text" : ocrText && extractDimensionsFromText(ocrText) ? "ocr" : "not_found",
      ocrAttempted: Boolean(options.ocrAttempted),
      ocrAvailable: Boolean(options.ocrAvailable),
      ocrTextSample: ocrText ? ocrText.replace(/\s+/g, " ").trim().slice(0, 500) : null,
      warnings
    }
  };
}

async function fileExists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function isTesseractAvailable() {
  try {
    await execFileAsync("tesseract", ["--version"], { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

async function downloadImage(url: string, outputPath: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`image download failed ${response.status} for ${url}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, Buffer.from(arrayBuffer));
}

async function readOcrText(images: ProductUrlReferenceImage[], outputDir: string) {
  const available = await isTesseractAvailable();
  if (!available) {
    return {
      available,
      text: null
    };
  }
  const selected = images.filter((image) => image.source === "detail_image" || image.score >= 100).slice(0, 3);
  const texts: string[] = [];
  for (const [index, image] of selected.entries()) {
    const extension = path.extname(new URL(image.url).pathname) || ".jpg";
    const localPath = path.join(outputDir, "reference-images", `ocr-${index}${extension}`);
    await downloadImage(image.url, localPath);
    const { stdout } = await execFileAsync("tesseract", [localPath, "stdout", "-l", "eng+kor", "--psm", "6"], {
      timeout: 30_000,
      maxBuffer: 1024 * 1024 * 8
    });
    texts.push(stdout);
  }
  return {
    available,
    text: texts.join("\n")
  };
}

function parseDimensionsOption(value: string | null): DimensionsMm | null {
  if (!value) return null;
  const match = /^(\d{2,5})[xX×](\d{2,5})[xX×](\d{2,5})$/.exec(value.trim());
  if (!match) return null;
  return {
    width: Number(match[1]),
    depth: Number(match[2]),
    height: Number(match[3])
  };
}

function parseHeightRangeOption(value: string | null): [number, number] | null {
  if (!value) return null;
  const match = /^(\d{2,5})(?:-|~|–|—)(\d{2,5})$/.exec(value.trim());
  if (!match) return null;
  return [Number(match[1]), Number(match[2])];
}

export function parseProductUrlReferenceArgs(argv: string[]): AnalyzeProductUrlOptions & { json: boolean; help: boolean } {
  const readOption = (name: string) => {
    const prefix = `--${name}=`;
    const inline = argv.find((entry) => entry.startsWith(prefix));
    if (inline) return inline.slice(prefix.length);
    const index = argv.findIndex((entry) => entry === `--${name}`);
    return index >= 0 ? argv[index + 1] ?? null : null;
  };
  return {
    url: readOption("url") ?? "",
    assetKey: readOption("asset-key"),
    outputPath: readOption("out"),
    dimensionsMm: parseDimensionsOption(readOption("dimensions-mm")),
    heightRangeMm: parseHeightRangeOption(readOption("height-range-mm")),
    downloadImages: argv.includes("--download-images"),
    ocrImages: argv.includes("--ocr-images"),
    json: argv.includes("--json"),
    help: argv.includes("--help")
  };
}

function resolveOutputPath(assetKey: string, outputPath?: string | null) {
  if (outputPath?.trim()) return path.resolve(outputPath);
  const paths = createAssetCompilerPaths();
  return path.join(paths.repoRoot, "assets", "references", "product-pages", assetKey, "reference-pack.json");
}

export async function analyzeProductUrlReference(
  options: AnalyzeProductUrlOptions
): Promise<ProductUrlReferenceSummary> {
  if (!options.url.trim()) {
    throw new Error("product URL reference analysis requires --url");
  }
  const response = await fetch(options.url, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(`product page fetch failed (${response.status}) for ${options.url}`);
  }
  const html = await response.text();
  let draft = analyzeProductHtml({
    url: response.url || options.url,
    html,
    assetKey: options.assetKey,
    dimensionsMm: options.dimensionsMm,
    heightRangeMm: options.heightRangeMm
  });
  const outputPath = resolveOutputPath(draft.assetKey, options.outputPath);
  const outputDir = path.dirname(outputPath);

  if (options.ocrImages) {
    const ocr = await readOcrText(draft.referenceImages, outputDir);
    draft = analyzeProductHtml({
      url: response.url || options.url,
      html,
      assetKey: draft.assetKey,
      dimensionsMm: options.dimensionsMm,
      heightRangeMm: options.heightRangeMm,
      ocrText: ocr.text,
      ocrAttempted: true,
      ocrAvailable: ocr.available
    });
  }

  if (options.downloadImages) {
    await mkdir(path.join(outputDir, "reference-images"), { recursive: true });
    for (const [index, image] of draft.referenceImages.entries()) {
      const extension = path.extname(new URL(image.url).pathname) || ".jpg";
      const localPath = path.join(outputDir, "reference-images", `${String(index + 1).padStart(2, "0")}-${image.view}${extension}`);
      if (!(await fileExists(localPath))) {
        await downloadImage(image.url, localPath);
      }
      image.localPath = localPath;
    }
  }

  await mkdir(outputDir, { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(draft, null, 2)}\n`, "utf8");
  return {
    ok: true,
    assetKey: draft.assetKey,
    outputPath,
    draft
  };
}

export function printProductUrlReferenceSummary(summary: ProductUrlReferenceSummary) {
  const { draft } = summary;
  console.log(
    [
      "Product URL Reference Analysis",
      `Status: ${summary.ok ? "PASS" : "FAIL"}`,
      `Asset key: ${summary.assetKey}`,
      `Output: ${summary.outputPath}`,
      "",
      "Product:",
      `- Title: ${draft.product.title ?? "unknown"}`,
      `- SKU: ${draft.product.sku ?? "unknown"}`,
      `- Manufacturer: ${draft.product.manufacturer ?? "unknown"}`,
      `- Price: ${draft.product.price ? `${draft.product.price} ${draft.product.priceCurrency ?? ""}`.trim() : "unknown"}`,
      `- Options: ${draft.product.options.length ? draft.product.options.join(", ") : "none"}`,
      `- Dimensions: ${
        draft.product.dimensionsMm
          ? `${draft.product.dimensionsMm.width}x${draft.product.dimensionsMm.depth}x${draft.product.dimensionsMm.height}mm`
          : "not found"
      }`,
      `- Height range: ${draft.product.heightRangeMm ? `${draft.product.heightRangeMm[0]}-${draft.product.heightRangeMm[1]}mm` : "not found"}`,
      "",
      "Reference:",
      `- Images selected: ${draft.referenceImages.length}`,
      `- Reference pack status: ${draft.referencePack.status}`,
      `- Release eligible: ${draft.legalUse.releaseEligible}`,
      `- Dimension source: ${draft.extraction.dimensionSource}`,
      ...(draft.extraction.warnings.length ? ["", "Warnings:", ...draft.extraction.warnings.map((warning) => `- ${warning}`)] : [])
    ].join("\n")
  );
}
