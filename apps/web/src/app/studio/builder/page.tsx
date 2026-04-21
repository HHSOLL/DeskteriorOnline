"use client";

import { Suspense, useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { AuthPopup } from "../../../components/overlay/AuthPopup";
import { StudioWorkspacePanel, StudioWorkspaceShell } from "../../../components/layout/StudioWorkspaceShell";
import { BuilderFooter } from "../../../features/builder/BuilderFooter";
import { BuilderPreviewPane } from "../../../features/builder/BuilderPreviewPane";
import { BuilderStepHeader } from "../../../features/builder/BuilderStepHeader";
import {
  BUILDER_LIGHTING_SCENE,
  BUILDER_STEPS,
  DOOR_STYLE_LABEL,
  FLOOR_FINISH_SWATCH,
  LIGHTING_MODE_LABEL,
  resolveBuilderStepIndex,
  WALL_FINISH_SWATCH,
  WINDOW_STYLE_LABEL
} from "../../../features/builder/constants";
import { buildPreviewDataUrl } from "../../../features/builder/logic/preview";
import { getWallLength } from "../../../features/builder/logic/openings";
import { useBuilderOpeningState } from "../../../features/builder/state/useBuilderOpeningState";
import { useBuilderSceneSync } from "../../../features/builder/state/useBuilderSceneSync";
import { BuilderDimensionsStep } from "../../../features/builder/steps/BuilderDimensionsStep";
import { BuilderOpeningsStep } from "../../../features/builder/steps/BuilderOpeningsStep";
import { BuilderShapeStep } from "../../../features/builder/steps/BuilderShapeStep";
import { BuilderLightingStep } from "../../../features/builder/steps/BuilderLightingStep";
import { BuilderStyleStep } from "../../../features/builder/steps/BuilderStyleStep";
import type { BuilderLightingMode, DoorStyle, WindowStyle } from "../../../features/builder/types";
import { fetchAssetCatalog } from "../../../lib/api/catalog";
import { fetchRoomTemplateConfig, type BuilderFinishOption } from "../../../lib/api/room-templates";
import { createStudioProject } from "../../../lib/api/project";
import {
  DEFAULT_CATALOG,
  buildProjectAssetSummary
} from "../../../lib/builder/catalog";
import {
  buildBuilderScene,
  builderFloorFinishes,
  getBuilderDimensionControls,
  normalizeBuilderSceneInput,
  builderTemplates,
  builderWallFinishes,
  type BuilderTemplateId
} from "../../../lib/builder/templates";
import { buildSeededSceneAssets } from "../../../lib/builder/seeded-assets";
import {
  isFurnishedRoomTemplateId,
  type FurnishedRoomTemplateId,
  type TemplateSeedPreset
} from "../../../lib/builder/template-browser";
import { deriveBlankRoomShell } from "../../../lib/domain/room-shell";
import type { Opening } from "../../../lib/stores/useSceneStore";
import { useAuthStore } from "../../../lib/stores/useAuthStore";
import type { EditorViewMode } from "../../../lib/stores/useEditorStore";

type BuilderPreviewMode = Extract<EditorViewMode, "top" | "builder-preview">;
const BUILDER_AUTH_DRAFT_KEY = "deskterioronline:builder-auth-draft";

type RouteOverrides = {
  templateId: BuilderTemplateId | null;
  width: number | null;
  depth: number | null;
  nookWidth: number | null;
  nookDepth: number | null;
  wallMaterialIndex: number | null;
  floorMaterialIndex: number | null;
  projectName: string | null;
  seedPreset: TemplateSeedPreset;
  seedTemplateId: FurnishedRoomTemplateId | null;
  lightingMode: BuilderLightingMode | null;
  doorStyle: DoorStyle | null;
  windowStyle: WindowStyle | null;
  addSecondaryWindow: boolean | null;
};

type BuilderAuthDraft = {
  intent: "template" | "custom";
  stepIndex: number;
  templateId: BuilderTemplateId;
  width: number;
  depth: number;
  nookWidth: number;
  nookDepth: number;
  wallMaterialIndex: number;
  floorMaterialIndex: number;
  lightingMode: BuilderLightingMode;
  projectName: string;
  projectDescription: string;
  doorStyle: DoorStyle;
  windowStyle: WindowStyle;
  addSecondaryWindow: boolean;
  starterSetPreset: TemplateSeedPreset;
  starterTemplateId: FurnishedRoomTemplateId | null;
  openings: Opening[];
};

function isBuilderTemplateId(value: string | null): value is BuilderTemplateId {
  return builderTemplates.some((template) => template.id === value);
}

function parsePositiveNumber(value: string | null) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseIntegerValue(value: string | null) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function parseSeedPreset(value: string | null): TemplateSeedPreset {
  if (value === "partial" || value === "full") {
    return value;
  }
  return "none";
}

function parseDoorStyle(value: string | null): DoorStyle {
  if (value === "double" || value === "french") {
    return value;
  }
  return "single";
}

function parseWindowStyle(value: string | null): WindowStyle {
  if (value === "wide") {
    return value;
  }
  return "single";
}

function parseLightingMode(value: string | null): BuilderLightingMode {
  if (value === "indirect") {
    return "indirect";
  }
  return "direct";
}

function StudioBuilderPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [intent, setIntent] = useState<"template" | "custom">("template");
  const { session } = useAuthStore();
  const isAuthenticated = Boolean(session?.user);

  const [projectName, setProjectName] = useState("새 공간 디자인");
  const [projectDescription, setProjectDescription] = useState("빌더에서 생성한 기본 공간");
  const [templateId, setTemplateId] = useState<BuilderTemplateId>("rect-studio");
  const [width, setWidth] = useState(6.4);
  const [depth, setDepth] = useState(4.8);
  const [dimensionUnit, setDimensionUnit] = useState<"ft" | "cm">("cm");
  const [nookWidth, setNookWidth] = useState(2.8);
  const [nookDepth, setNookDepth] = useState(2.4);
  const [wallMaterialIndex, setWallMaterialIndex] = useState(0);
  const [floorMaterialIndex, setFloorMaterialIndex] = useState(0);
  const [lightingMode, setLightingMode] = useState<BuilderLightingMode>("direct");
  const [doorStyle, setDoorStyle] = useState<DoorStyle>("single");
  const [windowStyle, setWindowStyle] = useState<WindowStyle>("single");
  const [addSecondaryWindow, setAddSecondaryWindow] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [templateOptions, setTemplateOptions] = useState(builderTemplates);
  const [wallFinishOptions, setWallFinishOptions] = useState<BuilderFinishOption[]>([...builderWallFinishes]);
  const [floorFinishOptions, setFloorFinishOptions] = useState<BuilderFinishOption[]>([...builderFloorFinishes]);
  const [starterSetPreset, setStarterSetPreset] = useState<TemplateSeedPreset>("none");
  const [starterTemplateId, setStarterTemplateId] = useState<FurnishedRoomTemplateId | null>(null);
  const [catalogSnapshot, setCatalogSnapshot] = useState(DEFAULT_CATALOG);
  const [pendingOpeningRestore, setPendingOpeningRestore] = useState<Opening[] | null>(null);
  const [authRestoreResolved, setAuthRestoreResolved] = useState(false);
  const routeOverridesRef = useRef<RouteOverrides>({
    templateId: null,
    width: null,
    depth: null,
    nookWidth: null,
    nookDepth: null,
    wallMaterialIndex: null,
    floorMaterialIndex: null,
    lightingMode: null,
    projectName: null,
    seedPreset: "none",
    seedTemplateId: null,
    doorStyle: null,
    windowStyle: null,
    addSecondaryWindow: null
  });

  useEffect(() => {
    const query = new URLSearchParams(searchParams.toString());
    const nextIntent = query.get("intent") === "custom" ? "custom" : "template";
    const nextStepIndex = resolveBuilderStepIndex(query.get("step"));
    const requestedTemplateId = query.get("templateId");
    const routeTemplateId = isBuilderTemplateId(requestedTemplateId) ? requestedTemplateId : null;
    const nextProjectName = query.get("projectName")?.trim() || null;
    const nextWidth = parsePositiveNumber(query.get("width"));
    const nextDepth = parsePositiveNumber(query.get("depth"));
    const nextNookWidth = parsePositiveNumber(query.get("nookWidth"));
    const nextNookDepth = parsePositiveNumber(query.get("nookDepth"));
    const nextWallMaterialIndex = parseIntegerValue(query.get("wall"));
    const nextFloorMaterialIndex = parseIntegerValue(query.get("floor"));
    const nextLightingMode = parseLightingMode(query.get("lighting"));
    const nextSeedPreset = parseSeedPreset(query.get("seed"));
    const requestedSeedTemplateId = query.get("scenePreset");
    const nextSeedTemplateId = isFurnishedRoomTemplateId(requestedSeedTemplateId) ? requestedSeedTemplateId : null;
    const nextDoorStyle = parseDoorStyle(query.get("doorStyle"));
    const nextWindowStyle = parseWindowStyle(query.get("windowStyle"));
    const nextAddSecondaryWindow = query.get("secondaryWindow") === "1";

    routeOverridesRef.current = {
      templateId: routeTemplateId,
      width: nextWidth,
      depth: nextDepth,
      nookWidth: nextNookWidth,
      nookDepth: nextNookDepth,
      wallMaterialIndex: nextWallMaterialIndex,
      floorMaterialIndex: nextFloorMaterialIndex,
      lightingMode: nextLightingMode,
      projectName: nextProjectName,
      seedPreset: nextSeedPreset,
      seedTemplateId: nextSeedTemplateId,
      doorStyle: nextDoorStyle,
      windowStyle: nextWindowStyle,
      addSecondaryWindow: nextAddSecondaryWindow
    };

    setIntent(nextIntent);
    setStepIndex(nextStepIndex);
    setStarterSetPreset(nextSeedPreset);
    setStarterTemplateId(nextSeedTemplateId);
    setDoorStyle(nextDoorStyle);
    setWindowStyle(nextWindowStyle);
    setAddSecondaryWindow(nextAddSecondaryWindow);

    if (routeTemplateId) {
      setTemplateId(routeTemplateId);
    }
    if (nextWidth !== null) setWidth(nextWidth);
    if (nextDepth !== null) setDepth(nextDepth);
    if (nextNookWidth !== null) setNookWidth(nextNookWidth);
    if (nextNookDepth !== null) setNookDepth(nextNookDepth);
    if (nextWallMaterialIndex !== null) setWallMaterialIndex(nextWallMaterialIndex);
    if (nextFloorMaterialIndex !== null) setFloorMaterialIndex(nextFloorMaterialIndex);
    setLightingMode(nextLightingMode);
    setProjectName(nextProjectName ?? (nextIntent === "custom" ? "맞춤 공간 디자인" : "새 공간 디자인"));
  }, [searchParams]);

  useEffect(() => {
    let active = true;

    fetchAssetCatalog()
      .then((catalog) => {
        if (!active) return;
        setCatalogSnapshot(catalog);
      })
      .catch(() => {
        if (!active) return;
        setCatalogSnapshot(DEFAULT_CATALOG);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    fetchRoomTemplateConfig()
      .then((config) => {
        if (!active) return;
        setTemplateOptions(config.templates);
        setWallFinishOptions(config.wallFinishes);
        setFloorFinishOptions(config.floorFinishes);
      })
      .catch(() => {
        if (!active) return;
        setTemplateOptions(builderTemplates);
        setWallFinishOptions([...builderWallFinishes]);
        setFloorFinishOptions([...builderFloorFinishes]);
      });

    return () => {
      active = false;
    };
  }, []);

  const activeStep = BUILDER_STEPS[stepIndex] ?? BUILDER_STEPS[0];
  const previewMode: BuilderPreviewMode = stepIndex <= 1 ? "top" : "builder-preview";
  const isFinalStep = stepIndex === BUILDER_STEPS.length - 1;
  const normalizedBuilderInput = useMemo(
    () =>
      normalizeBuilderSceneInput({
        templateId,
        width,
        depth,
        nookWidth,
        nookDepth
      }),
    [depth, nookDepth, nookWidth, templateId, width]
  );

  useEffect(() => {
    if (Math.abs(width - normalizedBuilderInput.width) > 0.0001) {
      setWidth(normalizedBuilderInput.width);
    }
    if (Math.abs(depth - normalizedBuilderInput.depth) > 0.0001) {
      setDepth(normalizedBuilderInput.depth);
    }
    if (
      typeof normalizedBuilderInput.nookWidth === "number" &&
      Math.abs(nookWidth - normalizedBuilderInput.nookWidth) > 0.0001
    ) {
      setNookWidth(normalizedBuilderInput.nookWidth);
    }
    if (
      typeof normalizedBuilderInput.nookDepth === "number" &&
      Math.abs(nookDepth - normalizedBuilderInput.nookDepth) > 0.0001
    ) {
      setNookDepth(normalizedBuilderInput.nookDepth);
    }
  }, [depth, nookDepth, nookWidth, normalizedBuilderInput, width]);

  const dimensionControls = useMemo(
    () => getBuilderDimensionControls(normalizedBuilderInput),
    [normalizedBuilderInput]
  );
  const exposesNookWidth = dimensionControls.some((control) => control.id === "nookWidth");
  const exposesNookDepth = dimensionControls.some((control) => control.id === "nookDepth");

  const activeWallFinish = useMemo(
    () => wallFinishOptions.find((finish) => finish.id === wallMaterialIndex) ?? wallFinishOptions[0] ?? builderWallFinishes[0],
    [wallFinishOptions, wallMaterialIndex]
  );
  const activeFloorFinish = useMemo(
    () => floorFinishOptions.find((finish) => finish.id === floorMaterialIndex) ?? floorFinishOptions[0] ?? builderFloorFinishes[0],
    [floorFinishOptions, floorMaterialIndex]
  );

  const baseScene = useMemo(
    () => buildBuilderScene(normalizedBuilderInput),
    [normalizedBuilderInput]
  );
  const {
    openings,
    selectedOpeningId,
    selectedWallId,
    selectedOpening,
    selectedOpeningWall,
    selectedWallOpenings,
    setSelectedOpeningId,
    setSelectedWallId,
    setOpeningPatch,
    setEntranceOpening,
    deleteOpening,
    addOpening,
    replaceOpenings
  } = useBuilderOpeningState({
    walls: baseScene.walls,
    templateOpenings: baseScene.openings,
    doorStyle,
    windowStyle,
    addSecondaryWindow
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const restoreQuery = new URLSearchParams(window.location.search);
    const shouldRestoreAuthDraft = restoreQuery.get("authRestore") === "1";
    if (!shouldRestoreAuthDraft) {
      window.sessionStorage.removeItem(BUILDER_AUTH_DRAFT_KEY);
      setAuthRestoreResolved(true);
      return;
    }
    const rawDraft = window.sessionStorage.getItem(BUILDER_AUTH_DRAFT_KEY);
    if (!rawDraft) {
      setAuthRestoreResolved(true);
      return;
    }

    window.sessionStorage.removeItem(BUILDER_AUTH_DRAFT_KEY);
    restoreQuery.delete("authRestore");
    router.replace(`/studio/builder?${restoreQuery.toString()}`, { scroll: false });

    try {
      const draft = JSON.parse(rawDraft) as Partial<BuilderAuthDraft>;
      const restoredTemplateId =
        draft.templateId && isBuilderTemplateId(draft.templateId) ? draft.templateId : null;
      const restoredDoorStyle = draft.doorStyle ? parseDoorStyle(draft.doorStyle) : null;
      const restoredWindowStyle = draft.windowStyle ? parseWindowStyle(draft.windowStyle) : null;
      const restoredSeedPreset = draft.starterSetPreset ? parseSeedPreset(draft.starterSetPreset) : "none";
      const restoredSeedTemplateId =
        draft.starterTemplateId && isFurnishedRoomTemplateId(draft.starterTemplateId) ? draft.starterTemplateId : null;

      routeOverridesRef.current = {
        templateId: restoredTemplateId,
        width: typeof draft.width === "number" ? draft.width : routeOverridesRef.current.width,
        depth: typeof draft.depth === "number" ? draft.depth : routeOverridesRef.current.depth,
        nookWidth: typeof draft.nookWidth === "number" ? draft.nookWidth : routeOverridesRef.current.nookWidth,
        nookDepth: typeof draft.nookDepth === "number" ? draft.nookDepth : routeOverridesRef.current.nookDepth,
        wallMaterialIndex:
          typeof draft.wallMaterialIndex === "number"
            ? draft.wallMaterialIndex
            : routeOverridesRef.current.wallMaterialIndex,
        floorMaterialIndex:
          typeof draft.floorMaterialIndex === "number"
            ? draft.floorMaterialIndex
            : routeOverridesRef.current.floorMaterialIndex,
        lightingMode: draft.lightingMode ? parseLightingMode(draft.lightingMode) : routeOverridesRef.current.lightingMode,
        projectName: typeof draft.projectName === "string" ? draft.projectName : routeOverridesRef.current.projectName,
        seedPreset: restoredSeedPreset,
        seedTemplateId: restoredSeedTemplateId,
        doorStyle: restoredDoorStyle,
        windowStyle: restoredWindowStyle,
        addSecondaryWindow:
          typeof draft.addSecondaryWindow === "boolean"
            ? draft.addSecondaryWindow
            : routeOverridesRef.current.addSecondaryWindow
      };

      if (draft.intent === "custom" || draft.intent === "template") {
        setIntent(draft.intent);
      }
      if (typeof draft.stepIndex === "number") {
        setStepIndex(Math.max(0, Math.min(BUILDER_STEPS.length - 1, draft.stepIndex)));
      }
      if (restoredTemplateId) {
        setTemplateId(restoredTemplateId);
      }
      if (typeof draft.width === "number") setWidth(draft.width);
      if (typeof draft.depth === "number") setDepth(draft.depth);
      if (typeof draft.nookWidth === "number") setNookWidth(draft.nookWidth);
      if (typeof draft.nookDepth === "number") setNookDepth(draft.nookDepth);
      if (typeof draft.wallMaterialIndex === "number") setWallMaterialIndex(draft.wallMaterialIndex);
      if (typeof draft.floorMaterialIndex === "number") setFloorMaterialIndex(draft.floorMaterialIndex);
      if (draft.lightingMode) setLightingMode(parseLightingMode(draft.lightingMode));
      if (typeof draft.projectName === "string") setProjectName(draft.projectName);
      if (typeof draft.projectDescription === "string") setProjectDescription(draft.projectDescription);
      if (restoredDoorStyle) setDoorStyle(restoredDoorStyle);
      if (restoredWindowStyle) setWindowStyle(restoredWindowStyle);
      if (typeof draft.addSecondaryWindow === "boolean") setAddSecondaryWindow(draft.addSecondaryWindow);
      setStarterSetPreset(restoredSeedPreset);
      if (restoredSeedTemplateId) {
        setStarterTemplateId(restoredSeedTemplateId);
      }
      if (Array.isArray(draft.openings)) {
        setPendingOpeningRestore(draft.openings as Opening[]);
      }
    } catch {
      window.sessionStorage.removeItem(BUILDER_AUTH_DRAFT_KEY);
    } finally {
      setAuthRestoreResolved(true);
    }
  }, [router]);

  useEffect(() => {
    if (!pendingOpeningRestore) return;
    replaceOpenings(pendingOpeningRestore);
    setPendingOpeningRestore(null);
  }, [pendingOpeningRestore, replaceOpenings]);

  const scene = useMemo(
    () => ({
      ...baseScene,
      openings
    }),
    [baseScene, openings]
  );
  const derivedRoomShell = useMemo(
    () =>
      deriveBlankRoomShell({
        scale: scene.scale,
        scaleInfo: scene.scaleInfo,
        walls: scene.walls,
        openings: scene.openings,
        floors: scene.floors
      }),
    [scene.floors, scene.openings, scene.scale, scene.scaleInfo, scene.walls]
  );

  const wallEntries = useMemo(
    () =>
      scene.walls.map((wall, index) => ({
        id: wall.id,
        label: `벽 ${index + 1}`,
        length: getWallLength(wall)
      })),
    [scene.walls]
  );

  const previewDataUrl = useMemo(
    () => buildPreviewDataUrl(scene.floors[0]?.outline ?? [], scene.openings.map(({ type, wallId }) => ({ type, wallId }))),
    [scene.floors, scene.openings]
  );
  const builderLighting = useMemo(() => BUILDER_LIGHTING_SCENE[lightingMode], [lightingMode]);
  const previewWallMaterialIndex = activeStep.id === "style" || activeStep.id === "lighting" ? wallMaterialIndex : -1;
  const previewFloorMaterialIndex = activeStep.id === "style" || activeStep.id === "lighting" ? floorMaterialIndex : -1;

  useBuilderSceneSync({
    previewMode,
    derivedRoomShell,
    wallMaterialIndex: previewWallMaterialIndex,
    floorMaterialIndex: previewFloorMaterialIndex,
    lighting: builderLighting
  });

  useEffect(() => {
    if (!authRestoreResolved) return;

    const nextQuery = new URLSearchParams();
    nextQuery.set("intent", intent);
    nextQuery.set("step", BUILDER_STEPS[stepIndex]?.id ?? BUILDER_STEPS[0].id);
    nextQuery.set("templateId", templateId);
    nextQuery.set("width", String(normalizedBuilderInput.width));
    nextQuery.set("depth", String(normalizedBuilderInput.depth));
    nextQuery.set("wall", String(wallMaterialIndex));
    nextQuery.set("floor", String(floorMaterialIndex));
    nextQuery.set("lighting", lightingMode);
    nextQuery.set("projectName", projectName);
    nextQuery.set("doorStyle", doorStyle);
    nextQuery.set("windowStyle", windowStyle);

    if (exposesNookWidth) {
      nextQuery.set("nookWidth", String(normalizedBuilderInput.nookWidth ?? nookWidth));
    }
    if (exposesNookDepth) {
      nextQuery.set("nookDepth", String(normalizedBuilderInput.nookDepth ?? nookDepth));
    }
    if (starterSetPreset !== "none") {
      nextQuery.set("seed", starterSetPreset);
    }
    if (starterTemplateId) {
      nextQuery.set("scenePreset", starterTemplateId);
    }
    if (addSecondaryWindow) {
      nextQuery.set("secondaryWindow", "1");
    }

    const nextQueryString = nextQuery.toString();
    const currentQueryString = searchParams.toString();

    if (nextQueryString === currentQueryString) {
      return;
    }

    router.replace(`/studio/builder?${nextQueryString}`, { scroll: false });
  }, [
    addSecondaryWindow,
    authRestoreResolved,
    depth,
    doorStyle,
    floorMaterialIndex,
    lightingMode,
    intent,
    nookDepth,
    nookWidth,
    normalizedBuilderInput,
    projectName,
    router,
    searchParams,
    starterSetPreset,
    starterTemplateId,
    stepIndex,
    templateId,
    wallMaterialIndex,
    width,
    windowStyle,
    exposesNookDepth,
    exposesNookWidth
  ]);

  const handleAddOpening = useCallback(
    (type: "door" | "window") => {
      const createdId = addOpening(type);
      if (!createdId) {
        toast.error("개구부를 배치할 벽이 없습니다.");
      }
    },
    [addOpening]
  );

  const handleTemplateSelect = (nextTemplateId: BuilderTemplateId) => {
    const nextTemplate = templateOptions.find((template) => template.id === nextTemplateId);
    if (!nextTemplate) return;
    const normalizedTemplateInput = normalizeBuilderSceneInput({
      templateId: nextTemplate.id,
      width: nextTemplate.defaultWidth,
      depth: nextTemplate.defaultDepth,
      nookWidth: nextTemplate.defaultNookWidth,
      nookDepth: nextTemplate.defaultNookDepth
    });
    setTemplateId(nextTemplate.id);
    setWidth(normalizedTemplateInput.width);
    setDepth(normalizedTemplateInput.depth);
    setNookWidth(normalizedTemplateInput.nookWidth ?? 2.8);
    setNookDepth(normalizedTemplateInput.nookDepth ?? 2.4);
  };

  const handleDimensionControlChange = useCallback(
    (controlId: "width" | "depth" | "nookWidth" | "nookDepth", value: number) => {
      if (controlId === "width") {
        setWidth(value);
        return;
      }
      if (controlId === "depth") {
        setDepth(value);
        return;
      }
      if (controlId === "nookWidth") {
        setNookWidth(value);
        return;
      }
      setNookDepth(value);
    },
    []
  );

  const setStepWithRoute = useCallback(
    (nextStepIndex: number) => {
      const clamped = Math.max(0, Math.min(BUILDER_STEPS.length - 1, nextStepIndex));
      setStepIndex(clamped);
    },
    []
  );

  const authNextPath = useMemo(() => {
    const query = new URLSearchParams();
    query.set("intent", intent);
    query.set("step", BUILDER_STEPS[stepIndex]?.id ?? BUILDER_STEPS[0].id);
    query.set("templateId", templateId);
    query.set("width", String(normalizedBuilderInput.width));
    query.set("depth", String(normalizedBuilderInput.depth));
    query.set("wall", String(wallMaterialIndex));
    query.set("floor", String(floorMaterialIndex));
    query.set("lighting", lightingMode);
    query.set("projectName", projectName);
    query.set("doorStyle", doorStyle);
    query.set("windowStyle", windowStyle);

    if (exposesNookWidth) {
      query.set("nookWidth", String(normalizedBuilderInput.nookWidth ?? nookWidth));
    }
    if (exposesNookDepth) {
      query.set("nookDepth", String(normalizedBuilderInput.nookDepth ?? nookDepth));
    }
    if (starterSetPreset !== "none") {
      query.set("seed", starterSetPreset);
    }
    if (starterTemplateId) {
      query.set("scenePreset", starterTemplateId);
    }
    if (addSecondaryWindow) {
      query.set("secondaryWindow", "1");
    }
    query.set("authRestore", "1");

    return `/studio/builder?${query.toString()}`;
  }, [
    addSecondaryWindow,
    doorStyle,
    floorMaterialIndex,
    lightingMode,
    intent,
    nookDepth,
    nookWidth,
    normalizedBuilderInput,
    projectName,
    starterSetPreset,
    starterTemplateId,
    stepIndex,
    templateId,
    wallMaterialIndex,
    windowStyle,
    exposesNookDepth,
    exposesNookWidth
  ]);

  const persistAuthDraft = useCallback(() => {
    if (typeof window === "undefined") return;

    const draft: BuilderAuthDraft = {
      intent,
      stepIndex,
      templateId,
      width: normalizedBuilderInput.width,
      depth: normalizedBuilderInput.depth,
      nookWidth: normalizedBuilderInput.nookWidth ?? nookWidth,
      nookDepth: normalizedBuilderInput.nookDepth ?? nookDepth,
      wallMaterialIndex,
      floorMaterialIndex,
      lightingMode,
      projectName,
      projectDescription,
      doorStyle,
      windowStyle,
      addSecondaryWindow,
      starterSetPreset,
      starterTemplateId,
      openings
    };

    window.sessionStorage.setItem(BUILDER_AUTH_DRAFT_KEY, JSON.stringify(draft));
  }, [
    addSecondaryWindow,
    doorStyle,
    floorMaterialIndex,
    lightingMode,
    intent,
    nookDepth,
    nookWidth,
    normalizedBuilderInput,
    openings,
    projectDescription,
    projectName,
    starterSetPreset,
    starterTemplateId,
    stepIndex,
    templateId,
    wallMaterialIndex,
    windowStyle
  ]);

  const handleCreate = async () => {
    if (!isAuthenticated) {
      persistAuthDraft();
      setIsAuthOpen(true);
      return;
    }

    if (!projectName.trim()) {
      toast.error("프로젝트 이름을 입력해 주세요.");
      return;
    }

    setIsCreating(true);
    try {
      const seededAssets = buildSeededSceneAssets(catalogSnapshot, derivedRoomShell, starterSetPreset, starterTemplateId);
      const project = await createStudioProject({
        name: projectName.trim(),
        description: projectDescription.trim() || "빌더에서 생성한 기본 공간",
        scene: {
          roomShell: derivedRoomShell,
          assets: seededAssets,
          materials: {
            wallIndex: wallMaterialIndex,
            floorIndex: floorMaterialIndex
          },
          lighting: {
            ...builderLighting
          },
          thumbnailDataUrl: previewDataUrl,
          assetSummary: buildProjectAssetSummary(catalogSnapshot, seededAssets),
          projectName: projectName.trim(),
          projectDescription: projectDescription.trim() || "빌더에서 생성한 기본 공간",
          message: starterSetPreset === "none" ? "빌더 초기 장면" : "빌더 템플릿 장면"
        }
      });

      router.push(`/project/${project.id}?origin=builder`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "공간 생성에 실패했습니다.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleNext = () => {
    if (isFinalStep) {
      void handleCreate();
      return;
    }
    setStepWithRoute(stepIndex + 1);
  };

  const handleBack = () => {
    setStepWithRoute(stepIndex - 1);
  };

  return (
    <div className="mt-12 h-[calc(100dvh-3rem)] overflow-hidden bg-[#f3f2ef] px-3 pb-3 pt-3 text-[#171411] sm:px-4 md:pt-4 lg:px-6">
      <div className="mx-auto h-full max-w-[1540px]">
        <StudioWorkspaceShell className="h-full min-h-0 gap-0 overflow-hidden rounded-[32px] border border-black/10 bg-white shadow-[0_24px_80px_rgba(48,38,26,0.12)] md:grid-cols-[minmax(340px,34vw)_minmax(0,1fr)]">
          <StudioWorkspacePanel className="grid min-h-0 grid-rows-[minmax(0,1fr)_auto] rounded-none border-0 border-b border-black/10 bg-white shadow-none lg:border-b-0 lg:border-r lg:border-black/10">
            <div className="min-h-0 overflow-y-auto p-6 sm:p-8 xl:p-9">
              <BuilderStepHeader activeStep={activeStep} />

              <div className="mt-8 space-y-6">
                {stepIndex === 0 ? (
                  <BuilderShapeStep
                    templateOptions={templateOptions}
                    templateId={templateId}
                    onSelectTemplate={handleTemplateSelect}
                  />
                ) : null}

                {stepIndex === 1 ? (
                  <BuilderDimensionsStep
                    unit={dimensionUnit}
                    controls={dimensionControls}
                    outline={scene.floors[0]?.outline ?? []}
                    onUnitChange={setDimensionUnit}
                    onControlChange={handleDimensionControlChange}
                  />
                ) : null}

                {stepIndex === 2 ? (
                  <BuilderOpeningsStep
                    doorStyle={doorStyle}
                    windowStyle={windowStyle}
                    addSecondaryWindow={addSecondaryWindow}
                    doorStyleLabels={DOOR_STYLE_LABEL}
                    windowStyleLabels={WINDOW_STYLE_LABEL}
                    wallEntries={wallEntries}
                    selectedWallId={selectedWallId}
                    selectedWallOpenings={selectedWallOpenings}
                    selectedOpeningId={selectedOpeningId}
                    selectedOpening={selectedOpening}
                    selectedOpeningWall={selectedOpeningWall}
                    onDoorStyleChange={setDoorStyle}
                    onWindowStyleChange={setWindowStyle}
                    onAddSecondaryWindowChange={setAddSecondaryWindow}
                    onSelectWall={setSelectedWallId}
                    onSelectOpening={setSelectedOpeningId}
                    onAddOpening={handleAddOpening}
                    onDeleteOpening={deleteOpening}
                    onPatchOpening={setOpeningPatch}
                    onSetEntrance={setEntranceOpening}
                    getWallLength={getWallLength}
                  />
                ) : null}

                {stepIndex === 3 ? (
                  <BuilderStyleStep
                    wallMaterialIndex={wallMaterialIndex}
                    floorMaterialIndex={floorMaterialIndex}
                    wallFinishOptions={wallFinishOptions}
                    floorFinishOptions={floorFinishOptions}
                    wallFinishSwatch={WALL_FINISH_SWATCH}
                    floorFinishSwatch={FLOOR_FINISH_SWATCH}
                    onWallMaterialIndexChange={setWallMaterialIndex}
                    onFloorMaterialIndexChange={setFloorMaterialIndex}
                  />
                ) : null}

                {stepIndex === 4 ? (
                  <BuilderLightingStep
                    lightingMode={lightingMode}
                    onLightingModeChange={setLightingMode}
                  />
                ) : null}
              </div>
            </div>

            <BuilderFooter
              stepIndex={stepIndex}
              isFinalStep={isFinalStep}
              isCreating={isCreating}
              onBack={handleBack}
              onNext={handleNext}
            />
          </StudioWorkspacePanel>

          <BuilderPreviewPane
            stepId={activeStep.id}
            previewMode={previewMode}
            unit={dimensionUnit}
            outline={scene.floors[0]?.outline ?? []}
            wallEntries={wallEntries}
            wallFinishName={activeWallFinish.name}
            floorFinishName={activeFloorFinish.name}
            lightingModeLabel={LIGHTING_MODE_LABEL[lightingMode]}
            doorCount={scene.openings.filter((opening) => opening.type === "door").length}
            windowCount={scene.openings.filter((opening) => opening.type === "window").length}
            selectedWallLabel={wallEntries.find((wall) => wall.id === selectedWallId)?.label ?? null}
            selectedOpening={selectedOpening}
          />
        </StudioWorkspaceShell>
      </div>

      <AuthPopup
        isOpen={isAuthOpen}
        onClose={() => {
          if (typeof window !== "undefined") {
            window.sessionStorage.removeItem(BUILDER_AUTH_DRAFT_KEY);
          }
          setIsAuthOpen(false);
        }}
        nextPath={authNextPath}
      />
    </div>
  );
}

export default function StudioBuilderPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f3f2ef]" />}>
      <StudioBuilderPageContent />
    </Suspense>
  );
}
