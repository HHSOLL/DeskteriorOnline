import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";

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
    error: `Generated assets request failed (${fallbackStatus})`
  };
}

export async function GET() {
  const supabase = createSupabaseServerClient();
  const session = await supabase.auth.getSession();
  const accessToken = session.data.session?.access_token;

  if (session.error || !accessToken) {
    return NextResponse.json({ items: [] }, { status: 200 });
  }

  try {
    const upstreamResponse = await fetch(`${resolveRailwayApiUrl()}/v1/assets`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`
      },
      cache: "no-store"
    });

    const payload = await upstreamResponse.json().catch(() => null);
    if (!upstreamResponse.ok) {
      return NextResponse.json(buildUpstreamErrorBody(payload, upstreamResponse.status), {
        status: upstreamResponse.status
      });
    }

    return NextResponse.json(payload ?? { items: [] }, {
      status: upstreamResponse.status,
      headers: {
        "Cache-Control": "private, no-store, max-age=0"
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
