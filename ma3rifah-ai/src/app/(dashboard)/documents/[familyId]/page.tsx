import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, AlertTriangle, FileClock, ShieldCheck } from 'lucide-react';
import { requirePermission } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { can } from '@/lib/auth/rbac';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { DocumentStatusBadge } from '@/components/dashboard/documents/document-status';
import {
  getDocumentFamily,
  getFamilyEvents,
  APPROVAL_LABELS,
  VERSION_EVENT_LABELS,
} from '@/lib/documents/versions';
import { formatBytes, formatNumber, formatRelativeTime } from '@/lib/utils';
import { VersionControls } from './version-controls';

export const metadata: Metadata = { title: 'إصدارات الوثيقة' };
export const dynamic = 'force-dynamic';

/** وسم حالة الاعتماد — ولونه يفرّق المرجع عمّا ليس مرجعًا */
function ApprovalBadge({
  status,
  isEffective,
}: {
  status: keyof typeof APPROVAL_LABELS;
  isEffective: boolean;
}) {
  const variant =
    isEffective && status === 'APPROVED'
      ? 'default'
      : status === 'MIGRATED_UNREVIEWED'
        ? 'secondary'
        : status === 'SUPERSEDED' || status === 'ARCHIVED'
          ? 'outline'
          : 'secondary';

  return <Badge variant={variant}>{APPROVAL_LABELS[status]}</Badge>;
}

export default async function DocumentFamilyPage({
  params,
}: {
  params: Promise<{ familyId: string }>;
}) {
  // الحارس في الصفحة نفسها لا في التخطيط: صفحةٌ تعتمد على حارس أعلاها
  // تُصبح مفتوحةً بأول إعادة ترتيب للمسارات.
  const { profile } = await requirePermission('documents.view');
  const { familyId } = await params;

  const supabase = await createClient();
  const family = await getDocumentFamily(supabase, familyId);

  // RLS هي من ردّت لا شرطٌ هنا: الوثيقة المحجوبة والوثيقة غير الموجودة
  // تظهران متطابقتين، فلا يُكشف وجود وثيقةٍ لا يحقّ للمستخدم رؤيتها.
  if (!family) notFound();

  const events = await getFamilyEvents(supabase, familyId);
  const canManage = can(profile.role, 'documents.manage');

  const effective = family.versions.find((v) => v.isEffective) ?? null;
  // أحدث إصدار جاهز للاعتماد — مادة خطوة التجهيز الظاهرة
  const pendingApproval = family.versions.find((v) => v.canApprove) ?? null;
  const unreviewedMigration =
    effective?.approvalStatus === 'MIGRATED_UNREVIEWED';

  return (
    <div className="space-y-6">
      <PageHeader
        title={family.title}
        description="إصدارات هذه الوثيقة وسجلّ اعتمادها. الإجابات تُبنى على الإصدار المعتمد وحده."
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link href="/documents">
              <ArrowRight className="size-4" aria-hidden />
              كل المستندات
            </Link>
          </Button>
        }
      />

      {/* الحالة المرجعية — أول ما يحتاج المدير معرفته */}
      <Card>
        <CardContent className="space-y-3 p-6">
          <div className="flex flex-wrap items-center gap-3">
            {effective ? (
              <>
                {/*
                  لا تُستخدم عبارة «المرجع المعتمد» لإصدارٍ لم يُعتمد.
                  والوثيقة المرحَّلة تخدم فعلًا ولم يُقرَّر اعتمادها، فوصفها
                  معتمدةً كذبٌ صغير يجعل المدير يطمئنّ إلى ما لم يراجعه.
                */}
                <ShieldCheck
                  className={
                    unreviewedMigration ? 'size-5 text-muted-foreground' : 'size-5 text-gold'
                  }
                  aria-hidden
                />
                <div>
                  <p className="text-sm font-semibold">
                    {unreviewedMigration
                      ? `مرجع مستخدم حاليًا — بانتظار المراجعة: الإصدار ${effective.versionLabel ?? '—'}`
                      : `المرجع المعتمد: الإصدار ${effective.versionLabel ?? '—'}`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {effective.effectiveFrom
                      ? `ساري من ${effective.effectiveFrom}`
                      : 'لم يُسجَّل تاريخ سريان'}
                    {' · '}
                    {formatNumber(effective.chunkCount)} مقطعًا قابلًا للبحث
                  </p>
                </div>
              </>
            ) : (
              <>
                <AlertTriangle className="size-5 text-destructive" aria-hidden />
                <div>
                  <p className="text-sm font-semibold">
                    لا يوجد إصدار معتمد لهذه الوثيقة
                  </p>
                  <p className="text-xs text-muted-foreground">
                    لن تظهر في إجابات المساعد حتى يُعتمد أحد إصداراتها.
                  </p>
                </div>
              </>
            )}
          </div>

          {/*
            الوثائق التي سبقت نظام الإصدارات تعمل مرجعًا، ولم يُسجَّل لها
            قرار اعتماد. والصدق هنا أهمّ من نظافة الواجهة: إخفاء هذا
            يجعل المدير يظنّ أن كل مراجعه مُقرَّرة وهي ليست كذلك.
          */}
          {unreviewedMigration ? (
            <div className="rounded-lg border border-gold/30 bg-gold/5 p-3 text-xs leading-relaxed">
              <strong className="font-semibold">لم يُسجَّل اعتماد لهذه الوثيقة.</strong>{' '}
              رُحّلت مع إطلاق نظام الإصدارات وتعمل مرجعًا كما كانت، لكن لا قرار
              اعتماد موثَّقًا لها.
              {canManage ? ' اعتمدها لتثبيت مرجعيتها بقرار له صاحب وتاريخ.' : ''}
            </div>
          ) : null}

          {/*
            بديل التفعيل التلقائي الذي أُلغي: خطوة ظاهرة تقول ماذا الآن.
            الوثيقة المفهرسة وغير المعتمدة لا تُجيب، ولو تُركت بلا هذه
            الرسالة لظنّ المدير أن الرفع كفى — وانتظر جوابًا لا يأتي.
          */}
          {!effective && pendingApproval ? (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs leading-relaxed">
              <strong className="font-semibold">
                اكتملت معالجة الإصدار {pendingApproval.versionLabel ?? '—'} وهو جاهز
                للاعتماد.
              </strong>{' '}
              {canManage
                ? 'راجعه واعتمده لبدء استخدام الوثيقة في إجابات المساعد.'
                : 'سيبدأ استخدامه بعد اعتماد مدير الشركة.'}
            </div>
          ) : null}

          {family.reviewDueAt ? (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <FileClock className="size-3.5" aria-hidden />
              المراجعة القادمة: {family.reviewDueAt}
              {family.reviewIntervalMonths
                ? ` (كل ${family.reviewIntervalMonths} شهرًا)`
                : ''}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {/* الإصدارات */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الإصدار</TableHead>
              <TableHead>الاعتماد</TableHead>
              <TableHead>المعالجة</TableHead>
              <TableHead>الحجم</TableHead>
              <TableHead>رُفع</TableHead>
              {canManage ? <TableHead>إجراءات</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {family.versions.map((version) => (
              <TableRow key={version.id} className={version.isEffective ? 'bg-primary/5' : ''}>
                <TableCell className="font-medium">
                  {version.versionLabel ?? '—'}
                </TableCell>
                <TableCell>
                  <ApprovalBadge
                    status={version.approvalStatus}
                    isEffective={version.isEffective}
                  />
                </TableCell>
                <TableCell>
                  <DocumentStatusBadge status={version.indexStatus as never} />
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {formatBytes(version.fileSizeBytes)}
                  {version.pageCount ? ` · ${version.pageCount} صفحة` : ''}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {formatRelativeTime(version.createdAt)}
                </TableCell>
                {canManage ? (
                  <TableCell>
                    <VersionControls
                      documentId={version.id}
                      canApprove={version.canApprove}
                      canArchive={
                        version.approvalStatus !== 'ARCHIVED' &&
                        version.indexStatus !== 'ARCHIVED'
                      }
                      isEffective={version.isEffective}
                    />
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* سجلّ الإصدارات — من فعل ماذا ومتى */}
      {events.length > 0 ? (
        <Card>
          <CardContent className="p-6">
            <h2 className="mb-4 text-sm font-semibold">سجلّ الوثيقة</h2>
            <ol className="space-y-3">
              {events.map((event) => (
                <li key={event.id} className="flex gap-3 text-sm">
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatRelativeTime(event.createdAt)}
                  </span>
                  <span>
                    {VERSION_EVENT_LABELS[event.event]}
                    {event.note ? (
                      <span className="text-muted-foreground"> — {event.note}</span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
