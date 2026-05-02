import assert from "node:assert/strict";
import {
  resolveSceneRenderQuality,
  type SceneInteractionMode
} from "../src/lib/scene/render-quality";
import type { EditorTopMode, EditorViewMode } from "../src/lib/stores/useEditorStore";

type RenderPolicyCase = {
  label: string;
  interactionMode: SceneInteractionMode;
  viewMode: EditorViewMode;
  topMode: EditorTopMode;
  expectedFrameLoop: "always" | "demand";
};

const cases: RenderPolicyCase[] = [
  {
    label: "editor top room idles on demand",
    interactionMode: "editor",
    viewMode: "top",
    topMode: "room",
    expectedFrameLoop: "demand"
  },
  {
    label: "editor desk precision idles on demand",
    interactionMode: "editor",
    viewMode: "top",
    topMode: "desk-precision",
    expectedFrameLoop: "demand"
  },
  {
    label: "builder preview idles on demand",
    interactionMode: "preview",
    viewMode: "builder-preview",
    topMode: "room",
    expectedFrameLoop: "demand"
  },
  {
    label: "shared viewer top idles on demand",
    interactionMode: "viewer-shared",
    viewMode: "top",
    topMode: "room",
    expectedFrameLoop: "demand"
  },
  {
    label: "shared viewer walk stays continuous",
    interactionMode: "viewer-shared",
    viewMode: "walk",
    topMode: "room",
    expectedFrameLoop: "always"
  },
  {
    label: "editor walk stays continuous",
    interactionMode: "editor",
    viewMode: "walk",
    topMode: "room",
    expectedFrameLoop: "always"
  },
  {
    label: "showcase walk keeps cinematic continuous rendering",
    interactionMode: "viewer-showcase",
    viewMode: "walk",
    topMode: "room",
    expectedFrameLoop: "always"
  }
];

function main() {
  const results = cases.map((testCase) => {
    const quality = resolveSceneRenderQuality({
      interactionMode: testCase.interactionMode,
      viewMode: testCase.viewMode,
      topMode: testCase.topMode,
      coarsePointer: false,
      devicePixelRatio: 1,
      hardwareConcurrency: 10,
      viewportWidth: 1440
    });

    assert.equal(
      quality.frameLoop,
      testCase.expectedFrameLoop,
      `${testCase.label}: expected ${testCase.expectedFrameLoop}, got ${quality.frameLoop}`
    );

    return {
      label: testCase.label,
      frameLoop: quality.frameLoop
    };
  });

  console.log(JSON.stringify({ results }, null, 2));
}

main();
