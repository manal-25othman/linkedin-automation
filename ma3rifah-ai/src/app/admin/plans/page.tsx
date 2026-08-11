import type { Metadata } from 'next';
import { requireSuperAdmin } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { PageHeader } from '@/components/shared/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCurrency, formatNumber } from '@/lib/utils';

export const metadata: Metadata = { title: 'الخطط' };
export const dynamic = 'force-dynamic';

export default async function AdminPlansPage() {
  await requireSuperAdmin();
  const admin = createAdminClient();

  const [plansResult, subscriptionsResult] = await Promise.all([
    admin.from('plans').select('*').order('sort_order'),
    admin.from('subscriptions').select('plan_id'),
  ]);

  const plans = plansResult.data ?? [];
  const counts = new Map<string, number>();
  for (const subscription of subscriptionsResult.data ?? []) {
    counts.set(subscription.plan_id, (counts.get(subscription.plan_id) ?? 0) + 1);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="الخطط"
        description="الخطط المعروضة على صفحة الأسعار. الأسعار والحدود تُقرأ من قاعدة البيانات وليست ثابتة في الواجهة."
      />

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الخطة</TableHead>
              <TableHead>السعر</TableHead>
              <TableHead>المستخدمون</TableHead>
              <TableHead>المستندات</TableHead>
              <TableHead>الأسئلة/شهر</TableHead>
              <TableHead>المشتركون</TableHead>
              <TableHead>الحالة</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {plans.map((plan) => (
              <TableRow key={plan.id}>
                <TableCell>
                  <p className="font-medium">{plan.name}</p>
                  <p className="text-xs text-muted-foreground" dir="ltr">
                    {plan.code}
                  </p>
                </TableCell>
                <TableCell className="tabular-nums text-sm">
                  {plan.is_custom_priced
                    ? 'حسب الطلب'
                    : formatCurrency(plan.price_amount, plan.currency)}
                </TableCell>
                <TableCell className="tabular-nums text-sm">
                  {plan.max_users === null ? 'بلا حد' : formatNumber(plan.max_users)}
                </TableCell>
                <TableCell className="tabular-nums text-sm">
                  {plan.max_documents === null ? 'بلا حد' : formatNumber(plan.max_documents)}
                </TableCell>
                <TableCell className="tabular-nums text-sm">
                  {plan.max_questions_monthly === null
                    ? 'بلا حد'
                    : formatNumber(plan.max_questions_monthly)}
                </TableCell>
                <TableCell className="tabular-nums text-sm">
                  {formatNumber(counts.get(plan.id) ?? 0)}
                </TableCell>
                <TableCell>
                  <Badge variant={plan.is_public ? 'success' : 'muted'}>
                    {plan.is_public ? 'معروضة' : 'مخفية'}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <p className="text-xs leading-relaxed text-muted-foreground">
        لتعديل خطة أو إضافة أخرى، حدّث جدول <code className="font-mono">plans</code> في قاعدة
        البيانات. تجاوزات الحدود لعميل بعينه تُضبط عبر الحقل{' '}
        <code className="font-mono">limit_overrides</code> في اشتراكه.
      </p>
    </div>
  );
}
