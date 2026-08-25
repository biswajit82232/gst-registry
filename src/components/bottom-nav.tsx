"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Plus, Settings2, Users } from "lucide-react";
import { cn } from "./ui";

const items = [
  { href: "/", label: "Register", icon: Home },
  { href: "/purchases/new", label: "Add", icon: Plus, primary: true },
  { href: "/suppliers", label: "Parties", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings2 },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="bottom-nav fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur md:hidden"
    >
      <ul className="grid grid-cols-4">
        {items.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/" || (pathname.startsWith("/purchases") && pathname !== "/purchases/new")
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                prefetch
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 py-1.5 text-[11px]",
                  active ? "font-medium text-ink" : "text-muted",
                )}
              >
                <Icon
                  className={cn("h-[18px] w-[18px]", item.primary && !active && "text-teal-800 dark:text-teal-300")}
                  strokeWidth={active || item.primary ? 2.2 : 1.7}
                />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
