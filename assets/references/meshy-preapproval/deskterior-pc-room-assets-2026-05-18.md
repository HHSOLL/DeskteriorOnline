# Meshy Preapproval: Deskterior PC Room Assets

Status: pending user review. No Meshy generation has been run for these candidates.

Purpose:
- Fill gaps that open-source GLBs do not cover cleanly.
- Keep PC assembly as a deskterior component, not the room centerpiece.
- Prioritize room furniture, decor quality, lighting atmosphere, and stylized material coherence.

Approval rule:
- Text-to-3D candidates require approval of the exact prompt before a Meshy job is started.
- Image-to-3D candidates require approval of both the prompt and the exact reference image.
- Product-exact assets must avoid brand logos/trademarks unless the user explicitly provides rights-safe source material.

## Candidates

| Priority | Candidate | Meshy mode | Proposed prompt or reference plan | Why needed | Risk / QA gate |
| --- | --- | --- | --- | --- | --- |
| P0 | White compact dual-chamber PC case proxy | Text to 3D | `A stylized high quality white compact dual chamber desktop PC case, glass side panel, clean rectangular silhouette, subtle vents, no logos, no branding, game-ready PBR, low poly but detailed, glTF asset, centered origin, neutral studio lighting` | Needed for a clean assembled PC body that can sit on the desk without overpowering the room. | Must be reviewed for scale, glass material, front/side orientation, and whether it resembles protected product dress too closely. |
| P0 | Modular warm oak desk shelf with small decor | Text to 3D | `Stylized warm oak desktop shelf organizer with small books, tiny plant, cable tray detail, rounded bevels, cozy desk setup prop, no logos, game-ready PBR, Bruno Simon inspired miniature room style, glTF asset, centered origin` | Room/deskterior density matters more than PC prominence; this is a high-value desk decor layer. | Must not become cluttered noise in the final camera. Needs material pass and pivot correction. |
| P0 | Cozy low sofa with textile seams | Text to 3D | `Stylized compact low sofa for a cozy gaming room, dark muted fabric, visible cushion seams and soft bevels, small throw pillow, no logos, game-ready PBR, miniature diorama style, glTF asset, centered origin` | Current sofa quality is a blocker for Bruno-style room feel. | Meshy may output blobby upholstery; accept only if silhouette is cleaner than existing local sofa GLB. |
| P1 | White triple-fan GPU proxy | Text to 3D first; image-to-3D only after reference approval | `Stylized white triple fan graphics card, thick heatsink, subtle RGB accent line, PCIe connector visible, no logos, no branding, game-ready PBR, clean geometry, glTF asset, centered origin` | PC assembly needs visible installable GPU, but exact commercial quote asset can wait until rights-safe reference handling is solved. | Must expose a predictable pivot/anchor for PCIe insertion. Avoid exact brand logos. |
| P1 | White 360 mm AIO cooler kit | Text to 3D | `Stylized white 360mm liquid CPU cooler kit, three fan radiator, round LCD-style pump cap without any logo, white braided tubes, subtle RGB rings, game-ready PBR, clean low-poly geometry, glTF asset, separated-looking components` | Required for CPU thermal paste and cooler installation sequence visual clarity. | Tubes may be malformed. Needs anchor metadata for pump-to-socket and radiator-to-case mounts. |
| P1 | White DDR5 RGB RAM pair | Text to 3D | `Two stylized white DDR5 memory sticks with translucent RGB light bars, gold connector edge, no logos, no branding, clean game-ready PBR, glTF asset, centered origin, small bevel details` | Supports RAM insertion interaction and click sound moment. | Must be dimensionally simple and slot-friendly; reject if too organic or merged. |
| P1 | White micro-ATX motherboard proxy | Text to 3D | `Stylized white and silver micro ATX motherboard, AM5-like CPU socket area, four RAM slots, one PCIe x16 slot, M.2 heatsink blocks, rear IO shield, no logos, no text branding, game-ready PBR, clean orthogonal geometry, glTF asset, centered origin` | Motherboard is the attachment platform for PC assembly. | Exact slot positions likely need manual correction in Blender; Meshy output is only a visual base. |
| P2 | Wall cove light and acoustic panel kit | Text to 3D | `Stylized cozy room wall treatment kit, slim wood slat acoustic panels, soft cove light strip housing, small picture frame, warm neutral material, no logos, game-ready PBR, miniature room diorama style, glTF asset` | Raises room atmosphere without making the PC louder. | Must stay subtle; strong line/grid artifacts are rejected. |
| P2 | Cable management set | Text to 3D | `Stylized desk cable management accessories, small cable tray, coiled black cable, cable clips, velcro ties, minimal desk setup props, no logos, game-ready PBR, glTF asset, centered origin` | Desk realism and PC-to-monitor connection need better cable dressing. | Use as small props only; must not visually clutter the final screenshot. |

## Image-to-3D Reference Policy

No image-to-3D reference image is approved yet.

Potential image sources after review:
- User-provided rights-safe screenshots/photos.
- Manufacturer product pages only if used as visual reference under a rights-reviewed workflow.
- AI-generated reference sheets that do not contain logos or exact trademarks.

Rejected until explicit approval:
- Direct use of commercial product images from shopping pages as Meshy input.
- Any prompt that asks for exact ASUS, GIGABYTE, LIAN LI, AMD, KLEVV, or other branded logos.

## Runtime Integration After Approval

1. Generate Meshy GLB into a staging directory, not directly into `apps/web/public/assets`.
2. Record source prompt, generation settings, provider job id, and preview screenshots.
3. Inspect in Blender or glTF tooling for scale, origin, material count, and mesh defects.
4. Create attachment metadata only for PC parts that pass visual and dimensional review.
5. Optimize with the project GLB pipeline before runtime catalog publication.
