'use client';

import { useEffect, useState, useTransition } from 'react';
import { useSearchParams } from 'next/navigation';
import { AlertCircle, Check, CheckCircle2, Clock, CreditCard } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/misc';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCurrency, formatDate, formatNumber, cn } from '@/lib/utils';
import { startCheckoutAction } from './actions';

export interface BillingPlanOption {
  id: string;
  code: string;
  name: string;
  description: string | null;
  priceAmount: number | null;
  currency: string;
  isCustomPriced: boolean;
  isCurrent: boolean;
  features: string[];
}

interface UsageSummary {
  planName: string | null;
  status: string | null;
  periodEnd: string | null;
  usersUsed: number;
  usersLimit: number | null;
  documentsUsed: number;
  documentsLimit: number | null;
  questionsUsed: number;
  questionsLimit: number | null;
}

interface PaymentRow {
  id: string;
  amountHalalas: number;
  currency: string;
  status: string;
  paidAt: string | null;
  createdAt: string;
}

/** رسائل العودة من صفحة الدفع — يقرؤها المسار من مَعلمة `payment` */
const PAYMENT_STATES: Record<string, { tone: 'success' | 'warning' | 'error'; text: string }> = {
  success: { tone: 'success', text: 'تم استلام الدفعة وتفعيل اشتراكك.' },
  failed: { tone: 'error', text: 'لم تكتمل عملية الدفع. لم يُخصم أي مبلغ.' },
  pending: {
    tone: 'warning',
    text: 'لم نتمكّن من تأكيد الدفعة الآن. إن خُصم المبلغ فسيُفعَّل الاشتراك تلقائيًا خلال دقائق.',
  },
  mismatch: {
    tone: 'error',
    text: 'المبلغ المدفوع لا يطابق سعر الخطة. تواصل مع الدعم ولا تُعد المحاولة.',
  },
  missing: { tone: 'error', text: 'رابط العودة غير مكتمل. راجع سجلّ المدفوعات أدناه.' },
};

const PAYMENT_STATUS_META: Record<string, { label: string; variant: 'success' | 'muted' | 'warning' }> =
  {
    PAID: { label: 'مدفوعة', variant: 'success' },
    INITIATED: { label: 'قيد الإتمام', variant: 'warning' },
    FAILED: { label: 'فاشلة', variant: 'muted' },
    REFUNDED: { label: 'مُستردّة', variant: 'muted' },
  };

/** شريط استهلاك — «بلا حد» لا يُرسم شريطًا لأنه لا نسبة له */
function UsageBar({ label, used, limit }: { label: string; used: number; limit: number | null }) {
  const unlimited = limit === null || limit < 0;
  const percent = unlimited ? 0 : Math.min(100, Math.round((used / Math.max(limit, 1)) * 100));

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="text-sm font-medium tabular-nums">
          {formatNumber(used)}
          {unlimited ? (
            <span className="text-muted-foreground"> / بلا حد</span>
          ) : (
            <span className="text-muted-foreground"> / {formatNumber(limit)}</span>
          )}
        </span>
      </div>
      {unlimited ? null : (
        <Progress value={percent} className={cn(percent >= 90 && '[&>div]:bg-destructive')} />
      )}
    </div>
  );
}

export function BillingClient({
  usage,
  plans,
  payments,
  paymentsEnabled,
}: {
  usage: UsageSummary | null;
  plans: BillingPlanOption[];
  payments: PaymentRow[];
  paymentsEnabled: boolean;
}) {
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [notice, setNotice] = useState<(typeof PAYMENT_STATES)[string] | null>(null);

  useEffect(() => {
    const state = searchParams.get('payment');
    if (state && PAYMENT_STATES[state]) setNotice(PAYMENT_STATES[state]);
  }, [searchParams]);

  function subscribe(planId: string) {
    startTransition(async () => {
      const result = await startCheckoutAction(planId);
      if (!result.ok || !result.checkout) {
        toast.error(result.message ?? 'تعذّر بدء عملية الدفع.');
        return;
      }

      // نموذج Moyasar المستضاف: يُبنى ويُرسل من المتصفح بالمفتاح
      // المنشور وحده. المفتاح السري لا يغادر الخادم إطلاقًا.
      const { amountHalalas, currency, description, callbackUrl, publishableKey } =
        result.checkout;

      const form = document.createElement('form');
      form.method = 'POST';
      form.action = 'https://api.moyasar.com/v1/payments.html';

      const fields: Record<string, string> = {
        'publishable_api_key': publishableKey,
        amount: String(amountHalalas),
        currency,
        description,
        callback_url: callbackUrl,
      };

      for (const [name, value] of Object.entries(fields)) {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        input.value = value;
        form.appendChild(input);
      }

      document.body.appendChild(form);
      form.submit();
    });
  }

  return (
    <div className="space-y-6">
      {notice ? (
        <div
          role="status"
          className={cn(
            'flex items-start gap-2.5 rounded-lg border p-3.5 text-sm',
            notice.tone === 'success' &&
              'border-[hsl(var(--success))]/40 bg-[hsl(var(--success))]/10',
            notice.tone === 'warning' &&
              'border-[hsl(var(--warning))]/40 bg-[hsl(var(--warning))]/10',
            notice.tone === 'error' && 'border-destructive/30 bg-destructive/5 text-destructive',
          )}
        >
          {notice.tone === 'success' ? (
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
          ) : notice.tone === 'warning' ? (
            <Clock className="mt-0.5 size-4 shrink-0" aria-hidden />
          ) : (
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          )}
          <p className="leading-relaxed">{notice.text}</p>
        </div>
      ) : null}

      {usage ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-3">
              <span>الخطة الحالية: {usage.planName ?? '—'}</span>
              {usage.periodEnd ? (
                <span className="text-sm font-normal text-muted-foreground">
                  تتجدّد في {formatDate(usage.periodEnd)}
                </span>
              ) : null}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <UsageBar label="المستخدمون" used={usage.usersUsed} limit={usage.usersLimit} />
            <UsageBar label="المستندات" used={usage.documentsUsed} limit={usage.documentsLimit} />
            <UsageBar
              label="أسئلة هذا الشهر"
              used={usage.questionsUsed}
              limit={usage.questionsLimit}
            />
          </CardContent>
        </Card>
      ) : null}

      {!paymentsEnabled ? (
        <div className="rounded-lg border border-[hsl(var(--warning))]/40 bg-[hsl(var(--warning))]/10 p-4 text-sm leading-relaxed">
          بوابة الدفع غير مفعّلة بعد على هذه النسخة. لإتمام الاشتراك أو ترقيته، تواصل معنا عبر
          صفحة الدعم الفني.
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        {plans.map((plan) => (
          <Card
            key={plan.id}
            className={cn('flex flex-col p-6', plan.isCurrent && 'border-primary ring-1 ring-primary/20')}
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-lg font-semibold">{plan.name}</h3>
              {plan.isCurrent ? <Badge>خطتك الحالية</Badge> : null}
            </div>

            <p className="mt-2 text-2xl font-semibold tabular-nums">
              {plan.isCustomPriced
                ? 'حسب الطلب'
                : formatCurrency(plan.priceAmount, plan.currency)}
              {!plan.isCustomPriced ? (
                <span className="text-sm font-normal text-muted-foreground"> / شهريًا</span>
              ) : null}
            </p>

            {plan.description ? (
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {plan.description}
              </p>
            ) : null}

            {plan.features.length > 0 ? (
              <ul className="mt-4 flex-1 space-y-2">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                    <span className="leading-relaxed">{feature}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex-1" />
            )}

            <Button
              className="mt-6 w-full"
              variant={plan.isCurrent ? 'outline' : 'default'}
              disabled={!paymentsEnabled || plan.isCustomPriced || isPending}
              loading={isPending}
              onClick={() => subscribe(plan.id)}
            >
              <CreditCard className="size-4" aria-hidden />
              {plan.isCustomPriced
                ? 'تواصل معنا'
                : plan.isCurrent
                  ? 'تجديد الاشتراك'
                  : 'الاشتراك في هذه الخطة'}
            </Button>
          </Card>
        ))}
      </div>

      {payments.length > 0 ? (
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>سجلّ المدفوعات</CardTitle>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>التاريخ</TableHead>
                <TableHead>المبلغ</TableHead>
                <TableHead>الحالة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((payment) => {
                const meta = PAYMENT_STATUS_META[payment.status] ?? {
                  label: payment.status,
                  variant: 'muted' as const,
                };
                return (
                  <TableRow key={payment.id}>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {formatDate(payment.paidAt ?? payment.createdAt)}
                    </TableCell>
                    <TableCell className="tabular-nums text-sm">
                      {formatCurrency(payment.amountHalalas / 100, payment.currency)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={meta.variant}>{meta.label}</Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      ) : null}
    </div>
  );
}
