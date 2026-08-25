"use client";

export function SetupScreen() {
  return (
    <div className="mx-auto max-w-lg px-3 py-8">
      <p className="text-[12px] font-semibold text-teal-700 dark:text-teal-300">GST Registry</p>
      <h1 className="mt-1 text-lg font-bold">Connect Supabase to start</h1>
      <ol className="mt-3 list-decimal space-y-1.5 pl-4 text-[13px] leading-5 text-muted">
        <li>Create a free project at supabase.com</li>
        <li>
          Run <code className="rounded bg-line px-1">supabase/schema.sql</code> in the SQL editor
        </li>
        <li>
          Copy the project URL and anon key into <code className="rounded bg-line px-1">.env.local</code>
        </li>
        <li>On Vercel, add the same two environment variables and redeploy</li>
      </ol>
      <pre className="mt-3 overflow-x-auto rounded-md border border-line bg-bg-elev p-2 text-[11px]">
        {`NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...`}
      </pre>
    </div>
  );
}
