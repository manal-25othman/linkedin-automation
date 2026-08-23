import Link from 'next/link';
import { AlertCircle, ArrowLeft, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { SubscriptionView } from '@/lib/billing/subscription-state';

/**
 * شريط حالة الاشتراك.
 *
 * لا يظهر إلا حين يستحق الظهور (`showBanner`) — والشريط الدائم يُتجاهَل
 * بعد يومين، فيصير وجودُه ضررًا حين يُحتاج فعلًا.
 *
 * ويُبنى بألوان اللوحة ورموزها، ويوضع فوق محتوى الصفحة لا فوق الترويسة:
 * ما يعلو الترويسة يُقرأ إعلانًا، وما يجاور المحتوى يُقرأ حالةً.
 */
export function SubscriptionBanner({ view }: { view: SubscriptionView }) {
  if (!view.showBanner) return null;

  const danger = view.tone === 'danger';

  return (
    <div
      role="status"
      className={cn(
        'flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between',
        danger
          ? 'border-destructive/30 bg-destructive/5'
          : 'border-[hsl(var(--warning))]/40 bg-[hsl(var(--warning))]/10',
      )}
    >
      <div className="flex items-start gap-2.5">
        {danger ? (
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
        ) : (
          <Clock className="mt-0.5 size-4 shrink-0 text-[hsl(var(--warning))]" aria-hidden />
        )}
        <div className="min-w-0">
          <p className={cn('text-sm font-medium', danger && 'text-destructive')}>
            {view.label}
          </p>
          <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
            {view.detail}
          </p>
        </div>
      </div>

      {view.cta ? (
        <Button
          size="sm"
          variant={danger ? 'default' : 'outline'}
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
  );
}
