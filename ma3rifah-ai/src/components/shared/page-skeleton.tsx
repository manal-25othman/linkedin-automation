import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/misc';

/**
 * هياكل عظمية لصفحات اللوحة.
 *
 * تُبنى بمقاسات الصفحة الحقيقية لا بمستطيلات عامة: العين تقرأ البنية
 * قبل أن تصل البيانات، فتشعر بأن الصفحة **تُحمَّل** لا بأنها متجمّدة.
 * والهيكل الذي لا يشبه ما يليه يُنتج قفزةً بصرية عند وصول المحتوى —
 * وهي أسوأ من غياب الهيكل أصلًا.
 *
 * ولا دوّامة تدور: الدوّامة تقول «انتظر» ولا تقول «ماذا سيأتي». والفرق
 * في الإحساس بالمدة لا في المدة نفسها.
 */

export function HeaderSkeleton({ withAction = false }: { withAction?: boolean }) {
  return (
    <div className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-2.5">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      {withAction ? <Skeleton className="h-9 w-32 shrink-0" /> : null}
    </div>
  );
}

export function StatCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }, (_, index) => (
        <Card key={index} className="p-5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-3 h-8 w-16" />
        </Card>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b p-4">
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="divide-y">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="flex items-center gap-4 p-4">
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="hidden h-4 w-28 sm:block" />
            <Skeleton className="hidden h-4 w-20 md:block" />
            <Skeleton className="h-8 w-16 shrink-0" />
          </div>
        ))}
      </div>
    </Card>
  );
}

export function CardsSkeleton({ count = 3, columns = 3 }: { count?: number; columns?: number }) {
  return (
    <div
      className={
        columns === 2
          ? 'grid gap-4 md:grid-cols-2'
          : 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3'
      }
    >
      {Array.from({ length: count }, (_, index) => (
        <Card key={index} className="space-y-3 p-5">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </Card>
      ))}
    </div>
  );
}

/** الشكل الأشيع: ترويسة ثم جدول */
export function ListPageSkeleton({
  withAction = true,
  rows = 5,
}: {
  withAction?: boolean;
  rows?: number;
}) {
  return (
    <div className="space-y-6">
      <HeaderSkeleton withAction={withAction} />
      <TableSkeleton rows={rows} />
    </div>
  );
}
