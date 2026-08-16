import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/shared/page-header';
import { BillingClient, type BillingPlanOption } from './billing-client';
import { serverEnv } from '@/lib/env';

export const metadata: Metadata = { title: 'الاشتراك والفواتير' };
export const dynamic = 'force-dynamic';

export default async function BillingPage() {
  const { company } = await requirePermission('billing.view');
  const supabase = await createClient();

  const [usageResult, plansResult, paymentsResult, subscriptionResult] = await Promise.all([
    supabase.rpc('company_usage_summary'),
    supabase.from('plans').select('*').eq('is_public', true).order('sort_order'),
    supabase
      .from('payments')
      .select('id, amount_halalas, currency, status, paid_at, created_at')
      .order('created_at', { ascending: false })
      .limit(12),
    supabase.from('subscriptions').select('plan_id, status, current_period_end').maybeSingle(),
  ]);

  const usage = usageResult.data?.[0] ?? null;
  const currentPlanId = subscriptionResult.data?.plan_id ?? null;

  const plans: BillingPlanOption[] = (plansResult.data ?? []).map((plan) => ({
    id: plan.id,
    code: plan.code,
    name: plan.name,
    description: plan.description,
    priceAmount: plan.price_amount,
    currency: plan.currency,
    isCustomPriced: plan.is_custom_priced,
    isCurrent: plan.id === currentPlanId,
    features: Array.isArray(plan.features)
      ? plan.features.filter((item): item is string => typeof item === 'string')
      : [],
  }));

  const payments = (paymentsResult.data ?? []).map((payment) => ({
    id: payment.id,
    amountHalalas: payment.amount_halalas,
    currency: payment.currency,
    status: payment.status,
    paidAt: payment.paid_at,
    createdAt: payment.created_at,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="الاشتراك والفواتير"
        description={`خطة ${company.name} الحالية واستهلاكها، وسجلّ المدفوعات.`}
      />

      <BillingClient
        usage={
          usage
            ? {
                planName: usage.plan_name,
                status: usage.subscription_status,
                periodEnd: usage.period_end,
                usersUsed: Number(usage.users_used ?? 0),
                usersLimit: usage.users_limit,
                documentsUsed: Number(usage.documents_used ?? 0),
                documentsLimit: usage.documents_limit,
                questionsUsed: usage.questions_used ?? 0,
                questionsLimit: usage.questions_limit,
              }
            : null
        }
        plans={plans}
        payments={payments}
        paymentsEnabled={serverEnv.isPaymentsConfigured}
      />
    </div>
  );
}
