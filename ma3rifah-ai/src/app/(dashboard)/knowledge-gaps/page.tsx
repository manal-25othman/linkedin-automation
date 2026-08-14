import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { can } from '@/lib/auth/rbac';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { GapsClient, type GapRowData } from './gaps-client';
import { CircleHelp, CheckCircle2, Clock } from 'lucide-react';

export const metadata: Metadata = { title: 'فجوات المعرفة' };
export const dynamic = 'force-dynamic';

export default async function KnowledgeGapsPage() {
  const { profile } = await requirePermission('knowledge_gaps.view');
  const supabase = await createClient();

  const [gapsResult, departmentsResult, documentsResult] = await Promise.all([
    supabase
      .from('knowledge_gaps')
      .select(
        'id, question, times_asked, department_id, status, last_asked_at, resolution_note, linked_document_id, answer_text',
      )
      .order('status', { ascending: true })
      .order('times_asked', { ascending: false })
      .limit(200),
    supabase.from('departments').select('id, name'),
    supabase.from('documents').select('id, name').eq('status', 'READY').order('name'),
  ]);

  const departmentNames = new Map(
    (departmentsResult.data ?? []).map((department) => [department.id, department.name]),
  );

  const gaps: GapRowData[] = (gapsResult.data ?? []).map((gap) => ({
    id: gap.id,
    question: gap.question,
    timesAsked: gap.times_asked,
    departmentName: gap.department_id ? departmentNames.get(gap.department_id) ?? null : null,
    status: gap.status,
    answerText: gap.answer_text,
    lastAskedAt: gap.last_asked_at,
    resolutionNote: gap.resolution_note,
    linkedDocumentId: gap.linked_document_id,
  }));

  const openCount = gaps.filter((gap) => gap.status === 'OPEN').length;
  const inReviewCount = gaps.filter((gap) => gap.status === 'IN_REVIEW').length;
  const resolvedCount = gaps.filter((gap) => gap.status === 'RESOLVED').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="فجوات المعرفة"
        description="أسئلة طرحها موظفوك ولم تجد قاعدة المعرفة إجابة لها. الأسئلة المتشابهة مجمّعة معًا مع عدّاد تكرار — هذه قائمة التوثيق مرتّبة حسب الحاجة الفعلية."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="مفتوحة"
          value={openCount}
          icon={CircleHelp}
          tone={openCount > 0 ? 'warning' : 'default'}
        />
        <StatCard label="قيد المراجعة" value={inReviewCount} icon={Clock} />
        <StatCard label="معالَجة" value={resolvedCount} icon={CheckCircle2} tone="success" />
      </div>

      <GapsClient
        gaps={gaps}
        documents={documentsResult.data ?? []}
        canManage={can(profile.role, 'knowledge_gaps.manage')}
      />
    </div>
  );
}
