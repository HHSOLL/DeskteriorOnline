"use client";

import { useEffect, useRef } from "react";
import { ThreeRendererAdapter } from "@deskterioronline/renderer-three";

declare global {
  interface Window {
    __DESKTERIORONLINE_RUNTIME_RENDERER__?: ThreeRendererAdapter;
  }
}

export function useRuntimeRendererBridge() {
  const adapterRef = useRef<ThreeRendererAdapter | null>(null);

  if (!adapterRef.current) {
    adapterRef.current = new ThreeRendererAdapter();
  }

  useEffect(() => {
    window.__DESKTERIORONLINE_RUNTIME_RENDERER__ = adapterRef.current ?? undefined;
  }, []);

  return {
    adapterRef
  };
}
