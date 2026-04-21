"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
    const initialize = useAuthStore((state) => state.initialize);
    const router = useRouter();
    const lastAuthToastRef = useRef<string | null>(null);

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
                toast.success("Welcome to DeskteriorOnline Studio");
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

    return (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );
}
