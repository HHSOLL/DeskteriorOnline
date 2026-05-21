import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_CATALOG } from "../src/lib/builder/catalog";
import {
  buildPlacedAssetZoneSummary,
  buildReplacementZoneSummary,
  buildReplacementCatalogCandidates,
  inferReplacementRoomZone
} from "../src/lib/builder/replacement-candidates";

function readSource(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

const selectedChair = DEFAULT_CATALOG.find((item) => item.id === "chair");
assert(selectedChair, "default chair catalog item must exist");

const chairCandidates = buildReplacementCatalogCandidates({
  items: DEFAULT_CATALOG,
  selectedAsset: {
    assetId: selectedChair.assetId,
    catalogItemId: selectedChair.id,
    anchorType: "floor",
    product: {
      dimensionsMm: selectedChair.dimensionsMm
    }
  },
  selectedCatalogItem: selectedChair
});

assert(chairCandidates.length > 0, "chair replacement candidates must be available");
assert(
  !chairCandidates.some((candidate) => candidate.item.id === selectedChair.id),
  "replacement candidates must exclude the selected catalog item"
);
assert(
  !chairCandidates.some((candidate) => candidate.item.assetId === selectedChair.assetId),
  "replacement candidates must exclude the selected runtime asset id"
);

const firstChairCandidate = chairCandidates[0];
assert(
  /chair|체어|의자|stool|스툴/i.test(firstChairCandidate.item.label),
  `chair-like candidates should outrank broad seating replacements, got ${firstChairCandidate.item.label}`
);
assert(
  Boolean(firstChairCandidate.item.dimensionsMm) || firstChairCandidate.item.scaleLocked,
  "top chair replacement should prefer candidates with real-scale catalog metadata"
);
assert.equal(firstChairCandidate.matchLabel, "추천", "top same-family candidate should be marked recommended");
assert.equal(
  firstChairCandidate.previewFamily,
  "chair",
  "top chair replacement should expose a chair silhouette family"
);
assert(
  firstChairCandidate.previewScale.width > 0 &&
    firstChairCandidate.previewScale.width <= 1 &&
    firstChairCandidate.previewScale.height > 0 &&
    firstChairCandidate.previewScale.height <= 1,
  "replacement candidate preview scale should stay normalized for card rendering"
);
assert(
  firstChairCandidate.detailLabel.includes("바닥"),
  "candidate detail must expose the placement anchor"
);
assert(
  firstChairCandidate.roomZone.label.length > 0,
  "replacement candidates must expose a room-zone label for cluster-aware customization"
);
const selectedChairRoomZone = inferReplacementRoomZone(selectedChair);
const sameZoneChairCandidates = chairCandidates.filter(
  (candidate) =>
    candidate.roomZone.id === selectedChairRoomZone.id ||
    candidate.roomZone.id === "flex" ||
    selectedChairRoomZone.id === "flex"
);
const chairZoneSummary = buildReplacementZoneSummary(chairCandidates, selectedChairRoomZone);
assert(
  sameZoneChairCandidates.length > 0 && sameZoneChairCandidates.length < chairCandidates.length,
  "mixed-zone seating replacements should expose a narrower same-zone subset and a broader all-candidates set"
);
assert(
  chairZoneSummary.length >= 2,
  "replacement zone summary should expose more than one customization zone when mixed-zone candidates exist"
);
assert.equal(
  chairZoneSummary[0].zone.id,
  selectedChairRoomZone.id,
  "replacement zone summary should keep the selected room zone first"
);
assert.equal(
  chairZoneSummary.reduce((total, summary) => total + summary.count, 0),
  chairCandidates.length,
  "replacement zone summary counts should cover all visible replacement candidates"
);
assert(
  chairZoneSummary.every((summary) => summary.topCandidateLabel.length > 0),
  "replacement zone summary should expose a top candidate label for each zone action"
);
assert(
  chairZoneSummary.every((summary) => summary.topCandidateItemId.length > 0),
  "replacement zone summary should expose a top candidate id for direct zone application"
);
assert(
  chairZoneSummary.every((summary) => {
    const topCandidate = chairCandidates.find((candidate) => candidate.item.id === summary.topCandidateItemId);
    return topCandidate?.item.label === summary.topCandidateLabel;
  }),
  "replacement zone summary top candidate id and label should refer to the same catalog item"
);

const sofaIndex = chairCandidates.findIndex((candidate) => /sofa|소파/i.test(candidate.item.label));
if (sofaIndex >= 0) {
  assert(
    sofaIndex > 0,
    "large sofa candidates should not outrank same-family chair replacements for a selected chair"
  );
}

const selectedDeskSurfaceItem = DEFAULT_CATALOG.find((item) => item.id === "p2s_keyboard_75_white");
assert(selectedDeskSurfaceItem, "desk-surface catalog item must exist");

const surfaceCandidates = buildReplacementCatalogCandidates({
  items: DEFAULT_CATALOG,
  selectedAsset: {
    assetId: selectedDeskSurfaceItem.assetId,
    catalogItemId: selectedDeskSurfaceItem.id,
    anchorType: "desk_surface",
    product: {
      dimensionsMm: selectedDeskSurfaceItem.dimensionsMm
    }
  },
  selectedCatalogItem: selectedDeskSurfaceItem
});

assert(surfaceCandidates.length > 0, "desk-surface replacement candidates must be available");
assert(
  surfaceCandidates[0].detailLabel.includes("데스크 표면"),
  "desk-surface replacements should prefer candidates that preserve the surface anchor"
);
assert(
  surfaceCandidates.every((candidate) => candidate.previewFamily && candidate.dimensionFitLabel),
  "replacement cards must include preview family and fit labels"
);
assert.equal(
  inferReplacementRoomZone(selectedDeskSurfaceItem).id,
  "workstation",
  "desk-surface accessories should resolve to the workstation zone"
);
assert.equal(
  surfaceCandidates[0].roomZone.id,
  "workstation",
  "desk-surface replacements should prefer candidates in the same workstation zone"
);
const placedZoneSummary = buildPlacedAssetZoneSummary([
  {
    id: "desk-asset",
    label: "Creator Desk",
    zone: inferReplacementRoomZone(DEFAULT_CATALOG.find((item) => item.id === "p2s_desk_walnut_160") ?? null),
    isSelected: false,
    supportDependentCount: 2,
    replacementItemId: "p2s_desk_white_compact_120",
    replacementLabel: "P2S 화이트 컴팩트 데스크",
    replacementMatchPercent: 88,
    replacementPreviewFamily: "desk",
    replacementPreviewScale: { width: 0.82, depth: 0.68, height: 0.62 }
  },
  {
    id: "keyboard-asset",
    label: "White Keyboard",
    zone: inferReplacementRoomZone(selectedDeskSurfaceItem),
    isSelected: true,
    replacementItemId: "p2s_keyboard_tkl_graphite",
    replacementLabel: "P2S TKL 그래파이트 키보드",
    replacementMatchPercent: 91,
    replacementPreviewFamily: "generic",
    replacementPreviewScale: { width: 0.42, depth: 0.28, height: 0.18 }
  },
  {
    id: "sofa-asset",
    label: "Low Sofa",
    zone: inferReplacementRoomZone(DEFAULT_CATALOG.find((item) => item.id === "sofa-03") ?? null),
    isSelected: false
  }
]);
assert(
  placedZoneSummary.length >= 2,
  "placed asset zone summary should group room assets into multiple customization zones"
);
assert.equal(
  placedZoneSummary[0].zone.id,
  "workstation",
  "placed asset zone summary should keep the selected asset zone first"
);
assert.equal(
  placedZoneSummary[0].topAssetId,
  "keyboard-asset",
  "selected zone summary should point to the currently selected asset when available"
);
assert.equal(
  placedZoneSummary[0].replaceableCount,
  2,
  "placed asset zone summary should count replaceable assets in the selected zone"
);
assert.equal(
  placedZoneSummary[0].topReplacementItemId,
  "p2s_keyboard_tkl_graphite",
  "selected zone summary should prefer the selected asset replacement candidate for quick zone application"
);
assert.equal(
  placedZoneSummary[0].topReplacementMatchPercent,
  91,
  "placed zone summary should expose the visible match score for the representative replacement"
);
assert.equal(
  placedZoneSummary[0].topReplacementPreviewFamily,
  "generic",
  "placed zone summary should preserve the representative replacement preview family for future live previews"
);
assert.deepEqual(
  placedZoneSummary[0].topReplacementPreviewScale,
  { width: 0.42, depth: 0.28, height: 0.18 },
  "placed zone summary should preserve the representative replacement preview scale for compact previews"
);
const placedCarrierZoneSummary = buildPlacedAssetZoneSummary([
  {
    id: "desk-asset",
    label: "Creator Desk",
    zone: inferReplacementRoomZone(DEFAULT_CATALOG.find((item) => item.id === "p2s_desk_walnut_160") ?? null),
    isSelected: true,
    supportDependentCount: 2,
    replacementItemId: "p2s_desk_white_compact_120",
    replacementLabel: "P2S 화이트 컴팩트 데스크",
    replacementMatchPercent: 88,
    replacementPreviewFamily: "desk",
    replacementPreviewScale: { width: 0.74, depth: 0.64, height: 0.58 }
  }
]);
assert.equal(
  placedCarrierZoneSummary[0].topSupportDependentCount,
  2,
  "placed zone summary should expose support cascade count for carrier replacements"
);
assert.deepEqual(
  placedCarrierZoneSummary[0].topReplacementPreviewScale,
  { width: 0.74, depth: 0.64, height: 0.58 },
  "placed zone summary should preserve carrier replacement preview scale"
);
assert.equal(
  placedZoneSummary.reduce((total, summary) => total + summary.count, 0),
  3,
  "placed asset zone summary counts should cover all placed assets"
);
const inspectorSource = readSource("src/components/editor/BuilderInspectorPanel.tsx");
const liveModelPreviewSource = readSource("src/components/editor/CatalogLiveModelPreview.tsx");
const meshyDecorCatalogItem = DEFAULT_CATALOG.find((item) => item.id === "p2s_meshy_pastel_mascot_stack");
assert(meshyDecorCatalogItem, "Meshy generated decor should be available for replacement/live-preview QA");
assert.match(
  meshyDecorCatalogItem.assetId,
  /^\/assets\/models\/p2s_meshy_pastel_mascot_stack\/p2s_meshy_pastel_mascot_stack\.glb$/,
  "Meshy generated decor should use the real generated GLB for live replacement previews"
);
assert.match(
  inspectorSource,
  /data-testid="selected-asset-room-zone"/,
  "inspector should expose the selected asset's inferred room zone"
);
assert.match(
  inspectorSource,
  /\{candidate\.roomZone\.label\}/,
  "replacement cards should show the candidate room zone"
);
assert.match(
  inspectorSource,
  /data-testid="asset-replacement-zone-filter"/,
  "inspector should expose a replacement zone filter for same-zone vs all candidates"
);
assert.match(
  inspectorSource,
  /data-testid=\{`asset-replacement-filter-\$\{filter\.id\}`\}/,
  "replacement zone filter buttons should have stable browser QA ids"
);
assert.match(
  inspectorSource,
  /visibleReplacementItems\.map/,
  "replacement grid should render the active filtered candidate set"
);
assert.match(
  inspectorSource,
  /data-testid="asset-replacement-zone-actions"/,
  "inspector should expose zone action rows for room-zone customization"
);
assert.match(
  inspectorSource,
  /data-testid=\{`asset-replacement-zone-action-\$\{summary\.zone\.id\}`\}/,
  "zone action rows should have stable browser QA ids"
);
assert.match(
  inspectorSource,
  /setReplacementZoneScope\(summary\.zone\.id\)/,
  "zone action rows should filter the replacement grid by candidate room zone"
);
assert.match(
  inspectorSource,
  /data-testid=\{`asset-replacement-zone-apply-\$\{summary\.zone\.id\}`\}/,
  "zone action rows should expose a stable apply button for the top candidate"
);
assert.match(
  inspectorSource,
  /onReplaceAsset\(selectedAsset\.id, topCandidate\.item\)/,
  "zone action apply should reuse the existing replacement path to preserve asset id and support anchor"
);
assert.match(
  inspectorSource,
  /data-testid="placed-zone-summary"/,
  "inspector should expose placed asset zone navigation in the room summary"
);
assert.match(
  inspectorSource,
  /data-testid=\{`placed-zone-summary-\$\{summary\.zone\.id\}`\}/,
  "placed asset zone rows should have stable browser QA ids"
);
assert.match(
  inspectorSource,
  /onSelectPlacedAsset\(summary\.topAssetId\)/,
  "placed asset zone rows should select a representative asset in that room zone"
);
assert.match(
  inspectorSource,
  /data-testid=\{`placed-zone-apply-\$\{summary\.zone\.id\}`\}/,
  "placed asset zone rows should expose a stable batch replacement QA id"
);
assert.match(
  inspectorSource,
  /onApplyPlacedZoneReplacements\(summary\.zone\.id\)/,
  "placed asset zone rows should call the zone-level replacement action"
);
assert.match(
  inspectorSource,
  /data-testid=\{`placed-zone-replacement-preview-\$\{summary\.zone\.id\}`\}/,
  "placed asset zone rows should show the representative replacement target before batch apply"
);
assert.match(
  inspectorSource,
  /summary\.topReplacementMatchPercent/,
  "placed asset zone rows should show the representative replacement match score"
);
assert.match(
  inspectorSource,
  /data-testid=\{`placed-zone-replacement-silhouette-\$\{summary\.zone\.id\}`\}/,
  "placed asset zone rows should render a compact representative replacement silhouette"
);
assert.match(
  inspectorSource,
  /function ReplacementIsometricPreview/,
  "replacement cards should use a dimension-aware isometric proxy instead of a flat fallback icon"
);
assert.match(
  inspectorSource,
  /data-preview-mode="isometric-proxy"/,
  "replacement isometric proxy should expose its preview mode for browser QA"
);
assert.match(
  inspectorSource,
  /testId=\{`asset-replacement-isometric-preview-\$\{item\.id\}`\}/,
  "replacement cards should expose stable isometric preview QA ids"
);
assert.match(
  inspectorSource,
  /testId=\{`placed-zone-replacement-isometric-\$\{summary\.zone\.id\}`\}/,
  "placed asset zone rows should expose stable compact isometric preview QA ids"
);
assert.match(
  inspectorSource,
  /rotateX\(62deg\) rotateZ\(-34deg\)/,
  "replacement isometric proxy should use a visible isometric floor transform"
);
assert.match(
  inspectorSource,
  /scale=\{candidate\.previewScale\}/,
  "replacement cards should drive the isometric proxy from normalized candidate dimensions"
);
assert.match(
  inspectorSource,
  /hasSpecificCatalogThumbnail\(item, thumbnail\)/,
  "replacement cards should only trust thumbnails that match the current catalog item"
);
assert.match(
  inspectorSource,
  /isCatalogLiveModelPreviewEligible\(item\)/,
  "replacement cards should upgrade eligible GLB/GLTF candidates to live model previews"
);
assert.match(
  inspectorSource,
  /testId=\{`asset-replacement-live-preview-\$\{item\.id\}`\}/,
  "replacement cards should expose stable live model preview QA ids"
);
assert.match(
  liveModelPreviewSource,
  /data-preview-mode="live-model"/,
  "live model preview should expose a browser QA mode"
);
assert.match(
  liveModelPreviewSource,
  /frameloop="demand"/,
  "live model preview should use a demand frame loop to avoid idle rendering cost"
);
assert.match(
  liveModelPreviewSource,
  /configureRuntimeAssetLoaders\(gl\)/,
  "live model preview should reuse runtime GLB loader configuration"
);
assert.match(
  liveModelPreviewSource,
  /__DESKTERIORONLINE_CATALOG_LIVE_MODEL_PREVIEWS__/,
  "live model preview should expose a browser-visible registry for real GLB render QA"
);
assert.match(
  liveModelPreviewSource,
  /source: "real-glb-live-preview"/,
  "live model preview registry should distinguish real GLB previews from proxy and placeholder previews"
);
assert.match(
  liveModelPreviewSource,
  /userData\.catalogLiveModelPreview/,
  "live model preview should stamp cloned GLB scenes with catalog preview provenance"
);
assert.match(
  liveModelPreviewSource,
  /meshCount/,
  "live model preview registry should expose mesh counts for generated asset QA"
);
assert.match(
  liveModelPreviewSource,
  /materialCount/,
  "live model preview registry should expose material counts for generated asset QA"
);
assert.match(
  liveModelPreviewSource,
  /getCatalogGenerationBadge\(item\)/,
  "live model preview registry should carry generated provider and review status"
);
assert.match(
  liveModelPreviewSource,
  /getDerivedStateFromError/,
  "live model preview should preserve fallback cards if GLB loading fails"
);
assert.match(
  inspectorSource,
  /summary\.topReplacementPreviewFamily/,
  "placed asset zone rows should consume the representative replacement preview family"
);
assert.match(
  inspectorSource,
  /summary\.topReplacementPreviewScale \?\? DEFAULT_REPLACEMENT_PREVIEW_SCALE/,
  "placed asset zone rows should drive compact isometric previews from representative replacement dimensions"
);
assert.match(
  inspectorSource,
  /data-testid=\{`placed-zone-support-cascade-\$\{summary\.zone\.id\}`\}/,
  "placed asset zone rows should expose support cascade QA ids for carrier replacements"
);
assert.match(
  inspectorSource,
  /summary\.topSupportDependentCount/,
  "placed asset zone rows should show when a parent replacement keeps dependent surface anchors"
);
const editorSource = readSource("src/app/(editor)/project/[id]/page.tsx");
assert.match(
  editorSource,
  /buildPlacedAssetZoneSummary/,
  "project editor should derive placed asset zone summaries from current scene assets"
);
assert.match(
  editorSource,
  /inferReplacementRoomZone\(catalogItem, asset\.assetId\)/,
  "project editor should infer placed asset zones from catalog metadata without scene schema changes"
);
assert.match(
  editorSource,
  /onSelectPlacedAsset=\{setSelectedAssetId\}/,
  "project editor should route placed zone clicks through the existing selection store"
);
assert.match(
  editorSource,
  /supportCarrierAssetIds/,
  "project editor should identify support-carrier assets before ordering batch zone replacement"
);
assert.match(
  editorSource,
  /supportDependentsByAssetId/,
  "project editor should map support dependents before cascade-aware batch replacement"
);
assert.match(
  editorSource,
  /canReplacementPreserveSupportCascade/,
  "project editor should preflight parent replacement candidates against dependent support anchors"
);
assert.match(
  editorSource,
  /doesProjectedSupportPreserveDependents\(plan\.asset\.id, projectedAssets\)/,
  "project editor should re-check support-carrier replacement plans against the projected batch scene"
);
assert.match(
  editorSource,
  /leftIsCarrier/,
  "zone replacement should order support-carrier parent updates after independent child replacements"
);
assert.match(
  editorSource,
  /supportDependentCount: supportDependentsByAssetId\.get\(asset\.id\)\?\.length/,
  "project editor should pass support cascade counts into placed zone summaries"
);
assert.match(
  editorSource,
  /replacementMatchPercent: replacementCandidate\?\.matchPercent/,
  "project editor should pass representative replacement match scores into placed zone summaries"
);
assert.match(
  editorSource,
  /replacementPreviewFamily: replacementCandidate\?\.previewFamily/,
  "project editor should pass representative replacement preview families into placed zone summaries"
);
assert.match(
  editorSource,
  /replacementPreviewScale: replacementCandidate\?\.previewScale/,
  "project editor should pass representative replacement preview scales into placed zone summaries"
);
assert.match(
  editorSource,
  /const applyPlacedZoneReplacements = useCallback/,
  "project editor should expose a zone-level replacement action"
);
assert.match(
  editorSource,
  /replaceSceneAssetWithCatalogItem\(plan\.asset, plan\.item\)/,
  "zone replacement should reuse the existing asset replacement update path"
);
assert.match(
  editorSource,
  /recordSnapshot\("존 추천 교체"\)/,
  "zone replacement should create one undo snapshot for the batch"
);
assert.match(
  editorSource,
  /onApplyPlacedZoneReplacements=\{applyPlacedZoneReplacements\}/,
  "project editor should wire the zone-level replacement action into the inspector"
);

console.log(
  JSON.stringify(
    {
      chairTopCandidate: firstChairCandidate.item.label,
      chairTopMatch: firstChairCandidate.matchPercent,
      chairSameZoneCount: sameZoneChairCandidates.length,
      chairAllCount: chairCandidates.length,
      chairZoneSummary,
      placedZoneSummary,
      surfaceTopCandidate: surfaceCandidates[0].item.label,
      surfaceTopMatch: surfaceCandidates[0].matchPercent
    },
    null,
    2
  )
);
