"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { emptyPurchase, round2, toNumber } from "@/lib/gst";
import { todayIso } from "@/lib/format";
import { useRegistry } from "@/lib/offline/registry";
import type { InputStatus, Profile, Purchase, PurchaseInput } from "@/lib/types";
import { Alert, Button, Field, inputClass } from "./ui";

function fromPurchase(p: Purchase): PurchaseInput {
  return {
    invoice_date: p.invoice_date,
    invoice_number: p.invoice_number,
    supplier_name: p.supplier_name,
    supplier_gstin: p.supplier_gstin ?? "",
    purchased_by: p.purchased_by ?? "",
    category: p.category,
    hsn_sac: p.hsn_sac ?? "",
    taxable_value: p.taxable_value,
    gst_rate: p.gst_rate,
    tax_type: p.tax_type,
    cgst: p.cgst,
    sgst: p.sgst,
    igst: p.igst,
    cess: p.cess,
    invoice_total: p.invoice_total,
    itc_eligible: true,
    reverse_charge: p.reverse_charge,
    payment_status: p.payment_status,
    payment_date: p.payment_date ?? p.invoice_date,
    place_of_supply: p.place_of_supply ?? "",
    notes: p.notes ?? "",
    supplier_id: p.supplier_id,
    input_status: p.input_status,
    input_on: p.input_on,
  };
}

function gstOfInput(form: PurchaseInput): number {
  return round2(toNumber(form.cgst) + toNumber(form.sgst) + toNumber(form.igst));
}

function withAmounts(form: PurchaseInput, amount: number, gst: number): PurchaseInput {
  const invoice_total = round2(toNumber(amount));
  const gstAmt = round2(toNumber(gst));
  const taxable_value = round2(Math.max(0, invoice_total - gstAmt));
  return {
    ...form,
    invoice_total,
    taxable_value,
    cgst: 0,
    sgst: 0,
    igst: gstAmt,
    cess: 0,
    itc_eligible: true,
  };
}

const STATUSES: { id: InputStatus; label: string }[] = [
  { id: "waiting", label: "Wait" },
  { id: "got", label: "Got" },
  { id: "missing", label: "No" },
];

export function StatusPicker({
  value,
  onChange,
}: {
  value: InputStatus;
  onChange: (next: InputStatus) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-1" role="group" aria-label="GST input">
      {STATUSES.map((item) => (
        <button
          key={item.id}
          type="button"
          aria-pressed={value === item.id}
          onClick={() => onChange(item.id)}
          className={`h-10 rounded-md text-[13px] font-semibold ${
            value === item.id
              ? item.id === "missing"
                ? "bg-rose-600 text-white"
                : "bg-teal-700 text-white dark:bg-teal-400 dark:text-teal-950"
              : "border border-line bg-bg-elev"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export function PurchaseForm({
  profile,
  purchase,
}: {
  profile: Profile | null;
  purchase?: Purchase;
}) {
  const router = useRouter();
  const { savePurchase, setMonth } = useRegistry();
  const partyRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<PurchaseInput>(() =>
    purchase ? fromPurchase(purchase) : emptyPurchase(profile?.gstin),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedNote, setSavedNote] = useState("");

  const gst = gstOfInput(form);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.supplier_name.trim()) {
      setError("Party is required.");
      return;
    }
    if (toNumber(form.invoice_total) <= 0) {
      setError("Enter the bill amount.");
      return;
    }
    setSaving(true);
    try {
      const saved = await savePurchase(
        {
          ...form,
          input_on: form.input_status === "waiting" ? null : form.input_on || todayIso(),
        },
        purchase?.id,
      );
      const ym = saved.invoice_date.slice(0, 7);
      if (/^\d{4}-\d{2}$/.test(ym)) setMonth(ym);
      if (purchase) {
        router.push(`/purchases/${saved.id}`);
        return;
      }
      setForm({
        ...emptyPurchase(profile?.gstin),
        invoice_date: form.invoice_date,
        input_status: "waiting",
      });
      setSavedNote("Saved. Add the next bill.");
      requestAnimationFrame(() => partyRef.current?.focus());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save this bill.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2.5 pb-14">
      <div className="grid grid-cols-2 gap-1.5">
        <Field label="Date">
          <input
            type="date"
            required
            className={inputClass()}
            value={form.invoice_date}
            onChange={(e) => setForm((f) => ({ ...f, invoice_date: e.target.value }))}
          />
        </Field>
        <Field label="Invoice">
          <input
            className={inputClass()}
            placeholder="Optional"
            enterKeyHint="next"
            value={form.invoice_number}
            onChange={(e) => setForm((f) => ({ ...f, invoice_number: e.target.value }))}
          />
        </Field>
      </div>

      <Field label="Party">
        <input
          ref={partyRef}
          required
          autoFocus={!purchase}
          className={inputClass()}
          placeholder="Who you bought from"
          autoComplete="organization"
          value={form.supplier_name}
          onChange={(e) => setForm((f) => ({ ...f, supplier_name: e.target.value, supplier_id: null }))}
        />
      </Field>

      <div className="grid grid-cols-2 gap-1.5">
        <Field label="Amount">
          <input
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            required
            className={inputClass("tabular")}
            value={form.invoice_total || ""}
            onChange={(e) => setForm((f) => withAmounts(f, Number(e.target.value), gst))}
          />
        </Field>
        <Field label="GST">
          <input
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            className={inputClass("tabular")}
            value={gst || ""}
            onChange={(e) => setForm((f) => withAmounts(f, f.invoice_total, Number(e.target.value)))}
          />
        </Field>
      </div>

      <div>
        <p className="mb-1 text-[11px] font-medium text-muted">GST input</p>
        <StatusPicker
          value={form.input_status}
          onChange={(input_status) => setForm((f) => ({ ...f, input_status }))}
        />
      </div>

      {savedNote ? <Alert tone="muted">{savedNote}</Alert> : null}
      {error ? <Alert tone="danger">{error}</Alert> : null}

      <div className="sticky-save sticky z-20 -mx-2.5 border-t border-line bg-bg/95 px-2.5 py-1.5 backdrop-blur md:bottom-0 md:mx-0 md:px-0">
        <Button type="submit" className="w-full min-h-11" disabled={saving}>
          {saving ? "Saving…" : purchase ? "Update" : "Save"}
        </Button>
      </div>
    </form>
  );
}
