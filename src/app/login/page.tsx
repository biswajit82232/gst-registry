"use client";

import { Suspense, useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BrandMark } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { SetupScreen } from "@/components/setup-screen";
import { Alert, Button, Field, inputClass } from "@/components/ui";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { authenticate, type AuthState } from "./actions";

const initial: AuthState = { error: "", info: "" };

function LoginForm() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [state, action, pending] = useActionState(authenticate, initial);
  const params = useSearchParams();
  const linkError =
    params.get("error") === "auth"
      ? "That sign-in link expired or was already used. Try again."
      : "";

  return (
    <div className="app-root safe-x flex min-h-dvh flex-col bg-bg pb-[max(2.5rem,env(safe-area-inset-bottom,0px))]">
      <div className="app-scroll flex min-h-dvh flex-col">
        <div className="safe-top flex justify-end">
          <ThemeToggle />
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-8">
          <h1 className="sr-only">GST Registry</h1>
          <BrandMark size={88} alt="" />
          <p className="mt-4 text-[12px] text-muted">GST purchase register</p>
          <form action={action} className="mt-8 space-y-4">
            <input type="hidden" name="mode" value={mode} />
            <Field label="Email">
              <input
                type="email"
                name="email"
                required
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="next"
                className={inputClass()}
              />
            </Field>
            <Field label="Password">
              <input
                type="password"
                name="password"
                required
                minLength={6}
                autoComplete={mode === "up" ? "new-password" : "current-password"}
                enterKeyHint="go"
                className={inputClass()}
              />
            </Field>
            {state.error || linkError ? <Alert tone="danger">{state.error || linkError}</Alert> : null}
            {state.info ? <p className="text-[13px] text-muted">{state.info}</p> : null}
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Please wait…" : mode === "in" ? "Sign in" : "Create account"}
            </Button>
          </form>
          <button
            type="button"
            className="mt-6 min-h-11 text-[13px] text-muted active:opacity-60"
            onClick={() => setMode(mode === "in" ? "up" : "in")}
          >
            {mode === "in" ? "New here? Create an account" : "Already registered? Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  if (!isSupabaseConfigured()) return <SetupScreen />;

  return (
    <Suspense fallback={<div className="app-root min-h-dvh bg-bg" />}>
      <LoginForm />
    </Suspense>
  );
}
