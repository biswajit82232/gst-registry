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
    <div className="flex items-center justify-between">
      <button
        type="button"
        className="flex h-10 w-10 items-center justify-center rounded-md text-muted active:bg-line/50"
        onClick={() => onChange(shiftMonth(month, -1))}
        aria-label="Previous month"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <p className="text-[13px] font-semibold" aria-live="polite">
        {monthLabel(month)}
      </p>
      <button
        type="button"
        className="flex h-10 w-10 items-center justify-center rounded-md text-muted active:bg-line/50"
        onClick={() => onChange(shiftMonth(month, 1))}
        aria-label="Next month"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
