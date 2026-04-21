"use client";

import { create } from "zustand";
import type { Session, User } from "@supabase/supabase-js";
import type { AuthUser } from "../../types";
import { buildBrowserAuthStartUrl } from "../auth/browser-origin";
import { clearInvalidBrowserSession, isRecoverableSessionError } from "../auth/session-recovery";
import { getSupabaseClient } from "../supabase/client";

type AuthState = {
  user: AuthUser | null;
  session: Session | null;
  isLoading: boolean;
  error: string | null;
  notice: string | null;
  initialize: () => void;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name?: string) => Promise<void>;
  loginWithProvider: (provider: "google" | "kakao", redirectTo?: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  clearNotice: () => void;
};

let authSubscription: { unsubscribe: () => void } | null = null;

const toAuthUser = (user: User | null | undefined): AuthUser | null => {
  if (!user) return null;
  const metadata = user.user_metadata ?? {};
  const name =
    (typeof metadata.name === "string" && metadata.name) ||
    (typeof metadata.full_name === "string" && metadata.full_name) ||
    (typeof metadata.preferred_username === "string" && metadata.preferred_username) ||
    null;
  return {
    id: user.id,
    email: user.email ?? null,
    name
  };
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  isLoading: true,
  error: null,
  notice: null,
  initialize: () => {
    if (authSubscription) return;
    const supabase = getSupabaseClient();
    if (!supabase) {
      set({ isLoading: false, error: "Supabase 환경 변수가 설정되지 않았습니다." });
      return;
    }

    set({ isLoading: true });
    supabase.auth.getSession().then(async ({ data, error }) => {
      if (error) {
        if (isRecoverableSessionError(error)) {
          await clearInvalidBrowserSession(supabase);
          set({
            session: null,
            user: null,
            isLoading: false,
            error: "세션이 만료되었습니다. 다시 로그인해주세요."
          });
          return;
        }

        set({ error: error.message });
      }
      set({
        session: data.session ?? null,
        user: toAuthUser(data.session?.user),
        isLoading: false
      });
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      set({
        session: session ?? null,
        user: toAuthUser(session?.user),
        isLoading: false
      });
    });
    authSubscription = data.subscription;
  },
  login: async (email, password) => {
    set({ isLoading: true, error: null, notice: null });
    const supabase = getSupabaseClient();
    if (!supabase) {
      set({ isLoading: false, error: "Supabase 환경 변수가 설정되지 않았습니다." });
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      set({ isLoading: false, error: error.message });
      return;
    }

    set({
      session: data.session ?? null,
      user: toAuthUser(data.user),
      isLoading: false
    });
  },
  signup: async (email, password, name) => {
    set({ isLoading: true, error: null, notice: null });
    const supabase = getSupabaseClient();
    if (!supabase) {
      set({ isLoading: false, error: "Supabase 환경 변수가 설정되지 않았습니다." });
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: name ? { data: { name } } : undefined
    });
    if (error) {
      set({ isLoading: false, error: error.message });
      return;
    }

    if (!data.session) {
      set({
        session: null,
        user: toAuthUser(data.user),
        isLoading: false,
        notice: "가입 확인 이메일을 확인해주세요."
      });
      return;
    }

    set({
      session: data.session,
      user: toAuthUser(data.session.user),
      isLoading: false
    });
  },
  loginWithProvider: async (provider, redirectTo) => {
    set({ isLoading: true, error: null, notice: null });
    if (typeof window === "undefined") {
      set({ isLoading: false, error: "브라우저 환경에서만 로그인할 수 있습니다." });
      return;
    }

    const nextPath = (() => {
      if (!redirectTo) return undefined;
      try {
        const url = new URL(redirectTo);
        return url.searchParams.get("next") ?? undefined;
      } catch {
        return undefined;
      }
    })();

    const signInUrl = buildBrowserAuthStartUrl(provider, nextPath);
    if (!signInUrl) {
      set({ isLoading: false, error: "로그인 시작 URL을 만들 수 없습니다." });
      return;
    }

    window.location.assign(signInUrl);
  },
  logout: async () => {
    set({ isLoading: true, error: null, notice: null });
    const supabase = getSupabaseClient();
    if (!supabase) {
      set({ isLoading: false, error: "Supabase 환경 변수가 설정되지 않았습니다." });
      return;
    }

    const { error } = await supabase.auth.signOut();
    if (error) {
      set({ isLoading: false, error: error.message });
      return;
    }

    set({ session: null, user: null, isLoading: false });
  },
  clearError: () => set({ error: null }),
  clearNotice: () => set({ notice: null })
}));
