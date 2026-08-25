"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export function ThemeToggle() {
  const { setTheme } = useTheme();

  return (
    <button
      type="button"
      aria-label="Toggle color theme"
      onClick={() => {
        const dark = document.documentElement.classList.contains("dark");
        setTheme(dark ? "light" : "dark");
      }}
      className="inline-flex h-11 w-11 items-center justify-center rounded-md text-muted active:bg-line/40"
    >
      <Sun className="hidden h-4 w-4 dark:block" />
      <Moon className="h-4 w-4 dark:hidden" />
    </button>
  );
}
