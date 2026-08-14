import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Building2,
  Download,
  LifeBuoy,
  CircleHelp,
  Coins,
  FileStack,
  MessageCircleQuestion,
  MousePointerClick,
  Percent,
  UserPlus,
  Users,
} from 'lucide-react';
import { requireSuperAdmin } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatNumber, formatPercent, formatRelativeTime, truncate } from '@/lib/utils';

export const metadata: Metadata = { title: 'إدارة المنصة' };
export const dynamic = 'force-dynamic';

export default async function AdminOverviewPage() {
  await requireSuperAdmin();

  // مدير المنصة يرى كل الشركات — نستخدم العميل الإداري بعد تحقق صريح أعلاه
  const admin = createAdminClient();

  const [
    companies,
    profiles,
    documents,
    messages,
    usage,
    contactRequests,
    visitorStats,
    visitorUnanswered,
  ] = await Promise.all([
    admin.from('companies').select('id, name, status, is_demo, created_at').order('created_at', {
      ascending: false,
    }),
    admin.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
    admin.from('documents').select('id', { count: 'exact', head: true }).neq('status', 'ARCHIVED'),
    admin.from('messages').select('id', { count: 'exact', head: true }).eq('role', 'USER'),
    admin
      .from('usage_records')
      .select('estimated_cost_usd')
      .eq('period_month', new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        .toISOString()
        .slice(0, 10)),
    admin
      .from('contact_requests')
      .select('id, full_name, company_name, email, status, created_at')
      .order('created_at', { ascending: false })
      .limit(8),
    admin.rpc('platform_visitor_stats', { p_days: 30 }),
    admin.rpc('platform_visitor_unanswered', { p_limit: 10 }),
  ]);

  const companyRows = companies.data ?? [];
  const visitors = visitorStats.data?.[0];
  const visitorGaps = visitorUnanswered.data ?? [];
  const visitorAnswerRate =
    visitors && visitors.questions_total > 0
      ? (visitors.answered_count / visitors.questions_total) * 100
      : null;
  const monthlyCost = (usage.data ?? []).reduce(
    (total, record) => total + Number(record.estimated_cost_usd ?? 0),
    0,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="نظرة عامة على المنصة"
        description="مؤشرات الاستخدام عبر جميع الشركات المشتركة."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" asChild>
              <Link href="/admin/support">
                <LifeBuoy className="size-4" aria-hidden />
                الدعم الفني
              </Link>
            </Button>
            {/* تنزيل مباشر لا صفحة وسيطة — الملف يُولَّد عند الطلب */}
            <Button asChild>
              <a href="/admin/export">
                <Download className="size-4" aria-hidden />
                تصدير Excel
              </a>
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="الشركات" value={companyRows.length} icon={Building2} />
        <StatCard label="المستخدمون النشطون" value={profiles.count ?? 0} icon={Users} />
        <StatCard label="المستندات" value={documents.count ?? 0} icon={FileStack} />
        <StatCard label="إجمالي الأسئلة" value={messages.count ?? 0} icon={MessageCircleQuestion} />
        <StatCard
          label="تكلفة AI هذا الشهر"
          value={`$${monthlyCost.toFixed(2)}`}
          icon={Coins}
          hint="تقديرية بأسعار القائمة"
        />
      </div>

      {/* زوّار الموقع — مسار منفصل تمامًا عن بيانات الشركات */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">زوّار الموقع (آخر 30 يومًا)</h2>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard
            label="زوّار استخدموا المحادثة"
            value={visitors?.visitors_in_period ?? 0}
            icon={MousePointerClick}
            hint={`${formatNumber(visitors?.visitors_total ?? 0)} منذ الإطلاق`}
          />
          <StatCard
            label="أسئلة الزوّار"
            value={visitors?.questions_total ?? 0}
            icon={MessageCircleQuestion}
          />
          <StatCard
            label="أسئلة بلا إجابة"
            value={visitors?.unanswered_count ?? 0}
            icon={CircleHelp}
            tone={(visitors?.unanswered_count ?? 0) > 0 ? 'warning' : 'default'}
            hint="ما لا يشرحه الموقع بوضوح"
          />
          <StatCard
            label="معدل الإجابة"
            value={visitorAnswerRate === null ? '—' : formatPercent(visitorAnswerRate)}
            icon={Percent}
            tone={visitorAnswerRate !== null && visitorAnswerRate < 70 ? 'warning' : 'success'}
          />
          <StatCard
            label="زوّار بدأوا التسجيل"
            value={visitors?.converted_count ?? 0}
            icon={UserPlus}
            tone="success"
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>أسئلة زوّار لم يجد المساعد لها إجابة</CardTitle>
          </CardHeader>
          <CardContent>
            {visitorGaps.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                لا توجد أسئلة بلا إجابة — أو لم تبدأ المحادثة بعد.
              </p>
            ) : (
              <>
                <p className="mb-3 text-sm text-muted-foreground">
                  كل سطر هنا سؤال يهمّ عميلًا محتملًا ولا يجيب عنه الموقع. أوضح دليل على ما
                  ينقص صفحات المنصة.
                </p>
                <ul className="divide-y">
                  {visitorGaps.map((gap, index) => (
                    <li key={`${gap.asked_at}-${index}`} className="py-3 first:pt-0 last:pb-0">
                      <p className="text-sm leading-relaxed">{truncate(gap.question, 160)}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatRelativeTime(gap.asked_at)}
                      </p>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </CardContent>
        </Card>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>أحدث الشركات</CardTitle>
          </CardHeader>
          <CardContent>
            {companyRows.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                لا توجد شركات مسجّلة بعد.
              </p>
            ) : (
              <ul className="divide-y">
                {companyRows.slice(0, 8).map((company) => (
                  <li
                    key={company.id}
                    className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{company.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatRelativeTime(company.created_at)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {company.is_demo ? <Badge variant="warning">تجريبية</Badge> : null}
                      <Badge variant={company.status === 'ACTIVE' ? 'success' : 'muted'}>
                        {company.status === 'ACTIVE' ? 'نشطة' : 'موقوفة'}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>طلبات التواصل</CardTitle>
          </CardHeader>
          <CardContent>
            {(contactRequests.data ?? []).length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                لا توجد طلبات تواصل جديدة.
              </p>
            ) : (
              <ul className="divide-y">
                {(contactRequests.data ?? []).map((request) => (
                  <li key={request.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-medium">{request.company_name}</p>
                      <Badge variant={request.status === 'NEW' ? 'default' : 'muted'}>
                        {request.status === 'NEW' ? 'جديد' : 'تمت المتابعة'}
                      </Badge>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground" dir="ltr">
                      {request.full_name} — {request.email}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatRelativeTime(request.created_at)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        عدد الأسئلة والتكلفة مؤشرات تشغيلية مجمّعة. محتوى المحادثات ومستندات الشركات لا
        يُعرض في هذه الشاشة.
      </p>
    </div>
  );
}
