import {
  CardsSkeleton, HeaderSkeleton,
} from '@/components/shared/page-skeleton';

/** هيكل انتظار «الإعدادات» — بمقاسات الصفحة نفسها */
export default function Loading() {
  return (
    <div className="space-y-6">
      <HeaderSkeleton />
      <CardsSkeleton count={4} columns={2} />
    </div>
  );
}
