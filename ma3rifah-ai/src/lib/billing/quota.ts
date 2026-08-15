import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';

/**
 * فرض حدود الخطة.
 *
 * الفحص في قاعدة البيانات لا في التطبيق: الحدّ يقاس على صفوف فعلية،
 * والدالة `security definer` تقرأ الاشتراك والخطة بنفسها. ولو حُسب هنا
 * لاحتاج التطبيق قراءة الاشتراك ثم العدّ ثم المقارنة — ثلاث خطوات بينها
 * فجوات، وكلٌّ منها موضع خطأ.
 *
 * والحدّ ‎-1‎ يعني «بلا حد» (خطة Enterprise) لا حدًّا سالبًا.
 */

interface QuotaRow {
  allowed: boolean;
  used: number;
  quota: number;
}

/**
 * تعذُّر الفحص لا يمنع العملية.
 *
 * لو رُفض الرفع لأن دالة الحصة غير موجودة — قاعدة لم تُطبَّق عليها
 * الترحيلات بعد — لتعطّلت المنصة كلها على عميل يدفع بسبب عطل عندنا لا
 * عنده. الأسلم أن يمرّ، ويُسجَّل التعذّر كي لا يمرّ صامتًا.
 */
async function readQuota(
  rpc: 'check_user_quota' | 'check_document_quota',
): Promise<QuotaRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(rpc);

  if (error) {
    logger.warn('تعذّر فحص حدّ الخطة', { rpc, reason: error.message });
    return null;
  }

  return (data as QuotaRow[] | null)?.[0] ?? null;
}

/** يرمي QUOTA_EXCEEDED إن بلغت الشركة حدّ المستخدمين */
export async function enforceUserQuota(): Promise<void> {
  const quota = await readQuota('check_user_quota');
  if (!quota || quota.allowed) return;

  throw new AppError(
    'QUOTA_EXCEEDED',
    `بلغت خطتك الحد الأقصى للمستخدمين (${quota.quota}). ` +
      'عطّل مستخدمًا غير نشط أو رقِّ الخطة لإضافة المزيد.',
  );
}

/** يرمي QUOTA_EXCEEDED إن بلغت الشركة حدّ المستندات */
export async function enforceDocumentQuota(): Promise<void> {
  const quota = await readQuota('check_document_quota');
  if (!quota || quota.allowed) return;

  throw new AppError(
    'QUOTA_EXCEEDED',
    `بلغت خطتك الحد الأقصى للمستندات (${quota.quota}). ` +
      'أرشِف مستندًا لم يعد مستخدمًا أو رقِّ الخطة.',
  );
}

/**
 * يرمي QUOTA_EXCEEDED إن كان الملف القادم يتجاوز مساحة التخزين.
 *
 * يُفحص بحجم الملف قبل رفعه لا بعده: الفحص البعدي يقبل الملف ثم يشكو،
 * فيبقى محمَّلًا على حساب لم يشترِ مساحته.
 */
export async function enforceStorageQuota(incomingBytes: number): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('check_storage_quota', {
    p_incoming_bytes: incomingBytes,
  });

  if (error) {
    logger.warn('تعذّر فحص حدّ التخزين', { reason: error.message });
    return;
  }

  const quota = (data as { allowed: boolean; used_mb: number; quota_mb: number }[] | null)?.[0];
  if (!quota || quota.allowed) return;

  throw new AppError(
    'QUOTA_EXCEEDED',
    `لا تتسع مساحة التخزين في خطتك لهذا الملف ` +
      `(المستخدَم ${quota.used_mb} من ${quota.quota_mb} ميغابايت). ` +
      'أرشِف مستندات لم تعد مستخدمة أو رقِّ الخطة.',
  );
}
