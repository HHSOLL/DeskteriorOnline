"use client";

import { Canvas } from "@react-three/fiber";
import {
  AdaptiveDpr,
  ContactShadows,
  Environment,
  Float,
  Html,
  PerspectiveCamera,
  Preload,
  Text
} from "@react-three/drei";
import { useState, Suspense } from "react";
import type { LucideIcon } from "lucide-react";
import { DraftingCompass, LayoutDashboard, Users } from "lucide-react";

type LandingHeroCanvasProps = {
  onAction: (id: string) => void;
  layout?: "fullscreen" | "framed";
};

function GridPlane() {
  return (
    <group position={[0, -1.5, 0]}>
      <gridHelper args={[32, 32, "#d9ccba", "#efe6da"]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial color="#f7f0e5" />
      </mesh>
    </group>
  );
}

function FloatingAction({
  position,
  label,
  icon: Icon,
  onClick
}: {
  position: [number, number, number];
  label: string;
  icon: LucideIcon;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <Float speed={1.2} floatIntensity={0.4} rotationIntensity={0.06}>
      <group
        position={position}
        onClick={(event) => {
          event.stopPropagation();
          onClick();
        }}
      >
        <mesh
          castShadow
          receiveShadow
          onPointerOver={() => {
            setHovered(true);
            document.body.style.cursor = "pointer";
          }}
          onPointerOut={() => {
            setHovered(false);
            document.body.style.cursor = "auto";
          }}
        >
          <boxGeometry args={[1.6, 0.58, 0.18]} />
          <meshPhysicalMaterial
            color={hovered ? "#efe6d8" : "#ffffff"}
            roughness={0.35}
            metalness={0.06}
            transmission={0.25}
            thickness={0.8}
            ior={1.42}
          />
        </mesh>

        <Html transform distanceFactor={7} pointerEvents="none">
          <div className="flex min-w-[110px] items-center justify-center gap-2 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#3c332a]">
            <Icon size={14} />
            <span>{label}</span>
          </div>
        </Html>
      </group>
    </Float>
  );
}

function SceneContent({ onAction }: { onAction: (id: string) => void }) {
  return (
    <>
      <color attach="background" args={["#f7f0e6"]} />
      <PerspectiveCamera makeDefault position={[0, 3.2, 11.6]} fov={34} />
      <ambientLight intensity={0.9} />
      <directionalLight
        position={[6, 12, 10]}
        intensity={1}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <Environment preset="apartment" />

      <GridPlane />

      <group position={[0, 1.2, -3]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[8.4, 4.6, 0.15]} />
          <meshStandardMaterial color="#f2e8dc" />
        </mesh>

        <mesh position={[-3.2, -0.8, 0.7]} castShadow receiveShadow>
          <boxGeometry args={[1.9, 0.5, 1.2]} />
          <meshStandardMaterial color="#dfcfbb" roughness={0.8} />
        </mesh>
        <mesh position={[-0.7, -1.02, 1.1]} castShadow receiveShadow>
          <boxGeometry args={[1.05, 0.26, 1.05]} />
          <meshStandardMaterial color="#d8c6b0" roughness={0.6} />
        </mesh>
        <mesh position={[2.3, -0.7, 0.6]} castShadow receiveShadow>
          <boxGeometry args={[1.3, 1.1, 0.6]} />
          <meshStandardMaterial color="#e9ddd1" roughness={0.75} />
        </mesh>

        <Text
          position={[0, 1.7, 0.12]}
          fontSize={0.36}
          color="#453a2e"
          anchorX="center"
          anchorY="middle"
          letterSpacing={0.06}
        >
          DESKTERIORONLINE STUDIO
        </Text>
        <Text
          position={[0, 1.2, 0.12]}
          fontSize={0.11}
          color="#8d7a66"
          anchorX="center"
          anchorY="middle"
          letterSpacing={0.16}
        >
          BUILDER FIRST INTERIOR WORKFLOW
        </Text>
      </group>

      <group position={[0, -0.4, 2.5]}>
        <FloatingAction
          position={[-2.3, 0, 0]}
          label="Builder"
          icon={DraftingCompass}
          onClick={() => onAction("new")}
        />
        <FloatingAction
          position={[0, 0, 0]}
          label="Studio"
          icon={LayoutDashboard}
          onClick={() => onAction("dashboard")}
        />
        <FloatingAction
          position={[2.3, 0, 0]}
          label="Community"
          icon={Users}
          onClick={() => onAction("community")}
        />
      </group>

      <ContactShadows position={[0, -1.48, 0]} opacity={0.22} scale={24} blur={2.5} far={8} />
      <AdaptiveDpr pixelated />
      <Preload all />
    </>
  );
}

export function LandingHeroCanvas({ onAction, layout = "fullscreen" }: LandingHeroCanvasProps) {
  const isFramed = layout === "framed";

  const content = (
    <Canvas
      shadows
      dpr={[1, 1.6]}
      performance={{ min: 0.5 }}
      gl={{ antialias: true, stencil: false, depth: true, alpha: true }}
    >
      <Suspense fallback={null}>
        <SceneContent onAction={onAction} />
      </Suspense>
    </Canvas>
  );

  if (isFramed) {
    return (
      <div className="overflow-hidden rounded-[30px] border border-[#e2d7c8] bg-[#f7f0e6] shadow-[0_28px_72px_rgba(84,65,39,0.12)]">
        <div className="border-b border-[#e8decf] px-5 py-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8c7a65]">
          Interactive Builder Preview
        </div>
        <div className="aspect-[4/3]">{content}</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-[#f7f0e6]" style={{ zIndex: 0 }}>
      {content}
    </div>
  );
}
