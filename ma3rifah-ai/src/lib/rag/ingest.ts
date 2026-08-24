import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { extractDocumentText } from '@/lib/rag/extract';
import { buildChunks } from '@/lib/rag/chunk';
import { embedTexts, toPgVector, getEmbeddingProvider } from '@/lib/rag/embeddings';
import { recordAudit } from '@/lib/audit';
import { recordAiUsage, estimateEmbeddingCostUsd } from '@/lib/ai/usage';
import { logger } from '@/lib/logger';
import { sanitizeTechnicalDetail, toAppError } from '@/lib/errors';

/**
 * خط معالجة المستند:
 *   تنزيل الملف → استخراج النص → تنظيف → تقطيع → تضمين → تخزين → READY
 *
 * يُشغَّل بعد أن يكون المستند مسجّلًا بحالة PROCESSING. أي فشل ينقل
 * المستند إلى FAILED مع رسالة عربية صالحة للعرض، ولا يترك المستخدم
 * أمام مستند عالق في PROCESSING إلى الأبد.
 */
export interface IngestResult {
  documentId: string;
  chunkCount: number;
  charCount: number;
  pageCount: number | null;
  durationMs: number;
}

/**
 * ما يُعرض للمستخدم حين يفشل مستند.
 *
 * التفصيل التقني كان يُعرض كما هو، فظهر لمالكة المنصّة سطرٌ إنجليزيّ
 * من ردّ مزوّد خارجي:
 *
 *   Voyage 429: {"detail":"You have not yet added your payment method…"}
 *
 * وثلاثة أعطال فيه:
 *
 *   ١) **إنجليزيّ في واجهة عربية**، ومَن يقرؤه لا يعرف ما يفعل.
 *   ٢) **يكشف اسم المزوّد وبنيته** لكل مستخدم في كل شركة — وهي معلومة
 *      لا تخصّهم، وتفيد من يريد تقليد المنصّة أو مهاجمة سلسلتها.
 *   ٣) و**يخالف القاعدة الموضوعة**: لا تفاصيل تقنية للمستخدم.
 *
 * فصار المعروض رسالةً عربية واحدة تقول ما يُفعَل. والتفصيل يبقى في
 * السجلّات لمن يشخّص، ويظهر في لوحة **مالك المنصّة وحده** — فهو الذي
 * يستطيع إصلاحه، ولا يكشف له إلا ما يملكه أصلًا.
 */
function buildFailureMessage(appError: { message: string; detail?: string }): string {
  return appError.message;
}

export async function ingestDocument(documentId: string): Promise<IngestResult> {
  const admin = createAdminClient();
  const startedAt = Date.now();

  const { data: document, error: documentError } = await admin
    .from('documents')
    .select('*')
    .eq('id', documentId)
    .single();

  if (documentError || !document) {
    throw toAppError(documentError ?? new Error(`المستند ${documentId} غير موجود`));
  }

  try {
    if (!document.storage_path) {
      throw new Error('المستند لا يحتوي على مسار تخزين');
    }

    // 1) تنزيل الملف من التخزين
    const { data: blob, error: downloadError } = await admin.storage
      .from('documents')
      .download(document.storage_path);

    if (downloadError || !blob) {
      throw new Error(`تعذّر تنزيل الملف: ${downloadError?.message ?? 'ملف غير موجود'}`);
    }

    const buffer = Buffer.from(await blob.arrayBuffer());

    // 2) استخراج النص وتنظيفه
    const extraction = await extractDocumentText(buffer, document.name, document.file_type);

    // 3) التقطيع
    const chunks = buildChunks(extraction);
    if (chunks.length === 0) {
      throw new Error('لم يُنتج المستند أي مقاطع قابلة للفهرسة');
    }

    // 4) التضمين
    const embeddings = await embedTexts(
      chunks.map((chunk) => chunk.content),
      'document',
    );

    if (embeddings.length !== chunks.length) {
      throw new Error('عدد التضمينات لا يطابق عدد المقاطع');
    }

    // تُحتسب تكلفة التضمين على الشركة فور حدوثها. هذه أكبر تكلفة
    // مفردة في النظام — رفع أرشيف كامل يستهلك في دقيقة ما تستهلكه مئات
    // الأسئلة — وكانت لا تُسجَّل إطلاقًا.
    const provider = getEmbeddingProvider();
    const embeddedTokens = chunks.reduce((sum, chunk) => sum + chunk.tokenCount, 0);

    await recordAiUsage({
      companyId: document.company_id,
      userId: document.uploaded_by,
      operation: 'embedding',
      provider: provider.name,
      model: provider.model,
      inputTokens: embeddedTokens,
      costUsd: estimateEmbeddingCostUsd(provider.name, provider.model, embeddedTokens),
    });

    // 5) التخزين — نحذف المقاطع القديمة أولًا لدعم إعادة المعالجة
    await admin.from('document_chunks').delete().eq('document_id', documentId);

    const BATCH_SIZE = 100;
    for (let offset = 0; offset < chunks.length; offset += BATCH_SIZE) {
      const batch = chunks.slice(offset, offset + BATCH_SIZE).map((chunk, position) => ({
        company_id: document.company_id,
        document_id: documentId,
        chunk_index: chunk.index,
        content: chunk.content,
        token_count: chunk.tokenCount,
        page_number: chunk.pageNumber,
        section_title: chunk.sectionTitle,
        embedding: toPgVector(embeddings[offset + position]),
      }));

      const { error: insertError } = await admin.from('document_chunks').insert(batch);
      if (insertError) {
        throw new Error(`تعذّر حفظ المقاطع: ${insertError.message}`);
      }
    }

    // 6) تحديث حالة المستند
    const { error: updateError } = await admin
      .from('documents')
      .update({
        status: 'READY',
        error_message: null,
        chunk_count: chunks.length,
        char_count: extraction.text.length,
        page_count: extraction.pageCount,
        processed_at: new Date().toISOString(),
      })
      .eq('id', documentId);

    if (updateError) throw new Error(updateError.message);

    const durationMs = Date.now() - startedAt;

    logger.info('اكتملت معالجة المستند', {
      documentId,
      chunkCount: chunks.length,
      provider: getEmbeddingProvider().name,
      durationMs,
    });

    await recordAudit({
      companyId: document.company_id,
      actorId: document.uploaded_by,
      action: 'document.processed',
      entityType: 'document',
      entityId: documentId,
      metadata: { chunkCount: chunks.length, durationMs },
    });

    return {
      documentId,
      chunkCount: chunks.length,
      charCount: extraction.text.length,
      pageCount: extraction.pageCount,
      durationMs,
    };
  } catch (error) {
    const appError = toAppError(error);

    logger.error('فشلت معالجة المستند', {
      documentId,
      code: appError.code,
      reason: sanitizeTechnicalDetail(appError.detail ?? appError.message),
    });

    await admin
      .from('documents')
      .update({
        status: 'FAILED',
        error_message: buildFailureMessage(appError),
      })
      .eq('id', documentId);

    await recordAudit({
      companyId: document.company_id,
      actorId: document.uploaded_by,
      action: 'document.processing_failed',
      entityType: 'document',
      entityId: documentId,
      metadata: { code: appError.code },
    });

    throw appError;
  }
}

/**
 * تشغيل المعالجة ضمن عمر الطلب نفسه.
 *
 * لا تُطلق المعالجة في الخلفية على منصات بلا خوادم دائمة: تُجمَّد الدالة
 * فور إرسال الرد، فيُقتل العمل في منتصفه ويبقى المستند «جاري التحليل»
 * إلى الأبد — بلا خطأ ولا تعافٍ. الانتظار داخل الطلب يجعل الفشل ظاهرًا
 * وقابلًا للإصلاح.
 *
 * يُرجع رسالة الفشل إن فشلت المعالجة، وnull إن نجحت. الرفع نفسه ناجح
 * في الحالتين — الملف مخزَّن، وحالة المستند تحمل النتيجة.
 */
export async function ingestDocumentNow(documentId: string): Promise<string | null> {
  try {
    await ingestDocument(documentId);
    return null;
  } catch (error) {
    return toAppError(error).displayMessage;
  }
}
