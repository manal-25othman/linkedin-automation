import { cn } from "@/lib/cn";

/**
 * علامة أنجز: علامة صحّ (الإنجاز) داخل مربّع تركوازي، ونقطة مرجانية تكسر
 * الشكل وتربط العلامة بلون الإشارة في بقية الواجهة.
 * مرسومة كـ SVG سطري لا كصورة: تأخذ لونها من `currentColor` حين تُستعمل فوق
 * خلفية داكنة، وتبقى حادّة على أي كثافة شاشة.
 */
export function LogoMark({
  className,
  onDark = false,
}: {
  className?: string;
  onDark?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={cn("size-9 shrink-0", className)}
      role="img"
      aria-label="أنجز"
    >
      {/* على الخلفيات الداكنة تنقلب العلامة: مربّع فاتح وعلامة تركوازية،
          فتبقى مقروءة بلا الاعتماد على شفافية قد تذوب في الخلفية. */}
      <rect
        width="64"
        height="64"
        rx="18"
        className={onDark ? "fill-canvas" : "fill-brand"}
      />
      <path
        d="M16 33.5 L27 44 L48 21"
        fill="none"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={onDark ? "stroke-brand" : "stroke-canvas"}
      />
      <circle cx="47" cy="45" r="6" className="fill-accent" />
    </svg>
  );
}

export function Logo({
  className,
  onDark = false,
}: {
  className?: string;
  onDark?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark onDark={onDark} className="size-9" />
      <span className="font-display text-xl font-extrabold tracking-tight">أنجز</span>
    </span>
  );
}
