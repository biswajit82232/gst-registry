"use client";

import { useMemo, useState } from "react";
import { FyBar, MonthBar } from "@/components/month-bar";
import { Alert, Button, Section } from "@/components/ui";
import {
  formatCompact,
  fyLabelFromStart,
  fyRangeFromStart,
  fyStartYearFromMonth,
  monthLabel,
  monthRange,
  monthShort,
  monthsInFy,
} from "@/lib/format";
import { totalsOf } from "@/lib/gst";
import { useRegistry } from "@/lib/offline/registry";
import { downloadPurchasePdf } from "@/lib/pdf";

function Summary({
  count,
  gst,
  got,
  waiting,
}: {
  count: number;
  gst: number;
  got: number;
  waiting: number;
}) {
  return (
    <p className="tabular text-[13px] text-muted">
      Waiting {formatCompact(waiting)}
      <span className="mx-1.5 text-line">·</span>
      Got {formatCompact(got)}
      <span className="mx-1.5 text-line">·</span>
      {count} {count === 1 ? "bill" : "bills"}
      <span className="mx-1.5 text-line">·</span>
      GST {formatCompact(gst)}
    </p>
  );
}

export default function ReportsPage() {
  const { purchases, profile, month, setMonth } = useRegistry();
  const [fyStart, setFyStart] = useState(() => fyStartYearFromMonth(month));
  const [hint, setHint] = useState("");

  const monthRows = useMemo(() => {
    const range = monthRange(month);
    return purchases.filter((row) => row.invoice_date >= range.start && row.invoice_date <= range.end);
  }, [purchases, month]);
  const monthTotals = useMemo(() => totalsOf(monthRows), [monthRows]);

  const fy = fyRangeFromStart(fyStart);
  const fyRows = useMemo(
    () => purchases.filter((row) => row.invoice_date >= fy.start && row.invoice_date <= fy.end),
    [purchases, fy.start, fy.end],
  );
  const fyTotals = useMemo(() => totalsOf(fyRows), [fyRows]);
  const fyMonths = useMemo(
    () =>
      monthsInFy(fyStart).map((ym) => {
        const range = monthRange(ym);
        const rows = fyRows.filter(
          (row) => row.invoice_date >= range.start && row.invoice_date <= range.end,
        );
        return { ym, label: monthShort(ym), rows, totals: totalsOf(rows) };
      }),
    [fyStart, fyRows],
  );
  const fyMonthsWithBills = fyMonths.filter((bucket) => bucket.rows.length > 0);

  function run(kind: "month" | "fy") {
    setHint("");
    const rows = kind === "month" ? monthRows : fyRows;
    if (rows.length === 0) {
      setHint("No bills in this period.");
      return;
    }
    try {
      downloadPurchasePdf(rows, {
        profile,
        periodLabel: kind === "month" ? monthLabel(month) : fyLabelFromStart(fyStart),
        months: kind === "fy" ? fyMonths : undefined,
      });
    } catch (err) {
      setHint(err instanceof Error ? err.message : "Could not make the PDF.");
    }
  }

  return (
    <div className="space-y-8">
      {hint ? <Alert tone="danger">{hint}</Alert> : null}
      {!profile?.gstin ? (
        <p className="text-[13px] leading-snug text-muted">Add your GSTIN in Settings to print it on the PDF.</p>
      ) : null}

      <Section title="This month">
        <MonthBar month={month} onChange={setMonth} />
        <Summary
          count={monthTotals.count}
          gst={monthTotals.gst}
          got={monthTotals.gotGst}
          waiting={monthTotals.waitingGst}
        />
        <Button type="button" className="w-full" disabled={monthRows.length === 0} onClick={() => run("month")}>
          Download month PDF
        </Button>
      </Section>

      <Section title="Financial year">
        <FyBar startYear={fyStart} onChange={setFyStart} />
        <Summary
          count={fyTotals.count}
          gst={fyTotals.gst}
          got={fyTotals.gotGst}
          waiting={fyTotals.waitingGst}
        />
        {fyMonthsWithBills.length > 0 ? (
          <ul className="divide-y divide-line border-y border-line">
            {fyMonthsWithBills.map((bucket) => (
              <li key={bucket.ym} className="flex items-baseline justify-between gap-3 py-2.5">
                <span className="text-[14px]">{bucket.label}</span>
                <span className="tabular shrink-0 text-[13px] text-muted">
                  {bucket.totals.count} {bucket.totals.count === 1 ? "bill" : "bills"}
                  <span className="mx-1.5 text-line">·</span>
                  {formatCompact(bucket.totals.gst)} GST
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        <Button type="button" className="w-full" disabled={fyRows.length === 0} onClick={() => run("fy")}>
          Download FY PDF
        </Button>
      </Section>
    </div>
  );
}
