import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { computeDocumentDiff, joinChunkText, DIFF_ALGORITHM } from '@/lib/documents/diff';
import { summarizeDocumentDiff } from '@/lib/ai/claude';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import type { DocumentDiff } from '@/types/database';

export interface VersionComparison {
  fromDocumentId: string;
  toDocumentId: string;
  fromLabel: string;
  toLabel: string;
  diff: DocumentDiff;
  summary: string | null;
  computedAt: string;
  /** جاءت من المخزون لا من حسابٍ جديد */
  cached: boolean;
}

/**
 * مقارنة إصدارين — من المخزون إن أمكن، وإلا بحساب جديد.
 *
 * والتخزين ليس تسريعًا فحسب: الحساب يقرأ مقاطع وثيقتين كاملتين ثم
 * يستدعي نموذجًا للصياغة. ومدير يفتح الصفحة ثلاث مرات في جلسة واحدة
 * يدفع ثلاث مرات ثمن نتيجة لا تتغيّر — النصّان ثابتان، فالفرق ثابت.
 *
 * ويُبطَل المخزون باسم الخوارزمية لا بالزمن: ما يجعل نتيجةً قديمة
 * خاطئة هو تغيّر طريقة الحساب، لا مرور الوقت عليها.
 */
export async function compareDocumentVersions(params: {
  fromDocumentId: string;
  toDocumentId: string;
  documentTitle: string;
  fromLabel: string;
  toLabel: string;
  withSummary: boolean;
}): Promise<VersionComparison> {
  const { fromDocumentId, toDocumentId } = params;

  if (fromDocumentId === toDocumentId) {
    throw new AppError('VALIDATION', 'اختر إصدارين مختلفين للمقارنة.');
  }

  /*
   * بجلسة المستخدم في كل نداء هنا — وهذا ليس تفصيلًا.
   *
   * `chunks_of_document_version` تشتقّ الشركة والدور والقسم من
   * `auth.uid()`. وبمفتاح الخدمة ترجع خاويةً بلا خطأ، فتُحسب مقارنةٌ
   * بين نصّين فارغين وتُعرض «لا فرق بين الإصدارين» — وهو أسوأ عطل
   * ممكن هنا: جوابٌ واثق ومعكوس.
   */
  const supabase = await createClient();

  // --- المخزون ---
  const { data: cached } = await supabase
    .from('document_comparisons')
    .select('diff, summary, computed_at')
    .eq('from_document_id', fromDocumentId)
    .eq('to_document_id', toDocumentId)
    .maybeSingle();

  const usable =
    cached &&
    cached.diff?.algorithm === DIFF_ALGORITHM &&
    (!params.withSummary || cached.summary !== null);

  if (usable && cached) {
    return {
      fromDocumentId,
      toDocumentId,
      fromLabel: params.fromLabel,
      toLabel: params.toLabel,
      diff: cached.diff,
      summary: cached.summary,
      computedAt: cached.computed_at,
      cached: true,
    };
  }

  // --- الحساب ---
  const [fromChunks, toChunks] = await Promise.all([
    readVersionText(supabase, fromDocumentId),
    readVersionText(supabase, toDocumentId),
  ]);

  if (fromChunks.length === 0 || toChunks.length === 0) {
    // الفارغ هنا يعني «لم تكتمل الفهرسة» أو «لا تملك صلاحية القراءة»،
    // ولا يعني «لا فرق». والتمييز واجب: الثاني جوابٌ خاطئ واثق.
    throw new AppError(
      'VALIDATION',
      'أحد الإصدارين غير قابل للقراءة بعد — لم تكتمل معالجته أو لا تملك صلاحيته.',
    );
  }

  const diff = computeDocumentDiff(joinChunkText(fromChunks), joinChunkText(toChunks));

  let summary: string | null = null;
  let summaryModel: string | null = null;

  if (params.withSummary) {
    const written = await summarizeDocumentDiff({
      documentTitle: params.documentTitle,
      fromLabel: params.fromLabel,
      toLabel: params.toLabel,
      added: diff.added,
      removed: diff.removed,
      changed: diff.changed,
      numberChanges: diff.numberChanges,
    });

    if (written) {
      summary = written.text;
      summaryModel = written.model;
    }
  }

  const { error } = await supabase.rpc('save_document_comparison', {
    p_from_document_id: fromDocumentId,
    p_to_document_id: toDocumentId,
    p_diff: diff,
    p_summary: summary,
    p_summary_model: summaryModel,
  });

  if (error) {
    // الحفظ تخزينٌ لا نتيجة: الفرق محسوب وصحيح، ويُعرض وإن لم يُخزَّن
    logger.warn('تعذّر حفظ مقارنة الإصدارين', { reason: error.message });
  }

  return {
    fromDocumentId,
    toDocumentId,
    fromLabel: params.fromLabel,
    toLabel: params.toLabel,
    diff,
    summary,
    computedAt: new Date().toISOString(),
    cached: false,
  };
}

async function readVersionText(
  supabase: Awaited<ReturnType<typeof createClient>>,
  documentId: string,
): Promise<{ content: string }[]> {
  const { data, error } = await supabase.rpc('chunks_of_document_version', {
    p_document_id: documentId,
  });

  if (error) {
    logger.warn('تعذّرت قراءة مقاطع الإصدار للمقارنة', { reason: error.message });
    return [];
  }

  return (data ?? []).map((row) => ({ content: row.content }));
}
