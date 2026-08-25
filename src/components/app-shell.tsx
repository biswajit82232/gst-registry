"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BottomNav } from "./bottom-nav";
import { SyncBadge } from "./sync-badge";
import { ThemeToggle } from "./theme-toggle";
import { cn } from "./ui";
import { useRegistry } from "@/lib/offline/registry";

const links = [
  { href: "/", label: "Register" },
  { href: "/purchases/new", label: "Add bill" },
  { href: "/suppliers", label: "Parties" },
  { href: "/settings", label: "Settings" },
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

function isActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/" || (pathname.startsWith("/purchases") && pathname !== "/purchases/new");
  }
  if (href === "/suppliers") return pathname.startsWith("/suppliers");
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { profile } = useRegistry();
  const title = titleFor(pathname);

  return (
    <div className="min-h-dvh bg-bg">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-bg-elev focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <aside className="fixed inset-y-0 left-0 hidden w-56 border-r border-line p-5 md:flex md:flex-col">
        <Link href="/" className="mb-8 block px-2">
          <span className="block text-[15px] font-semibold tracking-tight">GST Registry</span>
          <span className="mt-0.5 block truncate text-[12px] text-muted">
            {profile?.business_name || "Purchase register"}
          </span>
        </Link>
        <nav aria-label="Primary" className="flex flex-1 flex-col gap-1">
          {links.map((link) => {
            const active = isActive(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                prefetch
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center rounded-md px-2 text-[14px]",
                  active ? "font-medium text-ink" : "text-muted hover:text-ink",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="md:pl-56">
        <header className="safe-top safe-x sticky top-0 z-30 flex items-end justify-between gap-3 bg-bg/90 pb-3 backdrop-blur md:px-8">
          <div className="min-w-0">
            {profile?.business_name ? (
              <p className="truncate text-[12px] text-muted">{profile.business_name}</p>
            ) : (
              <p className="truncate text-[12px] text-muted md:hidden">GST Registry</p>
            )}
            <h1 className="truncate text-[20px] font-semibold tracking-tight">{title}</h1>
          </div>
          <div className="flex shrink-0 items-center">
            <SyncBadge />
            <ThemeToggle />
          </div>
        </header>
        <main
          id="main"
          className="safe-x mx-auto w-full max-w-2xl pb-[calc(var(--nav-h)+env(safe-area-inset-bottom,0px)+1rem)] pt-2 md:px-8 md:pb-12 md:pt-4"
        >
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
