import type { SceneDocument } from "./scene-document";

export type SceneIntegrityIssueSeverity = "info" | "warning" | "error";
export type SceneIntegrityStatus = "ok" | "warning" | "corrupt";
export type SceneRecoveryAction =
  | "review_room_shell"
  | "repair_scene_nodes"
  | "rebuild_support_relations"
  | "restore_asset_links";

export type SceneIntegrityIssue = {
  code:
    | "EMPTY_ROOM_SHELL"
    | "MISSING_NODE_ID"
    | "DUPLICATE_NODE_ID"
    | "MISSING_ASSET_ID"
    | "INVALID_NODE_SCALE"
    | "SELF_SUPPORT_REFERENCE"
    | "MISSING_SUPPORT_ASSET"
    | "SUPPORT_REFERENCE_MISMATCH"
    | "INVALID_SURFACE_SUPPORT";
  severity: SceneIntegrityIssueSeverity;
  message: string;
  nodeId?: string;
  supportObjectId?: string;
  surfaceId?: string;
};

export type SceneRecoverySnapshot = {
  nodeCount: number;
  visibleNodeCount: number;
  surfacePlacementCount: number;
  roomShellElementCount: number;
  missingAssetCount: number;
  invalidScaleCount: number;
  missingSupportReferenceCount: number;
  duplicateNodeIdCount: number;
  selfSupportReferenceCount: number;
  mismatchedSupportReferenceCount: number;
  invalidSurfacePlacementCount: number;
};

export type SceneIntegrityReport = {
  status: SceneIntegrityStatus;
  issues: SceneIntegrityIssue[];
  suggestedActions: SceneRecoveryAction[];
  recoverySnapshot: SceneRecoverySnapshot;
};

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function hasValidPositiveScale(value: unknown) {
  return (
    Array.isArray(value) &&
    value.length >= 3 &&
    typeof value[0] === "number" &&
    Number.isFinite(value[0]) &&
    value[0] > 0 &&
    typeof value[1] === "number" &&
    Number.isFinite(value[1]) &&
    value[1] > 0 &&
    typeof value[2] === "number" &&
    Number.isFinite(value[2]) &&
    value[2] > 0
  );
}

function isSurfaceLocalPlacement(
  value: unknown
): value is {
  mode: "surface_local";
  supportObjectId?: string | null;
  surfaceId?: string | null;
} {
  if (!value || typeof value !== "object" || !("mode" in value)) {
    return false;
  }
  const candidate = value as { mode?: unknown };
  return candidate.mode === "surface_local";
}

function pushIssue(
  issues: SceneIntegrityIssue[],
  seenIssueKeys: Set<string>,
  issue: SceneIntegrityIssue
) {
  const issueKey = [issue.code, issue.nodeId ?? "", issue.supportObjectId ?? "", issue.surfaceId ?? ""].join("|");
  if (seenIssueKeys.has(issueKey)) {
    return;
  }
  seenIssueKeys.add(issueKey);
  issues.push(issue);
}

export function summarizeSceneRecoverySnapshot(document: SceneDocument): SceneRecoverySnapshot {
  const roomShellElementCount =
    document.roomShell.walls.length +
    document.roomShell.openings.length +
    document.roomShell.floors.length +
    document.roomShell.ceilings.length +
    document.roomShell.rooms.length;

  const surfacePlacementCount = document.nodes.filter((node) => isSurfaceLocalPlacement(node.placement)).length;
  const missingAssetCount = document.nodes.filter((node) => !hasText(node.assetId)).length;
  const validNodeIds = new Set(document.nodes.map((node) => node.id).filter(hasText));
  const nodeIdCounts = new Map<string, number>();
  let missingSupportReferenceCount = 0;
  let invalidScaleCount = 0;
  let selfSupportReferenceCount = 0;
  let mismatchedSupportReferenceCount = 0;
  let invalidSurfacePlacementCount = 0;

  for (const node of document.nodes) {
    if (hasText(node.id)) {
      nodeIdCounts.set(node.id, (nodeIdCounts.get(node.id) ?? 0) + 1);
    }

    if (!hasValidPositiveScale(node.scale)) {
      invalidScaleCount += 1;
    }

    if (hasText(node.supportAssetId)) {
      if (hasText(node.id) && node.supportAssetId === node.id) {
        selfSupportReferenceCount += 1;
      } else if (!validNodeIds.has(node.supportAssetId)) {
        missingSupportReferenceCount += 1;
      }
    }

    if (!isSurfaceLocalPlacement(node.placement)) {
      continue;
    }

    const placement = node.placement;
    if (!hasText(placement.supportObjectId) || !hasText(placement.surfaceId)) {
      invalidSurfacePlacementCount += 1;
    }

    if (
      hasText(node.supportAssetId) &&
      hasText(placement.supportObjectId) &&
      node.supportAssetId !== placement.supportObjectId
    ) {
      mismatchedSupportReferenceCount += 1;
    }

    if (hasText(placement.supportObjectId)) {
      if (hasText(node.id) && placement.supportObjectId === node.id) {
        selfSupportReferenceCount += 1;
      } else if (!validNodeIds.has(placement.supportObjectId)) {
        missingSupportReferenceCount += 1;
      }
    }
  }

  let duplicateNodeIdCount = 0;
  for (const count of nodeIdCounts.values()) {
    if (count > 1) {
      duplicateNodeIdCount += count - 1;
    }
  }

  return {
    nodeCount: document.nodes.length,
    visibleNodeCount: document.nodes.filter((node) => node.visible !== false).length,
    surfacePlacementCount,
    roomShellElementCount,
    missingAssetCount,
    invalidScaleCount,
    missingSupportReferenceCount,
    duplicateNodeIdCount,
    selfSupportReferenceCount,
    mismatchedSupportReferenceCount,
    invalidSurfacePlacementCount
  };
}

export function inspectSceneDocumentIntegrity(document: SceneDocument): SceneIntegrityReport {
  const issues: SceneIntegrityIssue[] = [];
  const seenIssueKeys = new Set<string>();
  const knownNodeIds = new Set(document.nodes.map((node) => node.id).filter(hasText));
  const seenNodeIds = new Set<string>();

  const recoverySnapshot = summarizeSceneRecoverySnapshot(document);

  if (recoverySnapshot.roomShellElementCount === 0) {
    pushIssue(issues, seenIssueKeys, {
      code: "EMPTY_ROOM_SHELL",
      severity: "warning",
      message: "room shell geometry is empty; builder launch state fallback may be required."
    });
  }

  for (const node of document.nodes) {
    if (!hasText(node.id)) {
      pushIssue(issues, seenIssueKeys, {
        code: "MISSING_NODE_ID",
        severity: "error",
        message: "scene node is missing a stable id."
      });
    } else if (seenNodeIds.has(node.id)) {
      pushIssue(issues, seenIssueKeys, {
        code: "DUPLICATE_NODE_ID",
        severity: "error",
        message: `scene node id ${node.id} is duplicated.`,
        nodeId: node.id
      });
    } else {
      seenNodeIds.add(node.id);
    }

    if (!hasText(node.assetId)) {
      pushIssue(issues, seenIssueKeys, {
        code: "MISSING_ASSET_ID",
        severity: "error",
        message: "scene node is missing assetId and cannot be resolved at runtime.",
        nodeId: hasText(node.id) ? node.id : undefined
      });
    }

    if (!hasValidPositiveScale(node.scale)) {
      pushIssue(issues, seenIssueKeys, {
        code: "INVALID_NODE_SCALE",
        severity: "error",
        message: `scene node ${hasText(node.id) ? node.id : "(missing id)"} has an invalid scale vector.`,
        nodeId: hasText(node.id) ? node.id : undefined
      });
    }

    if (hasText(node.id) && hasText(node.supportAssetId) && node.supportAssetId === node.id) {
      pushIssue(issues, seenIssueKeys, {
        code: "SELF_SUPPORT_REFERENCE",
        severity: "error",
        message: `scene node ${node.id} references itself as a support asset.`,
        nodeId: node.id,
        supportObjectId: node.supportAssetId
      });
    }

    if (hasText(node.supportAssetId) && !knownNodeIds.has(node.supportAssetId)) {
      pushIssue(issues, seenIssueKeys, {
        code: "MISSING_SUPPORT_ASSET",
        severity: "error",
        message: `support asset ${node.supportAssetId} is missing from scene nodes.`,
        nodeId: hasText(node.id) ? node.id : undefined,
        supportObjectId: node.supportAssetId
      });
    }

    if (!isSurfaceLocalPlacement(node.placement)) {
      continue;
    }

    const placement = node.placement;
    if (!hasText(placement.supportObjectId)) {
      pushIssue(issues, seenIssueKeys, {
        code: "INVALID_SURFACE_SUPPORT",
        severity: "error",
        message: "surface-local placement is missing supportObjectId.",
        nodeId: hasText(node.id) ? node.id : undefined,
        surfaceId: hasText(placement.surfaceId) ? placement.surfaceId : undefined
      });
    } else if (hasText(node.id) && placement.supportObjectId === node.id) {
      pushIssue(issues, seenIssueKeys, {
        code: "SELF_SUPPORT_REFERENCE",
        severity: "error",
        message: `surface-local placement for ${node.id} references itself as support.`,
        nodeId: node.id,
        supportObjectId: placement.supportObjectId
      });
    } else if (!knownNodeIds.has(placement.supportObjectId)) {
      pushIssue(issues, seenIssueKeys, {
        code: "MISSING_SUPPORT_ASSET",
        severity: "error",
        message: `surface-local support asset ${placement.supportObjectId} is missing from scene nodes.`,
        nodeId: hasText(node.id) ? node.id : undefined,
        supportObjectId: placement.supportObjectId
      });
    }

    if (
      hasText(node.supportAssetId) &&
      hasText(placement.supportObjectId) &&
      node.supportAssetId !== placement.supportObjectId
    ) {
      pushIssue(issues, seenIssueKeys, {
        code: "SUPPORT_REFERENCE_MISMATCH",
        severity: "warning",
        message: `surface-local placement support ${placement.supportObjectId} does not match supportAssetId ${node.supportAssetId}.`,
        nodeId: hasText(node.id) ? node.id : undefined,
        supportObjectId: placement.supportObjectId
      });
    }

    if (!hasText(placement.surfaceId)) {
      pushIssue(issues, seenIssueKeys, {
        code: "INVALID_SURFACE_SUPPORT",
        severity: "error",
        message: "surface-local placement is missing surfaceId.",
        nodeId: hasText(node.id) ? node.id : undefined,
        supportObjectId: hasText(placement.supportObjectId) ? placement.supportObjectId : undefined
      });
    }
  }

  const suggestedActions = new Set<SceneRecoveryAction>();
  for (const issue of issues) {
    switch (issue.code) {
      case "EMPTY_ROOM_SHELL":
        suggestedActions.add("review_room_shell");
        break;
      case "MISSING_NODE_ID":
      case "DUPLICATE_NODE_ID":
      case "INVALID_NODE_SCALE":
        suggestedActions.add("repair_scene_nodes");
        break;
      case "MISSING_ASSET_ID":
        suggestedActions.add("restore_asset_links");
        break;
      case "SELF_SUPPORT_REFERENCE":
      case "MISSING_SUPPORT_ASSET":
      case "SUPPORT_REFERENCE_MISMATCH":
      case "INVALID_SURFACE_SUPPORT":
        suggestedActions.add("rebuild_support_relations");
        break;
    }
  }

  const status: SceneIntegrityStatus = issues.some((issue) => issue.severity === "error")
    ? "corrupt"
    : issues.length > 0
      ? "warning"
      : "ok";

  return {
    status,
    issues,
    suggestedActions: [...suggestedActions],
    recoverySnapshot
  };
}
