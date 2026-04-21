"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { buildBrowserAuthRedirectUrl } from "../lib/auth/browser-origin";
import { useAuthStore } from "../lib/stores/useAuthStore";

export function AuthPanel({ className }: { className?: string }) {
  const { user, session, isLoading, error, notice, loginWithProvider, logout } = useAuthStore();
  const isAuthed = Boolean(session?.user);

  const lastToastRef = useRef<string | null>(null);
  const lastNoticeRef = useRef<string | null>(null);

  useEffect(() => {
    if (!error) return;
    if (lastToastRef.current === error) return;
    lastToastRef.current = error;
    toast.error(error);
  }, [error]);

  useEffect(() => {
    if (!notice) return;
    if (lastNoticeRef.current === notice) return;
    lastNoticeRef.current = notice;
    toast.success(notice);
  }, [notice]);

  const handleSocialLogin = async (provider: "google" | "kakao") => {
    const redirectTo = buildBrowserAuthRedirectUrl();
    await loginWithProvider(provider, redirectTo);
  };

  const GoogleIcon = () => (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden>
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 12.35 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 3.03-2.31 5.59-4.92 7.31l7.9 6.15c4.62-4.27 7.06-10.58 7.06-17.93z"
      />
      <path
        fill="#FBBC05"
        d="M10.54 28.4a14.5 14.5 0 0 1 0-8.81l-7.98-6.19A24 24 0 0 0 0 24c0 3.92.94 7.63 2.56 10.99l7.98-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.9-5.81l-7.9-6.15c-2.2 1.48-5.02 2.36-8 2.36-6.26 0-11.57-3.99-13.46-9.45l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
      <path fill="none" d="M0 0h48v48H0z" />
    </svg>
  );

  const KakaoIcon = () => (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <rect x="2" y="2" width="20" height="20" rx="6" fill="#FEE500" />
      <path
        d="M9 7v10M9 12l6-5M9 12l6 5"
        stroke="#191919"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  const handleSignOut = async () => {
    await logout();
    toast.message("로그아웃되었습니다.");
  };

  return (
    <div className={`rounded-[28px] border border-stone-200/80 bg-white/70 p-7 shadow-[0_22px_70px_-55px_rgba(0,0,0,0.45)] backdrop-blur ${className ?? ""}`}>
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.34em] text-stone-500">Account</div>
        <h2 className="mt-3 font-sans text-2xl font-semibold text-stone-900">DeskteriorOnline 로그인</h2>
        <p className="mt-2 text-sm leading-relaxed text-stone-600">
          프로젝트 저장 및 개인 폴더(Storage) 접근을 위해 로그인이 필요합니다.
        </p>
      </div>

      {isLoading ? (
        <div className="mt-6 flex items-center gap-3 rounded-2xl border border-stone-200/70 bg-white/60 px-4 py-3 text-sm text-stone-600">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-stone-300 border-t-stone-800" />
          세션 확인 중...
        </div>
      ) : null}

      {!isLoading && isAuthed ? (
        <div className="mt-6 space-y-4">
          <div className="rounded-2xl border border-stone-200/70 bg-white/60 px-4 py-3 text-sm text-stone-700">
            <div className="text-[11px] font-semibold uppercase tracking-[0.34em] text-stone-500">Signed in</div>
            <div className="mt-2 truncate font-medium text-stone-900">{user.email ?? "Signed in"}</div>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full rounded-full border border-stone-300 bg-white px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.28em] text-stone-800 transition-all duration-300 hover:bg-stone-100 disabled:opacity-40"
          >
            로그아웃
          </button>
        </div>
      ) : null}

      {!isLoading && !isAuthed ? (
        <div className="mt-6 space-y-4">
          <button
            type="button"
            onClick={() => handleSocialLogin("google")}
            disabled={isLoading}
            className="inline-flex w-full items-center justify-center gap-3 rounded-full border border-stone-300 bg-white px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.28em] text-stone-800 transition-all duration-300 hover:bg-stone-100 disabled:opacity-40"
          >
            <GoogleIcon />
            Google로 계속하기
          </button>
          <button
            type="button"
            onClick={() => handleSocialLogin("kakao")}
            disabled={isLoading}
            className="inline-flex w-full items-center justify-center gap-3 rounded-full bg-[#FEE500] px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.28em] text-[#191919] transition-all duration-300 hover:bg-[#F7D200] disabled:opacity-40"
          >
            <KakaoIcon />
            카카오로 계속하기
          </button>
          <p className="text-xs leading-relaxed text-stone-500">
            Google/Kakao 소셜 로그인만 지원합니다.
          </p>
        </div>
      ) : null}
    </div>
  );
}
