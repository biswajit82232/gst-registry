# GST Registry

Mobile-first web app to log GST purchases, see how much tax you paid, and hand a clean pack to your CA.

## What it does

- Add a bill in under a minute: date, supplier, invoice, taxable value
- Auto-splits CGST + SGST or IGST from GSTIN + rate
- Tracks ITC eligibility, reverse charge, unpaid bills, missing GSTIN
- Month and financial-year totals
- CSV import / export and a CA-ready PDF register
- Email login, data in your Supabase project, dark mode

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. SQL Editor → paste and run `supabase/schema.sql`
3. Authentication → URL configuration:
   - Site URL: `http://localhost:3000` (later your Vercel URL)
   - Redirect URLs: `http://localhost:3000/auth/callback` and `https://YOUR-APP.vercel.app/auth/callback`
4. Optional: Authentication → Providers → Email → turn **Confirm email** off while you test

### 2. App

```bash
cp .env.example .env.local
```

Fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from Supabase → Settings → API.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), create an account, add your GSTIN in Settings, then log a purchase.

### 3. Vercel

1. Push this repo and import it in Vercel
2. Add the same two `NEXT_PUBLIC_SUPABASE_*` env vars
3. Deploy
4. Put the production URL into Supabase Site URL / Redirect URLs

Your data stays in Supabase (Postgres + auth). The Vercel app is only the UI.

## CA workflow

1. Log bills through the month (or import a CSV from Reports)
2. Open **Reports** → this month or this FY
3. Download PDF for the CA, and CSV as a backup
4. Flag **No GSTIN** and **Unpaid** before filing — those are the usual GSTR-2B mismatches

CSV template is on the Reports screen. Column names can be `invoice_date`, `supplier_name`, `taxable_value`, `gst_rate`, and so on; common aliases like `vendor name` and `purchaser` also work.

## Suppliers (existing projects)

If you already ran `schema.sql` before suppliers existed, also run `supabase/suppliers.sql` once in the SQL editor. That saves a supplier directory, backfills parties from old bills, and links history.

To track **Got input** vs waiting, run `supabase/input-status.sql` once as well.
