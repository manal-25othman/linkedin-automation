import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { buildChunks } from '@/lib/rag/chunk';
import { embedTexts, toPgVector } from '@/lib/rag/embeddings';
import { cleanText } from '@/lib/rag/extract';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { truncate } from '@/lib/utils';

/**
 * نشر السياسة المعتمدة في قاعدة المعرفة.
 *
 * تُنسَخ مستندًا حقيقيًّا (`source_kind = 'AUTHORED_POLICY'`) لا نوعَ
 * بيانات جديدًا — فتسري عليها كل ضوابط المستندات المثبتة: عزل الشركات،
 * وصلاحيات الأقسام والأدوار، وتصفية الاسترجاع — بلا تعديل حرف في
 * دالّة البحث ولا سياسة جديدة قد تُنسى.
 *
 * والمسوّدة لا تُرقَّى، بل يُنسخ نصّها: يبقى سجلّ «ما اعتُمد ومتى ومن
 * كتبه» في جدول المسوّدات كاملًا، ويبقى المستند المنشور قابلًا
 * للاستبدال عند اعتماد نسخة أحدث بلا أن يضيع ما قبله.
 */

const MIN_BODY_LENGTH = 40;
const MAX_BODY_LENGTH = 20_000;

export interface PublishPolicyInput {
  companyId: string;
  draftId: string;
  title: string;
  body: string;
  approverId: string;
}

/** يُعيد معرّف المستند المنشور */
export async function publishPolicyDraft(
  input: PublishPolicyInput,
): Promise<string> {
  const body = cleanText(input.body);

  if (body.length < MIN_BODY_LENGTH) {
    throw new AppError('VALIDATION', 'نصّ السياسة قصير جدًا.');
  }
  if (body.length > MAX_BODY_LENGTH) {
    throw new AppError(
      'VALIDATION',
      'نصّ السياسة طويل جدًا — قسّمه إلى سياستين أو ارفعه مستندًا.',
    );
  }

  const admin = createAdminClient();

  // حاجز ضدّ الخلط بين الشركات: مفتاح الخدمة يتجاوز RLS، فيُتحقق يدويًا
  const { data: draft } = await admin
    .from('policy_drafts')
    .select('id, company_id, document_id')
    .eq('id', input.draftId)
    .maybeSingle();

  if (!draft || draft.company_id !== input.companyId) {
    throw new AppError('NOT_FOUND', 'المسوّدة غير موجودة.');
  }

  const documentName = `سياسة معتمدة: ${truncate(input.title.trim(), 90)}`;
  let documentId = draft.document_id;

  if (documentId) {
    const { error } = await admin
      .from('documents')
      .update({ name: documentName, status: 'PROCESSING', error_message: null })
      .eq('id', documentId)
      .eq('company_id', input.companyId);

    if (error) throw new AppError('INTERNAL', 'تعذّر تحديث السياسة المنشورة.');
  } else {
    const { data: created, error } = await admin
      .from('documents')
      .insert({
        company_id: input.companyId,
        name: documentName,
        description: 'سياسة كتبتها إدارة الشركة في استوديو السياسات واعتمدتها.',
        file_type: 'text/markdown',
        file_size_bytes: Buffer.byteLength(body, 'utf8'),
        status: 'PROCESSING',
        source_kind: 'AUTHORED_POLICY',
        // متاحة لكل الشركة: السياسة تُكتب ليعمل بها الموظفون، وتقييدها
        // يعيد إنتاج المشكلة التي كُتبت لحلّها.
        visibility: 'COMPANY',
        uploaded_by: input.approverId,
      })
      .select('id')
      .single();

    if (error || !created) {
      logger.error('تعذّر إنشاء مستند السياسة', { reason: error?.message });
      throw new AppError('INTERNAL', 'تعذّر نشر السياسة.');
    }
    documentId = created.id;
  }

  try {
    const chunks = buildChunks({ text: body, pages: [], pageCount: null });
    if (chunks.length === 0) throw new Error('لم تُنتج السياسة أي مقاطع');

    const embeddings = await embedTexts(
      chunks.map((chunk) => chunk.content),
      'document',
    );
    if (embeddings.length !== chunks.length) {
      throw new Error('عدد التضمينات لا يطابق عدد المقاطع');
    }

    // تُحذف المقاطع القديمة أولًا — اعتماد نسخة أحدث يجب ألّا يترك
    // نسختين فيجيب البحث بالسياسة الملغاة.
    await admin.from('document_chunks').delete().eq('document_id', documentId);

    const { error: insertError } = await admin.from('document_chunks').insert(
      chunks.map((chunk, position) => ({
        company_id: input.companyId,
        document_id: documentId,
        chunk_index: chunk.index,
        content: chunk.content,
        token_count: chunk.tokenCount,
        page_number: null,
        section_title: 'سياسة معتمدة',
        embedding: toPgVector(embeddings[position]),
      })),
    );

    if (insertError) throw new Error(insertError.message);

    await admin
      .from('documents')
      .update({
        status: 'READY',
        chunk_count: chunks.length,
        char_count: body.length,
        processed_at: new Date().toISOString(),
      })
      .eq('id', documentId);

    await admin
      .from('policy_drafts')
      .update({ document_id: documentId })
      .eq('id', input.draftId);

    logger.info('نُشرت سياسة معتمدة', { chunkCount: chunks.length });
    return documentId;
  } catch (cause) {
    await admin
      .from('documents')
      .update({ status: 'FAILED', error_message: 'تعذّرت فهرسة السياسة.' })
      .eq('id', documentId);

    logger.error('تعذّرت فهرسة السياسة', {
      reason: cause instanceof Error ? cause.message : String(cause),
    });
    throw new AppError('INTERNAL', 'تعذّرت فهرسة السياسة بعد اعتمادها.');
  }
}
