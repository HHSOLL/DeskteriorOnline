"use client";

import { createContext, useContext, type MutableRefObject, type ReactNode } from "react";
import type { ThreeRendererAdapter } from "@deskterioronline/renderer-three";

export type RuntimeRendererBridgeState = {
  adapterRef: MutableRefObject<ThreeRendererAdapter | null>;
};

const RuntimeRendererContext = createContext<RuntimeRendererBridgeState | null>(null);

export function RuntimeRendererProvider({
  value,
  children
}: {
  value: RuntimeRendererBridgeState;
  children: ReactNode;
}) {
  return <RuntimeRendererContext.Provider value={value}>{children}</RuntimeRendererContext.Provider>;
}

export function useRuntimeRendererBridgeState() {
  return useContext(RuntimeRendererContext);
}

export function useRuntimeRendererAdapter() {
  return useRuntimeRendererBridgeState()?.adapterRef.current ?? null;
}
