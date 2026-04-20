import { notFound } from "next/navigation";
import { fetchPublicSceneByToken, PublicSceneError } from "../../../lib/server/public-scenes";
import { reportSceneError, reportSceneEvent } from "../../../lib/telemetry/scene-events";
import { resolveSharedViewerPresentation } from "../../../lib/viewer/presentation";
import { SharedProjectClient } from "./SharedProjectClient";

interface SharedProjectPageProps {
  params: { token: string };
  searchParams?: { source?: string | string[] };
}

export default async function SharedProjectPage({ params, searchParams }: SharedProjectPageProps) {
  const viewerPresentation = resolveSharedViewerPresentation(searchParams?.source);
  let scene: Awaited<ReturnType<typeof fetchPublicSceneByToken>> | null = null;
  let isExpired = false;
  try {
    scene = await fetchPublicSceneByToken(params.token);
    reportSceneEvent("public_viewer_scene_loaded", { token: params.token });
  } catch (error) {
    if (error instanceof PublicSceneError) {
      if (error.status === 404) {
        reportSceneError("public_viewer_scene_not_found", error, { token: params.token });
        notFound();
      }
      if (error.status === 410) {
        reportSceneError("public_viewer_scene_expired", error, { token: params.token });
        isExpired = true;
      } else {
        reportSceneError("public_viewer_scene_load_failed", error, { token: params.token });
        throw error;
      }
    } else {
      reportSceneError("public_viewer_scene_unknown_error", error, { token: params.token });
      throw error;
    }
  }

  if (isExpired) {
    return (
      <div className="min-h-screen bg-[#f5f1e8] px-4 pb-20 pt-24 text-[#171411] sm:px-6 lg:px-10">
        <div className="mx-auto max-w-3xl rounded-[30px] border border-black/10 bg-white/80 p-8 shadow-[0_20px_60px_rgba(0,0,0,0.08)]">
          <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#8a7c70]">링크 만료</div>
          <h1 className="mt-4 text-4xl font-semibold">공유 장면을 열 수 없습니다.</h1>
          <p className="mt-4 text-sm leading-7 text-[#61574e]">
            공유 토큰이 만료되었습니다. 편집자에게 새 공유 링크 발행을 요청해 주세요.
          </p>
        </div>
      </div>
    );
  }

  if (!scene) {
    notFound();
  }

  return (
    <SharedProjectClient
      projectName={scene.projectName}
      projectDescription={scene.projectDescription}
      sceneBootstrap={scene.sceneBootstrap}
      linkPermission={scene.linkPermission}
      expiresAt={scene.expiresAt}
      pinnedVersionNumber={scene.pinnedVersionNumber}
      previewAssetSummary={scene.previewAssetSummary}
      viewerPresentation={viewerPresentation}
    />
  );
}
