import { NextResponse } from "next/server";
import { z } from "zod";
import { recordSharedProjectActivityByToken } from "../../../../../../lib/server/showcase-activity";

export const runtime = "nodejs";

const activityPayloadSchema = z.object({
  eventType: z.enum(["view", "product_focus"]),
  sessionKey: z.string().trim().min(1).max(120),
  source: z.string().trim().max(48).optional().nullable(),
  assetId: z.string().trim().max(120).optional().nullable()
});

export async function POST(request: Request, context: { params: { token: string } }) {
  const token = context.params.token?.trim();
  if (!token) {
    return NextResponse.json({ error: "Token is required." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = activityPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid activity payload." },
      {
        status: 400,
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  }

  try {
    const result = await recordSharedProjectActivityByToken({
      token,
      eventType: parsed.data.eventType,
      sessionKey: parsed.data.sessionKey,
      source: parsed.data.source?.trim() || null,
      assetId: parsed.data.assetId?.trim() || null
    });

    return NextResponse.json(result, {
      status: 200,
      headers: {
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Activity tracking is unavailable.";
    return NextResponse.json(
      { recorded: false, deduped: false, degraded: true, error: message },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  }
}
