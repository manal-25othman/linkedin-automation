'use server';

import { revalidatePath } from 'next/cache';
import { randomBytes } from 'node:crypto';
import { requirePermission } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { userInviteSchema, userUpdateSchema, firstIssueMessage } from '@/lib/validation/schemas';
import { recordAudit } from '@/lib/audit';
import { AppError, toAppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { serverEnv } from '@/lib/env';

export interface ActionResult {
  ok: boolean;
  message?: string;
  /** كلمة مرور مؤقتة تُعرض مرة واحدة حين يتعذّر إرسال البريد */
  temporaryPassword?: string;
}

/**
 * كلمة مرور أولية للحساب الجديد.
 *
 * في المسار الطبيعي لا يراها أحد إطلاقًا — لا المدير ولا الموظف: الحساب
 * يُنشأ بها ثم يصل الموظفَ رابطٌ يضع به كلمة مروره بنفسه. وجودها ضرورة
 * تقنية فحسب، لأن الحساب لا يُنشأ بلا كلمة.
 *
 * ولا تُعرض إلا في حالة واحدة: تعذُّر إرسال البريد. عندها تُبنى من
 * مجموعة بلا محارف ملتبسة (0/O و1/l/I) لأنها ستُنقل يدويًا، والالتباس
 * هنا يعني محاولة دخول فاشلة وشكوى.
 */
function generateTemporaryPassword(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = randomBytes(14);
  let password = '';
  for (const byte of bytes) password += alphabet[byte % alphabet.length];
  // رمز واحد على الأقل — بعض السياسات تشترطه
  return `${password}#7`;
}

/** وجهة روابط البريد: تبديل الرمز بجلسة ثم صفحة تعيين كلمة المرور */
const SET_PASSWORD_REDIRECT = () =>
  `${serverEnv.appUrl}/auth/callback?next=/reset-password`;

/**
 * إرسال رابط «عيّن كلمة مرورك» إلى صاحب البريد.
 *
 * يُستعمل مسار الاستعادة لا مسار الدعوة، وهذا مقصود: الدعوة تُنشئ
 * حسابًا غير مؤكَّد لا يمكن إعادة إرسالها إليه (المستخدم صار موجودًا)،
 * فيعلق الموظف الذي ضاعت رسالته الأولى بلا مخرج. أما الاستعادة فتصلح
 * للحساب نفسه مرارًا، وهي المسار الذي يُختبر في كل نشر.
 *
 * يُرجع سبب الفشل نصًّا، أو null عند النجاح.
 */
async function sendSetPasswordEmail(email: string): Promise<string | null> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: SET_PASSWORD_REDIRECT(),
    });
    if (error) {
      logger.warn('تعذّر إرسال رابط تعيين كلمة المرور', { reason: error.message });
      return error.message;
    }
    return null;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    logger.warn('تعذّر إرسال رابط تعيين كلمة المرور', { reason });
    return reason;
  }
}

/**
 * إضافة مستخدم إلى الشركة.
 *
 * يستخدم مفتاح الخدمة لأن إنشاء حساب في auth.users يتطلب صلاحيات إدارية،
 * لكن التحقق من الصلاحية يسبق ذلك، وكل الحقول تُثبَّت على شركة المُنفِّذ
 * بدل الوثوق بأي معرّف قادم من العميل.
 */
export async function inviteUserAction(formData: FormData): Promise<ActionResult> {
  try {
    const { profile, company } = await requirePermission('users.manage');

    const parsed = userInviteSchema.safeParse({
      fullName: formData.get('fullName'),
      email: formData.get('email'),
      role: formData.get('role'),
      departmentId: formData.get('departmentId') || null,
      jobTitle: formData.get('jobTitle'),
    });

    if (!parsed.success) {
      throw new AppError('VALIDATION', firstIssueMessage(parsed.error));
    }

    const input = parsed.data;
    const supabase = await createClient();

    // القسم يجب أن يكون تابعًا لنفس الشركة — RLS تضمن ذلك عند القراءة
    if (input.departmentId) {
      const { data: department } = await supabase
        .from('departments')
        .select('id')
        .eq('id', input.departmentId)
        .maybeSingle();
      if (!department) throw new AppError('VALIDATION', 'القسم المختار غير صالح.');
    }

    const admin = createAdminClient();

    const { data: existing } = await admin
      .from('profiles')
      .select('id, company_id')
      .eq('email', input.email)
      .maybeSingle();

    if (existing) {
      throw new AppError(
        'VALIDATION',
        existing.company_id === company.id
          ? 'هذا المستخدم مضاف إلى شركتك بالفعل.'
          : 'هذا البريد الإلكتروني مرتبط بحساب آخر على المنصة.',
      );
    }

    // ---------------------------------------------------------------
    // إنشاء الحساب.
    //
    // كلمة المرور لا تمرّ بالمدير: يُنشأ الحساب بكلمة عشوائية لا تُعرض
    // ولا تُسجَّل، ثم يصل الموظفَ رابطٌ على بريده يضع فيه كلمة مروره
    // بنفسه. أن ينقل المديرُ كلمةَ مرور بواتساب أو شفاهةً يعني أن سرّ
    // الحساب مرّ بطرف ثالث وبقي في محادثة لا تُمحى — والموظف قد لا
    // يغيّرها أبدًا.
    //
    // ويُؤكَّد البريد صراحةً (email_confirm) لأن رسالة التأكيد المنفصلة
    // خطوة زائدة تُربك الموظف وتُوقف حسابه إن ضاعت؛ فتح رابط تعيين
    // كلمة المرور يثبت ملكية البريد بذاته.
    //
    // ولا يُعرض السرّ للمدير إلا إن تعذّر إرسال البريد فعلًا — وإلا لَما
    // استطاعت شركة إضافة موظف واحد حتى يُضبط SMTP، فيتوقف التبنّي عند
    // أول خطوة.
    // ---------------------------------------------------------------
    const initialPassword = generateTemporaryPassword();

    const { data: createdUser, error: createError } = await admin.auth.admin.createUser({
      email: input.email,
      password: initialPassword,
      email_confirm: true,
      user_metadata: { full_name: input.fullName },
    });

    if (createError || !createdUser.user) {
      logger.warn('تعذّر إنشاء المستخدم', { reason: createError?.message });
      throw new AppError('INTERNAL', 'تعذّر إنشاء الحساب. تأكد أن البريد غير مستخدم.');
    }

    const created = { user: { id: createdUser.user.id } };

    const emailFailure = await sendSetPasswordEmail(input.email);
    // لا تُعرض الكلمة إلا عند فشل البريد — وهي حينها المخرج الوحيد
    const temporaryPassword = emailFailure ? initialPassword : undefined;

    const { error: profileError } = await admin
      .from('profiles')
      .update({
        company_id: company.id,
        department_id: input.departmentId || null,
        full_name: input.fullName,
        email: input.email,
        job_title: input.jobTitle || null,
        role: input.role,
        // «مدعو» حتى يفتح الموظف الرابط ويضع كلمته — عندها يُفعَّل في
        // مسار /auth/callback. أما إن سلّمه المدير كلمة مؤقتة فهو قادر
        // على الدخول فورًا، فحالته نشطة.
        status: temporaryPassword ? 'ACTIVE' : 'INVITED',
      })
      .eq('id', created.user.id);

    if (profileError) {
      logger.error('تعذّر ربط المستخدم بالشركة', { reason: profileError.message });
      throw new AppError('INTERNAL');
    }

    await recordAudit({
      companyId: company.id,
      actorId: profile.id,
      actorEmail: profile.email,
      action: 'user.invited',
      entityType: 'profile',
      entityId: created.user.id,
      metadata: { role: input.role, emailSent: !temporaryPassword },
    });

    revalidatePath('/users');
    if (temporaryPassword) {
      return {
        ok: true,
        temporaryPassword,
        message:
          `أُنشئ حساب ${input.email} لكن تعذّر إرسال البريد. ` +
          'انسخ كلمة المرور المؤقتة وسلّمها للموظف — لن تظهر مرة أخرى.',
      };
    }

    return {
      ok: true,
      message: `أُنشئ الحساب وأُرسل إلى ${input.email} رابط يضع به كلمة مروره.`,
    };
  } catch (error) {
    return { ok: false, message: toAppError(error).message };
  }
}

/**
 * إعادة إرسال رابط تعيين كلمة المرور إلى موظف.
 *
 * الرسالة الأولى تضيع كثيرًا — مجلد المزعج، بريد كُتب بخطأ مطبعي، موظف
 * أجّل فتحها حتى انتهت صلاحيتها. وبلا هذا الزر يكون الحل الوحيد حذف
 * الحساب وإعادة إنشائه، أو أن يمرّ الموظف بـ«نسيت كلمة المرور؟» لكلمة
 * لم يضعها قط.
 *
 * لا يُعيد أبدًا كلمة مرور: الغاية أن يبقى السرّ بين المنصة والموظف.
 */
export async function resendAccessLinkAction(userId: string): Promise<ActionResult> {
  try {
    const { profile, company } = await requirePermission('users.manage');

    const supabase = await createClient();

    // القراءة عبر عميل المستخدم لا مفتاح الخدمة: RLS تمنع بذاتها
    // استهداف موظف في شركة أخرى، ثم يُتحقق من الشركة صراحةً كطبقة ثانية.
    const { data: target } = await supabase
      .from('profiles')
      .select('id, email, status, company_id')
      .eq('id', userId)
      .maybeSingle();

    if (!target || target.company_id !== company.id) {
      throw new AppError('NOT_FOUND', 'المستخدم غير موجود في شركتك.');
    }

    if (target.status === 'DISABLED') {
      throw new AppError(
        'VALIDATION',
        'الحساب معطّل. فعّله أولًا ثم أعد إرسال الرابط.',
      );
    }

    if (!target.email) {
      throw new AppError('VALIDATION', 'لا يوجد بريد إلكتروني مسجّل لهذا المستخدم.');
    }

    const failure = await sendSetPasswordEmail(target.email);

    if (failure) {
      throw new AppError(
        'INTERNAL',
        'تعذّر إرسال البريد الآن. تأكد من إعداد مزوّد البريد ثم أعد المحاولة.',
      );
    }

    await recordAudit({
      companyId: company.id,
      actorId: profile.id,
      actorEmail: profile.email,
      action: 'user.access_link_resent',
      entityType: 'profile',
      entityId: target.id,
    });

    return {
      ok: true,
      message: `أُرسل رابط تعيين كلمة المرور إلى ${target.email}.`,
    };
  } catch (error) {
    return { ok: false, message: toAppError(error).message };
  }
}

export async function updateUserAction(formData: FormData): Promise<ActionResult> {
  try {
    const { profile, company } = await requirePermission('users.manage');

    const parsed = userUpdateSchema.safeParse({
      userId: formData.get('userId'),
      fullName: formData.get('fullName'),
      role: formData.get('role'),
      departmentId: formData.get('departmentId') || null,
      jobTitle: formData.get('jobTitle'),
      status: formData.get('status'),
    });

    if (!parsed.success) {
      throw new AppError('VALIDATION', firstIssueMessage(parsed.error));
    }

    const input = parsed.data;

    // منع مدير الشركة من إسقاط صلاحيات نفسه وترك الشركة بلا مدير
    if (input.userId === profile.id) {
      if (input.role !== profile.role) {
        throw new AppError('VALIDATION', 'لا يمكنك تغيير دورك بنفسك.');
      }
      if (input.status !== 'ACTIVE') {
        throw new AppError('VALIDATION', 'لا يمكنك تعطيل حسابك بنفسك.');
      }
    }

    const supabase = await createClient();

    const { data: target } = await supabase
      .from('profiles')
      .select('id, role, status, company_id')
      .eq('id', input.userId)
      .maybeSingle();

    if (!target || target.company_id !== company.id) {
      throw new AppError('NOT_FOUND', 'المستخدم غير موجود في شركتك.');
    }

    // لا تُترك الشركة بلا مدير نشط
    const isDemotingLastAdmin =
      target.role === 'COMPANY_ADMIN' &&
      (input.role !== 'COMPANY_ADMIN' || input.status !== 'ACTIVE');

    if (isDemotingLastAdmin) {
      const { count } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'COMPANY_ADMIN')
        .eq('status', 'ACTIVE');

      if ((count ?? 0) <= 1) {
        throw new AppError(
          'VALIDATION',
          'لا يمكن إزالة آخر مدير نشط للشركة. عيّن مديرًا آخر أولًا.',
        );
      }
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: input.fullName,
        role: input.role,
        department_id: input.departmentId || null,
        job_title: input.jobTitle || null,
        status: input.status,
      })
      .eq('id', input.userId);

    if (error) throw error;

    const roleChanged = target.role !== input.role;
    const statusChanged = target.status !== input.status;

    await recordAudit({
      companyId: company.id,
      actorId: profile.id,
      actorEmail: profile.email,
      action: roleChanged
        ? 'user.role_changed'
        : statusChanged && input.status === 'DISABLED'
          ? 'user.deactivated'
          : statusChanged
            ? 'user.reactivated'
            : 'user.updated',
      entityType: 'profile',
      entityId: input.userId,
      metadata: { role: input.role, status: input.status },
    });

    revalidatePath('/users');
    return { ok: true, message: 'تم تحديث بيانات المستخدم.' };
  } catch (error) {
    return { ok: false, message: toAppError(error).message };
  }
}
