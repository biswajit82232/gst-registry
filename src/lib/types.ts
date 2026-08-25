export type Category = "goods" | "services" | "capital";
export type TaxType = "intra" | "inter";
export type PaymentStatus = "paid" | "unpaid";
export type InputStatus = "waiting" | "got" | "missing";

export type BillLine = {
  taxable: number;
  rate: number;
  gst?: number;
};

export type Profile = {
  id: string;
  business_name: string | null;
  gstin: string | null;
  state_code: string | null;
  email: string | null;
};

export type Purchase = {
  id: string;
  user_id: string;
  invoice_date: string;
  invoice_number: string;
  supplier_name: string;
  supplier_gstin: string | null;
  purchased_by: string | null;
  category: Category;
  hsn_sac: string | null;
  taxable_value: number;
  gst_rate: number;
  tax_type: TaxType;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  invoice_total: number;
  itc_eligible: boolean;
  reverse_charge: boolean;
  payment_status: PaymentStatus;
  payment_date: string | null;
  place_of_supply: string | null;
  notes: string | null;
  lines: BillLine[];
  supplier_id: string | null;
  input_status: InputStatus;
  input_on: string | null;
  created_at: string;
  updated_at: string;
};

export type PurchaseInput = Omit<
  Purchase,
  "id" | "user_id" | "created_at" | "updated_at"
>;

export type PurchaseTotals = {
  count: number;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  gst: number;
  total: number;
  itc: number;
  ineligible: number;
  missingGstin: number;
  unpaid: number;
  waitingGst: number;
  gotGst: number;
  missingGst: number;
  waitingCount: number;
  gotCount: number;
};

export type Supplier = {
  id: string;
  user_id: string;
  name: string;
  gstin: string | null;
  phone: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};
