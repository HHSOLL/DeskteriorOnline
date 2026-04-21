import { buildSharePreviewMeta } from "../src/lib/share/preview";
import { buildSceneDocumentBootstrapFromSavePayload } from "../src/lib/server/project-versions";
import { buildPublicScenePayload } from "../src/lib/server/public-scenes";
import { serializeScenePlacement } from "../src/lib/domain/scene-placement";
import { toSceneStorePatch } from "../src/lib/domain/scene-document";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const savePayload = {
  roomShell: {
    scale: 1,
    scaleInfo: {
      value: 1,
      source: "user_measure",
      confidence: 0.94
    },
    walls: [],
    openings: [],
    floors: [
      {
        id: "floor-1",
        outline: [
          [0, 0],
          [3.4, 0],
          [3.4, 2.4],
          [0, 2.4]
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
      position: [1.48, 0, 1.06],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      materialId: null,
      supportProfile: {
        surfaces: [
          {
            id: "desk-top",
            anchorTypes: ["desk_surface", "furniture_surface"],
            center: [0, 0],
            size: [1.24, 0.68],
            top: 0.74,
            margin: [0.08, 0.06]
          }
        ]
      },
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
      anchorType: "desk_surface",
      supportAssetId: "desk-1",
      position: [1.56, 0.77, 1.0],
      rotation: [0, Math.PI / 8, 0],
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
    wallIndex: 3,
    floorIndex: 2
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
  const bootstrap = buildSceneDocumentBootstrapFromSavePayload(savePayload);
  const previewMeta = buildSharePreviewMeta({
    projectName: "Desk Precision Share",
    projectDescription: "SceneDocument shared payload regression guard",
    versionNumber: 7,
    assetSummary: {
      totalAssets: 2,
      highlightedItems: [
        {
          catalogItemId: "desk-oak",
          assetId: "p2s_desk_oak",
          label: "Oak Desk",
          category: "Tables",
          collection: "Worksurface",
          tone: "sand",
          count: 1
        },
        {
          catalogItemId: "desk-lamp-glow",
          assetId: "p2s_desk_lamp_glow",
          label: "Desk Lamp Glow",
          category: "Lighting",
          collection: "Lighting",
          tone: "ember",
          count: 1
        }
      ],
      collections: [
        {
          label: "Worksurface",
          count: 1
        }
      ],
      uncataloguedCount: 0,
      primaryTone: "sand",
      primaryCollection: "Worksurface"
    }
  });

  const payload = buildPublicScenePayload({
    sharedProject: {
      id: "share-1",
      token: "sharetoken123",
      project_id: "project-1",
      project_version_id: "version-1",
      permissions: "view",
      expires_at: null,
      preview_meta: previewMeta
    },
    project: {
      id: "project-1",
      name: "Fallback Project Name",
      description: "Fallback project description",
      thumbnail_path: "project-1/thumb.png"
    },
    versionRow: {
      id: "version-1",
      version: 7,
      message: "publish",
      customization: {
        sceneDocument: bootstrap.document
      }
    }
  });

  assert(payload.projectName === "Desk Precision Share", `projectName mismatch: ${payload.projectName}`);
  assert(
    payload.projectDescription === "SceneDocument shared payload regression guard",
    `projectDescription mismatch: ${payload.projectDescription}`
  );
  assert(payload.pinnedVersionNumber === 7, `version number mismatch: ${payload.pinnedVersionNumber}`);
  assert(payload.linkPermission === "view", `link permission mismatch: ${payload.linkPermission}`);
  assert(payload.previewAssetSummary?.totalAssets === 2, "preview asset summary missing");
  assert(payload.sceneBootstrap, "sceneBootstrap missing from shared payload");

  const patch = toSceneStorePatch(payload.sceneBootstrap);
  const deskAsset = patch.assets.find((asset) => asset.id === "desk-1");
  const lampAsset = patch.assets.find((asset) => asset.id === "lamp-1");
  const savedLampPlacement = payload.sceneBootstrap.document.nodes.find((node) => node.id === "lamp-1")?.placement;

  assert(deskAsset && lampAsset, "shared payload assets missing");
  assert(lampAsset.supportAssetId === "desk-1", `lamp support mismatch: ${lampAsset.supportAssetId}`);
  assert(lampAsset.anchorType === "desk_surface", `lamp anchor mismatch: ${lampAsset.anchorType}`);
  assert(deskAsset.supportProfile?.surfaces[0]?.id === "desk-top", "desk support profile missing");
  assert(lampAsset.product?.scaleLocked === true, "lamp scaleLocked missing");
  assert(lampAsset.product?.finishMaterial === "powder coated steel", "lamp finishMaterial missing");
  assert(lampAsset.product?.source?.path === "assets/blender/deskterior/p2s_desk_lamp_glow.blend", "lamp source metadata missing");
  assert(lampAsset.product?.license?.spdx === "LicenseRef-DeskteriorOnline-Internal", "lamp license metadata missing");
  assert(lampAsset.product?.pivot?.y === "floor", "lamp pivot metadata missing");
  assert(lampAsset.product?.collisionProxy?.kind === "box", "lamp collisionProxy metadata missing");
  assert(lampAsset.product?.textureSet?.ktx2Ready === false, "lamp textureSet metadata missing");
  assert(lampAsset.product?.lodProfile?.maxDrawCalls === 12, "lamp lodProfile metadata missing");

  const loadedLampPlacement = serializeScenePlacement({
    position: lampAsset.position,
    rotation: lampAsset.rotation,
    scale: lampAsset.scale
  });

  assert(
    JSON.stringify(savedLampPlacement) === JSON.stringify(loadedLampPlacement),
    `shared lamp placement mismatch: ${JSON.stringify({ savedLampPlacement, loadedLampPlacement })}`
  );

  console.log("public scene payload ok");
  console.log(
    JSON.stringify(
      {
        token: payload.token,
        projectName: payload.projectName,
        pinnedVersionNumber: payload.pinnedVersionNumber,
        assets: patch.assets.map((asset) => ({
          id: asset.id,
          anchorType: asset.anchorType,
          supportAssetId: asset.supportAssetId ?? null
        }))
      },
      null,
      2
    )
  );
} catch (error) {
  console.error("[verify-public-scene-payload] failed");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
