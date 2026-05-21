import type { AttachmentAnchor, AttachmentAnchorId, PcBuildSpec, PcPartCategory } from "./types";

export type AttachmentCandidate = {
  anchorId: AttachmentAnchorId;
  anchorLabel: string;
  ownerPartId: string;
  accepts: PcPartCategory[];
  isOccupied: boolean;
  installedPartIds: string[];
};

const STEP_TO_PART_CATEGORY: Partial<Record<string, PcPartCategory>> = {
  "cpu-seated": "cpu",
  "ram-a2-inserted": "memory",
  "ram-b2-inserted": "memory",
  "ssd-inserted": "storage",
  "motherboard-screws-tightened": "motherboard",
  "psu-mounted": "psu",
  "pump-block-mounted": "cpu-cooler",
  "radiator-mounted": "cpu-cooler",
  "case-fans-mounted": "case-fan",
  "gpu-inserted": "gpu"
};

export function getAttachmentAnchor(build: PcBuildSpec, anchorId: AttachmentAnchorId): AttachmentAnchor | null {
  return build.anchors.find((anchor) => anchor.id === anchorId) ?? null;
}

export function getCompatibleAnchors(build: PcBuildSpec, partCategory: PcPartCategory): AttachmentAnchor[] {
  return build.anchors.filter((anchor) => anchor.accepts.includes(partCategory));
}

export function getAttachmentCandidates(build: PcBuildSpec, completedStepIds: readonly string[]): AttachmentCandidate[] {
  const completed = new Set(completedStepIds);

  return build.anchors.map((anchor) => {
    const installedPartIds = Object.values(build.parts)
      .filter((part) => anchor.accepts.includes(part.category))
      .filter((part) =>
        Object.entries(STEP_TO_PART_CATEGORY).some(([stepId, category]) => category === part.category && completed.has(stepId))
      )
      .map((part) => part.id);

    return {
      anchorId: anchor.id,
      anchorLabel: anchor.label,
      ownerPartId: anchor.ownerPartId,
      accepts: anchor.accepts,
      isOccupied: installedPartIds.length > 0,
      installedPartIds
    };
  });
}

export function getAttachmentSummary(build: PcBuildSpec, completedStepIds: readonly string[]) {
  const candidates = getAttachmentCandidates(build, completedStepIds);
  const occupiedAnchorCount = candidates.filter((candidate) => candidate.isOccupied).length;

  return {
    anchorCount: candidates.length,
    occupiedAnchorCount,
    openAnchorCount: candidates.length - occupiedAnchorCount,
    candidates
  };
}
