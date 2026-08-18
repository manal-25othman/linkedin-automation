import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Stat({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "default" | "brand" | "gold" | "success" | "muted";
}) {
  const tones = {
    default: "text-ink",
    brand: "text-brand",
    gold: "text-gold",
    success: "text-success",
    muted: "text-ink-muted",
  } as const;

  return (
    <div className="card p-5">
      <p className="text-xs font-medium text-ink-muted">{label}</p>
      <p className={cn("mt-1 font-display text-2xl font-extrabold tabular", tones[tone])}>
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-ink-faint">{hint}</p> : null}
    </div>
  );
}

export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <div className="card p-10 text-center">
      <p className="font-semibold">{title}</p>
      {body ? <p className="mt-2 text-sm text-ink-muted">{body}</p> : null}
    </div>
  );
}
