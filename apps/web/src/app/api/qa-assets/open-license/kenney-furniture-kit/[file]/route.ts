import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SELECTED_KENNEY_FILES = new Set([
  "bookcaseClosedWide.glb",
  "bookcaseOpen.glb",
  "lampWall.glb",
  "loungeSofaLong.glb",
  "pottedPlant.glb",
  "rugRounded.glb",
  "tableCoffeeGlass.glb"
]);

const REPO_ROOT = path.resolve(process.cwd(), "../..");
const SELECTED_GLB_ROOT = path.join(
  REPO_ROOT,
  "assets/sources/open-license/kenney-furniture-kit/selected-glb"
);
const ASSET_PATH_BY_FILE: Record<string, string> = {
  "bookcaseClosedWide.glb": path.join(SELECTED_GLB_ROOT, "bookcaseClosedWide.glb"),
  "bookcaseOpen.glb": path.join(SELECTED_GLB_ROOT, "bookcaseOpen.glb"),
  "lampWall.glb": path.join(SELECTED_GLB_ROOT, "lampWall.glb"),
  "loungeSofaLong.glb": path.join(SELECTED_GLB_ROOT, "loungeSofaLong.glb"),
  "pottedPlant.glb": path.join(SELECTED_GLB_ROOT, "pottedPlant.glb"),
  "rugRounded.glb": path.join(SELECTED_GLB_ROOT, "rugRounded.glb"),
  "tableCoffeeGlass.glb": path.join(SELECTED_GLB_ROOT, "tableCoffeeGlass.glb")
};

export async function GET(_request: Request, { params }: { params: { file: string } }) {
  const file = decodeURIComponent(params.file);
  if (!SELECTED_KENNEY_FILES.has(file)) {
    return NextResponse.json({ error: "Unknown QA asset." }, { status: 404 });
  }

  const assetPath = ASSET_PATH_BY_FILE[file];
  if (!assetPath || !assetPath.startsWith(`${SELECTED_GLB_ROOT}${path.sep}`)) {
    return NextResponse.json({ error: "Invalid QA asset path." }, { status: 400 });
  }

  try {
    const body = await readFile(assetPath);
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Cache-Control": "public, max-age=3600",
        "Content-Length": String(body.byteLength),
        "Content-Type": "model/gltf-binary",
        "X-Deskterior-Asset-License": "CC0-1.0",
        "X-Deskterior-Asset-Source": "Kenney Furniture Kit 2.0"
      }
    });
  } catch {
    return NextResponse.json({ error: "QA asset source file is unavailable." }, { status: 404 });
  }
}
