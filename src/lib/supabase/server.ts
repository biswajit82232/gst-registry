import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { cookieOptions } from "./cookies";
import { getSupabaseEnv } from "./config";

export async function createClient() {
  const { url, key } = getSupabaseEnv();
  if (!url || !key) {
    throw new Error("Supabase is not configured.");
  }

  const cookieStore = await cookies();
  const headerStore = await headers();
  const isHttps = (headerStore.get("x-forwarded-proto") || "http") === "https";

  return createServerClient(url, key, {
    cookieOptions: cookieOptions(isHttps),
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, {
              ...options,
              ...cookieOptions(isHttps),
            }),
          );
        } catch {
          // Called from a Server Component; proxy will refresh the session.
        }
      },
    },
  });
}
