import {
  CardsSkeleton, HeaderSkeleton,
} from '@/components/shared/page-skeleton';

/** هيكل انتظار «قاعدة المعرفة» — بمقاسات الصفحة نفسها */
export default function Loading() {
  return (
    <div className="space-y-6">
      <HeaderSkeleton withAction />
      <CardsSkeleton count={6} />
    </div>
  );
}
