import type { Metadata } from 'next';
import { requireSuperAdmin } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { PageHeader } from '@/components/shared/page-header';
import { PlansClient, type PlanRowData } from './plans-client';

export const metadata: Metadata = { title: 'الخطط' };
export const dynamic = 'force-dynamic';

/** المزايا مخزَّنة jsonb — تُقرأ متحفَّظًا لأن الجدول قد يُحرَّر يدويًا */
function toFeatureList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

export default async function AdminPlansPage() {
  await requireSuperAdmin();
  const admin = createAdminClient();

  const [plansResult, subscriptionsResult] = await Promise.all([
    admin.from('plans').select('*').order('sort_order'),
    admin.from('subscriptions').select('plan_id'),
  ]);

  const counts = new Map<string, number>();
  for (const subscription of subscriptionsResult.data ?? []) {
    counts.set(subscription.plan_id, (counts.get(subscription.plan_id) ?? 0) + 1);
  }

  const plans: PlanRowData[] = (plansResult.data ?? []).map((plan) => ({
    id: plan.id,
    code: plan.code,
    name: plan.name,
    description: plan.description,
    priceAmount: plan.price_amount,
    currency: plan.currency,
    maxUsers: plan.max_users,
    maxDocuments: plan.max_documents,
    maxQuestionsMonthly: plan.max_questions_monthly,
    maxStorageMb: plan.max_storage_mb,
    features: toFeatureList(plan.features),
    isPublic: plan.is_public,
    isCustomPriced: plan.is_custom_priced,
    sortOrder: plan.sort_order,
    subscriberCount: counts.get(plan.id) ?? 0,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="الخطط"
        description="ما تحفظه هنا هو ما يراه الزائر على صفحة الأسعار مباشرةً، وهو ما تُقاس عليه حدود كل شركة مشتركة."
      />

      <PlansClient plans={plans} />

      <p className="text-xs leading-relaxed text-muted-foreground">
        الخطط لا تُحذف — تُخفى. الحذف يكسر اشتراكات قائمة تشير إليها، أما الإخفاء فيمنعها من
        صفحة الأسعار ويُبقي من اشترك بها على ما اتفق عليه. وتجاوزات الحدود لعميل بعينه تُضبط
        عبر الحقل <code className="font-mono">limit_overrides</code> في اشتراكه.
      </p>
    </div>
  );
}
