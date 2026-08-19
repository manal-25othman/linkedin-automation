"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { buttonClass } from "@/components/ui/button";

/** زر إرسال يعطّل نفسه أثناء تنفيذ الـ Server Action ويمنع الإرسال المكرر. */
export function SubmitButton({
  children,
  pendingText,
  variant = "primary",
  size = "md",
  className,
}: {
  children: ReactNode;
  pendingText?: string;
  variant?: "primary" | "secondary" | "ghost" | "accent" | "danger";
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending} className={buttonClass(variant, size, className)}>
      {pending ? (pendingText ?? "جارٍ الحفظ…") : children}
    </button>
  );
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs font-medium text-danger">{message}</p>;
}

export function FormMessage({
  status,
  message,
}: {
  status: "idle" | "success" | "error";
  message: string;
}) {
  if (status === "idle" || !message) return null;

  return (
    <p
      role="status"
      className={cn(
        "rounded-xl border px-4 py-3 text-sm font-medium",
        status === "success"
          ? "border-success/20 bg-success-soft text-success"
          : "border-danger/20 bg-danger-soft text-danger",
      )}
    >
      {message}
    </p>
  );
}
