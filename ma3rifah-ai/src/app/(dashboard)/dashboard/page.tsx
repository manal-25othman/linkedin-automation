import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Activity,
  ArrowLeft,
  CircleHelp,
  FileStack,
  MessageCircleQuestion,
  MessagesSquare,
  Sparkles,
  Target,
  Users,
} from 'lucide-react';
import { requireCompanySession } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { can } from '@/lib/auth/rbac';
import { PageHeader } from '@/components/shared/page-header';
import { OnboardingCard } from '@/components/dashboard/onboarding-card';
import { WelcomeDialog } from '@/components/dashboard/welcome-dialog';
import { quickStartFor } from '@/content/help';
import { computeOnboarding } from '@/lib/onboarding';
import { SubscriptionBanner } from '@/components/dashboard/subscription-banner';
import {
  describeSubscription,
  type SubscriptionStatus,
} from '@/lib/billing/subscription-state';
import { StatCard } from '@/components/shared/stat-card';
import { EmptyState } from '@/components/shared/states';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/misc';
import { AnswerRateChart } from '@/components/dashboard/charts';
import { auditActionLabel } from '@/lib/config/audit-labels';
import { formatNumber, formatPercent, formatRelativeTime, truncate } from '@/lib/utils';

export const metadata: Metadata = { title: 'الرئيسية' };
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const { profile, company } = await requireCompanySession();
  const supabase = await createClient();

  const [
    statsResult,
    topQuestionsResult,
    gapsResult,
    activityResult,
    timeseriesResult,
    usageResult,
    subscriptionResult,
  ] =
    await Promise.all([
      supabase.rpc('company_dashboard_stats'),
      supabase.rpc('company_top_questions', { p_limit: 6 }),
      can(profile.role, 'knowledge_gaps.view')
        ? supabase
            .from('knowledge_gaps')
            .select('id, question, times_asked, status, last_asked_at')
            .eq('status', 'OPEN')
            .order('times_asked', { ascending: false })
            .limit(5)
        : Promise.resolve({ data: [], error: null }),
      supabase.rpc('company_recent_activity', { p_limit: 8 }),
      supabase.rpc('company_questions_timeseries', { p_days: 14 }),
      can(profile.role, 'billing.view')
        ? supabase.rpc('company_usage_summary')
        : Promise.resolve({ data: [], error: null }),
      // حالة الاشتراك — RLS تقصرها على شركة المستخدم
      supabase
        .from('subscriptions')
        .select('status, current_period_end, trial_ends_at, canceled_at')
        .maybeSingle(),
    ]);

  const stats = statsResult.data?.[0];
  const topQuestions = topQuestionsResult.data ?? [];
  const gaps = gapsResult.data ?? [];
  const activity = activityResult.data ?? [];
  const timeseries = timeseriesResult.data ?? [];
  const usage = usageResult.data?.[0];

  const questionsCount = stats?.questions_count ?? 0;
  const answeredCount = stats?.answered_count ?? 0;
  const unansweredCount = stats?.unanswered_count ?? 0;
  const totalAnswers = answeredCount + unansweredCount;
  const answerRate = totalAnswers > 0 ? (answeredCount / totalAnswers) * 100 : null;

  // حالة الاشتراك — الشريط لا يظهر إلا حين يستحق
  const subscriptionRow = subscriptionResult.data;
  const subscription = describeSubscription(
    subscriptionRow
      ? {
          status: subscriptionRow.status as SubscriptionStatus,
          currentPeriodEnd: subscriptionRow.current_period_end,
          trialEndsAt: subscriptionRow.trial_ends_at,
          canceledAt: subscriptionRow.canceled_at,
        }
      : null,
  );

  // رحلة التجهيز — تُحسب من البيانات لا من علامة محفوظة
  const onboarding = computeOnboarding(
    {
      usersCount: stats?.users_count ?? 0,
      documentsCount: stats?.documents_count ?? 0,
      documentsReady: stats?.documents_ready ?? 0,
      questionsCount,
    },
    { canManage: can(profile.role, 'documents.manage') },
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={`مرحبًا، ${profile.full_name || 'بك'}`}
        description={`نظرة عامة على استخدام قاعدة معرفة ${company.name}.`}
        actions={
          <Button asChild>
            <Link href="/assistant">
              <Sparkles className="size-4" aria-hidden />
              اسأل المساعد
            </Link>
          </Button>
        }
      />

      {/* حالة الاشتراك قبل كل شيء: من انتهت تجربته لا يعنيه تقدّم تجهيزه */}
      {can(profile.role, 'billing.view') ? (
        <SubscriptionBanner view={subscription} />
      ) : null}

      {/* رحلة التجهيز — تحلّ محلّ بطاقة «ارفع أول مستند» وتشمل ما بعدها */}
      {/*
        نافذة الترحيب تظهر مرّة، ومع التجهيز الناقص وحده: من أتمّ خطواته
        لا يحتاج ترحيبًا ويحتاج شاشته.
      */}
      {onboarding.complete ? null : <WelcomeDialog steps={quickStartFor(profile.role)} />}

      <OnboardingCard progress={onboarding} />

      {/* بطاقات الإحصاءات */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="المستخدمون" value={stats?.users_count ?? 0} icon={Users} />
        <StatCard
          label="المستندات"
          value={stats?.documents_count ?? 0}
          icon={FileStack}
          hint={
            (stats?.documents_processing ?? 0) > 0
              ? `${formatNumber(stats?.documents_processing)} قيد المعالجة`
              : `${formatNumber(stats?.documents_ready)} جاهز للسؤال`
          }
        />
        <StatCard
          label="المحادثات"
          value={stats?.conversations_count ?? 0}
          icon={MessagesSquare}
        />
        <StatCard
          label="أسئلة مُجابة"
          value={answeredCount}
          icon={MessageCircleQuestion}
          tone="success"
          hint={answerRate !== null ? `معدل الإجابة ${formatPercent(answerRate)}` : undefined}
        />
        <StatCard
          label="أسئلة بلا إجابة"
          value={unansweredCount}
          icon={CircleHelp}
          tone={unansweredCount > 0 ? 'warning' : 'default'}
          hint={unansweredCount > 0 ? 'فرص لتحسين التوثيق' : 'لا فجوات حاليًا'}
        />
      </div>

      {/* الرسم البياني + الاستهلاك */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>الأسئلة خلال آخر 14 يومًا</CardTitle>
          </CardHeader>
          <CardContent>
            {timeseries.some((point) => point.total > 0) ? (
              <AnswerRateChart data={timeseries} />
            ) : (
              <EmptyState
                icon={Activity}
                title="لا توجد أسئلة بعد"
                description="سيظهر هنا نشاط فريقك بمجرد أن يبدأ استخدام المساعد."
                className="border-0 bg-transparent py-10"
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{usage ? `خطة ${usage.plan_name}` : 'الاستهلاك'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {usage ? (
              <>
                <UsageBar
                  label="الأسئلة هذا الشهر"
                  used={usage.questions_used}
                  limit={usage.questions_limit}
                />
                <UsageBar label="المستندات" used={usage.documents_used} limit={usage.documents_limit} />
                <UsageBar label="المستخدمون" used={usage.users_used} limit={usage.users_limit} />
              </>
            ) : (
              <p className="text-sm leading-relaxed text-muted-foreground">
                تفاصيل الاشتراك متاحة لمدير الشركة.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* الأسئلة الأكثر تداولًا + فجوات المعرفة */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>أكثر الأسئلة تداولًا</CardTitle>
          </CardHeader>
          <CardContent>
            {topQuestions.length === 0 ? (
              <EmptyState
                icon={MessageCircleQuestion}
                title="لا توجد أسئلة بعد"
                description="ستظهر هنا الأسئلة الأكثر تكرارًا في شركتك."
                className="border-0 bg-transparent py-8"
              />
            ) : (
              <ul className="divide-y">
                {topQuestions.map((item, index) => (
                  <li key={`${item.question}-${index}`} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                    <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-medium text-muted-foreground">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-relaxed">{truncate(item.question, 120)}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>سُئل {formatNumber(item.times_asked)} مرة</span>
                        {item.unanswered > 0 ? (
                          <Badge variant="warning">
                            {formatNumber(item.unanswered)} بلا إجابة
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {can(profile.role, 'knowledge_gaps.view') ? (
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>فجوات المعرفة</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/knowledge-gaps">
                  الكل
                  <ArrowLeft className="size-4" aria-hidden />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {gaps.length === 0 ? (
                <EmptyState
                  icon={Target}
                  title="لا توجد فجوات مفتوحة"
                  description="كل الأسئلة وجدت إجابة في قاعدة المعرفة."
                  className="border-0 bg-transparent py-8"
                />
              ) : (
                <ul className="divide-y">
                  {gaps.map((gap) => (
                    <li key={gap.id} className="py-3 first:pt-0 last:pb-0">
                      <p className="text-sm leading-relaxed">{truncate(gap.question, 120)}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="warning">سُئل {formatNumber(gap.times_asked)} مرة</Badge>
                        <span>آخر مرة {formatRelativeTime(gap.last_asked_at)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        ) : null}
      </div>

      {/* آخر النشاطات */}
      {can(profile.role, 'analytics.view_department') ? (
        <Card>
          <CardHeader>
            <CardTitle>آخر النشاطات</CardTitle>
          </CardHeader>
          <CardContent>
            {activity.length === 0 ? (
              <EmptyState
                icon={Activity}
                title="لا يوجد نشاط مسجّل"
                description="ستظهر هنا العمليات الإدارية: رفع المستندات، تغيير الصلاحيات، وإدارة المستخدمين."
                className="border-0 bg-transparent py-8"
              />
            ) : (
              <ul className="divide-y">
                {activity.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{auditActionLabel(item.action)}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {item.actor_name}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatRelativeTime(item.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function UsageBar({
  label,
  used,
  limit,
}: {
  label: string;
  used: number;
  limit: number | null;
}) {
  const percentage = limit && limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  const isNearLimit = percentage >= 80;

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-2 text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">
          {formatNumber(used)}
          {limit ? <span className="text-muted-foreground"> / {formatNumber(limit)}</span> : null}
        </span>
      </div>
      {limit ? (
        <Progress
          value={percentage}
          className={isNearLimit ? '[&>div]:bg-[hsl(var(--warning))]' : undefined}
        />
      ) : (
        <p className="text-xs text-muted-foreground">بلا حد</p>
      )}
    </div>
  );
}
