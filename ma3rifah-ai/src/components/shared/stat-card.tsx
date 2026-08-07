import type { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn, formatNumber } from '@/lib/utils';

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  tone = 'default',
  className,
}: {
  label: string;
  value: number | string;
  icon?: LucideIcon;
  hint?: string;
  tone?: 'default' | 'success' | 'warning' | 'destructive';
  className?: string;
}) {
  const toneClasses = {
    default: 'text-primary bg-primary/10',
    success: 'text-[hsl(var(--success))] bg-[hsl(var(--success))]/10',
    warning: 'text-[hsl(var(--warning))] bg-[hsl(var(--warning))]/10',
    destructive: 'text-destructive bg-destructive/10',
  }[tone];

  return (
    <Card className={cn('p-5', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">
            {typeof value === 'number' ? formatNumber(value) : value}
          </p>
          {hint ? <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        {Icon ? (
          <div className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', toneClasses)}>
            <Icon className="size-4.5" aria-hidden />
          </div>
        ) : null}
      </div>
    </Card>
  );
}
