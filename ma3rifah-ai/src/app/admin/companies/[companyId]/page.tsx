import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowRight,
  CircleHelp,
  FileStack,
  LifeBuoy,
  MessageCircleQuestion,
  Users,
  Wallet,
} from 'lucide-react';
import { requireSuperAdmin } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ROLE_LABELS } from '@/lib/auth/rbac';
import { TICKET_STATUS_LABELS } from '@/lib/config/support';
import { formatBytes, formatDate, formatNumber, formatRelativeTime, truncate } from '@/lib/utils';

export const metadata: Metadata = { title: 'تفاصيل الشركة' };
export const dynamic = 'force-dynamic';

const DOC_STATUS_LABELS: Record<string, string> = {
  PROCESSING: 'جارٍ التحليل',
  READY: 'جاهز',
  FAILED: 'فشل',
  ARCHIVED: 'مؤرشف',
};

/**
 * ملف العميل الكامل لمالك المنصة.
 *
 * حدّ متعمَّد: لا يُعرض هنا **محتوى** أي مستند، ولا نص أي سؤال أو إجابة،
 * ولا محادثات الموظفين. ما يُعرض بيانات تشغيلية — أسماء وحالات وأعداد —
 * وهي ما يحتاجه الدعم فعلًا.
 *
 * وحين يسأل مدير تقنية المعلومات «هل تقرؤون وثائقنا؟» يكون الجواب «لا»
 * جوابًا صحيحًا، ولا يصحّ لو بُني هنا باب خلفي «للدعم فقط».
 */
const AUDIT_LABELS: Record<string, string> = {
  'auth.register': 'تسجيل شركة جديدة',
  'auth.login': 'تسجيل دخول',
  'auth.password_reset': 'إعادة تعيين كلمة المرور',
  'user.invited': 'إضافة مستخدم',
  'user.created': 'إنشاء مستخدم',
  'user.updated': 'تعديل مستخدم',
  'user.role_changed': 'تغيير دور',
  'user.deactivated': 'تعطيل مستخدم',
  'user.reactivated': 'تفعيل مستخدم',
  'document.uploaded': 'رفع مستند',
  'document.upload_failed': 'محاولة رفع فاشلة',
  'document.processed': 'اكتملت معالجة مستند',
  'document.processing_failed': 'فشلت معالجة مستند',
  'document.deleted': 'حذف مستند',
  'knowledge_gap.resolved': 'معالجة فجوة معرفة',
  'company.updated': 'تعديل بيانات الشركة',
  'whatsapp.link_code_requested': 'طلب ربط واتساب',
  'whatsapp.unlinked': 'إزالة ربط واتساب',
};

/** سطر واحد في لوحة الأدلة: ادّعاء العميل، وما يقوله السجل */
function EvidenceRow({
  claim,
  verdict,
  ok,
}: {
  claim: string;
  verdict: string;
  ok: boolean;
}) {
  return (
    <div className="rounded-lg border bg-muted/20 p-4">
      <p className="font-medium">{claim}</p>
      <p
        className={
          ok
            ? 'mt-1.5 text-[hsl(var(--success))]'
            : 'mt-1.5 text-[hsl(var(--warning))]'
        }
      >
        {verdict}
      </p>
    </div>
  );
}

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  await requireSuperAdmin();
  const { companyId } = await params;
  const admin = createAdminClient();

  const { data: company } = await admin
    .from('companies')
    .select('id, name, slug, status, industry, country, is_demo, created_at')
    .eq('id', companyId)
    .maybeSingle();

  if (!company) notFound();

  const [users, documents, subscription, usage, tickets, messageStats] = await Promise.all([
    admin
      .from('profiles')
      .select('id, full_name, email, role, status, job_title, last_seen_at, created_at')
      .eq('company_id', companyId)
      .order('created_at', { ascending: true }),
    admin
      .from('documents')
      .select('id, name, status, file_size_bytes, chunk_count, error_message, created_at')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(50),
    admin
      .from('subscriptions')
      .select('status, current_period_end, plan_id')
      .eq('company_id', companyId)
      .maybeSingle(),
    admin
      .from('usage_records')
      .select('period_month, questions_count, input_tokens, output_tokens, estimated_cost_usd')
      .eq('company_id', companyId)
      .order('period_month', { ascending: false })
      .limit(6),
    admin
      .from('support_tickets')
      .select('id, subject, status, priority, last_reply_at')
      .eq('company_id', companyId)
      .order('last_reply_at', { ascending: false })
      .limit(20),
    admin
      .from('messages')
      .select('role, answer_status')
      .eq('company_id', companyId)
      .limit(20000),
  ]);

  const { data: auditLog } = await admin
    .from('audit_logs')
    .select('id, action, actor_email, entity_type, metadata, created_at')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(40);

  const plan = subscription.data?.plan_id
    ? await admin.from('plans').select('name').eq('id', subscription.data.plan_id).maybeSingle()
    : { data: null };

  const rows = messageStats.data ?? [];
  const questions = rows.filter((row) => row.role === 'USER').length;
  const unanswered = rows.filter((row) => row.answer_status === 'UNANSWERED').length;
  const monthlyCost = Number(usage.data?.[0]?.estimated_cost_usd ?? 0);
  const openTickets = (tickets.data ?? []).filter(
    (ticket) => ticket.status === 'OPEN' || ticket.status === 'IN_PROGRESS',
  ).length;

  // --- الأدلة ---
  const documentRows = documents.data ?? [];
  const readyCount = documentRows.filter((row) => row.status === 'READY').length;
  const failedCount = documentRows.filter((row) => row.status === 'FAILED').length;
  const uploadedCount = documentRows.length - failedCount;
  const neverLoggedIn = (users.data ?? []).filter((user) => !user.last_seen_at).length;
  const inviteAttempts = (auditLog ?? []).filter(
    (entry) => entry.action === 'user.invited' || entry.action === 'user.created',
  ).length;
  // محاولات رُفضت قبل إنشاء صفّ المستند (نوع غير مدعوم، حجم، تكرار)
  const rejectedUploads = (auditLog ?? []).filter(
    (entry) => entry.action === 'document.upload_failed',
  ).length;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ms-2">
        <Link href="/admin/companies">
          <ArrowRight className="size-4" aria-hidden />
          كل الشركات
        </Link>
      </Button>

      <PageHeader
        title={company.name}
        description={[company.industry, company.country, `أُنشئت ${formatDate(company.created_at)}`]
          .filter(Boolean)
          .join(' · ')}
        actions={
          <div className="flex items-center gap-2">
            {company.is_demo ? <Badge variant="warning">بيانات تجريبية</Badge> : null}
            <Badge>{company.status}</Badge>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="المستخدمون" value={users.data?.length ?? 0} icon={Users} />
        <StatCard label="المستندات" value={documents.data?.length ?? 0} icon={FileStack} />
        <StatCard label="الأسئلة" value={questions} icon={MessageCircleQuestion} />
        <StatCard
          label="بلا إجابة"
          value={unanswered}
          icon={CircleHelp}
          tone={unanswered > 0 ? 'warning' : 'default'}
          hint={
            questions > 0 ? `${Math.round((unanswered / questions) * 100)}% من الأسئلة` : undefined
          }
        />
        <StatCard
          label="تكلفة الشهر"
          value={`$${monthlyCost.toFixed(2)}`}
          icon={Wallet}
          hint={plan.data?.name ? `خطة ${plan.data.name}` : 'بلا اشتراك'}
        />
      </div>

      {/* -------------------------------------------------------------
          لوحة الأدلة.

          حين يقول عميل «ما قدرنا نرفع» أو «الموظفون ما قدروا يدخلون»،
          فالجواب ليس تصديقًا ولا تكذيبًا بل نظرة في السجل. وأكثر ما
          يظهر أنه لا يكذب ولا يصيب: يصف عرضًا حقيقيًا وينسب له سببًا
          خاطئًا — وهذا ما تكشفه هذه اللوحة في ثوانٍ.
          ------------------------------------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle>الأدلة — ماذا حدث فعلًا</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm leading-relaxed">
          <EvidenceRow
            claim="«ما قدرنا نرفع أي مستند»"
            verdict={
              uploadedCount === 0 && failedCount === 0 && rejectedUploads === 0
                ? 'لم تُسجَّل أي محاولة رفع إطلاقًا — المشكلة قبل الرفع: لم يصلوا إلى الصفحة أو لم يجرّبوا.'
                : uploadedCount === 0 && failedCount === 0 && rejectedUploads > 0
                  ? `رُفضت ${formatNumber(rejectedUploads)} محاولة قبل الرفع (نوع غير مدعوم أو حجم أو ملف مكرّر). حاولوا فعلًا، والرفض جاء من التحقق لا من المعالجة.`
                : failedCount > 0 && readyCount === 0
                  ? `جُرِّب الرفع ${formatNumber(uploadedCount + failedCount)} مرة وفشل كله. السبب مذكور تحت كل مستند في القائمة أعلاه.`
                  : `نجح رفع ${formatNumber(readyCount)} مستندًا${failedCount > 0 ? ` وفشل ${formatNumber(failedCount)}` : ''}. الرفع يعمل عندهم.`
            }
            ok={readyCount > 0}
          />

          <EvidenceRow
            claim="«الموظفون ما قدروا يدخلون»"
            verdict={
              (users.data?.length ?? 0) <= 1
                ? 'لا يوجد موظفون مضافون أصلًا — لم تصل الشركة إلى مرحلة الدخول بعد.'
                : neverLoggedIn === 0
                  ? 'كل المستخدمين دخلوا فعلًا مرة واحدة على الأقل.'
                  : `${formatNumber(neverLoggedIn)} من ${formatNumber(users.data?.length ?? 0)} لم يدخلوا قط. إن كانت حالتهم «مدعو» فالدعوة لم تصل — راجع إعداد البريد.`
            }
            ok={neverLoggedIn === 0 && (users.data?.length ?? 0) > 1}
          />

          <EvidenceRow
            claim="«ما قدرت أضيف موظفًا»"
            verdict={
              inviteAttempts === 0
                ? 'لا توجد أي محاولة إضافة مستخدم في السجل — لم تُجرَّب العملية.'
                : `سُجِّلت ${formatNumber(inviteAttempts)} عملية إضافة مستخدم. العملية تعمل عندهم.`
            }
            ok={inviteAttempts > 0}
          />
        </CardContent>
      </Card>

      {openTickets > 0 ? (
        <div className="flex items-center gap-2 rounded-lg border border-[hsl(var(--warning))]/40 bg-[hsl(var(--warning))]/10 p-4 text-sm">
          <LifeBuoy className="size-4 text-[hsl(var(--warning))]" aria-hidden />
          لدى هذه الشركة {formatNumber(openTickets)} تذكرة دعم مفتوحة.
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ---------- المستخدمون ---------- */}
        <Card>
          <CardHeader>
            <CardTitle>المستخدمون</CardTitle>
          </CardHeader>
          <CardContent>
            {!users.data?.length ? (
              <p className="text-sm text-muted-foreground">لا يوجد مستخدمون.</p>
            ) : (
              <ul className="divide-y">
                {users.data.map((user) => (
                  <li key={user.id} className="flex items-start justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{user.full_name || '—'}</p>
                      <p className="truncate text-xs text-muted-foreground" dir="ltr">
                        {user.email}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {user.last_seen_at
                          ? `آخر ظهور ${formatRelativeTime(user.last_seen_at)}`
                          : 'لم يدخل بعد'}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Badge variant="muted">{ROLE_LABELS[user.role]}</Badge>
                      {user.status !== 'ACTIVE' ? (
                        <Badge variant="outline">{user.status}</Badge>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* ---------- المستندات ---------- */}
        <Card>
          <CardHeader>
            <CardTitle>المستندات</CardTitle>
          </CardHeader>
          <CardContent>
            {!documents.data?.length ? (
              <p className="text-sm text-muted-foreground">لم تُرفع مستندات بعد.</p>
            ) : (
              <ul className="divide-y">
                {documents.data.map((document) => (
                  <li key={document.id} className="py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{truncate(document.name, 60)}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {formatBytes(document.file_size_bytes)} ·{' '}
                          {formatNumber(document.chunk_count)} مقطع ·{' '}
                          {formatDate(document.created_at)}
                        </p>
                      </div>
                      <Badge
                        variant={
                          document.status === 'READY'
                            ? 'success'
                            : document.status === 'FAILED'
                              ? 'destructive'
                              : 'muted'
                        }
                      >
                        {DOC_STATUS_LABELS[document.status] ?? document.status}
                      </Badge>
                    </div>
                    {document.error_message ? (
                      <p className="mt-1.5 text-xs leading-relaxed text-destructive">
                        {truncate(document.error_message, 160)}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* ---------- الاستهلاك ---------- */}
        <Card>
          <CardHeader>
            <CardTitle>الاستهلاك الشهري</CardTitle>
          </CardHeader>
          <CardContent>
            {!usage.data?.length ? (
              <p className="text-sm text-muted-foreground">لا يوجد استهلاك مسجّل.</p>
            ) : (
              <ul className="divide-y">
                {usage.data.map((record) => (
                  <li key={record.period_month} className="flex items-center justify-between py-3">
                    <span className="text-sm">{record.period_month.slice(0, 7)}</span>
                    <span className="text-sm text-muted-foreground">
                      {formatNumber(record.questions_count)} سؤال · $
                      {Number(record.estimated_cost_usd).toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* ---------- التذاكر ---------- */}
        <Card>
          <CardHeader>
            <CardTitle>تذاكر الدعم</CardTitle>
          </CardHeader>
          <CardContent>
            {!tickets.data?.length ? (
              <p className="text-sm text-muted-foreground">لا توجد تذاكر.</p>
            ) : (
              <ul className="divide-y">
                {tickets.data.map((ticket) => (
                  <li key={ticket.id} className="py-3">
                    <Link
                      href={`/admin/support/${ticket.id}`}
                      className="flex items-start justify-between gap-3 hover:underline"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{truncate(ticket.subject, 60)}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {formatRelativeTime(ticket.last_reply_at)}
                        </p>
                      </div>
                      <Badge variant="muted">{TICKET_STATUS_LABELS[ticket.status]}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>سجل النشاط</CardTitle>
        </CardHeader>
        <CardContent>
          {!auditLog?.length ? (
            <p className="text-sm text-muted-foreground">لا يوجد نشاط مسجّل.</p>
          ) : (
            <ul className="divide-y">
              {auditLog.map((entry) => (
                <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0">
                    <span className="text-sm">{AUDIT_LABELS[entry.action] ?? entry.action}</span>
                    {entry.actor_email ? (
                      <span className="ms-2 text-xs text-muted-foreground" dir="ltr">
                        {entry.actor_email}
                      </span>
                    ) : null}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatRelativeTime(entry.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <p className="rounded-lg border bg-muted/30 p-4 text-xs leading-relaxed text-muted-foreground">
        لا تُعرض هنا محتويات المستندات ولا نصوص الأسئلة والإجابات ولا محادثات الموظفين — بيانات
        تشغيلية فقط. هذا حدّ متعمَّد يجعل جواب «لا نقرأ وثائقكم» صحيحًا حين يسأل عنه العميل.
      </p>
    </div>
  );
}
