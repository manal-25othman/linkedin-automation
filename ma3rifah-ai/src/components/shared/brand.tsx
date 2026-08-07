import Link from 'next/link';
import { cn } from '@/lib/utils';

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden
      className={cn('size-8 shrink-0', className)}
    >
      <rect width="32" height="32" rx="8" className="fill-primary" />
      {/* ثلاث طبقات: المستندات تتحوّل إلى معرفة */}
      <path
        d="M8 11.5 16 7.5l8 4-8 4-8-4Z"
        className="fill-primary-foreground"
        opacity="0.95"
      />
      <path
        d="M8 16l8 4 8-4"
        stroke="currentColor"
        className="text-primary-foreground"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.7"
      />
      <path
        d="M8 20.5l8 4 8-4"
        stroke="currentColor"
        className="text-primary-foreground"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.45"
      />
    </svg>
  );
}

export function Logo({
  href = '/',
  className,
  showText = true,
}: {
  href?: string;
  className?: string;
  showText?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn('flex items-center gap-2.5 font-semibold tracking-tight', className)}
    >
      <LogoMark />
      {showText ? (
        <span className="text-lg">
          معرفة <span className="text-primary">AI</span>
        </span>
      ) : null}
    </Link>
  );
}
