"use client";

import { useActionState, useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { SetupScreen } from "@/components/setup-screen";
import { Alert, Button, Field, inputClass } from "@/components/ui";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { authenticate, type AuthState } from "./actions";

const initial: AuthState = { error: "", info: "" };

export default function LoginPage() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [state, action, pending] = useActionState(authenticate, initial);

  if (!isSupabaseConfigured()) return <SetupScreen />;

  return (
    <div className="app-root safe-x flex min-h-dvh flex-col bg-bg pb-[max(2.5rem,env(safe-area-inset-bottom,0px))]">
      <div className="app-scroll flex min-h-dvh flex-col">
        <div className="safe-top flex justify-end">
          <ThemeToggle />
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-8">
        <p className="text-[12px] text-muted">GST purchase register</p>
        <h1 className="mt-1 text-[28px] font-semibold tracking-tight">GST Registry</h1>
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
          {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
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
