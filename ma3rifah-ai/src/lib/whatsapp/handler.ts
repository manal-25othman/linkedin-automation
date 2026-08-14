import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { embedQuery, toPgVector } from '@/lib/rag/embeddings';
import { selectContextChunks, type RetrievedChunk } from '@/lib/rag/retrieval';
import { generateAnswer, estimateCostUsd } from '@/lib/ai/claude';
import { buildSystemPrompt, buildUserMessage, isUnansweredResponse } from '@/lib/ai/prompts';
import { verifyAnswer, stripCitationMarkers } from '@/lib/rag/verify';
import { ROLE_LABELS } from '@/lib/auth/rbac';
import { normalizePhone } from '@/lib/whatsapp/client';
import { logger } from '@/lib/logger';
import { truncate } from '@/lib/utils';
import type { CompanyAiSettings } from '@/types/database';

/**
 * معالجة رسالة واردة من واتساب.
 *
 * تمرّ بالمسار نفسه الذي يمرّ به سؤال من المتصفح: التضمين، ثم الاسترجاع
 * الذي يفرض الصلاحيات داخل قاعدة البيانات، ثم التوليد، ثم التحقق. ولا
 * يُستثنى شيء لأن القناة مختلفة — القناة تغيّر طريقة الوصول لا حقوقه.
 *
 * الفرق الوحيد أن الهوية تأتي من ربط هاتف موثّق بدل جلسة متصفح، ولذلك
 * تُقرأ من قاعدة البيانات ولا تُقبل من نص الرسالة إطلاقًا.
 */

const MAX_QUESTION_LENGTH = 500;
const MAX_MESSAGES_PER_DAY = 40;

const UNKNOWN_NUMBER_REPLY =
  'أهلًا بك. هذا الرقم مخصّص لموظفي الشركات المشتركة في «معرفة AI».\n\n' +
  'لربط رقمك: افتح حسابك في المنصة ← الملف الشخصي ← «ربط واتساب»، ' +
  'واحصل على رمز الربط ثم أرسله هنا.';

export interface IncomingMessage {
  from: string;
  text: string;
  messageId: string;
}

/** يستخرج الرسائل النصية من حمولة الويب هوك */
export function extractMessages(payload: unknown): IncomingMessage[] {
  const messages: IncomingMessage[] = [];

  try {
    const entries = (payload as { entry?: unknown[] })?.entry ?? [];
    for (const entry of entries) {
      const changes = (entry as { changes?: unknown[] })?.changes ?? [];
      for (const change of changes) {
        const value = (change as { value?: Record<string, unknown> })?.value;
        const list = (value?.messages as unknown[]) ?? [];
        for (const item of list) {
          const message = item as {
            from?: string;
            id?: string;
            type?: string;
            text?: { body?: string };
          };
          if (message.type !== 'text' || !message.from || !message.text?.body) continue;
          messages.push({
            from: normalizePhone(message.from),
            text: message.text.body.trim(),
            messageId: message.id ?? '',
          });
        }
      }
    }
  } catch (error) {
    logger.warn('حمولة واتساب غير متوقعة', {
      reason: error instanceof Error ? error.message : String(error),
    });
  }

  return messages;
}

/** رمز الربط: MA- ثم ثمانية محارف */
const LINK_CODE_PATTERN = /\bMA-[A-Z2-9]{4,10}\b/i;

/**
 * الردّ على رسالة واحدة. يُعيد النص المُرسَل إلى المستخدم.
 * لا يرمي أبدًا — الويب هوك يجب أن يبقى ناجحًا وإلا أعادت Meta الإرسال.
 */
export async function handleIncomingMessage(message: IncomingMessage): Promise<string> {
  const admin = createAdminClient();

  // --- ١) محاولة ربط؟ ---
  const codeMatch = message.text.match(LINK_CODE_PATTERN);
  if (codeMatch) {
    return await completeLink(admin, codeMatch[0].toUpperCase(), message.from);
  }

  // --- ٢) هوية المرسِل ---
  const { data: link } = await admin
    .from('whatsapp_links')
    .select('user_id, company_id, verified_at, messages_today, messages_day')
    .eq('phone', message.from)
    .not('verified_at', 'is', null)
    .maybeSingle();

  if (!link) return UNKNOWN_NUMBER_REPLY;

  // --- ٣) سقف يومي ---
  const today = new Date().toISOString().slice(0, 10);
  const usedToday = link.messages_day === today ? link.messages_today : 0;

  if (usedToday >= MAX_MESSAGES_PER_DAY) {
    return `بلغت الحد اليومي (${MAX_MESSAGES_PER_DAY} رسالة). تابع من المنصة، أو عد غدًا.`;
  }

  const question = message.text.slice(0, MAX_QUESTION_LENGTH);
  if (question.length < 2) return 'اكتب سؤالك من فضلك.';

  try {
    const answer = await answerForUser(admin, link.user_id, link.company_id, question);

    await admin
      .from('whatsapp_links')
      .update({
        messages_today: usedToday + 1,
        messages_day: today,
        last_used_at: new Date().toISOString(),
      })
      .eq('phone', message.from);

    return answer;
  } catch (error) {
    logger.error('تعذّرت الإجابة على رسالة واتساب', {
      reason: error instanceof Error ? error.message : String(error),
    });
    return 'تعذّر إنتاج إجابة الآن. حاول بعد قليل أو استخدم المنصة.';
  }
}

/** إتمام الربط: الرمز صالح وغير منتهٍ، والرقم غير مرتبط بحساب آخر */
async function completeLink(
  admin: ReturnType<typeof createAdminClient>,
  code: string,
  phone: string,
): Promise<string> {
  const { data: pending } = await admin
    .from('whatsapp_links')
    .select('id, user_id, code_expires_at')
    .eq('link_code', code)
    .maybeSingle();

  if (!pending) return 'رمز الربط غير صحيح. اطلب رمزًا جديدًا من المنصة.';

  if (!pending.code_expires_at || new Date(pending.code_expires_at) < new Date()) {
    return 'انتهت صلاحية الرمز. اطلب رمزًا جديدًا من المنصة.';
  }

  // رقم مرتبط بحساب آخر: لا يُنقل تلقائيًا. النقل الصامت يعني أن من
  // يحوز الهاتف يرث صلاحيات صاحبه السابق بلا علم أحد.
  const { data: taken } = await admin
    .from('whatsapp_links')
    .select('id')
    .eq('phone', phone)
    .neq('id', pending.id)
    .maybeSingle();

  if (taken) {
    return 'هذا الرقم مرتبط بحساب آخر. أزل الربط من ذلك الحساب أولًا.';
  }

  const { error } = await admin
    .from('whatsapp_links')
    .update({
      phone,
      verified_at: new Date().toISOString(),
      link_code: null,
      code_expires_at: null,
    })
    .eq('id', pending.id);

  if (error) {
    logger.error('تعذّر إتمام ربط واتساب', { reason: error.message });
    return 'تعذّر إتمام الربط. حاول مرة أخرى.';
  }

  return (
    '✅ تم ربط رقمك بحسابك.\n\n' +
    'اسألني الآن عن سياسات شركتك وإجراءاتها، وسأجيبك من مستنداتها مع ذكر المصدر.'
  );
}

/** المسار الكامل: تضمين ← استرجاع بصلاحيات المستخدم ← توليد ← تحقق */
async function answerForUser(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  companyId: string,
  question: string,
): Promise<string> {
  const [{ data: profile }, { data: company }] = await Promise.all([
    admin.from('profiles').select('full_name, role, department_id').eq('id', userId).single(),
    admin.from('companies').select('name, ai_settings').eq('id', companyId).single(),
  ]);

  if (!profile || !company) throw new Error('تعذّر جلب بيانات المستخدم');

  const aiSettings = company.ai_settings as CompanyAiSettings;
  const embedding = await embedQuery(question);

  // الدالة الخدمية تشتق الشركة والدور والقسم من المستخدم داخل قاعدة
  // البيانات — المنطق نفسه الذي يخدم المتصفح، لا نسخة ثانية منه.
  const { data: rows, error } = await admin.rpc('match_chunks_for_user', {
    p_user_id: userId,
    p_query_embedding: toPgVector(embedding),
    p_match_count: aiSettings.retrieval_top_k ?? 8,
    p_min_similarity: aiSettings.min_similarity ?? 0.3,
    p_category_ids: null,
  });

  if (error) throw new Error(error.message);

  const candidates: RetrievedChunk[] = (rows ?? []).map((row) => ({
    chunkId: row.chunk_id,
    documentId: row.document_id,
    documentName: row.document_name,
    content: row.content,
    pageNumber: row.page_number,
    sectionTitle: row.section_title,
    similarity: row.similarity,
  }));

  const chunks = selectContextChunks(candidates, aiSettings.max_context_chunks ?? 6);

  let departmentName: string | null = null;
  if (profile.department_id) {
    const { data } = await admin
      .from('departments')
      .select('name')
      .eq('id', profile.department_id)
      .maybeSingle();
    departmentName = data?.name ?? null;
  }

  const completion = await generateAnswer({
    systemPrompt: buildSystemPrompt({
      companyName: company.name,
      tone: 'concise', // واتساب وسط قصير — الإجابة الطويلة لا تُقرأ فيه
      userName: profile.full_name || 'موظف',
      userRole: ROLE_LABELS[profile.role],
      departmentName,
    }),
    history: [],
    userMessage: buildUserMessage(question, chunks),
    maxTokens: 1200,
  });

  const unanswered = chunks.length === 0 || isUnansweredResponse(completion.text);
  const raw = completion.text.trim() || 'لم أجد معلومات كافية في قاعدة معرفة الشركة.';
  const verification = verifyAnswer({ answer: raw, chunks });

  // --- الاستهلاك ---
  await admin.rpc('record_usage', {
    p_company_id: companyId,
    p_questions: 1,
    p_input_tokens: completion.inputTokens,
    p_output_tokens: completion.outputTokens,
    p_cost_usd: estimateCostUsd(
      completion.model,
      completion.inputTokens,
      completion.outputTokens,
    ),
  });

  let text = stripCitationMarkers(raw);

  // المصادر بالنص: لا روابط في واتساب — المستند خلف جدار الصلاحيات
  // ورابطه لا يُفتح خارج جلسة، فذكر الاسم والصفحة أنفع من رابط يفشل.
  if (!unanswered) {
    const cited = verification.citedIndexes
      .map((index) => chunks[index])
      .filter(Boolean)
      .slice(0, 3)
      .map((chunk) =>
        chunk.pageNumber
          ? `• ${truncate(chunk.documentName, 60)} — صفحة ${chunk.pageNumber}`
          : `• ${truncate(chunk.documentName, 60)}`,
      );

    if (cited.length > 0) text += `\n\n📄 المصدر:\n${cited.join('\n')}`;
    for (const warning of verification.warnings) text += `\n\n⚠️ ${warning}`;
  }

  return text;
}
