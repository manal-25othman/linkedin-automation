import Link from 'next/link';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FALLBACK_PLANS, formatLimit } from '@/lib/config/plans';
import { formatCurrency, cn } from '@/lib/utils';
import { logger } from '@/lib/logger';
import { hasPublicSupabaseConfig } from '@/lib/supabase/public-env';
import type { Plan } from '@/types/database';

/**
 * الأسعار تُقرأ من قاعدة البيانات — ليست ثابتة في الواجهة.
 * إن تعذّر الوصول (وقت البناء مثلًا) نعرض النسخة الاحتياطية.
 */
async function loadPlans(): Promise<Plan[]> {
  if (!hasPublicSupabaseConfig) {
    return FALLBACK_PLANS;
  }

  try {
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('plans')
      .select('*')
      .eq('is_public', true)
      .order('sort_order', { ascending: true });

    if (error || !data || data.length === 0) return FALLBACK_PLANS;
    return data;
  } catch (error) {
    logger.warn('تعذّر تحميل الخطط من قاعدة البيانات — استخدام النسخة الاحتياطية', {
      reason: error instanceof Error ? error.message : String(error),
    });
    return FALLBACK_PLANS;
  }
}

export async function PricingTable() {
  const plans = await loadPlans();
  // الخطة الوسطى هي المُوصى بها عادةً
  const recommendedCode = plans.length >= 2 ? plans[1].code : plans[0]?.code;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {plans.map((plan) => {
        const isRecommended = plan.code === recommendedCode;

        return (
          <div
            key={plan.id}
            className={cn(
              'relative flex flex-col rounded-xl border bg-card p-7',
              isRecommended && 'border-primary shadow-md ring-1 ring-primary/20',
            )}
          >
            {isRecommended ? (
              <Badge className="absolute -top-3 start-7">الأكثر اختيارًا</Badge>
            ) : null}

            <h3 className="text-lg font-semibold">{plan.name}</h3>
            {plan.description ? (
              <p className="mt-2 min-h-[2.75rem] text-sm leading-relaxed text-muted-foreground">
                {plan.description}
              </p>
            ) : null}

            <div className="mt-6 flex items-baseline gap-2">
              <span className="text-3xl font-semibold tracking-tight">
                {plan.is_custom_priced
                  ? 'تسعير مخصص'
                  : formatCurrency(plan.price_amount, plan.currency)}
              </span>
              {!plan.is_custom_priced ? (
                <span className="text-sm text-muted-foreground">/ شهريًا</span>
              ) : null}
            </div>

            <dl className="mt-6 space-y-2 border-y py-5 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">المستخدمون</dt>
                <dd className="font-medium">{formatLimit(plan.max_users, 'مستخدم')}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">المستندات</dt>
                <dd className="font-medium">{formatLimit(plan.max_documents, 'مستند')}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">الأسئلة شهريًا</dt>
                <dd className="font-medium">
                  {formatLimit(plan.max_questions_monthly, 'سؤال')}
                </dd>
              </div>
            </dl>

            <ul className="mt-6 flex-1 space-y-3">
              {(plan.features ?? []).map((feature) => (
                <li key={feature} className="flex items-start gap-2.5">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                  <span className="text-sm leading-relaxed text-muted-foreground">
                    {feature}
                  </span>
                </li>
              ))}
            </ul>

            <Button
              className="mt-8"
              variant={isRecommended ? 'default' : 'outline'}
              asChild
            >
              <Link href={plan.is_custom_priced ? '/contact' : '/register'}>
                {plan.is_custom_priced ? 'تواصل مع المبيعات' : 'ابدأ التجربة'}
              </Link>
            </Button>
          </div>
        );
      })}
    </div>
  );
}
