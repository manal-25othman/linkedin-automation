import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { serverEnv } from '@/lib/env';
import { logger } from '@/lib/logger';

/**
 * التسجيل بدعوة.
 *
 * في مرحلة التجربة يكفي أن يشارك مجرِّبٌ رابط التسجيل في مجموعة واحدة
 * حتى تُنشأ حسابات لا تعرفها المالكة ولم توقّع اتفاقية، تستهلك من رصيد
 * النموذج بلا مقابل وتُفسد قياس التحويل.
 *
 * وإخفاء الرابط ليس حلًّا: صفحة `/register` قائمة في البناء سواء رُبط
 * إليها أم لا، والرابط يُكتشف.
 *
 * ---------------------------------------------------------------------
 * الوضع الافتراضي: **مغلق**
 *
 * فمتغيّر بيئة غائب أو مكتوب خطأً يعني «بدعوة» لا «مفتوح». والاتجاه
 * مقصود: خطأُ إعدادٍ يمنع تسجيلًا مشروعًا يُكتشف في دقائق ويُصلَح،
 * وخطأُ إعدادٍ يفتح الباب للعالم لا يُكتشف إلا بعد أن يدخل من دخل.
 * ---------------------------------------------------------------------
 */

export type RegistrationMode = 'invite' | 'open';

export function registrationMode(): RegistrationMode {
  return serverEnv.registrationMode === 'open' ? 'open' : 'invite';
}

export function inviteRequired(): boolean {
  return registrationMode() === 'invite';
}

export interface InviteCheck {
  valid: boolean;
  /** لمن أُصدرت الدعوة — يُعرض للطمأنة لا للتحقّق */
  label: string | null;
}

/**
 * التحقّق من الرمز **بلا استهلاك**.
 *
 * يُنادى قبل إنشاء الحساب ليظهر الخطأ مبكرًا. ولو استُهلك هنا لَأحرق
 * خطأٌ في كلمة المرور بعده دعوةً كاملة.
 */
export async function checkInviteCode(code: string): Promise<InviteCheck> {
  if (!inviteRequired()) return { valid: true, label: null };

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc('check_invite_code', { p_code: code });
    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : data;
    return { valid: Boolean(row?.valid), label: row?.label ?? null };
  } catch (cause) {
    // لا يُسجَّل الرمز نفسه: هو مفتاح باب
    logger.error('تعذّر التحقق من رمز الدعوة', {
      reason: cause instanceof Error ? cause.message : String(cause),
    });
    // فشل التحقّق يُغلق لا يفتح
    return { valid: false, label: null };
  }
}

/**
 * استهلاك الرمز بعد نجاح التسجيل.
 *
 * والعدّ ذرّيّ داخل القاعدة بقفل الصفّ: بلا قفل يقرأ طلبان متزامنان
 * «بقي واحد» معًا فيمرّان معًا — وهو أوّل ما يُستغلّ في رمزٍ يُشارَك.
 */
export async function redeemInviteCode(params: {
  code: string;
  email: string;
  companyId?: string | null;
  userId?: string | null;
}): Promise<boolean> {
  if (!inviteRequired()) return true;

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc('redeem_invite_code', {
      p_code: params.code,
      p_email: params.email,
      p_company_id: params.companyId ?? null,
      p_user_id: params.userId ?? null,
    });
    if (error) throw error;
    return Boolean(data);
  } catch (cause) {
    logger.error('تعذّر استهلاك رمز الدعوة', {
      reason: cause instanceof Error ? cause.message : String(cause),
    });
    return false;
  }
}

/** رسالة واحدة لكل أسباب الرفض — لئلّا تصير أداةَ تخمين */
export const INVITE_REJECTED_MESSAGE =
  'رمز الدعوة غير صالح أو انتهت صلاحيته. تواصلي معنا للحصول على دعوة.';
