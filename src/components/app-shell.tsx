"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Plus, Settings2, Stamp, Users } from "lucide-react";
import { BottomNav } from "./bottom-nav";
import { SyncBadge } from "./sync-badge";
import { ThemeToggle } from "./theme-toggle";
import { cn } from "./ui";
import { useRegistry } from "@/lib/offline/registry";

const links = [
  { href: "/", label: "Register", icon: Home },
  { href: "/purchases/new", label: "Add bill", icon: Plus },
  { href: "/suppliers", label: "Parties", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings2 },
];

function titleFor(pathname: string): string {
  if (pathname === "/") return "Register";
  if (pathname === "/purchases/new") return "Add bill";
  if (pathname.startsWith("/purchases/")) return "Bill";
  if (pathname === "/suppliers/new") return "New party";
  if (pathname.startsWith("/suppliers/")) return "Party";
  if (pathname === "/suppliers") return "Parties";
  if (pathname === "/settings") return "Settings";
  return "GST Registry";
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { profile } = useRegistry();
  const title = titleFor(pathname);

  return (
    <div className="min-h-dvh bg-bg">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-bg-elev focus:px-2 focus:py-1"
      >
        Skip to content
      </a>
      <aside className="fixed inset-y-0 left-0 hidden w-52 border-r border-line bg-bg-elev p-2.5 md:flex md:flex-col">
        <Link href="/" className="mb-3 flex items-center gap-2 px-1.5 py-1">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-teal-700 text-white dark:bg-teal-400 dark:text-teal-950">
            <Stamp className="h-3.5 w-3.5" />
          </span>
          <span className="min-w-0">
            <span className="block text-[13px] font-bold leading-tight">GST Registry</span>
            <span className="block truncate text-[10px] text-muted">
              {profile?.business_name || "Purchase register"}
            </span>
          </span>
        </Link>
        <nav aria-label="Primary" className="flex flex-1 flex-col gap-0.5">
          {links.map((link) => {
            const Icon = link.icon;
            const active =
              link.href === "/"
                ? pathname === "/" || (pathname.startsWith("/purchases") && pathname !== "/purchases/new")
                : link.href === "/suppliers"
                  ? pathname.startsWith("/suppliers")
                  : pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                prefetch
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-10 items-center gap-2 rounded-md px-2 py-1.5 text-[13px] font-medium",
                  active
                    ? "bg-brand-soft text-teal-800 dark:text-teal-200"
                    : "text-muted hover:bg-line/50 hover:text-ink",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {link.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="md:pl-52">
        <header className="safe-top safe-x sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-line bg-bg/90 py-1.5 backdrop-blur md:px-4 md:py-2">
          <div className="min-w-0">
            {profile?.business_name ? (
              <p className="truncate text-[10px] leading-none text-muted md:hidden">{profile.business_name}</p>
            ) : null}
            <h1 className="truncate text-[15px] font-semibold leading-tight">{title}</h1>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <SyncBadge />
            <ThemeToggle />
          </div>
        </header>
        <main
          id="main"
          className="safe-x mx-auto w-full max-w-3xl pb-[calc(var(--nav-h)+env(safe-area-inset-bottom,0px)+0.5rem)] pt-2 md:px-4 md:pb-8 md:pt-4"
        >
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
