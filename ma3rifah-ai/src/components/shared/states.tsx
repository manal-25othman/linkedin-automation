import type { LucideIcon } from 'lucide-react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/misc';

/** حالة «لا توجد بيانات» */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/25 px-6 py-14 text-center',
        className,
      )}
    >
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-background shadow-sm">
        <Icon className="size-5 text-muted-foreground" aria-hidden />
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      {description ? (
        <p className="mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

/** حالة الخطأ — رسالة صالحة للعرض فقط، بلا تفاصيل تقنية */
export function ErrorState({
  title = 'تعذّر تحميل البيانات',
  description = 'حدث خطأ أثناء جلب البيانات. حاول تحديث الصفحة.',
  action,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-destructive/25 bg-destructive/5 px-6 py-12 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-background shadow-sm">
        <AlertTriangle className="size-5 text-destructive" aria-hidden />
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

/** حالة التحميل داخل بطاقة */
export function LoadingState({ label = 'جاري التحميل…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2.5 py-12 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" aria-hidden />
      <span>{label}</span>
    </div>
  );
}

/** هيكل تحميل لجدول */
export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <Card className="overflow-hidden">
      <div className="divide-y">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="flex items-center gap-4 px-4 py-3.5">
            {Array.from({ length: columns }).map((__, columnIndex) => (
              <Skeleton
                key={columnIndex}
                className={cn('h-4', columnIndex === 0 ? 'w-1/3' : 'w-1/6')}
              />
            ))}
          </div>
        ))}
      </div>
    </Card>
  );
}

/** هيكل تحميل لشبكة بطاقات الإحصاءات */
export function StatsSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {Array.from({ length: count }).map((_, index) => (
        <Card key={index} className="p-5">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="mt-3 h-8 w-16" />
        </Card>
      ))}
    </div>
  );
}
