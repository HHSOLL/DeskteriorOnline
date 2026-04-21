import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "../../../../../../types/database";

function resolveNextPath(nextPath: string | null) {
  return nextPath && nextPath.startsWith("/") ? nextPath : "/";
}

function buildStatusUrl(
  origin: string,
  nextPath: string,
  status: "success" | "error",
  message?: string
) {
  const url = new URL(nextPath, origin);
  url.searchParams.set("auth", status);
  if (message) {
    url.searchParams.set("auth_message", message);
  }
  return url;
}

function clearSupabaseCookies(request: NextRequest, response: NextResponse) {
  request.cookies.getAll().forEach(({ name }) => {
    if (!name.startsWith("sb-")) return;
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
  const code = requestUrl.searchParams.get("code");
  const authError = requestUrl.searchParams.get("error");
  const authErrorDescription = requestUrl.searchParams.get("error_description");
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (authError) {
    const response = NextResponse.redirect(
      buildStatusUrl(origin, nextPath, "error", authErrorDescription ?? authError)
    );
    clearSupabaseCookies(request, response);
    return response;
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.redirect(
      buildStatusUrl(origin, nextPath, "error", "Supabase 환경 변수가 설정되지 않았습니다.")
    );
  }

  if (!code) {
    return NextResponse.redirect(new URL(nextPath, origin));
  }

  const successUrl = buildStatusUrl(origin, nextPath, "success");
  let response = NextResponse.redirect(successUrl);

  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        response = NextResponse.redirect(successUrl);
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      }
    }
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    const errorResponse = NextResponse.redirect(
      buildStatusUrl(origin, nextPath, "error", error.message)
    );
    clearSupabaseCookies(request, errorResponse);
    return errorResponse;
  }

  return response;
}
