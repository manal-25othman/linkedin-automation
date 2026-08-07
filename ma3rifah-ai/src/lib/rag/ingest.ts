import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { extractDocumentText } from '@/lib/rag/extract';
import { buildChunks } from '@/lib/rag/chunk';
import { embedTexts, toPgVector, getEmbeddingProvider } from '@/lib/rag/embeddings';
import { recordAudit } from '@/lib/audit';
import { logger } from '@/lib/logger';
import { toAppError } from '@/lib/errors';

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
      reason: appError.detail ?? appError.message,
    });

    await admin
      .from('documents')
      .update({
        status: 'FAILED',
        error_message: appError.message,
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
 * تشغيل المعالجة دون انتظار النتيجة.
 * تُستدعى بعد الرفع لتعود الواجهة فورًا وتعرض حالة «جاري التحليل».
 */
export function ingestDocumentInBackground(documentId: string): void {
  void ingestDocument(documentId).catch(() => {
    // الخطأ مُسجَّل ومُخزَّن في حالة المستند بالفعل
  });
}
