import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, CompanyAiSettings } from '@/types/database';
import { embedQuery, toPgVector } from '@/lib/rag/embeddings';
import { estimateTokens } from '@/lib/rag/chunk';
import { contentTokens, jaccard } from '@/lib/rag/verify';
import { logger } from '@/lib/logger';

export interface RetrievedChunk {
  chunkId: string;
  documentId: string;
  documentName: string;
  content: string;
  pageNumber: number | null;
  sectionTitle: string | null;
  similarity: number;
  /** رتبة المطابقة اللفظية — صفرٌ إن لم يجده المسار اللفظيّ */
  lexicalRank?: number;
  /** درجة الدمج بالرتبة المتبادلة، وعليها يقع الترتيب */
  fusedScore?: number;
  /** أيّ مسارٍ وجد المقطع — يُسجَّل للتشخيص */
  matchedBy?: 'dense' | 'sparse' | 'both';
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
 * العتبة النسبية: يُسقَط كل مقطع تشابهه أقل من نسبة من أفضل مقطع.
 *
 *     τ = max(τ_مطلقة، α × أعلى_تشابه)
 *
 * العتبة المطلقة وحدها لا تكفي. حين يجيب مقطع واحد عن السؤال بدقة،
 * تمرّ معه مقاطع «مقبولة» لا صلة لها، فتُغري النموذج بحشو الإجابة
 * منها — وهذا مصدر هلوسة لا يرجع إلى النموذج بل إلى ما أطعمناه.
 */
const RELATIVE_THRESHOLD_RATIO = 0.75;

/**
 * معامل التنويع في MMR (Maximal Marginal Relevance):
 *
 *     MMR(c) = λ × تشابه(س، c) − (1−λ) × أقصى_تشابه(c، المختار)
 *
 * بلا تنويع تُختار مقاطع متجاورة تكرّر النص نفسه، فتُستهلك ميزانية
 * السياق في تكرار ويضيع مقطع مكمّل كان سيغيّر الإجابة.
 *
 * التشابه بين المقاطع يُقاس معجميًا لا بالمتجهات: إعادة المتجهات من
 * قاعدة البيانات تنقل ١٠٢٤ عددًا لكل مقطع في كل سؤال، وثمنها لا
 * يوازي دقة أعلى في كشف التكرار النصّي تحديدًا.
 */
const MMR_LAMBDA = 0.7;

/** فوق هذا التشابه المعجمي يُعدّ المقطعان نسخة واحدة */
const NEAR_DUPLICATE = 0.82;

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

  /*
   * البركة أوسع من المطلوب عمدًا.
   *
   * الاسترجاع يُخرج مرشّحين، والاختيار يقع بعده في `selectContextChunks`.
   * فلو ضُيّقت البركة هنا لحُذف المقطع قبل أن يُرجَّح، ولا سبيل إلى
   * استرجاعه بعد ذلك.
   */
  const poolSize = Math.max((aiSettings.retrieval_top_k ?? 8) * 2, 16);

  /*
   * الأرضية متساهلة جدًّا هنا — والفرز يقع بعدها لا فيها.
   *
   * كانت 0.30 تُطبَّق داخل SQL قبل أن يرى أحدٌ شيئًا، فإن لم يبلغها
   * مقطعٌ رجعت الدالّة خاوية وقال المساعد «لم أجد معلومات كافية»
   * والإجابة في المستند أمام السائل.
   *
   * وسؤالٌ عن مستندٍ كامل («ما ملخّص التعديلات») لا يقابله مقطعٌ واحد
   * قريب: التشابه موزَّع لا مركَّز. فكانت الأرضية تقطع الحالة التي
   * يحتاجها المستخدم أكثر من غيرها.
   */
  const floor = aiSettings.min_similarity ?? 0.05;

  const { data, error } = await supabase.rpc('match_document_chunks_hybrid', {
    p_query_embedding: toPgVector(queryEmbedding),
    p_query_text: question,
    p_match_count: poolSize,
    p_min_similarity: floor,
    p_category_ids: options.categoryIds?.length ? options.categoryIds : null,
  });

  if (error) {
    logger.error('فشل البحث الهجين', { reason: error.message });
    throw error;
  }

  const rows = data ?? [];

  const candidates: RetrievedChunk[] = rows.map((row) => ({
    chunkId: row.chunk_id,
    documentId: row.document_id,
    documentName: row.document_name,
    content: row.content,
    pageNumber: row.page_number,
    sectionTitle: row.section_title,
    similarity: row.similarity,
    lexicalRank: row.lexical_rank,
    fusedScore: row.fused_score,
    matchedBy: row.matched_by as RetrievedChunk['matchedBy'],
  }));

  const maxChunks = aiSettings.max_context_chunks ?? 6;
  const selected = selectContextChunks(candidates, maxChunks);

  /*
   * أثرٌ يكفي لتشخيص فشل استرجاع بعد وقوعه.
   *
   * حين يقول المساعد «لم أجد» ونحن نرى الإجابة في المستند، السؤال
   * الأول هو: هل فشل الاسترجاع أم الاختيار أم التوليد؟ وبلا هذا
   * السطر لا جواب إلا التخمين.
   *
   * ولا يُسجَّل نصّ المقاطع ولا السؤال — محتوى مستندات الشركات لا
   * يدخل السجلّات.
   */
  logger.info('استرجاع', {
    questionLength: question.length,
    candidates: candidates.length,
    selected: selected.length,
    dense: candidates.filter((c) => c.matchedBy === 'dense').length,
    sparse: candidates.filter((c) => c.matchedBy === 'sparse').length,
    both: candidates.filter((c) => c.matchedBy === 'both').length,
    topSimilarity: candidates[0]?.similarity ?? null,
    selectedFrom: selected.map((c) => ({
      documentId: c.documentId,
      chunkId: c.chunkId,
      page: c.pageNumber,
      similarity: Number(c.similarity?.toFixed(3) ?? 0),
      matchedBy: c.matchedBy,
    })),
  });

  return {
    chunks: selected,
    isEmpty: selected.length === 0,
    latencyMs: Date.now() - startedAt,
  };
}

/**
 * اختيار مقاطع السياق: عتبة نسبية، ثم تنويع MMR، ثم ميزانية الرموز.
 *
 * مصدَّرة للاختبار — هذه هي المعادلات التي تحدّد ما يراه النموذج،
 * وما يراه النموذج يحدّد ما يهلوس به.
 */
export function selectContextChunks(
  candidates: RetrievedChunk[],
  maxChunks: number,
): RetrievedChunk[] {
  if (candidates.length === 0) return [];

  // --- ١) العتبة النسبية ---
  const bestSimilarity = candidates.reduce(
    (max, chunk) => Math.max(max, chunk.similarity),
    0,
  );
  const relativeFloor = bestSimilarity * RELATIVE_THRESHOLD_RATIO;
  const pool = candidates.filter((chunk) => chunk.similarity >= relativeFloor);

  // --- ٢) التنويع (MMR) مع ميزانية الرموز ---
  const selected: RetrievedChunk[] = [];
  const selectedTokens: Set<string>[] = [];
  const remaining = [...pool];
  let tokenBudget = MAX_CONTEXT_TOKENS;

  while (selected.length < maxChunks && remaining.length > 0) {
    let bestIndex = -1;
    let bestScore = Number.NEGATIVE_INFINITY;
    let bestRedundancy = 0;

    for (const [index, candidate] of remaining.entries()) {
      const tokens = contentTokens(candidate.content);
      const redundancy = selectedTokens.reduce(
        (max, chosen) => Math.max(max, jaccard(tokens, chosen)),
        0,
      );

      const score = MMR_LAMBDA * candidate.similarity - (1 - MMR_LAMBDA) * redundancy;

      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
        bestRedundancy = redundancy;
      }
    }

    if (bestIndex < 0) break;

    const [chosen] = remaining.splice(bestIndex, 1);

    // نسخة مكرّرة لا تضيف معلومة وتستهلك ميزانية السياق
    if (bestRedundancy >= NEAR_DUPLICATE) continue;

    const cost = estimateTokens(chosen.content);
    if (cost > tokenBudget && selected.length > 0) break;
    tokenBudget -= cost;

    selected.push(chosen);
    selectedTokens.push(contentTokens(chosen.content));
  }

  // يُعاد الترتيب بالتشابه: الأقرب أولًا في نافذة النموذج
  return selected.sort((a, b) => b.similarity - a.similarity);
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
