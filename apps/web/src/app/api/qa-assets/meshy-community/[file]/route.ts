import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import {
  MESHY_COMMUNITY_ASSET_FILE_SET,
  MESHY_COMMUNITY_SOURCE_ROOT_RELATIVE
} from "../../../../../lib/qa/meshy-community-assets";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const REPO_ROOT = path.resolve(process.cwd(), "../..");
const SELECTED_GLB_ROOT = path.join(REPO_ROOT, MESHY_COMMUNITY_SOURCE_ROOT_RELATIVE);

export async function GET(_request: Request, { params }: { params: { file: string } }) {
  const file = decodeURIComponent(params.file);
  if (!MESHY_COMMUNITY_ASSET_FILE_SET.has(file)) {
    return NextResponse.json({ error: "Unknown QA asset." }, { status: 404 });
  }

  const assetPath = path.join(SELECTED_GLB_ROOT, file);
  if (!assetPath.startsWith(`${SELECTED_GLB_ROOT}${path.sep}`)) {
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
        "X-Deskterior-Asset-Source": "Meshy community public model"
      }
    });
  } catch {
    return NextResponse.json({ error: "QA asset source file is unavailable." }, { status: 404 });
  }
}
