import 'server-only';

import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { AppError } from '@/lib/errors';
import { can, type Permission } from '@/lib/auth/rbac';
import type { Company, Profile } from '@/types/database';

export interface SessionContext {
  userId: string;
  profile: Profile;
  company: Company | null;
}

/**
 * سياق المستخدم الحالي، أو null إن لم يكن مسجّلًا.
 *
 * مغلّف بـ cache() فلا يُستعلم أكثر من مرة في نفس الطلب
 * مهما تعددت المكوّنات التي تستدعيه.
 */
export const getSessionContext = cache(async (): Promise<SessionContext | null> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile || profile.status !== 'ACTIVE') return null;

  let company: Company | null = null;
  if (profile.company_id) {
    const { data } = await supabase
      .from('companies')
      .select('*')
      .eq('id', profile.company_id)
      .maybeSingle();
    company = data ?? null;
  }

  return { userId: user.id, profile, company };
});

/** يرمي خطأ إن لم يكن المستخدم مسجّلًا */
export async function requireSession(): Promise<SessionContext> {
  const session = await getSessionContext();
  if (!session) throw new AppError('UNAUTHENTICATED');
  return session;
}

/** يرمي خطأ إن لم يكن للمستخدم شركة نشطة */
export async function requireCompanySession(): Promise<
  SessionContext & { company: Company }
> {
  const session = await requireSession();
  if (!session.company) {
    throw new AppError('FORBIDDEN', 'حسابك غير مرتبط بأي شركة.');
  }
  if (session.company.status === 'SUSPENDED') {
    throw new AppError(
      'FORBIDDEN',
      'حساب الشركة موقوف حاليًا. يُرجى التواصل مع الدعم.',
    );
  }
  return { ...session, company: session.company };
}

/** يرمي خطأ إن لم تكن لدى المستخدم الصلاحية المطلوبة */
export async function requirePermission(
  permission: Permission,
): Promise<SessionContext & { company: Company }> {
  const session = await requireCompanySession();
  if (!can(session.profile.role, permission)) {
    throw new AppError('FORBIDDEN');
  }
  return session;
}

/** مدير المنصة فقط */
export async function requireSuperAdmin(): Promise<SessionContext> {
  const session = await requireSession();
  if (session.profile.role !== 'SUPER_ADMIN') {
    throw new AppError('FORBIDDEN');
  }
  return session;
}
