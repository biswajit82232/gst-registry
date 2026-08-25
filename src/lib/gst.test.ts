import { describe, expect, it } from "vitest";
import {
  applyLinesToInput,
  decodeLines,
  emptyPurchase,
  gstFromInclusive,
  gstinCheckDigit,
  humanNotes,
  isValidGstin,
  lineFromInclusive,
  lineGst,
  lineTotal,
  splitTax,
} from "./gst";

describe("inclusive GST rounding", () => {
  it("keeps a ₹100 bill at 18% equal to 100.00", () => {
    const line = lineFromInclusive(100, 18);
    expect(lineTotal(line)).toBe(100);
    expect(lineGst(line)).toBe(gstFromInclusive(100, 18));
    expect(line.taxable).toBe(84.75);
    expect(lineGst(line)).toBe(15.25);
  });
});

describe("tax split", () => {
  it("splits intra-state GST into CGST and SGST", () => {
    const form = emptyPurchase();
    form.tax_type = "intra";
    form.itc_eligible = false;
    const saved = applyLinesToInput(form, [lineFromInclusive(100, 18)]);
    expect(saved.igst).toBe(0);
    expect(saved.cgst).toBe(7.63);
    expect(saved.sgst).toBe(7.62);
    expect(saved.cgst + saved.sgst).toBe(15.25);
    expect(saved.invoice_total).toBe(100);
    expect(saved.itc_eligible).toBe(false);
    expect(saved.notes).toBeNull();
    expect(saved.lines[0]?.gst).toBe(15.25);
  });

  it("puts interstate GST entirely in IGST", () => {
    const form = emptyPurchase();
    form.tax_type = "inter";
    const saved = applyLinesToInput(form, [lineFromInclusive(118, 18)]);
    expect(saved.cgst).toBe(0);
    expect(saved.sgst).toBe(0);
    expect(saved.igst).toBe(18);
    expect(saved.invoice_total).toBe(118);
  });

  it("splitTax halves odd paisa onto SGST", () => {
    expect(splitTax(1.01, "intra")).toEqual({ cgst: 0.51, sgst: 0.5, igst: 0 });
  });
});

describe("GSTIN checksum", () => {
  it("accepts a check-digit-valid GSTIN and rejects the placeholder", () => {
    const body = "27AAAAA0000A1Z";
    const gstin = body + gstinCheckDigit(body);
    expect(gstin).toHaveLength(15);
    expect(isValidGstin(gstin)).toBe(true);
    expect(isValidGstin("27AAAAA0000A1Z5")).toBe(false);
    expect(isValidGstin("not-a-gstin")).toBe(false);
  });
});

describe("notes vs lines", () => {
  it("reads lines from the column and keeps notes human", () => {
    const lines = decodeLines({
      lines: [{ taxable: 84.75, rate: 18, gst: 15.25 }],
      notes: "Paid in cash",
      taxable_value: 84.75,
      gst_rate: 18,
    });
    expect(lines).toEqual([{ taxable: 84.75, rate: 18, gst: 15.25 }]);
    expect(humanNotes("Paid in cash")).toBe("Paid in cash");
    expect(humanNotes('GSTLINES:[{"a":10,"r":18}]')).toBeNull();
    expect(humanNotes('GSTLINES:{"v":1,"items":[{"a":10,"r":18}],"n":"hello"}')).toBe("hello");
  });

  it("still decodes legacy GSTLINES notes when the column is empty", () => {
    const lines = decodeLines({
      notes: 'GSTLINES:[{"a":100,"r":5}]',
      taxable_value: 0,
      gst_rate: 18,
    });
    expect(lines[0]?.taxable).toBe(100);
    expect(lines[0]?.rate).toBe(5);
  });
});
