"use client";

import { useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { InstallCard } from "@/components/pwa";
import { Alert, Button, Field, inputClass } from "@/components/ui";
import { useRegistry } from "@/lib/offline/registry";
import { signOut } from "./actions";

export default function SettingsPage() {
  const { profile, userEmail, saveProfile, clearLocal } = useRegistry();
  const [business, setBusiness] = useState(profile?.business_name ?? "");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setStatus("");
    try {
      await saveProfile({
        business_name: business.trim() || null,
        gstin: profile?.gstin ?? null,
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
        <Field label="Business name">
          <input
            className={inputClass()}
            value={business}
            onChange={(e) => setBusiness(e.target.value)}
            placeholder="Your business"
            autoComplete="organization"
          />
        </Field>
        <p className="text-[12px] text-muted">{profile?.email || userEmail}</p>
        {status ? <Alert tone={status === "Saved." ? "muted" : "danger"}>{status}</Alert> : null}
        <Button type="submit" className="w-full min-h-11" disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </form>

      <InstallCard />

      <div className="flex items-center justify-between rounded-md border border-line bg-bg-elev px-2 py-1.5">
        <div>
          <p className="text-[13px] font-medium">Appearance</p>
          <p className="text-[12px] text-muted">Light or dark</p>
        </div>
        <ThemeToggle />
      </div>

      <Button variant="outline" className="w-full min-h-11" type="button" onClick={() => void onSignOut()}>
        Sign out
      </Button>
    </div>
  );
}
