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
 * كلمة مرور مؤقتة قابلة للنطق والنقل يدويًا.
 *
 * تُبنى من مجموعة بلا محارف ملتبسة (0/O و1/l/I): المدير سينقلها إلى
 * الموظف برسالة أو شفاهةً، والالتباس هنا يعني محاولة دخول فاشلة وشكوى.
 * والطول والعشوائية من crypto كافيان لكلمة تُبدَّل عند أول دخول.
 */
function generateTemporaryPassword(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = randomBytes(14);
  let password = '';
  for (const byte of bytes) password += alphabet[byte % alphabet.length];
  // رمز واحد على الأقل — بعض السياسات تشترطه
  return `${password}#7`;
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
    // تُجرَّب الدعوة بالبريد أولًا؛ فإن تعذّرت — وهو الغالب قبل ضبط
    // مزوّد بريد — يُنشأ الحساب بكلمة مرور مؤقتة تُعرض للمدير مرة
    // واحدة لينقلها للموظف. الاعتماد على البريد وحده يعني أن الشركة
    // لا تستطيع إضافة موظف واحد حتى يُضبط SMTP، وهذا يوقف التبنّي
    // كله عند أول خطوة.
    // ---------------------------------------------------------------
    let userId: string | null = null;
    let temporaryPassword: string | undefined;

    const invited = await admin.auth.admin.inviteUserByEmail(input.email, {
      data: { full_name: input.fullName },
      redirectTo: `${serverEnv.appUrl}/login`,
    });

    if (invited.data?.user && !invited.error) {
      userId = invited.data.user.id;
    } else {
      logger.info('تعذّرت الدعوة بالبريد — يُنشأ الحساب بكلمة مرور مؤقتة', {
        reason: invited.error?.message,
      });

      temporaryPassword = generateTemporaryPassword();
      const { data: createdUser, error: createError } = await admin.auth.admin.createUser({
        email: input.email,
        password: temporaryPassword,
        // يُؤكَّد البريد صراحةً: بلا مزوّد بريد لا تصل رسالة التأكيد،
        // فيبقى الحساب معلّقًا لا يستطيع صاحبه الدخول.
        email_confirm: true,
        user_metadata: { full_name: input.fullName },
      });

      if (createError || !createdUser.user) {
        logger.warn('تعذّر إنشاء المستخدم', { reason: createError?.message });
        throw new AppError('INTERNAL', 'تعذّر إنشاء الحساب. تأكد أن البريد غير مستخدم.');
      }
      userId = createdUser.user.id;
    }

    const created = { user: { id: userId } };

    const { error: profileError } = await admin
      .from('profiles')
      .update({
        company_id: company.id,
        department_id: input.departmentId || null,
        full_name: input.fullName,
        email: input.email,
        job_title: input.jobTitle || null,
        role: input.role,
        // بكلمة مرور مؤقتة يستطيع الموظف الدخول فورًا، فحالته نشطة لا
        // «مدعو» — و«مدعو» تعني في هذا النظام حسابًا لم يُفعَّل بعد.
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
      metadata: { role: input.role },
    });

    revalidatePath('/users');
    if (temporaryPassword) {
      return {
        ok: true,
        temporaryPassword,
        message:
          `أُنشئ حساب ${input.email}. انسخ كلمة المرور المؤقتة وسلّمها للموظف — ` +
          'لن تظهر مرة أخرى.',
      };
    }

    return { ok: true, message: `تم إرسال دعوة إلى ${input.email}.` };
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
