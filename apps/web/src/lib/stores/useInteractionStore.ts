import { create } from "zustand";

export type InteractionHint = {
  label: string;
  actionable: boolean;
  tone: "ready" | "blocked" | "info";
};

type InteractionState = {
  hint: InteractionHint | null;
  walkPointerLocked: boolean;
  walkPointerLockBlocked: boolean;
  setHint: (hint: InteractionHint | null) => void;
  setWalkPointerLockStatus: (status: {
    locked?: boolean;
    blocked?: boolean;
  }) => void;
};

export const useInteractionStore = create<InteractionState>((set) => ({
  hint: null,
  walkPointerLocked: false,
  walkPointerLockBlocked: false,
  setHint: (hint) => set({ hint }),
  setWalkPointerLockStatus: (status) =>
    set((state) => ({
      walkPointerLocked: status.locked ?? state.walkPointerLocked,
      walkPointerLockBlocked: status.blocked ?? state.walkPointerLockBlocked
    }))
}));
