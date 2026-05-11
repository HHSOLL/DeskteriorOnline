const VIDEO_REFERENCE_SOURCE_PATH =
  "assets/references/video-scenes/so-ong-space-2026-05-desk-setup/so-ong-space-reference-preview.png";
const VIDEO_REFERENCE_YOUTUBE_URL = "https://www.youtube.com/watch?v=jHakJw40k58";

export type SoOngVideoProduct = {
  catalogItemId: string;
  label: string;
  brand: string;
  sourceUrl: string;
  catalogCategory: string;
  dimensionsMm: { width: number; depth: number; height: number };
  finishColor: string;
  finishMaterial: string;
  videoRole: string;
  visibleInStill: "primary" | "secondary" | "listed_only";
  placementSurface: "desktop_top" | "wall" | "ceiling" | "floor" | "shelf_top";
  dimensionConfidence: "manufacturer_or_vendor_page" | "visual_estimate_pending_qa";
};

const prototypeLicense = {
  spdx: "LicenseRef-Video-Reference-Prototype-Only",
  label: "Prototype-only rebuild from public video/product references",
  requiresAttribution: true
} as const;

const prototypeSource = {
  kind: "deskterioronline_blender",
  name: "DeskteriorOnline So Ong video reference prototype pack",
  path: VIDEO_REFERENCE_SOURCE_PATH,
  url: VIDEO_REFERENCE_YOUTUBE_URL
} as const;

const prototypeContract = {
  source: prototypeSource,
  license: prototypeLicense,
  pivot: {
    x: "center",
    y: "floor",
    z: "center"
  },
  collisionProxy: {
    kind: "box",
    derivesFrom: "dimensionsMm"
  },
  textureSet: {
    workflow: "pbr_metallic_roughness",
    authored: "procedural",
    ktx2Ready: false
  },
  lodProfile: {
    strategy: "single_mesh",
    levelCount: 1,
    maxDrawCalls: 18,
    maxTriangleCount: 12000
  }
} as const;

export const SO_ONG_VIDEO_PRODUCTS = [
  {
    catalogItemId: "p2s_video_so_ong_tfg40q14wp_monitor",
    label: "TFG40Q14WP main ultrawide monitor",
    brand: "Hansung / TFG",
    sourceUrl: "https://link.coupang.com/a/b5EVrY",
    catalogCategory: "Electronics",
    dimensionsMm: { width: 944, depth: 287, height: 596 },
    finishColor: "White frame / black screen",
    finishMaterial: "Satin plastic shell, glossy screen glass",
    videoRole: "large central monitor with light bar and clock wallpaper",
    visibleInStill: "primary",
    placementSurface: "desktop_top",
    dimensionConfidence: "manufacturer_or_vendor_page"
  },
  {
    catalogItemId: "p2s_video_so_ong_cpm1610iq_portable_monitor",
    label: "CPM1610IQ secondary portable monitor",
    brand: "Camel Prism",
    sourceUrl: "https://link.coupang.com/a/b5HcjV",
    catalogCategory: "Electronics",
    dimensionsMm: { width: 358, depth: 40, height: 235 },
    finishColor: "Black display with grey folio stand",
    finishMaterial: "Gloss screen, matte folding cover",
    videoRole: "small angled monitor/tablet in front of the main display",
    visibleInStill: "primary",
    placementSurface: "desktop_top",
    dimensionConfidence: "visual_estimate_pending_qa"
  },
  {
    catalogItemId: "p2s_video_so_ong_empathist_stand",
    label: "The Empathist secondary monitor stand",
    brand: "The Empathist",
    sourceUrl: "https://29cm.onelink.me/1080201211/y72msqrw",
    catalogCategory: "Electronics",
    dimensionsMm: { width: 280, depth: 180, height: 120 },
    finishColor: "White",
    finishMaterial: "Painted metal plate and wire legs",
    videoRole: "minimal stand supporting the portable display",
    visibleInStill: "secondary",
    placementSurface: "desktop_top",
    dimensionConfidence: "visual_estimate_pending_qa"
  },
  {
    catalogItemId: "p2s_video_so_ong_ivy_planter",
    label: "IVY AI smart planter",
    brand: "IVY",
    sourceUrl: "https://s.click.aliexpress.com/e/_oBRDB0x",
    catalogCategory: "Plants",
    dimensionsMm: { width: 110, depth: 90, height: 115 },
    finishColor: "White body / black face screen",
    finishMaterial: "Gloss plastic, small live plant insert",
    videoRole: "small robot planter on the right side of the desk",
    visibleInStill: "primary",
    placementSurface: "desktop_top",
    dimensionConfidence: "visual_estimate_pending_qa"
  },
  {
    catalogItemId: "p2s_video_so_ong_sml_spacecraft",
    label: "SML WARS SS 001 Spacecraft",
    brand: "Sticky Monster Lab",
    sourceUrl: "http://shop.stickymonsterlab.com/shop/shopdetail.html?branduid=1303229",
    catalogCategory: "Decor",
    dimensionsMm: { width: 160, depth: 115, height: 130 },
    finishColor: "Warm white with grey window",
    finishMaterial: "Painted collectible vinyl/plastic",
    videoRole: "white spaceship collectible on top of the PC tower",
    visibleInStill: "primary",
    placementSurface: "desktop_top",
    dimensionConfidence: "visual_estimate_pending_qa"
  },
  {
    catalogItemId: "p2s_video_so_ong_divoom_times_gate",
    label: "Divoom Times Gate clock",
    brand: "Divoom",
    sourceUrl: "https://link.coupang.com/a/b5EMZs",
    catalogCategory: "Electronics",
    dimensionsMm: { width: 283, depth: 47, height: 97 },
    finishColor: "Black shell / five bright screens",
    finishMaterial: "Matte plastic with IPS display glass",
    videoRole: "five-screen desk clock on the left side",
    visibleInStill: "primary",
    placementSurface: "desktop_top",
    dimensionConfidence: "manufacturer_or_vendor_page"
  },
  {
    catalogItemId: "p2s_video_so_ong_charging_reel_cable",
    label: "charging reel cable",
    brand: "AliExpress reference",
    sourceUrl: "https://s.click.aliexpress.com/e/_onOxqJd",
    catalogCategory: "Utility",
    dimensionsMm: { width: 75, depth: 75, height: 28 },
    finishColor: "White reel / black cable",
    finishMaterial: "ABS shell and rubber cable",
    videoRole: "small cable puck for the white desk utility layer",
    visibleInStill: "secondary",
    placementSurface: "desktop_top",
    dimensionConfidence: "visual_estimate_pending_qa"
  },
  {
    catalogItemId: "p2s_video_so_ong_square1_power_cube",
    label: "Avolt x Martinelli Luce Square1 power cube",
    brand: "Avolt / Martinelli Luce",
    sourceUrl: "https://ozip.me/mAWYfhB?af",
    catalogCategory: "Utility",
    dimensionsMm: { width: 76, depth: 76, height: 76 },
    finishColor: "White cube",
    finishMaterial: "Matte plastic with recessed sockets",
    videoRole: "cube power strip near the desk edge",
    visibleInStill: "secondary",
    placementSurface: "desktop_top",
    dimensionConfidence: "manufacturer_or_vendor_page"
  },
  {
    catalogItemId: "p2s_video_so_ong_ecolor_power_strip",
    label: "Brennenstuhl Ecolor 4-outlet power strip",
    brand: "Brennenstuhl",
    sourceUrl: "https://link.coupang.com/a/b5EnDy",
    catalogCategory: "Utility",
    dimensionsMm: { width: 270, depth: 80, height: 58 },
    finishColor: "White with red switch",
    finishMaterial: "Plastic shell and socket inserts",
    videoRole: "linear 4-outlet strip for cable/power detail",
    visibleInStill: "secondary",
    placementSurface: "desktop_top",
    dimensionConfidence: "manufacturer_or_vendor_page"
  },
  {
    catalogItemId: "p2s_video_so_ong_hue_infuse_ceiling_light",
    label: "Philips Hue Infuse ceiling light",
    brand: "Philips Hue",
    sourceUrl: "https://link.coupang.com/a/b5EoFD",
    catalogCategory: "Lighting",
    dimensionsMm: { width: 381, depth: 381, height: 90 },
    finishColor: "White diffuser with color ambience",
    finishMaterial: "Translucent acrylic lens and metal housing",
    videoRole: "lavender ambient ceiling light mood source",
    visibleInStill: "listed_only",
    placementSurface: "ceiling",
    dimensionConfidence: "manufacturer_or_vendor_page"
  },
  {
    catalogItemId: "p2s_video_so_ong_movlabs_stand",
    label: "Movlabs stand for Samsung monitor",
    brand: "Movlabs",
    sourceUrl: "https://smartstore.naver.com/movlabs",
    catalogCategory: "Electronics",
    dimensionsMm: { width: 520, depth: 520, height: 1350 },
    finishColor: "White rolling stand",
    finishMaterial: "Powder-coated metal pole and caster base",
    videoRole: "rolling stand-by-me style monitor stand",
    visibleInStill: "listed_only",
    placementSurface: "floor",
    dimensionConfidence: "visual_estimate_pending_qa"
  },
  {
    catalogItemId: "p2s_video_so_ong_s32dg800_monitor",
    label: "Samsung S32DG800 monitor",
    brand: "Samsung",
    sourceUrl: "https://link.coupang.com/a/b5JESi",
    catalogCategory: "Electronics",
    dimensionsMm: { width: 720, depth: 264, height: 585 },
    finishColor: "Silver/white stand with black screen",
    finishMaterial: "Display glass, satin plastic, metal stand",
    videoRole: "secondary large monitor used with the rolling stand",
    visibleInStill: "listed_only",
    placementSurface: "floor",
    dimensionConfidence: "manufacturer_or_vendor_page"
  },
  {
    catalogItemId: "p2s_video_so_ong_bookshelf_planter",
    label: "bookshelf plant",
    brand: "AliExpress reference",
    sourceUrl: "https://s.click.aliexpress.com/e/_onQyOt1",
    catalogCategory: "Plants",
    dimensionsMm: { width: 110, depth: 110, height: 190 },
    finishColor: "White planter / green leaves",
    finishMaterial: "Ceramic-style pot and artificial greenery",
    videoRole: "small plant accent on the bookshelf",
    visibleInStill: "listed_only",
    placementSurface: "shelf_top",
    dimensionConfidence: "visual_estimate_pending_qa"
  },
  {
    catalogItemId: "p2s_video_so_ong_arachne_wood_blind",
    label: "Arachne wood blind, Odong tree 00",
    brand: "Arachne",
    sourceUrl: "https://ozip.me/37Fbr6W?af",
    catalogCategory: "Decor",
    dimensionsMm: { width: 1200, depth: 40, height: 1000 },
    finishColor: "Light natural wood",
    finishMaterial: "Horizontal wood slats",
    videoRole: "warm wood blind plane for the white/lavender room",
    visibleInStill: "listed_only",
    placementSurface: "wall",
    dimensionConfidence: "visual_estimate_pending_qa"
  },
  {
    catalogItemId: "p2s_video_so_ong_jekca_cat_block",
    label: "JEKCA cow tabby cat block",
    brand: "JEKCA",
    sourceUrl: "https://smartstore.naver.com/jekca/products/4639475955",
    catalogCategory: "Decor",
    dimensionsMm: { width: 220, depth: 105, height: 260 },
    finishColor: "White and grey tabby blocks",
    finishMaterial: "Interlocking ABS blocks",
    videoRole: "blocky cat collectible accent",
    visibleInStill: "listed_only",
    placementSurface: "desktop_top",
    dimensionConfidence: "visual_estimate_pending_qa"
  },
  {
    catalogItemId: "p2s_video_so_ong_gravastar_mars_pro",
    label: "Gravastar Mars Pro speaker",
    brand: "Gravastar",
    sourceUrl: "https://link.coupang.com/a/b5EypD",
    catalogCategory: "Electronics",
    dimensionsMm: { width: 201, depth: 180, height: 191 },
    finishColor: "Black body with warm driver core",
    finishMaterial: "Painted metal/plastic robot speaker shell",
    videoRole: "small futuristic speaker near the keyboard area",
    visibleInStill: "primary",
    placementSurface: "desktop_top",
    dimensionConfidence: "manufacturer_or_vendor_page"
  },
  {
    catalogItemId: "p2s_video_so_ong_plant_guardian_spray",
    label: "Plant Guardian spray",
    brand: "Plant Guardian",
    sourceUrl: "https://naver.me/xGITNSUq",
    catalogCategory: "Plants",
    dimensionsMm: { width: 70, depth: 55, height: 210 },
    finishColor: "White bottle with green label",
    finishMaterial: "Plastic spray bottle",
    videoRole: "plant care bottle in the peripheral setup",
    visibleInStill: "listed_only",
    placementSurface: "shelf_top",
    dimensionConfidence: "visual_estimate_pending_qa"
  },
  {
    catalogItemId: "p2s_video_so_ong_sanro_switch_cover",
    label: "SANRO wall switch cover",
    brand: "SANRO",
    sourceUrl: "https://ozip.me/U1EJzZj?af",
    catalogCategory: "Decor",
    dimensionsMm: { width: 120, depth: 15, height: 120 },
    finishColor: "White plate",
    finishMaterial: "Plastic wall switch cover",
    videoRole: "small white wall detail on the right side of the room",
    visibleInStill: "secondary",
    placementSurface: "wall",
    dimensionConfidence: "visual_estimate_pending_qa"
  },
  {
    catalogItemId: "p2s_video_so_ong_diecast_car",
    label: "diecast car",
    brand: "AliExpress reference",
    sourceUrl: "https://s.click.aliexpress.com/e/_oo9b0Jz",
    catalogCategory: "Decor",
    dimensionsMm: { width: 120, depth: 55, height: 45 },
    finishColor: "White body / dark glass",
    finishMaterial: "Painted diecast metal and plastic wheels",
    videoRole: "small white car model below the monitor",
    visibleInStill: "primary",
    placementSurface: "desktop_top",
    dimensionConfidence: "visual_estimate_pending_qa"
  },
  {
    catalogItemId: "p2s_video_so_ong_arturia_minifuse2",
    label: "Arturia MiniFuse 2 audio interface",
    brand: "Arturia",
    sourceUrl: "https://link.coupang.com/a/b5Hayv",
    catalogCategory: "Electronics",
    dimensionsMm: { width: 200, depth: 100, height: 43 },
    finishColor: "White body / grey controls",
    finishMaterial: "Painted aluminum/plastic interface body",
    videoRole: "white audio interface under the portable monitor",
    visibleInStill: "primary",
    placementSurface: "desktop_top",
    dimensionConfidence: "manufacturer_or_vendor_page"
  },
  {
    catalogItemId: "p2s_video_so_ong_offrame_dual_monitor_riser",
    label: "OFRAME dual monitor desk riser",
    brand: "OFRAME",
    sourceUrl: "https://naver.me/xSFLRV8T",
    catalogCategory: "Furniture",
    dimensionsMm: { width: 1000, depth: 250, height: 120 },
    finishColor: "White shelf / grey shadow slot",
    finishMaterial: "Painted board or metal riser with rubber feet",
    videoRole: "white shelf/riser layer under the left PC/display stack",
    visibleInStill: "secondary",
    placementSurface: "desktop_top",
    dimensionConfidence: "manufacturer_or_vendor_page"
  },
  {
    catalogItemId: "p2s_video_so_ong_razer_cobra_pro_white",
    label: "Razer Cobra Pro White mouse",
    brand: "Razer",
    sourceUrl: "https://link.coupang.com/a/bG31KL",
    catalogCategory: "Electronics",
    dimensionsMm: { width: 120, depth: 63, height: 38 },
    finishColor: "White shell / black grips / RGB underglow",
    finishMaterial: "Matte plastic, rubber grips, glossy lighting diffuser",
    videoRole: "white gaming mouse on the right side of the desk mat",
    visibleInStill: "primary",
    placementSurface: "desktop_top",
    dimensionConfidence: "manufacturer_or_vendor_page"
  },
  {
    catalogItemId: "p2s_video_so_ong_zionworks_synchronize_mat",
    label: "Zionworks SYNCHRONIZE desk mat",
    brand: "Zionworks / Aiglatson Studio",
    sourceUrl: "https://naver.me/GipWYdYt",
    catalogCategory: "Utility",
    dimensionsMm: { width: 900, depth: 400, height: 4 },
    finishColor: "Black woven field / white border and wordmark",
    finishMaterial: "Cloth top, stitched edge, rubber base",
    videoRole: "large black-and-white desk mat anchoring keyboard and mouse",
    visibleInStill: "primary",
    placementSurface: "desktop_top",
    dimensionConfidence: "manufacturer_or_vendor_page"
  },
  {
    catalogItemId: "p2s_video_so_ong_angry_miao_am_hatsu",
    label: "Angry Miao AM HATSU keyboard",
    brand: "Angry Miao",
    sourceUrl: "https://www.angrymiao.com/en/am-hatsu/",
    catalogCategory: "Electronics",
    dimensionsMm: { width: 360, depth: 220, height: 75 },
    finishColor: "White 3D curved body / dark sculpted keycaps",
    finishMaterial: "CNC aluminum-style body and plastic keycaps",
    videoRole: "two-piece organic split ergonomic keyboard on the desk mat",
    visibleInStill: "primary",
    placementSurface: "desktop_top",
    dimensionConfidence: "visual_estimate_pending_qa"
  },
  {
    catalogItemId: "p2s_video_so_ong_elgato_stream_deck_neo",
    label: "Elgato Stream Deck Neo",
    brand: "Elgato",
    sourceUrl: "https://link.coupang.com/a/bG32Rh",
    catalogCategory: "Electronics",
    dimensionsMm: { width: 107, depth: 78, height: 26 },
    finishColor: "White body / black LCD key face",
    finishMaterial: "Matte plastic shell, LCD keys, rubber base",
    videoRole: "small black-faced controller near the speaker and keyboard area",
    visibleInStill: "primary",
    placementSurface: "desktop_top",
    dimensionConfidence: "manufacturer_or_vendor_page"
  },
  {
    catalogItemId: "p2s_video_so_ong_reproducer_epic5",
    label: "reProducer Epic 5 studio monitor speaker",
    brand: "reProducer Audio Labs",
    sourceUrl: "https://bit.ly/4cePCNT",
    catalogCategory: "Electronics",
    dimensionsMm: { width: 190, depth: 240, height: 310 },
    finishColor: "White cabinet / black recessed drivers",
    finishMaterial: "Painted speaker cabinet, metal dome tweeter, rubber woofer",
    videoRole: "white studio monitor speakers flanking the screens",
    visibleInStill: "primary",
    placementSurface: "desktop_top",
    dimensionConfidence: "manufacturer_or_vendor_page"
  },
  {
    catalogItemId: "p2s_video_so_ong_hyte_y70_snow_white",
    label: "HYTE Y70 Snow White PC case",
    brand: "HYTE",
    sourceUrl: "https://link.coupang.com/a/bG34uy",
    catalogCategory: "Electronics",
    dimensionsMm: { width: 470, depth: 320, height: 470 },
    finishColor: "Snow white frame / panoramic glass / lavender RGB fans",
    finishMaterial: "Steel/plastic frame, tempered glass, RGB fan lighting",
    videoRole: "large white glass PC case with visible internals on the left side",
    visibleInStill: "primary",
    placementSurface: "desktop_top",
    dimensionConfidence: "manufacturer_or_vendor_page"
  },
  {
    catalogItemId: "p2s_video_so_ong_atom_60th_figure",
    label: "Itsub x Atom 60th anniversary Atom figure 28 cm",
    brand: "Itsub x Atom",
    sourceUrl: "https://bit.ly/3XBZ0GG",
    catalogCategory: "Decor",
    dimensionsMm: { width: 160, depth: 120, height: 280 },
    finishColor: "Skin tone, black hair/body, red boots",
    finishMaterial: "Painted vinyl/plastic figure",
    videoRole: "large 28 cm collectible figure for the top/peripheral shelf layer",
    visibleInStill: "listed_only",
    placementSurface: "shelf_top",
    dimensionConfidence: "visual_estimate_pending_qa"
  }
] as const satisfies readonly SoOngVideoProduct[];

export const SO_ONG_VIDEO_CATALOG_VARIANTS = SO_ONG_VIDEO_PRODUCTS.map((product) => ({
  id: product.catalogItemId,
  label: `Reference prototype · ${product.label}`,
  category: product.catalogCategory,
  assetId: `/assets/models/${product.catalogItemId}/${product.catalogItemId}.glb`,
  thumbnail: `/assets/catalog/thumbnails/${product.catalogItemId}.webp`,
  scale: [1, 1, 1],
  description:
    `Prototype-only rebuild for the So Ong desk setup video. Role: ${product.videoRole}. ` +
    "Not release eligible until licensed manufacturer CAD/material references and dimension QA are attached.",
  brand: product.brand,
  price: null,
  options:
    `${product.dimensionsMm.width}x${product.dimensionsMm.depth}x${product.dimensionsMm.height} mm · ` +
    `${product.placementSurface} · prototype_reference_only`,
  externalUrl: product.sourceUrl,
  dimensionsMm: product.dimensionsMm,
  finishColor: product.finishColor,
  finishMaterial: product.finishMaterial,
  detailNotes:
    `Source: ${VIDEO_REFERENCE_YOUTUBE_URL}; source confidence: ${product.dimensionConfidence}; ` +
    "commercial asset gate: blocked until rights and exact material references are secured.",
  scaleLocked: true,
  ...prototypeContract
}));

export const SO_ONG_VIDEO_SCENE_OBJECTS = [
  { id: "desk", catalogItemId: "p2s_desk_white_compact_120", positionMm: [0, 0, 735], yawDeg: 0 },
  { id: "main-monitor", catalogItemId: "p2s_video_so_ong_tfg40q14wp_monitor", positionMm: [180, -120, 735], yawDeg: 0 },
  { id: "portable-monitor", catalogItemId: "p2s_video_so_ong_cpm1610iq_portable_monitor", positionMm: [260, -310, 735], yawDeg: -4 },
  { id: "portable-monitor-stand", catalogItemId: "p2s_video_so_ong_empathist_stand", positionMm: [260, -280, 735], yawDeg: -4 },
  { id: "offrame-riser", catalogItemId: "p2s_video_so_ong_offrame_dual_monitor_riser", positionMm: [-820, 65, 735], yawDeg: 0 },
  { id: "hyte-y70", catalogItemId: "p2s_video_so_ong_hyte_y70_snow_white", positionMm: [-820, 60, 855], yawDeg: 0 },
  { id: "times-gate", catalogItemId: "p2s_video_so_ong_divoom_times_gate", positionMm: [-690, -20, 1325], yawDeg: 0 },
  { id: "spacecraft", catalogItemId: "p2s_video_so_ong_sml_spacecraft", positionMm: [-1000, 70, 1335], yawDeg: 0 },
  { id: "ivy", catalogItemId: "p2s_video_so_ong_ivy_planter", positionMm: [720, -260, 735], yawDeg: 0 },
  { id: "mars-pro", catalogItemId: "p2s_video_so_ong_gravastar_mars_pro", positionMm: [-575, -310, 735], yawDeg: -12 },
  { id: "audio-interface", catalogItemId: "p2s_video_so_ong_arturia_minifuse2", positionMm: [0, -360, 735], yawDeg: 0 },
  { id: "diecast", catalogItemId: "p2s_video_so_ong_diecast_car", positionMm: [20, -230, 735], yawDeg: -5 },
  { id: "reel-cable", catalogItemId: "p2s_video_so_ong_charging_reel_cable", positionMm: [-420, -360, 735], yawDeg: 0 },
  { id: "square1-power-cube", catalogItemId: "p2s_video_so_ong_square1_power_cube", positionMm: [-1110, -410, 735], yawDeg: 0 },
  { id: "ecolor-power-strip", catalogItemId: "p2s_video_so_ong_ecolor_power_strip", positionMm: [-760, 205, 735], yawDeg: 0 },
  { id: "mat", catalogItemId: "p2s_video_so_ong_zionworks_synchronize_mat", positionMm: [40, -190, 739], yawDeg: 0 },
  { id: "keyboard", catalogItemId: "p2s_video_so_ong_angry_miao_am_hatsu", positionMm: [20, -350, 745], yawDeg: 0 },
  { id: "mouse", catalogItemId: "p2s_video_so_ong_razer_cobra_pro_white", positionMm: [500, -360, 745], yawDeg: 6 },
  { id: "stream-deck-neo", catalogItemId: "p2s_video_so_ong_elgato_stream_deck_neo", positionMm: [-340, -310, 745], yawDeg: -5 },
  { id: "left-speaker", catalogItemId: "p2s_video_so_ong_reproducer_epic5", positionMm: [-520, -40, 735], yawDeg: 0 },
  { id: "right-speaker", catalogItemId: "p2s_video_so_ong_reproducer_epic5", positionMm: [920, -40, 735], yawDeg: 0 },
  { id: "light-bar", catalogItemId: "p2s_monitor_light_bar_black", positionMm: [180, -110, 1240], yawDeg: 0 },
  { id: "blind", catalogItemId: "p2s_video_so_ong_arachne_wood_blind", positionMm: [-820, 510, 900], yawDeg: 0 },
  { id: "switch-cover", catalogItemId: "p2s_video_so_ong_sanro_switch_cover", positionMm: [1120, 510, 940], yawDeg: 0 },
  { id: "ceiling-light", catalogItemId: "p2s_video_so_ong_hue_infuse_ceiling_light", positionMm: [0, 0, 2500], yawDeg: 0 },
  { id: "movlabs-stand", catalogItemId: "p2s_video_so_ong_movlabs_stand", positionMm: [1460, -260, 0], yawDeg: -8 },
  { id: "s32dg800", catalogItemId: "p2s_video_so_ong_s32dg800_monitor", positionMm: [1460, -260, 980], yawDeg: -8 },
  { id: "bookshelf-planter", catalogItemId: "p2s_video_so_ong_bookshelf_planter", positionMm: [-1350, 280, 1510], yawDeg: 0 },
  { id: "jekca-cat", catalogItemId: "p2s_video_so_ong_jekca_cat_block", positionMm: [1010, 170, 735], yawDeg: 16 },
  { id: "plant-spray", catalogItemId: "p2s_video_so_ong_plant_guardian_spray", positionMm: [-1250, 250, 735], yawDeg: 0 },
  { id: "atom-figure", catalogItemId: "p2s_video_so_ong_atom_60th_figure", positionMm: [-1060, 80, 1335], yawDeg: 8 }
] as const;
