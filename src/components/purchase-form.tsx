"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  calcGst,
  detectTaxType,
  emptyPurchase,
  fromInvoiceTotal,
  GST_RATES,
  gstinState,
  isValidGstin,
} from "@/lib/gst";
import { formatInr, formatMoney } from "@/lib/format";
import { useRegistry } from "@/lib/offline/registry";
import type { Profile, Purchase, PurchaseInput, Supplier } from "@/lib/types";
import { SupplierPicker } from "./supplier-picker";
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
    itc_eligible: p.itc_eligible,
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

export function PurchaseForm({
  profile,
  purchase,
  initialSupplier,
}: {
  profile: Profile | null;
  purchase?: Purchase;
  initialSupplier?: Supplier | null;
}) {
  const router = useRouter();
  const { suppliers, purchases, savePurchase, saveSupplier, profile: liveProfile, setMonth } =
    useRegistry();
  const profileGstin = profile?.gstin ?? liveProfile?.gstin;
  const invoiceRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<PurchaseInput>(() => {
    if (purchase) return fromPurchase(purchase);
    const base = emptyPurchase(profileGstin);
    if (!initialSupplier) return base;
    return {
      ...base,
      supplier_id: initialSupplier.id,
      supplier_name: initialSupplier.name,
      supplier_gstin: initialSupplier.gstin ?? "",
      tax_type: detectTaxType(initialSupplier.gstin, profileGstin),
      place_of_supply: gstinState(initialSupplier.gstin) || gstinState(profileGstin) || "",
    };
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmDup, setConfirmDup] = useState(false);
  const [savedNote, setSavedNote] = useState("");

  const gstinOk = !form.supplier_gstin?.trim() || isValidGstin(form.supplier_gstin);
  const gst = useMemo(() => form.cgst + form.sgst + form.igst, [form.cgst, form.sgst, form.igst]);
  const hasMore =
    Boolean(form.purchased_by) ||
    Boolean(form.hsn_sac) ||
    form.cess > 0 ||
    form.reverse_charge ||
    Boolean(form.notes) ||
    form.category !== "goods";

  function patch(partial: Partial<PurchaseInput>) {
    setForm((prev) => {
      const next = { ...prev, ...partial };
      const tax = calcGst({
        taxableValue: next.taxable_value,
        gstRate: next.gst_rate,
        taxType: next.tax_type,
        cess: next.cess,
      });
      return { ...next, ...tax };
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.supplier_name.trim()) {
      setError("Supplier name is required.");
      return;
    }
    setSaving(true);
    try {
      const invoiceNo = form.invoice_number.trim();
      if (!purchase && !confirmDup && invoiceNo) {
        const existing = purchases.find(
          (row) =>
            row.invoice_number.trim().toLowerCase() === invoiceNo.toLowerCase() &&
            row.supplier_name.trim().toLowerCase() === form.supplier_name.trim().toLowerCase(),
        );
        if (existing) {
          setConfirmDup(true);
          setSaving(false);
          setError("This supplier + invoice already exists. Save again to keep both.");
          return;
        }
      }

      const supplier = await saveSupplier({
        name: form.supplier_name.trim(),
        gstin: form.supplier_gstin?.trim().toUpperCase() || null,
        id: form.supplier_id || undefined,
      });

      const saved = await savePurchase(
        {
          ...form,
          supplier_id: supplier.id,
          supplier_name: supplier.name,
          supplier_gstin: supplier.gstin ?? "",
        },
        purchase?.id,
      );
      const ym = saved.invoice_date.slice(0, 7);
      if (/^\d{4}-\d{2}$/.test(ym)) setMonth(ym);
      if (purchase) {
        router.push(`/purchases/${saved.id}`);
        return;
      }
      const next = emptyPurchase(profileGstin);
      setForm({
        ...next,
        invoice_date: form.invoice_date,
        gst_rate: form.gst_rate,
        tax_type: form.tax_type,
        payment_status: form.payment_status,
        ...(initialSupplier
          ? {
              supplier_id: form.supplier_id,
              supplier_name: form.supplier_name,
              supplier_gstin: form.supplier_gstin,
              place_of_supply: form.place_of_supply,
            }
          : {}),
      });
      setConfirmDup(false);
      setSavedNote(saved.invoice_number.trim() ? `Saved #${saved.invoice_number}` : "Saved");
      requestAnimationFrame(() => invoiceRef.current?.focus());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save this bill.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2 pb-14">
      <div className="grid grid-cols-2 gap-1.5">
        <Field label="Date">
          <input
            type="date"
            required
            className={inputClass()}
            value={form.invoice_date}
            onChange={(e) => patch({ invoice_date: e.target.value })}
          />
        </Field>
        <Field label="Invoice no.">
          <input
            ref={invoiceRef}
            autoFocus={!purchase}
            className={inputClass()}
            placeholder="INV-104"
            enterKeyHint="next"
            value={form.invoice_number}
            onChange={(e) => setForm((f) => ({ ...f, invoice_number: e.target.value }))}
          />
        </Field>
      </div>

      <Field label="Supplier" as="div" hint="Saved parties appear as you type">
        <SupplierPicker
          suppliers={suppliers}
          name={form.supplier_name}
          gstin={form.supplier_gstin ?? ""}
            ownGstin={profileGstin}
          onChange={(next) => {
            patch({
              supplier_name: next.supplier_name,
              supplier_gstin: next.supplier_gstin,
              supplier_id: next.supplier_id,
              ...(next.tax_type ? { tax_type: next.tax_type } : {}),
              ...(next.place_of_supply ? { place_of_supply: next.place_of_supply } : {}),
            });
          }}
        />
      </Field>
      <Field
        label="GSTIN"
        hint={
          form.supplier_gstin && gstinOk
            ? gstinState(form.supplier_gstin) || "State not recognised"
            : "Needed for GSTR-2B"
        }
      >
        <input
          className={inputClass(!gstinOk ? "border-rose-400" : undefined)}
          placeholder="27AAAAA0000A1Z5"
          maxLength={15}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          value={form.supplier_gstin ?? ""}
          onChange={(e) => {
            const supplier_gstin = e.target.value.toUpperCase();
            const tax_type = detectTaxType(supplier_gstin, profileGstin);
            const place =
              gstinState(supplier_gstin) || form.place_of_supply || gstinState(profileGstin) || "";
            patch({ supplier_gstin, tax_type, place_of_supply: place });
          }}
        />
      </Field>

      {!profileGstin ? (
        <Alert>
          Add your GSTIN in Settings so intra vs inter is automatic.
        </Alert>
      ) : null}

      <div className="grid grid-cols-2 gap-1.5">
        <Field label="Taxable">
          <input
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            className={inputClass("tabular")}
            value={form.taxable_value || ""}
            onChange={(e) => patch({ taxable_value: Number(e.target.value) })}
          />
        </Field>
        <Field label="Bill total" hint="Incl. GST">
          <input
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            className={inputClass("tabular")}
            value={form.invoice_total || ""}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                ...fromInvoiceTotal({
                  invoiceTotal: Number(e.target.value),
                  gstRate: prev.gst_rate,
                  taxType: prev.tax_type,
                  cess: prev.cess,
                }),
              }))
            }
          />
        </Field>
      </div>

      <div>
        <p className="mb-0.5 text-[11px] font-medium text-muted">GST rate</p>
        <div className="grid grid-cols-5 gap-1" role="group" aria-label="GST rate">
          {GST_RATES.map((rate) => (
            <button
              key={rate}
              type="button"
              aria-pressed={form.gst_rate === rate}
              onClick={() => patch({ gst_rate: rate })}
              className={`h-8 rounded-md text-[12px] font-semibold ${
                form.gst_rate === rate
                  ? "bg-teal-700 text-white dark:bg-teal-400 dark:text-teal-950"
                  : "border border-line bg-bg-elev"
              }`}
            >
              {rate}%
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1" role="group" aria-label="Tax type">
        <button
          type="button"
          aria-pressed={form.tax_type === "intra"}
          onClick={() => patch({ tax_type: "intra" })}
          className={`h-8 rounded-md text-[12px] font-semibold ${
            form.tax_type === "intra"
              ? "bg-teal-700 text-white dark:bg-teal-400 dark:text-teal-950"
              : "border border-line"
          }`}
        >
          Intra CGST+SGST
        </button>
        <button
          type="button"
          aria-pressed={form.tax_type === "inter"}
          onClick={() => patch({ tax_type: "inter" })}
          className={`h-8 rounded-md text-[12px] font-semibold ${
            form.tax_type === "inter"
              ? "bg-teal-700 text-white dark:bg-teal-400 dark:text-teal-950"
              : "border border-line"
          }`}
        >
          Inter IGST
        </button>
      </div>

      <div className="flex items-center justify-between rounded-md border border-line bg-bg-elev px-2 py-1.5">
        <div>
          <p className="text-[10px] text-muted">
            GST {formatMoney(gst)}
            {form.tax_type === "intra"
              ? ` · C ${formatInr(form.cgst)} S ${formatInr(form.sgst)}`
              : ` · I ${formatInr(form.igst)}`}
          </p>
          <p className="tabular text-[16px] font-bold leading-tight">{formatMoney(form.invoice_total)}</p>
        </div>
        <label className="flex items-center gap-1.5 text-[12px]">
          <input
            type="checkbox"
            className="h-4 w-4 accent-teal-700"
            checked={form.itc_eligible}
            onChange={(e) => setForm((f) => ({ ...f, itc_eligible: e.target.checked }))}
          />
          ITC
        </label>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <Field label="Payment">
          <select
            className={inputClass()}
            value={form.payment_status}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                payment_status: e.target.value as PurchaseInput["payment_status"],
              }))
            }
          >
            <option value="paid">Paid</option>
            <option value="unpaid">Unpaid</option>
          </select>
        </Field>
        <Field label="Paid on">
          <input
            type="date"
            className={inputClass()}
            disabled={form.payment_status !== "paid"}
            value={form.payment_date ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, payment_date: e.target.value }))}
          />
        </Field>
      </div>

      <details className="rounded-md border border-line bg-bg-elev px-2 py-1" open={hasMore}>
        <summary className="cursor-pointer text-[12px] font-medium">More</summary>
        <div className="mt-1.5 space-y-1.5 pb-1">
          <div className="grid grid-cols-2 gap-1.5">
            <Field label="Purchaser">
              <input
                className={inputClass()}
                placeholder="You / staff"
                value={form.purchased_by ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, purchased_by: e.target.value }))}
              />
            </Field>
            <Field label="Category">
              <select
                className={inputClass()}
                value={form.category}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    category: e.target.value as PurchaseInput["category"],
                  }))
                }
              >
                <option value="goods">Goods</option>
                <option value="services">Services</option>
                <option value="capital">Capital</option>
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <Field label="HSN / SAC">
              <input
                className={inputClass()}
                placeholder="8471"
                value={form.hsn_sac ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, hsn_sac: e.target.value }))}
              />
            </Field>
            <Field label="Cess">
              <input
                type="number"
                min={0}
                step="0.01"
                className={inputClass("tabular")}
                value={form.cess || ""}
                onChange={(e) => patch({ cess: Number(e.target.value) })}
              />
            </Field>
          </div>
          <label className="flex items-center justify-between gap-2 text-[12px]">
            <span>Reverse charge</span>
            <input
              type="checkbox"
              className="h-4 w-4 accent-teal-700"
              checked={form.reverse_charge}
              onChange={(e) => setForm((f) => ({ ...f, reverse_charge: e.target.checked }))}
            />
          </label>
          <Field label="Place of supply">
            <input
              className={inputClass()}
              value={form.place_of_supply ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, place_of_supply: e.target.value }))}
            />
          </Field>
          <Field label="Notes">
            <textarea
              rows={2}
              className={`${inputClass()} h-auto py-1.5`}
              placeholder="For your CA"
              value={form.notes ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </Field>
        </div>
      </details>

      {savedNote ? <Alert tone="muted">{savedNote}. Add the next one.</Alert> : null}
      {error ? <Alert tone="danger">{error}</Alert> : null}

      <div className="sticky-save sticky z-20 -mx-2.5 border-t border-line bg-bg/95 px-2.5 py-1.5 backdrop-blur md:bottom-0 md:mx-0 md:px-0">
        <Button type="submit" className="w-full min-h-11" disabled={saving}>
          {saving ? "Saving…" : purchase ? "Update" : confirmDup ? "Save anyway" : "Save & next"}
        </Button>
      </div>
    </form>
  );
}
