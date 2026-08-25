# GST Registry

Mobile-first web app to log GST purchases, see how much tax you paid, and hand a clean pack to your CA.

## What it does

- Add a bill in under a minute: date, supplier, invoice, GST-inclusive amount
- Splits CGST + SGST or IGST from your GSTIN vs the supplier’s GSTIN
- Tracks whether input has shown up in GSTR-2B (Waiting / Got / No)
- Month and financial-year totals
- CA-ready PDF register with CGST / SGST / IGST columns
- Email login, data in your Supabase project, dark mode, offline copy on the device

CSV import/export helpers exist in code but are not on the Reports screen yet.

## Setup

### 1. Supabase (CLI)

Install the [Supabase CLI](https://supabase.com/docs/guides/cli), then from this repo:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
```

**New project:** push every migration.

```bash
npx supabase db push
```

**Existing project** that already ran the old SQL editor scripts (`schema.sql` / `suppliers.sql` / `input-status.sql`): mark the baseline as already applied, then push the tax-lines migration only.

```bash
npx supabase migration repair --status applied 20260825173332
npx supabase db push
```

That second migration adds `purchases.lines`, repairs intra-state bills that were stored as all-IGST, constrains `input_status`, and moves `handle_new_user` out of `public`.

Authentication → URL configuration:

- Site URL: `http://localhost:3000` (later your Vercel URL)
- Redirect URLs: `http://localhost:3000/auth/callback` and `https://YOUR-APP.vercel.app/auth/callback`

Optional: Authentication → Providers → Email → turn **Confirm email** off while you test.

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

```bash
npm test
```

### 3. Vercel

1. Open [vercel.com](https://vercel.com) and sign in with GitHub.
2. **Add New… → Project** → import `biswajit82232/gst-registry`.
3. Leave Framework Preset as **Next.js**. Root Directory blank.
4. **Environment Variables** (Production, Preview, and Development):

   | Name | Value |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://YOUR-PROJECT.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the anon / publishable key from Supabase → Settings → API |

5. Click **Deploy**. Copy the URL, e.g. `https://gst-registry.vercel.app`.
6. In Supabase → Authentication → URL configuration:
   - **Site URL:** `https://gst-registry.vercel.app`
   - **Redirect URLs:** `https://gst-registry.vercel.app/auth/callback` and `http://localhost:3000/auth/callback`
7. Open the Vercel URL on your phone (HTTPS is required for PWA). Chrome / Edge: menu → **Install app**. iPhone Safari: Share → **Add to Home Screen**.

Your data stays in Supabase. Vercel only hosts the UI. After the first visit, bills already on the phone still open if the network drops.

### PWA

The app installs as a standalone home-screen app. A service worker caches the shell; purchase data already lives in IndexedDB on the device. Install from **Settings** after you deploy.

## CA workflow

1. Log bills through the month
2. Open **Reports** → this month or this FY
3. Download PDF for the CA
4. Flag **No** and **Waiting** before filing — those are the usual GSTR-2B mismatches

Schema source of truth is `supabase/migrations/`. The SQL files in `supabase/*.sql` are pointers only.
