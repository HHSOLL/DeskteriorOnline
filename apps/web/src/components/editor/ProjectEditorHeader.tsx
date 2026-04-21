"use client";

import { motion } from "framer-motion";
import { ChevronLeft, LayoutGrid, Save, Settings2, Share2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { EditorStatusBadge } from "./EditorStatusBadge";
import type { EditorViewMode } from "../../lib/stores/useEditorStore";
import { useAuthStore } from "../../lib/stores/useAuthStore";
import { AuthPopup } from "../overlay/AuthPopup";

type ProjectEditorHeaderProps = {
  title: string;
  onTitleChange: (value: string) => void;
  onTitleCommit?: () => void;
  viewMode: EditorViewMode;
  canShowPanels: boolean;
  activePanel: "assets" | "properties" | null;
  onBack: () => void;
  onShowAssets: () => void;
  onShowInspector: () => void;
  onOpenShare: () => void;
  onSave: () => void;
  isSaving: boolean;
  isDirty: boolean;
  saveError: string | null;
  lastSavedAt: number | null;
};

export function ProjectEditorHeader({
  title,
  onTitleChange,
  onTitleCommit,
  viewMode,
  canShowPanels,
  activePanel,
  onBack,
  onShowAssets,
  onShowInspector,
  onOpenShare,
  onSave,
  isSaving,
  isDirty,
  saveError,
  lastSavedAt
}: ProjectEditorHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, session } = useAuthStore();
  const isAuthenticated = Boolean(session?.user);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const modeLabel = viewMode === "walk" ? "워크뷰" : "상단뷰";
  const navLinks = [
    { label: "홈", href: "/" },
    { label: "공간 선택", href: "/studio/select?mode=empty" },
    { label: "내 공간", href: "/studio" },
    { label: "갤러리", href: "/gallery" },
    { label: "커뮤니티", href: "/community" }
  ] as const;

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] border-b border-black/10 bg-white/95 backdrop-blur-xl">
        <div className="pointer-events-auto flex h-12 items-center gap-3 px-3 sm:px-4 xl:px-5">
          <div className="flex min-w-0 items-center gap-4">
            <button
              type="button"
              onClick={() => router.push("/")}
              className="text-left text-[14px] font-semibold tracking-[-0.04em] text-[#171411]"
            >
              DeskteriorOnline
            </button>
            <button
              type="button"
              onClick={onBack}
              className="group flex h-8 w-8 items-center justify-center rounded-full border border-black/10 bg-white transition hover:border-black/20 hover:bg-[#f4f4f1] active:scale-95"
              aria-label="프로젝트 목록으로 이동"
            >
              <ChevronLeft className="h-3.5 w-3.5 text-[#625a51] transition-colors group-hover:text-[#171411]" />
            </button>
          </div>

          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex min-w-0 flex-1 items-center gap-2"
          >
            <div className="min-w-0">
              <div className="truncate text-[9px] font-semibold tracking-[0.08em] text-[#8a8177]">
                프로젝트 이름
              </div>
              <input
                type="text"
                value={title}
                onChange={(event) => onTitleChange(event.target.value)}
                onBlur={() => onTitleCommit?.()}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.currentTarget.blur();
                  }
                }}
                placeholder="디자인 이름 입력"
                aria-label="디자인 이름"
                className="w-full min-w-[180px] max-w-[320px] truncate bg-transparent text-[12px] font-semibold leading-none text-[#171411] outline-none placeholder:text-[#a39a8d]"
              />
            </div>
            <span className="hidden h-3.5 w-px bg-black/10 lg:block" />
            <span className="hidden rounded-full border border-black/10 bg-[#f7f7f4] px-2.5 py-1 text-[9px] font-semibold text-[#625a51] lg:inline-flex">
              {modeLabel}
            </span>
          </motion.div>

          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-4 xl:flex">
              {navLinks.map((link) => {
                const isActive = pathname === link.href;
                return (
                  <button
                    key={link.href}
                    type="button"
                    onClick={() => router.push(link.href)}
                    className={`text-[10px] font-semibold tracking-[0.02em] transition ${
                      isActive ? "text-[#171411]" : "text-[#8a8177] hover:text-[#171411]"
                    }`}
                  >
                    {link.label}
                  </button>
                );
              })}
            </div>

            {canShowPanels ? (
              <>
                <button
                  type="button"
                  onClick={onShowAssets}
                  className={`inline-flex h-8 items-center gap-1 rounded-full border px-3 text-[10px] font-semibold transition ${
                    activePanel === "assets"
                      ? "border-black bg-[#171411] text-white"
                      : "border-black/10 text-[#625a51] hover:border-black/20 hover:bg-[#f4f4f1]"
                  }`}
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  추가
                </button>
                <button
                  type="button"
                  onClick={onShowInspector}
                  className={`inline-flex h-8 items-center gap-1 rounded-full border px-3 text-[10px] font-semibold transition ${
                    activePanel === "properties"
                      ? "border-black bg-[#171411] text-white"
                      : "border-black/10 text-[#625a51] hover:border-black/20 hover:bg-[#f4f4f1]"
                  }`}
                >
                  <Settings2 className="h-3.5 w-3.5" />
                  설정
                </button>
              </>
            ) : null}

            {isAuthenticated ? (
              <button
                type="button"
                onClick={() => router.push("/my")}
                className="hidden max-w-[160px] truncate text-[9px] font-bold uppercase tracking-[0.1em] text-[#999999] transition hover:text-[#171411] xl:block"
              >
                {user?.name ?? user?.email ?? "내 프로젝트"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsAuthOpen(true)}
                className="inline-flex h-8 items-center rounded-full bg-[#171411] px-3 text-[10px] font-semibold text-white transition hover:bg-black"
              >
                로그인
              </button>
            )}

            <div className="hidden xl:block">
              <EditorStatusBadge
                isDirty={isDirty}
                isSaving={isSaving}
                saveError={saveError}
                lastSavedAt={lastSavedAt}
              />
            </div>

            <button
              type="button"
              onClick={onOpenShare}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-black/10 bg-white text-[#625a51] transition hover:border-black/20 hover:bg-[#f4f4f1] hover:text-[#171411]"
              aria-label="공유"
            >
              <Share2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={isSaving || (!isDirty && !saveError)}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#171411] bg-[#171411] px-3 text-[10px] font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Save className="h-3.5 w-3.5" />
              <span>{isSaving ? "저장 중" : "저장"}</span>
            </button>
          </div>
        </div>
      </div>

      <AuthPopup isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} nextPath={pathname ?? "/studio"} />
    </>
  );
}
