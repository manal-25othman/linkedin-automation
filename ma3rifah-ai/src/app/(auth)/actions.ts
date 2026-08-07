'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { bootstrapCompany } from '@/lib/auth/bootstrap';
import { recordAudit } from '@/lib/audit';
import { loginSchema, registerSchema, firstIssueMessage } from '@/lib/validation/schemas';
import { logger } from '@/lib/logger';

export interface AuthFormState {
  status: 'idle' | 'error' | 'pending_confirmation';
  message: string;
}

export const AUTH_INITIAL_STATE: AuthFormState = { status: 'idle', message: '' };

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
