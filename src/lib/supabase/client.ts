import { createBrowserClient } from "@supabase/ssr";
import { cookieOptions, requestIsHttps } from "./cookies";
import { getSupabaseEnv } from "./config";

export function createClient() {
  const { url, key } = getSupabaseEnv();
  if (!url || !key) {
    throw new Error("Supabase is not configured. Add env vars from .env.example.");
  }
  return createBrowserClient(url, key, {
    cookieOptions: cookieOptions(requestIsHttps()),
  });
}
