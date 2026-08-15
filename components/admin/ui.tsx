import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 max-w-2xl">
        <h1 className="font-display text-2xl tracking-tight text-foreground sm:text-3xl">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 text-sm leading-relaxed text-muted">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="panel relative overflow-hidden py-4">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
        {label}
      </p>
      <p
        className={`mt-2 font-display text-2xl tracking-tight sm:text-3xl ${
          accent ? "text-accent" : "text-foreground"
        }`}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function Section({
  title,
  description,
  actions,
  children,
  className = "",
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`space-y-3 ${className}`}>
      {(title || actions) && (
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            {title && <h2 className="font-display text-lg text-foreground">{title}</h2>}
            {description && (
              <p className="mt-0.5 text-sm text-muted">{description}</p>
            )}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="panel flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <p className="font-medium text-foreground">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function AdminLoading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="space-y-4" aria-busy aria-live="polite">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-white/8" />
      <div className="h-4 w-80 max-w-full animate-pulse rounded bg-white/5" />
      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="panel h-24 animate-pulse bg-white/[0.03]" />
        ))}
      </div>
      <p className="text-sm text-muted">{label}</p>
    </div>
  );
}

export function InlineAlert({
  tone = "info",
  children,
}: {
  tone?: "info" | "warn" | "success" | "error";
  children: ReactNode;
}) {
  const styles = {
    info: "bg-accent/10 text-accent ring-accent/25",
    warn: "bg-amber-500/10 text-amber-100 ring-amber-500/30",
    success: "bg-accent/10 text-accent ring-accent/30",
    error: "bg-red-500/10 text-red-200 ring-red-500/30",
  }[tone];

  return (
    <div className={`rounded-xl px-3.5 py-2.5 text-sm ring-1 ${styles}`}>
      {children}
    </div>
  );
}

export function RowCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`panel flex flex-wrap items-center justify-between gap-3 py-3.5 ${className}`}
    >
      {children}
    </div>
  );
}
