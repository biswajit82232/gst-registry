"use client";

import { useActionState, useState } from "react";
import { Stamp } from "lucide-react";
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
    <div className="safe-x flex min-h-dvh flex-col bg-bg pb-[max(2.5rem,env(safe-area-inset-bottom,0px))]">
      <div className="safe-top flex justify-end py-1">
        <ThemeToggle />
      </div>
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center">
        <div className="mb-4 flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-700 text-white dark:bg-teal-400 dark:text-teal-950">
            <Stamp className="h-4 w-4" />
          </span>
          <div>
            <h1 className="text-[17px] font-bold leading-tight">GST Registry</h1>
            <p className="text-[11px] text-muted">Purchase GST, ready for the CA</p>
          </div>
        </div>
        <form action={action} className="space-y-2 rounded-lg border border-line bg-bg-elev p-3">
          <input type="hidden" name="mode" value={mode} />
          <Field label="Email">
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
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
          {state.info ? <p className="text-[12px] text-muted">{state.info}</p> : null}
          <Button type="submit" className="w-full min-h-11" disabled={pending}>
            {pending ? "Please wait…" : mode === "in" ? "Sign in" : "Create account"}
          </Button>
        </form>
        <button
          type="button"
          className="mt-3 min-h-10 text-[12px] text-muted"
          onClick={() => setMode(mode === "in" ? "up" : "in")}
        >
          {mode === "in" ? "New here? Create an account" : "Already registered? Sign in"}
        </button>
      </div>
    </div>
  );
}
