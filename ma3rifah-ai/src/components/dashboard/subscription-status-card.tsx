import Link from 'next/link';
import { ArrowLeft, CalendarClock, CircleCheck, CircleSlash, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/misc';
import { formatDate } from '@/lib/utils';
import type { SubscriptionView } from '@/lib/billing/subscription-state';

/**
 * بطاقة حالة الاشتراك في صفحة الفوترة.
 *
 * تظهر **دائمًا** خلافًا للشريط في اللوحة: من فتح صفحة الفوترة جاء
 * ليعرف حالته، فإخفاؤها عند «كل شيء بخير» يترك السؤال بلا جواب.
 *
 * وشريط التقدّم للتجربة وحدها: التجربة مدةٌ تنقضي فيُفهم امتلاؤها،
 * والاشتراك دورةٌ تتجدّد فامتلاؤها لا يعني شيئًا.
 */

const TONE_BADGE = {
  neutral: 'success',
  info: 'default',
  warning: 'warning',
  danger: 'destructive',
} as const;

export function SubscriptionStatusCard({ view }: { view: SubscriptionView }) {
  const Icon =
    view.tone === 'danger' ? CircleSlash : view.isTrial ? Clock : CircleCheck;

  // نسبة ما انقضى من التجربة — تحسب على أربعة عشر يومًا
  const TRIAL_DAYS = 14;
  const elapsed =
    view.isTrial && view.daysLeft !== null
      ? Math.min(100, Math.max(0, Math.round(((TRIAL_DAYS - view.daysLeft) / TRIAL_DAYS) * 100)))
      : null;

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <Icon
              className={
                view.tone === 'danger'
                  ? 'mt-0.5 size-5 shrink-0 text-destructive'
                  : 'mt-0.5 size-5 shrink-0 text-primary'
              }
              aria-hidden
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold">حالة الاشتراك</h2>
                <Badge variant={TONE_BADGE[view.tone]}>{view.label}</Badge>
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {view.detail}
              </p>
            </div>
          </div>

          {view.cta ? (
            <Button
              size="sm"
              variant={view.tone === 'danger' ? 'default' : 'outline'}
              asChild
              className="shrink-0"
            >
              <Link href={view.cta.href}>
                {view.cta.label}
                <ArrowLeft className="size-4" aria-hidden />
              </Link>
            </Button>
          ) : null}
        </div>

        {elapsed !== null ? (
          <div className="space-y-1.5">
            <Progress value={elapsed} />
            <p className="text-xs text-muted-foreground">
              انقضى {elapsed}٪ من فترة التجربة.
            </p>
          </div>
        ) : null}

        {view.deadline ? (
          <p className="flex items-center gap-2 border-t pt-3 text-xs text-muted-foreground">
            <CalendarClock className="size-3.5" aria-hidden />
            {view.isTrial ? 'تنتهي التجربة في' : 'الموعد القادم'}: {formatDate(view.deadline)}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
