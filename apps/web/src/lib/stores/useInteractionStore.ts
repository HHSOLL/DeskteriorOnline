import { create } from "zustand";

export type InteractionHint = {
  label: string;
  actionable: boolean;
  tone: "ready" | "blocked" | "info";
};

type InteractionState = {
  hint: InteractionHint | null;
  setHint: (hint: InteractionHint | null) => void;
};

export const useInteractionStore = create<InteractionState>((set) => ({
  hint: null,
  setHint: (hint) => set({ hint })
}));
