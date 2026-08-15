'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { knowledgeGapUpdateSchema, firstIssueMessage } from '@/lib/validation/schemas';
import { recordAudit } from '@/lib/audit';
import { upsertCuratedAnswer, removeCuratedAnswer } from '@/lib/rag/curated-answer';
import { notifyUsers, clearEntityNotifications } from '@/lib/notifications';
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

      // ويُمحى معه تنبيه «صار له إجابة» — إجابةٌ سُحبت لا يجوز أن يبقى
      // إشعارها قائمًا، ولا أن يسدّ الفهرسُ الفريد طريقَ تنبيهٍ لاحق.
      await clearEntityNotifications({
        companyId: company.id,
        type: 'GAP_ANSWERED',
        entityId: input.gapId,
      });
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
    //
    // المُطلِق هو وجود الإجابة لا اسم الحالة. كان التنبيه معلّقًا على
    // RESOLVED وحدها بينما تفتح النافذة على «قيد المراجعة»، فالمسار
    // الطبيعي — يفتح المدير الفجوة، يكتب الإجابة، يحفظ — كان ينشر
    // الإجابة في قاعدة المعرفة ولا يخبر صاحب السؤال أبدًا.
    const hasAnswer = Boolean(answerDocumentId || input.answerText);
    let notice = '';

    if (hasAnswer || isResolved) {
      const { data: askers } = await supabase
        .from('knowledge_gap_askers')
        .select('user_id')
        .eq('gap_id', input.gapId);

      const askerIds = (askers ?? []).map((row) => row.user_id);
      // لا يُنبَّه المجيب على إجابة نفسه
      const recipients = askerIds.filter((id) => id !== profile.id);

      // نصّ الإجابة في متن التنبيه: أقصر طريق بين السؤال وجوابه. وإلا
      // فالملاحظة، وإلا فالسؤال نفسه تذكيرًا بما يُشار إليه.
      const detail = input.answerText || input.resolutionNote || gap.question;

      const notified = await notifyUsers({
        companyId: company.id,
        userIds: recipients,
        type: 'GAP_ANSWERED',
        title: `إجابة على سؤالك: ${gap.question}`,
        body: detail,
        link: '/assistant',
        entityType: 'knowledge_gap',
        entityId: input.gapId,
      });

      // --- لماذا يُقال هذا للمدير ---
      // «تم الحفظ» وحدها تُخفي الفرق بين إجابةٍ بلغت صاحبها وإجابةٍ لم
      // تبلغ أحدًا. والفرق هو كل الغاية من الشاشة: المدير يظن أنه أغلق
      // الدائرة بينما الموظف لا يعلم شيئًا — وهذا بالضبط ما لا يُكتشف
      // إلا بعد أسابيع، إن اكتُشف.
      if (notified > 0) {
        notice = ` وصل التنبيه إلى ${notified} ${notified === 1 ? 'سائل' : 'من السائلين'}.`;
      } else if (askerIds.length > 0 && recipients.length === 0) {
        notice = ' لم يُرسَل تنبيه — أنت صاحب السؤال الوحيد.';
      } else if (askerIds.length === 0) {
        notice =
          ' لم يُسجَّل صاحب لهذا السؤال، فلم يصل تنبيه. الأسئلة الجديدة تُسجَّل تلقائيًا.';
      } else {
        notice = ' تعذّر إرسال التنبيه إلى السائلين.';
      }
    }

    revalidatePath('/knowledge-gaps');
    revalidatePath('/dashboard');

    return {
      ok: true,
      message: `${STATUS_MESSAGES[input.status] ?? 'تم تحديث الفجوة.'}${notice}`,
    };
  } catch (error) {
    return { ok: false, message: toAppError(error).message };
  }
}
