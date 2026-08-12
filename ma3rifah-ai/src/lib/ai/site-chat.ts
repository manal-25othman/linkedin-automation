import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { generateAnswer, estimateCostUsd } from '@/lib/ai/claude';
import {
  SITE_SYSTEM_PROMPT,
  SITE_UNANSWERED_MARKER,
} from '@/lib/ai/site-knowledge';
import { enforceRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { truncate } from '@/lib/utils';

/**
 * مساعد زوّار الموقع.
 *
 * منفصل تمامًا عن مساعد الموظفين: لا يستدعي RAG، ولا يلمس جداول
 * الشركات، ولا يقرأ أي مستند. مصدره الوحيد نص ثابت في الكود. هذا
 * الفصل بنيوي لا سياسي — لا يوجد في هذا الملف مسار برمجي يصل إلى
 * بيانات شركة أصلًا.
 *
 * الكتابة تتم بمفتاح الخدمة لأن الزائر مجهول ولا يملك جلسة، وجداول
 * الزوّار بلا سياسة كتابة إطلاقًا فلا يستطيع أي عميل الكتابة فيها.
 */

const MAX_QUESTION_LENGTH = 500;
const MAX_HISTORY_TURNS = 6;
const MAX_MESSAGES_PER_VISITOR = 40;

/**
 * نموذج أخف وأرخص: المهمة تصنيف وإجابة قصيرة من نص ثابت.
 * ملاحظة: haiku لا يدعم output_config.effort — يتكفّل generateAnswer بحذفه.
 */
const SITE_MODEL = 'claude-haiku-4-5';
const SITE_MAX_TOKENS = 700;

export interface SiteChatResult {
  answer: string;
  isUnanswered: boolean;
}

export async function askSiteAssistant(input: {
  question: string;
  visitorKey: string;
  entryPath?: string | null;
}): Promise<SiteChatResult> {
  const question = input.question.trim();

  if (question.length < 2) {
    throw new AppError('VALIDATION', 'اكتب سؤالك أولًا.');
  }
  if (question.length > MAX_QUESTION_LENGTH) {
    throw new AppError(
      'VALIDATION',
      `السؤال طويل. الحد الأقصى ${MAX_QUESTION_LENGTH} حرف.`,
    );
  }

  // الزائر مجهول، فالحد أضيق من حد الموظفين: الطلب مفتوح للعموم
  // ويستهلك رصيد المنصة لا رصيد شركة.
  enforceRateLimit(`site-chat:${input.visitorKey}`, RATE_LIMITS.siteChat);

  const admin = createAdminClient();

  // --- الزائر ---
  const { data: visitor, error: visitorError } = await admin
    .from('site_visitors')
    .upsert(
      {
        visitor_key: input.visitorKey,
        last_seen_at: new Date().toISOString(),
        entry_path: input.entryPath ? truncate(input.entryPath, 120) : null,
      },
      { onConflict: 'visitor_key', ignoreDuplicates: false },
    )
    .select('id, message_count')
    .single();

  if (visitorError || !visitor) {
    logger.error('تعذّر تسجيل زائر الموقع', { reason: visitorError?.message });
    throw new AppError('INTERNAL');
  }

  // سقف مطلق لكل زائر فوق تحديد المعدل: يمنع استنزاف الرصيد على مدى
  // طويل بطلبات متباعدة لا يلتقطها حد الدقيقة.
  if (visitor.message_count >= MAX_MESSAGES_PER_VISITOR) {
    throw new AppError(
      'RATE_LIMITED',
      'بلغت الحد الأقصى للأسئلة في هذه الجلسة. تواصل معنا عبر واتساب أو صفحة التواصل.',
    );
  }

  // --- سياق المحادثة ---
  const { data: historyRows } = await admin
    .from('site_chat_messages')
    .select('role, content')
    .eq('visitor_id', visitor.id)
    .order('created_at', { ascending: false })
    .limit(MAX_HISTORY_TURNS);

  const history = (historyRows ?? []).reverse().map((row) => ({
    role: row.role === 'USER' ? ('user' as const) : ('assistant' as const),
    content: truncate(row.content, 800),
  }));

  await admin.from('site_chat_messages').insert({
    visitor_id: visitor.id,
    role: 'USER',
    content: question,
  });

  // --- التوليد ---
  let completion;
  try {
    completion = await generateAnswer({
      systemPrompt: SITE_SYSTEM_PROMPT,
      history,
      userMessage: question,
      model: SITE_MODEL,
      maxTokens: SITE_MAX_TOKENS,
    });
  } catch (error) {
    await admin.from('site_chat_messages').insert({
      visitor_id: visitor.id,
      role: 'ASSISTANT',
      content: 'تعذّر توليد إجابة.',
      status: 'ERROR',
    });
    throw error;
  }

  const answer =
    completion.text.trim() ||
    `${SITE_UNANSWERED_MARKER}. تواصل معنا وسنجيبك مباشرة.`;

  const isUnanswered = answer.includes(SITE_UNANSWERED_MARKER);

  await admin.from('site_chat_messages').insert({
    visitor_id: visitor.id,
    role: 'ASSISTANT',
    content: answer,
    status: isUnanswered ? 'UNANSWERED' : 'ANSWERED',
    latency_ms: completion.latencyMs,
    model: completion.model,
    input_tokens: completion.inputTokens,
    output_tokens: completion.outputTokens,
  });

  await admin
    .from('site_visitors')
    .update({
      message_count: visitor.message_count + 1,
      last_seen_at: new Date().toISOString(),
    })
    .eq('id', visitor.id);

  logger.info('سؤال زائر', {
    unanswered: isUnanswered,
    latencyMs: completion.latencyMs,
    costUsd: estimateCostUsd(
      completion.model,
      completion.inputTokens,
      completion.outputTokens,
    ),
  });

  return { answer, isUnanswered };
}

/** يُستدعى عند انتقال الزائر إلى صفحة التسجيل من داخل المحادثة */
export async function markVisitorConverted(visitorKey: string): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin
      .from('site_visitors')
      .update({ converted: true })
      .eq('visitor_key', visitorKey);
  } catch (error) {
    logger.warn('تعذّر تسجيل تحوّل الزائر', {
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}
