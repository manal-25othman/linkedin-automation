import 'server-only';

import { createHash } from 'node:crypto';

import { createAdminClient } from '@/lib/supabase/admin';
import { buildChunks } from '@/lib/rag/chunk';
import { embedTexts, embedQuery, toPgVector } from '@/lib/rag/embeddings';
import { cleanText, extractOrDetectScan, assessExtraction } from '@/lib/rag/extract';
import { countPdfPages, ocrPdfPages } from '@/lib/rag/ocr';
import { serverEnv } from '@/lib/env';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';

/**
 * المكتبة المرجعية الرسمية: نصوص نظامية عامة ترفعها مالكة المنصّة مرة
 * واحدة، وتقرؤها كل الشركات قراءةً فقط.
 *
 * وهي منفصلة عن مستندات الشركات في القاعدة (`0039`) لا وسمًا عليها:
 * المساعد العادي لا يعرف هذه الجداول أصلًا، فلا يمكن أن يخلط نظام
 * العمل بلائحة شركةٍ ولو أخطأ أحدٌ في موجّه. ولا يقرأ منها إلا استوديو
 * السياسات، وبنداء صريح.
 *
 * ولا تُبنى هنا نصوص نظامية ولا تُختصر: يُخزَّن ما رُفع كما رُفع. النصّ
 * النظامي المُعاد صياغته يصير سياسةَ شركةٍ معتمدة، والخطأ فيه ليس خطأ
 * منتج بل خطأ يُعمل به.
 */

/** دلو ملفات المكتبة — منفصل عن دلو مستندات الشركات عمدًا */
export const REFERENCE_BUCKET = 'reference-library';

const MIN_BODY_LENGTH = 200;
const MAX_BODY_LENGTH = 400_000;

export interface ReferenceDocumentInput {
  name: string;
  /** الجهة المُصدِرة — تظهر في كل استشهاد */
  authority: string;
  referenceCode?: string | null;
  sourceUrl?: string | null;
  description?: string | null;
  body: string;
  uploadedBy: string;
}

export interface ReferenceMatch {
  chunkId: string;
  documentId: string;
  documentName: string;
  authority: string;
  referenceCode: string | null;
  /** رابط المصدر الرسمي — يصل المدير أسفل المسوّدة ليتحقق بنفسه */
  sourceUrl: string | null;
  /** متى نُسخ النصّ: النظام يتغيّر والاستشهاد لا يُحدِّث نفسه */
  textCopiedAt: string | null;
  content: string;
  pageNumber: number | null;
  sectionTitle: string | null;
  similarity: number;
}

/**
 * رفع وثيقة مرجعية وفهرستها. يُعيد معرّف الوثيقة.
 *
 * تُنشأ بحالة `PROCESSING` ولا تصير `READY` إلا بعد نجاح الفهرسة —
 * وسياسة القراءة تشترط `READY`. فالوثيقة نصف المفهرسة لا تُقرأ أصلًا،
 * والاستشهاد بنصٍّ ناقص أسوأ من غياب الاستشهاد.
 */
/**
 * الفهرسة المشتركة بين المسارين (الملف واللصق).
 *
 * تُنشأ الوثيقة بحالة `PROCESSING` ولا تصير `READY` إلا بعد نجاح
 * الفهرسة — وسياسة القراءة تشترط `READY`. فالوثيقة نصف المفهرسة لا
 * تُقرأ أصلًا، والاستشهاد بنصٍّ ناقص أسوأ من غياب الاستشهاد.
 */
async function indexReferenceBody(params: {
  admin: ReturnType<typeof createAdminClient>;
  meta: {
    name: string;
    authority: string;
    referenceCode: string | null;
    sourceUrl: string | null;
    description: string | null;
    uploadedBy: string;
  };
  body: string;
  fileType: string;
  storagePath?: string | null;
  checksum?: string | null;
  pageCount?: number | null;
  ocrPages?: number;
}): Promise<string> {
  const { admin, meta, body } = params;

  const { data: created, error } = await admin
    .from('platform_reference_documents')
    .insert({
      name: meta.name.trim(),
      authority: meta.authority.trim(),
      reference_code: meta.referenceCode?.trim() || null,
      source_url: meta.sourceUrl?.trim() || null,
      description: meta.description?.trim() || null,
      file_type: params.fileType,
      file_size_bytes: Buffer.byteLength(body, 'utf8'),
      // النصّ يُحفظ ليُعاد منه البناء عند الفشل ولتُعرض المعاينة —
      // والوثيقة الفاشلة بلا مقاطع فلا تُبنى من لا شيء.
      source_text: body,
      storage_path: params.storagePath ?? null,
      checksum: params.checksum ?? null,
      page_count: params.pageCount ?? null,
      ocr_pages: params.ocrPages ?? 0,
      status: 'PROCESSING',
      uploaded_by: meta.uploadedBy,
    })
    .select('id')
    .single();

  if (error || !created) {
    logger.error('تعذّر إنشاء وثيقة مرجعية', { reason: error?.message });
    throw new AppError('INTERNAL', 'تعذّر حفظ الوثيقة المرجعية.');
  }

  const documentId = created.id;

  try {
    const chunks = buildChunks({ text: body, pages: [], pageCount: null });
    if (chunks.length === 0) throw new Error('لم يُنتج النصّ أي مقاطع');

    const embeddings = await embedTexts(
      chunks.map((chunk) => chunk.content),
      'document',
    );
    if (embeddings.length !== chunks.length) {
      throw new Error('عدد التضمينات لا يطابق عدد المقاطع');
    }

    const { error: insertError } = await admin
      .from('platform_reference_chunks')
      .insert(
        chunks.map((chunk, position) => ({
          document_id: documentId,
          chunk_index: chunk.index,
          content: chunk.content,
          token_count: chunk.tokenCount,
          page_number: chunk.pageNumber,
          section_title: meta.referenceCode?.trim() || null,
          embedding: toPgVector(embeddings[position]),
        })),
      );

    if (insertError) throw new Error(insertError.message);

    await admin
      .from('platform_reference_documents')
      .update({
        status: 'READY',
        chunk_count: chunks.length,
        updated_at: new Date().toISOString(),
      })
      .eq('id', documentId);

    logger.info('فُهرست وثيقة مرجعية', { chunkCount: chunks.length });
    return documentId;
  } catch (cause) {
    await admin
      .from('platform_reference_documents')
      .update({
        status: 'FAILED',
        error_message: 'تعذّرت فهرسة الوثيقة المرجعية.',
      })
      .eq('id', documentId);

    logger.error('تعذّرت فهرسة وثيقة مرجعية', {
      reason: cause instanceof Error ? cause.message : String(cause),
    });
    throw new AppError('INTERNAL', 'تعذّرت فهرسة الوثيقة المرجعية.');
  }
}

/**
 * رفع وثيقة مرجعية بنصّ ملصوق. يبقى للمقاطع القصيرة — مادة واحدة
 * مثلًا — حيث رفع ملف كامل مبالغة.
 */
export async function ingestReferenceDocument(
  input: ReferenceDocumentInput,
): Promise<string> {
  const body = cleanText(input.body);

  if (body.length < MIN_BODY_LENGTH) {
    throw new AppError(
      'VALIDATION',
      `النصّ قصير جدًا. الحد الأدنى ${MIN_BODY_LENGTH} حرفًا.`,
    );
  }
  if (body.length > MAX_BODY_LENGTH) {
    throw new AppError(
      'VALIDATION',
      'النصّ طويل جدًا. قسّمه إلى وثائق (بابًا بابًا مثلًا).',
    );
  }

  return indexReferenceBody({
    admin: createAdminClient(),
    meta: {
      name: input.name,
      authority: input.authority,
      referenceCode: input.referenceCode ?? null,
      sourceUrl: input.sourceUrl ?? null,
      description: input.description ?? null,
      uploadedBy: input.uploadedBy,
    },
    body,
    fileType: 'text/plain',
  });
}

/**
 * رفع وثيقة مرجعية **من ملف** — بخطّ المعالجة نفسه الذي تمرّ به
 * مستندات الشركات.
 *
 * وكانت المكتبة الموضع الوحيد في المنتج الذي يطلب لصق النصّ يدويًا،
 * بينما يملك المشروع إصلاح PDF العربي المشوّه والقراءة الضوئية وقياس
 * جودة الاستخراج. أي أن **أهمّ نصّ في المنصّة كان يدخل من أضعف باب**.
 *
 * والفرق عن مسار الشركات أن لا شركة هنا ولا حصّة: المالكة ترفع مرة
 * واحدة للجميع، وكلفة القراءة الضوئية عليها. ولذلك لا يُفحَص حدّ خطة
 * ولا تُسجَّل الصفحات على مستهلك.
 */
export async function ingestReferenceDocumentFromFile(input: {
  name: string;
  authority: string;
  referenceCode?: string | null;
  sourceUrl?: string | null;
  description?: string | null;
  storagePath: string;
  fileName: string;
  mimeType?: string;
  uploadedBy: string;
}): Promise<string> {
  const admin = createAdminClient();

  const { data: blob, error: downloadError } = await admin.storage
    .from(REFERENCE_BUCKET)
    .download(input.storagePath);

  if (downloadError || !blob) {
    logger.error('تعذّر تنزيل الملف المرجعي', { reason: downloadError?.message });
    throw new AppError('VALIDATION', 'لم يصل الملف إلى التخزين. أعد المحاولة.');
  }

  const buffer = Buffer.from(await blob.arrayBuffer());
  const checksum = createHash('sha256').update(buffer).digest('hex');

  let text = '';
  let pageCount: number | null = null;
  let ocrPages = 0;

  const outcome = await extractOrDetectScan(buffer, input.fileName, input.mimeType);

  if (outcome.kind === 'text') {
    const quality = assessExtraction(outcome.extraction);

    /*
     * الاستخراج الفاسد يُرفض هنا لا يُخزَّن.
     *
     * ونصٌّ نظاميّ نصف مقروء أسوأ من غيابه: الاستشهاد به يُنتج سياسةً
     * تنسب إلى النظام ما لم يقله، ويقرؤها المدير فيثق بها لأن عليها
     * اسم جهة ورقم مادة.
     */
    if (quality.verdict === 'EMPTY') {
      throw new AppError('DOCUMENT_PROCESSING', quality.message!, quality.detail);
    }

    text = outcome.extraction.text;
    pageCount = outcome.extraction.pageCount;
  } else if (outcome.kind === 'scanned') {
    // نظام ممسوح ضوئيًا — يُقرأ بالرؤية، والكلفة على المنصّة
    const total = await countPdfPages(buffer);
    const limit = Math.min(total, serverEnv.ocrMaxPagesPerDocument);
    const pages = Array.from({ length: limit }, (_, index) => index + 1);

    const result = await ocrPdfPages(buffer, pages);
    text = result.pages.map((page) => page.text).join('\n\n');
    pageCount = total;
    ocrPages = result.pages.length;

    logger.info('قُرئت وثيقة مرجعية ضوئيًا', {
      pages: ocrPages,
      truncated: result.truncated,
    });
  } else {
    throw new AppError(
      'UNSUPPORTED_FILE',
      'الصور لا تُرفع إلى المكتبة المرجعية. ارفع ملف PDF أو Word أو الصق النصّ.',
    );
  }

  const body = cleanText(text);

  if (body.length < MIN_BODY_LENGTH) {
    throw new AppError(
      'VALIDATION',
      `النصّ المستخرَج قصير جدًا (${body.length} حرفًا). تأكد أن الملف يحتوي نصًّا قابلًا للقراءة.`,
    );
  }
  if (body.length > MAX_BODY_LENGTH) {
    throw new AppError(
      'VALIDATION',
      'النصّ طويل جدًا. قسّم النظام إلى أبواب وارفع كل باب وثيقةً مستقلة.',
    );
  }

  return indexReferenceBody({
    admin,
    meta: {
      name: input.name,
      authority: input.authority,
      referenceCode: input.referenceCode ?? null,
      sourceUrl: input.sourceUrl ?? null,
      description: input.description ?? null,
      uploadedBy: input.uploadedBy,
    },
    body,
    fileType: input.mimeType || 'application/pdf',
    storagePath: input.storagePath,
    checksum,
    pageCount,
    ocrPages,
  });
}

/**
 * البحث في المكتبة. يُنادى من استوديو السياسات وحده.
 *
 * يمرّ بمفتاح الخدمة لأن الدالّة `security definer` تحرس الحالة
 * (`READY`) بنفسها، ولا شيء في المكتبة يخصّ شركةً حتى يُصفّى بها.
 */
export async function searchReferenceLibrary(
  query: string,
  matchCount = 6,
): Promise<ReferenceMatch[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];

  const admin = createAdminClient();
  const embedding = await embedQuery(trimmed);

  const { data, error } = await admin.rpc('match_platform_reference_chunks', {
    p_query_embedding: toPgVector(embedding),
    p_match_count: matchCount,
    p_min_similarity: 0.3,
  });

  if (error) {
    logger.warn('تعذّر البحث في المكتبة المرجعية', { reason: error.message });
    return [];
  }

  return (data ?? []).map((row) => ({
    chunkId: row.chunk_id,
    documentId: row.document_id,
    documentName: row.document_name,
    authority: row.authority,
    referenceCode: row.reference_code,
    sourceUrl: row.source_url,
    textCopiedAt: row.text_copied_at,
    content: row.content,
    pageNumber: row.page_number,
    sectionTitle: row.section_title,
    similarity: row.similarity,
  }));
}


/**
 * إعادة فهرسة وثيقة مرجعية من نصّها المحفوظ.
 *
 * الحاجة إليها عملية لا نظرية: أكثر أسباب الفشل شيوعًا هو حدّ معدّل
 * مزوّد التضمين — عطلٌ عابر لا علاقة له بالمحتوى. وبلا إعادة محاولة
 * يُجبَر المالك على حذف الوثيقة ورفعها من الصفر لسببٍ يزول بعد دقيقة.
 *
 * وتُبنى من `source_text` لا من المقاطع: الوثيقة الفاشلة قد لا تملك
 * مقاطع أصلًا — وهي الحالة التي تحتاج هذه الدالّة أكثر من غيرها.
 */
export async function reindexReferenceDocument(documentId: string): Promise<number> {
  const admin = createAdminClient();

  const { data: doc, error } = await admin
    .from('platform_reference_documents')
    .select('id, source_text, reference_code')
    .eq('id', documentId)
    .maybeSingle();

  if (error || !doc) {
    throw new AppError('NOT_FOUND', 'الوثيقة غير موجودة.');
  }

  const body = doc.source_text ?? '';
  if (body.length < MIN_BODY_LENGTH) {
    // الوثائق المرفوعة قبل حفظ النصّ لا نصّ محفوظ لها
    throw new AppError(
      'VALIDATION',
      'لا يوجد نصّ محفوظ لهذه الوثيقة. احذفها وارفعها من جديد.',
    );
  }

  await admin
    .from('platform_reference_documents')
    .update({ status: 'PROCESSING', error_message: null })
    .eq('id', documentId);

  try {
    const chunks = buildChunks({ text: body, pages: [], pageCount: null });
    if (chunks.length === 0) throw new Error('لم يُنتج النصّ أي مقاطع');

    const embeddings = await embedTexts(
      chunks.map((chunk) => chunk.content),
      'document',
    );
    if (embeddings.length !== chunks.length) {
      throw new Error('عدد التضمينات لا يطابق عدد المقاطع');
    }

    // تُحذف المقاطع القديمة أولًا — وإلا بقيت نسخة نصف مفهرسة بجانب
    // الجديدة فيُرجع البحث الاثنتين.
    await admin.from('platform_reference_chunks').delete().eq('document_id', documentId);

    const { error: insertError } = await admin
      .from('platform_reference_chunks')
      .insert(
        chunks.map((chunk, position) => ({
          document_id: documentId,
          chunk_index: chunk.index,
          content: chunk.content,
          token_count: chunk.tokenCount,
          page_number: chunk.pageNumber,
          section_title: doc.reference_code?.trim() || null,
          embedding: toPgVector(embeddings[position]),
        })),
      );

    if (insertError) throw new Error(insertError.message);

    await admin
      .from('platform_reference_documents')
      .update({
        status: 'READY',
        chunk_count: chunks.length,
        updated_at: new Date().toISOString(),
      })
      .eq('id', documentId);

    logger.info('أُعيدت فهرسة وثيقة مرجعية', { chunkCount: chunks.length });
    return chunks.length;
  } catch (cause) {
    await admin
      .from('platform_reference_documents')
      .update({
        status: 'FAILED',
        error_message: 'تعذّرت إعادة الفهرسة.',
      })
      .eq('id', documentId);

    logger.error('تعذّرت إعادة فهرسة وثيقة مرجعية', {
      reason: cause instanceof Error ? cause.message : String(cause),
    });
    throw new AppError('INTERNAL', 'تعذّرت إعادة الفهرسة. حاول بعد قليل.');
  }
}
