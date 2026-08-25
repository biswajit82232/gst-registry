"use client";

import { BrandMark } from "./brand";

export function SetupScreen() {
  return (
    <div className="app-root mx-auto max-w-lg px-4 py-16">
      <BrandMark size={64} alt="" />
      <p className="mt-4 text-[12px] text-muted">GST Registry</p>
      <h1 className="mt-2 text-[24px] font-semibold tracking-tight">Connect Supabase to start</h1>
      <ol className="mt-6 list-decimal space-y-3 pl-5 text-[15px] leading-6 text-muted">
        <li>Create a free project at supabase.com</li>
        <li>
          Run <code className="text-ink">supabase/schema.sql</code> in the SQL editor
        </li>
        <li>
          Copy the project URL and anon key into <code className="text-ink">.env.local</code>
        </li>
        <li>On Vercel, add the same two environment variables and redeploy</li>
      </ol>
      <pre className="mt-6 overflow-x-auto text-[13px] text-muted">
        {`NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...`}
      </pre>
    </div>
  );
}
