import { analyzeProductHtml } from "@deskterioronline/asset-compiler";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const fixtureHtml = `
  <html>
    <head>
      <title>퍼시스 세티나 ZDQ012J 사이드 모션데스크_라미네이트</title>
      <meta property="og:title" content="퍼시스 SETINA 세티나 ZDQ012J 사이드 중역용 모션데스크(라미네이트)" />
      <meta property="og:image" content="https://fursys-store.com/web/product/big/202104/523caf072732e508b8c8507f6bc2fa2d.jpg" />
      <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "Product",
          "name": "퍼시스 SETINA 세티나 ZDQ012J 사이드 중역용 모션데스크(라미네이트)",
          "image": ["https://fursys-store.com/web/product/big/202104/523caf072732e508b8c8507f6bc2fa2d.jpg"],
          "brand": {"@type": "Brand", "name": "퍼시스스토어"},
          "offers": [
            {"name": "WP", "price": 2512400, "priceCurrency": "KRW", "image": "https://fursys-store.com/web/product/big/202104/523caf072732e508b8c8507f6bc2fa2d.jpg"}
          ]
        }
      </script>
    </head>
    <body>
      <span class="info_title"><span>상품명</span></span>
      <span class="info_cont"><span>퍼시스 SETINA 세티나 ZDQ012J 사이드 중역용 모션데스크(라미네이트)</span></span>
      <span class="info_title"><span>모델명</span></span>
      <span class="info_cont"><span>ZDQ012J</span></span>
      <span class="info_title"><span>제조사</span></span>
      <span class="info_cont"><span>퍼시스</span></span>
      <select option_title="색상">
        <option value="WP">WP</option>
        <option value="OBL">OBL</option>
        <option value="WW">WW</option>
        <option value="TL">TL</option>
      </select>
      <p><img src="//kongganoa.godohosting.com/fursys/executive/TIERRA/ZDQ012J.jpg"></p>
      <p><img src="/product/이미지경로"></p>
      <p><img src="/web/upload/category/editor/2023/04/26/noise.jpg"></p>
    </body>
  </html>
`;

const draft = analyzeProductHtml({
  url: "https://fursys-store.com/product/detail.html?product_no=2913&cate_no=118&display_group=1",
  html: fixtureHtml,
  assetKey: "p2s_fursys_setina_zdq012j",
  dimensionsMm: {
    width: 1172,
    depth: 590,
    height: 587
  },
  heightRangeMm: [587, 1073]
});

assert(draft.schemaVersion === "product-url-reference-alpha-v1", "unexpected product reference schema");
assert(draft.assetKey === "p2s_fursys_setina_zdq012j", "asset key override was not preserved");
assert(draft.product.sku === "ZDQ012J", "SKU extraction failed");
assert(draft.product.manufacturer === "FURSYS", "manufacturer normalization failed");
assert(draft.product.price === 2512400, "JSON-LD price extraction failed");
assert(draft.product.priceCurrency === "KRW", "JSON-LD currency extraction failed");
assert(draft.product.options.join(",") === "OBL,TL,WP,WW", "option extraction failed");
assert(draft.product.dimensionsMm?.width === 1172, "dimension override was not preserved");
assert(draft.product.heightRangeMm?.[1] === 1073, "height range override was not preserved");
assert(draft.referenceImages.some((image) => image.url.includes("ZDQ012J.jpg")), "detail reference image missing");
assert(
  draft.referenceImages.every((image) => !decodeURIComponent(image.url).includes("이미지경로")),
  "placeholder image path must not be selected as a product reference"
);
assert(
  draft.referenceImages.every((image) => !image.url.includes("/category/editor/")),
  "category/editor imagery must not be selected as a product reference"
);
assert(draft.extraction.openGraphImageFound, "open graph image missing");
assert(draft.referencePack.status === "dimension_verified", "dimension override should mark pack dimension verified");
assert(draft.legalUse.releaseEligible === false, "product URL reference must remain prototype-only");
assert(
  draft.materialHints.some((hint) => hint.slot === "DeskWood" && hint.materialType === "wood"),
  "wood material hint missing"
);
assert(
  draft.materialHints.every((hint) => hint.qaStatus === "pending"),
  "URL-derived material hints must stay pending"
);

console.log(
  JSON.stringify(
    {
      ok: true,
      assetKey: draft.assetKey,
      sku: draft.product.sku,
      options: draft.product.options,
      selectedImages: draft.referenceImages.length,
      referencePackStatus: draft.referencePack.status,
      releaseEligible: draft.legalUse.releaseEligible
    },
    null,
    2
  )
);
