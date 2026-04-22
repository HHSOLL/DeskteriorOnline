"use client";

import { createContext, useContext, type MutableRefObject, type ReactNode } from "react";
import type { Engine } from "@deskterioronline/engine-core";

export type RuntimeEngineBridgeState = {
  engineRef: MutableRefObject<Engine | null>;
  sceneDocumentId: string;
};

const RuntimeEngineContext = createContext<RuntimeEngineBridgeState | null>(null);

export function RuntimeEngineProvider({
  value,
  children
}: {
  value: RuntimeEngineBridgeState;
  children: ReactNode;
}) {
  return <RuntimeEngineContext.Provider value={value}>{children}</RuntimeEngineContext.Provider>;
}

export function useRuntimeEngineBridgeState() {
  return useContext(RuntimeEngineContext);
}

export function useRuntimeEngine() {
  return useRuntimeEngineBridgeState()?.engineRef.current ?? null;
}
