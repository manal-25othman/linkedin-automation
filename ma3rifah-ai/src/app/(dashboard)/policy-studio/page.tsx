import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/shared/page-header';
import { PolicyStudioClient, type PolicyDraftView } from './policy-studio-client';

export const metadata: Metadata = { title: 'استوديو السياسات' };
export const dynamic = 'force-dynamic';

/**
 * استوديو السياسات — للشركة التي تحتاج سياسةً مكتوبة لا تملكها.
 *
 * تُقرأ بجلسة المستخدم، فسياسة `policy_drafts_all` هي التي تحصر ما
 * يُرى: مسوّدات شركته، ولمديرها وحده. والصلاحية هنا حارس ثانٍ يمنع
 * الوصول إلى الصفحة أصلًا، لا بديلٌ عن حارس القاعدة.
 */
export default async function PolicyStudioPage() {
  await requirePermission('documents.manage');
  const supabase = await createClient();

  const { data } = await supabase
    .from('policy_drafts')
    .select(
      'id, title, topic, clarifications, body, citations, status, version, document_id, approved_at, created_at, updated_at',
    )
    .neq('status', 'DISCARDED')
    .order('updated_at', { ascending: false })
    .limit(50);

  const drafts: PolicyDraftView[] = (data ?? []).map((draft) => ({
    id: draft.id,
    title: draft.title,
    topic: draft.topic,
    clarifications: draft.clarifications ?? [],
    body: draft.body,
    citations: draft.citations ?? [],
    status: draft.status,
    version: draft.version,
    isPublished: Boolean(draft.document_id),
    approvedAt: draft.approved_at,
    updatedAt: draft.updated_at,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="استوديو السياسات"
        description="اكتب سياسة من وثائق شركتك والمراجع النظامية الرسمية، ثم حرّرها واعتمدها فتدخل قاعدة المعرفة."
      />
      <PolicyStudioClient drafts={drafts} />
    </div>
  );
}
