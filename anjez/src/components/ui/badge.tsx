import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "brand" | "success" | "warning" | "danger" | "info" | "gold";

const tones: Record<Tone, string> = {
  neutral: "bg-surface-soft text-ink-soft border-line",
  brand: "bg-brand-soft text-brand border-brand-line",
  success: "bg-success-soft text-success border-success/20",
  warning: "bg-warning-soft text-warning border-warning/20",
  danger: "bg-danger-soft text-danger border-danger/20",
  info: "bg-info-soft text-info border-info/20",
  gold: "bg-gold-soft text-gold border-gold-line",
};

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** ألوان موحّدة لحالات الطلبات والعمولات والسحوبات في كل الجداول. */
export const STATUS_TONES: Record<string, Tone> = {
  PENDING_PAYMENT: "warning",
  PAID: "info",
  IN_PROGRESS: "info",
  DELIVERED: "brand",
  COMPLETED: "success",
  CANCELLED: "neutral",
  REFUNDED: "danger",
  PENDING: "warning",
  APPROVED: "success",
  REQUESTED: "warning",
  PROCESSING: "info",
  REJECTED: "danger",
  ACTIVE: "success",
  SUSPENDED: "danger",
  BRONZE: "neutral",
  SILVER: "info",
  GOLD: "gold",
};
