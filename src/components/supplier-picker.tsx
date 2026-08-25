"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { detectTaxType, gstinState } from "@/lib/gst";
import type { Supplier } from "@/lib/types";
import { inputClass } from "./ui";

export function SupplierPicker({
  suppliers,
  name,
  onChange,
  ownGstin,
  inputRef,
  autoFocus,
}: {
  suppliers: Supplier[];
  name: string;
  gstin?: string;
  ownGstin?: string | null;
  inputRef?: React.Ref<HTMLInputElement>;
  autoFocus?: boolean;
  onChange: (next: {
    supplier_name: string;
    supplier_gstin?: string;
    supplier_id: string | null;
    tax_type?: "intra" | "inter";
    place_of_supply?: string;
  }) => void;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const q = name.trim().toLowerCase();

  const matches = useMemo(() => {
    if (!q) return suppliers.slice(0, 6);
    return suppliers
      .filter((s) =>
        [s.name, s.gstin].filter(Boolean).some((v) => String(v).toLowerCase().includes(q)),
      )
      .slice(0, 6);
  }, [q, suppliers]);

  const exact = matches.find((s) => s.name.toLowerCase() === q);

  useEffect(() => {
    function onDoc(e: Event) {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onDoc);
    return () => document.removeEventListener("pointerdown", onDoc);
  }, []);

  function pick(s: Supplier) {
    onChange({
      supplier_name: s.name,
      supplier_gstin: s.gstin ?? "",
      supplier_id: s.id,
      tax_type: detectTaxType(s.gstin, ownGstin),
      place_of_supply: gstinState(s.gstin) || gstinState(ownGstin) || "",
    });
    setOpen(false);
  }

  const showList = open && (matches.length > 0 || q.length > 0);

  return (
    <div ref={box} className="relative">
      <input
        ref={inputRef}
        required
        autoFocus={autoFocus}
        role="combobox"
        aria-expanded={showList}
        aria-autocomplete="list"
        className={inputClass()}
        placeholder="Type or pick a party"
        autoComplete="off"
        value={name}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          const supplier_name = e.target.value;
          const hit = suppliers.find(
            (s) => s.name.toLowerCase() === supplier_name.trim().toLowerCase(),
          );
          if (hit) {
            onChange({
              supplier_name,
              supplier_gstin: hit.gstin ?? "",
              supplier_id: hit.id,
              tax_type: detectTaxType(hit.gstin, ownGstin),
              place_of_supply: gstinState(hit.gstin) || gstinState(ownGstin) || "",
            });
            return;
          }
          onChange({
            supplier_name,
            supplier_gstin: "",
            supplier_id: null,
          });
        }}
      />
      {showList ? (
        <ul
          role="listbox"
        className="absolute z-20 mt-1 max-h-52 w-full overflow-auto rounded-md border border-line bg-bg-elev py-1 shadow-lg"
        >
          {matches.map((s) => (
            <li key={s.id} role="option">
              <button
                type="button"
                className="flex min-h-12 w-full flex-col items-start px-3 py-2 text-left active:bg-line/40"
                onClick={() => pick(s)}
              >
                <span className="text-[15px] font-medium">{s.name}</span>
                <span className="text-[12px] text-muted">{s.gstin || "No GSTIN"}</span>
              </button>
            </li>
          ))}
          {q && !exact ? (
            <li className="border-t border-line px-3 py-2 text-[12px] text-muted">
              New party · saved with this bill
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
