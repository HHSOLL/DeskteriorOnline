import { create } from "zustand";

export type WalkInventoryPlacementDraft = {
  objectId: string;
  label: string;
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
