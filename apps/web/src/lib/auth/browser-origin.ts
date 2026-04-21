"use client";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1"]);
const AUTH_QUERY_KEYS = ["code", "error", "error_description", "state", "auth", "auth_message"];

function toUrl(value: string | undefined | null): URL | null {
  if (!value) return null;

  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function isLoopback(url: URL) {
  return LOOPBACK_HOSTS.has(url.hostname);
}

export function resolveBrowserAppOrigin() {
  if (typeof window === "undefined") return null;
  return toUrl(window.location.origin)?.origin ?? null;
}

function hasAuthFlowParams(url: URL) {
  return AUTH_QUERY_KEYS.some((key) => url.searchParams.has(key));
}

export function resolveCanonicalBrowserHref(href: string) {
  const current = toUrl(href);
  const configured = toUrl(process.env.NEXT_PUBLIC_APP_URL);

  if (!current || !configured) return null;
  if (current.pathname === "/auth/callback" || hasAuthFlowParams(current)) return null;
  if (!isLoopback(current) || !isLoopback(configured) || current.origin === configured.origin) return null;

  const canonical = new URL(`${current.pathname}${current.search}${current.hash}`, configured.origin);
  return canonical.toString();
}

export function buildBrowserAuthRedirectUrl(nextPath?: string) {
  const origin = resolveBrowserAppOrigin();
  if (!origin) return undefined;
  const callbackUrl = new URL("/auth/callback", origin);
  const resolvedNextPath = (() => {
    if (nextPath && nextPath.startsWith("/")) {
      return nextPath;
    }
    if (typeof window === "undefined") {
      return "/";
    }

    const current = new URL(window.location.href);
    AUTH_QUERY_KEYS.forEach((key) => current.searchParams.delete(key));
    const derivedPath = `${current.pathname}${current.search}${current.hash}`;
    return derivedPath.startsWith("/") ? derivedPath : "/";
  })();

  callbackUrl.searchParams.set("next", resolvedNextPath);
  return callbackUrl.toString();
}

export function buildBrowserAuthStartUrl(provider: "google" | "kakao", nextPath?: string) {
  const origin = resolveBrowserAppOrigin();
  if (!origin) return undefined;

  const signinUrl = new URL("/auth/signin", origin);
  signinUrl.searchParams.set("provider", provider);

  const resolvedNextPath = (() => {
    if (nextPath && nextPath.startsWith("/")) {
      return nextPath;
    }
    if (typeof window === "undefined") {
      return "/";
    }

    const current = new URL(window.location.href);
    AUTH_QUERY_KEYS.forEach((key) => current.searchParams.delete(key));
    const derivedPath = `${current.pathname}${current.search}${current.hash}`;
    return derivedPath.startsWith("/") ? derivedPath : "/";
  })();

  signinUrl.searchParams.set("next", resolvedNextPath);
  return signinUrl.toString();
}
