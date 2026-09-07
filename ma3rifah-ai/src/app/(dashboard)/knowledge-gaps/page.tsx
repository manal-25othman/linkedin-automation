import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { can, ROLE_LABELS } from '@/lib/auth/rbac';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/shared/stat-card';
import { GapsClient, type GapRowData } from './gaps-client';
import { CircleHelp, CheckCircle2, Clock, FileSpreadsheet, UserCheck } from 'lucide-react';

export const metadata: Metadata = { title: 'فجوات المعرفة' };
export const dynamic = 'force-dynamic';

export default async function KnowledgeGapsPage() {
  const { profile } = await requirePermission('knowledge_gaps.view');
  const supabase = await createClient();

  const [gapsResult, departmentsResult, documentsResult, membersResult] = await Promise.all([
    supabase
      .from('knowledge_gaps')
      .select(
        'id, question, times_asked, department_id, status, last_asked_at, resolution_note, linked_document_id, answer_text, assigned_to, expert_answer, expert_answered_at',
      )
      .order('status', { ascending: true })
      .order('times_asked', { ascending: false })
      .limit(200),
    supabase.from('departments').select('id, name'),
    supabase.from('documents').select('id, name').eq('status', 'READY').order('name'),
    // مرشَّحو التوجيه: كل نشِط في الشركة. سياسة `profiles` تحصرهم في
    // الشركة، والخبير قد يكون موظفًا لا مديرًا — وهذا هو المقصود.
    supabase
      .from('profiles')
      .select('id, full_name, role, department_id, job_title')
      .eq('status', 'ACTIVE')
      .order('full_name'),
  ]);

  const departmentNames = new Map(
    (departmentsResult.data ?? []).map((department) => [department.id, department.name]),
  );

  const memberNames = new Map(
    (membersResult.data ?? []).map((member) => [member.id, member.full_name]),
  );

  const gaps: GapRowData[] = (gapsResult.data ?? []).map((gap) => ({
    id: gap.id,
    question: gap.question,
    timesAsked: gap.times_asked,
    departmentId: gap.department_id,
    departmentName: gap.department_id ? departmentNames.get(gap.department_id) ?? null : null,
    status: gap.status,
    answerText: gap.answer_text,
    lastAskedAt: gap.last_asked_at,
    resolutionNote: gap.resolution_note,
    linkedDocumentId: gap.linked_document_id,
    assignedTo: gap.assigned_to,
    assignedName: gap.assigned_to ? memberNames.get(gap.assigned_to) ?? null : null,
    expertAnswer: gap.expert_answer,
    expertAnsweredAt: gap.expert_answered_at,
  }));

  const openCount = gaps.filter((gap) => gap.status === 'OPEN').length;
  const inReviewCount = gaps.filter((gap) => gap.status === 'IN_REVIEW').length;
  const resolvedCount = gaps.filter((gap) => gap.status === 'RESOLVED').length;
  // جواب خبير وصل ولم يُعتمد بعد — أهمّ رقم في الشاشة لأنه ينتظر المدير
  const awaitingCount = gaps.filter(
    (gap) => gap.expertAnsweredAt !== null && !gap.answerText,
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="فجوات المعرفة"
        description="أسئلة طرحها موظفوك ولم تجد قاعدة المعرفة إجابة لها. الأسئلة المتشابهة مجمّعة معًا مع عدّاد تكرار — هذه قائمة التوثيق مرتّبة حسب الحاجة الفعلية."
        actions={
          gaps.length > 0 ? (
            <Button variant="outline" asChild>
              {/* رابط لا زر جافاسكربت: التنزيل من route يمر بفحص الصلاحية على الخادم */}
              <a href="/knowledge-gaps/export" download>
                <FileSpreadsheet className="size-4" aria-hidden />
                تنزيل Excel
              </a>
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="مفتوحة"
          value={openCount}
          icon={CircleHelp}
          tone={openCount > 0 ? 'warning' : 'default'}
        />
        <StatCard
          label="بانتظار اعتمادك"
          value={awaitingCount}
          icon={UserCheck}
          tone={awaitingCount > 0 ? 'warning' : 'default'}
        />
        <StatCard label="قيد المراجعة" value={inReviewCount} icon={Clock} />
        <StatCard label="معالَجة" value={resolvedCount} icon={CheckCircle2} tone="success" />
      </div>

      <GapsClient
        gaps={gaps}
        documents={documentsResult.data ?? []}
        members={(membersResult.data ?? []).map((member) => ({
          id: member.id,
          name: member.full_name,
          role: ROLE_LABELS[member.role],
          jobTitle: member.job_title,
          departmentId: member.department_id,
          departmentName: member.department_id
            ? (departmentNames.get(member.department_id) ?? null)
            : null,
        }))}
        canManage={can(profile.role, 'knowledge_gaps.manage')}
      />
    </div>
  );
}
