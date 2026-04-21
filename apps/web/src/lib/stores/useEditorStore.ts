import { create } from "zustand";

export type EditorViewMode = "top" | "walk" | "builder-preview";
export type EditorTopMode = "room" | "desk-precision";
export type TransformMode = "translate" | "rotate";
export type TransformSpace = "world" | "local";

export type EditorPanels = {
  properties: boolean;
  assets: boolean;
};

export type EditorShellPreset = "editor" | "viewer";

type EditorShellState = {
  viewMode: EditorViewMode;
  topMode: EditorTopMode;
  selectedId: string | null;
  panels: EditorPanels;
  transformMode: TransformMode;
  transformSpace: TransformSpace;
  isTransforming: boolean;
  readOnly: boolean;
};

type EditorShellOverrides = Partial<Omit<EditorShellState, "panels">> & {
  panels?: Partial<EditorPanels>;
};

type EditorState = {
  viewMode: EditorViewMode;
  topMode: EditorTopMode;
  selectedId: string | null;
  panels: EditorPanels;
  transformMode: TransformMode;
  transformSpace: TransformSpace;
  isTransforming: boolean;
  readOnly: boolean;
  setViewMode: (mode: EditorViewMode) => void;
  setTopMode: (mode: EditorTopMode) => void;
  setSelectedId: (id: string | null) => void;
  openPanel: (panel: keyof EditorPanels) => void;
  closePanel: (panel: keyof EditorPanels) => void;
  togglePanel: (panel: keyof EditorPanels) => void;
  setPanels: (panels: Partial<EditorPanels>) => void;
  setTransformMode: (mode: TransformMode) => void;
  setTransformSpace: (space: TransformSpace) => void;
  setIsTransforming: (value: boolean) => void;
  setReadOnly: (value: boolean) => void;
  applyShellPreset: (
    preset: EditorShellPreset,
    overrides?: EditorShellOverrides
  ) => void;
  resetShellState: (overrides?: EditorShellOverrides) => void;
};

const editorShellDefaults: EditorShellState = {
  viewMode: "top",
  topMode: "room",
  selectedId: null,
  panels: {
    properties: false,
    assets: false
  },
  transformMode: "translate",
  transformSpace: "world",
  isTransforming: false,
  readOnly: false
};

const viewerShellDefaults: EditorShellState = {
  ...editorShellDefaults,
  readOnly: true
};

function resolveShellState(
  base: EditorShellState,
  overrides?: EditorShellOverrides
): EditorShellState {
  return {
    ...base,
    ...overrides,
    panels: {
      ...base.panels,
      ...overrides?.panels
    }
  };
}

export const useEditorStore = create<EditorState>((set) => ({
  ...editorShellDefaults,
  setViewMode: (mode) => set({ viewMode: mode }),
  setTopMode: (mode) => set({ topMode: mode }),
  setSelectedId: (id) => set({ selectedId: id }),
  openPanel: (panel) =>
    set((state) => ({ panels: { ...state.panels, [panel]: true } })),
  closePanel: (panel) =>
    set((state) => ({ panels: { ...state.panels, [panel]: false } })),
  togglePanel: (panel) =>
    set((state) => ({
      panels: { ...state.panels, [panel]: !state.panels[panel] }
    })),
  setPanels: (panels) =>
    set((state) => ({ panels: { ...state.panels, ...panels } })),
  setTransformMode: (mode) => set({ transformMode: mode }),
  setTransformSpace: (space) => set({ transformSpace: space }),
  setIsTransforming: (value) => set({ isTransforming: value }),
  setReadOnly: (value) => set({ readOnly: value }),
  applyShellPreset: (preset, overrides) =>
    set(
      resolveShellState(
        preset === "viewer" ? viewerShellDefaults : editorShellDefaults,
        overrides
      )
    ),
  resetShellState: (overrides) =>
    set(resolveShellState(editorShellDefaults, overrides))
}));
