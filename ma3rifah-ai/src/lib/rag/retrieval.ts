import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, CompanyAiSettings } from '@/types/database';
import { embedQuery, toPgVector } from '@/lib/rag/embeddings';
import { estimateTokens } from '@/lib/rag/chunk';
import { logger } from '@/lib/logger';

export interface RetrievedChunk {
  chunkId: string;
  documentId: string;
  documentName: string;
  content: string;
  pageNumber: number | null;
  sectionTitle: string | null;
  similarity: number;
}

export interface RetrievalResult {
  chunks: RetrievedChunk[];
  /** true إذا لم يُسترجع أي مقطع يتجاوز حد التشابه */
  isEmpty: boolean;
  latencyMs: number;
}

/** حد أعلى لحجم السياق المُرسل إلى النموذج — تحكّم مباشر في التكلفة */
const MAX_CONTEXT_TOKENS = 6000;

/**
 * استرجاع المقاطع الأقرب دلاليًا للسؤال.
 *
 * ملاحظة أمنية مهمة: يُمرَّر عميل Supabase الخاص بجلسة المستخدم،
 * ودالة match_document_chunks تشتق الشركة والدور والقسم من auth.uid()
 * داخل قاعدة البيانات. لا يستطيع العميل تمرير company_id، ولا يمكن
 * لخطأ في كود التطبيق أن يسرّب مقاطع شركة أخرى أو مستندًا ممنوعًا.
 */
export async function retrieveRelevantChunks(
  supabase: SupabaseClient<Database>,
  question: string,
  aiSettings: CompanyAiSettings,
  options: { categoryIds?: string[] } = {},
): Promise<RetrievalResult> {
  const startedAt = Date.now();

  const queryEmbedding = await embedQuery(question);

  const { data, error } = await supabase.rpc('match_document_chunks', {
    p_query_embedding: toPgVector(queryEmbedding),
    p_match_count: aiSettings.retrieval_top_k ?? 8,
    p_min_similarity: aiSettings.min_similarity ?? 0.3,
    p_category_ids: options.categoryIds?.length ? options.categoryIds : null,
  });

  if (error) {
    logger.error('فشل البحث الدلالي', { reason: error.message });
    throw error;
  }

  const rows = data ?? [];

  // نأخذ الأعلى تشابهًا مع احترام سقف الرموز
  const maxChunks = aiSettings.max_context_chunks ?? 6;
  const selected: RetrievedChunk[] = [];
  let tokenBudget = MAX_CONTEXT_TOKENS;

  for (const row of rows) {
    if (selected.length >= maxChunks) break;
    const cost = estimateTokens(row.content);
    if (cost > tokenBudget && selected.length > 0) break;
    tokenBudget -= cost;

    selected.push({
      chunkId: row.chunk_id,
      documentId: row.document_id,
      documentName: row.document_name,
      content: row.content,
      pageNumber: row.page_number,
      sectionTitle: row.section_title,
      similarity: row.similarity,
    });
  }

  return {
    chunks: selected,
    isEmpty: selected.length === 0,
    latencyMs: Date.now() - startedAt,
  };
}

/**
 * تجميع المصادر للعرض: مصدر واحد لكل مستند مع أعلى تشابه،
 * حتى لا تظهر خمسة مقاطع من نفس الملف كخمسة مصادر منفصلة.
 */
export function summarizeSources(chunks: RetrievedChunk[]) {
  const byDocument = new Map<string, RetrievedChunk>();

  for (const chunk of chunks) {
    const key = `${chunk.documentId}:${chunk.pageNumber ?? 'na'}`;
    const existing = byDocument.get(key);
    if (!existing || chunk.similarity > existing.similarity) {
      byDocument.set(key, chunk);
    }
  }

  return Array.from(byDocument.values()).sort((a, b) => b.similarity - a.similarity);
}
