import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { buildChunks } from '@/lib/rag/chunk';
import { embedTexts, toPgVector } from '@/lib/rag/embeddings';
import { cleanText } from '@/lib/rag/extract';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { truncate } from '@/lib/utils';

/**
 * الإجابة المعتمدة: جواب يكتبه مدير الشركة لسدّ فجوة معرفية، فيدخل
 * قاعدة المعرفة **مستندًا حقيقيًا** يجده البحث الدلالي كأي مستند.
 *
 * لماذا مستند لا نوع بيانات جديد: تسري عليه عندئذٍ كل ضوابط المستندات
 * المثبتة — عزل الشركات، صلاحيات الأقسام والأدوار، وتصفية RAG — بلا
 * تعديل حرف في دالة البحث ولا سياسة جديدة قد تُنسى. أضمن طريق لعدم
 * كسر العزل هو ألّا نفتح إليه مسارًا ثانيًا.
 *
 * ويُحفظ السؤال مع الجواب في نص المقطع عمدًا: البحث يقارن متجه سؤال
 * الموظف بمتجه المقطع، وصيغة السؤال أقرب إلى صيغة سؤال زميله من صيغة
 * الجواب المصاغ إداريًا.
 */

const MIN_ANSWER_LENGTH = 20;
const MAX_ANSWER_LENGTH = 8000;

export interface CuratedAnswerInput {
  companyId: string;
  gapId: string;
  question: string;
  answer: string;
  authorId: string;
  /** مستند موجود يُستشهد به إلى جانب الجواب المكتوب */
  categoryId?: string | null;
}

/**
 * إنشاء (أو تحديث) مستند الإجابة المعتمدة وفهرسته.
 * يُعيد معرّف المستند.
 */
export async function upsertCuratedAnswer(
  input: CuratedAnswerInput,
): Promise<string> {
  const answer = cleanText(input.answer);

  if (answer.length < MIN_ANSWER_LENGTH) {
    throw new AppError(
      'VALIDATION',
      `الإجابة قصيرة جدًا. اكتب ${MIN_ANSWER_LENGTH} حرفًا على الأقل ليجدها البحث.`,
    );
  }
  if (answer.length > MAX_ANSWER_LENGTH) {
    throw new AppError(
      'VALIDATION',
      `الإجابة طويلة جدًا. الحد الأقصى ${MAX_ANSWER_LENGTH} حرف — إن طالت فارفعها مستندًا.`,
    );
  }

  const admin = createAdminClient();
  const question = truncate(input.question.trim(), 300);

  // --- المستند ---
  const { data: gap } = await admin
    .from('knowledge_gaps')
    .select('answer_document_id, company_id')
    .eq('id', input.gapId)
    .maybeSingle();

  // حاجز ضد الخلط بين الشركات: مفتاح الخدمة يتجاوز RLS، فيُتحقق يدويًا
  if (!gap || gap.company_id !== input.companyId) {
    throw new AppError('NOT_FOUND', 'الفجوة غير موجودة.');
  }

  const documentName = `إجابة معتمدة: ${truncate(question, 90)}`;
  let documentId = gap.answer_document_id;

  if (documentId) {
    const { error } = await admin
      .from('documents')
      .update({
        name: documentName,
        category_id: input.categoryId || null,
        status: 'PROCESSING',
        error_message: null,
      })
      .eq('id', documentId)
      .eq('company_id', input.companyId);

    if (error) throw new AppError('INTERNAL', 'تعذّر تحديث الإجابة المعتمدة.');
  } else {
    const { data: created, error } = await admin
      .from('documents')
      .insert({
        company_id: input.companyId,
        category_id: input.categoryId || null,
        name: documentName,
        description: 'إجابة كتبها مدير الشركة لسدّ فجوة معرفية.',
        file_type: 'text/markdown',
        file_size_bytes: Buffer.byteLength(answer, 'utf8'),
        status: 'PROCESSING',
        source_kind: 'CURATED_ANSWER',
        // متاحة لكل الشركة: الفجوة نشأت من سؤال موظف، وتقييدها يعيد
        // إنتاج المشكلة نفسها لموظف آخر يسأل السؤال ذاته.
        visibility: 'COMPANY',
        uploaded_by: input.authorId,
      })
      .select('id')
      .single();

    if (error || !created) {
      logger.error('تعذّر إنشاء مستند الإجابة المعتمدة', { reason: error?.message });
      throw new AppError('INTERNAL', 'تعذّر حفظ الإجابة المعتمدة.');
    }
    documentId = created.id;
  }

  // --- الفهرسة ---
  try {
    const body = `السؤال: ${question}\n\nالإجابة المعتمدة من إدارة الشركة:\n${answer}`;
    const chunks = buildChunks({ text: body, pages: [], pageCount: null });

    if (chunks.length === 0) {
      throw new Error('لم تُنتج الإجابة أي مقاطع');
    }

    const embeddings = await embedTexts(
      chunks.map((chunk) => chunk.content),
      'document',
    );

    if (embeddings.length !== chunks.length) {
      throw new Error('عدد التضمينات لا يطابق عدد المقاطع');
    }

    // تُحذف المقاطع القديمة أولًا — تحرير الإجابة يجب ألّا يترك نسختين
    // فيسترجع البحث الجواب القديم بعد تصحيحه.
    await admin.from('document_chunks').delete().eq('document_id', documentId);

    const { error: insertError } = await admin.from('document_chunks').insert(
      chunks.map((chunk, position) => ({
        company_id: input.companyId,
        document_id: documentId,
        chunk_index: chunk.index,
        content: chunk.content,
        token_count: chunk.tokenCount,
        page_number: null,
        section_title: 'إجابة معتمدة',
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

    logger.info('فُهرست إجابة معتمدة', { chunkCount: chunks.length });
  } catch (error) {
    await admin
      .from('documents')
      .update({
        status: 'FAILED',
        error_message: 'تعذّرت فهرسة الإجابة المعتمدة.',
      })
      .eq('id', documentId);

    logger.error('تعذّرت فهرسة الإجابة المعتمدة', {
      reason: error instanceof Error ? error.message : String(error),
    });
    throw new AppError(
      'INTERNAL',
      'حُفظت الإجابة لكن تعذّرت فهرستها، فلن يجدها البحث بعد. حاول الحفظ مرة أخرى.',
    );
  }

  return documentId;
}

/** حذف مستند الإجابة المعتمدة حين تُعاد الفجوة إلى «مفتوحة» */
export async function removeCuratedAnswer(
  companyId: string,
  documentId: string,
): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin
      .from('documents')
      .delete()
      .eq('id', documentId)
      .eq('company_id', companyId)
      .eq('source_kind', 'CURATED_ANSWER');
  } catch (error) {
    logger.warn('تعذّر حذف الإجابة المعتمدة', {
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}
