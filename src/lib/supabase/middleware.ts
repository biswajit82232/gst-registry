import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { cookieOptions } from "./cookies";
import { getSupabaseEnv } from "./config";

export async function updateSession(request: NextRequest) {
  const { url, key } = getSupabaseEnv();

  if (!url || !key) {
    return NextResponse.next({ request });
  }

  const isHttps = request.nextUrl.protocol === "https:";
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookieOptions: cookieOptions(isHttps),
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, {
            ...options,
            ...cookieOptions(isHttps),
          }),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic =
    path.startsWith("/login") ||
    path.startsWith("/auth") ||
    path === "/setup" ||
    path === "/manifest.webmanifest" ||
    path === "/manifest" ||
    path.startsWith("/icon") ||
    path.startsWith("/icons") ||
    path.startsWith("/apple-icon") ||
    path === "/logo.png" ||
    path === "/favicon.ico";

  if (!user && !isPublic) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/login";
    return NextResponse.redirect(redirect);
  }

  if (user && path.startsWith("/login")) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/";
    return NextResponse.redirect(redirect);
  }

  return supabaseResponse;
}
