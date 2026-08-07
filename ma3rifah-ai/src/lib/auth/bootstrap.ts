import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { DEFAULT_DEPARTMENTS, DEFAULT_CATEGORIES } from '@/lib/config/defaults';
import { DEFAULT_PLAN_CODE, TRIAL_PERIOD_DAYS } from '@/lib/config/plans';
import { slugify } from '@/lib/utils';
import { logger } from '@/lib/logger';
import { AppError } from '@/lib/errors';

/**
 * تجهيز شركة جديدة بعد تسجيل أول مستخدم فيها.
 *
 * يعمل بمفتاح الخدمة لأن المستخدم في هذه اللحظة بلا شركة، فلا تسمح له
 * سياسات RLS بإنشاء واحدة. المعرّف يأتي من Supabase Auth بعد تسجيل
 * ناجح، لا من مدخلات العميل.
 */
export async function bootstrapCompany(params: {
  userId: string;
  email: string;
  fullName: string;
  companyName: string;
  jobTitle?: string;
}): Promise<{ companyId: string }> {
  const admin = createAdminClient();

  // لا نُنشئ شركة ثانية لمستخدم لديه شركة
  const { data: existingProfile } = await admin
    .from('profiles')
    .select('company_id')
    .eq('id', params.userId)
    .maybeSingle();

  if (existingProfile?.company_id) {
    return { companyId: existingProfile.company_id };
  }

  // slug فريد
  const baseSlug = slugify(params.companyName);
  let slug = baseSlug;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data: taken } = await admin
      .from('companies')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
    if (!taken) break;
    slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
  }

  const { data: company, error: companyError } = await admin
    .from('companies')
    .insert({ name: params.companyName, slug })
    .select('id')
    .single();

  if (companyError || !company) {
    logger.error('تعذّر إنشاء الشركة', { reason: companyError?.message });
    throw new AppError('INTERNAL', 'تعذّر إنشاء الشركة. حاول مرة أخرى.');
  }

  const companyId = company.id;

  // الأقسام الافتراضية
  const { data: departments } = await admin
    .from('departments')
    .insert(
      DEFAULT_DEPARTMENTS.map((department) => ({
        company_id: companyId,
        name: department.name,
        code: department.code,
        description: department.description,
      })),
    )
    .select('id, code');

  // تصنيفات المعرفة الافتراضية
  await admin.from('knowledge_categories').insert(
    DEFAULT_CATEGORIES.map((category) => ({
      company_id: companyId,
      name: category.name,
      description: category.description,
      color: category.color,
      sort_order: category.sort_order,
    })),
  );

  // المستخدم الأول يصبح مدير الشركة، ويُسند إلى قسم الإدارة
  const managementDepartment = departments?.find((department) => department.code === 'MGMT');

  const { error: profileError } = await admin
    .from('profiles')
    .update({
      company_id: companyId,
      department_id: managementDepartment?.id ?? null,
      full_name: params.fullName,
      email: params.email,
      job_title: params.jobTitle || null,
      role: 'COMPANY_ADMIN',
      status: 'ACTIVE',
    })
    .eq('id', params.userId);

  if (profileError) {
    logger.error('تعذّر تحديث ملف المستخدم', { reason: profileError.message });
    throw new AppError('INTERNAL', 'تعذّر إكمال تجهيز الحساب.');
  }

  // اشتراك تجريبي على الخطة الافتراضية
  const { data: plan } = await admin
    .from('plans')
    .select('id')
    .eq('code', DEFAULT_PLAN_CODE)
    .maybeSingle();

  if (plan) {
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + TRIAL_PERIOD_DAYS);

    await admin.from('subscriptions').insert({
      company_id: companyId,
      plan_id: plan.id,
      status: 'TRIALING',
      trial_ends_at: trialEnd.toISOString(),
      current_period_end: trialEnd.toISOString(),
    });
  } else {
    logger.warn('الخطة الافتراضية غير موجودة — الشركة بلا اشتراك', {
      planCode: DEFAULT_PLAN_CODE,
    });
  }

  logger.info('تم تجهيز شركة جديدة', { companyId, slug });

  return { companyId };
}
