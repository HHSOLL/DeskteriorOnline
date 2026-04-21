import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Provider } from "@supabase/supabase-js";
import type { Database } from "../../../../../../types/database";

const SUPPORTED_PROVIDERS = new Set<Provider>(["google", "kakao"]);

function resolveNextPath(nextPath: string | null) {
  return nextPath && nextPath.startsWith("/") ? nextPath : "/";
}

function buildStatusUrl(
  origin: string,
  nextPath: string,
  status: "error",
  message?: string
) {
  const url = new URL(nextPath, origin);
  url.searchParams.set("auth", status);
  if (message) {
    url.searchParams.set("auth_message", message);
  }
  return url;
}

function clearPkceCookies(request: NextRequest, response: NextResponse) {
  request.cookies.getAll().forEach(({ name }) => {
    if (!name.startsWith("sb-")) return;
    if (!name.includes("code-verifier")) return;
    response.cookies.set(name, "", {
      maxAge: 0,
      path: "/"
    });
  });
}

export async function GET(request: NextRequest) {
  const requestUrl = request.nextUrl;
  const origin = requestUrl.origin;
  const nextPath = resolveNextPath(requestUrl.searchParams.get("next"));
  const provider = requestUrl.searchParams.get("provider");
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.redirect(
      buildStatusUrl(origin, nextPath, "error", "Supabase 환경 변수가 설정되지 않았습니다.")
    );
  }

  if (!provider || !SUPPORTED_PROVIDERS.has(provider as Provider)) {
    return NextResponse.redirect(
      buildStatusUrl(origin, nextPath, "error", "지원하지 않는 로그인 공급자입니다.")
    );
  }

  const callbackUrl = new URL("/auth/callback", origin);
  callbackUrl.searchParams.set("next", nextPath);

  const response = new NextResponse(null, { status: 307 });
  clearPkceCookies(request, response);

  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      }
    }
  });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: provider as Provider,
    options: {
      redirectTo: callbackUrl.toString()
    }
  });

  if (error || !data.url) {
    return NextResponse.redirect(
      buildStatusUrl(origin, nextPath, "error", error?.message ?? "로그인 URL을 만들 수 없습니다.")
    );
  }

  response.headers.set("Location", data.url);
  return response;
}
