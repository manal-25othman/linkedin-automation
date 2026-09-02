'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireCompanySession } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { enforceRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { firstIssueMessage } from '@/lib/validation/schemas';
import { recordAudit } from '@/lib/audit';
import { AppError, toAppError } from '@/lib/errors';
import { logger } from '@/lib/logger';

export interface ActionResult {
  ok: boolean;
  message?: string;
}

const rating = z.coerce.number().int().min(1, 'اختر تقييمًا.').max(5, 'اختر تقييمًا.');

export const feedbackSurveySchema = z.object({
  overallRating: rating,
  foundAnswers: z.enum(['MOSTLY', 'SOMETIMES', 'RARELY'], {
    message: 'أجب عن سؤال الإجابات.',
  }),
  recommendRating: rating,
  mostUseful: z.string().trim().max(1000, 'النص طويل جدًا.').optional().default(''),
  missing: z.string().trim().max(1000, 'النص طويل جدًا.').optional().default(''),
  allowContact: z.boolean(),
});

/**
 * حفظ الاستبيان — إجابة واحدة لكل مستخدم تُعدَّل إن أُعيد إرسالها.
 *
 * الشركة والمستخدم من الجلسة لا من النموذج، وسياسة الإدراج تتحقق منهما
 * مرة أخرى. لا يُسجَّل في التدقيق نصّ الإجابات — وجودها فقط.
 */
export async function submitFeedbackSurveyAction(formData: FormData): Promise<ActionResult> {
  try {
    const { profile, company } = await requireCompanySession();
    await enforceRateLimit(`survey:${profile.id}`, RATE_LIMITS.mutation);

    const parsed = feedbackSurveySchema.safeParse({
      overallRating: formData.get('overallRating'),
      foundAnswers: formData.get('foundAnswers'),
      recommendRating: formData.get('recommendRating'),
      mostUseful: formData.get('mostUseful') ?? '',
      missing: formData.get('missing') ?? '',
      allowContact: formData.get('allowContact') === 'on',
    });

    if (!parsed.success) {
      throw new AppError('VALIDATION', firstIssueMessage(parsed.error));
    }

    const input = parsed.data;
    const supabase = await createClient();

    const { error } = await supabase.from('feedback_surveys').upsert(
      {
        company_id: company.id,
        user_id: profile.id,
        role: profile.role,
        overall_rating: input.overallRating,
        found_answers: input.foundAnswers,
        recommend_rating: input.recommendRating,
        most_useful: input.mostUseful || null,
        missing: input.missing || null,
        allow_contact: input.allowContact,
      },
      { onConflict: 'user_id' },
    );

    if (error) {
      logger.error('تعذّر حفظ الاستبيان', { reason: error.message });
      throw new AppError('INTERNAL', 'تعذّر حفظ إجاباتك. حاول مرة أخرى.');
    }

    await recordAudit({
      companyId: company.id,
      actorId: profile.id,
      actorEmail: profile.email,
      action: 'feedback_survey.submitted',
      entityType: 'feedback_survey',
      entityId: profile.id,
      metadata: { overallRating: input.overallRating },
    });

    revalidatePath('/feedback');
    revalidatePath('/assistant');
    return { ok: true, message: 'شكرًا لك — وصلنا رأيك.' };
  } catch (error) {
    return { ok: false, message: toAppError(error).displayMessage };
  }
}
