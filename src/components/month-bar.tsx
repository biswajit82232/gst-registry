"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { fyLabelFromStart, monthLabel, shiftMonth } from "@/lib/format";

function PeriodNav({
  label,
  ariaLabel,
  onPrev,
  onNext,
  prevLabel,
  nextLabel,
}: {
  label: string;
  ariaLabel: string;
  onPrev: () => void;
  onNext: () => void;
  prevLabel: string;
  nextLabel: string;
}) {
  return (
    <div className="flex items-center justify-between" role="navigation" aria-label={ariaLabel}>
      <button
        type="button"
        className="flex h-11 w-11 items-center justify-center rounded-md text-muted active:bg-line/50"
        onClick={onPrev}
        aria-label={prevLabel}
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <p className="text-[15px] font-medium tracking-tight" aria-live="polite">
        {label}
      </p>
      <button
        type="button"
        className="flex h-11 w-11 items-center justify-center rounded-md text-muted active:bg-line/50"
        onClick={onNext}
        aria-label={nextLabel}
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  );
}

export function MonthBar({
  month,
  onChange,
}: {
  month: string;
  onChange: (next: string) => void;
}) {
  return (
    <PeriodNav
      label={monthLabel(month)}
      ariaLabel="Month"
      onPrev={() => onChange(shiftMonth(month, -1))}
      onNext={() => onChange(shiftMonth(month, 1))}
      prevLabel="Previous month"
      nextLabel="Next month"
    />
  );
}

export function FyBar({
  startYear,
  onChange,
}: {
  startYear: number;
  onChange: (next: number) => void;
}) {
  return (
    <PeriodNav
      label={fyLabelFromStart(startYear)}
      ariaLabel="Financial year"
      onPrev={() => onChange(startYear - 1)}
      onNext={() => onChange(startYear + 1)}
      prevLabel="Previous financial year"
      nextLabel="Next financial year"
    />
  );
}
