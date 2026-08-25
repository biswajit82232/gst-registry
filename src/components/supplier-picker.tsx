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
}: {
  suppliers: Supplier[];
  name: string;
  gstin?: string;
  ownGstin?: string | null;
  onChange: (next: {
    supplier_name: string;
    supplier_gstin: string;
    supplier_id: string | null;
    tax_type?: "intra" | "inter";
    place_of_supply?: string;
  }) => void;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => {
    const q = name.trim().toLowerCase();
    if (!q) return suppliers.slice(0, 6);
    return suppliers
      .filter((s) =>
        [s.name, s.gstin].filter(Boolean).some((v) => String(v).toLowerCase().includes(q)),
      )
      .slice(0, 6);
  }, [name, suppliers]);

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

  return (
    <div ref={box} className="relative">
      <input
        required
        className={inputClass()}
        placeholder="Name or pick saved"
        autoComplete="off"
        value={name}
        onFocus={() => setOpen(true)}
        onChange={(e) =>
          onChange({
            supplier_name: e.target.value,
            supplier_gstin: "",
            supplier_id: null,
          })
        }
      />
      {open && matches.length > 0 ? (
        <ul className="absolute z-20 mt-0.5 max-h-44 w-full overflow-auto rounded-md border border-line bg-bg-elev py-0.5 shadow-lg">
          {matches.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className="flex min-h-11 w-full flex-col items-start px-2 py-1.5 text-left active:bg-line/50"
                onClick={() => pick(s)}
              >
                <span className="text-[13px] font-medium">{s.name}</span>
                <span className="text-[10px] text-muted">{s.gstin || "No GSTIN"}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
