import type { SceneAsset } from "../stores/useSceneStore";
import type { TopViewInteractionPolicy } from "./top-view-policy";

export const DESK_PRECISION_HOTKEY_COMMIT_DELAY_MS = 280;

export type DeskPrecisionHotkeyEvent = {
  key: string;
  code?: string;
  altKey?: boolean;
  shiftKey?: boolean;
};

export type DeskPrecisionHotkeyPreview = {
  updates: {
    position?: SceneAsset["position"];
    rotation?: SceneAsset["rotation"];
  };
  label: "Nudge asset" | "Rotate asset";
  transformMode?: "translate" | "rotate";
  commitMode: "preview-batched";
};

function resolvePrecisionMoveStep(event: DeskPrecisionHotkeyEvent, defaultStep: number) {
  if (event.altKey) return 0.001;
  if (event.shiftKey) return 0.01;
  return defaultStep;
}

function resolvePrecisionRotateStep(event: DeskPrecisionHotkeyEvent, defaultStep: number) {
  if (event.altKey) return Math.PI / 1800;
  if (event.shiftKey) return Math.PI / 12;
  return defaultStep;
}

export function resolveDeskPrecisionHotkeyPreview(input: {
  event: DeskPrecisionHotkeyEvent;
  asset: Pick<SceneAsset, "position" | "rotation">;
  policy: TopViewInteractionPolicy;
}): DeskPrecisionHotkeyPreview | null {
  const { event, asset, policy } = input;
  const key =
    event.code === "KeyQ"
      ? "q"
      : event.code === "KeyE"
        ? "e"
        : event.code === "KeyR"
          ? "r"
          : event.key.toLowerCase();
  const moveStep = resolvePrecisionMoveStep(event, policy.translationSnap);

  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    const direction = event.key === "ArrowLeft" ? -1 : 1;
    return {
      updates: {
        position: [
          asset.position[0] + direction * moveStep,
          asset.position[1],
          asset.position[2]
        ]
      },
      label: "Nudge asset",
      transformMode: "translate",
      commitMode: "preview-batched"
    };
  }

  if (event.key === "ArrowUp" || event.key === "ArrowDown") {
    const direction = event.key === "ArrowUp" ? -1 : 1;
    return {
      updates: {
        position: [
          asset.position[0],
          asset.position[1],
          asset.position[2] + direction * moveStep
        ]
      },
      label: "Nudge asset",
      transformMode: "translate",
      commitMode: "preview-batched"
    };
  }

  if (key === "q" || key === "e" || key === "r") {
    const direction = key === "q" ? -1 : 1;
    return {
      updates: {
        rotation: [
          asset.rotation[0],
          asset.rotation[1] + direction * resolvePrecisionRotateStep(event, policy.rotateStep),
          asset.rotation[2]
        ]
      },
      label: "Rotate asset",
      transformMode: "rotate",
      commitMode: "preview-batched"
    };
  }

  return null;
}
