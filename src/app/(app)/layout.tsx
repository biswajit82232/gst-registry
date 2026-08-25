import { AppShell } from "@/components/app-shell";
import { SetupScreen } from "@/components/setup-screen";
import { RegistryProvider } from "@/lib/offline/registry";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured()) {
    return <SetupScreen />;
  }
  return (
    <RegistryProvider>
      <AppShell>{children}</AppShell>
    </RegistryProvider>
  );
}
