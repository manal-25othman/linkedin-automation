import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { buildChunks } from '@/lib/rag/chunk';
import { embedTexts, embedQuery, toPgVector } from '@/lib/rag/embeddings';
import { cleanText } from '@/lib/rag/extract';
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

  const admin = createAdminClient();

  const { data: created, error } = await admin
    .from('platform_reference_documents')
    .insert({
      name: input.name.trim(),
      authority: input.authority.trim(),
      reference_code: input.referenceCode?.trim() || null,
      source_url: input.sourceUrl?.trim() || null,
      description: input.description?.trim() || null,
      file_type: 'text/plain',
      file_size_bytes: Buffer.byteLength(body, 'utf8'),
      status: 'PROCESSING',
      uploaded_by: input.uploadedBy,
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
          section_title: input.referenceCode?.trim() || null,
          embedding: toPgVector(embeddings[position]),
        })),
      );

    if (insertError) throw new Error(insertError.message);

    await admin
      .from('platform_reference_documents')
      .update({ status: 'READY', updated_at: new Date().toISOString() })
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
    content: row.content,
    pageNumber: row.page_number,
    sectionTitle: row.section_title,
    similarity: row.similarity,
  }));
}
