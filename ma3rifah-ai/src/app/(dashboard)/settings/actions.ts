'use server';

import { revalidatePath } from 'next/cache';
import { requireCompanySession, requirePermission } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { aiSettingsSchema, firstIssueMessage } from '@/lib/validation/schemas';
import { recordAudit } from '@/lib/audit';
import { AppError, toAppError } from '@/lib/errors';

export interface ActionResult {
  ok: boolean;
  message?: string;
}

export async function updateCompanyAction(formData: FormData): Promise<ActionResult> {
  try {
    const { profile, company } = await requirePermission('company.manage');

    const name = String(formData.get('name') ?? '').trim();
    const industry = String(formData.get('industry') ?? '').trim();

    if (name.length < 2 || name.length > 150) {
      throw new AppError('VALIDATION', 'اسم الشركة يجب أن يكون بين حرفين و150 حرفًا.');
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from('companies')
      .update({ name, industry: industry || null })
      .eq('id', company.id);

    if (error) throw error;

    await recordAudit({
      companyId: company.id,
      actorId: profile.id,
      actorEmail: profile.email,
      action: 'company.updated',
      entityType: 'company',
      entityId: company.id,
      metadata: { name },
    });

    revalidatePath('/settings');
    revalidatePath('/dashboard', 'layout');
    return { ok: true, message: 'تم تحديث بيانات الشركة.' };
  } catch (error) {
    return { ok: false, message: toAppError(error).message };
  }
}

export async function updateAiSettingsAction(formData: FormData): Promise<ActionResult> {
  try {
    const { profile, company } = await requirePermission('company.manage');

    const parsed = aiSettingsSchema.safeParse({
      tone: formData.get('tone'),
      retrieval_top_k: Number(formData.get('retrieval_top_k')),
      min_similarity: Number(formData.get('min_similarity')),
      max_context_chunks: Number(formData.get('max_context_chunks')),
      history_window: Number(formData.get('history_window')),
      allow_general_knowledge: formData.get('allow_general_knowledge') === 'on',
    });

    if (!parsed.success) {
      throw new AppError('VALIDATION', firstIssueMessage(parsed.error));
    }

    const settings = parsed.data;

    if (settings.max_context_chunks > settings.retrieval_top_k) {
      throw new AppError(
        'VALIDATION',
        'عدد المقاطع المُرسلة للنموذج لا يجوز أن يتجاوز عدد المقاطع المسترجعة.',
      );
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from('companies')
      .update({ ai_settings: settings })
      .eq('id', company.id);

    if (error) throw error;

    await recordAudit({
      companyId: company.id,
      actorId: profile.id,
      actorEmail: profile.email,
      action: 'company.ai_settings_updated',
      entityType: 'company',
      entityId: company.id,
      metadata: settings,
    });

    revalidatePath('/settings');
    return { ok: true, message: 'تم حفظ إعدادات المساعد.' };
  } catch (error) {
    return { ok: false, message: toAppError(error).message };
  }
}

export async function updateProfileAction(formData: FormData): Promise<ActionResult> {
  try {
    const { profile } = await requireCompanySession();

    const fullName = String(formData.get('fullName') ?? '').trim();
    const jobTitle = String(formData.get('jobTitle') ?? '').trim();

    if (fullName.length < 2 || fullName.length > 120) {
      throw new AppError('VALIDATION', 'الاسم يجب أن يكون بين حرفين و120 حرفًا.');
    }

    const supabase = await createClient();
    // RLS تسمح للمستخدم بتعديل بياناته الشخصية فقط دون دوره أو حالته
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName, job_title: jobTitle || null })
      .eq('id', profile.id);

    if (error) throw error;

    revalidatePath('/settings/profile');
    revalidatePath('/dashboard', 'layout');
    return { ok: true, message: 'تم تحديث ملفك الشخصي.' };
  } catch (error) {
    return { ok: false, message: toAppError(error).message };
  }
}
