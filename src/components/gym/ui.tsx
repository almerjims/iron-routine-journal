import { useEffect, useState, type ReactNode } from "react";
import { Minus, Plus, TrendingDown, TrendingUp, Minus as Flat, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtNum } from "@/lib/gym/format";
import type { TrendStatus } from "@/lib/gym/calc";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-5 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="truncate text-3xl font-bold uppercase">{title}</h1>
        {subtitle && <div className="mt-0.5 text-sm text-muted-foreground">{subtitle}</div>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

export function EmptyState({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed bg-card/50 px-6 py-10 text-center">
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-secondary text-primary [&_svg]:size-7">{icon}</div>
      <h3 className="text-xl font-semibold">{title}</h3>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">{text}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-3xl font-bold">{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

/** Big numeric input with -/+ steppers. */
export function Stepper({
  value, onChange, step, decimal, label, placeholder,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  step: number;
  decimal?: boolean;
  label: string;
  placeholder?: string;
}) {
  const [text, setText] = useState(value == null ? "" : fmtNum(value));
  useEffect(() => {
    const parsed = text === "" ? null : Number(text.replace(",", "."));
    if (parsed !== value) setText(value == null ? "" : fmtNum(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  const bump = (d: number) => {
    const n = Math.max(0, Math.round(((value ?? 0) + d) * 100) / 100);
    onChange(n);
  };
  return (
    <div className="flex h-12 min-w-0 flex-1 items-stretch overflow-hidden rounded-lg border bg-surface">
      <button type="button" aria-label={`Decrease ${label}`} onClick={() => bump(-step)}
        className="flex w-11 shrink-0 items-center justify-center text-muted-foreground active:bg-accent">
        <Minus className="size-4" />
      </button>
      <input
        aria-label={label}
        inputMode={decimal ? "decimal" : "numeric"}
        value={text}
        placeholder={placeholder}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => {
          const t = e.target.value.replace(/[^0-9.,]/g, "");
          setText(t);
          if (t === "") return onChange(null);
          const n = Number(t.replace(",", "."));
          if (!Number.isNaN(n)) onChange(decimal ? n : Math.round(n));
        }}
        className="w-full min-w-0 bg-transparent text-center text-lg font-semibold outline-none placeholder:text-muted-foreground/50"
      />
      <button type="button" aria-label={`Increase ${label}`} onClick={() => bump(step)}
        className="flex w-11 shrink-0 items-center justify-center text-muted-foreground active:bg-accent">
        <Plus className="size-4" />
      </button>
    </div>
  );
}

const REST_OPTIONS = [30, 45, 60, 75, 90, 120, 150, 180, 240, 300];
export const fmtRest = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` : `${s}s`);

export function RestSelect({ value, onChange, defaultSeconds, className }: {
  value: number | null; onChange: (v: number | null) => void; defaultSeconds: number; className?: string;
}) {
  const v = value == null ? "default" : String(value);
  return (
    <Select value={v} onValueChange={(x) => onChange(x === "default" ? null : Number(x))}>
      <SelectTrigger className={cn("h-10 w-auto gap-1 text-sm", className)} aria-label="Rest timer">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="default">Rest: default ({fmtRest(defaultSeconds)})</SelectItem>
        <SelectItem value="0">Rest: off</SelectItem>
        {REST_OPTIONS.map((s) => (
          <SelectItem key={s} value={String(s)}>Rest: {fmtRest(s)}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function StatusBadge({ status, change, className }: { status: TrendStatus; change?: number; className?: string }) {
  const map = {
    improving: { icon: TrendingUp, label: "Improving", cls: "bg-success/15 text-success" },
    maintaining: { icon: Flat, label: "Maintaining", cls: "bg-secondary text-muted-foreground" },
    declining: { icon: TrendingDown, label: "Declining", cls: "bg-destructive/15 text-destructive" },
    new: { icon: Sparkles, label: "Not enough data", cls: "bg-secondary text-muted-foreground" },
  }[status];
  const Icon = map.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold", map.cls, className)}>
      <Icon className="size-3.5" />
      {map.label}
      {status !== "new" && change != null && <span className="opacity-80">{change >= 0 ? "+" : ""}{(change * 100).toFixed(1)}%</span>}
    </span>
  );
}

export const GROUP_COLORS = ["var(--group-a)", "var(--group-b)", "var(--group-c)", "var(--group-d)"];
export const groupColor = (i: number) => GROUP_COLORS[Math.max(0, i) % GROUP_COLORS.length];

export function GroupBadge({ count, color }: { count: number; color: string }) {
  return (
    <span className="rounded px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-background" style={{ backgroundColor: color }}>
      {count >= 3 ? "Giant set" : "Superset"}
    </span>
  );
}
