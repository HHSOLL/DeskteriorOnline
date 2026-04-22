import { createEngine } from "@deskterioronline/engine-core";
import { ThreeRendererAdapter } from "@deskterioronline/renderer-three";
import {
  migrateLegacySceneStoreStateToV2,
  type LegacySceneStoreStateLike
} from "@deskterioronline/scene-schema";
import * as THREE from "three";
import {
  applyRuntimeTransformToObject,
  resolveRuntimeAssetTransform,
  resolveRuntimeAssetVisibility
} from "../src/lib/runtime/runtime-render-sync";
import type { SceneAsset } from "../src/lib/stores/useSceneStore";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function closeTo(actual: number, expected: number, epsilon = 1e-4) {
  return Math.abs(actual - expected) <= epsilon;
}

const legacyState: LegacySceneStoreStateLike = {
  scale: 1,
  scaleInfo: {
    value: 1,
    source: "user_measure" as const,
    confidence: 1
  },
  walls: [],
  openings: [],
  floors: [
    {
      id: "floor-1",
      outline: [
        [0, 0] as [number, number],
        [4, 0] as [number, number],
        [4, 3] as [number, number],
        [0, 3] as [number, number]
      ],
      materialId: null
    }
  ],
  ceilings: [],
  rooms: [],
  cameraAnchors: [],
  navGraph: { nodes: [], edges: [] },
  assets: [
    {
      id: "desk-1",
      assetId: "p2s_desk_oak",
      catalogItemId: "p2s_desk_oak",
      position: [1.2, 0, 1.1],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      materialId: "oak-natural"
    }
  ],
  wallMaterialIndex: 0,
  floorMaterialIndex: 0,
  lighting: {
    mode: "direct",
    ambientIntensity: 0.4,
    hemisphereIntensity: 0.4,
    directionalIntensity: 1.2,
    environmentBlur: 0.1,
    accentIntensity: 0.8,
    beamOpacity: 0.2
  }
};

try {
  const document = migrateLegacySceneStoreStateToV2(legacyState, {
    id: "verify-runtime-render-sync",
    version: 2
  });
  const engine = createEngine(document);
  const adapter = new ThreeRendererAdapter();
  const asset = legacyState.assets[0]! as SceneAsset;
  const object = new THREE.Group();
  object.position.set(0, 0, 0);
  object.rotation.set(0, 0, 0);
  object.scale.set(1, 1, 1);

  engine.beginObjectPreview(asset.id);
  engine.previewObjectTransform(asset.id, {
    position: [1.95, 0.1, 1.45],
    rotation: [0, 0.4, 0]
  });
  adapter.syncRuntimeScene(engine.runtimeScene);

  const previewTransform = resolveRuntimeAssetTransform(adapter, engine, asset);
  const changed = applyRuntimeTransformToObject(object, previewTransform);
  assert(changed, "runtime render sync should apply the preview transform");
  assert(closeTo(object.position.x, 1.95), "preview x position should be applied to the object");
  assert(closeTo(object.position.y, 0.1), "preview y position should be applied to the object");
  assert(closeTo(object.rotation.y, 0.4), "preview rotation should be applied to the object");
  assert(adapter.getObjectHandle(asset.id)?.materialId === "oak-natural", "renderer snapshot should retain material assignment");

  const unchanged = applyRuntimeTransformToObject(object, previewTransform);
  assert(!unchanged, "applying the same preview twice should be a no-op");
  assert(resolveRuntimeAssetVisibility(adapter, engine, asset) === true, "runtime visibility should default to visible");

  console.log("runtime render sync ok");
  console.log(
    JSON.stringify(
      {
        objectPosition: [object.position.x, object.position.y, object.position.z],
        objectRotation: [object.rotation.x, object.rotation.y, object.rotation.z],
        materialId: adapter.getObjectHandle(asset.id)?.materialId ?? null,
        visible: resolveRuntimeAssetVisibility(adapter, engine, asset)
      },
      null,
      2
    )
  );
} catch (error) {
  console.error("[verify-runtime-render-sync] failed");
  console.error(error);
  process.exitCode = 1;
}
