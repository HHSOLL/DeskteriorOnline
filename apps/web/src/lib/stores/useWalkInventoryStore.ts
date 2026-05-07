import { create } from "zustand";
import type { SceneAnchorType } from "../scene/anchor-types";
import type { SceneAsset } from "./useSceneStore";

export type WalkInventoryPlacementDraft = {
  objectId: string;
  label: string;
  asset: SceneAsset;
  anchorType: SceneAnchorType;
  placementMode: "world" | "surface";
  catalogItemId: string;
  assetId: string;
  createdAt: number;
};

type WalkInventoryState = {
  placementDraft: WalkInventoryPlacementDraft | null;
  setPlacementDraft: (draft: WalkInventoryPlacementDraft) => void;
  clearPlacementDraft: () => void;
};

export const useWalkInventoryStore = create<WalkInventoryState>((set) => ({
  placementDraft: null,
  setPlacementDraft: (draft) => set({ placementDraft: draft }),
  clearPlacementDraft: () => set({ placementDraft: null })
}));
