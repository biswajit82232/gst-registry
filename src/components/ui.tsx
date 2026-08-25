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
    <Tag className={cn("block space-y-1.5", className)}>
      <span className="text-[12px] text-muted">{label}</span>
      {children}
      {hint ? <span className="block text-[12px] leading-snug text-muted">{hint}</span> : null}
    </Tag>
  );
}

export function Section({
  title,
  children,
  className,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-3", className)}>
      {title ? <h2 className="text-[12px] text-muted">{title}</h2> : null}
      {children}
    </section>
  );
}

export function inputClass(extra?: string) {
  return cn(
    "field-input h-11 w-full rounded-md border border-line bg-bg-elev px-3 text-ink",
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
    primary: "bg-teal-800 text-white dark:bg-teal-400 dark:text-teal-950 active:opacity-80",
    ghost: "bg-transparent text-ink active:bg-line/60",
    danger: "text-rose-700 dark:text-rose-300 active:bg-rose-50 dark:active:bg-rose-950/40",
    outline: "border border-line bg-bg-elev text-ink active:bg-line/40",
  } as const;
  const sizes = {
    sm: "h-10 px-3 text-[13px]",
    md: "h-11 px-4 text-[14px]",
  } as const;

  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition disabled:opacity-50",
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

export function Segmented<T extends string | number>({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: T;
  onChange: (next: T) => void;
  options: { id: T; label: string; activeClass?: string }[];
  ariaLabel?: string;
}) {
  return (
    <div className="flex rounded-md bg-line/70 p-0.5 dark:bg-line/80" role="group" aria-label={ariaLabel}>
      {options.map((item) => {
        const active = value === item.id || (typeof value === "number" && Math.abs(Number(value) - Number(item.id)) < 0.001);
        return (
          <button
            key={String(item.id)}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(item.id)}
            className={cn(
              "min-h-10 min-w-0 flex-1 rounded-[10px] px-1 text-[13px] font-medium active:opacity-80",
              active ? cn("bg-bg-elev text-ink shadow-sm", item.activeClass) : "text-muted",
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

export function UnderlineTabs<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: T;
  onChange: (next: T) => void;
  options: { id: T; label: string }[];
  ariaLabel?: string;
}) {
  return (
    <div className="no-scrollbar flex gap-5 overflow-x-auto overscroll-x-contain border-b border-line" role="tablist" aria-label={ariaLabel}>
      {options.map((item) => {
        const active = value === item.id;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.id)}
            className={cn(
              "-mb-px shrink-0 border-b-2 py-2.5 text-[13px] active:opacity-70",
              active ? "border-ink font-medium text-ink" : "border-transparent text-muted",
            )}
          >
            {item.label}
          </button>
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
    <div className="px-1 py-10 text-center">
      <p className="text-[15px] font-medium">{title}</p>
      {hint ? <p className="mt-1 text-[13px] text-muted">{hint}</p> : null}
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
    warn: "text-amber-800 dark:text-amber-200",
    danger: "text-rose-700 dark:text-rose-300",
    muted: "text-muted",
  } as const;
  return (
    <p className={cn("text-[13px] leading-snug", styles[tone])} role="status">
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
    <div className="flex min-h-11 items-center justify-between gap-2 text-[13px]">
      <span className="text-muted">{message}</span>
      <button
        type="button"
        onClick={onUndo}
        className="min-h-10 font-medium text-ink underline-offset-2 hover:underline"
      >
        Undo
      </button>
    </div>
  );
}

export function TextLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link href={href} className={cn("text-[13px] font-medium text-ink underline-offset-2 hover:underline", className)}>
      {children}
    </Link>
  );
}

export function Confirm({
  open,
  title,
  body,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/35 p-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] md:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-lg border border-line bg-bg-elev p-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <p id="confirm-title" className="text-[15px] font-medium">
          {title}
        </p>
        {body ? <p className="mt-1 text-[13px] leading-snug text-muted">{body}</p> : null}
        <div className="mt-4 flex gap-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button type="button" variant="danger" className="flex-1 bg-rose-50 dark:bg-rose-950/40" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
