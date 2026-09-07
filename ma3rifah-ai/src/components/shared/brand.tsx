import Link from 'next/link';
import { cn } from '@/lib/utils';

/**
 * علامة «بديهة»: شرارة رباعية — الفكرة تحضر في لحظتها.
 *
 * الشرارة الكبرى ذهبية وحدها، والصغرى بيضاء شفافة: لمسة ذهب واحدة
 * تكفي، وتوزيعه على العنصرين يُفقد العلامة رصانتها.
 * الأشكال نفسها مكرَّرة في public/icon.svg بألوان صريحة لأيقونة التبويب.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden
      className={cn('size-8 shrink-0', className)}
    >
      <rect width="32" height="32" rx="8" className="fill-primary" />
      <path
        d="M14.5 6c.7 5.4 3 7.7 8.5 8.5-5.5.8-7.8 3.1-8.5 8.5-.7-5.4-3-7.7-8.5-8.5 5.5-.8 7.8-3.1 8.5-8.5Z"
        className="fill-gold"
      />
      <path
        d="M23.5 19c.4 3 1.6 4.2 4.5 4.5-2.9.3-4.1 1.5-4.5 4.5-.4-3-1.6-4.2-4.5-4.5 2.9-.3 4.1-1.5 4.5-4.5Z"
        className="fill-primary-foreground"
        opacity="0.75"
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
      {showText ? <span className="text-lg">بديهة</span> : null}
    </Link>
  );
}
