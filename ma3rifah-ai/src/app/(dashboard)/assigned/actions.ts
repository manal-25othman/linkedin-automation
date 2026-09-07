'use server';

import { revalidatePath } from 'next/cache';
import { requireCompanySession } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { expertAnswerSchema, firstIssueMessage } from '@/lib/validation/schemas';
import { notifyCompanyAdmins, clearEntityNotifications } from '@/lib/notifications';
import { recordAudit } from '@/lib/audit';
import { AppError, toAppError } from '@/lib/errors';
import { truncate } from '@/lib/utils';

export interface ActionResult {
  ok: boolean;
  message?: string;
}

/**
 * جواب الخبير على سؤال أُسنِد إليه.
 *
 * لا يمرّ بجلسة صلاحيات: الخبير قد يكون موظفًا لا يملك
 * `knowledge_gaps.manage`، والحقّ هنا مصدره **الإسناد** لا الدور.
 * ولذلك لا تُكتب الصفّ من هنا مباشرة: تُنادى دالّة قاعدة البيانات
 * التي تتحقّق أن المنادي هو المُسنَد إليه وأن الصفّ في شركته، وتكتب
 * عمودين لا غير. فلو أخطأ هذا الملف يومًا بقي الحارس قائمًا.
 *
 * والمسوّدة لا تدخل قاعدة المعرفة: يعتمدها المدير من شاشة الفجوات
 * بالمسار القائم نفسه، فيبقى قرار النشر بيد واحدة.
 */
export async function submitExpertAnswerAction(formData: FormData): Promise<ActionResult> {
  try {
    const { profile, company } = await requireCompanySession();

    const parsed = expertAnswerSchema.safeParse({
      gapId: formData.get('gapId'),
      answer: formData.get('answer'),
    });

    if (!parsed.success) {
      throw new AppError('VALIDATION', firstIssueMessage(parsed.error));
    }

    const { gapId, answer } = parsed.data;
    const supabase = await createClient();

    // السؤال للتنبيه — وسياسة القراءة لا تُظهره إلا لمن أُسنِد إليه
    const { data: gap } = await supabase
      .from('knowledge_gaps')
      .select('id, question')
      .eq('id', gapId)
      .maybeSingle();

    if (!gap) {
      throw new AppError('NOT_FOUND', 'هذا السؤال لم يعد موجَّهًا إليك.');
    }

    const { data: written, error } = await supabase.rpc('submit_expert_answer', {
      p_gap_id: gapId,
      p_answer: answer,
    });

    if (error) throw error;
    if (!written) {
      throw new AppError('FORBIDDEN', 'هذا السؤال لم يعد موجَّهًا إليك.');
    }

    await recordAudit({
      companyId: company.id,
      actorId: profile.id,
      actorEmail: profile.email,
      action: 'knowledge_gap.expert_answered',
      entityType: 'knowledge_gap',
      entityId: gapId,
    });

    // مسوّدة سابقة عن الفجوة نفسها تسدّ الفهرس الفريد أمام تنبيه جديد
    await clearEntityNotifications({
      companyId: company.id,
      type: 'GAP_EXPERT_ANSWERED',
      entityId: gapId,
    });

    await notifyCompanyAdmins({
      companyId: company.id,
      type: 'GAP_EXPERT_ANSWERED',
      title: `جواب بانتظار اعتمادك: ${truncate(gap.question, 90)}`,
      body: `أجاب ${profile.full_name}. راجع الجواب واعتمده لينشر في قاعدة المعرفة.`,
      link: '/knowledge-gaps',
      entityType: 'knowledge_gap',
      entityId: gapId,
    });

    revalidatePath('/assigned');
    revalidatePath('/knowledge-gaps');

    return {
      ok: true,
      message: 'وصل جوابك إلى مدير الشركة. لن يظهر للموظفين قبل اعتماده.',
    };
  } catch (error) {
    return { ok: false, message: toAppError(error).displayMessage };
  }
}
