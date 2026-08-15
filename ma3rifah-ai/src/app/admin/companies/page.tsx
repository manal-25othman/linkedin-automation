import Link from 'next/link';
import type { Metadata } from 'next';
import { requireSuperAdmin } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/states';
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
import { ActionButton } from '@/components/dashboard/crud-dialog';
import { setCompanyStatusAction } from '../actions';
import { formatDate, formatNumber } from '@/lib/utils';
import { Building2 } from 'lucide-react';

export const metadata: Metadata = { title: 'الشركات' };
export const dynamic = 'force-dynamic';

export default async function AdminCompaniesPage() {
  await requireSuperAdmin();
  const admin = createAdminClient();

  const [companiesResult, profilesResult, documentsResult, subscriptionsResult, plansResult] =
    await Promise.all([
      admin
        .from('companies')
        .select('id, name, slug, status, is_demo, industry, created_at')
        .order('created_at', { ascending: false }),
      admin.from('profiles').select('company_id').eq('status', 'ACTIVE'),
      admin.from('documents').select('company_id').neq('status', 'ARCHIVED'),
      admin.from('subscriptions').select('company_id, plan_id, status'),
      admin.from('plans').select('id, name'),
    ]);

  const userCounts = new Map<string, number>();
  for (const profile of profilesResult.data ?? []) {
    if (!profile.company_id) continue;
    userCounts.set(profile.company_id, (userCounts.get(profile.company_id) ?? 0) + 1);
  }

  const documentCounts = new Map<string, number>();
  for (const document of documentsResult.data ?? []) {
    documentCounts.set(document.company_id, (documentCounts.get(document.company_id) ?? 0) + 1);
  }

  const planNames = new Map((plansResult.data ?? []).map((plan) => [plan.id, plan.name]));
  const subscriptions = new Map(
    (subscriptionsResult.data ?? []).map((subscription) => [
      subscription.company_id,
      { plan: planNames.get(subscription.plan_id) ?? '—', status: subscription.status },
    ]),
  );

  const companies = companiesResult.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="الشركات"
        description="جميع الشركات المسجّلة على المنصة وحالة اشتراك كل منها."
      />

      {companies.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="لا توجد شركات"
          description="ستظهر هنا الشركات فور تسجيلها على المنصة."
        />
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الشركة</TableHead>
                <TableHead>الخطة</TableHead>
                <TableHead>المستخدمون</TableHead>
                <TableHead>المستندات</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>تاريخ التسجيل</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {companies.map((company) => {
                const subscription = subscriptions.get(company.id);
                const isActive = company.status === 'ACTIVE';

                return (
                  <TableRow key={company.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/admin/companies/${company.id}`}
                          className="font-medium hover:text-primary hover:underline"
                        >
                          {company.name}
                        </Link>
                        {company.is_demo ? <Badge variant="warning">تجريبية</Badge> : null}
                      </div>
                      <p className="text-xs text-muted-foreground" dir="ltr">
                        {company.slug}
                      </p>
                    </TableCell>

                    <TableCell className="text-sm">
                      {subscription ? subscription.plan : '—'}
                    </TableCell>

                    <TableCell className="tabular-nums text-sm">
                      {formatNumber(userCounts.get(company.id) ?? 0)}
                    </TableCell>

                    <TableCell className="tabular-nums text-sm">
                      {formatNumber(documentCounts.get(company.id) ?? 0)}
                    </TableCell>

                    <TableCell>
                      <Badge variant={isActive ? 'success' : 'muted'}>
                        {isActive ? 'نشطة' : 'موقوفة'}
                      </Badge>
                    </TableCell>

                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {formatDate(company.created_at)}
                    </TableCell>

                    <TableCell>
                      <ActionButton
                        variant="outline"
                        size="sm"
                        action={() =>
                          setCompanyStatusAction(company.id, isActive ? 'SUSPENDED' : 'ACTIVE')
                        }
                        confirmMessage={
                          isActive
                            ? `سيتوقف مستخدمو «${company.name}» عن الوصول إلى المنصة.\n\nهل تريد المتابعة؟`
                            : undefined
                        }
                      >
                        {isActive ? 'إيقاف' : 'تفعيل'}
                      </ActionButton>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
