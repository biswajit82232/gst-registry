"use client";

import { useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { InstallCard } from "@/components/pwa";
import { Alert, Button, Field, inputClass } from "@/components/ui";
import { gstinState, isValidGstin } from "@/lib/gst";
import { useRegistry } from "@/lib/offline/registry";
import { signOut } from "./actions";

export default function SettingsPage() {
  const { profile, userEmail, saveProfile, clearLocal } = useRegistry();
  const [business, setBusiness] = useState(profile?.business_name ?? "");
  const [gstin, setGstin] = useState(profile?.gstin ?? "");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const gstinOk = !gstin.trim() || isValidGstin(gstin);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!gstinOk) return;
    setSaving(true);
    setStatus("");
    try {
      await saveProfile({
        business_name: business.trim() || null,
        gstin: gstin.trim() || null,
      });
      setStatus("Saved.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  async function onSignOut() {
    await clearLocal();
    await signOut();
  }

  return (
    <div className="space-y-8">
      <form onSubmit={save} className="space-y-4">
        <Field label="Business name">
          <input
            className={inputClass()}
            value={business}
            onChange={(e) => setBusiness(e.target.value)}
            placeholder="Your business"
            autoComplete="organization"
          />
        </Field>
        <Field
          label="GSTIN"
          hint={gstin && gstinOk ? gstinState(gstin) || "Used on PDF reports" : "Printed on month and FY PDFs"}
        >
          <input
            className={inputClass(!gstinOk ? "border-rose-400" : undefined)}
            value={gstin}
            onChange={(e) => setGstin(e.target.value.toUpperCase())}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            placeholder="27AAAAA0000A1Z5"
          />
        </Field>
        <p className="text-[13px] text-muted">{profile?.email || userEmail}</p>
        {status ? <Alert tone={status === "Saved." ? "muted" : "danger"}>{status}</Alert> : null}
        <Button type="submit" className="w-full" disabled={saving || !gstinOk}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </form>

      <div className="border-t border-line pt-8">
        <InstallCard />
      </div>

      <div className="flex items-center justify-between border-t border-line py-1 pt-6">
        <div>
          <p className="text-[15px] font-medium">Appearance</p>
          <p className="text-[13px] text-muted">Light or dark</p>
        </div>
        <ThemeToggle />
      </div>

      <div className="border-t border-line pt-6">
        <Button variant="ghost" className="w-full text-muted" type="button" onClick={() => void onSignOut()}>
          Sign out
        </Button>
      </div>
    </div>
  );
}
