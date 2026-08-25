import Link from "next/link";

export function cn(...inputs: Array<string | false | null | undefined>) {
  return inputs.filter(Boolean).join(" ");
}

export function Field({
  label,
  hint,
  children,
  className,
  as = "label",
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
  as?: "label" | "div";
}) {
  const Tag = as;
  return (
    <Tag className={cn("block space-y-0.5", className)}>
      <span className="text-[11px] font-medium text-muted">{label}</span>
      {children}
      {hint ? <span className="block text-[10px] leading-tight text-muted">{hint}</span> : null}
    </Tag>
  );
}

export function inputClass(extra?: string) {
  return cn(
    "field-input h-9 w-full rounded-md border border-line bg-bg-elev px-2.5 text-ink",
    "placeholder:text-muted/70 disabled:opacity-50",
    extra,
  );
}

export function Button({
  children,
  variant = "primary",
  className,
  size = "md",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md";
}) {
  const styles = {
    primary: "bg-teal-700 text-white dark:bg-teal-400 dark:text-teal-950 active:opacity-80",
    ghost: "bg-transparent text-ink active:bg-line/60",
    danger: "bg-rose-600 text-white active:bg-rose-700",
    outline: "border border-line bg-bg-elev text-ink active:bg-line/40",
  } as const;
  const sizes = {
    sm: "h-8 px-2.5 text-[12px]",
    md: "h-9 px-3 text-[13px]",
  } as const;

  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-md font-semibold transition disabled:opacity-50",
        styles[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function StatStrip({
  items,
}: {
  items: { label: string; value: string; accent?: boolean; href?: string }[];
}) {
  return (
    <div
      className="grid overflow-hidden rounded-md border border-line bg-bg-elev"
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
    >
      {items.map((item, i) => {
        const inner = (
          <>
            <p className={cn("text-[9px] leading-none", item.accent ? "opacity-80" : "text-muted")}>
              {item.label}
            </p>
            <p className="tabular mt-0.5 truncate text-[11px] font-semibold leading-tight">
              {item.value}
            </p>
          </>
        );
        const cls = cn(
          "flex min-h-11 min-w-0 flex-col items-center justify-center px-1 py-1.5 text-center",
          i > 0 && "border-l border-line",
          item.accent && "bg-amber-400 text-amber-950 dark:bg-amber-400",
        );
        return item.href ? (
          <Link key={item.label} href={item.href} className={cls} aria-label={`${item.label} ${item.value}`}>
            {inner}
          </Link>
        ) : (
          <div key={item.label} className={cls}>
            {inner}
          </div>
        );
      })}
    </div>
  );
}

export function Empty({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-dashed border-line px-3 py-5 text-center">
      <p className="text-[13px] font-medium">{title}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-muted">{hint}</p> : null}
      {children}
    </div>
  );
}

export function Alert({
  children,
  tone = "warn",
}: {
  children: React.ReactNode;
  tone?: "warn" | "danger" | "muted";
}) {
  const styles = {
    warn: "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100",
    danger: "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200",
    muted: "border-line bg-bg-elev text-muted",
  } as const;
  return (
    <p className={cn("rounded-md border px-2 py-1.5 text-[11px] leading-snug", styles[tone])} role="status">
      {children}
    </p>
  );
}

export function UndoBar({
  message,
  onUndo,
}: {
  message: string;
  onUndo: () => void;
}) {
  return (
    <div className="flex min-h-10 items-center justify-between gap-2 rounded-md bg-ink px-2 py-1.5 text-[12px] text-bg-elev">
      <span>{message}</span>
      <button
        type="button"
        onClick={onUndo}
        className="min-h-8 min-w-11 font-semibold underline-offset-2 hover:underline"
      >
        Undo
      </button>
    </div>
  );
}
