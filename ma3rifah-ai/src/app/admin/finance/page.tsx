import type { Metadata } from 'next';
import {
  Banknote,
  Cpu,
  Server,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
} from 'lucide-react';
import { requireSuperAdmin } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/shared/states';
import { ExpensesEditor } from './expenses-editor';
import { formatSar } from '@/lib/roi';
import { logger } from '@/lib/logger';

export const metadata: Metadata = { title: 'المالية' };
export const dynamic = 'force-dynamic';

/** الريال مربوط بالدولار — التحويل ثابت لا تقديري */
const SAR_PER_USD = 3.75;

export default async function AdminFinancePage() {
  await requireSuperAdmin();

  // الدوالّ تمرّ بجلسة المستخدم كي تتحقّق من الدور داخل القاعدة أيضًا،
  // لا في طبقة التطبيق وحدها. ومفتاح الخدمة يجعل auth.uid() فارغًا
  // فترفض الدالّة — وهو عطل وقع سابقًا في هذه الصفحة نفسها.
  const sessionClient = await createClient();
  const admin = createAdminClient();

  const [summary, pnl, expenses] = await Promise.all([
    sessionClient.rpc('platform_finance_summary', { p_months: 6 }),
    sessionClient.rpc('platform_company_pnl', {}),
    admin.from('platform_expenses').select('*').order('starts_on', { ascending: false }),
  ]);

  if (summary.error) {
    logger.warn('تعذّر قراءة الملخّص المالي', { reason: summary.error.message });
  }

  const months = summary.data ?? [];

  // =====================================================================
  // مؤشّر معطّل يجب أن يقول إنه معطّل
  //
  // كانت بطاقتا التكلفة تعرضان «٠ ريال» حين يتعذّر التقرير، بينما تعرض
  // بطاقتا الإيراد والربح «—». والصفر هنا **ادّعاء بأن القياس تمّ ولم
  // يجد شيئًا** — وهو أسوأ من الفراغ: قرأته المالكة «لا تكلفة عليّ»
  // وهي تستعمل المنصّة فعلًا، فسألت عن سبب غياب التكلفة بدل أن تُخبَر
  // أن التقرير نفسه لم يعمل.
  //
  // والدالّة تُنشئ صفوف الأشهر بـ`generate_series`، فهي تُرجع صفًّا لكل
  // شهر ولو لم يكن في القاعدة معطًى واحد. فصفرُ الصفوف لا يعني «لا
  // بيانات» بل **«لم يُقرأ التقرير»** — ولا سبيل لخلطهما.
  // =====================================================================
  const reportUnavailable = Boolean(summary.error) || months.length === 0;
  const current = months.length > 0 ? months[months.length - 1] : null;
  const previous = months.length > 1 ? months[months.length - 2] : null;

  const companies = (pnl.data ?? []).filter((row) => !row.is_demo);
  const losing = companies.filter((row) => row.profit_sar < 0);

  // الاتجاه: النمو عن الشهر السابق. ولا يُحسب من قسمةٍ على صفر.
  const growth =
    previous && previous.revenue_sar > 0 && current
      ? ((current.revenue_sar - previous.revenue_sar) / previous.revenue_sar) * 100
      : null;

  const aiCostSar = current ? current.ai_cost_usd * SAR_PER_USD : 0;
  const fixedCostSar = current ? current.fixed_cost_usd * SAR_PER_USD : 0;
  const profitable = current !== null && current.net_profit_sar > 0;

  /** قيمة البطاقة، أو «غير متاح» إن تعذّر التقرير */
  const shown = (value: string): string => (reportUnavailable ? 'غير متاح' : value);

  return (
    <div className="space-y-8">
      <PageHeader
        title="المالية"
        description="إيراد مقبوض لا مستحَقّ، وتكلفة فعلية لا مقدَّرة، والربح بينهما."
      />

      {/* البطاقات الأربع */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="الإيراد المقبوض هذا الشهر"
          value={reportUnavailable ? 'غير متاح' : `${formatSar(current!.revenue_sar)} ريال`}
          icon={Banknote}
          tone="success"
          hint={
            reportUnavailable
              ? 'تعذّر قراءة التقرير'
              : growth === null
                ? 'لا مقارنة بعد'
                : `${growth >= 0 ? '+' : ''}${growth.toFixed(0)}٪ عن الشهر السابق`
          }
        />
        <StatCard
          label="تكلفة الذكاء"
          value={shown(`${formatSar(Math.round(aiCostSar))} ريال`)}
          icon={Cpu}
          tone="default"
          hint={
            reportUnavailable
              ? 'تعذّر قراءة التقرير'
              : `${formatSar(current?.questions_count ?? 0)} سؤالًا`
          }
        />
        <StatCard
          label="المصاريف الثابتة"
          value={shown(`${formatSar(Math.round(fixedCostSar))} ريال`)}
          icon={Server}
          tone="default"
          hint={
            reportUnavailable
              ? 'تعذّر قراءة التقرير'
              : fixedCostSar === 0
                ? 'لم تُدخَل بعد — الربح يبدو أكبر مما هو'
                : undefined
          }
        />
        <StatCard
          label="الربح الصافي"
          value={reportUnavailable ? 'غير متاح' : `${formatSar(current!.net_profit_sar)} ريال`}
          icon={profitable ? TrendingUp : TrendingDown}
          tone={reportUnavailable ? 'default' : profitable ? 'success' : 'destructive'}
          hint={
            reportUnavailable
              ? 'تعذّر قراءة التقرير'
              : current?.margin_percent !== null && current?.margin_percent !== undefined
                ? `هامش ${current.margin_percent}٪`
                : 'لا إيراد بعد'
          }
        />
      </div>

      {reportUnavailable ? (
        <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
          <div className="text-sm leading-relaxed">
            <strong>تعذّر قراءة التقرير المالي.</strong> والأرجح أن قاعدة البيانات لم
            تُحدَّث بعد: شغّلي{' '}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
              supabase/ALL_MIGRATIONS.sql
            </code>{' '}
            في محرّر SQL على Supabase ثم حدّثي هذه الصفحة.
            <span className="mt-1.5 block text-muted-foreground">
              ولا تُقرأ الأصفار أعلاه قياسًا: لم يُقرأ شيء بعد.
            </span>
          </div>
        </div>
      ) : fixedCostSar === 0 ? (
        <div className="flex items-start gap-3 rounded-xl border border-[hsl(var(--warning))]/30 bg-[hsl(var(--warning))]/10 p-4">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-[hsl(var(--warning))]" aria-hidden />
          <p className="text-sm leading-relaxed">
            <strong>لم تُدخَل أي مصاريف ثابتة.</strong> الاستضافة والقاعدة والأدوات
            لا تظهر في أي جدول، فلا تُطرح — والربح أعلاه أكبر مما هو فعلًا. أضيفيها
            أدناه لتصير الأرقام صادقة.
          </p>
        </div>
      ) : null}

      {/* الاتجاه الشهري */}
      <Card>
        <CardHeader>
          <CardTitle>الاتجاه — ستة أشهر</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-y bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 text-start font-medium">الشهر</th>
                  <th className="px-4 py-2.5 text-start font-medium">الإيراد</th>
                  <th className="px-4 py-2.5 text-start font-medium">الذكاء</th>
                  <th className="px-4 py-2.5 text-start font-medium">الثابت</th>
                  <th className="px-4 py-2.5 text-start font-medium">الصافي</th>
                  <th className="px-4 py-2.5 text-start font-medium">شركات دافعة</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {months.map((month) => (
                  <tr key={month.period_month}>
                    <td className="px-4 py-3 font-medium">
                      {new Intl.DateTimeFormat('ar-SA', {
                        month: 'long',
                        year: 'numeric',
                      }).format(new Date(month.period_month))}
                    </td>
                    <td className="numeric px-4 py-3">{formatSar(month.revenue_sar)}</td>
                    <td className="numeric px-4 py-3 text-muted-foreground">
                      {formatSar(Math.round(month.ai_cost_usd * SAR_PER_USD))}
                    </td>
                    <td className="numeric px-4 py-3 text-muted-foreground">
                      {formatSar(Math.round(month.fixed_cost_usd * SAR_PER_USD))}
                    </td>
                    <td
                      className={
                        month.net_profit_sar >= 0
                          ? 'numeric px-4 py-3 font-semibold text-[hsl(var(--success))]'
                          : 'numeric px-4 py-3 font-semibold text-destructive'
                      }
                    >
                      {formatSar(month.net_profit_sar)}
                    </td>
                    <td className="numeric px-4 py-3 text-muted-foreground">
                      {month.paying_companies}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* الربح لكل شركة */}
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            الربح لكل شركة
            {losing.length > 0 ? (
              <Badge variant="destructive">{losing.length} خاسرة</Badge>
            ) : null}
          </CardTitle>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            مرتَّبة بالأخسر أولًا — فهو الذي يحتاج قرارًا. والمتوسّط يخفي: عميلٌ
            واحد كثير الاستعمال قد يلتهم ربح البقيّة ولا يظهر إلا هنا.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {companies.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={Banknote}
                title="لا شركات حقيقية بعد"
                description="ستظهر هنا أرباح كل شركة فور أول اشتراك مدفوع."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-y bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 text-start font-medium">الشركة</th>
                    <th className="px-4 py-2.5 text-start font-medium">الخطة</th>
                    <th className="px-4 py-2.5 text-start font-medium">مقبوض</th>
                    <th className="px-4 py-2.5 text-start font-medium">تكلفتها</th>
                    <th className="px-4 py-2.5 text-start font-medium">الربح</th>
                    <th className="px-4 py-2.5 text-start font-medium">الاستهلاك</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {companies.map((row) => {
                    const usage =
                      row.questions_limit && row.questions_limit > 0
                        ? Math.round((row.questions_count / row.questions_limit) * 100)
                        : null;

                    return (
                      <tr key={row.company_id}>
                        <td className="px-4 py-3 font-medium">{row.company_name}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {row.plan_name ?? '—'}
                        </td>
                        <td className="numeric px-4 py-3">{formatSar(row.revenue_sar)}</td>
                        <td className="numeric px-4 py-3 text-muted-foreground">
                          {formatSar(Math.round(row.ai_cost_usd * SAR_PER_USD))}
                        </td>
                        <td
                          className={
                            row.profit_sar >= 0
                              ? 'numeric px-4 py-3 font-semibold text-[hsl(var(--success))]'
                              : 'numeric px-4 py-3 font-semibold text-destructive'
                          }
                        >
                          {formatSar(row.profit_sar)}
                          {row.margin_percent !== null ? (
                            <span className="ms-1.5 text-xs font-normal text-muted-foreground">
                              ({row.margin_percent}٪)
                            </span>
                          ) : null}
                        </td>
                        <td className="numeric px-4 py-3 text-muted-foreground">
                          {usage === null ? '—' : `${usage}٪`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <ExpensesEditor expenses={expenses.data ?? []} />

      <p className="text-xs leading-relaxed text-muted-foreground">
        الإيراد يُحسب من المدفوعات <strong>الناجحة</strong> وحدها — لا المستردَّة ولا
        الفاشلة ولا سعر الخطة. وتكلفة الذكاء من سجلّ الاستهلاك الفعلي لا من تقدير.
        والتحويل ٣٫٧٥ ريالًا للدولار (الريال مربوط). ولا تشمل هذه الأرقام ضريبة
        القيمة المضافة — تُضاف بعد حسم كون الأسعار شاملةً لها أو غير شاملة.
      </p>
    </div>
  );
}
