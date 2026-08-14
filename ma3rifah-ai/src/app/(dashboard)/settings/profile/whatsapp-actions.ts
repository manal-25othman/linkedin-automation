'use server';

import { revalidatePath } from 'next/cache';
import { requireCompanySession } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { enforceRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { recordAudit } from '@/lib/audit';
import { toAppError } from '@/lib/errors';
import { logger } from '@/lib/logger';

export interface LinkCodeResult {
  ok: boolean;
  code?: string;
  expiresAt?: string;
  message?: string;
}

/**
 * طلب رمز ربط واتساب.
 *
 * الرمز يُولَّد في قاعدة البيانات ويُربط بصاحب الجلسة هناك — لا يُمرَّر
 * معرّف مستخدم من العميل. وهذا نصف الإثبات؛ نصفه الآخر أن يصل الرمز من
 * الهاتف نفسه.
 */
export async function requestWhatsAppLinkCodeAction(): Promise<LinkCodeResult> {
  try {
    const { profile, company } = await requireCompanySession();
    enforceRateLimit(`wa-link:${profile.id}`, RATE_LIMITS.mutation);

    const supabase = await createClient();
    const { data, error } = await supabase.rpc('request_whatsapp_link_code');

    if (error || !data?.[0]) {
      logger.error('تعذّر توليد رمز ربط واتساب', { reason: error?.message });
      return { ok: false, message: 'تعذّر توليد الرمز. حاول مرة أخرى.' };
    }

    await recordAudit({
      companyId: company.id,
      actorId: profile.id,
      actorEmail: profile.email,
      action: 'whatsapp.link_code_requested',
      entityType: 'whatsapp_link',
      entityId: profile.id,
    });

    revalidatePath('/settings/profile');
    return { ok: true, code: data[0].code, expiresAt: data[0].expires_at };
  } catch (error) {
    return { ok: false, message: toAppError(error).message };
  }
}

/** إزالة الربط — تتكفّل RLS بقصر الحذف على صاحبه أو مدير الشركة */
export async function unlinkWhatsAppAction(): Promise<{ ok: boolean; message?: string }> {
  try {
    const { profile, company } = await requireCompanySession();
    const supabase = await createClient();

    const { error } = await supabase
      .from('whatsapp_links')
      .delete()
      .eq('user_id', profile.id);

    if (error) {
      logger.warn('تعذّر إزالة ربط واتساب', { reason: error.message });
      return { ok: false, message: 'تعذّر إزالة الربط.' };
    }

    await recordAudit({
      companyId: company.id,
      actorId: profile.id,
      actorEmail: profile.email,
      action: 'whatsapp.unlinked',
      entityType: 'whatsapp_link',
      entityId: profile.id,
    });

    revalidatePath('/settings/profile');
    return { ok: true };
  } catch (error) {
    return { ok: false, message: toAppError(error).message };
  }
}
