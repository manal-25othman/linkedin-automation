import type { Metadata } from 'next';
import {
  BarChart3,
  CircleHelp,
  FileStack,
  MessageCircleQuestion,
  MessagesSquare,
  Percent,
  ThumbsUp,
  Timer,
  Users,
  Wallet,
} from 'lucide-react';
import { requirePermission } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { EmptyState } from '@/components/shared/states';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AnswerRateChart,
  CostChart,
  DepartmentUsageChart,
  HourlyActivityChart,
} from '@/components/dashboard/charts';
import { formatNumber, formatPercent, truncate } from '@/lib/utils';

export const metadata: Metadata = { title: 'التحليلات' };
export const dynamic = 'force-dynamic';

export default async function AnalyticsPage() {
  await requirePermission('analytics.view_department');
  const supabase = await createClient();

  const [
    statsResult,
    timeseriesResult,
    topQuestionsResult,
    topDocumentsResult,
    departmentsResult,
    qualityResult,
    activeUsersResult,
    hourlyResult,
    costResult,
    usageResult,
  ] = await Promise.all([
    supabase.rpc('company_dashboard_stats'),
    supabase.rpc('company_questions_timeseries', { p_days: 30 }),
    supabase.rpc('company_top_questions', { p_limit: 10 }),
    supabase.rpc('company_top_documents', { p_limit: 8 }),
    supabase.rpc('company_department_usage'),
    supabase.rpc('company_answer_quality', { p_days: 30 }),
    supabase.rpc('company_active_users', { p_days: 30 }),
    supabase.rpc('company_hourly_activity', { p_days: 30 }),
    supabase.rpc('company_cost_summary', { p_months: 6 }),
    supabase.rpc('company_usage_summary'),
  ]);

  const stats = statsResult.data?.[0];
  const timeseries = timeseriesResult.data ?? [];
  const topQuestions = topQuestionsResult.data ?? [];
  const topDocuments = topDocumentsResult.data ?? [];
  const departments = departmentsResult.data ?? [];
  const quality = qualityResult.data?.[0];
  const activeUsers = activeUsersResult.data?.[0];
  const hourly = hourlyResult.data ?? [];
  const cost = costResult.data ?? [];
  const usage = usageResult.data?.[0];

  const answersTotal = quality?.answers_total ?? 0;
  const citationRate =
    answersTotal > 0 ? ((quality?.answers_with_source ?? 0) / answersTotal) * 100 : null;

  const feedbackTotal = quality?.feedback_total ?? 0;
  const satisfaction =
    feedbackTotal > 0 ? ((quality?.feedback_up ?? 0) / feedbackTotal) * 100 : null;

  const adoption =
    activeUsers && activeUsers.total_users > 0
      ? (activeUsers.active_users / activeUsers.total_users) * 100
      : null;

  const monthlyCost = cost.length > 0 ? Number(cost[cost.length - 1].estimated_cost_usd) : 0;
  const questionsLimit = usage?.questions_limit ?? null;
  const questionsUsed = usage?.questions_used ?? 0;
  const quotaPercent =
    questionsLimit && questionsLimit > 0 ? (questionsUsed / questionsLimit) * 100 : null;

  const answered = stats?.answered_count ?? 0;
  const unanswered = stats?.unanswered_count ?? 0;
  const totalAnswers = answered + unanswered;
  const answerRate = totalAnswers > 0 ? (answered / totalAnswers) * 100 : null;

  const hasActivity = totalAnswers > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="التحليلات"
        description="قياس استخدام قاعدة المعرفة وأثرها: ما الذي يسأل عنه فريقك، وما الذي لا يجد إجابة."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="إجمالي المحادثات"
          value={stats?.conversations_count ?? 0}
          icon={MessagesSquare}
        />
        <StatCard
          label="إجمالي الأسئلة"
          value={stats?.questions_count ?? 0}
          icon={MessageCircleQuestion}
        />
        <StatCard label="أسئلة مُجابة" value={answered} icon={MessageCircleQuestion} tone="success" />
        <StatCard
          label="بلا إجابة"
          value={unanswered}
          icon={CircleHelp}
          tone={unanswered > 0 ? 'warning' : 'default'}
        />
        <StatCard
          label="معدل الإجابة"
          value={answerRate === null ? '—' : formatPercent(answerRate)}
          icon={Percent}
          tone={answerRate !== null && answerRate < 70 ? 'warning' : 'success'}
          hint={
            answerRate !== null && answerRate < 70
              ? 'راجع فجوات المعرفة لرفع المعدل'
              : undefined
          }
        />
      </div>

      {/* تبنّي النظام وجودة إجاباته — ما لا تكشفه أعداد الأسئلة وحدها */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="مستخدمون نشطون"
          value={activeUsers?.active_users ?? 0}
          icon={Users}
          hint={
            adoption === null
              ? 'خلال 30 يومًا'
              : `${formatPercent(adoption)} من ${formatNumber(activeUsers?.total_users ?? 0)} مستخدمًا`
          }
          tone={adoption !== null && adoption < 40 ? 'warning' : 'default'}
        />
        <StatCard
          label="إجابات موثّقة بمصدر"
          value={citationRate === null ? '—' : formatPercent(citationRate)}
          icon={FileStack}
          hint={citationRate === null ? 'لا توجد إجابات بعد' : 'نسبة الإجابات المستندة لمستند'}
          tone={citationRate !== null && citationRate < 60 ? 'warning' : 'success'}
        />
        <StatCard
          label="رضا الموظفين"
          value={satisfaction === null ? '—' : formatPercent(satisfaction)}
          icon={ThumbsUp}
          hint={
            feedbackTotal === 0
              ? 'لا توجد تقييمات بعد'
              : `${formatNumber(feedbackTotal)} تقييمًا`
          }
          tone={satisfaction !== null && satisfaction < 60 ? 'warning' : 'success'}
        />
        <StatCard
          label="متوسط زمن الرد"
          value={quality ? `${(quality.avg_latency_ms / 1000).toFixed(1)} ث` : '—'}
          icon={Timer}
        />
        <StatCard
          label="تكلفة الشهر التقديرية"
          value={`$${monthlyCost.toFixed(2)}`}
          icon={Wallet}
          hint={
            quotaPercent === null
              ? `${formatNumber(questionsUsed)} سؤالًا هذا الشهر`
              : `${formatNumber(questionsUsed)} من ${formatNumber(questionsLimit ?? 0)} سؤالًا (${formatPercent(quotaPercent)})`
          }
          tone={quotaPercent !== null && quotaPercent >= 80 ? 'warning' : 'default'}
        />
      </div>

      {activeUsers?.top_user_name ? (
        <p className="text-sm text-muted-foreground">
          الأكثر استخدامًا خلال 30 يومًا:{' '}
          <span className="font-medium text-foreground">{activeUsers.top_user_name}</span> بـ
          {formatNumber(activeUsers.top_user_questions ?? 0)} سؤالًا
          {activeUsers.new_users > 0
            ? ` · انضم ${formatNumber(activeUsers.new_users)} مستخدمًا جديدًا`
            : ''}
        </p>
      ) : null}

      {!hasActivity ? (
        <EmptyState
          icon={BarChart3}
          title="لا توجد بيانات كافية بعد"
          description="ستظهر التحليلات بمجرد أن يبدأ فريقك في استخدام المساعد الذكي."
        />
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>الأسئلة خلال آخر 30 يومًا</CardTitle>
            </CardHeader>
            <CardContent>
              <AnswerRateChart data={timeseries} />
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>أكثر الأسئلة تداولًا</CardTitle>
              </CardHeader>
              <CardContent>
                {topQuestions.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    لا توجد أسئلة مسجّلة بعد.
                  </p>
                ) : (
                  <ul className="divide-y">
                    {topQuestions.map((item, index) => (
                      <li
                        key={`${item.question}-${index}`}
                        className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
                      >
                        <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-medium text-muted-foreground">
                          {index + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm leading-relaxed">
                            {truncate(item.question, 110)}
                          </p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span>{formatNumber(item.times_asked)} مرة</span>
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

            <Card>
              <CardHeader>
                <CardTitle>أكثر المستندات استخدامًا</CardTitle>
              </CardHeader>
              <CardContent>
                {topDocuments.length === 0 ? (
                  <EmptyState
                    icon={FileStack}
                    title="لا توجد مصادر مسجّلة"
                    description="ستظهر هنا المستندات التي استند إليها المساعد في إجاباته."
                    className="border-0 bg-transparent py-6"
                  />
                ) : (
                  <ul className="divide-y">
                    {topDocuments.map((document) => (
                      <li
                        key={document.document_id}
                        className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                      >
                        <span className="min-w-0 truncate text-sm">
                          {document.document_name}
                        </span>
                        <Badge variant="secondary" className="shrink-0">
                          {formatNumber(document.citations)} استشهاد
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>الأسئلة حسب القسم</CardTitle>
            </CardHeader>
            <CardContent>
              <DepartmentUsageChart data={departments} />
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>ساعات الذروة</CardTitle>
              </CardHeader>
              <CardContent>
                <HourlyActivityChart data={hourly} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>الاستهلاك والتكلفة</CardTitle>
              </CardHeader>
              <CardContent>
                <CostChart data={cost} />
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
