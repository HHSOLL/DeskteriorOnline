"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { saveProject, type SaveProjectPayload } from "../../lib/api/project";
import { useProjectStore } from "../../lib/stores/useProjectStore";

type UseEditorSaveSessionOptions = {
  projectId: string;
  payload: SaveProjectPayload;
  signature: string;
  ready: boolean;
  autosaveDelayMs?: number;
};

export function useEditorSaveSession({
  projectId,
  payload,
  signature,
  ready,
  autosaveDelayMs = 3000
}: UseEditorSaveSessionOptions) {
  const [lastSavedSignature, setLastSavedSignature] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [persistedSaveCount, setPersistedSaveCount] = useState(0);
  const payloadRef = useRef(payload);
  const signatureRef = useRef(signature);
  const readyRef = useRef(false);

  payloadRef.current = payload;
  signatureRef.current = signature;

  useLayoutEffect(() => {
    if (!ready) return;
    readyRef.current = true;
    setLastSavedSignature((current) => current ?? signature);
    setLastSavedAt((current) => current ?? Date.now());
    setSaveError(null);
  }, [ready, signature]);

  const isDirty = useMemo(() => {
    if (!ready) return false;
    return lastSavedSignature !== signature;
  }, [lastSavedSignature, ready, signature]);

  const performSave = useCallback(
    async (reason: "manual" | "autosave") => {
      if (!readyRef.current || isSaving) return false;
      setIsSaving(true);
      setSaveError(null);
      const activeSignature = signatureRef.current;
      try {
        await saveProject(projectId, payloadRef.current);
        useProjectStore.setState((state) => {
          const applyProjectUpdate = (project: typeof state.currentProject) => {
            if (!project || project.id !== projectId) return project;
            const nextMetadata = {
              ...(project.metadata ?? {}),
              ...(payloadRef.current.assetSummary !== undefined
                ? { assetSummary: payloadRef.current.assetSummary }
                : {})
            };
            return {
              ...project,
              name: payloadRef.current.projectName ?? project.name,
              description:
                payloadRef.current.projectDescription !== undefined
                  ? payloadRef.current.projectDescription
                  : project.description,
              thumbnail: payloadRef.current.thumbnailDataUrl ?? project.thumbnail,
              metadata: nextMetadata
            };
          };

          return {
            currentProject: applyProjectUpdate(state.currentProject),
            projects: state.projects.map((project) => applyProjectUpdate(project) ?? project)
          };
        });
        setLastSavedSignature(activeSignature);
        setLastSavedAt(Date.now());
        setPersistedSaveCount((count) => count + 1);
        if (reason === "manual") {
          toast.success("디자인 저장이 동기화되었습니다");
        }
        return true;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Synchronization failed.";
        setSaveError(message);
        toast.error(message);
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [isSaving, projectId]
  );

  useEffect(() => {
    if (!ready || !isDirty || isSaving) return;
    const timer = window.setTimeout(() => {
      void performSave("autosave");
    }, autosaveDelayMs);
    return () => window.clearTimeout(timer);
  }, [autosaveDelayMs, isDirty, isSaving, performSave, ready, signature]);

  return {
    isDirty,
    isSaving,
    saveError,
    lastSavedAt,
    persistedSaveCount,
    triggerManualSave: () => performSave("manual"),
    markCurrentStateSaved: () => {
      setLastSavedSignature(signatureRef.current);
      setLastSavedAt(Date.now());
      setSaveError(null);
    }
  };
}
