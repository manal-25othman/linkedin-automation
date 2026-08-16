'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { bootstrapCompany } from '@/lib/auth/bootstrap';
import { activateInvitedProfile } from '@/lib/auth/activation';
import { recordAudit } from '@/lib/audit';
import { loginSchema, registerSchema, firstIssueMessage } from '@/lib/validation/schemas';
import { logger } from '@/lib/logger';
import { serverEnv } from '@/lib/env';
import { headers } from 'next/headers';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';

import type { AuthFormState } from './form-state';

/** رسائل Supabase الإنجليزية تُترجم إلى رسائل عربية صالحة للعرض */
function translateAuthError(message: string): string {
  const normalized = message.toLowerCase();

  if (normalized.includes('invalid login credentials')) {
    return 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
  }
  if (normalized.includes('email not confirmed')) {
    return 'لم يتم تأكيد بريدك الإلكتروني بعد. راجع رسالة التأكيد في بريدك.';
  }
  if (normalized.includes('user already registered') || normalized.includes('already been registered')) {
    return 'هذا البريد الإلكتروني مسجّل مسبقًا. جرّب تسجيل الدخول بدلًا من ذلك.';
  }
  if (normalized.includes('rate limit') || normalized.includes('too many requests')) {
    return 'عدد كبير من المحاولات. يُرجى الانتظار قليلًا ثم المحاولة مجددًا.';
  }
  if (normalized.includes('password')) {
    return 'كلمة المرور لا تحقق الحد الأدنى من المتطلبات.';
  }
  return 'تعذّر إتمام العملية. حاول مرة أخرى.';
}


/**
 * حدّ محاولات المصادقة.
 *
 * يُحسب على البريد وعلى عنوان الشبكة معًا: الحدّ على العنوان وحده يمرّ
 * منه مهاجمٌ موزَّع على عناوين كثيرة يجرّب كلمات على حساب واحد، والحدّ
 * على البريد وحده يمرّ منه من يرشّ كلمة واحدة على آلاف الحسابات. وكلا
 * النمطين واقعي.
 *
 * ولا يُفرَّق في الرسالة بين بريد موجود وغير موجود — الرسالة واحدة —
 * كي لا يصير الحدّ نفسه أداة تعداد للحسابات.
 */
async function authRateLimited(email: string): Promise<boolean> {
  const headerList = await headers();
  const ip = headerList.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

  const byEmail = checkRateLimit(`auth-email:${email}`, RATE_LIMITS.auth);
  const byIp = checkRateLimit(`auth-ip:${ip}`, RATE_LIMITS.auth);

  return !byEmail.allowed || !byIp.allowed;
}

const RATE_LIMIT_MESSAGE =
  'محاولات كثيرة خلال وقت قصير. انتظر بضع دقائق ثم حاول مجددًا.';

export async function loginAction(
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    return { status: 'error', message: firstIssueMessage(parsed.error) };
  }

  if (await authRateLimited(parsed.data.email)) {
    logger.warn('تجاوز حدّ محاولات الدخول');
    return { status: 'error', message: RATE_LIMIT_MESSAGE };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    logger.warn('محاولة تسجيل دخول فاشلة', { reason: error.message });
    return { status: 'error', message: translateAuthError(error.message) };
  }

  if (data.user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id, status')
      .eq('id', data.user.id)
      .maybeSingle();

    if (profile?.status === 'DISABLED') {
      await supabase.auth.signOut();
      return {
        status: 'error',
        message: 'هذا الحساب معطّل. تواصل مع مدير الشركة.',
      };
    }

    // أول دخول لمستخدم مدعو يرفع حالته إلى ACTIVE
    const activation = await activateInvitedProfile({
      userId: data.user.id,
      status: profile?.status,
      companyId: profile?.company_id,
    });

    if (activation === 'PENDING_COMPANY') {
      await supabase.auth.signOut();
      return {
        status: 'error',
        message: 'حسابك غير مرتبط بأي شركة بعد. تواصل مع الدعم لإكمال التجهيز.',
      };
    }

    await recordAudit({
      companyId: profile?.company_id ?? null,
      actorId: data.user.id,
      actorEmail: data.user.email,
      action: 'auth.login',
    });
  }

  const redirectTo = String(formData.get('redirectTo') || '/dashboard');
  const safeRedirect = redirectTo.startsWith('/') ? redirectTo : '/dashboard';

  revalidatePath('/', 'layout');
  redirect(safeRedirect);
}

export async function registerAction(
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = registerSchema.safeParse({
    fullName: formData.get('fullName'),
    email: formData.get('email'),
    password: formData.get('password'),
    companyName: formData.get('companyName'),
    jobTitle: formData.get('jobTitle'),
  });

  if (!parsed.success) {
    return { status: 'error', message: firstIssueMessage(parsed.error) };
  }

  const { fullName, email, password, companyName, jobTitle } = parsed.data;

  if (await authRateLimited(email)) {
    logger.warn('تجاوز حدّ محاولات التسجيل');
    return { status: 'error', message: RATE_LIMIT_MESSAGE };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });

  if (error) {
    logger.warn('محاولة تسجيل فاشلة', { reason: error.message });
    return { status: 'error', message: translateAuthError(error.message) };
  }

  if (!data.user) {
    return { status: 'error', message: 'تعذّر إنشاء الحساب. حاول مرة أخرى.' };
  }

  // تجهيز الشركة والأقسام والتصنيفات والاشتراك التجريبي
  try {
    await bootstrapCompany({
      userId: data.user.id,
      email,
      fullName,
      companyName,
      jobTitle: jobTitle || undefined,
    });
  } catch (bootstrapError) {
    logger.error('فشل تجهيز الشركة بعد التسجيل', {
      reason: bootstrapError instanceof Error ? bootstrapError.message : String(bootstrapError),
    });
    return {
      status: 'error',
      message: 'تم إنشاء الحساب لكن تعذّر تجهيز الشركة. تواصل مع الدعم.',
    };
  }

  await recordAudit({
    companyId: null,
    actorId: data.user.id,
    actorEmail: email,
    action: 'auth.register',
    metadata: { companyName },
  });

  // إذا كان تأكيد البريد مفعّلًا في Supabase فلن تُنشأ جلسة الآن
  if (!data.session) {
    return {
      status: 'pending_confirmation',
      message:
        'تم إنشاء حسابك. أرسلنا رسالة تأكيد إلى بريدك الإلكتروني — افتح الرابط فيها لتفعيل الحساب.',
    };
  }

  revalidatePath('/', 'layout');
  redirect('/dashboard');
}

export async function logoutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/login');
}

/**
 * طلب رابط إعادة تعيين كلمة المرور.
 *
 * يُعاد النجاح دائمًا مهما كان البريد موجودًا أو لا. الرسالة المختلفة
 * («هذا البريد غير مسجّل») تحوّل الصفحة إلى أداة تعداد: يجرّب المهاجم
 * قائمة بريد فيعرف من منها مسجّل في المنصة، وذلك وحده معلومة تُباع.
 */
export async function requestPasswordResetAction(
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { status: 'error', message: 'أدخل بريدًا إلكترونيًا صحيحًا.' };
  }

  // يُطبَّق الحدّ بصمت: تغيير الرسالة عند التجاوز يكشف أن البريد جُرّب
  // كثيرًا، وهي معلومة لا داعي لمنحها.
  if (await authRateLimited(email)) {
    logger.warn('تجاوز حدّ طلبات استعادة كلمة المرور');
    return {
      status: 'success',
      message:
        'إن كان هذا البريد مسجّلًا لدينا فستصلك رسالة بها رابط إعادة التعيين خلال دقائق. ' +
        'تحقّق من مجلد الرسائل غير المرغوبة أيضًا.',
    };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${serverEnv.appUrl}/auth/callback?next=/reset-password`,
    });

    // يُسجَّل الفشل ولا يُعرض: قد يكون البريد غير مضبوط، وهي مشكلتنا
    // نحن لا مشكلة صاحب البريد.
    if (error) {
      logger.warn('تعذّر إرسال رابط إعادة التعيين', { reason: error.message });
    }
  } catch (error) {
    logger.warn('تعذّر إرسال رابط إعادة التعيين', {
      reason: error instanceof Error ? error.message : String(error),
    });
  }

  return {
    status: 'success',
    message:
      'إن كان هذا البريد مسجّلًا لدينا فستصلك رسالة بها رابط إعادة التعيين خلال دقائق. ' +
      'تحقّق من مجلد الرسائل غير المرغوبة أيضًا.',
  };
}

/**
 * تعيين كلمة مرور جديدة.
 *
 * يُستدعى بعد أن يفتح المستخدم الرابط، فتكون Supabase قد أنشأت جلسة
 * مؤقتة له. غياب الجلسة يعني رابطًا منتهيًا أو مستعملًا.
 */
export async function updatePasswordAction(
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirmPassword') ?? '');

  if (password.length < 8) {
    return { status: 'error', message: 'كلمة المرور يجب ألّا تقل عن ٨ محارف.' };
  }
  if (password !== confirm) {
    return { status: 'error', message: 'كلمتا المرور غير متطابقتين.' };
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) {
    return {
      status: 'error',
      message: 'انتهت صلاحية الرابط أو استُعمل من قبل. اطلب رابطًا جديدًا.',
    };
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { status: 'error', message: translateAuthError(error.message) };
  }

  await recordAudit({
    companyId: null,
    actorId: userData.user.id,
    actorEmail: userData.user.email ?? null,
    action: 'auth.password_reset',
    entityType: 'profile',
    entityId: userData.user.id,
  });

  revalidatePath('/', 'layout');
  redirect('/dashboard');
}
