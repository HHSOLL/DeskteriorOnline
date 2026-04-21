"use client";

import { motion } from "framer-motion";
import { LogOut, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "../../lib/stores/useAuthStore";
import { AuthPopup } from "../overlay/AuthPopup";

export function PremiumNavbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, session, logout } = useAuthStore();
  const isAuthenticated = Boolean(session?.user);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [authNextPath, setAuthNextPath] = useState<string | undefined>(undefined);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  const isEditor = pathname?.startsWith("/project/");
  const isSharedViewer = pathname?.startsWith("/shared/");
  const navItems = [
    { name: "홈", href: "/", match: (path: string | null) => path === "/" },
    {
      name: "공간 선택",
      href: "/studio/select?mode=empty",
      match: (path: string | null) => Boolean(path?.startsWith("/studio/select"))
    },
    {
      name: "공간 만들기",
      action: "builder" as const,
      match: (path: string | null) => Boolean(path?.startsWith("/studio/builder"))
    },
    { name: "내 공간", action: "projects" as const, match: (path: string | null) => path === "/studio" },
    { name: "갤러리", action: "gallery" as const, match: (path: string | null) => path === "/gallery" },
    { name: "커뮤니티", action: "community" as const, match: (path: string | null) => path === "/community" }
  ] as const;

  if (isEditor || isSharedViewer) {
    return null;
  }

  const openAuth = (nextPath: string) => {
    setAuthNextPath(nextPath);
    setIsAuthOpen(true);
  };

  const handleAction = (action: "builder" | "projects" | "gallery" | "community") => {
    setIsMobileMenuOpen(false);

    if (!isAuthenticated && (action === "builder" || action === "projects")) {
      openAuth(action === "builder" ? "/studio/builder?intent=custom" : "/studio");
      return;
    }

    if (action === "builder") {
      router.push("/studio/builder?intent=custom");
      return;
    }
    if (action === "projects") {
      router.push("/studio");
      return;
    }
    if (action === "gallery") {
      router.push("/gallery");
      return;
    }
    router.push("/community");
  };

  return (
    <>
      <nav className="fixed left-0 right-0 top-0 z-[100] border-b border-[#e8e3dc] bg-white/88 backdrop-blur-md">
        <div className="mx-auto flex h-12 max-w-[1540px] items-center justify-between gap-4 px-4 sm:px-5 lg:px-6">
          <div className="flex items-center">
            <motion.button
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={() => router.push("/")}
              className="text-left text-[14px] font-semibold tracking-[-0.04em] text-[#181818] sm:text-[15px]"
            >
              DeskteriorOnline
            </motion.button>
          </div>

          <div className="hidden min-w-0 flex-1 items-center justify-end gap-6 md:flex">
            <div className="flex items-center gap-4 text-[10px] font-semibold tracking-[0.01em] text-[#6d655c]">
              {navItems.map((item) => {
                const isActive = item.match(pathname);
                return (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => ("href" in item ? router.push(item.href) : handleAction(item.action))}
                    className={`transition-colors hover:text-black ${isActive ? "text-black" : ""}`}
                  >
                    {item.name}
                  </button>
                );
              })}
            </div>
            {isAuthenticated ? (
              <>
                <button
                  type="button"
                  onClick={() => router.push("/my")}
                  className="max-w-[180px] truncate text-[11px] text-[#8b8277] transition hover:text-black"
                >
                  {user?.name ?? user?.email ?? "내 프로젝트"}
                </button>
                <button
                  type="button"
                  onClick={() => void logout()}
                  className="inline-flex h-8 items-center gap-2 rounded-full border border-black/10 px-3 text-[10px] font-semibold text-[#181818] transition hover:border-black/30"
                >
                  <LogOut className="h-4 w-4" />
                  로그아웃
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => openAuth(pathname ?? "/")}
                className="inline-flex h-8 items-center justify-center rounded-full border border-black px-3 text-[10px] font-semibold text-[#181818] transition hover:bg-black hover:text-white"
              >
                로그인
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsMobileMenuOpen((prev) => !prev)}
            className="rounded-full border border-[#e5e5e0] bg-white/70 p-2 md:hidden"
            aria-label="모바일 메뉴 열기/닫기"
          >
            {isMobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>

        {isMobileMenuOpen ? (
          <div className="mx-auto max-w-[1540px] border-t border-[#e5e5e0] bg-white/95 px-4 py-4 backdrop-blur-md md:hidden">
            <div className="grid grid-cols-1 gap-2 text-[11px] font-semibold text-[#666666]">
              {navItems.map((item) => (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => ("href" in item ? router.push(item.href) : handleAction(item.action))}
                  className="w-full rounded-full border border-[#e5e5e0] px-4 py-2 text-left transition-colors hover:border-black hover:text-black"
                >
                  {item.name}
                </button>
              ))}
            </div>

            {isAuthenticated ? (
              <div className="mt-3 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    router.push("/my");
                  }}
                  className="truncate text-[10px] text-[#777777]"
                >
                  {user?.name ?? user?.email ?? "내 프로젝트"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    void logout();
                  }}
                  className="inline-flex items-center gap-2 rounded-full border border-black/10 px-4 py-2 text-[11px] font-semibold text-[#181818]"
                >
                  <LogOut className="h-4 w-4" />
                  로그아웃
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  openAuth(pathname ?? "/");
                }}
                className="mt-3 w-full rounded-full border border-black px-6 py-2 text-[11px] font-semibold transition-all hover:bg-black hover:text-white"
              >
                로그인
              </button>
            )}
          </div>
        ) : null}
      </nav>

      <AuthPopup isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} nextPath={authNextPath} />
    </>
  );
}
