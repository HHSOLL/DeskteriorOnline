"use client";

import { Physics, CuboidCollider, RigidBody } from "@react-three/rapier";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { useShellSelector } from "../../../lib/stores/scene-slices";
import { getWallRenderPlacement } from "../../../lib/geometry/wall-placement";

type PhysicsWorldProps = {
  children: ReactNode;
  debug?: boolean;
  enabled?: boolean;
};

const DEFAULT_HEIGHT = 2.8;
const FLOOR_THICKNESS = 0.2;

function computeBounds(walls: { start: [number, number]; end: [number, number] }[], scale: number) {
  if (walls.length === 0) {
    return { minX: -2.5, maxX: 2.5, minZ: -2.5, maxZ: 2.5 };
  }

  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;

  walls.forEach((wall) => {
    [wall.start, wall.end].forEach(([x, z]) => {
      const scaledX = x * scale;
      const scaledZ = z * scale;
      minX = Math.min(minX, scaledX);
      maxX = Math.max(maxX, scaledX);
      minZ = Math.min(minZ, scaledZ);
      maxZ = Math.max(maxZ, scaledZ);
    });
  });

  return { minX, maxX, minZ, maxZ };
}

export default function PhysicsWorld({ children, debug, enabled = true }: PhysicsWorldProps) {
  const walls = useShellSelector((slice) => slice.walls);
  const openings = useShellSelector((slice) => slice.openings);
  const floors = useShellSelector((slice) => slice.floors);
  const scale = useShellSelector((slice) => slice.scale);

  const bounds = useMemo(() => computeBounds(walls, scale), [walls, scale]);
  const width = Math.max(1, bounds.maxX - bounds.minX + 2);
  const depth = Math.max(1, bounds.maxZ - bounds.minZ + 2);
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerZ = (bounds.minZ + bounds.maxZ) / 2;

  const wallColliders = useMemo(() => {
    const openingsByWall = new Map<string, typeof openings>();
    openings.forEach((opening) => {
      if (opening.type !== "door") return;
      const list = openingsByWall.get(opening.wallId) ?? [];
      list.push(opening);
      openingsByWall.set(opening.wallId, list);
    });

    const colliders: {
      id: string;
      args: [number, number, number];
      position: [number, number, number];
      rotation: [number, number, number];
    }[] = [];

    walls.forEach((wall) => {
      const placement = getWallRenderPlacement(wall, floors, scale);
      const dx = placement.end[0] - placement.start[0];
      const dz = placement.end[1] - placement.start[1];
      const length = placement.length;
      if (!Number.isFinite(length) || length < 0.05) return;
      const angle = -placement.angle;
      const thickness = Math.max(0.02, wall.thickness * scale);
      const height = wall.height > 0 ? wall.height : DEFAULT_HEIGHT;
      const ux = dx / length;
      const uz = dz / length;

      const wallOpenings = (openingsByWall.get(wall.id) ?? [])
        .map((opening) => ({
          offset: opening.offset * scale + placement.startInset,
          width: opening.width * scale
        }))
        .filter((opening) => opening.width > 0.05)
        .sort((a, b) => a.offset - b.offset);

      const segments: { start: number; length: number }[] = [];
      let cursor = 0;
      wallOpenings.forEach((opening) => {
        const start = Math.max(0, opening.offset);
        if (start > cursor + 0.05) {
          segments.push({ start: cursor, length: start - cursor });
        }
        cursor = Math.max(cursor, opening.offset + opening.width);
      });
      if (length - cursor > 0.05) {
        segments.push({ start: cursor, length: length - cursor });
      }

      if (segments.length === 0) {
        const midX = (placement.start[0] + placement.end[0]) * 0.5;
        const midZ = (placement.start[1] + placement.end[1]) * 0.5;
        colliders.push({
          id: wall.id,
          args: [length / 2, height / 2, thickness / 2],
          position: [midX, height / 2, midZ],
          rotation: [0, angle, 0]
        });
        return;
      }

      segments.forEach((segment, index) => {
        const midOffset = segment.start + segment.length / 2;
        const midX = placement.start[0] + ux * midOffset;
        const midZ = placement.start[1] + uz * midOffset;
        colliders.push({
          id: `${wall.id}-${index}`,
          args: [segment.length / 2, height / 2, thickness / 2],
          position: [midX, height / 2, midZ],
          rotation: [0, angle, 0]
        });
      });
    });

    return colliders;
  }, [floors, openings, scale, walls]);

  return (
    <Physics gravity={[0, -9.81, 0]}>
      {/* Floor Collider */}
      {enabled ? (
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider
            args={[width / 2, FLOOR_THICKNESS / 2, depth / 2]}
            position={[centerX, -FLOOR_THICKNESS / 2, centerZ]}
          />
        </RigidBody>
      ) : null}

      {/* Wall Colliders */}
      {enabled
        ? wallColliders.map((wall) =>
            wall ? (
              <RigidBody key={wall.id} type="fixed" colliders={false} position={wall.position} rotation={wall.rotation}>
                <CuboidCollider args={wall.args} />
              </RigidBody>
            ) : null
          )
        : null}

      {children}
    </Physics>
  );
}
