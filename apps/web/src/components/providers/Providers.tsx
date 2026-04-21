"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { resolveBrowserAppOrigin, resolveCanonicalBrowserHref } from "../../lib/auth/browser-origin";
import { useAuthStore } from "../../lib/stores/useAuthStore";

const OAUTH_CALLBACK_QUERY_KEYS = [
    "code",
    "error",
    "error_description",
    "state",
    "access_token",
    "refresh_token",
    "token_type",
    "expires_in",
    "expires_at",
] as const;

export function Providers({ children }: { children: ReactNode }) {
    const [queryClient] = useState(() => new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: 60 * 1000,
            },
        },
    }));
    const [authWelcomeVisible, setAuthWelcomeVisible] = useState(false);
    const initialize = useAuthStore((state) => state.initialize);
    const router = useRouter();
    const lastAuthToastRef = useRef<string | null>(null);
    const authWelcomeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const url = new URL(window.location.href);
        const canonicalHref = resolveCanonicalBrowserHref(window.location.href);
        if (canonicalHref) {
            window.location.replace(canonicalHref);
            return;
        }
        if (url.pathname === "/auth/callback") {
            return;
        }
        const hasOauthCallbackParams = OAUTH_CALLBACK_QUERY_KEYS.some((key) => url.searchParams.has(key));
        if (hasOauthCallbackParams && url.pathname !== "/auth/callback") {
            const callbackBase = resolveBrowserAppOrigin() ?? window.location.origin;
            const callbackUrl = new URL("/auth/callback", callbackBase);
            OAUTH_CALLBACK_QUERY_KEYS.forEach((key) => {
                const value = url.searchParams.get(key);
                if (value) {
                    callbackUrl.searchParams.set(key, value);
                }
            });
            const strippedUrl = new URL(url.toString());
            OAUTH_CALLBACK_QUERY_KEYS.forEach((key) => strippedUrl.searchParams.delete(key));
            const nextTarget = `${strippedUrl.pathname}${strippedUrl.search}${strippedUrl.hash}`;
            callbackUrl.searchParams.set("next", nextTarget || "/");
            window.location.replace(callbackUrl.toString());
            return;
        }
        initialize();
    }, [initialize]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const searchParams = new URLSearchParams(window.location.search);
        const status = searchParams.get("auth");
        const authMessage = searchParams.get("auth_message");
        if (!status) {
            lastAuthToastRef.current = null;
            return;
        }
        if (lastAuthToastRef.current !== status) {
            if (status === "success") {
                if (authWelcomeTimerRef.current) {
                    clearTimeout(authWelcomeTimerRef.current);
                }
                setAuthWelcomeVisible(true);
                authWelcomeTimerRef.current = setTimeout(() => {
                    setAuthWelcomeVisible(false);
                    authWelcomeTimerRef.current = null;
                }, 2200);
            } else if (status === "error") {
                toast.error(authMessage ?? "로그인에 실패했습니다.");
            }
            lastAuthToastRef.current = status;
        }
        const url = new URL(window.location.href);
        url.searchParams.delete("auth");
        url.searchParams.delete("auth_message");
        router.replace(`${url.pathname}${url.search}${url.hash}`, { scroll: false });
    }, [router]);

    useEffect(() => {
        return () => {
            if (authWelcomeTimerRef.current) {
                clearTimeout(authWelcomeTimerRef.current);
            }
        };
    }, []);

    return (
        <QueryClientProvider client={queryClient}>
            {children}
            <AnimatePresence>
                {authWelcomeVisible ? (
                    <motion.div
                        key="auth-welcome"
                        initial={{ opacity: 0, y: 14, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.98 }}
                        transition={{ duration: 0.28, ease: "easeOut" }}
                        className="pointer-events-none fixed inset-0 z-[10000] flex items-center justify-center px-4"
                    >
                        <div className="rounded-[28px] border border-stone-200/90 bg-white/92 px-7 py-5 text-center shadow-[0_35px_90px_-45px_rgba(15,23,42,0.45)] backdrop-blur-xl">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.34em] text-stone-500">
                                DeskteriorOnline
                            </div>
                            <div className="mt-2 text-base font-semibold text-stone-900">
                                DeskteriorOnline에 오신 것을 환영합니다.
                            </div>
                        </div>
                    </motion.div>
                ) : null}
            </AnimatePresence>
        </QueryClientProvider>
    );
}
