# So Ong Space Desk Setup Reference Pack

Source video: <https://www.youtube.com/watch?v=jHakJw40k58>

This pack tracks the supplied So Ong desk setup product references, but only the
products actually visible in the supplied reference still are generated and
exposed as DeskteriorOnline `prototype_reference_only` catalog assets. The goal
is to let the editor, inventory, placement kernel, save/reload/share paths, and
product hotspot UX exercise a creator-inspired desk setup before manufacturer
CAD, licensed reference images, and final PBR material scans are available.

## Commercial Boundary

- These assets are not release-eligible commercial SKU assets.
- Public product pages and the video comment list are used only as reference.
- Final paid catalog promotion still requires manufacturer permission, exact
  dimensions, reference images, material QA, and the normal commercial asset
  fidelity gate.

## Generated Artifacts

- Procedural GLB models:
  `apps/web/public/assets/models/p2s_video_so_ong_*/*.glb`
- Inventory thumbnails:
  `apps/web/public/assets/catalog/thumbnails/p2s_video_so_ong_*.webp`
- Visual smoke render:
  `assets/references/video-scenes/so-ong-space-2026-05-desk-setup/so-ong-space-reference-preview.png`
- Product and scene contracts:
  `apps/web/src/lib/builder/so-ong-video-reference.ts`

## 2026-05-11 Detail Pass

The second pass checked accessible product-detail pages and product-name
search results for dimensions and visual signatures, then rebuilt the procedural
assets with stronger product-specific silhouettes and material splits.

Confirmed or vendor-backed dimensions now drive these prototype assets:

- TFG40Q14WP main monitor: 944 x 287 x 596 mm envelope, white ultrawide frame,
  height-adjust stand, black glossy screen, top light-bar composition.
- Divoom Times Gate: 283 x 47 x 97 mm five-display black clock body.
- Avolt Square1: 76 mm cube power strip body with multi-face recessed sockets.
- Brennenstuhl Ecolor 4-way strip: 270 x 80 x 58 mm body with red switch and
  socket spacing.
- Philips Hue Infuse: 381 mm circular fixture envelope with diffuser/glow
  lens separation.
- Samsung S32DG800: approximately 720 x 264 x 585 mm with stand.
- GravaStar Mars Pro: approximately 201 x 180 x 191 mm robot-speaker envelope
  after reconciling the product-detail W/D/H orientation.
- Arturia MiniFuse 2: 200 x 100 x 43 mm audio interface body.

## 2026-05-11 Extended Screenshot Match Pass

The third pass expanded the pack from 20 to 28 unique supplied product
references. The newly added references are:

- OFRAME dual monitor riser/shelf.
- Razer Cobra Pro White mouse: 119.6 x 62.5 x 38.1 mm envelope with white shell,
  black grips, scroll wheel, and RGB underglow.
- Zionworks/Aiglatson Studio SYNCHRONIZE desk mat: 900 x 400 x 4 mm mat with
  stitched border, woven-thread pattern, label patch, and wordmark.
- Angry Miao AM HATSU: split 4-by-6 ergonomic keyboard with organic curved
  white body and dark keycaps.
- Elgato Stream Deck Neo: 107 x 78 x 26 mm low desktop controller with eight
  LCD keys and infobar.
- reProducer Epic 5: 190 x 240 x 310 mm with-spikes envelope, white cabinet,
  black recessed baffle, tweeter, woofer, and feet.
- HYTE Y70 Snow White: 470 x 320 x 470 mm case envelope with panoramic glass,
  internal GPU/motherboard details, RGB side fans, and white tubes.
- Itsub x Atom 60th Anniversary 28 cm figure: prototype shelf/figure asset.

The smoke render was also rebuilt to match the supplied still more closely:
HYTE Y70 and OFRAME shelf on the left, product-specific Epic 5 speakers, AM
HATSU keyboard, Cobra Pro mouse, Stream Deck Neo, SYNCHRONIZE mat, and a denser
PC/speaker/desktop product composition.

## 2026-05-11 Product Detail Reconciliation Pass

The fourth pass rechecked accessible product detail/spec pages and corrected
the reference pack in places where earlier silhouettes were visually plausible
but dimension-orientation or scale was weak:

- Mars Pro now uses a 201 x 180 x 191 mm envelope and a lower, wider robot
  speaker body instead of the previous taller envelope.
- OFRAME dual monitor riser now uses a wider 1000 x 250 x 120 mm shelf layer,
  which better supports the left PC/tower stack in the reference composition.
- Stream Deck Neo now uses a low 107 x 78 x 26 mm tabletop footprint instead
  of an upright 78 mm-tall block.
- The smoke render lighting was rebalanced toward the supplied still: darker
  woven desk mat, softer off-white desktop, stronger lavender wall wash, and
  reduced neutral front fill.

Products without accessible reliable size data are still dimensioned from the
video/product-list visual reference and must remain
`visual_estimate_pending_qa` until reliable manufacturer dimensions are
attached.

## 2026-05-12 Reference Fidelity Pass

The fifth pass focused on making the pack feel like the supplied reference
still when it appears inside DeskteriorOnline rather than just making the GLBs
exist.

- Inventory thumbnails are now rendered from the actual procedural Blender
  models and exported as WebP thumbnails, replacing the earlier flat SVG cards.
- The reference smoke render uses the same product-specific layout as the
  catalog metadata: HYTE Y70/OFRAME tower stack on the left, Epic 5 speakers on
  both sides, TFG40Q14WP main display, CPM1610IQ portable display, Stream Deck
  Neo, AM HATSU, Cobra Pro White, SYNCHRONIZE mat, IVY planter, Mars Pro,
  Times Gate, and the smaller desk props.
- White plastic/laminate materials were darkened slightly and the neutral front
  fill was reduced so the scene keeps visible white surface detail instead of
  blowing out to a blank white plane.
- The preview room was widened and re-lit with a soft lavender wall wash to
  remove black empty background and better match the video still's cool ambient
  setup.

This remains a prototype reference pack. The models are recognizable procedural
rebuilds for product-flow testing, not production SKU twins.

## 2026-05-13 Visible Crop Scope Pass

The latest pass narrows generated catalog exposure to the products visible in
the supplied still instead of generating every product from the full comment
list. The full 28-item reference list is still kept as source metadata, but
`listed_only` entries are not exported as catalog assets and do not appear in
the preview layout.

Generated/exposed visible-crop products now cover 17 product references:
TFG40Q14WP, CPM1610IQ, the portable monitor stand, IVY, SML spacecraft, Times
Gate, charging reel cable, Square1, Mars Pro, diecast, MiniFuse 2, OFRAME riser,
Cobra Pro White, SYNCHRONIZE mat, AM HATSU, reProducer Epic 5, and HYTE Y70.

The visible scene keeps the separate white desk and monitor light bar as
composition fixtures. Stream Deck Neo, ceiling light, room blind, wall switch,
Movlabs/S32DG800 side setup, Atom figure, and other non-crop references are
metadata-only until a screenshot/frame actually requires them.

## Verification

Run:

```bash
npm --workspace apps/web run verify:video-scene-reference
```

The verification checks that all 28 supplied unique product references remain
tracked as metadata, only the 17 visible-crop references are generated/exposed
as catalog entries, `listed_only` entries stay out of the layout and fidelity
report, and the visual preview artifact exists.
