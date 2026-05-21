"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import gsap from "gsap";
import {
  computeLightingBoundsMm,
  resolveLightingFixtureColor,
  resolveLightingFixtures
} from "../../../lib/scene/lighting-layout";
import { useEditorStore } from "../../../lib/stores/useEditorStore";
import { useShellSelector } from "../../../lib/stores/scene-slices";
import { useInteractionRegistry } from "../interaction/InteractionManager";

type LightSpec = {
  id: string;
  position: [number, number, number];
  intensity: number;
  beamRadius: number;
  spread: number;
  color: string;
};

function createBeamMaterial(height: number, opacity: number, color: string) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uHeight: { value: height },
      uOpacity: { value: opacity },
      uColor: { value: new THREE.Color(color) }
    },
    vertexShader: `
      varying vec3 vLocalPosition;

      void main() {
        vLocalPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vLocalPosition;
      uniform float uHeight;
      uniform float uOpacity;
      uniform vec3 uColor;

      void main() {
        float vertical = clamp((uHeight * 0.5 - vLocalPosition.y) / uHeight, 0.0, 1.0);
        float radial = length(vLocalPosition.xz);
        float core = 1.0 - smoothstep(0.04, 0.36, radial);
        float falloff = 1.0 - smoothstep(0.18, 0.92, radial);
        float alpha = (core * 0.48 + falloff * 0.52) * vertical * vertical * uOpacity;
        gl_FragColor = vec4(uColor, alpha);
      }
    `
  });
}

function createFloorGlowMaterial(opacity: number, color: string) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uOpacity: { value: opacity },
      uColor: { value: new THREE.Color(color) }
    },
    vertexShader: `
      varying vec2 vUv;

      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform float uOpacity;
      uniform vec3 uColor;

      void main() {
        vec2 centered = vUv - vec2(0.5);
        float radial = length(centered * vec2(0.82, 1.1));
        float alpha = (1.0 - smoothstep(0.0, 0.52, radial)) * uOpacity;
        gl_FragColor = vec4(uColor, alpha);
      }
    `
  });
}

function createIndirectGlowMaterial(opacity: number) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uOpacity: { value: opacity },
      uColor: { value: new THREE.Color("#fff3d7") }
    },
    vertexShader: `
      varying vec2 vUv;

      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform float uOpacity;
      uniform vec3 uColor;

      void main() {
        float edge = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
        float edgeGlow = 1.0 - smoothstep(0.0, 0.18, edge);
        float centerLift = 1.0 - smoothstep(0.0, 0.72, distance(vUv, vec2(0.5)));
        float alpha = max(edgeGlow * 0.92, centerLift * 0.18) * uOpacity;
        gl_FragColor = vec4(uColor, alpha);
      }
    `
  });
}

function createDioramaWashMaterial(opacity: number, color: string, aspect: [number, number], depthTest = true) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest,
    side: THREE.DoubleSide,
    blending: THREE.NormalBlending,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    uniforms: {
      uOpacity: { value: opacity },
      uColor: { value: new THREE.Color(color) },
      uAspect: { value: new THREE.Vector2(...aspect) }
    },
    vertexShader: `
      varying vec2 vUv;

      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform float uOpacity;
      uniform vec3 uColor;
      uniform vec2 uAspect;

      void main() {
        vec2 centered = (vUv - vec2(0.5)) * uAspect;
        float radial = length(centered);
        float halo = 1.0 - smoothstep(0.08, 0.58, radial);
        float core = 1.0 - smoothstep(0.0, 0.26, radial);
        float alpha = (halo * halo * 0.76 + core * 0.18) * uOpacity;
        gl_FragColor = vec4(uColor, alpha);
      }
    `
  });
}

function LightFixture({
  spec,
  accentIntensity,
  beamOpacity
}: {
  spec: LightSpec;
  accentIntensity: number;
  beamOpacity: number;
}) {
  const registry = useInteractionRegistry();
  const rootRef = useRef<THREE.Group | null>(null);
  const bulbRef = useRef<THREE.Mesh | null>(null);
  const spotRef = useRef<THREE.SpotLight | null>(null);
  const fillRef = useRef<THREE.PointLight | null>(null);
  const targetRef = useRef<THREE.Object3D | null>(null);
  const [isOn, setIsOn] = useState(true);
  const beamHeight = Math.max(1.4, spec.position[1] - 0.04);
  const beamMaterial = useMemo(() => createBeamMaterial(beamHeight, 0, spec.color), [beamHeight, spec.color]);
  const floorGlowMaterial = useMemo(() => createFloorGlowMaterial(0, spec.color), [spec.color]);
  const targetObject = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    if (spotRef.current && targetRef.current) {
      spotRef.current.target = targetRef.current;
    }
  }, []);

  useEffect(() => {
    const nextSpotIntensity = isOn ? spec.intensity * accentIntensity * 2.1 : 0;
    const nextFillIntensity = isOn ? spec.intensity * accentIntensity * 0.3 : 0;
    const nextBulbIntensity = isOn ? 0.54 + accentIntensity * 0.72 : 0.08;
    const nextGlowOpacity = isOn ? beamOpacity : 0;

    if (spotRef.current) {
      gsap.to(spotRef.current, {
        intensity: nextSpotIntensity,
        duration: 0.45,
        ease: "power2.out"
      });
    }

    if (fillRef.current) {
      gsap.to(fillRef.current, {
        intensity: nextFillIntensity,
        duration: 0.45,
        ease: "power2.out"
      });
    }

    if (bulbRef.current?.material instanceof THREE.MeshStandardMaterial) {
      gsap.to(bulbRef.current.material, {
        emissiveIntensity: nextBulbIntensity,
        duration: 0.35,
        ease: "power2.out"
      });
    }

    gsap.to(beamMaterial.uniforms.uOpacity, {
      value: nextGlowOpacity,
      duration: 0.4,
      ease: "power2.out"
    });
    gsap.to(floorGlowMaterial.uniforms.uOpacity, {
      value: nextGlowOpacity * 0.72,
      duration: 0.4,
      ease: "power2.out"
    });
  }, [accentIntensity, beamMaterial.uniforms.uOpacity, beamOpacity, floorGlowMaterial.uniforms.uOpacity, isOn, spec.intensity]);

  useEffect(() => {
    const group = rootRef.current;
    if (!group) return;
    group.userData.interactive = true;
    group.userData.interactionLabel = "Light";
    group.userData.onInteract = () => setIsOn((prev) => !prev);
    if (bulbRef.current) {
      group.userData.highlightMesh = bulbRef.current;
    }
    registry?.register(group);
    return () => registry?.unregister(group);
  }, [registry]);

  useEffect(() => {
    return () => {
      beamMaterial.dispose();
      floorGlowMaterial.dispose();
      targetObject.removeFromParent();
    };
  }, [beamMaterial, floorGlowMaterial, targetObject]);

  return (
    <group ref={rootRef} position={spec.position}>
      <primitive object={targetObject} ref={targetRef} position={[0, -beamHeight, 0]} />
      <mesh position={[0, 0.06, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.12, 0.14, 0.04, 24]} />
        <meshStandardMaterial color="#efebe2" roughness={0.78} metalness={0.06} />
      </mesh>
      <mesh position={[0, 0.028, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.09, 0.09, 0.024, 24]} />
        <meshStandardMaterial color="#f6f2ea" roughness={0.44} metalness={0.08} />
      </mesh>
      <mesh ref={bulbRef} position={[0, 0.01, 0]} castShadow={false} receiveShadow={false}>
        <cylinderGeometry args={[0.055, 0.06, 0.028, 24]} />
        <meshStandardMaterial color="#fff6dd" emissive="#fff1c7" emissiveIntensity={1.06} roughness={0.16} />
      </mesh>
      <mesh position={[0, -beamHeight / 2, 0]} renderOrder={3}>
        <coneGeometry args={[spec.beamRadius, beamHeight, 26, 1, true]} />
        <primitive object={beamMaterial} attach="material" />
      </mesh>
      <mesh position={[0, -beamHeight + 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={3}>
        <planeGeometry args={[spec.beamRadius * 1.8, spec.beamRadius * 1.8, 1, 1]} />
        <primitive object={floorGlowMaterial} attach="material" />
      </mesh>
      <spotLight
        ref={spotRef}
        position={[0, 0.02, 0]}
        intensity={0}
        distance={beamHeight * 2.35}
        angle={spec.spread}
        penumbra={0.62}
        decay={1.7}
        color={spec.color}
      />
      <pointLight ref={fillRef} position={[0, -0.12, 0]} intensity={0} distance={3.6} decay={2.2} color={spec.color} />
    </group>
  );
}

function DioramaAccentWash({
  centerX,
  centerZ,
  width,
  depth,
  height,
  accentIntensity
}: {
  centerX: number;
  centerZ: number;
  width: number;
  depth: number;
  height: number;
  accentIntensity: number;
}) {
  const warmFloorMaterial = useMemo(
    () => createDioramaWashMaterial(Math.min(0.44, accentIntensity * 0.42), "#ff7a54", [1.02, 0.58]),
    [accentIntensity]
  );
  const coolFloorMaterial = useMemo(
    () => createDioramaWashMaterial(Math.min(0.36, accentIntensity * 0.34), "#587cff", [0.94, 0.64]),
    [accentIntensity]
  );
  const warmWallMaterial = useMemo(
    () => createDioramaWashMaterial(Math.min(0.5, accentIntensity * 0.48), "#ff5f7a", [0.62, 0.92], false),
    [accentIntensity]
  );
  const sideWarmWallMaterial = useMemo(
    () => createDioramaWashMaterial(Math.min(0.44, accentIntensity * 0.42), "#ff6f54", [0.72, 0.92], false),
    [accentIntensity]
  );
  const coolWallMaterial = useMemo(
    () => createDioramaWashMaterial(Math.min(0.46, accentIntensity * 0.44), "#6aa7ff", [0.68, 0.92], false),
    [accentIntensity]
  );

  useEffect(() => {
    return () => {
      warmFloorMaterial.dispose();
      coolFloorMaterial.dispose();
      warmWallMaterial.dispose();
      sideWarmWallMaterial.dispose();
      coolWallMaterial.dispose();
    };
  }, [coolFloorMaterial, coolWallMaterial, sideWarmWallMaterial, warmFloorMaterial, warmWallMaterial]);

  const floorY = 0.026;
  const wallY = Math.max(0.9, height * 0.48);
  const wallHeight = Math.max(1.55, height * 0.88);
  const wallOffset = 0.18;

  return (
    <group name="builder-preview-mood-wash">
      <mesh position={[centerX + width * 0.28, floorY, centerZ + depth * 0.18]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={5}>
        <planeGeometry args={[Math.max(1.9, width * 0.62), Math.max(1.45, depth * 0.64), 1, 1]} />
        <primitive object={warmFloorMaterial} attach="material" />
      </mesh>
      <mesh position={[centerX - width * 0.27, floorY + 0.003, centerZ - depth * 0.14]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={5}>
        <planeGeometry args={[Math.max(1.75, width * 0.58), Math.max(1.35, depth * 0.58), 1, 1]} />
        <primitive object={coolFloorMaterial} attach="material" />
      </mesh>
      <mesh position={[centerX + width / 2 - wallOffset, wallY, centerZ + depth * 0.06]} rotation={[0, -Math.PI / 2, 0]} renderOrder={5}>
        <planeGeometry args={[Math.max(1.95, depth * 0.78), wallHeight, 1, 1]} />
        <primitive object={warmWallMaterial} attach="material" />
      </mesh>
      <mesh position={[centerX + width * 0.2, wallY, centerZ + depth / 2 - wallOffset]} renderOrder={5}>
        <planeGeometry args={[Math.max(1.9, width * 0.58), wallHeight, 1, 1]} />
        <primitive object={sideWarmWallMaterial} attach="material" />
      </mesh>
      <mesh position={[centerX - width * 0.22, wallY, centerZ - depth / 2 + wallOffset]} renderOrder={5}>
        <planeGeometry args={[Math.max(2, width * 0.72), wallHeight, 1, 1]} />
        <primitive object={coolWallMaterial} attach="material" />
      </mesh>
    </group>
  );
}

function IndirectCeilingGlow({
  centerX,
  centerZ,
  width,
  depth,
  height,
  accentIntensity
}: {
  centerX: number;
  centerZ: number;
  width: number;
  depth: number;
  height: number;
  accentIntensity: number;
}) {
  const plateMaterial = useMemo(
    () => createIndirectGlowMaterial(Math.min(0.38, accentIntensity * 0.36)),
    [accentIntensity]
  );
  const stripMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: "#fff0ce",
        transparent: true,
        opacity: Math.min(0.34, accentIntensity * 0.32),
        depthWrite: false
      }),
    [accentIntensity]
  );

  useEffect(() => {
    return () => {
      plateMaterial.dispose();
      stripMaterial.dispose();
    };
  }, [plateMaterial, stripMaterial]);

  const stripLengthX = Math.max(1.6, width - 0.5);
  const stripLengthZ = Math.max(1.6, depth - 0.5);

  return (
    <group position={[centerX, height, centerZ]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
        <planeGeometry args={[Math.max(1.8, width), Math.max(1.8, depth), 1, 1]} />
        <primitive object={plateMaterial} attach="material" />
      </mesh>
      <mesh position={[0, -0.02, -depth / 2 + 0.18]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
        <planeGeometry args={[stripLengthX, 0.16]} />
        <primitive object={stripMaterial} attach="material" />
      </mesh>
      <mesh position={[0, -0.02, depth / 2 - 0.18]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
        <planeGeometry args={[stripLengthX, 0.16]} />
        <primitive object={stripMaterial} attach="material" />
      </mesh>
      <mesh position={[-width / 2 + 0.18, -0.02, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 2]} renderOrder={2}>
        <planeGeometry args={[stripLengthZ, 0.16]} />
        <primitive object={stripMaterial} attach="material" />
      </mesh>
      <mesh position={[width / 2 - 0.18, -0.02, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 2]} renderOrder={2}>
        <planeGeometry args={[stripLengthZ, 0.16]} />
        <primitive object={stripMaterial} attach="material" />
      </mesh>
      <pointLight
        position={[0, -0.12, 0]}
        intensity={accentIntensity * 0.42}
        distance={Math.max(width, depth) * 1.08}
        decay={2.5}
        color="#fff1d2"
      />
    </group>
  );
}

export default function InteractiveLights() {
  const walls = useShellSelector((slice) => slice.walls);
  const scale = useShellSelector((slice) => slice.scale);
  const lighting = useShellSelector((slice) => slice.lighting);
  const viewMode = useEditorStore((state) => state.viewMode);
  const isDioramaPreview = viewMode === "builder-preview";

  const layout = useMemo(() => {
    const bounds = computeLightingBoundsMm(walls, scale);
    const centerX = (bounds.minXMm + bounds.maxXMm) / 2000;
    const centerZ = (bounds.minZMm + bounds.maxZMm) / 2000;
    const width = Math.max(2, (bounds.maxXMm - bounds.minXMm) / 1000);
    const depth = Math.max(2, (bounds.maxZMm - bounds.minZMm) / 1000);
    const height = bounds.ceilingHeightMm / 1000;
    const fixtures: LightSpec[] =
      lighting.mode === "direct"
        ? resolveLightingFixtures(lighting.fixtures, bounds, 3)
            .filter((fixture) => fixture.enabled)
            .map((fixture) => ({
              id: fixture.id,
              position: [
                fixture.positionMm[0] / 1000,
                fixture.positionMm[1] / 1000,
                fixture.positionMm[2] / 1000
              ],
              intensity: fixture.intensity,
              beamRadius: fixture.beamRadiusMm / 1000,
              spread: fixture.spread,
              color: resolveLightingFixtureColor(fixture.colorTemperature)
            }))
        : [];

    return {
      centerX,
      centerZ,
      width,
      depth,
      height,
      fixtures
    };
  }, [lighting.fixtures, lighting.mode, scale, walls]);

  if (lighting.mode === "indirect") {
    return (
      <IndirectCeilingGlow
        centerX={layout.centerX}
        centerZ={layout.centerZ}
        width={layout.width}
        depth={layout.depth}
        height={layout.height - 0.03}
        accentIntensity={lighting.accentIntensity}
      />
    );
  }

  if (layout.fixtures.length === 0 && !isDioramaPreview) return null;

  return (
    <group>
      {isDioramaPreview ? (
        <DioramaAccentWash
          centerX={layout.centerX}
          centerZ={layout.centerZ}
          width={layout.width}
          depth={layout.depth}
          height={layout.height}
          accentIntensity={lighting.accentIntensity}
        />
      ) : null}
      {layout.fixtures.map((spec) => (
        <LightFixture
          key={spec.id}
          spec={spec}
          accentIntensity={lighting.accentIntensity}
          beamOpacity={lighting.beamOpacity}
        />
      ))}
    </group>
  );
}
