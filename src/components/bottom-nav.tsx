"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileSpreadsheet, Home, Plus, Users, Wallet } from "lucide-react";
import { cn } from "./ui";

const items = [
  { href: "/", label: "Home", icon: Home },
  { href: "/purchases", label: "Recon", icon: Wallet },
  { href: "/purchases/new", label: "Add", icon: Plus },
  { href: "/suppliers", label: "Parties", icon: Users },
  { href: "/reports", label: "Reports", icon: FileSpreadsheet },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="bottom-nav fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg-elev/95 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur md:hidden"
    >
      <ul className="grid grid-cols-5">
        {items.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href ||
                (item.href === "/purchases" &&
                  pathname.startsWith("/purchases") &&
                  pathname !== "/purchases/new") ||
                (item.href === "/suppliers" && pathname.startsWith("/suppliers"));
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                prefetch
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 flex-col items-center justify-center gap-0 py-1 text-[10px] font-medium",
                  active ? "text-teal-700 dark:text-teal-300" : "text-muted",
                )}
              >
                <Icon className="h-4 w-4" strokeWidth={active ? 2.4 : 1.8} />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
