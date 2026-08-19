import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "accent" | "danger";
type Size = "sm" | "md" | "lg";

/** الكبسولة هي شكل الأزرار في هذه الهوية — لا حواف قائمة في أي مكان. */
const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-bold transition-all disabled:opacity-60 disabled:cursor-not-allowed";

const variants: Record<Variant, string> = {
  primary: "bg-brand text-white shadow-[0_8px_20px_-10px_rgb(14_124_123/0.7)] hover:bg-brand-hover hover:shadow-[0_10px_26px_-10px_rgb(14_124_123/0.75)]",
  secondary: "bg-surface text-ink border border-line-strong hover:border-brand-line hover:bg-surface-tint",
  ghost: "text-brand hover:bg-brand-soft",
  accent: "bg-accent text-white shadow-[0_8px_20px_-10px_rgb(255_107_74/0.8)] hover:bg-accent-hover",
  danger: "bg-danger text-white hover:brightness-95",
};

const sizes: Record<Size, string> = {
  sm: "text-sm px-4 py-1.5",
  md: "text-sm px-5 py-2.5",
  lg: "text-base px-7 py-3.5",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra?: string) {
  return cn(base, variants[variant], sizes[size], extra);
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size; children: ReactNode }) {
  return (
    <Link className={buttonClass(variant, size, className)} {...props}>
      {children}
    </Link>
  );
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return (
    <button className={buttonClass(variant, size, className)} {...props}>
      {children}
    </button>
  );
}
