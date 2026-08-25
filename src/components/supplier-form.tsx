"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Field, inputClass } from "@/components/ui";
import { isValidGstin, gstinState } from "@/lib/gst";
import { useRegistry } from "@/lib/offline/registry";
import type { Supplier } from "@/lib/types";

export function SupplierForm({
  supplier,
  onSaved,
}: {
  supplier?: Supplier;
  onSaved?: (saved: Supplier) => void;
}) {
  const router = useRouter();
  const { saveSupplier } = useRegistry();
  const [name, setName] = useState(supplier?.name ?? "");
  const [gstin, setGstin] = useState(supplier?.gstin ?? "");
  const [phone, setPhone] = useState(supplier?.phone ?? "");
  const [notes, setNotes] = useState(supplier?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const gstinOk = !gstin.trim() || isValidGstin(gstin);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setSaving(true);
    try {
      const saved = await saveSupplier({
        name,
        gstin,
        phone,
        notes,
        id: supplier?.id,
      });
      if (onSaved) onSaved(saved);
      else router.push(`/suppliers/${saved.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save supplier.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 pb-16">
      <Field label="Name">
        <input
          required
          className={inputClass()}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Vendor / shop"
          autoComplete="organization"
        />
      </Field>
      <Field
        label="GSTIN"
        hint={gstin && gstinOk ? gstinState(gstin) || "State not recognised" : "Optional"}
      >
        <input
          className={inputClass(!gstinOk ? "border-rose-400" : undefined)}
          maxLength={15}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          value={gstin}
          onChange={(e) => setGstin(e.target.value.toUpperCase())}
          placeholder="15-character GSTIN"
        />
      </Field>
      <Field label="Phone">
        <input
          className={inputClass()}
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Optional"
        />
      </Field>
      <Field label="Notes">
        <textarea
          rows={2}
          className={inputClass("h-auto min-h-11 py-2.5")}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Terms, contact"
        />
      </Field>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <div className="sticky-save sticky z-20 -mx-4 border-t border-line bg-bg/95 px-4 py-2.5 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:p-0">
        <Button type="submit" className="w-full" disabled={saving || !gstinOk}>
          {saving ? "Saving…" : supplier ? "Update" : "Save"}
        </Button>
      </div>
    </form>
  );
}
