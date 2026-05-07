import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../../../lib/supabase/server";
import {
  deleteProjectForOwner,
  getProjectByOwner,
  ProjectApiError
} from "../../../../../lib/server/projects";
import { requireAuthenticatedUserId } from "../../../../../lib/server/shares";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function resolveErrorStatus(error: unknown) {
  if (!error || typeof error !== "object" || !("status" in error)) {
    return null;
  }
  const status = (error as { status?: unknown }).status;
  return typeof status === "number" ? status : null;
}

function toErrorResponse(error: unknown) {
  if (error instanceof ProjectApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  const status = resolveErrorStatus(error);
  if (error instanceof Error && status !== null) {
    return NextResponse.json({ error: error.message }, { status });
  }
  const message = error instanceof Error ? error.message : "Unexpected server error.";
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function GET(_request: Request, context: { params: { projectId: string } }) {
  const projectId = context.params.projectId;
  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  try {
    const ownerId = await requireAuthenticatedUserId(supabase);
    const project = await getProjectByOwner(supabase, ownerId, projectId);
    return NextResponse.json({ project }, { status: 200 });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: { params: { projectId: string } }) {
  const projectId = context.params.projectId;
  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  try {
    const ownerId = await requireAuthenticatedUserId(supabase);
    await deleteProjectForOwner(supabase, ownerId, projectId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
