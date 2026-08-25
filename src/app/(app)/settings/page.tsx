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
    setSaving(true);
    setStatus("");
    try {
      await saveProfile({
        business_name: business.trim() || null,
        gstin: gstin.trim().toUpperCase() || null,
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
    <div className="space-y-3">
      <form onSubmit={save} className="space-y-2">
        <p className="text-[11px] text-muted">
          Your GSTIN splits CGST+SGST vs IGST when a supplier is in another state.
        </p>
        <Field label="Business name">
          <input
            className={inputClass()}
            value={business}
            onChange={(e) => setBusiness(e.target.value)}
            placeholder="Shown on PDFs"
            autoComplete="organization"
          />
        </Field>
        <Field
          label="Your GSTIN"
          hint={gstin && gstinOk ? gstinState(gstin) ?? "State not recognised" : "15 characters"}
        >
          <input
            className={inputClass(!gstinOk ? "border-rose-400" : undefined)}
            maxLength={15}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            value={gstin}
            onChange={(e) => setGstin(e.target.value.toUpperCase())}
            placeholder="27AAAAA0000A1Z5"
          />
        </Field>
        <p className="text-[11px] text-muted">{profile?.email || userEmail}</p>
        {status ? <Alert tone={status === "Saved." ? "muted" : "danger"}>{status}</Alert> : null}
        <Button type="submit" className="w-full min-h-11" disabled={saving || !gstinOk}>
          {saving ? "Saving…" : "Save profile"}
        </Button>
      </form>

      <InstallCard />

      <div className="flex items-center justify-between rounded-md border border-line bg-bg-elev px-2 py-1.5">
        <div>
          <p className="text-[13px] font-medium">Appearance</p>
          <p className="text-[11px] text-muted">Light or dark</p>
        </div>
        <ThemeToggle />
      </div>

      <Button variant="outline" className="w-full min-h-11" type="button" onClick={() => void onSignOut()}>
        Sign out
      </Button>
    </div>
  );
}
