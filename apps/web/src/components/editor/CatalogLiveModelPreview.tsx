"use client";

import {
  Component,
  Suspense,
  useEffect,
  useMemo,
  type ErrorInfo,
  type ReactNode
} from "react";
import { Canvas, useThree } from "@react-three/fiber";
import * as THREE from "three";
import {
  getCatalogGenerationBadge,
  type LibraryCatalogItem
} from "../../lib/builder/catalog";
import {
  configureRuntimeAssetLoaders,
  useGLBAsset
} from "../../lib/loaders/AssetLoader";

type CatalogLiveModelPreviewProps = {
  item: LibraryCatalogItem;
  testId: string;
  preserveDrawingBufferForQa?: boolean;
};

type CatalogLiveModelPreviewBoundaryProps = {
  children: ReactNode;
};

type CatalogLiveModelPreviewBoundaryState = {
  failed: boolean;
};

type CatalogLivePreviewBounds = {
  center: THREE.Vector3;
  floorY: number;
  fitScale: number;
  width: number;
  height: number;
  depth: number;
};

type CatalogLiveModelPreviewRegistryEntry = {
  itemId: string;
  assetId: string;
  label: string;
  source: "real-glb-live-preview";
  status: "loaded";
  meshCount: number;
  materialCount: number;
  bounds: Pick<CatalogLivePreviewBounds, "width" | "height" | "depth" | "floorY" | "fitScale">;
  generatedProvider: string | null;
  reviewStatus: string | null;
  sourcePath: string | null;
};

declare global {
  interface Window {
    __DESKTERIORONLINE_CATALOG_LIVE_MODEL_PREVIEWS__?: Record<string, CatalogLiveModelPreviewRegistryEntry>;
  }
}

const livePreviewCamera = {
  position: [2.4, 1.8, 2.8] as [number, number, number],
  zoom: 72,
  near: 0.05,
  far: 50
};
const LIVE_PREVIEW_TARGET_LONGEST_EDGE = 1.55;
const LIVE_PREVIEW_MAX_FIT_SCALE = 7.5;

const livePreviewEmptyBounds: CatalogLivePreviewBounds = {
  center: new THREE.Vector3(0, 0, 0),
  floorY: 0,
  fitScale: 1,
  width: 0,
  height: 0,
  depth: 0
};

export function isCatalogLiveModelPreviewEligible(item: LibraryCatalogItem) {
  const assetId = item.assetId.trim();
  return assetId.startsWith("/assets/models/") && /\.(glb|gltf)$/i.test(assetId);
}

class CatalogLiveModelPreviewBoundary extends Component<
  CatalogLiveModelPreviewBoundaryProps,
  CatalogLiveModelPreviewBoundaryState
> {
  state: CatalogLiveModelPreviewBoundaryState = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(_error: Error, _errorInfo: ErrorInfo) {
    // Keep card fallback previews visible if a model thumbnail fails to load.
  }

  render() {
    if (this.state.failed) {
      return null;
    }

    return this.props.children;
  }
}

function CatalogLivePreviewRenderer({ item }: { item: LibraryCatalogItem }) {
  const { gl, invalidate } = useThree();
  const gltf = useGLBAsset(item.assetId);
  const model = useMemo(() => {
    const clone = gltf.scene.clone(true);
    clone.name = `catalog-live-model-preview:${item.id}`;
    clone.userData.catalogLiveModelPreview = {
      itemId: item.id,
      assetId: item.assetId,
      source: "real-glb-live-preview"
    };
    return clone;
  }, [gltf.scene, item.assetId, item.id]);
  const bounds = useMemo(() => {
    const box = new THREE.Box3().setFromObject(model);
    if (box.isEmpty()) {
      return livePreviewEmptyBounds;
    }

    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const longest = Math.max(size.x, size.y, size.z, 0.001);
    return {
      center,
      floorY: box.min.y,
      fitScale: Math.min(LIVE_PREVIEW_MAX_FIT_SCALE, LIVE_PREVIEW_TARGET_LONGEST_EDGE / longest),
      width: size.x,
      height: size.y,
      depth: size.z
    };
  }, [model]);
  const modelStats = useMemo(() => {
    const materials = new Set<THREE.Material>();
    let meshCount = 0;

    model.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;

      meshCount += 1;
      const material = mesh.material;
      if (Array.isArray(material)) {
        material.forEach((entry) => materials.add(entry));
      } else if (material) {
        materials.add(material);
      }
    });

    return {
      meshCount,
      materialCount: materials.size
    };
  }, [model]);
  const generationBadge = useMemo(() => getCatalogGenerationBadge(item), [item]);

  useEffect(() => {
    configureRuntimeAssetLoaders(gl);
    invalidate();
  }, [gl, invalidate, model]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const registry = (window.__DESKTERIORONLINE_CATALOG_LIVE_MODEL_PREVIEWS__ ??= {});
    registry[item.id] = {
      itemId: item.id,
      assetId: item.assetId,
      label: item.label,
      source: "real-glb-live-preview",
      status: "loaded",
      meshCount: modelStats.meshCount,
      materialCount: modelStats.materialCount,
      bounds: {
        width: bounds.width,
        height: bounds.height,
        depth: bounds.depth,
        floorY: bounds.floorY,
        fitScale: bounds.fitScale
      },
      generatedProvider: generationBadge?.providerLabel ?? null,
      reviewStatus: generationBadge?.reviewLabel ?? null,
      sourcePath: item.source?.path ?? null
    };

    return () => {
      delete window.__DESKTERIORONLINE_CATALOG_LIVE_MODEL_PREVIEWS__?.[item.id];
    };
  }, [
    bounds.depth,
    bounds.fitScale,
    bounds.floorY,
    bounds.height,
    bounds.width,
    generationBadge?.providerLabel,
    generationBadge?.reviewLabel,
    item.assetId,
    item.id,
    item.label,
    item.source?.path,
    modelStats.materialCount,
    modelStats.meshCount
  ]);

  return (
    <group
      position={[0, -0.58, 0]}
      rotation={[0, -Math.PI / 5, 0]}
      scale={bounds.fitScale}
    >
      <primitive
        object={model}
        position={[-bounds.center.x, -bounds.floorY, -bounds.center.z]}
      />
    </group>
  );
}

export function CatalogLiveModelPreview({
  item,
  testId,
  preserveDrawingBufferForQa = false
}: CatalogLiveModelPreviewProps) {
  if (!isCatalogLiveModelPreviewEligible(item)) {
    return null;
  }

  return (
    <CatalogLiveModelPreviewBoundary>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[3]"
        data-preview-mode="live-model"
        data-testid={testId}
      >
        <Canvas
          frameloop="demand"
          dpr={[1, 1.25]}
          orthographic
          camera={livePreviewCamera}
          gl={{
            alpha: true,
            antialias: true,
            powerPreference: "low-power",
            preserveDrawingBuffer: preserveDrawingBufferForQa
          }}
          onCreated={({ gl }) => {
            gl.outputColorSpace = THREE.SRGBColorSpace;
            gl.toneMapping = THREE.NeutralToneMapping;
            gl.toneMappingExposure = 1.08;
            gl.setClearColor(0x000000, 0);
            configureRuntimeAssetLoaders(gl);
          }}
        >
          <ambientLight intensity={0.72} />
          <directionalLight position={[2.5, 3, 2]} intensity={1.8} color="#ffd9ae" />
          <directionalLight position={[-2.5, 1.8, -2.2]} intensity={0.62} color="#b9cbff" />
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.6, 0]}>
            <circleGeometry args={[0.92, 48]} />
            <meshBasicMaterial color="#1f1712" transparent opacity={0.14} depthWrite={false} />
          </mesh>
          <Suspense fallback={null}>
            <CatalogLivePreviewRenderer item={item} />
          </Suspense>
        </Canvas>
      </span>
    </CatalogLiveModelPreviewBoundary>
  );
}
