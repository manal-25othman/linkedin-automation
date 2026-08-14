'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { knowledgeGapUpdateSchema, firstIssueMessage } from '@/lib/validation/schemas';
import { recordAudit } from '@/lib/audit';
import { upsertCuratedAnswer, removeCuratedAnswer } from '@/lib/rag/curated-answer';
import { notifyUsers } from '@/lib/notifications';
import { AppError, toAppError } from '@/lib/errors';

export interface ActionResult {
  ok: boolean;
  message?: string;
}

const STATUS_MESSAGES: Record<string, string> = {
  OPEN: 'تم إعادة فتح الفجوة.',
  IN_REVIEW: 'تم نقل الفجوة إلى قيد المراجعة.',
  RESOLVED: 'تم وضع علامة معالَجة على الفجوة.',
  DISMISSED: 'تم تجاهل الفجوة.',
};

export async function updateKnowledgeGapAction(formData: FormData): Promise<ActionResult> {
  try {
    const { profile, company } = await requirePermission('knowledge_gaps.manage');

    const parsed = knowledgeGapUpdateSchema.safeParse({
      gapId: formData.get('gapId'),
      status: formData.get('status'),
      resolutionNote: formData.get('resolutionNote'),
      linkedDocumentId: formData.get('linkedDocumentId') || null,
      answerText: formData.get('answerText'),
    });

    if (!parsed.success) {
      throw new AppError('VALIDATION', firstIssueMessage(parsed.error));
    }

    const input = parsed.data;
    const isResolved = input.status === 'RESOLVED';

    if (isResolved && !input.answerText && !input.resolutionNote && !input.linkedDocumentId) {
      throw new AppError(
        'VALIDATION',
        'عند وضع علامة معالَجة، اكتب إجابة معتمدة أو اربط مستندًا أو اكتب ملاحظة.',
      );
    }

    const supabase = await createClient();

    // الفجوة تخصّ الشركة الحالية — تتكفّل RLS بالمنع، والقراءة هنا
    // لأننا نحتاج نصّ السؤال وقائمة من سألوه.
    const { data: gap } = await supabase
      .from('knowledge_gaps')
      .select('id, question, answer_document_id')
      .eq('id', input.gapId)
      .maybeSingle();

    if (!gap) {
      throw new AppError('NOT_FOUND', 'الفجوة غير موجودة.');
    }

    // --- الإجابة المعتمدة: تدخل قاعدة المعرفة فيجدها البحث ---
    // هذا ما يحوّل الفجوة من تشخيص إلى حلّ. بدونه يُكتب الجواب ويُخزَّن
    // ولا يراه أحد، ويسمع الموظف «لم أجد معلومات» عن سؤال أُجيب عنه.
    let answerDocumentId = gap.answer_document_id;

    if (input.answerText) {
      answerDocumentId = await upsertCuratedAnswer({
        companyId: company.id,
        gapId: input.gapId,
        question: gap.question,
        answer: input.answerText,
        authorId: profile.id,
      });
    } else if (answerDocumentId && input.status === 'OPEN') {
      // أُعيدت الفجوة مفتوحة ⇒ لا يصحّ أن يبقى جوابها في قاعدة المعرفة
      await removeCuratedAnswer(company.id, answerDocumentId);
      answerDocumentId = null;
    }

    const { error } = await supabase
      .from('knowledge_gaps')
      .update({
        status: input.status,
        resolution_note: input.resolutionNote || null,
        linked_document_id: input.linkedDocumentId || null,
        answer_text: input.answerText || null,
        answer_document_id: answerDocumentId,
        resolved_by: isResolved ? profile.id : null,
        resolved_at: isResolved ? new Date().toISOString() : null,
      })
      .eq('id', input.gapId);

    if (error) throw error;

    await recordAudit({
      companyId: company.id,
      actorId: profile.id,
      actorEmail: profile.email,
      action: isResolved ? 'knowledge_gap.resolved' : 'knowledge_gap.status_changed',
      entityType: 'knowledge_gap',
      entityId: input.gapId,
      metadata: { status: input.status, hasCuratedAnswer: Boolean(input.answerText) },
    });

    // --- إغلاق الدائرة مع من سأل ---
    // بلا هذا يُجاب السؤال ولا يعلم صاحبه، فلا يعود ليسأل، ويبقى
    // انطباعه أن المنصة لم تعرف الجواب.
    if (isResolved) {
      const { data: askers } = await supabase
        .from('knowledge_gap_askers')
        .select('user_id')
        .eq('gap_id', input.gapId);

      await notifyUsers({
        companyId: company.id,
        userIds: (askers ?? []).map((row) => row.user_id).filter((id) => id !== profile.id),
        type: 'GAP_ANSWERED',
        title: 'سؤالك صار له إجابة',
        body: gap.question,
        link: '/assistant',
        entityType: 'knowledge_gap',
        entityId: input.gapId,
      });
    }

    revalidatePath('/knowledge-gaps');
    revalidatePath('/dashboard');

    return { ok: true, message: STATUS_MESSAGES[input.status] ?? 'تم تحديث الفجوة.' };
  } catch (error) {
    return { ok: false, message: toAppError(error).message };
  }
}
