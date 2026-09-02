import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { cleanText, extractOrDetectScan, type ExtractionResult } from '@/lib/rag/extract';
import { OCR_PAGES_PER_CALL, countPdfPages, ocrImage, ocrPdfPages } from '@/lib/rag/ocr';
import { isAiConfigured } from '@/lib/ai/claude';
import { serverEnv } from '@/lib/env';
import { AppError } from '@/lib/errors';
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
  /**
   * القراءة الضوئية لم تكتمل بعد: قُرئ `done` من `total` صفحة والمستند
   * ما زال PROCESSING. على المستدعي أن يعاود النداء ليُكمل.
   */
  ocrPending: { done: number; total: number } | null;
}

export interface IngestOptions {
  /**
   * المهلة التي لا تبدأ بعدها دفعة قراءة ضوئية جديدة (ملّي ثانية من بدء
   * المعالجة). الطلب على الخادم محدود العمر، والدفعة الواحدة قد تستغرق
   * عشرين ثانية، فتُترك للأخيرة مساحة تكتمل فيها قبل أن يُقتل الطلب.
   */
  ocrDeadlineMs?: number;
}

const DEFAULT_OCR_DEADLINE_MS = 25_000;

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

/**
 * القراءة الضوئية لمستند ممسوح أو صورة — على دفعات تُخزَّن فور اكتمالها.
 *
 * تُرجع النصّ الكامل إن اكتملت كل الصفحات، أو `pending` إن انتهت المهلة
 * وبقيت صفحات. ولا تقرأ صفحةً مخزَّنة مرتين: الاستئناف يبدأ مما بعدها.
 */
async function ocrDocument(params: {
  admin: ReturnType<typeof createAdminClient>;
  documentId: string;
  companyId: string;
  uploadedBy: string | null;
  buffer: Buffer;
  source: { kind: 'scanned'; pageCount: number | null } | { kind: 'image'; mediaType: 'image/png' | 'image/jpeg' | 'image/webp' };
  startedAt: number;
  deadlineMs: number;
}): Promise<{ extraction: ExtractionResult; pending: null } | { extraction: null; pending: { done: number; total: number } }> {
  const { admin, documentId, companyId, buffer, startedAt, deadlineMs } = params;

  if (!isAiConfigured()) {
    throw new AppError(
      'AI_UNAVAILABLE',
      'هذا الملف ممسوح ضوئيًا ويحتاج قراءة ضوئية، وهي غير مهيّأة على هذا الخادم.',
    );
  }

  const total =
    params.source.kind === 'image'
      ? 1
      : params.source.pageCount ?? (await countPdfPages(buffer));

  const maxPages = serverEnv.ocrMaxPagesPerDocument;
  if (total > maxPages) {
    throw new AppError(
      'DOCUMENT_PROCESSING',
      `هذا الملف ممسوح ضوئيًا وفيه ${total} صفحة، والحد للملف الواحد ${maxPages} صفحة. قسّمه إلى ملفات أصغر ثم ارفعها.`,
    );
  }

  // ما قُرئ من قبل — الاستئناف يبدأ بعده
  const { data: storedRows, error: storedError } = await admin
    .from('document_ocr_pages')
    .select('page_number, text')
    .eq('document_id', documentId)
    .order('page_number');
  if (storedError) throw new Error(`تعذّر قراءة الصفحات المخزَّنة: ${storedError.message}`);

  const stored = new Map<number, string>((storedRows ?? []).map((row) => [row.page_number, row.text]));
  const remaining = Array.from({ length: total }, (_, i) => i + 1).filter((n) => !stored.has(n));

  if (remaining.length > 0) {
    const { data: quotaRows, error: quotaError } = await admin.rpc('check_ocr_quota', {
      p_company: companyId,
      p_pages: remaining.length,
    });
    if (quotaError) throw new Error(`تعذّر فحص حصة القراءة الضوئية: ${quotaError.message}`);
    const quota = quotaRows?.[0];
    if (quota && !quota.allowed) {
      throw new AppError(
        'QUOTA_EXCEEDED',
        `هذا الملف ممسوح ضوئيًا ويحتاج قراءة ${remaining.length} صفحة، وخطتك تسمح بـ ${quota.quota} صفحة شهريًا (استُهلك ${quota.used}). رقِّ الخطة أو انتظر بداية الشهر ثم أعد المحاولة.`,
      );
    }

    // page_count يُثبَّت مبكرًا كي تُعرض نسبة التقدم في القائمة
    await admin
      .from('documents')
      .update({ page_count: total, ocr_pages: stored.size, error_message: null })
      .eq('id', documentId);
  }

  while (remaining.length > 0 && Date.now() - startedAt < deadlineMs) {
    const batch = remaining.splice(0, params.source.kind === 'image' ? 1 : OCR_PAGES_PER_CALL);
    const result =
      params.source.kind === 'image'
        ? await ocrImage(buffer, params.source.mediaType)
        : await ocrPdfPages(buffer, batch);

    const rows = result.pages.map((page) => ({
      document_id: documentId,
      company_id: companyId,
      page_number: page.pageNumber,
      text: page.text,
    }));
    const { error: upsertError } = await admin
      .from('document_ocr_pages')
      .upsert(rows, { onConflict: 'document_id,page_number' });
    if (upsertError) throw new Error(`تعذّر حفظ الصفحات المقروءة: ${upsertError.message}`);

    for (const page of result.pages) stored.set(page.pageNumber, page.text);

    await recordAiUsage({
      companyId,
      userId: params.uploadedBy,
      operation: 'ocr',
      provider: 'anthropic',
      model: result.model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      costUsd: result.costUsd,
      latencyMs: result.latencyMs,
      ocrPages: result.pages.length,
    });

    await admin.from('documents').update({ ocr_pages: stored.size }).eq('id', documentId);

    logger.info('دفعة قراءة ضوئية', {
      documentId,
      pages: batch,
      done: stored.size,
      total,
      truncated: result.truncated,
      latencyMs: result.latencyMs,
    });
  }

  if (remaining.length > 0) {
    return { extraction: null, pending: { done: stored.size, total } };
  }

  const pages = Array.from(stored.entries())
    .sort(([a], [b]) => a - b)
    .map(([pageNumber, text]) => ({ pageNumber, text: cleanText(text) }))
    .filter((page) => page.text.length > 0);

  const text = cleanText(pages.map((page) => page.text).join('\n\n'));
  if (text.length < 20) {
    throw new AppError(
      'DOCUMENT_PROCESSING',
      'قُرئ الملف ضوئيًا فلم يُعثر فيه على نصّ مقروء. تأكد من وضوح الصور ثم أعد الرفع.',
    );
  }

  return { extraction: { text, pages, pageCount: total }, pending: null };
}

export async function ingestDocument(
  documentId: string,
  options: IngestOptions = {},
): Promise<IngestResult> {
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

    // 2) استخراج النص وتنظيفه — أو قراءته ضوئيًا إن كان صورًا
    const outcome = await extractOrDetectScan(buffer, document.name, document.file_type);

    let extraction: ExtractionResult;
    let ocrPageCount = 0;

    if (outcome.kind === 'text') {
      extraction = outcome.extraction;
    } else {
      const ocr = await ocrDocument({
        admin,
        documentId,
        companyId: document.company_id,
        uploadedBy: document.uploaded_by,
        buffer,
        source: outcome,
        startedAt,
        deadlineMs: options.ocrDeadlineMs ?? DEFAULT_OCR_DEADLINE_MS,
      });

      if (ocr.pending) {
        // المستند يبقى PROCESSING عمدًا، والمستدعي يعاود النداء
        return {
          documentId,
          chunkCount: 0,
          charCount: 0,
          pageCount: ocr.pending.total,
          durationMs: Date.now() - startedAt,
          ocrPending: ocr.pending,
        };
      }

      extraction = ocr.extraction;
      ocrPageCount = ocr.extraction.pageCount ?? 0;
    }

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
        ocr_pages: ocrPageCount,
        processed_at: new Date().toISOString(),
      })
      .eq('id', documentId);

    if (updateError) throw new Error(updateError.message);

    const durationMs = Date.now() - startedAt;

    logger.info('اكتملت معالجة المستند', {
      documentId,
      chunkCount: chunks.length,
      ocrPages: ocrPageCount,
      provider: getEmbeddingProvider().name,
      durationMs,
    });

    await recordAudit({
      companyId: document.company_id,
      actorId: document.uploaded_by,
      action: 'document.processed',
      entityType: 'document',
      entityId: documentId,
      metadata: { chunkCount: chunks.length, durationMs, ocrPages: ocrPageCount },
    });

    return {
      documentId,
      chunkCount: chunks.length,
      charCount: extraction.text.length,
      pageCount: extraction.pageCount,
      durationMs,
      ocrPending: null,
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
export interface IngestNowResult {
  /** رسالة الفشل الصالحة للعرض، أو null */
  failure: string | null;
  /** قراءة ضوئية لم تكتمل — يُعاود النداء لإكمالها */
  ocrPending: { done: number; total: number } | null;
}

export async function ingestDocumentNow(
  documentId: string,
  options: IngestOptions = {},
): Promise<IngestNowResult> {
  try {
    const result = await ingestDocument(documentId, options);
    return { failure: null, ocrPending: result.ocrPending };
  } catch (error) {
    return { failure: toAppError(error).displayMessage, ocrPending: null };
  }
}
