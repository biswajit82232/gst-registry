"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { monthLabel, shiftMonth } from "@/lib/format";

export function MonthBar({
  month,
  onChange,
}: {
  month: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className="flex items-center justify-between" role="navigation" aria-label="Month">
      <button
        type="button"
        className="flex h-11 w-11 items-center justify-center rounded-md text-muted active:bg-line/50"
        onClick={() => onChange(shiftMonth(month, -1))}
        aria-label="Previous month"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <p className="text-[15px] font-medium tracking-tight" aria-live="polite">
        {monthLabel(month)}
      </p>
      <button
        type="button"
        className="flex h-11 w-11 items-center justify-center rounded-md text-muted active:bg-line/50"
        onClick={() => onChange(shiftMonth(month, 1))}
        aria-label="Next month"
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  );
}
