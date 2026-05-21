import { NextResponse } from "next/server";
import { z } from "zod";
import { ProductAssetGenerationRequestSchema } from "@deskterioronline/contracts/product-assets";
import { createSupabaseServerClient } from "../../../../../lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function resolveRailwayApiUrl() {
  const baseUrl = process.env.RAILWAY_API_URL;
  if (!baseUrl || baseUrl.trim().length === 0) {
    throw new Error("RAILWAY_API_URL is not configured.");
  }
  return baseUrl.replace(/\/$/, "");
}

function buildUpstreamErrorBody(payload: unknown, fallbackStatus: number) {
  if (payload && typeof payload === "object") {
    return payload;
  }
  return {
    error: `Product asset generation request failed (${fallbackStatus})`
  };
}

export async function POST(request: Request) {
  const supabase = createSupabaseServerClient();
  const session = await supabase.auth.getSession();
  const accessToken = session.data.session?.access_token;

  if (session.error || !accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: z.infer<typeof ProductAssetGenerationRequestSchema>;
  try {
    body = ProductAssetGenerationRequestSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request body.", details: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  try {
    const upstreamResponse = await fetch(`${resolveRailwayApiUrl()}/v1/product-assets/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`
      },
      cache: "no-store",
      body: JSON.stringify(body)
    });

    const payload = await upstreamResponse.json().catch(() => null);
    if (!upstreamResponse.ok) {
      return NextResponse.json(buildUpstreamErrorBody(payload, upstreamResponse.status), {
        status: upstreamResponse.status
      });
    }

    return NextResponse.json(payload ?? {}, { status: upstreamResponse.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
