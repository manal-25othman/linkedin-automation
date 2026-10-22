import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { logger } from '@/lib/logger';

/**
 * اعتماد إصدارٍ أنشأته المنصّة بعد قرار إنسان.
 *
 * ولا تفعيل تلقائي في المنتج بعد `0042` — فلماذا هذا؟
 *
 * لأن **الاعتماد وقع فعلًا** في هذين المسارين قبل أن يُنشأ المستند:
 *
 *   • الإجابة المعتمدة: مدير الشركة كتب الجواب واعتمده لسدّ فجوة.
 *   • استوديو السياسات: المدير حرّر المسوّدة وضغط «اعتماد ونشر».
 *
 * فالمستند هنا **نتيجةُ اعتماد لا طلبُ اعتماد**، ومطالبة المدير باعتماده
 * مرةً ثانية من صفحة الإصدارات ليست حرصًا بل خطوةٌ لا معنى لها: سيعتمد
 * ما اعتمده قبل ثانية. والأسوأ أنها تتركه يظنّ أن سياسته منشورة وهي لا
 * تُجيب.
 *
 * والفرق عن الرفع العادي واضح: الملف المرفوع لم يقرأه أحد بعد.
 *
 * ويُنادى بمفتاح الخدمة (الفهرسة تجري خارج جلسة المستخدم)، فيُشترط
 * تطابق الشركة صراحةً في كل جملة — RLS لا تحرس مفتاح الخدمة.
 */
export async function approveAuthoredVersion(params: {
  admin: SupabaseClient<Database>;
  companyId: string;
  documentId: string;
  approverId: string;
  note: string;
}): Promise<void> {
  const { admin, companyId, documentId, approverId, note } = params;

  const { data: row, error: readError } = await admin
    .from('documents')
    .select('family_id, status')
    .eq('id', documentId)
    .eq('company_id', companyId)
    .maybeSingle();

  if (readError || !row) {
    logger.error('تعذّر قراءة الإصدار لاعتماده', { reason: readError?.message });
    return;
  }

  // الفهرسة شرط الاعتماد — وهو الشرط نفسه الذي تفرضه الدالّة في
  // القاعدة. ولا يُعتمد مستندٌ لا مقاطع له.
  if (row.status !== 'READY') {
    logger.warn('لم يُعتمد الإصدار: لم تكتمل فهرستها');
    return;
  }

  const today = new Date().toISOString().slice(0, 10);

  const { data: family } = await admin
    .from('document_families')
    .select('effective_document_id')
    .eq('id', row.family_id)
    .eq('company_id', companyId)
    .maybeSingle();

  const previous = family?.effective_document_id ?? null;

  const { error: approveError } = await admin
    .from('documents')
    .update({
      approval_status: 'APPROVED',
      approved_by: approverId,
      approved_at: new Date().toISOString(),
      effective_from: today,
      ...(previous && previous !== documentId
        ? { supersedes_document_id: previous }
        : {}),
    })
    .eq('id', documentId)
    .eq('company_id', companyId);

  if (approveError) {
    logger.error('تعذّر اعتماد الإصدار المُنشأ', { reason: approveError.message });
    return;
  }

  if (previous && previous !== documentId) {
    await admin
      .from('documents')
      .update({ approval_status: 'SUPERSEDED' })
      .eq('id', previous)
      .eq('company_id', companyId);
  }

  const { error: pointerError } = await admin
    .from('document_families')
    .update({ effective_document_id: documentId })
    .eq('id', row.family_id)
    .eq('company_id', companyId);

  if (pointerError) {
    // المستند معتمد ولا يُجيب — وهي الحالة التي لا يجوز أن تمرّ صامتة
    logger.error('اعتُمد الإصدار ولم يُحرَّك مؤشّر العائلة', {
      reason: pointerError.message,
    });
    return;
  }

  await admin.from('document_version_events').insert({
    company_id: companyId,
    family_id: row.family_id,
    document_id: documentId,
    event: 'APPROVED',
    actor_id: approverId,
    note,
  });
}
