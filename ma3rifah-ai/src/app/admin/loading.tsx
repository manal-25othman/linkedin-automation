import {
  CardsSkeleton, HeaderSkeleton, StatCardsSkeleton,
} from '@/components/shared/page-skeleton';

/** هيكل انتظار «نظرة عامة» — بمقاسات الصفحة نفسها */
export default function Loading() {
  return (
    <div className="space-y-6">
      <HeaderSkeleton />
      <StatCardsSkeleton />
      <CardsSkeleton count={2} columns={2} />
    </div>
  );
}
