import { cn } from '@/lib/utils';

/** شارة صغيرة متحركة تُستعمل في العناوين */
export function Pulse({ className }: { className?: string }) {
  return (
    <span className={cn('relative flex size-2', className)} aria-hidden>
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/60" />
      <span className="relative inline-flex size-2 rounded-full bg-primary" />
    </span>
  );
}
