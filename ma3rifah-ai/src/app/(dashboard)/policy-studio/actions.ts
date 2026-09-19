'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { recordAudit } from '@/lib/audit';
import { enforceRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { AppError, toAppError } from '@/lib/errors';
import { retrieveRelevantChunks } from '@/lib/rag/retrieval';
import { recordAiUsage } from '@/lib/ai/usage';
import { generateClarifyingQuestions, generatePolicyDraft } from '@/lib/knowledge/policy-studio';
import { publishPolicyDraft } from '@/lib/knowledge/publish-policy';
import { truncate } from '@/lib/utils';
import { logger } from '@/lib/logger';
import type { CompanyAiSettings, PolicyClarification } from '@/types/database';

/**
 * إجراءات استوديو السياسات.
 *
 * كلها خلف `documents.manage` — وهي صلاحية مدير الشركة وحده. ولم
 * تُنشأ صلاحية جديدة: السياسة تنتهي مستندًا في قاعدة المعرفة، ومن
 * يملك إدارة المستندات يملك هذا بطبيعته. وصلاحية لكل ميزة تُنتج
 * جدولًا لا يقرؤه أحد ويُخطئ فيه الجميع.
 */

export interface ActionResult {
  ok: boolean;
  message?: string;
  draftId?: string;
}

const MAX_TITLE = 140;
const MAX_TOPIC = 200;
const MAX_ANSWER = 600;

/** ١) بدء مسوّدة: يولّد أسئلة المعالج ويحفظ الصفّ */
export async function startPolicyDraftAction(formData: FormData): Promise<ActionResult> {
  try {
    const { profile, company } = await requirePermission('documents.manage');
    await enforceRateLimit(`policy-start:${profile.id}`, RATE_LIMITS.chat);

    const title = String(formData.get('title') ?? '').trim();
    const topic = String(formData.get('topic') ?? '').trim() || title;
    const gapId = String(formData.get('gapId') ?? '').trim() || null;

    if (title.length < 4 || title.length > MAX_TITLE) {
      throw new AppError('VALIDATION', 'اكتب عنوانًا واضحًا للسياسة.');
    }
    if (topic.length > MAX_TOPIC) {
      throw new AppError('VALIDATION', 'الموضوع طويل جدًا.');
    }

    const questions = await generateClarifyingQuestions(topic, company.name);
    const clarifications: PolicyClarification[] = questions.map((question) => ({
      question,
      answer: '',
    }));

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('policy_drafts')
      .insert({
        company_id: company.id,
        gap_id: gapId,
        title,
        topic,
        clarifications,
        created_by: profile.id,
      })
      .select('id')
      .single();

    if (error || !data) {
      logger.error('تعذّر إنشاء مسوّدة سياسة', { reason: error?.message });
      return { ok: false, message: 'تعذّر بدء المسوّدة.' };
    }

    await recordAudit({
      companyId: company.id,
      actorId: profile.id,
      actorEmail: profile.email,
      action: 'policy.draft_started',
      entityType: 'policy_draft',
      entityId: data.id,
    });

    revalidatePath('/policy-studio');
    return { ok: true, draftId: data.id };
  } catch (error) {
    return { ok: false, message: toAppError(error).displayMessage };
  }
}

/** ٢) حفظ أجوبة المعالج ثم توليد المسوّدة */
export async function generatePolicyDraftAction(formData: FormData): Promise<ActionResult> {
  try {
    const { profile, company } = await requirePermission('documents.manage');
    await enforceRateLimit(`policy-generate:${profile.id}`, RATE_LIMITS.chat);

    const draftId = String(formData.get('draftId') ?? '').trim();
    if (!draftId) throw new AppError('VALIDATION', 'المسوّدة غير محدّدة.');

    const supabase = await createClient();
    const { data: draft } = await supabase
      .from('policy_drafts')
      .select('id, title, topic, clarifications, status')
      .eq('id', draftId)
      .maybeSingle();

    if (!draft) throw new AppError('NOT_FOUND', 'المسوّدة غير موجودة.');
    if (draft.status !== 'DRAFT') {
      throw new AppError('VALIDATION', 'المسوّدة معتمدة — لا تُعاد كتابتها.');
    }

    // أجوبة المدير تأتي مرقّمة بترتيب الأسئلة المحفوظة
    const clarifications: PolicyClarification[] = draft.clarifications.map(
      (item, index) => ({
        question: item.question,
        answer: truncate(String(formData.get(`answer-${index}`) ?? '').trim(), MAX_ANSWER),
      }),
    );

    const aiSettings = company.ai_settings as CompanyAiSettings;
    const retrieval = await retrieveRelevantChunks(supabase, draft.topic, aiSettings);

    const result = await generatePolicyDraft({
      companyName: company.name,
      title: draft.title,
      topic: draft.topic,
      clarifications,
      companyChunks: retrieval.chunks,
    });

    const { error } = await supabase
      .from('policy_drafts')
      .update({
        clarifications,
        body: result.body,
        citations: result.citations,
        updated_at: new Date().toISOString(),
      })
      .eq('id', draftId);

    if (error) {
      logger.error('تعذّر حفظ المسوّدة المولَّدة', { reason: error.message });
      return { ok: false, message: 'تعذّر حفظ المسوّدة.' };
    }

    await recordAiUsage({
      companyId: company.id,
      userId: profile.id,
      operation: 'chat',
      provider: 'anthropic',
      model: 'policy-studio',
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
      latencyMs: 0,
      // عمل إداري لا يُحسب على حصّة أسئلة الموظفين — كما في مسوّدة
      // الفجوة سواءً بسواء.
      countsAsQuestion: false,
    }).catch(() => undefined);

    revalidatePath('/policy-studio');
    return {
      ok: true,
      message: result.withoutReferences
        ? 'كُتبت المسوّدة من وثائق شركتك وحدها — المكتبة المرجعية لم تُطابق شيئًا، فراجع الجمل النظامية بعناية.'
        : 'كُتبت المسوّدة. راجعها وحرّرها قبل الاعتماد.',
    };
  } catch (error) {
    return { ok: false, message: toAppError(error).displayMessage };
  }
}

/** ٣) حفظ تحرير المدير — الدالّة تؤرّخ النسخة في المعاملة نفسها */
export async function savePolicyDraftAction(formData: FormData): Promise<ActionResult> {
  try {
    const { profile, company } = await requirePermission('documents.manage');

    const draftId = String(formData.get('draftId') ?? '').trim();
    const body = String(formData.get('body') ?? '');
    if (!draftId) throw new AppError('VALIDATION', 'المسوّدة غير محدّدة.');

    const supabase = await createClient();
    const { error } = await supabase.rpc('save_policy_draft_version', {
      p_draft_id: draftId,
      p_body: body,
      p_note: String(formData.get('note') ?? '').trim() || null,
    });

    if (error) {
      const message = error.message.includes('draft_too_short')
        ? 'نصّ السياسة قصير جدًا.'
        : error.message.includes('draft_not_editable')
          ? 'المسوّدة معتمدة أو ليست لشركتك.'
          : 'تعذّر حفظ التعديل.';
      return { ok: false, message };
    }

    await recordAudit({
      companyId: company.id,
      actorId: profile.id,
      actorEmail: profile.email,
      action: 'policy.draft_edited',
      entityType: 'policy_draft',
      entityId: draftId,
    });

    revalidatePath('/policy-studio');
    return { ok: true, message: 'حُفظ التعديل ونسخته.' };
  } catch (error) {
    return { ok: false, message: toAppError(error).displayMessage };
  }
}

/** ٤) الاعتماد والنشر — الخطوة الوحيدة التي تُدخل النصّ قاعدة المعرفة */
export async function approvePolicyDraftAction(formData: FormData): Promise<ActionResult> {
  try {
    const { profile, company } = await requirePermission('documents.manage');
    await enforceRateLimit(`policy-approve:${profile.id}`, RATE_LIMITS.mutation);

    const draftId = String(formData.get('draftId') ?? '').trim();
    if (!draftId) throw new AppError('VALIDATION', 'المسوّدة غير محدّدة.');

    const supabase = await createClient();
    const { data: draft } = await supabase
      .from('policy_drafts')
      .select('id, title, body, status, gap_id')
      .eq('id', draftId)
      .maybeSingle();

    if (!draft) throw new AppError('NOT_FOUND', 'المسوّدة غير موجودة.');
    if (draft.status !== 'DRAFT') {
      throw new AppError('VALIDATION', 'المسوّدة معتمدة بالفعل.');
    }

    // النشر أولًا: لو فشلت الفهرسة بعد وسم الاعتماد، لبقيت سياسة
    // «معتمدة» لا يجدها أحد — وهو أسوأ من فشلٍ معلن.
    const documentId = await publishPolicyDraft({
      companyId: company.id,
      draftId: draft.id,
      title: draft.title,
      body: draft.body,
      approverId: profile.id,
    });

    const { error } = await supabase
      .from('policy_drafts')
      .update({
        status: 'APPROVED',
        approved_by: profile.id,
        approved_at: new Date().toISOString(),
        document_id: documentId,
      })
      .eq('id', draftId);

    if (error) {
      logger.error('نُشرت السياسة ولم يُسجَّل اعتمادها', { reason: error.message });
      return { ok: false, message: 'نُشرت السياسة ولم يُسجَّل الاعتماد. راجع السجلّ.' };
    }

    await recordAudit({
      companyId: company.id,
      actorId: profile.id,
      actorEmail: profile.email,
      action: 'policy.approved',
      entityType: 'policy_draft',
      entityId: draftId,
    });

    revalidatePath('/policy-studio');
    revalidatePath('/documents');
    return { ok: true, message: 'اعتُمدت السياسة ودخلت قاعدة المعرفة.' };
  } catch (error) {
    return { ok: false, message: toAppError(error).displayMessage };
  }
}

/** ٥) إهمال مسوّدة — لا تُحذف: سجلّ ما لم يُعتمد جزء من التدقيق */
export async function discardPolicyDraftAction(formData: FormData): Promise<ActionResult> {
  try {
    const { profile, company } = await requirePermission('documents.manage');
    const draftId = String(formData.get('draftId') ?? '').trim();
    if (!draftId) throw new AppError('VALIDATION', 'المسوّدة غير محدّدة.');

    const supabase = await createClient();
    const { error } = await supabase
      .from('policy_drafts')
      .update({ status: 'DISCARDED', updated_at: new Date().toISOString() })
      .eq('id', draftId)
      .eq('status', 'DRAFT');

    if (error) return { ok: false, message: 'تعذّر إهمال المسوّدة.' };

    await recordAudit({
      companyId: company.id,
      actorId: profile.id,
      actorEmail: profile.email,
      action: 'policy.draft_discarded',
      entityType: 'policy_draft',
      entityId: draftId,
    });

    revalidatePath('/policy-studio');
    return { ok: true, message: 'أُهملت المسوّدة.' };
  } catch (error) {
    return { ok: false, message: toAppError(error).displayMessage };
  }
}
