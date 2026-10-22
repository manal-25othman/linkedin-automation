import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireCompanySession } from '@/lib/auth/session';
import { retrieveRelevantChunks, summarizeSources } from '@/lib/rag/retrieval';
import { isConversationalFollowUp } from '@/lib/rag/gap-filter';
import { generateAnswer, generateConversationTitle, estimateCostUsd, rewriteSearchQuery } from '@/lib/ai/claude';
import { buildSystemPrompt, buildUserMessage, isUnansweredResponse } from '@/lib/ai/prompts';
import {
  verifyAnswer,
  stripCitationMarkers,
  splitClaims,
  detectSuspectedConflict,
  readCoverage,
} from '@/lib/rag/verify';
import type { ConfidenceLevel, SuspectedConflict } from '@/lib/rag/verify';
import type { RetrievedChunk } from '@/lib/rag/retrieval';
import { ROLE_LABELS } from '@/lib/auth/rbac';
import { recordAnalyticsEvent } from '@/lib/audit';
import { getEmbeddingProvider } from '@/lib/rag/embeddings';
import { estimateTokens } from '@/lib/rag/chunk';
import { estimateEmbeddingCostUsd } from '@/lib/ai/usage';
import { notifyCompanyAdmins } from '@/lib/notifications';
import { enforceRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { truncate } from '@/lib/utils';
import type { CompanyAiSettings } from '@/types/database';

export interface AnswerSource {
  documentId: string;
  documentName: string;
  /** اسم الإصدار الذي أُخذ منه النص — null لوثيقة بلا عائلة بعد */
  versionLabel: string | null;
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
  /** درجة ثقة مركّبة ∈ [0,1] — null حين لا توجد إجابة تُقاس */
  confidence: number | null;
  confidenceLevel: ConfidenceLevel | null;
  /** أرقام وردت في الإجابة بلا أصل في المصادر */
  unverifiedNumbers: string[];
  /** ما لم تغطّه المصادر من السؤال — null حين كانت التغطية كاملة */
  coverageNote: string | null;
  /** ما يلزم السائل توضيحه قبل أن يصحّ جواب واحد */
  clarificationNote: string | null;
  /** موضعان يستحقّان النظر لاختلاف أرقامهما في موضوع واحد */
  conflictNote: string | null;
}

const MAX_QUESTION_LENGTH = 2000;

/**
 * إلحاق التحذيرات بنص الإجابة.
 *
 * تُلحق بالنص لا تُعرض في حقل منفصل عمدًا: الحقل المنفصل يُنسى عند
 * النسخ واللصق، والإجابة تُنقل إلى واتساب أو بريد بلا تحذيرها فتُقرأ
 * كأنها مؤكَّدة.
 */
function appendWarnings(answer: string, warnings: string[]): string {
  if (warnings.length === 0) return answer;
  return `${answer}\n\n${warnings.map((warning) => `⚠️ ${warning}`).join('\n')}`;
}

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

  await enforceRateLimit(`chat:${profile.id}`, RATE_LIMITS.chat);

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
  let retrieval = await retrieveRelevantChunks(supabase, question, aiSettings);

  /*
   * محاولة إنقاذ واحدة قبل «لم أجد».
   *
   * السؤال يُكتب بالعامية والوثيقة بلغة الأنظمة، وحين لا يشتركان في
   * معنًى قريب ولا لفظٍ يعود الاسترجاع خاويًا والجوابُ في المستند.
   * فيُعاد صوغ السؤال بلغة الوثائق ويُبحث به ثانيةً.
   *
   * ولا تقع المحاولة إلا عند بحثٍ أول خاوٍ: النجاح لا يحتاجها،
   * وإجراؤها دائمًا يُحمّل كل سؤالٍ زمنَ وتكلفةَ علاجِ حالةٍ نادرة.
   * وفشلُ الصياغة نفسها ليس حدثًا — نعود إلى «لم أجد» كما كنا.
   */
  if (retrieval.isEmpty) {
    const rewritten = await rewriteSearchQuery(question);
    if (rewritten) {
      const retried = await retrieveRelevantChunks(supabase, rewritten, aiSettings);
      if (!retried.isEmpty) {
        logger.info('أنقذت إعادةُ الصياغة الاسترجاعَ', {
          chunks: retried.chunks.length,
          // لا يُسجَّل نصّ السؤال ولا صياغته — أطوالهما تكفي للتشخيص
          questionLength: question.length,
          rewrittenLength: rewritten.length,
        });
        retrieval = {
          ...retried,
          latencyMs: retrieval.latencyMs + retried.latencyMs,
        };
      }
    }
  }

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

  // --- التغطية ---
  // تُقرأ علامة الحالة وتُنزع من النصّ قبل أي قياس: بقاؤها يُفسد
  // حساب الرسوخ (كلماتها ليست من المصادر) ويُعرض للمستخدم رمزًا
  // داخليًا لا معنى له عنده.
  const coverage = readCoverage(completion.text);

  const unanswered = retrieval.isEmpty || isUnansweredResponse(coverage.text);
  const rawAnswer =
    coverage.text.trim() ||
    'لم أجد معلومات كافية في قاعدة معرفة الشركة للإجابة عن هذا السؤال.';

  // --- التحقق من رسوخ الإجابة في مصادرها ---
  // يُجرى بعد التوليد لا قبله: الموجّه يطلب ألّا يخترع النموذج، وهذا
  // يتحقق أنه لم يفعل. القياس معجمي محلي بلا استدعاء نموذج ثانٍ.
  const verification = verifyAnswer({ answer: rawAnswer, chunks: retrieval.chunks });

  // --- الجملة ومصدرها ---
  // تُقطَّع قبل حذف العلامات، فهي كل ما يربط جملةً بوثيقةٍ بعينها.
  const claims = unanswered ? [] : splitClaims(rawAnswer, retrieval.chunks.length);

  // --- اشتباه التعارض ---
  // يُحسب على المقاطع التي استُشهد بها وحدها: التعارض بين مقطعين لم
  // يدخلا الإجابة ليس تحذيرًا للقارئ بل ضجيج عن نصّ لم يره.
  const conflict = unanswered
    ? null
    : detectSuspectedConflict(retrieval.chunks, verification.citedIndexes);

  const coverageNote = unanswered || coverage.coverage === 'FULL' ? null : coverage.note;
  const conflictNote = conflict ? describeConflict(retrieval.chunks, conflict) : null;

  // تُحذف علامات [مصدر ن] بعد استخلاصها: أفادت في الربط ولا تفيد القارئ
  const answerText = appendWarnings(
    stripCitationMarkers(rawAnswer),
    unanswered
      ? []
      : [
          ...verification.warnings,
          ...(coverageNote
            ? [
                coverage.coverage === 'NEEDS_CLARIFICATION'
                  ? `حدّد ${coverageNote} ليصحّ جواب واحد — المصادر تفرّق بينها.`
                  : `لم أجد في مستندات الشركة نصًّا عن: ${coverageNote}`,
              ]
            : []),
          ...(conflictNote ? [conflictNote] : []),
        ],
  );

  if (verification.numbers.unverified.length > 0) {
    // لا يُسجَّل السؤال ولا الإجابة — الأرقام وحدها كافية للتتبّع
    logger.warn('أرقام في الإجابة بلا أصل في المصادر', {
      companyId: company.id,
      count: verification.numbers.unverified.length,
      groundedness: verification.groundedness,
    });
  }

  // --- حفظ الإجابة ---
  const { data: assistantMessage, error: assistantError } = await supabase
    .from('messages')
    .insert({
      company_id: company.id,
      conversation_id: conversationId,
      user_id: profile.id,
      role: 'ASSISTANT',
      content: answerText,
      answer_status: unanswered ? 'UNANSWERED' : COVERAGE_STATUS[coverage.coverage],
      coverage_note: coverageNote,
      conflict_note: conflictNote,
      latency_ms: completion.latencyMs + retrieval.latencyMs,
      model: completion.model,
      input_tokens: completion.inputTokens,
      output_tokens: completion.outputTokens,
      confidence: unanswered ? null : verification.confidence,
      groundedness: unanswered ? null : verification.groundedness,
      unverified_numbers: unanswered ? 0 : verification.numbers.unverified.length,
      citations_inferred: unanswered ? false : verification.citationsInferred,
    })
    .select('id')
    .single();

  if (assistantError || !assistantMessage) {
    logger.error('تعذّر حفظ إجابة المساعد', { reason: assistantError?.message });
    throw new AppError('INTERNAL');
  }

  // --- المصادر ---
  // تُعرض المقاطع التي استند إليها الجواب فعلًا، لا كل ما استُرجع.
  // عرض ستة مصادر لإجابة بُنيت على واحد ادّعاء رسوخ لم يحدث، ويجعل
  // التحقق اليدوي مستحيلًا على من يريد أن يراجع.
  const citedChunks = verification.citedIndexes
    .map((index) => retrieval.chunks[index])
    .filter((chunk): chunk is NonNullable<typeof chunk> => Boolean(chunk));

  const summarized = unanswered ? [] : summarizeSources(citedChunks);

  /*
   * وصف الإصدار يُنسخ الآن لا يُقرأ لاحقًا.
   *
   * `documents.id` إصدارٌ بعينه، فالاستشهاد دقيقٌ أصلًا — لكن اسمه
   * يعيش في العائلة وتتغيّر العائلة. فلو قُرئ وقت العرض لأظهرت إجابةُ
   * الأمس اسمَ إصدار اليوم، وهي لم تُبنَ عليه.
   *
   * وبجلسة المستخدم لا بمفتاح الخدمة: الدالّة تَفحص `can_read_document`،
   * ومفتاح الخدمة بلا هوية فترجع خاويةً بلا خطأ — فتُحفظ الاستشهادات
   * بلا أسماء إصدارات ولا يشتكي شيء.
   */
  const versions = new Map<string, { familyId: string | null; label: string | null }>();

  if (summarized.length > 0) {
    const documentIds = [...new Set(summarized.map((chunk) => chunk.documentId))];
    const { data: versionRows, error: versionError } = await supabase.rpc(
      'describe_document_versions',
      { p_document_ids: documentIds },
    );

    if (versionError) {
      // لا تُسقط الإجابة: الاستشهاد بلا اسم إصدار أنقص لا باطل
      logger.warn('تعذّر قراءة أسماء الإصدارات للاستشهاد', {
        reason: versionError.message,
      });
    }

    for (const row of versionRows ?? []) {
      versions.set(row.document_id, {
        familyId: row.family_id,
        label: row.version_label,
      });
    }
  }

  const sources: AnswerSource[] = summarized.map((chunk) => ({
    documentId: chunk.documentId,
    documentName: chunk.documentName,
    versionLabel: versions.get(chunk.documentId)?.label ?? null,
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
        family_id: versions.get(chunk.documentId)?.familyId ?? null,
        version_label: versions.get(chunk.documentId)?.label ?? null,
        page_number: chunk.pageNumber,
        section_title: chunk.sectionTitle,
        similarity: chunk.similarity,
        excerpt: truncate(chunk.content, 240),
      })),
    );
  }

  // --- الجمل ومصادرها ---
  // تُحفظ بعد المصادر لا قبلها: فشلُها لا يُسقط الإجابة، وإجابةٌ بلا
  // تفصيلِ جُمَلٍ أنقص من إجابةٍ معه — لا باطلة.
  if (claims.length > 0) {
    const { error: claimsError } = await supabase.from('message_claims').insert(
      claims.map((claim) => ({
        company_id: company.id,
        message_id: assistantMessage.id,
        position: claim.position,
        text: truncate(claim.text, 2000),
        document_ids: [
          ...new Set(
            claim.sourceIndexes
              .map((index) => retrieval.chunks[index]?.documentId)
              .filter((id): id is string => Boolean(id)),
          ),
        ],
      })),
    );

    if (claimsError) {
      logger.warn('تعذّر حفظ جمل الإجابة ومصادرها', { reason: claimsError.message });
    }
  }

  // --- فجوة معرفة ---
  // المتابعات المحادثية («تاكد الان») تفشل استرجاعًا بالطبع، وليست
  // فجواتِ توثيق — تسجيلُها يملأ قائمة المدير بما لا يُجاب فتُهمَل
  /*
   * والتغطية الناقصة فجوةٌ أيضًا — وهي الأخطر لأنها لا تُرى.
   *
   * سؤالٌ من شقّين أُجيب عن أحدهما يُسجَّل اليوم `ANSWERED` فلا يبلغ
   * المدير أبدًا، والشقّ الثاني يبقى بلا توثيق سنةً كاملة بينما
   * «لم أجد» الصريحة تصل في يومها.
   *
   * ونصُّ ما نقص يُحفظ على الرسالة لا على الفجوة: ربطُه بالفجوة يأتي
   * مع تحويل الفجوات إلى مهامّ، حيث يتوسّع سجلّ الفجوة أصلًا — وترحيلٌ
   * يُضيف حقلًا ثم يُعاد تشكيله بعد أسبوع تكلفةٌ بلا مقابل.
   */
  const recordsGap = unanswered || coverage.coverage === 'PARTIAL';

  if (recordsGap && !isConversationalFollowUp(question)) {
    const { data: gapId, error: gapError } = await supabase.rpc('record_knowledge_gap', {
      p_question: question,
    });

    if (gapError) {
      logger.warn('تعذّر تسجيل فجوة المعرفة', { reason: gapError.message });
    } else if (gapId) {
      // --- تسجيل السائل ---
      // تفعله دالةُ قاعدة البيانات أيضًا، ويُعاد هنا عمدًا: النسخة
      // القديمة من الدالة (ترحيل 0006) لا تسجّل السائل، فقاعدةُ بيانات
      // لم تُحدَّث تُنتج فجوات بلا سائل — ثم يكتب المدير الإجابة ولا
      // تجد المنصةُ أحدًا تُبلّغه، بلا خطأ ولا أثر.
      //
      // والتبعية من النوع الذي لا يشتكي: كل شيء «يعمل» إلا الحلقة
      // الأخيرة. فتُثبَّت هنا حيث تُقرأ، ويصير التطبيق مسؤولًا عن
      // معرفة من سأل بدل أن يفترضه.
      // مفتاح الخدمة: لا يملك أي مستخدم سياسة كتابة على هذا الجدول
      const { error: askerError } = await createAdminClient()
        .from('knowledge_gap_askers')
        .upsert(
          {
            gap_id: gapId,
            user_id: profile.id,
            company_id: company.id,
            asked_at: new Date().toISOString(),
          },
          { onConflict: 'gap_id,user_id' },
        );

      if (askerError) {
        logger.warn('تعذّر تسجيل صاحب السؤال', { reason: askerError.message });
      }

      // تنبيه واحد لكل فجوة لا لكل سؤال: يمنع الفهرس الفريد على
      // (المستلم، النوع، الكيان) تكرارَه مهما تكرّر السؤال.
      await notifyCompanyAdmins({
        companyId: company.id,
        type: 'GAP_OPENED',
        title: unanswered
          ? 'سؤال لم تجد له قاعدة المعرفة إجابة'
          : 'سؤال أُجيب عنه جزئيًا — بقي شقّ بلا توثيق',
        body: coverageNote ? `${question}\n\nالناقص: ${coverageNote}` : question,
        link: '/knowledge-gaps',
        entityType: 'knowledge_gap',
        entityId: gapId,
      });
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
    cacheReadTokens: completion.cacheReadTokens,
    cacheWriteTokens: completion.cacheWriteTokens,
    latencyMs: completion.latencyMs,
    unanswered,
    sourceCount: sources.length,
    question,
  });

  return {
    conversationId,
    conversationTitle,
    userMessageId: userMessage.id,
    assistantMessageId: assistantMessage.id,
    answer: answerText,
    sources,
    isUnanswered: unanswered,
    confidence: unanswered ? null : verification.confidence,
    confidenceLevel: unanswered ? null : verification.level,
    unverifiedNumbers: unanswered ? [] : verification.numbers.unverified,
    coverageNote: coverage.coverage === 'PARTIAL' ? coverageNote : null,
    clarificationNote: coverage.coverage === 'NEEDS_CLARIFICATION' ? coverageNote : null,
    conflictNote,
  };
}

/** علامة التغطية ← حالة الإجابة المحفوظة */
const COVERAGE_STATUS = {
  FULL: 'ANSWERED',
  PARTIAL: 'PARTIAL',
  NEEDS_CLARIFICATION: 'NEEDS_CLARIFICATION',
} as const;

/**
 * صياغة الاشتباه بلغة تُراجَع لا بلغة تُصدّق.
 *
 * «راجع هذين الموضعين» لا «المصادر متعارضة»: ما حُسب هو اختلاف أرقام
 * في موضوع واحد، وقد يكون فرقًا مشروعًا بين فئتين. والتحذير الذي
 * يدّعي أكثر مما يعرف يُكذَّب مرةً ثم يُتجاهل دائمًا.
 */
function describeConflict(chunks: RetrievedChunk[], conflict: SuspectedConflict): string {
  const [left, right] = conflict.indexes;
  const nameA = chunks[left]?.documentName ?? 'مصدر';
  const nameB = chunks[right]?.documentName ?? 'مصدر';

  return (
    `راجع هذين الموضعين قبل الاعتماد: «${nameA}» يذكر ` +
    `${conflict.numbersA.join('، ')}، و«${nameB}» يذكر ` +
    `${conflict.numbersB.join('، ')} في الموضوع نفسه.`
  );
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
  cacheReadTokens: number;
  cacheWriteTokens: number;
  latencyMs: number;
  unanswered: boolean;
  sourceCount: number;
  question: string;
}): Promise<void> {
  const cost = estimateCostUsd(
    params.model,
    params.inputTokens,
    params.outputTokens,
    params.cacheReadTokens,
    params.cacheWriteTokens,
  );

  // تضمين السؤال يمرّ على مزوّد خارجي أيضًا. تكلفته ضئيلة للسؤال
  // الواحد وملموسة عبر آلاف الأسئلة، وإغفالها يجعل الهامش يبدو أوسع.
  const embeddingProvider = getEmbeddingProvider();
  const queryTokens = estimateTokens(params.question);
  const embeddingCost = estimateEmbeddingCostUsd(
    embeddingProvider.name,
    embeddingProvider.model,
    queryTokens,
  );

  try {
    const admin = createAdminClient();

    await admin.rpc('record_usage', {
      p_company_id: params.companyId,
      p_questions: 1,
      // تشمل المخزَّنة مؤقتًا: هي رموز دخل فُوتِرت فعلًا وإن بسعر مخفَّض،
      // وإسقاطها يُظهر استهلاكًا أقلّ من الحقيقي في تقارير الشركة
      p_input_tokens:
        params.inputTokens + params.cacheReadTokens + params.cacheWriteTokens + queryTokens,
      p_output_tokens: params.outputTokens,
      p_cost_usd: cost + embeddingCost,
    });

    // تنبيه اقتراب الحصة — بعد تسجيل الاستهلاك كي يقرأ الرقم المحدَّث.
    //
    // بعميل الجلسة لا بمفتاح الخدمة: الدالة تقرأ auth.uid() لتعرف شركة
    // الطالب، ومفتاح الخدمة يجعلها null فتخرج صامتة بلا أثر ظاهر.
    //
    // وفشلُه لا يُسقط الإجابة: التنبيه خدمةٌ إضافية، وحجبُ جواب وصل
    // فعلًا لأن تنبيهًا تعذّر مقايضةٌ خاسرة.
    try {
      const sessionClient = await createClient();
      await sessionClient.rpc('notify_quota_warning');
    } catch (error) {
      logger.warn('تعذّر إرسال تنبيه الحصة', {
        reason: error instanceof Error ? error.message : String(error),
      });
    }

    await admin.from('ai_usage_logs').insert({
      company_id: params.companyId,
      user_id: params.userId,
      operation: 'chat',
      provider: 'anthropic',
      model: params.model,
      input_tokens: params.inputTokens + params.cacheReadTokens + params.cacheWriteTokens,
      output_tokens: params.outputTokens,
      estimated_cost_usd: cost,
      latency_ms: params.latencyMs,
    });

    if (embeddingCost > 0) {
      await admin.from('ai_usage_logs').insert({
        company_id: params.companyId,
        user_id: params.userId,
        operation: 'embedding',
        provider: embeddingProvider.name,
        model: embeddingProvider.model,
        input_tokens: queryTokens,
        output_tokens: 0,
        estimated_cost_usd: embeddingCost,
      });
    }
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
/** أطول سببٍ يُقبل — الحقل للتوضيح لا للمراسلة */
const MAX_FEEDBACK_NOTE = 500;

export async function submitFeedback(
  messageId: string,
  feedback: 'UP' | 'DOWN' | null,
  note?: string | null,
): Promise<void> {
  await requireCompanySession();
  const supabase = await createClient();

  /*
   * السبب يُحفظ مع «لم تعجبني» وحدها، ويُمحى مع غيرها.
   *
   * فمن ضغط «لم تعجبني» وكتب سببًا ثم بدا له فرفع الإبهام، لا يبقى
   * سببُ استياءٍ معلّقًا على إجابةٍ رضي عنها.
   */
  const trimmed = (note ?? '').trim().slice(0, MAX_FEEDBACK_NOTE);
  const payload =
    feedback === 'DOWN'
      ? { feedback, feedback_note: trimmed || null }
      : { feedback, feedback_note: null };

  const { error } = await supabase
    .from('messages')
    .update(payload)
    .eq('id', messageId)
    .eq('role', 'ASSISTANT');

  if (error) {
    logger.warn('تعذّر حفظ التقييم', { reason: error.message });
    throw new AppError('INTERNAL', 'تعذّر حفظ التقييم.');
  }
}
