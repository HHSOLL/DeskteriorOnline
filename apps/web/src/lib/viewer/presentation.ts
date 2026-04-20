export type SharedViewerPresentation = "shared" | "showcase";

export function resolveSharedViewerPresentation(value: unknown): SharedViewerPresentation {
  const normalized = Array.isArray(value) ? value[0] : value;
  return normalized === "showcase" ? "showcase" : "shared";
}

export function buildShowcaseViewerHref(token: string) {
  return `/shared/${encodeURIComponent(token)}?source=showcase`;
}
