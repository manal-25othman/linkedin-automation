import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireCompanySession } from '@/lib/auth/session';
import { retrieveRelevantChunks, summarizeSources } from '@/lib/rag/retrieval';
import { generateAnswer, generateConversationTitle, estimateCostUsd } from '@/lib/ai/claude';
import { buildSystemPrompt, buildUserMessage, isUnansweredResponse } from '@/lib/ai/prompts';
import { ROLE_LABELS } from '@/lib/auth/rbac';
import { recordAnalyticsEvent } from '@/lib/audit';
import { enforceRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { truncate } from '@/lib/utils';
import type { CompanyAiSettings } from '@/types/database';

export interface AnswerSource {
  documentId: string;
  documentName: string;
  pageNumber: number | null;
  sectionTitle: string | null;
  similarity: number;
  excerpt: string;
}

export interface AskResult {
  conversationId: string;
  conversationTitle: string;
  userMessageId: string;
  assistantMessageId: string;
  answer: string;
  sources: AnswerSource[];
  isUnanswered: boolean;
}

const MAX_QUESTION_LENGTH = 2000;

/**
 * دورة السؤال الكاملة:
 *
 *  1. التحقق من الهوية والصلاحية والحصة
 *  2. إنشاء/جلب المحادثة
 *  3. تضمين السؤال
 *  4. البحث الدلالي (مع فرض الصلاحيات داخل قاعدة البيانات)
 *  5. بناء السياق من المقاطع المسموح بها فقط
 *  6. استدعاء Claude
 *  7. حفظ الإجابة والمصادر
 *  8. تسجيل فجوة معرفة إن لم تكفِ المصادر
 *  9. تسجيل الاستهلاك والتحليلات
 */
export async function askAssistant(input: {
  question: string;
  conversationId?: string | null;
}): Promise<AskResult> {
  const session = await requireCompanySession();
  const { profile, company } = session;

  const question = input.question.trim();
  if (question.length < 2) {
    throw new AppError('VALIDATION', 'اكتب سؤالك أولًا.');
  }
  if (question.length > MAX_QUESTION_LENGTH) {
    throw new AppError(
      'VALIDATION',
      `السؤال طويل جدًا. الحد الأقصى ${MAX_QUESTION_LENGTH} حرف.`,
    );
  }

  enforceRateLimit(`chat:${profile.id}`, RATE_LIMITS.chat);

  const supabase = await createClient();

  // --- الحصة الشهرية ---
  const { data: quotaRows } = await supabase.rpc('check_question_quota');
  const quota = quotaRows?.[0];
  if (quota && !quota.allowed) {
    throw new AppError(
      'QUOTA_EXCEEDED',
      `تم استهلاك الحد الشهري للأسئلة (${quota.quota}). تواصل مع مدير الشركة لترقية الخطة.`,
    );
  }

  // --- المحادثة ---
  let conversationId = input.conversationId ?? null;
  let conversationTitle = '';

  if (conversationId) {
    const { data: conversation } = await supabase
      .from('conversations')
      .select('id, title')
      .eq('id', conversationId)
      .maybeSingle();

    if (!conversation) {
      throw new AppError('NOT_FOUND', 'المحادثة غير موجودة.');
    }
    conversationTitle = conversation.title;
  } else {
    conversationTitle = await generateConversationTitle(question);
    const { data: created, error } = await supabase
      .from('conversations')
      .insert({
        company_id: company.id,
        user_id: profile.id,
        title: conversationTitle,
      })
      .select('id, title')
      .single();

    if (error || !created) {
      logger.error('تعذّر إنشاء المحادثة', { reason: error?.message });
      throw new AppError('INTERNAL');
    }
    conversationId = created.id;
    conversationTitle = created.title;
  }

  const aiSettings = company.ai_settings as CompanyAiSettings;

  // --- تاريخ المحادثة (نافذة محدودة للتحكم في التكلفة) ---
  const historyWindow = Math.max(0, aiSettings.history_window ?? 6);
  const { data: historyRows } = await supabase
    .from('messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(historyWindow);

  const history = (historyRows ?? [])
    .reverse()
    .map((row) => ({
      role: row.role === 'USER' ? ('user' as const) : ('assistant' as const),
      content: truncate(row.content, 2000),
    }));

  // --- حفظ سؤال المستخدم ---
  const { data: userMessage, error: userMessageError } = await supabase
    .from('messages')
    .insert({
      company_id: company.id,
      conversation_id: conversationId,
      user_id: profile.id,
      role: 'USER',
      content: question,
    })
    .select('id')
    .single();

  if (userMessageError || !userMessage) {
    logger.error('تعذّر حفظ رسالة المستخدم', { reason: userMessageError?.message });
    throw new AppError('INTERNAL');
  }

  // --- الاسترجاع ---
  const retrieval = await retrieveRelevantChunks(supabase, question, aiSettings);

  // --- التوليد ---
  const departmentName = await getDepartmentName(supabase, profile.department_id);

  const completion = await generateAnswer({
    systemPrompt: buildSystemPrompt({
      companyName: company.name,
      tone: aiSettings.tone ?? 'professional',
      userName: profile.full_name || 'موظف',
      userRole: ROLE_LABELS[profile.role],
      departmentName,
    }),
    history,
    userMessage: buildUserMessage(question, retrieval.chunks),
  });

  const unanswered = retrieval.isEmpty || isUnansweredResponse(completion.text);
  const answerText =
    completion.text.trim() ||
    'لم أجد معلومات كافية في قاعدة معرفة الشركة للإجابة عن هذا السؤال.';

  // --- حفظ الإجابة ---
  const { data: assistantMessage, error: assistantError } = await supabase
    .from('messages')
    .insert({
      company_id: company.id,
      conversation_id: conversationId,
      user_id: profile.id,
      role: 'ASSISTANT',
      content: answerText,
      answer_status: unanswered ? 'UNANSWERED' : 'ANSWERED',
      latency_ms: completion.latencyMs + retrieval.latencyMs,
      model: completion.model,
      input_tokens: completion.inputTokens,
      output_tokens: completion.outputTokens,
    })
    .select('id')
    .single();

  if (assistantError || !assistantMessage) {
    logger.error('تعذّر حفظ إجابة المساعد', { reason: assistantError?.message });
    throw new AppError('INTERNAL');
  }

  // --- المصادر ---
  const summarized = unanswered ? [] : summarizeSources(retrieval.chunks);
  const sources: AnswerSource[] = summarized.map((chunk) => ({
    documentId: chunk.documentId,
    documentName: chunk.documentName,
    pageNumber: chunk.pageNumber,
    sectionTitle: chunk.sectionTitle,
    similarity: chunk.similarity,
    excerpt: truncate(chunk.content, 240),
  }));

  if (sources.length > 0) {
    await supabase.from('message_sources').insert(
      summarized.map((chunk) => ({
        company_id: company.id,
        message_id: assistantMessage.id,
        document_id: chunk.documentId,
        chunk_id: chunk.chunkId,
        document_name: chunk.documentName,
        page_number: chunk.pageNumber,
        section_title: chunk.sectionTitle,
        similarity: chunk.similarity,
        excerpt: truncate(chunk.content, 240),
      })),
    );
  }

  // --- فجوة معرفة ---
  if (unanswered) {
    const { error: gapError } = await supabase.rpc('record_knowledge_gap', {
      p_question: question,
    });
    if (gapError) {
      logger.warn('تعذّر تسجيل فجوة المعرفة', { reason: gapError.message });
    }
  }

  // --- الاستهلاك والتحليلات ---
  await recordUsageAndAnalytics({
    companyId: company.id,
    userId: profile.id,
    departmentId: profile.department_id,
    model: completion.model,
    inputTokens: completion.inputTokens,
    outputTokens: completion.outputTokens,
    latencyMs: completion.latencyMs,
    unanswered,
    sourceCount: sources.length,
  });

  return {
    conversationId,
    conversationTitle,
    userMessageId: userMessage.id,
    assistantMessageId: assistantMessage.id,
    answer: answerText,
    sources,
    isUnanswered: unanswered,
  };
}

async function getDepartmentName(
  supabase: Awaited<ReturnType<typeof createClient>>,
  departmentId: string | null,
): Promise<string | null> {
  if (!departmentId) return null;
  const { data } = await supabase
    .from('departments')
    .select('name')
    .eq('id', departmentId)
    .maybeSingle();
  return data?.name ?? null;
}

async function recordUsageAndAnalytics(params: {
  companyId: string;
  userId: string;
  departmentId: string | null;
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  unanswered: boolean;
  sourceCount: number;
}): Promise<void> {
  const cost = estimateCostUsd(params.model, params.inputTokens, params.outputTokens);

  try {
    const admin = createAdminClient();

    await admin.rpc('record_usage', {
      p_company_id: params.companyId,
      p_questions: 1,
      p_input_tokens: params.inputTokens,
      p_output_tokens: params.outputTokens,
      p_cost_usd: cost,
    });

    await admin.from('ai_usage_logs').insert({
      company_id: params.companyId,
      user_id: params.userId,
      operation: 'chat',
      provider: 'anthropic',
      model: params.model,
      input_tokens: params.inputTokens,
      output_tokens: params.outputTokens,
      estimated_cost_usd: cost,
      latency_ms: params.latencyMs,
    });
  } catch (error) {
    logger.warn('تعذّر تسجيل الاستهلاك', {
      reason: error instanceof Error ? error.message : String(error),
    });
  }

  await recordAnalyticsEvent({
    companyId: params.companyId,
    userId: params.userId,
    departmentId: params.departmentId,
    eventType: params.unanswered ? 'question.unanswered' : 'question.answered',
    metadata: { sourceCount: params.sourceCount, latencyMs: params.latencyMs },
  });
}

/** تقييم إجابة (👍 / 👎) */
export async function submitFeedback(
  messageId: string,
  feedback: 'UP' | 'DOWN' | null,
): Promise<void> {
  await requireCompanySession();
  const supabase = await createClient();

  const { error } = await supabase
    .from('messages')
    .update({ feedback })
    .eq('id', messageId)
    .eq('role', 'ASSISTANT');

  if (error) {
    logger.warn('تعذّر حفظ التقييم', { reason: error.message });
    throw new AppError('INTERNAL', 'تعذّر حفظ التقييم.');
  }
}
