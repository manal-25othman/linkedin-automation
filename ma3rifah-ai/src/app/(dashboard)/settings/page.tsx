import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CompanyForm, AiSettingsForm } from './settings-forms';
import { auditActionLabel } from '@/lib/config/audit-labels';
import { formatDate, formatNumber, formatRelativeTime } from '@/lib/utils';
import type { CompanyAiSettings } from '@/types/database';

export const metadata: Metadata = { title: 'الإعدادات' };
export const dynamic = 'force-dynamic';

const SUBSCRIPTION_LABELS: Record<string, string> = {
  TRIALING: 'فترة تجريبية',
  ACTIVE: 'نشط',
  PAST_DUE: 'متأخر السداد',
  CANCELED: 'ملغى',
  EXPIRED: 'منتهٍ',
};

export default async function SettingsPage() {
  const { company } = await requirePermission('company.view_settings');
  const supabase = await createClient();

  const [usageResult, auditResult] = await Promise.all([
    supabase.rpc('company_usage_summary'),
    supabase
      .from('audit_logs')
      .select('id, action, actor_email, created_at')
      .order('created_at', { ascending: false })
      .limit(15),
  ]);

  const usage = usageResult.data?.[0];
  const auditEntries = auditResult.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="الإعدادات"
        description="بيانات الشركة، ضبط سلوك المساعد الذكي، وحالة الاشتراك."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>بيانات الشركة</CardTitle>
            <CardDescription>تظهر في الشريط الجانبي وفي موجّه المساعد.</CardDescription>
          </CardHeader>
          <CardContent>
            <CompanyForm name={company.name} industry={company.industry} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>الاشتراك</CardTitle>
            <CardDescription>خطتك الحالية واستهلاكها.</CardDescription>
          </CardHeader>
          <CardContent>
            {usage ? (
              <dl className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">الخطة</dt>
                  <dd className="flex items-center gap-2 font-medium">
                    {usage.plan_name}
                    <Badge
                      variant={usage.subscription_status === 'ACTIVE' ? 'success' : 'secondary'}
                    >
                      {SUBSCRIPTION_LABELS[usage.subscription_status] ??
                        usage.subscription_status}
                    </Badge>
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">تجديد/انتهاء الفترة</dt>
                  <dd className="font-medium">{formatDate(usage.period_end)}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">الأسئلة هذا الشهر</dt>
                  <dd className="font-medium tabular-nums">
                    {formatNumber(usage.questions_used)}
                    {usage.questions_limit ? ` / ${formatNumber(usage.questions_limit)}` : ''}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">المستندات</dt>
                  <dd className="font-medium tabular-nums">
                    {formatNumber(usage.documents_used)}
                    {usage.documents_limit ? ` / ${formatNumber(usage.documents_limit)}` : ''}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">المستخدمون</dt>
                  <dd className="font-medium tabular-nums">
                    {formatNumber(usage.users_used)}
                    {usage.users_limit ? ` / ${formatNumber(usage.users_limit)}` : ''}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="text-sm leading-relaxed text-muted-foreground">
                لا يوجد اشتراك مرتبط بهذه الشركة. تواصل مع فريق المبيعات لتفعيل خطة.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>إعدادات المساعد الذكي</CardTitle>
          <CardDescription>
            ضبط دقة الاسترجاع وحجم السياق. هذه الإعدادات تؤثر مباشرة على جودة الإجابات
            وعلى تكلفة الاستخدام.
          </CardDescription>
        </CardHeader>
        <CardContent className="max-w-2xl">
          <AiSettingsForm settings={company.ai_settings as CompanyAiSettings} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>سجل التدقيق</CardTitle>
          <CardDescription>آخر العمليات الحساسة على حساب شركتك.</CardDescription>
        </CardHeader>
        <CardContent>
          {auditEntries.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              لا توجد عمليات مسجّلة بعد.
            </p>
          ) : (
            <ul className="divide-y">
              {auditEntries.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{auditActionLabel(entry.action)}</p>
                    <p className="truncate text-xs text-muted-foreground" dir="ltr">
                      {entry.actor_email ?? '—'}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatRelativeTime(entry.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
