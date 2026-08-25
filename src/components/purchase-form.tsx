"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  applyLinesToInput,
  decodeLines,
  DEFAULT_GST_RATE,
  emptyPurchase,
  GST_RATES,
  isValidGstin,
  lineGst,
  lineTotal,
  nextUnusedRate,
  toNumber,
  totalsFromLines,
  type BillLine,
} from "@/lib/gst";
import { formatInr, todayIso } from "@/lib/format";
import { useRegistry } from "@/lib/offline/registry";
import type { InputStatus, Profile, Purchase, PurchaseInput } from "@/lib/types";
import { SupplierPicker } from "./supplier-picker";
import { Alert, Button, Field, inputClass, Section, Segmented } from "./ui";

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

const STATUSES: { id: InputStatus; label: string; activeClass?: string }[] = [
  { id: "waiting", label: "Wait" },
  { id: "got", label: "Got", activeClass: "text-emerald-700 dark:text-emerald-300" },
  { id: "missing", label: "No", activeClass: "text-rose-700 dark:text-rose-300" },
];

export function StatusPicker({
  value,
  onChange,
}: {
  value: InputStatus;
  onChange: (next: InputStatus) => void;
}) {
  return <Segmented value={value} onChange={onChange} options={STATUSES} ariaLabel="GST input" />;
}

export function PurchaseForm({
  profile,
  purchase,
  supplierId,
  onSaved,
}: {
  profile: Profile | null;
  purchase?: Purchase;
  supplierId?: string | null;
  onSaved?: (saved: Purchase) => void;
}) {
  const router = useRouter();
  const { savePurchase, saveSupplier, setMonth, suppliers } = useRegistry();
  const partyRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<PurchaseInput>(() =>
    purchase ? fromPurchase(purchase) : emptyPurchase(profile?.gstin),
  );
  const [lines, setLines] = useState<BillLine[]>(() =>
    purchase ? decodeLines(purchase) : [{ taxable: 0, rate: DEFAULT_GST_RATE }],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedNote, setSavedNote] = useState("");

  const gstin = form.supplier_gstin ?? "";
  const gstinOk = !gstin.trim() || isValidGstin(gstin);
  const totals = useMemo(() => totalsFromLines(lines), [lines]);

  useEffect(() => {
    if (purchase || !supplierId) return;
    const s = suppliers.find((row) => row.id === supplierId);
    if (!s) return;
    setForm((f) =>
      f.supplier_id === s.id
        ? f
        : {
            ...f,
            supplier_id: s.id,
            supplier_name: s.name,
            supplier_gstin: s.gstin ?? "",
          },
    );
  }, [purchase, supplierId, suppliers]);

  function setLine(index: number, patch: Partial<BillLine>) {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.supplier_name.trim()) {
      setError("Party is required.");
      return;
    }
    if (!gstinOk) {
      setError("GSTIN looks invalid.");
      return;
    }
    if (totals.invoice_total <= 0) {
      setError("Enter at least one item amount.");
      return;
    }
    setSaving(true);
    try {
      const party = await saveSupplier({
        name: form.supplier_name,
        gstin,
        id: form.supplier_id || undefined,
      });
      const payload = applyLinesToInput(
        {
          ...form,
          supplier_id: party.id,
          supplier_name: party.name,
          supplier_gstin: party.gstin ?? "",
          input_on: form.input_status === "waiting" ? null : form.input_on || todayIso(),
        },
        lines,
      );
      const saved = await savePurchase(payload, purchase?.id);
      const ym = saved.invoice_date.slice(0, 7);
      if (/^\d{4}-\d{2}$/.test(ym)) setMonth(ym);
      if (purchase) {
        if (onSaved) onSaved(saved);
        else router.push(`/purchases/${saved.id}`);
        return;
      }
      setForm({
        ...emptyPurchase(profile?.gstin),
        invoice_date: form.invoice_date,
        supplier_id: party.id,
        supplier_name: party.name,
        supplier_gstin: party.gstin ?? "",
        input_status: "waiting",
      });
      setLines([{ taxable: 0, rate: DEFAULT_GST_RATE }]);
      setSavedNote("Saved. Add the next bill.");
      requestAnimationFrame(() => amountRef.current?.focus());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save this bill.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8 pb-16">
      <Section title="Bill">
        <div className="grid grid-cols-2 gap-3">
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
      </Section>

      <Section title="Party">
        <Field label="Name" as="div">
          <SupplierPicker
            suppliers={suppliers}
            name={form.supplier_name}
            gstin={gstin}
            ownGstin={profile?.gstin}
            inputRef={partyRef}
            autoFocus={!purchase && !supplierId}
            onChange={(next) =>
              setForm((f) => ({
                ...f,
                supplier_name: next.supplier_name,
                supplier_id: next.supplier_id,
                supplier_gstin:
                  next.supplier_gstin !== undefined ? next.supplier_gstin : f.supplier_gstin,
                tax_type: next.tax_type ?? f.tax_type,
                place_of_supply: next.place_of_supply ?? f.place_of_supply,
              }))
            }
          />
        </Field>
        <Field label="GSTIN" hint={gstin && gstinOk ? "Saved with this party" : "Optional"}>
          <input
            className={inputClass(!gstinOk ? "border-rose-400" : undefined)}
            maxLength={15}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            placeholder="If the party has one"
            value={gstin}
            onChange={(e) =>
              setForm((f) => ({ ...f, supplier_gstin: e.target.value.toUpperCase(), supplier_id: f.supplier_id }))
            }
          />
        </Field>
      </Section>

      <Section title="Items">
        <div className="space-y-5">
          {lines.map((line, index) => (
            <div key={index} className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  ref={index === 0 ? amountRef : undefined}
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  className={inputClass("tabular min-w-0 flex-1")}
                  placeholder="Taxable amount"
                  value={line.taxable || ""}
                  onChange={(e) => setLine(index, { taxable: Number(e.target.value) })}
                />
                {lines.length > 1 ? (
                  <button
                    type="button"
                    aria-label="Remove item"
                    className="h-11 w-11 shrink-0 text-[18px] text-muted"
                    onClick={() => setLines((prev) => prev.filter((_, i) => i !== index))}
                  >
                    ×
                  </button>
                ) : null}
              </div>
              <Segmented
                value={
                  GST_RATES.find((rate) => Math.abs(line.rate - rate) < 0.001) ?? line.rate
                }
                onChange={(rate) => setLine(index, { rate: Number(rate) })}
                options={GST_RATES.map((rate) => ({ id: rate, label: `${rate}%` }))}
                ariaLabel={`GST rate for item ${index + 1}`}
              />
              {toNumber(line.taxable) > 0 ? (
                <p className="text-[13px] text-muted">
                  GST {formatInr(lineGst(line))} · Total {formatInr(lineTotal(line))}
                </p>
              ) : null}
            </div>
          ))}
          <button
            type="button"
            className="min-h-11 text-[13px] font-medium text-ink"
            onClick={() =>
              setLines((prev) => [...prev, { taxable: 0, rate: nextUnusedRate(prev.map((line) => line.rate)) }])
            }
          >
            Add rate
          </button>
        </div>
        {totals.invoice_total > 0 ? (
          <div className="flex items-baseline justify-between pt-1">
            <p className="text-[13px] text-muted">
              GST {formatInr(totals.gst)}
              {lines.filter((line) => toNumber(line.taxable) > 0).length > 1 ? " · mixed rates" : ""}
            </p>
            <p className="tabular text-[20px] font-semibold tracking-tight">{formatInr(totals.invoice_total)}</p>
          </div>
        ) : null}
      </Section>

      <Section title="Input">
        <StatusPicker
          value={form.input_status}
          onChange={(input_status) => setForm((f) => ({ ...f, input_status }))}
        />
      </Section>

      {savedNote ? <Alert tone="muted">{savedNote}</Alert> : null}
      {error ? <Alert tone="danger">{error}</Alert> : null}

      <div className="sticky-save sticky z-20 -mx-4 border-t border-line bg-bg/95 px-4 py-2.5 backdrop-blur md:bottom-0 md:mx-0 md:px-0">
        <Button type="submit" className="w-full" disabled={saving || !gstinOk}>
          {saving ? "Saving…" : purchase ? "Update" : "Save"}
        </Button>
      </div>
    </form>
  );
}
