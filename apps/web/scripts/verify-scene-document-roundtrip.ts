import {
  mapProjectVersionToSceneDocument,
  toSceneStorePatch
} from "../src/lib/domain/scene-document";
import { serializeScenePlacement } from "../src/lib/domain/scene-placement";
import { buildSceneDocumentBootstrapFromSavePayload } from "../src/lib/server/project-versions";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const payload = {
  roomShell: {
    scale: 1,
    scaleInfo: {
      value: 1,
      source: "user_measure",
      confidence: 0.92
    },
    walls: [],
    openings: [],
    floors: [
      {
        id: "floor-1",
        outline: [
          [0, 0],
          [3.2, 0],
          [3.2, 2.6],
          [0, 2.6]
        ],
        materialId: null,
        roomId: "room-1",
        roomType: "other",
        label: "Main Room"
      }
    ]
  },
  assets: [
    {
      id: "desk-1",
      assetId: "p2s_desk_oak",
      catalogItemId: "desk-oak",
      anchorType: "floor",
      supportAssetId: null,
      supportProfile: {
        surfaces: [
          {
            id: "desk-top",
            anchorTypes: ["desk_surface", "furniture_surface"],
            center: [0, 0],
            size: [1.3, 0.7],
            top: 0.74,
            margin: [0.08, 0.06]
          }
        ]
      },
      position: [1.4, 0, 1.1],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      materialId: null,
      product: {
        id: "desk-oak",
        name: "Oak Desk",
        category: "Tables",
        brand: "DeskteriorOnline",
        price: "₩420,000",
        options: "1400 x 700",
        externalUrl: "https://example.com/desk",
        thumbnail: "https://example.com/desk.png",
        dimensionsMm: {
          width: 1400,
          depth: 700,
          height: 740
        },
        finishColor: "oak",
        finishMaterial: "veneered wood",
        detailNotes: "Rounded front edge",
        scaleLocked: true,
        source: {
          kind: "deskterioronline_blender",
          name: "DeskteriorOnline Blender Deskterior",
          path: "assets/blender/deskterior/p2s_desk_oak.blend",
          url: null
        },
        license: {
          spdx: "LicenseRef-DeskteriorOnline-Internal",
          label: "DeskteriorOnline Internal Catalog",
          requiresAttribution: false
        },
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
          maxDrawCalls: 16,
          maxTriangleCount: 2000
        }
      }
    },
    {
      id: "lamp-1",
      assetId: "p2s_desk_lamp_glow",
      catalogItemId: "desk-lamp-glow",
      visible: false,
      anchorType: "desk_surface",
      supportAssetId: "desk-1",
      position: [1.52, 0.77, 1.02],
      rotation: [0, Math.PI / 6, 0],
      scale: [1, 1, 1],
      materialId: null,
      product: {
        id: "desk-lamp-glow",
        name: "Desk Lamp Glow",
        category: "Lighting",
        brand: "DeskteriorOnline",
        price: "₩98,000",
        options: "Warm light",
        externalUrl: "https://example.com/lamp",
        thumbnail: "https://example.com/lamp.png",
        dimensionsMm: {
          width: 220,
          depth: 180,
          height: 420
        },
        finishColor: "cream",
        finishMaterial: "powder coated steel",
        detailNotes: "Emitter head with soft glow",
        scaleLocked: true,
        source: {
          kind: "deskterioronline_blender",
          name: "DeskteriorOnline Blender Deskterior",
          path: "assets/blender/deskterior/p2s_desk_lamp_glow.blend",
          url: null
        },
        license: {
          spdx: "LicenseRef-DeskteriorOnline-Internal",
          label: "DeskteriorOnline Internal Catalog",
          requiresAttribution: false
        },
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
          maxDrawCalls: 12,
          maxTriangleCount: 6000
        }
      }
    }
  ],
  materials: {
    wallIndex: 2,
    floorIndex: 1
  },
  lighting: {
    mode: "direct",
    ambientIntensity: 0.44,
    hemisphereIntensity: 0.54,
    directionalIntensity: 1.24,
    environmentBlur: 0.14,
    accentIntensity: 0.82,
    beamOpacity: 0.18
  }
};

try {
  const bootstrap = buildSceneDocumentBootstrapFromSavePayload(payload);
  const versionLike = {
    customization: {
      sceneDocument: bootstrap.document
    }
  };

  const mapped = mapProjectVersionToSceneDocument(versionLike);
  assert(mapped, "sceneDocument parse failed");
  assert(mapped.diagnostics?.source === "customization.sceneDocument", "expected diagnostics source on mapped bootstrap");
  assert(mapped.diagnostics?.integrity.status === "ok", "expected mapped bootstrap integrity to be ok");
  const patch = toSceneStorePatch(mapped);

  assert(bootstrap.diagnostics?.source === "save-payload", "expected save-payload diagnostics source");
  assert(bootstrap.diagnostics?.integrity.status === "ok", "expected bootstrap integrity to be ok");

  assert(patch.assets.length === 2, `expected 2 assets, received ${patch.assets.length}`);
  assert(patch.entranceId === null, "expected null entranceId for blank shell");

  const deskNode = bootstrap.document.nodes.find((node) => node.id === "desk-1");
  const lampNode = bootstrap.document.nodes.find((node) => node.id === "lamp-1");
  const deskAsset = patch.assets.find((asset) => asset.id === "desk-1");
  const lampAsset = patch.assets.find((asset) => asset.id === "lamp-1");

  assert(deskNode && lampNode, "saved sceneDocument nodes missing");
  assert(deskAsset && lampAsset, "loaded scene assets missing");

  assert(deskAsset.anchorType === "floor", `desk anchor mismatch: ${deskAsset.anchorType}`);
  assert(lampAsset.anchorType === "desk_surface", `lamp anchor mismatch: ${lampAsset.anchorType}`);
  assert(lampAsset.visible === false, "lamp visibility should roundtrip through sceneDocument");
  assert(lampAsset.supportAssetId === "desk-1", `lamp supportAssetId mismatch: ${lampAsset.supportAssetId}`);
  assert(
    lampAsset.product?.dimensionsMm?.height === 420,
    `lamp dimensions mismatch: ${JSON.stringify(lampAsset.product?.dimensionsMm)}`
  );
  assert(lampAsset.product?.scaleLocked === true, "lamp scaleLocked flag missing");
  assert(lampAsset.product?.source?.kind === "deskterioronline_blender", "lamp source metadata missing");
  assert(lampAsset.product?.license?.spdx === "LicenseRef-DeskteriorOnline-Internal", "lamp license metadata missing");
  assert(lampAsset.product?.pivot?.y === "floor", "lamp pivot metadata missing");
  assert(lampAsset.product?.collisionProxy?.kind === "box", "lamp collision proxy metadata missing");
  assert(lampAsset.product?.textureSet?.workflow === "pbr_metallic_roughness", "lamp textureSet metadata missing");
  assert(lampAsset.product?.lodProfile?.maxTriangleCount === 6000, "lamp lodProfile metadata missing");
  assert(deskAsset.supportProfile?.surfaces[0]?.id === "desk-top", "desk supportProfile surface missing");

  const savedDeskPlacement = deskNode.placement;
  const savedLampPlacement = lampNode.placement;
  assert(savedDeskPlacement, "desk placement snapshot missing");
  assert(savedLampPlacement, "lamp placement snapshot missing");
  assert(lampNode.visible === false, "sceneDocument node visibility should be preserved");

  const loadedDeskPlacement = serializeScenePlacement({
    position: deskAsset.position,
    rotation: deskAsset.rotation,
    scale: deskAsset.scale
  });
  const loadedLampPlacement = serializeScenePlacement({
    position: lampAsset.position,
    rotation: lampAsset.rotation,
    scale: lampAsset.scale
  });

  assert(
    JSON.stringify(savedDeskPlacement) === JSON.stringify(loadedDeskPlacement),
    `desk placement roundtrip mismatch: ${JSON.stringify({ savedDeskPlacement, loadedDeskPlacement })}`
  );
  assert(
    JSON.stringify(savedLampPlacement) === JSON.stringify(loadedLampPlacement),
    `lamp placement roundtrip mismatch: ${JSON.stringify({ savedLampPlacement, loadedLampPlacement })}`
  );

  console.log("sceneDocument roundtrip ok");
  console.log(
    JSON.stringify(
      {
        assets: patch.assets.map((asset) => ({
          id: asset.id,
          anchorType: asset.anchorType,
          supportAssetId: asset.supportAssetId ?? null
        })),
        wallMaterialIndex: patch.wallMaterialIndex,
        floorMaterialIndex: patch.floorMaterialIndex
      },
      null,
      2
    )
  );
} catch (error) {
  console.error("[verify-scene-document-roundtrip] failed");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
