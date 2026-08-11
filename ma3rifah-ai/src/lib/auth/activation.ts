import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/logger';

/**
 * تفعيل ملف مدعو بعد أول تسجيل دخول ناجح.
 *
 * الحالة INVITED تعني أن الملف أُنشئ (بمُحفِّز التسجيل أو بدعوة من مدير
 * الشركة) ولم يُستخدم بعد. سياسات RLS تمنع المستخدم من تعديل حالته
 * بنفسه، لذا تتم الترقية بمفتاح الخدمة على الخادم — وفقط بعد أن يثبت
 * Supabase Auth هويته، ولملف مرتبط بشركة فعلًا.
 *
 * تُعيد الحالة النهائية للملف حتى يقرر المُستدعي ما يعرضه للمستخدم.
 */
export async function activateInvitedProfile(params: {
  userId: string;
  status: string | null | undefined;
  companyId: string | null | undefined;
}): Promise<'ACTIVE' | 'PENDING_COMPANY' | 'UNCHANGED'> {
  if (params.status !== 'INVITED') return 'UNCHANGED';

  // ملف بلا شركة = تسجيل لم يكتمل تجهيزه؛ لا يُفعَّل قبل ربطه بشركة
  if (!params.companyId) return 'PENDING_COMPANY';

  const admin = createAdminClient();
  const { error } = await admin
    .from('profiles')
    .update({ status: 'ACTIVE' })
    .eq('id', params.userId)
    .eq('status', 'INVITED');

  if (error) {
    logger.error('تعذّر تفعيل ملف مدعو', { reason: error.message });
    return 'UNCHANGED';
  }

  return 'ACTIVE';
}
