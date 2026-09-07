import type { Metadata } from 'next';
import { requireCompanySession } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/states';
import { Inbox } from 'lucide-react';
import { AssignedClient, type AssignedGap } from './assigned-client';

export const metadata: Metadata = { title: 'أسئلة موجَّهة إليك' };
export const dynamic = 'force-dynamic';

/**
 * صفحة الخبير.
 *
 * تُقرأ بجلسة المستخدم لا بعميل الإدارة، فسياسة `knowledge_gaps_select`
 * هي التي تحصر ما يُرى: صفوف شركته التي أُسنِدت إليه هو. والمرشِّح
 * أدناه احتياط ثانٍ لا حارس أول — الحارس في القاعدة.
 *
 * ولا تتطلب صلاحية: الحقّ هنا مصدره الإسناد لا الدور، فقد يكون الخبير
 * موظفًا لا يرى شاشة الفجوات أصلًا.
 */
export default async function AssignedGapsPage() {
  const { profile } = await requireCompanySession();
  const supabase = await createClient();

  const { data } = await supabase
    .from('knowledge_gaps')
    .select('id, question, times_asked, status, last_asked_at, expert_answer, expert_answered_at, answer_text')
    .eq('assigned_to', profile.id)
    .order('expert_answered_at', { ascending: true, nullsFirst: true })
    .order('times_asked', { ascending: false })
    .limit(100);

  const gaps: AssignedGap[] = (data ?? []).map((gap) => ({
    id: gap.id,
    question: gap.question,
    timesAsked: gap.times_asked,
    lastAskedAt: gap.last_asked_at,
    expertAnswer: gap.expert_answer,
    expertAnsweredAt: gap.expert_answered_at,
    isPublished: Boolean(gap.answer_text),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="أسئلة موجَّهة إليك"
        description="أسئلة طرحها زملاؤك ولم تجد قاعدة المعرفة إجابة لها، ووجّهها مدير الشركة إليك لأنك تعرف جوابها. ما تكتبه هنا لا يظهر لأحد قبل أن يعتمده المدير."
      />

      {gaps.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="لا يوجد سؤال موجَّه إليك"
          description="حين يوجّه مدير الشركة سؤالًا إليك سيظهر هنا، ويصلك تنبيه به."
        />
      ) : (
        <AssignedClient gaps={gaps} />
      )}
    </div>
  );
}
