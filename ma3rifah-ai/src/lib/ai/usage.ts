import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/logger';

/**
 * محاسبة التكلفة لكل شركة.
 *
 * مفتاح واحد يخدم كل العملاء، فالفاتورة تصل مجمّعة ولا تقول من استهلك
 * ماذا. والتوزيع لا يمكن استرجاعه لاحقًا: إن لم يُسجَّل الاستهلاك لحظة
 * حدوثه، ضاعت نسبته إلى صاحبها إلى الأبد.
 *
 * وكانت التضمينات لا تُحتسب إطلاقًا — وهي التكلفة الوحيدة التي تقفز
 * دفعة واحدة: رفع مستند من ٥٠٠ صفحة يستهلك في دقيقة ما تستهلكه مئات
 * الأسئلة. فشركة ترفع أرشيفها كله في يومها الأول تبدو في التقرير
 * القديم بلا تكلفة تُذكر.
 */

/** سعر التضمين بالدولار لكل مليون رمز */
const EMBEDDING_PRICING_USD_PER_MTOK: Record<string, number> = {
  'voyage-3.5': 0.06,
  'voyage-3.5-lite': 0.02,
  'voyage-3-large': 0.18,
  'text-embedding-3-small': 0.02,
  'text-embedding-3-large': 0.13,
};

/** المزوّد المحلي بلا تكلفة خارجية */
const FREE_PROVIDERS = new Set(['local']);

export function estimateEmbeddingCostUsd(
  provider: string,
  model: string,
  tokens: number,
): number {
  if (FREE_PROVIDERS.has(provider)) return 0;
  // سعر افتراضي متحفّظ للنموذج غير المعروف: تقدير أعلى من الواقع أأمن
  // من تقدير أقل، لأن الثاني يجعل الهامش يبدو أوسع مما هو.
  const rate = EMBEDDING_PRICING_USD_PER_MTOK[model] ?? 0.18;
  return (tokens * rate) / 1_000_000;
}

export interface UsageEntry {
  companyId: string;
  userId?: string | null;
  operation: 'chat' | 'embedding' | 'title' | 'site_chat';
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens?: number;
  costUsd: number;
  latencyMs?: number;
  /** يُحتسب ضمن حصة الأسئلة الشهرية */
  countsAsQuestion?: boolean;
}

/**
 * تسجيل استهلاك واحد.
 *
 * لا يرمي أبدًا: فشل المحاسبة لا يجوز أن يُفشل عملية نجحت للعميل.
 * ويُسجَّل التعذّر في السجل كي لا يمرّ نقص المحاسبة صامتًا.
 */
export async function recordAiUsage(entry: UsageEntry): Promise<void> {
  try {
    const admin = createAdminClient();

    await admin.from('ai_usage_logs').insert({
      company_id: entry.companyId,
      user_id: entry.userId ?? null,
      operation: entry.operation,
      provider: entry.provider,
      model: entry.model,
      input_tokens: entry.inputTokens,
      output_tokens: entry.outputTokens ?? 0,
      estimated_cost_usd: entry.costUsd,
      latency_ms: entry.latencyMs ?? null,
    });

    await admin.rpc('record_usage', {
      p_company_id: entry.companyId,
      p_questions: entry.countsAsQuestion ? 1 : 0,
      p_input_tokens: entry.inputTokens,
      p_output_tokens: entry.outputTokens ?? 0,
      p_cost_usd: entry.costUsd,
    });
  } catch (error) {
    logger.warn('تعذّر تسجيل الاستهلاك', {
      operation: entry.operation,
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}
