'use server';

import { revalidatePath } from 'next/cache';
import { requireSuperAdmin } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { recordAudit } from '@/lib/audit';
import { AppError, toAppError } from '@/lib/errors';
import { planUpsertSchema, firstIssueMessage } from '@/lib/validation/schemas';

export interface ActionResult {
  ok: boolean;
  message?: string;
}

export async function setCompanyStatusAction(
  companyId: string,
  status: 'ACTIVE' | 'SUSPENDED',
): Promise<ActionResult> {
  try {
    const session = await requireSuperAdmin();
    const admin = createAdminClient();

    const { error } = await admin.from('companies').update({ status }).eq('id', companyId);
    if (error) throw error;

    await recordAudit({
      companyId,
      actorId: session.profile.id,
      actorEmail: session.profile.email,
      action: 'company.updated',
      entityType: 'company',
      entityId: companyId,
      metadata: { status },
    });

    revalidatePath('/admin/companies');
    revalidatePath('/admin');

    return {
      ok: true,
      message: status === 'ACTIVE' ? 'تم تفعيل الشركة.' : 'تم إيقاف الشركة.',
    };
  } catch (error) {
    return { ok: false, message: toAppError(error).message };
  }
}

/**
 * حفظ خطة — إنشاءً أو تعديلًا.
 *
 * محصور بمالك المنصة: الأسعار والحدود التي تُكتب هنا هي التي يراها كل
 * زائر على صفحة الأسعار، وهي التي تُقاس عليها حدود كل شركة مشتركة.
 *
 * وتُبطَل ذاكرة صفحتَي الأسعار والرئيسية بعد الحفظ، وإلا بقي السعر
 * القديم معروضًا للزوّار بعد تغييره — وهو أسوأ من عدم التغيير أصلًا،
 * لأن البائع يظن أنه غيّر والمشتري يرى غير ذلك.
 */
export async function upsertPlanAction(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireSuperAdmin();

    const parsed = planUpsertSchema.safeParse({
      planId: formData.get('planId') || null,
      code: formData.get('code'),
      name: formData.get('name'),
      description: formData.get('description') ?? '',
      priceAmount: formData.get('priceAmount') ?? '',
      currency: formData.get('currency') || 'SAR',
      maxUsers: formData.get('maxUsers') ?? '',
      maxDocuments: formData.get('maxDocuments') ?? '',
      maxQuestionsMonthly: formData.get('maxQuestionsMonthly') ?? '',
      maxStorageMb: formData.get('maxStorageMb') ?? '',
      features: formData.get('features') ?? '',
      isPublic: formData.get('isPublic') === 'on',
      isCustomPriced: formData.get('isCustomPriced') === 'on',
      sortOrder: formData.get('sortOrder') || 0,
    });

    if (!parsed.success) {
      throw new AppError('VALIDATION', firstIssueMessage(parsed.error));
    }

    const input = parsed.data;
    const admin = createAdminClient();

    const row = {
      code: input.code,
      name: input.name,
      description: input.description || null,
      // الخطة «حسب الطلب» لا سعر لها — لو بقي رقم قديم لعُرض الاثنان معًا
      price_amount: input.isCustomPriced ? null : input.priceAmount,
      currency: input.currency,
      max_users: input.maxUsers,
      max_documents: input.maxDocuments,
      max_questions_monthly: input.maxQuestionsMonthly,
      max_storage_mb: input.maxStorageMb,
      features: input.features
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0),
      is_public: input.isPublic,
      is_custom_priced: input.isCustomPriced,
      sort_order: input.sortOrder,
    };

    const { error } = input.planId
      ? await admin.from('plans').update(row).eq('id', input.planId)
      : await admin.from('plans').insert(row);

    if (error) {
      // الرمز مفتاح فريد، وتصادمه أشيع خطأ هنا
      if (error.code === '23505') {
        throw new AppError('VALIDATION', 'يوجد خطة بهذا الرمز مسبقًا. اختر رمزًا آخر.');
      }
      throw error;
    }

    await recordAudit({
      companyId: null,
      actorId: session.profile.id,
      actorEmail: session.profile.email,
      action: input.planId ? 'plan.updated' : 'plan.created',
      entityType: 'plan',
      entityId: input.planId ?? null,
      metadata: { code: input.code, isPublic: input.isPublic },
    });

    revalidatePath('/admin/plans');
    revalidatePath('/pricing');
    revalidatePath('/');

    return { ok: true, message: input.planId ? 'تم حفظ الخطة.' : 'تمت إضافة الخطة.' };
  } catch (error) {
    return { ok: false, message: toAppError(error).message };
  }
}

/**
 * إخفاء خطة أو إظهارها.
 *
 * لا حذف: الخطة المحذوفة تكسر اشتراكات قائمة تشير إليها. الإخفاء يمنعها
 * من صفحة الأسعار ويُبقي من اشترك بها على ما اتفق عليه.
 */
export async function setPlanVisibilityAction(
  planId: string,
  isPublic: boolean,
): Promise<ActionResult> {
  try {
    const session = await requireSuperAdmin();
    const admin = createAdminClient();

    const { error } = await admin.from('plans').update({ is_public: isPublic }).eq('id', planId);
    if (error) throw error;

    await recordAudit({
      companyId: null,
      actorId: session.profile.id,
      actorEmail: session.profile.email,
      action: 'plan.updated',
      entityType: 'plan',
      entityId: planId,
      metadata: { isPublic },
    });

    revalidatePath('/admin/plans');
    revalidatePath('/pricing');
    revalidatePath('/');

    return { ok: true, message: isPublic ? 'صارت الخطة معروضة.' : 'أُخفيت الخطة.' };
  } catch (error) {
    return { ok: false, message: toAppError(error).message };
  }
}
