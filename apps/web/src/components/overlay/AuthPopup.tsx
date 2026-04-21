"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { useEffect } from "react";
import { useAuthStore } from "../../lib/stores/useAuthStore";
import { buildBrowserAuthRedirectUrl } from "../../lib/auth/browser-origin";
import { toast } from "sonner";

interface AuthPopupProps {
    isOpen: boolean;
    onClose: () => void;
    nextPath?: string;
}

export function AuthPopup({ isOpen, onClose, nextPath }: AuthPopupProps) {
    const { loginWithProvider, isLoading, error, notice, session } = useAuthStore();
    const isAuthenticated = Boolean(session?.user);

    useEffect(() => {
        if (!isOpen || !isAuthenticated) return;
        onClose();
    }, [isAuthenticated, isOpen, onClose]);

    useEffect(() => {
        if (error) toast.error(error);
    }, [error]);

    useEffect(() => {
        if (notice) toast.success(notice);
    }, [notice]);

    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose]);

    const handleSocialLogin = async (provider: "google" | "kakao") => {
        const redirectTo = buildBrowserAuthRedirectUrl(nextPath);
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

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[rgba(247,243,236,0.52)] p-6 backdrop-blur-xl">
                    <motion.div
                        initial={{ opacity: 0, y: 18, scale: 0.985 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 12, scale: 0.985 }}
                        role="dialog"
                        aria-modal="true"
                        aria-label="로그인"
                        className="relative w-full max-w-[420px] overflow-hidden rounded-[32px] border border-stone-200/85 bg-[linear-gradient(180deg,rgba(255,255,255,0.97),rgba(252,249,244,0.94))] p-6 shadow-[0_40px_120px_-50px_rgba(15,23,42,0.4)]"
                    >
                        <button
                            onClick={onClose}
                            type="button"
                            aria-label="Close authentication dialog"
                            className="absolute right-5 top-5 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full border border-stone-200/80 bg-white/80 text-stone-500 transition-all duration-300 hover:border-stone-300 hover:text-stone-900"
                        >
                            <X className="h-5 w-5" />
                        </button>

                        <div className="space-y-6">
                            <div className="flex items-center justify-between gap-4 pr-12">
                                <div className="space-y-2">
                                    <div className="text-[11px] font-semibold uppercase tracking-[0.34em] text-stone-500">
                                        DeskteriorOnline
                                    </div>
                                    <p className="text-sm leading-relaxed text-stone-600">
                                        소셜 계정으로 바로 시작하세요.
                                    </p>
                                </div>
                                {isLoading ? (
                                    <span className="inline-flex h-10 min-w-10 items-center justify-center rounded-full border border-stone-200/80 bg-white/80 px-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">
                                        ...
                                    </span>
                                ) : null}
                            </div>

                            <div className="space-y-3">
                                <button
                                    type="button"
                                    disabled={isLoading}
                                    onClick={() => handleSocialLogin("google")}
                                    className="flex w-full items-center justify-center gap-3 rounded-[22px] border border-stone-300/90 bg-white px-5 py-4 text-sm font-semibold text-stone-900 transition-all duration-300 hover:border-stone-900 hover:bg-stone-950 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <GoogleIcon />
                                    구글로 계속하기
                                </button>
                                <button
                                    type="button"
                                    disabled={isLoading}
                                    onClick={() => handleSocialLogin("kakao")}
                                    className="flex w-full items-center justify-center gap-3 rounded-[22px] bg-[#FEE500] px-5 py-4 text-sm font-semibold text-[#191919] transition-all duration-300 hover:bg-[#f6d900] disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <KakaoIcon />
                                    카카오로 계속하기
                                </button>
                            </div>

                            <div className="rounded-[24px] border border-stone-200/70 bg-white/55 px-4 py-3 text-center text-[11px] leading-relaxed text-stone-500">
                                Google · Kakao 소셜 로그인만 지원합니다.
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
