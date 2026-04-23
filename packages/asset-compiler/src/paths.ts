import path from "node:path";
import { fileURLToPath } from "node:url";
import type { AssetCompilerPaths } from "./types";

const moduleFile = fileURLToPath(import.meta.url);
const moduleDir = path.dirname(moduleFile);

export function createAssetCompilerPaths(): AssetCompilerPaths {
  const repoRoot = path.resolve(moduleDir, "../../..");
  const appRoot = path.join(repoRoot, "apps", "web");
  const publicRoot = path.join(appRoot, "public");

  return {
    repoRoot,
    appRoot,
    publicRoot,
    manifestPath: path.join(publicRoot, "assets", "catalog", "manifest.json"),
    webScriptDir: path.join(appRoot, "scripts"),
    ingestDraftDir: path.join(repoRoot, "assets", "ingest-staging"),
    runtimePackageDir: path.join(publicRoot, "assets", "catalog", "runtime-packages"),
    runtimePackageIndexPath: path.join(publicRoot, "assets", "catalog", "runtime-packages.json")
  };
}
