'use server';

import { revalidatePath } from 'next/cache';
import { requireCompanySession } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

/**
 * تعليم تنبيهات كمقروءة.
 *
 * لا يُمرَّر معرّف المستخدم من العميل: الدالة في قاعدة البيانات تشتقّه
 * من الجلسة وتقصر التحديث على صفوفه. فلا يستطيع أحد تعليم تنبيهات غيره
 * ولو أرسل معرّفاتها.
 */
export async function markNotificationsReadAction(ids?: string[]): Promise<{ ok: boolean }> {
  try {
    await requireCompanySession();
    const supabase = await createClient();

    const { error } = await supabase.rpc('mark_notifications_read', {
      p_ids: ids && ids.length > 0 ? ids : undefined,
    });

    if (error) {
      logger.warn('تعذّر تعليم التنبيهات كمقروءة', { reason: error.message });
      return { ok: false };
    }

    revalidatePath('/', 'layout');
    return { ok: true };
  } catch (error) {
    logger.warn('تعذّر تعليم التنبيهات كمقروءة', {
      reason: error instanceof Error ? error.message : String(error),
    });
    return { ok: false };
  }
}
