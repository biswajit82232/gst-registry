"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AuthState = {
  error: string;
  info: string;
};

export async function authenticate(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const mode = String(formData.get("mode") ?? "in");

  if (!email || !password) {
    return { error: "Email and password are required.", info: "" };
  }

  const supabase = await createClient();
  const headerStore = await headers();
  const origin =
    headerStore.get("origin") ||
    `${headerStore.get("x-forwarded-proto") || "http"}://${headerStore.get("x-forwarded-host") || headerStore.get("host")}`;

  if (mode === "up") {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${origin}/auth/callback` },
    });
    if (error) return { error: error.message, info: "" };
    if (!data.session) {
      return {
        error: "",
        info: "Account created. Confirm email if asked, then sign in.",
      };
    }
  } else {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message, info: "" };
  }

  revalidatePath("/", "layout");
  redirect("/");
}
