import {
  HeaderSkeleton, TableSkeleton,
} from '@/components/shared/page-skeleton';

/** هيكل انتظار «الأقسام» — بمقاسات الصفحة نفسها */
export default function Loading() {
  return (
    <div className="space-y-6">
      <HeaderSkeleton withAction />
      <TableSkeleton />
    </div>
  );
}
